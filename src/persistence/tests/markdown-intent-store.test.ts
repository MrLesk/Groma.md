import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import {
  parseEntityId,
  parseRelationId,
  type GraphEntity,
  type GraphRelation,
} from "../../core/index.ts";
import { createStandardModelCapability } from "../../standard-model/index.ts";
import {
  createLocalResourceProvider,
  createMarkdownIntentStore,
  markdownIntentLocator,
  workspaceResourceLocator,
} from "../index.ts";

const roots: string[] = [];
const decoder = new TextDecoder();

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function entityId(hex: string) {
  const parsed = parseEntityId(`ent_${hex.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid test entity id");
  return parsed.value;
}

function relationId(hex: string) {
  const parsed = parseRelationId(`rel_${hex.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid test relation id");
  return parsed.value;
}

function component(id: ReturnType<typeof entityId>, payload: GraphEntity["payload"]): GraphEntity {
  return { id, kind: "component", payload };
}

async function resources() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-markdown-store-"));
  roots.push(workspaceRoot);
  return createLocalResourceProvider({ workspaceRoot });
}

async function publish(
  provider: Awaited<ReturnType<typeof resources>>,
  locator: string,
  text: string,
) {
  const parsed = workspaceResourceLocator(...locator.split("/"));
  if (!parsed.ok) throw new Error("invalid test locator");
  const staged = await provider.stageReplacement(parsed.value, new TextEncoder().encode(text));
  if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
  const committed = await provider.commitReplacement(staged.value);
  expect(committed.state).toBe("committed");
}

describe("Markdown intent codec", () => {
  test("derives the canonical stable-identity shard and resource key", () => {
    const id = entityId("ab12");
    const locator = markdownIntentLocator(id);
    expect(locator).toMatchObject({ ok: true });
    if (!locator.ok) throw new Error("expected locator");
    expect(String(locator.value)).toBe(`groma/intent/00/${id}.md`);
  });

  test("round-trips nested components, items, relations, Unicode prose, and extensions", () => {
    const model = createStandardModelCapability();
    const source = entityId("10");
    const target = entityId("20");
    const store = createMarkdownIntentStore({ model, resources: {} as never });
    const entity = component(source, {
      actions: [
        { description: "Second", id: "z-action", "vendor.io/item": { z: 2, a: 1 } },
        { id: "a-action", name: "First" },
      ],
      "acme.io/owner": "Architecture",
      intent: "Café architecture\n\nPreserve **meaning**.\n",
      name: "Renamable name",
      parent: target,
      type: "service.worker",
    });
    const relations: GraphRelation[] = [
      {
        id: relationId("30"),
        payload: { description: "Calls", "vendor.io/confidence": 0.9 },
        source,
        target,
        type: "depends-on",
      },
    ];

    const encoded = store.serialize(entity, relations);
    expect(encoded).toMatchObject({ ok: true });
    if (!encoded.ok) throw new Error("expected serialized resource");
    expect(String(encoded.value.locator)).toBe(`groma/intent/00/${source}.md`);
    expect(String(encoded.value.resource)).toBe(String(encoded.value.locator));
    expect(String(encoded.value.revision)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(decoder.decode(encoded.value.bytes)).toBe(`---
schema: groma/v0.1
id: ${source}
kind: component
name: Renamable name
type: service.worker
parent: ${target}
actions:
  - id: a-action
    name: First
  - id: z-action
    description: Second
    vendor.io/item:
      a: 1
      z: 2
relationships:
  - id: ${relationId("30")}
    type: depends-on
    target: ${target}
    description: Calls
    vendor.io/confidence: 0.9
acme.io/owner: Architecture
---

# Intent

Café architecture

Preserve **meaning**.

`);

    const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
    expect(decoded).toMatchObject({ ok: true });
    if (!decoded.ok) throw new Error("expected decoded resource");
    const canonical = model.parse(entity);
    if (!canonical.ok) throw new Error("expected canonical component");
    const canonicalDraft = model.serialize(canonical.value);
    if (!canonicalDraft.ok) throw new Error("expected canonical entity draft");
    expect(decoded.value.entity).toEqual({
      id: entity.id,
      kind: canonicalDraft.value.kind,
      payload: canonicalDraft.value.payload as GraphEntity["payload"],
    });
    expect(decoded.value.relations).toEqual(relations);
    expect(decoded.value.revision).toBe(encoded.value.revision);
  });

  test("canonicalizes equivalent semantic ordering to byte-identical Markdown", () => {
    const source = entityId("40");
    const target = entityId("50");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const first = component(source, {
      outputs: [
        { id: "z", name: "Z" },
        { id: "a", name: "A" },
      ],
      "z.io/value": { z: true, a: false },
      "a.io/value": 1,
      name: "Stable",
      type: "service",
    });
    const second = component(source, {
      type: "service",
      name: "Stable",
      "a.io/value": 1,
      "z.io/value": { a: false, z: true },
      outputs: [
        { name: "A", id: "a" },
        { name: "Z", id: "z" },
      ],
    });
    const relationA: GraphRelation = {
      id: relationId("60"),
      payload: {},
      source,
      target,
      type: "uses",
    };
    const relationB: GraphRelation = {
      id: relationId("61"),
      payload: {},
      source,
      target,
      type: "calls",
    };
    const left = store.serialize(first, [relationA, relationB]);
    const right = store.serialize(second, [relationB, relationA]);
    if (!left.ok || !right.ok) throw new Error("expected serialization");
    expect(left.value.bytes).toEqual(right.value.bytes);
  });

  test("uses readable known-field order and round-trips arbitrary nested extension keys", () => {
    const id = entityId("65");
    const nested = JSON.parse(
      '{"__proto__":"data, not a prototype","line\\nkey":{"z":2,"a":1}}',
    ) as GraphEntity["payload"];
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const encoded = store.serialize(
      component(id, {
        actions: [{ id: "act" }],
        desired: "present",
        inputs: [{ id: "in" }],
        lifecycle: "active",
        name: "Ordered",
        outputs: [{ id: "out" }],
        parent: entityId("66"),
        type: "service",
        "vendor.io/nested": nested,
      }),
      [],
    );
    if (!encoded.ok) throw new Error("expected serialization");
    const text = decoder.decode(encoded.value.bytes);
    const fields = [
      "schema:",
      "id:",
      "kind:",
      "name:",
      "type:",
      "parent:",
      "desired:",
      "lifecycle:",
      "inputs:",
      "outputs:",
      "actions:",
      "vendor.io/nested:",
    ];
    expect(fields.map((field) => text.indexOf(`\n${field}`))).toEqual(
      [...fields.map((field) => text.indexOf(`\n${field}`))].sort((left, right) => left - right),
    );
    const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
    if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
    const decodedPayload = decoded.value.entity.payload as Readonly<Record<string, unknown>>;
    const decodedNested = decodedPayload["vendor.io/nested"] as Readonly<Record<string, unknown>>;
    expect(Object.hasOwn(decodedNested, "__proto__")).toBeTrue();
    expect(decodedNested["__proto__"]).toBe("data, not a prototype");
    expect(decodedNested["line\nkey"]).toEqual({ a: 1, z: 2 });
    const exposed = encoded.value.bytes;
    exposed[0] = 0;
    expect(store.decode(encoded.value.locator, encoded.value.bytes)).toMatchObject({ ok: true });
  });

  test("distinguishes omitted, empty, and trailing-newline intent", () => {
    const id = entityId("70");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    for (const intent of [undefined, "", "line", "line\n", "line\n\n", "=======\n"] as const) {
      const encoded = store.serialize(component(id, intent === undefined ? {} : { intent }), []);
      if (!encoded.ok) throw new Error("expected serialization");
      const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
      if (!decoded.ok) throw new Error("expected decoding");
      expect((decoded.value.entity.payload as { readonly intent?: string }).intent).toBe(intent);
    }
  });

  test("hashes exact loaded bytes while canonical rewrites normalize formatting", () => {
    const id = entityId("80");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const handFormatted = `---\nkind: component\nschema: groma/v0.1\nname: 'Hand formatted'\nid: ${id}\n---\n`;
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const bytes = new TextEncoder().encode(handFormatted);
    const loaded = store.decode(locator.value, bytes);
    if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.message);
    expect(String(loaded.value.revision)).toBe(
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    );
    const canonical = store.serialize(loaded.value.entity, loaded.value.relations);
    if (!canonical.ok) throw new Error("expected serialization");
    expect(canonical.value.revision).not.toBe(loaded.value.revision);
  });

  test("decodes the architecture-style blank line before the Intent heading", () => {
    const id = entityId("801");
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const decoded = store.decode(
      locator.value,
      new TextEncoder().encode(
        `---\nschema: groma/v0.1\nid: ${id}\nkind: component\n---\n\n# Intent\n\nArchitecture prose.\n`,
      ),
    );
    if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
    expect((decoded.value.entity.payload as { readonly intent?: string }).intent).toBe(
      "Architecture prose.",
    );
  });

  test("fails closed on unpaired surrogates anywhere canonical UTF-8 would be lossy", () => {
    const id = entityId("802");
    const target = entityId("803");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const nestedKey: Record<string, string> = {};
    Object.defineProperty(nestedKey, `bad${String.fromCharCode(0xd800)}key`, {
      enumerable: true,
      value: "value",
    });
    const entities = [
      component(id, { intent: `before${String.fromCharCode(0xd800)}after` }),
      component(id, {
        actions: [{ id: "act", name: `bad${String.fromCharCode(0xdc00)}` }],
      }),
      component(id, { "vendor.io/nested": nestedKey }),
      component(id, {
        "vendor.io/nested": { value: `bad${String.fromCharCode(0xd800)}` },
      }),
    ];
    for (const entity of entities) {
      expect(store.serialize(entity, [])).toMatchObject({
        diagnostics: [{ code: "invalid-intent-unicode" }],
        ok: false,
      });
    }
    expect(
      store.serialize(component(id, {}), [
        {
          id: relationId("802"),
          payload: { description: `bad${String.fromCharCode(0xd800)}` },
          source: id,
          target,
          type: "uses",
        },
      ]),
    ).toMatchObject({ diagnostics: [{ code: "invalid-intent-unicode" }], ok: false });
  });

  test("preserves safe YAML integers across nested component, item, and relation extensions", () => {
    const id = entityId("804");
    const target = entityId("805");
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const decoded = store.decode(
      locator.value,
      new TextEncoder().encode(`---
schema: groma/v0.1
id: ${id}
kind: component
actions:
  - id: act
    vendor.io/nested:
      count: 7
relationships:
  - id: ${relationId("804")}
    type: uses
    target: ${target}
    vendor.io/nested:
      count: 9
vendor.io/nested:
  count: 42
---
`),
    );
    if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
    expect(decoded.value.entity.payload).toMatchObject({
      actions: [{ id: "act", "vendor.io/nested": { count: 7 } }],
      "vendor.io/nested": { count: 42 },
    });
    expect(decoded.value.relations).toMatchObject([
      { payload: { "vendor.io/nested": { count: 9 } } },
    ]);
    const canonical = store.serialize(decoded.value.entity, decoded.value.relations);
    if (!canonical.ok) throw new Error(canonical.diagnostics[0]?.message);
    const reloaded = store.decode(canonical.value.locator, canonical.value.bytes);
    if (!reloaded.ok) throw new Error(reloaded.diagnostics[0]?.message);
    expect(reloaded.value.entity).toEqual(decoded.value.entity);
    expect(reloaded.value.relations).toEqual(decoded.value.relations);
  });

  test("round-trips finite GraphData numbers beyond the safe-integer range", () => {
    const id = entityId("8051");
    const target = entityId("8052");
    const reportedInteger = 1_000_000_000_000_000_100;
    const reportedExponent = 1.2345678901234568e20;
    const values = {
      exactNegativeInteger: -9_007_199_254_740_992,
      exactPositiveInteger: 9_007_199_254_740_992,
      largeNegativeExponent: -1e100,
      largePositiveExponent: 1e100,
      reportedInteger,
    };
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const relation: GraphRelation = {
      id: relationId("8051"),
      payload: { "vendor.io/numbers": { negativeReportedInteger: -reportedInteger } },
      source: id,
      target,
      type: "uses",
    };
    const encoded = store.serialize(
      component(id, {
        actions: [{ id: "act", "vendor.io/numbers": { reportedExponent } }],
        "vendor.io/numbers": values,
      }),
      [relation],
    );
    if (!encoded.ok) throw new Error(encoded.diagnostics[0]?.message);
    const text = decoder.decode(encoded.value.bytes);
    expect(text).toContain("reportedInteger: 1.0000000000000001e+18");
    expect(text).toContain("reportedExponent: 1.2345678901234568e+20");
    expect(text).toContain("negativeReportedInteger: -1.0000000000000001e+18");
    expect(text).not.toContain("!!float");
    const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
    if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
    expect(decoded.value.entity.payload).toMatchObject({
      actions: [{ id: "act", "vendor.io/numbers": { reportedExponent } }],
      "vendor.io/numbers": values,
    });
    expect(decoded.value.relations).toEqual([relation]);
    const rewritten = store.serialize(decoded.value.entity, decoded.value.relations);
    if (!rewritten.ok) throw new Error(rewritten.diagnostics[0]?.message);
    expect(rewritten.value.bytes).toEqual(encoded.value.bytes);
  });

  test("rejects unsafe, non-finite, and underflowed YAML numbers before model use", () => {
    const id = entityId("806");
    const target = entityId("807");
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const cases = [
      ["intent-unsafe-integer", "vendor.io/value: 9007199254740993"],
      [
        "intent-unsafe-integer",
        "actions:\n  - id: act\n    vendor.io/nested:\n      value: 9007199254740993",
      ],
      [
        "intent-unsafe-integer",
        `relationships:\n  - id: ${relationId("806")}\n    type: uses\n    target: ${target}\n    vendor.io/nested:\n      value: 9007199254740993`,
      ],
      ["intent-unsafe-integer", `vendor.io/value: 1${"0".repeat(400)}`],
      ["intent-non-finite-number", "vendor.io/value: 1e999"],
      ["intent-non-finite-number", "vendor.io/value: .nan"],
      ["intent-number-underflow", "vendor.io/value: 1e-999"],
    ] as const;
    for (const [code, fields] of cases) {
      expect(
        store.decode(
          locator.value,
          new TextEncoder().encode(
            `---\nschema: groma/v0.1\nid: ${id}\nkind: component\n${fields}\n---\n`,
          ),
        ),
      ).toMatchObject({ diagnostics: [{ code }], ok: false });
    }
  });

  test("keeps stable locators across rename and reparent operations", () => {
    const id = entityId("81");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const before = store.serialize(component(id, { name: "Before", type: "service" }), []);
    const after = store.serialize(
      component(id, { name: "After", parent: entityId("82"), type: "worker" }),
      [],
    );
    if (!before.ok || !after.ok) throw new Error("expected serialization");
    expect(after.value.locator).toBe(before.value.locator);
    expect(after.value.resource).toBe(before.value.resource);
  });

  test("preserves namespaced extensions through unrelated mutation and rewrite", () => {
    const id = entityId("83");
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources: {} as never });
    const original = component(id, {
      actions: [{ id: "act", "vendor.io/item": { z: 2, a: 1 } }],
      "vendor.io/component": { enabled: true },
      name: "Before",
    });
    const relation: GraphRelation = {
      id: relationId("83"),
      payload: { "vendor.io/relation": ["kept"] },
      source: id,
      target: entityId("84"),
      type: "uses",
    };
    const encoded = store.serialize(original, [relation]);
    if (!encoded.ok) throw new Error("expected serialization");
    const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
    if (!decoded.ok) throw new Error("expected decoding");
    const patched = model.patch(decoded.value.entity, { name: "After" });
    if (!patched.ok || patched.value.id === undefined) throw new Error("expected patch");
    const rewritten = store.serialize(
      component(id, patched.value.payload as GraphEntity["payload"]),
      decoded.value.relations,
    );
    if (!rewritten.ok) throw new Error("expected rewrite");
    const reloaded = store.decode(rewritten.value.locator, rewritten.value.bytes);
    if (!reloaded.ok) throw new Error("expected reload");
    expect(reloaded.value.entity.payload).toMatchObject({
      actions: [{ id: "act", "vendor.io/item": { a: 1, z: 2 } }],
      "vendor.io/component": { enabled: true },
      name: "After",
    });
    expect(reloaded.value.relations).toEqual(decoded.value.relations);
  });

  test("diagnoses schema mismatch and malformed UTF-8 before semantic use", () => {
    const id = entityId("85");
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    expect(
      store.decode(
        locator.value,
        new TextEncoder().encode(`---\nschema: groma/v9\nkind: component\nid: ${id}\n---\n`),
      ),
    ).toMatchObject({ diagnostics: [{ code: "intent-schema-mismatch" }], ok: false });
    expect(store.decode(locator.value, new Uint8Array([0xff, 0xfe]))).toMatchObject({
      diagnostics: [{ code: "invalid-intent-utf8" }],
      ok: false,
    });
  });

  test("snapshots genuine Uint8Array bytes without species or mutable Buffer views", () => {
    const id = entityId("851");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const encoded = store.serialize(component(id, { name: "Stable bytes" }), []);
    if (!encoded.ok) throw new Error(encoded.diagnostics[0]?.message);

    const bufferInput = Buffer.from(encoded.value.bytes);
    const decodedBuffer = store.decode(encoded.value.locator, bufferInput);
    if (!decodedBuffer.ok) throw new Error(decodedBuffer.diagnostics[0]?.message);
    const revision = decodedBuffer.value.revision;
    const entity = decodedBuffer.value.entity;
    const exposed = decodedBuffer.value.bytes;
    expect(Buffer.isBuffer(exposed)).toBeFalse();
    exposed[0] = 0;
    expect(decodedBuffer.value.bytes[0]).toBe("-".charCodeAt(0));
    expect(decodedBuffer.value.revision).toBe(revision);
    expect(decodedBuffer.value.entity).toBe(entity);
    expect(bufferInput[0]).toBe("-".charCodeAt(0));

    let constructorCalls = 0;
    let speciesReads = 0;
    class HostileBytes extends Uint8Array {
      constructor(value: Uint8Array) {
        super(value);
        constructorCalls += 1;
      }

      static get [Symbol.species](): Uint8ArrayConstructor {
        speciesReads += 1;
        throw new Error("species must not be read");
      }
    }
    const hostile = new HostileBytes(encoded.value.bytes);
    constructorCalls = 0;
    const decodedHostile = store.decode(encoded.value.locator, hostile);
    expect(decodedHostile).toMatchObject({ ok: true });
    expect(constructorCalls).toBe(0);
    expect(speciesReads).toBe(0);

    expect(store.decode(encoded.value.locator, new Float64Array([1]) as never)).toMatchObject({
      diagnostics: [{ code: "invalid-intent-bytes" }],
      ok: false,
    });
    const proxy = new Proxy(encoded.value.bytes, {
      get: () => {
        throw new Error("proxy must not be read");
      },
    });
    expect(store.decode(encoded.value.locator, proxy)).toMatchObject({
      diagnostics: [{ code: "invalid-intent-bytes" }],
      ok: false,
    });
  });

  test("rejects non-outgoing relations and scanner-shaped direct inputs", () => {
    const id = entityId("86");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    expect(
      store.serialize(component(id, {}), [
        {
          id: relationId("86"),
          payload: {},
          source: entityId("87"),
          target: id,
          type: "uses",
        },
      ]),
    ).toMatchObject({ diagnostics: [{ code: "non-outgoing-intent-relation" }], ok: false });
    expect(store.serialize({ stableKey: "scanner-candidate" } as never, [])).toMatchObject({
      diagnostics: [{ code: "invalid-intent-entity" }],
      ok: false,
    });
    expect(
      store.serialize(component(id, {}), [
        { stableKey: "scanner-relationship", targetStableKey: "other" } as never,
      ]),
    ).toMatchObject({ diagnostics: [{ code: "invalid-intent-relation" }], ok: false });
  });

  test("rejects accessor and proxy entity or relation records without reading getters", () => {
    const id = entityId("808");
    const target = entityId("809");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    let getterReads = 0;
    const accessorEntity = { kind: "component", payload: {} } as Record<string, unknown>;
    Object.defineProperty(accessorEntity, "id", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return getterReads % 2 === 0 ? id : target;
      },
    });
    expect(store.serialize(accessorEntity as never, [])).toMatchObject({
      diagnostics: [{ code: "invalid-intent-entity" }],
      ok: false,
    });
    expect(getterReads).toBe(0);

    const accessorEntityPayload: Record<string, unknown> = {};
    Object.defineProperty(accessorEntityPayload, "name", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return getterReads % 2 === 0 ? "Second" : "First";
      },
    });
    expect(store.serialize(component(id, accessorEntityPayload as never), [])).toMatchObject({
      diagnostics: [{ code: "unsupported-payload" }],
      ok: false,
    });
    expect(getterReads).toBe(0);

    const accessorRelation = {
      payload: {},
      source: id,
      target,
      type: "uses",
    } as Record<string, unknown>;
    Object.defineProperty(accessorRelation, "id", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        throw new Error("must not run");
      },
    });
    expect(store.serialize(component(id, {}), [accessorRelation as never])).toMatchObject({
      diagnostics: [{ code: "invalid-intent-relation" }],
      ok: false,
    });
    expect(getterReads).toBe(0);

    const accessorRelationPayload: Record<string, unknown> = {};
    Object.defineProperty(accessorRelationPayload, "description", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        throw new Error("must not run");
      },
    });
    expect(
      store.serialize(component(id, {}), [
        {
          id: relationId("808"),
          payload: accessorRelationPayload as never,
          source: id,
          target,
          type: "uses",
        },
      ]),
    ).toMatchObject({ diagnostics: [{ code: "unsupported-payload" }], ok: false });
    expect(getterReads).toBe(0);

    const accessorArray: GraphRelation[] = [];
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        throw new Error("must not run");
      },
    });
    expect(store.serialize(component(id, {}), accessorArray)).toMatchObject({
      diagnostics: [{ code: "invalid-intent-relations" }],
      ok: false,
    });
    expect(getterReads).toBe(0);

    const throwingProxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("proxy trap");
        },
      },
    );
    expect(store.serialize(throwingProxy as never, [])).toMatchObject({
      diagnostics: [{ code: "invalid-intent-entity" }],
      ok: false,
    });
    expect(store.serialize(component(id, {}), [throwingProxy as never])).toMatchObject({
      diagnostics: [{ code: "invalid-intent-relation" }],
      ok: false,
    });
  });

  test("rejects duplicate relationship identities in direct serialize and decode calls", () => {
    const id = entityId("88");
    const target = entityId("89");
    const duplicate: GraphRelation = {
      id: relationId("88"),
      payload: {},
      source: id,
      target,
      type: "uses",
    };
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    expect(store.serialize(component(id, {}), [duplicate, duplicate])).toMatchObject({
      diagnostics: [{ code: "duplicate-intent-relation" }],
      ok: false,
    });
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const relationship = `  - id: ${duplicate.id}\n    type: uses\n    target: ${target}\n`;
    expect(
      store.decode(
        locator.value,
        new TextEncoder().encode(
          `---\nschema: groma/v0.1\nid: ${id}\nkind: component\nrelationships:\n${relationship}${relationship}---\n`,
        ),
      ),
    ).toMatchObject({ diagnostics: [{ code: "duplicate-intent-relation" }], ok: false });
  });

  test("rejects conflicts, duplicate YAML keys, aliases, anchors, tags, wrong kinds, and malformed bodies", () => {
    const id = entityId("90");
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const conflict = "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch";
    expect(store.serialize(component(id, { intent: conflict }), [])).toMatchObject({
      diagnostics: [{ code: "intent-conflict-marker" }],
      ok: false,
    });
    const separator = store.serialize(component(id, { intent: "=======\n" }), []);
    if (!separator.ok) throw new Error(separator.diagnostics[0]?.message);
    expect(store.decode(separator.value.locator, separator.value.bytes)).toMatchObject({
      ok: true,
    });
    const cases = [
      [
        "intent-conflict-marker",
        `---\nschema: groma/v0.1\nid: ${id}\nkind: component\n---\n\n# Intent\n\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n`,
      ],
      [
        "intent-malformed-yaml",
        `---\nschema: groma/v0.1\nid: ${id}\nkind: component\nname: [unterminated\n---\n`,
      ],
      [
        "intent-duplicate-yaml-key",
        `---\nschema: groma/v0.1\nkind: component\nid: ${id}\nid: ${id}\n---\n`,
      ],
      [
        "intent-unsupported-yaml",
        `---\nschema: groma/v0.1\nkind: component\nid: &id ${id}\nname: *id\n---\n`,
      ],
      [
        "intent-unsupported-yaml",
        `---\nschema: groma/v0.1\nkind: component\nid: ${id}\nname: &name Ordering\n---\n`,
      ],
      [
        "intent-unsupported-yaml",
        `---\nschema: groma/v0.1\nkind: component\nid: !custom ${id}\n---\n`,
      ],
      [
        "invalid-intent-unicode",
        `---\nschema: groma/v0.1\nkind: component\nid: ${id}\nname: "\\uD800"\n---\n`,
      ],
      ["intent-wrong-kind", `---\nschema: groma/v0.1\nkind: evidence\nid: ${id}\n---\n`],
      [
        "intent-malformed-body",
        `---\nschema: groma/v0.1\nkind: component\nid: ${id}\nintent: true\n---\n`,
      ],
    ] as const;
    for (const [code, text] of cases) {
      expect(store.decode(locator.value, new TextEncoder().encode(text))).toMatchObject({
        diagnostics: [{ code }],
        ok: false,
      });
    }
  });
});

describe("provider-backed Markdown intent store", () => {
  test("loads the exact two-level layout and validates the whole graph", async () => {
    const provider = await resources();
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources: provider });
    const rootId = entityId("a0");
    const childId = entityId("b0");
    const root = store.serialize(component(rootId, { intent: "Root", type: "domain" }), [
      {
        id: relationId("c0"),
        payload: { description: "Contains intent-level dependency" },
        source: rootId,
        target: childId,
        type: "uses",
      },
    ]);
    const child = store.serialize(
      component(childId, { intent: "Child", parent: rootId, type: "service" }),
      [],
    );
    if (!root.ok || !child.ok) throw new Error("expected serialization");
    await publish(provider, String(root.value.locator), decoder.decode(root.value.bytes));
    await publish(provider, String(child.value.locator), decoder.decode(child.value.bytes));

    const loaded = await store.load();
    expect(loaded).toMatchObject({ ok: true });
    if (!loaded.ok) throw new Error("expected load");
    expect(loaded.value.entities.map((entity) => entity.id)).toEqual([rootId, childId]);
    expect(loaded.value.relations.map((relation) => relation.id)).toEqual([relationId("c0")]);
    expect(loaded.value.documents.map((document) => String(document.resource))).toEqual([
      `groma/intent/00/${rootId}.md`,
      `groma/intent/00/${childId}.md`,
    ]);

    const read = await store.read(childId);
    expect(read).toMatchObject({ ok: true, value: { entity: { id: childId } } });
  });

  test("round-trips multi-level same-type and mixed-type recursive containment", async () => {
    const provider = await resources();
    const store = createMarkdownIntentStore({
      bounds: { pageSize: 1 },
      model: createStandardModelCapability(),
      resources: provider,
    });
    const root = entityId("a1");
    const sameTypeChild = entityId("a2");
    const mixedTypeGrandchild = entityId("a3");
    const sameTypeGreatGrandchild = entityId("a4");
    const hierarchy = [
      component(root, { name: "Root", type: "service" }),
      component(sameTypeChild, { name: "Same", parent: root, type: "service" }),
      component(mixedTypeGrandchild, {
        name: "Mixed",
        parent: sameTypeChild,
        type: "worker",
      }),
      component(sameTypeGreatGrandchild, {
        name: "Same again",
        parent: mixedTypeGrandchild,
        type: "worker",
      }),
    ];
    for (const entity of hierarchy) {
      const encoded = store.serialize(entity, []);
      if (!encoded.ok) throw new Error(encoded.diagnostics[0]?.message);
      const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
      if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
      expect(decoded.value.entity.id).toBe(entity.id);
      await publish(provider, String(encoded.value.locator), decoder.decode(encoded.value.bytes));
    }
    const loaded = await store.load();
    if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.message);
    expect(
      loaded.value.entities.map((entity) => ({
        id: entity.id,
        parent: (entity.payload as { readonly parent?: string }).parent,
        type: (entity.payload as { readonly type?: string }).type,
      })),
    ).toEqual([
      { id: root, parent: undefined, type: "service" },
      { id: sameTypeChild, parent: root, type: "service" },
      { id: mixedTypeGrandchild, parent: sameTypeChild, type: "worker" },
      { id: sameTypeGreatGrandchild, parent: mixedTypeGrandchild, type: "worker" },
    ]);
  });

  test("treats a missing intent root as empty", async () => {
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: await resources(),
    });
    expect(await store.load()).toMatchObject({
      ok: true,
      value: { documents: [], entities: [], relations: [] },
    });
  });

  test("fails closed if the intent root disappears after a successful enumeration page", async () => {
    let calls = 0;
    const shard = workspaceResourceLocator("groma", "intent", "00");
    if (!shard.ok) throw new Error("expected shard locator");
    const scriptedProvider = {
      enumerate: async () => {
        calls += 1;
        return calls === 1
          ? {
              ok: true as const,
              value: {
                entries: [{ kind: "directory" as const, locator: shard.value }],
                nextCursor: "scripted-cursor" as never,
                truncatedByDepth: false,
              },
            }
          : {
              diagnostics: [{ code: "resource-missing", message: "Intent root disappeared" }],
              ok: false as const,
            };
      },
    };
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: scriptedProvider as never,
    });
    expect(await store.load()).toMatchObject({
      diagnostics: [{ code: "intent-load-inconsistent" }],
      ok: false,
    });
    expect(calls).toBe(2);
  });

  test("rejects repeated or fresh continuation cursors on empty non-final pages", async () => {
    const shard = workspaceResourceLocator("groma", "intent", "00");
    if (!shard.ok) throw new Error("expected shard locator");
    for (const secondCursor of ["cursor-1", "cursor-2"]) {
      let calls = 0;
      const scriptedProvider = {
        enumerate: async () => {
          calls += 1;
          return {
            ok: true as const,
            value:
              calls === 1
                ? {
                    entries: [{ kind: "directory" as const, locator: shard.value }],
                    nextCursor: "cursor-1" as never,
                    truncatedByDepth: false,
                  }
                : {
                    entries: [],
                    nextCursor: secondCursor as never,
                    truncatedByDepth: false,
                  },
          };
        },
      };
      const store = createMarkdownIntentStore({
        model: createStandardModelCapability(),
        resources: scriptedProvider as never,
      });
      expect(await store.load()).toMatchObject({
        diagnostics: [{ code: "intent-load-inconsistent" }],
        ok: false,
      });
      expect(calls).toBe(2);
    }
  });

  test("caps progressing enumeration pages by document and canonical shard bounds", async () => {
    let calls = 0;
    const scriptedProvider = {
      enumerate: async () => {
        const shard = (calls % 256).toString(16).padStart(2, "0");
        const locator = workspaceResourceLocator("groma", "intent", shard);
        if (!locator.ok) throw new Error("expected shard locator");
        calls += 1;
        return {
          ok: true as const,
          value: {
            entries: [{ kind: "directory" as const, locator: locator.value }],
            nextCursor: `cursor-${calls}` as never,
            truncatedByDepth: false,
          },
        };
      },
    };
    const store = createMarkdownIntentStore({
      bounds: { maxDocuments: 0 },
      model: createStandardModelCapability(),
      resources: scriptedProvider as never,
    });
    expect(await store.load()).toMatchObject({
      diagnostics: [{ code: "intent-page-limit-exceeded" }],
      ok: false,
    });
    expect(calls).toBe(257);
  });

  test("diagnoses duplicate identities before wrong locations", async () => {
    const provider = await resources();
    const store = createMarkdownIntentStore({
      bounds: { pageSize: 1 },
      model: createStandardModelCapability(),
      resources: provider,
    });
    const id = entityId("d0");
    const encoded = store.serialize(component(id, { name: "Duplicate" }), []);
    if (!encoded.ok) throw new Error("expected serialization");
    const text = decoder.decode(encoded.value.bytes);
    await publish(provider, String(encoded.value.locator), text);
    await publish(provider, `groma/intent/ff/${id}.md`, text);
    expect(await store.load()).toMatchObject({
      diagnostics: [{ code: "duplicate-intent-entity" }],
      ok: false,
    });
  });

  test("diagnoses a single valid document stored at the wrong stable-ID location", async () => {
    const provider = await resources();
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: provider,
    });
    const id = entityId("d1");
    const encoded = store.serialize(component(id, { name: "Misplaced" }), []);
    if (!encoded.ok) throw new Error("expected serialization");
    await publish(provider, `groma/intent/ff/${id}.md`, decoder.decode(encoded.value.bytes));
    expect(await store.load()).toMatchObject({
      diagnostics: [{ code: "intent-wrong-location" }],
      ok: false,
    });
  });

  test("orders documents by canonical locator across shards and excludes other planes", async () => {
    const provider = await resources();
    const store = createMarkdownIntentStore({
      bounds: { pageSize: 1 },
      model: createStandardModelCapability(),
      resources: provider,
    });
    const high = entityId(`aa${"0".repeat(30)}`);
    const low = entityId(`01${"0".repeat(30)}`);
    for (const id of [high, low]) {
      const encoded = store.serialize(component(id, { name: String(id) }), []);
      if (!encoded.ok) throw new Error("expected serialization");
      await publish(provider, String(encoded.value.locator), decoder.decode(encoded.value.bytes));
    }
    await publish(provider, "groma/evidence/ignored.md", "not intent");
    const loaded = await store.load();
    if (!loaded.ok) throw new Error("expected load");
    expect(loaded.value.documents.map((document) => document.entity.id)).toEqual([low, high]);
  });

  test("diagnoses unknown parents, cycles, endpoints, duplicate relations, and unexpected layout", async () => {
    const scenarios: readonly [
      string,
      (provider: Awaited<ReturnType<typeof resources>>) => Promise<void>,
    ][] = [
      [
        "unknown-intent-parent",
        async (provider) => {
          const id = entityId("e0");
          const store = createMarkdownIntentStore({
            model: createStandardModelCapability(),
            resources: provider,
          });
          const encoded = store.serialize(component(id, { parent: entityId("eeee") }), []);
          if (!encoded.ok) throw new Error("expected serialization");
          await publish(
            provider,
            String(encoded.value.locator),
            decoder.decode(encoded.value.bytes),
          );
        },
      ],
      [
        "intent-containment-cycle",
        async (provider) => {
          const a = entityId("e1");
          const b = entityId("e2");
          const store = createMarkdownIntentStore({
            model: createStandardModelCapability(),
            resources: provider,
          });
          for (const [id, parent] of [
            [a, b],
            [b, a],
          ] as const) {
            const encoded = store.serialize(component(id, { parent }), []);
            if (!encoded.ok) throw new Error("expected serialization");
            await publish(
              provider,
              String(encoded.value.locator),
              decoder.decode(encoded.value.bytes),
            );
          }
        },
      ],
      [
        "unknown-intent-relation-target",
        async (provider) => {
          const source = entityId("e3");
          const store = createMarkdownIntentStore({
            model: createStandardModelCapability(),
            resources: provider,
          });
          const encoded = store.serialize(component(source, {}), [
            { id: relationId("e3"), payload: {}, source, target: entityId("eeee"), type: "uses" },
          ]);
          if (!encoded.ok) throw new Error("expected serialization");
          await publish(
            provider,
            String(encoded.value.locator),
            decoder.decode(encoded.value.bytes),
          );
        },
      ],
      [
        "duplicate-intent-relation",
        async (provider) => {
          const a = entityId("e4");
          const b = entityId("e5");
          const relation = relationId("e4");
          const store = createMarkdownIntentStore({
            model: createStandardModelCapability(),
            resources: provider,
          });
          for (const id of [a, b]) {
            const encoded = store.serialize(component(id, {}), [
              { id: relation, payload: {}, source: id, target: id, type: "uses" },
            ]);
            if (!encoded.ok) throw new Error("expected serialization");
            await publish(
              provider,
              String(encoded.value.locator),
              decoder.decode(encoded.value.bytes),
            );
          }
        },
      ],
      [
        "unexpected-intent-resource",
        async (provider) => publish(provider, "groma/intent/readme.md", "unexpected"),
      ],
    ];
    for (const [code, arrange] of scenarios) {
      const provider = await resources();
      await arrange(provider);
      const store = createMarkdownIntentStore({
        model: createStandardModelCapability(),
        resources: provider,
      });
      expect(await store.load()).toMatchObject({ diagnostics: [{ code }], ok: false });
    }
  });

  test("enforces configured document count and byte bounds", async () => {
    const provider = await resources();
    const model = createStandardModelCapability();
    const writer = createMarkdownIntentStore({ model, resources: provider });
    const encoded = writer.serialize(component(entityId("f0"), { intent: "too large" }), []);
    const second = writer.serialize(component(entityId("f1"), { intent: "also retained" }), []);
    if (!encoded.ok || !second.ok) throw new Error("expected serialization");
    await publish(provider, String(encoded.value.locator), decoder.decode(encoded.value.bytes));
    await publish(provider, String(second.value.locator), decoder.decode(second.value.bytes));
    const byteBounded = createMarkdownIntentStore({
      bounds: { maxDocumentBytes: 32 },
      model,
      resources: provider,
    });
    expect(await byteBounded.load()).toMatchObject({
      diagnostics: [{ code: "resource-too-large" }],
      ok: false,
    });
    const countBounded = createMarkdownIntentStore({
      bounds: { maxDocuments: 0 },
      model,
      resources: provider,
    });
    expect(await countBounded.load()).toMatchObject({
      diagnostics: [{ code: "intent-document-limit-exceeded" }],
      ok: false,
    });
    const totalBounded = createMarkdownIntentStore({
      bounds: {
        maxTotalDocumentBytes: encoded.value.bytes.byteLength + second.value.bytes.byteLength - 1,
      },
      model,
      resources: provider,
    });
    expect(await totalBounded.load()).toMatchObject({
      diagnostics: [{ code: "intent-total-byte-limit-exceeded" }],
      ok: false,
    });
    for (const maxTotalDocumentBytes of [0, Number.MAX_SAFE_INTEGER]) {
      expect(() =>
        createMarkdownIntentStore({
          bounds: { maxTotalDocumentBytes },
          model,
          resources: provider,
        }),
      ).toThrow("maxTotalDocumentBytes must be a safe integer");
    }
  });
});
