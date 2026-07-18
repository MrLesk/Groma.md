import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseDocument, stringify } from "yaml";

import {
  createEntityAliasResolver,
  createObservationSession,
  observationSessionApiVersion,
  parseEntityId,
  parseGraphGeneration,
  type CompletedObservationSnapshot,
  type EntityId,
  type ObservationRecord,
} from "../../core/index.ts";
import {
  createEvidenceBindingStore,
  createLocalResourceProvider,
  type CanonicalTransactionTarget,
  type EvidenceBindingMutation,
  type EvidenceBindingSnapshot,
  type EvidenceObservationIdentity,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-evidence-store-"));
  roots.push(root);
  return root;
}

function generation(value: number) {
  const parsed = parseGraphGeneration(value);
  if (!parsed.ok) throw new Error("invalid test generation");
  return parsed.value;
}

function entity(value: string): EntityId {
  const parsed = parseEntityId(value);
  if (!parsed.ok) throw new Error("invalid test entity");
  return parsed.value;
}

const componentOld = entity("ent_00000000000000000000000000000001");
const componentLive = entity("ent_00000000000000000000000000000002");
const componentOther = entity("ent_00000000000000000000000000000003");

function provenance(scope: string, resource: string, character = "a") {
  return Object.freeze([
    Object.freeze({
      fingerprint: `sha256:${character.repeat(16)}`,
      range: Object.freeze({ endByteExclusive: 11, startByte: 3 }),
      resource,
      scope,
    }),
  ]);
}

function sixRecords(): readonly ObservationRecord[] {
  return Object.freeze([
    Object.freeze({
      candidate: Object.freeze({
        iconDomain: "example.test",
        label: "API",
        name: "API component",
        summary: "Owns the external API.",
        type: "service",
      }),
      key: "component.api",
      kind: "component-candidate" as const,
      provenance: provenance("src", "src/api.ts", "a"),
      scope: "src",
    }),
    Object.freeze({
      component: Object.freeze({ key: "component.api", scope: "src" }),
      description: "Receives a request.",
      key: "input.request",
      kind: "input" as const,
      name: "request",
      provenance: provenance("src", "src/api.ts", "b"),
      scope: "src",
    }),
    Object.freeze({
      component: Object.freeze({ key: "component.api", scope: "src" }),
      description: "Returns a response.",
      key: "output.response",
      kind: "output" as const,
      name: "response",
      provenance: provenance("src", "src/api.ts", "c"),
      scope: "src",
    }),
    Object.freeze({
      component: Object.freeze({ key: "component.api", scope: "src" }),
      description: "Handles a request.",
      key: "action.handle",
      kind: "action" as const,
      name: "handle",
      provenance: provenance("src", "src/api.ts", "d"),
      scope: "src",
    }),
    Object.freeze({
      from: Object.freeze({ key: "component.api", scope: "src" }),
      key: "relationship.calls",
      kind: "relationship" as const,
      provenance: provenance("src", "src/api.ts", "e"),
      relationshipType: "calls",
      scope: "src",
      to: Object.freeze({ key: "docs.api", scope: "docs" }),
    }),
    Object.freeze({
      content: "# API\n\nThe public contract.",
      format: "markdown" as const,
      key: "docs.api",
      kind: "documentation" as const,
      provenance: provenance("docs", "docs/api.md", "f"),
      scope: "docs",
      subject: Object.freeze({ key: "component.api", scope: "src" }),
    }),
  ]);
}

function scaleComponentRecord(index: number): ObservationRecord {
  return Object.freeze({
    candidate: Object.freeze({
      name: `Scale component ${index.toString().padStart(5, "0")}`,
      type: "service",
    }),
    key: `component.scale.${index.toString().padStart(5, "0")}`,
    kind: "component-candidate" as const,
    provenance: provenance("src", "src/scale.ts", "a"),
    scope: "src",
  });
}

function completedSnapshot(
  options: {
    readonly epoch?: string;
    readonly projectId?: string;
    readonly records?: readonly ObservationRecord[];
    readonly sourceId?: string;
    readonly sourceInstance?: string;
    readonly sourceVersion?: string;
  } = {},
): CompletedObservationSnapshot {
  const epoch = options.epoch ?? "epoch-1";
  const records = options.records ?? sixRecords();
  const session = createObservationSession(
    {
      apiVersion: observationSessionApiVersion,
      epoch,
      projectId: options.projectId ?? "project-a",
      scopes: Object.freeze([
        Object.freeze({ id: "docs", resourceRoot: "docs" }),
        Object.freeze({ id: "src", resourceRoot: "src" }),
      ]),
      source: Object.freeze({
        id: options.sourceId ?? "scanner.ts",
        instance: options.sourceInstance ?? "workspace",
        version: options.sourceVersion ?? "1.2.3",
      }),
    },
    records.length > 2_048 ? { maxBatchRecords: records.length } : undefined,
  );
  if (!session.ok) throw new Error(JSON.stringify(session.diagnostics));
  const submitted = session.value.submitBatch({
    epoch,
    records,
    sequence: 1,
  });
  if (!submitted.ok) throw new Error(JSON.stringify(submitted.diagnostics));
  const completed = session.value.complete({
    coverage: Object.freeze([
      Object.freeze({
        kinds: Object.freeze(["documentation" as const]),
        scope: "docs",
        state: "partial" as const,
      }),
      Object.freeze({
        kinds: Object.freeze([
          "action" as const,
          "component-candidate" as const,
          "input" as const,
          "output" as const,
          "relationship" as const,
        ]),
        scope: "src",
        state: "complete" as const,
      }),
    ]),
    epoch,
    sequence: 2,
  });
  if (!completed.ok) throw new Error(JSON.stringify(completed.diagnostics));
  return completed.value;
}

function identity(
  snapshot: CompletedObservationSnapshot,
  key: string,
  scope = "src",
): EvidenceObservationIdentity {
  return Object.freeze({
    key,
    projectId: snapshot.projectId,
    scope,
    sourceId: snapshot.source.id,
    sourceInstance: snapshot.source.instance,
  });
}

async function applyTargets(root: string, targets: readonly CanonicalTransactionTarget[]) {
  for (const target of targets) {
    const file = path.join(root, String(target.locator));
    if (target.replacement === undefined) {
      await rm(file, { force: true });
    } else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, target.replacement);
    }
  }
}

async function persistSnapshotDocuments(root: string, snapshot: EvidenceBindingSnapshot) {
  for (const stored of snapshot.documents) {
    const file = path.join(root, String(stored.locator));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, stored.bytes);
  }
}

async function emptyStore(root: string) {
  const resources = await createLocalResourceProvider({ workspaceRoot: root });
  const store = createEvidenceBindingStore({ resources });
  const loaded = await store.load();
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.diagnostics));
  return { loaded: loaded.value, resources, store };
}

interface MutableBindingYamlRecord {
  decision: Record<string, unknown>;
  generation: number;
}

interface MutableBindingYaml {
  history: MutableBindingYamlRecord[];
  identity: EvidenceObservationIdentity;
}

function yamlIdentity(identityValue: EvidenceObservationIdentity): Record<string, string> {
  return {
    key: identityValue.key,
    projectId: identityValue.projectId,
    scope: identityValue.scope,
    sourceId: identityValue.sourceId,
    sourceInstance: identityValue.sourceInstance,
  };
}

async function rewriteBindingDocuments(
  root: string,
  snapshot: EvidenceBindingSnapshot,
  mutate: (bindings: MutableBindingYaml[]) => boolean,
) {
  for (const stored of snapshot.documents.filter((item) => item.kind === "binding-shard")) {
    const source = new TextDecoder().decode(stored.bytes);
    const document = parseDocument(source.slice(4, -4), {
      schema: "core",
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });
    const frontmatter = document.toJS({ maxAliasCount: 0 }) as {
      bindings: MutableBindingYaml[];
    };
    if (!mutate(frontmatter.bindings)) continue;
    const rewritten = `---\n${stringify(frontmatter, {
      aliasDuplicateObjects: false,
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
    })}---\n`;
    const locator = path.join(root, String(stored.locator));
    await writeFile(locator, rewritten);
  }
}

async function persistedHistoryFixture(root: string) {
  const empty = await emptyStore(root);
  const firstSnapshot = completedSnapshot();
  const otherSnapshot = completedSnapshot({ projectId: "project-b", sourceInstance: "other" });
  const first = empty.store.plan(empty.loaded, {
    completedSnapshot: firstSnapshot,
    generation: generation(1),
  });
  if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
  const second = empty.store.plan(first.value.snapshot, {
    completedSnapshot: otherSnapshot,
    generation: generation(2),
  });
  if (!second.ok) throw new Error(JSON.stringify(second.diagnostics));
  const automatic = empty.store.plan(second.value.snapshot, {
    bindingMutations: [
      {
        decision: { componentId: componentLive, type: "automatic" },
        identity: identity(firstSnapshot, "component.api"),
      },
      {
        decision: { componentId: componentLive, type: "automatic" },
        identity: identity(firstSnapshot, "input.request"),
      },
      {
        decision: { componentId: componentLive, type: "automatic" },
        identity: identity(otherSnapshot, "component.api"),
      },
    ],
    generation: generation(3),
  });
  if (!automatic.ok) throw new Error(JSON.stringify(automatic.diagnostics));
  const explicit = empty.store.plan(automatic.value.snapshot, {
    bindingMutations: [
      {
        decision: { componentId: componentOther, type: "explicit" },
        identity: identity(firstSnapshot, "component.api"),
      },
      {
        decision: { componentId: componentOther, type: "explicit" },
        identity: identity(firstSnapshot, "input.request"),
      },
      {
        decision: { componentId: componentOther, type: "explicit" },
        identity: identity(otherSnapshot, "component.api"),
      },
    ],
    generation: generation(4),
  });
  if (!explicit.ok) throw new Error(JSON.stringify(explicit.diagnostics));
  for (const targets of [
    first.value.targets,
    second.value.targets,
    automatic.value.targets,
    explicit.value.targets,
  ]) {
    await applyTargets(root, targets);
  }
  return {
    firstSnapshot,
    otherSnapshot,
    snapshot: explicit.value.snapshot,
    store: empty.store,
  };
}

async function loadPersisted(root: string) {
  const resources = await createLocalResourceProvider({ workspaceRoot: root });
  return createEvidenceBindingStore({ resources }).load();
}

describe("canonical evidence and binding store", () => {
  test("persists all observation kinds, coverage, provenance, and restart generations without intent writes", async () => {
    const root = await temporaryRoot();
    const intent = path.join(
      root,
      "groma",
      "intent",
      "00",
      "ent_00000000000000000000000000000000.md",
    );
    await mkdir(path.dirname(intent), { recursive: true });
    await writeFile(intent, "curated intent\n");
    const { loaded, store } = await emptyStore(root);
    const snapshot = completedSnapshot();

    const planned = store.plan(loaded, { completedSnapshot: snapshot, generation: generation(7) });

    expect(planned.ok).toBeTrue();
    if (!planned.ok) return;
    expect(planned.value.changed).toBeTrue();
    expect(
      planned.value.targets.every((target) => String(target.locator).startsWith("groma/evidence/")),
    ).toBeTrue();
    expect(planned.value.snapshot.evidence.map((entry) => entry.observation.kind).sort()).toEqual([
      "action",
      "component-candidate",
      "documentation",
      "input",
      "output",
      "relationship",
    ]);
    expect(planned.value.snapshot.sources[0]).toMatchObject({
      generation: 7,
      projectId: "project-a",
      recordCount: 6,
      sourceId: "scanner.ts",
      sourceInstance: "workspace",
      sourceVersion: "1.2.3",
    });
    expect(planned.value.snapshot.sources[0]?.coverage).toEqual(snapshot.coverage);
    expect(planned.value.snapshot.evidence[0]?.observation.provenance[0]?.range).toEqual({
      endByteExclusive: 11,
      startByte: 3,
    });
    await applyTargets(root, planned.value.targets);
    expect(await readFile(intent, "utf8")).toBe("curated intent\n");

    const restarted = await emptyStore(root);
    expect(Number(restarted.loaded.sources[0]?.generation)).toBe(7);
    expect(restarted.loaded.evidence.every((entry) => entry.observedGeneration === 7)).toBeTrue();
    const replay = restarted.store.plan(restarted.loaded, {
      completedSnapshot: completedSnapshot({ epoch: "epoch-replay" }),
      generation: generation(8),
    });
    expect(replay).toMatchObject({ ok: true, value: { changed: false, targets: [] } });
    if (replay.ok) {
      expect(replay.value.snapshot.documents.map((item) => [item.resource, item.revision])).toEqual(
        restarted.loaded.documents.map((item) => [item.resource, item.revision]),
      );
    }
  });

  test("reconstructs a zero-record completed source and its exact coverage after restart", async () => {
    const root = await temporaryRoot();
    const { loaded, store } = await emptyStore(root);
    const snapshot = completedSnapshot({ records: Object.freeze([]) });
    const planned = store.plan(loaded, {
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
    expect(planned.value.snapshot.sources).toHaveLength(1);
    expect(planned.value.snapshot.sources[0]).toMatchObject({ recordCount: 0 });
    expect(planned.value.snapshot.evidence).toEqual([]);
    expect(planned.value.snapshot.documents.map((item) => item.kind)).toEqual(["source"]);
    await applyTargets(root, planned.value.targets);

    const restarted = await emptyStore(root);
    expect(restarted.loaded.sources[0]?.coverage).toEqual(snapshot.coverage);
    expect(restarted.loaded.sources[0]?.recordCount).toBe(0);
    expect(restarted.loaded.evidence).toEqual([]);
    expect(restarted.loaded.documents.map((item) => item.kind)).toEqual(["source"]);
    expect(restarted.store.plan(restarted.loaded, { generation: generation(2) })).toMatchObject({
      ok: true,
      value: { changed: false, targets: [] },
    });
  });

  test("retains missing evidence and binding history, and resolves supersession through aliases without byte rewrites", async () => {
    const root = await temporaryRoot();
    const first = await emptyStore(root);
    const snapshot = completedSnapshot();
    const seeded = first.store.plan(first.loaded, {
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    if (!seeded.ok) throw new Error(JSON.stringify(seeded.diagnostics));
    const mutations: readonly EvidenceBindingMutation[] = Object.freeze([
      Object.freeze({
        decision: Object.freeze({ componentId: componentOld, type: "automatic" as const }),
        identity: identity(snapshot, "component.api"),
      }),
      Object.freeze({
        decision: Object.freeze({ componentId: componentOther, type: "explicit" as const }),
        identity: identity(snapshot, "input.request"),
      }),
      Object.freeze({
        decision: Object.freeze({ type: "ignored" as const }),
        identity: identity(snapshot, "output.response"),
      }),
      Object.freeze({
        decision: Object.freeze({
          successor: identity(snapshot, "relationship.calls"),
          type: "superseded" as const,
        }),
        identity: identity(snapshot, "action.handle"),
      }),
      Object.freeze({
        decision: Object.freeze({ componentId: componentOld, type: "automatic" as const }),
        identity: identity(snapshot, "relationship.calls"),
      }),
    ]);
    const bound = first.store.plan(seeded.value.snapshot, {
      bindingMutations: mutations,
      generation: generation(2),
    });
    if (!bound.ok) throw new Error(JSON.stringify(bound.diagnostics));
    await applyTargets(root, [...seeded.value.targets, ...bound.value.targets]);
    const restarted = await emptyStore(root);
    const revisions = restarted.loaded.documents.map((item) => [item.resource, item.revision]);
    const rematerialized = restarted.store.plan(restarted.loaded, {
      generation: generation(3),
    });
    expect(rematerialized).toMatchObject({ ok: true, value: { changed: false, targets: [] } });
    if (rematerialized.ok) {
      const exactDocuments = (documents: EvidenceBindingSnapshot["documents"]) =>
        documents.map((item) => [
          item.resource,
          item.revision,
          new TextDecoder().decode(item.bytes),
        ]);
      expect(exactDocuments(rematerialized.value.snapshot.documents)).toEqual(
        exactDocuments(restarted.loaded.documents),
      );
      expect(new Set(rematerialized.value.snapshot.documents.map((item) => item.kind))).toEqual(
        new Set(["source", "evidence-shard", "binding-shard"]),
      );
    }
    const aliases = createEntityAliasResolver(
      [{ source: componentOld, target: componentLive }],
      new Set([componentLive, componentOther]),
    );
    if (!aliases.ok) throw new Error(JSON.stringify(aliases.diagnostics));

    const resolved = restarted.store.resolve(
      restarted.loaded,
      identity(snapshot, "action.handle"),
      aliases.value,
    );
    expect(resolved).toMatchObject({
      ok: true,
      value: {
        decision: "automatic",
        observationChain: [identity(snapshot, "relationship.calls")],
        resolvedComponentId: componentLive,
        storedComponentId: componentOld,
      },
    });
    expect(restarted.loaded.documents.map((item) => [item.resource, item.revision])).toEqual(
      revisions,
    );
    const missingAlias = createEntityAliasResolver([], new Set([componentOther]));
    if (!missingAlias.ok) throw new Error(JSON.stringify(missingAlias.diagnostics));
    expect(
      restarted.store.resolve(
        restarted.loaded,
        identity(snapshot, "relationship.calls"),
        missingAlias.value,
      ),
    ).toMatchObject({ diagnostics: [{ code: "unknown-entity" }], ok: false });

    const subset = completedSnapshot({
      epoch: "epoch-subset",
      records: Object.freeze([sixRecords()[0]!, sixRecords()[1]!]),
      sourceVersion: "1.2.4",
    });
    const rescanned = restarted.store.plan(restarted.loaded, {
      bindingMutations: [
        {
          decision: { componentId: componentLive, type: "explicit" },
          identity: identity(snapshot, "input.request"),
        },
      ],
      completedSnapshot: subset,
      generation: generation(3),
    });
    if (!rescanned.ok) throw new Error(JSON.stringify(rescanned.diagnostics));
    expect(rescanned.value.snapshot.sources[0]?.recordCount).toBe(2);
    expect(rescanned.value.snapshot.evidence).toHaveLength(6);
    expect(
      Number(
        rescanned.value.snapshot.evidence.find((entry) => entry.identity.key === "output.response")
          ?.observedGeneration,
      ),
    ).toBe(1);
    expect(
      rescanned.value.snapshot.bindings.find((binding) => binding.identity.key === "input.request")
        ?.history,
    ).toHaveLength(2);
    expect(
      rescanned.value.snapshot.bindings.find(
        (binding) => binding.identity.key === "output.response",
      ),
    ).toEqual(
      restarted.loaded.bindings.find((binding) => binding.identity.key === "output.response"),
    );

    const unavailable = restarted.store.plan(rescanned.value.snapshot, {
      generation: generation(4),
    });
    expect(unavailable).toMatchObject({ ok: true, value: { changed: false, targets: [] } });
    if (unavailable.ok)
      expect(unavailable.value.snapshot.evidence).toEqual(rescanned.value.snapshot.evidence);
  });

  test("fails closed on duplicate, cross-lane, missing-terminal, cyclic, and stale-generation binding decisions", async () => {
    const root = await temporaryRoot();
    const empty = await emptyStore(root);
    const firstSnapshot = completedSnapshot();
    const otherSnapshot = completedSnapshot({ projectId: "project-b", sourceInstance: "other" });
    const first = empty.store.plan(empty.loaded, {
      completedSnapshot: firstSnapshot,
      generation: generation(1),
    });
    if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
    const second = empty.store.plan(first.value.snapshot, {
      completedSnapshot: otherSnapshot,
      generation: generation(2),
    });
    if (!second.ok) throw new Error(JSON.stringify(second.diagnostics));
    expect(second.value.snapshot.sources).toHaveLength(2);
    expect(second.value.snapshot.evidence).toHaveLength(12);
    expect(
      new Set(
        second.value.snapshot.evidence
          .filter((entry) => entry.identity.key === "component.api")
          .map((entry) => entry.identity.projectId),
      ),
    ).toEqual(new Set(["project-a", "project-b"]));
    const automatic: EvidenceBindingMutation = Object.freeze({
      decision: Object.freeze({ componentId: componentLive, type: "automatic" as const }),
      identity: identity(firstSnapshot, "component.api"),
    });
    expect(
      empty.store.plan(second.value.snapshot, {
        bindingMutations: [automatic, automatic],
        generation: generation(3),
      }),
    ).toMatchObject({ diagnostics: [{ code: "duplicate-binding-mutation" }], ok: false });
    expect(
      empty.store.plan(second.value.snapshot, {
        bindingMutations: [
          {
            decision: {
              successor: identity(otherSnapshot, "component.api"),
              type: "superseded",
            },
            identity: identity(firstSnapshot, "component.api"),
          },
        ],
        generation: generation(3),
      }),
    ).toMatchObject({ diagnostics: [{ code: "binding-cross-lane-supersession" }], ok: false });
    expect(
      empty.store.plan(second.value.snapshot, {
        bindingMutations: [
          {
            decision: {
              successor: identity(firstSnapshot, "input.request"),
              type: "superseded",
            },
            identity: identity(firstSnapshot, "component.api"),
          },
        ],
        generation: generation(3),
      }),
    ).toMatchObject({ diagnostics: [{ code: "binding-terminal-missing" }], ok: false });
    expect(
      empty.store.plan(second.value.snapshot, {
        bindingMutations: [
          {
            decision: {
              successor: identity(firstSnapshot, "input.request"),
              type: "superseded",
            },
            identity: identity(firstSnapshot, "component.api"),
          },
          {
            decision: {
              successor: identity(firstSnapshot, "component.api"),
              type: "superseded",
            },
            identity: identity(firstSnapshot, "input.request"),
          },
        ],
        generation: generation(3),
      }),
    ).toMatchObject({ diagnostics: [{ code: "binding-supersession-cycle" }], ok: false });
    const bound = empty.store.plan(second.value.snapshot, {
      bindingMutations: [automatic],
      generation: generation(3),
    });
    if (!bound.ok) throw new Error(JSON.stringify(bound.diagnostics));
    expect(
      empty.store.plan(bound.value.snapshot, {
        bindingMutations: [
          {
            decision: { componentId: componentOther, type: "explicit" },
            identity: identity(firstSnapshot, "component.api"),
          },
        ],
        generation: generation(3),
      }),
    ).toMatchObject({ diagnostics: [{ code: "evidence-generation-not-advanced" }], ok: false });
  });

  test("rejects invalid persisted supersession history even when later decisions mask it", async () => {
    const cases = [
      {
        code: "binding-cross-lane-supersession",
        mutate: (
          bindings: MutableBindingYaml[],
          firstSnapshot: CompletedObservationSnapshot,
          otherSnapshot: CompletedObservationSnapshot,
        ) => {
          const origin = bindings.find(
            (binding) =>
              binding.identity.key === "component.api" &&
              binding.identity.projectId === "project-a",
          );
          if (origin === undefined) return false;
          origin.history[0]!.decision = {
            type: "superseded",
            successor: yamlIdentity(identity(otherSnapshot, "component.api")),
          };
          return true;
        },
        name: "cross-lane",
      },
      {
        code: "binding-supersession-cycle",
        mutate: (bindings: MutableBindingYaml[], firstSnapshot: CompletedObservationSnapshot) => {
          const origin = bindings.find(
            (binding) =>
              binding.identity.key === "component.api" &&
              binding.identity.projectId === "project-a",
          );
          if (origin === undefined) return false;
          origin.history[0]!.decision = {
            type: "superseded",
            successor: yamlIdentity(identity(firstSnapshot, "component.api")),
          };
          return true;
        },
        name: "self-referential",
      },
      {
        code: "binding-terminal-missing",
        mutate: (bindings: MutableBindingYaml[], firstSnapshot: CompletedObservationSnapshot) => {
          const origin = bindings.find(
            (binding) =>
              binding.identity.key === "component.api" &&
              binding.identity.projectId === "project-a",
          );
          if (origin === undefined) return false;
          origin.history[0]!.decision = {
            type: "superseded",
            successor: yamlIdentity(identity(firstSnapshot, "output.response")),
          };
          return true;
        },
        name: "missing-terminal",
      },
      {
        code: "binding-supersession-cycle",
        mutate: (bindings: MutableBindingYaml[], firstSnapshot: CompletedObservationSnapshot) => {
          let changed = false;
          const origin = bindings.find(
            (binding) =>
              binding.identity.key === "component.api" &&
              binding.identity.projectId === "project-a",
          );
          if (origin !== undefined) {
            origin.history[0]!.decision = {
              type: "superseded",
              successor: yamlIdentity(identity(firstSnapshot, "input.request")),
            };
            changed = true;
          }
          const successor = bindings.find(
            (binding) =>
              binding.identity.key === "input.request" &&
              binding.identity.projectId === "project-a",
          );
          if (successor !== undefined) {
            successor.history[0]!.decision = {
              type: "superseded",
              successor: yamlIdentity(identity(firstSnapshot, "component.api")),
            };
            changed = true;
          }
          return changed;
        },
        name: "cycle",
      },
    ] as const;

    for (const historyCase of cases) {
      const root = await temporaryRoot();
      const fixture = await persistedHistoryFixture(root);
      let changed = false;
      await rewriteBindingDocuments(root, fixture.snapshot, (bindings) => {
        const mutated = historyCase.mutate(bindings, fixture.firstSnapshot, fixture.otherSnapshot);
        changed = changed || mutated;
        return mutated;
      });
      expect(changed, historyCase.name).toBeTrue();
      expect(await loadPersisted(root), historyCase.name).toMatchObject({
        diagnostics: [{ code: historyCase.code }],
        ok: false,
      });
    }
  });

  test("reloads a valid terminal-to-superseded-to-terminal binding history", async () => {
    const root = await temporaryRoot();
    const fixture = await persistedHistoryFixture(root);
    const superseded = fixture.store.plan(fixture.snapshot, {
      bindingMutations: [
        {
          decision: {
            successor: identity(fixture.firstSnapshot, "input.request"),
            type: "superseded",
          },
          identity: identity(fixture.firstSnapshot, "component.api"),
        },
      ],
      generation: generation(5),
    });
    if (!superseded.ok) throw new Error(JSON.stringify(superseded.diagnostics));
    const terminal = fixture.store.plan(superseded.value.snapshot, {
      bindingMutations: [
        {
          decision: { componentId: componentOther, type: "explicit" },
          identity: identity(fixture.firstSnapshot, "component.api"),
        },
      ],
      generation: generation(6),
    });
    if (!terminal.ok) throw new Error(JSON.stringify(terminal.diagnostics));
    await applyTargets(root, superseded.value.targets);
    await applyTargets(root, terminal.value.targets);

    const reloaded = await loadPersisted(root);
    expect(reloaded.ok).toBeTrue();
    if (!reloaded.ok) return;
    expect(
      reloaded.value.bindings
        .find(
          (binding) =>
            binding.identity.key === "component.api" && binding.identity.projectId === "project-a",
        )
        ?.history.map((entry) => entry.decision.type),
    ).toEqual(["automatic", "explicit", "superseded", "explicit"]);
    const aliases = createEntityAliasResolver([], new Set([componentLive, componentOther]));
    if (!aliases.ok) throw new Error(JSON.stringify(aliases.diagnostics));
    expect(
      fixture.store.resolve(
        reloaded.value,
        identity(fixture.firstSnapshot, "component.api"),
        aliases.value,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        decision: "explicit",
        observationChain: [],
        resolvedComponentId: componentOther,
        storedComponentId: componentOther,
      },
    });
  });

  test("validates a long same-generation supersession chain with bounded linear work", async () => {
    const root = await temporaryRoot();
    const { loaded, store } = await emptyStore(root);
    const chainLength = 8_192;
    const records = Object.freeze(
      Array.from({ length: chainLength + 1 }, (_, index) => scaleComponentRecord(index)),
    );
    const snapshot = completedSnapshot({ records });
    const identities = records.map((record) => identity(snapshot, record.key));
    const chain = (terminal: "cycle" | "ignored" | "missing"): EvidenceBindingMutation[] =>
      identities.slice(0, chainLength).map((observationIdentity, index) => ({
        decision:
          index < chainLength - 1
            ? { successor: identities[index + 1]!, type: "superseded" as const }
            : terminal === "ignored"
              ? { type: "ignored" as const }
              : {
                  successor: terminal === "cycle" ? identities[0]! : identities[chainLength]!,
                  type: "superseded" as const,
                },
        identity: observationIdentity,
      }));

    const started = performance.now();
    const valid = store.plan(loaded, {
      bindingMutations: chain("ignored"),
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    expect(valid.ok).toBeTrue();
    expect(performance.now() - started).toBeLessThan(10_000);
    expect(
      store.plan(loaded, {
        bindingMutations: chain("cycle"),
        completedSnapshot: snapshot,
        generation: generation(1),
      }),
    ).toMatchObject({ diagnostics: [{ code: "binding-supersession-cycle" }], ok: false });
    expect(
      store.plan(loaded, {
        bindingMutations: chain("missing"),
        completedSnapshot: snapshot,
        generation: generation(1),
      }),
    ).toMatchObject({ diagnostics: [{ code: "binding-terminal-missing" }], ok: false });
  });

  test("bounds aggregate binding history across planning, replay, and restart", async () => {
    const root = await temporaryRoot();
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const bindingCount = 512;
    const historyGenerations = 16;
    const maximumHistoryEntries = bindingCount * historyGenerations;
    const store = createEvidenceBindingStore({
      bounds: {
        maxBindingHistoryEntries: 32,
        maxBindings: bindingCount,
        maxEvidenceRecords: bindingCount,
        maxTotalBindingHistoryEntries: maximumHistoryEntries,
      },
      resources,
    });
    const empty = await store.load();
    if (!empty.ok) throw new Error(JSON.stringify(empty.diagnostics));
    const records = Object.freeze(
      Array.from({ length: bindingCount }, (_, index) => scaleComponentRecord(index)),
    );
    const snapshot = completedSnapshot({ records });
    const identities = records.map((record) => identity(snapshot, record.key));
    let current = empty.value;
    for (
      let currentGeneration = 1;
      currentGeneration <= historyGenerations;
      currentGeneration += 1
    ) {
      const planned = store.plan(current, {
        bindingMutations: identities.map((observationIdentity) => ({
          decision:
            currentGeneration % 2 === 0
              ? { componentId: componentLive, type: "automatic" as const }
              : { type: "ignored" as const },
          identity: observationIdentity,
        })),
        ...(currentGeneration === 1 ? { completedSnapshot: snapshot } : {}),
        generation: generation(currentGeneration),
      });
      if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
      current = planned.value.snapshot;
    }
    expect(current.bindings.reduce((total, binding) => total + binding.history.length, 0)).toBe(
      maximumHistoryEntries,
    );
    await persistSnapshotDocuments(root, current);
    expect((await store.load()).ok).toBeTrue();
    expect(
      store.plan(current, {
        bindingMutations: [{ decision: { type: "ignored" }, identity: identities[0]! }],
        generation: generation(historyGenerations + 1),
      }),
    ).toMatchObject({ diagnostics: [{ code: "evidence-item-limit-exceeded" }], ok: false });
    const belowAggregateBoundary = createEvidenceBindingStore({
      bounds: {
        maxBindingHistoryEntries: 32,
        maxBindings: bindingCount,
        maxEvidenceRecords: bindingCount,
        maxTotalBindingHistoryEntries: maximumHistoryEntries - 1,
      },
      resources,
    });
    expect(await belowAggregateBoundary.load()).toMatchObject({
      diagnostics: [{ code: "evidence-item-limit-exceeded" }],
      ok: false,
    });
  });

  test("indexes current evidence by source lane instead of rescanning it per source", async () => {
    const root = await temporaryRoot();
    const { loaded, store } = await emptyStore(root);
    const sourceCount = 256;
    const sourceRecords = Object.freeze(sixRecords().slice(0, 4));
    const sources: EvidenceBindingSnapshot["sources"][number][] = [];
    const evidence: EvidenceBindingSnapshot["evidence"][number][] = [];
    for (let index = 0; index < sourceCount; index += 1) {
      const sourceSnapshot = completedSnapshot({
        records: sourceRecords,
        sourceInstance: `scale-${index.toString().padStart(4, "0")}`,
      });
      const planned = store.plan(loaded, {
        completedSnapshot: sourceSnapshot,
        generation: generation(1),
      });
      if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
      sources.push(...planned.value.snapshot.sources);
      evidence.push(...planned.value.snapshot.evidence);
    }

    let sourceInstanceReads = 0;
    const countedEvidence = Object.freeze(
      evidence.map((entry) => {
        const storedSourceInstance = entry.identity.sourceInstance;
        return Object.freeze({
          ...entry,
          identity: Object.freeze({
            key: entry.identity.key,
            projectId: entry.identity.projectId,
            scope: entry.identity.scope,
            sourceId: entry.identity.sourceId,
            get sourceInstance() {
              sourceInstanceReads += 1;
              return storedSourceInstance;
            },
          }),
        });
      }),
    );
    const combined: EvidenceBindingSnapshot = Object.freeze({
      bindings: Object.freeze([]),
      documents: Object.freeze([]),
      evidence: countedEvidence,
      sources: Object.freeze(sources),
    });
    const planned = store.plan(combined, { generation: generation(2) });
    expect(planned.ok).toBeTrue();
    if (planned.ok) {
      expect(planned.value.snapshot.sources).toHaveLength(sourceCount);
      expect(planned.value.snapshot.evidence).toHaveLength(sourceCount * sourceRecords.length);
    }
    expect(sourceInstanceReads).toBeLessThan(countedEvidence.length * 48);
  });

  test("rejects cumulative evidence, binding, and history counts across individually bounded shards", async () => {
    const root = await temporaryRoot();
    const { loaded, resources, store } = await emptyStore(root);
    let current = loaded;
    for (let index = 0; index < 6; index += 1) {
      const sourceSnapshot = completedSnapshot({
        records: Object.freeze([scaleComponentRecord(0)]),
        sourceInstance: `shard-${index}`,
      });
      const planned = store.plan(current, {
        completedSnapshot: sourceSnapshot,
        generation: generation(index + 1),
      });
      if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
      await applyTargets(root, planned.value.targets);
      current = planned.value.snapshot;
    }
    const evidenceShards = current.documents.filter((item) => item.kind === "evidence-shard");
    expect(evidenceShards.length).toBeGreaterThan(1);
    for (const shard of evidenceShards) {
      const decoded = store.decodeEvidenceShard(shard.locator, shard.bytes);
      if (!decoded.ok) throw new Error(JSON.stringify(decoded.diagnostics));
      expect(decoded.value.length).toBeLessThanOrEqual(3);
    }
    expect(
      await createEvidenceBindingStore({
        bounds: { maxEvidenceRecords: 3, maxSources: 6 },
        resources,
      }).load(),
    ).toMatchObject({ diagnostics: [{ code: "evidence-item-limit-exceeded" }], ok: false });

    const bound = store.plan(current, {
      bindingMutations: current.evidence.map((entry) => ({
        decision: { type: "ignored" as const },
        identity: entry.identity,
      })),
      generation: generation(7),
    });
    if (!bound.ok) throw new Error(JSON.stringify(bound.diagnostics));
    await applyTargets(root, bound.value.targets);
    current = bound.value.snapshot;
    const bindingShards = current.documents.filter((item) => item.kind === "binding-shard");
    expect(bindingShards.length).toBeGreaterThan(1);
    for (const shard of bindingShards) {
      const decoded = store.decodeBindingShard(shard.locator, shard.bytes);
      if (!decoded.ok) throw new Error(JSON.stringify(decoded.diagnostics));
      expect(decoded.value.length).toBeLessThanOrEqual(3);
    }
    expect(
      await createEvidenceBindingStore({
        bounds: { maxBindings: 3, maxEvidenceRecords: 6, maxSources: 6 },
        resources,
      }).load(),
    ).toMatchObject({ diagnostics: [{ code: "evidence-item-limit-exceeded" }], ok: false });
    expect(
      await createEvidenceBindingStore({
        bounds: {
          maxBindings: 6,
          maxEvidenceRecords: 6,
          maxSources: 6,
          maxTotalBindingHistoryEntries: 5,
        },
        resources,
      }).load(),
    ).toMatchObject({ diagnostics: [{ code: "evidence-item-limit-exceeded" }], ok: false });
    expect(
      (
        await createEvidenceBindingStore({
          bounds: {
            maxBindings: 6,
            maxEvidenceRecords: 6,
            maxSources: 6,
            maxTotalBindingHistoryEntries: 6,
          },
          resources,
        }).load()
      ).ok,
    ).toBeTrue();
  });

  test("rejects canonical-looking empty evidence and binding shard files on restart", async () => {
    const canonicalShard = (frontmatter: Record<string, unknown>) =>
      `---\n${stringify(frontmatter, {
        aliasDuplicateObjects: false,
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0,
      })}---\n`;
    const evidenceRoot = await temporaryRoot();
    const evidenceFile = path.join(evidenceRoot, "groma", "evidence", "shards", "00.md");
    await mkdir(path.dirname(evidenceFile), { recursive: true });
    await writeFile(
      evidenceFile,
      canonicalShard({
        schema: "groma/evidence-shard/v0.1",
        bucket: "00",
        records: [],
      }),
    );
    expect(await loadPersisted(evidenceRoot)).toMatchObject({
      diagnostics: [{ code: "empty-evidence-shard" }],
      ok: false,
    });

    const bindingRoot = await temporaryRoot();
    const bindingFile = path.join(bindingRoot, "groma", "bindings", "shards", "00.md");
    await mkdir(path.dirname(bindingFile), { recursive: true });
    await writeFile(
      bindingFile,
      canonicalShard({
        schema: "groma/binding-shard/v0.1",
        bucket: "00",
        bindings: [],
      }),
    );
    expect(await loadPersisted(bindingRoot)).toMatchObject({
      diagnostics: [{ code: "empty-binding-shard" }],
      ok: false,
    });
  });

  test("rejects hostile YAML, wrong buckets, noncanonical order, and configured bounds", async () => {
    const root = await temporaryRoot();
    const { loaded, resources, store } = await emptyStore(root);
    const planned = store.plan(loaded, {
      completedSnapshot: completedSnapshot(),
      generation: generation(1),
    });
    if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
    const shard = planned.value.snapshot.documents.find((item) => item.kind === "evidence-shard")!;
    const source = new TextDecoder().decode(shard.bytes);
    const wrongBucket = source.replace(/bucket: [0-9a-f]{2}/, "bucket: ff");
    expect(
      store.decodeEvidenceShard(shard.locator, new TextEncoder().encode(wrongBucket)).ok,
    ).toBeFalse();
    for (const yaml of [
      "---\nschema: groma/evidence-shard/v0.1\nbucket: 00\nbucket: 00\nrecords: []\n---\n",
      "---\nschema: groma/evidence-shard/v0.1\nbucket: 00\nrecords: &records []\ncopy: *records\n---\n",
      "---\nschema: groma/evidence-shard/v0.1\nbucket: 00\nrecords: !!seq []\n---\n",
      "---\nschema: groma/evidence-shard/v0.1\nbucket: 00\nrecords: []\ngeneration: 1e9999\n---\n",
    ]) {
      expect(
        store.decodeEvidenceShard(shard.locator, new TextEncoder().encode(yaml)).ok,
      ).toBeFalse();
    }
    expect(store.decodeEvidenceShard(shard.locator, new Uint8Array([0xff, 0xfe]))).toMatchObject({
      diagnostics: [{ code: "evidence-invalid-utf8" }],
      ok: false,
    });
    expect(
      store.decodeEvidenceShard(shard.locator, new TextEncoder().encode(`${source}\n`)),
    ).toMatchObject({ diagnostics: [{ code: "evidence-malformed-markdown" }], ok: false });
    const bounded = createEvidenceBindingStore({
      bounds: { maxDocumentBytes: 32 },
      resources: (await emptyStore(await temporaryRoot())).resources,
    });
    expect(bounded.decodeEvidenceShard(shard.locator, shard.bytes)).toMatchObject({
      diagnostics: [{ code: "evidence-document-byte-limit-exceeded" }],
      ok: false,
    });
    const itemBounded = createEvidenceBindingStore({
      bounds: { maxEvidenceRecords: 1 },
      resources: (await emptyStore(await temporaryRoot())).resources,
    });
    expect(
      itemBounded.plan(loaded, {
        completedSnapshot: completedSnapshot(),
        generation: generation(1),
      }),
    ).toMatchObject({ diagnostics: [{ code: "evidence-item-limit-exceeded" }], ok: false });
    expect(() =>
      createEvidenceBindingStore({
        bounds: { maxTotalBindingHistoryEntries: 4_000_001 },
        resources,
      }),
    ).toThrow(RangeError);
  });

  test("snapshots hostile byte views before all public decoder comparisons", async () => {
    const root = await temporaryRoot();
    const { loaded, store } = await emptyStore(root);
    const snapshot = completedSnapshot();
    const planned = store.plan(loaded, {
      bindingMutations: [
        { decision: { type: "ignored" }, identity: identity(snapshot, "component.api") },
      ],
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
    const documents = [
      planned.value.snapshot.documents.find((item) => item.kind === "source")!,
      planned.value.snapshot.documents.find((item) => item.kind === "evidence-shard")!,
      planned.value.snapshot.documents.find((item) => item.kind === "binding-shard")!,
    ];
    const decode = (stored: (typeof documents)[number], bytes: Uint8Array) => {
      if (stored.kind === "source") return store.decodeSource(stored.locator, bytes);
      if (stored.kind === "evidence-shard") return store.decodeEvidenceShard(stored.locator, bytes);
      return store.decodeBindingShard(stored.locator, bytes);
    };

    for (const stored of documents) {
      const validHostile = new Uint8Array(stored.bytes);
      Object.defineProperty(validHostile, "byteLength", {
        get() {
          throw new Error("hostile byteLength");
        },
      });
      let validResult: ReturnType<typeof decode> | undefined;
      expect(() => {
        validResult = decode(stored, validHostile);
      }).not.toThrow();
      expect(validResult?.ok).toBeTrue();

      const canonicalText = new TextDecoder().decode(stored.bytes);
      const noncanonicalHostile = new TextEncoder().encode(`${canonicalText.slice(0, -4)}\n---\n`);
      Object.defineProperty(noncanonicalHostile, "byteLength", {
        get() {
          throw new Error("hostile byteLength");
        },
      });
      let noncanonicalResult: ReturnType<typeof decode> | undefined;
      expect(() => {
        noncanonicalResult = decode(stored, noncanonicalHostile);
      }).not.toThrow();
      expect(noncanonicalResult).toMatchObject({
        diagnostics: [{ code: "noncanonical-evidence-document" }],
        ok: false,
      });

      const proxied = new Proxy(new Uint8Array(stored.bytes), {
        get() {
          throw new Error("hostile index access");
        },
      });
      let proxyResult: ReturnType<typeof decode> | undefined;
      expect(() => {
        proxyResult = decode(stored, proxied);
      }).not.toThrow();
      expect(proxyResult).toMatchObject({
        diagnostics: [{ code: "invalid-evidence-bytes" }],
        ok: false,
      });
    }
  });

  test("rejects a plan whose largest serialized document exceeds its byte bound", async () => {
    const root = await temporaryRoot();
    const { loaded, resources } = await emptyStore(root);
    const snapshot = completedSnapshot();
    const baselineStore = createEvidenceBindingStore({ resources });
    const baseline = baselineStore.plan(loaded, {
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    if (!baseline.ok) throw new Error(JSON.stringify(baseline.diagnostics));
    const largestDocumentBytes = Math.max(
      ...baseline.value.snapshot.documents.map((item) => item.bytes.byteLength),
    );
    const totalDocumentBytes = baseline.value.snapshot.documents.reduce(
      (total, item) => total + item.bytes.byteLength,
      0,
    );

    const rejected = createEvidenceBindingStore({
      bounds: {
        maxDocumentBytes: largestDocumentBytes - 1,
        maxTotalDocumentBytes: totalDocumentBytes,
      },
      resources,
    }).plan(loaded, { completedSnapshot: snapshot, generation: generation(1) });
    expect(rejected).toMatchObject({
      diagnostics: [
        {
          code: "evidence-document-byte-limit-exceeded",
          details: { maximum: largestDocumentBytes - 1 },
        },
      ],
      ok: false,
    });
    expect("value" in rejected).toBeFalse();

    const boundaryStore = createEvidenceBindingStore({
      bounds: {
        maxDocumentBytes: largestDocumentBytes,
        maxTotalDocumentBytes: totalDocumentBytes,
      },
      resources,
    });
    const boundary = boundaryStore.plan(loaded, {
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    expect(boundary.ok).toBeTrue();
    if (boundary.ok) {
      expect(
        Math.max(...boundary.value.snapshot.documents.map((item) => item.bytes.byteLength)),
      ).toBe(largestDocumentBytes);
      await applyTargets(root, boundary.value.targets);
      expect((await boundaryStore.load()).ok).toBeTrue();
    }
  });

  test("rejects aggregate planned bytes while every serialized document remains allowed", async () => {
    const root = await temporaryRoot();
    const { loaded, resources } = await emptyStore(root);
    const snapshot = completedSnapshot();
    const baselineStore = createEvidenceBindingStore({ resources });
    const baseline = baselineStore.plan(loaded, {
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    if (!baseline.ok) throw new Error(JSON.stringify(baseline.diagnostics));
    const documentSizes = baseline.value.snapshot.documents.map((item) => item.bytes.byteLength);
    const largestDocumentBytes = Math.max(...documentSizes);
    const totalDocumentBytes = documentSizes.reduce((total, bytes) => total + bytes, 0);
    expect(documentSizes.every((bytes) => bytes <= largestDocumentBytes)).toBeTrue();

    const rejected = createEvidenceBindingStore({
      bounds: {
        maxDocumentBytes: largestDocumentBytes,
        maxTotalDocumentBytes: totalDocumentBytes - 1,
      },
      resources,
    }).plan(loaded, { completedSnapshot: snapshot, generation: generation(1) });
    expect(rejected).toMatchObject({
      diagnostics: [{ code: "evidence-total-byte-limit-exceeded" }],
      ok: false,
    });
    expect("value" in rejected).toBeFalse();

    const boundaryStore = createEvidenceBindingStore({
      bounds: {
        maxDocumentBytes: largestDocumentBytes,
        maxTotalDocumentBytes: totalDocumentBytes,
      },
      resources,
    });
    const boundary = boundaryStore.plan(loaded, {
      completedSnapshot: snapshot,
      generation: generation(1),
    });
    expect(boundary.ok).toBeTrue();
    if (boundary.ok) {
      expect(
        boundary.value.snapshot.documents.reduce((total, item) => total + item.bytes.byteLength, 0),
      ).toBe(totalDocumentBytes);
      await applyTargets(root, boundary.value.targets);
      expect((await boundaryStore.load()).ok).toBeTrue();
    }
  });

  test("rejects a source document whose semantic fingerprint does not match current evidence", async () => {
    const root = await temporaryRoot();
    const { loaded, store } = await emptyStore(root);
    const planned = store.plan(loaded, {
      completedSnapshot: completedSnapshot(),
      generation: generation(1),
    });
    if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
    await applyTargets(root, planned.value.targets);
    const sourceDocument = planned.value.snapshot.documents.find((item) => item.kind === "source")!;
    const file = path.join(root, String(sourceDocument.locator));
    const text = await readFile(file, "utf8");
    const tampered = text.replace(
      /snapshotFingerprint: sha256:([0-9a-f])([0-9a-f]{63})/,
      (_match, first: string, rest: string) =>
        `snapshotFingerprint: sha256:${first === "0" ? "1" : "0"}${rest}`,
    );
    await writeFile(file, tampered);

    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    expect(await createEvidenceBindingStore({ resources }).load()).toMatchObject({
      diagnostics: [{ code: "evidence-source-fingerprint-mismatch" }],
      ok: false,
    });
  });

  test("materializes all 256 logical buckets and reports exact deterministic fanout evidence", async () => {
    const root = await temporaryRoot();
    const { loaded, store } = await emptyStore(root);
    const byBucket = new Map<string, ObservationRecord>();
    let counter = 0;
    while (byBucket.size < 256) {
      const key = `candidate.${counter.toString(36)}`;
      const snapshot = completedSnapshot({
        records: [
          {
            candidate: { name: key },
            key,
            kind: "component-candidate",
            provenance: provenance("src", "src/generated.ts"),
            scope: "src",
          },
        ],
      });
      const single = store.plan(loaded, { completedSnapshot: snapshot, generation: generation(1) });
      if (!single.ok) throw new Error(JSON.stringify(single.diagnostics));
      const bucket = single.value.snapshot.documents.find(
        (item) => item.kind === "evidence-shard",
      )?.bucket;
      if (bucket !== undefined && !byBucket.has(bucket)) byBucket.set(bucket, snapshot.records[0]!);
      counter += 1;
    }
    const snapshot = completedSnapshot({ records: Object.freeze([...byBucket.values()]) });
    const planned = store.plan(loaded, { completedSnapshot: snapshot, generation: generation(1) });
    if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));

    expect(planned.value.fanout).toHaveLength(256);
    expect(planned.value.fanout.map((entry) => entry.bucket)).toEqual(
      Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0")),
    );
    expect(planned.value.fanout.every((entry) => entry.retainedCount === 1)).toBeTrue();
    expect(planned.value.fanout.every((entry) => entry.currentCount === 1)).toBeTrue();
    expect(planned.value.fanout.every((entry) => entry.distinctSourceCount === 1)).toBeTrue();
    expect(planned.value.fanout.every((entry) => entry.serializedBytes > 0)).toBeTrue();
    expect(
      planned.value.snapshot.documents.filter((item) => item.kind === "evidence-shard"),
    ).toHaveLength(256);
  });
});
