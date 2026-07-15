import { describe, expect, test } from "bun:test";

import {
  canonicalSchemaMigrationApiVersion,
  failure,
  parseContentRevision,
  parseResourceKey,
  success,
  type CanonicalSchemaMigrationContribution,
  type CanonicalSchemaDefinition,
  type CanonicalSchemaMigrationInput,
  type TransactionOutcome,
} from "../../core/index.ts";
import {
  createSchemaMigrationOperations,
  type CanonicalMigrationCatalogCapability,
  type CanonicalMigrationResource,
  type SchemaMigrationBounds,
} from "../schema-migrations.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function resource(locator: string, schema: string): CanonicalMigrationResource {
  const bytes = encoder.encode(`schema: ${schema}\nname: Example\n`);
  const revision = parseContentRevision(`sha256:${"0".repeat(64)}`);
  const key = parseResourceKey(locator);
  if (!revision.ok || !key.ok) throw new Error("fixture resource is invalid");
  return Object.freeze({ bytes, locator, resource: key.value, revision: revision.value, schema });
}

function contribution(
  migrators: CanonicalSchemaMigrationContribution["migrators"] = Object.freeze([
    Object.freeze({
      fromSchema: "example/v0",
      fromVersion: 0,
      id: "example.zero-to-one",
      migrate: (input: CanonicalSchemaMigrationInput) =>
        success(
          Object.freeze({
            bytes: encoder.encode(decoder.decode(input.bytes).replace("example/v0", "example/v1")),
          }),
        ),
      toSchema: "example/v1",
      toVersion: 1,
    }),
  ]),
): CanonicalSchemaMigrationContribution {
  return Object.freeze({
    apiVersion: canonicalSchemaMigrationApiVersion,
    id: "example.schemas",
    migrators,
    schemas: Object.freeze([
      Object.freeze({ schema: "example/v0", version: 0 }),
      Object.freeze({ schema: "example/v1", version: 1 }),
      Object.freeze({ schema: "example/v2", version: 2 }),
    ]),
  });
}

function harness(
  resources: readonly CanonicalMigrationResource[],
  contributions: readonly unknown[] = Object.freeze([contribution()]),
  execute: (request: unknown) => Promise<TransactionOutcome> = async () =>
    ({
      event: { affected: { entities: [], relations: [] }, generation: 1 },
      generation: 1,
      revisions: [],
      status: "committed",
    }) as unknown as TransactionOutcome,
  options: {
    readonly bounds?: Partial<SchemaMigrationBounds>;
    readonly catalog?: CanonicalMigrationCatalogCapability;
    readonly targetVersion?: number;
  } = Object.freeze({}),
) {
  const catalog: CanonicalMigrationCatalogCapability =
    options.catalog ??
    Object.freeze({
      inspect: (_locator: string, bytes: Uint8Array) => {
        const schema = decoder.decode(bytes).match(/^schema: ([^\n]+)$/m)?.[1];
        return schema === undefined ? { diagnostics: [], ok: false as const } : success({ schema });
      },
      load: async () => success(Object.freeze({ resources: Object.freeze([...resources]) })),
    });
  return createSchemaMigrationOperations({
    bounds: {
      maxContributions: 8,
      maxDocumentBytes: 1024,
      maxMigrators: 16,
      maxPathCandidates: 2,
      maxPathExpansions: 128,
      maxPathSteps: 8,
      maxSchemas: 16,
      maxTokenCharacters: 128,
      maxTotalBytes: 4096,
      ...options.bounds,
    },
    catalog,
    contributions,
    targetVersion: options.targetVersion ?? 1,
    transactionExecution: { execute: execute as never },
  });
}

describe("schema migration operations", () => {
  test("reports floor, document versions, mixed state, incompatibility, and complete paths", async () => {
    const operations = harness([
      resource("groma/groma.yaml", "example/v1"),
      resource("groma/aliases.md", "example/v0"),
      resource("groma/packages.lock", "example/v2"),
    ]);

    const status = await operations.status();

    expect(status).toMatchObject({
      ok: true,
      value: {
        completePath: false,
        documentVersions: [0, 1, 2],
        mixedVersions: true,
        schemaFloor: 0,
        targetVersion: 1,
      },
    });
    if (status.ok) {
      expect(status.value.resources.map((entry) => entry.path)).toEqual([
        "complete",
        "complete",
        "incompatible",
      ]);
    }
  });

  test("preview lists current and changed resources without publishing writes", async () => {
    let executions = 0;
    let migrations = 0;
    const base = contribution();
    const tracked = contribution(
      Object.freeze([
        Object.freeze({
          ...base.migrators[0]!,
          migrate: (input: Parameters<(typeof base.migrators)[number]["migrate"]>[0]) => {
            migrations += 1;
            return base.migrators[0]!.migrate(input);
          },
        }),
      ]),
    );
    const operations = harness(
      [resource("groma/aliases.md", "example/v0"), resource("groma/groma.yaml", "example/v1")],
      [tracked],
      async () => {
        executions += 1;
        throw new Error("preview must not execute a transaction");
      },
    );

    const preview = await operations.preview();

    expect(preview).toMatchObject({
      ok: true,
      value: {
        resources: [
          { changed: true, locator: "groma/aliases.md", migrators: ["example.zero-to-one"] },
          { changed: false, locator: "groma/groma.yaml", migrators: [] },
        ],
      },
    });
    expect(migrations).toBe(2);
    expect(executions).toBe(0);
  });

  test("preserves catalog provider failures while keeping migration validation semantic", async () => {
    const unavailable = Object.freeze({
      code: "resource-provider-failure",
      message: "Transient catalog read failed",
    });
    const loadFailure: CanonicalMigrationCatalogCapability = Object.freeze({
      inspect: () => success({ schema: "example/v1" }),
      load: async () => failure(unavailable),
    });
    const loadFailed = harness([], [contribution()], undefined, { catalog: loadFailure });
    expect(await loadFailed.status()).toEqual(failure(unavailable));
    expect(await loadFailed.preview()).toEqual(failure(unavailable));
    expect(await loadFailed.apply()).toMatchObject({
      diagnostics: [unavailable],
      phase: "snapshot",
      status: "provider-failure",
    });

    const old = resource("groma/groma.yaml", "example/v0");
    const inspectFailure: CanonicalMigrationCatalogCapability = Object.freeze({
      inspect: () => failure(unavailable),
      load: async () => success(Object.freeze({ resources: Object.freeze([old]) })),
    });
    const inspectFailed = harness([old], [contribution()], undefined, { catalog: inspectFailure });
    expect(await inspectFailed.status()).toMatchObject({ ok: true });
    expect(await inspectFailed.preview()).toEqual(failure(unavailable));
    expect(await inspectFailed.apply()).toMatchObject({
      diagnostics: [unavailable],
      phase: "snapshot",
      status: "provider-failure",
    });

    const invalidSchema = Object.freeze({
      code: "migration-resource-schema-unavailable",
      message: "Schema is invalid",
    });
    const invalidLoad: CanonicalMigrationCatalogCapability = Object.freeze({
      inspect: () => success({ schema: "example/v1" }),
      load: async () => failure(invalidSchema),
    });
    expect(
      await harness([], [contribution()], undefined, { catalog: invalidLoad }).apply(),
    ).toMatchObject({
      diagnostics: [invalidSchema],
      status: "validation-rejected",
    });
    const invalidInspect: CanonicalMigrationCatalogCapability = Object.freeze({
      inspect: () => failure(invalidSchema),
      load: async () => success(Object.freeze({ resources: Object.freeze([old]) })),
    });
    expect(
      await harness([old], [contribution()], undefined, { catalog: invalidInspect }).apply(),
    ).toMatchObject({
      diagnostics: [{ code: "schema-migrator-output-incompatible" }],
      status: "validation-rejected",
    });

    expect(await harness([resource("groma/groma.yaml", "unknown/v0")]).apply()).toMatchObject({
      diagnostics: [{ code: "schema-migration-path-missing" }],
      status: "validation-rejected",
    });
  });

  test("fails closed for missing and ambiguous paths before invoking a transaction", async () => {
    let executions = 0;
    const alternative = Object.freeze({
      ...contribution().migrators[0]!,
      id: "example.alternative",
    });
    const ambiguous = contribution(Object.freeze([contribution().migrators[0]!, alternative]));
    const execute = async () => {
      executions += 1;
      throw new Error("invalid plans must not execute");
    };
    const ambiguousPreview = await harness(
      [resource("groma/groma.yaml", "example/v0")],
      [ambiguous],
      execute,
    ).preview();
    const missingPreview = await harness(
      [resource("groma/groma.yaml", "unknown/v0")],
      [contribution()],
      execute,
    ).preview();

    expect(ambiguousPreview).toMatchObject({
      diagnostics: [{ code: "schema-migration-path-ambiguous" }],
      ok: false,
    });
    expect(missingPreview).toMatchObject({
      diagnostics: [{ code: "schema-migration-path-missing" }],
      ok: false,
    });
    expect(executions).toBe(0);
  });

  test("contains throwing and nondeterministic plugin migrators byte-for-byte", async () => {
    let executions = 0;
    let toggle = false;
    const execute = async () => {
      executions += 1;
      throw new Error("failed migrators must not execute");
    };
    const throwing = contribution(
      Object.freeze([
        Object.freeze({
          ...contribution().migrators[0]!,
          migrate: () => {
            throw new Error("plugin failure");
          },
        }),
      ]),
    );
    const nondeterministic = contribution(
      Object.freeze([
        Object.freeze({
          ...contribution().migrators[0]!,
          migrate: () => {
            toggle = !toggle;
            return success({ bytes: encoder.encode(`schema: example/v1\nvalue: ${toggle}\n`) });
          },
        }),
      ]),
    );

    expect(
      await harness([resource("groma/groma.yaml", "example/v0")], [throwing], execute).apply(),
    ).toMatchObject({
      diagnostics: [{ code: "schema-migrator-threw" }],
      status: "validation-rejected",
    });
    expect(
      await harness(
        [resource("groma/groma.yaml", "example/v0")],
        [nondeterministic],
        execute,
      ).apply(),
    ).toMatchObject({
      diagnostics: [{ code: "schema-migrator-nondeterministic" }],
      status: "validation-rejected",
    });
    expect(executions).toBe(0);
  });

  test("contains hostile byte views and aggregate output inflation", async () => {
    class MisreportedBytes extends Uint8Array {
      override get byteLength(): number {
        return 1;
      }
    }
    const oversized = new MisreportedBytes(2_048);
    oversized.set(encoder.encode("schema: example/v1\n"));
    let thenRead = false;
    const hostileView = contribution(
      Object.freeze([
        Object.freeze({
          ...contribution().migrators[0]!,
          migrate: () => success({ bytes: oversized }),
        }),
      ]),
    );
    const hostileThenable = contribution(
      Object.freeze([
        Object.freeze({
          ...contribution().migrators[0]!,
          migrate: () =>
            ({
              then: () => {
                thenRead = true;
              },
            }) as never,
        }),
      ]),
    );
    const inflatedBytes = encoder.encode(`schema: example/v1\n${"x".repeat(870)}`);
    const inflated = contribution(
      Object.freeze([
        Object.freeze({
          ...contribution().migrators[0]!,
          migrate: () => success({ bytes: inflatedBytes }),
        }),
      ]),
    );

    expect(
      await harness([resource("groma/groma.yaml", "example/v0")], [hostileView]).preview(),
    ).toMatchObject({
      diagnostics: [
        {
          code: "schema-migrator-result-invalid",
          details: { locator: "groma/groma.yaml", migrator: "example.zero-to-one" },
        },
      ],
      ok: false,
    });
    expect(
      await harness([resource("groma/groma.yaml", "example/v0")], [hostileThenable]).preview(),
    ).toMatchObject({
      diagnostics: [
        {
          code: "schema-migrator-failed",
          details: { locator: "groma/groma.yaml", migrator: "example.zero-to-one" },
        },
      ],
      ok: false,
    });
    expect(thenRead).toBeFalse();
    expect(
      await harness(
        Array.from({ length: 5 }, (_, index) =>
          resource(`groma/records/example/record-${index}.yaml`, "example/v0"),
        ),
        [inflated],
      ).preview(),
    ).toMatchObject({
      diagnostics: [{ code: "schema-migration-total-bytes-exceeded" }],
      ok: false,
    });
  });

  test("bounds migration-path expansion even when a branching graph has no target", async () => {
    const schemas: CanonicalSchemaDefinition[] = [
      Object.freeze({ schema: "example/start/v0", version: 0 }),
    ];
    const migrators: Array<CanonicalSchemaMigrationContribution["migrators"][number]> = [];
    let prior = ["example/start/v0"];
    for (let version = 1; version <= 5; version += 1) {
      const next = [`example/layer${version}a/v${version}`, `example/layer${version}b/v${version}`];
      for (const schema of next) schemas.push(Object.freeze({ schema, version }));
      for (const fromSchema of prior) {
        for (const toSchema of next) {
          migrators.push(
            Object.freeze({
              fromSchema,
              fromVersion: version - 1,
              id: `example.path.${migrators.length}`,
              migrate: (input: CanonicalSchemaMigrationInput) => success({ bytes: input.bytes }),
              toSchema,
              toVersion: version,
            }),
          );
        }
      }
      prior = next;
    }
    const branching = Object.freeze({
      apiVersion: canonicalSchemaMigrationApiVersion,
      id: "example.branching",
      migrators: Object.freeze(migrators),
      schemas: Object.freeze(schemas),
    });
    const operations = harness(
      [resource("groma/groma.yaml", "example/start/v0")],
      [branching],
      undefined,
      {
        bounds: {
          maxMigrators: 64,
          maxPathExpansions: 5,
          maxPathSteps: 10,
          maxSchemas: 32,
        },
        targetVersion: 6,
      },
    );

    expect(await operations.status()).toMatchObject({
      ok: true,
      value: { completePath: false, resources: [{ path: "bounded" }] },
    });
    expect(await operations.preview()).toMatchObject({
      diagnostics: [{ code: "schema-migration-path-search-exhausted" }],
      ok: false,
    });

    const stepBounded = harness(
      [resource("groma/groma.yaml", "example/start/v0")],
      [branching],
      undefined,
      {
        bounds: {
          maxMigrators: 64,
          maxPathExpansions: 64,
          maxPathSteps: 2,
          maxSchemas: 32,
        },
        targetVersion: 6,
      },
    );
    expect(await stepBounded.status()).toMatchObject({
      ok: true,
      value: { completePath: false, resources: [{ path: "bounded" }] },
    });
    expect(await stepBounded.preview()).toMatchObject({
      diagnostics: [{ code: "schema-migration-path-search-exhausted" }],
      ok: false,
    });
  });

  test("publishes one all-resource batch while reporting only changed bytes", async () => {
    let request: unknown;
    const operations = harness(
      [resource("groma/aliases.md", "example/v0"), resource("groma/groma.yaml", "example/v1")],
      [contribution()],
      async (value) => {
        request = value;
        return {
          event: { affected: { entities: [], relations: [] }, generation: 1 },
          generation: 1,
          revisions: [],
          status: "committed",
        } as unknown as TransactionOutcome;
      },
    );

    expect(await operations.apply()).toMatchObject({ generation: 1, status: "applied" });
    expect(request).toMatchObject({
      affected: {},
      expectedRevisions: [{ resource: "groma/aliases.md" }, { resource: "groma/groma.yaml" }],
      mutation: {
        catalog: [{ resource: "groma/aliases.md" }, { resource: "groma/groma.yaml" }],
        kind: "canonical-schema-migration",
        targets: [
          { locator: "groma/aliases.md", resource: "groma/aliases.md" },
          { locator: "groma/groma.yaml", resource: "groma/groma.yaml" },
        ],
      },
    });
  });
});
