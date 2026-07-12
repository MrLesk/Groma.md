import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  TransactionEngine,
  parseEntityId,
  parseRelationId,
  parseResourceKey,
  type ProposedTransaction,
  type ResourceKey,
} from "../../core/index.ts";
import {
  createStandardModelCapability,
  createStandardModelInvariant,
} from "../../standard-model/index.ts";
import {
  createLocalResourceProvider,
  createLocalTransactionJournal,
  createMarkdownIntentStore,
  createMarkdownIntentTransactionAdapter,
  localTransactionStateLocator,
  markdownIntentLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type LocalResourceFaultPhase,
  type LocalTransactionFaultPhase,
  type WorkspaceResourceLocator,
} from "../index.ts";

const roots: string[] = [];
const decoder = new TextDecoder();

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
  resourceFaultInjector?: (phase: LocalResourceFaultPhase) => void,
) {
  const resources = await createLocalResourceProvider({
    ...roots,
    ...(resourceFaultInjector === undefined ? {} : { faultInjector: resourceFaultInjector }),
    staleLockMilliseconds: 1,
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

  test("rejects optimistic races and preserves a projection watermark through settlement", async () => {
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
      projectionWatermark: number;
    };
    expect(state.projectionWatermark).toBe(0);
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
  });

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
    const restarted = await harness(roots);
    expect(await restarted.engine.recover(outcome.recovery)).toMatchObject({
      generation: 1,
      status: "committed",
    });
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
    expect(await first.provider.commit(prepared.token)).toMatchObject({
      generation: 1,
      status: "committed",
    });
  });
});
