import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createApplicationSnapshotStateDecoder,
  createReconciliationOperations,
} from "../../src/application/index.ts";
import {
  BoundedQueryContracts,
  createGraphCommittedEvent,
  createObservationSession,
  createOpaqueIdSource,
  GraphKernel,
  observationSessionApiVersion,
  parseEntityId,
  parseGraphGeneration,
  parseRelationId,
  parseResourceKey,
  success,
  type CompletedObservationSnapshot,
  type GraphData,
  type GraphEntity,
  type GraphRelation,
  type ObservationRecord,
  type Result,
  type TransactionOutcome,
  type TransactionProvider,
  type TransactionRequest,
} from "../../src/core/index.ts";
import {
  createJsonEvidenceStore,
  createLocalProjectionIndex,
  createLocalResourceProvider,
  createProjectionQueryEngine,
  DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
  DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
  jsonEvidenceIndexLocator,
  jsonEvidenceSourceLocator,
} from "../../src/persistence/index.ts";
import { createStandardModelCapability } from "../../src/standard-model/index.ts";
import type { ApiComponentPage, ApiComponentView } from "../../src/web/client/api.ts";
import { buildBlueprintFlowGraph } from "../../src/web/client/graph.ts";
import { emptyModel, mergeChildrenPage, mergeRootsPage } from "../../src/web/client/model.ts";

const OBSERVATION_COUNT = 500_000;
const OBSERVATION_BATCH_SIZE = 2_000;
const EVIDENCE_SHARDS = 256;
const ENTITY_COUNT = 1_000;
const RELATION_COUNT = 4_000;
const QUERY_PAGE_SIZE = 100;
const BROWSER_CHILD_PAGE_SIZE = 10;
const PROVENANCE = Object.freeze([
  Object.freeze({
    fingerprint: "sha256:aaaaaaaaaaaaaaaa",
    resource: "source.ts",
    scope: "organization",
  }),
]);

interface Measurement {
  readonly milliseconds: number;
  readonly rssMiB: number;
}

interface ScaleReport {
  readonly browser: {
    readonly connectedEdgesDrawn: number;
    readonly detailIdentity: string;
    readonly focusedNodes: number;
    readonly mainLayerNodes: number;
    readonly retainedNodesAfterTwoPages: number;
    readonly searchPageItems: number;
  };
  readonly evidence: {
    readonly deterministic: boolean;
    readonly documentCount: number;
    readonly indexBytes: number;
    readonly largestShardBytes: number;
    readonly roundTripRecords: number;
    readonly serialize: Measurement;
  };
  readonly observations: {
    readonly batches: number;
    readonly canonicalCharacters: number;
    readonly ingest: Measurement;
    readonly reconcile: Measurement;
    readonly records: number;
  };
  readonly projection: {
    readonly entities: number;
    readonly enumeratePages: number;
    readonly query: Measurement;
    readonly rebuild: Measurement;
    readonly relationships: number;
    readonly semanticSliceEquivalent: boolean;
  };
}

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return result.value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function measured<T>(operation: () => T | Promise<T>): Promise<readonly [T, Measurement]> {
  const started = performance.now();
  const value = await operation();
  return Object.freeze([
    value,
    Object.freeze({
      milliseconds: Math.round((performance.now() - started) * 10) / 10,
      rssMiB: Math.round((process.memoryUsage.rss() / 1024 / 1024) * 10) / 10,
    }),
  ] as const);
}

function observation(index: number): ObservationRecord {
  return Object.freeze({
    content: "x",
    format: "text" as const,
    key: `observation-${String(index).padStart(6, "0")}`,
    kind: "documentation" as const,
    provenance: PROVENANCE,
    scope: "organization",
  });
}

async function observationFixture(): Promise<{
  readonly measurement: Measurement;
  readonly snapshot: CompletedObservationSnapshot;
}> {
  const session = valueOf(
    createObservationSession(
      {
        apiVersion: observationSessionApiVersion,
        epoch: "organization-scale-1",
        projectId: "project.organization",
        scopes: Object.freeze([Object.freeze({ id: "organization", resourceRoot: "." })]),
        source: Object.freeze({ id: "scale.fixture", instance: "local", version: "1.0.0" }),
      },
      {
        maxBatchRecords: OBSERVATION_BATCH_SIZE,
        maxBatches: OBSERVATION_COUNT / OBSERVATION_BATCH_SIZE,
        maxRecords: OBSERVATION_COUNT,
      },
    ),
  );
  const [snapshot, measurement] = await measured(() => {
    let sequence = 0;
    for (let start = 0; start < OBSERVATION_COUNT; start += OBSERVATION_BATCH_SIZE) {
      const records = new Array<ObservationRecord>(OBSERVATION_BATCH_SIZE);
      for (let offset = 0; offset < records.length; offset += 1) {
        records[offset] = observation(start + offset);
      }
      sequence += 1;
      const receipt = valueOf(
        session.submitBatch({ epoch: "organization-scale-1", records, sequence }),
      );
      assert(receipt.acceptedRecords === records.length, "observation batch was not accepted");
    }
    const inspection = session.inspect();
    assert(inspection.recordCount === OBSERVATION_COUNT, "observation count drifted");
    return valueOf(
      session.complete({
        coverage: Object.freeze([
          Object.freeze({
            kinds: Object.freeze(["documentation" as const]),
            scope: "organization",
            state: "complete" as const,
          }),
        ]),
        epoch: "organization-scale-1",
        sequence: sequence + 1,
      }),
    );
  });
  return Object.freeze({ measurement, snapshot });
}

function emptyTransactionProvider(): Pick<TransactionProvider, "snapshot"> {
  const state = Object.freeze({ components: Object.freeze([]), relationships: Object.freeze([]) });
  return Object.freeze({
    snapshot: (resources: readonly string[]) =>
      Object.freeze({
        generation: 0,
        revisions: Object.freeze(
          resources.map((resource) => Object.freeze({ resource, revision: null })),
        ),
        state,
      }),
  }) as Pick<TransactionProvider, "snapshot">;
}

async function reconcileFixture(snapshot: CompletedObservationSnapshot): Promise<Measurement> {
  const idSource = createOpaqueIdSource(() => new Uint8Array(16));
  const graph = new GraphKernel({ idSource, maxPageSize: 100 });
  const model = createStandardModelCapability();
  const transactionProvider = emptyTransactionProvider();
  const snapshotStateDecoder = createApplicationSnapshotStateDecoder({
    bounds: {
      maxComponents: 1,
      maxDiagnosticCount: 10,
      maxEmbeddedItems: 1,
      maxRelationships: 1,
      maxSnapshotStateDepth: 30,
      maxSnapshotStateValues: 100,
    },
    graph,
    isProxy: () => false,
    model,
  });
  const indexResource = valueOf(jsonEvidenceIndexLocator());
  const committedGeneration = valueOf(parseGraphGeneration(1));
  const committedEvent = valueOf(createGraphCommittedEvent(1, {}));
  let capturedEvidenceRecords = 0;
  const reconciliation = createReconciliationOperations({
    bounds: {
      maxComponents: 1,
      maxEmbeddedItems: 1,
      maxRecords: OBSERVATION_COUNT,
      maxRelationships: 1,
      maxSnapshotAttempts: 1,
      maxSources: 1,
      maxTransactionDataDepth: 30,
      // The transaction copy counts containers and scalar leaves, not records.
      // Five million was measured too low for 500,000 provenance-bearing records.
      maxTransactionDataValues: 10_000_000,
    },
    entropy: () => new Uint8Array(16),
    evidenceResourceMapper: Object.freeze({
      resourceForEvidence: () => parseResourceKey(indexResource),
      resourceForEvidenceSource: (sourceKey: string) => {
        const locator = jsonEvidenceSourceLocator(sourceKey);
        return locator.ok ? parseResourceKey(locator.value) : locator;
      },
    }),
    graph,
    resourceMapper: Object.freeze({
      resourceForComponent: () => parseResourceKey("groma/components/unused.md"),
    }),
    snapshotStateDecoder,
    transactionExecution: Object.freeze({
      execute: async (request: TransactionRequest): Promise<TransactionOutcome> => {
        const mutation = request.mutation as Readonly<Record<string, unknown>>;
        const evidence = mutation.evidence as {
          readonly sources: readonly { readonly snapshot: CompletedObservationSnapshot }[];
        };
        capturedEvidenceRecords = evidence.sources[0]?.snapshot.records.length ?? 0;
        return Object.freeze({
          event: committedEvent,
          generation: committedGeneration,
          revisions: Object.freeze([]),
          status: "committed" as const,
        });
      },
    }),
    transactionProvider,
  });
  const [result, measurement] = await measured(() => reconciliation.reconcile(snapshot));
  assert(
    result.ok && result.value.status === "committed",
    result.ok
      ? `reconciliation ended with ${result.value.status}`
      : `reconciliation failed: ${result.diagnostics.map((item) => item.code).join(", ")}`,
  );
  assert(
    capturedEvidenceRecords === OBSERVATION_COUNT,
    "reconciliation did not preserve every observation",
  );
  return measurement;
}

async function evidenceFixture(snapshot: CompletedObservationSnapshot): Promise<{
  readonly deterministic: boolean;
  readonly documentCount: number;
  readonly indexBytes: number;
  readonly largestShardBytes: number;
  readonly measurement: Measurement;
  readonly roundTripRecords: number;
}> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "groma-organization-scale-"));
  try {
    const resources = await createLocalResourceProvider({ workspaceRoot });
    const store = createJsonEvidenceStore({
      bounds: {
        maxIndexBytes: 1024 * 1024,
        maxShardBytes: 1024 * 1024,
        maxSources: EVIDENCE_SHARDS,
        maxTotalBytes: 64 * 1024 * 1024,
        maxValues: 600_000,
      },
      resources,
    });
    const buckets = Array.from({ length: EVIDENCE_SHARDS }, (_, index) => ({
      records: [] as string[],
      sourceKey: `bucket-${String(index).padStart(3, "0")}`,
    }));
    for (let index = 0; index < snapshot.records.length; index += 1) {
      buckets[index % EVIDENCE_SHARDS]!.records.push(snapshot.records[index]!.key);
    }
    const state = Object.freeze({
      sources: Object.freeze(
        buckets.map((bucket) =>
          Object.freeze({
            records: Object.freeze(bucket.records),
            sourceKey: bucket.sourceKey,
          }),
        ),
      ),
      version: 1,
    }) as GraphData;
    const [serialized, measurement] = await measured(() => valueOf(store.serialize(state)));
    const reversed = valueOf(
      store.serialize(
        Object.freeze({
          sources: Object.freeze(
            [...(state as { readonly sources: readonly GraphData[] }).sources].reverse(),
          ),
          version: 1,
        }),
      ),
    );
    const signatures = (documents: typeof serialized.documents) =>
      documents.map((document) => `${document.locator}:${document.revision}`);
    const deterministic =
      JSON.stringify(signatures(serialized.documents)) ===
      JSON.stringify(signatures(reversed.documents));
    assert(deterministic, "evidence sharding changed with source order");
    for (const document of serialized.documents) {
      const staged = await resources.stageReplacement(document.locator, document.bytes);
      assert(staged.ok, "evidence document could not be staged");
      const committed = await resources.commitReplacement(staged.value);
      assert(committed.state === "committed", "evidence document could not be committed");
    }
    const loaded = valueOf(await store.load());
    const loadedSources = (
      loaded.state as { readonly sources: readonly { readonly records: readonly string[] }[] }
    ).sources;
    const roundTripRecords = loadedSources.reduce(
      (total, source) => total + source.records.length,
      0,
    );
    assert(roundTripRecords === OBSERVATION_COUNT, "evidence round trip lost records");
    const index = serialized.documents.find((document) => document.locator.endsWith("index.json"));
    const shards = serialized.documents.filter((document) => document !== index);
    return Object.freeze({
      deterministic,
      documentCount: serialized.documents.length,
      indexBytes: index?.bytes.byteLength ?? 0,
      largestShardBytes: Math.max(...shards.map((document) => document.bytes.byteLength)),
      measurement,
      roundTripRecords,
    });
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

function entityId(index: number) {
  return valueOf(parseEntityId(`ent_${index.toString(16).padStart(32, "0")}`));
}

function relationId(index: number) {
  return valueOf(parseRelationId(`rel_${index.toString(16).padStart(32, "0")}`));
}

function componentEntity(index: number, parent?: string): GraphEntity {
  const id = entityId(index + 1);
  return Object.freeze({
    id,
    kind: "component",
    payload: Object.freeze({
      extensions: Object.freeze({}),
      id,
      kind: "component",
      name: index === 42 ? "Semantic Anchor" : `Component ${String(index).padStart(4, "0")}`,
      ...(parent === undefined ? {} : { parent }),
      scale: index === 0 ? "system" : index < 401 ? "domain" : "part",
      type: "service",
    }),
  });
}

function connectedGraph(): {
  readonly entities: readonly GraphEntity[];
  readonly relations: readonly GraphRelation[];
} {
  const entities: GraphEntity[] = [];
  for (let index = 0; index < ENTITY_COUNT; index += 1) {
    let parent: string | undefined;
    if (index > 0 && index <= 400) parent = entityId(1);
    else if (index > 400 && index <= 440) parent = entityId(index);
    entities.push(componentEntity(index, parent));
  }
  const relations: GraphRelation[] = [];
  for (let index = 0; index < RELATION_COUNT; index += 1) {
    const source = entityId((index % ENTITY_COUNT) + 1);
    const target = entityId(((index * 37 + 11) % ENTITY_COUNT) + 1);
    if (source === target) continue;
    relations.push(
      Object.freeze({
        id: relationId(index + 1),
        payload: Object.freeze({}),
        source,
        target,
        type: "depends-on",
      }),
    );
  }
  return Object.freeze({ entities: Object.freeze(entities), relations: Object.freeze(relations) });
}

function queryContracts() {
  return new BoundedQueryContracts({
    maxAnchorCharacters: 256,
    maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
    maxPageSize: QUERY_PAGE_SIZE,
    maxQueryContextCharacters: DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
  });
}

function apiView(entity: GraphEntity): ApiComponentView {
  const payload = entity.payload as Readonly<Record<string, unknown>>;
  return {
    component: payload,
    revision: `sha256:${createHash("sha256").update(entity.id).digest("hex")}`,
  } as unknown as ApiComponentView;
}

function apiPage(
  items: readonly GraphEntity[],
  hasMore: boolean,
  nextCursor?: string,
): ApiComponentPage {
  return {
    generation: 1,
    hasMore,
    items: items.map(apiView),
    ...(nextCursor === undefined ? {} : { nextCursor }),
  };
}

async function projectionFixture(): Promise<ScaleReport["projection"] & ScaleReport["browser"]> {
  const graph = connectedGraph();
  const generation = valueOf(parseGraphGeneration(1));
  const projection = createLocalProjectionIndex({
    bounds: {
      maxBytes: 64 * 1024 * 1024,
      maxEntities: ENTITY_COUNT,
      maxPageSize: QUERY_PAGE_SIZE,
      maxRelations: RELATION_COUNT,
    },
    canonical: Object.freeze({
      snapshot: async () =>
        success(
          Object.freeze({
            aliases: Object.freeze([]),
            entities: graph.entities,
            generation,
            relations: graph.relations,
          }),
        ),
    }),
  });
  const [rebuilt, rebuild] = await measured(() => projection.rebuild());
  assert(rebuilt.ok, "large projection did not rebuild");
  const queryEngine = createProjectionQueryEngine({
    bounds: {
      maxEntities: ENTITY_COUNT,
      maxPageSize: QUERY_PAGE_SIZE,
      maxProjectionPageSize: QUERY_PAGE_SIZE,
      maxTraversalDepth: 16,
      maxTraversalEntities: ENTITY_COUNT,
      maxTraversalRelationVisits: RELATION_COUNT * 2,
      maxTraversalRelations: RELATION_COUNT,
    },
    projection,
    queries: queryContracts(),
  });
  const [queryResult, query] = await measured(async () => {
    const identity = valueOf(await queryEngine.identity());
    let cursor: string | undefined;
    let enumeratePages = 0;
    let enumerated = 0;
    do {
      const page = valueOf(
        await queryEngine.pageEntities(
          identity,
          Object.freeze({ kind: "component" }),
          Object.freeze({ ...(cursor === undefined ? {} : { cursor }), limit: QUERY_PAGE_SIZE }),
        ),
      );
      enumeratePages += 1;
      enumerated += page.items.length;
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    assert(enumerated === ENTITY_COUNT, "paged query did not enumerate the projection");
    const search = valueOf(
      await queryEngine.searchEntities(
        identity,
        Object.freeze({ kind: "component", text: "semantic anchor" }),
        Object.freeze({ limit: 20 }),
      ),
    );
    assert(search.items.length === 1, "search did not isolate the semantic anchor");
    const detail = valueOf(await queryEngine.exactEntity(identity, entityId(43)));
    const traversal = valueOf(
      await queryEngine.traverseRelations(
        identity,
        Object.freeze({ depth: 2, direction: "both", entity: entityId(43) }),
        Object.freeze({ limit: 20 }),
      ),
    );
    assert(traversal.items.length > 0, "connected graph traversal was empty");
    return Object.freeze({ detail, enumeratePages, search, traversal });
  });

  const root = graph.entities[0]!;
  const children = graph.entities.slice(1, 21);
  let model = mergeRootsPage(emptyModel(), apiPage([root], false));
  model = mergeChildrenPage(
    model,
    root.id,
    apiPage(children.slice(0, BROWSER_CHILD_PAGE_SIZE), true, "children-page-2"),
  );
  const firstLayer = buildBlueprintFlowGraph({
    dependencies: graph.relations,
    model,
  });
  model = mergeChildrenPage(
    model,
    root.id,
    apiPage(children.slice(BROWSER_CHILD_PAGE_SIZE), true, "children-page-3"),
  );
  const secondLayer = buildBlueprintFlowGraph({ dependencies: graph.relations, model });
  const focus = children[0]!;
  const focusedChild = graph.entities[401]!;
  model = mergeChildrenPage(model, focus.id, apiPage([focusedChild], false));
  const focused = buildBlueprintFlowGraph({
    dependencies: graph.relations,
    focusPath: [focus.id],
    model,
  });
  assert(
    firstLayer.nodes.length <= BROWSER_CHILD_PAGE_SIZE + 1,
    "main layer exceeded its bounded child page",
  );
  assert(
    focused.nodes.some((node) => node.id === focusedChild.id),
    "focus did not reveal detail",
  );

  const smallProjection = createLocalProjectionIndex({
    bounds: {
      maxBytes: 8 * 1024 * 1024,
      maxEntities: 21,
      maxPageSize: QUERY_PAGE_SIZE,
      maxRelations: RELATION_COUNT,
    },
    canonical: Object.freeze({
      snapshot: async () =>
        success(
          Object.freeze({
            aliases: Object.freeze([]),
            entities: graph.entities.slice(0, 21),
            generation,
            relations: graph.relations.filter(
              (relation) =>
                Number.parseInt(relation.source.slice(4), 16) <= 21 &&
                Number.parseInt(relation.target.slice(4), 16) <= 21,
            ),
          }),
        ),
    }),
  });
  assert((await smallProjection.rebuild()).ok, "small projection did not rebuild");
  const smallModel = mergeChildrenPage(
    mergeRootsPage(emptyModel(), apiPage([root], false)),
    root.id,
    apiPage(children.slice(0, BROWSER_CHILD_PAGE_SIZE), true, "children-page-2"),
  );
  const smallLayer = buildBlueprintFlowGraph({ dependencies: graph.relations, model: smallModel });
  const semanticSliceEquivalent =
    JSON.stringify(firstLayer) === JSON.stringify(smallLayer) &&
    JSON.stringify(queryResult.detail.item.payload) === JSON.stringify(graph.entities[42]!.payload);
  assert(semanticSliceEquivalent, "small and large semantic slices diverged");

  return Object.freeze({
    connectedEdgesDrawn: secondLayer.edges.length,
    detailIdentity: queryResult.detail.item.id,
    entities: graph.entities.length,
    enumeratePages: queryResult.enumeratePages,
    focusedNodes: focused.nodes.length,
    mainLayerNodes: firstLayer.nodes.length,
    query,
    rebuild,
    relationships: graph.relations.length,
    retainedNodesAfterTwoPages: model.nodes.size,
    searchPageItems: queryResult.search.items.length,
    semanticSliceEquivalent,
  });
}

async function main(): Promise<void> {
  const observations = await observationFixture();
  const reconcile = await reconcileFixture(observations.snapshot);
  const evidence = await evidenceFixture(observations.snapshot);
  const projection = await projectionFixture();
  const report: ScaleReport = Object.freeze({
    browser: Object.freeze({
      connectedEdgesDrawn: projection.connectedEdgesDrawn,
      detailIdentity: projection.detailIdentity,
      focusedNodes: projection.focusedNodes,
      mainLayerNodes: projection.mainLayerNodes,
      retainedNodesAfterTwoPages: projection.retainedNodesAfterTwoPages,
      searchPageItems: projection.searchPageItems,
    }),
    evidence: Object.freeze({
      deterministic: evidence.deterministic,
      documentCount: evidence.documentCount,
      indexBytes: evidence.indexBytes,
      largestShardBytes: evidence.largestShardBytes,
      roundTripRecords: evidence.roundTripRecords,
      serialize: evidence.measurement,
    }),
    observations: Object.freeze({
      batches: OBSERVATION_COUNT / OBSERVATION_BATCH_SIZE,
      canonicalCharacters: observations.snapshot.records.reduce(
        (total, record) => total + JSON.stringify(record).length,
        0,
      ),
      ingest: observations.measurement,
      reconcile,
      records: observations.snapshot.records.length,
    }),
    projection: Object.freeze({
      entities: projection.entities,
      enumeratePages: projection.enumeratePages,
      query: projection.query,
      rebuild: projection.rebuild,
      relationships: projection.relationships,
      semanticSliceEquivalent: projection.semanticSliceEquivalent,
    }),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();
