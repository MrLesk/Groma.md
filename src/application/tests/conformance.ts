import type {
  ApplicationMutationOutcome,
  ApplicationOperations,
  ComponentPage,
  ExactComponentRead,
} from "../index.ts";

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

export interface ApplicationOperationsTrace {
  readonly final: {
    readonly components: readonly {
      readonly extensionKeys: readonly string[];
      readonly id: string;
      readonly intent?: string;
      readonly parent?: string;
      readonly type?: string;
    }[];
    readonly generation: number;
    readonly relationshipCount: number;
    readonly revisionsPresent: boolean;
  };
  readonly initialization: string;
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
    readonly actionIds: readonly string[];
    readonly extensionKeys: readonly string[];
    readonly inputIds: readonly string[];
    readonly intent?: string;
    readonly outputIds: readonly string[];
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
        extensionKeys: ["example.dev/owner"],
        id: conformanceIds.rootA,
        intent: "Own commerce architecture.",
        type: "domain",
      },
      { extensionKeys: [], id: conformanceIds.rootB, type: "domain" },
      {
        extensionKeys: [],
        id: conformanceIds.serviceA,
        intent: "Coordinate checkout.",
        parent: conformanceIds.rootA,
        type: "service",
      },
      {
        extensionKeys: ["example.dev/tier"],
        id: conformanceIds.serviceB,
        intent: "Provide identity services.",
        parent: conformanceIds.rootB,
        type: "service",
      },
      {
        extensionKeys: [],
        id: conformanceIds.nestedService,
        parent: conformanceIds.serviceA,
        type: "service",
      },
    ],
    generation: 10,
    relationshipCount: 0,
    revisionsPresent: true,
  },
  initialization: "initialized",
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
    actionIds: ["review"],
    extensionKeys: ["example.dev/owner"],
    inputIds: ["evidence"],
    intent: "Own commerce architecture.",
    outputIds: ["decisions"],
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

  const rootA = record(
    "create-root-a",
    await api.createComponent({
      component: {
        "example.dev/owner": "architecture",
        actions: [{ id: "review", description: "Review architecture" }],
        desired: "active",
        id: conformanceIds.rootA,
        inputs: [{ id: "evidence", name: "Evidence" }],
        intent: "Own commerce architecture.",
        lifecycle: "active",
        name: "Commerce",
        outputs: [{ id: "decisions", name: "Decisions" }],
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
        id: conformanceIds.serviceA,
        intent: "Coordinate checkout.",
        parent: conformanceIds.rootA,
        type: "service",
      },
      relationships: [
        {
          description: "Cross-branch dependency",
          id: conformanceIds.crossBranch,
          target: conformanceIds.rootB,
          type: "depends-on",
        },
        {
          "example.dev/strength": "required",
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
      components: finalPage.items.map(({ component }) => ({
        extensionKeys: Object.keys(component.extensions).sort(),
        id: component.id,
        ...(component.intent === undefined ? {} : { intent: component.intent }),
        ...(component.parent === undefined ? {} : { parent: component.parent }),
        ...(component.type === undefined ? {} : { type: component.type }),
      })),
      generation: Number(finalPage.generation),
      relationshipCount: finalRelationRead.relationships.items.length,
      revisionsPresent: finalPage.items.every((item) => item.revision.length > 0),
    },
    initialization: initialization.status,
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
      actionIds: rootA.value.actions?.map((item) => item.id) ?? [],
      extensionKeys: Object.keys(rootA.value.extensions).sort(),
      inputIds: rootA.value.inputs?.map((item) => item.id) ?? [],
      ...(rootA.value.intent === undefined ? {} : { intent: rootA.value.intent }),
      outputIds: rootA.value.outputs?.map((item) => item.id) ?? [],
      revisionPresent: revision(rootA).length > 0,
    },
    stale: {
      ...(unchanged.item.component.intent === undefined
        ? {}
        : { unchangedIntent: unchanged.item.component.intent }),
      status: stale.status,
    },
  };
}
