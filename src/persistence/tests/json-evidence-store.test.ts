import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { GraphData } from "../../core/index.ts";
import {
  createJsonEvidenceStore,
  createLocalResourceProvider,
  jsonEvidenceIndexLocator,
  jsonEvidenceSourceLocator,
  type JsonEvidenceDocument,
} from "../index.ts";

const roots: string[] = [];
const decoder = new TextDecoder();

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-json-evidence-"));
  roots.push(workspaceRoot);
  const resources = await createLocalResourceProvider({ workspaceRoot });
  return { resources, store: createJsonEvidenceStore({ resources }) };
}

function state(sources: readonly GraphData[]): GraphData {
  return Object.freeze({ sources: Object.freeze(sources), version: 1 });
}

async function publish(
  resources: Awaited<ReturnType<typeof createLocalResourceProvider>>,
  documents: readonly JsonEvidenceDocument[],
) {
  for (const document of documents) {
    const staged = await resources.stageReplacement(document.locator, document.bytes);
    if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
    expect((await resources.commitReplacement(staged.value)).state).toBe("committed");
  }
}

describe("deterministic JSON evidence store", () => {
  test("round-trips one bounded shard per source with a canonical index", async () => {
    const { resources, store } = await fixture();
    const input = state([
      Object.freeze({ records: Object.freeze([{ key: "b" }]), sourceKey: "source-b" }),
      Object.freeze({ records: Object.freeze([{ key: "a" }]), sourceKey: "source-a" }),
    ]);
    const serialized = store.serialize(input);
    expect(serialized.ok).toBeTrue();
    if (!serialized.ok) return;
    expect(serialized.value.documents).toHaveLength(3);
    const index = jsonEvidenceIndexLocator();
    expect(index.ok).toBeTrue();
    if (!index.ok) return;
    const indexDocument = serialized.value.documents.find(
      (document) => document.locator === index.value,
    );
    expect(indexDocument).toBeDefined();
    if (indexDocument === undefined) return;
    expect(decoder.decode(indexDocument.bytes)).toContain('"schema": "groma/evidence-index/v0.2"');
    expect(decoder.decode(indexDocument.bytes).indexOf("source-a")).toBeLessThan(
      decoder.decode(indexDocument.bytes).indexOf("source-b"),
    );

    await publish(resources, serialized.value.documents);
    expect(await store.load()).toMatchObject({
      ok: true,
      value: {
        documents: { length: 3 },
        state: {
          sources: [
            { records: [{ key: "a" }], sourceKey: "source-a" },
            { records: [{ key: "b" }], sourceKey: "source-b" },
          ],
          version: 1,
        },
      },
    });
  });

  test("keeps the index and unrelated source shard byte-stable on a routine rescan", async () => {
    const { store } = await fixture();
    const before = store.serialize(
      state([
        Object.freeze({ records: Object.freeze([{ key: "a", value: 1 }]), sourceKey: "source-a" }),
        Object.freeze({ records: Object.freeze([{ key: "b", value: 1 }]), sourceKey: "source-b" }),
      ]),
    );
    const after = store.serialize(
      state([
        Object.freeze({ records: Object.freeze([{ key: "a", value: 2 }]), sourceKey: "source-a" }),
        Object.freeze({ records: Object.freeze([{ key: "b", value: 1 }]), sourceKey: "source-b" }),
      ]),
    );
    expect(before.ok).toBeTrue();
    expect(after.ok).toBeTrue();
    if (!before.ok || !after.ok) return;
    const beforeRevisions = new Map(
      before.value.documents.map((document) => [String(document.locator), document.revision]),
    );
    const changed = after.value.documents
      .filter((document) => beforeRevisions.get(String(document.locator)) !== document.revision)
      .map((document) => String(document.locator));
    const sourceA = jsonEvidenceSourceLocator("source-a");
    expect(sourceA.ok).toBeTrue();
    if (!sourceA.ok) return;
    expect(changed).toEqual([String(sourceA.value)]);
  });

  test("rejects a source shard beyond its explicit byte bound", async () => {
    const { resources } = await fixture();
    const store = createJsonEvidenceStore({
      bounds: { maxIndexBytes: 256, maxShardBytes: 256, maxTotalBytes: 1024 },
      resources,
    });
    expect(
      store.serialize(state([Object.freeze({ detail: "x".repeat(512), sourceKey: "source-a" })])),
    ).toMatchObject({ diagnostics: [{ code: "evidence-shard-too-large" }], ok: false });
  });
});
