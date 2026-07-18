import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createObservationSession,
  failure,
  observationSessionApiVersion,
  type ObservationCoverage,
  type ObservationRecord,
  type Result,
} from "../../core/index.ts";
import { copyCanonicalGraphData } from "../../core/payload.ts";
import {
  createLocalObservationJournal,
  createLocalResourceProvider,
  localObservationJournalMinimumBytes,
  localObservationJournalResourceProfile,
  localObservationJournalSessionBounds,
  localObservationSessionLocator,
  workspaceResourceLocator,
  type LocalObservationJournalFaultPhase,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "../index.ts";

const temporaryRoots: string[] = [];
const crashChild = path.join(import.meta.dir, "fixtures", "observation-crash-child.ts");

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function roots() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-observation-journal-"));
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-observation-locks-"));
  temporaryRoots.push(workspaceRoot, coordinationRoot);
  return { coordinationRoot, workspaceRoot };
}

async function resources(value: Awaited<ReturnType<typeof roots>>) {
  return createLocalResourceProvider({
    ...localObservationJournalResourceProfile,
    ...value,
  });
}

function begin(epoch = "epoch-001", sourceId = "example.typescript") {
  return {
    apiVersion: observationSessionApiVersion,
    epoch,
    projectId: "project.local",
    scopes: [{ id: "app", resourceRoot: "src" }],
    source: { id: sourceId, instance: "workspace", version: "1.2.3" },
  } as const;
}

function lane(epoch = "epoch-001", sourceId = "example.typescript") {
  return {
    epoch,
    projectId: "project.local",
    source: { id: sourceId, instance: "workspace" },
  } as const;
}

function laneIdentity(sourceId = "example.typescript") {
  return {
    projectId: "project.local",
    source: { id: sourceId, instance: "workspace" },
  } as const;
}

function candidate(key = "api", name = "API"): ObservationRecord {
  return {
    candidate: { name, type: "service" },
    key,
    kind: "component-candidate",
    provenance: [
      {
        fingerprint: "sha256:aaaaaaaaaaaaaaaa",
        resource: "src/index.ts",
        scope: "app",
      },
    ],
    scope: "app",
  };
}

function coverage(): readonly ObservationCoverage[] {
  return [{ kinds: ["component-candidate"], scope: "app", state: "complete" }];
}

function codes(result: Result<unknown>): readonly string[] {
  return result.ok ? [] : result.diagnostics.map((item) => item.code);
}

function absoluteLocator(root: string, locator: WorkspaceResourceLocator): string {
  return path.join(root, ...String(locator).split("/"));
}

async function seed(
  provider: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  content: string,
) {
  const staged = await provider.stageReplacement(locator, new TextEncoder().encode(content));
  if (!staged.ok) throw new Error("seed stage failed");
  const committed = await provider.commitReplacement(staged.value);
  if (committed.state !== "committed") throw new Error("seed commit failed");
}

function providerWithCommitOverride(
  base: LocalResourceProvider,
  commitReplacement: LocalResourceProvider["commitReplacement"],
): LocalResourceProvider {
  const provider: LocalResourceProvider = {
    acquireCoordination: (request) => base.acquireCoordination(request),
    cleanupReplacementStages: (locator) => base.cleanupReplacementStages(locator),
    commitReplacement,
    discardReplacement: (handle) => base.discardReplacement(handle),
    enumerate: (request) => base.enumerate(request),
    read: (request) => base.read(request),
    releaseCoordination: (lease) => base.releaseCoordination(lease),
    removeResource: (locator) => base.removeResource(locator),
    stageReplacement: (locator, bytes) => base.stageReplacement(locator, bytes),
    withCoordination<T>(
      request: Parameters<LocalResourceProvider["withCoordination"]>[0],
      action: () => T | Promise<T>,
    ) {
      return base.withCoordination(request, action);
    },
  };
  return Object.freeze(provider);
}

function providerWithReleaseOverride(
  base: LocalResourceProvider,
  releaseCoordination: LocalResourceProvider["releaseCoordination"],
): LocalResourceProvider {
  const provider: LocalResourceProvider = {
    acquireCoordination: (request) => base.acquireCoordination(request),
    cleanupReplacementStages: (locator) => base.cleanupReplacementStages(locator),
    commitReplacement: (handle) => base.commitReplacement(handle),
    discardReplacement: (handle) => base.discardReplacement(handle),
    enumerate: (request) => base.enumerate(request),
    read: (request) => base.read(request),
    releaseCoordination,
    removeResource: (locator) => base.removeResource(locator),
    stageReplacement: (locator, bytes) => base.stageReplacement(locator, bytes),
    withCoordination<T>(
      request: Parameters<LocalResourceProvider["withCoordination"]>[0],
      action: () => T | Promise<T>,
    ) {
      return base.withCoordination(request, action);
    },
  };
  return Object.freeze(provider);
}

describe("local observation journal", () => {
  test("durably publishes begin, batches, heartbeat, completion, handoff and acknowledgement", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error(started.diagnostics[0]?.code);
    expect(
      await started.value.submitBatch({ epoch: "epoch-001", records: [candidate()], sequence: 1 }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 1 } });
    expect(await started.value.heartbeat({ epoch: "epoch-001", sequence: 2 })).toEqual({
      ok: true,
      value: undefined,
    });
    const completed = await started.value.complete({
      coverage: coverage(),
      epoch: "epoch-001",
      sequence: 3,
    });
    expect(completed).toEqual({ ok: true, value: undefined });

    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid fixture locator");
    const bytes = await readFile(absoluteLocator(location.workspaceRoot, locator.value));
    expect(bytes.at(-1)).toBe(10);
    expect(bytes.toString("utf8")).toStartWith('{"checkpoint":');
    expect(bytes.toString("utf8")).not.toContain(location.workspaceRoot);

    const first = await journal.handoff(lane());
    const second = await journal.handoff(lane());
    expect(first).toEqual(second);
    if (!first.ok) throw new Error(first.diagnostics[0]?.code);
    expect(first.value.token).toMatch(/^groma-observation-handoff-v1:[0-9a-f]{64}$/);
    expect(first.value.snapshot.records.map((record) => record.key)).toEqual(["api"]);
    expect(await journal.acknowledge({ ...lane(), token: first.value.token })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await journal.acknowledge({ ...lane(), token: first.value.token })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await createLocalObservationJournal({ resources: provider }).recover()).toEqual({
      ok: true,
      value: { abandoned: [], acknowledged: [lane()], handoffs: [] },
    });
  });

  test("restart abandons active sessions without exposing partial records as coverage", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    await started.value.submitBatch({ epoch: "epoch-001", records: [candidate()], sequence: 1 });

    const recovered = await createLocalObservationJournal({ resources: provider }).recover();
    expect(recovered).toMatchObject({
      ok: true,
      value: {
        abandoned: [
          {
            epoch: "epoch-001",
            kind: "recovered-incomplete",
            reason: { code: "observation-session-interrupted" },
          },
        ],
        handoffs: [],
      },
    });
    expect(await journal.handoff(lane())).toMatchObject({
      ok: false,
      diagnostics: [{ code: "stale-observation-lane" }],
    });
  });

  test("restart offers the identical complete snapshot until downstream acknowledgement", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    await started.value.submitBatch({ epoch: "epoch-001", records: [candidate()], sequence: 1 });
    await started.value.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 2 });

    const first = await createLocalObservationJournal({ resources: provider }).recover();
    const second = await createLocalObservationJournal({ resources: provider }).recover();
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      value: { handoffs: [{ epoch: "epoch-001", snapshot: { records: [{ key: "api" }] } }] },
    });
  });

  test("contradictions and every incomplete terminal outcome become durable abandonment", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const contradictory = await journal.begin(begin("epoch-contradiction", "source.contradiction"));
    if (!contradictory.ok) throw new Error("begin failed");
    await contradictory.value.submitBatch({
      epoch: "epoch-contradiction",
      records: [candidate()],
      sequence: 1,
    });
    expect(
      codes(
        await contradictory.value.submitBatch({
          epoch: "epoch-contradiction",
          records: [candidate("api", "Different")],
          sequence: 2,
        }),
      ),
    ).toEqual(["contradictory-observation"]);

    const cancelled = await journal.begin(begin("epoch-cancel", "source.cancel"));
    const expired = await journal.begin(begin("epoch-expire", "source.expire"));
    const failed = await journal.begin(begin("epoch-fail", "source.fail"));
    if (!cancelled.ok || !expired.ok || !failed.ok) throw new Error("terminal begin failed");
    await cancelled.value.cancel({ epoch: "epoch-cancel", sequence: 1 });
    await expired.value.expire({ epoch: "epoch-expire", heartbeatSequence: 0 });
    await failed.value.fail({
      epoch: "epoch-fail",
      reason: { code: "scanner-failed", message: "Parser failed" },
      sequence: 1,
    });

    const recovered = await journal.recover();
    if (!recovered.ok) throw new Error(recovered.diagnostics[0]?.code);
    expect(recovered.value.abandoned.map((item) => item.kind).sort()).toEqual([
      "cancelled",
      "contradictory",
      "expired",
      "failed",
    ]);
    expect(recovered.value.abandoned.find((item) => item.kind === "failed")).toEqual({
      epoch: "epoch-fail",
      kind: "failed",
      lane: {
        projectId: "project.local",
        source: { id: "source.fail", instance: "workspace" },
      },
      reason: { code: "scanner-failed", message: "Parser failed" },
    });
    expect(recovered.value.handoffs).toEqual([]);
  });

  test("a newer epoch durably supersedes the lane and fences the old handle before body inspection", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const old = await journal.begin(begin("epoch-old"));
    if (!old.ok) throw new Error("begin failed");
    expect(codes(await journal.begin(begin("epoch-new")))).toEqual([
      "observation-session-superseded",
    ]);
    const current = await journal.begin(begin("epoch-new"));
    if (!current.ok) throw new Error("retry begin failed");
    const hostileRecords = new Proxy([] as ObservationRecord[], {
      getPrototypeOf() {
        throw new Error("stale lane must not inspect operation body");
      },
    });
    expect(
      codes(
        await old.value.submitBatch({ epoch: "epoch-old", records: hostileRecords, sequence: 1 }),
      ),
    ).toEqual(["stale-observation-lane"]);
    expect(
      await current.value.complete({ coverage: coverage(), epoch: "epoch-new", sequence: 1 }),
    ).toMatchObject({ ok: true });
  });

  test("a completed lane cannot be replaced until its exact handoff is acknowledged", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const current = await journal.begin(begin("epoch-current"));
    if (!current.ok) throw new Error("begin failed");
    await current.value.complete({
      coverage: coverage(),
      epoch: "epoch-current",
      sequence: 1,
    });

    expect(codes(await journal.begin(begin("epoch-next")))).toEqual([
      "observation-completion-awaiting-acknowledgement",
    ]);
    const handoff = await journal.handoff(lane("epoch-current"));
    if (!handoff.ok) throw new Error("handoff failed");
    expect(codes(await journal.begin(begin("epoch-next")))).toEqual([
      "observation-completion-awaiting-acknowledgement",
    ]);
    await journal.acknowledge({ ...lane("epoch-current"), token: handoff.value.token });
    expect(await journal.begin(begin("epoch-next"))).toMatchObject({ ok: true });
  });

  test("a completed checkpoint forged as superseded fails closed without losing its handoff", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const current = await journal.begin(begin("epoch-completed"));
    if (!current.ok) throw new Error("begin failed");
    await current.value.submitBatch({
      epoch: "epoch-completed",
      records: [candidate()],
      sequence: 1,
    });
    await current.value.complete({
      coverage: coverage(),
      epoch: "epoch-completed",
      sequence: 2,
    });
    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid fixture locator");
    const absolute = absoluteLocator(location.workspaceRoot, locator.value);
    const forged = JSON.parse(await readFile(absolute, "utf8")) as Record<string, unknown>;
    forged.delivery = null;
    forged.lifecycle = {
      reason: {
        code: "observation-session-superseded",
        kind: "superseded",
        message: "Observation session was superseded by a newer epoch",
      },
      state: "abandoned",
    };
    const canonical = copyCanonicalGraphData(forged, "transaction");
    if (!canonical.ok) throw new Error("forged fixture canonicalization failed");
    const forgedBytes = `${canonical.value.canonicalJson}\n`;
    await writeFile(absolute, forgedBytes);

    expect(codes(await journal.recover())).toEqual(["malformed-observation-journal"]);
    expect(codes(await journal.begin(begin("epoch-next")))).toEqual([
      "malformed-observation-journal",
    ]);
    expect(await readFile(absolute, "utf8")).toBe(forgedBytes);
  });

  test("concurrent operations are rejected without inspecting the losing body", async () => {
    const location = await roots();
    const provider = await resources(location);
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    const journal = createLocalObservationJournal({
      async faultInjector(phase) {
        if (phase === "after-batch") {
          entered();
          await gate;
        }
      },
      resources: provider,
    });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    const first = started.value.submitBatch({
      epoch: "epoch-001",
      records: [candidate()],
      sequence: 1,
    });
    await waiting;
    const hostile = new Proxy([] as ObservationRecord[], {
      getPrototypeOf() {
        throw new Error("concurrent body must not be inspected");
      },
    });
    expect(
      codes(await started.value.submitBatch({ epoch: "epoch-001", records: hostile, sequence: 2 })),
    ).toEqual(["observation-session-operation-in-progress"]);
    release();
    expect(await first).toMatchObject({ ok: true });
  });

  test("a divergent durable checkpoint is stale before the handle inspects its operation body", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid fixture locator");
    const absolute = absoluteLocator(location.workspaceRoot, locator.value);
    const stored = JSON.parse(await readFile(absolute, "utf8")) as Record<string, unknown>;
    const divergent = createObservationSession(begin(), localObservationJournalSessionBounds);
    if (!divergent.ok) throw new Error("divergent fixture begin failed");
    const submitted = divergent.value.submitBatch({
      epoch: "epoch-001",
      records: [candidate("worker")],
      sequence: 1,
    });
    if (!submitted.ok) throw new Error("divergent fixture batch failed");
    stored.checkpoint = divergent.value.checkpoint();
    const canonical = copyCanonicalGraphData(stored, "transaction");
    if (!canonical.ok) throw new Error("divergent fixture canonicalization failed");
    await writeFile(absolute, `${canonical.value.canonicalJson}\n`);

    const hostile = new Proxy([] as ObservationRecord[], {
      getPrototypeOf() {
        throw new Error("stale checkpoint must not inspect operation body");
      },
    });
    expect(
      codes(
        await started.value.submitBatch({
          epoch: "epoch-001",
          records: hostile,
          sequence: 1,
        }),
      ),
    ).toEqual(["stale-observation-lane"]);
  });

  test("an unconfirmed publication poisons the handle before later hostile bodies", async () => {
    const location = await roots();
    const base = await resources(location);
    let armed = false;
    const provider = providerWithCommitOverride(base, async (handle) =>
      armed ? { state: "not-committed" } : base.commitReplacement(handle),
    );
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    const confirmedInspection = started.value.inspect();
    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid fixture locator");
    const absolute = absoluteLocator(location.workspaceRoot, locator.value);
    const confirmedBytes = await readFile(absolute);
    armed = true;
    expect(
      codes(
        await started.value.submitBatch({
          epoch: "epoch-001",
          records: [candidate()],
          sequence: 1,
        }),
      ),
    ).toEqual(["observation-journal-publication-unconfirmed"]);
    expect(started.value.inspect()).toEqual(confirmedInspection);
    expect(await readFile(absolute)).toEqual(confirmedBytes);
    const hostile = new Proxy([] as ObservationRecord[], {
      getPrototypeOf() {
        throw new Error("poisoned handle must not inspect later bodies");
      },
    });
    expect(
      codes(await started.value.submitBatch({ epoch: "epoch-001", records: hostile, sequence: 2 })),
    ).toEqual(["observation-session-handle-poisoned"]);
  });

  test("inspection advances after confirmed publication before a post-publication fault", async () => {
    const location = await roots();
    const provider = await resources(location);
    let armed = false;
    const journal = createLocalObservationJournal({
      faultInjector(phase) {
        if (armed && phase === "after-batch") throw new Error("stop after durable batch");
      },
      resources: provider,
    });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    armed = true;
    expect(
      codes(
        await started.value.submitBatch({
          epoch: "epoch-001",
          records: [candidate()],
          sequence: 1,
        }),
      ),
    ).toEqual(["observation-journal-fault"]);
    expect(started.value.inspect()).toMatchObject({
      lastSequence: 1,
      recordCount: 1,
      signalCount: 1,
    });
    expect(codes(await started.value.heartbeat({ epoch: "epoch-001", sequence: 2 }))).toEqual([
      "observation-session-handle-poisoned",
    ]);
  });

  test("an unconfirmed persistent-lease release reports uncertainty and poisons applied handles", async () => {
    const location = await roots();
    const base = await resources(location);
    let armed = false;
    let releases = 0;
    const provider = providerWithReleaseOverride(base, async (lease) => {
      if (armed && releases < 2) {
        releases += 1;
        return failure({
          code: "resource-coordination-release-failed",
          message: "Release could not yet be confirmed",
        });
      }
      return base.releaseCoordination(lease);
    });
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    armed = true;
    const applied = await started.value.submitBatch({
      epoch: "epoch-001",
      records: [candidate()],
      sequence: 1,
    });
    expect(codes(applied)).toEqual(["observation-journal-coordination-release-unconfirmed"]);
    expect(applied.ok ? undefined : applied.diagnostics[0]?.details?.actionCompleted).toBeTrue();
    expect(started.value.inspect()).toMatchObject({
      lastSequence: 1,
      recordCount: 1,
      signalCount: 1,
    });
    const hostile = new Proxy([] as ObservationRecord[], {
      getPrototypeOf() {
        throw new Error("release-uncertain handle must not inspect later bodies");
      },
    });
    expect(
      codes(await started.value.submitBatch({ epoch: "epoch-001", records: hostile, sequence: 2 })),
    ).toEqual(["observation-session-handle-poisoned"]);

    expect(releases).toBe(2);
    const other = await journal.begin(begin("epoch-other", "source.other"));
    expect(other.ok).toBeTrue();

    const recovered = await journal.recover();
    expect(recovered.ok).toBeTrue();
    if (!recovered.ok) throw new Error("recovery failed");
    expect(
      recovered.value.abandoned
        .map((item) => ({ epoch: item.epoch, kind: item.kind, source: item.lane.source.id }))
        .sort((left, right) => left.source.localeCompare(right.source)),
    ).toEqual([
      { epoch: "epoch-001", kind: "recovered-incomplete", source: "example.typescript" },
      { epoch: "epoch-other", kind: "recovered-incomplete", source: "source.other" },
    ]);
    expect(await journal.recover()).toEqual(recovered);
  });

  test("a thrown release acknowledgement is settled before a fresh lane acquisition", async () => {
    const location = await roots();
    const base = await resources(location);
    let armed = false;
    let thrownAcknowledgements = 0;
    const provider = providerWithReleaseOverride(base, async (lease) => {
      const released = await base.releaseCoordination(lease);
      if (armed && released.ok && thrownAcknowledgements < 2) {
        thrownAcknowledgements += 1;
        throw new Error("release succeeded but its acknowledgement was lost");
      }
      return released;
    });
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    armed = true;
    expect(
      codes(
        await started.value.submitBatch({
          epoch: "epoch-001",
          records: [candidate()],
          sequence: 1,
        }),
      ),
    ).toEqual(["observation-journal-coordination-release-unconfirmed"]);
    expect(thrownAcknowledgements).toBe(2);

    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid fixture locator");
    const before = await readFile(absoluteLocator(location.workspaceRoot, locator.value));
    const competitor = await resources(location);
    const held = await competitor.acquireCoordination({
      context: "local-machine",
      locator: locator.value,
    });
    if (!held.ok) throw new Error("competing acquisition failed");

    expect(codes(await journal.recover())).toEqual(["resource-coordination-contended"]);
    expect(await readFile(absoluteLocator(location.workspaceRoot, locator.value))).toEqual(before);
    expect(await competitor.releaseCoordination(held.value)).toEqual({
      ok: true,
      value: undefined,
    });

    const recovered = await journal.recover();
    expect(recovered.ok).toBeTrue();
    if (!recovered.ok) throw new Error("recovery failed");
    expect(recovered.value.abandoned).toMatchObject([
      { epoch: "epoch-001", kind: "recovered-incomplete" },
    ]);
  });

  test("an exact empty active begin is idempotently reclaimable and fenced after advancement", async () => {
    const location = await roots();
    let reads = 0;
    const provider = await createLocalResourceProvider({
      ...localObservationJournalResourceProfile,
      ...location,
      faultInjector(phase) {
        if (phase === "read") {
          reads += 1;
          if (reads === 2) throw new Error("begin readback unavailable");
        }
      },
    });
    const journal = createLocalObservationJournal({ resources: provider });
    expect(codes(await journal.begin(begin()))).toEqual([
      "observation-journal-publication-unconfirmed",
    ]);

    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid fixture locator");
    const absolute = absoluteLocator(location.workspaceRoot, locator.value);
    const durableBegin = await readFile(absolute);
    const conflicting = begin("epoch-001");
    expect(
      codes(
        await journal.begin({
          ...conflicting,
          source: { ...conflicting.source, version: "9.9.9" },
        }),
      ),
    ).toEqual(["observation-epoch-already-recorded"]);
    expect(await readFile(absolute)).toEqual(durableBegin);

    const reclaimed = await journal.begin(begin());
    expect(reclaimed.ok).toBeTrue();
    if (!reclaimed.ok) throw new Error("exact begin was not reclaimed");
    expect(reclaimed.value.inspect()).toMatchObject({
      lastSequence: 0,
      recordCount: 0,
      signalCount: 0,
      state: "active",
    });
    const duplicate = await journal.begin(begin());
    expect(duplicate.ok).toBeTrue();
    if (!duplicate.ok) throw new Error("exact duplicate begin was not reclaimed");
    expect(
      await reclaimed.value.submitBatch({
        epoch: "epoch-001",
        records: [candidate()],
        sequence: 1,
      }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 1 } });
    const advancedBytes = await readFile(absolute);
    expect(codes(await journal.begin(begin()))).toEqual(["observation-epoch-already-recorded"]);
    expect(await readFile(absolute)).toEqual(advancedBytes);
    const hostile = new Proxy([] as ObservationRecord[], {
      getPrototypeOf() {
        throw new Error("stale duplicate handle must not inspect its operation body");
      },
    });
    expect(
      codes(
        await duplicate.value.submitBatch({
          epoch: "epoch-001",
          records: hostile,
          sequence: 1,
        }),
      ),
    ).toEqual(["stale-observation-lane"]);
  });

  test("cleanup is epoch-scoped and preserves other lanes and unrelated canonical planes", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const first = await journal.begin(begin("epoch-first", "source.first"));
    const second = await journal.begin(begin("epoch-second", "source.second"));
    if (!first.ok || !second.ok) throw new Error("begin failed");
    await first.value.cancel({ epoch: "epoch-first", sequence: 1 });
    const sentinels = [
      workspaceResourceLocator("groma", "intent", "sentinel.md"),
      workspaceResourceLocator("groma", "evidence", "sentinel.md"),
      workspaceResourceLocator("groma", "transaction-state.json"),
      workspaceResourceLocator("groma", "projection", "sentinel.json"),
    ].map((parsed) => {
      if (!parsed.ok) throw new Error("invalid sentinel");
      return parsed.value;
    });
    for (const locator of sentinels) {
      await seed(provider, locator, `preserve:${locator}\n`);
    }
    const secondLocator = localObservationSessionLocator(laneIdentity("source.second"));
    if (!secondLocator.ok) throw new Error("invalid second locator");
    const preserved = new Map<string, string>();
    for (const locator of [secondLocator.value, ...sentinels]) {
      preserved.set(
        String(locator),
        (await readFile(absoluteLocator(location.workspaceRoot, locator))).toString("hex"),
      );
    }

    expect(await journal.cleanup(lane("epoch-first", "source.first"))).toEqual({
      ok: true,
      value: undefined,
    });
    for (const [locator, bytes] of preserved) {
      expect(
        (
          await readFile(
            absoluteLocator(location.workspaceRoot, locator as WorkspaceResourceLocator),
          )
        ).toString("hex"),
      ).toEqual(bytes);
    }
    expect(codes(await journal.cleanup(lane("wrong-epoch", "source.second")))).toEqual([
      "stale-observation-lane",
    ]);
    for (const [locator, bytes] of preserved) {
      expect(
        (
          await readFile(
            absoluteLocator(location.workspaceRoot, locator as WorkspaceResourceLocator),
          )
        ).toString("hex"),
      ).toEqual(bytes);
    }
  });

  test("malformed or noncanonical lanes fail recovery closed without deletion", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid locator");
    const absolute = absoluteLocator(location.workspaceRoot, locator.value);
    const canonical = await readFile(absolute, "utf8");
    await writeFile(absolute, ` ${canonical}`);
    expect(codes(await journal.recover())).toEqual(["malformed-observation-journal"]);
    expect(await readFile(absolute, "utf8")).toBe(` ${canonical}`);
  });

  test("a completed canonical checkpoint outside the exact local profile cannot hand off", async () => {
    const location = await roots();
    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const started = await journal.begin(begin());
    if (!started.ok) throw new Error("begin failed");
    const locator = localObservationSessionLocator(laneIdentity());
    if (!locator.ok) throw new Error("invalid locator");
    const absolute = absoluteLocator(location.workspaceRoot, locator.value);
    const stored = JSON.parse(await readFile(absolute, "utf8")) as Record<string, unknown>;
    const outsideProfile = createObservationSession(begin(), {
      ...localObservationJournalSessionBounds,
      maxCanonicalCharacters: 5 * 1024 * 1024,
    });
    if (!outsideProfile.ok) throw new Error("outside-profile fixture begin failed");
    const submitted = outsideProfile.value.submitBatch({
      epoch: "epoch-001",
      records: [candidate()],
      sequence: 1,
    });
    if (!submitted.ok) throw new Error("outside-profile fixture batch failed");
    const completed = outsideProfile.value.complete({
      coverage: coverage(),
      epoch: "epoch-001",
      sequence: 2,
    });
    if (!completed.ok) throw new Error("outside-profile fixture completion failed");
    const checkpoint = outsideProfile.value.checkpoint();
    const canonicalCheckpoint = copyCanonicalGraphData(checkpoint, "query");
    if (!canonicalCheckpoint.ok) throw new Error("outside-profile checkpoint was not canonical");
    stored.checkpoint = checkpoint;
    stored.delivery = {
      state: "available",
      token: `groma-observation-handoff-v1:${createHash("sha256")
        .update(canonicalCheckpoint.value.canonicalJson)
        .digest("hex")}`,
    };
    stored.lifecycle = { state: "completed" };
    stored.revision = 3;
    const canonical = copyCanonicalGraphData(stored, "transaction");
    if (!canonical.ok) throw new Error("outside-profile fixture canonicalization failed");
    const hostileBytes = `${canonical.value.canonicalJson}\n`;
    await writeFile(absolute, hostileBytes);

    expect(codes(await journal.handoff(lane()))).toEqual(["malformed-observation-journal"]);
    expect(await readFile(absolute, "utf8")).toBe(hostileBytes);
  });

  test("retries an indeterminate provider commit and poisons only when readback stays unconfirmed", async () => {
    const retryLocation = await roots();
    let retryArmed = false;
    let renameAcknowledgements = 0;
    const retryProvider = await createLocalResourceProvider({
      ...localObservationJournalResourceProfile,
      ...retryLocation,
      faultInjector(phase) {
        if (retryArmed && phase === "after-rename") {
          renameAcknowledgements += 1;
          if (renameAcknowledgements === 1) throw new Error("first acknowledgement lost");
        }
      },
    });
    const retryJournal = createLocalObservationJournal({ resources: retryProvider });
    const retrySession = await retryJournal.begin(begin());
    if (!retrySession.ok) throw new Error("retry begin failed");
    retryArmed = true;
    expect(
      await retrySession.value.submitBatch({
        epoch: "epoch-001",
        records: [candidate()],
        sequence: 1,
      }),
    ).toMatchObject({ ok: true });
    expect(renameAcknowledgements).toBe(2);

    const readLocation = await roots();
    let readArmed = false;
    let reads = 0;
    const readProvider = await createLocalResourceProvider({
      ...localObservationJournalResourceProfile,
      ...readLocation,
      faultInjector(phase) {
        if (readArmed && phase === "read") {
          reads += 1;
          if (reads === 2) throw new Error("readback unavailable");
        }
      },
    });
    const readJournal = createLocalObservationJournal({ resources: readProvider });
    const readSession = await readJournal.begin(begin());
    if (!readSession.ok) throw new Error("readback begin failed");
    readArmed = true;
    expect(
      codes(
        await readSession.value.submitBatch({
          epoch: "epoch-001",
          records: [candidate()],
          sequence: 1,
        }),
      ),
    ).toEqual(["observation-journal-publication-unconfirmed"]);
    expect(codes(await readSession.value.heartbeat({ epoch: "epoch-001", sequence: 2 }))).toEqual([
      "observation-session-handle-poisoned",
    ]);
    const recovered = await createLocalObservationJournal({ resources: readProvider }).recover();
    expect(recovered).toMatchObject({
      ok: true,
      value: { abandoned: [{ kind: "recovered-incomplete" }], handoffs: [] },
    });
  });

  test("a crash between supersession and replacement retains actionable superseded abandonment", async () => {
    const location = await roots();
    const provider = await resources(location);
    const firstJournal = createLocalObservationJournal({ resources: provider });
    const first = await firstJournal.begin(begin("epoch-old"));
    if (!first.ok) throw new Error("first begin failed");
    const interrupted = createLocalObservationJournal({
      faultInjector(phase) {
        if (phase === "after-abandonment") throw new Error("stop after supersession");
      },
      resources: provider,
    });
    expect(codes(await interrupted.begin(begin("epoch-new")))).toEqual([
      "observation-journal-fault",
    ]);
    const recovered = await firstJournal.recover();
    expect(recovered).toMatchObject({
      ok: true,
      value: { abandoned: [{ epoch: "epoch-old", kind: "superseded" }], handoffs: [] },
    });
  });

  test("validates journal bounds against the negotiated provider-compatible profile", async () => {
    const location = await roots();
    const provider = await resources(location);
    expect(() =>
      createLocalObservationJournal({
        bounds: { maxJournalBytes: 1024 },
        resources: provider,
      }),
    ).toThrow("configured session profile");
    expect(() =>
      createLocalObservationJournal({
        bounds: { maxLanes: 1, maxPageSize: 2 },
        resources: provider,
      }),
    ).toThrow("maxPageSize must not exceed maxLanes");
    expect(localObservationJournalMinimumBytes).toBeLessThanOrEqual(
      localObservationJournalResourceProfile.maxReplacementBytes,
    );
  });

  test("persists a Unicode-heavy session within the negotiated whole-file byte envelope", async () => {
    const location = await roots();
    const provider = await resources(location);
    const scopes = Array.from({ length: 256 }, (_, index) => ({
      id: index === 0 ? "app" : `scope.${String(index).padStart(3, "0")}`,
      resourceRoot: index === 0 ? "." : "\ud800".repeat(4_096),
    }));
    const request = {
      apiVersion: observationSessionApiVersion,
      epoch: "epoch-unicode",
      projectId: "project.unicode",
      scopes,
      source: { id: "source.unicode", instance: "workspace", version: "1.0.0" },
    } as const;
    const journal = createLocalObservationJournal({
      bounds: { maxJournalBytes: localObservationJournalMinimumBytes },
      resources: provider,
    });
    const started = await journal.begin(request);
    if (!started.ok) throw new Error(started.diagnostics[0]?.code);
    const records: ObservationRecord[] = Array.from({ length: 31 }, (_, index) => ({
      content: "界".repeat(65_000),
      format: "text" as const,
      key: `documentation.${index}`,
      kind: "documentation" as const,
      provenance: [
        {
          fingerprint: "sha256:aaaaaaaaaaaaaaaa",
          resource: "src/index.ts",
          scope: "app",
        },
      ],
      scope: "app",
    }));
    expect(
      await started.value.submitBatch({ epoch: request.epoch, records, sequence: 1 }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 31 } });
    expect(
      await started.value.complete({
        coverage: scopes.map((scope) => ({ kinds: [], scope: scope.id, state: "partial" })),
        epoch: request.epoch,
        sequence: 2,
      }),
    ).toMatchObject({ ok: true });
    const locator = localObservationSessionLocator({
      projectId: request.projectId,
      source: { id: request.source.id, instance: request.source.instance },
    });
    if (!locator.ok) throw new Error("invalid Unicode lane locator");
    expect(
      (await readFile(absoluteLocator(location.workspaceRoot, locator.value))).byteLength,
    ).toBeLessThanOrEqual(localObservationJournalMinimumBytes);
  }, 30_000);

  test("resource-phase crashes recover immediately as an exact old-or-new durable lane", async () => {
    const cases = [
      ["begin", "write"],
      ["begin", "replacement-target-file-sync"],
      ["batch", "flush"],
      ["heartbeat", "replacement-parent-directory-sync"],
      ["completion", "after-rename"],
      ["handoff", "write"],
      ["abandonment", "replacement-target-file-sync"],
      ["acknowledgement", "replacement-parent-directory-sync"],
      ["cleanup", "removal-unlink"],
      ["cleanup", "removal-after-unlink"],
      ["cleanup", "removal-parent-directory-sync"],
    ] as const;
    const crashLane = {
      epoch: "epoch-crash",
      projectId: "project.crash",
      source: { id: "fixture.typescript", instance: "workspace" },
    } as const;
    for (const [action, phase] of cases) {
      const location = await roots();
      const child = Bun.spawn({
        cmd: [
          process.execPath,
          crashChild,
          location.workspaceRoot,
          location.coordinationRoot,
          action,
          `resource:${phase}`,
        ],
        stderr: "pipe",
        stdout: "pipe",
      });
      const exit = await child.exited;
      if (exit !== 86) {
        throw new Error(
          `${action}/${phase} crash fixture exited ${exit}: ${await new Response(child.stderr).text()}`,
        );
      }

      const parsedLocator = localObservationSessionLocator({
        projectId: crashLane.projectId,
        source: crashLane.source,
      });
      if (!parsedLocator.ok) throw new Error("invalid crash lane locator");
      const absolute = absoluteLocator(location.workspaceRoot, parsedLocator.value);
      let durable:
        | {
            checkpoint: {
              transitions: Array<{
                coverage?: readonly ObservationCoverage[];
                records?: readonly ObservationRecord[];
                sequence?: number;
                type: string;
              }>;
            };
            delivery: { state: string; token: string } | null;
            lifecycle: { state: string };
          }
        | undefined;
      try {
        durable = JSON.parse(await readFile(absolute, "utf8")) as typeof durable;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }

      if (action !== "begin" && action !== "cleanup") expect(durable).toBeDefined();
      const transitions = durable?.checkpoint.transitions ?? [];
      if (action === "batch") {
        expect([0, 1]).toContain(transitions.length);
        if (transitions.length === 1) {
          expect(transitions).toEqual([{ records: [candidate()], sequence: 1, type: "batch" }]);
        }
      } else if (action === "heartbeat") {
        expect(transitions).toEqual(
          transitions.length === 0 ? [] : [{ sequence: 1, type: "heartbeat" }],
        );
      } else if (action === "completion" || action === "handoff" || action === "acknowledgement") {
        expect(transitions[0]).toEqual({ records: [candidate()], sequence: 1, type: "batch" });
        expect(transitions[1]).toEqual({ coverage: coverage(), sequence: 2, type: "complete" });
      } else if (action === "abandonment") {
        expect(transitions).toEqual(
          transitions.length === 0 ? [] : [{ sequence: 1, type: "cancel" }],
        );
      } else if (action === "cleanup" && durable !== undefined) {
        expect(transitions).toEqual([{ sequence: 1, type: "cancel" }]);
      }

      const provider = await resources(location);
      const first = await createLocalObservationJournal({ resources: provider }).recover();
      const second = await createLocalObservationJournal({ resources: provider }).recover();
      if (!first.ok || !second.ok) {
        throw new Error(`${action}/${phase}: recovery failed`);
      }
      expect(second).toEqual(first);
      if (action === "completion" || action === "handoff") {
        expect(first.value.handoffs).toHaveLength(1);
        expect(first.value.handoffs[0]).toMatchObject({
          epoch: crashLane.epoch,
          snapshot: { coverage: coverage(), records: [candidate()] },
        });
        expect(first.value.handoffs[0]?.token).toMatch(
          /^groma-observation-handoff-v1:[0-9a-f]{64}$/,
        );
      } else if (action === "acknowledgement") {
        if (first.value.acknowledged.length === 1) {
          expect(first.value.acknowledged[0]).toEqual(crashLane);
          expect(first.value.handoffs).toEqual([]);
        } else {
          expect(first.value.acknowledged).toEqual([]);
          expect(first.value.handoffs).toHaveLength(1);
          expect(first.value.handoffs[0]).toMatchObject({
            epoch: crashLane.epoch,
            lane: { projectId: crashLane.projectId, source: crashLane.source },
          });
        }
      } else if (action === "cleanup" && durable === undefined) {
        expect(first.value).toEqual({ abandoned: [], acknowledged: [], handoffs: [] });
      } else {
        expect(first.value.handoffs).toEqual([]);
        expect(first.value.abandoned).toHaveLength(durable === undefined ? 0 : 1);
      }
    }
  }, 30_000);

  test("a pre-commit process crash leaves a reclaimable stage that retry and cleanup remove", async () => {
    const location = await roots();
    const child = Bun.spawn({
      cmd: [
        process.execPath,
        crashChild,
        location.workspaceRoot,
        location.coordinationRoot,
        "begin",
        "resource:write",
      ],
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(await child.exited).toBe(86);
    const directory = path.join(location.workspaceRoot, "groma", "observation-sessions");
    expect((await readdir(directory)).some((name) => name.startsWith(".groma-stage-"))).toBeTrue();

    const provider = await resources(location);
    const journal = createLocalObservationJournal({ resources: provider });
    const retried = await journal.begin({
      ...begin("epoch-crash", "fixture.typescript"),
      projectId: "project.crash",
      source: { id: "fixture.typescript", instance: "workspace", version: "1.0.0" },
    });
    if (!retried.ok) throw new Error(retried.diagnostics[0]?.code);
    await retried.value.cancel({ epoch: "epoch-crash", sequence: 1 });
    await journal.cleanup({
      epoch: "epoch-crash",
      projectId: "project.crash",
      source: { id: "fixture.typescript", instance: "workspace" },
    });
    expect((await readdir(directory)).filter((name) => name.startsWith(".groma-stage-"))).toEqual(
      [],
    );
  });

  test("real process crashes recover deterministically at every journal boundary", async () => {
    const actions = [
      "begin",
      "batch",
      "heartbeat",
      "completion",
      "handoff",
      "abandonment",
      "acknowledgement",
      "cleanup",
    ] as const;
    for (const action of actions) {
      const location = await roots();
      const child = Bun.spawn({
        cmd: [
          process.execPath,
          crashChild,
          location.workspaceRoot,
          location.coordinationRoot,
          action,
        ],
        stderr: "pipe",
        stdout: "pipe",
      });
      const exit = await child.exited;
      if (exit !== 86) {
        throw new Error(
          `${action} crash fixture exited ${exit}: ${await new Response(child.stderr).text()}`,
        );
      }
      if (action !== "cleanup") {
        const locator = localObservationSessionLocator({
          projectId: "project.crash",
          source: { id: "fixture.typescript", instance: "workspace" },
        });
        if (!locator.ok) throw new Error("invalid crash lane locator");
        const durable = JSON.parse(
          await readFile(absoluteLocator(location.workspaceRoot, locator.value), "utf8"),
        ) as {
          checkpoint: {
            transitions: Array<{ records?: Array<{ key: string }>; type: string }>;
          };
        };
        if (action === "batch") {
          expect(durable.checkpoint.transitions).toMatchObject([
            { records: [{ key: "api" }], type: "batch" },
          ]);
        }
        if (action === "heartbeat") {
          expect(durable.checkpoint.transitions).toMatchObject([{ type: "heartbeat" }]);
        }
      }
      const provider = await resources(location);
      const recovered = await createLocalObservationJournal({ resources: provider }).recover();
      if (!recovered.ok) throw new Error(`${action}: ${recovered.diagnostics[0]?.code}`);
      if (action === "completion" || action === "handoff") {
        expect(recovered.value.handoffs).toHaveLength(1);
        expect(recovered.value.handoffs[0]?.epoch).toBe("epoch-crash");
      } else if (action === "acknowledgement") {
        expect(recovered.value).toMatchObject({
          acknowledged: [
            {
              epoch: "epoch-crash",
              projectId: "project.crash",
              source: { id: "fixture.typescript", instance: "workspace" },
            },
          ],
          handoffs: [],
        });
      } else if (action === "cleanup") {
        expect(recovered.value).toEqual({ abandoned: [], acknowledged: [], handoffs: [] });
        const directory = path.join(location.workspaceRoot, "groma", "observation-sessions");
        expect(await readdir(directory)).toEqual([]);
      } else {
        expect(recovered.value.abandoned).toHaveLength(1);
        expect(recovered.value.handoffs).toEqual([]);
      }
    }
  }, 30_000);
});
