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
    expect(decoder.decode(encoded.value.bytes)).toContain(
      "# Intent\n\nCafé architecture\n\nPreserve **meaning**.\n\n",
    );

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
    expect(decoded.value.entity.payload).toMatchObject({
      "vendor.io/nested": {
        __proto__: "data, not a prototype",
        "line\nkey": { a: 1, z: 2 },
      },
    });
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
    for (const intent of [undefined, "", "line", "line\n", "line\n\n"] as const) {
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

  test("rejects conflicts, duplicate YAML keys, aliases, tags, wrong kinds, and malformed bodies", () => {
    const id = entityId("90");
    const locator = markdownIntentLocator(id);
    if (!locator.ok) throw new Error("expected locator");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const cases = [
      ["intent-conflict-marker", `---\nid: ${id}\n<<<<<<< HEAD\n---\n`],
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
        `---\nschema: groma/v0.1\nkind: component\nid: !custom ${id}\n---\n`,
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
    if (!encoded.ok) throw new Error("expected serialization");
    await publish(provider, String(encoded.value.locator), decoder.decode(encoded.value.bytes));
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
  });
});
