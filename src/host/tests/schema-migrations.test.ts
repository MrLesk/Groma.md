import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createSchemaMigrationOperations,
  type CanonicalMigrationCatalogCapability,
} from "../../application/index.ts";
import {
  canonicalSchemaMigrationApiVersion,
  failure,
  success,
  TransactionEngine,
  type CanonicalSchemaMigrationContribution,
  type CanonicalSchemaMigrationInput,
} from "../../core/index.ts";
import {
  createCanonicalMigrationTransactionAdapter,
  createLocalCanonicalMigrationCatalog,
  createLocalResourceProvider,
  createLocalTransactionJournal,
} from "../../persistence/index.ts";

const roots: string[] = [];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "groma-schema-migration-"));
  roots.push(root);
  await mkdir(path.join(root, "groma", "intent", "00"), { recursive: true });
  return root;
}

const contribution: CanonicalSchemaMigrationContribution = Object.freeze({
  apiVersion: canonicalSchemaMigrationApiVersion,
  id: "test.schemas",
  migrators: Object.freeze([
    Object.freeze({
      fromSchema: "groma/v0",
      fromVersion: 0,
      id: "test.intent-v0-to-v1",
      migrate: (input: CanonicalSchemaMigrationInput) =>
        success({
          bytes: encoder.encode(decoder.decode(input.bytes).replace("groma/v0", "groma/v0.1")),
        }),
      toSchema: "groma/v0.1",
      toVersion: 1,
    }),
    Object.freeze({
      fromSchema: "groma/aliases/v0",
      fromVersion: 0,
      id: "test.aliases-v0-to-v1",
      migrate: (input: CanonicalSchemaMigrationInput) =>
        success({
          bytes: encoder.encode(
            decoder.decode(input.bytes).replace("groma/aliases/v0", "groma/aliases/v0.1"),
          ),
        }),
      toSchema: "groma/aliases/v0.1",
      toVersion: 1,
    }),
  ]),
  schemas: Object.freeze([
    Object.freeze({ schema: "groma/v0", version: 0 }),
    Object.freeze({ schema: "groma/v0.1", version: 1 }),
    Object.freeze({ schema: "groma/aliases/v0", version: 0 }),
    Object.freeze({ schema: "groma/aliases/v0.1", version: 1 }),
    Object.freeze({ schema: "groma.packages-lock/v1", version: 1 }),
  ]),
});

function operations(
  catalog: CanonicalMigrationCatalogCapability,
  provider: ReturnType<typeof createLocalTransactionJournal>,
) {
  return createSchemaMigrationOperations({
    bounds: {
      maxContributions: 4,
      maxDocumentBytes: 1024 * 1024,
      maxMigrators: 8,
      maxPathCandidates: 2,
      maxPathExpansions: 128,
      maxPathSteps: 8,
      maxSchemas: 8,
      maxTokenCharacters: 128,
      maxTotalBytes: 4 * 1024 * 1024,
    },
    catalog,
    contributions: Object.freeze([contribution]),
    targetVersion: 1,
    transactionExecution: new TransactionEngine({
      maxAffectedIdentities: 1,
      maxRequestDataDepth: 30,
      maxRequestDataValues: 10_000,
      maxSnapshotStateDepth: 30,
      maxSnapshotStateValues: 10_000,
      provider,
    }),
  });
}

describe("local canonical migration persistence", () => {
  test("catalogs every official canonical resource and excludes recovery and unrelated files", async () => {
    const root = await temporaryRoot();
    const entity = "ent_00000000000000000000000000000000";
    await mkdir(path.join(root, "groma", "records", "plugin.example"), { recursive: true });
    await mkdir(path.join(root, "groma", "evidence", "sources", "aa"), { recursive: true });
    await mkdir(path.join(root, "groma", "evidence", "shards"), { recursive: true });
    await mkdir(path.join(root, "groma", "bindings", "shards"), { recursive: true });
    await mkdir(path.join(root, "groma", "notes", "a", "b", "c", "d"), { recursive: true });
    await Promise.all([
      writeFile(path.join(root, "groma", "groma.yaml"), "schema: groma/v0.1\n"),
      writeFile(
        path.join(root, "groma", "packages.lock"),
        '{\n  "packages": [],\n  "schema": "groma.packages-lock/v1"\n}\n',
      ),
      writeFile(
        path.join(root, "groma", "aliases.md"),
        "---\nschema: groma/aliases/v0.1\naliases: []\n---\n",
      ),
      writeFile(
        path.join(root, "groma", "intent", "00", `${entity}.md`),
        "---\nschema: groma/v0.1\n---\n",
      ),
      writeFile(
        path.join(root, "groma", "evidence", "sources", "aa", `${"a".repeat(64)}.md`),
        "---\nschema: groma/evidence-source/v0.1\n---\n",
      ),
      writeFile(
        path.join(root, "groma", "evidence", "shards", "00.md"),
        "---\nschema: groma/evidence-shard/v0.1\n---\n",
      ),
      writeFile(
        path.join(root, "groma", "bindings", "shards", "00.md"),
        "---\nschema: groma/binding-shard/v0.1\n---\n",
      ),
      writeFile(path.join(root, "groma", "transaction-state.json"), "not catalogued\n"),
      writeFile(path.join(root, "groma", "notes.md"), "not canonical\n"),
      writeFile(path.join(root, "groma", "notes", "a", "b", "c", "d", "ignored.md"), "ignored\n"),
      writeFile(
        path.join(root, "groma", "records", "plugin.example", "state.json"),
        '{"schema":"plugin.example/v1","value":true}\n',
      ),
    ]);
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const catalog = createLocalCanonicalMigrationCatalog({ resources });

    const loaded = await catalog.load();

    expect(loaded.ok).toBeTrue();
    if (loaded.ok) {
      expect(loaded.value.resources.map((entry) => String(entry.locator))).toEqual([
        "groma/aliases.md",
        "groma/bindings/shards/00.md",
        `groma/evidence/shards/00.md`,
        `groma/evidence/sources/aa/${"a".repeat(64)}.md`,
        "groma/groma.yaml",
        `groma/intent/00/${entity}.md`,
        "groma/packages.lock",
        "groma/records/plugin.example/state.json",
      ]);
      expect(loaded.value.resources.map((entry) => entry.schema)).toEqual([
        "groma/aliases/v0.1",
        "groma/binding-shard/v0.1",
        "groma/evidence-shard/v0.1",
        "groma/evidence-source/v0.1",
        "groma/v0.1",
        "groma/v0.1",
        "groma.packages-lock/v1",
        "plugin.example/v1",
      ]);
    }
  });

  test("does not spend canonical bounds on oversized unrelated trees", async () => {
    const root = await temporaryRoot();
    const cache = path.join(root, "groma", "cache");
    await mkdir(cache, { recursive: true });
    await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        writeFile(path.join(cache, `ignored-${index}.txt`), "ignored\n"),
      ),
    );
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const catalog = createLocalCanonicalMigrationCatalog({
      bounds: { maxEntriesPerDirectory: 3, pageSize: 1 },
      resources,
    });

    expect(await catalog.load()).toEqual({ ok: true, value: { resources: [] } });
  });

  test("keeps a disappearing canonical plane retryable as a provider failure", async () => {
    const root = await temporaryRoot();
    const entity = "ent_00000000000000000000000000000000";
    await writeFile(
      path.join(root, "groma", "intent", "00", `${entity}.md`),
      "---\nschema: groma/v0.1\n---\n",
    );
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    let enumerationCalls = 0;
    const racingResources = Object.freeze({
      enumerate: async (request: Parameters<typeof resources.enumerate>[0]) => {
        enumerationCalls += 1;
        return enumerationCalls === 2
          ? failure({ code: "resource-missing", message: "Plane disappeared" })
          : resources.enumerate(request);
      },
      read: (request: Parameters<typeof resources.read>[0]) => resources.read(request),
    });
    const catalog = createLocalCanonicalMigrationCatalog({
      bounds: { pageSize: 1 },
      resources: racingResources,
    });

    expect(await catalog.load()).toMatchObject({
      diagnostics: [{ code: "migration-resource-provider-failure" }],
      ok: false,
    });
    expect(enumerationCalls).toBe(2);
  });

  test("fails closed on canonical-plane depth truncation and entry overflow", async () => {
    for (const relative of [
      ["intent", "00", "nested", "leaf.md"],
      ["records", "plugin.example", "nested", "leaf.json"],
    ]) {
      const root = await temporaryRoot();
      const file = path.join(root, "groma", ...relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "ignored\n");
      const resources = await createLocalResourceProvider({ workspaceRoot: root });
      const catalog = createLocalCanonicalMigrationCatalog({ resources });

      expect(await catalog.load(), relative.join("/")).toMatchObject({
        diagnostics: [{ code: "migration-resource-enumeration-incomplete" }],
        ok: false,
      });
    }

    for (const relative of [
      ["evidence", "sources", "00", "nested", "leaf.md"],
      ["bindings", "shards", "nested", "leaf.md"],
    ]) {
      const root = await temporaryRoot();
      const file = path.join(root, "groma", ...relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "ignored\n");
      const resources = await createLocalResourceProvider({ workspaceRoot: root });
      const catalog = createLocalCanonicalMigrationCatalog({ resources });

      expect(await catalog.load(), relative.join("/")).toMatchObject({ ok: false });
    }

    const root = await temporaryRoot();
    const shard = path.join(root, "groma", "intent", "00");
    await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        writeFile(
          path.join(shard, `ent_${index.toString(16).padStart(32, "0")}.md`),
          "---\nschema: groma/v0.1\n---\n",
        ),
      ),
    );
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const catalog = createLocalCanonicalMigrationCatalog({
      bounds: { maxEntriesPerDirectory: 3, pageSize: 1 },
      resources,
    });

    expect(await catalog.load()).toMatchObject({
      diagnostics: [{ code: "resource-directory-overflow" }],
      ok: false,
    });

    const malformedRoot = await temporaryRoot();
    await writeFile(path.join(malformedRoot, "groma", "intent", "readme.md"), "ignored\n");
    const malformedResources = await createLocalResourceProvider({
      workspaceRoot: malformedRoot,
    });
    const malformedCatalog = createLocalCanonicalMigrationCatalog({
      resources: malformedResources,
    });
    expect(await malformedCatalog.load()).toMatchObject({
      diagnostics: [{ code: "migration-resource-layout-invalid" }],
      ok: false,
    });
  });

  test("rejects duplicate schema declarations instead of choosing one", async () => {
    const root = await temporaryRoot();
    const configuration = path.join(root, "groma", "groma.yaml");
    await writeFile(configuration, "schema: groma/v0.1\nschema: groma/v0\n");
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const catalog = createLocalCanonicalMigrationCatalog({ resources });

    expect(await catalog.load()).toMatchObject({
      diagnostics: [{ code: "migration-resource-schema-unavailable" }],
      ok: false,
    });
  });

  test("publishes all changed canonical bytes through one journal generation", async () => {
    const root = await temporaryRoot();
    const entity = "ent_00000000000000000000000000000000";
    const aliasFile = path.join(root, "groma", "aliases.md");
    const intentFile = path.join(root, "groma", "intent", "00", `${entity}.md`);
    await Promise.all([
      writeFile(path.join(root, "groma", "groma.yaml"), "schema: groma/v0.1\n"),
      writeFile(aliasFile, "---\naliases: []\nschema: 'groma/aliases/v0'\n---\n"),
      writeFile(intentFile, "---\nschema: groma/v0\n---\n"),
    ]);
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const catalog = createLocalCanonicalMigrationCatalog({ resources });
    const provider = createLocalTransactionJournal({
      adapter: createCanonicalMigrationTransactionAdapter(catalog),
      resources,
    });

    const applied = await operations(catalog, provider).apply();

    expect(applied).toMatchObject({ generation: 1, status: "applied" });
    expect(await readFile(aliasFile, "utf8")).toContain("schema: 'groma/aliases/v0.1'");
    expect(await readFile(intentFile, "utf8")).toContain("schema: groma/v0.1");
    const current = await operations(catalog, provider).apply();
    expect(current).toMatchObject({ status: "current" });
  });

  test("rejects partial or unrelated target sets against the complete catalog", async () => {
    const root = await temporaryRoot();
    const entity = "ent_00000000000000000000000000000000";
    await Promise.all([
      writeFile(path.join(root, "groma", "groma.yaml"), "schema: groma/v0.1\n"),
      writeFile(
        path.join(root, "groma", "intent", "00", `${entity}.md`),
        "---\nschema: groma/v0\n---\n",
      ),
    ]);
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const catalog = createLocalCanonicalMigrationCatalog({ resources });
    const adapter = createCanonicalMigrationTransactionAdapter(catalog);
    const current = await adapter.load();
    expect(current.ok).toBeTrue();
    if (!current.ok) return;
    const catalogEntries = current.value.resources.map((entry) =>
      Object.freeze({ resource: entry.resource, revision: entry.revision }),
    );
    const first = current.value.resources[0]!;
    const replacement = Buffer.from("schema: groma/v0.1\n").toString("base64url");
    const proposal = {
      affected: {},
      baseGeneration: 0,
      context: {},
      expectedRevisions: [{ expected: first.revision, resource: first.resource }],
      generation: 1,
      mutation: {
        catalog: catalogEntries,
        kind: "canonical-schema-migration",
        targets: [{ locator: first.locator, replacement, resource: first.resource }],
      },
      priorState: current.value.state,
    };

    expect(adapter.materialize(proposal as never, current.value)).toMatchObject({
      diagnostics: [{ code: "migration-resource-set-mismatch" }],
      ok: false,
    });

    const unrelated = "unrelated/new-file.yaml";
    const unrelatedProposal = {
      ...proposal,
      expectedRevisions: [
        { expected: first.revision, resource: first.resource },
        { expected: null, resource: unrelated },
      ],
      mutation: {
        ...proposal.mutation,
        targets: [
          { locator: first.locator, replacement, resource: first.resource },
          { locator: unrelated, replacement, resource: unrelated },
        ],
      },
    };
    expect(adapter.materialize(unrelatedProposal as never, current.value)).toMatchObject({
      diagnostics: [{ code: "migration-resource-set-mismatch" }],
      ok: false,
    });

    const tinyAdapter = createCanonicalMigrationTransactionAdapter(catalog, {
      maxReplacementBytes: 32,
      maxTargetBytes: 32,
      maxTargets: 4,
    });
    const oversizedReplacement = Buffer.alloc(64).toString("base64url");
    const oversizedProposal = {
      ...proposal,
      expectedRevisions: current.value.resources.map((entry) => ({
        expected: entry.revision,
        resource: entry.resource,
      })),
      mutation: {
        ...proposal.mutation,
        targets: current.value.resources.map((entry) => ({
          locator: entry.locator,
          replacement: oversizedReplacement,
          resource: entry.resource,
        })),
      },
    };
    expect(tinyAdapter.materialize(oversizedProposal as never, current.value)).toMatchObject({
      diagnostics: [{ code: "invalid-migration-transaction" }],
      ok: false,
    });
  });

  test("rejects a canonical resource added between snapshot and prepare", async () => {
    const root = await temporaryRoot();
    const entity = "ent_00000000000000000000000000000000";
    const intentFile = path.join(root, "groma", "intent", "00", `${entity}.md`);
    await Promise.all([
      writeFile(path.join(root, "groma", "groma.yaml"), "schema: groma/v0.1\n"),
      writeFile(intentFile, "---\nschema: groma/v0\n---\n"),
    ]);
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const baseCatalog = createLocalCanonicalMigrationCatalog({ resources });
    let loads = 0;
    const racingCatalog = Object.freeze({
      inspect: baseCatalog.inspect,
      load: async () => {
        loads += 1;
        if (loads === 3) {
          const directory = path.join(root, "groma", "records", "plugin.example");
          await mkdir(directory, { recursive: true });
          await writeFile(
            path.join(directory, "added.json"),
            '{"schema":"plugin.example/v1","value":true}\n',
          );
        }
        return baseCatalog.load();
      },
    });
    const provider = createLocalTransactionJournal({
      adapter: createCanonicalMigrationTransactionAdapter(racingCatalog),
      resources,
    });

    expect(await operations(racingCatalog, provider).apply()).toMatchObject({
      phase: "prepare",
      status: "provider-failure",
    });
    expect(loads).toBe(3);
    expect(await readFile(intentFile, "utf8")).toContain("schema: groma/v0\n");
  });

  test("rejects a canonical resource removed between snapshot and prepare", async () => {
    const root = await temporaryRoot();
    const entity = "ent_00000000000000000000000000000000";
    const aliasFile = path.join(root, "groma", "aliases.md");
    const intentFile = path.join(root, "groma", "intent", "00", `${entity}.md`);
    await Promise.all([
      writeFile(aliasFile, "---\nschema: groma/aliases/v0\naliases: []\n---\n"),
      writeFile(intentFile, "---\nschema: groma/v0\n---\n"),
    ]);
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const baseCatalog = createLocalCanonicalMigrationCatalog({ resources });
    let loads = 0;
    const racingCatalog = Object.freeze({
      inspect: baseCatalog.inspect,
      load: async () => {
        loads += 1;
        if (loads === 3) await rm(aliasFile);
        return baseCatalog.load();
      },
    });
    const provider = createLocalTransactionJournal({
      adapter: createCanonicalMigrationTransactionAdapter(racingCatalog),
      resources,
    });

    expect(await operations(racingCatalog, provider).apply()).toMatchObject({
      diagnostics: [{ code: "content-revision-conflict" }],
      status: "conflict",
    });
    expect(loads).toBe(3);
    expect(await readFile(intentFile, "utf8")).toContain("schema: groma/v0\n");
  });

  test("restarts an interrupted multi-resource migration from the durable journal", async () => {
    const root = await temporaryRoot();
    const entity = "ent_00000000000000000000000000000000";
    const aliasFile = path.join(root, "groma", "aliases.md");
    const intentFile = path.join(root, "groma", "intent", "00", `${entity}.md`);
    await Promise.all([
      writeFile(path.join(root, "groma", "groma.yaml"), "schema: groma/v0.1\n"),
      writeFile(aliasFile, "---\nschema: groma/aliases/v0\naliases: []\n---\n"),
      writeFile(intentFile, "---\nschema: groma/v0\n---\n"),
    ]);
    const firstResources = await createLocalResourceProvider({ workspaceRoot: root });
    const firstCatalog = createLocalCanonicalMigrationCatalog({ resources: firstResources });
    let interrupted = false;
    const firstProvider = createLocalTransactionJournal({
      adapter: createCanonicalMigrationTransactionAdapter(firstCatalog),
      faultInjector: (phase, index) => {
        if (!interrupted && phase === "after-target" && index === 0) {
          interrupted = true;
          throw new Error("simulated process interruption");
        }
      },
      resources: firstResources,
    });

    expect(await operations(firstCatalog, firstProvider).apply()).toMatchObject({
      status: "indeterminate",
    });

    const restartedResources = await createLocalResourceProvider({ workspaceRoot: root });
    const restartedCatalog = createLocalCanonicalMigrationCatalog({
      resources: restartedResources,
    });
    const restartedProvider = createLocalTransactionJournal({
      adapter: createCanonicalMigrationTransactionAdapter(restartedCatalog),
      resources: restartedResources,
    });
    const settled = await restartedProvider.snapshot([]);

    expect(settled.generation).toBe(1);
    expect(await readFile(aliasFile, "utf8")).toContain("schema: groma/aliases/v0.1");
    expect(await readFile(intentFile, "utf8")).toContain("schema: groma/v0.1");
    expect(await operations(restartedCatalog, restartedProvider).apply()).toMatchObject({
      status: "current",
    });
  });
});
