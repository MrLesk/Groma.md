import { describe, expect, test } from "bun:test";

import {
  TransactionEngine,
  TRANSACTION_DIAGNOSTIC_MAX_CHARACTERS,
  type AffectedIdentityInput,
  type GraphData,
  type ProposedTransaction,
  type ResourceKey,
  type TransactionProvider,
} from "../../core/index.ts";
import {
  createStandardModelInvariant,
  STANDARD_MODEL_INVARIANT_ID,
  type StandardModelTransactionContext,
  type StandardModelTransactionMutation,
  type StandardModelTransactionState,
  type StandardModelInvariantOptions,
} from "../index.ts";

const entityId = (value: number) => `ent_${value.toString(16).padStart(32, "0")}`;
const relationId = (value: number) => `rel_${value.toString(16).padStart(32, "0")}`;

const options: StandardModelInvariantOptions = {
  maxComponentMutations: 20,
  maxComponents: 20,
  maxOwnerCharacters: 100,
  maxPinnedComponentIds: 20,
  maxRelationshipMutations: 20,
  maxRelationships: 20,
};

function component(
  id: string,
  payload: Readonly<Record<string, unknown>> = {},
  kind = "component",
) {
  return { id, kind, payload };
}

function relationship(
  id: string,
  source: string,
  target: string,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return { id, payload: {}, source, target, type: "requires", ...overrides };
}

function proposal(
  overrides: {
    readonly affected?: unknown;
    readonly context?: unknown;
    readonly mutation?: unknown;
    readonly priorState?: unknown;
  } = {},
): ProposedTransaction {
  const mutation = overrides.mutation ?? { components: [], relationships: [] };
  const mutationRecord = mutation as {
    readonly components?: readonly Record<string, unknown>[];
    readonly relationships?: readonly Record<string, unknown>[];
  };
  const inferredAffected = {
    entities: (mutationRecord.components ?? []).flatMap((entry) => {
      if (typeof entry.id === "string") return [entry.id];
      const created = entry.component as { readonly id?: unknown } | undefined;
      return typeof created?.id === "string" ? [created.id] : [];
    }),
    relations: (mutationRecord.relationships ?? []).flatMap((entry) => {
      if (typeof entry.id === "string") return [entry.id];
      const upserted = entry.relationship as { readonly id?: unknown } | undefined;
      return typeof upserted?.id === "string" ? [upserted.id] : [];
    }),
  };
  return {
    affected: overrides.affected ?? inferredAffected,
    baseGeneration: 1,
    context: overrides.context ?? {
      ownership: { owner: "curated", plane: "intent" },
      pinnedComponentIds: [],
    },
    expectedRevisions: [],
    generation: 2,
    mutation,
    priorState: overrides.priorState ?? { components: [], relationships: [] },
  } as unknown as ProposedTransaction;
}

function validate(overrides: Parameters<typeof proposal>[0] = {}) {
  return createStandardModelInvariant(options).validate(proposal(overrides));
}

describe("standard model transaction invariant", () => {
  test("is one explicit Core invariant with caller-controlled bounds", () => {
    const invariant = createStandardModelInvariant(options);
    expect(invariant.id).toBe(STANDARD_MODEL_INVARIANT_ID);
    expect(invariant.validate(proposal())).toEqual([]);
    expect(Object.isFrozen(invariant)).toBeTrue();

    expect(() => createStandardModelInvariant({ ...options, maxComponents: 0 })).toThrow(
      "maxComponents must be a positive safe integer",
    );
  });

  test("exports envelopes that are compile-time compatible with Core GraphData", () => {
    const context: StandardModelTransactionContext = {
      ownership: { owner: "curated", plane: "intent" },
      pinnedComponentIds: [],
    };
    const state: StandardModelTransactionState = { components: [], relationships: [] };
    const mutation: StandardModelTransactionMutation = { components: [], relationships: [] };
    const values: readonly GraphData[] = [context, state, mutation];
    expect(values).toHaveLength(3);
  });

  test("requires all five mutation targets in affected identities while allowing supersets", () => {
    const first = component(entityId(1));
    const second = component(entityId(2));
    const existingRelationship = relationship(relationId(1), entityId(1), entityId(2));
    const cases = [
      {
        mutation: {
          components: [{ component: { id: entityId(3) }, type: "create" }],
          relationships: [],
        },
        priorState: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: {
          components: [{ id: entityId(1), patch: { name: "Updated" }, type: "patch" }],
          relationships: [],
        },
        priorState: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: {
          components: [{ id: entityId(1), type: "remove" }],
          relationships: [{ id: relationId(1), type: "remove" }],
        },
        priorState: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(2), entityId(1), entityId(2)),
              type: "upsert",
            },
          ],
        },
        priorState: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: { components: [], relationships: [{ id: relationId(1), type: "remove" }] },
        priorState: { components: [first, second], relationships: [existingRelationship] },
      },
    ];

    for (const input of cases) {
      expect(
        validate({
          affected: { entities: [], relations: [] },
          mutation: input.mutation,
          priorState: input.priorState,
        }),
      ).toMatchObject([
        {
          code: "mutation-target-not-affected",
          details: { path: expect.stringContaining("mutation.") },
        },
      ]);
    }

    expect(
      validate({
        affected: { entities: [entityId(8)], relations: [relationId(8)] },
        mutation: { components: [], relationships: [] },
      }),
    ).toEqual([]);
  });

  test("accepts multiple roots and recursive same-type or mixed-type children", () => {
    expect(
      validate({
        mutation: {
          components: [
            { component: { id: entityId(1), name: "Shop", type: "domain" }, type: "create" },
            { component: { id: entityId(2), name: "Users", type: "domain" }, type: "create" },
            {
              component: {
                id: entityId(3),
                name: "Orders",
                parent: entityId(1),
                type: "component",
              },
              type: "create",
            },
            {
              component: {
                id: entityId(4),
                name: "Order Item",
                parent: entityId(3),
                type: "component",
              },
              type: "create",
            },
            {
              component: {
                id: entityId(5),
                name: "Adapter",
                parent: entityId(4),
                type: "adapter",
              },
              type: "create",
            },
          ],
          relationships: [],
        },
      }),
    ).toEqual([]);
  });

  test("applies the complete batch before validating atomic reparenting and removal", () => {
    const priorState = {
      components: [
        component(entityId(1), { name: "Old root", type: "domain" }),
        component(entityId(2), {
          intent: "Preserved curated meaning",
          parent: entityId(1),
          type: "component",
        }),
        component(entityId(3), { name: "New root", type: "domain" }),
      ],
      relationships: [relationship(relationId(1), entityId(2), entityId(1))],
    };
    expect(
      validate({
        priorState,
        mutation: {
          components: [
            { id: entityId(2), patch: { name: "Moved child", parent: entityId(3) }, type: "patch" },
            { id: entityId(1), type: "remove" },
          ],
          relationships: [{ id: relationId(1), type: "remove" }],
        },
      }),
    ).toEqual([]);
  });

  test("sparse patches preserve omitted containment instead of silently making roots", () => {
    const diagnostics = validate({
      priorState: {
        components: [
          component(entityId(1), { type: "domain" }),
          component(entityId(2), {
            intent: "Must survive",
            parent: entityId(1),
            type: "component",
          }),
        ],
        relationships: [],
      },
      mutation: {
        components: [
          { id: entityId(2), patch: { name: "Only this changes" }, type: "patch" },
          { id: entityId(1), type: "remove" },
        ],
        relationships: [],
      },
    });
    expect(diagnostics).toMatchObject([
      { code: "unknown-component-parent", details: { id: entityId(2), parent: entityId(1) } },
    ]);
  });

  test("permits coordinated component and relationship removal but rejects dangling final state", () => {
    const priorState = {
      components: [
        component(entityId(1), { type: "domain" }),
        component(entityId(2), { type: "service" }),
      ],
      relationships: [relationship(relationId(1), entityId(1), entityId(2))],
    };
    expect(
      validate({
        priorState,
        mutation: {
          components: [{ id: entityId(2), type: "remove" }],
          relationships: [{ id: relationId(1), type: "remove" }],
        },
      }),
    ).toEqual([]);

    expect(
      validate({
        priorState,
        mutation: {
          components: [{ id: entityId(2), type: "remove" }],
          relationships: [],
        },
      }),
    ).toMatchObject([
      {
        code: "invalid-relationship-target",
        details: { id: relationId(1), target: entityId(2) },
      },
    ]);
  });

  test("accepts ordinary relationships across root trees and validates their semantic payload", () => {
    expect(
      validate({
        priorState: {
          components: [
            component(entityId(1), { type: "domain" }),
            component(entityId(2), { type: "domain" }),
          ],
          relationships: [],
        },
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(1), entityId(1), entityId(2), {
                payload: { "acme.io/critical": true, description: "Crosses roots." },
                type: "requires.runtime",
              }),
              type: "upsert",
            },
          ],
        },
      }),
    ).toEqual([]);

    expect(
      validate({
        priorState: {
          components: [component(entityId(1)), component(entityId(2))],
          relationships: [],
        },
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(1), entityId(1), entityId(2), {
                payload: { description: 42 },
              }),
              type: "upsert",
            },
          ],
        },
      }),
    ).toMatchObject([{ code: "invalid-standard-model-field" }]);
  });

  test("rejects self-parenting, indirect cycles, and unresolved parents with stable IDs", () => {
    expect(
      validate({
        mutation: {
          components: [{ component: { id: entityId(1), parent: entityId(1) }, type: "create" }],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "self-component-parent", details: { id: entityId(1) } }]);

    expect(
      validate({
        mutation: {
          components: [
            { component: { id: entityId(1), parent: entityId(2) }, type: "create" },
            { component: { id: entityId(2), parent: entityId(3) }, type: "create" },
            { component: { id: entityId(3), parent: entityId(1) }, type: "create" },
          ],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "component-containment-cycle", details: { id: entityId(1) } }]);

    expect(
      validate({
        mutation: {
          components: [{ component: { id: entityId(1), parent: entityId(9) }, type: "create" }],
          relationships: [],
        },
      }),
    ).toMatchObject([
      {
        code: "unknown-component-parent",
        details: { id: entityId(1), parent: entityId(9) },
      },
    ]);
  });

  test("fails closed on ambiguous prior identities and duplicate mutation targets", () => {
    expect(
      validate({
        priorState: {
          components: [component(entityId(1)), component(entityId(1))],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "ambiguous-component-identity", details: { id: entityId(1) } }]);

    expect(
      validate({
        priorState: {
          components: [component(entityId(1))],
          relationships: [],
        },
        mutation: {
          components: [
            { id: entityId(1), patch: { name: "First" }, type: "patch" },
            { id: entityId(1), type: "remove" },
          ],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "ambiguous-component-mutation", details: { id: entityId(1) } }]);

    expect(
      validate({
        priorState: {
          components: [component(entityId(1))],
          relationships: [
            relationship(relationId(1), entityId(1), entityId(1)),
            relationship(relationId(1), entityId(1), entityId(1)),
          ],
        },
      }),
    ).toMatchObject([{ code: "ambiguous-relationship-identity", details: { id: relationId(1) } }]);

    expect(
      validate({
        priorState: {
          components: [component(entityId(1))],
          relationships: [relationship(relationId(1), entityId(1), entityId(1))],
        },
        mutation: {
          components: [],
          relationships: [
            { id: relationId(1), type: "remove" },
            {
              relationship: relationship(relationId(1), entityId(1), entityId(1)),
              type: "upsert",
            },
          ],
        },
      }),
    ).toMatchObject([{ code: "ambiguous-relationship-mutation", details: { id: relationId(1) } }]);
  });

  test("requires stable create/upsert identities, valid kinds, tokens, endpoints, and embedded IDs", () => {
    expect(
      validate({
        mutation: {
          components: [{ component: { name: "No ID" }, type: "create" }],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "invalid-entity-id" }]);

    expect(
      validate({
        priorState: {
          components: [component(entityId(1), {}, "scanner-observation")],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "wrong-standard-model-kind", details: { id: entityId(1) } }]);

    expect(
      validate({
        mutation: {
          components: [{ component: { id: entityId(1), type: "Not Valid" }, type: "create" }],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "invalid-standard-model-token" }]);

    expect(
      validate({
        mutation: {
          components: [
            {
              component: {
                actions: [
                  { id: "act_same", name: "First" },
                  { id: "act_same", name: "Second" },
                ],
                id: entityId(1),
              },
              type: "create",
            },
          ],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "duplicate-standard-item-id", details: { id: entityId(1) } }]);

    expect(
      validate({
        priorState: { components: [component(entityId(1))], relationships: [] },
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(1), entityId(1), entityId(9), {
                type: "Not Valid",
              }),
              type: "upsert",
            },
          ],
        },
      }),
    ).toMatchObject([{ code: "invalid-relation-type", details: { id: relationId(1) } }]);

    expect(
      validate({
        priorState: { components: [component(entityId(1))], relationships: [] },
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(1), entityId(1), entityId(9)),
              type: "upsert",
            },
          ],
        },
      }),
    ).toMatchObject([
      {
        code: "invalid-relationship-target",
        details: { id: relationId(1), target: entityId(9) },
      },
    ]);
  });

  test("validates ownership and reserved pinned-boundary context without surface semantics", () => {
    const state = {
      components: [component(entityId(1)), component(entityId(2))],
      relationships: [],
    };
    expect(
      validate({
        context: {
          ownership: { owner: "scanner:typescript", plane: "evidence" },
          pinnedComponentIds: [entityId(1), entityId(2)],
        },
        priorState: state,
      }),
    ).toEqual([]);

    expect(
      validate({
        context: {
          ownership: { owner: "curated", plane: "intent" },
          pinnedComponentIds: [entityId(1)],
        },
        mutation: {
          components: [{ id: entityId(1), type: "remove" }],
          relationships: [],
        },
        priorState: { components: [component(entityId(1))], relationships: [] },
      }),
    ).toEqual([]);

    expect(
      validate({
        context: {
          ownership: { owner: "curated", plane: "cli" },
          pinnedComponentIds: [],
        },
      }),
    ).toMatchObject([{ code: "invalid-standard-model-context" }]);

    expect(
      validate({
        context: {
          ownership: { owner: "curated", plane: "intent" },
          pinnedComponentIds: [entityId(2), entityId(1)],
        },
        priorState: state,
      }),
    ).toMatchObject([{ code: "invalid-pinned-component-identities" }]);

    expect(
      validate({
        context: {
          ownership: { owner: "curated", plane: "intent" },
          pinnedComponentIds: [entityId(9)],
        },
        priorState: state,
      }),
    ).toMatchObject([{ code: "unknown-pinned-component", details: { id: entityId(9) } }]);
  });

  test("checks array bounds before enumerating attacker-controlled entries", () => {
    let ownKeysCalled = false;
    const oversized = new Proxy(new Array(21), {
      ownKeys: () => {
        ownKeysCalled = true;
        throw new Error("must not enumerate an over-limit array");
      },
    });
    expect(
      validate({
        priorState: { components: oversized, relationships: [] },
      }),
    ).toMatchObject([{ code: "standard-model-envelope-too-large" }]);
    expect(ownKeysCalled).toBeFalse();
  });

  test("keeps direct diagnostics bounded for oversized IDs, tokens, kinds, and extension keys", () => {
    const oversized = "x".repeat(5_000);
    const oversizedInvalidToken = `${oversized} INVALID`;
    const cases = [
      {
        code: "invalid-entity-id",
        mutation: {
          components: [{ component: { id: oversized }, type: "create" }],
          relationships: [],
        },
        priorState: { components: [], relationships: [] },
      },
      {
        code: "invalid-standard-model-token",
        mutation: {
          components: [
            { component: { id: entityId(1), type: oversizedInvalidToken }, type: "create" },
          ],
          relationships: [],
        },
        priorState: { components: [], relationships: [] },
      },
      {
        code: "wrong-standard-model-kind",
        mutation: { components: [], relationships: [] },
        priorState: { components: [component(entityId(1), {}, oversized)], relationships: [] },
      },
      {
        code: "invalid-relation-type",
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(1), entityId(1), entityId(2), {
                type: oversizedInvalidToken,
              }),
              type: "upsert",
            },
          ],
        },
        priorState: {
          components: [component(entityId(1)), component(entityId(2))],
          relationships: [],
        },
      },
      {
        code: "unknown-standard-model-field",
        mutation: {
          components: [{ component: { [oversized]: true, id: entityId(1) }, type: "create" }],
          relationships: [],
        },
        priorState: { components: [], relationships: [] },
      },
    ];

    for (const input of cases) {
      const diagnostics = validate(input);
      expect(diagnostics).toMatchObject([{ code: input.code }]);
      expect(diagnostics[0]!.message.length).toBeLessThanOrEqual(
        TRANSACTION_DIAGNOSTIC_MAX_CHARACTERS,
      );
      for (const value of Object.values(diagnostics[0]!.details ?? {})) {
        if (typeof value === "string") {
          expect(value.length).toBeLessThanOrEqual(TRANSACTION_DIAGNOSTIC_MAX_CHARACTERS);
        }
      }
    }
  });

  test("does not invoke accessors and does not retain mutable mutation aliases", () => {
    let accessorCalled = false;
    const payload = Object.defineProperty({}, "name", {
      enumerable: true,
      get: () => {
        accessorCalled = true;
        return "unsafe";
      },
    });
    expect(
      validate({
        priorState: {
          components: [component(entityId(1), payload)],
          relationships: [],
        },
      }),
    ).toMatchObject([{ code: "unsupported-payload" }]);
    expect(accessorCalled).toBeFalse();

    const mutablePatch = { name: "Before" };
    const invariant = createStandardModelInvariant(options);
    const input = proposal({
      priorState: { components: [component(entityId(1))], relationships: [] },
      mutation: {
        components: [{ id: entityId(1), patch: mutablePatch, type: "patch" }],
        relationships: [],
      },
    });
    expect(invariant.validate(input)).toEqual([]);
    mutablePatch.name = "After";
    expect(invariant.validate(input)).toEqual([]);
  });

  test("selects final graph diagnostics in stable identity order", () => {
    const cycle = [
      component(entityId(1), { parent: entityId(3) }),
      component(entityId(2), { parent: entityId(1) }),
      component(entityId(3), { parent: entityId(2) }),
    ];
    const firstCycle = validate({ priorState: { components: cycle, relationships: [] } });
    const permutedCycle = validate({
      priorState: { components: [cycle[2], cycle[0], cycle[1]], relationships: [] },
    });
    expect(firstCycle).toEqual(permutedCycle);
    expect(firstCycle).toMatchObject([
      { code: "component-containment-cycle", details: { id: entityId(1) } },
    ]);

    const invalidParents = [
      component(entityId(2), { parent: entityId(8) }),
      component(entityId(1), { parent: entityId(9) }),
    ];
    const firstMissingParent = validate({
      priorState: { components: invalidParents, relationships: [] },
    });
    expect(firstMissingParent).toEqual(
      validate({
        priorState: { components: invalidParents.toReversed(), relationships: [] },
      }),
    );
    expect(firstMissingParent).toMatchObject([
      { code: "unknown-component-parent", details: { id: entityId(1) } },
    ]);

    const validComponent = component(entityId(1));
    const invalidRelationships = [
      relationship(relationId(2), entityId(1), entityId(8)),
      relationship(relationId(1), entityId(9), entityId(1)),
    ];
    const firstMissingEndpoint = validate({
      priorState: { components: [validComponent], relationships: invalidRelationships },
    });
    expect(firstMissingEndpoint).toEqual(
      validate({
        priorState: {
          components: [validComponent],
          relationships: invalidRelationships.toReversed(),
        },
      }),
    );
    expect(firstMissingEndpoint).toMatchObject([
      { code: "invalid-relationship-source", details: { id: relationId(1) } },
    ]);
  });
});

class InvariantProvider implements TransactionProvider {
  prepareCalls = 0;

  constructor(
    readonly state: unknown = {
      components: [component(entityId(1), { parent: entityId(2) }), component(entityId(2), {})],
      relationships: [],
    },
  ) {}

  snapshot(resources: readonly ResourceKey[]) {
    return {
      generation: 1,
      revisions: resources.map((resource) => ({ resource, revision: "revision-1" })),
      state: this.state,
    };
  }

  prepare() {
    this.prepareCalls += 1;
    return { status: "prepared" as const, token: "prepared" };
  }

  commit(): never {
    throw new Error("invalid transaction must not commit");
  }

  recover() {
    return { status: "not-committed" as const };
  }
}

function registeredEngine(provider: InvariantProvider): TransactionEngine {
  const engine = new TransactionEngine({
    maxAffectedIdentities: 20,
    maxRequestDataDepth: 32,
    maxRequestDataValues: 2_000,
    maxSnapshotStateDepth: 32,
    maxSnapshotStateValues: 2_000,
    provider,
  });
  const registered = engine.registerInvariant(createStandardModelInvariant(options));
  if (!registered.ok) throw new Error(registered.diagnostics[0]?.message);
  return engine;
}

function invalidCycleRequest() {
  return {
    affected: { entities: [entityId(2)] },
    context: {
      ownership: { owner: "curated", plane: "intent" },
      pinnedComponentIds: [],
    },
    expectedRevisions: [{ expected: "revision-1", resource: "components" }],
    mutation: {
      components: [{ id: entityId(2), patch: { parent: entityId(1) }, type: "patch" }],
      relationships: [],
    },
  };
}

function engineRequest(
  mutation: unknown,
  affected: AffectedIdentityInput = { entities: [], relations: [] },
) {
  return {
    affected,
    context: {
      ownership: { owner: "curated", plane: "intent" },
      pinnedComponentIds: [],
    },
    expectedRevisions: [{ expected: "revision-1", resource: "components" }],
    mutation,
  };
}

describe("shared transaction registration", () => {
  test("direct and host/CLI-style calls use the same registration and reject identically", async () => {
    const directProvider = new InvariantProvider();
    const direct = await registeredEngine(directProvider).execute(invalidCycleRequest());

    const hostProvider = new InvariantProvider();
    const host = {
      edit: (request: ReturnType<typeof invalidCycleRequest>) =>
        registeredEngine(hostProvider).execute(request),
    };
    const surfaced = await host.edit(invalidCycleRequest());

    expect(direct).toMatchObject({
      diagnostics: [{ code: "component-containment-cycle" }],
      status: "validation-rejected",
    });
    expect(surfaced).toEqual(direct);
    expect(directProvider.prepareCalls).toBe(0);
    expect(hostProvider.prepareCalls).toBe(0);
  });

  test("registered engines bind create, patch, remove, upsert, and relation removal to affected", async () => {
    const first = component(entityId(1));
    const second = component(entityId(2));
    const existingRelationship = relationship(relationId(1), entityId(1), entityId(2));
    const cases = [
      {
        mutation: {
          components: [{ component: { id: entityId(3) }, type: "create" }],
          relationships: [],
        },
        state: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: {
          components: [{ id: entityId(1), patch: { name: "Updated" }, type: "patch" }],
          relationships: [],
        },
        state: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: {
          components: [{ id: entityId(1), type: "remove" }],
          relationships: [{ id: relationId(1), type: "remove" }],
        },
        state: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(2), entityId(1), entityId(2)),
              type: "upsert",
            },
          ],
        },
        state: { components: [first, second], relationships: [existingRelationship] },
      },
      {
        mutation: { components: [], relationships: [{ id: relationId(1), type: "remove" }] },
        state: { components: [first, second], relationships: [existingRelationship] },
      },
    ];

    for (const input of cases) {
      const provider = new InvariantProvider(input.state);
      const result = await registeredEngine(provider).execute(engineRequest(input.mutation));
      expect(result).toMatchObject({
        diagnostics: [{ code: "mutation-target-not-affected" }],
        status: "validation-rejected",
      });
      expect(provider.prepareCalls).toBe(0);
    }
  });

  test("preserves actionable Standard codes for oversized invalid user values", async () => {
    const oversized = "x".repeat(5_000);
    const oversizedInvalidToken = `${oversized} INVALID`;
    const cases = [
      {
        affected: { entities: [], relations: [] },
        code: "invalid-entity-id",
        mutation: {
          components: [{ component: { id: oversized }, type: "create" }],
          relationships: [],
        },
        state: { components: [], relationships: [] },
      },
      {
        affected: { entities: [entityId(1)], relations: [] },
        code: "invalid-standard-model-token",
        mutation: {
          components: [
            { component: { id: entityId(1), type: oversizedInvalidToken }, type: "create" },
          ],
          relationships: [],
        },
        state: { components: [], relationships: [] },
      },
      {
        affected: { entities: [], relations: [] },
        code: "wrong-standard-model-kind",
        mutation: { components: [], relationships: [] },
        state: { components: [component(entityId(1), {}, oversized)], relationships: [] },
      },
      {
        affected: { entities: [], relations: [relationId(1)] },
        code: "invalid-relation-type",
        mutation: {
          components: [],
          relationships: [
            {
              relationship: relationship(relationId(1), entityId(1), entityId(2), {
                type: oversizedInvalidToken,
              }),
              type: "upsert",
            },
          ],
        },
        state: {
          components: [component(entityId(1)), component(entityId(2))],
          relationships: [],
        },
      },
      {
        affected: { entities: [entityId(1)], relations: [] },
        code: "unknown-standard-model-field",
        mutation: {
          components: [{ component: { [oversized]: true, id: entityId(1) }, type: "create" }],
          relationships: [],
        },
        state: { components: [], relationships: [] },
      },
    ];

    for (const input of cases) {
      const provider = new InvariantProvider(input.state);
      const result = await registeredEngine(provider).execute(
        engineRequest(input.mutation, input.affected),
      );
      expect(result).toMatchObject({
        diagnostics: [{ code: input.code }],
        status: "validation-rejected",
      });
      expect(result).not.toMatchObject({ diagnostics: [{ code: "invalid-invariant-result" }] });
      expect(provider.prepareCalls).toBe(0);
    }
  });
});
