import { describe, expect, test } from "bun:test";

import { createEntityAliasResolver } from "../aliases.ts";
import { GraphKernel, type GraphSnapshot } from "../graph.ts";
import { createOpaqueIdSource, parseEntityId } from "../identity.ts";

function createKernel(maxPageSize = 3): GraphKernel {
  let value = 0;
  return new GraphKernel({
    idSource: createOpaqueIdSource(() => {
      value += 1;
      const bytes = new Uint8Array(16);
      bytes[15] = value;
      return bytes;
    }),
    maxPageSize,
  });
}

function addEntity(kernel: GraphKernel, snapshot: GraphSnapshot, kind: string, payload: unknown) {
  const result = kernel.addEntity(snapshot, { kind, payload });
  if (!result.ok) throw new Error(result.diagnostics[0]?.message);
  return result.value;
}

describe("graph kernel", () => {
  test("mints stable identity that survives rename and move payload changes", () => {
    const kernel = createKernel();
    const created = addEntity(kernel, kernel.empty(), "component", {
      name: "Ordering",
      path: "packages/ordering",
    });
    const updated = kernel.updateEntity(
      created.snapshot,
      { expectedKind: "component", id: created.entity.id },
      { name: "Order Management", path: "services/orders" },
    );

    expect(updated.ok).toBeTrue();
    if (!updated.ok) return;
    expect(updated.value.entity.id).toBe(created.entity.id);
    expect(updated.value.entity.payload).toEqual({
      name: "Order Management",
      path: "services/orders",
    });
  });

  test("creates and resolves typed relations only through exact identities", () => {
    const kernel = createKernel();
    const ordering = addEntity(kernel, kernel.empty(), "component", { name: "Ordering" });
    const payments = addEntity(kernel, ordering.snapshot, "component", { name: "Payments" });
    const relation = kernel.addRelation(payments.snapshot, {
      payload: { reason: "authorize payment" },
      source: { expectedKind: "component", id: ordering.entity.id },
      target: { expectedKind: "component", id: payments.entity.id },
      type: "requires",
    });

    expect(relation.ok).toBeTrue();
    if (!relation.ok) return;
    expect(kernel.resolveRelation(relation.value.snapshot, relation.value.relation.id)).toEqual({
      ok: true,
      value: relation.value.relation,
    });
  });

  test("copies and deeply freezes entity and relation draft payloads", () => {
    const kernel = createKernel();
    const entityDraft = { details: { labels: ["original"] } };
    const first = addEntity(kernel, kernel.empty(), "component", entityDraft);
    const second = addEntity(kernel, first.snapshot, "component", {});
    const relationDraft = { evidence: [{ source: "scanner" }] };
    const related = kernel.addRelation(second.snapshot, {
      payload: relationDraft,
      source: { id: first.entity.id },
      target: { id: second.entity.id },
      type: "observes",
    });
    if (!related.ok) throw new Error(related.diagnostics[0]?.message);

    entityDraft.details.labels.push("caller mutation");
    relationDraft.evidence[0]!.source = "caller mutation";

    expect(kernel.resolveEntity(related.value.snapshot, { id: first.entity.id })).toMatchObject({
      ok: true,
      value: { payload: { details: { labels: ["original"] } } },
    });
    expect(kernel.resolveRelation(related.value.snapshot, related.value.relation.id)).toMatchObject(
      {
        ok: true,
        value: { payload: { evidence: [{ source: "scanner" }] } },
      },
    );
    const entityPayload = first.entity.payload as unknown as {
      readonly details: { readonly labels: readonly string[] };
    };
    const relationPayload = related.value.relation.payload as unknown as {
      readonly evidence: readonly { readonly source: string }[];
    };
    expect(Object.isFrozen(entityPayload)).toBeTrue();
    expect(Object.isFrozen(entityPayload.details)).toBeTrue();
    expect(Object.isFrozen(entityPayload.details.labels)).toBeTrue();
    expect(Object.isFrozen(relationPayload.evidence[0]!)).toBeTrue();
  });

  test("returned payloads cannot mutate snapshots through resolve, page, or traversal", () => {
    const kernel = createKernel();
    const first = addEntity(kernel, kernel.empty(), "component", {
      details: { labels: ["stable"] },
    });
    const second = addEntity(kernel, first.snapshot, "component", {});
    const related = kernel.addRelation(second.snapshot, {
      payload: { reasons: ["stable"] },
      source: { id: first.entity.id },
      target: { id: second.entity.id },
      type: "requires",
    });
    if (!related.ok) throw new Error(related.diagnostics[0]?.message);

    const resolved = kernel.resolveEntity(related.value.snapshot, { id: first.entity.id });
    const entityPage = kernel.pageEntities(related.value.snapshot, { limit: 3 });
    const traversal = kernel.traverseRelations(related.value.snapshot, {
      direction: "outgoing",
      entity: { id: first.entity.id },
      limit: 3,
    });
    if (!resolved.ok || !entityPage.ok || !traversal.ok) throw new Error("expected graph reads");

    const resolvedPayload = resolved.value.payload as unknown as {
      details: { labels: string[] };
    };
    const pagedPayload = entityPage.value.items[0]!.payload as unknown as {
      details: { labels: string[] };
    };
    const traversedPayload = traversal.value.items[0]!.payload as unknown as {
      reasons: string[];
    };
    expect(() => resolvedPayload.details.labels.push("mutation")).toThrow();
    expect(() => {
      pagedPayload.details = { labels: ["mutation"] };
    }).toThrow();
    expect(() => traversedPayload.reasons.push("mutation")).toThrow();

    expect(kernel.resolveEntity(related.value.snapshot, { id: first.entity.id })).toMatchObject({
      ok: true,
      value: { payload: { details: { labels: ["stable"] } } },
    });
    expect(kernel.resolveRelation(related.value.snapshot, related.value.relation.id)).toMatchObject(
      {
        ok: true,
        value: { payload: { reasons: ["stable"] } },
      },
    );
  });

  test("keeps old and updated snapshots isolated from caller-owned payloads", () => {
    const kernel = createKernel();
    const originalDraft = { name: "Original", nested: { version: 1 } };
    const created = addEntity(kernel, kernel.empty(), "component", originalDraft);
    const updateDraft = { name: "Updated", nested: { version: 2 } };
    const updated = kernel.updateEntity(created.snapshot, { id: created.entity.id }, updateDraft);
    if (!updated.ok) throw new Error(updated.diagnostics[0]?.message);

    originalDraft.nested.version = 99;
    updateDraft.nested.version = 99;

    expect(kernel.resolveEntity(created.snapshot, { id: created.entity.id })).toMatchObject({
      ok: true,
      value: { payload: { name: "Original", nested: { version: 1 } } },
    });
    expect(kernel.resolveEntity(updated.value.snapshot, { id: created.entity.id })).toMatchObject({
      ok: true,
      value: { payload: { name: "Updated", nested: { version: 2 } } },
    });
  });

  test("copies loaded entity and relation payloads into an isolated snapshot", () => {
    const kernel = createKernel();
    const entityPayload = { labels: ["loaded"] };
    const relationPayload = { confidence: { value: 1 } };
    const loaded = kernel.load(
      [
        {
          id: "ent_00000000000000000000000000000001",
          kind: "component",
          payload: entityPayload,
        },
        {
          id: "ent_00000000000000000000000000000002",
          kind: "component",
          payload: {},
        },
      ],
      [
        {
          id: "rel_00000000000000000000000000000001",
          payload: relationPayload,
          source: { id: "ent_00000000000000000000000000000001" },
          target: { id: "ent_00000000000000000000000000000002" },
          type: "requires",
        },
      ],
    );
    if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.message);

    entityPayload.labels.push("caller mutation");
    relationPayload.confidence.value = 99;

    expect(
      kernel.resolveEntity(loaded.value, {
        id: "ent_00000000000000000000000000000001",
      }),
    ).toMatchObject({ ok: true, value: { payload: { labels: ["loaded"] } } });
    expect(
      kernel.resolveRelation(loaded.value, "rel_00000000000000000000000000000001"),
    ).toMatchObject({ ok: true, value: { payload: { confidence: { value: 1 } } } });
  });

  test("rejects unsupported or behavior-bearing payload shapes with diagnostics", () => {
    const kernel = createKernel();
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const sparse = new Array(2);
    sparse[1] = "value";
    const accessor = Object.defineProperty({}, "computed", {
      enumerable: true,
      get: () => "value",
    });
    class CustomArray extends Array<string> {}
    const arraySubclass = new CustomArray("value");
    const customPrototypeArray = ["value"];
    Object.setPrototypeOf(customPrototypeArray, null);

    for (const [payload, path] of [
      [{ nested: undefined }, "$.nested"],
      [{ nested: Number.NaN }, "$.nested"],
      [{ nested: new Date(0) }, "$.nested"],
      [cyclic, "$.self"],
      [sparse, "$[0]"],
      [accessor, "$.computed"],
      [{ nested: arraySubclass }, "$.nested"],
      [{ nested: customPrototypeArray }, "$.nested"],
    ] as const) {
      expect(kernel.addEntity(kernel.empty(), { kind: "component", payload })).toMatchObject({
        diagnostics: [{ code: "unsupported-payload", details: { path } }],
        ok: false,
      });
    }

    const first = addEntity(kernel, kernel.empty(), "component", {});
    expect(
      kernel.addRelation(first.snapshot, {
        payload: () => "behavior",
        source: { id: first.entity.id },
        target: { id: first.entity.id },
        type: "requires",
      }),
    ).toMatchObject({
      diagnostics: [{ code: "unsupported-payload", details: { owner: "relation", path: "$" } }],
      ok: false,
    });
    expect(
      kernel.updateEntity(first.snapshot, { id: first.entity.id }, { value: Infinity }),
    ).toMatchObject({
      diagnostics: [{ code: "unsupported-payload", details: { owner: "entity", path: "$.value" } }],
      ok: false,
    });
    expect(
      kernel.load(
        [
          {
            id: "ent_00000000000000000000000000000001",
            kind: "component",
            payload: { value: 1n },
          },
        ],
        [],
      ),
    ).toMatchObject({
      diagnostics: [{ code: "unsupported-payload", details: { owner: "entity", path: "$.value" } }],
      ok: false,
    });
  });

  test("fails closed for malformed, dangling, wrong-kind, and ambiguous references", () => {
    const kernel = createKernel();
    const group = addEntity(kernel, kernel.empty(), "group", { name: "Commerce" });

    expect(kernel.resolveEntity(group.snapshot, { id: "Commerce" })).toMatchObject({
      diagnostics: [{ code: "invalid-entity-id" }],
      ok: false,
    });
    expect(
      kernel.resolveEntity(group.snapshot, {
        id: "ent_ffffffffffffffffffffffffffffffff",
      }),
    ).toMatchObject({ diagnostics: [{ code: "unknown-entity" }], ok: false });
    expect(
      kernel.resolveEntity(group.snapshot, { expectedKind: "component", id: group.entity.id }),
    ).toMatchObject({ diagnostics: [{ code: "wrong-entity-kind" }], ok: false });
    expect(
      kernel.resolveEntity(group.snapshot, { expectedKind: "Component Name", id: group.entity.id }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-entity-kind" }], ok: false });
    expect(
      kernel.addRelation(group.snapshot, {
        payload: {},
        source: { id: group.entity.id },
        target: { id: "ent_ffffffffffffffffffffffffffffffff" },
        type: "contains",
      }),
    ).toMatchObject({ diagnostics: [{ code: "unknown-entity" }], ok: false });
    expect(
      kernel.addRelation(group.snapshot, {
        payload: {},
        source: { expectedKind: "component", id: group.entity.id },
        target: { id: group.entity.id },
        type: "contains",
      }),
    ).toMatchObject({ diagnostics: [{ code: "wrong-entity-kind" }], ok: false });
    expect(
      kernel.addRelation(group.snapshot, {
        payload: {},
        source: { id: group.entity.id },
        target: { id: group.entity.id },
        type: "Contains Group",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-relation-type" }], ok: false });

    const duplicate = kernel.load(
      [
        { id: group.entity.id, kind: "group", payload: {} },
        { id: group.entity.id, kind: "component", payload: {} },
      ],
      [],
    );
    expect(duplicate).toMatchObject({
      diagnostics: [{ code: "ambiguous-entity-identity" }],
      ok: false,
    });
  });

  test("orders loaded entities deterministically and exposes bounded pages only", () => {
    const kernel = createKernel(2);
    const loaded = kernel.load(
      [3, 1, 2].map((suffix) => ({
        id: `ent_0000000000000000000000000000000${suffix}`,
        kind: "component",
        payload: { suffix },
      })),
      [],
    );
    expect(loaded.ok).toBeTrue();
    if (!loaded.ok) return;

    const first = kernel.pageEntities(loaded.value, { limit: 2 });
    expect(first.ok).toBeTrue();
    if (!first.ok) return;
    expect(first.value.items.map((item) => item.payload)).toEqual([{ suffix: 1 }, { suffix: 2 }]);
    expect(first.value.hasMore).toBeTrue();

    const second = kernel.pageEntities(loaded.value, {
      ...(first.value.nextAfter === undefined ? {} : { after: first.value.nextAfter }),
      limit: 2,
    });
    expect(second).toMatchObject({
      ok: true,
      value: { hasMore: false, items: [{ payload: { suffix: 3 } }] },
    });
    expect(kernel.pageEntities(loaded.value, { limit: 0 })).toMatchObject({
      diagnostics: [{ code: "invalid-page-limit" }],
      ok: false,
    });
    expect(kernel.pageEntities(loaded.value, { limit: 3 })).toMatchObject({
      diagnostics: [{ code: "invalid-page-limit" }],
      ok: false,
    });
  });

  test("bounds incoming and outgoing traversal with deterministic relation order", () => {
    const kernel = createKernel(2);
    const center = addEntity(kernel, kernel.empty(), "component", {});
    const left = addEntity(kernel, center.snapshot, "component", {});
    const right = addEntity(kernel, left.snapshot, "component", {});
    const incoming = kernel.addRelation(right.snapshot, {
      payload: {},
      source: { id: left.entity.id },
      target: { id: center.entity.id },
      type: "informs",
    });
    if (!incoming.ok) throw new Error(incoming.diagnostics[0]?.message);
    const outgoing = kernel.addRelation(incoming.value.snapshot, {
      payload: {},
      source: { id: center.entity.id },
      target: { id: right.entity.id },
      type: "requires",
    });
    if (!outgoing.ok) throw new Error(outgoing.diagnostics[0]?.message);

    const page = kernel.traverseRelations(outgoing.value.snapshot, {
      direction: "both",
      entity: { id: center.entity.id },
      limit: 2,
    });
    expect(page.ok).toBeTrue();
    if (!page.ok) return;
    expect(page.value.items.map((item) => item.id)).toEqual(
      [incoming.value.relation.id, outgoing.value.relation.id].sort(),
    );
    expect(
      kernel.traverseRelations(outgoing.value.snapshot, {
        direction: "sideways" as "incoming",
        entity: { id: center.entity.id },
        limit: 1,
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-traversal-direction" }], ok: false });
  });

  test("resolves deterministic alias chains for entities and relationship endpoints", () => {
    const kernel = createKernel();
    const id = (value: number) => `ent_${value.toString(16).padStart(32, "0")}`;
    const relation = `rel_${"1".padStart(32, "0")}`;
    const loaded = kernel.load(
      [{ id: id(3), kind: "component", payload: { name: "Survivor" } }],
      [
        {
          id: relation,
          payload: {},
          source: { id: id(1) },
          target: { id: id(2) },
          type: "depends-on",
        },
      ],
      [
        { source: id(2), target: id(3) },
        { source: id(1), target: id(2) },
      ],
    );
    expect(loaded.ok).toBeTrue();
    if (!loaded.ok) return;
    expect(kernel.resolveEntityIdentity(loaded.value, id(1))).toMatchObject({
      ok: true,
      value: { chain: [id(2), id(3)], requested: id(1), resolved: id(3) },
    });
    expect(kernel.resolveEntity(loaded.value, { id: id(1) })).toMatchObject({
      ok: true,
      value: { id: id(3), payload: { name: "Survivor" } },
    });
    expect(kernel.resolveRelation(loaded.value, relation)).toMatchObject({
      ok: true,
      value: { source: id(3), target: id(3) },
    });
  });

  test("isolates alias resolution from caller-owned live identity sets", () => {
    const id = (value: number) => {
      const parsed = parseEntityId(`ent_${value.toString(16).padStart(32, "0")}`);
      if (!parsed.ok) throw new Error("invalid test identity");
      return parsed.value;
    };
    const live = new Set([id(2)]);
    const resolver = createEntityAliasResolver([{ source: id(1), target: id(2) }], live);
    expect(resolver.ok).toBeTrue();
    if (!resolver.ok) return;
    live.delete(id(2));
    live.add(id(1));
    expect(resolver.value.resolve(id(1))).toMatchObject({
      ok: true,
      value: { requested: id(1), resolved: id(2) },
    });
  });

  test("retries implicit identity minting when an alias source is reserved", () => {
    const id = (value: number) => `ent_${value.toString(16).padStart(32, "0")}`;
    let entityCalls = 0;
    const kernel = new GraphKernel({
      idSource: {
        nextEntityId: () => {
          entityCalls += 1;
          return entityCalls === 1 ? id(1) : id(3);
        },
        nextRelationId: () => `rel_${"1".padStart(32, "0")}`,
      },
      maxPageSize: 3,
    });
    const loaded = kernel.load(
      [{ id: id(2), kind: "component", payload: {} }],
      [],
      [{ source: id(1), target: id(2) }],
    );
    expect(loaded.ok).toBeTrue();
    if (!loaded.ok) return;
    expect(kernel.addEntity(loaded.value, { kind: "component", payload: {} })).toMatchObject({
      ok: true,
      value: { entity: { id: id(3) } },
    });
    expect(entityCalls).toBe(2);
  });

  test("fails closed for invalid and ambiguous alias graphs", () => {
    const kernel = createKernel();
    const id = (value: number) => `ent_${value.toString(16).padStart(32, "0")}`;
    const live = [{ id: id(3), kind: "component", payload: {} }];
    for (const [aliases, code] of [
      [[{ source: id(1), target: id(1) }], "self-component-alias"],
      [[{ source: id(1), target: id(4) }], "missing-component-alias-target"],
      [
        [
          { source: id(1), target: id(2) },
          { source: id(2), target: id(1) },
        ],
        "component-alias-cycle",
      ],
      [
        [
          { source: id(1), target: id(2) },
          { source: id(1), target: id(3) },
        ],
        "ambiguous-component-supersession",
      ],
      [[{ source: id(3), target: id(1) }], "ambiguous-component-supersession"],
    ] as const) {
      expect(kernel.load(live, [], aliases)).toMatchObject({
        diagnostics: [{ code }],
        ok: false,
      });
    }
  });

  test("loads a representative large graph as one validated snapshot", () => {
    const entityCount = 10_000;
    const id = (prefix: "ent" | "rel", value: number): string =>
      `${prefix}_${value.toString(16).padStart(32, "0")}`;
    const entities = Array.from({ length: entityCount }, (_, index) => ({
      id: id("ent", index + 1),
      kind: "component",
      payload: { index, tags: ["bulk", "fixture"] },
    }));
    const relations = Array.from({ length: entityCount - 1 }, (_, index) => ({
      id: id("rel", index + 1),
      payload: { index },
      source: { expectedKind: "component", id: id("ent", index + 1) },
      target: { expectedKind: "component", id: id("ent", index + 2) },
      type: "precedes",
    }));

    const kernel = createKernel(10);
    const loaded = kernel.load(entities, relations);
    expect(loaded.ok).toBeTrue();
    if (!loaded.ok) return;
    expect(loaded.value).toMatchObject({
      entityCount,
      relationCount: entityCount - 1,
    });
    expect(kernel.resolveEntity(loaded.value, { id: id("ent", entityCount) })).toMatchObject({
      ok: true,
      value: { payload: { index: entityCount - 1, tags: ["bulk", "fixture"] } },
    });
  });
});
