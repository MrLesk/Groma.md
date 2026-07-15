import { describe, expect, test } from "bun:test";

import {
  createOpaqueIdSource,
  GraphKernel,
  parseRelationId,
  type GraphEntity,
  type GraphSnapshot,
  type RelationId,
} from "../../core/index.ts";
import {
  createStandardModelCapability,
  STANDARD_COMPONENT_LABEL_MAX_CODE_POINTS,
  STANDARD_COMPONENT_KIND,
  STANDARD_MODEL_CAPABILITY_ID,
  STANDARD_COMPONENT_SUMMARY_MAX_CODE_POINTS,
  standardComponentDisplayText,
  type StandardComponent,
  type StandardComponentInput,
} from "../index.ts";

const componentId = (value: number) => `ent_${value.toString(16).padStart(32, "0")}`;
function relationshipId(value: number): RelationId {
  const parsed = parseRelationId(`rel_${value.toString(16).padStart(32, "0")}`);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
  return parsed.value;
}

function createKernel(maxPageSize = 100): GraphKernel {
  let value = 100;
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

function addComponent(
  kernel: GraphKernel,
  snapshot: GraphSnapshot,
  input: StandardComponentInput,
): { readonly entity: GraphEntity; readonly snapshot: GraphSnapshot } {
  const model = createStandardModelCapability();
  const draft = model.normalize(input);
  if (!draft.ok) throw new Error(draft.diagnostics[0]?.message);
  const added = kernel.addEntity(snapshot, draft.value);
  if (!added.ok) throw new Error(added.diagnostics[0]?.message);
  return added.value;
}

function pageComponents(kernel: GraphKernel, snapshot: GraphSnapshot): readonly GraphEntity[] {
  const page = kernel.pageEntities(snapshot, { kind: STANDARD_COMPONENT_KIND, limit: 100 });
  if (!page.ok) throw new Error(page.diagnostics[0]?.message);
  return page.value.items;
}

describe("standard v0.1 model", () => {
  test("is an explicit capability and accepts a sparse root component", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const normalized = model.normalize({});

    expect(model.id).toBe(STANDARD_MODEL_CAPABILITY_ID);
    expect(normalized).toEqual({ ok: true, value: { kind: "component", payload: {} } });
    if (!normalized.ok) return;
    const added = kernel.addEntity(kernel.empty(), normalized.value);
    if (!added.ok) throw new Error(added.diagnostics[0]?.message);
    const parsed = model.parse(added.value.entity);

    expect(parsed).toMatchObject({
      ok: true,
      value: { extensions: {}, id: added.value.entity.id, kind: "component" },
    });
    if (!parsed.ok) return;
    expect("parent" in parsed.value).toBeFalse();
    expect("inputs" in parsed.value).toBeFalse();
    expect("lifecycle" in parsed.value).toBeFalse();
  });

  test("derives deterministic recursive same-type and mixed-type child views", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const shop = addComponent(kernel, kernel.empty(), {
      id: componentId(1),
      name: "Shop",
      type: "domain",
    });
    const users = addComponent(kernel, shop.snapshot, {
      id: componentId(2),
      name: "Users",
      type: "domain",
    });
    const cart = addComponent(kernel, users.snapshot, {
      id: componentId(6),
      name: "Cart",
      parent: componentId(1),
      type: "component",
    });
    const orders = addComponent(kernel, cart.snapshot, {
      id: componentId(4),
      name: "Orders",
      parent: componentId(1),
      type: "component",
    });
    const orderItem = addComponent(kernel, orders.snapshot, {
      id: componentId(5),
      name: "OrderItem",
      parent: componentId(4),
      type: "component",
    });
    const authentication = addComponent(kernel, orderItem.snapshot, {
      id: componentId(8),
      name: "Authentication",
      parent: componentId(2),
      type: "service",
    });
    const login = addComponent(kernel, authentication.snapshot, {
      id: componentId(7),
      name: "Login",
      parent: componentId(8),
      type: "service",
    });
    const googleLogin = addComponent(kernel, login.snapshot, {
      id: componentId(3),
      name: "GoogleLogin",
      parent: componentId(7),
      type: "adapter",
    });
    const entities = pageComponents(kernel, googleLogin.snapshot).toReversed();

    const roots = model.children(entities);
    const shopChildren = model.children(entities, componentId(1));
    const orderChildren = model.children(entities, componentId(4));
    const authenticationChildren = model.children(entities, componentId(8));
    const loginChildren = model.children(entities, componentId(7));

    expect(roots.ok && roots.value.map((item) => item.name)).toEqual(["Shop", "Users"]);
    expect(shopChildren.ok && shopChildren.value.map((item) => item.name)).toEqual([
      "Orders",
      "Cart",
    ]);
    expect(orderChildren.ok && orderChildren.value.map((item) => item.name)).toEqual(["OrderItem"]);
    expect(
      authenticationChildren.ok && authenticationChildren.value.map((item) => item.type),
    ).toEqual(["service"]);
    expect(loginChildren.ok && loginChildren.value.map((item) => item.type)).toEqual(["adapter"]);
  });

  test("normalizes the full Ordering example and stable embedded item identities", () => {
    const model = createStandardModelCapability();
    const ordering = model.normalize({
      id: componentId(20),
      name: "Ordering",
      type: "service",
      parent: componentId(10),
      desired: "present",
      lifecycle: "active",
      intent: "Own the durable order and its business lifecycle.",
      inputs: [
        {
          id: "inp_place_order",
          name: "Place order request",
          description: "A customer's confirmed intent to purchase.",
        },
        { id: "inp_cancel_order", name: "Cancel order request" },
      ],
      outputs: [
        { id: "out_order_status", name: "Order status changed" },
        { id: "out_order_placed", name: "Order placed" },
      ],
      actions: [
        { id: "act_update_progress", name: "Update order progress" },
        { id: "act_place_order", name: "Place order" },
        { id: "act_cancel_order", name: "Cancel order" },
      ],
    });
    if (!ordering.ok) throw new Error(ordering.diagnostics[0]?.message);
    const kernel = createKernel();
    const commerce = addComponent(kernel, kernel.empty(), {
      id: componentId(10),
      name: "Commerce",
      type: "domain",
    });
    const added = kernel.addEntity(commerce.snapshot, ordering.value);
    if (!added.ok) throw new Error(added.diagnostics[0]?.message);
    const parsed = model.parse(added.value.entity);
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);

    expect(parsed.value).toMatchObject({
      actions: [
        { id: "act_cancel_order" },
        { id: "act_place_order" },
        { id: "act_update_progress" },
      ],
      desired: "present",
      lifecycle: "active",
      name: "Ordering",
      parent: componentId(10),
      type: "service",
    });
    expect(parsed.value.inputs?.map((item) => item.id)).toEqual([
      "inp_cancel_order",
      "inp_place_order",
    ]);
    expect(parsed.value.outputs?.map((item) => item.id)).toEqual([
      "out_order_placed",
      "out_order_status",
    ]);
  });

  test("preserves bounded recognition metadata and derives one-component display text", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const normalized = model.normalize({
      iconDomain: "xn--bcher-kva.example",
      id: componentId(20),
      label: "Orders",
      name: "Order Management",
      summary: "Owns the durable order lifecycle.",
      type: "external",
    });
    if (!normalized.ok) throw new Error(normalized.diagnostics[0]?.message);
    const added = kernel.addEntity(kernel.empty(), normalized.value);
    if (!added.ok) throw new Error(added.diagnostics[0]?.message);
    const parsed = model.parse(added.value.entity);
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);

    expect(parsed.value).toMatchObject({
      iconDomain: "xn--bcher-kva.example",
      label: "Orders",
      name: "Order Management",
      summary: "Owns the durable order lifecycle.",
      type: "external",
    });
    expect(model.serialize(parsed.value)).toEqual(normalized);
    expect(standardComponentDisplayText(parsed.value)).toBe("Orders");
    expect(standardComponentDisplayText({ id: parsed.value.id, name: "Order Management" })).toBe(
      "Order Management",
    );
    expect(standardComponentDisplayText({ id: parsed.value.id })).toBe(parsed.value.id);

    const cleared = model.patch(added.value.entity, {
      iconDomain: null,
      label: null,
      summary: null,
    });
    if (!cleared.ok) throw new Error(cleared.diagnostics[0]?.message);
    expect(cleared.value.payload).toEqual({ name: "Order Management", type: "external" });
  });

  test("rejects non-canonical recognition metadata without rewriting it", () => {
    const model = createStandardModelCapability();
    const malformed = [
      [{ label: "" }, "invalid-component-label"],
      [{ label: " padded" }, "invalid-component-label"],
      [{ label: "two\nlines" }, "invalid-component-label"],
      [{ label: `bad${String.fromCharCode(0xd800)}` }, "invalid-component-label"],
      [
        { label: "🙂".repeat(STANDARD_COMPONENT_LABEL_MAX_CODE_POINTS + 1) },
        "invalid-component-label",
      ],
      [{ summary: "" }, "invalid-component-summary"],
      [{ summary: "two\u2028lines" }, "invalid-component-summary"],
      [
        { summary: "s".repeat(STANDARD_COMPONENT_SUMMARY_MAX_CODE_POINTS + 1) },
        "invalid-component-summary",
      ],
      [{ iconDomain: "example.com." }, "invalid-component-icon-domain"],
      [{ iconDomain: "Example.com" }, "invalid-component-icon-domain"],
      [{ iconDomain: "https://example.com" }, "invalid-component-icon-domain"],
      [{ iconDomain: "example.com:443" }, "invalid-component-icon-domain"],
      [{ iconDomain: "example.com/icon.png" }, "invalid-component-icon-domain"],
      [{ iconDomain: "localhost" }, "invalid-component-icon-domain"],
      [{ iconDomain: "127.0.0.1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "127.1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "127.0.1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "0x7f.1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "0177.1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "123.456" }, "invalid-component-icon-domain"],
      [{ iconDomain: "127.0x1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "0x7f.0.0x0.1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "0x.1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "0x.0x1" }, "invalid-component-icon-domain"],
      [{ iconDomain: "1.0x" }, "invalid-component-icon-domain"],
      [{ iconDomain: `${"a".repeat(64)}.example` }, "invalid-component-icon-domain"],
      [{ iconDomain: "-bad.example" }, "invalid-component-icon-domain"],
    ] as const;

    for (const [input, code] of malformed) {
      expect(model.normalize(input)).toMatchObject({ diagnostics: [{ code }], ok: false });
    }
    expect(
      model.normalize({
        iconDomain: "example.com",
        label: "L".repeat(STANDARD_COMPONENT_LABEL_MAX_CODE_POINTS),
        summary: "S".repeat(STANDARD_COMPONENT_SUMMARY_MAX_CODE_POINTS),
      }),
    ).toMatchObject({ ok: true });
    for (const iconDomain of [
      "123.example",
      "0x.example",
      "0x7f.example",
      "0x.0xzz",
      "127.0xzz",
      "1.2.3.4.5",
    ]) {
      expect(model.normalize({ iconDomain })).toMatchObject({ ok: true });
    }
  });

  test("produces one canonical model for equivalent property and item insertion orders", () => {
    const model = createStandardModelCapability();
    const first = model.normalize({
      id: componentId(1),
      name: "Ordering",
      type: "service",
      inputs: [
        { id: "inp_b", name: "B", "acme.io/detail": { z: 2, a: 1 } },
        { id: "inp_a", name: "A" },
      ],
      "acme.io/labels": { z: [2, 1], a: true },
    });
    const secondInput: StandardComponentInput = {
      "acme.io/labels": { a: true, z: [2, 1] },
      inputs: [
        { name: "A", id: "inp_a" },
        { "acme.io/detail": { a: 1, z: 2 }, name: "B", id: "inp_b" },
      ],
      type: "service",
      name: "Ordering",
      id: componentId(1),
    };
    const second = model.normalize(secondInput);

    expect(first).toEqual(second);
    expect(first.ok && JSON.stringify(first.value)).toBe(
      second.ok ? JSON.stringify(second.value) : "failed",
    );
  });

  test("preserves omissions in sparse patches and clears only explicit known fields", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const added = addComponent(kernel, kernel.empty(), {
      id: componentId(1),
      name: "Ordering",
      type: "service",
      parent: componentId(2),
      intent: "Own orders.",
      inputs: [{ id: "inp_order", name: "Order" }],
      desired: "present",
      "acme.io/owner": "commerce",
    });

    const sparse = model.patch(added.entity, { name: "Order Management" });
    if (!sparse.ok) throw new Error(sparse.diagnostics[0]?.message);
    expect(sparse.value.payload).toEqual({
      "acme.io/owner": "commerce",
      desired: "present",
      inputs: [{ id: "inp_order", name: "Order" }],
      intent: "Own orders.",
      name: "Order Management",
      parent: componentId(2),
      type: "service",
    });

    const updated = kernel.updateEntity(
      added.snapshot,
      { expectedKind: "component", id: added.entity.id },
      sparse.value.payload,
    );
    if (!updated.ok) throw new Error(updated.diagnostics[0]?.message);
    const cleared = model.patch(updated.value.entity, { intent: null, parent: null });
    if (!cleared.ok) throw new Error(cleared.diagnostics[0]?.message);
    expect(cleared.value.payload).not.toHaveProperty("intent");
    expect(cleared.value.payload).not.toHaveProperty("parent");
    expect(cleared.value.payload).toMatchObject({
      "acme.io/owner": "commerce",
      inputs: [{ id: "inp_order" }],
      type: "service",
    });
  });

  test("round-trips unknown namespaced extensions through every model operation", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const normalized = model.normalize({
      id: componentId(1),
      "acme.io/metadata": { tiers: ["critical", "customer"], owner: "commerce" },
      actions: [
        {
          id: "act_place_order",
          "acme:automation": { retries: 3 },
        },
      ],
    });
    if (!normalized.ok) throw new Error(normalized.diagnostics[0]?.message);
    const added = kernel.addEntity(kernel.empty(), normalized.value);
    if (!added.ok) throw new Error(added.diagnostics[0]?.message);
    const parsed = model.parse(added.value.entity);
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
    const serialized = model.serialize(parsed.value);
    if (!serialized.ok) throw new Error(serialized.diagnostics[0]?.message);
    const patched = model.patch(added.value.entity, { lifecycle: "active" });

    expect(serialized.value).toEqual(normalized.value);
    expect(parsed.value.extensions).toEqual({
      "acme.io/metadata": { owner: "commerce", tiers: ["critical", "customer"] },
    });
    expect(parsed.value.actions?.[0]?.extensions).toEqual({
      "acme:automation": { retries: 3 },
    });
    expect(patched).toMatchObject({
      ok: true,
      value: {
        payload: {
          "acme.io/metadata": { owner: "commerce", tiers: ["critical", "customer"] },
          actions: [{ "acme:automation": { retries: 3 }, id: "act_place_order" }],
          lifecycle: "active",
        },
      },
    });
  });

  test("rejects authority collisions and unsafe extensions during serialization", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const added = addComponent(kernel, kernel.empty(), {
      id: componentId(1),
      name: "Ordering",
      actions: [{ id: "act_place_order", name: "Place order" }],
    });
    const parsed = model.parse(added.entity);
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);

    for (const extensions of [
      { id: componentId(99) },
      { name: "Shadow name" },
      { owner: "commerce" },
    ]) {
      expect(model.serialize({ ...parsed.value, extensions })).toMatchObject({
        ok: false,
        diagnostics: [{ code: "invalid-extension-key" }],
      });
    }

    const action = parsed.value.actions?.[0];
    if (action === undefined) throw new Error("expected action fixture");
    for (const extensions of [{ id: "act_shadow" }, { name: "Shadow action" }]) {
      expect(
        model.serialize({
          ...parsed.value,
          actions: [{ ...action, extensions }],
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "invalid-extension-key" }],
      });
    }

    let accessorExecuted = false;
    const accessorExtensions = Object.defineProperty({}, "acme.io/value", {
      enumerable: true,
      get: () => {
        accessorExecuted = true;
        throw new Error("extension accessor must not run");
      },
    });
    const unsafe = {
      ...parsed.value,
      extensions: accessorExtensions,
    } as unknown as StandardComponent;
    let result: ReturnType<typeof model.serialize> | undefined;
    expect(() => {
      result = model.serialize(unsafe);
    }).not.toThrow();
    expect(accessorExecuted).toBeFalse();
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "unsupported-payload" }],
    });
  });

  test("derives children from heterogeneous pages and validates component records", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const arbitrary = kernel.addEntity(kernel.empty(), {
      id: componentId(9),
      kind: "scanner-observation",
      payload: { malformedForAComponent: true },
    });
    if (!arbitrary.ok) throw new Error(arbitrary.diagnostics[0]?.message);
    const root = addComponent(kernel, arbitrary.value.snapshot, {
      id: componentId(1),
      name: "Shop",
      type: "domain",
    });
    const child = addComponent(kernel, root.snapshot, {
      id: componentId(2),
      name: "Orders",
      parent: componentId(1),
      type: "component",
    });
    const page = kernel.pageEntities(child.snapshot, { limit: 100 });
    if (!page.ok) throw new Error(page.diagnostics[0]?.message);

    expect(model.children(page.value.items)).toMatchObject({
      ok: true,
      value: [{ id: componentId(1), name: "Shop" }],
    });
    expect(model.children(page.value.items, componentId(1))).toMatchObject({
      ok: true,
      value: [{ id: componentId(2), name: "Orders" }],
    });

    const malformed = kernel.addEntity(child.snapshot, {
      id: componentId(3),
      kind: STANDARD_COMPONENT_KIND,
      payload: { name: 42 },
    });
    if (!malformed.ok) throw new Error(malformed.diagnostics[0]?.message);
    const malformedPage = kernel.pageEntities(malformed.value.snapshot, { limit: 100 });
    if (!malformedPage.ok) throw new Error(malformedPage.diagnostics[0]?.message);
    expect(model.children(malformedPage.value.items)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "invalid-standard-model-field" }],
    });
  });

  test("derives relationship views from Core identity without duplicating authority", () => {
    const model = createStandardModelCapability();
    const kernel = createKernel();
    const ordering = addComponent(kernel, kernel.empty(), {
      id: componentId(1),
      name: "Ordering",
    });
    const payments = addComponent(kernel, ordering.snapshot, {
      id: componentId(2),
      name: "Payments",
    });
    const inventory = addComponent(kernel, payments.snapshot, {
      id: componentId(3),
      name: "Inventory",
    });
    const requiresInventory = kernel.addRelation(inventory.snapshot, {
      id: relationshipId(2),
      type: "requires",
      source: { expectedKind: "component", id: ordering.entity.id },
      target: { expectedKind: "component", id: inventory.entity.id },
      payload: { description: "Reserves inventory." },
    });
    if (!requiresInventory.ok) throw new Error(requiresInventory.diagnostics[0]?.message);
    const requiresPayments = kernel.addRelation(requiresInventory.value.snapshot, {
      id: relationshipId(1),
      type: "requires",
      source: { expectedKind: "component", id: ordering.entity.id },
      target: { expectedKind: "component", id: payments.entity.id },
      payload: { "acme.io/critical": true, description: "Authorizes payment." },
    });
    if (!requiresPayments.ok) throw new Error(requiresPayments.diagnostics[0]?.message);
    const page = kernel.pageRelations(requiresPayments.value.snapshot, { limit: 100 });
    if (!page.ok) throw new Error(page.diagnostics[0]?.message);
    const views = model.relationships(page.value.items.toReversed());
    if (!views.ok) throw new Error(views.diagnostics[0]?.message);

    expect(views.value.map((item) => item.id)).toEqual([relationshipId(1), relationshipId(2)]);
    expect(views.value[0]).toEqual({
      id: relationshipId(1),
      type: "requires",
      source: ordering.entity.id,
      target: payments.entity.id,
      description: "Authorizes payment.",
      extensions: { "acme.io/critical": true },
    });
    const parsedOrdering = model.parse(ordering.entity);
    expect(parsedOrdering.ok && "relationships" in parsedOrdering.value).toBeFalse();

    const collidingPayload = kernel.addRelation(requiresPayments.value.snapshot, {
      id: relationshipId(3),
      type: "informs",
      source: { expectedKind: "component", id: inventory.entity.id },
      target: { expectedKind: "component", id: ordering.entity.id },
      payload: { id: "rel_shadow" },
    });
    if (!collidingPayload.ok) throw new Error(collidingPayload.diagnostics[0]?.message);
    expect(model.relationships([collidingPayload.value.relation])).toMatchObject({
      ok: false,
      diagnostics: [{ code: "unknown-standard-model-field" }],
    });
  });

  test("rejects duplicate embedded IDs and non-v0.1 structured vocabulary", () => {
    const model = createStandardModelCapability();
    expect(
      model.normalize({
        inputs: [
          { id: "inp_same", name: "First" },
          { id: "inp_same", name: "Second" },
        ],
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "duplicate-standard-item-id" }] });

    for (const field of ["requirements", "state", "guarantees", "triggers", "effects"]) {
      expect(model.normalize({ [field]: [] })).toMatchObject({
        ok: false,
        diagnostics: [{ code: "unknown-standard-model-field" }],
      });
    }
  });

  test("keeps Core model-neutral", () => {
    const kernel = createKernel();
    const arbitrary = kernel.addEntity(kernel.empty(), {
      kind: "arbitrary-model-node",
      payload: { anything: true },
    });
    if (!arbitrary.ok) throw new Error(arbitrary.diagnostics[0]?.message);
    const model = createStandardModelCapability();

    expect(
      kernel.resolveEntity(arbitrary.value.snapshot, { id: arbitrary.value.entity.id }),
    ).toEqual({ ok: true, value: arbitrary.value.entity });
    expect(model.parse(arbitrary.value.entity)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "wrong-standard-model-kind" }],
    });
  });
});
