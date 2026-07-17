import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BoundedQueryContracts,
  createGraphCommittedEvent,
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseRelationId,
  success,
  type EntityAlias,
  type EntityId,
  type GraphEntity,
  type GraphRelation,
  type ProjectionCanonicalSnapshot,
  type ProjectionCanonicalSource,
  type ProjectionCatalogReadRequest,
  type ProjectionReadCapability,
  type ProjectionReadIdentity,
  type ProjectionRelationReadRequest,
  type ProjectionSnapshot,
} from "../../core/index.ts";
import {
  createLocalProjectionIndex,
  createLocalResourceProvider,
  createProjectionQueryEngine as createRawProjectionQueryEngine,
  DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
  DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
} from "../index.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function entity(value: string) {
  const parsed = parseEntityId(`ent_${value.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid entity fixture");
  return parsed.value;
}

function relation(value: string) {
  const parsed = parseRelationId(`rel_${value.padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid relation fixture");
  return parsed.value;
}

function generation(value: number) {
  const parsed = parseGraphGeneration(value);
  if (!parsed.ok) throw new Error("invalid generation fixture");
  return parsed.value;
}

const ids = Object.freeze({
  a: entity("1"),
  b: entity("2"),
  c: entity("3"),
  d: entity("4"),
  obsolete: entity("9"),
  r1: relation("1"),
  r2: relation("2"),
  r3: relation("3"),
  r4: relation("4"),
});

function graphEntity(id: ReturnType<typeof entity>, name: string, kind = "component"): GraphEntity {
  return Object.freeze({
    id,
    kind,
    payload: Object.freeze({ name, type: kind === "component" ? "service" : "evidence" }),
  });
}

function graphRelation(
  id: ReturnType<typeof relation>,
  source: ReturnType<typeof entity>,
  target: ReturnType<typeof entity>,
  type: string,
): GraphRelation {
  return Object.freeze({ id, payload: Object.freeze({}), source, target, type });
}

function projectionSnapshot(
  generationValue = 7,
  fingerprintValue = "fixture:query-engine",
): ProjectionSnapshot {
  const entities = Object.freeze([
    graphEntity(ids.a, "Order API"),
    graphEntity(ids.b, "Payment Service"),
    graphEntity(ids.c, "Invoice Worker"),
    graphEntity(ids.d, "Order evidence", "evidence"),
  ]);
  const relations = Object.freeze([
    graphRelation(ids.r1, ids.a, ids.b, "requires"),
    graphRelation(ids.r2, ids.b, ids.c, "emits"),
    graphRelation(ids.r3, ids.c, ids.a, "requires"),
    graphRelation(ids.r4, ids.d, ids.b, "requires"),
  ]);
  const projected = Object.freeze(
    entities.map((item) =>
      Object.freeze({
        entity: item,
        searchableText: `${item.id}\n${item.kind}\n${String((item.payload as { name: string }).name)
          .normalize("NFKC")
          .toLowerCase()}\n${String((item.payload as { type: string }).type)}`,
      }),
    ),
  );
  const adjacency = Object.freeze(
    entities.map((item) =>
      Object.freeze({
        entity: item.id,
        incoming: Object.freeze(
          relations.filter((edge) => edge.target === item.id).map((edge) => edge.id),
        ),
        outgoing: Object.freeze(
          relations.filter((edge) => edge.source === item.id).map((edge) => edge.id),
        ),
      }),
    ),
  );
  const fingerprint = parseProjectionCanonicalFingerprint(fingerprintValue);
  if (!fingerprint.ok) throw new Error("invalid fingerprint fixture");
  return Object.freeze({
    adjacency,
    aliases: Object.freeze([{ source: ids.obsolete, target: ids.b }]),
    entities: projected,
    fingerprint: fingerprint.value,
    generation: generation(generationValue),
    relations,
  });
}

function queryContracts() {
  return new BoundedQueryContracts({
    maxAnchorCharacters: 256,
    maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
    maxPageSize: 3,
    maxQueryContextCharacters: DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
  });
}

/** Models the public caller flow: capture one identity, then make one explicit data read. */
function createQueryFlow(options: Parameters<typeof createRawProjectionQueryEngine>[0]) {
  const engine = createRawProjectionQueryEngine(options);
  return Object.freeze({
    exactEntity: async (id: string) => {
      const expected = await engine.identity();
      return expected.ok ? engine.exactEntity(expected.value, id) : expected;
    },
    identity: engine.identity,
    maxPageSize: engine.maxPageSize,
    pageEntities: async (
      query: Parameters<typeof engine.pageEntities>[1],
      request: Parameters<typeof engine.pageEntities>[2],
    ) => {
      const expected = await engine.identity();
      return expected.ok ? engine.pageEntities(expected.value, query, request) : expected;
    },
    searchEntities: async (
      query: Parameters<typeof engine.searchEntities>[1],
      request: Parameters<typeof engine.searchEntities>[2],
    ) => {
      const expected = await engine.identity();
      return expected.ok ? engine.searchEntities(expected.value, query, request) : expected;
    },
    traverseRelations: async (
      query: Parameters<typeof engine.traverseRelations>[1],
      request: Parameters<typeof engine.traverseRelations>[2],
    ) => {
      const expected = await engine.identity();
      return expected.ok ? engine.traverseRelations(expected.value, query, request) : expected;
    },
  });
}

function boundedEngine(
  provider: ReturnType<typeof mutableProjection>,
  maxQueryContextCharacters: number,
  maxCursorCharacters: number,
) {
  return createQueryFlow({
    bounds: {
      maxCursorCharacters,
      maxEntities: 8,
      maxPageSize: 3,
      maxProjectionPageSize: 2,
      maxTraversalDepth: 3,
      maxTraversalEntities: 8,
      maxTraversalRelationVisits: 16,
      maxTraversalRelations: 8,
    },
    projection: provider.projection,
    queries: new BoundedQueryContracts({
      maxAnchorCharacters: 256,
      maxCursorCharacters,
      maxPageSize: 3,
      maxQueryContextCharacters,
    }),
  });
}

function maximumTermSearch(): string {
  const terms: string[] = [];
  for (let index = 0; index < 32; index += 1) {
    terms.push(`${"文".repeat(index === 0 ? 7 : 6)}${String.fromCharCode(0x4e00 + index)}`);
  }
  return terms.join(" ");
}

function mutableProjection(initial = projectionSnapshot()) {
  let snapshot = initial;
  let loads = 0;
  const projection: ProjectionReadCapability = Object.freeze({
    exactCatalogEntry: async (_identity: ProjectionReadIdentity, requested: EntityId) => {
      const projected = snapshot.entities.find((item) => item.entity.id === requested);
      return projected === undefined
        ? {
            diagnostics: [
              { code: "projection-read-anchor-mismatch", message: "fixture anchor is absent" },
            ],
            ok: false as const,
          }
        : success({
            identity: { fingerprint: snapshot.fingerprint, generation: snapshot.generation },
            value: {
              id: projected.entity.id,
              kind: projected.entity.kind,
              searchableText: projected.searchableText,
            },
          });
    },
    exactEntities: async (_identity: ProjectionReadIdentity, requested: readonly EntityId[]) => {
      const entities = new Map(snapshot.entities.map((item) => [item.entity.id, item.entity]));
      const items: GraphEntity[] = [];
      for (let index = 0; index < requested.length; index += 1) {
        const item = entities.get(requested[index]!);
        if (item === undefined) {
          return {
            diagnostics: [{ code: "unknown-entity", message: "fixture entity is absent" }],
            ok: false as const,
          };
        }
        items.push(item);
      }
      return success({
        identity: { fingerprint: snapshot.fingerprint, generation: snapshot.generation },
        items: Object.freeze(items),
      });
    },
    identity: async () => {
      loads += 1;
      return success({ fingerprint: snapshot.fingerprint, generation: snapshot.generation });
    },
    exactEntity: async (
      _identity: ProjectionReadIdentity,
      requested: ReturnType<typeof entity>,
    ) => {
      const entities = new Map(snapshot.entities.map((item) => [item.entity.id, item.entity]));
      let current = requested;
      const aliases = new Map(snapshot.aliases.map((alias) => [alias.source, alias.target]));
      for (let count = 0; count <= snapshot.aliases.length; count += 1) {
        const entity = entities.get(current);
        if (entity !== undefined) {
          return success({
            identity: { fingerprint: snapshot.fingerprint, generation: snapshot.generation },
            value: entity,
          });
        }
        const next = aliases.get(current);
        if (next === undefined) {
          return {
            diagnostics: [{ code: "unknown-entity", message: "fixture entity is absent" }],
            ok: false as const,
          };
        }
        current = next;
      }
      return {
        diagnostics: [{ code: "unknown-entity", message: "fixture alias is cyclic" }],
        ok: false as const,
      };
    },
    pageCatalog: async (
      _identity: ProjectionReadIdentity,
      request: ProjectionCatalogReadRequest,
    ) => {
      const entries = snapshot.entities.map((item) => ({
        id: item.entity.id,
        kind: item.entity.kind,
        searchableText: item.searchableText,
      }));
      const start =
        request.after === undefined
          ? 0
          : entries.findIndex((item) => item.id === request.after) + 1;
      if (start === 0 && request.after !== undefined) {
        return {
          diagnostics: [
            { code: "projection-read-anchor-mismatch", message: "fixture anchor is absent" },
          ],
          ok: false as const,
        };
      }
      const items = Object.freeze(entries.slice(start, start + request.limit));
      const hasMore = start + items.length < entries.length;
      return success({
        hasMore,
        identity: { fingerprint: snapshot.fingerprint, generation: snapshot.generation },
        items,
        ...(hasMore ? { nextAfter: items[items.length - 1]!.id } : {}),
      });
    },
    pageRelations: async (
      _identity: ProjectionReadIdentity,
      request: ProjectionRelationReadRequest,
    ) => {
      const adjacency = snapshot.adjacency.find((item) => item.entity === request.entity);
      const relations = new Map(snapshot.relations.map((item) => [item.id, item]));
      const ids = adjacency?.[request.direction] ?? [];
      const start =
        request.after === undefined ? 0 : ids.findIndex((item) => item === request.after) + 1;
      if (start === 0 && request.after !== undefined) {
        return {
          diagnostics: [
            { code: "projection-read-anchor-mismatch", message: "fixture anchor is absent" },
          ],
          ok: false as const,
        };
      }
      const selected = ids.slice(start, start + request.limit);
      const items = selected.map((id) => {
        const edge = relations.get(id)!;
        const neighbor = request.direction === "incoming" ? edge.source : edge.target;
        return {
          direction: request.direction,
          entity: snapshot.entities.find((item) => item.entity.id === neighbor)!.entity,
          from: request.entity,
          relation: edge,
        };
      });
      const hasMore = start + selected.length < ids.length;
      return success({
        hasMore,
        identity: { fingerprint: snapshot.fingerprint, generation: snapshot.generation },
        items,
        ...(hasMore ? { nextAfter: selected[selected.length - 1]! } : {}),
      });
    },
  });
  return {
    get loads() {
      return loads;
    },
    projection,
    set snapshot(value: ProjectionSnapshot) {
      snapshot = value;
    },
  };
}

function queryEngineFor(projection: ProjectionReadCapability) {
  return createQueryFlow({
    bounds: {
      maxEntities: 8,
      maxPageSize: 3,
      maxProjectionPageSize: 2,
      maxTraversalDepth: 3,
      maxTraversalEntities: 8,
      maxTraversalRelationVisits: 16,
      maxTraversalRelations: 8,
    },
    projection,
    queries: queryContracts(),
  });
}

function engine(provider = mutableProjection()) {
  return { engine: queryEngineFor(provider.projection), provider };
}

describe("projection query engine", () => {
  test("captures one explicit identity for an exact multi-read flow without hidden identity reads", async () => {
    const provider = mutableProjection();
    const served: ProjectionReadIdentity[] = [];
    const projection: ProjectionReadCapability = Object.freeze({
      exactCatalogEntry: async (expected: ProjectionReadIdentity, id: EntityId) => {
        served.push(expected);
        return provider.projection.exactCatalogEntry(expected, id);
      },
      exactEntities: async (expected: ProjectionReadIdentity, requested: readonly EntityId[]) => {
        served.push(expected);
        return provider.projection.exactEntities(expected, requested);
      },
      exactEntity: async (expected: ProjectionReadIdentity, id: EntityId) => {
        served.push(expected);
        return provider.projection.exactEntity(expected, id);
      },
      identity: provider.projection.identity,
      pageCatalog: async (
        expected: ProjectionReadIdentity,
        request: ProjectionCatalogReadRequest,
      ) => {
        served.push(expected);
        return provider.projection.pageCatalog(expected, request);
      },
      pageRelations: async (
        expected: ProjectionReadIdentity,
        request: ProjectionRelationReadRequest,
      ) => {
        served.push(expected);
        return provider.projection.pageRelations(expected, request);
      },
    });
    const query = createRawProjectionQueryEngine({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection,
      queries: queryContracts(),
    });

    const captured = await query.identity();
    if (!captured.ok) throw new Error("expected projection identity");
    expect(await query.exactEntity(captured.value, ids.obsolete)).toMatchObject({ ok: true });
    expect(
      await query.pageEntities(captured.value, { kind: "component" }, { limit: 1 }),
    ).toMatchObject({ ok: true });
    expect(
      await query.searchEntities(captured.value, { text: "payment" }, { limit: 1 }),
    ).toMatchObject({ ok: true });
    expect(
      await query.traverseRelations(
        captured.value,
        { depth: 1, direction: "outgoing", entity: ids.a },
        { limit: 1 },
      ),
    ).toMatchObject({ ok: true });

    expect(provider.loads).toBe(1);
    expect(served.length).toBeGreaterThan(4);
    for (const expected of served) {
      expect(expected).toEqual(captured.value);
      expect(Object.isFrozen(expected)).toBeTrue();
    }
  });

  test("rejects same-generation branch B data under a previously captured branch A identity", async () => {
    const branchA = projectionSnapshot(7, "fixture:raw-branch-a");
    const branchBBase = projectionSnapshot(7, "fixture:raw-branch-b");
    const branchBMarker = "/private/branch-b-data";
    const branchB = Object.freeze({
      ...branchBBase,
      entities: Object.freeze(
        branchBBase.entities.map((item) =>
          item.entity.id === ids.a
            ? Object.freeze({
                entity: graphEntity(ids.a, branchBMarker),
                searchableText: `${ids.a}\ncomponent\n${branchBMarker}\nservice`,
              })
            : item,
        ),
      ),
    });
    const provider = mutableProjection(branchA);
    const reads = {
      exactEntities: 0,
      exactEntity: 0,
      pageCatalog: 0,
      pageRelations: 0,
    };
    const projection: ProjectionReadCapability = Object.freeze({
      ...provider.projection,
      exactEntities: async (expected: ProjectionReadIdentity, requested: readonly EntityId[]) => {
        reads.exactEntities += 1;
        return provider.projection.exactEntities(expected, requested);
      },
      exactEntity: async (expected: ProjectionReadIdentity, id: EntityId) => {
        reads.exactEntity += 1;
        return provider.projection.exactEntity(expected, id);
      },
      pageCatalog: async (
        expected: ProjectionReadIdentity,
        request: ProjectionCatalogReadRequest,
      ) => {
        reads.pageCatalog += 1;
        return provider.projection.pageCatalog(expected, request);
      },
      pageRelations: async (
        expected: ProjectionReadIdentity,
        request: ProjectionRelationReadRequest,
      ) => {
        reads.pageRelations += 1;
        return provider.projection.pageRelations(expected, request);
      },
    });
    const query = createRawProjectionQueryEngine({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection,
      queries: queryContracts(),
    });
    const identityA = await query.identity();
    if (!identityA.ok) throw new Error("expected branch A identity");
    provider.snapshot = branchB;

    const results = [
      await query.exactEntity(identityA.value, ids.a),
      await query.pageEntities(identityA.value, { kind: "component" }, { limit: 1 }),
      await query.traverseRelations(
        identityA.value,
        { depth: 1, direction: "outgoing", entity: ids.a },
        { limit: 1 },
      ),
    ];

    for (const result of results) {
      expect(result).toMatchObject({
        diagnostics: [{ code: "graph-query-unavailable" }],
        ok: false,
      });
    }
    expect(JSON.stringify(results)).not.toContain(branchBMarker);
    expect(reads).toEqual({
      exactEntities: 0,
      exactEntity: 2,
      pageCatalog: 1,
      pageRelations: 0,
    });
    expect(provider.loads).toBe(1);
  });

  test("captures a validated page maximum and contains hostile construction records", async () => {
    const provider = mutableProjection();
    const bounds = { maxPageSize: 2 };
    const query = createRawProjectionQueryEngine({
      bounds,
      projection: provider.projection,
      queries: queryContracts(),
    });
    bounds.maxPageSize = 1;

    expect(query.maxPageSize).toBe(2);
    expect(Object.isFrozen(query)).toBeTrue();
    const captured = await query.identity();
    if (!captured.ok) throw new Error("expected projection identity");
    expect(await query.pageEntities(captured.value, {}, { limit: 3 })).toMatchObject({
      diagnostics: [{ code: "invalid-page-limit", details: { maximum: 2 } }],
      ok: false,
    });

    const narrowerQueries = new BoundedQueryContracts({
      maxAnchorCharacters: 256,
      maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
      maxPageSize: 1,
      maxQueryContextCharacters: DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
    });
    expect(() =>
      createRawProjectionQueryEngine({
        bounds: { maxPageSize: 2 },
        projection: provider.projection,
        queries: narrowerQueries,
      }),
    ).toThrow("maxPageSize exceeds the bounded query contract maximum");
    expect(provider.loads).toBe(1);

    const replacementProjection = { ...provider.projection };
    const methodCaptured = createRawProjectionQueryEngine({
      bounds: { maxPageSize: 3 },
      projection: replacementProjection,
      queries: queryContracts(),
    });
    replacementProjection.identity = async () => failure({ code: "replaced", message: "replaced" });
    replacementProjection.exactEntity = async () =>
      failure({ code: "replaced", message: "replaced" });
    const methodIdentity = await methodCaptured.identity();
    if (!methodIdentity.ok) throw new Error("expected captured identity method");
    expect(await methodCaptured.exactEntity(methodIdentity.value, ids.a)).toMatchObject({
      ok: true,
      value: { item: { id: ids.a } },
    });

    let boundGetterCalls = 0;
    const hostileBounds = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostileBounds, "maxPageSize", {
      enumerable: true,
      get: () => {
        boundGetterCalls += 1;
        return 2;
      },
    });
    expect(() =>
      createRawProjectionQueryEngine({
        bounds: hostileBounds,
        projection: provider.projection,
        queries: queryContracts(),
      } as unknown as Parameters<typeof createRawProjectionQueryEngine>[0]),
    ).toThrow("bounds are malformed");
    expect(boundGetterCalls).toBe(0);

    let optionGetterCalls = 0;
    const hostileOptions = {
      projection: provider.projection,
      queries: queryContracts(),
    } as Record<string, unknown>;
    Object.defineProperty(hostileOptions, "bounds", {
      enumerable: true,
      get: () => {
        optionGetterCalls += 1;
        return { maxPageSize: 2 };
      },
    });
    expect(() =>
      createRawProjectionQueryEngine(
        hostileOptions as unknown as Parameters<typeof createRawProjectionQueryEngine>[0],
      ),
    ).toThrow("options are malformed");
    expect(optionGetterCalls).toBe(0);
  });

  test("rejects hostile expected identities before any partial provider read", async () => {
    const provider = mutableProjection();
    let dataReads = 0;
    const projection: ProjectionReadCapability = Object.freeze({
      exactCatalogEntry: async (expected: ProjectionReadIdentity, id: EntityId) => {
        dataReads += 1;
        return provider.projection.exactCatalogEntry(expected, id);
      },
      exactEntities: async (expected: ProjectionReadIdentity, requested: readonly EntityId[]) => {
        dataReads += 1;
        return provider.projection.exactEntities(expected, requested);
      },
      exactEntity: async (expected: ProjectionReadIdentity, id: EntityId) => {
        dataReads += 1;
        return provider.projection.exactEntity(expected, id);
      },
      identity: provider.projection.identity,
      pageCatalog: async (
        expected: ProjectionReadIdentity,
        request: ProjectionCatalogReadRequest,
      ) => {
        dataReads += 1;
        return provider.projection.pageCatalog(expected, request);
      },
      pageRelations: async (
        expected: ProjectionReadIdentity,
        request: ProjectionRelationReadRequest,
      ) => {
        dataReads += 1;
        return provider.projection.pageRelations(expected, request);
      },
    });
    const query = createRawProjectionQueryEngine({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection,
      queries: queryContracts(),
    });
    let getterCalls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "fingerprint", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return projectionSnapshot().fingerprint;
      },
    });
    Object.defineProperty(hostile, "generation", { enumerable: true, value: generation(7) });
    const expected = hostile as unknown as ProjectionReadIdentity;

    expect(await query.exactEntity(expected, ids.a)).toMatchObject({
      diagnostics: [{ code: "graph-query-unavailable" }],
      ok: false,
    });
    expect(await query.pageEntities(expected, {}, { limit: 1 })).toMatchObject({ ok: false });
    expect(await query.searchEntities(expected, { text: "payment" }, { limit: 1 })).toMatchObject({
      ok: false,
    });
    expect(
      await query.traverseRelations(
        expected,
        { depth: 1, direction: "outgoing", entity: ids.a },
        { limit: 1 },
      ),
    ).toMatchObject({ ok: false });
    expect({ dataReads, getterCalls, identityReads: provider.loads }).toEqual({
      dataReads: 0,
      getterCalls: 0,
      identityReads: 0,
    });
  });

  test("resolves exact canonical identities and aliases with the projection generation", async () => {
    const { engine: query } = engine();

    expect(await query.exactEntity(ids.b)).toMatchObject({
      ok: true,
      value: { generation: 7, item: { id: ids.b, kind: "component" } },
    });
    expect(await query.exactEntity(ids.obsolete)).toMatchObject({
      ok: true,
      value: { generation: 7, item: { id: ids.b, kind: "component" } },
    });
    expect(await query.exactEntity(entity("8"))).toMatchObject({
      diagnostics: [{ code: "unknown-entity" }],
      ok: false,
    });
  });

  test("routes replacement-provider diagnostics only for the matching read operation", async () => {
    const provider = mutableProjection();
    const providerFailure = (code: string) =>
      failure({ code, message: "fixture replacement-provider failure" });

    const initial = await queryEngineFor(provider.projection).pageEntities(
      { kind: "component" },
      { limit: 2 },
    );
    if (!initial.ok || initial.value.nextCursor === undefined) throw new Error("expected cursor");

    expect(
      await queryEngineFor(
        Object.freeze({
          ...provider.projection,
          exactEntity: async () => providerFailure("projection-read-anchor-mismatch"),
        }),
      ).exactEntity(ids.a),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
    expect(
      await queryEngineFor(
        Object.freeze({
          ...provider.projection,
          exactEntity: async () => providerFailure("unknown-entity"),
        }),
      ).exactEntity(ids.a),
    ).toMatchObject({ diagnostics: [{ code: "unknown-entity" }], ok: false });

    for (const code of ["projection-read-anchor-mismatch", "unknown-entity"] as const) {
      expect(
        await queryEngineFor(
          Object.freeze({
            ...provider.projection,
            exactCatalogEntry: async () => providerFailure(code),
          }),
        ).pageEntities({ kind: "component" }, { cursor: initial.value.nextCursor, limit: 2 }),
      ).toMatchObject({ diagnostics: [{ code: "cursor-anchor-mismatch" }], ok: false });
    }

    expect(
      await queryEngineFor(
        Object.freeze({
          ...provider.projection,
          identity: async () => providerFailure("unknown-entity"),
        }),
      ).exactEntity(ids.a),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
    expect(
      await queryEngineFor(
        Object.freeze({
          ...provider.projection,
          exactEntities: async () => providerFailure("unknown-entity"),
        }),
      ).pageEntities({ kind: "component" }, { limit: 2 }),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
    expect(
      await queryEngineFor(
        Object.freeze({
          ...provider.projection,
          pageCatalog: async () => providerFailure("projection-read-anchor-mismatch"),
        }),
      ).pageEntities({ kind: "component" }, { limit: 1 }),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
    expect(
      await queryEngineFor(
        Object.freeze({
          ...provider.projection,
          pageRelations: async () => providerFailure("unknown-entity"),
        }),
      ).traverseRelations({ depth: 1, direction: "outgoing", entity: ids.a }, { limit: 1 }),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
  });

  test("pages filtered components in stable identity order and resumes opaquely", async () => {
    const { engine: query } = engine();
    const first = await query.pageEntities({ kind: "component" }, { limit: 2 });
    expect(first).toMatchObject({
      ok: true,
      value: {
        generation: 7,
        hasMore: true,
        items: [{ id: ids.a }, { id: ids.b }],
      },
    });
    if (!first.ok || first.value.nextCursor === undefined) throw new Error("expected cursor");
    const second = await query.pageEntities(
      { kind: "component" },
      { cursor: first.value.nextCursor, limit: 2 },
    );
    expect(second).toMatchObject({
      ok: true,
      value: { generation: 7, hasMore: false, items: [{ id: ids.c }] },
    });

    expect(
      await query.pageEntities({ kind: "evidence" }, { cursor: first.value.nextCursor, limit: 2 }),
    ).toMatchObject({ diagnostics: [{ code: "cursor-query-mismatch" }], ok: false });
    expect(
      await query.pageEntities(
        { kind: "component" },
        { cursor: replaceCursorAnchor(first.value.nextCursor, entity("8")), limit: 2 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-anchor-mismatch" }], ok: false });
    expect(
      await query.pageEntities(
        { kind: "component" },
        { cursor: replaceCursorAnchor(first.value.nextCursor, ids.d), limit: 2 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-anchor-mismatch" }], ok: false });
  });

  test("validates one exact cursor anchor before suffix paging and batches page entities", async () => {
    const provider = mutableProjection();
    let exactCatalogCalls = 0;
    let batchCalls = 0;
    let exactEntityCalls = 0;
    const catalogAfters: (EntityId | undefined)[] = [];
    const projection: ProjectionReadCapability = Object.freeze({
      ...provider.projection,
      exactCatalogEntry: async (identity: ProjectionReadIdentity, id: EntityId) => {
        exactCatalogCalls += 1;
        return provider.projection.exactCatalogEntry(identity, id);
      },
      exactEntities: async (identity: ProjectionReadIdentity, requested: readonly EntityId[]) => {
        batchCalls += 1;
        return provider.projection.exactEntities(identity, requested);
      },
      exactEntity: async (identity: ProjectionReadIdentity, id: EntityId) => {
        exactEntityCalls += 1;
        return provider.projection.exactEntity(identity, id);
      },
      pageCatalog: async (
        identity: ProjectionReadIdentity,
        request: ProjectionCatalogReadRequest,
      ) => {
        catalogAfters.push(request.after);
        return provider.projection.pageCatalog(identity, request);
      },
    });
    const query = createQueryFlow({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection,
      queries: queryContracts(),
    });
    const first = await query.pageEntities({ kind: "component" }, { limit: 2 });
    if (!first.ok || first.value.nextCursor === undefined) throw new Error("expected cursor");
    exactCatalogCalls = 0;
    batchCalls = 0;
    exactEntityCalls = 0;
    catalogAfters.length = 0;

    expect(
      await query.pageEntities({ kind: "component" }, { cursor: first.value.nextCursor, limit: 2 }),
    ).toMatchObject({ ok: true, value: { items: [{ id: ids.c }] } });
    expect({ batchCalls, catalogAfters, exactCatalogCalls, exactEntityCalls }).toEqual({
      batchCalls: 1,
      catalogAfters: [ids.b],
      exactCatalogCalls: 1,
      exactEntityCalls: 0,
    });

    catalogAfters.length = 0;
    expect(
      await query.pageEntities(
        { kind: "component" },
        { cursor: replaceCursorAnchor(first.value.nextCursor, ids.d), limit: 2 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-anchor-mismatch" }], ok: false });
    expect(catalogAfters).toEqual([]);

    const anchorBounded = createQueryFlow({
      bounds: {
        maxEntities: 1,
        maxPageSize: 1,
        maxProjectionPageSize: 1,
        maxTraversalDepth: 1,
        maxTraversalEntities: 1,
        maxTraversalRelationVisits: 1,
        maxTraversalRelations: 1,
      },
      projection,
      queries: queryContracts(),
    });
    catalogAfters.length = 0;
    expect(
      await anchorBounded.pageEntities(
        { kind: "component" },
        { cursor: first.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "entity-scan-bound-exceeded" }], ok: false });
    expect(catalogAfters).toEqual([]);
  });

  test("contains malformed replacement-provider exact anchors and entity batches", async () => {
    const baseline = mutableProjection();
    const identity = { fingerprint: projectionSnapshot().fingerprint, generation: generation(7) };
    const malformedBatches: readonly (() => unknown)[] = [
      () =>
        success({
          identity: {
            fingerprint: projectionSnapshot(7, "fixture:wrong-batch").fingerprint,
            generation: generation(7),
          },
          items: Object.freeze([
            graphEntity(ids.a, "Order API"),
            graphEntity(ids.b, "Payment Service"),
          ]),
        }),
      () => success({ identity, items: [] }),
      () =>
        success({
          identity,
          items: Object.freeze([
            graphEntity(ids.b, "Payment Service"),
            graphEntity(ids.a, "Order API"),
          ]),
        }),
      () =>
        success({
          identity,
          items: Object.freeze([
            graphEntity(entity("8"), "Wrong"),
            graphEntity(ids.b, "Payment Service"),
          ]),
        }),
      () =>
        success({
          identity,
          items: Object.freeze([
            graphEntity(ids.a, "Order API", "evidence"),
            graphEntity(ids.b, "Payment Service"),
          ]),
        }),
      () => {
        const items = [graphEntity(ids.a, "Order API"), graphEntity(ids.b, "Payment Service")];
        Object.defineProperty(items, "0", { enumerable: true, get: () => items[1] });
        return success({ identity, items });
      },
      () =>
        success({
          identity,
          items: Object.freeze([
            Object.freeze({ id: ids.a, kind: "component", payload: { invalid: () => true } }),
            graphEntity(ids.b, "Payment Service"),
          ]),
        }),
    ];
    for (let index = 0; index < malformedBatches.length; index += 1) {
      const projection = Object.freeze({
        ...baseline.projection,
        exactEntities: async () => malformedBatches[index]!(),
      }) as ProjectionReadCapability;
      expect(
        await createQueryFlow({
          bounds: {
            maxEntities: 8,
            maxPageSize: 3,
            maxProjectionPageSize: 2,
            maxTraversalDepth: 3,
            maxTraversalEntities: 8,
            maxTraversalRelationVisits: 16,
            maxTraversalRelations: 8,
          },
          projection,
          queries: queryContracts(),
        }).pageEntities({ kind: "component" }, { limit: 2 }),
      ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
    }

    let suffixCalls = 0;
    const malformedAnchor = Object.freeze({
      ...baseline.projection,
      exactCatalogEntry: async () =>
        success({
          identity,
          value: { id: ids.a, kind: "component", searchableText: "a" },
        }),
      pageCatalog: async (
        expected: ProjectionReadIdentity,
        request: ProjectionCatalogReadRequest,
      ) => {
        suffixCalls += 1;
        return baseline.projection.pageCatalog(expected, request);
      },
    });
    const initial = await engine(baseline).engine.pageEntities({ kind: "component" }, { limit: 2 });
    if (!initial.ok || initial.value.nextCursor === undefined) throw new Error("expected cursor");
    expect(
      await createQueryFlow({
        bounds: {
          maxEntities: 8,
          maxPageSize: 3,
          maxProjectionPageSize: 2,
          maxTraversalDepth: 3,
          maxTraversalEntities: 8,
          maxTraversalRelationVisits: 16,
          maxTraversalRelations: 8,
        },
        projection: malformedAnchor,
        queries: queryContracts(),
      }).pageEntities({ kind: "component" }, { cursor: initial.value.nextCursor, limit: 2 }),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
    expect(suffixCalls).toBe(0);
  });

  test("normalizes search exactly like the projection and binds equivalent term sets", async () => {
    const { engine: query } = engine();
    const first = await query.searchEntities({ text: "ＳＥＲＶＩＣＥ payment" }, { limit: 1 });
    expect(first).toMatchObject({
      ok: true,
      value: { generation: 7, hasMore: false, items: [{ id: ids.b }] },
    });

    const paged = await query.searchEntities({ text: "component" }, { limit: 1 });
    if (!paged.ok || paged.value.nextCursor === undefined)
      throw new Error("expected search cursor");
    expect(
      await query.searchEntities(
        { text: "component" },
        { cursor: paged.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ ok: true, value: { generation: 7 } });
    expect(
      await query.searchEntities(
        { text: "component" },
        { cursor: replaceCursorAnchor(paged.value.nextCursor, ids.d), limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-anchor-mismatch" }], ok: false });
  });

  test("fits every valid search and its cursor inside the shared derived ceilings", async () => {
    const escapedFingerprint = "\u0000".repeat(128);
    const maximumKind = `a${"1".repeat(127)}`;
    const maximumSearch = "\u0000".repeat(256);
    const exactContextProvider = mutableProjection(projectionSnapshot(7, escapedFingerprint));
    const exactContext = boundedEngine(
      exactContextProvider,
      DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
      DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
    );
    expect(
      await exactContext.searchEntities({ kind: maximumKind, text: maximumSearch }, { limit: 1 }),
    ).toMatchObject({ ok: true, value: { hasMore: false, items: [] } });
    expect(exactContextProvider.loads).toBe(1);

    const shortContextProvider = mutableProjection(projectionSnapshot(7, escapedFingerprint));
    const shortContext = boundedEngine(
      shortContextProvider,
      DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS - 1,
      DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
    );
    expect(
      await shortContext.searchEntities({ kind: maximumKind, text: maximumSearch }, { limit: 1 }),
    ).toMatchObject({ diagnostics: [{ code: "query-context-too-large" }], ok: false });
    expect(shortContextProvider.loads).toBe(1);

    expect(
      await exactContext.searchEntities(
        { kind: maximumKind, text: `${maximumSearch}\u0000` },
        { limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "invalid-search-text" }], ok: false });
    expect(exactContextProvider.loads).toBe(2);

    const zeroIoProvider = mutableProjection();
    const zeroIo = boundedEngine(
      zeroIoProvider,
      DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
      DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
    );
    const tooManyTerms = Array.from({ length: 33 }, (_, index) => `term${index}`).join(" ");
    expect(await zeroIo.searchEntities({ text: tooManyTerms }, { limit: 1 })).toMatchObject({
      diagnostics: [{ code: "invalid-search-text" }],
      ok: false,
    });
    expect(await zeroIo.searchEntities({ text: "valid" }, { limit: 4 })).toMatchObject({
      diagnostics: [{ code: "invalid-page-limit" }],
      ok: false,
    });
    expect(zeroIoProvider.loads).toBe(2);

    const cursorFingerprint = "文".repeat(128);
    const cursorSearch = maximumTermSearch();
    expect(cursorFingerprint.length).toBe(128);
    expect(cursorSearch.length).toBe(256);
    const base = projectionSnapshot(Number.MAX_SAFE_INTEGER, cursorFingerprint);
    const cursorSnapshot = Object.freeze({
      ...base,
      entities: Object.freeze(
        base.entities.map((projected) =>
          Object.freeze({
            ...projected,
            entity: Object.freeze({ ...projected.entity, kind: maximumKind }),
            searchableText: cursorSearch,
          }),
        ),
      ),
    });
    const cursorProvider = mutableProjection(cursorSnapshot);
    const cursorEngine = boundedEngine(
      cursorProvider,
      DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
      DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
    );
    const first = await cursorEngine.searchEntities(
      { kind: maximumKind, text: cursorSearch },
      { limit: 1 },
    );
    expect(first).toMatchObject({ ok: true, value: { hasMore: true, items: [{ id: ids.a }] } });
    if (!first.ok || first.value.nextCursor === undefined) throw new Error("expected max cursor");
    expect(first.value.nextCursor.length).toBe(DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS);
    expect(
      await cursorEngine.searchEntities(
        { kind: maximumKind, text: cursorSearch },
        { cursor: first.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ ok: true, value: { items: [{ id: ids.b }] } });

    const shortCursorProvider = mutableProjection(cursorSnapshot);
    const shortCursor = boundedEngine(
      shortCursorProvider,
      DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
      DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS - 1,
    );
    expect(
      await shortCursor.searchEntities({ kind: maximumKind, text: cursorSearch }, { limit: 1 }),
    ).toMatchObject({ diagnostics: [{ code: "continuation-cursor-too-large" }], ok: false });

    const mismatchedCursorBudgets = createQueryFlow({
      bounds: {
        maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS - 1,
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection: mutableProjection(cursorSnapshot).projection,
      queries: new BoundedQueryContracts({
        maxAnchorCharacters: 256,
        maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
        maxPageSize: 3,
        maxQueryContextCharacters: DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
      }),
    });
    expect(
      await mismatchedCursorBudgets.searchEntities(
        { kind: maximumKind, text: cursorSearch },
        { limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "continuation-cursor-too-large" }], ok: false });
  });

  test("normalizes replacement-provider catalog text instead of assuming provider casing", async () => {
    const baseline = projectionSnapshot();
    const uppercase = Object.freeze({
      ...baseline,
      entities: Object.freeze(
        baseline.entities.map((item) =>
          item.entity.id === ids.b
            ? Object.freeze({ ...item, searchableText: "Payment Service" })
            : item,
        ),
      ),
    });
    expect(
      await engine(mutableProjection(uppercase)).engine.searchEntities(
        { text: "payment service" },
        { limit: 1 },
      ),
    ).toMatchObject({ ok: true, value: { items: [{ id: ids.b }] } });
  });

  test("copies catalog and adjacency pages before poisoned provider iterators can hide entries", async () => {
    const provider = mutableProjection();
    let catalogItems: readonly unknown[] | undefined;
    let relationItems: readonly unknown[] | undefined;
    const projection = Object.freeze({
      ...provider.projection,
      pageCatalog: async (
        identity: ProjectionReadIdentity,
        request: ProjectionCatalogReadRequest,
      ) => {
        const result = await provider.projection.pageCatalog(identity, request);
        if (result.ok) catalogItems = result.value.items;
        return result;
      },
      pageRelations: async (
        identity: ProjectionReadIdentity,
        request: ProjectionRelationReadRequest,
      ) => {
        const result = await provider.projection.pageRelations(identity, request);
        if (result.ok) relationItems = result.value.items;
        return result;
      },
    });
    const query = createQueryFlow({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection,
      queries: queryContracts(),
    });
    const originalIterator = Array.prototype[Symbol.iterator];
    let entityPage: Awaited<ReturnType<typeof query.pageEntities>> | undefined;
    let traversalPage: Awaited<ReturnType<typeof query.traverseRelations>> | undefined;
    Array.prototype[Symbol.iterator] = function () {
      return this === catalogItems || this === relationItems
        ? Reflect.apply(originalIterator, [], [])
        : Reflect.apply(originalIterator, this, []);
    };
    try {
      entityPage = await query.pageEntities({ kind: "component" }, { limit: 1 });
      traversalPage = await query.traverseRelations(
        { depth: 1, direction: "outgoing", entity: ids.a },
        { limit: 1 },
      );
    } finally {
      Array.prototype[Symbol.iterator] = originalIterator;
    }

    expect(entityPage).toMatchObject({ ok: true, value: { items: [{ id: ids.a }] } });
    expect(traversalPage).toMatchObject({
      ok: true,
      value: { items: [{ entity: { id: ids.b }, relation: { id: ids.r1 } }] },
    });
  });

  test("keeps token validation and search deterministic after helper prototypes are poisoned", async () => {
    const provider = mutableProjection();
    const query = engine(provider).engine;
    const originalTest = RegExp.prototype.test;
    const originalNormalize = String.prototype.normalize;
    const originalLower = String.prototype.toLowerCase;
    const originalIncludes = String.prototype.includes;
    const originalSplit = String.prototype.split;
    const originalFilter = Array.prototype.filter;
    let invalid: Awaited<ReturnType<typeof query.pageEntities>> | undefined;
    let searched: Awaited<ReturnType<typeof query.searchEntities>> | undefined;
    RegExp.prototype.test = () => true;
    String.prototype.normalize = () => "poisoned";
    String.prototype.toLowerCase = () => "poisoned";
    String.prototype.includes = () => false;
    String.prototype.split = () => ["poisoned"];
    Array.prototype.filter = () => [];
    try {
      invalid = await query.pageEntities({ kind: "INVALID!" }, { limit: 1 });
      searched = await query.searchEntities({ text: "ＳＥＲＶＩＣＥ payment" }, { limit: 1 });
    } finally {
      RegExp.prototype.test = originalTest;
      String.prototype.normalize = originalNormalize;
      String.prototype.toLowerCase = originalLower;
      String.prototype.includes = originalIncludes;
      String.prototype.split = originalSplit;
      Array.prototype.filter = originalFilter;
    }

    expect(invalid).toMatchObject({ diagnostics: [{ code: "invalid-entity-kind" }], ok: false });
    expect(searched).toMatchObject({ ok: true, value: { items: [{ id: ids.b }] } });
    expect(provider.loads).toBe(2);
  });

  test("traverses recursive cyclic relationships by direction, type, and bounded depth", async () => {
    const { engine: query } = engine();
    const outgoing = await query.traverseRelations(
      { depth: 3, direction: "outgoing", entity: ids.a },
      { limit: 3 },
    );
    expect(outgoing).toMatchObject({
      ok: true,
      value: {
        generation: 7,
        hasMore: false,
        items: [
          { depth: 1, direction: "outgoing", entity: { id: ids.b }, relation: { id: ids.r1 } },
          { depth: 2, direction: "outgoing", entity: { id: ids.c }, relation: { id: ids.r2 } },
          { depth: 3, direction: "outgoing", entity: { id: ids.a }, relation: { id: ids.r3 } },
        ],
      },
    });

    const incoming = await query.traverseRelations(
      { depth: 2, direction: "incoming", entity: ids.a },
      { limit: 3 },
    );
    expect(incoming).toMatchObject({
      ok: true,
      value: {
        items: [
          { depth: 1, direction: "incoming", entity: { id: ids.c }, relation: { id: ids.r3 } },
          { depth: 2, direction: "incoming", entity: { id: ids.b }, relation: { id: ids.r2 } },
        ],
      },
    });

    const both = await query.traverseRelations(
      { depth: 1, direction: "both", entity: ids.a },
      { limit: 3 },
    );
    expect(both).toMatchObject({
      ok: true,
      value: {
        items: [
          { depth: 1, direction: "outgoing", relation: { id: ids.r1 } },
          { depth: 1, direction: "incoming", relation: { id: ids.r3 } },
        ],
      },
    });

    const typed = await query.traverseRelations(
      { depth: 3, direction: "outgoing", entity: ids.a, relationType: "requires" },
      { limit: 3 },
    );
    expect(typed).toMatchObject({
      ok: true,
      value: { items: [{ depth: 1, relation: { id: ids.r1 } }] },
    });
  });

  test("resumes canonical and alias traversal and prioritizes stale cursors over removed roots", async () => {
    const provider = mutableProjection();
    const { engine: query } = engine(provider);
    const first = await query.traverseRelations(
      { depth: 3, direction: "outgoing", entity: ids.a },
      { limit: 1 },
    );
    if (!first.ok || first.value.nextCursor === undefined) throw new Error("expected cursor");
    const second = await query.traverseRelations(
      { depth: 3, direction: "outgoing", entity: ids.a },
      { cursor: first.value.nextCursor, limit: 1 },
    );
    expect(second).toMatchObject({
      ok: true,
      value: { items: [{ depth: 2, relation: { id: ids.r2 } }] },
    });

    const aliasFirst = await query.traverseRelations(
      { depth: 2, direction: "outgoing", entity: ids.obsolete },
      { limit: 1 },
    );
    if (!aliasFirst.ok || aliasFirst.value.nextCursor === undefined) {
      throw new Error("expected alias cursor");
    }
    expect(aliasFirst).toMatchObject({
      value: { items: [{ depth: 1, relation: { id: ids.r2 } }] },
    });
    expect(
      await query.traverseRelations(
        { depth: 2, direction: "outgoing", entity: ids.obsolete },
        { cursor: aliasFirst.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({
      ok: true,
      value: { items: [{ depth: 2, relation: { id: ids.r3 } }] },
    });

    const advanced = projectionSnapshot(8, "fixture:changed-generation-and-fingerprint");
    provider.snapshot = Object.freeze({
      ...advanced,
      adjacency: Object.freeze(advanced.adjacency.filter((item) => item.entity !== ids.a)),
      entities: Object.freeze(advanced.entities.filter((item) => item.entity.id !== ids.a)),
      relations: Object.freeze(
        advanced.relations.filter((item) => item.source !== ids.a && item.target !== ids.a),
      ),
    });
    expect(
      await query.traverseRelations(
        { depth: 3, direction: "outgoing", entity: ids.a },
        { cursor: first.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "stale-cursor" }], ok: false });
  });

  test("binds cursors to exact projection content and rejects forged traversal anchors", async () => {
    const provider = mutableProjection();
    const { engine: query } = engine(provider);
    const first = await query.traverseRelations(
      { depth: 3, direction: "outgoing", entity: ids.a },
      { limit: 1 },
    );
    if (!first.ok || first.value.nextCursor === undefined) throw new Error("expected cursor");

    const forged = replaceCursorAnchor(first.value.nextCursor, relation("8"));
    expect(
      await query.traverseRelations(
        { depth: 3, direction: "incoming", entity: ids.a },
        { cursor: first.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-query-mismatch" }], ok: false });
    expect(
      await query.traverseRelations(
        { depth: 3, direction: "outgoing", entity: ids.a },
        { cursor: forged, limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-anchor-mismatch" }], ok: false });

    provider.snapshot = projectionSnapshot(7, "fixture:same-generation-branch");
    expect(
      await query.traverseRelations(
        { depth: 3, direction: "outgoing", entity: ids.a },
        { cursor: first.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-query-mismatch" }], ok: false });
  });

  test("binds fresh cursors to same-generation fingerprints and permits an exact-content ABA", async () => {
    const snapshotA = projectionSnapshot(7, "fixture:branch-a");
    const snapshotB = projectionSnapshot(7, "fixture:branch-b");
    const provider = mutableProjection(snapshotA);
    const query = createRawProjectionQueryEngine({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection: provider.projection,
      queries: queryContracts(),
    });
    const identityA = await query.identity();
    if (!identityA.ok) throw new Error("expected branch A identity");
    const pageA = await query.pageEntities(identityA.value, { kind: "component" }, { limit: 1 });
    if (!pageA.ok || pageA.value.nextCursor === undefined) throw new Error("expected A cursor");

    provider.snapshot = snapshotB;
    const identityB = await query.identity();
    if (!identityB.ok) throw new Error("expected branch B identity");
    expect(
      await query.pageEntities(
        identityB.value,
        { kind: "component" },
        { cursor: pageA.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-query-mismatch" }], ok: false });
    const pageB = await query.pageEntities(identityB.value, { kind: "component" }, { limit: 1 });
    if (!pageB.ok || pageB.value.nextCursor === undefined) throw new Error("expected B cursor");

    provider.snapshot = snapshotA;
    const identityAAgain = await query.identity();
    if (!identityAAgain.ok) throw new Error("expected restored branch A identity");
    expect(
      await query.pageEntities(
        identityAAgain.value,
        { kind: "component" },
        { cursor: pageA.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ ok: true, value: { items: [{ id: ids.b }] } });
    expect(
      await query.pageEntities(
        identityAAgain.value,
        { kind: "component" },
        { cursor: pageB.value.nextCursor, limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-query-mismatch" }], ok: false });
  });

  test("fails malformed and over-bound inputs before partial data reads", async () => {
    const provider = mutableProjection();
    const { engine: query } = engine(provider);

    expect(await query.pageEntities({}, { limit: 0 })).toMatchObject({
      diagnostics: [{ code: "invalid-page-limit" }],
      ok: false,
    });
    expect(await query.searchEntities({ text: "   " }, { limit: 1 })).toMatchObject({
      diagnostics: [{ code: "invalid-search-text" }],
      ok: false,
    });
    expect(
      await query.traverseRelations(
        { depth: 4, direction: "outgoing", entity: ids.a },
        { limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "invalid-traversal-depth" }], ok: false });
    expect(await query.pageEntities({}, { cursor: "not-a-cursor", limit: 1 })).toMatchObject({
      diagnostics: [{ code: "malformed-continuation-cursor" }],
      ok: false,
    });
    let coercions = 0;
    expect(
      await query.exactEntity({
        toString: () => {
          coercions += 1;
          return ids.a;
        },
      } as unknown as string),
    ).toMatchObject({ diagnostics: [{ code: "invalid-entity-id" }], ok: false });
    expect(coercions).toBe(0);
    expect(await query.pageEntities({ kind: `a${"a".repeat(128)}` }, { limit: 1 })).toMatchObject({
      diagnostics: [{ code: "invalid-entity-kind" }],
      ok: false,
    });
    expect(
      await query.traverseRelations(
        {
          depth: 1,
          direction: "outgoing",
          entity: ids.a,
          relationType: `a${"a".repeat(128)}`,
        },
        { limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "invalid-relation-type" }], ok: false });
    expect(provider.loads).toBe(7);
  });

  test("contains malformed nested values from a replacement partial-read provider", async () => {
    const provider = mutableProjection();
    const hostile = Object.freeze({
      ...provider.projection,
      exactEntity: async () => success(null),
    }) as unknown as ProjectionReadCapability;
    await expect(
      createQueryFlow({
        bounds: {
          maxEntities: 8,
          maxPageSize: 3,
          maxProjectionPageSize: 2,
          maxTraversalDepth: 3,
          maxTraversalEntities: 8,
          maxTraversalRelationVisits: 16,
          maxTraversalRelations: 8,
        },
        projection: hostile,
        queries: queryContracts(),
      }).exactEntity(ids.a),
    ).resolves.toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
  });

  test("rejects an exact entity returned under a different projection identity", async () => {
    const provider = mutableProjection();
    const wrong = projectionSnapshot(7, "fixture:wrong-exact-identity").fingerprint;
    const hostile = Object.freeze({
      ...provider.projection,
      exactEntity: async (_identity: ProjectionReadIdentity, id: EntityId) =>
        success({
          identity: { fingerprint: wrong, generation: generation(7) },
          value: graphEntity(id, "Stale replacement entity"),
        }),
    }) satisfies ProjectionReadCapability;

    expect(
      await createQueryFlow({
        bounds: {
          maxEntities: 8,
          maxPageSize: 3,
          maxProjectionPageSize: 2,
          maxTraversalDepth: 3,
          maxTraversalEntities: 8,
          maxTraversalRelationVisits: 16,
          maxTraversalRelations: 8,
        },
        projection: hostile,
        queries: queryContracts(),
      }).exactEntity(ids.a),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
  });

  test("stops cyclic traversal at explicit entity and relation work bounds", async () => {
    const provider = mutableProjection();
    const relationBounded = createQueryFlow({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 8,
        maxTraversalRelations: 1,
      },
      projection: provider.projection,
      queries: queryContracts(),
    });
    expect(
      await relationBounded.traverseRelations(
        { depth: 3, direction: "outgoing", entity: ids.a },
        { limit: 3 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "traversal-relation-bound-exceeded" }], ok: false });

    const entityBounded = createQueryFlow({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 1,
        maxTraversalRelationVisits: 8,
        maxTraversalRelations: 8,
      },
      projection: provider.projection,
      queries: queryContracts(),
    });
    expect(
      await entityBounded.traverseRelations(
        { depth: 3, direction: "outgoing", entity: ids.a },
        { limit: 3 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "traversal-entity-bound-exceeded" }], ok: false });
  });

  test("charges filtered nonmatching edges to the traversal visit bound before another page", async () => {
    const baseline = projectionSnapshot();
    const rewrittenR2 = graphRelation(ids.r2, ids.a, ids.c, "emits");
    const bounded = Object.freeze({
      ...baseline,
      adjacency: Object.freeze(
        baseline.adjacency.map((entry) =>
          entry.entity === ids.a
            ? Object.freeze({ ...entry, outgoing: Object.freeze([ids.r1, ids.r2]) })
            : entry.entity === ids.b
              ? Object.freeze({ ...entry, outgoing: Object.freeze([]) })
              : entry.entity === ids.c
                ? Object.freeze({ ...entry, incoming: Object.freeze([ids.r2]) })
                : entry,
        ),
      ),
      relations: Object.freeze(
        baseline.relations.map((edge) => (edge.id === ids.r2 ? rewrittenR2 : edge)),
      ),
    });
    const query = createQueryFlow({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 1,
        maxTraversalRelations: 1,
      },
      projection: mutableProjection(bounded).projection,
      queries: queryContracts(),
    });
    expect(
      await query.traverseRelations(
        { depth: 1, direction: "outgoing", entity: ids.a, relationType: "emits" },
        { limit: 1 },
      ),
    ).toMatchObject({
      diagnostics: [{ code: "traversal-relation-visit-bound-exceeded" }],
      ok: false,
    });
  });

  test("rejects oversized derived search and adjacency work from a replacement projection", async () => {
    const baseline = projectionSnapshot();
    const oversizedText = Object.freeze({
      ...baseline,
      entities: Object.freeze([
        Object.freeze({
          ...baseline.entities[0]!,
          searchableText: "x".repeat(64 * 1024 + 1),
        }),
        ...baseline.entities.slice(1),
      ]),
    });
    const textProvider = mutableProjection(oversizedText);
    expect(
      await engine(textProvider).engine.searchEntities({ text: "x" }, { limit: 1 }),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });

    const oversizedAdjacency = Object.freeze({
      ...baseline,
      adjacency: Object.freeze([
        Object.freeze({
          ...baseline.adjacency[0]!,
          outgoing: Object.freeze(Array.from({ length: 9 }, () => ids.r1)),
        }),
        ...baseline.adjacency.slice(1),
      ]),
    });
    const adjacencyProvider = mutableProjection(oversizedAdjacency);
    expect(
      await engine(adjacencyProvider).engine.traverseRelations(
        { depth: 1, direction: "outgoing", entity: ids.a },
        { limit: 1 },
      ),
    ).toMatchObject({ diagnostics: [{ code: "graph-query-unavailable" }], ok: false });
  });

  test("queries equivalent rebuilt and incrementally updated projections without canonical mutation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "groma-query-engine-"));
    roots.push(root);
    const resources = await createLocalResourceProvider({ workspaceRoot: root });
    const initial = canonical(1, "Payment service");
    const source = new MutableCanonicalSource(initial);
    const projection = createLocalProjectionIndex({ canonical: source, resources });
    const query = createQueryFlow({
      bounds: {
        maxEntities: 8,
        maxPageSize: 3,
        maxProjectionPageSize: 2,
        maxTraversalDepth: 3,
        maxTraversalEntities: 8,
        maxTraversalRelationVisits: 16,
        maxTraversalRelations: 8,
      },
      projection,
      queries: queryContracts(),
    });
    expect((await projection.rebuild()).ok).toBeTrue();

    source.value = canonical(2, "Renamed payment service", true);
    const beforeQueries = JSON.stringify(source.value);
    const event = createGraphCommittedEvent(2, { entities: [ids.b], relations: [ids.r2] });
    if (!event.ok) throw new Error("invalid event fixture");
    expect((await projection.update(event.value)).ok).toBeTrue();
    const beforeIncrementalQueries = source.calls;
    const incrementalPages = await representativePages(query);
    expect(source.calls).toBe(beforeIncrementalQueries);

    expect((await projection.rebuild()).ok).toBeTrue();
    const beforeRebuiltQueries = source.calls;
    const rebuiltPages = await representativePages(query);
    expect(source.calls).toBe(beforeRebuiltQueries);
    expect(rebuiltPages).toEqual(incrementalPages);
    expect(JSON.stringify(source.value)).toBe(beforeQueries);
  });
});

function canonical(
  generationValue: number,
  paymentName: string,
  includeSecondRelation = false,
): ProjectionCanonicalSnapshot {
  const relations = [graphRelation(ids.r1, ids.a, ids.b, "requires")];
  if (includeSecondRelation) relations.push(graphRelation(ids.r2, ids.b, ids.c, "emits"));
  return Object.freeze({
    aliases: Object.freeze([
      { source: ids.obsolete, target: ids.b },
    ]) satisfies readonly EntityAlias[],
    entities: Object.freeze([
      graphEntity(ids.a, "Order API"),
      graphEntity(ids.b, paymentName),
      graphEntity(ids.c, "Invoice Worker"),
    ]),
    generation: generation(generationValue),
    relations: Object.freeze(relations),
  });
}

class MutableCanonicalSource implements ProjectionCanonicalSource {
  calls = 0;
  value: ProjectionCanonicalSnapshot;

  constructor(value: ProjectionCanonicalSnapshot) {
    this.value = value;
  }

  async snapshot() {
    this.calls += 1;
    return success(this.value);
  }
}

async function representativePages(query: ReturnType<typeof createQueryFlow>) {
  return Promise.all([
    query.pageEntities({ kind: "component" }, { limit: 3 }),
    query.searchEntities({ text: "renamed payment" }, { limit: 3 }),
    query.traverseRelations({ depth: 2, direction: "outgoing", entity: ids.a }, { limit: 3 }),
    query.exactEntity(ids.obsolete),
  ]);
}

function replaceCursorAnchor(cursor: string, anchor: string): string {
  const prefix = "groma.cursor.v1:";
  const state = JSON.parse(decodeURIComponent(cursor.slice(prefix.length))) as {
    anchor: unknown;
  };
  state.anchor = anchor;
  return `${prefix}${encodeURIComponent(JSON.stringify(state))}`;
}
