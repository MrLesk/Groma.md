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
  markdownIntentResource,
  workspaceResourceLocator,
} from "../index.ts";

const roots: string[] = [];
const decoder = new TextDecoder();
const encoder = new TextEncoder();

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

function componentLabels(
  entities: readonly GraphEntity[],
  extra: readonly [ReturnType<typeof entityId>, string][] = [],
) {
  const labels = new Map<ReturnType<typeof entityId>, string>(extra);
  for (const entity of entities) {
    const payload = entity.payload as { readonly name?: unknown };
    labels.set(entity.id, typeof payload.name === "string" ? payload.name : entity.id);
  }
  return labels;
}

async function resources() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-markdown-store-"));
  roots.push(workspaceRoot);
  return createLocalResourceProvider({ workspaceRoot });
}

async function publish(
  provider: Awaited<ReturnType<typeof resources>>,
  locator: string,
  bytes: Uint8Array,
) {
  const parsed = workspaceResourceLocator(...locator.split("/"));
  if (!parsed.ok) throw new Error("invalid test locator");
  const staged = await provider.stageReplacement(parsed.value, bytes);
  if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
  const committed = await provider.commitReplacement(staged.value);
  expect(committed.state).toBe("committed");
}

describe("readable Markdown component codec", () => {
  test("keeps stable logical identity separate from readable locations", () => {
    const id = entityId("ab12");
    const resource = markdownIntentResource(id);
    if (!resource.ok) throw new Error("expected stable resource mapping");
    expect(String(resource.value)).toBe(`component:${id}`);
  });

  test("maps component names and parent chains directly to readable document paths", () => {
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources: {} as never });
    const system = component(entityId("10"), { name: "Commerce Platform" });
    const domain = component(entityId("20"), { name: "Orders", parent: system.id });
    const worker = component(entityId("30"), { name: "Fulfilment: Worker", parent: domain.id });
    const locations = store.locations([worker, domain, system]);
    if (!locations.ok) throw new Error(locations.diagnostics[0]?.message);
    expect(
      locations.value.map((entry) => ({ id: entry.id, locator: String(entry.locator) })),
    ).toEqual([
      { id: system.id, locator: "groma/components/Commerce Platform.md" },
      { id: domain.id, locator: "groma/components/Commerce Platform/Orders.md" },
      {
        id: worker.id,
        locator: "groma/components/Commerce Platform/Orders/Fulfilment- Worker.md",
      },
    ]);
  });

  test("fails closed when sibling names collide on portable filesystems", () => {
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const first = component(entityId("40"), { name: "Orders" });
    const second = component(entityId("41"), { name: "orders" });
    expect(store.locations([first, second])).toMatchObject({
      diagnostics: [
        {
          code: "component-filename-collision",
          details: { filename: "orders.md", firstId: first.id, secondId: second.id },
        },
      ],
      ok: false,
    });
  });

  test("round-trips prose-first intent, item bullets, relationships, and extensions", () => {
    const model = createStandardModelCapability();
    const source = entityId("50");
    const target = entityId("51");
    const store = createMarkdownIntentStore({ model, resources: {} as never });
    const entity = component(source, {
      actions: [
        { description: "Create an order", id: "create-order", name: "Create" },
        { id: "archive", "vendor.io/item": { confidence: 0.9 } },
      ],
      "acme.io/owner": "Architecture",
      inputs: [{ description: "Incoming\nrequest", id: "request", name: "Order — request" }],
      intent: "Own the durable order lifecycle.\n\nKeep **business meaning** local.\n",
      name: "Orders",
      parent: target,
      scale: "domain",
      type: "service",
    });
    const relations: GraphRelation[] = [
      {
        id: relationId("52"),
        payload: { description: "Publishes events", "vendor.io/confidence": 1 },
        source,
        target,
        type: "depends-on",
      },
    ];
    const encoded = store.serialize(
      entity,
      relations,
      undefined,
      componentLabels([entity], [[target, "Platform"]]),
    );
    if (!encoded.ok) throw new Error(encoded.diagnostics[0]?.message);
    expect(String(encoded.value.locator)).toBe("groma/components/Orders.md");
    expect(String(encoded.value.resource)).toBe(`component:${source}`);
    const text = decoder.decode(encoded.value.bytes);
    expect(text).toStartWith(
      `---\nid: ${source}\ntype: service\nscale: domain\nacme.io/owner: Architecture\nitemExtensions:\n  actions:\n    archive:\n      vendor.io/item:\n        confidence: 0.9\nrelationshipExtensions:\n  ${relationId("52")}:\n    vendor.io/confidence: 1\n---\n\n# Orders\n`,
    );
    expect(text).toContain("- `request`: Order \\— request — Incoming\\nrequest");
    expect(text).toContain("- `create-order`: Create — Create an order");
    expect(text).toContain(`## Contained by\n\n[Platform](groma:component/${target})`);
    expect(text).toContain(
      `- depends-on [Platform](groma:component/${target}?relationship=${relationId("52")}) — Publishes events`,
    );
    expect(text).toEndWith(
      "## Purpose\n\nOwn the durable order lifecycle.\n\nKeep **business meaning** local.\n\n",
    );
    const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
    if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
    const canonical = model.parse(entity);
    if (!canonical.ok) throw new Error("expected canonical component");
    const draft = model.serialize(canonical.value);
    if (!draft.ok) throw new Error("expected canonical draft");
    expect(decoded.value.entity).toEqual({
      id: source,
      kind: "component",
      payload: draft.value.payload as GraphEntity["payload"],
    });
    expect(decoded.value.relations).toEqual(relations);
  });

  test("canonicalizes semantic ordering to byte-identical Markdown", () => {
    const source = entityId("60");
    const target = entityId("61");
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
    });
    const second = component(source, {
      name: "Stable",
      "a.io/value": 1,
      "z.io/value": { a: false, z: true },
      outputs: [
        { name: "A", id: "a" },
        { name: "Z", id: "z" },
      ],
    });
    const relationA: GraphRelation = {
      id: relationId("62"),
      payload: {},
      source,
      target,
      type: "uses",
    };
    const relationB: GraphRelation = {
      id: relationId("63"),
      payload: {},
      source,
      target,
      type: "calls",
    };
    const labels = componentLabels([first], [[target, "Target"]]);
    const left = store.serialize(first, [relationA, relationB], undefined, labels);
    const right = store.serialize(second, [relationB, relationA], undefined, labels);
    if (!left.ok || !right.ok) throw new Error("expected serialization");
    expect(left.value.bytes).toEqual(right.value.bytes);
  });

  test("writes shared only when true and treats omission as the deterministic false default", () => {
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const omitted = store.serialize(component(entityId("64"), { name: "Local" }), []);
    const explicitFalse = store.serialize(
      component(entityId("65"), { name: "Also local", shared: false }),
      [],
    );
    const shared = store.serialize(component(entityId("66"), { name: "Shared", shared: true }), []);
    if (!omitted.ok || !explicitFalse.ok || !shared.ok) throw new Error("expected serialization");
    expect(decoder.decode(omitted.value.bytes)).not.toContain("shared:");
    expect(decoder.decode(explicitFalse.value.bytes)).not.toContain("shared:");
    expect(
      (explicitFalse.value.entity.payload as { readonly shared?: boolean }).shared,
    ).toBeUndefined();
    expect(decoder.decode(shared.value.bytes)).toContain("shared: true");
  });

  test("projects long nested identities through short stable file-local item markers", () => {
    const id = entityId("67");
    const longId =
      "observation:workspace:candidate.action.0123456789abcdef0123456789abcdef0123456789abcdef";
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const encoded = store.serialize(
      component(id, { actions: [{ id: longId, name: "Serve request" }], name: "API" }),
      [],
    );
    if (!encoded.ok) throw new Error(encoded.diagnostics[0]?.message);
    const text = decoder.decode(encoded.value.bytes);
    expect(text).toMatch(/itemIds:\n  actions:\n    serve-request-[0-9a-f]{16}:/u);
    expect(text).toMatch(/- `serve-request-[0-9a-f]{16}`: Serve request/u);
    expect(text.match(/observation:workspace/gu)).toHaveLength(1);
    expect(text).not.toContain("`observation%3A");
    const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
    if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
    expect((decoded.value.entity.payload as { actions: [{ id: string }] }).actions[0]?.id).toBe(
      longId,
    );
  });

  test("distinguishes omitted, empty, and trailing-newline prose", () => {
    const id = entityId("70");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    for (const intent of [
      undefined,
      "",
      "line",
      "line\n",
      "line\n\n",
      "# Inputs\n\nprose",
    ] as const) {
      const encoded = store.serialize(component(id, intent === undefined ? {} : { intent }), []);
      if (!encoded.ok) throw new Error("expected serialization");
      const decoded = store.decode(encoded.value.locator, encoded.value.bytes);
      if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
      expect((decoded.value.entity.payload as { readonly intent?: string }).intent).toBe(intent);
    }
  });

  test("derives identity only from frontmatter when a file is hand-renamed", () => {
    const id = entityId("80");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const locator = workspaceResourceLocator("groma", "components", "Hand moved.md");
    if (!locator.ok) throw new Error("expected locator");
    const decoded = store.decode(
      locator.value,
      encoder.encode(
        `---\nid: ${id}\n---\n\n# Hand formatted\n\n## Purpose\n\nArchitecture prose.\n`,
      ),
    );
    if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message);
    expect(decoded.value.entity.id).toBe(id);
    expect(String(decoded.value.locator)).toBe("groma/components/Hand moved.md");
    expect(String(decoded.value.resource)).toBe(`component:${id}`);
  });

  test("fails closed on old schemas, malformed body metadata, conflicts, and lossy Unicode", () => {
    const id = entityId("90");
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: {} as never,
    });
    const locator = workspaceResourceLocator("groma", "components", `${id}.md`);
    if (!locator.ok) throw new Error("expected locator");
    const cases = [
      ["unexpected-intent-field", `---\nschema: groma/component/v0.2\nid: ${id}\n---\n`],
      ["invalid-intent-markdown", `---\nid: ${id}\n---\n\n# Broken\n\n## Inputs\n\n- Missing id\n`],
      [
        "intent-conflict-marker",
        `---\nid: ${id}\n---\n\n# Broken\n\n## Purpose\n\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n`,
      ],
    ] as const;
    for (const [code, source] of cases) {
      expect(store.decode(locator.value, encoder.encode(source))).toMatchObject({
        diagnostics: [{ code }],
        ok: false,
      });
    }
    expect(store.serialize(component(id, { intent: "broken\ud800" }), [])).toMatchObject({
      diagnostics: [{ code: "invalid-intent-unicode" }],
      ok: false,
    });
  });
});

describe("provider-backed readable component store", () => {
  test("loads recursive folders and keeps hand-moved files bound to their embedded ids", async () => {
    const provider = await resources();
    const model = createStandardModelCapability();
    const store = createMarkdownIntentStore({ model, resources: provider });
    const root = component(entityId("a0"), { name: "Platform" });
    const child = component(entityId("a1"), { name: "Orders", parent: root.id });
    const labels = componentLabels([root, child]);
    const locations = store.locations([root, child]);
    if (!locations.ok) throw new Error(locations.diagnostics[0]?.message);
    for (const entity of [root, child]) {
      const locator = locations.value.find((entry) => entry.id === entity.id)!.locator;
      const encoded = store.serialize(entity, [], locator, labels);
      if (!encoded.ok) throw new Error(encoded.diagnostics[0]?.message);
      await publish(provider, String(locator), encoded.value.bytes);
    }
    const loaded = await store.load();
    if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.message);
    expect(loaded.value.documents.map((document) => String(document.locator))).toEqual([
      "groma/components/Platform.md",
      "groma/components/Platform/Orders.md",
    ]);
    expect(loaded.value.documents.map((document) => String(document.resource))).toEqual([
      `component:${root.id}`,
      `component:${child.id}`,
    ]);
    const movedLocator = workspaceResourceLocator("groma", "components", "Moved.md");
    if (!movedLocator.ok) throw new Error("expected moved locator");
    const moved = store.serialize(child, [], movedLocator.value, labels);
    if (!moved.ok) throw new Error(moved.diagnostics[0]?.message);
    await publish(provider, "groma/components/Moved.md", moved.value.bytes);
    const original = workspaceResourceLocator("groma", "components", "Platform", "Orders.md");
    if (!original.ok) throw new Error("expected locator");
    expect((await provider.removeResource(original.value)).state).toBe("committed");
    const reloaded = await store.load();
    if (!reloaded.ok) throw new Error(reloaded.diagnostics[0]?.message);
    expect(
      String(reloaded.value.documents.find((document) => document.entity.id === child.id)?.locator),
    ).toBe("groma/components/Moved.md");
    const read = await store.read(child.id);
    if (!read.ok) throw new Error(read.diagnostics[0]?.message);
    expect(read.value.entity.id).toBe(child.id);
  });

  test("rejects duplicate embedded identities regardless of filenames", async () => {
    const provider = await resources();
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: provider,
    });
    const id = entityId("b0");
    const encoded = store.serialize(component(id, { name: "Duplicate" }), []);
    if (!encoded.ok) throw new Error("expected serialization");
    await publish(provider, "groma/components/First.md", encoded.value.bytes);
    await publish(provider, "groma/components/Second.md", encoded.value.bytes);
    expect(await store.load()).toMatchObject({
      diagnostics: [{ code: "duplicate-intent-entity", details: { id } }],
      ok: false,
    });
  });

  test("ignores only documented incidental operating-system metadata", async () => {
    const provider = await resources();
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: provider,
    });
    const id = entityId("b1");
    const encoded = store.serialize(component(id, { name: "Platform" }), []);
    if (!encoded.ok) throw new Error("expected serialization");
    await publish(provider, "groma/components/Platform.md", encoded.value.bytes);
    await publish(provider, "groma/components/.DS_Store", encoder.encode("finder"));
    await publish(provider, "groma/components/Platform/Thumbs.db", encoder.encode("explorer"));
    await publish(provider, "groma/components/Platform/desktop.ini", encoder.encode("shell"));

    const loaded = await store.load();

    expect(loaded).toMatchObject({ ok: true });
    if (!loaded.ok) return;
    expect(loaded.value.documents.map((document) => String(document.locator))).toEqual([
      "groma/components/Platform.md",
    ]);
  });

  test("validates parents, containment cycles, relationship targets, and sibling collisions", async () => {
    const scenarios: readonly {
      code: string;
      entities: readonly GraphEntity[];
      relations?: ReadonlyMap<string, readonly GraphRelation[]>;
    }[] = [
      {
        code: "unknown-intent-parent",
        entities: [component(entityId("c0"), { name: "Orphan", parent: entityId("cf") })],
      },
      {
        code: "intent-containment-cycle",
        entities: [
          component(entityId("c1"), { name: "One", parent: entityId("c2") }),
          component(entityId("c2"), { name: "Two", parent: entityId("c1") }),
        ],
      },
      {
        code: "unknown-intent-relation-target",
        entities: [component(entityId("c3"), { name: "Source" })],
        relations: new Map([
          [
            entityId("c3"),
            [
              {
                id: relationId("c4"),
                payload: {},
                source: entityId("c3"),
                target: entityId("cf"),
                type: "uses",
              },
            ],
          ],
        ]),
      },
    ];
    for (const scenario of scenarios) {
      const provider = await resources();
      const store = createMarkdownIntentStore({
        model: createStandardModelCapability(),
        resources: provider,
      });
      for (const entity of scenario.entities) {
        const labels = componentLabels(scenario.entities, [[entityId("cf"), "Missing"]]);
        const encoded = store.serialize(
          entity,
          scenario.relations?.get(entity.id) ?? [],
          undefined,
          labels,
        );
        if (!encoded.ok) throw new Error(encoded.diagnostics[0]?.message);
        await publish(provider, String(encoded.value.locator), encoded.value.bytes);
      }
      expect(await store.load()).toMatchObject({
        diagnostics: [{ code: scenario.code }],
        ok: false,
      });
    }
  });

  test("rejects non-Markdown files and enforces document bounds", async () => {
    const provider = await resources();
    await publish(provider, "groma/components/readme.json", encoder.encode("{}\n"));
    const store = createMarkdownIntentStore({
      model: createStandardModelCapability(),
      resources: provider,
    });
    expect(await store.load()).toMatchObject({
      diagnostics: [
        {
          code: "unexpected-intent-resource",
          details: { kind: "file", locator: "groma/components/readme.json" },
          message:
            "Component folders contain an unexpected file at groma/components/readme.json; remove it or move it outside groma/components",
        },
      ],
      ok: false,
    });

    const boundedProvider = await resources();
    const bounded = createMarkdownIntentStore({
      bounds: { maxDocumentBytes: 16 },
      model: createStandardModelCapability(),
      resources: boundedProvider,
    });
    expect(bounded.serialize(component(entityId("d0"), { name: "Too large" }), [])).toMatchObject({
      diagnostics: [{ code: "resource-too-large" }],
      ok: false,
    });
  });
});
