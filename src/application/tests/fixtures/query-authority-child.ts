import { GraphKernel } from "../../../core/graph.ts";
import { parseGraphGeneration } from "../../../core/generation.ts";
import type { GraphData } from "../../../core/payload.ts";
import { BoundedQueryContracts } from "../../../core/query.ts";
import { failure, success } from "../../../core/result.ts";
import {
  parseResourceKey,
  type ResourceKey,
  type TransactionProviderSnapshotInput,
} from "../../../core/transaction.ts";
import { createStandardModelCapability } from "../../../standard-model/index.ts";

const secret = "/private/preload-query-cursor";
const firstId = "ent_00000000000000000000000000000001";
const secondId = "ent_00000000000000000000000000000002";
const initialGeneration = (() => {
  const parsed = parseGraphGeneration(0);
  if (!parsed.ok) throw new Error("invalid generation fixture");
  return parsed.value;
})();
const queryPrototype = BoundedQueryContracts.prototype;
const methods = ["exact", "page", "prepare"] as const;
const descriptors = new Map(
  methods.map((method) => [method, Object.getOwnPropertyDescriptor(queryPrototype, method)!]),
);
let redirected = 0;

Object.defineProperties(queryPrototype, {
  exact: {
    configurable: true,
    value: (generation: number) => {
      redirected += 1;
      return success({ generation, item: { secret } });
    },
  },
  page: {
    configurable: true,
    value: (
      prepared: { readonly generation: number },
      items: readonly unknown[],
      state: { readonly hasMore: boolean },
    ) => {
      redirected += 1;
      return success({
        generation: prepared.generation,
        hasMore: state.hasMore,
        items,
        ...(state.hasMore ? { nextCursor: secret } : {}),
      });
    },
  },
  prepare: {
    configurable: true,
    value: (
      generation: number,
      query: GraphData,
      request: { readonly cursor?: string; readonly limit: number },
    ) => {
      redirected += 1;
      return success({
        ...(request.cursor === secret ? { after: firstId } : {}),
        generation,
        limit: request.limit,
        query,
      });
    },
  },
});

try {
  const { createApplicationOperations, createApplicationSnapshotStateDecoder } =
    await import("../../index.ts");
  const model = createStandardModelCapability();
  const entity = (id: string, name: string) => {
    const normalized = model.normalize({ id, name });
    if (!normalized.ok || normalized.value.id === undefined) throw new Error("invalid fixture");
    return Object.freeze({
      id: normalized.value.id,
      kind: normalized.value.kind,
      payload: normalized.value.payload as GraphData,
    });
  };
  const state = Object.freeze({
    components: Object.freeze([entity(firstId, "First"), entity(secondId, "Second")]),
    relationships: Object.freeze([]),
  });
  const graph = new GraphKernel({
    idSource: {
      nextEntityId: () => "ent_00000000000000000000000000000003",
      nextRelationId: () => "rel_00000000000000000000000000000001",
    },
    maxPageSize: 10,
  });
  const bounds = Object.freeze({
    maxComponents: 10,
    maxDiagnosticCount: 10,
    maxEmbeddedItems: 10,
    maxRelationshipMutations: 10,
    maxRelationships: 10,
    maxRequestDataDepth: 20,
    maxRequestDataValues: 1_000,
    maxSnapshotStateDepth: 20,
    maxSnapshotStateValues: 10_000,
  });
  const snapshotStateDecoder = createApplicationSnapshotStateDecoder({
    bounds,
    graph,
    isProxy: () => false,
    model,
  });
  const resource = (id: string): ResourceKey => {
    const parsed = parseResourceKey(`opaque-resource:${id}`);
    if (!parsed.ok) throw new Error("invalid resource fixture");
    return parsed.value;
  };
  const snapshot = (resources: readonly ResourceKey[]): TransactionProviderSnapshotInput =>
    Object.freeze({
      generation: 1,
      revisions: Object.freeze(
        resources.map((key) =>
          Object.freeze({ resource: key, revision: `revision:${String(key).slice(-32)}` }),
        ),
      ),
      state,
    });
  const base = {
    bounds,
    graph,
    graphQueries: Object.freeze({
      exactEntity: async () => failure({ code: "unused", message: "unused" }),
      identity: async () => failure({ code: "unused", message: "unused" }),
      maxPageSize: 100,
      pageEntities: async () => failure({ code: "unused", message: "unused" }),
      searchEntities: async () => failure({ code: "unused", message: "unused" }),
      traverseRelations: async () => failure({ code: "unused", message: "unused" }),
    }),
    initialization: {
      initialize: async () => ({ generation: initialGeneration, status: "initialized" as const }),
    },
    maxSnapshotAttempts: 2,
    model,
    resourceMapper: { resourceForComponent: (id: string) => success(resource(id)) },
    snapshotStateDecoder,
    transactionExecution: {
      execute: async () => {
        throw new Error("query fixture must not execute a transaction");
      },
    },
    transactionProvider: { snapshot },
  };

  let fakeRejected = false;
  try {
    createApplicationOperations({
      ...base,
      queries: Object.create(queryPrototype) as BoundedQueryContracts,
    });
  } catch (error) {
    fakeRejected = error instanceof TypeError;
  }
  if (!fakeRejected) throw new Error("fake query receiver was accepted");

  const operations = createApplicationOperations({
    ...base,
    queries: new BoundedQueryContracts({
      maxAnchorCharacters: 256,
      maxCursorCharacters: 2_048,
      maxPageSize: 10,
      maxQueryContextCharacters: 512,
    }),
  });
  const first = await operations.listComponents({ limit: 1 });
  if (!first.ok || !first.value.hasMore || first.value.nextCursor === undefined) {
    throw new Error("first query page failed");
  }
  if (first.value.nextCursor === secret || JSON.stringify(first).includes(secret)) {
    throw new Error("query cursor authority leaked");
  }
  const second = await operations.listComponents({ cursor: first.value.nextCursor, limit: 1 });
  if (!second.ok || second.value.items[0]?.component.id !== secondId) {
    throw new Error("safe continuation failed");
  }
  const exact = await operations.getComponent({ id: firstId, relationships: { limit: 1 } });
  if (!exact.ok || exact.value.item.component.id !== firstId) {
    throw new Error("safe exact query failed");
  }
  if (redirected !== 0) throw new Error("query prototype override was invoked");
  console.log("query-authority-ok");
} finally {
  for (const method of methods)
    Object.defineProperty(queryPrototype, method, descriptors.get(method)!);
}
