import { describe, expect, test } from "bun:test";

import { GraphKernel, type GraphSnapshot } from "./graph.ts";
import { createOpaqueIdSource } from "./identity.ts";

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
});
