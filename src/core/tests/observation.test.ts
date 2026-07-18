import { describe, expect, test } from "bun:test";

import {
  createObservationSession,
  observationSessionCheckpointApiVersion,
  observationSessionApiVersion,
  restoreObservationSessionCheckpoint,
  type ObservationCoverage,
  type ObservationProvenance,
  type ObservationRecord,
  type ObservationSession,
  type ObservationSessionBegin,
  type ObservationSessionCheckpoint,
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

function descriptorOnceGraph(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const target: Record<PropertyKey, unknown> | unknown[] = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(target) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) continue;
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: descriptor.enumerable === true,
      value: descriptorOnceGraph(descriptor.value),
      writable: true,
    });
  }
  const inspected = new Set<PropertyKey>();
  return new Proxy(target, {
    getOwnPropertyDescriptor(proxyTarget, key) {
      if (inspected.has(key)) throw new Error(`descriptor ${String(key)} was inspected twice`);
      inspected.add(key);
      return Reflect.getOwnPropertyDescriptor(proxyTarget, key);
    },
  });
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
    for (const resourceRoot of ["src\troot", "src\nroot", "src\rroot"]) {
      expect(
        codes(
          createObservationSession({
            ...begin(),
            scopes: [{ id: "app", resourceRoot }],
          }),
        ),
      ).toEqual(["invalid-observation-begin"]);
    }
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
    for (const resource of ["src/file\tname.ts", "src/file\nname.ts", "src/file\rname.ts"]) {
      expect(
        codes(
          session().submitBatch({
            epoch: "epoch-001",
            records: [
              {
                ...wrongProvenance,
                provenance: [{ ...provenance()[0]!, resource }],
              },
            ],
            sequence: 1,
          }),
        ),
      ).toEqual(["invalid-observation-provenance"]);
    }

    expect(
      session().submitBatch({
        epoch: "epoch-001",
        records: [
          {
            ...wrongProvenance,
            key: "unicode",
            provenance: [{ ...provenance()[0]!, resource: "src/naïve/文件.ts" }],
          },
        ],
        sequence: 1,
      }),
    ).toMatchObject({ ok: true });
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

  test("uses the public canonical-character bound for long provenance-rich records", () => {
    const longProvenance = Array.from({ length: 32 }, (_, index) => {
      const prefix = `src/${String(index).padStart(2, "0")}-`;
      return {
        fingerprint: `sha256:${String(index).padStart(2, "0")}`,
        resource: `${prefix}${"a".repeat(4_096 - prefix.length)}`,
        scope: "app",
      };
    });
    const record: ObservationRecord = {
      content: "x".repeat(65_000),
      format: "text",
      key: "long.documentation",
      kind: "documentation",
      provenance: longProvenance,
      scope: "app",
    };

    const measured = session();
    expect(
      measured.submitBatch({ epoch: "epoch-001", records: [record], sequence: 1 }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 1 } });
    const exactCharacters = measured.inspect().canonicalCharacters;
    expect(exactCharacters).toBeGreaterThan(163_840);

    const exact = valueOf(
      createObservationSession(begin(), { maxCanonicalCharacters: exactCharacters }),
    );
    expect(exact.submitBatch({ epoch: "epoch-001", records: [record], sequence: 1 })).toMatchObject(
      { ok: true, value: { acceptedRecords: 1 } },
    );

    const under = valueOf(
      createObservationSession(begin(), { maxCanonicalCharacters: exactCharacters - 1 }),
    );
    expect(
      codes(under.submitBatch({ epoch: "epoch-001", records: [record], sequence: 1 })),
    ).toEqual(["observation-record-too-large"]);
    expect(under.inspect()).toMatchObject({
      batchCount: 0,
      canonicalCharacters: 0,
      recordCount: 0,
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

  test("checkpoints only accepted compact transitions and restores equivalent completed state", () => {
    const observed = session();
    const original = candidate("api") as Extract<
      ObservationRecord,
      { kind: "component-candidate" }
    >;
    valueOf(observed.submitBatch({ epoch: "epoch-001", records: [original], sequence: 1 }));
    (original.candidate as { name?: string }).name = "mutated after acceptance";
    valueOf(observed.submitBatch({ epoch: "epoch-001", records: [candidate("api")], sequence: 2 }));
    valueOf(observed.submitBatch({ epoch: "epoch-001", records: [], sequence: 3 }));
    valueOf(observed.heartbeat({ epoch: "epoch-001", sequence: 4 }));
    valueOf(observed.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 5 }));

    const checkpoint = observed.checkpoint();
    expect(checkpoint.apiVersion).toBe(observationSessionCheckpointApiVersion);
    expect(checkpoint.bounds).toEqual({
      maxBatchRecords: 2_048,
      maxBatches: 4_096,
      maxCanonicalCharacters: 256 * 1024 * 1024,
      maxCoverageEntries: 1_024,
      maxProvenancePerRecord: 32,
      maxRecords: 100_000,
      maxResourceCharacters: 4_096,
      maxScopes: 256,
      maxSignals: 1_000_000,
      maxTextCharacters: 65_536,
      maxTokenCharacters: 256,
    });
    expect(
      checkpoint.transitions
        .filter((transition) => transition.type === "batch")
        .map((transition) => transition.records.length),
    ).toEqual([1, 0, 0]);
    expect(
      checkpoint.transitions[0]?.type === "batch"
        ? (
            checkpoint.transitions[0].records[0] as Extract<
              ObservationRecord,
              { kind: "component-candidate" }
            >
          ).candidate.name
        : undefined,
    ).toBe("api");
    expect(Object.isFrozen(checkpoint)).toBeTrue();
    expect(Object.isFrozen(checkpoint.transitions)).toBeTrue();

    const restored = valueOf(restoreObservationSessionCheckpoint(checkpoint));
    expect(restored.inspect()).toEqual(observed.inspect());
    expect(valueOf(restored.snapshot())).toEqual(valueOf(observed.snapshot()));
    expect(restored.checkpoint()).toEqual(checkpoint);
  });

  test("rejected calls never alter checkpoints and all incomplete terminal states replay", () => {
    const contradictory = session();
    valueOf(
      contradictory.submitBatch({ epoch: "epoch-001", records: [candidate("api")], sequence: 1 }),
    );
    const before = contradictory.checkpoint();
    expect(
      codes(
        contradictory.submitBatch({
          epoch: "epoch-001",
          records: [candidate("api", "app", "different")],
          sequence: 2,
        }),
      ),
    ).toEqual(["contradictory-observation"]);
    expect(contradictory.checkpoint()).toEqual(before);

    const terminal = [
      (() => {
        const value = session();
        valueOf(value.cancel({ epoch: "epoch-001", sequence: 1 }));
        return value;
      })(),
      (() => {
        const value = session();
        valueOf(value.expire({ epoch: "epoch-001", heartbeatSequence: 0 }));
        return value;
      })(),
      (() => {
        const value = session();
        valueOf(
          value.fail({
            epoch: "epoch-001",
            reason: { code: "scanner-failed", message: "Scanner failed" },
            sequence: 1,
          }),
        );
        return value;
      })(),
    ];
    for (const value of terminal) {
      const restored = valueOf(restoreObservationSessionCheckpoint(value.checkpoint()));
      expect(restored.inspect()).toEqual(value.inspect());
      expect(codes(restored.snapshot())).toEqual(["observation-session-incomplete"]);
    }
  });

  test("restoration rejects non-exact hostile envelopes and noncompact replay records", () => {
    const observed = session();
    valueOf(observed.submitBatch({ epoch: "epoch-001", records: [candidate("api")], sequence: 1 }));
    const checkpoint = observed.checkpoint();
    const duplicate = structuredClone(checkpoint) as ObservationSessionCheckpoint;
    (duplicate.transitions as unknown as Array<{ records: ObservationRecord[] }>).push({
      records: [candidate("api")],
      sequence: 2,
      type: "batch",
    } as never);
    expect(codes(restoreObservationSessionCheckpoint(duplicate))).toEqual([
      "invalid-observation-checkpoint",
    ]);

    const extra = { ...checkpoint, unexpected: true } as ObservationSessionCheckpoint;
    expect(codes(restoreObservationSessionCheckpoint(extra))).toEqual([
      "invalid-observation-checkpoint",
    ]);
    const nested = structuredClone(checkpoint) as ObservationSessionCheckpoint;
    (nested.begin.source as unknown as { unexpected: boolean }).unexpected = true;
    expect(codes(restoreObservationSessionCheckpoint(nested))).toEqual([
      "invalid-observation-checkpoint",
    ]);
    const nestedRecord = structuredClone(checkpoint) as ObservationSessionCheckpoint;
    const firstTransition = nestedRecord.transitions[0];
    if (firstTransition?.type !== "batch") throw new Error("expected batch fixture");
    (firstTransition.records[0] as unknown as { unexpected: boolean }).unexpected = true;
    expect(codes(restoreObservationSessionCheckpoint(nestedRecord))).toEqual([
      "invalid-observation-checkpoint",
    ]);
    const extendedTransitions = structuredClone(checkpoint) as ObservationSessionCheckpoint;
    (extendedTransitions.transitions as unknown as { unexpected: boolean }).unexpected = true;
    expect(codes(restoreObservationSessionCheckpoint(extendedTransitions))).toEqual([
      "invalid-observation-checkpoint",
    ]);
    const hostile = new Proxy(checkpoint, {
      ownKeys() {
        throw new Error("hostile checkpoint envelope");
      },
    });
    expect(codes(restoreObservationSessionCheckpoint(hostile))).toEqual([
      "invalid-observation-checkpoint",
    ]);
  });

  test("restoration captures hostile descriptor graphs once before ordinary semantic replay", () => {
    const active = session();
    valueOf(active.submitBatch({ epoch: "epoch-001", records: [candidate("api")], sequence: 1 }));

    const completed = session();
    valueOf(completed.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 1 }));

    const failed = session();
    valueOf(
      failed.fail({
        epoch: "epoch-001",
        reason: { code: "scanner-failed", message: "Scanner failed" },
        sequence: 1,
      }),
    );

    for (const observed of [active, completed, failed]) {
      const restored = valueOf(
        restoreObservationSessionCheckpoint(descriptorOnceGraph(observed.checkpoint())),
      );
      expect(restored.checkpoint()).toEqual(observed.checkpoint());
    }

    const transitionTarget = structuredClone(active.checkpoint().transitions[0]!);
    const remaining = new Set(Reflect.ownKeys(transitionTarget));
    const revocable = Proxy.revocable(transitionTarget, {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        remaining.delete(key);
        if (remaining.size === 0) revocable.revoke();
        return descriptor;
      },
    });
    const checkpoint = structuredClone(active.checkpoint()) as unknown as {
      transitions: unknown[];
    };
    checkpoint.transitions[0] = revocable.proxy;
    expect(valueOf(restoreObservationSessionCheckpoint(checkpoint)).checkpoint()).toEqual(
      active.checkpoint(),
    );

    const changingCoverage = structuredClone(
      completed.checkpoint(),
    ) as ObservationSessionCheckpoint;
    const completion = changingCoverage.transitions[0];
    if (completion?.type !== "complete") throw new Error("expected completion fixture");
    const coverageTarget = completion.coverage[0]!;
    let coverageStateReads = 0;
    (completion.coverage as ObservationCoverage[])[0] = new Proxy(coverageTarget, {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key !== "state" || descriptor === undefined || !("value" in descriptor)) {
          return descriptor;
        }
        coverageStateReads += 1;
        return { ...descriptor, value: coverageStateReads === 1 ? "partial" : "complete" };
      },
    });
    expect(
      valueOf(restoreObservationSessionCheckpoint(changingCoverage)).checkpoint().transitions,
    ).toEqual(completed.checkpoint().transitions);
    expect(coverageStateReads).toBe(1);

    const changingFailure = structuredClone(failed.checkpoint()) as ObservationSessionCheckpoint;
    const failure = changingFailure.transitions[0];
    if (failure?.type !== "fail") throw new Error("expected failure fixture");
    const reasonTarget = failure.reason;
    let failureMessageReads = 0;
    (failure as { reason: typeof failure.reason }).reason = new Proxy(reasonTarget, {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key !== "message" || descriptor === undefined || !("value" in descriptor)) {
          return descriptor;
        }
        failureMessageReads += 1;
        return {
          ...descriptor,
          value: failureMessageReads === 1 ? "Scanner failed" : "Mutated after validation",
        };
      },
    });
    expect(valueOf(restoreObservationSessionCheckpoint(changingFailure)).checkpoint()).toEqual(
      failed.checkpoint(),
    );
    expect(failureMessageReads).toBe(1);
  });

  test("restoration rejects replay mixtures, in-batch duplicates, and normalized terminal mutation", () => {
    const observed = session();
    valueOf(observed.submitBatch({ epoch: "epoch-001", records: [candidate("api")], sequence: 1 }));

    const mixed = structuredClone(observed.checkpoint()) as ObservationSessionCheckpoint;
    (mixed.transitions as unknown as Array<unknown>).push({
      records: [candidate("api"), candidate("worker")],
      sequence: 2,
      type: "batch",
    });
    expect(codes(restoreObservationSessionCheckpoint(mixed))).toEqual([
      "invalid-observation-checkpoint",
    ]);

    const duplicate = structuredClone(observed.checkpoint()) as ObservationSessionCheckpoint;
    const first = duplicate.transitions[0];
    if (first?.type !== "batch") throw new Error("expected batch fixture");
    (first.records as ObservationRecord[]).push(candidate("api"));
    expect(codes(restoreObservationSessionCheckpoint(duplicate))).toEqual([
      "invalid-observation-checkpoint",
    ]);

    const completed = session();
    valueOf(completed.complete({ coverage: coverage(), epoch: "epoch-001", sequence: 1 }));
    const reordered = structuredClone(completed.checkpoint()) as ObservationSessionCheckpoint;
    const terminal = reordered.transitions[0];
    if (terminal?.type !== "complete") throw new Error("expected completion fixture");
    (terminal.coverage[0]!.kinds as ObservationRecord["kind"][]).reverse();
    expect(codes(restoreObservationSessionCheckpoint(reordered))).toEqual([
      "invalid-observation-checkpoint",
    ]);
  });

  test("restoration owns shared hostile containers once across batches and transitions", () => {
    const timeSlicedRecord = () => {
      const target = structuredClone(candidate("api"));
      let keyReads = 0;
      return {
        reads: () => keyReads,
        value: new Proxy(target, {
          getOwnPropertyDescriptor(recordTarget, key) {
            const descriptor = Reflect.getOwnPropertyDescriptor(recordTarget, key);
            if (key !== "key" || descriptor === undefined || !("value" in descriptor)) {
              return descriptor;
            }
            keyReads += 1;
            return { ...descriptor, value: keyReads === 1 ? "api" : "worker" };
          },
        }),
      };
    };

    const oneBatch = session();
    valueOf(
      oneBatch.submitBatch({
        epoch: "epoch-001",
        records: [candidate("api"), candidate("worker", "app", "api")],
        sequence: 1,
      }),
    );
    const withinBatch = structuredClone(oneBatch.checkpoint()) as ObservationSessionCheckpoint;
    const withinTransition = withinBatch.transitions[0];
    if (withinTransition?.type !== "batch") throw new Error("expected batch fixture");
    const withinAlias = timeSlicedRecord();
    (withinTransition.records as ObservationRecord[])[0] = withinAlias.value;
    (withinTransition.records as ObservationRecord[])[1] = withinAlias.value;
    expect(codes(restoreObservationSessionCheckpoint(withinBatch))).toEqual([
      "invalid-observation-checkpoint",
    ]);
    expect(withinAlias.reads()).toBe(1);

    const twoBatches = session();
    valueOf(
      twoBatches.submitBatch({ epoch: "epoch-001", records: [candidate("api")], sequence: 1 }),
    );
    valueOf(
      twoBatches.submitBatch({
        epoch: "epoch-001",
        records: [candidate("worker", "app", "api")],
        sequence: 2,
      }),
    );
    const acrossTransitions = structuredClone(
      twoBatches.checkpoint(),
    ) as ObservationSessionCheckpoint;
    const firstTransition = acrossTransitions.transitions[0];
    const secondTransition = acrossTransitions.transitions[1];
    if (firstTransition?.type !== "batch" || secondTransition?.type !== "batch") {
      throw new Error("expected batch fixtures");
    }
    const acrossAlias = timeSlicedRecord();
    (firstTransition.records as ObservationRecord[])[0] = acrossAlias.value;
    (secondTransition.records as ObservationRecord[])[0] = acrossAlias.value;
    expect(codes(restoreObservationSessionCheckpoint(acrossTransitions))).toEqual([
      "invalid-observation-checkpoint",
    ]);
    expect(acrossAlias.reads()).toBe(1);

    const aliasedParentBase = oneBatch.checkpoint();
    const transitionTarget: unknown[] = [undefined];
    let transitionIndexReads = 0;
    let parentTransition: ObservationSessionCheckpoint["transitions"][number];
    const transitionsProxy = new Proxy(transitionTarget, {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key !== "0" || descriptor === undefined || !("value" in descriptor)) {
          return descriptor;
        }
        transitionIndexReads += 1;
        return {
          ...descriptor,
          value: transitionIndexReads === 1 ? parentTransition : candidate("api"),
        };
      },
    });
    parentTransition = {
      records: transitionsProxy as unknown as readonly ObservationRecord[],
      sequence: 1,
      type: "batch",
    };
    transitionTarget[0] = parentTransition;
    const aliasedParent = {
      ...aliasedParentBase,
      transitions: transitionsProxy,
    } as unknown as ObservationSessionCheckpoint;
    expect(codes(restoreObservationSessionCheckpoint(aliasedParent))).toEqual([
      "invalid-observation-checkpoint",
    ]);
    expect(transitionIndexReads).toBe(1);
  });

  test("restoration bounds hostile transition capture before semantic batch validation", () => {
    const observed = valueOf(createObservationSession(begin(), { maxCanonicalCharacters: 256 }));
    valueOf(observed.submitBatch({ epoch: "epoch-001", records: [], sequence: 1 }));
    const oversized = structuredClone(observed.checkpoint()) as ObservationSessionCheckpoint;
    const transition = oversized.transitions[0];
    if (transition?.type !== "batch") throw new Error("expected batch fixture");
    (transition.records as ObservationRecord[]).push({
      content: "x".repeat(4_000_000),
      format: "text",
      key: "oversized",
      kind: "documentation",
      provenance: provenance(),
      scope: "app",
    });
    const restored = restoreObservationSessionCheckpoint(oversized);
    expect(codes(restored)).toEqual(["invalid-observation-checkpoint"]);
    expect(restored.ok ? undefined : restored.diagnostics[0]?.details?.reason).toContain(
      "could not be captured safely within its bounds",
    );
  });
});
