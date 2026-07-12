import { describe, expect, test } from "bun:test";

import {
  BoundedQueryContracts,
  GraphKernel,
  parseGraphGeneration,
  parseResourceKey,
  success,
  type GraphData,
  type GraphGeneration,
  type ResourceKey,
  type TransactionProviderSnapshotInput,
} from "../../core/index.ts";
import {
  createStandardModelCapability,
  type StandardComponentInput,
  type StandardModelTransactionState,
} from "../../standard-model/index.ts";
import {
  createApplicationOperations,
  type ApplicationOperationsOptions,
  type WorkspaceInitializationOutcome,
} from "../index.ts";

const ids = {
  domain: "ent_00000000000000000000000000000001",
  service: "ent_00000000000000000000000000000002",
  module: "ent_00000000000000000000000000000003",
  nestedService: "ent_00000000000000000000000000000004",
  secondRoot: "ent_00000000000000000000000000000005",
  target: "ent_00000000000000000000000000000006",
} as const;

const relationIds = {
  first: "rel_00000000000000000000000000000001",
  second: "rel_00000000000000000000000000000002",
} as const;

const model = createStandardModelCapability();

function component(input: StandardComponentInput) {
  const normalized = model.normalize(input);
  if (!normalized.ok || normalized.value.id === undefined) throw new Error("invalid fixture");
  return Object.freeze({
    id: normalized.value.id,
    kind: normalized.value.kind,
    payload: normalized.value.payload as GraphData,
  });
}

function state(
  components: readonly ReturnType<typeof component>[],
  relationships: StandardModelTransactionState["relationships"] = [],
): StandardModelTransactionState {
  return Object.freeze({
    components: Object.freeze([...components]),
    relationships: Object.freeze([...relationships]),
  });
}

const richState = state(
  [
    component({ id: ids.domain, name: "Commerce", type: "domain" }),
    component({
      "example.dev/owner": "architecture",
      actions: [{ id: "deploy", description: "Release safely" }],
      desired: "active",
      id: ids.service,
      inputs: [{ id: "orders", name: "Orders" }],
      intent: "Own the order lifecycle.",
      lifecycle: "active",
      name: "Ordering",
      outputs: [{ id: "receipts", name: "Receipts" }],
      parent: ids.domain,
      type: "service",
    }),
    component({ id: ids.module, name: "Checkout", parent: ids.service, type: "module" }),
    component({
      id: ids.nestedService,
      name: "Worker",
      parent: ids.module,
      type: "service",
    }),
    component({ id: ids.secondRoot, name: "Platform", type: "domain" }),
    component({ id: ids.target, name: "Identity", parent: ids.secondRoot, type: "service" }),
  ],
  [
    {
      id: relationIds.first,
      payload: { description: "Authenticates through" },
      source: ids.service,
      target: ids.target,
      type: "depends-on",
    },
    {
      id: relationIds.second,
      payload: { "example.dev/strength": "required" },
      source: ids.service,
      target: ids.module,
      type: "coordinates-with",
    },
  ],
);

function resource(id: string): ResourceKey {
  const parsed = parseResourceKey(`opaque-resource:${id}`);
  if (!parsed.ok) throw new Error("invalid resource fixture");
  return parsed.value;
}

function generation(value: number): GraphGeneration {
  const parsed = parseGraphGeneration(value);
  if (!parsed.ok) throw new Error("invalid generation fixture");
  return parsed.value;
}

class SnapshotFixture {
  generation = 1;
  readonly requested: readonly ResourceKey[][] = [];
  sequence: number[] = [];
  currentState: StandardModelTransactionState = richState;

  snapshot = (resources: readonly ResourceKey[]): TransactionProviderSnapshotInput => {
    (this.requested as ResourceKey[][]).push([...resources]);
    const generation = this.sequence.shift() ?? this.generation;
    return Object.freeze({
      generation,
      revisions: Object.freeze(
        resources.map((key) =>
          Object.freeze({ resource: key, revision: `revision:${String(key).slice(-32)}` }),
        ),
      ),
      state: this.currentState,
    });
  };
}

function operations(
  fixture: SnapshotFixture,
  initializationOutcome: WorkspaceInitializationOutcome = {
    generation: generation(0),
    status: "initialized",
  },
  overrides: Partial<ApplicationOperationsOptions> = {},
) {
  let entityCounter = 100;
  let relationCounter = 100;
  return createApplicationOperations({
    graph: new GraphKernel({
      idSource: {
        nextEntityId: () => `ent_${(entityCounter++).toString(16).padStart(32, "0")}`,
        nextRelationId: () => `rel_${(relationCounter++).toString(16).padStart(32, "0")}`,
      },
      maxPageSize: 100,
    }),
    initialization: { initialize: async () => initializationOutcome },
    maxSnapshotAttempts: 3,
    model,
    queries: new BoundedQueryContracts({
      maxAnchorCharacters: 256,
      maxCursorCharacters: 2_048,
      maxPageSize: 10,
      maxQueryContextCharacters: 512,
    }),
    resourceMapper: { resourceForComponent: (id) => success(resource(id)) },
    transactionExecution: {
      execute: async () => {
        throw new Error("read slice must not execute transactions");
      },
    },
    transactionProvider: fixture,
    ...overrides,
  });
}

describe("application workspace initialization", () => {
  test.each<WorkspaceInitializationOutcome>([
    { generation: generation(1), status: "initialized" },
    { generation: generation(2), status: "already-initialized" },
    {
      diagnostics: [{ code: "workspace-conflict", message: "Workspace conflicts" }],
      status: "conflict",
    },
  ] as const)("delegates the $status outcome", async (outcome) => {
    const result = await operations(new SnapshotFixture(), outcome).initialize({});
    expect(result).toEqual(success(outcome));
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
  });

  test("rejects non-empty or accessor-bearing requests before delegation", async () => {
    let calls = 0;
    const api = operations(
      new SnapshotFixture(),
      { generation: generation(0), status: "initialized" },
      {
        initialization: {
          initialize: async () => {
            calls += 1;
            return { generation: generation(0), status: "initialized" };
          },
        },
      },
    );
    expect((await api.initialize({ unexpected: true } as never)).ok).toBe(false);
    const accessor = {};
    Object.defineProperty(accessor, "value", { enumerable: true, get: () => 1 });
    expect((await api.initialize(accessor)).ok).toBe(false);
    expect(calls).toBe(0);
  });
});

describe("application component reads", () => {
  test("reads sparse and rich exact components with bounded outgoing relationships", async () => {
    const fixture = new SnapshotFixture();
    const api = operations(fixture);
    const rich = await api.getComponent({ id: ids.service, relationships: { limit: 1 } });
    expect(rich.ok).toBe(true);
    if (!rich.ok) return;
    expect(rich.value.item.component.intent).toBe("Own the order lifecycle.");
    expect(rich.value.item.component.extensions).toEqual({
      "example.dev/owner": "architecture",
    });
    expect(rich.value.relationships.items.map((item) => String(item.relationship.id))).toEqual([
      relationIds.first,
    ]);
    expect(rich.value.relationships.hasMore).toBe(true);
    expect(rich.value.relationships.nextCursor).toBeDefined();
    expect(rich.value.item.revision).toStartWith("revision:");

    const next = await api.getComponent({
      id: ids.service,
      relationships: { cursor: rich.value.relationships.nextCursor!, limit: 1 },
    });
    expect(next.ok && String(next.value.relationships.items[0]?.relationship.id)).toBe(
      relationIds.second,
    );
    const sparse = await api.getComponent({ id: ids.domain, relationships: { limit: 2 } });
    expect(sparse.ok && sparse.value.item.component.intent).toBeUndefined();
    expect(fixture.requested.every((request) => request.length === 1)).toBe(true);
  });

  test("lists all, multiple roots, and recursive same/mixed-type children deterministically", async () => {
    const api = operations(new SnapshotFixture());
    const all = await api.listComponents({ limit: 10 });
    expect(all.ok && all.value.items.map((item) => String(item.component.id))).toEqual(
      Object.values(ids),
    );
    const roots = await api.listRoots({ limit: 10 });
    expect(roots.ok && roots.value.items.map((item) => String(item.component.id))).toEqual([
      ids.domain,
      ids.secondRoot,
    ]);
    const domainChildren = await api.listChildren({ limit: 10, parent: ids.domain });
    expect(
      domainChildren.ok && domainChildren.value.items.map((item) => String(item.component.id)),
    ).toEqual([ids.service]);
    const serviceChildren = await api.listChildren({ limit: 10, parent: ids.service });
    expect(serviceChildren.ok && serviceChildren.value.items[0]?.component.type).toBe("module");
    const moduleChildren = await api.listChildren({ limit: 10, parent: ids.module });
    expect(moduleChildren.ok && moduleChildren.value.items[0]?.component.type).toBe("service");
  });

  test("binds continuation cursors to query and generation", async () => {
    const fixture = new SnapshotFixture();
    const api = operations(fixture);
    const first = await api.listComponents({ limit: 2 });
    expect(first.ok && first.value.hasMore).toBe(true);
    if (!first.ok || first.value.nextCursor === undefined) return;
    const next = await api.listComponents({ cursor: first.value.nextCursor, limit: 2 });
    expect(next.ok && next.value.items.map((item) => String(item.component.id))).toEqual([
      ids.module,
      ids.nestedService,
    ]);
    const wrongQuery = await api.listRoots({ cursor: first.value.nextCursor, limit: 2 });
    expect(wrongQuery.ok ? "" : wrongQuery.diagnostics[0]?.code).toBe("cursor-query-mismatch");
    fixture.generation = 2;
    const stale = await api.listComponents({ cursor: first.value.nextCursor, limit: 2 });
    expect(stale.ok ? "" : stale.diagnostics[0]?.code).toBe("stale-cursor");
  });

  test("retries a page when generation changes and fails after the configured bound", async () => {
    const retry = new SnapshotFixture();
    retry.sequence = [1, 2, 2, 2];
    const recovered = await operations(retry).listRoots({ limit: 2 });
    expect(recovered.ok && Number(recovered.value.generation)).toBe(2);
    expect(retry.requested).toHaveLength(4);

    const racing = new SnapshotFixture();
    racing.sequence = [1, 2, 3, 4, 5, 6];
    const exhausted = await operations(racing).listRoots({ limit: 2 });
    expect(exhausted.ok ? "" : exhausted.diagnostics[0]?.code).toBe("snapshot-generation-conflict");
  });

  test("rejects malformed request and provider state without leaking resource keys", async () => {
    const fixture = new SnapshotFixture();
    const api = operations(fixture);
    const malformedRequest = await api.getComponent({ id: ids.domain } as never);
    expect(malformedRequest.ok ? "" : malformedRequest.diagnostics[0]?.code).toBe(
      "invalid-application-request",
    );
    fixture.currentState = { components: [], relationships: [], unexpected: true } as never;
    const malformedState = await api.listComponents({ limit: 2 });
    expect(malformedState.ok).toBe(false);
    expect(JSON.stringify(malformedState)).not.toContain("opaque-resource:");

    const missing = new SnapshotFixture();
    missing.currentState = state([]);
    const notFound = await operations(missing).getComponent({
      id: ids.domain,
      relationships: { limit: 1 },
    });
    expect(notFound.ok ? "" : notFound.diagnostics[0]?.code).toBe("unknown-component");
    expect(JSON.stringify(notFound)).not.toContain("opaque-resource:");
  });

  test("accepts an uninitialized empty state as an empty bounded graph", async () => {
    const fixture = new SnapshotFixture();
    fixture.currentState = state([]);
    const page = await operations(fixture).listComponents({ limit: 5 });
    expect(page.ok && page.value.items).toEqual([]);
    expect(page.ok && Number(page.value.generation)).toBe(1);
  });
});
