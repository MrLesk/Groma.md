import { describe, expect, test } from "bun:test";

import type { GraphData } from "../payload.ts";
import type { Diagnostic } from "../result.ts";
import {
  TransactionEngine,
  type ProposedTransaction,
  type ResourceKey,
  type ResourceRevisionInput,
  type TransactionCommitResultInput,
  type TransactionEngineOptions,
  type TransactionPrepareResultInput,
  type TransactionProvider,
  type TransactionProviderSnapshotInput,
  type TransactionRecoveryResultInput,
} from "../transaction.ts";

const firstEntity = "ent_00000000000000000000000000000001";
const secondEntity = "ent_00000000000000000000000000000002";
const firstRelation = "rel_00000000000000000000000000000001";

type PhaseMode = "indeterminate" | "malformed" | "not-committed" | "success" | "throw";

class FaultProvider implements TransactionProvider {
  generation = 4;
  readonly log: string[] = [];
  prepareCalls = 0;
  commitCalls = 0;
  recoverCalls = 0;
  snapshotCalls = 0;
  afterSnapshot?: () => void;
  prepareMode: PhaseMode | "generation-conflict" | "revision-conflict" = "success";
  commitMode: PhaseMode = "success";
  recoveryMode: PhaseMode = "success";
  snapshotMode: "malformed" | "success" | "throw" = "success";
  state: GraphData = { components: [{ id: firstEntity, owner: "intent" }] };
  readonly revisions = new Map<string, string | null>([
    ["components/one", "revision-1"],
    ["components/two", null],
  ]);
  staged?: ProposedTransaction;

  snapshot(resources: readonly ResourceKey[]): TransactionProviderSnapshotInput {
    this.snapshotCalls += 1;
    this.log.push("snapshot");
    if (this.snapshotMode === "throw") throw new Error("snapshot fault");
    if (this.snapshotMode === "malformed") {
      return {
        generation: "forged",
        revisions: [],
        state: {},
      } as unknown as TransactionProviderSnapshotInput;
    }
    const result = {
      generation: this.generation,
      revisions: resources.map((resource) => ({
        resource,
        revision: this.revisions.get(resource) ?? null,
      })),
      state: this.state,
    };
    this.afterSnapshot?.();
    return result;
  }

  prepare(proposal: ProposedTransaction): TransactionPrepareResultInput {
    this.prepareCalls += 1;
    this.log.push("prepare");
    if (this.prepareMode === "throw") throw new Error("prepare fault");
    if (this.prepareMode === "malformed") {
      return { status: "prepared", token: 7 } as unknown as TransactionPrepareResultInput;
    }
    if (this.prepareMode === "generation-conflict" || proposal.baseGeneration !== this.generation) {
      return { reason: "generation", status: "conflict" };
    }
    if (
      this.prepareMode === "revision-conflict" ||
      proposal.expectedRevisions.some(
        (entry) => (this.revisions.get(entry.resource) ?? null) !== entry.expected,
      )
    ) {
      return { reason: "revision", status: "conflict" };
    }
    this.staged = proposal;
    return { status: "prepared", token: "prepared-1" };
  }

  commit(token: string): TransactionCommitResultInput {
    this.commitCalls += 1;
    this.log.push("commit-start");
    if (token !== "prepared-1" || this.staged === undefined) throw new Error("unknown token");
    if (this.commitMode === "throw") throw new Error("commit fault");
    if (this.commitMode === "malformed") {
      return {
        affected: this.staged.affected,
        generation: this.staged.generation + 1,
        revisions: [],
        status: "committed",
      };
    }
    if (this.commitMode === "not-committed") return { status: "not-committed" };
    if (this.commitMode === "indeterminate") return { status: "indeterminate" };
    this.confirmStagedCommit();
    this.log.push("commit-confirmed");
    return this.committedResult();
  }

  recover(token: string): TransactionRecoveryResultInput {
    this.recoverCalls += 1;
    this.log.push("recover");
    if (token !== "prepared-1" || this.staged === undefined) throw new Error("unknown token");
    if (this.recoveryMode === "throw") throw new Error("recovery fault");
    if (this.recoveryMode === "malformed") {
      return {
        affected: this.staged.affected,
        generation: this.staged.generation + 1,
        revisions: [],
        status: "committed",
      };
    }
    if (this.recoveryMode === "not-committed") return { status: "not-committed" };
    if (this.recoveryMode === "indeterminate") return { status: "indeterminate" };
    this.confirmStagedCommit();
    return this.committedResult();
  }

  private confirmStagedCommit(): void {
    if (this.staged === undefined) throw new Error("nothing staged");
    this.generation = this.staged.generation;
    for (const expectation of this.staged.expectedRevisions) {
      this.revisions.set(expectation.resource, `revision-${this.generation}`);
    }
  }

  private committedResult(): TransactionCommitResultInput {
    if (this.staged === undefined) throw new Error("nothing staged");
    const revisions: ResourceRevisionInput[] = this.staged.expectedRevisions.map((entry) => ({
      resource: entry.resource,
      revision: this.revisions.get(entry.resource) ?? null,
    }));
    return {
      affected: this.staged.affected,
      generation: this.generation,
      revisions,
      status: "committed",
    };
  }
}

function createEngine(
  provider: TransactionProvider,
  overrides: Partial<Omit<TransactionEngineOptions, "provider">> = {},
): TransactionEngine {
  return new TransactionEngine({
    maxAffectedIdentities: 100,
    maxRequestDataDepth: 32,
    maxRequestDataValues: 10_000,
    maxSnapshotStateDepth: 64,
    maxSnapshotStateValues: 100_000,
    provider,
    ...overrides,
  });
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    affected: {
      entities: [secondEntity, firstEntity, firstEntity],
      relations: [firstRelation],
    },
    context: { ownership: "intent", surface: "shared-operation" },
    expectedRevisions: [
      { expected: null, resource: "components/two" },
      { expected: "revision-1", resource: "components/one" },
    ],
    mutation: { operations: [{ component: secondEntity, type: "create" }] },
    ...overrides,
  };
}

function diagnostic(code: string, message = code): Diagnostic {
  return { code, message };
}

function malformedConfirmedResults(): readonly unknown[] {
  const fields = {
    affected: { entities: [firstEntity, secondEntity], relations: [firstRelation] },
    generation: 5,
    revisions: [
      { resource: "components/one", revision: "revision-5" },
      { resource: "components/two", revision: "revision-5" },
    ],
  };
  return [
    { ...fields, status: "not-committed" },
    { ...fields, status: "indeterminate" },
    { status: "committed" },
    { ...fields, extra: true, status: "committed" },
  ];
}

describe("transaction engine", () => {
  test("rejects stale expected content revisions without preparing or writing", async () => {
    const provider = new FaultProvider();
    const engine = createEngine(provider);
    const result = await engine.execute(
      request({
        expectedRevisions: [{ expected: "stale", resource: "components/one" }],
      }),
    );

    expect(result).toMatchObject({
      diagnostics: [{ code: "content-revision-conflict" }],
      status: "conflict",
    });
    expect(provider.prepareCalls).toBe(0);
    expect(provider.commitCalls).toBe(0);
    expect(provider.generation).toBe(4);
  });

  test("supports expected absence and returns resulting revisions", async () => {
    const provider = new FaultProvider();
    const result = await createEngine(provider).execute(request());

    expect(result).toMatchObject({
      generation: 5,
      revisions: [
        { resource: "components/one", revision: "revision-5" },
        { resource: "components/two", revision: "revision-5" },
      ],
      status: "committed",
    });
  });

  test("runs every invariant in registration order against one complete immutable proposal", async () => {
    const provider = new FaultProvider();
    const engine = createEngine(provider);
    const calls: string[] = [];
    const proposals: ProposedTransaction[] = [];
    const first = engine.registerInvariant({
      id: "standard.parent",
      validate: (proposal: ProposedTransaction) => {
        calls.push("parent");
        proposals.push(proposal);
        expect(proposal).toMatchObject({
          baseGeneration: 4,
          context: { ownership: "intent", surface: "shared-operation" },
          expectedRevisions: [
            { expected: "revision-1", resource: "components/one" },
            { expected: null, resource: "components/two" },
          ],
          generation: 5,
          mutation: { operations: [{ component: secondEntity, type: "create" }] },
          priorState: { components: [{ id: firstEntity, owner: "intent" }] },
        });
        expect(Object.isFrozen(proposal)).toBeTrue();
        expect(Object.isFrozen(proposal.mutation)).toBeTrue();
        expect(Object.isFrozen(proposal.priorState)).toBeTrue();
        return [diagnostic("invalid-parent", "Parent is invalid")];
      },
    });
    const second = engine.registerInvariant({
      id: "standard.relations",
      validate: (proposal: ProposedTransaction) => {
        calls.push("relations");
        proposals.push(proposal);
        return [diagnostic("invalid-relation", "Relation is invalid")];
      },
    });
    expect(first.ok && second.ok).toBeTrue();

    const result = await engine.execute(request());

    expect(calls).toEqual(["parent", "relations"]);
    expect(proposals[0]).toBe(proposals[1]);
    expect(result).toMatchObject({
      diagnostics: [{ code: "invalid-parent" }, { code: "invalid-relation" }],
      status: "validation-rejected",
    });
    expect(provider.prepareCalls).toBe(0);
  });

  test("continues invariant aggregation when an invariant throws or forges diagnostics", async () => {
    const provider = new FaultProvider();
    const engine = createEngine(provider);
    const calls: string[] = [];
    let nestedOwnKeysCalled = false;
    const nestedDetail = new Proxy(
      {},
      {
        ownKeys: (target) => {
          nestedOwnKeysCalled = true;
          return Reflect.ownKeys(target);
        },
      },
    );
    engine.registerInvariant({
      id: "throws",
      validate: () => {
        calls.push("throws");
        throw new Error("plugin detail must not escape");
      },
    });
    engine.registerInvariant({
      id: "forges",
      validate: () => {
        calls.push("forges");
        return [{ code: "bad", message: "bad", details: { nested: nestedDetail } }];
      },
    } as unknown as Parameters<TransactionEngine["registerInvariant"]>[0]);
    engine.registerInvariant({
      id: "last",
      validate: () => {
        calls.push("last");
        return [diagnostic("last-diagnostic")];
      },
    });

    const result = await engine.execute(request());
    expect(calls).toEqual(["throws", "forges", "last"]);
    expect(nestedOwnKeysCalled).toBeFalse();
    expect(result).toMatchObject({
      diagnostics: [
        { code: "invariant-threw" },
        { code: "invalid-invariant-result" },
        { code: "last-diagnostic" },
      ],
      status: "validation-rejected",
    });
  });

  test("atomically catches a concurrent generation or revision race during prepare", async () => {
    for (const mode of ["generation", "revision"] as const) {
      const provider = new FaultProvider();
      provider.afterSnapshot = () => {
        if (mode === "generation") provider.generation += 1;
        else provider.revisions.set("components/one", "concurrent-revision");
      };
      const result = await createEngine(provider).execute(request());
      expect(result).toMatchObject({
        diagnostics: [
          {
            code:
              mode === "generation"
                ? "concurrent-generation-conflict"
                : "content-revision-conflict",
          },
        ],
        status: "conflict",
      });
      expect(provider.prepareCalls).toBe(1);
      expect(provider.commitCalls).toBe(0);
      expect(provider.generation).toBe(mode === "generation" ? 5 : 4);
    }
  });

  test("advances exactly one generation and returns one canonical event only after confirmation", async () => {
    const provider = new FaultProvider();
    const result = await createEngine(provider).execute(request());
    provider.log.push("event-observed");

    expect(provider.generation).toBe(5);
    expect(provider.log).toEqual([
      "snapshot",
      "prepare",
      "commit-start",
      "commit-confirmed",
      "event-observed",
    ]);
    expect(result as unknown).toEqual({
      event: {
        affected: {
          entities: [firstEntity, secondEntity],
          relations: [firstRelation],
        },
        generation: 5,
        type: "graph.committed",
      },
      generation: 5,
      revisions: [
        { resource: "components/one", revision: "revision-5" },
        { resource: "components/two", revision: "revision-5" },
      ],
      status: "committed",
    });
    expect(Object.isFrozen(result)).toBeTrue();
    if (result.status === "committed") {
      expect(Object.isFrozen(result.event)).toBeTrue();
      expect(Object.isFrozen(result.revisions)).toBeTrue();
    }
  });

  test("reports known commit rejection as provider failure without success", async () => {
    const provider = new FaultProvider();
    provider.commitMode = "not-committed";
    const result = await createEngine(provider).execute(request());

    expect(result).toMatchObject({
      committed: false,
      diagnostics: [{ code: "provider-commit-not-committed" }],
      phase: "commit",
      status: "provider-failure",
    });
    expect(result).not.toHaveProperty("event");
    expect(provider.generation).toBe(4);
  });

  test("never assumes rollback after a thrown, explicit, or malformed commit result", async () => {
    for (const mode of ["throw", "indeterminate", "malformed"] as const) {
      const provider = new FaultProvider();
      provider.commitMode = mode;
      const result = await createEngine(provider).execute(request());
      expect(result).toMatchObject({
        recovery: { baseGeneration: 4, generation: 5, token: "prepared-1" },
        status: "indeterminate",
      });
      expect(result).not.toHaveProperty("event");
    }
  });

  test("recovery resolves committed, not committed, or still indeterminate explicitly", async () => {
    for (const mode of [
      "success",
      "not-committed",
      "indeterminate",
      "throw",
      "malformed",
    ] as const) {
      const provider = new FaultProvider();
      provider.commitMode = "indeterminate";
      const engine = createEngine(provider);
      const uncertain = await engine.execute(request());
      if (uncertain.status !== "indeterminate") throw new Error("expected recovery handle");
      provider.recoveryMode = mode;

      const recovered = await engine.recover(uncertain.recovery);

      if (mode === "success") {
        expect(recovered).toMatchObject({ event: { generation: 5 }, status: "committed" });
      } else if (mode === "not-committed") {
        expect(recovered).toMatchObject({
          committed: false,
          phase: "recovery",
          status: "provider-failure",
        });
      } else {
        expect(recovered).toMatchObject({ recovery: uncertain.recovery, status: "indeterminate" });
      }
    }
  });

  test("maps snapshot and prepare faults to known provider failures", async () => {
    for (const [phase, mode] of [
      ["snapshot", "throw"],
      ["snapshot", "malformed"],
      ["prepare", "throw"],
      ["prepare", "malformed"],
    ] as const) {
      const provider = new FaultProvider();
      if (phase === "snapshot") provider.snapshotMode = mode;
      else provider.prepareMode = mode;
      const result = await createEngine(provider).execute(request());
      expect(result).toMatchObject({ committed: false, phase, status: "provider-failure" });
      expect(result).not.toHaveProperty("event");
      expect(provider.commitCalls).toBe(0);
    }
  });

  test("rejects malformed requests, duplicate expectations, and invalid invariants deterministically", async () => {
    const provider = new FaultProvider();
    const engine = createEngine(provider);
    expect(engine.registerInvariant({ id: "same", validate: () => [] }).ok).toBeTrue();
    expect(engine.registerInvariant({ id: "same", validate: () => [] })).toMatchObject({
      diagnostics: [{ code: "duplicate-invariant-id" }],
      ok: false,
    });
    expect(
      engine.registerInvariant({
        id: "missing-callable",
        validate: 1,
      } as unknown as Parameters<TransactionEngine["registerInvariant"]>[0]),
    ).toMatchObject({
      diagnostics: [{ code: "invalid-transaction-invariant" }],
      ok: false,
    });

    const duplicate = await engine.execute(
      request({
        expectedRevisions: [
          { expected: "revision-1", resource: "components/one" },
          { expected: "revision-1", resource: "components/one" },
        ],
      }),
    );
    expect(duplicate).toMatchObject({
      diagnostics: [{ code: "duplicate-revision-expectation" }],
      status: "validation-rejected",
    });
    const malformed = await engine.execute({
      ...request(),
      extra: true,
    } as unknown as ReturnType<typeof request>);
    expect(malformed).toMatchObject({
      diagnostics: [{ code: "invalid-transaction-request" }],
      status: "validation-rejected",
    });
    expect(provider.snapshotCalls).toBe(0);
  });

  test("does not invoke accessors in transaction inputs or retain caller-owned aliases", async () => {
    const provider = new FaultProvider();
    const engine = createEngine(provider);
    let getterCalled = false;
    const accessorRequest = request() as Record<string, unknown>;
    Object.defineProperty(accessorRequest, "mutation", {
      enumerable: true,
      get: () => {
        getterCalled = true;
        return {};
      },
    });
    const invalid = await engine.execute(accessorRequest as unknown as ReturnType<typeof request>);
    expect(invalid).toMatchObject({ status: "validation-rejected" });
    expect(getterCalled).toBeFalse();

    const mutation = { operations: [{ label: "original" }] };
    const context = { ownership: { plane: "intent" } };
    provider.state = { nested: { label: "prior" } };
    let proposal: ProposedTransaction | undefined;
    engine.registerInvariant({
      id: "capture",
      validate: (value: ProposedTransaction) => {
        proposal = value;
        return [];
      },
    });
    const pending = engine.execute(request({ context, mutation }));
    mutation.operations[0]!.label = "caller mutation";
    context.ownership.plane = "caller mutation";
    const committed = await pending;
    (provider.state as { nested: { label: string } }).nested.label = "caller mutation";
    expect(committed.status).toBe("committed");
    expect(proposal).toMatchObject({
      context: { ownership: { plane: "intent" } },
      mutation: { operations: [{ label: "original" }] },
      priorState: { nested: { label: "prior" } },
    });
  });

  test("rejects forged provider snapshots and commit revisions without leaking exceptions", async () => {
    const provider = new FaultProvider();
    const originalSnapshot = provider.snapshot;
    provider.snapshot = (() => ({
      generation: 4,
      revisions: [{ resource: "unexpected", revision: "revision-1" }],
      state: {},
    })) as typeof provider.snapshot;
    expect(await createEngine(provider).execute(request())).toMatchObject({
      phase: "snapshot",
      status: "provider-failure",
    });

    provider.snapshot = originalSnapshot.bind(provider);
    provider.commit = (() => ({
      affected: { entities: [firstEntity], relations: [] },
      generation: 5,
      revisions: [{ resource: "unexpected", revision: "revision-5" }],
      status: "committed",
    })) as typeof provider.commit;
    expect(await createEngine(provider).execute(request())).toMatchObject({
      status: "indeterminate",
    });
  });

  test("does not invoke accessors in provider responses", async () => {
    const provider = new FaultProvider();
    let snapshotGetterCalled = false;
    provider.snapshot = (() => {
      const response = { generation: 4, revisions: [], state: {} } as Record<string, unknown>;
      Object.defineProperty(response, "state", {
        enumerable: true,
        get: () => {
          snapshotGetterCalled = true;
          return {};
        },
      });
      return response as unknown as TransactionProviderSnapshotInput;
    }) as typeof provider.snapshot;
    expect(await createEngine(provider).execute(request())).toMatchObject({
      phase: "snapshot",
      status: "provider-failure",
    });
    expect(snapshotGetterCalled).toBeFalse();

    const commitProvider = new FaultProvider();
    let commitGetterCalled = false;
    commitProvider.commit = (() => {
      const response = {
        affected: { entities: [firstEntity, secondEntity], relations: [firstRelation] },
        generation: 5,
        revisions: [],
        status: "committed",
      } as Record<string, unknown>;
      Object.defineProperty(response, "affected", {
        enumerable: true,
        get: () => {
          commitGetterCalled = true;
          return {};
        },
      });
      return response as unknown as TransactionCommitResultInput;
    }) as typeof commitProvider.commit;
    expect(await createEngine(commitProvider).execute(request())).toMatchObject({
      status: "indeterminate",
    });
    expect(commitGetterCalled).toBeFalse();
  });

  test("derives recovered event identities from durable provider evidence, not the caller envelope", async () => {
    const provider = new FaultProvider();
    provider.commitMode = "indeterminate";
    const engine = createEngine(provider);
    const uncertain = await engine.execute(request());
    if (uncertain.status !== "indeterminate") throw new Error("expected recovery handle");

    const forged = {
      ...uncertain.recovery,
      affected: { entities: ["ent_ffffffffffffffffffffffffffffffff"], relations: [] },
    };
    expect(await engine.recover(forged)).toMatchObject({
      diagnostics: [{ code: "invalid-transaction-recovery" }],
      status: "validation-rejected",
    });

    const recovered = await engine.recover(uncertain.recovery);
    expect(recovered).toMatchObject({
      event: {
        affected: {
          entities: [firstEntity, secondEntity],
          relations: [firstRelation],
        },
      },
      status: "committed",
    });
  });

  test("classifies repeated recovery idempotently with the same single-event outcome", async () => {
    const provider = new FaultProvider();
    provider.commitMode = "indeterminate";
    const engine = createEngine(provider);
    const uncertain = await engine.execute(request());
    if (uncertain.status !== "indeterminate") throw new Error("expected recovery handle");

    const first = await engine.recover(uncertain.recovery);
    const second = await engine.recover(uncertain.recovery);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ event: { type: "graph.committed" }, status: "committed" });
  });

  test("binds commit result fields exactly to the committed status", async () => {
    for (const malformed of malformedConfirmedResults()) {
      const provider = new FaultProvider();
      provider.commit = (() => malformed) as typeof provider.commit;

      const result = await createEngine(provider).execute(request());

      expect(result).toMatchObject({
        diagnostics: [{ code: "invalid-provider-commit-result" }],
        status: "indeterminate",
      });
      expect(result).not.toHaveProperty("committed", false);
    }
  });

  test("binds recovery result fields exactly to the committed status", async () => {
    for (const malformed of malformedConfirmedResults()) {
      const provider = new FaultProvider();
      provider.commitMode = "indeterminate";
      const engine = createEngine(provider);
      const uncertain = await engine.execute(request());
      if (uncertain.status !== "indeterminate") throw new Error("expected recovery handle");
      provider.recover = (() => malformed) as typeof provider.recover;

      const result = await engine.recover(uncertain.recovery);

      expect(result).toMatchObject({
        diagnostics: [{ code: "invalid-provider-recovery-result" }],
        status: "indeterminate",
      });
      expect(result).not.toHaveProperty("committed", false);
    }
  });

  test("validates every structural budget constructor option", () => {
    const provider = new FaultProvider();
    const valid: TransactionEngineOptions = {
      maxAffectedIdentities: 1,
      maxRequestDataDepth: 1,
      maxRequestDataValues: 1,
      maxSnapshotStateDepth: 1,
      maxSnapshotStateValues: 1,
      provider,
    };
    expect(() => new TransactionEngine(valid)).not.toThrow();
    for (const option of [
      "maxAffectedIdentities",
      "maxRequestDataDepth",
      "maxRequestDataValues",
      "maxSnapshotStateDepth",
      "maxSnapshotStateValues",
    ] as const) {
      for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        expect(() => new TransactionEngine({ ...valid, [option]: invalid })).toThrow(RangeError);
      }
    }
  });

  test("bounds total affected identities before enumerating over-limit arrays", async () => {
    const affected = {
      entities: [firstEntity, secondEntity],
      relations: [firstRelation],
    };
    expect(
      await createEngine(new FaultProvider(), { maxAffectedIdentities: 3 }).execute(
        request({ affected }),
      ),
    ).toMatchObject({ status: "committed" });
    const overLimitProvider = new FaultProvider();
    expect(
      await createEngine(overLimitProvider, { maxAffectedIdentities: 2 }).execute(
        request({ affected }),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "invalid-transaction-affected-identities" }],
      status: "validation-rejected",
    });
    expect(overLimitProvider.snapshotCalls).toBe(0);

    let ownKeysCalled = false;
    const overLimitEntities = new Proxy([firstEntity, secondEntity, firstEntity, secondEntity], {
      ownKeys: (target) => {
        ownKeysCalled = true;
        return Reflect.ownKeys(target);
      },
    });
    expect(
      await createEngine(new FaultProvider(), { maxAffectedIdentities: 3 }).execute(
        request({ affected: { entities: overLimitEntities } }),
      ),
    ).toMatchObject({ status: "validation-rejected" });
    expect(ownKeysCalled).toBeFalse();
  });

  test("preflights provider-confirmed affected identities before key enumeration", async () => {
    const provider = new FaultProvider();
    let ownKeysCalled = false;
    const overLimitEntities = new Proxy([firstEntity, secondEntity, firstEntity, secondEntity], {
      ownKeys: (target) => {
        ownKeysCalled = true;
        return Reflect.ownKeys(target);
      },
    });
    provider.commit = (() => ({
      affected: { entities: overLimitEntities },
      generation: 5,
      revisions: [
        { resource: "components/one", revision: "revision-5" },
        { resource: "components/two", revision: "revision-5" },
      ],
      status: "committed",
    })) as typeof provider.commit;

    const result = await createEngine(provider, { maxAffectedIdentities: 3 }).execute(
      request({
        affected: { entities: [firstEntity, secondEntity], relations: [firstRelation] },
      }),
    );

    expect(result).toMatchObject({ status: "indeterminate" });
    expect(ownKeysCalled).toBeFalse();
  });

  test("shares exact value and depth budgets across request context and mutation", async () => {
    const bounded = request({ context: { a: 1 }, mutation: { b: [true] } });
    expect(
      await createEngine(new FaultProvider(), { maxRequestDataValues: 5 }).execute(bounded),
    ).toMatchObject({ status: "committed" });
    const overLimit = new FaultProvider();
    expect(
      await createEngine(overLimit, { maxRequestDataValues: 4 }).execute(bounded),
    ).toMatchObject({
      diagnostics: [{ code: "transaction-request-too-large" }],
      status: "validation-rejected",
    });
    expect(overLimit.snapshotCalls).toBe(0);

    const deep = request({ context: null, mutation: { a: { b: 1 } } });
    expect(
      await createEngine(new FaultProvider(), { maxRequestDataDepth: 3 }).execute(deep),
    ).toMatchObject({ status: "committed" });
    expect(
      await createEngine(new FaultProvider(), { maxRequestDataDepth: 2 }).execute(deep),
    ).toMatchObject({
      diagnostics: [{ code: "transaction-request-too-large" }],
      status: "validation-rejected",
    });

    let ownKeysCalled = false;
    const overLimitArray = new Proxy([1, 2, 3, 4, 5], {
      ownKeys: (target) => {
        ownKeysCalled = true;
        return Reflect.ownKeys(target);
      },
    });
    expect(
      await createEngine(new FaultProvider(), { maxRequestDataValues: 4 }).execute(
        request({ context: null, mutation: overLimitArray }),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "transaction-request-too-large" }],
      status: "validation-rejected",
    });
    expect(ownKeysCalled).toBeFalse();
  });

  test("counts every shared-DAG request occurrence and freezes feasible copies", async () => {
    const shared = { value: 1 };
    const context = { left: shared, right: shared };
    let proposal: ProposedTransaction | undefined;
    const provider = new FaultProvider();
    const exact = createEngine(provider, { maxRequestDataValues: 6 });
    exact.registerInvariant({
      id: "capture-request-budget",
      validate: (value) => {
        proposal = value;
        return [];
      },
    });
    expect(await exact.execute(request({ context, mutation: null }))).toMatchObject({
      status: "committed",
    });
    const copied = proposal?.context as
      | { readonly left: { readonly value: number }; readonly right: { readonly value: number } }
      | undefined;
    expect(copied).toEqual({ left: { value: 1 }, right: { value: 1 } });
    expect(copied?.left).not.toBe(copied?.right);
    expect(Object.isFrozen(copied)).toBeTrue();
    expect(Object.isFrozen(copied?.left)).toBeTrue();

    expect(
      await createEngine(new FaultProvider(), { maxRequestDataValues: 5 }).execute(
        request({ context, mutation: null }),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "transaction-request-too-large" }],
      status: "validation-rejected",
    });
  });

  test("applies exact value and depth budgets independently to snapshot state", async () => {
    const exactValues = new FaultProvider();
    exactValues.state = { a: 1 };
    expect(
      await createEngine(exactValues, { maxSnapshotStateValues: 2 }).execute(request()),
    ).toMatchObject({ status: "committed" });
    const overValues = new FaultProvider();
    overValues.state = { a: 1 };
    expect(
      await createEngine(overValues, { maxSnapshotStateValues: 1 }).execute(request()),
    ).toMatchObject({
      diagnostics: [{ code: "transaction-snapshot-state-too-large" }],
      phase: "snapshot",
      status: "provider-failure",
    });

    const exactDepth = new FaultProvider();
    exactDepth.state = { a: { b: 1 } };
    expect(
      await createEngine(exactDepth, { maxSnapshotStateDepth: 3 }).execute(request()),
    ).toMatchObject({ status: "committed" });
    const overDepth = new FaultProvider();
    overDepth.state = { a: { b: 1 } };
    expect(
      await createEngine(overDepth, { maxSnapshotStateDepth: 2 }).execute(request()),
    ).toMatchObject({
      diagnostics: [{ code: "transaction-snapshot-state-too-large" }],
      phase: "snapshot",
      status: "provider-failure",
    });
  });

  test("counts every shared-DAG snapshot occurrence and freezes feasible copies", async () => {
    const shared = { value: 1 };
    let proposal: ProposedTransaction | undefined;
    const provider = new FaultProvider();
    provider.state = { left: shared, right: shared };
    const exact = createEngine(provider, { maxSnapshotStateValues: 5 });
    exact.registerInvariant({
      id: "capture-snapshot-budget",
      validate: (value) => {
        proposal = value;
        return [];
      },
    });
    expect(await exact.execute(request())).toMatchObject({ status: "committed" });
    const copied = proposal?.priorState as
      | { readonly left: { readonly value: number }; readonly right: { readonly value: number } }
      | undefined;
    expect(copied?.left).not.toBe(copied?.right);
    expect(Object.isFrozen(copied)).toBeTrue();
    expect(Object.isFrozen(copied?.right)).toBeTrue();

    const overLimit = new FaultProvider();
    overLimit.state = { left: shared, right: shared };
    expect(
      await createEngine(overLimit, { maxSnapshotStateValues: 4 }).execute(request()),
    ).toMatchObject({
      diagnostics: [{ code: "transaction-snapshot-state-too-large" }],
      phase: "snapshot",
      status: "provider-failure",
    });
  });
});
