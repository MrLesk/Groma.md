import { describe, expect, test } from "bun:test";

import {
  createObservationSession,
  observationSessionApiVersion,
  type ObservationCoverage,
  type ObservationProvenance,
  type ObservationRecord,
  type ObservationSession,
  type ObservationSessionBegin,
  type Result,
} from "../index.ts";

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return result.value;
}

function begin(scopes: readonly string[] = ["app"]): ObservationSessionBegin {
  return {
    apiVersion: observationSessionApiVersion,
    epoch: "epoch-001",
    projectId: "project.local",
    scopes: scopes.map((id) => ({ id, resourceRoot: id === "app" ? "src" : "packages/shared" })),
    source: { id: "example.typescript", instance: "workspace", version: "1.2.3" },
  };
}

function provenance(scope = "app", resource = "src/index.ts"): readonly ObservationProvenance[] {
  return [
    {
      fingerprint: "sha256:aaaaaaaaaaaaaaaa",
      range: { endByteExclusive: 20, startByte: 4 },
      resource,
      scope,
    },
  ];
}

function candidate(key: string, scope = "app", name = key): ObservationRecord {
  return {
    candidate: { name, type: "service" },
    key,
    kind: "component-candidate",
    provenance: provenance(scope, scope === "app" ? "src/index.ts" : "packages/shared/index.ts"),
    scope,
  };
}

function coverage(scopes: readonly string[] = ["app"]): readonly ObservationCoverage[] {
  return scopes.map((scope) => ({
    kinds: ["component-candidate", "input", "output", "action", "relationship", "documentation"],
    scope,
    state: "partial",
  }));
}

function session(scopes?: readonly string[]): ObservationSession {
  return valueOf(createObservationSession(begin(scopes)));
}

function codes(result: Result<unknown>): readonly string[] {
  return result.ok ? [] : result.diagnostics.map((item) => item.code);
}

describe("finite observation sessions", () => {
  test("binds an immutable versioned project, source, epoch, and sorted declared scopes", () => {
    const request = begin(["shared", "app"]);
    const created = valueOf(createObservationSession(request));
    (request.scopes[0] as { id: string }).id = "mutated";
    (request.source as { id: string }).id = "mutated";

    expect(created.inspect()).toEqual({
      apiVersion: observationSessionApiVersion,
      batchCount: 0,
      canonicalCharacters: 0,
      epoch: "epoch-001",
      lastHeartbeatSequence: 0,
      lastSequence: 0,
      projectId: "project.local",
      recordCount: 0,
      scopes: [
        { id: "app", resourceRoot: "src" },
        { id: "shared", resourceRoot: "packages/shared" },
      ],
      signalCount: 0,
      source: { id: "example.typescript", instance: "workspace", version: "1.2.3" },
      state: "active",
    });
    expect(Object.isFrozen(created.inspect())).toBeTrue();
    expect(Object.isFrozen(created.inspect().scopes)).toBeTrue();
    expect(codes(created.snapshot())).toEqual(["observation-session-incomplete"]);
  });

  test("rejects unsupported versions and malformed or duplicate declarations", () => {
    expect(
      codes(createObservationSession({ ...begin(), apiVersion: "groma.observation/v2" } as never)),
    ).toEqual(["invalid-observation-begin"]);
    expect(codes(createObservationSession({ ...begin(), scopes: [] }))).toEqual([
      "invalid-observation-begin",
    ]);
    expect(
      codes(
        createObservationSession({ ...begin(), scopes: [...begin().scopes, ...begin().scopes] }),
      ),
    ).toEqual(["invalid-observation-begin"]);
  });

  test("accepts sparse partial evidence, forward references, and every observation kind", () => {
    const observed = session(["app", "shared"]);
    const records: ObservationRecord[] = [
      {
        component: { key: "api", scope: "app" },
        key: "api.input.request",
        kind: "input",
        name: "request",
        provenance: provenance(),
        scope: "app",
      },
      {
        component: { key: "api", scope: "app" },
        description: "Emitted after validation",
        key: "api.output.accepted",
        kind: "output",
        name: "accepted",
        provenance: provenance(),
        scope: "app",
      },
      {
        component: { key: "api", scope: "app" },
        key: "api.action.validate",
        kind: "action",
        name: "validate",
        provenance: provenance(),
        scope: "app",
      },
      {
        from: { key: "api", scope: "app" },
        key: "api.depends.shared",
        kind: "relationship",
        provenance: provenance(),
        relationshipType: "depends-on",
        scope: "app",
        to: { key: "library", scope: "shared" },
      },
      {
        content: "# API\nRaw source documentation.",
        format: "markdown",
        key: "api.docs",
        kind: "documentation",
        provenance: provenance(),
        scope: "app",
        subject: { key: "api", scope: "app" },
      },
      candidate("api"),
      candidate("library", "shared"),
    ];

    expect(observed.submitBatch({ epoch: "epoch-001", records, sequence: 1 })).toEqual({
      ok: true,
      value: { acceptedRecords: 7, replayedRecords: 0, sequence: 1, totalRecords: 7 },
    });
    const snapshot = valueOf(
      observed.complete({ coverage: coverage(["app", "shared"]), epoch: "epoch-001", sequence: 2 }),
    );
    expect(snapshot.records.map((record) => `${record.scope}:${record.key}`)).toEqual([
      "app:api",
      "app:api.action.validate",
      "app:api.depends.shared",
      "app:api.docs",
      "app:api.input.request",
      "app:api.output.accepted",
      "shared:library",
    ]);
    expect(snapshot.coverage.map((item) => item.scope)).toEqual(["app", "shared"]);
    expect(Object.isFrozen(snapshot)).toBeTrue();
    expect(Object.isFrozen(snapshot.records)).toBeTrue();
    expect(Object.isFrozen(snapshot.records[0])).toBeTrue();
    expect(observed.snapshot()).toEqual({ ok: true, value: snapshot });
  });

  test("accepts existence-only candidates and description-only component members", () => {
    const observed = session();
    const records: ObservationRecord[] = [
      {
        candidate: {},
        key: "unnamed",
        kind: "component-candidate",
        provenance: provenance(),
        scope: "app",
      },
      {
        component: { key: "unnamed", scope: "app" },
        description: "An observed route without a defensible display name",
        key: "unnamed.action",
        kind: "action",
        provenance: provenance(),
        scope: "app",
      },
    ];
    expect(observed.submitBatch({ epoch: "epoch-001", records, sequence: 1 })).toMatchObject({
      ok: true,
      value: { acceptedRecords: 2 },
    });
  });

  test("scopes observation identity to source and scope instead of canonical graph IDs", () => {
    const observed = session(["app", "shared"]);
    expect(
      observed.submitBatch({
        epoch: "epoch-001",
        records: [candidate("same", "app", "App"), candidate("same", "shared", "Shared")],
        sequence: 1,
      }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 2 } });

    for (const invalid of [
      "ent_0123456789abcdef0123456789abcdef",
      "rel_0123456789abcdef0123456789abcdef",
      "contains spaces",
    ]) {
      const isolated = session();
      expect(
        codes(
          isolated.submitBatch({
            epoch: "epoch-001",
            records: [candidate(invalid)],
            sequence: 1,
          }),
        ),
      ).toEqual(["invalid-observation-key"]);
    }
  });

  test("treats exact replay as idempotent and incompatible reuse as an atomic contradiction", () => {
    const observed = session();
    const original = candidate("api");
    expect(
      observed.submitBatch({ epoch: "epoch-001", records: [original], sequence: 1 }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 1, replayedRecords: 0 } });
    expect(
      observed.submitBatch({ epoch: "epoch-001", records: [original], sequence: 2 }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 0, replayedRecords: 1 } });

    const conflict = observed.submitBatch({
      epoch: "epoch-001",
      records: [candidate("new"), candidate("api", "app", "Different")],
      sequence: 3,
    });
    expect(codes(conflict)).toEqual(["contradictory-observation"]);
    expect(observed.inspect()).toMatchObject({ batchCount: 2, lastSequence: 2, recordCount: 1 });

    const withinBatch = session();
    expect(
      codes(
        withinBatch.submitBatch({
          epoch: "epoch-001",
          records: [candidate("api"), candidate("api", "app", "Different")],
          sequence: 1,
        }),
      ),
    ).toEqual(["contradictory-observation"]);
    expect(withinBatch.inspect()).toMatchObject({ batchCount: 0, lastSequence: 0, recordCount: 0 });
  });

  test("fails undeclared scopes and incoherent or malformed provenance", () => {
    const undeclared = session();
    expect(
      codes(
        undeclared.submitBatch({
          epoch: "epoch-001",
          records: [candidate("api", "other")],
          sequence: 1,
        }),
      ),
    ).toEqual(["undeclared-observation-scope"]);

    const wrongProvenance = candidate("api") as Extract<
      ObservationRecord,
      { kind: "component-candidate" }
    >;
    expect(
      codes(
        session(["app", "shared"]).submitBatch({
          epoch: "epoch-001",
          records: [{ ...wrongProvenance, provenance: provenance("shared") }],
          sequence: 1,
        }),
      ),
    ).toEqual(["invalid-observation-provenance"]);
    expect(
      codes(
        session().submitBatch({
          epoch: "epoch-001",
          records: [{ ...wrongProvenance, provenance: [] }],
          sequence: 1,
        }),
      ),
    ).toEqual(["invalid-observation-provenance"]);
    expect(
      codes(
        session().submitBatch({
          epoch: "epoch-001",
          records: [
            {
              ...wrongProvenance,
              provenance: provenance("app", "groma/intent.md"),
            },
          ],
          sequence: 1,
        }),
      ),
    ).toEqual(["invalid-observation-provenance"]);
    for (const invalidProvenance of [
      [{ ...provenance()[0]!, fingerprint: "not-a-fingerprint" }],
      [
        {
          ...provenance()[0]!,
          range: { endByteExclusive: 10, startByte: 20 },
        },
      ],
    ]) {
      expect(
        codes(
          session().submitBatch({
            epoch: "epoch-001",
            records: [{ ...wrongProvenance, provenance: invalidProvenance }],
            sequence: 1,
          }),
        ),
      ).toEqual(["invalid-observation-provenance"]);
    }
  });

  test("preflights large batches and preserves cumulative atomicity", () => {
    const observed = valueOf(
      createObservationSession(begin(), {
        maxBatchRecords: 3,
        maxRecords: 4,
      }),
    );
    const oversized = [candidate("a"), candidate("b"), candidate("c"), candidate("d")];
    Object.defineProperty(oversized, "0", {
      enumerable: true,
      get: () => {
        throw new Error("must not inspect an item after length preflight");
      },
    });
    expect(
      codes(observed.submitBatch({ epoch: "epoch-001", records: oversized, sequence: 1 })),
    ).toEqual(["observation-batch-too-large"]);
    expect(observed.inspect()).toMatchObject({ batchCount: 0, lastSequence: 0, recordCount: 0 });

    expect(
      observed.submitBatch({
        epoch: "epoch-001",
        records: [candidate("a"), candidate("b"), candidate("c")],
        sequence: 1,
      }),
    ).toMatchObject({ ok: true });
    expect(
      codes(
        observed.submitBatch({
          epoch: "epoch-001",
          records: [candidate("d"), candidate("e")],
          sequence: 2,
        }),
      ),
    ).toEqual(["observation-session-too-large"]);
    expect(observed.inspect()).toMatchObject({ batchCount: 1, lastSequence: 1, recordCount: 3 });
  });

  test("supports a maximum-sized bounded batch", () => {
    const observed = valueOf(
      createObservationSession(begin(), { maxBatchRecords: 1_000, maxRecords: 1_000 }),
    );
    const records = Array.from({ length: 1_000 }, (_, index) => candidate(`component.${index}`));
    expect(observed.submitBatch({ epoch: "epoch-001", records, sequence: 1 })).toMatchObject({
      ok: true,
      value: { acceptedRecords: 1_000, totalRecords: 1_000 },
    });
  });

  test("bounds retained canonical characters and reserves a final signal for termination", () => {
    const measured = session();
    valueOf(measured.submitBatch({ epoch: "epoch-001", records: [candidate("one")], sequence: 1 }));
    const oneRecordCharacters = measured.inspect().canonicalCharacters;
    const bounded = valueOf(
      createObservationSession(begin(), {
        maxCanonicalCharacters: oneRecordCharacters,
      }),
    );
    expect(
      bounded.submitBatch({ epoch: "epoch-001", records: [candidate("one")], sequence: 1 }),
    ).toMatchObject({ ok: true });
    expect(
      codes(bounded.submitBatch({ epoch: "epoch-001", records: [candidate("two")], sequence: 2 })),
    ).toEqual(["observation-session-too-large"]);

    const finiteSignals = valueOf(createObservationSession(begin(), { maxSignals: 2 }));
    expect(finiteSignals.heartbeat({ epoch: "epoch-001", sequence: 1 })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(codes(finiteSignals.heartbeat({ epoch: "epoch-001", sequence: 2 }))).toEqual([
      "observation-session-too-large",
    ]);
    expect(finiteSignals.cancel({ epoch: "epoch-001", sequence: 2 })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  test("canonicalizes provenance and candidate order without reflecting ownKeys", () => {
    const firstCandidate = candidate("api") as Extract<
      ObservationRecord,
      { kind: "component-candidate" }
    >;
    const secondCandidate: ObservationRecord = {
      candidate: { type: "service", name: "api" },
      key: "api",
      kind: "component-candidate",
      provenance: [
        {
          ...provenance()[0]!,
          range: { endByteExclusive: 40, startByte: 4 },
        },
        provenance()[0]!,
      ],
      scope: "app",
    };
    const firstWithTwo = {
      ...firstCandidate,
      provenance: [
        provenance()[0]!,
        {
          ...provenance()[0]!,
          range: { endByteExclusive: 40, startByte: 4 },
        },
      ],
    };
    const first = session();
    const second = session();
    valueOf(first.submitBatch({ epoch: "epoch-001", records: [firstWithTwo], sequence: 1 }));
    valueOf(second.submitBatch({ epoch: "epoch-001", records: [secondCandidate], sequence: 1 }));
    const firstSnapshot = valueOf(
      first.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 2 }),
    );
    const secondSnapshot = valueOf(
      second.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 2 }),
    );
    expect(firstSnapshot).toEqual(secondSnapshot);

    const hostile = new Proxy(candidate("proxy"), {
      ownKeys: () => {
        throw new Error("ownKeys must not be consulted");
      },
    });
    const hostileArray = new Proxy([hostile], {
      ownKeys: () => {
        throw new Error("array ownKeys must not be consulted");
      },
    });
    expect(
      session().submitBatch({ epoch: "epoch-001", records: hostileArray, sequence: 1 }),
    ).toMatchObject({ ok: true });
  });

  test("advances heartbeats and expires only from explicit matching logical evidence", () => {
    const observed = session();
    expect(observed.heartbeat({ epoch: "epoch-001", sequence: 1 })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(codes(observed.expire({ epoch: "epoch-001", heartbeatSequence: 0 }))).toEqual([
      "heartbeat-expiry-stale",
    ]);
    expect(observed.expire({ epoch: "epoch-001", heartbeatSequence: 1 })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(observed.inspect()).toMatchObject({ lastHeartbeatSequence: 1, state: "expired" });
    expect(codes(observed.snapshot())).toEqual(["observation-session-incomplete"]);
  });

  test("cancellation and failure are terminal and never imply coverage", () => {
    const cancelled = session();
    expect(cancelled.cancel({ epoch: "epoch-001", sequence: 1 })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(cancelled.inspect().state).toBe("cancelled");
    expect(codes(cancelled.snapshot())).toEqual(["observation-session-incomplete"]);

    const failed = session();
    expect(
      failed.fail({
        epoch: "epoch-001",
        reason: { code: "scanner-failed", message: "Scanner could not parse the source" },
        sequence: 1,
      }),
    ).toEqual({ ok: true, value: undefined });
    expect(failed.inspect().state).toBe("failed");
    expect(failed.inspect().failure).toEqual({
      code: "scanner-failed",
      message: "Scanner could not parse the source",
    });
    expect(codes(failed.snapshot())).toEqual(["observation-session-incomplete"]);
  });

  test("rejects stale epochs and every signal after a terminal state before batch-body inspection", () => {
    const stale = session();
    expect(
      codes(stale.submitBatch({ epoch: "old-epoch", records: [candidate("api")], sequence: 1 })),
    ).toEqual(["stale-observation-epoch"]);

    const completed = session();
    valueOf(completed.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 1 }));
    const hostileRecords = new Proxy([] as ObservationRecord[], {
      getPrototypeOf: () => {
        throw new Error("terminal fence must run before batch-body inspection");
      },
    });
    const terminalResults: Result<unknown>[] = [
      completed.submitBatch({ epoch: "epoch-001", records: hostileRecords, sequence: 2 }),
      completed.heartbeat({ epoch: "epoch-001", sequence: 2 }),
      completed.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 2 }),
      completed.fail({
        epoch: "epoch-001",
        reason: { code: "late", message: "late" },
        sequence: 2,
      }),
      completed.cancel({ epoch: "epoch-001", sequence: 2 }),
      completed.expire({ epoch: "epoch-001", heartbeatSequence: 0 }),
    ];
    for (const result of terminalResults) {
      expect(codes(result)).toEqual(["observation-session-terminal"]);
    }
  });

  test("applies the same terminal fence after completion, failure, cancellation, and expiry", () => {
    const terminated: ObservationSession[] = [];
    const completed = session();
    valueOf(completed.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 1 }));
    terminated.push(completed);

    const failed = session();
    valueOf(
      failed.fail({
        epoch: "epoch-001",
        reason: { code: "scanner-failed", message: "failed" },
        sequence: 1,
      }),
    );
    terminated.push(failed);

    const cancelled = session();
    valueOf(cancelled.cancel({ epoch: "epoch-001", sequence: 1 }));
    terminated.push(cancelled);

    const expired = session();
    valueOf(expired.expire({ epoch: "epoch-001", heartbeatSequence: 0 }));
    terminated.push(expired);

    for (const observed of terminated) {
      expect(codes(observed.heartbeat({ epoch: "epoch-001", sequence: 2 }))).toEqual([
        "observation-session-terminal",
      ]);
      expect(
        codes(
          observed.submitBatch({ epoch: "epoch-001", records: [candidate("late")], sequence: 2 }),
        ),
      ).toEqual(["observation-session-terminal"]);
    }
  });

  test("allows zero-record completion only through explicit per-scope coverage", () => {
    const observed = session(["app", "shared"]);
    const completed = observed.complete({
      coverage: [
        { kinds: [], scope: "shared", state: "partial" },
        { kinds: [], scope: "app", state: "partial" },
      ],
      epoch: "epoch-001",
      sequence: 1,
    });
    expect(completed).toMatchObject({ ok: true, value: { records: [] } });

    const missingCoverage = session(["app", "shared"]);
    expect(
      codes(
        missingCoverage.complete({
          coverage: [{ kinds: [], scope: "app", state: "partial" }],
          epoch: "epoch-001",
          sequence: 1,
        }),
      ),
    ).toEqual(["invalid-observation-session"]);
  });
});
