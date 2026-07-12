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
  type GraphGeneration,
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
  createStandardModelCapability,
  createStandardModelInvariant,
  type StandardComponentInput,
  type StandardModelTransactionState,
} from "../../standard-model/index.ts";
import {
  type ApplicationMutationOutcome,
  createApplicationOperations,
  type ApplicationOperationsOptions,
  type WorkspaceInitializationOutcome,
} from "../index.ts";
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
  currentState: StandardModelTransactionState = state([]);
  #pending: ProposedTransaction | undefined;

  snapshot = (resources: readonly ResourceKey[]): TransactionProviderSnapshotInput =>
    Object.freeze({
      generation: this.generation,
      revisions: Object.freeze(
        resources.map((key) =>
          Object.freeze({ resource: key, revision: this.revisions.get(key) ?? null }),
        ),
      ),
      state: this.currentState,
    });

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
) {
  const semanticInitialization = createStatefulSemanticInitializer();
  let entityCounter = 50;
  let relationCounter = 50;
  const graph = new GraphKernel({
    idSource: {
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
  let executions = 0;
  const api = createApplicationOperations({
    graph,
    initialization: semanticInitialization.capability,
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
      execute: (request) => {
        executions += 1;
        return executeOverride === undefined
          ? engine.execute(request)
          : executeOverride(request, engine);
      },
    },
    transactionProvider: provider,
  });
  return { api, executions: () => executions, initialization: semanticInitialization, provider };
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
});

function committedRevision(outcome: ApplicationMutationOutcome<unknown>): string {
  if (outcome.status !== "committed" || outcome.revisions[0]?.revision === null) {
    throw new Error(`expected committed mutation, received ${outcome.status}`);
  }
  return outcome.revisions[0]!.revision;
}

describe("application component mutations", () => {
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
});
