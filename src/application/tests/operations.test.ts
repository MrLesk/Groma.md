import { describe, expect, test } from "bun:test";

import {
  BoundedQueryContracts,
  GraphKernel,
  TransactionEngine,
  failure,
  parseGraphGeneration,
  parseResourceKey,
  success,
  type GraphData,
  type GraphDataRecord,
  type GraphEntity,
  type GraphGeneration,
  type GraphRelation,
  type OpaqueIdSource,
  type ProposedTransaction,
  type ResourceKey,
  type TransactionCommitResultInput,
  type TransactionOutcome,
  type TransactionPrepareResultInput,
  type TransactionProvider,
  type TransactionRequest,
  type TransactionProviderSnapshotInput,
} from "../../core/index.ts";
import {
  STANDARD_COMPONENT_KIND,
  createStandardModelCapability,
  createStandardModelInvariant,
  type StandardComponentInput,
  type StandardComponentPatch,
  type StandardModelCapability,
  type StandardModelTransactionState,
} from "../../standard-model/index.ts";
import {
  type ApplicationMutationOutcome,
  type ApplicationOperationBounds,
  createApplicationOperations,
  createApplicationSnapshotStateDecoder,
  type ApplicationOperationsOptions,
  type ApplicationSnapshotStateDecoder,
  type WorkspaceInitializationOutcome,
} from "../index.ts";
import * as snapshotStateModule from "../snapshot-state.ts";
import {
  createStatefulSemanticInitializer,
  exerciseApplicationOperations,
  expectedApplicationOperationsTrace,
} from "./conformance.ts";

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
const applicationBounds: ApplicationOperationBounds = Object.freeze({
  maxComponents: 1_000,
  maxDiagnosticCount: 100,
  maxEmbeddedItems: 100,
  maxRelationshipMutations: 100,
  maxRelationships: 1_000,
  maxRequestDataDepth: 30,
  maxRequestDataValues: 10_000,
  maxSnapshotStateDepth: 30,
  maxSnapshotStateValues: 100_000,
});

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

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

class MutationProvider implements TransactionProvider {
  commits = 0;
  generation = 0;
  prepares = 0;
  revisions = new Map<ResourceKey, string>();
  snapshots = 0;
  currentState: StandardModelTransactionState = state([]);
  #pending: ProposedTransaction | undefined;

  snapshot = (resources: readonly ResourceKey[]): TransactionProviderSnapshotInput => {
    this.snapshots += 1;
    return Object.freeze({
      generation: this.generation,
      revisions: Object.freeze(
        resources.map((key) =>
          Object.freeze({ resource: key, revision: this.revisions.get(key) ?? null }),
        ),
      ),
      state: this.currentState,
    });
  };

  prepare = (proposal: ProposedTransaction): TransactionPrepareResultInput => {
    this.prepares += 1;
    if (proposal.baseGeneration !== this.generation) {
      return Object.freeze({ reason: "generation", status: "conflict" });
    }
    for (const expected of proposal.expectedRevisions) {
      if ((this.revisions.get(expected.resource) ?? null) !== expected.expected) {
        return Object.freeze({ reason: "revision", status: "conflict" });
      }
    }
    this.#pending = proposal;
    return Object.freeze({ status: "prepared", token: `memory-token-${this.prepares}` });
  };

  commit = (_token: string): TransactionCommitResultInput => {
    const proposal = this.#pending;
    if (proposal === undefined) return Object.freeze({ status: "not-committed" });
    this.#pending = undefined;
    const mutation = proposal.mutation as {
      readonly components: readonly GraphDataRecord[];
      readonly relationships: readonly GraphDataRecord[];
    };
    const components = new Map(
      this.currentState.components.map((entry) => [entry.id, entry] as const),
    );
    const relationships = new Map(
      this.currentState.relationships.map((entry) => [entry.id, entry] as const),
    );
    for (const change of mutation.components) {
      if (change.type === "create") {
        const input = change.component as GraphDataRecord;
        const normalized = model.normalize(input);
        if (!normalized.ok || normalized.value.id === undefined) throw new Error("invalid create");
        components.set(
          normalized.value.id,
          Object.freeze({
            id: normalized.value.id,
            kind: normalized.value.kind,
            payload: normalized.value.payload as GraphData,
          }),
        );
      } else if (change.type === "patch") {
        const id = String(change.id);
        const existing = components.get(id);
        if (existing === undefined) throw new Error("missing patch target");
        const patched = model.patch(existing as never, change.patch as never);
        if (!patched.ok) throw new Error("invalid patch");
        components.set(
          id,
          Object.freeze({
            id,
            kind: patched.value.kind,
            payload: patched.value.payload as GraphData,
          }),
        );
      } else if (change.type === "remove") {
        components.delete(String(change.id));
      }
    }
    for (const change of mutation.relationships) {
      if (change.type === "upsert") {
        const relationship = change.relationship as GraphDataRecord;
        relationships.set(
          String(relationship.id),
          Object.freeze({
            id: String(relationship.id),
            payload: relationship.payload as GraphData,
            source: String(relationship.source),
            target: String(relationship.target),
            type: String(relationship.type),
          }),
        );
      } else if (change.type === "remove") {
        relationships.delete(String(change.id));
      }
    }
    this.currentState = Object.freeze({
      components: Object.freeze(
        Array.from(components.values()).sort((left, right) =>
          left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
        ),
      ) as StandardModelTransactionState["components"],
      relationships: Object.freeze(
        Array.from(relationships.values()).sort((left, right) =>
          left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
        ),
      ) as StandardModelTransactionState["relationships"],
    });
    this.generation = proposal.generation;
    const confirmed = proposal.expectedRevisions.map((expected) => {
      const componentId = String(expected.resource).slice("opaque-resource:".length);
      const stillExists = components.has(componentId);
      const revision = stillExists ? `committed-revision-${this.generation}-${componentId}` : null;
      if (revision === null) this.revisions.delete(expected.resource);
      else this.revisions.set(expected.resource, revision);
      return Object.freeze({ resource: expected.resource, revision });
    });
    this.commits += 1;
    return Object.freeze({
      affected: proposal.affected,
      generation: proposal.generation,
      revisions: Object.freeze(confirmed),
      status: "committed",
    });
  };

  recover = (): TransactionCommitResultInput => Object.freeze({ status: "not-committed" });
}

function mutationOperations(
  provider = new MutationProvider(),
  executeOverride?: (
    request: TransactionRequest,
    engine: TransactionEngine,
  ) => Promise<TransactionOutcome>,
  idSource?: OpaqueIdSource,
  bounds = applicationBounds,
  modelCapability: StandardModelCapability = model,
  isProxy?: (value: unknown) => boolean,
) {
  const semanticInitialization = createStatefulSemanticInitializer();
  let entityCounter = 50;
  let relationCounter = 50;
  const graph = new GraphKernel({
    idSource: idSource ?? {
      nextEntityId: () => `ent_${(entityCounter++).toString(16).padStart(32, "0")}`,
      nextRelationId: () => `rel_${(relationCounter++).toString(16).padStart(32, "0")}`,
    },
    maxPageSize: 100,
  });
  const engine = new TransactionEngine({
    maxAffectedIdentities: 100,
    maxRequestDataDepth: 20,
    maxRequestDataValues: 10_000,
    maxSnapshotStateDepth: 20,
    maxSnapshotStateValues: 10_000,
    provider,
  });
  const registered = engine.registerInvariant(
    createStandardModelInvariant({
      maxComponentMutations: 100,
      maxComponents: 1_000,
      maxOwnerCharacters: 100,
      maxPinnedComponentIds: 100,
      maxRelationshipMutations: 100,
      maxRelationships: 1_000,
    }),
  );
  if (!registered.ok) throw new Error("failed to register test invariant");
  const snapshotStateDecoder = createApplicationSnapshotStateDecoder({
    bounds,
    graph,
    ...(isProxy === undefined ? {} : { isProxy }),
    model: modelCapability,
  });
  let executions = 0;
  let mappings = 0;
  const api = createApplicationOperations({
    bounds,
    graph,
    initialization: semanticInitialization.capability,
    maxSnapshotAttempts: 3,
    model: modelCapability,
    queries: new BoundedQueryContracts({
      maxAnchorCharacters: 256,
      maxCursorCharacters: 2_048,
      maxPageSize: 10,
      maxQueryContextCharacters: 512,
    }),
    resourceMapper: {
      resourceForComponent: (id) => {
        mappings += 1;
        return success(resource(id));
      },
    },
    snapshotStateDecoder,
    transactionExecution: {
      execute: (request) => {
        executions += 1;
        return executeOverride === undefined
          ? engine.execute(request)
          : executeOverride(request, engine);
      },
    },
    transactionProvider: provider,
  });
  return {
    api,
    executions: () => executions,
    initialization: semanticInitialization,
    mappings: () => mappings,
    provider,
  };
}

function applicationOptions(
  fixture: SnapshotFixture,
  initializationOutcome: WorkspaceInitializationOutcome = {
    generation: generation(0),
    status: "initialized",
  },
  overrides: Partial<ApplicationOperationsOptions> = {},
) {
  let entityCounter = 100;
  let relationCounter = 100;
  const bounds = overrides.bounds ?? applicationBounds;
  const graph =
    overrides.graph ??
    new GraphKernel({
      idSource: {
        nextEntityId: () => `ent_${(entityCounter++).toString(16).padStart(32, "0")}`,
        nextRelationId: () => `rel_${(relationCounter++).toString(16).padStart(32, "0")}`,
      },
      maxPageSize: 100,
    });
  const snapshotStateDecoder =
    overrides.snapshotStateDecoder ??
    createApplicationSnapshotStateDecoder({ bounds, graph, model });
  return {
    bounds,
    graph,
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
    snapshotStateDecoder,
    transactionExecution: {
      execute: async () => {
        throw new Error("read slice must not execute transactions");
      },
    },
    transactionProvider: fixture,
    ...overrides,
  } satisfies ApplicationOperationsOptions;
}

function operations(
  fixture: SnapshotFixture,
  initializationOutcome: WorkspaceInitializationOutcome = {
    generation: generation(0),
    status: "initialized",
  },
  overrides: Partial<ApplicationOperationsOptions> = {},
) {
  return createApplicationOperations(applicationOptions(fixture, initializationOutcome, overrides));
}

function recognizedProxy<T extends object>(
  value: T,
  proxies: Set<unknown>,
  traps: { count: number },
): T {
  const proxy = new Proxy(value, {
    ownKeys: () => {
      traps.count += 1;
      throw new Error("/private/recognized-proxy-trap");
    },
  });
  proxies.add(proxy);
  return proxy;
}

function proxyAwareOperations(
  fixture: SnapshotFixture,
  proxies: ReadonlySet<unknown>,
  overrides: Partial<ApplicationOperationsOptions> = {},
) {
  const options = applicationOptions(fixture, undefined, overrides);
  return createApplicationOperations({
    ...options,
    snapshotStateDecoder: createApplicationSnapshotStateDecoder({
      bounds: options.bounds,
      graph: options.graph,
      isProxy: (value) => proxies.has(value),
      model: options.model,
    }),
  });
}

describe("application workspace initialization", () => {
  test.each<WorkspaceInitializationOutcome>([
    { generation: generation(1), status: "initialized" },
    { generation: generation(2), status: "already-initialized" },
    {
      diagnostics: [
        {
          code: "workspace-conflict",
          message: "The operation conflicts with current canonical state",
        },
      ],
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

  test("atomically initializes absent semantic state and reports compatible repetition", async () => {
    const semantic = createStatefulSemanticInitializer();
    const api = operations(new SnapshotFixture(), undefined, {
      initialization: semantic.capability,
    });
    const first = await api.initialize({});
    const second = await api.initialize({});
    expect(first.ok && first.value.status).toBe("initialized");
    expect(second.ok && second.value.status).toBe("already-initialized");
    expect(semantic.snapshot()).toEqual({
      components: [],
      generation: 0,
      relationships: [],
      state: "initialized",
    });
  });

  test("preserves conflicting semantic state and copies typed diagnostic details", async () => {
    const semantic = createStatefulSemanticInitializer("conflicting");
    const before = JSON.stringify(semantic.snapshot());
    const api = operations(new SnapshotFixture(), undefined, {
      initialization: semantic.capability,
    });
    const result = await api.initialize({});
    expect(result.ok && result.value.status).toBe("conflict");
    if (!result.ok || result.value.status !== "conflict") return;
    expect(result.value.diagnostics[0]?.details).toEqual({
      attempts: 1,
      overwritePrevented: true,
      state: "incompatible",
    });
    expect(Object.isFrozen(result.value.diagnostics[0]?.details)).toBe(true);
    expect(JSON.stringify(semantic.snapshot())).toBe(before);
    expect(semantic.snapshot().sentinel).toBe("preserve-incompatible-workspace");
  });

  test("rejects accessor-bearing initialization diagnostic details without invoking them", async () => {
    let invoked = false;
    const details = {};
    Object.defineProperty(details, "secret", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "hidden";
      },
    });
    const api = operations(new SnapshotFixture(), undefined, {
      initialization: {
        initialize: async () =>
          ({
            diagnostics: [{ code: "conflict", details, message: "Conflict" }],
            status: "conflict",
          }) as never,
      },
    });
    expect((await api.initialize({})).ok).toBe(false);
    expect(invoked).toBe(false);
  });

  test("replaces unsafe initialization diagnostic codes without leaking them", async () => {
    const secret = "/private/workspace/groma/intent/secret.md";
    for (const entry of [
      { expected: "application-conflict", status: "conflict" },
      { expected: "application-provider-failure", status: "provider-failure" },
    ] as const) {
      const result = await operations(new SnapshotFixture(), {
        diagnostics: [{ code: secret, message: `Initialization exposed ${secret}` }],
        status: entry.status,
      }).initialize({});
      expect(result.ok).toBe(true);
      expect(JSON.stringify(result)).not.toContain(secret);
      if (
        !result.ok ||
        result.value.status === "initialized" ||
        result.value.status === "already-initialized"
      ) {
        continue;
      }
      expect(result.value.diagnostics[0]?.code).toBe(entry.expected);
    }
  });

  test("rejects recognized outer and nested initialization proxies without traps", async () => {
    for (const location of ["outer", "diagnostics", "details"] as const) {
      const proxies = new Set<unknown>();
      const traps = { count: 0 };
      const base = {
        diagnostics: [
          {
            code: "workspace-conflict",
            details:
              location === "details"
                ? recognizedProxy({ attempts: 1 }, proxies, traps)
                : { attempts: 1 },
            message: "Conflict",
          },
        ],
        status: "conflict" as const,
      };
      const outcome =
        location === "outer"
          ? recognizedProxy(base, proxies, traps)
          : location === "diagnostics"
            ? { ...base, diagnostics: recognizedProxy(base.diagnostics, proxies, traps) }
            : base;
      const api = proxyAwareOperations(new SnapshotFixture(), proxies, {
        initialization: { initialize: async () => outcome as never },
      });
      const result = await api.initialize({});
      expect(result.ok, location).toBeFalse();
      expect(result.ok ? "" : result.diagnostics[0]?.code, location).toBe(
        "workspace-initialization-failed",
      );
      expect(Object.isFrozen(result), location).toBeTrue();
      expect(traps.count, location).toBe(0);
    }
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

  test("uses the injected proxy-aware snapshot decoder for application reads", async () => {
    const fixture = new SnapshotFixture();
    fixture.currentState = new Proxy(state([]), {});
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const api = operations(fixture, undefined, {
      graph,
      snapshotStateDecoder: createApplicationSnapshotStateDecoder({
        bounds: applicationBounds,
        graph,
        isProxy: (value) => value === fixture.currentState,
        model,
      }),
    });

    expect(await api.listComponents({ limit: 2 })).toMatchObject({
      diagnostics: [{ code: "invalid-standard-model-state" }],
      ok: false,
    });
  });

  test("rejects forged, wrapped, proxied, and throwing decoder objects before provider access", () => {
    const fixture = new SnapshotFixture();
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const decoder = createApplicationSnapshotStateDecoder({
      bounds: applicationBounds,
      graph,
      model,
    });
    const candidates = [
      { decode: () => success({ components: [], graph: graph.empty(), relationships: [] }) },
      { decode: decoder.decode },
      new Proxy(decoder, {}),
      { decode: () => Promise.reject(new Error("/private/decoder-secret")) },
      {
        decode: () => {
          throw new Error("/private/decoder-secret");
        },
      },
    ];

    for (const snapshotStateDecoder of candidates) {
      expect(() =>
        operations(fixture, undefined, {
          graph,
          snapshotStateDecoder: snapshotStateDecoder as never,
        }),
      ).toThrow("snapshotStateDecoder must be created");
    }
    expect(fixture.requested).toHaveLength(0);
  });

  test("keeps decoder provenance registration private to the factory module", () => {
    expect("registerApplicationSnapshotStateDecoder" in snapshotStateModule).toBeFalse();
    expect("recordApplicationSnapshotStateDecoder" in snapshotStateModule).toBeFalse();
    expect("promiseSpeciesCarrier" in snapshotStateModule).toBeFalse();
    expect("intrinsicPromiseSpeciesDescriptor" in snapshotStateModule).toBeFalse();
    expect(typeof snapshotStateModule.applicationSnapshotStateDecoderMetadata).toBe("function");
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const decoder = createApplicationSnapshotStateDecoder({
      bounds: applicationBounds,
      graph,
      model,
    });
    const metadata = snapshotStateModule.applicationSnapshotStateDecoderMetadata(decoder);
    expect(Object.isFrozen(metadata)).toBeTrue();
    expect(Object.isFrozen(metadata?.bounds)).toBeTrue();
  });

  test("requires exact decoder graph, model, and snapshot-bound compatibility", () => {
    const fixture = new SnapshotFixture();
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const decoderBounds = [
      "maxComponents",
      "maxDiagnosticCount",
      "maxEmbeddedItems",
      "maxRelationships",
      "maxSnapshotStateDepth",
      "maxSnapshotStateValues",
    ] as const;
    for (const name of decoderBounds) {
      const bounds = Object.freeze({
        ...applicationBounds,
        maxComponents: name === "maxComponents" ? 1 : applicationBounds.maxComponents,
      });
      const mismatched = Object.freeze({ ...bounds, [name]: bounds[name] + 1 });
      const snapshotStateDecoder = createApplicationSnapshotStateDecoder({
        bounds: mismatched,
        graph,
        model,
      });
      expect(() => operations(fixture, undefined, { bounds, graph, snapshotStateDecoder })).toThrow(
        `snapshotStateDecoder ${name} must match`,
      );
    }

    const otherGraph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.service,
        nextRelationId: () => relationIds.second,
      },
      maxPageSize: 100,
    });
    expect(() =>
      operations(fixture, undefined, {
        graph,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph: otherGraph,
          model,
        }),
      }),
    ).toThrow("snapshotStateDecoder graph must match");

    const otherModel = createStandardModelCapability();
    expect(() =>
      operations(fixture, undefined, {
        graph,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph,
          model: otherModel,
        }),
      }),
    ).toThrow("snapshotStateDecoder model must match");
    expect(fixture.requested).toHaveLength(0);
  });

  test("bounds diagnostics from every decoder Standard Model operation", () => {
    const bounds = Object.freeze({ ...applicationBounds, maxDiagnosticCount: 1 });
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const entity = component({ id: ids.domain, type: "domain" }) as GraphEntity;
    const relation: GraphRelation = Object.freeze({
      id: relationIds.first as GraphRelation["id"],
      payload: Object.freeze({ description: "Depends on" }),
      source: ids.domain as GraphRelation["source"],
      target: ids.service as GraphRelation["target"],
      type: "depends-on",
    });
    const diagnostics = Object.freeze([
      Object.freeze({ code: "first-model-failure", message: "first" }),
      Object.freeze({ code: "second-model-failure", message: "second" }),
    ]);
    const failed = () => Object.freeze({ diagnostics, ok: false as const });
    const check = (result: ReturnType<ApplicationSnapshotStateDecoder["decode"]>) => {
      expect(result.ok).toBeFalse();
      if (result.ok) return;
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("application-snapshot-decode-failed");
      expect(Object.isFrozen(result)).toBeTrue();
      expect(Object.isFrozen(result.diagnostics)).toBeTrue();
    };

    for (const operation of ["normalize", "patch", "parse", "relationships"] as const) {
      const modelCapability: StandardModelCapability = Object.freeze({
        ...model,
        [operation]: () => failed() as never,
      });
      const decoder = createApplicationSnapshotStateDecoder({
        bounds,
        graph,
        model: modelCapability,
      });
      if (operation === "normalize") {
        check(
          decoder.normalizeComponent(
            { id: ids.domain },
            { present: true, value: ids.domain },
          ) as never,
        );
      } else if (operation === "patch") {
        check(decoder.patchComponent(entity, { name: "Ignored" }, ids.domain) as never);
      } else if (operation === "parse") {
        check(
          decoder.canonicalizeEntity(entity, {
            id: entity.id,
            kind: STANDARD_COMPONENT_KIND,
          }) as never,
        );
        check(decoder.decode(state([entity])));
      } else {
        check(decoder.canonicalizeRelationships(Object.freeze([relation])) as never);
      }
    }
  });

  test("contains unexpected faults from a genuine decoder without leaking secrets", async () => {
    const fixture = new SnapshotFixture();
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const api = operations(fixture, undefined, {
      graph,
      snapshotStateDecoder: createApplicationSnapshotStateDecoder({
        bounds: applicationBounds,
        graph,
        isProxy: () => {
          throw new Error("/private/decoder-secret");
        },
        model,
      }),
    });

    const result = await api.listComponents({ limit: 2 });
    expect(result.ok ? "" : result.diagnostics[0]?.code).toBe("application-snapshot-decode-failed");
    expect(JSON.stringify(result)).not.toContain("/private/decoder-secret");
    expect(fixture.requested).toHaveLength(1);
  });

  test("snapshots every application option and bound before caller mutation", async () => {
    const fixture = new SnapshotFixture();
    const proxiedState = new Proxy(state([]), {});
    fixture.currentState = proxiedState;
    const bounds = { ...applicationBounds };
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    let originalExecutions = 0;
    const source = applicationOptions(fixture, undefined, {
      bounds,
      graph,
      snapshotStateDecoder: createApplicationSnapshotStateDecoder({
        bounds,
        graph,
        isProxy: (value) => value === proxiedState,
        model,
      }),
      transactionExecution: {
        execute: async () => {
          originalExecutions += 1;
          return Object.freeze({
            committed: false,
            diagnostics: Object.freeze([
              Object.freeze({ code: "original-execution", message: "Original execution" }),
            ]),
            phase: "prepare" as const,
            status: "provider-failure" as const,
          });
        },
      },
    });
    const api = createApplicationOperations(source);
    let forgedCalls = 0;
    const forged = () => {
      forgedCalls += 1;
      throw new Error("/private/forged-capability");
    };
    const mutable = source as Mutable<ApplicationOperationsOptions>;
    (bounds as Mutable<ApplicationOperationBounds>).maxComponents = 1;
    mutable.graph = {} as never;
    mutable.initialization = { initialize: forged } as never;
    mutable.maxSnapshotAttempts = 1;
    mutable.model = {} as never;
    mutable.queries = { exact: forged, page: forged, prepare: forged } as never;
    mutable.resourceMapper = { resourceForComponent: forged } as never;
    mutable.snapshotStateDecoder = { decode: forged } as never;
    mutable.transactionExecution = { execute: forged } as never;
    mutable.transactionProvider = { snapshot: forged } as never;

    expect(await api.initialize({})).toMatchObject({ ok: true });
    expect(await api.listComponents({ limit: 2 })).toMatchObject({
      diagnostics: [{ code: "invalid-standard-model-state" }],
      ok: false,
    });

    fixture.currentState = richState;
    fixture.sequence = [1, 2, 2, 2];
    const roots = await api.listRoots({ limit: 10 });
    expect(roots.ok && roots.value.items).toHaveLength(2);
    expect(fixture.requested.length).toBeGreaterThanOrEqual(5);

    const mutation = await api.updateComponent({
      expectedRevision: `revision:${ids.domain.slice(-32)}`,
      id: ids.domain,
      patch: { name: "Renamed" },
    });
    expect(mutation.status).toBe("provider-failure");
    expect(originalExecutions).toBe(1);
    expect(forgedCalls).toBe(0);
  });

  test("captures capability methods so later mutation cannot redirect invocation", async () => {
    const fixture = new SnapshotFixture();
    let initializeCalls = 0;
    let executionCalls = 0;
    let forgedCalls = 0;
    const initialization = {
      initialize: async () => {
        initializeCalls += 1;
        return { generation: generation(0), status: "initialized" as const };
      },
    };
    const resourceMapper = { resourceForComponent: (id: string) => success(resource(id)) };
    const transactionExecution = {
      execute: async () => {
        executionCalls += 1;
        return {
          committed: false as const,
          diagnostics: [{ code: "captured-execution", message: "Captured execution" }],
          phase: "prepare" as const,
          status: "provider-failure" as const,
        };
      },
    };
    const source = applicationOptions(fixture, undefined, {
      initialization,
      resourceMapper,
      transactionExecution,
    });
    const api = createApplicationOperations(source);
    const forged = () => {
      forgedCalls += 1;
      throw new Error("/private/redirected-capability");
    };
    initialization.initialize = forged as never;
    resourceMapper.resourceForComponent = forged as never;
    transactionExecution.execute = forged as never;
    fixture.snapshot = forged as never;
    for (const method of ["exact", "page", "prepare"] as const) {
      Object.defineProperty(source.queries, method, { configurable: true, value: forged });
    }

    expect(await api.initialize({})).toMatchObject({ ok: true });
    expect(await api.listRoots({ limit: 2 })).toMatchObject({ ok: true });
    const mutation = await api.updateComponent({
      expectedRevision: `revision:${ids.domain.slice(-32)}`,
      id: ids.domain,
      patch: { name: "Renamed" },
    });
    expect(mutation.status).toBe("provider-failure");
    expect(initializeCalls).toBe(1);
    expect(executionCalls).toBe(1);
    expect(forgedCalls).toBe(0);
  });

  test("contains hostile diagnostics from an identity-matched decoder model", async () => {
    const secret = "/private/details-secret";

    async function readWith(
      diagnostics: readonly unknown[],
      proxies: ReadonlySet<unknown> = new Set(),
    ) {
      const fixture = new SnapshotFixture();
      fixture.currentState = state([
        component({ id: ids.domain, name: "Commerce", type: "domain" }),
      ]);
      const graph = new GraphKernel({
        idSource: {
          nextEntityId: () => ids.domain,
          nextRelationId: () => relationIds.first,
        },
        maxPageSize: 100,
      });
      const hostileModel: StandardModelCapability = Object.freeze({
        ...model,
        parse: () => ({ diagnostics, ok: false }) as never,
      });
      return operations(fixture, undefined, {
        graph,
        model: hostileModel,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph,
          isProxy: (value) => proxies.has(value),
          model: hostileModel,
        }),
      }).listComponents({ limit: 2 });
    }

    const proxyDetails = new Proxy({ maximum: 1, secret }, {});
    const proxiedDetailsResult = await readWith(
      [{ code: "hostile-model", details: proxyDetails, message: secret }],
      new Set([proxyDetails]),
    );
    expect(proxiedDetailsResult.ok ? "" : proxiedDetailsResult.diagnostics[0]?.code).toBe(
      "application-snapshot-decode-failed",
    );

    let detailGetterCalls = 0;
    const accessorDetails = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorDetails, "maximum", {
      enumerable: true,
      get: () => {
        detailGetterCalls += 1;
        throw new Error(secret);
      },
    });
    const accessorResult = await readWith([
      { code: "hostile-model", details: accessorDetails, message: secret },
    ]);
    expect(accessorResult.ok ? "" : accessorResult.diagnostics[0]?.code).toBe(
      "application-snapshot-decode-failed",
    );
    expect(detailGetterCalls).toBe(0);

    const proxiedArray = new Proxy([{ code: "hostile-model", message: secret }], {});
    const proxiedArrayResult = await readWith(proxiedArray, new Set([proxiedArray]));
    expect(proxiedArrayResult.ok ? "" : proxiedArrayResult.diagnostics[0]?.code).toBe(
      "application-snapshot-decode-failed",
    );

    let entryGetterCalls = 0;
    const accessorEntry = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessorEntry, {
      code: {
        enumerable: true,
        get: () => {
          entryGetterCalls += 1;
          throw new Error(secret);
        },
      },
      message: { enumerable: true, value: secret },
    });
    const accessorEntryResult = await readWith([accessorEntry]);
    expect(accessorEntryResult.ok ? "" : accessorEntryResult.diagnostics[0]?.code).toBe(
      "application-snapshot-decode-failed",
    );
    expect(entryGetterCalls).toBe(0);

    const mutableDetails: { componentId: string; maximum: number; secret: string } = {
      componentId: ids.domain,
      maximum: 2,
      secret,
    };
    const mutableEntry = {
      code: "mutable-model-failure",
      details: mutableDetails,
      message: secret,
    };
    const mutableDiagnostics = [mutableEntry];
    const copiedResult = await readWith(mutableDiagnostics);
    mutableDetails.componentId = ids.service;
    mutableDetails.maximum = 999;
    mutableEntry.code = secret;
    mutableDiagnostics.splice(0);

    expect(copiedResult).toMatchObject({
      diagnostics: [
        {
          code: "mutable-model-failure",
          details: { componentId: ids.domain, maximum: 2 },
        },
      ],
      ok: false,
    });
    expect(Object.isFrozen(copiedResult)).toBeTrue();
    expect(!copiedResult.ok && Object.isFrozen(copiedResult.diagnostics)).toBeTrue();
    expect(!copiedResult.ok && Object.isFrozen(copiedResult.diagnostics[0]?.details)).toBeTrue();

    for (const result of [
      proxiedDetailsResult,
      accessorResult,
      proxiedArrayResult,
      accessorEntryResult,
      copiedResult,
    ]) {
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  test("rejects hostile component success values from an identity-matched model", async () => {
    const secret = "/private/success-secret";
    const base = {
      extensions: {},
      id: ids.domain,
      kind: STANDARD_COMPONENT_KIND,
      name: "Commerce",
      type: "domain",
    };

    async function readWith(value: unknown, proxies: ReadonlySet<unknown> = new Set()) {
      const fixture = new SnapshotFixture();
      fixture.currentState = state([component({ id: ids.domain, type: "domain" })]);
      const graph = new GraphKernel({
        idSource: {
          nextEntityId: () => ids.domain,
          nextRelationId: () => relationIds.first,
        },
        maxPageSize: 100,
      });
      const hostileModel: StandardModelCapability = Object.freeze({
        ...model,
        parse: () => success(value as never),
      });
      return operations(fixture, undefined, {
        graph,
        model: hostileModel,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph,
          isProxy: (candidate) => proxies.has(candidate),
          model: hostileModel,
        }),
      }).listComponents({ limit: 2 });
    }

    let getterCalls = 0;
    const accessor = { ...base } as Record<string, unknown>;
    Object.defineProperty(accessor, "name", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        throw new Error(secret);
      },
    });
    const { extensions: _extensions, ...missingExtensions } = base;
    const symbolComponent = { ...base } as Record<PropertyKey, unknown>;
    symbolComponent[Symbol("secret")] = secret;
    const proxyComponent = new Proxy({ ...base }, {});
    const proxyItem = new Proxy({ extensions: {}, id: "input" }, {});
    const proxyExtensions = new Proxy({ "example.dev/value": true }, {});
    const nestedProxy = new Proxy({ secret }, {});
    const cases = [
      { name: "proxy component", proxies: new Set([proxyComponent]), value: proxyComponent },
      { name: "accessor component", value: accessor },
      { name: "wrong identity", value: { ...base, id: ids.service } },
      { name: "missing required field", value: missingExtensions },
      { name: "extra field", value: { ...base, extra: secret } },
      { name: "wrong kind", value: { ...base, kind: "service" } },
      { name: "wrong field type", value: { ...base, name: 1 } },
      { name: "symbol field", value: symbolComponent },
      {
        name: "proxy item",
        proxies: new Set([proxyItem]),
        value: { ...base, inputs: [proxyItem] },
      },
      {
        name: "proxy extensions",
        proxies: new Set([proxyExtensions]),
        value: { ...base, extensions: proxyExtensions },
      },
      {
        name: "nested proxy extension",
        proxies: new Set([nestedProxy]),
        value: { ...base, extensions: { "example.dev/value": { nested: nestedProxy } } },
      },
    ];
    for (const entry of cases) {
      const result = await readWith(entry.value, entry.proxies);
      expect(result.ok ? "" : result.diagnostics[0]?.code, entry.name).toBe(
        "application-snapshot-decode-failed",
      );
      expect(JSON.stringify(result), entry.name).not.toContain(secret);
    }
    expect(getterCalls).toBe(0);

    const rejectingSuccess = Promise.reject(new Error(secret));
    const promiseResult = await readWith(rejectingSuccess);
    await Promise.resolve();
    expect(promiseResult.ok ? "" : promiseResult.diagnostics[0]?.code).toBe(
      "application-snapshot-decode-failed",
    );
    expect(JSON.stringify(promiseResult)).not.toContain(secret);
  });

  test("contains native Promise outputs without consulting hostile species or accessors", async () => {
    const marker = "HOSTILE_UNHANDLED";
    const secret = "/private/success-secret";
    const unhandled: unknown[] = [];
    let getterCalls = 0;
    let speciesGetterCalls = 0;
    let constructorPromise: Promise<never> | undefined;
    let constructorDescriptor: PropertyDescriptor | undefined;
    let writableConstructorPromise: Promise<never> | undefined;
    let writableConstructorDescriptor: PropertyDescriptor | undefined;
    const fixedConstructorPromises: {
      readonly descriptor: PropertyDescriptor;
      readonly promise: Promise<never>;
    }[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };

    function ownThenPromise(): Promise<never> {
      const promise = Promise.reject(new Error(`${marker}:${secret}`));
      Object.defineProperty(promise, "then", {
        configurable: true,
        get: () => {
          getterCalls += 1;
          throw new Error(`${marker}:own-then:${secret}`);
        },
      });
      return promise;
    }

    class HostilePromise<T> extends Promise<T> {
      static override get [Symbol.species](): PromiseConstructor {
        speciesGetterCalls += 1;
        throw new Error(`${marker}:species:${secret}`);
      }
    }
    Object.defineProperty(HostilePromise.prototype, "then", {
      configurable: true,
      get: () => {
        getterCalls += 1;
        throw new Error(`${marker}:inherited-then:${secret}`);
      },
    });
    function hostilePromise(): HostilePromise<never> {
      const promise = new HostilePromise<never>((_resolve, reject) => {
        reject(new Error(`${marker}:${secret}`));
      });
      Object.defineProperty(promise, "then", {
        configurable: true,
        get: () => {
          getterCalls += 1;
          throw new Error(`${marker}:own-subclass-then:${secret}`);
        },
      });
      return promise;
    }

    function constructorAccessorPromise(): HostilePromise<never> {
      const promise = hostilePromise();
      Object.defineProperty(promise, "constructor", {
        configurable: true,
        enumerable: true,
        get: () => {
          getterCalls += 1;
          throw new Error(`${marker}:constructor:${secret}`);
        },
      });
      constructorPromise = promise;
      constructorDescriptor = Object.getOwnPropertyDescriptor(promise, "constructor");
      return promise;
    }

    function writableConstructorDataPromise(): HostilePromise<never> {
      const promise = hostilePromise();
      Object.defineProperty(promise, "constructor", {
        configurable: false,
        enumerable: true,
        value: HostilePromise,
        writable: true,
      });
      writableConstructorPromise = promise;
      writableConstructorDescriptor = Object.getOwnPropertyDescriptor(promise, "constructor");
      return promise;
    }

    function unshadowableConstructorPromise(): HostilePromise<never> {
      const promise = new HostilePromise<never>(() => undefined);
      Object.defineProperty(promise, "constructor", {
        configurable: false,
        get: () => {
          getterCalls += 1;
          throw new Error(`${marker}:unshadowable-constructor:${secret}`);
        },
      });
      return promise;
    }

    function fixedIntrinsicConstructorPromise(): HostilePromise<never> {
      const promise = hostilePromise();
      Object.defineProperty(promise, "constructor", {
        configurable: false,
        enumerable: false,
        value: Promise,
        writable: false,
      });
      fixedConstructorPromises.push({
        descriptor: Object.getOwnPropertyDescriptor(promise, "constructor")!,
        promise,
      });
      return promise;
    }

    async function readWith(modelOverride: Partial<StandardModelCapability>) {
      const fixture = new SnapshotFixture();
      fixture.currentState = state([component({ id: ids.domain, type: "domain" })]);
      const graph = new GraphKernel({
        idSource: {
          nextEntityId: () => ids.domain,
          nextRelationId: () => relationIds.first,
        },
        maxPageSize: 100,
      });
      const hostileModel: StandardModelCapability = Object.freeze({
        ...model,
        ...modelOverride,
      });
      return operations(fixture, undefined, {
        graph,
        model: hostileModel,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph,
          model: hostileModel,
        }),
      }).listComponents({ limit: 2 });
    }

    process.on("unhandledRejection", onUnhandled);
    try {
      const parseResult = await readWith({ parse: () => hostilePromise() as never });
      const successValue = await readWith({
        parse: () => success(constructorAccessorPromise() as never),
      });
      const relationshipResult = await readWith({
        relationships: () => ownThenPromise() as never,
      });
      const intrinsicResult = await readWith({
        parse: () => Promise.reject(new Error(`${marker}:intrinsic:${secret}`)) as never,
      });
      const writableConstructorResult = await readWith({
        parse: () => writableConstructorDataPromise() as never,
      });
      const unshadowableConstructorResult = await readWith({
        parse: () => unshadowableConstructorPromise() as never,
      });
      const fixedConstructorParseResult = await readWith({
        parse: () => fixedIntrinsicConstructorPromise() as never,
      });
      const fixedConstructorSuccessResult = await readWith({
        parse: () => success(fixedIntrinsicConstructorPromise() as never),
      });
      const promiseShapedPrototype = Object.create(null) as Record<string, unknown>;
      Object.defineProperty(promiseShapedPrototype, "then", {
        get: () => {
          getterCalls += 1;
          throw new Error(`${marker}:shaped-then:${secret}`);
        },
      });
      const promiseShaped = Object.create(promiseShapedPrototype);
      const shapedResult = await readWith({ parse: () => promiseShaped as never });

      for (const result of [
        parseResult,
        successValue,
        relationshipResult,
        intrinsicResult,
        writableConstructorResult,
        unshadowableConstructorResult,
        fixedConstructorParseResult,
        fixedConstructorSuccessResult,
        shapedResult,
      ]) {
        expect(result.ok ? "" : result.diagnostics[0]?.code).toBe(
          "application-snapshot-decode-failed",
        );
        expect(Object.isFrozen(result)).toBeTrue();
        expect(JSON.stringify(result)).not.toContain(marker);
        expect(JSON.stringify(result)).not.toContain(secret);
      }
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(Object.getOwnPropertyDescriptor(constructorPromise!, "constructor")).toEqual(
        constructorDescriptor,
      );
      expect(Object.getOwnPropertyDescriptor(writableConstructorPromise!, "constructor")).toEqual(
        writableConstructorDescriptor,
      );
      for (const entry of fixedConstructorPromises) {
        expect(Object.getOwnPropertyDescriptor(entry.promise, "constructor")).toEqual(
          entry.descriptor,
        );
      }
      expect(getterCalls).toBe(0);
      expect(speciesGetterCalls).toBe(0);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("copies mutable component success values without retaining model aliases", async () => {
    const nested = { enabled: true };
    const itemExtensions = { "example.dev/item": nested };
    const item = { extensions: itemExtensions, id: "orders", name: "Orders" };
    const extensions = { "example.dev/component": { tier: 1 } };
    const modelValue = {
      extensions,
      id: ids.domain,
      inputs: [item],
      kind: STANDARD_COMPONENT_KIND,
      name: "Commerce",
      type: "domain",
    };
    const fixture = new SnapshotFixture();
    fixture.currentState = state([
      component({
        "example.dev/component": { tier: 1 },
        id: ids.domain,
        inputs: [
          {
            "example.dev/item": { enabled: true },
            id: "orders",
            name: "Orders",
          },
        ],
        name: "Commerce",
        type: "domain",
      }),
    ]);
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const mutableModel: StandardModelCapability = Object.freeze({
      ...model,
      parse: () => success(modelValue as never),
    });
    const result = await operations(fixture, undefined, {
      graph,
      model: mutableModel,
      snapshotStateDecoder: createApplicationSnapshotStateDecoder({
        bounds: applicationBounds,
        graph,
        model: mutableModel,
      }),
    }).listComponents({ limit: 2 });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    const copied = result.value.items[0]!.component;

    modelValue.name = "Changed";
    item.name = "Changed";
    nested.enabled = false;
    (extensions["example.dev/component"] as { tier: number }).tier = 9;
    modelValue.inputs.splice(0);

    expect(copied).toMatchObject({
      extensions: { "example.dev/component": { tier: 1 } },
      inputs: [
        {
          extensions: { "example.dev/item": { enabled: true } },
          id: "orders",
          name: "Orders",
        },
      ],
      name: "Commerce",
    });
    expect(Object.isFrozen(copied)).toBeTrue();
    expect(Object.isFrozen(copied.inputs)).toBeTrue();
    expect(Object.isFrozen(copied.inputs?.[0])).toBeTrue();
    expect(Object.isFrozen(copied.inputs?.[0]?.extensions["example.dev/item"])).toBeTrue();
  });

  test("binds every component view field exactly to its graph payload", async () => {
    for (const field of [
      "name",
      "type",
      "parent",
      "intent",
      "inputs",
      "outputs",
      "actions",
      "lifecycle",
      "desired",
      "extensions",
    ] as const) {
      const fixture = new SnapshotFixture();
      const graph = new GraphKernel({
        idSource: {
          nextEntityId: () => ids.domain,
          nextRelationId: () => relationIds.first,
        },
        maxPageSize: 100,
      });
      const hostileModel: StandardModelCapability = Object.freeze({
        ...model,
        parse: (entity: GraphEntity) => {
          const parsed = model.parse(entity);
          if (!parsed.ok || entity.id !== ids.service) return parsed;
          const changed = { ...parsed.value } as Record<string, unknown>;
          if (field === "name") changed.name = "Changed";
          else if (field === "type") changed.type = "module";
          else if (field === "parent") changed.parent = ids.secondRoot;
          else if (field === "intent") changed.intent = "Changed intent";
          else if (field === "inputs" || field === "outputs" || field === "actions") {
            changed[field] = [];
          } else if (field === "lifecycle") changed.lifecycle = "retired";
          else if (field === "desired") delete changed.desired;
          else changed.extensions = { "example.dev/owner": "changed" };
          return success(changed as never);
        },
      });
      const result = await operations(fixture, undefined, {
        graph,
        model: hostileModel,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph,
          model: hostileModel,
        }),
      }).listComponents({ limit: 2 });
      expect(result.ok ? "" : result.diagnostics[0]?.code, field).toBe(
        "application-snapshot-decode-failed",
      );
    }
  });

  test("rejects hostile relationship success values and copies valid mutable ones", async () => {
    const secret = "/private/success-secret";
    const base = {
      extensions: {},
      id: relationIds.first,
      source: ids.service,
      target: ids.target,
      type: "depends-on",
    };

    async function readWith(
      value: unknown,
      proxies: ReadonlySet<unknown> = new Set(),
      payload: GraphData = {},
    ) {
      const fixture = new SnapshotFixture();
      fixture.currentState = state(
        [
          component({ id: ids.service, type: "service" }),
          component({ id: ids.target, type: "service" }),
        ],
        [
          {
            id: relationIds.first,
            payload,
            source: ids.service,
            target: ids.target,
            type: "depends-on",
          },
        ],
      );
      const graph = new GraphKernel({
        idSource: {
          nextEntityId: () => ids.domain,
          nextRelationId: () => relationIds.first,
        },
        maxPageSize: 100,
      });
      const hostileModel: StandardModelCapability = Object.freeze({
        ...model,
        relationships: () => success(value as never),
      });
      return operations(fixture, undefined, {
        graph,
        model: hostileModel,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph,
          isProxy: (candidate) => proxies.has(candidate),
          model: hostileModel,
        }),
      }).getComponent({ id: ids.service, relationships: { limit: 2 } });
    }

    const proxyRelationship = new Proxy({ ...base }, {});
    const proxyArray = new Proxy([{ ...base }], {});
    const nestedProxy = new Proxy({ secret }, {});
    const { extensions: _extensions, ...missingExtensions } = base;
    const cases = [
      {
        name: "proxy relationship",
        proxies: new Set([proxyRelationship]),
        value: [proxyRelationship],
      },
      { name: "proxy array", proxies: new Set([proxyArray]), value: proxyArray },
      { name: "missing field", value: [missingExtensions] },
      { name: "extra field", value: [{ ...base, extra: secret }] },
      { name: "wrong id", value: [{ ...base, id: relationIds.second }] },
      { name: "wrong type", value: [{ ...base, type: "coordinates-with" }] },
      { name: "wrong source", value: [{ ...base, source: ids.target }] },
      { name: "wrong target", value: [{ ...base, target: ids.service }] },
      { name: "malformed type", value: [{ ...base, type: "Depends_On" }] },
      {
        name: "nested proxy extension",
        proxies: new Set([nestedProxy]),
        value: [{ ...base, extensions: { "example.dev/value": nestedProxy } }],
      },
    ];
    for (const entry of cases) {
      const result = await readWith(entry.value, entry.proxies);
      expect(result.ok ? "" : result.diagnostics[0]?.code, entry.name).toBe(
        "application-snapshot-decode-failed",
      );
      expect(JSON.stringify(result), entry.name).not.toContain(secret);
    }

    const relationshipExtensions = { "example.dev/value": { weight: 1 } };
    const mutable = [{ ...base, description: "Authenticates", extensions: relationshipExtensions }];
    const copiedResult = await readWith(mutable, new Set(), {
      "example.dev/value": { weight: 1 },
      description: "Authenticates",
    });
    expect(copiedResult.ok).toBeTrue();
    if (!copiedResult.ok) return;
    mutable[0]!.description = "Changed";
    (relationshipExtensions["example.dev/value"] as { weight: number }).weight = 9;
    mutable.splice(0);
    const copied = copiedResult.value.relationships.items[0]!.relationship;
    expect(copied).toMatchObject({
      description: "Authenticates",
      extensions: { "example.dev/value": { weight: 1 } },
    });
    expect(Object.isFrozen(copied)).toBeTrue();
    expect(Object.isFrozen(copied.extensions)).toBeTrue();
    expect(Object.isFrozen(copied.extensions["example.dev/value"])).toBeTrue();
  });

  test("binds relationship description and extensions exactly to graph payload", async () => {
    for (const change of [
      "description-changed",
      "description-added",
      "description-removed",
      "extension-changed",
      "extension-added",
      "extension-removed",
    ] as const) {
      const fixture = new SnapshotFixture();
      const graph = new GraphKernel({
        idSource: {
          nextEntityId: () => ids.domain,
          nextRelationId: () => relationIds.first,
        },
        maxPageSize: 100,
      });
      const hostileModel: StandardModelCapability = Object.freeze({
        ...model,
        relationships: (relations: readonly GraphRelation[]) => {
          const viewed = model.relationships(relations);
          if (!viewed.ok) return viewed;
          const changed = viewed.value.map((relationship) => ({ ...relationship }));
          const first = changed[0]!;
          const second = changed[1]!;
          if (change === "description-changed") first.description = "Changed";
          else if (change === "description-added") second.description = "Added";
          else if (change === "description-removed") delete first.description;
          else if (change === "extension-changed") {
            second.extensions = { "example.dev/strength": "optional" };
          } else if (change === "extension-added") {
            first.extensions = { "example.dev/new": true };
          } else second.extensions = {};
          return success(changed as never);
        },
      });
      const result = await operations(fixture, undefined, {
        graph,
        model: hostileModel,
        snapshotStateDecoder: createApplicationSnapshotStateDecoder({
          bounds: applicationBounds,
          graph,
          model: hostileModel,
        }),
      }).getComponent({ id: ids.service, relationships: { limit: 2 } });
      expect(result.ok ? "" : result.diagnostics[0]?.code, change).toBe(
        "application-snapshot-decode-failed",
      );
    }
  });

  test("bounds embedded items per component and structural model success values globally", async () => {
    const fixture = new SnapshotFixture();
    fixture.currentState = state([
      component({ id: ids.domain, inputs: [{ id: "item" }] }),
      component({ id: ids.service, inputs: [{ id: "item" }] }),
    ]);
    const graph = new GraphKernel({
      idSource: {
        nextEntityId: () => ids.domain,
        nextRelationId: () => relationIds.first,
      },
      maxPageSize: 100,
    });
    const itemBounds = Object.freeze({ ...applicationBounds, maxEmbeddedItems: 1 });
    const itemModel: StandardModelCapability = Object.freeze({
      ...model,
      parse: (entity: GraphEntity) =>
        success({
          extensions: {},
          id: entity.id,
          inputs: [{ extensions: {}, id: "item" }],
          kind: STANDARD_COMPONENT_KIND,
        } as never),
    });
    const itemResult = await operations(fixture, undefined, {
      bounds: itemBounds,
      graph,
      model: itemModel,
      snapshotStateDecoder: createApplicationSnapshotStateDecoder({
        bounds: itemBounds,
        graph,
        model: itemModel,
      }),
    }).listComponents({ limit: 2 });
    expect(itemResult.ok).toBeTrue();
    if (!itemResult.ok) return;
    expect(itemResult.value.items).toHaveLength(2);
    expect(
      itemResult.value.items.map(({ component: value }) => value.inputs?.map((item) => item.id)),
    ).toEqual([["item"], ["item"]]);

    const overflowFixture = new SnapshotFixture();
    overflowFixture.currentState = state([component({ id: ids.domain, type: "domain" })]);
    const overflowBounds = Object.freeze({ ...applicationBounds, maxEmbeddedItems: 2 });
    const overflowModel: StandardModelCapability = Object.freeze({
      ...model,
      parse: (entity: GraphEntity) =>
        success({
          actions: [{ extensions: {}, id: "action" }],
          extensions: {},
          id: entity.id,
          inputs: [{ extensions: {}, id: "input" }],
          kind: STANDARD_COMPONENT_KIND,
          outputs: [{ extensions: {}, id: "output" }],
        } as never),
    });
    const overflowResult = await operations(overflowFixture, undefined, {
      bounds: overflowBounds,
      graph,
      model: overflowModel,
      snapshotStateDecoder: createApplicationSnapshotStateDecoder({
        bounds: overflowBounds,
        graph,
        model: overflowModel,
      }),
    }).listComponents({ limit: 1 });
    expect(overflowResult.ok ? "" : overflowResult.diagnostics[0]?.code).toBe(
      "application-bound-exceeded",
    );

    const structuralFixture = new SnapshotFixture();
    structuralFixture.currentState = state([component({ id: ids.domain })]);
    const structuralBounds = Object.freeze({
      ...applicationBounds,
      maxSnapshotStateValues: 30,
    });
    const structuralModel: StandardModelCapability = Object.freeze({
      ...model,
      parse: (entity: GraphEntity) =>
        success({
          extensions: { "example.dev/large": new Array(50).fill(true) },
          id: entity.id,
          kind: STANDARD_COMPONENT_KIND,
        } as never),
    });
    const structuralResult = await operations(structuralFixture, undefined, {
      bounds: structuralBounds,
      graph,
      model: structuralModel,
      snapshotStateDecoder: createApplicationSnapshotStateDecoder({
        bounds: structuralBounds,
        graph,
        model: structuralModel,
      }),
    }).listComponents({ limit: 2 });
    expect(structuralResult.ok ? "" : structuralResult.diagnostics[0]?.code).toBe(
      "application-snapshot-decode-failed",
    );
  });

  test("accepts an uninitialized empty state as an empty bounded graph", async () => {
    const fixture = new SnapshotFixture();
    fixture.currentState = state([]);
    const page = await operations(fixture).listComponents({ limit: 5 });
    expect(page.ok && page.value.items).toEqual([]);
    expect(page.ok && Number(page.value.generation)).toBe(1);
  });

  test("contains mapper failure secrets for exact, page, and mutation operations", async () => {
    const secret = "/private/workspace/groma/intent/secret.md";
    const api = operations(new SnapshotFixture(), undefined, {
      resourceMapper: {
        resourceForComponent: () =>
          failure({
            code: "mapper-secret",
            details: { locator: secret },
            message: `Cannot map ${secret}`,
          }),
      },
    });
    const exact = await api.getComponent({ id: ids.domain, relationships: { limit: 1 } });
    const page = await api.listComponents({ limit: 1 });
    const mutation = await api.createComponent({
      component: { id: "ent_00000000000000000000000000000009" },
    });
    for (const outcome of [exact, page, mutation]) {
      expect(JSON.stringify(outcome)).not.toContain(secret);
      expect(JSON.stringify(outcome)).not.toContain("mapper-secret");
      const diagnostics = "diagnostics" in outcome ? outcome.diagnostics : [];
      expect(diagnostics[0]?.code).toBe("component-resource-unavailable");
      expect(diagnostics[0]?.details).toHaveProperty("componentId");
    }
  });

  test("contains recognized snapshot, query, and mapper proxies before their traps", async () => {
    for (const location of [
      "snapshot-outer",
      "snapshot-revisions",
      "snapshot-state",
      "query-prepare",
      "query-page",
      "query-exact",
      "mapper",
    ] as const) {
      const proxies = new Set<unknown>();
      const traps = { count: 0 };
      const fixture = new SnapshotFixture();
      const overrides: Mutable<Partial<ApplicationOperationsOptions>> = {};
      if (location.startsWith("snapshot-")) {
        const revisions =
          location === "snapshot-revisions"
            ? recognizedProxy([], proxies, traps)
            : Object.freeze([]);
        const snapshotState =
          location === "snapshot-state" ? recognizedProxy(state([]), proxies, traps) : state([]);
        const snapshotValue = {
          generation: generation(1),
          revisions,
          state: snapshotState,
        };
        overrides.transactionProvider = {
          snapshot: () =>
            (location === "snapshot-outer"
              ? recognizedProxy(snapshotValue, proxies, traps)
              : snapshotValue) as never,
        };
      } else if (location.startsWith("query-")) {
        const safeQueries = new BoundedQueryContracts({
          maxAnchorCharacters: 256,
          maxCursorCharacters: 2_048,
          maxPageSize: 10,
          maxQueryContextCharacters: 512,
        });
        const method = location.slice("query-".length) as "exact" | "page" | "prepare";
        const intrinsic = BoundedQueryContracts.prototype[method];
        Object.defineProperty(safeQueries, method, {
          configurable: true,
          value: (...args: unknown[]) =>
            recognizedProxy(
              Reflect.apply(intrinsic as never, safeQueries, args) as object,
              proxies,
              traps,
            ),
        });
        overrides.queries = safeQueries;
      } else {
        overrides.resourceMapper = {
          resourceForComponent: () =>
            recognizedProxy(success(resource(ids.domain)), proxies, traps) as never,
        };
      }
      const api = proxyAwareOperations(fixture, proxies, overrides);
      const result =
        location === "query-exact" || location === "mapper"
          ? await api.getComponent({ id: ids.domain, relationships: { limit: 1 } })
          : await api.listComponents({ limit: 1 });
      expect(result.ok, location).toBeFalse();
      expect(Object.isFrozen(result), location).toBeTrue();
      expect(JSON.stringify(result), location).not.toContain("recognized-proxy-trap");
      expect(traps.count, location).toBe(0);
    }
  });

  test("query wrappers never reject or leak on throwing, Promise, or unrecognized proxy outputs", async () => {
    const secret = "/private/query-capability-secret";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const behavior of ["throw", "promise", "proxy"] as const) {
        const queries = new BoundedQueryContracts({
          maxAnchorCharacters: 256,
          maxCursorCharacters: 2_048,
          maxPageSize: 10,
          maxQueryContextCharacters: 512,
        });
        Object.defineProperty(queries, "prepare", {
          configurable: true,
          value: () => {
            if (behavior === "throw") throw new Error(secret);
            if (behavior === "promise") return Promise.reject(new Error(secret));
            return new Proxy(
              {},
              {
                ownKeys: () => {
                  throw new Error(secret);
                },
              },
            );
          },
        });
        const result = await operations(new SnapshotFixture(), undefined, {
          queries,
        }).listComponents({ limit: 1 });
        expect(result.ok, behavior).toBeFalse();
        expect(result.ok ? "" : result.diagnostics[0]?.code, behavior).toBe(
          "query-capability-failed",
        );
        expect(Object.isFrozen(result), behavior).toBeTrue();
        expect(JSON.stringify(result), behavior).not.toContain(secret);
      }
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

function committedRevision(outcome: ApplicationMutationOutcome<unknown>): string {
  if (outcome.status !== "committed" || outcome.revisions[0]?.revision === null) {
    throw new Error(`expected committed mutation, received ${outcome.status}`);
  }
  return outcome.revisions[0]!.revision;
}

describe("application component mutations", () => {
  test("mints against canonical state and retries an existing identity before commit", async () => {
    const provider = new MutationProvider();
    const existing = "ent_0000000000000000000000000000000a";
    const fresh = "ent_0000000000000000000000000000000b";
    provider.currentState = state([component({ id: existing, type: "service" })]);
    provider.revisions.set(resource(existing), "existing-revision");
    let calls = 0;
    const fixture = mutationOperations(provider, undefined, {
      nextEntityId: () => {
        calls += 1;
        return calls === 1 ? existing : fresh;
      },
      nextRelationId: () => relationIds.first,
    });
    const created = await fixture.api.createComponent({ component: { type: "service" } });
    expect(created.status).toBe("committed");
    expect(created.status === "committed" && String(created.value.id)).toBe(fresh);
    expect(calls).toBe(2);

    const suppliedConflict = await fixture.api.createComponent({ component: { id: existing } });
    expect(suppliedConflict.status).toBe("conflict");
    expect(calls).toBe(2);
  });

  test("matches the reusable provider-neutral semantic workflow", async () => {
    const trace = await exerciseApplicationOperations(mutationOperations().api);
    expect(trace).toEqual(expectedApplicationOperationsTrace);
  });

  test("creates rich roots and nested components with supplied and minted stable identities", async () => {
    const fixture = mutationOperations();
    const root = await fixture.api.createComponent({
      component: {
        "example.dev/owner": "architecture",
        actions: [{ id: "review", description: "Review changes" }],
        desired: "active",
        id: ids.domain,
        inputs: [{ id: "plans", name: "Plans" }],
        intent: "Own commerce architecture.",
        lifecycle: "active",
        name: "Commerce",
        outputs: [{ id: "decisions", name: "Decisions" }],
        type: "domain",
      },
    });
    expect(root.status).toBe("committed");
    if (root.status !== "committed") return;
    expect(String(root.value.id)).toBe(ids.domain);
    expect(root.value.extensions).toEqual({ "example.dev/owner": "architecture" });
    expect(root.revisions).toEqual([
      { componentId: ids.domain, revision: committedRevision(root) },
    ]);

    const nested = await fixture.api.createComponent({
      component: { intent: "Process orders.", parent: ids.domain, type: "service" },
      relationships: [
        {
          "example.dev/criticality": "high",
          description: "Belongs to the domain",
          target: ids.domain,
          type: "depends-on",
        },
      ],
    });
    expect(nested.status).toBe("committed");
    if (nested.status !== "committed") return;
    expect(String(nested.value.id)).toBe("ent_00000000000000000000000000000032");
    expect(nested.affected.relationships).toHaveLength(1);
    expect(fixture.executions()).toBe(2);
    expect(fixture.provider.commits).toBe(2);
    expect(fixture.provider.prepares).toBe(2);

    const read = await fixture.api.getComponent({
      id: nested.value.id,
      relationships: { limit: 5 },
    });
    expect(read.ok && read.value.relationships.items[0]?.relationship.description).toBe(
      "Belongs to the domain",
    );
  });

  test("rejects stale revisions without executing and applies sparse fields, items, and extensions", async () => {
    const fixture = mutationOperations();
    const created = await fixture.api.createComponent({
      component: { id: ids.service, name: "Old", type: "service" },
    });
    const revision = committedRevision(created);
    const executions = fixture.executions();
    const stale = await fixture.api.updateComponent({
      expectedRevision: "stale-revision",
      id: ids.service,
      patch: { name: "Ignored" },
    });
    expect(stale.status).toBe("conflict");
    expect(fixture.executions()).toBe(executions);
    expect(fixture.provider.commits).toBe(1);

    const updated = await fixture.api.updateComponent({
      expectedRevision: revision,
      id: ids.service,
      patch: {
        "example.dev/tier": 1,
        actions: [{ id: "ship", name: "Ship" }],
        intent: "Updated intent.",
        name: null,
      },
    });
    expect(updated.status).toBe("committed");
    if (updated.status !== "committed") return;
    expect(updated.value.name).toBeUndefined();
    expect(updated.value.intent).toBe("Updated intent.");
    expect(updated.value.actions?.[0]?.id).toBe("ship");
    expect(updated.value.extensions).toEqual({ "example.dev/tier": 1 });
  });

  test("validates embedded items against the final sparse component", async () => {
    const fixture = mutationOperations(
      new MutationProvider(),
      undefined,
      undefined,
      Object.freeze({ ...applicationBounds, maxEmbeddedItems: 100 }),
    );
    const items = (prefix: string, length: number) =>
      Array.from({ length }, (_, index) => ({ id: `${prefix}-${String(index).padStart(3, "0")}` }));
    const createInputs = items("input", 60);
    const created = await fixture.api.createComponent({
      component: { id: ids.domain, inputs: createInputs },
    });
    expect(created.status).toBe("committed");
    if (created.status !== "committed") return;
    createInputs[0]!.id = "mutated";
    createInputs.splice(0);
    expect(created.value.inputs).toHaveLength(60);
    expect(created.value.inputs?.[0]?.id).toBe("input-000");
    expect(Object.isFrozen(created.value)).toBeTrue();
    expect(Object.isFrozen(created.value.inputs)).toBeTrue();
    expect(snapshotStateModule.isCanonicalApplicationSnapshotComponent(created.value)).toBeTrue();
    const executions = fixture.executions();
    const rejectedUpdate = await fixture.api.updateComponent({
      expectedRevision: committedRevision(created),
      id: ids.domain,
      patch: { outputs: items("rejected-output", 60) },
    });
    expect(rejectedUpdate.status).toBe("validation-rejected");
    expect(
      rejectedUpdate.status === "validation-rejected" && rejectedUpdate.diagnostics[0]?.code,
    ).toBe("application-bound-exceeded");
    expect(fixture.executions()).toBe(executions);
    expect(fixture.provider.generation).toBe(Number(created.generation));

    const unchanged = await fixture.api.getComponent({
      id: ids.domain,
      relationships: { limit: 1 },
    });
    expect(unchanged.ok).toBeTrue();
    if (!unchanged.ok) return;
    expect(unchanged.value.generation).toBe(created.generation);
    expect(unchanged.value.item.revision).toBe(committedRevision(created));
    expect(unchanged.value.item.component.inputs).toHaveLength(60);
    expect(unchanged.value.item.component.outputs).toBeUndefined();

    const acceptedOutputs = items("output", 40);
    const atLimit = await fixture.api.updateComponent({
      expectedRevision: unchanged.value.item.revision,
      id: ids.domain,
      patch: { outputs: acceptedOutputs },
    });
    expect(atLimit.status).toBe("committed");
    if (atLimit.status !== "committed") return;
    acceptedOutputs[0]!.id = "mutated";
    acceptedOutputs.splice(0);
    expect(atLimit.value.inputs).toHaveLength(60);
    expect(atLimit.value.outputs).toHaveLength(40);
    expect(atLimit.value.outputs?.[0]?.id).toBe("output-000");
    expect(Object.isFrozen(atLimit.value)).toBeTrue();
    expect(Object.isFrozen(atLimit.value.outputs)).toBeTrue();
    expect(snapshotStateModule.isCanonicalApplicationSnapshotComponent(atLimit.value)).toBeTrue();

    const replaced = await fixture.api.updateComponent({
      expectedRevision: committedRevision(atLimit),
      id: ids.domain,
      patch: { inputs: null, outputs: items("replacement-output", 100) },
    });
    expect(replaced.status).toBe("committed");
    if (replaced.status !== "committed") return;
    expect(replaced.value.inputs).toBeUndefined();
    expect(replaced.value.outputs).toHaveLength(100);
  });

  test("contains throwing and malformed Standard Model patch outputs", async () => {
    const secret = "/private/model-patch-secret";
    let getterCalls = 0;
    const cases: readonly StandardModelCapability[] = [
      Object.freeze({
        ...model,
        patch: () => {
          throw new Error(secret);
        },
      }),
      Object.freeze({
        ...model,
        patch: () => {
          const draft = Object.create(null) as Record<string, unknown>;
          Object.defineProperties(draft, {
            id: { enumerable: true, value: ids.domain },
            kind: { enumerable: true, value: STANDARD_COMPONENT_KIND },
            payload: {
              enumerable: true,
              get: () => {
                getterCalls += 1;
                throw new Error(secret);
              },
            },
          });
          return success(draft as never);
        },
      }),
      Object.freeze({
        ...model,
        patch: (entity: GraphEntity, patch: StandardComponentPatch) => {
          const result = model.patch(entity, patch);
          if (!result.ok) return result;
          const payload = { ...(result.value.payload as GraphDataRecord) };
          Object.defineProperty(payload, "name", {
            enumerable: true,
            get: () => {
              getterCalls += 1;
              throw new Error(secret);
            },
          });
          return success(Object.freeze({ ...result.value, payload }));
        },
      }),
      Object.freeze({
        ...model,
        patch: () => {
          const entry = Object.create(null) as Record<string, unknown>;
          Object.defineProperties(entry, {
            code: {
              enumerable: true,
              get: () => {
                getterCalls += 1;
                throw new Error(secret);
              },
            },
            message: { enumerable: true, value: secret },
          });
          return { diagnostics: [entry], ok: false } as never;
        },
      }),
    ];
    for (const modelCapability of cases) {
      const fixture = mutationOperations(
        new MutationProvider(),
        undefined,
        undefined,
        applicationBounds,
        modelCapability,
      );
      const created = await fixture.api.createComponent({ component: { id: ids.domain } });
      expect(created.status).toBe("committed");
      if (created.status !== "committed") continue;
      const executions = fixture.executions();
      const result = await fixture.api.updateComponent({
        expectedRevision: committedRevision(created),
        id: ids.domain,
        patch: { name: "Ignored" },
      });
      expect(result.status).toBe("validation-rejected");
      expect(["application-snapshot-decode-failed", "invalid-standard-model-value"]).toContain(
        result.status === "validation-rejected" ? (result.diagnostics[0]?.code ?? "") : "",
      );
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(fixture.executions()).toBe(executions);
    }
    expect(getterCalls).toBe(0);

    let proxyTraps = 0;
    const nestedProxy = new Proxy(
      { secret },
      {
        ownKeys: () => {
          proxyTraps += 1;
          throw new Error(secret);
        },
      },
    );
    const proxyModel: StandardModelCapability = Object.freeze({
      ...model,
      patch: (entity: GraphEntity, patch: StandardComponentPatch) => {
        const result = model.patch(entity, patch);
        if (!result.ok) return result;
        return success(
          Object.freeze({
            ...result.value,
            payload: Object.freeze({
              ...(result.value.payload as GraphDataRecord),
              "example.dev/proxy": nestedProxy,
            }),
          }),
        );
      },
    });
    const proxyFixture = mutationOperations(
      new MutationProvider(),
      undefined,
      undefined,
      applicationBounds,
      proxyModel,
      (value) => value === nestedProxy,
    );
    const proxyCreated = await proxyFixture.api.createComponent({
      component: { id: ids.domain },
    });
    expect(proxyCreated.status).toBe("committed");
    if (proxyCreated.status === "committed") {
      const executions = proxyFixture.executions();
      const result = await proxyFixture.api.updateComponent({
        expectedRevision: committedRevision(proxyCreated),
        id: ids.domain,
        patch: { name: "Ignored" },
      });
      expect(result.status).toBe("validation-rejected");
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(proxyFixture.executions()).toBe(executions);
    }
    expect(proxyTraps).toBe(0);
  });

  test("contains hostile Standard Model parse outputs for create and update", async () => {
    const secret = "/private/model-parse-secret";
    let getterCalls = 0;
    const hostileParse = (
      entity: GraphEntity,
      mode: "accessor" | "identity" | "malformed" | "throw",
    ) => {
      if (mode === "throw") throw new Error(secret);
      if (mode === "malformed") return { ok: true } as never;
      const parsed = model.parse(entity);
      if (!parsed.ok) return parsed;
      if (mode === "identity") return success({ ...parsed.value, id: ids.service } as never);
      const value = { ...parsed.value } as Record<string, unknown>;
      Object.defineProperty(value, "name", {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          throw new Error(secret);
        },
      });
      return success(value as never);
    };

    for (const mode of ["accessor", "identity", "malformed", "throw"] as const) {
      let enabled = false;
      const modelCapability: StandardModelCapability = Object.freeze({
        ...model,
        parse: (entity: GraphEntity) =>
          enabled &&
          typeof entity.payload === "object" &&
          entity.payload !== null &&
          !Array.isArray(entity.payload) &&
          (entity.payload as GraphDataRecord).name === "Ignored"
            ? hostileParse(entity, mode)
            : model.parse(entity),
      });
      const fixture = mutationOperations(
        new MutationProvider(),
        undefined,
        undefined,
        applicationBounds,
        modelCapability,
      );
      const created = await fixture.api.createComponent({ component: { id: ids.domain } });
      expect(created.status, `update setup ${mode}`).toBe("committed");
      if (created.status !== "committed") continue;
      enabled = true;
      const executions = fixture.executions();
      const result = await fixture.api.updateComponent({
        expectedRevision: committedRevision(created),
        id: ids.domain,
        patch: { name: "Ignored" },
      });
      expect(result.status, `update ${mode}`).toBe("validation-rejected");
      expect(JSON.stringify(result), `update ${mode}`).not.toContain(secret);
      expect(fixture.executions(), `update ${mode}`).toBe(executions);
    }

    for (const mode of ["accessor", "identity", "malformed", "throw"] as const) {
      const modelCapability: StandardModelCapability = Object.freeze({
        ...model,
        parse: (entity: GraphEntity) => hostileParse(entity, mode),
      });
      const fixture = mutationOperations(
        new MutationProvider(),
        undefined,
        undefined,
        applicationBounds,
        modelCapability,
      );
      const result = await fixture.api.createComponent({ component: { id: ids.domain } });
      expect(result.status, `create ${mode}`).toBe("validation-rejected");
      expect(JSON.stringify(result), `create ${mode}`).not.toContain(secret);
      expect(fixture.executions(), `create ${mode}`).toBe(0);
    }

    for (const modelCapability of [
      Object.freeze({
        ...model,
        normalize: () => {
          throw new Error(secret);
        },
      }),
      Object.freeze({
        ...model,
        normalize: () => ({ ok: true }) as never,
      }),
      Object.freeze({
        ...model,
        normalize: () => {
          const entry = Object.create(null) as Record<string, unknown>;
          Object.defineProperties(entry, {
            code: {
              enumerable: true,
              get: () => {
                getterCalls += 1;
                throw new Error(secret);
              },
            },
            message: { enumerable: true, value: secret },
          });
          return { diagnostics: [entry], ok: false } as never;
        },
      }),
    ] as const) {
      const fixture = mutationOperations(
        new MutationProvider(),
        undefined,
        undefined,
        applicationBounds,
        modelCapability,
      );
      const result = await fixture.api.createComponent({ component: { id: ids.domain } });
      expect(result.status).toBe("validation-rejected");
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(fixture.executions()).toBe(0);
    }

    const normalizeModel: StandardModelCapability = Object.freeze({
      ...model,
      normalize: (input: StandardComponentInput) => {
        const normalized = model.normalize(input);
        if (!normalized.ok) return normalized;
        const payload = { ...(normalized.value.payload as GraphDataRecord) };
        Object.defineProperty(payload, "name", {
          enumerable: true,
          get: () => {
            getterCalls += 1;
            throw new Error(secret);
          },
        });
        return success(Object.freeze({ ...normalized.value, payload }));
      },
    });
    const normalizeFixture = mutationOperations(
      new MutationProvider(),
      undefined,
      undefined,
      applicationBounds,
      normalizeModel,
    );
    const normalizeResult = await normalizeFixture.api.createComponent({
      component: { id: ids.domain },
    });
    expect(normalizeResult.status).toBe("validation-rejected");
    expect(JSON.stringify(normalizeResult)).not.toContain(secret);
    expect(normalizeFixture.executions()).toBe(0);
    expect(getterCalls).toBe(0);
  });

  test("does not execute mutations when model views substitute component or relationship semantics", async () => {
    for (const boundary of ["component", "relationship"] as const) {
      const modelCapability: StandardModelCapability = Object.freeze({
        ...model,
        ...(boundary === "component"
          ? {
              parse: (entity: GraphEntity) => {
                const parsed = model.parse(entity);
                return parsed.ok ? success({ ...parsed.value, name: "Injected" } as never) : parsed;
              },
            }
          : {
              relationships: (relations: readonly GraphRelation[]) => {
                const viewed = model.relationships(relations);
                return viewed.ok
                  ? success(
                      viewed.value.map((relationship) => ({
                        ...relationship,
                        description: "Injected",
                      })) as never,
                    )
                  : viewed;
              },
            }),
      });
      const fixture = mutationOperations(
        new MutationProvider(),
        undefined,
        undefined,
        applicationBounds,
        modelCapability,
      );
      const result = await fixture.api.createComponent({
        component: { id: ids.domain },
        ...(boundary === "relationship"
          ? {
              relationships: [{ id: relationIds.first, target: ids.domain, type: "depends-on" }],
            }
          : {}),
      });
      expect(result.status, boundary).toBe("validation-rejected");
      expect(fixture.executions(), boundary).toBe(0);
    }
  });

  test("binds normalized identity presence before graph or provider work", async () => {
    for (const supplied of [true, false]) {
      const modelCapability: StandardModelCapability = Object.freeze({
        ...model,
        normalize: (input: StandardComponentInput) => {
          const normalized = model.normalize(input);
          if (!normalized.ok) return normalized;
          return success(Object.freeze({ ...normalized.value, id: ids.service }));
        },
      });
      const fixture = mutationOperations(
        new MutationProvider(),
        undefined,
        undefined,
        applicationBounds,
        modelCapability,
      );
      const result = await fixture.api.createComponent({
        component: supplied ? { id: ids.domain } : {},
      });
      expect(result.status, supplied ? "substituted id" : "injected id").toBe(
        "validation-rejected",
      );
      expect(fixture.provider.snapshots).toBe(0);
      expect(fixture.mappings()).toBe(0);
      expect(fixture.executions()).toBe(0);
    }

    const minted = mutationOperations();
    const result = await minted.api.createComponent({ component: {} });
    expect(result.status).toBe("committed");
    if (result.status !== "committed") return;
    expect(String(result.value.id)).toBe("ent_00000000000000000000000000000032");
  });

  test("contains rejected Promise normalize and patch results", async () => {
    const secret = "/private/mutation-promise-secret";
    const unhandled: unknown[] = [];
    let getterCalls = 0;
    let speciesCalls = 0;
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    class HostilePromise<T> extends Promise<T> {
      static override get [Symbol.species](): PromiseConstructor {
        speciesCalls += 1;
        throw new Error(secret);
      }
    }
    Object.defineProperty(HostilePromise.prototype, "then", {
      configurable: true,
      get: () => {
        getterCalls += 1;
        throw new Error(secret);
      },
    });
    const rejectedPromise = (hostile: boolean): Promise<never> => {
      if (!hostile) return Promise.reject(new Error(secret));
      const promise = new HostilePromise<never>((_resolve, reject) => reject(new Error(secret)));
      Object.defineProperty(promise, "then", {
        configurable: true,
        get: () => {
          getterCalls += 1;
          throw new Error(secret);
        },
      });
      return promise;
    };

    process.on("unhandledRejection", onUnhandled);
    try {
      for (const hostile of [false, true]) {
        const normalizeModel: StandardModelCapability = Object.freeze({
          ...model,
          normalize: () => rejectedPromise(hostile) as never,
        });
        const normalizeFixture = mutationOperations(
          new MutationProvider(),
          undefined,
          undefined,
          applicationBounds,
          normalizeModel,
        );
        const normalized = await normalizeFixture.api.createComponent({
          component: { id: ids.domain },
        });
        expect(normalized.status).toBe("validation-rejected");
        expect(JSON.stringify(normalized)).not.toContain(secret);
        expect(normalizeFixture.provider.snapshots).toBe(0);
        expect(normalizeFixture.executions()).toBe(0);

        const patchModel: StandardModelCapability = Object.freeze({
          ...model,
          patch: () => rejectedPromise(hostile) as never,
        });
        const patchFixture = mutationOperations(
          new MutationProvider(),
          undefined,
          undefined,
          applicationBounds,
          patchModel,
        );
        const created = await patchFixture.api.createComponent({ component: { id: ids.domain } });
        expect(created.status).toBe("committed");
        if (created.status !== "committed") continue;
        const executions = patchFixture.executions();
        const patched = await patchFixture.api.updateComponent({
          expectedRevision: committedRevision(created),
          id: ids.domain,
          patch: { name: "Ignored" },
        });
        expect(patched.status).toBe("validation-rejected");
        expect(JSON.stringify(patched)).not.toContain(secret);
        expect(patchFixture.executions()).toBe(executions);
      }
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(getterCalls).toBe(0);
      expect(speciesCalls).toBe(0);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("rejects proxied and oversized normalize and patch payloads inside the decoder boundary", async () => {
    const secret = "/private/model-boundary-secret";
    let proxyTraps = 0;
    const nestedProxy = new Proxy(
      { secret },
      {
        ownKeys: () => {
          proxyTraps += 1;
          throw new Error(secret);
        },
      },
    );
    const proxyModel: StandardModelCapability = Object.freeze({
      ...model,
      normalize: (input: StandardComponentInput) => {
        const normalized = model.normalize(input);
        if (!normalized.ok) return normalized;
        return success(
          Object.freeze({
            ...normalized.value,
            payload: Object.freeze({
              ...(normalized.value.payload as GraphDataRecord),
              "example.dev/proxy": nestedProxy,
            }),
          }),
        );
      },
    });
    const proxyFixture = mutationOperations(
      new MutationProvider(),
      undefined,
      undefined,
      applicationBounds,
      proxyModel,
      (value) => value === nestedProxy,
    );
    const proxyResult = await proxyFixture.api.createComponent({
      component: { id: ids.domain },
    });
    expect(proxyResult.status).toBe("validation-rejected");
    expect(JSON.stringify(proxyResult)).not.toContain(secret);
    expect(proxyFixture.provider.snapshots).toBe(0);
    expect(proxyFixture.mappings()).toBe(0);
    expect(proxyFixture.executions()).toBe(0);
    expect(proxyTraps).toBe(0);

    const structuralBounds = Object.freeze({
      ...applicationBounds,
      maxSnapshotStateValues: 100,
    });
    const large = new Array(150).fill(true);
    const normalizeModel: StandardModelCapability = Object.freeze({
      ...model,
      normalize: (input: StandardComponentInput) => {
        const normalized = model.normalize(input);
        if (!normalized.ok) return normalized;
        return success(
          Object.freeze({
            ...normalized.value,
            payload: Object.freeze({
              ...(normalized.value.payload as GraphDataRecord),
              "example.dev/large": large,
            }),
          }),
        );
      },
    });
    const normalizeFixture = mutationOperations(
      new MutationProvider(),
      undefined,
      undefined,
      structuralBounds,
      normalizeModel,
    );
    const normalizeResult = await normalizeFixture.api.createComponent({
      component: { id: ids.domain },
    });
    expect(normalizeResult.status).toBe("validation-rejected");
    expect(normalizeFixture.provider.snapshots).toBe(0);
    expect(normalizeFixture.mappings()).toBe(0);
    expect(normalizeFixture.executions()).toBe(0);

    const patchModel: StandardModelCapability = Object.freeze({
      ...model,
      patch: (entity: GraphEntity, patch: StandardComponentPatch) => {
        const patched = model.patch(entity, patch);
        if (!patched.ok) return patched;
        return success(
          Object.freeze({
            ...patched.value,
            payload: Object.freeze({
              ...(patched.value.payload as GraphDataRecord),
              "example.dev/large": large,
            }),
          }),
        );
      },
    });
    const patchFixture = mutationOperations(
      new MutationProvider(),
      undefined,
      undefined,
      structuralBounds,
      patchModel,
    );
    const created = await patchFixture.api.createComponent({ component: { id: ids.domain } });
    expect(created.status).toBe("committed");
    if (created.status !== "committed") return;
    const executions = patchFixture.executions();
    const patchResult = await patchFixture.api.updateComponent({
      expectedRevision: committedRevision(created),
      id: ids.domain,
      patch: { name: "Ignored" },
    });
    expect(patchResult.status).toBe("validation-rejected");
    expect(patchFixture.executions()).toBe(executions);
  });

  test("adds, updates, removes outgoing relationships and rejects identity hijacking", async () => {
    const fixture = mutationOperations();
    const source = await fixture.api.createComponent({ component: { id: ids.domain } });
    const target = await fixture.api.createComponent({ component: { id: ids.target } });
    const other = await fixture.api.createComponent({ component: { id: ids.secondRoot } });
    const added = await fixture.api.updateComponent({
      expectedRevision: committedRevision(source),
      id: ids.domain,
      patch: {},
      relationships: {
        upsert: [
          {
            description: "Initial",
            id: relationIds.first,
            target: ids.target,
            type: "depends-on",
          },
        ],
      },
    });
    expect(added.status).toBe("committed");
    if (added.status !== "committed") return;

    const hijack = await fixture.api.updateComponent({
      expectedRevision: committedRevision(target),
      id: ids.target,
      patch: {},
      relationships: {
        upsert: [{ id: relationIds.first, target: ids.secondRoot, type: "depends-on" }],
      },
    });
    expect(hijack.status).toBe("validation-rejected");
    expect(hijack.status === "validation-rejected" && hijack.diagnostics[0]?.code).toBe(
      "relationship-id-hijack",
    );

    const changed = await fixture.api.updateComponent({
      expectedRevision: committedRevision(added),
      id: ids.domain,
      patch: {},
      relationships: {
        upsert: [
          {
            description: "Changed",
            id: relationIds.first,
            target: ids.secondRoot,
            type: "coordinates-with",
          },
        ],
      },
    });
    expect(changed.status).toBe("committed");
    if (changed.status !== "committed") return;
    const changedRead = await fixture.api.getComponent({
      id: ids.domain,
      relationships: { limit: 5 },
    });
    expect(
      changedRead.ok && String(changedRead.value.relationships.items[0]?.relationship.target),
    ).toBe(ids.secondRoot);

    const removed = await fixture.api.updateComponent({
      expectedRevision: committedRevision(changed),
      id: ids.domain,
      patch: {},
      relationships: { remove: [relationIds.first] },
    });
    expect(removed.status).toBe("committed");
    const finalRead = await fixture.api.getComponent({
      id: ids.domain,
      relationships: { limit: 5 },
    });
    expect(finalRead.ok && finalRead.value.relationships.items).toEqual([]);
    expect(other.status).toBe("committed");
  });

  test("isolates relationship model input mutation and executes only the canonical view", async () => {
    const secret = "/private/relationship-model-mutation";
    const unsafe = new Proxy(
      { secret },
      {
        ownKeys: () => {
          throw new Error(secret);
        },
      },
    );
    let modelCalls = 0;
    let modelInputFrozen = true;
    let mutationAccepted = false;
    let unsafeReachedExecution = false;
    let lastExecutedRelationship: GraphDataRecord | undefined;
    const hostileModel: StandardModelCapability = Object.freeze({
      ...model,
      relationships: (relations: readonly GraphRelation[]) => {
        const viewed = model.relationships(relations);
        const relation = relations[0];
        if (relation !== undefined) {
          modelCalls += 1;
          modelInputFrozen &&=
            Object.isFrozen(relations) &&
            Object.isFrozen(relation) &&
            Object.isFrozen(relation.payload);
          if (typeof relation.payload === "object" && relation.payload !== null) {
            mutationAccepted ||= Reflect.defineProperty(relation.payload, "example.dev/unsafe", {
              enumerable: true,
              value: unsafe,
            });
          }
          mutationAccepted ||= Reflect.defineProperty(relations, "0", {
            enumerable: true,
            value: unsafe,
          });
        }
        return viewed;
      },
    });
    const fixture = mutationOperations(
      new MutationProvider(),
      async (request, engine) => {
        const mutation = request.mutation as {
          readonly relationships: readonly GraphDataRecord[];
        };
        for (const change of mutation.relationships) {
          if (change.type !== "upsert") continue;
          const relationship = change.relationship as GraphDataRecord;
          const payload = relationship.payload as GraphDataRecord;
          unsafeReachedExecution ||=
            Object.getOwnPropertyDescriptor(payload, "example.dev/unsafe")?.value === unsafe;
          lastExecutedRelationship = relationship;
          expect(Object.isFrozen(relationship)).toBeTrue();
          expect(Object.isFrozen(payload)).toBeTrue();
        }
        return engine.execute(request);
      },
      undefined,
      applicationBounds,
      hostileModel,
      (value) => value === unsafe,
    );
    const source = await fixture.api.createComponent({ component: { id: ids.domain } });
    await fixture.api.createComponent({ component: { id: ids.target } });
    await fixture.api.createComponent({ component: { id: ids.secondRoot } });
    const added = await fixture.api.updateComponent({
      expectedRevision: committedRevision(source),
      id: ids.domain,
      patch: {},
      relationships: {
        upsert: [
          {
            description: "Initial",
            id: relationIds.first,
            target: ids.target,
            type: "depends-on",
          },
        ],
      },
    });
    expect(added.status).toBe("committed");
    if (added.status !== "committed") return;
    const changed = await fixture.api.updateComponent({
      expectedRevision: committedRevision(added),
      id: ids.domain,
      patch: {},
      relationships: {
        upsert: [
          {
            "example.dev/weight": 2,
            description: "Changed",
            id: relationIds.first,
            target: ids.secondRoot,
            type: "coordinates-with",
          },
        ],
      },
    });
    expect(changed.status).toBe("committed");
    expect(modelCalls).toBeGreaterThanOrEqual(2);
    expect(modelInputFrozen).toBeTrue();
    expect(mutationAccepted).toBeFalse();
    expect(unsafeReachedExecution).toBeFalse();
    expect(lastExecutedRelationship).toMatchObject({
      id: relationIds.first,
      payload: {
        "example.dev/weight": 2,
        description: "Changed",
      },
      source: ids.domain,
      target: ids.secondRoot,
      type: "coordinates-with",
    });
    expect(JSON.stringify(lastExecutedRelationship)).not.toContain(secret);
  });

  test("reparents explicitly and leaves cycle rejection to the registered invariant", async () => {
    const fixture = mutationOperations();
    const root = await fixture.api.createComponent({ component: { id: ids.domain } });
    const child = await fixture.api.createComponent({
      component: { id: ids.service, parent: ids.domain },
    });
    const rootChild = await fixture.api.reparentComponent({
      expectedRevision: committedRevision(child),
      id: ids.service,
      parent: null,
    });
    expect(rootChild.status === "committed" && rootChild.value.parent).toBeUndefined();
    const nestedAgain = await fixture.api.reparentComponent({
      expectedRevision: committedRevision(rootChild),
      id: ids.service,
      parent: ids.domain,
    });
    expect(nestedAgain.status).toBe("committed");

    const cycle = await fixture.api.reparentComponent({
      expectedRevision: committedRevision(root),
      id: ids.domain,
      parent: ids.service,
    });
    expect(cycle.status).toBe("validation-rejected");
    expect(cycle.status === "validation-rejected" && cycle.diagnostics[0]?.code).toBe(
      "component-containment-cycle",
    );
    expect(fixture.provider.commits).toBe(4);
    expect(fixture.provider.prepares).toBe(4);
  });

  test("removes only a relation-free leaf after explicit cleanup", async () => {
    const fixture = mutationOperations();
    const root = await fixture.api.createComponent({ component: { id: ids.domain } });
    const child = await fixture.api.createComponent({
      component: { id: ids.service, parent: ids.domain },
    });
    const target = await fixture.api.createComponent({
      component: { id: ids.target },
      relationships: [{ id: relationIds.first, target: ids.domain, type: "depends-on" }],
    });
    const hasChild = await fixture.api.removeComponent({
      expectedRevision: committedRevision(root),
      id: ids.domain,
    });
    expect(hasChild.status === "validation-rejected" && hasChild.diagnostics[0]?.code).toBe(
      "component-has-children",
    );
    const reparented = await fixture.api.reparentComponent({
      expectedRevision: committedRevision(child),
      id: ids.service,
      parent: null,
    });
    expect(reparented.status).toBe("committed");
    const incident = await fixture.api.removeComponent({
      expectedRevision: committedRevision(root),
      id: ids.domain,
    });
    expect(incident.status === "validation-rejected" && incident.diagnostics[0]?.code).toBe(
      "component-has-relationships",
    );
    const cleaned = await fixture.api.updateComponent({
      expectedRevision: committedRevision(target),
      id: ids.target,
      patch: {},
      relationships: { remove: [relationIds.first] },
    });
    expect(cleaned.status).toBe("committed");
    const removed = await fixture.api.removeComponent({
      expectedRevision: committedRevision(root),
      id: ids.domain,
    });
    expect(removed.status).toBe("committed");
    if (removed.status !== "committed") return;
    expect(removed.value).toBe(ids.domain);
    expect(removed.revisions).toEqual([{ componentId: ids.domain, revision: null }]);
  });

  test("scrubs resource diagnostics and fails closed on malformed transaction outcomes", async () => {
    const conflictProvider = new MutationProvider();
    let changed = false;
    const conflictFixture = mutationOperations(conflictProvider, async (request, engine) => {
      if (!changed) {
        changed = true;
        for (const entry of request.expectedRevisions) {
          conflictProvider.revisions.set(entry.resource as ResourceKey, "raced-revision");
        }
      }
      return engine.execute(request);
    });
    const conflict = await conflictFixture.api.createComponent({ component: { id: ids.domain } });
    expect(conflict.status).toBe("conflict");
    expect(JSON.stringify(conflict)).not.toContain("opaque-resource:");

    const malformedFixture = mutationOperations(
      new MutationProvider(),
      async () => ({ status: "impossible" }) as never,
    );
    const malformed = await malformedFixture.api.createComponent({
      component: { id: ids.domain },
    });
    expect(malformed.status).toBe("indeterminate");
    expect(JSON.stringify(malformed)).not.toContain("opaque-resource:");

    const invalid = await malformedFixture.api.updateComponent({
      expectedRevision: "revision",
      id: ids.domain,
      patch: {},
      unexpected: true,
    } as never);
    expect(invalid.status).toBe("validation-rejected");
    expect(malformedFixture.executions()).toBe(1);
  });

  test("sanitizes conflict, provider, validation, and indeterminate capability diagnostics", async () => {
    const secret = "/private/provider/workspace.md::recovery-secret-token";
    const diagnostic = {
      code: "semantic-test-code",
      details: {
        id: ids.domain,
        note: secret,
        path: secret,
        resource: secret,
      },
      message: `Provider exposed ${secret}`,
    };
    const outcomes: readonly { readonly outcome: TransactionOutcome; readonly status: string }[] = [
      { outcome: { diagnostics: [diagnostic], status: "conflict" }, status: "conflict" },
      {
        outcome: {
          committed: false,
          diagnostics: [diagnostic],
          phase: "prepare",
          status: "provider-failure",
        },
        status: "provider-failure",
      },
      {
        outcome: { diagnostics: [diagnostic], status: "validation-rejected" },
        status: "validation-rejected",
      },
      {
        outcome: {
          diagnostics: [diagnostic],
          recovery: {
            baseGeneration: generation(0),
            generation: generation(1),
            resources: [resource(ids.domain)],
            token: secret,
          },
          status: "indeterminate",
        },
        status: "indeterminate",
      },
    ];
    for (const entry of outcomes) {
      const fixture = mutationOperations(new MutationProvider(), async () => entry.outcome);
      const result = await fixture.api.createComponent({ component: { id: ids.domain } });
      expect(String(result.status)).toBe(entry.status);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(result.status !== "committed" && result.diagnostics[0]?.code).toBe(
        "semantic-test-code",
      );
      expect(result.status !== "committed" && result.diagnostics[0]?.details?.id).toBe(ids.domain);
    }
  });

  test("replaces unsafe transaction diagnostic codes with category-owned codes", async () => {
    const secret = "/private/workspace/groma/intent/secret.md";
    const cases: readonly {
      readonly expected: string;
      readonly outcome: TransactionOutcome;
    }[] = [
      {
        expected: "application-conflict",
        outcome: { diagnostics: [{ code: secret, message: secret }], status: "conflict" },
      },
      {
        expected: "application-provider-failure",
        outcome: {
          committed: false,
          diagnostics: [{ code: secret, message: secret }],
          phase: "prepare",
          status: "provider-failure",
        },
      },
      {
        expected: "application-validation-rejected",
        outcome: {
          diagnostics: [{ code: secret, message: secret }],
          status: "validation-rejected",
        },
      },
    ];
    for (const entry of cases) {
      const fixture = mutationOperations(new MutationProvider(), async () => entry.outcome);
      const result = await fixture.api.createComponent({ component: { id: ids.domain } });
      expect(result.status).not.toBe("committed");
      expect(JSON.stringify(result)).not.toContain(secret);
      if (result.status !== "committed") {
        expect(result.diagnostics[0]?.code).toBe(entry.expected);
      }
    }
  });

  test("rejects recognized outer and nested transaction outcome proxies without traps", async () => {
    for (const location of [
      "outer",
      "diagnostics",
      "details",
      "revisions",
      "affected",
      "recovery-resources",
    ] as const) {
      const proxies = new Set<unknown>();
      const traps = { count: 0 };
      const fixture = mutationOperations(
        new MutationProvider(),
        async (request, engine) => {
          if (location === "revisions" || location === "affected") {
            const committed = await engine.execute(request);
            if (committed.status !== "committed") return committed;
            return {
              ...committed,
              ...(location === "revisions"
                ? { revisions: recognizedProxy([...committed.revisions], proxies, traps) }
                : {
                    event: {
                      ...committed.event,
                      affected: recognizedProxy({ ...committed.event.affected }, proxies, traps),
                    },
                  }),
            } as never;
          }
          if (location === "recovery-resources") {
            return {
              diagnostics: [{ code: "unknown", message: "Unknown" }],
              recovery: {
                baseGeneration: generation(0),
                generation: generation(1),
                resources: recognizedProxy([resource(ids.domain)], proxies, traps),
                token: "opaque",
              },
              status: "indeterminate",
            } as never;
          }
          const diagnostics = [
            {
              code: "validation",
              details:
                location === "details"
                  ? recognizedProxy({ id: ids.domain }, proxies, traps)
                  : { id: ids.domain },
              message: "Validation",
            },
          ];
          const outcome = {
            diagnostics:
              location === "diagnostics"
                ? recognizedProxy(diagnostics, proxies, traps)
                : diagnostics,
            status: "validation-rejected" as const,
          };
          return (
            location === "outer" ? recognizedProxy(outcome, proxies, traps) : outcome
          ) as never;
        },
        undefined,
        applicationBounds,
        model,
        (value) => proxies.has(value),
      );
      const result = await fixture.api.createComponent({ component: { id: ids.domain } });
      expect(result.status, location).toBe("indeterminate");
      expect(Object.isFrozen(result), location).toBeTrue();
      expect(JSON.stringify(result), location).not.toContain("recognized-proxy-trap");
      expect(traps.count, location).toBe(0);
    }
  });

  test("binds committed affected identity sets exactly to the submitted transaction", async () => {
    const otherEntity = "ent_0000000000000000000000000000000c";
    const otherRelation = "rel_00000000000000000000000000000003";
    const cases = [
      {
        entities: [ids.domain],
        expected: "committed",
        name: "reordered",
        relations: [relationIds.second, relationIds.first],
      },
      { entities: [], expected: "indeterminate", name: "missing", relations: [] },
      {
        entities: [ids.domain, otherEntity],
        expected: "indeterminate",
        name: "extra",
        relations: [relationIds.first, relationIds.second],
      },
      {
        entities: [otherEntity],
        expected: "indeterminate",
        name: "unrelated",
        relations: [relationIds.first, relationIds.second],
      },
      {
        entities: [ids.domain, ids.domain],
        expected: "indeterminate",
        name: "duplicate",
        relations: [relationIds.first, relationIds.second],
      },
      {
        entities: [ids.domain],
        expected: "indeterminate",
        name: "extra relation",
        relations: [relationIds.first, relationIds.second, otherRelation],
      },
    ] as const;
    for (const entry of cases) {
      const fixture = mutationOperations(new MutationProvider(), async (request) => {
        const committedGeneration = generation(1);
        return {
          event: {
            affected: { entities: entry.entities, relations: entry.relations },
            generation: committedGeneration,
            type: "graph.committed",
          },
          generation: committedGeneration,
          revisions: request.expectedRevisions.map((expected) => ({
            resource: expected.resource,
            revision: "committed-fake-revision",
          })),
          status: "committed",
        } as never;
      });
      const result = await fixture.api.createComponent({
        component: { id: ids.domain },
        relationships: [
          { id: relationIds.first, target: ids.domain, type: "depends-on" },
          { id: relationIds.second, target: ids.domain, type: "coordinates-with" },
        ],
      });
      expect(result.status, entry.name).toBe(entry.expected);
      if (result.status === "committed") {
        expect(result.affected).toEqual({
          components: [ids.domain],
          relationships: [relationIds.first, relationIds.second],
        });
      }
    }
  });
});

describe("application operation bounds", () => {
  test("rejects constructor bounds beyond absolute ceilings", () => {
    expect(() => operations(new SnapshotFixture(), undefined, { maxSnapshotAttempts: 17 })).toThrow(
      "maxSnapshotAttempts",
    );
    expect(() =>
      operations(new SnapshotFixture(), undefined, {
        bounds: { ...applicationBounds, maxComponents: 1_000_001 },
      }),
    ).toThrow("maxComponents");
    expect(() =>
      operations(new SnapshotFixture(), undefined, {
        bounds: { ...applicationBounds, maxRequestDataDepth: 101 },
      }),
    ).toThrow("maxRequestDataDepth");
    expect(() =>
      operations(new SnapshotFixture(), undefined, {
        bounds: { ...applicationBounds, maxRequestDataValues: 10_000_001 },
      }),
    ).toThrow("maxRequestDataValues");
  });

  test("rejects over-limit snapshot arrays before reading entries", async () => {
    let invoked = false;
    const components = new Array(2);
    Object.defineProperty(components, "0", {
      enumerable: true,
      get: () => {
        invoked = true;
        return {};
      },
    });
    const fixture = new SnapshotFixture();
    fixture.currentState = { components, relationships: [] } as never;
    const result = await operations(fixture, undefined, {
      bounds: { ...applicationBounds, maxComponents: 1 },
    }).listComponents({ limit: 1 });
    expect(result.ok).toBe(false);
    expect(invoked).toBe(false);

    let relationshipInvoked = false;
    const relationships = new Array(2);
    Object.defineProperty(relationships, "0", {
      enumerable: true,
      get: () => {
        relationshipInvoked = true;
        return {};
      },
    });
    const relationshipFixture = new SnapshotFixture();
    relationshipFixture.currentState = { components: [], relationships } as never;
    const relationshipResult = await operations(relationshipFixture, undefined, {
      bounds: { ...applicationBounds, maxRelationships: 1 },
    }).listComponents({ limit: 1 });
    expect(relationshipResult.ok).toBe(false);
    expect(relationshipInvoked).toBe(false);

    const structuralFixture = new SnapshotFixture();
    const structural = await operations(structuralFixture, undefined, {
      bounds: { ...applicationBounds, maxSnapshotStateDepth: 2, maxSnapshotStateValues: 2 },
    }).listComponents({ limit: 1 });
    expect(structural.ok).toBe(false);

    const embeddedFixture = new SnapshotFixture();
    const embedded = await operations(embeddedFixture, undefined, {
      bounds: { ...applicationBounds, maxEmbeddedItems: 1 },
    }).listComponents({ limit: 1 });
    expect(embedded.ok ? "" : embedded.diagnostics[0]?.code).toBe("application-bound-exceeded");
  });

  test("rejects embedded and relationship request overflows before identity or execution", async () => {
    let entityCalls = 0;
    const idSource: OpaqueIdSource = {
      nextEntityId: () => {
        entityCalls += 1;
        return ids.domain;
      },
      nextRelationId: () => relationIds.first,
    };
    let embeddedInvoked = false;
    const inputs = new Array(2);
    Object.defineProperty(inputs, "0", {
      enumerable: true,
      get: () => {
        embeddedInvoked = true;
        return {};
      },
    });
    const embedded = mutationOperations(new MutationProvider(), undefined, idSource, {
      ...applicationBounds,
      maxEmbeddedItems: 1,
    });
    const embeddedResult = await embedded.api.createComponent({ component: { inputs } as never });
    expect(embeddedResult.status).toBe("validation-rejected");
    expect(embeddedInvoked).toBe(false);
    expect(entityCalls).toBe(0);
    expect(embedded.executions()).toBe(0);

    let relationshipInvoked = false;
    const relationships = new Array(2);
    Object.defineProperty(relationships, "0", {
      enumerable: true,
      get: () => {
        relationshipInvoked = true;
        return {};
      },
    });
    const relationship = mutationOperations(new MutationProvider(), undefined, idSource, {
      ...applicationBounds,
      maxRelationshipMutations: 1,
    });
    const relationshipResult = await relationship.api.createComponent({
      component: {},
      relationships: relationships as never,
    });
    expect(relationshipResult.status).toBe("validation-rejected");
    expect(relationshipInvoked).toBe(false);
    expect(entityCalls).toBe(0);
    expect(relationship.executions()).toBe(0);
  });

  test("bounds create, update, and relationship request depth before side effects", async () => {
    const cases = [
      {
        bounds: { ...applicationBounds, maxRequestDataDepth: 4 },
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.createComponent({
            component: { "example.dev/deep": { level: { value: true } } },
          }),
        name: "create extension depth",
      },
      {
        bounds: { ...applicationBounds, maxRequestDataDepth: 4 },
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.updateComponent({
            expectedRevision: "revision",
            id: ids.domain,
            patch: { "example.dev/deep": { level: { value: true } } },
          }),
        name: "update extension depth",
      },
      {
        bounds: { ...applicationBounds, maxRequestDataDepth: 5 },
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.createComponent({
            component: {},
            relationships: [
              {
                "example.dev/deep": { level: { value: true } },
                description: "Bounded relationship",
                target: ids.target,
                type: "depends-on",
              },
            ],
          }),
        name: "relationship extension depth",
      },
    ] as const;
    for (const entry of cases) {
      let entityCalls = 0;
      let relationCalls = 0;
      const provider = new MutationProvider();
      const fixture = mutationOperations(
        provider,
        undefined,
        {
          nextEntityId: () => {
            entityCalls += 1;
            return ids.domain;
          },
          nextRelationId: () => {
            relationCalls += 1;
            return relationIds.first;
          },
        },
        entry.bounds,
      );
      const result = await entry.invoke(fixture.api);
      expect(result.status, entry.name).toBe("validation-rejected");
      expect(
        result.status === "validation-rejected" && result.diagnostics[0]?.code,
        entry.name,
      ).toBe("application-request-data-too-large");
      expect(entityCalls, entry.name).toBe(0);
      expect(relationCalls, entry.name).toBe(0);
      expect(provider.snapshots, entry.name).toBe(0);
      expect(fixture.executions(), entry.name).toBe(0);
    }
  });

  test("bounds total create, update, and relationship request values before side effects", async () => {
    const cases = [
      {
        bounds: { ...applicationBounds, maxRequestDataValues: 7 },
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.createComponent({
            component: {
              "example.dev/owner": "architecture",
              actions: [{ description: "Release safely", id: "deploy" }],
            },
          }),
        name: "create item and extension values",
      },
      {
        bounds: { ...applicationBounds, maxRequestDataValues: 7 },
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.updateComponent({
            expectedRevision: "revision",
            id: ids.domain,
            patch: {
              "example.dev/owner": "architecture",
              outputs: [{ id: "receipts", name: "Receipts" }],
            },
          }),
        name: "update item and extension values",
      },
      {
        bounds: { ...applicationBounds, maxRequestDataValues: 7 },
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.createComponent({
            component: {},
            relationships: [
              {
                "example.dev/strength": "required",
                description: "Authenticates through",
                target: ids.target,
                type: "depends-on",
              },
            ],
          }),
        name: "relationship description and extension values",
      },
    ] as const;
    for (const entry of cases) {
      let entityCalls = 0;
      let relationCalls = 0;
      const provider = new MutationProvider();
      const fixture = mutationOperations(
        provider,
        undefined,
        {
          nextEntityId: () => {
            entityCalls += 1;
            return ids.domain;
          },
          nextRelationId: () => {
            relationCalls += 1;
            return relationIds.first;
          },
        },
        entry.bounds,
      );
      const result = await entry.invoke(fixture.api);
      expect(result.status, entry.name).toBe("validation-rejected");
      expect(
        result.status === "validation-rejected" && result.diagnostics[0]?.code,
        entry.name,
      ).toBe("application-request-data-too-large");
      expect(entityCalls, entry.name).toBe(0);
      expect(relationCalls, entry.name).toBe(0);
      expect(provider.snapshots, entry.name).toBe(0);
      expect(fixture.executions(), entry.name).toBe(0);
    }
  });

  test("rejects proxy-shaped component input before identity or execution", async () => {
    let trapped = false;
    let entityCalls = 0;
    const componentProxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => {
          trapped = true;
          throw new Error("proxy trap must stay contained");
        },
      },
    );
    const fixture = mutationOperations(new MutationProvider(), undefined, {
      nextEntityId: () => {
        entityCalls += 1;
        return ids.domain;
      },
      nextRelationId: () => relationIds.first,
    });
    const result = await fixture.api.createComponent({ component: componentProxy });
    expect(result.status).toBe("validation-rejected");
    expect(trapped).toBe(true);
    expect(entityCalls).toBe(0);
    expect(fixture.executions()).toBe(0);
  });

  test("contains proxy-shaped update and relationship payloads before side effects", async () => {
    const hostile = () =>
      new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error("proxy trap must stay contained");
          },
        },
      );
    for (const entry of [
      {
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.updateComponent({
            expectedRevision: "revision",
            id: ids.domain,
            patch: hostile(),
          }),
        name: "update patch",
      },
      {
        invoke: (api: ReturnType<typeof mutationOperations>["api"]) =>
          api.createComponent({ component: {}, relationships: [hostile() as never] }),
        name: "relationship payload",
      },
    ] as const) {
      let entityCalls = 0;
      let relationCalls = 0;
      const provider = new MutationProvider();
      const fixture = mutationOperations(provider, undefined, {
        nextEntityId: () => {
          entityCalls += 1;
          return ids.domain;
        },
        nextRelationId: () => {
          relationCalls += 1;
          return relationIds.first;
        },
      });
      const result = await entry.invoke(fixture.api);
      expect(result.status, entry.name).toBe("validation-rejected");
      expect(entityCalls, entry.name).toBe(0);
      expect(relationCalls, entry.name).toBe(0);
      expect(provider.snapshots, entry.name).toBe(0);
      expect(fixture.executions(), entry.name).toBe(0);
    }
  });

  test("rejects over-limit executor diagnostics before reading entries", async () => {
    let invoked = false;
    const diagnostics = new Array(2);
    Object.defineProperty(diagnostics, "0", {
      enumerable: true,
      get: () => {
        invoked = true;
        return {};
      },
    });
    const fixture = mutationOperations(
      new MutationProvider(),
      async () => ({ diagnostics, status: "validation-rejected" }) as never,
      undefined,
      { ...applicationBounds, maxDiagnosticCount: 1 },
    );
    const result = await fixture.api.createComponent({ component: { id: ids.domain } });
    expect(result.status).toBe("indeterminate");
    expect(invoked).toBe(false);
  });
});
