import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  observationSessionApiVersion,
  PluginRuntime,
  pluginRuntimeApiVersion,
  type CompletedObservationSnapshot,
  type PluginRegistration,
  type Result,
  type RunningPluginGraph,
} from "../../core/index.ts";
import {
  createLocalObservationJournal,
  createLocalResourceProvider,
  localObservationJournalSessionBounds,
  type LocalObservationJournal,
} from "../../persistence/index.ts";
import {
  scannerApiVersion,
  scannerCapability,
  scannerCapabilityId,
  scannerCapabilityVersion,
  type Scanner,
  type ScannerProjectResources,
} from "../../plugin-sdk/index.ts";
import {
  createScannerExecutionRuntime,
  scannerExecutionApiVersion,
  type CompletedObservationConsumer,
  type ScannerExecutionRuntime,
  type ScannerExecutionSession,
  type ScannerRuntimeScheduler,
  type ScannerRuntimeTimer,
} from "../scanner-runtime.ts";
import type {
  ProjectRegistrationOperations,
  ProjectRegistrationSnapshot,
} from "../local-project-registry.ts";

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return result.value;
}

const revisionA = `sha256:${"a".repeat(64)}`;
const revisionB = `sha256:${"b".repeat(64)}`;

function project(id = "project.default", revision = revisionA): ProjectRegistrationSnapshot {
  return Object.freeze({
    availability: "available" as const,
    coverage: Object.freeze([Object.freeze({ id: "workspace", resourceRoot: "." })]),
    id,
    name: id,
    revision,
    scanners: Object.freeze([
      Object.freeze({ configuration: Object.freeze({ mode: "strict" }), id: "official.test" }),
    ]),
    source: ".",
  } satisfies ProjectRegistrationSnapshot);
}

function projects(
  get: (id: string, calls: number) => ProjectRegistrationSnapshot = (id) => project(id),
): Pick<ProjectRegistrationOperations, "get"> & { readonly calls: () => number } {
  let calls = 0;
  return Object.freeze({
    calls: () => calls,
    get: async ({ id }) => ({ ok: true as const, value: get(id, ++calls) }),
  } satisfies Pick<ProjectRegistrationOperations, "get"> & {
    readonly calls: () => number;
  });
}

function resources(): ScannerProjectResources {
  return Object.freeze({
    enumerate: async (request) => ({
      ok: true as const,
      value: Object.freeze({
        entries: Object.freeze([
          Object.freeze({
            kind: "file" as const,
            resource: "src/index.ts",
            scope: request.scope,
            size: 16,
          }),
        ]),
        truncatedByDepth: false,
      }),
    }),
    read: async () => ({
      ok: true as const,
      value: Object.freeze({ bytes: new TextEncoder().encode("export const api = 1") }),
    }),
  } satisfies ScannerProjectResources);
}

function candidateRecord() {
  return Object.freeze({
    candidate: Object.freeze({ name: "API" }),
    key: "api",
    kind: "component-candidate" as const,
    provenance: Object.freeze([
      Object.freeze({
        fingerprint: "sha256:aaaaaaaa",
        resource: "src/index.ts",
        scope: "workspace",
      }),
    ]),
    scope: "workspace",
  });
}

function completeScanner(
  hooks: Readonly<{
    afterComplete?: () => Promise<Result<void>>;
    beforeComplete?: () => Promise<void>;
    inspectRequest?: (request: Parameters<Scanner["scan"]>[0]) => void;
  }> = Object.freeze({}),
): Scanner {
  return Object.freeze({
    async scan(request) {
      hooks.inspectRequest?.(request);
      const source = await request.resources.read({
        maxBytes: 4_096,
        resource: "src/index.ts",
        scope: "workspace",
      });
      if (!source.ok) return source;
      const batch = request.observations.submitBatch({
        epoch: request.session.epoch,
        records: [candidateRecord()],
        sequence: 1,
      });
      if (!batch.ok) return batch;
      const heartbeat = request.observations.heartbeat({
        epoch: request.session.epoch,
        sequence: 2,
      });
      if (!heartbeat.ok) return heartbeat;
      await hooks.beforeComplete?.();
      const completed = request.observations.complete({
        coverage: [{ kinds: ["component-candidate"], scope: "workspace", state: "partial" }],
        epoch: request.session.epoch,
        sequence: 3,
      });
      if (!completed.ok) return completed;
      return hooks.afterComplete?.() ?? { ok: true, value: undefined };
    },
  } satisfies Scanner);
}

async function plugins(scanner: Scanner): Promise<RunningPluginGraph> {
  const registration: PluginRegistration = Object.freeze({
    manifest: Object.freeze({
      apiVersion: pluginRuntimeApiVersion,
      id: "official.test",
      phase: 1 as const,
      provides: Object.freeze([scannerCapability]),
      requires: Object.freeze([]),
      version: "2.3.4",
    }),
    start: () =>
      Object.freeze({
        capabilities: Object.freeze([
          Object.freeze({
            id: scannerCapabilityId,
            value: scanner,
            version: scannerCapabilityVersion,
          }),
        ]),
      }),
  });
  const runtime = new PluginRuntime();
  const resolved = valueOf(runtime.resolve([registration]));
  return valueOf(
    await runtime.start(resolved, Object.freeze({ isCancellationRequested: () => false })),
  );
}

class ManualScheduler implements ScannerRuntimeScheduler {
  readonly #timers: Array<{
    active: boolean;
    readonly callback: () => void;
    readonly delay: number;
  }> = [];

  schedule(delay: number, callback: () => void): ScannerRuntimeTimer {
    const entry = { active: true, callback, delay };
    this.#timers.push(entry);
    return Object.freeze({
      cancel: () => {
        entry.active = false;
      },
    });
  }

  fire(delay: number): void {
    const timer = this.#timers.find((item) => item.active && item.delay === delay);
    if (timer === undefined) throw new Error(`No active timer for ${delay}`);
    timer.active = false;
    timer.callback();
  }

  fireRetained(delay: number): void {
    const timer = this.#timers.findLast((item) => item.delay === delay);
    if (timer === undefined) throw new Error(`No retained timer for ${delay}`);
    timer.callback();
  }

  isActive(delay: number): boolean {
    return this.#timers.some((item) => item.active && item.delay === delay);
  }
}

async function journalFixture(): Promise<{
  readonly journal: LocalObservationJournal;
  readonly remove: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "groma-scanner-runtime-"));
  const coordinationRoot = await mkdtemp(path.join(os.tmpdir(), "groma-scanner-runtime-locks-"));
  await mkdir(path.join(root, "groma"), { recursive: true });
  const provider = await createLocalResourceProvider({ coordinationRoot, workspaceRoot: root });
  return Object.freeze({
    journal: createLocalObservationJournal({ resources: provider }),
    remove: async () => {
      await rm(root, { force: true, recursive: true });
      await rm(coordinationRoot, { force: true, recursive: true });
    },
  });
}

function journalWithBegin(
  journal: LocalObservationJournal,
  begin: LocalObservationJournal["begin"],
): LocalObservationJournal {
  return Object.freeze({
    acknowledge: (request) => journal.acknowledge(request),
    begin,
    cleanup: (request) => journal.cleanup(request),
    handoff: (request) => journal.handoff(request),
    recover: () => journal.recover(),
  } satisfies LocalObservationJournal);
}

async function runtimeFixture(
  scanner: Scanner,
  overrides: Readonly<{
    consumer?: CompletedObservationConsumer;
    journal?: LocalObservationJournal;
    projectOperations?: Pick<ProjectRegistrationOperations, "get">;
    projectResources?: (
      project: ProjectRegistrationSnapshot,
    ) => Promise<Result<ScannerProjectResources>>;
    scheduler?: ScannerRuntimeScheduler;
  }> = Object.freeze({}),
): Promise<{
  readonly consumed: CompletedObservationSnapshot[];
  readonly runtime: ScannerExecutionRuntime;
}> {
  const consumed: CompletedObservationSnapshot[] = [];
  let entropy = 1;
  const runtime = createScannerExecutionRuntime({
    bounds: {
      heartbeatTimeoutMilliseconds: 10,
      maxDurationMilliseconds: 20,
    },
    consumer:
      overrides.consumer ??
      Object.freeze({
        consume: async (snapshot: CompletedObservationSnapshot) => {
          consumed.push(snapshot);
          return { ok: true as const, value: undefined };
        },
      }),
    entropy: (length) => new Uint8Array(length).fill(entropy++),
    journal: overrides.journal!,
    plugins: await plugins(scanner),
    projectResources:
      overrides.projectResources ?? (async () => ({ ok: true as const, value: resources() })),
    projects: overrides.projectOperations ?? projects(),
    scheduler: overrides.scheduler ?? new ManualScheduler(),
  });
  return { consumed, runtime };
}

describe("scanner execution runtime", () => {
  test("runs an enabled blind scanner through durable completion and one consumer handoff", async () => {
    const fixture = await journalFixture();
    const requestKeys: string[][] = [];
    try {
      const { consumed, runtime } = await runtimeFixture(
        completeScanner({
          inspectRequest: (request) => requestKeys.push(Object.keys(request).sort()),
        }),
        { journal: fixture.journal },
      );
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect(execution.inspect()).toMatchObject({
        apiVersion: scannerExecutionApiVersion,
        epoch: expect.stringMatching(/^epoch_[0-9a-f]{32}$/),
        projectId: "project.default",
        scannerId: "official.test",
      });
      const report = await execution.completion;
      expect(report).toMatchObject({
        batchCount: 1,
        diagnostics: [],
        lastHeartbeatSequence: 2,
        recordCount: 1,
        status: "completed",
      });
      expect(requestKeys).toEqual([
        ["apiVersion", "cancellation", "configuration", "observations", "resources", "session"],
      ]);
      expect(consumed).toHaveLength(1);
      expect(consumed[0]).toMatchObject({
        projectId: "project.default",
        records: [{ key: "api" }],
        source: { id: "official.test", instance: "default", version: "2.3.4" },
      });
      expect(await fixture.journal.recover()).toEqual({
        ok: true,
        value: { abandoned: [], acknowledged: [], handoffs: [] },
      });
    } finally {
      await fixture.remove();
    }
  });

  test("never publishes completion when a scanner completes its sink and then rejects", async () => {
    const fixture = await journalFixture();
    try {
      const { consumed, runtime } = await runtimeFixture(
        completeScanner({ afterComplete: () => Promise.reject(new Error("private failure")) }),
        { journal: fixture.journal },
      );
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect(await execution.completion).toMatchObject({
        diagnostics: [{ code: "scanner-plugin-failed" }],
        status: "failed",
      });
      expect(consumed).toEqual([]);
      expect(await fixture.journal.recover()).toEqual({
        ok: true,
        value: { abandoned: [], acknowledged: [], handoffs: [] },
      });
    } finally {
      await fixture.remove();
    }
  });

  test("exposes bounded progress, isolates independent lanes, and rejects one conflicting lane", async () => {
    const fixture = await journalFixture();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const projectOperations = projects((id) => project(id));
    try {
      const { runtime } = await runtimeFixture(completeScanner({ beforeComplete: () => held }), {
        journal: fixture.journal,
        projectOperations,
      });
      const first = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      await Promise.resolve();
      expect(first.inspect()).toMatchObject({ batchCount: 1, recordCount: 1, status: "running" });
      expect(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      ).toMatchObject({ diagnostics: [{ code: "scanner-session-conflict" }], ok: false });
      const second = valueOf(
        await runtime.start({
          projectId: `project_${"1".repeat(32)}`,
          scannerId: "official.test",
        }),
      );
      expect(second.inspect()).toMatchObject({ status: "running" });
      first.cancel();
      second.cancel();
      expect((await first.completion).status).toBe("cancelled");
      expect((await second.completion).status).toBe("cancelled");
      release();
    } finally {
      await fixture.remove();
    }
  });

  test("expires a never-settling scanner and fences its retained request", async () => {
    const fixture = await journalFixture();
    const scheduler = new ManualScheduler();
    let retained: Parameters<Scanner["scan"]>[0] | undefined;
    const scanner: Scanner = Object.freeze({
      scan: (request) => {
        retained = request;
        return new Promise<Result<void>>(() => {});
      },
    } satisfies Scanner);
    try {
      const { runtime } = await runtimeFixture(scanner, {
        journal: fixture.journal,
        scheduler,
      });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      scheduler.fire(10);
      expect(await execution.completion).toMatchObject({
        diagnostics: [{ code: "scanner-heartbeat-expired" }],
        status: "expired",
      });
      expect(
        await retained!.resources.read({
          maxBytes: 1,
          resource: "src/index.ts",
          scope: "workspace",
        }),
      ).toMatchObject({ diagnostics: [{ code: "scanner-request-cancelled" }], ok: false });
    } finally {
      await fixture.remove();
    }
  });

  test("fences a project revision change before durable completion", async () => {
    const fixture = await journalFixture();
    const projectOperations = projects((id, calls) =>
      project(id, calls <= 2 ? revisionA : revisionB),
    );
    try {
      const { consumed, runtime } = await runtimeFixture(completeScanner(), {
        journal: fixture.journal,
        projectOperations,
      });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect(await execution.completion).toMatchObject({
        diagnostics: [{ code: "scanner-project-changed" }],
        status: "failed",
      });
      expect(consumed).toEqual([]);
    } finally {
      await fixture.remove();
    }
  });

  test("makes ignored invalid scope and contradictory observations fatal", async () => {
    const fixture = await journalFixture();
    const invalidScopeScanner: Scanner = Object.freeze({
      async scan(request) {
        request.observations.submitBatch({
          epoch: request.session.epoch,
          records: [
            {
              ...candidateRecord(),
              provenance: [
                {
                  fingerprint: "sha256:aaaaaaaa",
                  resource: "src/index.ts",
                  scope: "undeclared",
                },
              ],
              scope: "undeclared",
            },
          ],
          sequence: 1,
        });
        request.observations.complete({
          coverage: [{ kinds: ["component-candidate"], scope: "workspace", state: "partial" }],
          epoch: request.session.epoch,
          sequence: 1,
        });
        return { ok: true as const, value: undefined };
      },
    } satisfies Scanner);
    try {
      const invalid = await runtimeFixture(invalidScopeScanner, { journal: fixture.journal });
      const invalidExecution = valueOf(
        await invalid.runtime.start({
          projectId: "project.default",
          scannerId: "official.test",
        }),
      );
      expect(await invalidExecution.completion).toMatchObject({
        diagnostics: [{ code: "undeclared-observation-scope" }],
        status: "failed",
      });
      expect(invalid.consumed).toEqual([]);

      const contradictoryScanner: Scanner = Object.freeze({
        async scan(request) {
          request.observations.submitBatch({
            epoch: request.session.epoch,
            records: [candidateRecord()],
            sequence: 1,
          });
          request.observations.submitBatch({
            epoch: request.session.epoch,
            records: [
              {
                ...candidateRecord(),
                candidate: { name: "Different API" },
              },
            ],
            sequence: 2,
          });
          request.observations.complete({
            coverage: [{ kinds: ["component-candidate"], scope: "workspace", state: "partial" }],
            epoch: request.session.epoch,
            sequence: 2,
          });
          return { ok: true as const, value: undefined };
        },
      } satisfies Scanner);
      const contradictory = await runtimeFixture(contradictoryScanner, {
        journal: fixture.journal,
      });
      const contradictoryExecution = valueOf(
        await contradictory.runtime.start({
          projectId: "project.default",
          scannerId: "official.test",
        }),
      );
      expect(await contradictoryExecution.completion).toMatchObject({
        batchCount: 1,
        diagnostics: [{ code: "contradictory-observation" }],
        status: "failed",
      });
      expect(contradictory.consumed).toEqual([]);
    } finally {
      await fixture.remove();
    }
  });

  test("never invokes a scanner for a pre-aborted execution", async () => {
    const fixture = await journalFixture();
    const cancellation = new AbortController();
    cancellation.abort();
    let invocations = 0;
    const scanner: Scanner = Object.freeze({
      scan: async () => {
        invocations += 1;
        return { ok: true as const, value: undefined };
      },
    } satisfies Scanner);
    try {
      const { runtime } = await runtimeFixture(scanner, { journal: fixture.journal });
      expect(
        await runtime.start({
          cancellation: cancellation.signal,
          projectId: "project.default",
          scannerId: "official.test",
        }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-execution-cancelled" }],
        ok: false,
      });
      expect(invocations).toBe(0);
    } finally {
      await fixture.remove();
    }
  });

  test("publishes an accepted scanner failure without waiting for the scanner Promise", async () => {
    const fixture = await journalFixture();
    let durableFailure: unknown;
    const recordingJournal = journalWithBegin(fixture.journal, async (begin) => {
      const started = await fixture.journal.begin(begin);
      if (!started.ok) return started;
      const durable = started.value;
      return {
        ok: true as const,
        value: Object.freeze({
          cancel: (signal) => durable.cancel(signal),
          complete: (completion) => durable.complete(completion),
          expire: (expiry) => durable.expire(expiry),
          fail: (report) => {
            durableFailure = report;
            return durable.fail(report);
          },
          heartbeat: (heartbeat) => durable.heartbeat(heartbeat),
          inspect: () => durable.inspect(),
          submitBatch: (batch) => durable.submitBatch(batch),
        } satisfies typeof durable),
      };
    });
    const scanner: Scanner = Object.freeze({
      scan(request) {
        const reported = request.observations.fail({
          epoch: request.session.epoch,
          reason: { code: "scanner-private-failure", message: "Bounded scanner failure" },
          sequence: 1,
        });
        if (!reported.ok) return Promise.resolve(reported);
        return new Promise<Result<void>>(() => {});
      },
    } satisfies Scanner);
    try {
      const { runtime } = await runtimeFixture(scanner, { journal: recordingJournal });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect(await execution.completion).toMatchObject({
        diagnostics: [{ code: "scanner-reported-failure" }],
        status: "failed",
      });
      expect(durableFailure).toMatchObject({
        reason: { code: "scanner-private-failure", message: "Bounded scanner failure" },
        sequence: 1,
      });
    } finally {
      await fixture.remove();
    }
  });

  test("redelivers a failed post-start handoff through same-runtime recovery", async () => {
    const fixture = await journalFixture();
    let deliveries = 0;
    const consumer: CompletedObservationConsumer = Object.freeze({
      consume: async () => {
        deliveries += 1;
        return deliveries === 1
          ? {
              diagnostics: [{ code: "consumer-temporarily-unavailable", message: "Retry later" }],
              ok: false as const,
            }
          : { ok: true as const, value: undefined };
      },
    });
    try {
      const { runtime } = await runtimeFixture(completeScanner(), {
        consumer,
        journal: fixture.journal,
      });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect(await execution.completion).toMatchObject({
        diagnostics: [{ code: "consumer-temporarily-unavailable" }],
        status: "failed",
      });
      expect(await runtime.recover()).toEqual({
        ok: true,
        value: { abandoned: 0, acknowledged: 0, consumed: 1 },
      });
      expect(deliveries).toBe(2);
      expect(await fixture.journal.recover()).toEqual({
        ok: true,
        value: { abandoned: [], acknowledged: [], handoffs: [] },
      });
    } finally {
      await fixture.remove();
    }
  });

  test("cancels and awaits every active execution before closing the runtime", async () => {
    const fixture = await journalFixture();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const projectOperations = projects((id) => project(id));
    try {
      const { runtime } = await runtimeFixture(completeScanner({ beforeComplete: () => held }), {
        journal: fixture.journal,
        projectOperations,
      });
      const first = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      const second = valueOf(
        await runtime.start({
          projectId: `project_${"2".repeat(32)}`,
          scannerId: "official.test",
        }),
      );
      const reports = await runtime.cancelAll();
      expect(reports.map((report) => report.status)).toEqual(["cancelled", "cancelled"]);
      expect((await first.completion).status).toBe("cancelled");
      expect((await second.completion).status).toBe("cancelled");
      expect(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      ).toMatchObject({ diagnostics: [{ code: "scanner-runtime-cancelled" }], ok: false });
      release();
    } finally {
      await fixture.remove();
    }
  });

  test("deeply captures a mutable project snapshot and rejects proxy registrations", async () => {
    const fixture = await journalFixture();
    const mutable = {
      availability: "available" as const,
      coverage: [{ id: "workspace", resourceRoot: "." }],
      id: "project.default",
      name: "Mutable project",
      revision: revisionA,
      scanners: [{ configuration: { mode: "strict" }, id: "official.test" }],
      source: ".",
    };
    let capturedResourceSource = "";
    let requestConfiguration = "";
    let requestScopes = "";
    const mutableProjects: Pick<ProjectRegistrationOperations, "get"> = Object.freeze({
      get: async () => ({ ok: true as const, value: mutable }),
    });
    const scanner = completeScanner({
      inspectRequest: (request) => {
        requestConfiguration = JSON.stringify(request.configuration);
        requestScopes = JSON.stringify(request.session.scopes);
      },
    });
    try {
      const { runtime } = await runtimeFixture(scanner, {
        journal: fixture.journal,
        projectOperations: mutableProjects,
        projectResources: async (captured) => {
          capturedResourceSource = captured.source;
          mutable.source = "moved";
          mutable.coverage[0]!.resourceRoot = "other";
          mutable.scanners[0]!.configuration.mode = "mutated";
          return { ok: true as const, value: resources() };
        },
      });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect((await execution.completion).status).toBe("completed");
      expect(capturedResourceSource).toBe(".");
      expect(requestConfiguration).toBe('{"mode":"strict"}');
      expect(requestScopes).toBe('[{"id":"workspace","resourceRoot":"."}]');

      const proxyProject = new Proxy(project(), {});
      const proxyRuntime = await runtimeFixture(completeScanner(), {
        journal: fixture.journal,
        projectOperations: Object.freeze({
          get: async () => ({ ok: true as const, value: proxyProject }),
        } satisfies Pick<ProjectRegistrationOperations, "get">),
      });
      expect(
        await proxyRuntime.runtime.start({
          projectId: "project.default",
          scannerId: "official.test",
        }),
      ).toMatchObject({ diagnostics: [{ code: "scanner-project-unavailable" }], ok: false });
    } finally {
      await fixture.remove();
    }
  });

  test("captures project resource methods before durable session admission", async () => {
    const fixture = await journalFixture();
    const mutableResources = {
      enumerate: resources().enumerate,
      read: async () => ({
        ok: true as const,
        value: Object.freeze({ bytes: new TextEncoder().encode("captured") }),
      }),
    };
    const journal = journalWithBegin(fixture.journal, async (begin) => {
      mutableResources.read = async () => ({
        ok: true as const,
        value: Object.freeze({ bytes: new TextEncoder().encode("mutated") }),
      });
      return fixture.journal.begin(begin);
    });
    let observed = "";
    const scanner: Scanner = Object.freeze({
      async scan(request) {
        const read = await request.resources.read({
          maxBytes: 128,
          resource: "src/index.ts",
          scope: "workspace",
        });
        if (!read.ok) return read;
        observed = new TextDecoder().decode(read.value.bytes);
        const completed = request.observations.complete({
          coverage: [{ kinds: [], scope: "workspace", state: "partial" }],
          epoch: request.session.epoch,
          sequence: 1,
        });
        return completed.ok ? { ok: true as const, value: undefined } : completed;
      },
    } satisfies Scanner);
    try {
      const { runtime } = await runtimeFixture(scanner, {
        journal,
        projectResources: async () => ({ ok: true as const, value: mutableResources }),
      });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect((await execution.completion).status).toBe("completed");
      expect(observed).toBe("captured");
    } finally {
      await fixture.remove();
    }
  });

  test("fails closed when durable batch receipts diverge from the shadow session", async () => {
    const fixture = await journalFixture();
    const divergentJournal = journalWithBegin(fixture.journal, async (begin) => {
      const started = await fixture.journal.begin(begin);
      if (!started.ok) return started;
      const durable = started.value;
      return {
        ok: true as const,
        value: Object.freeze({
          cancel: (signal) => durable.cancel(signal),
          complete: (completion) => durable.complete(completion),
          expire: (expiry) => durable.expire(expiry),
          fail: (report) => durable.fail(report),
          heartbeat: (heartbeat) => durable.heartbeat(heartbeat),
          inspect: () => durable.inspect(),
          async submitBatch(batch) {
            const receipt = await durable.submitBatch(batch);
            return receipt.ok
              ? {
                  ok: true as const,
                  value: Object.freeze({
                    ...receipt.value,
                    acceptedRecords: receipt.value.acceptedRecords + 1,
                  }),
                }
              : receipt;
          },
        } satisfies typeof durable),
      };
    });
    try {
      const { consumed, runtime } = await runtimeFixture(completeScanner(), {
        journal: divergentJournal,
      });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      expect(await execution.completion).toMatchObject({
        diagnostics: [{ code: "scanner-session-diverged" }],
        status: "failed",
      });
      expect(consumed).toEqual([]);
    } finally {
      await fixture.remove();
    }
  });

  test("closes retained observation authority and heartbeat timing when the scanner settles", async () => {
    const fixture = await journalFixture();
    const scheduler = new ManualScheduler();
    let durableStarted!: () => void;
    const startedDurability = new Promise<void>((resolve) => {
      durableStarted = resolve;
    });
    let releaseDurability!: () => void;
    const heldDurability = new Promise<void>((resolve) => {
      releaseDurability = resolve;
    });
    const delayedJournal = journalWithBegin(fixture.journal, async (begin) => {
      const started = await fixture.journal.begin(begin);
      if (!started.ok) return started;
      const durable = started.value;
      return {
        ok: true as const,
        value: Object.freeze({
          cancel: (signal) => durable.cancel(signal),
          complete: (completion) => durable.complete(completion),
          expire: (expiry) => durable.expire(expiry),
          fail: (report) => durable.fail(report),
          heartbeat: (heartbeat) => durable.heartbeat(heartbeat),
          inspect: () => durable.inspect(),
          async submitBatch(batch) {
            durableStarted();
            await heldDurability;
            return durable.submitBatch(batch);
          },
        } satisfies typeof durable),
      };
    });
    let retained: Parameters<Scanner["scan"]>[0] | undefined;
    let settle!: (result: Result<void>) => void;
    const scanner: Scanner = Object.freeze({
      scan(request) {
        retained = request;
        const batch = request.observations.submitBatch({
          epoch: request.session.epoch,
          records: [candidateRecord()],
          sequence: 1,
        });
        if (!batch.ok) return Promise.resolve(batch);
        const completed = request.observations.complete({
          coverage: [{ kinds: ["component-candidate"], scope: "workspace", state: "partial" }],
          epoch: request.session.epoch,
          sequence: 2,
        });
        if (!completed.ok) return Promise.resolve(completed);
        return new Promise<Result<void>>((resolve) => {
          settle = resolve;
        });
      },
    } satisfies Scanner);
    try {
      const { runtime } = await runtimeFixture(scanner, { journal: delayedJournal, scheduler });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      await startedDurability;
      settle({ ok: true, value: undefined });
      for (
        let attempt = 0;
        attempt < 10 && execution.inspect().status === "running";
        attempt += 1
      ) {
        await Promise.resolve();
      }
      expect(execution.inspect().status).toBe("draining");
      expect(scheduler.isActive(10)).toBe(false);
      expect(scheduler.isActive(20)).toBe(true);
      scheduler.fireRetained(10);
      await Promise.resolve();
      expect(execution.inspect().status).toBe("draining");
      expect(
        retained!.observations.heartbeat({ epoch: retained!.session.epoch, sequence: 3 }),
      ).toMatchObject({ diagnostics: [{ code: "scanner-request-cancelled" }], ok: false });
      releaseDurability();
      expect((await execution.completion).status).toBe("completed");
    } finally {
      await fixture.remove();
    }
  });

  test("rejects scanner providers that retain plugin-runtime capabilities", async () => {
    const fixture = await journalFixture();
    const retainedCapability = Object.freeze({ privateBlueprintRead: () => "forbidden" });
    const resourceCapability = Object.freeze({
      cardinality: "single" as const,
      id: "groma.resources/v1",
      version: "1.0.0",
    });
    let retainedByScanner: unknown;
    const registrations: readonly PluginRegistration[] = Object.freeze([
      Object.freeze({
        manifest: Object.freeze({
          apiVersion: pluginRuntimeApiVersion,
          id: "official.retained-resources",
          phase: 0 as const,
          provides: Object.freeze([resourceCapability]),
          requires: Object.freeze([]),
          version: "1.0.0",
        }),
        start: () =>
          Object.freeze({
            capabilities: Object.freeze([
              Object.freeze({
                id: resourceCapability.id,
                value: retainedCapability,
                version: resourceCapability.version,
              }),
            ]),
          }),
      }),
      Object.freeze({
        manifest: Object.freeze({
          apiVersion: pluginRuntimeApiVersion,
          id: "official.test",
          phase: 1 as const,
          provides: Object.freeze([scannerCapability]),
          requires: Object.freeze([resourceCapability]),
          version: "2.3.4",
        }),
        start: (context: Parameters<PluginRegistration["start"]>[0]) => {
          retainedByScanner = context.requirements[0]?.providers[0]?.value;
          return Object.freeze({
            capabilities: Object.freeze([
              Object.freeze({
                id: scannerCapabilityId,
                value: completeScanner(),
                version: scannerCapabilityVersion,
              }),
            ]),
          });
        },
      }),
    ]);
    const pluginRuntime = new PluginRuntime();
    const graph = valueOf(
      await pluginRuntime.start(
        valueOf(pluginRuntime.resolve(registrations)),
        Object.freeze({ isCancellationRequested: () => false }),
      ),
    );
    try {
      const runtime = createScannerExecutionRuntime({
        bounds: { heartbeatTimeoutMilliseconds: 10, maxDurationMilliseconds: 20 },
        consumer: Object.freeze({
          consume: async () => ({ ok: true as const, value: undefined }),
        }),
        entropy: (length) => new Uint8Array(length).fill(1),
        journal: fixture.journal,
        plugins: graph,
        projectResources: async () => ({ ok: true as const, value: resources() }),
        projects: projects(),
        scheduler: new ManualScheduler(),
      });
      expect(retainedByScanner).toBe(retainedCapability);
      expect(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-provider-authority-invalid" }],
        ok: false,
      });
    } finally {
      await graph.shutdown();
      await fixture.remove();
    }
  });

  test("settles cancelAll and quarantines a permanently pending durable batch", async () => {
    const fixture = await journalFixture();
    let batchStarted!: () => void;
    const startedBatch = new Promise<void>((resolve) => {
      batchStarted = resolve;
    });
    let releaseBatch!: () => Promise<void>;
    let intercept = true;
    const mutations = { acknowledge: 0, cleanup: 0, complete: 0, handoff: 0 };
    const journal: LocalObservationJournal = Object.freeze({
      acknowledge: (request) => {
        mutations.acknowledge += 1;
        return fixture.journal.acknowledge(request);
      },
      async begin(begin) {
        const started = await fixture.journal.begin(begin);
        if (!started.ok) return started;
        const durable = started.value;
        return {
          ok: true as const,
          value: Object.freeze({
            cancel: (signal) => durable.cancel(signal),
            complete: (completion) => {
              mutations.complete += 1;
              return durable.complete(completion);
            },
            expire: (expiry) => durable.expire(expiry),
            fail: (report) => durable.fail(report),
            heartbeat: (heartbeat) => durable.heartbeat(heartbeat),
            inspect: () => durable.inspect(),
            submitBatch(batch) {
              if (!intercept || begin.projectId !== "project.default") {
                return durable.submitBatch(batch);
              }
              intercept = false;
              batchStarted();
              return new Promise((resolve) => {
                releaseBatch = async () => {
                  resolve(await durable.submitBatch(batch));
                };
              });
            },
          } satisfies typeof durable),
        };
      },
      cleanup: (request) => {
        mutations.cleanup += 1;
        return fixture.journal.cleanup(request);
      },
      handoff: (request) => {
        mutations.handoff += 1;
        return fixture.journal.handoff(request);
      },
      recover: () => fixture.journal.recover(),
    } satisfies LocalObservationJournal);
    try {
      const { runtime } = await runtimeFixture(completeScanner(), { journal });
      const execution = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      await startedBatch;
      const reports = await runtime.cancelAll();
      expect(reports.map((report) => report.status)).toEqual(["cancelled"]);
      expect((await execution.completion).status).toBe("cancelled");
      expect(mutations).toEqual({ acknowledge: 0, cleanup: 0, complete: 0, handoff: 0 });
      expect(await runtime.recover()).toMatchObject({
        diagnostics: [{ code: "scanner-recovery-conflict" }],
        ok: false,
      });
      await releaseBatch();
      let recovered: Awaited<ReturnType<ScannerExecutionRuntime["recover"]>> | undefined;
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await Promise.resolve();
        recovered = await runtime.recover();
        if (recovered.ok) break;
      }
      expect(recovered).toMatchObject({
        ok: true,
        value: { abandoned: 1, acknowledged: 0, consumed: 0 },
      });
      expect(mutations.complete).toBe(0);
      expect(mutations.handoff).toBe(0);
      expect(mutations.acknowledge).toBe(0);
      expect(mutations.cleanup).toBe(1);
    } finally {
      await fixture.remove();
    }
  });

  test("interrupts a pending consumer without acknowledgement and releases only its lane", async () => {
    const fixture = await journalFixture();
    let consumerStarted!: () => void;
    const startedConsumer = new Promise<void>((resolve) => {
      consumerStarted = resolve;
    });
    let releaseConsumer!: (result: Result<void>) => void;
    let heldConsumer = true;
    const deliveries: string[] = [];
    const mutations = { acknowledge: 0, cleanup: 0 };
    const journal: LocalObservationJournal = Object.freeze({
      acknowledge: (request) => {
        mutations.acknowledge += 1;
        return fixture.journal.acknowledge(request);
      },
      begin: (begin) => fixture.journal.begin(begin),
      cleanup: (request) => {
        mutations.cleanup += 1;
        return fixture.journal.cleanup(request);
      },
      handoff: (request) => fixture.journal.handoff(request),
      recover: () => fixture.journal.recover(),
    } satisfies LocalObservationJournal);
    const consumer: CompletedObservationConsumer = Object.freeze({
      consume(snapshot: Parameters<CompletedObservationConsumer["consume"]>[0]) {
        deliveries.push(snapshot.projectId);
        if (snapshot.projectId !== "project.default" || !heldConsumer) {
          return Promise.resolve({ ok: true as const, value: undefined });
        }
        heldConsumer = false;
        consumerStarted();
        return new Promise<Result<void>>((resolve) => {
          releaseConsumer = resolve;
        });
      },
    });
    try {
      const { runtime } = await runtimeFixture(completeScanner(), {
        consumer,
        journal,
        projectOperations: projects((id) => project(id)),
      });
      const first = valueOf(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      );
      await startedConsumer;
      first.cancel();
      expect(await first.completion).toMatchObject({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "scanner-host-operation-interrupted" }),
        ]),
        status: "cancelled",
      });
      expect(mutations).toEqual({ acknowledge: 0, cleanup: 0 });
      expect(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-session-quarantined" }],
        ok: false,
      });

      const independentProject = `project_${"3".repeat(32)}`;
      const independent = valueOf(
        await runtime.start({ projectId: independentProject, scannerId: "official.test" }),
      );
      expect((await independent.completion).status).toBe("completed");
      expect(deliveries).toContain(independentProject);

      releaseConsumer({ ok: true, value: undefined });
      let replacement: Result<ScannerExecutionSession> | undefined;
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await Promise.resolve();
        replacement = await runtime.start({
          projectId: "project.default",
          scannerId: "official.test",
        });
        if (replacement.ok) break;
      }
      const replacementExecution = valueOf(replacement!);
      expect((await replacementExecution.completion).status).toBe("completed");
      expect(deliveries.filter((projectId) => projectId === "project.default")).toHaveLength(3);
      expect(mutations.acknowledge).toBe(3);
      expect(mutations.cleanup).toBe(3);
    } finally {
      await fixture.remove();
    }
  });

  test("does not let one failed pending handoff block an independent lane", async () => {
    const fixture = await journalFixture();
    const failedProject = "project.default";
    const independentProject = `project_${"4".repeat(32)}`;
    const deliveries: string[] = [];
    const consumer: CompletedObservationConsumer = Object.freeze({
      consume: async (snapshot: Parameters<CompletedObservationConsumer["consume"]>[0]) => {
        deliveries.push(snapshot.projectId);
        return snapshot.projectId === failedProject
          ? {
              diagnostics: [{ code: "consumer-rejected-a", message: "Lane A is unavailable" }],
              ok: false as const,
            }
          : { ok: true as const, value: undefined };
      },
    });
    try {
      const { runtime } = await runtimeFixture(completeScanner(), {
        consumer,
        journal: fixture.journal,
        projectOperations: projects((id) => project(id)),
      });
      const failed = valueOf(
        await runtime.start({ projectId: failedProject, scannerId: "official.test" }),
      );
      expect((await failed.completion).status).toBe("failed");
      const independent = valueOf(
        await runtime.start({ projectId: independentProject, scannerId: "official.test" }),
      );
      expect((await independent.completion).status).toBe("completed");
      expect(deliveries).toEqual([failedProject, independentProject]);
    } finally {
      await fixture.remove();
    }
  });

  test("targeted recovery excludes full recovery until its handoff is consumed", async () => {
    const fixture = await journalFixture();
    let consumerStarted!: () => void;
    const startedConsumer = new Promise<void>((resolve) => {
      consumerStarted = resolve;
    });
    let releaseConsumer!: () => void;
    const heldConsumer = new Promise<void>((resolve) => {
      releaseConsumer = resolve;
    });
    let deliveries = 0;
    try {
      const durable = valueOf(
        await fixture.journal.begin({
          apiVersion: observationSessionApiVersion,
          epoch: "epoch_recovery",
          projectId: "project.default",
          scopes: [{ id: "workspace", resourceRoot: "." }],
          source: { id: "official.test", instance: "default", version: "2.3.4" },
        }),
      );
      valueOf(
        await durable.submitBatch({
          epoch: "epoch_recovery",
          records: [candidateRecord()],
          sequence: 1,
        }),
      );
      valueOf(
        await durable.complete({
          coverage: [{ kinds: ["component-candidate"], scope: "workspace", state: "partial" }],
          epoch: "epoch_recovery",
          sequence: 2,
        }),
      );
      const consumer: CompletedObservationConsumer = Object.freeze({
        async consume() {
          deliveries += 1;
          if (deliveries === 1) {
            consumerStarted();
            await heldConsumer;
          }
          return { ok: true as const, value: undefined };
        },
      });
      const { runtime } = await runtimeFixture(completeScanner(), {
        consumer,
        journal: fixture.journal,
      });
      const admission = runtime.start({
        projectId: "project.default",
        scannerId: "official.test",
      });
      await startedConsumer;
      expect(await runtime.recover()).toMatchObject({
        diagnostics: [{ code: "scanner-recovery-conflict" }],
        ok: false,
      });
      releaseConsumer();
      const execution = valueOf(await admission);
      expect((await execution.completion).status).toBe("completed");
      expect(deliveries).toBe(2);
      expect(await fixture.journal.recover()).toEqual({
        ok: true,
        value: { abandoned: [], acknowledged: [], handoffs: [] },
      });
    } finally {
      await fixture.remove();
    }
  });

  test("blocks admissions while full recovery is loading unknown journal ownership", async () => {
    const fixture = await journalFixture();
    let refreshStarted!: () => void;
    const startedRefresh = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    let releaseRefresh!: () => void;
    const heldRefresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const journal: LocalObservationJournal = Object.freeze({
      acknowledge: (request) => fixture.journal.acknowledge(request),
      begin: (begin) => fixture.journal.begin(begin),
      cleanup: (request) => fixture.journal.cleanup(request),
      handoff: (request) => fixture.journal.handoff(request),
      async recover() {
        refreshStarted();
        await heldRefresh;
        return fixture.journal.recover();
      },
    } satisfies LocalObservationJournal);
    try {
      const { runtime } = await runtimeFixture(completeScanner(), {
        journal,
        projectOperations: projects((id) => project(id)),
      });
      const recovery = runtime.recover();
      await startedRefresh;
      expect(
        await runtime.start({ projectId: "project.default", scannerId: "official.test" }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-recovery-conflict" }],
        ok: false,
      });
      expect(
        await runtime.start({
          projectId: `project_${"6".repeat(32)}`,
          scannerId: "official.test",
        }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-recovery-conflict" }],
        ok: false,
      });
      releaseRefresh();
      expect(await recovery).toEqual({
        ok: true,
        value: { abandoned: 0, acknowledged: 0, consumed: 0 },
      });
    } finally {
      await fixture.remove();
    }
  });

  test("does not duplicate a full-recovery handoff through concurrent same-lane admission", async () => {
    const fixture = await journalFixture();
    const recoveringProject = "project.default";
    const independentProject = `project_${"5".repeat(32)}`;
    let consumerStarted!: () => void;
    const startedConsumer = new Promise<void>((resolve) => {
      consumerStarted = resolve;
    });
    let releaseConsumer!: () => void;
    const heldConsumer = new Promise<void>((resolve) => {
      releaseConsumer = resolve;
    });
    let acknowledgementStarted!: () => void;
    const startedAcknowledgement = new Promise<void>((resolve) => {
      acknowledgementStarted = resolve;
    });
    let releaseAcknowledgement!: () => void;
    const heldAcknowledgement = new Promise<void>((resolve) => {
      releaseAcknowledgement = resolve;
    });
    let cleanupStarted!: () => void;
    const startedCleanup = new Promise<void>((resolve) => {
      cleanupStarted = resolve;
    });
    let releaseCleanup!: () => void;
    const heldCleanup = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const deliveries: string[] = [];
    let holdRecovery = true;
    try {
      const durable = valueOf(
        await fixture.journal.begin({
          apiVersion: observationSessionApiVersion,
          epoch: "epoch_concurrent_recovery",
          projectId: recoveringProject,
          scopes: [{ id: "workspace", resourceRoot: "." }],
          source: { id: "official.test", instance: "default", version: "2.3.4" },
        }),
      );
      valueOf(
        await durable.submitBatch({
          epoch: "epoch_concurrent_recovery",
          records: [candidateRecord()],
          sequence: 1,
        }),
      );
      valueOf(
        await durable.complete({
          coverage: [{ kinds: ["component-candidate"], scope: "workspace", state: "partial" }],
          epoch: "epoch_concurrent_recovery",
          sequence: 2,
        }),
      );
      const consumer: CompletedObservationConsumer = Object.freeze({
        async consume(snapshot: Parameters<CompletedObservationConsumer["consume"]>[0]) {
          deliveries.push(snapshot.projectId);
          if (snapshot.projectId === recoveringProject && holdRecovery) {
            holdRecovery = false;
            consumerStarted();
            await heldConsumer;
          }
          return { ok: true as const, value: undefined };
        },
      });
      const journal: LocalObservationJournal = Object.freeze({
        async acknowledge(request) {
          if (request.projectId === recoveringProject) {
            acknowledgementStarted();
            await heldAcknowledgement;
          }
          return fixture.journal.acknowledge(request);
        },
        begin: (begin) => fixture.journal.begin(begin),
        async cleanup(request) {
          if (request.projectId === recoveringProject) {
            cleanupStarted();
            await heldCleanup;
          }
          return fixture.journal.cleanup(request);
        },
        handoff: (request) => fixture.journal.handoff(request),
        recover: () => fixture.journal.recover(),
      } satisfies LocalObservationJournal);
      const { runtime } = await runtimeFixture(completeScanner(), {
        consumer,
        journal,
        projectOperations: projects((id) => project(id)),
      });
      const recovery = runtime.recover();
      await startedConsumer;

      expect(
        await runtime.start({ projectId: recoveringProject, scannerId: "official.test" }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-recovery-conflict" }],
        ok: false,
      });
      expect(deliveries).toEqual([recoveringProject]);

      const independent = valueOf(
        await runtime.start({ projectId: independentProject, scannerId: "official.test" }),
      );
      expect((await independent.completion).status).toBe("completed");
      expect(deliveries).toEqual([recoveringProject, independentProject]);

      releaseConsumer();
      await startedAcknowledgement;
      expect(
        await runtime.start({ projectId: recoveringProject, scannerId: "official.test" }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-recovery-conflict" }],
        ok: false,
      });
      releaseAcknowledgement();
      await startedCleanup;
      expect(
        await runtime.start({ projectId: recoveringProject, scannerId: "official.test" }),
      ).toMatchObject({
        diagnostics: [{ code: "scanner-recovery-conflict" }],
        ok: false,
      });
      releaseCleanup();
      expect(await recovery).toEqual({
        ok: true,
        value: { abandoned: 0, acknowledged: 0, consumed: 1 },
      });
      expect(deliveries.filter((projectId) => projectId === recoveringProject)).toHaveLength(1);
    } finally {
      await fixture.remove();
    }
  });
});
