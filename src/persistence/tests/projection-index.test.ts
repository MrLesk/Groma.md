import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createGraphCommittedEvent,
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseRelationId,
  success,
  type EntityAlias,
  type GraphEntity,
  type GraphRelation,
  type ProjectionCanonicalSnapshot,
  type ProjectionCanonicalSource,
} from "../../core/index.ts";
import { createStandardModelCapability } from "../../standard-model/index.ts";
import {
  createLocalProjectionIndex,
  createLocalResourceProvider,
  createTransactionProjectionCanonicalSource,
  localProjectionIndexLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

const ids = {
  child: entity("2"),
  grandchild: entity("3"),
  obsolete: entity("4"),
  root: entity("1"),
  rootChild: relation("1"),
  rootGrandchild: relation("3"),
  childGrandchild: relation("2"),
};

function entity(hex: string) {
  const parsed = parseEntityId(`ent_${hex.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid entity fixture");
  return parsed.value;
}

function relation(hex: string) {
  const parsed = parseRelationId(`rel_${hex.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid relation fixture");
  return parsed.value;
}

function generation(value: number) {
  const parsed = parseGraphGeneration(value);
  if (!parsed.ok) throw new Error("invalid generation fixture");
  return parsed.value;
}

function component(
  id: ReturnType<typeof entity>,
  name: string,
  parent?: ReturnType<typeof entity>,
) {
  return Object.freeze({
    id,
    kind: "component",
    payload: Object.freeze({
      ...(parent === undefined ? {} : { parent }),
      name,
      type: parent === undefined ? "domain" : "component",
    }),
  }) satisfies GraphEntity;
}

function edge(
  id: ReturnType<typeof relation>,
  source: ReturnType<typeof entity>,
  target: ReturnType<typeof entity>,
  description: string,
) {
  return Object.freeze({
    id,
    payload: Object.freeze({ description }),
    source,
    target,
    type: "depends-on",
  }) satisfies GraphRelation;
}

function canonical(
  generationValue: number,
  options: {
    aliases?: readonly EntityAlias[];
    childName?: string;
    extraRelation?: boolean;
    rootName?: string;
  } = {},
): ProjectionCanonicalSnapshot {
  const entities = Object.freeze([
    component(ids.root, options.rootName ?? "Root domain"),
    component(ids.child, options.childName ?? "Child service", ids.root),
    component(ids.grandchild, "Grandchild worker", ids.child),
  ]);
  const relations = [
    edge(ids.rootChild, ids.root, ids.child, "Root calls child"),
    edge(ids.childGrandchild, ids.child, ids.grandchild, "Child emits work"),
  ];
  if (options.extraRelation === true) {
    relations.push(edge(ids.rootGrandchild, ids.root, ids.grandchild, "Root monitors grandchild"));
  }
  return Object.freeze({
    aliases: options.aliases ?? Object.freeze([]),
    entities,
    generation: generation(generationValue),
    relations: Object.freeze(relations.sort((left, right) => (left.id < right.id ? -1 : 1))),
  });
}

class MutableCanonicalSource implements ProjectionCanonicalSource {
  calls = 0;
  value: ProjectionCanonicalSnapshot;

  constructor(value: ProjectionCanonicalSnapshot) {
    this.value = value;
  }

  async snapshot() {
    this.calls += 1;
    return success(this.value);
  }
}

async function temporaryProvider(options: { failProjectionWrites?: boolean } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "groma-projection-"));
  roots.push(root);
  const resources = await createLocalResourceProvider({
    faultInjector: (phase, context) => {
      if (
        options.failProjectionWrites === true &&
        phase === "write" &&
        context?.locator === ".groma-cache/projection-index.json"
      ) {
        throw new Error("injected projection publication failure");
      }
    },
    workspaceRoot: root,
  });
  return { resources, root };
}

async function replace(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  bytes: Uint8Array,
) {
  const staged = await resources.stageReplacement(locator, bytes);
  if (!staged.ok) throw new Error("fixture replacement could not stage");
  const committed = await resources.commitReplacement(staged.value);
  if (committed.state !== "committed") throw new Error("fixture replacement could not commit");
}

describe("projection fingerprint contract", () => {
  test("keeps provider syntax opaque while enforcing one primitive bound", () => {
    expect(parseProjectionCanonicalFingerprint("provider-v2:opaque-content-id").ok).toBeTrue();
    expect(parseProjectionCanonicalFingerprint("").ok).toBeFalse();
    expect(parseProjectionCanonicalFingerprint("x".repeat(129)).ok).toBeFalse();
    expect(parseProjectionCanonicalFingerprint({ toString: () => "fingerprint" }).ok).toBeFalse();
  });
});

describe("local projection index", () => {
  test("rebuilds deterministically and applies a contiguous recursive graph event equivalently", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({ canonical: source, resources });

    const first = await index.rebuild();
    const firstBytes = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    const repeated = await index.rebuild();
    const repeatedBytes = await readFile(path.join(root, ".groma-cache", "projection-index.json"));

    expect(first.ok).toBeTrue();
    expect(repeated).toEqual(first);
    expect(repeatedBytes).toEqual(firstBytes);

    source.value = canonical(2, {
      aliases: Object.freeze([{ source: ids.obsolete, target: ids.child }]),
      childName: "Renamed child service",
      extraRelation: true,
    });
    const event = createGraphCommittedEvent(2, {
      entities: [ids.child],
      relations: [ids.rootGrandchild],
    });
    if (!event.ok) throw new Error("invalid committed event fixture");
    const incrementallyUpdated = await index.update(event.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();
    const incrementalBytes = await readFile(
      path.join(root, ".groma-cache", "projection-index.json"),
    );
    const rebuiltBytes = await readFile(
      path.join(fresh.root, ".groma-cache", "projection-index.json"),
    );

    expect(incrementallyUpdated).toEqual(rebuilt);
    expect(incrementalBytes).toEqual(rebuiltBytes);
    expect(incrementallyUpdated.ok && Number(incrementallyUpdated.value.generation)).toBe(2);
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.entities.find((item) => item.entity.id === ids.child)
          ?.searchableText,
    ).toContain("renamed child service");
    expect(incrementallyUpdated.ok && incrementallyUpdated.value.aliases).toEqual([
      { source: ids.obsolete, target: ids.child },
    ]);
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.adjacency.find((item) => item.entity === ids.root)?.outgoing,
    ).toEqual([ids.rootChild, ids.rootGrandchild]);
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.adjacency.find((item) => item.entity === ids.grandchild)
          ?.incoming,
    ).toEqual([ids.childGrandchild, ids.rootGrandchild]);
  });

  test("rebuilds absent, corrupt, stale, deleted, and missed-generation indexes without canonical writes", async () => {
    const { resources } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({ canonical: source, resources });
    const canonicalLocator = workspaceResourceLocator("groma", "intent", "canonical.md");
    if (!canonicalLocator.ok) throw new Error("invalid canonical fixture locator");
    const canonicalBytes = new TextEncoder().encode("canonical intent bytes\n");
    await replace(resources, canonicalLocator.value, canonicalBytes);

    expect((await index.load()).ok).toBeTrue();
    const projectionLocator = localProjectionIndexLocator();
    if (!projectionLocator.ok) throw new Error("invalid projection locator");
    await replace(resources, projectionLocator.value, new TextEncoder().encode("{corrupt\n"));
    source.value = canonical(2, { childName: "After corruption" });
    const repaired = await index.load();
    expect(repaired.ok && Number(repaired.value.generation)).toBe(2);

    source.value = canonical(4, { childName: "After event gap", extraRelation: true });
    const missed = createGraphCommittedEvent(4, {
      entities: [ids.child],
      relations: [ids.rootGrandchild],
    });
    if (!missed.ok) throw new Error("invalid missed event fixture");
    expect((await index.update(missed.value)).ok).toBeTrue();
    const afterGap = await index.load();
    expect(afterGap.ok && Number(afterGap.value.generation)).toBe(4);

    expect((await resources.removeResource(projectionLocator.value)).state).toBe("committed");
    expect((await index.load()).ok).toBeTrue();
    expect(
      await resources.read({
        locator: canonicalLocator.value,
        maxBytes: canonicalBytes.byteLength,
      }),
    ).toEqual({ ok: true, value: { bytes: canonicalBytes } });
  });

  test("rejects same-generation cache content from another canonical history before load or update", async () => {
    const staleLoad = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(5, { rootName: "Branch A root" }));
    const index = createLocalProjectionIndex({ canonical: source, resources: staleLoad.resources });
    const branchA = await index.rebuild();
    expect(branchA.ok).toBeTrue();
    const branchAFingerprint = branchA.ok ? branchA.value.fingerprint : undefined;
    expect(branchAFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);

    source.value = canonical(5, { rootName: "Branch B root" });
    const loaded = await index.load();
    expect(loaded.ok).toBeTrue();
    expect(loaded.ok && loaded.value.fingerprint).not.toBe(branchAFingerprint);
    expect(
      loaded.ok &&
        loaded.value.entities.find((item) => item.entity.id === ids.root)?.searchableText,
    ).toContain("branch b root");
    source.value = canonical(6, { rootName: "Branch B root" });
    const generationOnly = await index.rebuild();
    expect(
      generationOnly.ok &&
        loaded.ok &&
        generationOnly.value.fingerprint === loaded.value.fingerprint,
    ).toBeTrue();

    const staleUpdate = await temporaryProvider();
    source.value = canonical(5, { rootName: "Branch A root" });
    const updateIndex = createLocalProjectionIndex({
      canonical: source,
      resources: staleUpdate.resources,
    });
    expect((await updateIndex.rebuild()).ok).toBeTrue();
    source.value = canonical(6, {
      childName: "Branch B changed child",
      rootName: "Branch B root",
    });
    const event = createGraphCommittedEvent(6, { entities: [ids.child], relations: [] });
    if (!event.ok) throw new Error("invalid same-generation history event fixture");
    const updated = await updateIndex.update(event.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();
    expect(updated).toEqual(rebuilt);
    expect(
      updated.ok &&
        updated.value.entities.find((item) => item.entity.id === ids.root)?.searchableText,
    ).toContain("branch b root");
    expect(
      await readFile(path.join(staleUpdate.root, ".groma-cache", "projection-index.json")),
    ).toEqual(await readFile(path.join(fresh.root, ".groma-cache", "projection-index.json")));
  });

  test("replaces an oversized disposable index without changing canonical bytes", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({
      bounds: { maxBytes: 4_096 },
      canonical: source,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const projectionLocator = localProjectionIndexLocator();
    const canonicalLocator = workspaceResourceLocator("groma", "intent", "canonical.md");
    if (!projectionLocator.ok || !canonicalLocator.ok) throw new Error("invalid locator fixture");
    const canonicalBytes = new TextEncoder().encode("canonical intent remains exact\n");
    await replace(resources, canonicalLocator.value, canonicalBytes);
    await replace(resources, projectionLocator.value, new Uint8Array(4_097));

    const repaired = await index.load();

    expect(repaired.ok).toBeTrue();
    expect(
      await resources.read({ locator: projectionLocator.value, maxBytes: 4_096 }),
    ).toMatchObject({ ok: true });
    expect(
      await resources.read({
        locator: canonicalLocator.value,
        maxBytes: canonicalBytes.byteLength,
      }),
    ).toEqual({ ok: true, value: { bytes: canonicalBytes } });
  });

  test("refreshes alias-resolved endpoints for byte-unchanged incoming relationships", async () => {
    const first = await temporaryProvider();
    const before: ProjectionCanonicalSnapshot = Object.freeze({
      aliases: Object.freeze([]),
      entities: Object.freeze([
        component(ids.root, "Root"),
        component(ids.child, "Survivor"),
        component(ids.obsolete, "Obsolete"),
      ]),
      generation: generation(1),
      relations: Object.freeze([
        edge(ids.rootChild, ids.root, ids.obsolete, "Incoming relation remains byte-unchanged"),
      ]),
    });
    const source = new MutableCanonicalSource(before);
    const index = createLocalProjectionIndex({ canonical: source, resources: first.resources });
    expect((await index.rebuild()).ok).toBeTrue();

    source.value = Object.freeze({
      aliases: Object.freeze([{ source: ids.obsolete, target: ids.child }]),
      entities: Object.freeze([component(ids.root, "Root"), component(ids.child, "Survivor")]),
      generation: generation(2),
      // The canonical owning document still names the obsolete target. Alias resolution
      // changes its projection without making the relationship an affected write.
      relations: before.relations,
    });
    const merged = createGraphCommittedEvent(2, {
      entities: [ids.child, ids.obsolete],
      relations: [],
    });
    if (!merged.ok) throw new Error("invalid merge event fixture");
    const incrementallyUpdated = await index.update(merged.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();

    expect(incrementallyUpdated).toEqual(rebuilt);
    expect(incrementallyUpdated.ok && incrementallyUpdated.value.relations[0]?.target).toBe(
      ids.child,
    );
    expect(
      incrementallyUpdated.ok &&
        incrementallyUpdated.value.adjacency.find((item) => item.entity === ids.child)?.incoming,
    ).toEqual([ids.rootChild]);
  });

  test("refreshes alias-resolved containment for a byte-unchanged child", async () => {
    const model = createStandardModelCapability();
    let currentGeneration = 1;
    let state = {
      aliases: [] as readonly EntityAlias[],
      components: [
        component(ids.root, "Root"),
        component(ids.child, "Child", ids.obsolete),
        component(ids.obsolete, "Obsolete parent"),
      ],
      relationships: [] as readonly GraphRelation[],
    };
    const source = createTransactionProjectionCanonicalSource({
      model,
      transactionProvider: {
        snapshot: async () => ({
          generation: currentGeneration,
          revisions: [],
          state,
        }),
      },
    });
    const incremental = await temporaryProvider();
    const index = createLocalProjectionIndex({
      canonical: source,
      resources: incremental.resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();

    currentGeneration = 2;
    state = {
      aliases: [{ source: ids.obsolete, target: ids.root }],
      // The owning component remains byte-unchanged and still names the merged identity.
      components: [component(ids.root, "Root"), component(ids.child, "Child", ids.obsolete)],
      relationships: [],
    };
    const merged = createGraphCommittedEvent(2, {
      entities: [ids.root, ids.obsolete],
      relations: [],
    });
    if (!merged.ok) throw new Error("invalid containment merge event fixture");
    const updated = await index.update(merged.value);

    const fresh = await temporaryProvider();
    const rebuilt = await createLocalProjectionIndex({
      canonical: source,
      resources: fresh.resources,
    }).rebuild();
    const updatedBytes = await readFile(
      path.join(incremental.root, ".groma-cache", "projection-index.json"),
    );
    const rebuiltBytes = await readFile(
      path.join(fresh.root, ".groma-cache", "projection-index.json"),
    );
    const child = updated.ok
      ? updated.value.entities.find((item) => item.entity.id === ids.child)
      : undefined;

    expect(updated).toEqual(rebuilt);
    expect(updatedBytes).toEqual(rebuiltBytes);
    expect(child?.entity.payload).toMatchObject({ parent: ids.root });
    expect(child?.searchableText).toContain(ids.root);
    expect(child?.searchableText).not.toContain(ids.obsolete);
  });

  test("rejects malformed committed events before canonical reads or projection writes", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({
      bounds: { maxEntities: 3, maxRelations: 2 },
      canonical: source,
      resources,
    });
    expect((await index.rebuild()).ok).toBeTrue();
    const before = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    const callsBefore = source.calls;
    source.value = canonical(2, { childName: "Must not be observed" });
    const malformed: readonly unknown[] = [
      null,
      { affected: { entities: [], relations: [] }, generation: 2, type: "other" },
      { generation: 2, type: "graph.committed" },
      {
        affected: { entities: [], relations: [] },
        extra: true,
        generation: 2,
        type: "graph.committed",
      },
      {
        affected: { entities: [ids.child, ids.root], relations: [] },
        generation: 2,
        type: "graph.committed",
      },
      {
        affected: { entities: [ids.root, ids.root], relations: [] },
        generation: 2,
        type: "graph.committed",
      },
    ];

    for (const candidate of malformed) {
      expect(await index.update(candidate as never)).toEqual({
        diagnostics: [
          {
            code: "projection-index-unavailable",
            details: { reason: "committed-event-malformed" },
            message:
              "The disposable projection index is unavailable; retry or delete it to rebuild",
          },
        ],
        ok: false,
      });
    }

    const overBound: readonly unknown[] = [
      {
        affected: {
          entities: [ids.root, ids.child, ids.grandchild, ids.obsolete],
          relations: [],
        },
        generation: 2,
        type: "graph.committed",
      },
      {
        affected: {
          entities: [],
          relations: [ids.rootChild, ids.childGrandchild, ids.rootChild],
        },
        generation: 2,
        type: "graph.committed",
      },
    ];
    for (const candidate of overBound) {
      expect(await index.update(candidate as never)).toMatchObject({
        diagnostics: [
          {
            code: "projection-index-unavailable",
            details: { reason: "committed-event-bound-exceeded" },
          },
        ],
        ok: false,
      });
    }

    expect(source.calls).toBe(callsBefore);
    expect(await readFile(path.join(root, ".groma-cache", "projection-index.json"))).toEqual(
      before,
    );
  });

  test("serializes deterministically despite inherited toJSON pollution", async () => {
    const { resources, root } = await temporaryProvider();
    const source = new MutableCanonicalSource(canonical(1));
    const index = createLocalProjectionIndex({ canonical: source, resources });
    expect((await index.rebuild()).ok).toBeTrue();
    const baseline = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    const original = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    let rebuilt: Awaited<ReturnType<typeof index.rebuild>> | undefined;
    let pollutedBytes: Uint8Array | undefined;
    try {
      Object.defineProperty(Object.prototype, "toJSON", {
        configurable: true,
        value: () => ({ polluted: true }),
      });
      rebuilt = await index.rebuild();
      pollutedBytes = await readFile(path.join(root, ".groma-cache", "projection-index.json"));
    } finally {
      if (original === undefined) delete (Object.prototype as { toJSON?: unknown }).toJSON;
      else Object.defineProperty(Object.prototype, "toJSON", original);
    }

    expect(rebuilt?.ok).toBeTrue();
    expect(pollutedBytes).toEqual(baseline);
    expect((await index.load()).ok).toBeTrue();
  });

  test("fails closed at search and UTF-8 byte bounds before publishing cache artifacts", async () => {
    const search = await temporaryProvider();
    const searchIndex = createLocalProjectionIndex({
      bounds: { maxSearchableTextCharacters: 48 },
      canonical: new MutableCanonicalSource(canonical(1)),
      resources: search.resources,
    });
    expect(await searchIndex.rebuild()).toMatchObject({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "projection-searchable-text-bound-exceeded" },
        },
      ],
      ok: false,
    });
    await expect(readFile(path.join(search.root, ".groma-cache", ".gitignore"))).rejects.toThrow();

    const bytes = await temporaryProvider();
    const unicode: ProjectionCanonicalSnapshot = Object.freeze({
      aliases: Object.freeze([]),
      entities: Object.freeze([component(ids.root, `Root ${"é".repeat(100)}`)]),
      generation: generation(1),
      relations: Object.freeze([]),
    });
    const byteIndex = createLocalProjectionIndex({
      bounds: { maxBytes: 600 },
      canonical: new MutableCanonicalSource(unicode),
      resources: bytes.resources,
    });
    expect(await byteIndex.rebuild()).toMatchObject({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "projection-byte-bound-exceeded" },
        },
      ],
      ok: false,
    });
    await expect(readFile(path.join(bytes.root, ".groma-cache", ".gitignore"))).rejects.toThrow();
  });

  test("keeps its provider-owned cache invisible to Git without project ignore rules", async () => {
    const { resources, root } = await temporaryProvider();
    const initialized = Bun.spawn(["git", "init", "--quiet"], {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(await initialized.exited).toBe(0);
    const index = createLocalProjectionIndex({
      canonical: new MutableCanonicalSource(canonical(1)),
      resources,
    });

    expect((await index.rebuild()).ok).toBeTrue();
    expect(await readFile(path.join(root, ".groma-cache", ".gitignore"), "utf8")).toBe("*\n");
    const ignoreLocator = workspaceResourceLocator(".groma-cache", ".gitignore");
    if (!ignoreLocator.ok) throw new Error("invalid projection ignore fixture locator");
    expect((await resources.removeResource(ignoreLocator.value)).state).toBe("committed");
    expect((await index.load()).ok).toBeTrue();
    expect(await readFile(path.join(root, ".groma-cache", ".gitignore"), "utf8")).toBe("*\n");
    await replace(resources, ignoreLocator.value, new TextEncoder().encode("x\n"));
    expect((await index.load()).ok).toBeTrue();
    expect(await readFile(path.join(root, ".groma-cache", ".gitignore"), "utf8")).toBe("*\n");
    const status = Bun.spawn(["git", "status", "--porcelain", "--untracked-files=all"], {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    });
    const output = await new Response(status.stdout).text();
    expect(await status.exited).toBe(0);
    expect(output).toBe("");
  });

  test("returns one stable actionable diagnostic when canonical state or publication is unavailable", async () => {
    const healthy = await temporaryProvider();
    const unavailableSource: ProjectionCanonicalSource = {
      snapshot: async () => failure({ code: "private-source-error", message: "/private/path" }),
    };
    expect(
      await createLocalProjectionIndex({
        canonical: unavailableSource,
        resources: healthy.resources,
      }).load(),
    ).toEqual({
      diagnostics: [
        {
          code: "projection-index-unavailable",
          details: { reason: "canonical-snapshot-failed" },
          message: "The disposable projection index is unavailable; retry or delete it to rebuild",
        },
      ],
      ok: false,
    });

    const failing = await temporaryProvider({ failProjectionWrites: true });
    const source = new MutableCanonicalSource(canonical(1));
    expect(
      await createLocalProjectionIndex({ canonical: source, resources: failing.resources }).load(),
    ).toMatchObject({
      diagnostics: [{ code: "projection-index-unavailable" }],
      ok: false,
    });
  });

  test("adapts one transaction snapshot generation and resolves aliased relation endpoints", async () => {
    const model = createStandardModelCapability();
    const source = createTransactionProjectionCanonicalSource({
      model,
      transactionProvider: {
        snapshot: async (resources) => ({
          generation: 7,
          revisions: [],
          state: {
            aliases: [{ source: ids.obsolete, target: ids.child }],
            components: [component(ids.root, "Root"), component(ids.child, "Child", ids.root)],
            relationships: [
              edge(ids.rootChild, ids.root, ids.obsolete, "Targets the obsolete identity"),
            ],
          },
        }),
      },
    });

    const result = await source.snapshot();

    expect(result.ok && Number(result.value.generation)).toBe(7);
    expect(result.ok && result.value.relations[0]?.target).toBe(ids.child);
    expect(result.ok && result.value.aliases).toEqual([
      { source: ids.obsolete, target: ids.child },
    ]);
  });
});
