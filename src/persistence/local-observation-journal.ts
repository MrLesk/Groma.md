import { createHash } from "node:crypto";

import {
  createObservationSession,
  failure,
  restoreObservationSessionCheckpoint,
  success,
  type CompletedObservationSnapshot,
  type Diagnostic,
  type ObservationBatch,
  type ObservationBatchReceipt,
  type ObservationCompletion,
  type ObservationExpiry,
  type ObservationFailure,
  type ObservationHeartbeat,
  type ObservationSession,
  type ObservationSessionBegin,
  type ObservationSessionBounds,
  type ObservationSessionCheckpoint,
  type ObservationSessionInspection,
  type ObservationTerminalSignal,
  type Result,
} from "../core/index.ts";
import { copyCanonicalGraphData } from "../core/payload.ts";
import { inspectExactRecord } from "../core/runtime.ts";
import {
  workspaceResourceLocator,
  type LocalCoordinationLease,
  type LocalResourceProvider,
  type ResourceContinuationCursor,
  type WorkspaceResourceLocator,
} from "./contracts.ts";

export const localObservationJournalSessionBounds: ObservationSessionBounds = Object.freeze({
  maxBatchRecords: 2_048,
  maxBatches: 4_096,
  maxCanonicalCharacters: 2 * 1024 * 1024,
  maxCoverageEntries: 256,
  maxProvenancePerRecord: 32,
  maxRecords: 50_000,
  maxResourceCharacters: 4_096,
  maxScopes: 256,
  maxSignals: 8_192,
  maxTextCharacters: 65_536,
  maxTokenCharacters: 256,
});

/** Host provider limits that cover the official whole-file session profile. */
export const localObservationJournalResourceProfile = Object.freeze({
  maxDepth: 1,
  maxEntriesPerDirectory: 10_000,
  maxPageSize: 1_000,
  maxReadBytes: 16 * 1024 * 1024,
  maxReplacementBytes: 16 * 1024 * 1024,
});

export interface LocalObservationJournalBounds {
  readonly maxJournalBytes: number;
  readonly maxLanes: number;
  readonly maxPageSize: number;
}

export type LocalObservationJournalFaultPhase =
  | "after-abandonment"
  | "after-acknowledgement"
  | "after-batch"
  | "after-begin"
  | "after-cleanup"
  | "after-completion"
  | "after-handoff"
  | "after-heartbeat";

export type LocalObservationJournalFaultInjector = (
  phase: LocalObservationJournalFaultPhase,
) => void | Promise<void>;

export interface LocalObservationJournalOptions {
  readonly bounds?: Partial<LocalObservationJournalBounds>;
  readonly faultInjector?: LocalObservationJournalFaultInjector;
  readonly resources: LocalResourceProvider;
}

export interface ObservationLaneIdentity {
  readonly projectId: string;
  readonly source: Readonly<{ readonly id: string; readonly instance: string }>;
}

export type ObservationAbandonmentKind =
  "cancelled" | "contradictory" | "expired" | "failed" | "recovered-incomplete" | "superseded";

export interface ObservationAbandonment {
  readonly epoch: string;
  readonly kind: ObservationAbandonmentKind;
  readonly lane: ObservationLaneIdentity;
  readonly reason: Readonly<{ readonly code: string; readonly message: string }>;
}

export interface ObservationHandoff {
  readonly epoch: string;
  readonly lane: ObservationLaneIdentity;
  readonly snapshot: CompletedObservationSnapshot;
  readonly token: string;
}

export interface ObservationJournalRecovery {
  readonly abandoned: readonly ObservationAbandonment[];
  readonly acknowledged: readonly ObservationLaneRequest[];
  readonly handoffs: readonly ObservationHandoff[];
}

export interface ObservationLaneRequest extends ObservationLaneIdentity {
  readonly epoch: string;
}

export interface ObservationHandoffAcknowledgement extends ObservationLaneRequest {
  readonly token: string;
}

export interface DurableObservationSession {
  cancel(signal: ObservationTerminalSignal): Promise<Result<void>>;
  complete(completion: ObservationCompletion): Promise<Result<void>>;
  expire(expiry: ObservationExpiry): Promise<Result<void>>;
  fail(report: ObservationFailure): Promise<Result<void>>;
  heartbeat(heartbeat: ObservationHeartbeat): Promise<Result<void>>;
  inspect(): ObservationSessionInspection;
  submitBatch(batch: ObservationBatch): Promise<Result<ObservationBatchReceipt>>;
}

export interface LocalObservationJournal {
  acknowledge(request: ObservationHandoffAcknowledgement): Promise<Result<void>>;
  begin(begin: ObservationSessionBegin): Promise<Result<DurableObservationSession>>;
  cleanup(request: ObservationLaneRequest): Promise<Result<void>>;
  handoff(request: ObservationLaneRequest): Promise<Result<ObservationHandoff>>;
  recover(): Promise<Result<ObservationJournalRecovery>>;
}

interface StoredLane {
  readonly projectId: string;
  readonly sourceId: string;
  readonly sourceInstance: string;
}

interface StoredAbandonment {
  readonly code: string;
  readonly kind: ObservationAbandonmentKind;
  readonly message: string;
}

interface StoredLifecycleActive {
  readonly state: "active";
}

interface StoredLifecycleAbandoned {
  readonly reason: StoredAbandonment;
  readonly state: "abandoned";
}

interface StoredLifecycleCompleted {
  readonly state: "completed";
}

type StoredLifecycle = StoredLifecycleAbandoned | StoredLifecycleActive | StoredLifecycleCompleted;

interface StoredDelivery {
  readonly state: "acknowledged" | "available" | "pending";
  readonly token: string;
}

interface StoredObservationLane {
  readonly checkpoint: ObservationSessionCheckpoint;
  readonly delivery: StoredDelivery | null;
  readonly lane: StoredLane;
  readonly lifecycle: StoredLifecycle;
  readonly revision: number;
  readonly version: 1;
}

interface LoadedLane {
  readonly session: ObservationSession;
  readonly state: StoredObservationLane;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const handoffTokenPattern = /^groma-observation-handoff-v1:[0-9a-f]{64}$/;
const laneFilePattern = /^groma\/observation-sessions\/[0-9a-f]{64}\.json$/;
const laneTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
const defaultBounds: LocalObservationJournalBounds = Object.freeze({
  maxJournalBytes: 16 * 1024 * 1024,
  maxLanes: 10_000,
  maxPageSize: 1_000,
});
const absoluteBounds: LocalObservationJournalBounds = Object.freeze({
  maxJournalBytes: 64 * 1024 * 1024,
  maxLanes: 100_000,
  maxPageSize: 10_000,
});
/**
 * Conservative encoded envelope for the exact session profile. Record canonical JSON
 * expands by at most three UTF-8 bytes per canonical character. Begin resource roots
 * and the one failure message are not charged to that Core counter, so their worst-case
 * JSON escaping uses six bytes per UTF-16 code unit. The remaining terms cover every
 * bounded transition, array separator, coverage entry, and fixed envelope.
 */
export const localObservationJournalMinimumBytes =
  localObservationJournalSessionBounds.maxCanonicalCharacters * 3 +
  localObservationJournalSessionBounds.maxScopes *
    (localObservationJournalSessionBounds.maxResourceCharacters * 6 +
      localObservationJournalSessionBounds.maxTokenCharacters +
      512) +
  localObservationJournalSessionBounds.maxSignals * 128 +
  localObservationJournalSessionBounds.maxBatches * 64 +
  localObservationJournalSessionBounds.maxRecords * 2 +
  localObservationJournalSessionBounds.maxCoverageEntries *
    (localObservationJournalSessionBounds.maxTokenCharacters + 512) +
  localObservationJournalSessionBounds.maxTextCharacters * 6 +
  1024 * 1024;

if (
  localObservationJournalMinimumBytes > localObservationJournalResourceProfile.maxReplacementBytes
) {
  throw new Error("local observation session profile exceeds its provider byte budget");
}

const sessionsRootResult = workspaceResourceLocator("groma", "observation-sessions");
if (!sessionsRootResult.ok) throw new Error("invalid built-in observation sessions root");
export const localObservationSessionsRoot = sessionsRootResult.value;

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze({ code, message, ...(details === undefined ? {} : { details }) });
}

function configuredBound(
  value: number | undefined,
  fallback: number,
  maximum: number,
  name: string,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0 || selected > maximum) {
    throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
  }
  return selected;
}

function resolveBounds(
  configured?: Partial<LocalObservationJournalBounds>,
): LocalObservationJournalBounds {
  const resolved = Object.freeze({
    maxJournalBytes: configuredBound(
      configured?.maxJournalBytes,
      defaultBounds.maxJournalBytes,
      absoluteBounds.maxJournalBytes,
      "maxJournalBytes",
    ),
    maxLanes: configuredBound(
      configured?.maxLanes,
      defaultBounds.maxLanes,
      absoluteBounds.maxLanes,
      "maxLanes",
    ),
    maxPageSize: configuredBound(
      configured?.maxPageSize,
      defaultBounds.maxPageSize,
      absoluteBounds.maxPageSize,
      "maxPageSize",
    ),
  });
  if (resolved.maxJournalBytes < localObservationJournalMinimumBytes) {
    throw new RangeError(
      `maxJournalBytes must be at least ${localObservationJournalMinimumBytes} for the configured session profile`,
    );
  }
  if (resolved.maxPageSize > resolved.maxLanes) {
    throw new RangeError("maxPageSize must not exceed maxLanes");
  }
  return resolved;
}

function safeLaneToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= localObservationJournalSessionBounds.maxTokenCharacters &&
    laneTokenPattern.test(value)
  );
}

function inspectLane(value: unknown): Result<ObservationLaneIdentity> {
  const lane = inspectExactRecord(
    value,
    [["projectId", "source"]],
    "invalid-observation-lane",
    "Observation lane",
  );
  if (!lane.ok) return lane;
  const source = inspectExactRecord(
    lane.value.source,
    [["id", "instance"]],
    "invalid-observation-lane",
    "Observation lane source",
  );
  if (
    !source.ok ||
    !safeLaneToken(lane.value.projectId) ||
    !safeLaneToken(source.value.id) ||
    !safeLaneToken(source.value.instance)
  ) {
    return failure(diagnostic("invalid-observation-lane", "Observation lane identity is invalid"));
  }
  return success(
    Object.freeze({
      projectId: lane.value.projectId,
      source: Object.freeze({ id: source.value.id, instance: source.value.instance }),
    }),
  );
}

function inspectLaneRequest(value: unknown): Result<ObservationLaneRequest> {
  const request = inspectExactRecord(
    value,
    [["epoch", "projectId", "source"]],
    "invalid-observation-lane",
    "Observation lane request",
  );
  if (!request.ok) return request;
  const lane = inspectLane({ projectId: request.value.projectId, source: request.value.source });
  if (!lane.ok || !safeLaneToken(request.value.epoch)) {
    return failure(diagnostic("invalid-observation-lane", "Observation lane request is invalid"));
  }
  return success(Object.freeze({ ...lane.value, epoch: request.value.epoch }));
}

function storedLane(lane: ObservationLaneIdentity): StoredLane {
  return Object.freeze({
    projectId: lane.projectId,
    sourceId: lane.source.id,
    sourceInstance: lane.source.instance,
  });
}

function publicLane(lane: StoredLane): ObservationLaneIdentity {
  return Object.freeze({
    projectId: lane.projectId,
    source: Object.freeze({ id: lane.sourceId, instance: lane.sourceInstance }),
  });
}

function laneFromBegin(begin: ObservationSessionBegin): ObservationLaneIdentity {
  return Object.freeze({
    projectId: begin.projectId,
    source: Object.freeze({ id: begin.source.id, instance: begin.source.instance }),
  });
}

function laneFromRequest(request: ObservationLaneRequest): ObservationLaneIdentity {
  return Object.freeze({ projectId: request.projectId, source: request.source });
}

function sameLane(stored: StoredLane, lane: ObservationLaneIdentity): boolean {
  return (
    stored.projectId === lane.projectId &&
    stored.sourceId === lane.source.id &&
    stored.sourceInstance === lane.source.instance
  );
}

function canonicalJson(value: unknown, maximum: number): Result<string> {
  const copied = copyCanonicalGraphData(value, "query", {
    code: "observation-journal-too-large",
    maximum: maximum - 1,
    message: "Observation journal exceeds its byte bound",
  });
  if (!copied.ok) return copied;
  return success(`${copied.value.canonicalJson}\n`);
}

function laneDigest(lane: ObservationLaneIdentity): string {
  const canonical = copyCanonicalGraphData(storedLane(lane), "query");
  if (!canonical.ok) throw new Error("validated observation lane was not canonical");
  return createHash("sha256").update(canonical.value.canonicalJson).digest("hex");
}

export function localObservationSessionLocator(
  laneValue: ObservationLaneIdentity,
): Result<WorkspaceResourceLocator> {
  const lane = inspectLane(laneValue);
  if (!lane.ok) return lane;
  return workspaceResourceLocator(
    "groma",
    "observation-sessions",
    `${laneDigest(lane.value)}.json`,
  );
}

function handoffToken(checkpoint: ObservationSessionCheckpoint): string {
  const canonical = copyCanonicalGraphData(checkpoint, "query");
  if (!canonical.ok) throw new Error("Core checkpoint was not canonical");
  return `groma-observation-handoff-v1:${createHash("sha256")
    .update(canonical.value.canonicalJson)
    .digest("hex")}`;
}

const abandonmentReasons: Readonly<
  Record<ObservationAbandonmentKind, Readonly<{ code: string; message: string }>>
> = Object.freeze({
  cancelled: Object.freeze({
    code: "observation-session-cancelled",
    message: "Observation session was cancelled before completion",
  }),
  contradictory: Object.freeze({
    code: "contradictory-observation",
    message: "Observation session reported contradictory evidence and was abandoned",
  }),
  expired: Object.freeze({
    code: "observation-session-expired",
    message: "Observation session expired before completion",
  }),
  failed: Object.freeze({
    code: "observation-session-failed",
    message: "Observation session failed before completion",
  }),
  "recovered-incomplete": Object.freeze({
    code: "observation-session-interrupted",
    message: "Interrupted observation session was abandoned during recovery",
  }),
  superseded: Object.freeze({
    code: "observation-session-superseded",
    message: "Observation session was superseded by a newer epoch",
  }),
});

function storedAbandonment(kind: ObservationAbandonmentKind): StoredAbandonment {
  const reason = abandonmentReasons[kind];
  return Object.freeze({ code: reason.code, kind, message: reason.message });
}

function nextLaneRevision(revision: number): Result<number> {
  return Number.isSafeInteger(revision) && revision >= 0 && revision < Number.MAX_SAFE_INTEGER
    ? success(revision + 1)
    : failure(
        diagnostic(
          "observation-lane-revision-exhausted",
          "Observation lane revision cannot advance safely",
        ),
      );
}

function abandonedState(
  state: StoredObservationLane,
  kind: ObservationAbandonmentKind,
): Result<StoredObservationLane> {
  const revision = nextLaneRevision(state.revision);
  return revision.ok
    ? success(
        Object.freeze({
          ...state,
          delivery: null,
          lifecycle: Object.freeze({
            reason: storedAbandonment(kind),
            state: "abandoned" as const,
          }),
          revision: revision.value,
        }),
      )
    : revision;
}

function buildState(
  session: ObservationSession,
  lane: ObservationLaneIdentity,
  revision: number,
  lifecycle: StoredLifecycle,
  delivery: StoredDelivery | null,
): StoredObservationLane {
  return Object.freeze({
    checkpoint: session.checkpoint(),
    delivery,
    lane: storedLane(lane),
    lifecycle,
    revision,
    version: 1,
  });
}

function encodeState(
  state: StoredObservationLane,
  bounds: LocalObservationJournalBounds,
): Result<Uint8Array> {
  const encoded = canonicalJson(state, bounds.maxJournalBytes);
  if (!encoded.ok) return encoded;
  const bytes = textEncoder.encode(encoded.value);
  return bytes.byteLength <= bounds.maxJournalBytes
    ? success(bytes)
    : failure(
        diagnostic("observation-journal-too-large", "Observation journal exceeds its byte bound", {
          maximum: bounds.maxJournalBytes,
        }),
      );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

function parseLifecycle(value: unknown): StoredLifecycle | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const state = (value as Record<string, unknown>).state;
  if (state === "active" || state === "completed") {
    const exact = inspectExactRecord(
      value,
      [["state"]],
      "malformed-observation-journal",
      "Observation lifecycle",
    );
    return exact.ok ? Object.freeze({ state }) : undefined;
  }
  if (state !== "abandoned") return undefined;
  const exact = inspectExactRecord(
    value,
    [["reason", "state"]],
    "malformed-observation-journal",
    "Observation lifecycle",
  );
  if (!exact.ok) return undefined;
  const reason = inspectExactRecord(
    exact.value.reason,
    [["code", "kind", "message"]],
    "malformed-observation-journal",
    "Observation abandonment",
  );
  if (!reason.ok || typeof reason.value.kind !== "string") return undefined;
  const expected = abandonmentReasons[reason.value.kind as ObservationAbandonmentKind];
  if (
    expected === undefined ||
    reason.value.code !== expected.code ||
    reason.value.message !== expected.message
  ) {
    return undefined;
  }
  return Object.freeze({
    reason: storedAbandonment(reason.value.kind as ObservationAbandonmentKind),
    state: "abandoned",
  });
}

function parseDelivery(value: unknown): StoredDelivery | null | undefined {
  if (value === null) return null;
  const exact = inspectExactRecord(
    value,
    [["state", "token"]],
    "malformed-observation-journal",
    "Observation delivery",
  );
  if (
    !exact.ok ||
    (exact.value.state !== "available" &&
      exact.value.state !== "pending" &&
      exact.value.state !== "acknowledged") ||
    typeof exact.value.token !== "string" ||
    !handoffTokenPattern.test(exact.value.token)
  ) {
    return undefined;
  }
  return Object.freeze({ state: exact.value.state, token: exact.value.token });
}

function malformedJournal(): Result<never> {
  return failure(
    diagnostic(
      "malformed-observation-journal",
      "Observation session journal is malformed or noncanonical",
    ),
  );
}

function parseState(
  bytes: Uint8Array,
  locator: WorkspaceResourceLocator,
  bounds: LocalObservationJournalBounds,
): Result<LoadedLane> {
  if (bytes.byteLength > bounds.maxJournalBytes) {
    return failure(
      diagnostic("observation-journal-too-large", "Observation journal exceeds its byte bound"),
    );
  }
  try {
    const decoded = JSON.parse(textDecoder.decode(bytes)) as unknown;
    const exact = inspectExactRecord(
      decoded,
      [["checkpoint", "delivery", "lane", "lifecycle", "revision", "version"]],
      "malformed-observation-journal",
      "Observation journal",
    );
    if (!exact.ok || exact.value.version !== 1) return malformedJournal();
    if (
      typeof exact.value.revision !== "number" ||
      !Number.isSafeInteger(exact.value.revision) ||
      exact.value.revision <= 0
    ) {
      return malformedJournal();
    }
    const laneRecord = inspectExactRecord(
      exact.value.lane,
      [["projectId", "sourceId", "sourceInstance"]],
      "malformed-observation-journal",
      "Observation stored lane",
    );
    if (
      !laneRecord.ok ||
      !safeLaneToken(laneRecord.value.projectId) ||
      !safeLaneToken(laneRecord.value.sourceId) ||
      !safeLaneToken(laneRecord.value.sourceInstance)
    ) {
      return malformedJournal();
    }
    const lane: StoredLane = Object.freeze({
      projectId: laneRecord.value.projectId,
      sourceId: laneRecord.value.sourceId,
      sourceInstance: laneRecord.value.sourceInstance,
    });
    const expectedLocator = localObservationSessionLocator(publicLane(lane));
    if (!expectedLocator.ok || expectedLocator.value !== locator) return malformedJournal();
    const restored = restoreObservationSessionCheckpoint(
      exact.value.checkpoint as ObservationSessionCheckpoint,
    );
    if (!restored.ok) return malformedJournal();
    const checkpoint = restored.value.checkpoint();
    if (
      checkpoint.begin.projectId !== lane.projectId ||
      checkpoint.begin.source.id !== lane.sourceId ||
      checkpoint.begin.source.instance !== lane.sourceInstance
    ) {
      return malformedJournal();
    }
    const lifecycle = parseLifecycle(exact.value.lifecycle);
    const delivery = parseDelivery(exact.value.delivery);
    if (lifecycle === undefined || delivery === undefined) return malformedJournal();
    const coreState = restored.value.inspect().state;
    const abandonmentMatchesCore =
      lifecycle.state !== "abandoned" ||
      (lifecycle.reason.kind === "cancelled" && coreState === "cancelled") ||
      (lifecycle.reason.kind === "expired" && coreState === "expired") ||
      (lifecycle.reason.kind === "failed" && coreState === "failed") ||
      ((lifecycle.reason.kind === "contradictory" ||
        lifecycle.reason.kind === "recovered-incomplete") &&
        coreState === "active") ||
      (lifecycle.reason.kind === "superseded" && coreState === "active");
    if (
      (lifecycle.state === "active" && (coreState !== "active" || delivery !== null)) ||
      (lifecycle.state === "completed" &&
        (coreState !== "completed" ||
          delivery === null ||
          delivery.token !== handoffToken(checkpoint))) ||
      (lifecycle.state === "abandoned" && delivery !== null) ||
      !abandonmentMatchesCore
    ) {
      return malformedJournal();
    }
    const normalized: StoredObservationLane = Object.freeze({
      checkpoint,
      delivery,
      lane,
      lifecycle,
      revision: exact.value.revision,
      version: 1,
    });
    const encoded = encodeState(normalized, bounds);
    if (!encoded.ok || !equalBytes(encoded.value, bytes)) return malformedJournal();
    return success(Object.freeze({ session: restored.value, state: normalized }));
  } catch {
    return malformedJournal();
  }
}

function resourceMissing(result: Result<unknown>): boolean {
  return (
    !result.ok &&
    result.diagnostics.length === 1 &&
    result.diagnostics[0]?.code === "resource-missing"
  );
}

function coordinationLeaseCannotBeRetried(released: Result<void>): boolean {
  if (released.ok) return false;
  return released.diagnostics.some(
    (item) =>
      item.code === "invalid-coordination-lease" ||
      item.code === "resource-coordination-ownership-lost",
  );
}

type ObservationCoordinationSlot =
  | Readonly<{ readonly state: "acquiring" | "settling" }>
  | Readonly<{
      readonly lease: LocalCoordinationLease;
      readonly state: "active" | "retained-held" | "retained-unknown";
    }>;

type CoordinationReleaseObservation =
  | Readonly<{ readonly result: Result<void>; readonly state: "confirmed" }>
  | Readonly<{ readonly state: "unknown" }>;

export function createLocalObservationJournal(
  options: LocalObservationJournalOptions,
): LocalObservationJournal {
  const bounds = resolveBounds(options.bounds);
  const coordinationSlots = new Map<string, ObservationCoordinationSlot>();

  const readLane = async (locator: WorkspaceResourceLocator): Promise<Result<LoadedLane>> => {
    const read = await options.resources.read({ locator, maxBytes: bounds.maxJournalBytes });
    if (!read.ok) return read;
    return parseState(read.value.bytes, locator, bounds);
  };

  const readOptional = async (
    locator: WorkspaceResourceLocator,
  ): Promise<Result<LoadedLane | undefined>> => {
    const read = await options.resources.read({ locator, maxBytes: bounds.maxJournalBytes });
    if (resourceMissing(read)) return success(undefined);
    if (!read.ok) return read;
    return parseState(read.value.bytes, locator, bounds);
  };

  const publish = async (
    locator: WorkspaceResourceLocator,
    state: StoredObservationLane,
  ): Promise<Result<void>> => {
    const encoded = encodeState(state, bounds);
    if (!encoded.ok) return encoded;
    const cleaned = await options.resources.cleanupReplacementStages(locator);
    if (!cleaned.ok && !resourceMissing(cleaned)) {
      return failure(
        diagnostic(
          "observation-journal-stage-cleanup-failed",
          "Abandoned observation journal replacement stages could not be cleaned up safely",
        ),
      );
    }
    const staged = await options.resources.stageReplacement(locator, encoded.value);
    if (!staged.ok) return staged;
    let committed = await options.resources.commitReplacement(staged.value);
    if (committed.state === "committed-indeterminate") {
      committed = await options.resources.commitReplacement(staged.value);
    }
    if (committed.state !== "committed") {
      await options.resources.discardReplacement(staged.value);
      return failure(
        diagnostic(
          "observation-journal-publication-unconfirmed",
          "Observation journal durability was not confirmed",
        ),
      );
    }
    const readBack = await options.resources.read({
      locator,
      maxBytes: bounds.maxJournalBytes,
    });
    if (!readBack.ok || !equalBytes(readBack.value.bytes, encoded.value)) {
      return failure(
        diagnostic(
          "observation-journal-publication-unconfirmed",
          "Observation journal durability was not confirmed",
        ),
      );
    }
    return success(undefined);
  };

  const invokeFault = async (phase: LocalObservationJournalFaultPhase): Promise<Result<void>> => {
    if (options.faultInjector === undefined) return success(undefined);
    try {
      await options.faultInjector(phase);
      return success(undefined);
    } catch {
      return failure(
        diagnostic("observation-journal-fault", "Observation journal operation was interrupted", {
          phase,
        }),
      );
    }
  };

  const coordinate = async <T>(
    locator: WorkspaceResourceLocator,
    action: () => Promise<Result<T>>,
  ): Promise<Result<T>> => {
    const key = String(locator);
    const previous = coordinationSlots.get(key);
    if (
      previous?.state === "active" ||
      previous?.state === "acquiring" ||
      previous?.state === "settling"
    ) {
      return failure(
        diagnostic(
          "resource-coordination-contended",
          "Local resource coordination is already held",
        ),
      );
    }
    const releaseOnce = async (
      lease: LocalCoordinationLease,
    ): Promise<CoordinationReleaseObservation> => {
      try {
        return Object.freeze({
          result: await options.resources.releaseCoordination(lease),
          state: "confirmed" as const,
        });
      } catch {
        return Object.freeze({ state: "unknown" as const });
      }
    };
    const releaseWithRetry = async (
      lease: LocalCoordinationLease,
    ): Promise<CoordinationReleaseObservation> => {
      let observed = await releaseOnce(lease);
      if (
        observed.state === "unknown" ||
        (!observed.result.ok && !coordinationLeaseCannotBeRetried(observed.result))
      ) {
        observed = await releaseOnce(lease);
      }
      return observed;
    };
    const releaseDiagnostic = (actionCompleted: boolean): Diagnostic =>
      diagnostic(
        "observation-journal-coordination-release-unconfirmed",
        "Observation journal coordination release was not confirmed",
        { actionCompleted },
      );

    let acquired: Result<LocalCoordinationLease> | undefined;
    if (previous?.state === "retained-held" || previous?.state === "retained-unknown") {
      coordinationSlots.set(key, Object.freeze({ state: "settling" as const }));
      const settled = await releaseWithRetry(previous.lease);
      if (settled.state === "unknown") {
        coordinationSlots.set(
          key,
          Object.freeze({ lease: previous.lease, state: "retained-unknown" as const }),
        );
        return failure(releaseDiagnostic(false));
      }
      if (!settled.result.ok && !coordinationLeaseCannotBeRetried(settled.result)) {
        coordinationSlots.set(
          key,
          Object.freeze({ lease: previous.lease, state: "retained-held" as const }),
        );
        return failure(releaseDiagnostic(false));
      } else {
        coordinationSlots.delete(key);
      }
    }
    if (acquired === undefined) {
      coordinationSlots.set(key, Object.freeze({ state: "acquiring" as const }));
      try {
        acquired = await options.resources.acquireCoordination({
          context: "local-machine",
          locator,
        });
      } catch {
        acquired = failure(
          diagnostic(
            "observation-journal-coordination-acquire-failed",
            "Observation journal coordination could not be acquired",
          ),
        );
      }
      if (!acquired.ok) coordinationSlots.delete(key);
    }
    if (!acquired.ok) return acquired;
    coordinationSlots.set(key, Object.freeze({ lease: acquired.value, state: "active" as const }));
    let actionCompleted = false;
    let actionResult: Result<T>;
    try {
      actionResult = await action();
      actionCompleted = true;
    } catch {
      actionResult = failure(
        diagnostic(
          "observation-journal-action-failed",
          "The coordinated observation journal action failed",
        ),
      );
    }
    const released = await releaseWithRetry(acquired.value);
    if (released.state === "confirmed" && released.result.ok) {
      coordinationSlots.delete(key);
      return actionResult;
    }
    if (released.state === "unknown") {
      coordinationSlots.set(
        key,
        Object.freeze({ lease: acquired.value, state: "retained-unknown" as const }),
      );
    } else if (!coordinationLeaseCannotBeRetried(released.result)) {
      coordinationSlots.set(
        key,
        Object.freeze({ lease: acquired.value, state: "retained-held" as const }),
      );
    } else {
      coordinationSlots.delete(key);
    }
    return actionResult.ok
      ? failure(releaseDiagnostic(actionCompleted))
      : failure(...actionResult.diagnostics, releaseDiagnostic(actionCompleted));
  };

  const staleLane = (): Result<never> =>
    failure(
      diagnostic(
        "stale-observation-lane",
        "Observation lane no longer matches the requested epoch or revision",
      ),
    );

  const makeHandle = (
    session: ObservationSession,
    lane: ObservationLaneIdentity,
    locator: WorkspaceResourceLocator,
    initialRevision: number,
  ): DurableObservationSession => {
    let revision = initialRevision;
    let busy = false;
    let poisoned = false;

    const run = async <T>(
      operation: () => Result<T>,
      classify: (value: T) => {
        readonly fault: LocalObservationJournalFaultPhase;
        readonly lifecycle: StoredLifecycle;
        readonly delivery: StoredDelivery | null;
      },
    ): Promise<Result<T>> => {
      if (poisoned) {
        return failure(
          diagnostic(
            "observation-session-handle-poisoned",
            "Observation session cannot continue after unconfirmed durable publication",
          ),
        );
      }
      if (busy) {
        return failure(
          diagnostic(
            "observation-session-operation-in-progress",
            "Observation session accepts only one durable operation at a time",
          ),
        );
      }
      busy = true;
      let coreApplied = false;
      try {
        const coordinated = await coordinate(locator, async () => {
          const loaded = await readLane(locator);
          if (!loaded.ok) return loaded as Result<T>;
          if (
            loaded.value.state.revision !== revision ||
            !sameLane(loaded.value.state.lane, lane) ||
            loaded.value.state.checkpoint.begin.epoch !== session.inspect().epoch ||
            handoffToken(loaded.value.state.checkpoint) !== handoffToken(session.checkpoint()) ||
            loaded.value.state.lifecycle.state !== "active"
          ) {
            return staleLane();
          }
          const prospectiveRevision = nextLaneRevision(revision);
          if (!prospectiveRevision.ok) return prospectiveRevision as Result<T>;
          const result = operation();
          if (!result.ok) {
            const contradiction = result.diagnostics.some(
              (item) => item.code === "contradictory-observation",
            );
            if (!contradiction) return result;
            const abandoned = abandonedState(loaded.value.state, "contradictory");
            if (!abandoned.ok) return abandoned as Result<T>;
            const durable = await publish(locator, abandoned.value);
            if (!durable.ok) {
              poisoned = true;
              return durable as Result<T>;
            }
            revision = abandoned.value.revision;
            const fault = await invokeFault("after-abandonment");
            if (!fault.ok) poisoned = true;
            return fault.ok ? result : (fault as Result<T>);
          }
          coreApplied = true;
          const classified = classify(result.value);
          const next = buildState(
            session,
            lane,
            prospectiveRevision.value,
            classified.lifecycle,
            classified.delivery,
          );
          const durable = await publish(locator, next);
          if (!durable.ok) {
            poisoned = true;
            return durable as Result<T>;
          }
          revision = next.revision;
          const fault = await invokeFault(classified.fault);
          if (!fault.ok) {
            poisoned = true;
            return fault as Result<T>;
          }
          return result;
        });
        if (!coordinated.ok && coreApplied) poisoned = true;
        return coordinated;
      } finally {
        busy = false;
      }
    };

    return Object.freeze({
      cancel(signal: ObservationTerminalSignal) {
        return run(
          () => session.cancel(signal),
          () => ({
            delivery: null,
            fault: "after-abandonment",
            lifecycle: Object.freeze({
              reason: storedAbandonment("cancelled"),
              state: "abandoned" as const,
            }),
          }),
        );
      },
      async complete(completion: ObservationCompletion) {
        const completed = await run(
          () => session.complete(completion),
          () => {
            const token = handoffToken(session.checkpoint());
            return {
              delivery: Object.freeze({ state: "available" as const, token }),
              fault: "after-completion" as const,
              lifecycle: Object.freeze({ state: "completed" as const }),
            };
          },
        );
        return completed.ok ? success(undefined) : completed;
      },
      expire(expiry: ObservationExpiry) {
        return run(
          () => session.expire(expiry),
          () => ({
            delivery: null,
            fault: "after-abandonment",
            lifecycle: Object.freeze({
              reason: storedAbandonment("expired"),
              state: "abandoned" as const,
            }),
          }),
        );
      },
      fail(report: ObservationFailure) {
        return run(
          () => session.fail(report),
          () => ({
            delivery: null,
            fault: "after-abandonment",
            lifecycle: Object.freeze({
              reason: storedAbandonment("failed"),
              state: "abandoned" as const,
            }),
          }),
        );
      },
      heartbeat(heartbeat: ObservationHeartbeat) {
        return run(
          () => session.heartbeat(heartbeat),
          () => ({
            delivery: null,
            fault: "after-heartbeat",
            lifecycle: Object.freeze({ state: "active" as const }),
          }),
        );
      },
      inspect: () => session.inspect(),
      submitBatch(batch: ObservationBatch) {
        return run(
          () => session.submitBatch(batch),
          () => ({
            delivery: null,
            fault: "after-batch",
            lifecycle: Object.freeze({ state: "active" as const }),
          }),
        );
      },
    });
  };

  const handoff = async (
    requestValue: ObservationLaneRequest,
  ): Promise<Result<ObservationHandoff>> => {
    const request = inspectLaneRequest(requestValue);
    if (!request.ok) return request;
    const locator = localObservationSessionLocator(laneFromRequest(request.value));
    if (!locator.ok) return locator;
    return coordinate(locator.value, async () => {
      const loaded = await readLane(locator.value);
      if (!loaded.ok) return loaded as Result<ObservationHandoff>;
      if (
        !sameLane(loaded.value.state.lane, request.value) ||
        loaded.value.state.checkpoint.begin.epoch !== request.value.epoch ||
        loaded.value.state.lifecycle.state !== "completed" ||
        loaded.value.state.delivery === null
      ) {
        return staleLane();
      }
      if (loaded.value.state.delivery.state === "acknowledged") {
        return failure(
          diagnostic(
            "observation-handoff-acknowledged",
            "Observation handoff is already acknowledged",
          ),
        );
      }
      let state = loaded.value.state;
      if (state.delivery!.state === "available") {
        const revision = nextLaneRevision(state.revision);
        if (!revision.ok) return revision as Result<ObservationHandoff>;
        state = Object.freeze({
          ...state,
          delivery: Object.freeze({ ...state.delivery!, state: "pending" as const }),
          revision: revision.value,
        });
        const durable = await publish(locator.value, state);
        if (!durable.ok) return durable as Result<ObservationHandoff>;
        const fault = await invokeFault("after-handoff");
        if (!fault.ok) return fault as Result<ObservationHandoff>;
      }
      const snapshot = loaded.value.session.snapshot();
      if (!snapshot.ok) return malformedJournal();
      return success(
        Object.freeze({
          epoch: request.value.epoch,
          lane: Object.freeze({
            projectId: request.value.projectId,
            source: request.value.source,
          }),
          snapshot: snapshot.value,
          token: state.delivery!.token,
        }),
      );
    });
  };

  const acknowledge = async (
    requestValue: ObservationHandoffAcknowledgement,
  ): Promise<Result<void>> => {
    const request = inspectExactRecord(
      requestValue,
      [["epoch", "projectId", "source", "token"]],
      "invalid-observation-handoff",
      "Observation handoff acknowledgement",
    );
    if (!request.ok || typeof request.value.token !== "string") {
      return failure(
        diagnostic("invalid-observation-handoff", "Observation handoff acknowledgement is invalid"),
      );
    }
    const laneRequest = inspectLaneRequest({
      epoch: request.value.epoch,
      projectId: request.value.projectId,
      source: request.value.source,
    });
    if (!laneRequest.ok || !handoffTokenPattern.test(request.value.token)) {
      return failure(
        diagnostic("invalid-observation-handoff", "Observation handoff acknowledgement is invalid"),
      );
    }
    const locator = localObservationSessionLocator(laneFromRequest(laneRequest.value));
    if (!locator.ok) return locator;
    return coordinate(locator.value, async () => {
      const loaded = await readLane(locator.value);
      if (!loaded.ok) return loaded as Result<void>;
      const delivery = loaded.value.state.delivery;
      if (
        !sameLane(loaded.value.state.lane, laneRequest.value) ||
        loaded.value.state.checkpoint.begin.epoch !== laneRequest.value.epoch ||
        loaded.value.state.lifecycle.state !== "completed" ||
        delivery === null ||
        delivery.token !== request.value.token
      ) {
        return staleLane();
      }
      if (delivery.state === "acknowledged") return success(undefined);
      if (delivery.state !== "pending") {
        return failure(
          diagnostic(
            "observation-handoff-not-offered",
            "Observation handoff must be offered before acknowledgement",
          ),
        );
      }
      const revision = nextLaneRevision(loaded.value.state.revision);
      if (!revision.ok) return revision;
      const next: StoredObservationLane = Object.freeze({
        ...loaded.value.state,
        delivery: Object.freeze({ ...delivery, state: "acknowledged" as const }),
        revision: revision.value,
      });
      const durable = await publish(locator.value, next);
      if (!durable.ok) return durable;
      return invokeFault("after-acknowledgement");
    });
  };

  const cleanup = async (requestValue: ObservationLaneRequest): Promise<Result<void>> => {
    const request = inspectLaneRequest(requestValue);
    if (!request.ok) return request;
    const locator = localObservationSessionLocator(laneFromRequest(request.value));
    if (!locator.ok) return locator;
    return coordinate(locator.value, async () => {
      const loaded = await readLane(locator.value);
      if (!loaded.ok) return loaded as Result<void>;
      if (
        !sameLane(loaded.value.state.lane, request.value) ||
        loaded.value.state.checkpoint.begin.epoch !== request.value.epoch
      ) {
        return staleLane();
      }
      const eligible =
        loaded.value.state.lifecycle.state === "abandoned" ||
        (loaded.value.state.lifecycle.state === "completed" &&
          loaded.value.state.delivery?.state === "acknowledged");
      if (!eligible) {
        return failure(
          diagnostic(
            "observation-session-cleanup-ineligible",
            "Only abandoned or acknowledged observation sessions may be cleaned up",
          ),
        );
      }
      let removed = await options.resources.removeResource(locator.value);
      if (removed.state === "committed-indeterminate") {
        removed = await options.resources.removeResource(locator.value);
      }
      if (removed.state !== "committed") {
        return failure(
          diagnostic(
            "observation-journal-cleanup-unconfirmed",
            "Observation journal cleanup was not confirmed",
          ),
        );
      }
      const readBack = await readOptional(locator.value);
      if (!readBack.ok || readBack.value !== undefined) {
        return failure(
          diagnostic(
            "observation-journal-cleanup-unconfirmed",
            "Observation journal cleanup was not confirmed",
          ),
        );
      }
      const cleaned = await options.resources.cleanupReplacementStages(locator.value);
      if (!cleaned.ok) {
        return failure(
          diagnostic(
            "observation-journal-stage-cleanup-failed",
            "Abandoned observation journal replacement stages could not be cleaned up safely",
          ),
        );
      }
      return invokeFault("after-cleanup");
    });
  };

  const begin = async (
    beginValue: ObservationSessionBegin,
  ): Promise<Result<DurableObservationSession>> => {
    const created = createObservationSession(beginValue, localObservationJournalSessionBounds);
    if (!created.ok) return created;
    const session = created.value;
    const lane = laneFromBegin(session.inspect());
    const locator = localObservationSessionLocator(lane);
    if (!locator.ok) return locator;
    return coordinate(locator.value, async () => {
      const existing = await readOptional(locator.value);
      if (!existing.ok) return existing as Result<DurableObservationSession>;
      let revision = 0;
      if (existing.value !== undefined) {
        if (!sameLane(existing.value.state.lane, lane)) {
          return failure(
            diagnostic(
              "observation-lane-identity-collision",
              "Observation lane locator is already bound to another source identity",
            ),
          );
        }
        revision = existing.value.state.revision;
        if (existing.value.state.checkpoint.begin.epoch === session.inspect().epoch) {
          return failure(
            diagnostic(
              "observation-epoch-already-recorded",
              "Observation epoch is already recorded for this source lane",
            ),
          );
        }
        if (
          existing.value.state.lifecycle.state === "completed" &&
          existing.value.state.delivery?.state !== "acknowledged"
        ) {
          return failure(
            diagnostic(
              "observation-completion-awaiting-acknowledgement",
              "The completed observation must be acknowledged before a newer epoch can begin",
            ),
          );
        }
        if (existing.value.state.lifecycle.state === "active") {
          const superseded = abandonedState(existing.value.state, "superseded");
          if (!superseded.ok) return superseded as Result<DurableObservationSession>;
          const durable = await publish(locator.value, superseded.value);
          if (!durable.ok) return durable as Result<DurableObservationSession>;
          revision = superseded.value.revision;
          const fault = await invokeFault("after-abandonment");
          if (!fault.ok) return fault as Result<DurableObservationSession>;
          return failure(
            diagnostic(
              "observation-session-superseded",
              "The previous observation epoch was superseded; retry the newer begin",
            ),
          );
        }
      }
      const nextRevision = nextLaneRevision(revision);
      if (!nextRevision.ok) return nextRevision as Result<DurableObservationSession>;
      const active = buildState(
        session,
        lane,
        nextRevision.value,
        Object.freeze({ state: "active" as const }),
        null,
      );
      const durable = await publish(locator.value, active);
      if (!durable.ok) return durable as Result<DurableObservationSession>;
      const fault = await invokeFault("after-begin");
      if (!fault.ok) return fault as Result<DurableObservationSession>;
      return success(makeHandle(session, lane, locator.value, active.revision));
    });
  };

  const recover = async (): Promise<Result<ObservationJournalRecovery>> => {
    const locators: WorkspaceResourceLocator[] = [];
    const seenLocators = new Set<string>();
    let cursor: ResourceContinuationCursor | undefined;
    let pages = 0;
    do {
      pages += 1;
      if (pages > bounds.maxLanes + 1) {
        return failure(
          diagnostic(
            "observation-journal-too-large",
            "Observation recovery page count exceeds its bound",
          ),
        );
      }
      const page = await options.resources.enumerate({
        ...(cursor === undefined ? {} : { cursor }),
        limit: Math.min(bounds.maxPageSize, bounds.maxLanes - locators.length),
        locator: localObservationSessionsRoot,
        maxDepth: 0,
        maxEntriesPerDirectory: bounds.maxLanes,
      });
      if (resourceMissing(page) && cursor === undefined) {
        return success(
          Object.freeze({
            abandoned: Object.freeze([]),
            acknowledged: Object.freeze([]),
            handoffs: Object.freeze([]),
          }),
        );
      }
      if (!page.ok) return page;
      if (page.value.truncatedByDepth) {
        return failure(
          diagnostic(
            "malformed-observation-journal",
            "Observation session journal contains an unexpected nested resource",
          ),
        );
      }
      for (const entry of page.value.entries) {
        if (
          entry.kind !== "file" ||
          !laneFilePattern.test(String(entry.locator)) ||
          seenLocators.has(String(entry.locator)) ||
          locators.length >= bounds.maxLanes
        ) {
          return failure(
            diagnostic(
              "malformed-observation-journal",
              "Observation session journal contains an unexpected resource",
            ),
          );
        }
        seenLocators.add(String(entry.locator));
        locators.push(entry.locator);
      }
      cursor = page.value.nextCursor;
      if (cursor !== undefined && page.value.entries.length === 0) {
        return failure(
          diagnostic(
            "malformed-observation-journal",
            "Observation recovery continuation did not make progress",
          ),
        );
      }
      if (cursor !== undefined && locators.length >= bounds.maxLanes) {
        return failure(
          diagnostic("observation-journal-too-large", "Observation lane count exceeds its bound"),
        );
      }
    } while (cursor !== undefined);

    locators.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    const abandoned: ObservationAbandonment[] = [];
    const handoffs: ObservationHandoff[] = [];
    const acknowledged: ObservationLaneRequest[] = [];
    for (const locator of locators) {
      const recovered = await coordinate(locator, async () => {
        const loaded = await readLane(locator);
        if (!loaded.ok) return loaded as Result<void>;
        let state = loaded.value.state;
        if (state.lifecycle.state === "active") {
          const abandonedStateResult = abandonedState(state, "recovered-incomplete");
          if (!abandonedStateResult.ok) return abandonedStateResult;
          state = abandonedStateResult.value;
          const durable = await publish(locator, state);
          if (!durable.ok) return durable;
          const fault = await invokeFault("after-abandonment");
          if (!fault.ok) return fault;
        }
        if (state.lifecycle.state === "abandoned") {
          const sourceFailure =
            state.lifecycle.reason.kind === "failed"
              ? loaded.value.session.inspect().failure
              : undefined;
          abandoned.push(
            Object.freeze({
              epoch: state.checkpoint.begin.epoch,
              kind: state.lifecycle.reason.kind,
              lane: publicLane(state.lane),
              reason: Object.freeze({
                code: sourceFailure?.code ?? state.lifecycle.reason.code,
                message: sourceFailure?.message ?? state.lifecycle.reason.message,
              }),
            }),
          );
          return success(undefined);
        }
        if (state.delivery?.state === "acknowledged") {
          acknowledged.push(
            Object.freeze({
              epoch: state.checkpoint.begin.epoch,
              ...publicLane(state.lane),
            }),
          );
          return success(undefined);
        }
        if (state.delivery?.state === "available") {
          const revision = nextLaneRevision(state.revision);
          if (!revision.ok) return revision;
          state = Object.freeze({
            ...state,
            delivery: Object.freeze({ ...state.delivery, state: "pending" as const }),
            revision: revision.value,
          });
          const durable = await publish(locator, state);
          if (!durable.ok) return durable;
          const fault = await invokeFault("after-handoff");
          if (!fault.ok) return fault;
        }
        const snapshot = loaded.value.session.snapshot();
        if (!snapshot.ok || state.delivery === null) return malformedJournal();
        handoffs.push(
          Object.freeze({
            epoch: state.checkpoint.begin.epoch,
            lane: publicLane(state.lane),
            snapshot: snapshot.value,
            token: state.delivery.token,
          }),
        );
        return success(undefined);
      });
      if (!recovered.ok) return recovered;
    }
    return success(
      Object.freeze({
        abandoned: Object.freeze(abandoned),
        acknowledged: Object.freeze(acknowledged),
        handoffs: Object.freeze(handoffs),
      }),
    );
  };

  return Object.freeze({ acknowledge, begin, cleanup, handoff, recover });
}
