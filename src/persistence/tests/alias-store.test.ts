import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseEntityId, type EntityAlias } from "../../core/index.ts";
import { aliasStoreLocator, createAliasStore, createLocalResourceProvider } from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function id(value: number) {
  const parsed = parseEntityId(`ent_${value.toString(16).padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid test identity");
  return parsed.value;
}

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-alias-store-"));
  roots.push(workspaceRoot);
  const resources = await createLocalResourceProvider({ workspaceRoot });
  return { resources, store: createAliasStore({ resources }), workspaceRoot };
}

describe("canonical alias store", () => {
  test("serializes sorted human-readable records and reloads exact bytes", async () => {
    const { resources, store } = await fixture();
    expect(await store.load()).toMatchObject({ ok: true, value: { aliases: [], revision: null } });
    const aliases: readonly EntityAlias[] = Object.freeze([
      Object.freeze({ source: id(2), target: id(3) }),
      Object.freeze({ source: id(1), target: id(2) }),
    ]);
    const serialized = store.serialize(aliases);
    expect(serialized.ok).toBeTrue();
    if (!serialized.ok || serialized.value.bytes === undefined) return;
    const firstBytes = serialized.value.bytes;
    firstBytes[0] = 0;
    expect(new TextDecoder().decode(serialized.value.bytes)).toBe(
      `---\nschema: groma/aliases/v0.1\naliases:\n  - source: ${id(1)}\n    target: ${id(2)}\n  - source: ${id(2)}\n    target: ${id(3)}\n---\n`,
    );
    const locator = aliasStoreLocator();
    if (!locator.ok) throw new Error("missing alias locator");
    const staged = await resources.stageReplacement(locator.value, serialized.value.bytes);
    if (!staged.ok) throw new Error("could not stage alias fixture");
    expect((await resources.commitReplacement(staged.value)).state).toBe("committed");
    const loaded = await store.load();
    expect(loaded).toMatchObject({
      ok: true,
      value: {
        aliases: [
          { source: id(1), target: id(2) },
          { source: id(2), target: id(3) },
        ],
        revision: serialized.value.revision,
      },
    });
  });

  test("rejects ambiguous, cyclic, self, and unsupported Markdown frontmatter", async () => {
    const { store } = await fixture();
    const document = (body: string) =>
      new TextEncoder().encode(`---\nschema: groma/aliases/v0.1\naliases:\n${body}---\n`);
    for (const [bytes, code] of [
      [document(`  - source: ${id(1)}\n    target: ${id(1)}\n`), "self-component-alias"],
      [
        document(
          `  - source: ${id(1)}\n    target: ${id(2)}\n  - source: ${id(1)}\n    target: ${id(3)}\n`,
        ),
        "ambiguous-component-supersession",
      ],
      [
        document(
          `  - source: ${id(1)}\n    target: ${id(2)}\n  - source: ${id(2)}\n    target: ${id(1)}\n`,
        ),
        "component-alias-cycle",
      ],
      [
        new TextEncoder().encode(
          `---\nschema: groma/aliases/v0.1\naliases: &items\n  - source: ${id(1)}\n    target: ${id(2)}\ncopy: *items\n---\n`,
        ),
        "alias-store-unsupported-yaml",
      ],
    ] as const) {
      expect(store.decode(bytes)).toMatchObject({ diagnostics: [{ code }], ok: false });
    }
    const proxied = new Proxy(new Uint8Array(), {});
    expect(store.decode(proxied)).toMatchObject({
      diagnostics: [{ code: "invalid-alias-store-bytes" }],
      ok: false,
    });
  });

  test("rejects accessor and proxy serialization inputs without retaining them", async () => {
    const { store } = await fixture();
    let getterReads = 0;
    const accessor: Record<string, unknown> = { target: id(2) };
    Object.defineProperty(accessor, "source", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return id(1);
      },
    });
    expect(store.serialize([accessor as never])).toMatchObject({
      diagnostics: [{ code: "invalid-component-alias" }],
      ok: false,
    });
    expect(getterReads).toBe(0);

    const throwingProxy = new Proxy([], {
      getPrototypeOf: () => {
        throw new Error("proxy trap");
      },
    });
    expect(store.serialize(throwingProxy)).toMatchObject({
      diagnostics: [{ code: "invalid-alias-store" }],
      ok: false,
    });
  });

  test("validates a long alias chain within the configured structural bound", async () => {
    const { store } = await fixture();
    const aliases = Object.freeze(
      Array.from({ length: 2_000 }, (_, index) =>
        Object.freeze({ source: id(index + 1), target: id(index + 2) }),
      ),
    );
    const serialized = store.serialize(aliases);
    expect(serialized.ok).toBeTrue();
    if (!serialized.ok || serialized.value.bytes === undefined) return;
    expect(store.decode(serialized.value.bytes)).toMatchObject({
      ok: true,
      value: { aliases: { length: 2_000 } },
    });
  });
});
