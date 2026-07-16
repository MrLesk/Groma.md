import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  TransactionEngine,
  failure,
  parseContentRevision,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseProjectionReadIntegrity,
  parseRelationId,
  parseResourceKey,
  success,
  type ProposedTransaction,
  type ContentRevision,
  type GraphData,
  type ResourceKey,
} from "../../core/index.ts";
import {
  createStandardModelCapability,
  createStandardModelInvariant,
} from "../../standard-model/index.ts";
import {
  createLocalResourceProvider,
  createLocalTransactionJournal,
  createAliasStore,
  createMarkdownIntentStore,
  createMarkdownIntentTransactionAdapter,
  localTransactionStateLocator,
  markdownIntentLocator,
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalResourceFaultContext,
  type LocalResourceProvider,
  type LocalResourceFaultPhase,
  type CanonicalTransactionAdapter,
  type CanonicalTransactionTarget,
  type LocalTransactionFaultPhase,
  type WorkspaceResourceLocator,
} from "../index.ts";

const roots: string[] = [];
const decoder = new TextDecoder();
const transactionCrashChild = path.join(import.meta.dir, "fixtures", "transaction-crash-child.ts");

function projectionIdentity(generationValue: number, character: string) {
  const generation = parseGraphGeneration(generationValue);
  const fingerprint = parseProjectionCanonicalFingerprint(`sha256:${character.repeat(64)}`);
  if (!generation.ok || !fingerprint.ok) throw new Error("invalid projection identity fixture");
  return Object.freeze({ fingerprint: fingerprint.value, generation: generation.value });
}

function projectionIntegrity(character: string) {
  const parsed = parseProjectionReadIntegrity(`sha256:${character.repeat(64)}`);
  if (!parsed.ok) throw new Error("invalid projection integrity fixture");
  return parsed.value;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

const entityId = (value: number) => {
  const parsed = parseEntityId(`ent_${value.toString(16).padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid test entity ID");
  return parsed.value;
};

const relationId = (value: number) => {
  const parsed = parseRelationId(`rel_${value.toString(16).padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid test relation ID");
  return parsed.value;
};

function resourceFor(id: ReturnType<typeof entityId>): ResourceKey {
  const locator = markdownIntentLocator(id);
  if (!locator.ok) throw new Error("invalid test locator");
  const resource = parseResourceKey(locator.value);
  if (!resource.ok) throw new Error("invalid test resource");
  return resource.value;
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "groma-journal-test-"));
  roots.push(root);
  const coordinationRoot = await mkdtemp(path.join(tmpdir(), "groma-journal-locks-"));
  roots.push(coordinationRoot);
  return { coordinationRoot, workspaceRoot: root };
}

async function seed(
  provider: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  bytes: Uint8Array,
) {
  const staged = await provider.stageReplacement(locator as never, bytes);
  if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
  const committed = await provider.commitReplacement(staged.value);
  if (committed.state !== "committed") throw new Error("seed did not commit");
}

const invariantBounds = {
  maxComponentMutations: 20,
  maxComponents: 20,
  maxOwnerCharacters: 100,
  maxPinnedComponentIds: 20,
  maxRelationshipMutations: 20,
  maxRelationships: 20,
};

async function harness(
  roots: Awaited<ReturnType<typeof workspace>>,
  faultInjector?: (phase: LocalTransactionFaultPhase, targetIndex?: number) => void,
  resourceFaultInjector?: (
    phase: LocalResourceFaultPhase,
    context?: LocalResourceFaultContext,
  ) => void | Promise<void>,
  defaultStalePolicy = false,
) {
  const resources = await createLocalResourceProvider({
    ...roots,
    ...(resourceFaultInjector === undefined ? {} : { faultInjector: resourceFaultInjector }),
    ...(defaultStalePolicy ? {} : { staleLockMilliseconds: 1 }),
  });
  const model = createStandardModelCapability();
  const store = createMarkdownIntentStore({ model, resources });
  const provider = createLocalTransactionJournal({
    adapter: createMarkdownIntentTransactionAdapter({ model, store }),
    ...(faultInjector === undefined ? {} : { faultInjector }),
    resources,
  });
  const engine = new TransactionEngine({
    maxAffectedIdentities: 100,
    maxRequestDataDepth: 30,
    maxRequestDataValues: 10_000,
    maxSnapshotStateDepth: 30,
    maxSnapshotStateValues: 100_000,
    provider,
  });
  const registered = engine.registerInvariant(createStandardModelInvariant(invariantBounds));
  if (!registered.ok) throw new Error("invariant registration failed");
  return { engine, model, provider, resources, store };
}

async function within<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function stageArtifacts(directory: string): Promise<string[]> {
  const artifacts: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.name.startsWith(".groma-stage-")) artifacts.push(absolute);
    if (entry.isDirectory()) artifacts.push(...(await stageArtifacts(absolute)));
  }
  return artifacts;
}

async function crashTransactionProcess(
  roots: Awaited<ReturnType<typeof workspace>>,
  mode: "create" | "delete",
  phase: LocalResourceFaultPhase,
  locator: WorkspaceResourceLocator,
  occurrence: number,
): Promise<void> {
  let armedResolve!: () => void;
  let armedReject!: (error: Error) => void;
  const armed = new Promise<void>((resolve, reject) => {
    armedResolve = resolve;
    armedReject = reject;
  });
  const child = Bun.spawn({
    cmd: [
      process.execPath,
      transactionCrashChild,
      roots.workspaceRoot,
      roots.coordinationRoot ?? "-",
      mode,
      phase,
      String(locator),
      String(occurrence),
    ],
    ipc(message) {
      if (typeof message !== "object" || message === null || !("type" in message)) return;
      if (message.type === "armed") armedResolve();
      if (message.type === "unexpected-completion") {
        armedReject(new Error("crash fixture completed without reaching its fault boundary"));
      }
    },
    stderr: "pipe",
    stdout: "pipe",
  });
  try {
    await within(
      Promise.race([
        armed,
        child.exited.then(async (code) => {
          if (code === 86) return;
          const stderr = await new Response(child.stderr).text();
          throw new Error(`crash fixture exited before arming (${code}): ${stderr}`);
        }),
      ]),
      5_000,
      "transaction crash fixture arming",
    );
    expect(await within(child.exited, 5_000, "transaction crash boundary")).toBe(86);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([child.exited, Bun.sleep(2_000)]);
    }
    try {
      child.disconnect();
    } catch {
      // The deliberately terminated child may already have closed IPC.
    }
    child.unref();
  }
}

interface ProviderOverrides {
  readonly acquireCoordination?: LocalResourceProvider["acquireCoordination"];
  readonly commitReplacement?: LocalResourceProvider["commitReplacement"];
  readonly discardReplacement?: LocalResourceProvider["discardReplacement"];
  readonly releaseCoordination?: LocalResourceProvider["releaseCoordination"];
  readonly removeResource?: LocalResourceProvider["removeResource"];
  readonly stageReplacement?: LocalResourceProvider["stageReplacement"];
}

function providerWithOverrides(
  base: LocalResourceProvider,
  overrides: ProviderOverrides,
): LocalResourceProvider {
  const provider: LocalResourceProvider = {
    acquireCoordination: (request) =>
      (overrides.acquireCoordination ?? base.acquireCoordination.bind(base))(request),
    cleanupReplacementStages: (locator) => base.cleanupReplacementStages(locator),
    commitReplacement: (handle) =>
      (overrides.commitReplacement ?? base.commitReplacement.bind(base))(handle),
    discardReplacement: (handle) =>
      (overrides.discardReplacement ?? base.discardReplacement.bind(base))(handle),
    enumerate: (request) => base.enumerate(request),
    read: (request) => base.read(request),
    releaseCoordination: (lease) =>
      (overrides.releaseCoordination ?? base.releaseCoordination.bind(base))(lease),
    removeResource: (locator) =>
      (overrides.removeResource ?? base.removeResource.bind(base))(locator),
    stageReplacement: (locator, bytes) =>
      (overrides.stageReplacement ?? base.stageReplacement.bind(base))(locator, bytes),
    withCoordination(request, action) {
      return base.withCoordination(request, action);
    },
  };
  return Object.freeze(provider);
}

function engineFor(provider: ReturnType<typeof createLocalTransactionJournal>) {
  const engine = new TransactionEngine({
    maxAffectedIdentities: 100,
    maxRequestDataDepth: 30,
    maxRequestDataValues: 10_000,
    maxSnapshotStateDepth: 30,
    maxSnapshotStateValues: 100_000,
    provider,
  });
  const registered = engine.registerInvariant(createStandardModelInvariant(invariantBounds));
  if (!registered.ok) throw new Error("invariant registration failed");
  return engine;
}

function journalHarnessFor(resources: LocalResourceProvider) {
  const model = createStandardModelCapability();
  const store = createMarkdownIntentStore({ model, resources });
  const provider = createLocalTransactionJournal({
    adapter: createMarkdownIntentTransactionAdapter({ model, store }),
    resources,
  });
  return { engine: engineFor(provider), provider, store };
}

function createRequest() {
  const shop = entityId(1);
  const orders = entityId(2);
  const relation = relationId(1);
  return {
    affected: { entities: [shop, orders], relations: [relation] },
    context: {
      ownership: { owner: "curated", plane: "intent" },
      pinnedComponentIds: [],
    },
    expectedRevisions: [
      { expected: null, resource: resourceFor(shop) },
      { expected: null, resource: resourceFor(orders) },
    ],
    mutation: {
      components: [
        { component: { id: shop, intent: "Own commerce.", type: "domain" }, type: "create" },
        {
          component: { id: orders, intent: "Place orders.", parent: shop, type: "service" },
          type: "create",
        },
      ],
      relationships: [
        {
          relationship: {
            id: relation,
            payload: { description: "Shop requires Orders." },
            source: shop,
            target: orders,
            type: "requires",
          },
          type: "upsert",
        },
      ],
    },
  } as const;
}

describe("local transaction journal", () => {
  test("re-homes untouched outgoing relationships when aliasing their source", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources });
    const aliases = createAliasStore({ resources });
    const obsolete = entityId(21);
    const survivor = entityId(22);
    const relation = relationId(21);

    const canonicalEntity = (id: ReturnType<typeof entityId>, name: string) => {
      const normalized = model.normalize({ id, name, type: "service" });
      if (!normalized.ok || normalized.value.id === undefined) {
        throw new Error("invalid component fixture");
      }
      return Object.freeze({
        id,
        kind: normalized.value.kind,
        payload: normalized.value.payload as GraphData,
      });
    };
    const survivorDocument = store.serialize(
      canonicalEntity(survivor, "Survivor"),
      Object.freeze([]),
    );
    const obsoleteDocument = store.serialize(
      canonicalEntity(obsolete, "Obsolete"),
      Object.freeze([
        Object.freeze({
          id: relation,
          payload: Object.freeze({ description: "Must survive source migration." }),
          source: obsolete,
          target: survivor,
          type: "requires",
        }),
      ]),
    );
    if (!survivorDocument.ok || !obsoleteDocument.ok) {
      throw new Error("invalid intent document fixtures");
    }
    await seed(resources, survivorDocument.value.locator, survivorDocument.value.bytes);
    await seed(resources, obsoleteDocument.value.locator, obsoleteDocument.value.bytes);

    const emptyAliases = await aliases.load();
    if (!emptyAliases.ok) throw new Error("expected empty aliases");
    const provider = createLocalTransactionJournal({
      adapter: createMarkdownIntentTransactionAdapter({
        aliases,
        maxAliases: invariantBounds.maxComponents,
        model,
        store,
      }),
      resources,
    });
    const engine = engineFor(provider);
    const initial = await provider.snapshot([
      emptyAliases.value.resource,
      obsoleteDocument.value.resource,
      survivorDocument.value.resource,
    ]);
    const request = (affected: {
      readonly entities: readonly ReturnType<typeof entityId>[];
      readonly relations: readonly ReturnType<typeof relationId>[];
    }) => ({
      affected,
      context: {
        ownership: { owner: "curated", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: initial.revisions.map((entry) => ({
        expected: entry.revision,
        resource: entry.resource,
      })),
      mutation: {
        aliases: [{ source: obsolete, target: survivor, type: "upsert" }],
        components: [{ id: obsolete, type: "remove" }],
        relationships: [],
      },
    });
    const underreported = await engine.execute(request({ entities: [obsolete], relations: [] }));
    expect(underreported).toMatchObject({ committed: false, status: "provider-failure" });
    const unchangedAliases = await aliases.load();
    if (!unchangedAliases.ok) throw new Error("expected unchanged aliases to load");
    expect(unchangedAliases.value.aliases).toEqual([]);

    const merged = await engine.execute(
      request({ entities: [obsolete, survivor], relations: [relation] }),
    );
    expect(merged).toMatchObject({ status: "committed" });
    if (merged.status === "committed") {
      expect(merged.event.affected).toEqual({
        entities: [obsolete, survivor],
        relations: [relation],
      });
    }

    const loadedAliases = await aliases.load();
    if (!loadedAliases.ok) throw new Error("expected aliases to load");
    const loaded = await store.load(loadedAliases.value.aliases);
    if (!loaded.ok) throw new Error("expected intent state to load");
    expect(loaded.value.entities.map((entity) => entity.id)).toEqual([survivor]);
    expect(loaded.value.relations).toEqual([
      expect.objectContaining({ id: relation, source: survivor, target: survivor }),
    ]);
    expect(
      await Bun.file(
        path.join(roots.workspaceRoot, String(obsoleteDocument.value.locator)),
      ).exists(),
    ).toBeFalse();
  });

  test("loads aliases above Core's default through the configured store and adapter bound", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    const model = createStandardModelCapability();
    const maximumAliases = 100_001;
    const target = entityId(200_000);
    const store = createMarkdownIntentStore({
      bounds: { maxDocuments: maximumAliases },
      model,
      resources,
    });
    const normalized = model.normalize({ id: target, name: "Target", type: "service" });
    if (!normalized.ok || normalized.value.id === undefined) {
      throw new Error("invalid target fixture");
    }
    const targetDocument = store.serialize(
      Object.freeze({
        id: target,
        kind: normalized.value.kind,
        payload: normalized.value.payload as GraphData,
      }),
      Object.freeze([]),
    );
    if (!targetDocument.ok) throw new Error("invalid target document fixture");
    await seed(resources, targetDocument.value.locator, targetDocument.value.bytes);

    const realAliases = createAliasStore({
      bounds: { maxAliases: maximumAliases },
      resources,
    });
    const emptyAliases = await realAliases.load();
    if (!emptyAliases.ok) throw new Error("expected empty aliases");
    const aliasRecords = Object.freeze(
      Array.from({ length: maximumAliases }, (_, index) =>
        Object.freeze({ source: entityId(index + 1), target }),
      ),
    );
    const adapter = createMarkdownIntentTransactionAdapter({
      aliases: Object.freeze({
        decode: realAliases.decode,
        load: async () => success(Object.freeze({ ...emptyAliases.value, aliases: aliasRecords })),
        serialize: realAliases.serialize,
      }),
      maxAliases: maximumAliases,
      model,
      store,
    });

    const snapshot = await adapter.load();

    expect(snapshot.ok).toBeTrue();
    if (!snapshot.ok) return;
    const snapshotState = snapshot.value.state as unknown as {
      readonly aliases: readonly unknown[];
    };
    expect(snapshotState.aliases).toHaveLength(maximumAliases);
  });

  test("materializes relationship upserts and removals through obsolete source aliases", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources });
    const aliases = createAliasStore({ resources });
    const obsolete = entityId(11);
    const survivor = entityId(12);
    const relation = relationId(11);
    const obsoleteLocator = markdownIntentLocator(obsolete);
    if (!obsoleteLocator.ok) throw new Error("invalid obsolete locator fixture");

    const normalized = model.normalize({
      id: survivor,
      intent: "Own the surviving boundary.",
      type: "service",
    });
    if (!normalized.ok || normalized.value.id === undefined) {
      throw new Error("invalid survivor fixture");
    }
    const survivorDocument = store.serialize(
      Object.freeze({
        id: survivor,
        kind: normalized.value.kind,
        payload: normalized.value.payload as GraphData,
      }),
      Object.freeze([]),
    );
    if (!survivorDocument.ok) throw new Error("invalid survivor document fixture");
    await seed(resources, survivorDocument.value.locator, survivorDocument.value.bytes);

    const aliasDocument = aliases.serialize(
      Object.freeze([Object.freeze({ source: obsolete, target: survivor })]),
    );
    if (!aliasDocument.ok || aliasDocument.value.bytes === undefined) {
      throw new Error("invalid alias document fixture");
    }
    await seed(resources, aliasDocument.value.locator, aliasDocument.value.bytes);

    const provider = createLocalTransactionJournal({
      adapter: createMarkdownIntentTransactionAdapter({
        aliases,
        maxAliases: invariantBounds.maxComponents,
        model,
        store,
      }),
      resources,
    });
    const engine = engineFor(provider);
    const initial = await provider.snapshot([survivorDocument.value.resource]);
    const initialRevision = initial.revisions[0]?.revision;
    if (initialRevision === null || initialRevision === undefined) {
      throw new Error("missing survivor revision");
    }

    const upserted = await engine.execute({
      affected: { entities: [survivor], relations: [relation] },
      context: {
        ownership: { owner: "curated", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: [{ expected: initialRevision, resource: survivorDocument.value.resource }],
      mutation: {
        components: [],
        relationships: [
          {
            relationship: {
              id: relation,
              payload: { description: "Written through the retired identity." },
              source: obsolete,
              target: obsolete,
              type: "requires",
            },
            type: "upsert",
          },
        ],
      },
    });
    expect(upserted).toMatchObject({ status: "committed" });

    const aliasSnapshot = await aliases.load();
    if (!aliasSnapshot.ok) throw new Error("expected aliases to load");
    const loadedAfterUpsert = await store.load(aliasSnapshot.value.aliases);
    if (!loadedAfterUpsert.ok) throw new Error("expected intent state to load");
    expect(loadedAfterUpsert.value.relations).toEqual([
      expect.objectContaining({ id: relation, source: survivor, target: survivor }),
    ]);
    expect(
      await Bun.file(path.join(roots.workspaceRoot, String(obsoleteLocator.value))).exists(),
    ).toBeFalse();

    const afterUpsert = await provider.snapshot([survivorDocument.value.resource]);
    const updatedRevision = afterUpsert.revisions[0]?.revision;
    if (updatedRevision === null || updatedRevision === undefined) {
      throw new Error("missing updated survivor revision");
    }
    const removeRequest = (entities: readonly ReturnType<typeof entityId>[]) => ({
      affected: { entities, relations: [relation] },
      context: {
        ownership: { owner: "curated", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: [{ expected: updatedRevision, resource: survivorDocument.value.resource }],
      mutation: {
        components: [],
        relationships: [{ id: relation, type: "remove" }],
      },
    });
    const underreportedRemoval = await engine.execute(removeRequest([]));
    expect(underreportedRemoval).toMatchObject({
      committed: false,
      status: "provider-failure",
    });

    const removed = await engine.execute(removeRequest([survivor]));
    expect(removed).toMatchObject({ status: "committed" });

    const loadedAfterRemoval = await store.load(aliasSnapshot.value.aliases);
    if (!loadedAfterRemoval.ok) throw new Error("expected final intent state to load");
    expect(loadedAfterRemoval.value.relations).toEqual([]);
    expect(
      await Bun.file(path.join(roots.workspaceRoot, String(obsoleteLocator.value))).exists(),
    ).toBeFalse();
  });

  test("commits deterministic Markdown replacements and deletions with the generation marker last", async () => {
    const firstRoots = await workspace();
    const first = await harness(firstRoots);
    const initial = await first.provider.snapshot([]);
    expect(initial).toEqual({
      generation: 0,
      revisions: [],
      state: { components: [], relationships: [] },
    });

    const created = await first.engine.execute(createRequest());
    expect(created).toMatchObject({ generation: 1, status: "committed" });
    const loaded = await first.store.load();
    expect(loaded).toMatchObject({ ok: true });
    if (!loaded.ok) throw new Error("expected loaded graph");
    expect(loaded.value.entities).toHaveLength(2);
    expect(loaded.value.relations).toHaveLength(1);

    const journalPath = path.join(firstRoots.workspaceRoot, String(localTransactionStateLocator));
    const firstJournal = await readFile(journalPath, "utf8");
    const firstState = JSON.parse(firstJournal) as Record<string, unknown>;
    expect(firstState).toMatchObject({ generation: 1, phase: "idle", version: 1 });
    expect(firstJournal).not.toContain(firstRoots.workspaceRoot);
    expect(firstJournal).not.toContain(firstRoots.coordinationRoot);
    expect(firstJournal).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-/);
    expect(firstJournal).not.toMatch(/createdAt|timestamp|\/var\/|\/tmp\//);

    const secondRoots = await workspace();
    const second = await harness(secondRoots);
    expect(await second.engine.execute(createRequest())).toMatchObject({ status: "committed" });
    expect(
      await readFile(
        path.join(secondRoots.workspaceRoot, String(localTransactionStateLocator)),
        "utf8",
      ),
    ).toBe(firstJournal);

    const shop = entityId(1);
    const orders = entityId(2);
    const shopDocument = loaded.value.documents.find((document) => document.entity.id === shop)!;
    const ordersDocument = loaded.value.documents.find(
      (document) => document.entity.id === orders,
    )!;
    const removed = await first.engine.execute({
      affected: { entities: [shop, orders], relations: [relationId(1)] },
      context: {
        ownership: { owner: "curated", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: [
        { expected: shopDocument.revision, resource: shopDocument.resource },
        { expected: ordersDocument.revision, resource: ordersDocument.resource },
      ],
      mutation: {
        components: [
          { id: shop, patch: { intent: "Own the complete shop." }, type: "patch" },
          { id: orders, type: "remove" },
        ],
        relationships: [{ id: relationId(1), type: "remove" }],
      },
    });
    expect(removed).toMatchObject({ generation: 2, status: "committed" });
    const final = await first.store.load();
    expect(final).toMatchObject({ ok: true });
    if (!final.ok) throw new Error("expected final graph");
    expect(final.value.entities.map((entity) => entity.id)).toEqual([shop]);
    expect(final.value.entities[0]?.payload).toMatchObject({ intent: "Own the complete shop." });
    expect(final.value.relations).toEqual([]);
    expect(
      (JSON.parse(await readFile(journalPath, "utf8")) as { generation: number }).generation,
    ).toBe(2);
  });

  test("coordinates persistent leases, bounded orphan cleanup, and idempotent durable removal", async () => {
    const roots = await workspace();
    const first = await createLocalResourceProvider({ ...roots, maxEntriesPerDirectory: 10 });
    const second = await createLocalResourceProvider({ ...roots, maxEntriesPerDirectory: 10 });
    const locator = workspaceResourceLocator("groma", "intent", "target.md");
    if (!locator.ok) throw new Error("invalid locator");
    const lease = await first.acquireCoordination({
      context: "local-machine",
      locator: locator.value,
    });
    expect(lease).toMatchObject({ ok: true });
    if (!lease.ok) throw new Error("expected lease");
    expect(
      await second.acquireCoordination({ context: "local-machine", locator: locator.value }),
    ).toMatchObject({
      diagnostics: [{ code: "resource-coordination-contended" }],
      ok: false,
    });
    expect(await first.releaseCoordination(lease.value)).toEqual({ ok: true, value: undefined });
    expect(await first.releaseCoordination(lease.value)).toEqual({ ok: true, value: undefined });

    await seed(first, locator.value, new TextEncoder().encode("old"));
    expect((await first.removeResource(locator.value)).state).toBe("committed");
    expect((await first.removeResource(locator.value)).state).toBe("committed");
    expect(await first.read({ locator: locator.value, maxBytes: 10 })).toMatchObject({
      diagnostics: [{ code: "resource-missing" }],
      ok: false,
    });

    const staged = await first.stageReplacement(locator.value, new TextEncoder().encode("live"));
    if (!staged.ok) throw new Error("expected live stage");
    expect(await second.cleanupReplacementStages(locator.value)).toEqual({
      ok: true,
      value: undefined,
    });
    const parent = path.dirname(path.join(roots.workspaceRoot, locator.value));
    expect((await readdir(parent)).some((name) => name.startsWith(".groma-stage-"))).toBeTrue();
    await first.discardReplacement(staged.value);

    await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        writeFile(path.join(parent, `sibling-${index}.txt`), "bounded"),
      ),
    );
    expect(await first.cleanupReplacementStages(locator.value)).toMatchObject({
      diagnostics: [{ code: "resource-directory-overflow" }],
      ok: false,
    });
  });

  test("retries POSIX deletion durability after unlink when the target is already missing", async () => {
    const roots = await workspace();
    let failSync = true;
    const provider = await createLocalResourceProvider({
      ...roots,
      faultInjector(phase) {
        if (failSync && phase === "removal-parent-directory-sync") {
          failSync = false;
          throw new Error("interrupt deletion directory sync");
        }
      },
    });
    const locator = workspaceResourceLocator("groma", "deletion.txt");
    if (!locator.ok) throw new Error("invalid locator");
    await seed(provider, locator.value, new TextEncoder().encode("remove me"));
    expect((await provider.removeResource(locator.value)).state).toBe(
      process.platform === "win32" ? "committed" : "committed-indeterminate",
    );
    expect((await provider.removeResource(locator.value)).state).toBe("committed");
  });

  test("keeps deletion indeterminate when a missing parent can hide a sibling", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    const locator = workspaceResourceLocator("groma", "intent", "ab", "target.md");
    if (!locator.ok) throw new Error("invalid missing-parent target locator");
    const resource = parseResourceKey(locator.value);
    if (!resource.ok) throw new Error("invalid missing-parent target resource");
    const siblingLocator = workspaceResourceLocator("groma", "intent", "ab", "sibling.md");
    if (!siblingLocator.ok) throw new Error("invalid missing-parent sibling locator");
    const siblingResource = parseResourceKey(siblingLocator.value);
    if (!siblingResource.ok) throw new Error("invalid missing-parent sibling resource");
    const prior = new TextEncoder().encode("remove me");
    const sibling = new TextEncoder().encode("keep me");
    await seed(resources, locator.value, prior);
    await seed(resources, siblingLocator.value, sibling);
    const priorRevision = parseContentRevision(
      `sha256:${createHash("sha256").update(prior).digest("hex")}`,
    );
    if (!priorRevision.ok) throw new Error("invalid missing-parent target revision");
    const siblingRevision = parseContentRevision(
      `sha256:${createHash("sha256").update(sibling).digest("hex")}`,
    );
    if (!siblingRevision.ok) throw new Error("invalid missing-parent sibling revision");
    const target = Object.freeze({
      expected: priorRevision.value,
      locator: locator.value,
      resource: resource.value,
      result: null,
    });
    const adapter: CanonicalTransactionAdapter = Object.freeze({
      load: async () =>
        success(
          Object.freeze({
            resources: Object.freeze([
              Object.freeze({
                locator: locator.value,
                resource: resource.value,
                revision: priorRevision.value,
              }),
              Object.freeze({
                locator: siblingLocator.value,
                resource: siblingResource.value,
                revision: siblingRevision.value,
              }),
            ]),
            state: {},
          }),
        ),
      materialize: () => success(Object.freeze({ state: {}, targets: Object.freeze([target]) })),
    });
    let interrupted = false;
    const journal = createLocalTransactionJournal({
      adapter,
      faultInjector(phase) {
        if (!interrupted && phase === "after-committing-state") {
          interrupted = true;
          throw new Error("interrupt before deletion");
        }
      },
      resources,
    });
    const proposal = {
      affected: { entities: [], relations: [] },
      baseGeneration: 0,
      context: {},
      expectedRevisions: [{ expected: priorRevision.value, resource: resource.value }],
      generation: 1,
      mutation: {},
      priorState: {},
    } as unknown as ProposedTransaction;
    const prepared = await journal.prepare(proposal);
    expect(prepared.status).toBe("prepared");
    if (prepared.status !== "prepared") return;
    expect(await journal.commit(prepared.token)).toEqual({ status: "indeterminate" });
    expect(interrupted).toBeTrue();

    await rm(path.dirname(path.join(roots.workspaceRoot, String(locator.value))), {
      recursive: true,
    });

    const restartedResources = await createLocalResourceProvider(roots);
    const restarted = createLocalTransactionJournal({ adapter, resources: restartedResources });
    expect(await restarted.recover(prepared.token)).toEqual({ status: "indeterminate" });
    await expect(restarted.snapshot([])).rejects.toThrow(
      "interrupted transaction cannot be settled",
    );
    expect(await restartedResources.read({ locator: locator.value, maxBytes: 100 })).toMatchObject({
      diagnostics: [{ code: "resource-missing" }],
      ok: false,
    });
    expect(
      await restartedResources.read({ locator: siblingLocator.value, maxBytes: 100 }),
    ).toMatchObject({
      diagnostics: [{ code: "resource-missing" }],
      ok: false,
    });
  });

  test("keeps an idle settlement indeterminate until re-publication succeeds", async () => {
    const roots = await workspace();
    const base = await createLocalResourceProvider(roots);
    let failRepublication = false;
    let rejectedRepublications = 0;
    const resources = providerWithOverrides(base, {
      async stageReplacement(locator, bytes) {
        if (failRepublication && locator === localTransactionStateLocator) {
          rejectedRepublications += 1;
          return failure(
            Object.freeze({
              code: "injected-journal-republication-failure",
              message: "Injected journal re-publication failure",
            }),
          );
        }
        return base.stageReplacement(locator, bytes);
      },
    });
    const locator = workspaceResourceLocator("groma", "intent", "ab", "target.md");
    if (!locator.ok) throw new Error("invalid re-publication target locator");
    const resource = parseResourceKey(locator.value);
    if (!resource.ok) throw new Error("invalid re-publication target resource");
    const replacement = new TextEncoder().encode("new state");
    const replacementRevision = parseContentRevision(
      `sha256:${createHash("sha256").update(replacement).digest("hex")}`,
    );
    if (!replacementRevision.ok) throw new Error("invalid replacement revision");
    const target = Object.freeze({
      expected: null,
      locator: locator.value,
      replacement,
      resource: resource.value,
      result: replacementRevision.value,
    });
    const adapter: CanonicalTransactionAdapter = Object.freeze({
      load: async () => success(Object.freeze({ resources: Object.freeze([]), state: {} })),
      materialize: () => success(Object.freeze({ state: {}, targets: Object.freeze([target]) })),
    });
    const journal = createLocalTransactionJournal({ adapter, resources });
    const proposal = {
      affected: { entities: [], relations: [] },
      baseGeneration: 0,
      context: {},
      expectedRevisions: [{ expected: null, resource: resource.value }],
      generation: 1,
      mutation: {},
      priorState: {},
    } as unknown as ProposedTransaction;
    const prepared = await journal.prepare(proposal);
    expect(prepared.status).toBe("prepared");
    if (prepared.status !== "prepared") return;
    expect(await journal.commit(prepared.token)).toMatchObject({
      generation: 1,
      status: "committed",
    });

    failRepublication = true;
    expect(await journal.recover(prepared.token)).toEqual({ status: "indeterminate" });
    expect(rejectedRepublications).toBe(1);
    failRepublication = false;
    expect(await journal.recover(prepared.token)).toMatchObject({
      generation: 1,
      status: "committed",
    });
  });

  for (const retry of ["prepare", "snapshot"] as const) {
    test(`retains a failed prepare release for the next ${retry}`, async () => {
      const roots = await workspace();
      const base = await createLocalResourceProvider(roots);
      let acquisitions = 0;
      let releases = 0;
      const resources = providerWithOverrides(base, {
        acquireCoordination(request) {
          acquisitions += 1;
          return base.acquireCoordination(request);
        },
        async releaseCoordination(lease) {
          releases += 1;
          if (releases === 1) {
            return failure(
              Object.freeze({
                code: "injected-prepare-release-failure",
                message: "Injected prepare release failure",
              }),
            );
          }
          return base.releaseCoordination(lease);
        },
      });
      let materializations = 0;
      const adapter: CanonicalTransactionAdapter = Object.freeze({
        load: async () => success(Object.freeze({ resources: Object.freeze([]), state: {} })),
        materialize: () => {
          materializations += 1;
          return failure(
            Object.freeze({
              code: "injected-materialization-failure",
              message: "Injected materialization failure",
            }),
          );
        },
      });
      const journal = createLocalTransactionJournal({ adapter, resources });
      const proposal = {
        affected: { entities: [], relations: [] },
        baseGeneration: 0,
        context: {},
        expectedRevisions: [],
        generation: 1,
        mutation: {},
        priorState: {},
      } as unknown as ProposedTransaction;

      await expect(journal.prepare(proposal)).rejects.toThrow("preparation failed");
      if (retry === "snapshot") {
        expect(await journal.snapshot([])).toMatchObject({ generation: 0, revisions: [] });
      } else {
        await expect(journal.prepare(proposal)).rejects.toThrow("preparation failed");
      }
      expect(acquisitions).toBe(1);
      expect(releases).toBe(2);
      expect(materializations).toBe(retry === "prepare" ? 2 : 1);
    });
  }

  for (const releaseFailure of ["retryable", "ownership-lost"] as const) {
    for (const retainedBy of ["prepare", "snapshot"] as const) {
      const behavior =
        releaseFailure === "retryable"
          ? `reuses a lease retained by ${retainedBy}`
          : `reacquires after ${retainedBy} loses lease ownership`;
      test(`${behavior} when recovering a settled token`, async () => {
        const roots = await workspace();
        const base = await createLocalResourceProvider(roots);
        let acquisitions = 0;
        let releases = 0;
        let failNextRelease = false;
        const resources = providerWithOverrides(base, {
          acquireCoordination(request) {
            acquisitions += 1;
            return base.acquireCoordination(request);
          },
          async releaseCoordination(lease) {
            releases += 1;
            if (failNextRelease) {
              failNextRelease = false;
              if (releaseFailure === "ownership-lost") {
                const released = await base.releaseCoordination(lease);
                if (!released.ok) return released;
                return failure(
                  Object.freeze({
                    code: "resource-coordination-ownership-lost",
                    message: "Injected coordination ownership loss",
                  }),
                );
              }
              return failure(
                Object.freeze({
                  code: "injected-retained-release-failure",
                  message: "Injected retained release failure",
                }),
              );
            }
            return base.releaseCoordination(lease);
          },
        });
        const locator = workspaceResourceLocator("groma", "intent", "ab", "target.md");
        if (!locator.ok) throw new Error("invalid retained-lease target locator");
        const resource = parseResourceKey(locator.value);
        if (!resource.ok) throw new Error("invalid retained-lease target resource");
        const replacement = new TextEncoder().encode("settled state");
        const result = parseContentRevision(
          `sha256:${createHash("sha256").update(replacement).digest("hex")}`,
        );
        if (!result.ok) throw new Error("invalid retained-lease target revision");
        const target = Object.freeze({
          expected: null,
          locator: locator.value,
          replacement,
          resource: resource.value,
          result: result.value,
        });
        let rejectMaterialization = false;
        const adapter: CanonicalTransactionAdapter = Object.freeze({
          load: async () => success(Object.freeze({ resources: Object.freeze([]), state: {} })),
          materialize: () =>
            rejectMaterialization
              ? failure(
                  Object.freeze({
                    code: "injected-materialization-failure",
                    message: "Injected materialization failure",
                  }),
                )
              : success(Object.freeze({ state: {}, targets: Object.freeze([target]) })),
        });
        const journal = createLocalTransactionJournal({ adapter, resources });
        const proposal = {
          affected: { entities: [], relations: [] },
          baseGeneration: 0,
          context: {},
          expectedRevisions: [{ expected: null, resource: resource.value }],
          generation: 1,
          mutation: {},
          priorState: {},
        } as unknown as ProposedTransaction;
        const prepared = await journal.prepare(proposal);
        expect(prepared.status).toBe("prepared");
        if (prepared.status !== "prepared") return;
        expect(await journal.commit(prepared.token)).toMatchObject({
          generation: 1,
          status: "committed",
        });

        failNextRelease = true;
        if (retainedBy === "snapshot") {
          await expect(journal.snapshot([])).rejects.toThrow(
            releaseFailure === "retryable"
              ? "Injected retained release failure"
              : "Injected coordination ownership loss",
          );
        } else {
          rejectMaterialization = true;
          await expect(
            journal.prepare({
              ...proposal,
              baseGeneration: 1,
              expectedRevisions: [],
              generation: 2,
            } as unknown as ProposedTransaction),
          ).rejects.toThrow("preparation failed");
        }

        expect(acquisitions).toBe(2);
        expect(await journal.recover(prepared.token)).toMatchObject({
          generation: 1,
          status: "committed",
        });
        expect(acquisitions).toBe(releaseFailure === "retryable" ? 2 : 3);
        expect(releases).toBe(3);
      });
    }
  }

  test("reacquires after a committed transaction loses coordination during release", async () => {
    const roots = await workspace();
    const canonicalRoot = await realpath(roots.workspaceRoot);
    const absoluteResource = path.resolve(canonicalRoot, "groma");
    const key = `${canonicalRoot}\0${absoluteResource}`
      .normalize("NFC")
      .toLowerCase()
      .normalize("NFC");
    const identity = createHash("sha256").update(key).digest("hex");
    const lockPath = path.join(roots.coordinationRoot, `${identity}.lock`);
    let releaseCalls = 0;
    let ownershipLost = false;
    const active = await harness(roots, undefined, async (phase) => {
      if (phase !== "coordination-release") return;
      releaseCalls += 1;
      if (releaseCalls === 2) {
        ownershipLost = true;
        await rm(lockPath, { recursive: true });
      }
    });

    const outcome = await active.engine.execute(createRequest());
    expect(ownershipLost).toBeTrue();
    expect(outcome.status).toBe("indeterminate");
    if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");
    expect(await active.engine.recover(outcome.recovery)).toMatchObject({
      generation: 1,
      status: "committed",
    });
    expect(releaseCalls).toBe(3);
  });

  for (const phase of [
    "after-prepared-state",
    "stage-target",
    "after-committing-state",
    "after-target",
    "before-settled-state",
    "after-settled-state",
  ] as const) {
    test(`restart exposes one complete graph after interruption at ${phase}`, async () => {
      const roots = await workspace();
      let fired = false;
      const interrupted = await harness(roots, (observed) => {
        if (!fired && observed === phase) {
          fired = true;
          throw new Error("simulated process termination");
        }
      });
      const outcome = await interrupted.engine.execute(createRequest());
      expect(fired).toBeTrue();
      if (outcome.status === "indeterminate") {
        const restarted = await harness(roots);
        const recovered = await restarted.engine.recover(outcome.recovery);
        expect(recovered).toMatchObject({ generation: 1, status: "committed" });
      }
      const restarted = await harness(roots);
      const snapshot = await restarted.provider.snapshot([
        resourceFor(entityId(1)),
        resourceFor(entityId(2)),
      ]);
      const present = snapshot.revisions.filter((entry) => entry.revision !== null).length;
      expect([0, 2]).toContain(present);
      expect(snapshot.generation).toBe(present === 0 ? 0 : 1);
      const loaded = await restarted.store.load();
      if (!loaded.ok) throw new Error("expected restart load");
      expect(loaded.value.entities).toHaveLength(present);
      expect(loaded.value.relations).toHaveLength(present === 0 ? 0 : 1);
      expect(outcome.status).toBe(
        phase === "after-prepared-state" || phase === "stage-target"
          ? "provider-failure"
          : phase === "after-settled-state"
            ? "committed"
            : "indeterminate",
      );
    });
  }

  const processCrashCases: readonly {
    readonly expectedEntities: number;
    readonly expectedGeneration: number;
    readonly locator: "journal" | "orders" | "shop";
    readonly mode: "create" | "delete";
    readonly occurrence: number;
    readonly phase: LocalResourceFaultPhase;
  }[] = [
    {
      expectedEntities: 0,
      expectedGeneration: 0,
      locator: "journal",
      mode: "create",
      occurrence: 1,
      phase: "after-rename",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "journal",
      mode: "create",
      occurrence: 2,
      phase: "replacement-after-rename-before-mode",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "journal",
      mode: "create",
      occurrence: 2,
      phase: "replacement-target-file-sync",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "journal",
      mode: "create",
      occurrence: 2,
      phase: "replacement-parent-directory-sync",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "journal",
      mode: "create",
      occurrence: 2,
      phase: "after-rename",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "journal",
      mode: "create",
      occurrence: 3,
      phase: "replacement-after-rename-before-mode",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "shop",
      mode: "create",
      occurrence: 1,
      phase: "replacement-after-rename-before-mode",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "shop",
      mode: "create",
      occurrence: 1,
      phase: "replacement-target-file-sync",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "shop",
      mode: "create",
      occurrence: 1,
      phase: "replacement-parent-directory-sync",
    },
    {
      expectedEntities: 2,
      expectedGeneration: 1,
      locator: "shop",
      mode: "create",
      occurrence: 1,
      phase: "after-rename",
    },
    {
      expectedEntities: 1,
      expectedGeneration: 2,
      locator: "orders",
      mode: "delete",
      occurrence: 1,
      phase: "removal-parent-directory-sync",
    },
    {
      expectedEntities: 1,
      expectedGeneration: 2,
      locator: "orders",
      mode: "delete",
      occurrence: 1,
      phase: "removal-after-unlink",
    },
  ];

  for (const crashCase of processCrashCases) {
    test(`recovers a real process exit at ${crashCase.phase} for ${crashCase.locator} occurrence ${crashCase.occurrence}`, async () => {
      const roots = await workspace();
      if (crashCase.mode === "delete") {
        const initial = await harness(roots);
        expect(await initial.engine.execute(createRequest())).toMatchObject({
          generation: 1,
          status: "committed",
        });
      }
      const shopLocator = markdownIntentLocator(entityId(1));
      const ordersLocator = markdownIntentLocator(entityId(2));
      if (!shopLocator.ok || !ordersLocator.ok) throw new Error("invalid crash-test locators");
      const faultLocator =
        crashCase.locator === "journal"
          ? localTransactionStateLocator
          : crashCase.locator === "shop"
            ? shopLocator.value
            : ordersLocator.value;
      await crashTransactionProcess(
        roots,
        crashCase.mode,
        crashCase.phase,
        faultLocator,
        crashCase.occurrence,
      );

      const stateAfterExit = JSON.parse(
        await readFile(
          path.join(roots.workspaceRoot, String(localTransactionStateLocator)),
          "utf8",
        ),
      ) as { readonly phase?: unknown };
      let recoveredReplacementCommits = 0;
      const replacementLocators = new Set([String(shopLocator.value), String(ordersLocator.value)]);
      const restarted = await harness(
        roots,
        undefined,
        (phase, context) => {
          if (
            phase === "after-rename" &&
            context?.locator !== undefined &&
            replacementLocators.has(String(context.locator))
          ) {
            recoveredReplacementCommits += 1;
          }
        },
        true,
      );
      const snapshot = await within(
        Promise.resolve(
          restarted.provider.snapshot([resourceFor(entityId(1)), resourceFor(entityId(2))]),
        ),
        5_000,
        "default-stale transaction recovery",
      );
      expect(snapshot.generation).toBe(crashCase.expectedGeneration);
      expect(snapshot.revisions.filter((entry) => entry.revision !== null)).toHaveLength(
        crashCase.expectedEntities,
      );
      const loaded = await restarted.store.load();
      if (!loaded.ok) throw new Error("expected recovered graph");
      expect(loaded.value.entities).toHaveLength(crashCase.expectedEntities);
      expect(loaded.value.relations).toHaveLength(crashCase.expectedEntities === 2 ? 1 : 0);
      expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);
      if (stateAfterExit.phase === "committing") {
        expect(recoveredReplacementCommits).toBeGreaterThan(0);
      }

      if (crashCase.expectedGeneration === 0) {
        expect(await restarted.engine.execute(createRequest())).toMatchObject({
          generation: 1,
          status: "committed",
        });
      } else {
        const shopDocument = loaded.value.documents.find(
          (document) => document.entity.id === entityId(1),
        );
        if (shopDocument === undefined) throw new Error("recovered graph is missing Shop");
        expect(
          await restarted.engine.execute({
            affected: { entities: [entityId(1)], relations: [] },
            context: {
              ownership: { owner: "curated", plane: "intent" },
              pinnedComponentIds: [],
            },
            expectedRevisions: [
              { expected: shopDocument.revision, resource: shopDocument.resource },
            ],
            mutation: {
              components: [
                {
                  id: entityId(1),
                  patch: { intent: `Recovered after ${crashCase.phase}.` },
                  type: "patch",
                },
              ],
              relationships: [],
            },
          }),
        ).toMatchObject({
          generation: crashCase.expectedGeneration + 1,
          status: "committed",
        });
      }
    });
  }

  test("cleans recovery-created stages after an unconfirmed startup target", async () => {
    const roots = await workspace();
    const shopLocator = markdownIntentLocator(entityId(1));
    if (!shopLocator.ok) throw new Error("invalid recovery-cleanup target locator");
    await crashTransactionProcess(roots, "create", "after-rename", localTransactionStateLocator, 2);
    expect(
      JSON.parse(
        await readFile(
          path.join(roots.workspaceRoot, String(localTransactionStateLocator)),
          "utf8",
        ),
      ),
    ).toMatchObject({ generation: 1, phase: "committing" });

    let failedBeforeRename = false;
    const restarted = await harness(
      roots,
      undefined,
      (phase, context) => {
        if (!failedBeforeRename && phase === "rename" && context?.locator === shopLocator.value) {
          failedBeforeRename = true;
          throw new Error("interrupt recovered target before rename");
        }
      },
      true,
    );
    const requested = [resourceFor(entityId(1)), resourceFor(entityId(2))];
    await expect(restarted.provider.snapshot(requested)).rejects.toThrow(
      "interrupted transaction cannot be settled",
    );
    expect(failedBeforeRename).toBeTrue();
    expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);

    const settled = await restarted.provider.snapshot(requested);
    expect(settled.generation).toBe(1);
    expect(settled.revisions.filter((entry) => entry.revision !== null)).toHaveLength(2);
    expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);
  });

  test("reuses an idle snapshot lease after a one-shot release failure", async () => {
    const roots = await workspace();
    let releaseCalls = 0;
    const active = await harness(roots, undefined, (phase) => {
      if (phase !== "coordination-release") return;
      releaseCalls += 1;
      if (releaseCalls === 1) throw new Error("interrupt idle snapshot lease release");
    });

    await expect(active.provider.snapshot([])).rejects.toThrow();
    expect(releaseCalls).toBe(1);
    expect(await active.provider.snapshot([])).toMatchObject({ generation: 0 });
    expect(releaseCalls).toBe(2);
  });

  test("does not share a retained snapshot lease with a concurrent caller", async () => {
    const roots = await workspace();
    let releaseCalls = 0;
    let holdRead = false;
    let readHeld = false;
    let readStartedResolve!: () => void;
    let releaseReadResolve!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      readStartedResolve = resolve;
    });
    const releaseRead = new Promise<void>((resolve) => {
      releaseReadResolve = resolve;
    });
    const active = await harness(roots, undefined, async (phase) => {
      if (phase === "coordination-release") {
        releaseCalls += 1;
        if (releaseCalls === 1) throw new Error("retain the idle snapshot lease");
      }
      if (holdRead && !readHeld && phase === "read") {
        readHeld = true;
        readStartedResolve();
        await releaseRead;
      }
    });
    await expect(active.provider.snapshot([])).rejects.toThrow();

    holdRead = true;
    const retry = active.provider.snapshot([]);
    await within(readStarted, 5_000, "retained snapshot lease handoff");
    try {
      await expect(active.provider.snapshot([])).rejects.toThrow();
    } finally {
      releaseReadResolve();
    }
    expect(await retry).toMatchObject({ generation: 0 });
    expect(releaseCalls).toBe(2);
  });

  test("retains the startup lease when release fails after child-process recovery", async () => {
    const roots = await workspace();
    await crashTransactionProcess(roots, "create", "after-rename", localTransactionStateLocator, 2);

    let releaseCalls = 0;
    const restarted = await harness(
      roots,
      undefined,
      (phase) => {
        if (phase !== "coordination-release") return;
        releaseCalls += 1;
        if (releaseCalls === 1) throw new Error("interrupt startup lease release");
      },
      true,
    );
    const requested = [resourceFor(entityId(1)), resourceFor(entityId(2))];
    await expect(restarted.provider.snapshot(requested)).rejects.toThrow();
    expect(releaseCalls).toBe(1);
    expect(
      JSON.parse(
        await readFile(
          path.join(roots.workspaceRoot, String(localTransactionStateLocator)),
          "utf8",
        ),
      ),
    ).toMatchObject({ generation: 1, phase: "idle" });

    const settled = await restarted.provider.snapshot(requested);
    expect(settled.generation).toBe(1);
    expect(settled.revisions.filter((entry) => entry.revision !== null)).toHaveLength(2);
    expect(releaseCalls).toBe(2);
    expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);

    const loaded = await restarted.store.load();
    if (!loaded.ok) throw new Error("expected recovered startup graph");
    const shopDocument = loaded.value.documents.find(
      (document) => document.entity.id === entityId(1),
    );
    if (shopDocument === undefined) throw new Error("recovered startup graph is missing Shop");
    expect(
      await restarted.engine.execute({
        affected: { entities: [entityId(1)], relations: [] },
        context: {
          ownership: { owner: "curated", plane: "intent" },
          pinnedComponentIds: [],
        },
        expectedRevisions: [{ expected: shopDocument.revision, resource: shopDocument.resource }],
        mutation: {
          components: [
            {
              id: entityId(1),
              patch: { intent: "Continue after startup lease recovery." },
              type: "patch",
            },
          ],
          relationships: [],
        },
      }),
    ).toMatchObject({ generation: 2, status: "committed" });
  });

  test("rejects optimistic races and preserves a projection watermark through settlement", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    await seed(
      resources,
      localTransactionStateLocator,
      new TextEncoder().encode(
        '{"generation":0,"phase":"idle","projectionFingerprint":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","projectionIntegrity":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","projectionResourceCount":7,"projectionWatermark":0,"settlement":null,"version":1}\n',
      ),
    );
    const active = await harness(roots);
    const stale = createRequest();
    const wrong = {
      ...stale,
      expectedRevisions: stale.expectedRevisions.map((entry, index) => ({
        expected:
          index === 0
            ? "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            : null,
        resource: entry.resource,
      })),
    };
    expect(await active.engine.execute(wrong)).toMatchObject({
      diagnostics: [{ code: "content-revision-conflict" }],
      status: "conflict",
    });
    expect(await active.engine.execute(stale)).toMatchObject({ status: "committed" });
    const stateRead = await active.resources.read({
      locator: localTransactionStateLocator,
      maxBytes: 1_000_000,
    });
    if (!stateRead.ok) throw new Error("expected transaction state");
    const state = JSON.parse(decoder.decode(stateRead.value.bytes)) as {
      projectionFingerprint: string;
      projectionIntegrity: string;
      projectionResourceCount: number;
      projectionWatermark: number;
    };
    expect(state.projectionWatermark).toBe(0);
    expect(state.projectionFingerprint).toBe(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(state.projectionIntegrity).toBe(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    expect(state.projectionResourceCount).toBe(7);
  });

  test("ignores inherited legacy-token markers for modern checkpointed transactions", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    const fingerprint = `sha256:${"a".repeat(64)}`;
    const integrity = `sha256:${"b".repeat(64)}`;
    await seed(
      resources,
      localTransactionStateLocator,
      new TextEncoder().encode(
        `${JSON.stringify({
          generation: 0,
          phase: "idle",
          projectionFingerprint: fingerprint,
          projectionIntegrity: integrity,
          projectionResourceCount: 7,
          projectionWatermark: 0,
          settlement: null,
          version: 1,
        })}\n`,
      ),
    );
    const active = await harness(roots);
    const original = Object.getOwnPropertyDescriptor(Object.prototype, "usesLegacyTokenEvidence");
    let outcome: Awaited<ReturnType<typeof active.engine.execute>> | undefined;
    try {
      Object.defineProperty(Object.prototype, "usesLegacyTokenEvidence", {
        configurable: true,
        enumerable: true,
        value: true,
      });
      outcome = await active.engine.execute(createRequest());
    } finally {
      if (original === undefined) {
        delete (Object.prototype as { usesLegacyTokenEvidence?: unknown }).usesLegacyTokenEvidence;
      } else {
        Object.defineProperty(Object.prototype, "usesLegacyTokenEvidence", original);
      }
    }
    expect(outcome).toMatchObject({ generation: 1, status: "committed" });
    const settled = JSON.parse(
      await readFile(path.join(roots.workspaceRoot, String(localTransactionStateLocator)), "utf8"),
    ) as Record<string, unknown>;
    expect(settled).toMatchObject({
      generation: 1,
      phase: "idle",
      projectionFingerprint: fingerprint,
      projectionIntegrity: integrity,
      projectionResourceCount: 7,
      projectionWatermark: 0,
    });
    expect(settled).not.toHaveProperty("usesLegacyTokenEvidence");
    const restarted = await harness(roots);
    expect(await restarted.provider.snapshot([])).toMatchObject({ generation: 1 });
  });

  test("records projection continuity only for the current settled generation", async () => {
    const roots = await workspace();
    const active = await harness(roots);
    const initial = projectionIdentity(0, "a");
    const initialIntegrity = projectionIntegrity("b");
    expect(await active.provider.readProjectionCheckpoint()).toEqual({
      ok: true,
      value: {
        generation: initial.generation,
        projection: null,
        projectionIntegrity: null,
        projectionResourceCount: null,
      },
    });
    expect(
      await active.provider.recordProjectionCheckpoint(initial, initialIntegrity, 0),
    ).toMatchObject({ diagnostics: [{ code: "invalid-projection-checkpoint" }], ok: false });
    expect(await active.provider.recordProjectionCheckpoint(initial, initialIntegrity, 7)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await active.provider.readProjectionCheckpoint()).toEqual({
      ok: true,
      value: {
        generation: initial.generation,
        projection: initial,
        projectionIntegrity: initialIntegrity,
        projectionResourceCount: 7,
      },
    });

    expect(await active.engine.execute(createRequest())).toMatchObject({
      generation: 1,
      status: "committed",
    });
    const current = projectionIdentity(1, "a");
    expect(await active.provider.readProjectionCheckpoint()).toEqual({
      ok: true,
      value: {
        generation: current.generation,
        projection: initial,
        projectionIntegrity: initialIntegrity,
        projectionResourceCount: 7,
      },
    });
    expect(
      await active.provider.recordProjectionCheckpoint(initial, initialIntegrity, 7),
    ).toMatchObject({
      diagnostics: [{ code: "projection-checkpoint-generation-mismatch" }],
      ok: false,
    });
    expect(
      await active.provider.recordProjectionCheckpoint(current, projectionIntegrity("c"), 9),
    ).toEqual({
      ok: true,
      value: undefined,
    });
  });

  test("contains checkpoint release throws and preserves earlier specific failures", async () => {
    const roots = await workspace();
    let failNextRelease = false;
    const active = await harness(roots, undefined, (phase) => {
      if (phase === "coordination-release" && failNextRelease) {
        failNextRelease = false;
        throw new Error("injected checkpoint release throw");
      }
    });
    const initial = projectionIdentity(0, "d");
    const integrity = projectionIntegrity("e");

    failNextRelease = true;
    expect(await active.provider.readProjectionCheckpoint()).toMatchObject({
      diagnostics: [{ code: "projection-checkpoint-unavailable" }],
      ok: false,
    });
    expect(await active.provider.readProjectionCheckpoint()).toMatchObject({
      ok: true,
      value: { generation: 0, projection: null },
    });

    failNextRelease = true;
    expect(await active.provider.recordProjectionCheckpoint(initial, integrity, 7)).toMatchObject({
      diagnostics: [{ code: "projection-checkpoint-unavailable" }],
      ok: false,
    });
    expect(await active.provider.recordProjectionCheckpoint(initial, integrity, 7)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await active.provider.readProjectionCheckpoint()).toMatchObject({
      ok: true,
      value: { projection: initial, projectionIntegrity: integrity, projectionResourceCount: 7 },
    });

    failNextRelease = true;
    expect(
      await active.provider.recordProjectionCheckpoint(projectionIdentity(1, "f"), integrity, 9),
    ).toMatchObject({
      diagnostics: [{ code: "projection-checkpoint-generation-mismatch" }],
      ok: false,
    });
    expect(await active.provider.recordProjectionCheckpoint(initial, integrity, 7)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  test("contains retryable and ownership-lost checkpoint release results", async () => {
    const roots = await workspace();
    const base = await createLocalResourceProvider(roots);
    let releaseMode: "normal" | "ownership-lost" | "retryable" = "retryable";
    const resources = providerWithOverrides(base, {
      async releaseCoordination(lease) {
        const mode = releaseMode;
        releaseMode = "normal";
        if (mode === "retryable") {
          return failure({
            code: "injected-checkpoint-release-failure",
            message: "Injected checkpoint release failure",
          });
        }
        if (mode === "ownership-lost") {
          await base.releaseCoordination(lease);
          return failure({
            code: "resource-coordination-ownership-lost",
            message: "Injected checkpoint ownership loss",
          });
        }
        return base.releaseCoordination(lease);
      },
    });
    const active = journalHarnessFor(resources);

    expect(await active.provider.readProjectionCheckpoint()).toMatchObject({
      diagnostics: [{ code: "projection-checkpoint-unavailable" }],
      ok: false,
    });
    expect(await active.provider.readProjectionCheckpoint()).toMatchObject({ ok: true });

    releaseMode = "ownership-lost";
    expect(await active.provider.readProjectionCheckpoint()).toMatchObject({
      diagnostics: [{ code: "projection-checkpoint-unavailable" }],
      ok: false,
    });
    expect(await active.provider.readProjectionCheckpoint()).toMatchObject({ ok: true });
  });

  test("migrates legacy watermarks to an unverified checkpoint", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    await seed(
      resources,
      localTransactionStateLocator,
      new TextEncoder().encode(
        '{"generation":0,"phase":"idle","projectionWatermark":0,"settlement":null,"version":1}\n',
      ),
    );
    const active = await harness(roots);
    const genesis = projectionIdentity(0, "b");
    const genesisIntegrity = projectionIntegrity("c");
    expect(await active.provider.readProjectionCheckpoint()).toEqual({
      ok: true,
      value: {
        generation: genesis.generation,
        projection: null,
        projectionIntegrity: null,
        projectionResourceCount: null,
      },
    });
    expect(await active.provider.recordProjectionCheckpoint(genesis, genesisIntegrity, 11)).toEqual(
      {
        ok: true,
        value: undefined,
      },
    );
    const read = await active.resources.read({
      locator: localTransactionStateLocator,
      maxBytes: 1_000_000,
    });
    if (!read.ok) throw new Error("expected migrated transaction state");
    expect(decoder.decode(read.value.bytes)).toContain(
      `"projectionFingerprint":"${genesis.fingerprint}"`,
    );
  });

  test("preserves legacy pending token evidence across failed roll-forward retries", async () => {
    const roots = await workspace();
    const base = await createLocalResourceProvider(roots);
    const locator = workspaceResourceLocator("groma", "records", "legacy-pending");
    if (!locator.ok) throw new Error("invalid legacy pending fixture locator");
    await seed(base, locator.value, new TextEncoder().encode("divergent current bytes\n"));
    const affected = { entities: [], relations: [] };
    const targets = [
      {
        expected: `sha256:${"a".repeat(64)}`,
        locator: String(locator.value),
        resource: String(locator.value),
        result: null,
      },
    ];
    const token = `groma-local-tx-v1:${createHash("sha256")
      .update(JSON.stringify({ affected, baseGeneration: 0, generation: 1, targets, version: 1 }))
      .digest("hex")}`;
    const source = `${JSON.stringify({
      affected,
      baseGeneration: 0,
      generation: 1,
      phase: "committing",
      projectionWatermark: 0,
      targets,
      token,
      version: 1,
    })}\n`;
    await seed(base, localTransactionStateLocator, new TextEncoder().encode(source));
    const journalHandles = new WeakSet<object>();
    let rejectedWriteBack = false;
    const resources = providerWithOverrides(base, {
      async stageReplacement(target, bytes) {
        const staged = await base.stageReplacement(target, bytes);
        if (staged.ok && target === localTransactionStateLocator) {
          journalHandles.add(staged.value as object);
        }
        return staged;
      },
      async commitReplacement(handle) {
        if (!rejectedWriteBack && journalHandles.has(handle as object)) {
          rejectedWriteBack = true;
          return Object.freeze({
            diagnostics: Object.freeze([
              Object.freeze({
                code: "injected-legacy-write-back-rejection",
                message: "Injected legacy pending write-back rejection",
              }),
            ]),
            state: "not-committed" as const,
          });
        }
        return base.commitReplacement(handle);
      },
    });
    const active = journalHarnessFor(resources);
    await expect(active.provider.snapshot([])).rejects.toThrow();
    expect(rejectedWriteBack).toBeTrue();
    expect(
      await readFile(path.join(roots.workspaceRoot, String(localTransactionStateLocator)), "utf8"),
    ).toBe(source);
    await expect(active.provider.snapshot([])).rejects.toThrow(
      "interrupted transaction cannot be settled",
    );
    expect(
      await readFile(path.join(roots.workspaceRoot, String(localTransactionStateLocator)), "utf8"),
    ).toBe(source);

    const restarted = await harness(roots);
    await expect(restarted.provider.snapshot([])).rejects.toThrow(
      "interrupted transaction cannot be settled",
    );
    expect(
      await readFile(path.join(roots.workspaceRoot, String(localTransactionStateLocator)), "utf8"),
    ).toBe(source);
  });

  test("migrates a legacy prepared token only after rollback settles it", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    const locator = workspaceResourceLocator("groma", "records", "legacy-prepared");
    if (!locator.ok) throw new Error("invalid legacy prepared fixture locator");
    const affected = { entities: [], relations: [] };
    const targets = [
      {
        expected: null,
        locator: String(locator.value),
        resource: String(locator.value),
        result: null,
      },
    ];
    const token = `groma-local-tx-v1:${createHash("sha256")
      .update(JSON.stringify({ affected, baseGeneration: 0, generation: 1, targets, version: 1 }))
      .digest("hex")}`;
    await seed(
      resources,
      localTransactionStateLocator,
      new TextEncoder().encode(
        `${JSON.stringify({
          affected,
          baseGeneration: 0,
          generation: 1,
          phase: "prepared",
          projectionWatermark: 0,
          targets,
          token,
          version: 1,
        })}\n`,
      ),
    );

    const active = await harness(roots);
    expect(await active.provider.snapshot([])).toMatchObject({ generation: 0 });
    const settled = JSON.parse(
      await readFile(path.join(roots.workspaceRoot, String(localTransactionStateLocator)), "utf8"),
    ) as Record<string, unknown>;
    expect(settled).toMatchObject({
      generation: 0,
      phase: "idle",
      projectionFingerprint: null,
      projectionIntegrity: null,
      projectionResourceCount: null,
      projectionWatermark: null,
      settlement: { outcome: "not-committed", token },
    });
    expect(settled).not.toHaveProperty("usesLegacyTokenEvidence");
  });

  test("rejects noncanonical legacy journal bytes before migration", async () => {
    const affected = { entities: [], relations: [] };
    const targets = [
      {
        expected: null,
        locator: "groma/records/legacy",
        resource: "groma/records/legacy",
        result: null,
      },
    ];
    const token = `groma-local-tx-v1:${createHash("sha256")
      .update(JSON.stringify({ affected, baseGeneration: 0, generation: 1, targets, version: 1 }))
      .digest("hex")}`;
    const variants = [
      '{"generation":0, "phase":"idle","projectionWatermark":0,"settlement":null,"version":1}\n',
      '{"phase":"idle","generation":0,"projectionWatermark":0,"settlement":null,"version":1}\n',
      '{"generation":0,"generation":0,"phase":"idle","projectionWatermark":0,"settlement":null,"version":1}\n',
      `${JSON.stringify({
        affected,
        baseGeneration: 0,
        generation: 1,
        phase: "prepared",
        projectionWatermark: 0,
        targets,
        token,
        version: 1,
      }).replace('"phase"', ' "phase"')}\n`,
      `${JSON.stringify({
        affected,
        baseGeneration: 0,
        generation: 1,
        phase: "prepared",
        projectionWatermark: 0,
        targets,
        token,
        usesLegacyTokenEvidence: true,
        version: 1,
      })}\n`,
    ];
    for (const source of variants) {
      const roots = await workspace();
      const resources = await createLocalResourceProvider(roots);
      await seed(resources, localTransactionStateLocator, new TextEncoder().encode(source));
      const active = await harness(roots);
      await expect(active.provider.snapshot([])).rejects.toThrow("noncanonical");
    }
  });

  test("fails closed for malformed and bounded journal records", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    await seed(resources, localTransactionStateLocator, new TextEncoder().encode("{}\n"));
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources });
    const provider = createLocalTransactionJournal({
      adapter: createMarkdownIntentTransactionAdapter({ model, store }),
      resources,
    });
    await expect(provider.snapshot([])).rejects.toThrow("malformed");
    expect(() =>
      createLocalTransactionJournal({
        adapter: createMarkdownIntentTransactionAdapter({ model, store }),
        bounds: { maxTargets: 0 },
        resources,
      }),
    ).toThrow("maxTargets");

    const oversized = createLocalTransactionJournal({
      adapter: createMarkdownIntentTransactionAdapter({ model, store }),
      bounds: { maxJournalBytes: 2 },
      resources,
    });
    await expect(oversized.snapshot([])).rejects.toThrow("byte bound");
    expect(() =>
      createLocalTransactionJournal({
        adapter: createMarkdownIntentTransactionAdapter({ model, store }),
        bounds: { maxReplacementBytes: 9, maxTargetBytes: 8 },
        resources,
      }),
    ).toThrow("maxTargetBytes");
  });

  test("reports non-contention coordination acquisition failures as provider failures", async () => {
    const roots = await workspace();
    const base = await createLocalResourceProvider(roots);
    let acquisitions = 0;
    const resources = providerWithOverrides(base, {
      async acquireCoordination(request) {
        acquisitions += 1;
        if (acquisitions === 2) {
          return failure(
            Object.freeze({
              code: "resource-provider-failure",
              message: "Injected coordination I/O failure",
            }),
          );
        }
        return base.acquireCoordination(request);
      },
    });
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources });
    const journal = createLocalTransactionJournal({
      adapter: createMarkdownIntentTransactionAdapter({ model, store }),
      resources,
    });
    const engine = engineFor(journal);

    expect(await engine.execute(createRequest())).toMatchObject({
      committed: false,
      phase: "prepare",
      status: "provider-failure",
    });
    expect(acquisitions).toBe(2);
  });

  for (const operation of ["delete", "replace"] as const) {
    test(`rejects an oversized existing target before publishing prepared state for ${operation}`, async () => {
      const roots = await workspace();
      const resources = await createLocalResourceProvider(roots);
      const locator = workspaceResourceLocator("groma", `oversized-${operation}.md`);
      if (!locator.ok) throw new Error("invalid oversized target locator");
      const resource = parseResourceKey(locator.value);
      if (!resource.ok) throw new Error("invalid oversized target resource");
      const previous = new TextEncoder().encode("0123456789abcdefX");
      await seed(resources, locator.value, previous);
      const previousRevision = parseContentRevision(
        `sha256:${createHash("sha256").update(previous).digest("hex")}`,
      );
      const replacement = new TextEncoder().encode("small");
      const replacementRevision = parseContentRevision(
        `sha256:${createHash("sha256").update(replacement).digest("hex")}`,
      );
      if (!previousRevision.ok || !replacementRevision.ok) {
        throw new Error("invalid oversized target revisions");
      }
      const adapter: CanonicalTransactionAdapter = Object.freeze({
        load: async () =>
          success(
            Object.freeze({
              resources: Object.freeze([
                Object.freeze({
                  locator: locator.value,
                  resource: resource.value,
                  revision: previousRevision.value,
                }),
              ]),
              state: {},
            }),
          ),
        materialize: () =>
          success(
            Object.freeze({
              state: {},
              targets: Object.freeze([
                Object.freeze({
                  expected: previousRevision.value,
                  locator: locator.value,
                  ...(operation === "replace" ? { replacement } : {}),
                  resource: resource.value,
                  result: operation === "replace" ? replacementRevision.value : null,
                }),
              ]),
            }),
          ),
      });
      const journal = createLocalTransactionJournal({
        adapter,
        bounds: { maxReplacementBytes: 8, maxTargetBytes: 16 },
        resources,
      });
      const proposal = {
        affected: { entities: [], relations: [] },
        baseGeneration: 0,
        context: {},
        expectedRevisions: [{ expected: previousRevision.value, resource: resource.value }],
        generation: 1,
        mutation: {},
        priorState: {},
      } as unknown as ProposedTransaction;

      await expect(journal.prepare(proposal)).rejects.toThrow("preparation failed");
      expect(
        await resources.read({ locator: localTransactionStateLocator, maxBytes: 1_000_000 }),
      ).toMatchObject({ diagnostics: [{ code: "resource-missing" }], ok: false });
      const unchanged = await resources.read({ locator: locator.value, maxBytes: 100 });
      expect(unchanged).toMatchObject({ ok: true });
      if (unchanged.ok) expect(unchanged.value.bytes).toEqual(previous);
    });
  }

  for (const publication of [
    { expectedTargetCommits: 0, journalOrdinal: 2, phase: "committing" },
    { expectedTargetCommits: 2, journalOrdinal: 3, phase: "idle" },
  ] as const) {
    test(`requires confirmed journal durability before acknowledging ${publication.phase} publication`, async () => {
      const roots = await workspace();
      const base = await createLocalResourceProvider(roots);
      const handles = new WeakMap<
        object,
        { readonly journalOrdinal?: number; readonly locator: string }
      >();
      let journalStages = 0;
      let targetCommits = 0;
      let injectUncertainty = true;
      const resources = providerWithOverrides(base, {
        async stageReplacement(locator, bytes) {
          const staged = await base.stageReplacement(locator, bytes);
          if (staged.ok) {
            const isJournal = locator === localTransactionStateLocator;
            handles.set(staged.value as object, {
              ...(isJournal ? { journalOrdinal: (journalStages += 1) } : {}),
              locator: String(locator),
            });
          }
          return staged;
        },
        async commitReplacement(handle) {
          const actual = await base.commitReplacement(handle);
          const tracked = handles.get(handle as object);
          if (tracked?.locator !== String(localTransactionStateLocator)) {
            targetCommits += 1;
            return actual;
          }
          if (injectUncertainty && tracked.journalOrdinal === publication.journalOrdinal) {
            return Object.freeze({
              diagnostics: Object.freeze([
                Object.freeze({
                  code: "injected-journal-indeterminate",
                  message: "Injected journal durability uncertainty",
                }),
              ]),
              state: "committed-indeterminate" as const,
            });
          }
          return actual;
        },
      });
      const model = createStandardModelCapability();
      const store = createMarkdownIntentStore({ model, resources });
      const journal = createLocalTransactionJournal({
        adapter: createMarkdownIntentTransactionAdapter({ model, store }),
        resources,
      });
      const engine = engineFor(journal);

      const outcome = await engine.execute(createRequest());
      expect(journalStages).toBeGreaterThanOrEqual(publication.journalOrdinal);
      expect(outcome.status).toBe("indeterminate");
      if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");
      expect(targetCommits).toBe(publication.expectedTargetCommits);
      expect(
        JSON.parse(
          await readFile(
            path.join(roots.workspaceRoot, String(localTransactionStateLocator)),
            "utf8",
          ),
        ),
      ).toMatchObject({ phase: publication.phase });

      injectUncertainty = false;
      expect(await engine.recover(outcome.recovery)).toMatchObject({
        generation: 1,
        status: "committed",
      });
      expect(targetCommits).toBe(2);
      const loaded = await store.load();
      expect(loaded).toMatchObject({ ok: true });
      if (loaded.ok) {
        expect(loaded.value.entities).toHaveLength(2);
        expect(loaded.value.relations).toHaveLength(1);
      }
    });
  }

  for (const failureMode of ["not-committed", "throw"] as const) {
    test(`discards a journal stage after a pre-move ${failureMode} publication`, async () => {
      const roots = await workspace();
      const base = await createLocalResourceProvider(roots);
      const journalHandles = new WeakSet<object>();
      let injected = false;
      const resources = providerWithOverrides(base, {
        async stageReplacement(locator, bytes) {
          const staged = await base.stageReplacement(locator, bytes);
          if (staged.ok && locator === localTransactionStateLocator) {
            journalHandles.add(staged.value as object);
          }
          return staged;
        },
        async commitReplacement(handle) {
          if (!injected && journalHandles.has(handle as object)) {
            injected = true;
            if (failureMode === "throw") throw new Error("interrupt journal before rename");
            return Object.freeze({
              diagnostics: Object.freeze([
                Object.freeze({
                  code: "injected-journal-not-committed",
                  message: "Injected pre-move journal rejection",
                }),
              ]),
              state: "not-committed" as const,
            });
          }
          return base.commitReplacement(handle);
        },
      });
      const active = journalHarnessFor(resources);

      expect(await active.engine.execute(createRequest())).toMatchObject({
        status: "provider-failure",
      });
      expect(injected).toBeTrue();
      expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);
      expect(
        await resources.read({ locator: localTransactionStateLocator, maxBytes: 1_000_000 }),
      ).toMatchObject({ diagnostics: [{ code: "resource-missing" }], ok: false });
      expect(await active.engine.execute(createRequest())).toMatchObject({
        generation: 1,
        status: "committed",
      });
      expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);
    });
  }

  test("retries a journal discard failure before staging later state", async () => {
    const roots = await workspace();
    const base = await createLocalResourceProvider(roots);
    const journalHandles = new WeakSet<object>();
    let rejectedCommit = false;
    let journalDiscards = 0;
    const resources = providerWithOverrides(base, {
      async stageReplacement(locator, bytes) {
        const staged = await base.stageReplacement(locator, bytes);
        if (staged.ok && locator === localTransactionStateLocator) {
          journalHandles.add(staged.value as object);
        }
        return staged;
      },
      async commitReplacement(handle) {
        if (!rejectedCommit && journalHandles.has(handle as object)) {
          rejectedCommit = true;
          return Object.freeze({
            diagnostics: Object.freeze([
              Object.freeze({
                code: "injected-journal-not-committed",
                message: "Injected pre-move journal rejection",
              }),
            ]),
            state: "not-committed" as const,
          });
        }
        return base.commitReplacement(handle);
      },
      async discardReplacement(handle) {
        if (journalHandles.has(handle as object)) {
          journalDiscards += 1;
          if (journalDiscards === 1) {
            return failure(
              Object.freeze({
                code: "injected-journal-discard-failure",
                message: "Injected journal discard failure",
              }),
            );
          }
        }
        return base.discardReplacement(handle);
      },
    });
    const active = journalHarnessFor(resources);

    expect(await active.engine.execute(createRequest())).toMatchObject({
      status: "provider-failure",
    });
    expect(await stageArtifacts(roots.workspaceRoot)).toHaveLength(1);
    expect(journalDiscards).toBe(1);
    expect(await active.engine.execute(createRequest())).toMatchObject({
      generation: 1,
      status: "committed",
    });
    expect(journalDiscards).toBe(2);
    expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);
  });

  test("does not discard a journal handle when thrown publication bytes are visible", async () => {
    const roots = await workspace();
    let interruptedFinalization = false;
    const base = await createLocalResourceProvider({
      ...roots,
      faultInjector(phase, context) {
        if (
          !interruptedFinalization &&
          phase === "replacement-after-rename-before-mode" &&
          context?.locator === localTransactionStateLocator
        ) {
          interruptedFinalization = true;
          throw new Error("interrupt visible journal finalization");
        }
      },
    });
    const journalHandles = new WeakSet<object>();
    let threwAfterMove = false;
    let journalDiscards = 0;
    const resources = providerWithOverrides(base, {
      async stageReplacement(locator, bytes) {
        const staged = await base.stageReplacement(locator, bytes);
        if (staged.ok && locator === localTransactionStateLocator) {
          journalHandles.add(staged.value as object);
        }
        return staged;
      },
      async commitReplacement(handle) {
        const committed = await base.commitReplacement(handle);
        if (!threwAfterMove && journalHandles.has(handle as object)) {
          threwAfterMove = true;
          throw new Error("lose the post-move provider response");
        }
        return committed;
      },
      async discardReplacement(handle) {
        if (journalHandles.has(handle as object)) journalDiscards += 1;
        return base.discardReplacement(handle);
      },
    });
    const active = journalHarnessFor(resources);

    expect(await active.engine.execute(createRequest())).toMatchObject({
      status: "provider-failure",
    });
    expect(interruptedFinalization).toBeTrue();
    expect(threwAfterMove).toBeTrue();
    expect(journalDiscards).toBe(0);
    expect(await active.engine.execute(createRequest())).toMatchObject({
      generation: 1,
      status: "committed",
    });
    expect(await stageArtifacts(roots.workspaceRoot)).toEqual([]);
  });

  test("independently rejects generic adapters that change the expected resource set", async () => {
    const roots = await workspace();
    const resources = await createLocalResourceProvider(roots);
    const checkedLocator = workspaceResourceLocator("groma", "checked.md");
    const uncheckedLocator = workspaceResourceLocator("groma", "unchecked.md");
    if (!checkedLocator.ok || !uncheckedLocator.ok) throw new Error("invalid test locators");
    const checkedResource = parseResourceKey(checkedLocator.value);
    const uncheckedResource = parseResourceKey(uncheckedLocator.value);
    if (!checkedResource.ok || !uncheckedResource.ok) throw new Error("invalid test resources");
    const safeBytes = new TextEncoder().encode("must remain unchanged");
    await seed(resources, uncheckedLocator.value, safeBytes);
    const replacement = new TextEncoder().encode("unchecked replacement");
    const replacementRevision = parseContentRevision(
      `sha256:${createHash("sha256").update(replacement).digest("hex")}`,
    );
    const priorRevision = parseContentRevision(
      `sha256:${createHash("sha256").update(safeBytes).digest("hex")}`,
    );
    if (!replacementRevision.ok || !priorRevision.ok) throw new Error("invalid test revision");
    const target = (
      locator: WorkspaceResourceLocator,
      resource: ResourceKey,
      expected: ContentRevision | null,
    ): CanonicalTransactionTarget =>
      Object.freeze({
        expected,
        locator,
        replacement,
        resource,
        result: replacementRevision.value,
      });
    const checkedTarget = target(checkedLocator.value, checkedResource.value, null);
    const uncheckedTarget = target(
      uncheckedLocator.value,
      uncheckedResource.value,
      priorRevision.value,
    );
    const cases: readonly (readonly CanonicalTransactionTarget[])[] = [
      [checkedTarget, uncheckedTarget],
      [uncheckedTarget],
      [],
      [checkedTarget, checkedTarget],
      [target(checkedLocator.value, checkedResource.value, priorRevision.value)],
    ];
    const proposal = {
      affected: { entities: [], relations: [] },
      baseGeneration: 0,
      context: {},
      expectedRevisions: [{ expected: null, resource: checkedResource.value }],
      generation: 1,
      mutation: {},
      priorState: {},
    } as unknown as ProposedTransaction;

    for (const targets of cases) {
      const adapter: CanonicalTransactionAdapter = Object.freeze({
        load: async () => success(Object.freeze({ resources: Object.freeze([]), state: {} })),
        materialize: () =>
          success(Object.freeze({ state: {}, targets: Object.freeze(Array.from(targets)) })),
      });
      const journal = createLocalTransactionJournal({ adapter, resources });
      await expect(journal.prepare(proposal)).rejects.toThrow("preparation failed");
      const unchecked = await resources.read({ locator: uncheckedLocator.value, maxBytes: 100 });
      expect(unchecked).toMatchObject({ ok: true });
      if (!unchecked.ok) throw new Error("expected unchecked resource");
      expect(unchecked.value.bytes).toEqual(safeBytes);
      expect(
        await resources.read({ locator: localTransactionStateLocator, maxBytes: 1_000_000 }),
      ).toMatchObject({ diagnostics: [{ code: "resource-missing" }], ok: false });
    }
  });

  for (const aliasCase of [
    { locator: String(localTransactionStateLocator), name: "exact" },
    { locator: String(localTransactionStateLocator).toUpperCase(), name: "uppercase alias" },
  ]) {
    test(`rejects the ${aliasCase.name} transaction state resource before publication`, async () => {
      const roots = await workspace();
      const resources = await createLocalResourceProvider(roots);
      const stateLocator = parseWorkspaceResourceLocator(aliasCase.locator);
      if (!stateLocator.ok) throw new Error("invalid transaction state alias locator");
      const stateResource = parseResourceKey(stateLocator.value);
      if (!stateResource.ok) throw new Error("invalid transaction state alias resource key");
      const damagingBytes = new TextEncoder().encode("destroy the transaction journal");
      const damagingRevision = parseContentRevision(
        `sha256:${createHash("sha256").update(damagingBytes).digest("hex")}`,
      );
      if (!damagingRevision.ok) throw new Error("invalid damaging revision");
      const adapter: CanonicalTransactionAdapter = Object.freeze({
        load: async () =>
          success(
            Object.freeze({
              resources: Object.freeze([]),
              state: {},
            }),
          ),
        materialize: () =>
          success(
            Object.freeze({
              state: {},
              targets: Object.freeze([
                Object.freeze({
                  expected: null,
                  locator: stateLocator.value,
                  replacement: damagingBytes,
                  resource: stateResource.value,
                  result: damagingRevision.value,
                }),
              ]),
            }),
          ),
      });
      const journal = createLocalTransactionJournal({ adapter, resources });
      const proposal = {
        affected: { entities: [], relations: [] },
        baseGeneration: 0,
        context: {},
        expectedRevisions: [{ expected: null, resource: stateResource.value }],
        generation: 1,
        mutation: {},
        priorState: {},
      } as unknown as ProposedTransaction;

      await expect(journal.prepare(proposal)).rejects.toThrow("preparation failed");
      expect(
        await resources.read({ locator: localTransactionStateLocator, maxBytes: 1_000_000 }),
      ).toMatchObject({ diagnostics: [{ code: "resource-missing" }], ok: false });
      expect(
        await resources.read({ locator: stateLocator.value, maxBytes: 1_000_000 }),
      ).toMatchObject({ diagnostics: [{ code: "resource-missing" }], ok: false });
      expect(await journal.snapshot([stateResource.value])).toMatchObject({
        generation: 0,
        revisions: [{ resource: stateResource.value, revision: null }],
      });

      const valid = await harness(roots);
      expect(await valid.engine.execute(createRequest())).toMatchObject({
        generation: 1,
        status: "committed",
      });
    });
  }

  test("keeps externally divergent committing state indeterminate", async () => {
    const roots = await workspace();
    let interruptedOnce = false;
    const active = await harness(roots, (phase) => {
      if (!interruptedOnce && phase === "after-committing-state") {
        interruptedOnce = true;
        throw new Error("interrupt before targets");
      }
    });
    const outcome = await active.engine.execute(createRequest());
    expect(outcome.status).toBe("indeterminate");
    if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");
    const shopLocator = markdownIntentLocator(entityId(1));
    if (!shopLocator.ok) throw new Error("invalid shop locator");
    await seed(
      active.resources,
      shopLocator.value,
      new TextEncoder().encode("external divergence"),
    );

    const restarted = await harness(roots);
    expect(await restarted.engine.recover(outcome.recovery)).toMatchObject({
      status: "indeterminate",
    });
    expect(
      await restarted.resources.read({ locator: shopLocator.value, maxBytes: 100 }),
    ).toMatchObject({ ok: true });
  });

  test("returns affected identities and revisions from the durable settlement on repeated recovery", async () => {
    const roots = await workspace();
    const active = await harness(roots, (phase) => {
      if (phase === "after-committing-state") throw new Error("interrupt once");
    });
    const outcome = await active.engine.execute(createRequest());
    expect(outcome.status).toBe("indeterminate");
    if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");
    const restarted = await harness(roots);
    const first = await restarted.engine.recover(outcome.recovery);
    const second = await restarted.engine.recover(outcome.recovery);
    expect(first).toMatchObject({ status: "committed" });
    expect(second).toEqual(first);
    if (first.status !== "committed") throw new Error("expected committed recovery");
    expect(first.event.affected).toEqual({
      entities: [entityId(1), entityId(2)],
      relations: [relationId(1)],
    });
    expect(first.revisions.map((entry) => entry.resource)).toEqual([
      resourceFor(entityId(1)),
      resourceFor(entityId(2)),
    ]);
  });

  test("retains pending recovery evidence when cleanup fails and settles it on restart", async () => {
    const roots = await workspace();
    let journalFault = false;
    let cleanupFault = false;
    const interrupted = await harness(
      roots,
      (phase) => {
        if (!journalFault && phase === "stage-target") {
          journalFault = true;
          throw new Error("interrupt prepare");
        }
      },
      (phase) => {
        if (!cleanupFault && phase === "cleanup") {
          cleanupFault = true;
          throw new Error("interrupt cleanup");
        }
      },
    );
    expect(await interrupted.engine.execute(createRequest())).toMatchObject({
      status: "provider-failure",
    });
    expect(journalFault).toBeTrue();
    expect(cleanupFault).toBeTrue();
    expect(
      JSON.parse(
        await readFile(
          path.join(roots.workspaceRoot, String(localTransactionStateLocator)),
          "utf8",
        ),
      ),
    ).toMatchObject({ generation: 1, phase: "prepared" });

    const restarted = await harness(roots);
    expect(await restarted.provider.snapshot([])).toMatchObject({ generation: 0 });
    expect(
      JSON.parse(
        await readFile(
          path.join(roots.workspaceRoot, String(localTransactionStateLocator)),
          "utf8",
        ),
      ),
    ).toMatchObject({ generation: 0, phase: "idle" });
  });

  test("makes lease-release failures indeterminate and recovers the durable settlement", async () => {
    const roots = await workspace();
    let releaseFault = false;
    let releaseCount = 0;
    const active = await harness(roots, undefined, (phase) => {
      if (phase === "coordination-release") releaseCount += 1;
      if (!releaseFault && phase === "coordination-release" && releaseCount === 2) {
        releaseFault = true;
        throw new Error("interrupt lease release");
      }
    });
    const outcome = await active.engine.execute(createRequest());
    expect(releaseFault).toBeTrue();
    expect(outcome.status).toBe("indeterminate");
    if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");
    expect(await active.engine.recover(outcome.recovery)).toMatchObject({
      generation: 1,
      status: "committed",
    });
    const restarted = await harness(roots);
    expect(await restarted.engine.recover(outcome.recovery)).toMatchObject({
      generation: 1,
      status: "committed",
    });
  });

  test("retains a freshly acquired recovery lease until release can be retried", async () => {
    const roots = await workspace();
    const interrupted = await harness(roots, (phase) => {
      if (phase === "after-committing-state") throw new Error("interrupt before targets");
    });
    const outcome = await interrupted.engine.execute(createRequest());
    expect(outcome.status).toBe("indeterminate");
    if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");

    let releaseCalls = 0;
    const restarted = await harness(roots, undefined, (phase) => {
      if (phase !== "coordination-release") return;
      releaseCalls += 1;
      if (releaseCalls === 1) throw new Error("interrupt fresh recovery lease release");
    });
    expect(await restarted.engine.recover(outcome.recovery)).toMatchObject({
      status: "indeterminate",
    });
    expect(await restarted.engine.recover(outcome.recovery)).toMatchObject({
      generation: 1,
      status: "committed",
    });
    expect(releaseCalls).toBe(2);
  });

  test("rolls forward a mixed replacement and deletion from exact old/new revisions", async () => {
    const roots = await workspace();
    const initial = await harness(roots);
    expect(await initial.engine.execute(createRequest())).toMatchObject({ status: "committed" });
    const loaded = await initial.store.load();
    if (!loaded.ok) throw new Error("expected initial graph");
    const shop = entityId(1);
    const orders = entityId(2);
    const shopDocument = loaded.value.documents.find((document) => document.entity.id === shop)!;
    const ordersDocument = loaded.value.documents.find(
      (document) => document.entity.id === orders,
    )!;

    let interruptedOnce = false;
    const interrupted = await harness(roots, (phase, targetIndex) => {
      if (!interruptedOnce && phase === "after-target" && targetIndex === 0) {
        interruptedOnce = true;
        throw new Error("interrupt between replacement and deletion");
      }
    });
    const outcome = await interrupted.engine.execute({
      affected: { entities: [shop, orders], relations: [relationId(1)] },
      context: {
        ownership: { owner: "curated", plane: "intent" },
        pinnedComponentIds: [],
      },
      expectedRevisions: [
        { expected: shopDocument.revision, resource: shopDocument.resource },
        { expected: ordersDocument.revision, resource: ordersDocument.resource },
      ],
      mutation: {
        components: [
          { id: shop, patch: { intent: "Updated after restart." }, type: "patch" },
          { id: orders, type: "remove" },
        ],
        relationships: [{ id: relationId(1), type: "remove" }],
      },
    });
    expect(outcome.status).toBe("indeterminate");
    if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");
    const restarted = await harness(roots);
    expect(await restarted.engine.recover(outcome.recovery)).toMatchObject({
      generation: 2,
      status: "committed",
    });
    const final = await restarted.store.load();
    if (!final.ok) throw new Error("expected final graph");
    expect(final.value.entities).toHaveLength(1);
    expect(final.value.entities[0]?.payload).toMatchObject({ intent: "Updated after restart." });
    expect(final.value.relations).toEqual([]);
  });

  for (const mode of ["retry-succeeds", "retry-remains-indeterminate"] as const) {
    test(`requires confirmed deletion durability when ${mode}`, async () => {
      const roots = await workspace();
      const initial = await harness(roots);
      expect(await initial.engine.execute(createRequest())).toMatchObject({ status: "committed" });
      const loaded = await initial.store.load();
      if (!loaded.ok) throw new Error("expected initial graph");
      const shop = entityId(1);
      const orders = entityId(2);
      const shopDocument = loaded.value.documents.find((document) => document.entity.id === shop)!;
      const ordersDocument = loaded.value.documents.find(
        (document) => document.entity.id === orders,
      )!;

      const base = await createLocalResourceProvider(roots);
      let forceIndeterminate = true;
      let removalCalls = 0;
      const resources = providerWithOverrides(base, {
        async removeResource(locator) {
          removalCalls += 1;
          const actual = await base.removeResource(locator);
          if (
            forceIndeterminate &&
            (mode === "retry-remains-indeterminate" || removalCalls === 1)
          ) {
            return Object.freeze({
              diagnostics: Object.freeze([
                {
                  code: "injected-removal-indeterminate",
                  message: "Injected deletion acknowledgement uncertainty",
                },
              ]),
              state: "committed-indeterminate" as const,
            });
          }
          return actual;
        },
      });
      const model = createStandardModelCapability();
      const store = createMarkdownIntentStore({ model, resources });
      const journal = createLocalTransactionJournal({
        adapter: createMarkdownIntentTransactionAdapter({ model, store }),
        resources,
      });
      const engine = engineFor(journal);
      const request = {
        affected: { entities: [shop, orders], relations: [relationId(1)] },
        context: {
          ownership: { owner: "curated", plane: "intent" },
          pinnedComponentIds: [],
        },
        expectedRevisions: [
          { expected: shopDocument.revision, resource: shopDocument.resource },
          { expected: ordersDocument.revision, resource: ordersDocument.resource },
        ],
        mutation: {
          components: [
            { id: shop, patch: { intent: `Deletion ${mode}.` }, type: "patch" },
            { id: orders, type: "remove" },
          ],
          relationships: [{ id: relationId(1), type: "remove" }],
        },
      } as const;
      const outcome = await engine.execute(request);
      expect(removalCalls).toBe(2);
      if (mode === "retry-succeeds") {
        expect(outcome).toMatchObject({ generation: 2, status: "committed" });
      } else {
        expect(outcome.status).toBe("indeterminate");
        if (outcome.status !== "indeterminate") throw new Error("expected recovery receipt");
        expect(
          JSON.parse(
            await readFile(
              path.join(roots.workspaceRoot, String(localTransactionStateLocator)),
              "utf8",
            ),
          ),
        ).toMatchObject({ generation: 2, phase: "committing" });
        forceIndeterminate = false;
        expect(await engine.recover(outcome.recovery)).toMatchObject({
          generation: 2,
          status: "committed",
        });
        expect(removalCalls).toBe(3);
      }
      const final = await store.load();
      if (!final.ok) throw new Error("expected final graph");
      expect(final.value.entities.map((entity) => entity.id)).toEqual([shop]);
      expect(final.value.relations).toEqual([]);
    });
  }

  test("a prepared transaction holds coordination until commit", async () => {
    const roots = await workspace();
    const first = await harness(roots);
    const second = await harness(roots);
    const request = createRequest();
    const proposal = {
      affected: request.affected,
      baseGeneration: 0,
      context: request.context,
      expectedRevisions: request.expectedRevisions,
      generation: 1,
      mutation: request.mutation,
      priorState: { components: [], relationships: [] },
    } as unknown as ProposedTransaction;
    const prepared = await first.provider.prepare(proposal);
    expect(prepared).toMatchObject({ status: "prepared" });
    if (prepared.status !== "prepared") throw new Error("expected prepared");
    expect(await second.provider.prepare(proposal)).toEqual({
      reason: "generation",
      status: "conflict",
    });
    expect(await second.provider.readProjectionCheckpoint()).toMatchObject({
      diagnostics: [{ code: "resource-coordination-contended" }],
      ok: false,
    });
    expect(await first.provider.commit(prepared.token)).toMatchObject({
      generation: 1,
      status: "committed",
    });
  });
});
