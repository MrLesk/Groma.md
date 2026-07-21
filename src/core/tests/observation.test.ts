import { describe, expect, test } from "bun:test";
import {
  canonicalizeCompletedObservationSnapshot,
  createObservationSession,
  observationSessionApiVersion,
  type ObservationCoverage,
  type ObservationRecord,
  type ObservationSessionBegin,
  type Result,
} from "../index.ts";

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(","));
  return result.value;
}

const begin: ObservationSessionBegin = Object.freeze({
  apiVersion: observationSessionApiVersion,
  epoch: "epoch-001",
  projectId: "project.local",
  scopes: Object.freeze([Object.freeze({ id: "app", resourceRoot: "src" })]),
  source: Object.freeze({ id: "example.typescript", instance: "workspace", version: "1.0.0" }),
});

const record: ObservationRecord = Object.freeze({
  candidate: Object.freeze({ name: "API", type: "service" }),
  key: "component.api",
  kind: "component-candidate",
  provenance: Object.freeze([
    Object.freeze({
      fingerprint: "sha256:aaaaaaaaaaaaaaaa",
      resource: "src/index.ts",
      scope: "app",
    }),
  ]),
  scope: "app",
});

const coverage: readonly ObservationCoverage[] = Object.freeze([
  Object.freeze({
    kinds: Object.freeze(["component-candidate" as const]),
    scope: "app",
    state: "complete",
  }),
]);

describe("finite observation sessions", () => {
  test("accepts bounded observations and publishes only after successful completion", () => {
    const session = valueOf(createObservationSession(begin));
    expect(session.snapshot()).toMatchObject({
      ok: false,
      diagnostics: [{ code: "observation-session-incomplete" }],
    });
    expect(
      session.submitBatch({ epoch: begin.epoch, records: [record], sequence: 1 }),
    ).toMatchObject({ ok: true, value: { acceptedRecords: 1, totalRecords: 1 } });
    expect(session.complete({ coverage, epoch: begin.epoch, sequence: 2 })).toMatchObject({
      ok: true,
      value: { records: [{ key: "component.api" }] },
    });
    expect(session.snapshot()).toMatchObject({
      ok: true,
      value: { coverage, records: [{ key: "component.api" }] },
    });
  });

  test("failed and cancelled sessions never produce a completed snapshot", () => {
    const failed = valueOf(createObservationSession(begin));
    expect(
      failed.fail({
        epoch: begin.epoch,
        reason: { code: "parse-failed", message: "Parse failed" },
        sequence: 1,
      }),
    ).toMatchObject({ ok: true });
    expect(failed.snapshot()).toMatchObject({
      ok: false,
      diagnostics: [{ code: "observation-session-incomplete" }],
    });
    const cancelled = valueOf(createObservationSession(begin));
    expect(cancelled.cancel({ epoch: begin.epoch, sequence: 1 })).toMatchObject({ ok: true });
    expect(cancelled.snapshot()).toMatchObject({
      ok: false,
      diagnostics: [{ code: "observation-session-incomplete" }],
    });
  });

  test("rejects contradictory replay and incomplete coverage without changing accepted state", () => {
    const session = valueOf(createObservationSession(begin));
    expect(
      session.submitBatch({ epoch: begin.epoch, records: [record], sequence: 1 }),
    ).toMatchObject({ ok: true });
    expect(
      session.submitBatch({
        epoch: begin.epoch,
        records: [{ ...record, candidate: { name: "Other" } }],
        sequence: 2,
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "contradictory-observation" }] });
    expect(session.inspect()).toMatchObject({ lastSequence: 1, recordCount: 1, state: "active" });
    expect(session.complete({ coverage: [], epoch: begin.epoch, sequence: 2 })).toMatchObject({
      ok: false,
    });
    expect(session.snapshot()).toMatchObject({ ok: false });
  });

  test("keeps deterministic identity and ordering in the completed snapshot", () => {
    const session = valueOf(createObservationSession(begin));
    const second = Object.freeze({ ...record, key: "component.zed" });
    expect(
      session.submitBatch({ epoch: begin.epoch, records: [second, record], sequence: 1 }),
    ).toMatchObject({ ok: true });
    const completed = valueOf(session.complete({ coverage, epoch: begin.epoch, sequence: 2 }));
    expect(completed.records.map((item) => item.key)).toEqual(["component.api", "component.zed"]);
    expect(completed.projectId).toBe("project.local");
    expect(completed.source.id).toBe("example.typescript");
  });

  test("canonicalizes one complete snapshot through the same finite-session rules", () => {
    const completed = valueOf(
      canonicalizeCompletedObservationSnapshot({
        ...begin,
        coverage,
        records: [record],
      }),
    );
    expect(completed.records).toEqual([record]);
    expect(Object.isFrozen(completed)).toBeTrue();
    expect(
      canonicalizeCompletedObservationSnapshot({
        ...completed,
        records: [{ ...record, scope: "other" }],
      }),
    ).toMatchObject({ diagnostics: [{ code: "undeclared-observation-scope" }], ok: false });
    expect(
      canonicalizeCompletedObservationSnapshot({ ...completed, trailing: true }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-observation-snapshot" }], ok: false });
  });
});
