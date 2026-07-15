import type {
  ApplicationMutationOutcome,
  ApplicationOperations,
  ComponentPage,
  ExactComponentRead,
  WorkspaceInitializationCapability,
} from "../index.ts";
import { parseGraphGeneration, type GraphData } from "../../core/index.ts";
import type {
  StandardComponent,
  StandardItem,
  StandardRelationship,
} from "../../standard-model/index.ts";

export const conformanceIds = Object.freeze({
  module: "ent_00000000000000000000000000000069",
  nestedService: "ent_0000000000000000000000000000006a",
  rootA: "ent_00000000000000000000000000000065",
  rootB: "ent_00000000000000000000000000000066",
  serviceA: "ent_00000000000000000000000000000067",
  serviceB: "ent_00000000000000000000000000000068",
  crossBranch: "rel_000000000000000000000000000000c9",
  sibling: "rel_000000000000000000000000000000ca",
} as const);

export type SemanticInitializationMode = "absent" | "conflicting";

export interface SemanticInitializationSnapshot {
  readonly components: readonly [];
  readonly generation?: number;
  readonly relationships: readonly [];
  readonly sentinel?: string;
  readonly state: "absent" | "conflicting" | "initialized";
}

export function createStatefulSemanticInitializer(mode: SemanticInitializationMode = "absent"): {
  readonly capability: WorkspaceInitializationCapability;
  readonly snapshot: () => SemanticInitializationSnapshot;
} {
  const generation = parseGraphGeneration(0);
  if (!generation.ok) throw new Error("Semantic initializer generation is invalid");
  let state: SemanticInitializationSnapshot = Object.freeze(
    mode === "conflicting"
      ? {
          components: Object.freeze([] as const),
          relationships: Object.freeze([] as const),
          sentinel: "preserve-incompatible-workspace",
          state: "conflicting" as const,
        }
      : {
          components: Object.freeze([] as const),
          relationships: Object.freeze([] as const),
          state: "absent" as const,
        },
  );
  const capability: WorkspaceInitializationCapability = Object.freeze({
    initialize: async () => {
      if (state.state === "conflicting") {
        return Object.freeze({
          diagnostics: Object.freeze([
            Object.freeze({
              code: "workspace-initialization-conflict",
              details: Object.freeze({
                attempts: 1,
                overwritePrevented: true,
                state: "incompatible",
              }),
              message: "Existing workspace state is incompatible with initialization",
            }),
          ]),
          status: "conflict" as const,
        });
      }
      if (state.state === "initialized") {
        return Object.freeze({
          generation: generation.value,
          status: "already-initialized" as const,
        });
      }
      state = Object.freeze({
        components: Object.freeze([] as const),
        generation: Number(generation.value),
        relationships: Object.freeze([] as const),
        state: "initialized" as const,
      });
      return Object.freeze({ generation: generation.value, status: "initialized" as const });
    },
  });
  return Object.freeze({ capability, snapshot: () => state });
}

export interface StandardItemTrace {
  readonly description?: string;
  readonly extensions: Readonly<Record<string, GraphData>>;
  readonly id: string;
  readonly name?: string;
}

export interface ComponentSemanticsTrace {
  readonly actions?: readonly StandardItemTrace[];
  readonly desired?: string;
  readonly extensions: Readonly<Record<string, GraphData>>;
  readonly iconDomain?: string;
  readonly id: string;
  readonly inputs?: readonly StandardItemTrace[];
  readonly intent?: string;
  readonly label?: string;
  readonly lifecycle?: string;
  readonly name?: string;
  readonly outputs?: readonly StandardItemTrace[];
  readonly parent?: string;
  readonly summary?: string;
  readonly type?: string;
}

export interface RelationshipSemanticsTrace {
  readonly description?: string;
  readonly extensions: Readonly<Record<string, GraphData>>;
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

function extensions(
  value: Readonly<Record<string, GraphData>>,
): Readonly<Record<string, GraphData>> {
  const copied: Record<string, GraphData> = {};
  for (const key of Object.keys(value).sort()) copied[key] = value[key]!;
  return copied;
}

function item(item: StandardItem): StandardItemTrace {
  return {
    ...(item.description === undefined ? {} : { description: item.description }),
    extensions: extensions(item.extensions),
    id: item.id,
    ...(item.name === undefined ? {} : { name: item.name }),
  };
}

export function projectComponentSemantics(component: StandardComponent): ComponentSemanticsTrace {
  return {
    ...(component.actions === undefined ? {} : { actions: component.actions.map(item) }),
    ...(component.desired === undefined ? {} : { desired: component.desired }),
    extensions: extensions(component.extensions),
    ...(component.iconDomain === undefined ? {} : { iconDomain: component.iconDomain }),
    id: component.id,
    ...(component.inputs === undefined ? {} : { inputs: component.inputs.map(item) }),
    ...(component.intent === undefined ? {} : { intent: component.intent }),
    ...(component.label === undefined ? {} : { label: component.label }),
    ...(component.lifecycle === undefined ? {} : { lifecycle: component.lifecycle }),
    ...(component.name === undefined ? {} : { name: component.name }),
    ...(component.outputs === undefined ? {} : { outputs: component.outputs.map(item) }),
    ...(component.parent === undefined ? {} : { parent: component.parent }),
    ...(component.summary === undefined ? {} : { summary: component.summary }),
    ...(component.type === undefined ? {} : { type: component.type }),
  };
}

export function projectRelationshipSemantics(
  relationship: StandardRelationship,
): RelationshipSemanticsTrace {
  return {
    ...(relationship.description === undefined ? {} : { description: relationship.description }),
    extensions: extensions(relationship.extensions),
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    type: relationship.type,
  };
}

export interface ApplicationOperationsTrace {
  readonly final: {
    readonly components: readonly ComponentSemanticsTrace[];
    readonly generation: number;
    readonly relationshipCount: number;
    readonly revisionsPresent: boolean;
  };
  readonly initialization: readonly string[];
  readonly mutations: readonly {
    readonly generation?: number;
    readonly id: string;
    readonly revisionPresent: boolean;
    readonly status: string;
  }[];
  readonly pages: {
    readonly allHasMore: readonly boolean[];
    readonly allIds: readonly string[];
    readonly childHasMore: readonly boolean[];
    readonly childIds: readonly string[];
    readonly relationshipHasMore: readonly boolean[];
    readonly relationshipIds: readonly string[];
    readonly rootHasMore: readonly boolean[];
    readonly rootIds: readonly string[];
  };
  readonly richRead: {
    readonly component: ComponentSemanticsTrace;
    readonly relationships: readonly RelationshipSemanticsTrace[];
    readonly revisionPresent: boolean;
  };
  readonly stale: {
    readonly unchangedIntent?: string;
    readonly status: string;
  };
}

export const expectedApplicationOperationsTrace: ApplicationOperationsTrace = Object.freeze({
  final: {
    components: [
      {
        actions: [
          {
            description: "Review architecture",
            extensions: { "example.dev/cadence": "continuous" },
            id: "review",
            name: "Review",
          },
        ],
        desired: "active",
        extensions: { "example.dev/owner": "architecture" },
        id: conformanceIds.rootA,
        inputs: [
          {
            description: "Observed facts",
            extensions: { "example.dev/source": "scanner" },
            id: "evidence",
            name: "Evidence",
          },
        ],
        intent: "Own commerce architecture.",
        lifecycle: "active",
        name: "Commerce",
        outputs: [
          {
            description: "Architectural decisions",
            extensions: { "example.dev/format": "record" },
            id: "decisions",
            name: "Decisions",
          },
        ],
        type: "domain",
      },
      { extensions: {}, id: conformanceIds.rootB, type: "domain" },
      {
        actions: [
          {
            description: "Submit an order",
            extensions: { "example.dev/channel": "web" },
            id: "submit",
            name: "Submit",
          },
        ],
        desired: "evolving",
        extensions: { "example.dev/team": "commerce" },
        id: conformanceIds.serviceA,
        inputs: [
          {
            description: "Current cart",
            extensions: { "example.dev/format": "json" },
            id: "cart",
            name: "Cart",
          },
        ],
        iconDomain: "checkout.example.com",
        intent: "Coordinate checkout.",
        label: "Checkout flow",
        lifecycle: "active",
        name: "Checkout",
        outputs: [
          {
            description: "Accepted order",
            extensions: { "example.dev/durability": "canonical" },
            id: "order",
            name: "Order",
          },
        ],
        parent: conformanceIds.rootA,
        summary: "Coordinates carts, identity, and accepted orders.",
        type: "service",
      },
      {
        extensions: { "example.dev/tier": 1 },
        id: conformanceIds.serviceB,
        intent: "Provide identity services.",
        name: "Identity",
        outputs: [{ extensions: {}, id: "identity", name: "Identity" }],
        parent: conformanceIds.rootB,
        type: "service",
      },
      {
        extensions: {},
        id: conformanceIds.nestedService,
        parent: conformanceIds.serviceA,
        type: "service",
      },
    ],
    generation: 10,
    relationshipCount: 0,
    revisionsPresent: true,
  },
  initialization: ["initialized", "already-initialized"],
  mutations: [
    { generation: 1, id: "create-root-a", revisionPresent: true, status: "committed" },
    { generation: 2, id: "create-root-b", revisionPresent: true, status: "committed" },
    { generation: 3, id: "create-service-b", revisionPresent: true, status: "committed" },
    { generation: 4, id: "create-service-a", revisionPresent: true, status: "committed" },
    { generation: 5, id: "create-module", revisionPresent: true, status: "committed" },
    {
      generation: 6,
      id: "create-nested-service",
      revisionPresent: true,
      status: "committed",
    },
    { generation: 7, id: "update-service-b", revisionPresent: true, status: "committed" },
    { generation: 8, id: "reparent-service-b", revisionPresent: true, status: "committed" },
    {
      generation: 9,
      id: "remove-service-a-relationships",
      revisionPresent: true,
      status: "committed",
    },
    { generation: 10, id: "remove-module", revisionPresent: true, status: "committed" },
  ],
  pages: {
    allHasMore: [true, true, false],
    allIds: [
      conformanceIds.rootA,
      conformanceIds.rootB,
      conformanceIds.serviceA,
      conformanceIds.serviceB,
      conformanceIds.module,
      conformanceIds.nestedService,
    ],
    childHasMore: [true, false],
    childIds: [conformanceIds.module, conformanceIds.nestedService],
    relationshipHasMore: [true, false],
    relationshipIds: [conformanceIds.crossBranch, conformanceIds.sibling],
    rootHasMore: [true, false],
    rootIds: [conformanceIds.rootA, conformanceIds.rootB],
  },
  richRead: {
    component: {
      actions: [
        {
          description: "Submit an order",
          extensions: { "example.dev/channel": "web" },
          id: "submit",
          name: "Submit",
        },
      ],
      desired: "evolving",
      extensions: { "example.dev/team": "commerce" },
      id: conformanceIds.serviceA,
      inputs: [
        {
          description: "Current cart",
          extensions: { "example.dev/format": "json" },
          id: "cart",
          name: "Cart",
        },
      ],
      iconDomain: "checkout.example.com",
      intent: "Coordinate checkout.",
      label: "Checkout flow",
      lifecycle: "active",
      name: "Checkout",
      outputs: [
        {
          description: "Accepted order",
          extensions: { "example.dev/durability": "canonical" },
          id: "order",
          name: "Order",
        },
      ],
      parent: conformanceIds.rootA,
      summary: "Coordinates carts, identity, and accepted orders.",
      type: "service",
    },
    relationships: [
      {
        description: "Cross-branch dependency",
        extensions: { "example.dev/rationale": "boundary" },
        id: conformanceIds.crossBranch,
        source: conformanceIds.serviceA,
        target: conformanceIds.rootB,
        type: "depends-on",
      },
      {
        description: "Coordinate identity",
        extensions: { "example.dev/strength": "required" },
        id: conformanceIds.sibling,
        source: conformanceIds.serviceA,
        target: conformanceIds.serviceB,
        type: "coordinates-with",
      },
    ],
    revisionPresent: true,
  },
  stale: { status: "conflict", unchangedIntent: "Provide identity services." },
});

function committed<T>(
  outcome: ApplicationMutationOutcome<T>,
  operation: string,
): Extract<ApplicationMutationOutcome<T>, { readonly status: "committed" }> {
  if (outcome.status !== "committed") {
    throw new Error(`${operation} expected committed but received ${outcome.status}`);
  }
  return outcome;
}

function revision(outcome: Extract<ApplicationMutationOutcome<unknown>, { status: "committed" }>) {
  const value = outcome.revisions[0]?.revision;
  if (value === undefined || value === null)
    throw new Error("committed component revision missing");
  return value;
}

function read<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false },
  operation: string,
): T {
  if (!result.ok) throw new Error(`${operation} failed`);
  return result.value;
}

async function componentPages(
  api: ApplicationOperations,
  first: ComponentPage,
): Promise<readonly ComponentPage[]> {
  const pages = [first];
  let current = first;
  while (current.nextCursor !== undefined) {
    current = read(
      await api.listComponents({ cursor: current.nextCursor, limit: 2 }),
      "continued component page",
    );
    pages.push(current);
  }
  return pages;
}

export async function exerciseApplicationOperations(
  api: ApplicationOperations,
): Promise<ApplicationOperationsTrace> {
  const initialization = read(await api.initialize({}), "initialize");
  const repeatedInitialization = read(await api.initialize({}), "repeat initialize");
  const mutations: {
    generation?: number;
    id: string;
    revisionPresent: boolean;
    status: string;
  }[] = [];
  function record<T>(
    id: string,
    outcome: ApplicationMutationOutcome<T>,
  ): Extract<ApplicationMutationOutcome<T>, { status: "committed" }> {
    const result = committed(outcome, id);
    mutations.push({
      generation: Number(result.generation),
      id,
      revisionPresent: result.revisions.every((entry) => entry.revision !== null),
      status: result.status,
    });
    return result;
  }

  record(
    "create-root-a",
    await api.createComponent({
      component: {
        "example.dev/owner": "architecture",
        actions: [
          {
            "example.dev/cadence": "continuous",
            description: "Review architecture",
            id: "review",
            name: "Review",
          },
        ],
        desired: "active",
        id: conformanceIds.rootA,
        inputs: [
          {
            "example.dev/source": "scanner",
            description: "Observed facts",
            id: "evidence",
            name: "Evidence",
          },
        ],
        intent: "Own commerce architecture.",
        lifecycle: "active",
        name: "Commerce",
        outputs: [
          {
            "example.dev/format": "record",
            description: "Architectural decisions",
            id: "decisions",
            name: "Decisions",
          },
        ],
        type: "domain",
      },
    }),
  );
  const rootB = record(
    "create-root-b",
    await api.createComponent({ component: { id: conformanceIds.rootB, type: "domain" } }),
  );
  const serviceB = record(
    "create-service-b",
    await api.createComponent({
      component: {
        id: conformanceIds.serviceB,
        name: "Identity",
        parent: conformanceIds.rootA,
        type: "service",
      },
    }),
  );
  const serviceA = record(
    "create-service-a",
    await api.createComponent({
      component: {
        "example.dev/team": "commerce",
        actions: [
          {
            "example.dev/channel": "web",
            description: "Submit an order",
            id: "submit",
            name: "Submit",
          },
        ],
        desired: "evolving",
        id: conformanceIds.serviceA,
        inputs: [
          {
            "example.dev/format": "json",
            description: "Current cart",
            id: "cart",
            name: "Cart",
          },
        ],
        iconDomain: "checkout.example.com",
        intent: "Coordinate checkout.",
        label: "Checkout flow",
        lifecycle: "active",
        name: "Checkout",
        outputs: [
          {
            "example.dev/durability": "canonical",
            description: "Accepted order",
            id: "order",
            name: "Order",
          },
        ],
        parent: conformanceIds.rootA,
        summary: "Coordinates carts, identity, and accepted orders.",
        type: "service",
      },
      relationships: [
        {
          "example.dev/rationale": "boundary",
          description: "Cross-branch dependency",
          id: conformanceIds.crossBranch,
          target: conformanceIds.rootB,
          type: "depends-on",
        },
        {
          "example.dev/strength": "required",
          description: "Coordinate identity",
          id: conformanceIds.sibling,
          target: conformanceIds.serviceB,
          type: "coordinates-with",
        },
      ],
    }),
  );
  const module = record(
    "create-module",
    await api.createComponent({
      component: {
        id: conformanceIds.module,
        parent: conformanceIds.serviceA,
        type: "module",
      },
    }),
  );
  record(
    "create-nested-service",
    await api.createComponent({
      component: {
        id: conformanceIds.nestedService,
        parent: conformanceIds.serviceA,
        type: "service",
      },
    }),
  );

  const exactFirst = read(
    await api.getComponent({ id: conformanceIds.serviceA, relationships: { limit: 1 } }),
    "exact service read",
  );
  if (exactFirst.relationships.nextCursor === undefined) {
    throw new Error("relationship conformance page did not continue");
  }
  const exactSecond = read(
    await api.getComponent({
      id: conformanceIds.serviceA,
      relationships: { cursor: exactFirst.relationships.nextCursor, limit: 1 },
    }),
    "continued relationship read",
  );

  const allFirst = read(await api.listComponents({ limit: 2 }), "component page");
  const allPages = await componentPages(api, allFirst);
  const rootFirst = read(await api.listRoots({ limit: 1 }), "root page");
  if (rootFirst.nextCursor === undefined) throw new Error("root page did not continue");
  const rootSecond = read(
    await api.listRoots({ cursor: rootFirst.nextCursor, limit: 1 }),
    "continued root page",
  );
  const childFirst = read(
    await api.listChildren({ limit: 1, parent: conformanceIds.serviceA }),
    "child page",
  );
  if (childFirst.nextCursor === undefined) throw new Error("child page did not continue");
  const childSecond = read(
    await api.listChildren({
      cursor: childFirst.nextCursor,
      limit: 1,
      parent: conformanceIds.serviceA,
    }),
    "continued child page",
  );

  const updated = record(
    "update-service-b",
    await api.updateComponent({
      expectedRevision: revision(serviceB),
      id: conformanceIds.serviceB,
      patch: {
        "example.dev/tier": 1,
        intent: "Provide identity services.",
        outputs: [{ id: "identity", name: "Identity" }],
      },
    }),
  );
  record(
    "reparent-service-b",
    await api.reparentComponent({
      expectedRevision: revision(updated),
      id: conformanceIds.serviceB,
      parent: conformanceIds.rootB,
    }),
  );
  const stale = await api.updateComponent({
    expectedRevision: revision(updated),
    id: conformanceIds.serviceB,
    patch: { intent: "This stale write must not apply." },
  });
  const unchanged = read(
    await api.getComponent({ id: conformanceIds.serviceB, relationships: { limit: 1 } }),
    "stale verification read",
  );
  const relationsRemoved = record(
    "remove-service-a-relationships",
    await api.updateComponent({
      expectedRevision: revision(serviceA),
      id: conformanceIds.serviceA,
      patch: {},
      relationships: { remove: [conformanceIds.crossBranch, conformanceIds.sibling] },
    }),
  );
  const moduleRemoved = await api.removeComponent({
    expectedRevision: revision(module),
    id: conformanceIds.module,
  });
  const removed = committed(moduleRemoved, "remove-module");
  mutations.push({
    generation: Number(removed.generation),
    id: "remove-module",
    revisionPresent: removed.revisions.every((entry) => entry.revision === null),
    status: removed.status,
  });

  const finalPage = read(await api.listComponents({ limit: 10 }), "final component page");
  const finalRelationRead = read(
    await api.getComponent({ id: conformanceIds.serviceA, relationships: { limit: 10 } }),
    "final relationship read",
  );
  if (finalRelationRead.item.revision !== revision(relationsRemoved)) {
    throw new Error("relationship removal revision was not observable");
  }

  return {
    final: {
      components: finalPage.items.map(({ component }) => projectComponentSemantics(component)),
      generation: Number(finalPage.generation),
      relationshipCount: finalRelationRead.relationships.items.length,
      revisionsPresent: finalPage.items.every((item) => item.revision.length > 0),
    },
    initialization: [initialization.status, repeatedInitialization.status],
    mutations,
    pages: {
      allHasMore: allPages.map((page) => page.hasMore),
      allIds: allPages.flatMap((page) => page.items.map((item) => item.component.id)),
      childHasMore: [childFirst.hasMore, childSecond.hasMore],
      childIds: [...childFirst.items, ...childSecond.items].map((item) => item.component.id),
      relationshipHasMore: [exactFirst.relationships.hasMore, exactSecond.relationships.hasMore],
      relationshipIds: [exactFirst, exactSecond].flatMap((item: ExactComponentRead) =>
        item.relationships.items.map((view) => view.relationship.id),
      ),
      rootHasMore: [rootFirst.hasMore, rootSecond.hasMore],
      rootIds: [...rootFirst.items, ...rootSecond.items].map((item) => item.component.id),
    },
    richRead: {
      component: projectComponentSemantics(exactFirst.item.component),
      relationships: [exactFirst, exactSecond].flatMap((entry) =>
        entry.relationships.items.map((view) => projectRelationshipSemantics(view.relationship)),
      ),
      revisionPresent: exactFirst.item.revision.length > 0,
    },
    stale: {
      ...(unchanged.item.component.intent === undefined
        ? {}
        : { unchangedIntent: unchanged.item.component.intent }),
      status: stale.status,
    },
  };
}
