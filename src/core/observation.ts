import { copyCanonicalGraphData, createCanonicalGraphDataCapturer } from "./payload.ts";
import { failure, type Diagnostic, type Result, success } from "./result.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "./runtime.ts";

export const observationSessionApiVersion = "groma.observation/v1" as const;
export const observationSessionCheckpointApiVersion = "groma.observation-checkpoint/v1" as const;

export type ObservationSessionState = "active" | "cancelled" | "completed" | "expired" | "failed";

export type ObservationRecordKind =
  "action" | "component-candidate" | "documentation" | "input" | "output" | "relationship";

export interface ObservationSourceIdentity {
  readonly id: string;
  readonly instance: string;
  readonly version: string;
}

export interface ObservationScopeDeclaration {
  readonly id: string;
  /** Source-relative resource root. This is evidence scope, not conceptual containment. */
  readonly resourceRoot: string;
}

export interface ObservationSessionBegin {
  readonly apiVersion: typeof observationSessionApiVersion;
  readonly epoch: string;
  readonly projectId: string;
  readonly scopes: readonly ObservationScopeDeclaration[];
  readonly source: ObservationSourceIdentity;
}

export interface ObservationReference {
  readonly key: string;
  readonly scope: string;
}

export interface ObservationResourceRange {
  /** Zero-based exclusive byte offset into the exact fingerprinted resource bytes. */
  readonly endByteExclusive: number;
  /** Zero-based inclusive byte offset into the exact fingerprinted resource bytes. */
  readonly startByte: number;
}

export interface ObservationProvenance {
  readonly fingerprint: string;
  readonly resource: string;
  readonly scope: string;
  readonly range?: ObservationResourceRange;
}

interface ObservationRecordBase {
  readonly key: string;
  readonly provenance: readonly ObservationProvenance[];
  readonly scope: string;
}

export interface ComponentCandidateObservation extends ObservationRecordBase {
  readonly kind: "component-candidate";
  readonly candidate: Readonly<{
    readonly iconDomain?: string;
    readonly label?: string;
    readonly name?: string;
    readonly summary?: string;
    readonly type?: string;
  }>;
}

export interface ComponentInputObservation extends ObservationRecordBase {
  readonly kind: "input";
  readonly component: ObservationReference;
  readonly description?: string;
  readonly name?: string;
}

export interface ComponentOutputObservation extends ObservationRecordBase {
  readonly kind: "output";
  readonly component: ObservationReference;
  readonly description?: string;
  readonly name?: string;
}

export interface ComponentActionObservation extends ObservationRecordBase {
  readonly kind: "action";
  readonly component: ObservationReference;
  readonly description?: string;
  readonly name?: string;
}

export interface RelationshipObservation extends ObservationRecordBase {
  readonly kind: "relationship";
  readonly from: ObservationReference;
  readonly relationshipType: string;
  readonly to: ObservationReference;
}

export interface DocumentationObservation extends ObservationRecordBase {
  readonly kind: "documentation";
  readonly content: string;
  readonly format: "markdown" | "text";
  readonly subject?: ObservationReference;
}

export type ObservationRecord =
  | ComponentActionObservation
  | ComponentCandidateObservation
  | ComponentInputObservation
  | ComponentOutputObservation
  | DocumentationObservation
  | RelationshipObservation;

export interface ObservationBatch {
  readonly epoch: string;
  readonly records: readonly ObservationRecord[];
  readonly sequence: number;
}

export interface ObservationHeartbeat {
  readonly epoch: string;
  readonly sequence: number;
}

export interface ObservationCoverage {
  readonly kinds: readonly ObservationRecordKind[];
  readonly scope: string;
  readonly state: "complete" | "partial";
}

export interface ObservationCompletion {
  readonly coverage: readonly ObservationCoverage[];
  readonly epoch: string;
  readonly sequence: number;
}

export interface ObservationFailure {
  readonly epoch: string;
  readonly reason: ObservationFailureReason;
  readonly sequence: number;
}

export interface ObservationFailureReason {
  readonly code: string;
  readonly message: string;
}

export interface ObservationTerminalSignal {
  readonly epoch: string;
  readonly sequence: number;
}

export interface ObservationExpiry {
  readonly epoch: string;
  /** The host's last observed heartbeat. Core never consults a clock. */
  readonly heartbeatSequence: number;
}

export interface ObservationBatchReceipt {
  readonly acceptedRecords: number;
  readonly replayedRecords: number;
  readonly sequence: number;
  readonly totalRecords: number;
}

export interface ObservationSessionInspection {
  readonly apiVersion: typeof observationSessionApiVersion;
  readonly batchCount: number;
  readonly canonicalCharacters: number;
  readonly epoch: string;
  readonly failure?: ObservationFailureReason;
  readonly lastHeartbeatSequence: number;
  readonly lastSequence: number;
  readonly projectId: string;
  readonly recordCount: number;
  readonly scopes: readonly ObservationScopeDeclaration[];
  readonly signalCount: number;
  readonly source: ObservationSourceIdentity;
  readonly state: ObservationSessionState;
}

export interface CompletedObservationSnapshot {
  readonly apiVersion: typeof observationSessionApiVersion;
  readonly coverage: readonly ObservationCoverage[];
  readonly epoch: string;
  readonly projectId: string;
  readonly records: readonly ObservationRecord[];
  readonly scopes: readonly ObservationScopeDeclaration[];
  readonly source: ObservationSourceIdentity;
}

export type ObservationSessionCheckpointTransition =
  | Readonly<{
      readonly records: readonly ObservationRecord[];
      readonly sequence: number;
      readonly type: "batch";
    }>
  | Readonly<{ readonly sequence: number; readonly type: "cancel" }>
  | Readonly<{
      readonly coverage: readonly ObservationCoverage[];
      readonly sequence: number;
      readonly type: "complete";
    }>
  | Readonly<{ readonly heartbeatSequence: number; readonly type: "expire" }>
  | Readonly<{
      readonly reason: ObservationFailureReason;
      readonly sequence: number;
      readonly type: "fail";
    }>
  | Readonly<{ readonly sequence: number; readonly type: "heartbeat" }>;

/**
 * Core-owned compact recovery evidence. It contains accepted state transitions, not
 * caller batches or any persistence/layout policy.
 */
export interface ObservationSessionCheckpoint {
  readonly apiVersion: typeof observationSessionCheckpointApiVersion;
  readonly begin: ObservationSessionBegin;
  readonly bounds: ObservationSessionBounds;
  readonly transitions: readonly ObservationSessionCheckpointTransition[];
}

export interface ObservationSession {
  cancel(signal: ObservationTerminalSignal): Result<void>;
  checkpoint(): ObservationSessionCheckpoint;
  complete(completion: ObservationCompletion): Result<CompletedObservationSnapshot>;
  expire(expiry: ObservationExpiry): Result<void>;
  fail(report: ObservationFailure): Result<void>;
  heartbeat(heartbeat: ObservationHeartbeat): Result<void>;
  inspect(): ObservationSessionInspection;
  snapshot(): Result<CompletedObservationSnapshot>;
  submitBatch(batch: ObservationBatch): Result<ObservationBatchReceipt>;
}

export interface ObservationSessionBounds {
  readonly maxBatchRecords: number;
  readonly maxBatches: number;
  readonly maxCanonicalCharacters: number;
  readonly maxCoverageEntries: number;
  readonly maxProvenancePerRecord: number;
  readonly maxRecords: number;
  readonly maxResourceCharacters: number;
  readonly maxScopes: number;
  readonly maxSignals: number;
  readonly maxTextCharacters: number;
  readonly maxTokenCharacters: number;
}

export const defaultObservationSessionBounds: ObservationSessionBounds = Object.freeze({
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

const boundsCeilings: ObservationSessionBounds = Object.freeze({
  maxBatchRecords: 100_000,
  maxBatches: 1_000_000,
  maxCanonicalCharacters: 2_147_483_647,
  maxCoverageEntries: 100_000,
  maxProvenancePerRecord: 1_024,
  maxRecords: 1_000_000,
  maxResourceCharacters: 64 * 1024,
  maxScopes: 10_000,
  maxSignals: 10_000_000,
  maxTextCharacters: 16 * 1024 * 1024,
  maxTokenCharacters: 4_096,
});

interface StoredObservationRecord {
  readonly canonical: string;
  readonly value: ObservationRecord;
}

interface MutableSessionState {
  batchCount: number;
  canonicalCharacters: number;
  completed?: CompletedObservationSnapshot;
  failure?: ObservationFailureReason;
  lastHeartbeatSequence: number;
  lastSequence: number;
  readonly records: Map<string, StoredObservationRecord>;
  signalCount: number;
  state: ObservationSessionState;
}

const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
const exactVersionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const canonicalEntityIdPattern = /^ent_[0-9a-f]{32}$/;
const canonicalRelationIdPattern = /^rel_[0-9a-f]{32}$/;
const fingerprintPattern = /^[a-z][a-z0-9.-]*:[A-Za-z0-9_-]+$/;

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze(
    details === undefined
      ? { code, message }
      : { code, details: Object.freeze({ ...details }), message },
  );
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

function resolveBounds(bounds?: Partial<ObservationSessionBounds>): ObservationSessionBounds {
  const resolved: Record<keyof ObservationSessionBounds, number> = {} as Record<
    keyof ObservationSessionBounds,
    number
  >;
  for (const name of Object.keys(defaultObservationSessionBounds) as Array<
    keyof ObservationSessionBounds
  >) {
    let configuredValue: number | undefined;
    if (bounds !== undefined) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(bounds, name);
      } catch {
        throw new TypeError(`Observation session bound ${name} could not be inspected safely`);
      }
      if (descriptor !== undefined) {
        if (!("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError(
            `Observation session bound ${name} must be an enumerable data property`,
          );
        }
        configuredValue = descriptor.value as number;
      }
    }
    resolved[name] = configuredBound(
      configuredValue,
      defaultObservationSessionBounds[name],
      boundsCeilings[name],
      name,
    );
  }
  if (resolved.maxBatchRecords > resolved.maxRecords) {
    throw new RangeError("maxBatchRecords must not exceed maxRecords");
  }
  if (resolved.maxCoverageEntries < resolved.maxScopes) {
    throw new RangeError("maxCoverageEntries must be at least maxScopes");
  }
  return Object.freeze(resolved);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validToken(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    tokenPattern.test(value)
  );
}

function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

function validResourceLocator(value: unknown, maximum: number): value is string {
  return (
    validText(value, maximum) &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    (value === "." ||
      (!/[\\]/.test(value) &&
        !/^(?:\/|[A-Za-z]:)/.test(value) &&
        !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")))
  );
}

function resourceWithinScope(resource: string, resourceRoot: string): boolean {
  return (
    resourceRoot === "." || resource === resourceRoot || resource.startsWith(`${resourceRoot}/`)
  );
}

function validSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function inspectArray(
  value: unknown,
  maximum: number,
  code: string,
  subject: string,
): Result<readonly unknown[]> {
  const length = inspectIntrinsicArrayLength(value, code, subject);
  if (!length.ok) return length;
  if (length.value > maximum) {
    return failure(
      diagnostic(code, `${subject} exceeds its configured bound`, {
        maximum,
        received: length.value,
      }),
    );
  }
  try {
    const source = value as unknown[];
    const copied: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const key = String(index);
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(diagnostic(code, `${subject} items must be enumerable data properties`));
      }
      copied.push(descriptor.value);
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(diagnostic(code, `${subject} could not be inspected safely`));
  }
}

function inspectRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  code: string,
  subject: string,
): Result<Readonly<Record<string, unknown>>> {
  const accepted = new Set([...required, ...optional]);
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return failure(diagnostic(code, `${subject} must be a plain record`));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return failure(
        diagnostic(code, `${subject} must use the intrinsic Object prototype or null`),
      );
    }
    const copied: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of accepted) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) continue;
      if (!("value" in descriptor) || !descriptor.enumerable) {
        return failure(diagnostic(code, `${subject} fields must be enumerable data properties`));
      }
      Object.defineProperty(copied, key, { enumerable: true, value: descriptor.value });
    }
    if (required.some((key) => !Object.hasOwn(copied, key))) {
      return failure(diagnostic(code, `${subject} keys do not match the public contract`));
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(diagnostic(code, `${subject} could not be inspected safely`));
  }
}

function invalidBegin(reason: string): Result<never> {
  return failure(
    diagnostic("invalid-observation-begin", "Observation session begin is invalid", { reason }),
  );
}

function inspectSource(
  value: unknown,
  bounds: ObservationSessionBounds,
): Result<ObservationSourceIdentity> {
  const inspected = inspectRecord(
    value,
    ["id", "instance", "version"],
    [],
    "invalid-observation-begin",
    "Observation source identity",
  );
  if (!inspected.ok) return invalidBegin("source identity has an invalid shape");
  if (
    !validToken(inspected.value.id, bounds.maxTokenCharacters) ||
    !validToken(inspected.value.instance, bounds.maxTokenCharacters) ||
    typeof inspected.value.version !== "string" ||
    inspected.value.version.length > bounds.maxTokenCharacters ||
    !exactVersionPattern.test(inspected.value.version)
  ) {
    return invalidBegin("source identity has invalid values");
  }
  return success(
    Object.freeze({
      id: inspected.value.id,
      instance: inspected.value.instance,
      version: inspected.value.version,
    }),
  );
}

function inspectScope(
  value: unknown,
  bounds: ObservationSessionBounds,
): Result<ObservationScopeDeclaration> {
  const inspected = inspectRecord(
    value,
    ["id", "resourceRoot"],
    [],
    "invalid-observation-begin",
    "Observation scope",
  );
  if (!inspected.ok) return invalidBegin("scope has an invalid shape");
  if (
    !validToken(inspected.value.id, bounds.maxTokenCharacters) ||
    !validResourceLocator(inspected.value.resourceRoot, bounds.maxResourceCharacters)
  ) {
    return invalidBegin("scope has invalid values");
  }
  return success(
    Object.freeze({ id: inspected.value.id, resourceRoot: inspected.value.resourceRoot }),
  );
}

function inspectBegin(
  value: unknown,
  bounds: ObservationSessionBounds,
): Result<ObservationSessionBegin> {
  const inspected = inspectRecord(
    value,
    ["apiVersion", "epoch", "projectId", "scopes", "source"],
    [],
    "invalid-observation-begin",
    "Observation session begin",
  );
  if (!inspected.ok) return invalidBegin("begin has an invalid shape");
  if (inspected.value.apiVersion !== observationSessionApiVersion) {
    return invalidBegin("apiVersion is unsupported");
  }
  if (
    !validToken(inspected.value.epoch, bounds.maxTokenCharacters) ||
    !validToken(inspected.value.projectId, bounds.maxTokenCharacters)
  ) {
    return invalidBegin("project or epoch identity is invalid");
  }
  const source = inspectSource(inspected.value.source, bounds);
  if (!source.ok) return source;
  const scopes = inspectArray(
    inspected.value.scopes,
    bounds.maxScopes,
    "invalid-observation-begin",
    "Observation scopes",
  );
  if (!scopes.ok || scopes.value.length === 0) {
    return invalidBegin("at least one bounded scope is required");
  }
  const copiedScopes: ObservationScopeDeclaration[] = [];
  const seen = new Set<string>();
  for (const candidate of scopes.value) {
    const scope = inspectScope(candidate, bounds);
    if (!scope.ok) return scope;
    if (seen.has(scope.value.id)) return invalidBegin("scope identities must be unique");
    seen.add(scope.value.id);
    copiedScopes.push(scope.value);
  }
  copiedScopes.sort((left, right) => compareCodeUnits(left.id, right.id));
  return success(
    Object.freeze({
      apiVersion: observationSessionApiVersion,
      epoch: inspected.value.epoch,
      projectId: inspected.value.projectId,
      scopes: Object.freeze(copiedScopes),
      source: source.value,
    }),
  );
}

function invalidRecord(reason: string, index: number): Result<never> {
  return failure(
    diagnostic("invalid-observation-record", "Observation record is invalid", { index, reason }),
  );
}

function inspectKey(
  value: unknown,
  bounds: ObservationSessionBounds,
  index: number,
): Result<string> {
  if (
    !validToken(value, bounds.maxTokenCharacters) ||
    canonicalEntityIdPattern.test(value) ||
    canonicalRelationIdPattern.test(value)
  ) {
    return failure(
      diagnostic(
        "invalid-observation-key",
        "Observation keys must be bounded source-local tokens, never canonical graph identities",
        { index },
      ),
    );
  }
  return success(value);
}

function declaredScope(
  value: unknown,
  scopeIds: ReadonlySet<string>,
  bounds: ObservationSessionBounds,
  index: number,
): Result<string> {
  if (!validToken(value, bounds.maxTokenCharacters) || !scopeIds.has(value)) {
    return failure(
      diagnostic("undeclared-observation-scope", "Observation references an undeclared scope", {
        index,
      }),
    );
  }
  return success(value);
}

function inspectReference(
  value: unknown,
  scopeIds: ReadonlySet<string>,
  bounds: ObservationSessionBounds,
  index: number,
): Result<ObservationReference> {
  const inspected = inspectRecord(
    value,
    ["key", "scope"],
    [],
    "invalid-observation-record",
    "Observation reference",
  );
  if (!inspected.ok) return invalidRecord("reference has an invalid shape", index);
  const key = inspectKey(inspected.value.key, bounds, index);
  if (!key.ok) return key;
  const scope = declaredScope(inspected.value.scope, scopeIds, bounds, index);
  if (!scope.ok) return scope;
  return success(Object.freeze({ key: key.value, scope: scope.value }));
}

function inspectRange(value: unknown, index: number): Result<ObservationResourceRange> {
  const inspected = inspectRecord(
    value,
    ["endByteExclusive", "startByte"],
    [],
    "invalid-observation-provenance",
    "Observation provenance range",
  );
  if (!inspected.ok) {
    return failure(
      diagnostic("invalid-observation-provenance", "Observation provenance is invalid", { index }),
    );
  }
  const { endByteExclusive, startByte } = inspected.value;
  if (
    typeof startByte !== "number" ||
    !Number.isSafeInteger(startByte) ||
    startByte < 0 ||
    typeof endByteExclusive !== "number" ||
    !Number.isSafeInteger(endByteExclusive) ||
    endByteExclusive < startByte
  ) {
    return failure(
      diagnostic("invalid-observation-provenance", "Observation provenance is invalid", { index }),
    );
  }
  return success(Object.freeze({ endByteExclusive, startByte }));
}

function inspectProvenance(
  value: unknown,
  recordScope: string,
  scopeIds: ReadonlySet<string>,
  scopeRoots: ReadonlyMap<string, string>,
  bounds: ObservationSessionBounds,
  index: number,
): Result<ObservationProvenance> {
  const inspected = inspectRecord(
    value,
    ["fingerprint", "resource", "scope"],
    ["range"],
    "invalid-observation-provenance",
    "Observation provenance",
  );
  if (!inspected.ok) {
    return failure(
      diagnostic("invalid-observation-provenance", "Observation provenance is invalid", { index }),
    );
  }
  const scope = declaredScope(inspected.value.scope, scopeIds, bounds, index);
  if (!scope.ok || scope.value !== recordScope) {
    return failure(
      diagnostic(
        "invalid-observation-provenance",
        "Observation provenance must be bound to the record's declared scope",
        { index },
      ),
    );
  }
  if (
    !validResourceLocator(inspected.value.resource, bounds.maxResourceCharacters) ||
    !resourceWithinScope(inspected.value.resource, scopeRoots.get(recordScope)!) ||
    typeof inspected.value.fingerprint !== "string" ||
    inspected.value.fingerprint.length > bounds.maxTokenCharacters ||
    !fingerprintPattern.test(inspected.value.fingerprint)
  ) {
    return failure(
      diagnostic("invalid-observation-provenance", "Observation provenance is invalid", { index }),
    );
  }
  let range: ObservationResourceRange | undefined;
  if ("range" in inspected.value) {
    const parsed = inspectRange(inspected.value.range, index);
    if (!parsed.ok) return parsed;
    range = parsed.value;
  }
  return success(
    Object.freeze({
      fingerprint: inspected.value.fingerprint,
      resource: inspected.value.resource,
      ...(range === undefined ? {} : { range }),
      scope: scope.value,
    }),
  );
}

function inspectProvenances(
  value: unknown,
  recordScope: string,
  scopeIds: ReadonlySet<string>,
  scopeRoots: ReadonlyMap<string, string>,
  bounds: ObservationSessionBounds,
  index: number,
): Result<readonly ObservationProvenance[]> {
  const list = inspectArray(
    value,
    bounds.maxProvenancePerRecord,
    "invalid-observation-provenance",
    "Observation provenance list",
  );
  if (!list.ok || list.value.length === 0) {
    return failure(
      diagnostic(
        "invalid-observation-provenance",
        "Every observation requires nonempty bounded provenance",
        { index },
      ),
    );
  }
  const copied: ObservationProvenance[] = [];
  const seen = new Set<string>();
  for (const candidate of list.value) {
    const provenance = inspectProvenance(
      candidate,
      recordScope,
      scopeIds,
      scopeRoots,
      bounds,
      index,
    );
    if (!provenance.ok) return provenance;
    const range = provenance.value.range;
    const key = `${provenance.value.resource}\u0000${provenance.value.fingerprint}\u0000${range?.startByte ?? ""}\u0000${range?.endByteExclusive ?? ""}`;
    if (seen.has(key)) {
      return failure(
        diagnostic("invalid-observation-provenance", "Observation provenance is duplicated", {
          index,
        }),
      );
    }
    seen.add(key);
    copied.push(provenance.value);
  }
  copied.sort((left, right) => {
    const leftKey = `${left.resource}\u0000${left.fingerprint}\u0000${left.range?.startByte ?? ""}\u0000${left.range?.endByteExclusive ?? ""}`;
    const rightKey = `${right.resource}\u0000${right.fingerprint}\u0000${right.range?.startByte ?? ""}\u0000${right.range?.endByteExclusive ?? ""}`;
    return compareCodeUnits(leftKey, rightKey);
  });
  return success(Object.freeze(copied));
}

function inspectCandidate(
  value: unknown,
  bounds: ObservationSessionBounds,
  index: number,
): Result<ComponentCandidateObservation["candidate"]> {
  const inspected = inspectRecord(
    value,
    [],
    ["iconDomain", "label", "name", "summary", "type"],
    "invalid-observation-record",
    "Component candidate",
  );
  if (!inspected.ok) return invalidRecord("component candidate has an invalid shape", index);
  const copied: Record<string, string> = {};
  const orderedFields = ["iconDomain", "label", "name", "summary", "type"] as const;
  for (const key of orderedFields) {
    if (!Object.hasOwn(inspected.value, key)) continue;
    const candidate = inspected.value[key];
    const maximum = key === "summary" ? bounds.maxTextCharacters : bounds.maxTokenCharacters;
    if (!validText(candidate, maximum)) {
      return invalidRecord(`component candidate ${key} is invalid`, index);
    }
    copied[key] = candidate;
  }
  return success(Object.freeze(copied));
}

function inspectRecordValue(
  value: unknown,
  scopeIds: ReadonlySet<string>,
  scopeRoots: ReadonlyMap<string, string>,
  bounds: ObservationSessionBounds,
  index: number,
): Result<StoredObservationRecord> {
  const base = inspectRecord(
    value,
    ["key", "kind", "provenance", "scope"],
    [
      "candidate",
      "component",
      "content",
      "description",
      "format",
      "from",
      "name",
      "relationshipType",
      "subject",
      "to",
    ],
    "invalid-observation-record",
    "Observation record",
  );
  if (!base.ok) return invalidRecord("record has an invalid shape", index);
  const key = inspectKey(base.value.key, bounds, index);
  if (!key.ok) return key;
  const scope = declaredScope(base.value.scope, scopeIds, bounds, index);
  if (!scope.ok) return scope;
  const provenance = inspectProvenances(
    base.value.provenance,
    scope.value,
    scopeIds,
    scopeRoots,
    bounds,
    index,
  );
  if (!provenance.ok) return provenance;

  let record: ObservationRecord;
  const kind = base.value.kind;
  if (kind === "component-candidate") {
    const shape = inspectRecord(
      value,
      ["candidate", "key", "kind", "provenance", "scope"],
      [],
      "invalid-observation-record",
      "Component candidate observation",
    );
    if (!shape.ok) return invalidRecord("component candidate has an invalid shape", index);
    const candidate = inspectCandidate(shape.value.candidate, bounds, index);
    if (!candidate.ok) return candidate;
    record = Object.freeze({
      candidate: candidate.value,
      key: key.value,
      kind,
      provenance: provenance.value,
      scope: scope.value,
    });
  } else if (kind === "input" || kind === "output" || kind === "action") {
    const shape = inspectRecord(
      value,
      ["component", "key", "kind", "provenance", "scope"],
      ["description", "name"],
      "invalid-observation-record",
      "Component member observation",
    );
    if (!shape.ok) return invalidRecord("component member has an invalid shape", index);
    const component = inspectReference(shape.value.component, scopeIds, bounds, index);
    if (!component.ok) return component;
    if ("name" in shape.value && !validText(shape.value.name, bounds.maxTokenCharacters)) {
      return invalidRecord("component member name is invalid", index);
    }
    let description: string | undefined;
    if ("description" in shape.value) {
      if (!validText(shape.value.description, bounds.maxTextCharacters)) {
        return invalidRecord("component member description is invalid", index);
      }
      description = shape.value.description;
    }
    const name = "name" in shape.value ? (shape.value.name as string) : undefined;
    record = Object.freeze({
      component: component.value,
      ...(description === undefined ? {} : { description }),
      key: key.value,
      kind,
      ...(name === undefined ? {} : { name }),
      provenance: provenance.value,
      scope: scope.value,
    });
  } else if (kind === "relationship") {
    const shape = inspectRecord(
      value,
      ["from", "key", "kind", "provenance", "relationshipType", "scope", "to"],
      [],
      "invalid-observation-record",
      "Relationship observation",
    );
    if (!shape.ok) return invalidRecord("relationship has an invalid shape", index);
    const from = inspectReference(shape.value.from, scopeIds, bounds, index);
    if (!from.ok) return from;
    const to = inspectReference(shape.value.to, scopeIds, bounds, index);
    if (!to.ok) return to;
    if (!validToken(shape.value.relationshipType, bounds.maxTokenCharacters)) {
      return invalidRecord("relationship type is invalid", index);
    }
    record = Object.freeze({
      from: from.value,
      key: key.value,
      kind,
      provenance: provenance.value,
      relationshipType: shape.value.relationshipType,
      scope: scope.value,
      to: to.value,
    });
  } else if (kind === "documentation") {
    const shape = inspectRecord(
      value,
      ["content", "format", "key", "kind", "provenance", "scope"],
      ["subject"],
      "invalid-observation-record",
      "Documentation observation",
    );
    if (!shape.ok) return invalidRecord("documentation evidence has an invalid shape", index);
    if (
      !validText(shape.value.content, bounds.maxTextCharacters) ||
      (shape.value.format !== "markdown" && shape.value.format !== "text")
    ) {
      return invalidRecord("documentation content or format is invalid", index);
    }
    let subject: ObservationReference | undefined;
    if ("subject" in shape.value) {
      const reference = inspectReference(shape.value.subject, scopeIds, bounds, index);
      if (!reference.ok) return reference;
      subject = reference.value;
    }
    record = Object.freeze({
      content: shape.value.content,
      format: shape.value.format,
      key: key.value,
      kind,
      provenance: provenance.value,
      scope: scope.value,
      ...(subject === undefined ? {} : { subject }),
    });
  } else {
    return invalidRecord("record kind is unsupported", index);
  }

  const canonical = copyCanonicalGraphData(record, "query", {
    code: "observation-record-too-large",
    maximum: bounds.maxCanonicalCharacters,
    message: "Observation record exceeds its canonical character bound",
  });
  if (!canonical.ok) return failure(...canonical.diagnostics);
  return success(Object.freeze({ canonical: canonical.value.canonicalJson, value: record }));
}

function qualifiedKey(scope: string, key: string): string {
  return `${scope}\u0000${key}`;
}

function stableEpoch(
  value: unknown,
  begin: ObservationSessionBegin,
  bounds: ObservationSessionBounds,
): Result<void> {
  if (!validToken(value, bounds.maxTokenCharacters) || value !== begin.epoch) {
    return failure(
      diagnostic("stale-observation-epoch", "Observation signal does not match the active epoch"),
    );
  }
  return success(undefined);
}

function activeState(state: MutableSessionState): Result<void> {
  if (state.state === "active") return success(undefined);
  return failure(
    diagnostic(
      "observation-session-terminal",
      "Observation session rejects signals after reaching a terminal state",
      { state: state.state },
    ),
  );
}

function nextSequence(
  value: unknown,
  state: MutableSessionState,
  bounds: ObservationSessionBounds,
  terminal: boolean,
): Result<number> {
  if (
    state.signalCount >= bounds.maxSignals ||
    (!terminal && state.signalCount >= bounds.maxSignals - 1)
  ) {
    return failure(
      diagnostic(
        "observation-session-too-large",
        terminal
          ? "Observation session exceeds its signal bound"
          : "Observation session reserves its final bounded signal for termination",
        { maximum: bounds.maxSignals },
      ),
    );
  }
  if (
    !validSequence(value) ||
    value <= state.lastSequence ||
    (!terminal && value >= Number.MAX_SAFE_INTEGER)
  ) {
    return failure(
      diagnostic("invalid-observation-session", "Observation sequence must advance monotonically", {
        lastSequence: state.lastSequence,
      }),
    );
  }
  return success(value);
}

function inspectSignal(
  value: unknown,
  acceptedKeys: readonly string[],
  begin: ObservationSessionBegin,
  bounds: ObservationSessionBounds,
  state: MutableSessionState,
  subject: string,
): Result<Readonly<Record<string, unknown>>> {
  const active = activeState(state);
  if (!active.ok) return active;
  const inspected = inspectRecord(value, acceptedKeys, [], "invalid-observation-session", subject);
  if (!inspected.ok) return inspected;
  const epoch = stableEpoch(inspected.value.epoch, begin, bounds);
  if (!epoch.ok) return epoch;
  return inspected;
}

function inspectCoverage(
  value: unknown,
  begin: ObservationSessionBegin,
  bounds: ObservationSessionBounds,
): Result<readonly ObservationCoverage[]> {
  const list = inspectArray(
    value,
    bounds.maxCoverageEntries,
    "invalid-observation-session",
    "Observation coverage",
  );
  if (!list.ok) return list;
  if (list.value.length !== begin.scopes.length) {
    return failure(
      diagnostic(
        "invalid-observation-session",
        "Completion must report coverage exactly once for every declared scope",
      ),
    );
  }
  const scopeIds = new Set(begin.scopes.map((scope) => scope.id));
  const copied: ObservationCoverage[] = [];
  const seenScopes = new Set<string>();
  const allKinds: readonly ObservationRecordKind[] = Object.freeze([
    "action",
    "component-candidate",
    "documentation",
    "input",
    "output",
    "relationship",
  ]);
  const allowedKinds = new Set<string>(allKinds);
  for (let index = 0; index < list.value.length; index += 1) {
    const inspected = inspectRecord(
      list.value[index],
      ["kinds", "scope", "state"],
      [],
      "invalid-observation-session",
      "Observation coverage entry",
    );
    if (!inspected.ok) return inspected;
    const scope = declaredScope(inspected.value.scope, scopeIds, bounds, index);
    if (!scope.ok) return scope;
    if (seenScopes.has(scope.value)) {
      return failure(
        diagnostic("invalid-observation-session", "Coverage scope is duplicated", { index }),
      );
    }
    if (inspected.value.state !== "complete" && inspected.value.state !== "partial") {
      return failure(
        diagnostic("invalid-observation-session", "Coverage state is invalid", { index }),
      );
    }
    const kinds = inspectArray(
      inspected.value.kinds,
      allKinds.length,
      "invalid-observation-session",
      "Observation coverage kinds",
    );
    if (!kinds.ok) return kinds;
    const seenKinds = new Set<string>();
    const copiedKinds: ObservationRecordKind[] = [];
    for (const kind of kinds.value) {
      if (typeof kind !== "string" || !allowedKinds.has(kind) || seenKinds.has(kind)) {
        return failure(
          diagnostic("invalid-observation-session", "Coverage kinds are invalid or duplicated", {
            index,
          }),
        );
      }
      seenKinds.add(kind);
      copiedKinds.push(kind as ObservationRecordKind);
    }
    copiedKinds.sort(compareCodeUnits);
    seenScopes.add(scope.value);
    copied.push(
      Object.freeze({
        kinds: Object.freeze(copiedKinds),
        scope: scope.value,
        state: inspected.value.state,
      }),
    );
  }
  copied.sort((left, right) => compareCodeUnits(left.scope, right.scope));
  return success(Object.freeze(copied));
}

function inspectFailureReason(
  value: unknown,
  bounds: ObservationSessionBounds,
): Result<ObservationFailureReason> {
  const inspected = inspectRecord(
    value,
    ["code", "message"],
    [],
    "invalid-observation-session",
    "Observation failure reason",
  );
  if (
    !inspected.ok ||
    !validToken(inspected.value.code, bounds.maxTokenCharacters) ||
    !validText(inspected.value.message, bounds.maxTextCharacters)
  ) {
    return failure(
      diagnostic("invalid-observation-session", "Observation failure reason is invalid"),
    );
  }
  return success(
    Object.freeze({
      code: inspected.value.code,
      message: inspected.value.message,
    }),
  );
}

function invalidCheckpoint(reason: string): Result<never> {
  return failure(
    diagnostic("invalid-observation-checkpoint", "Observation checkpoint is invalid", { reason }),
  );
}

function inspectCheckpointBounds(value: unknown): Result<ObservationSessionBounds> {
  const names = Object.keys(defaultObservationSessionBounds) as Array<
    keyof ObservationSessionBounds
  >;
  const inspected = inspectExactRecord(
    value,
    [names],
    "invalid-observation-checkpoint",
    "Observation checkpoint bounds",
  );
  if (!inspected.ok) return invalidCheckpoint("bounds have an invalid shape");
  const copied: Partial<ObservationSessionBounds> = {};
  for (const name of names) {
    Object.defineProperty(copied, name, {
      enumerable: true,
      value: inspected.value[name],
    });
  }
  try {
    return success(resolveBounds(copied));
  } catch {
    return invalidCheckpoint("bounds have invalid values");
  }
}

function checkpointTransitionShape(value: unknown): Result<Readonly<Record<string, unknown>>> {
  const inspected = inspectExactRecord(
    value,
    [
      ["records", "sequence", "type"],
      ["sequence", "type"],
      ["coverage", "sequence", "type"],
      ["heartbeatSequence", "type"],
      ["reason", "sequence", "type"],
    ],
    "invalid-observation-checkpoint",
    "Observation checkpoint transition",
  );
  if (!inspected.ok) return invalidCheckpoint("transition has an invalid shape");
  const transition = inspected.value;
  const matchesType =
    (transition.type === "batch" && Object.hasOwn(transition, "records")) ||
    ((transition.type === "cancel" || transition.type === "heartbeat") &&
      Object.hasOwn(transition, "sequence")) ||
    (transition.type === "complete" && Object.hasOwn(transition, "coverage")) ||
    (transition.type === "expire" && Object.hasOwn(transition, "heartbeatSequence")) ||
    (transition.type === "fail" && Object.hasOwn(transition, "reason"));
  return matchesType ? success(transition) : invalidCheckpoint("transition type is unsupported");
}

function inspectCheckpointTransitions(value: unknown, maximum: number): Result<readonly unknown[]> {
  const length = inspectIntrinsicArrayLength(
    value,
    "invalid-observation-checkpoint",
    "Observation checkpoint transitions",
  );
  if (!length.ok || length.value > maximum) {
    return invalidCheckpoint("transitions have an invalid shape or size");
  }
  try {
    const source = value as unknown[];
    const keys = Reflect.ownKeys(source);
    const keySet = new Set(keys);
    if (keys.length !== length.value + 1 || !keySet.has("length")) {
      return invalidCheckpoint("transitions array has extra or missing properties");
    }
    const copied: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const key = String(index);
      if (!keySet.has(key)) return invalidCheckpoint("transitions array is sparse");
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return invalidCheckpoint("transition items must be enumerable data properties");
      }
      copied.push(descriptor.value);
    }
    return success(Object.freeze(copied));
  } catch {
    return invalidCheckpoint("transitions could not be inspected safely");
  }
}

function saturatingCheckpointSum(...values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (value >= Number.MAX_SAFE_INTEGER - total) return Number.MAX_SAFE_INTEGER;
    total += value;
  }
  return total;
}

function saturatingCheckpointProduct(left: number, right: number): number {
  return left > Number.MAX_SAFE_INTEGER / right ? Number.MAX_SAFE_INTEGER : left * right;
}

function checkpointCaptureBudgets(bounds: ObservationSessionBounds): Readonly<{
  beginCharacters: number;
  beginValues: number;
  transitionCharacters: number;
  transitionValues: number;
}> {
  const beginCharacters = saturatingCheckpointSum(
    1_024,
    saturatingCheckpointProduct(
      bounds.maxScopes,
      saturatingCheckpointSum(
        saturatingCheckpointProduct(bounds.maxResourceCharacters, 6),
        saturatingCheckpointProduct(bounds.maxTokenCharacters, 6),
        128,
      ),
    ),
    saturatingCheckpointProduct(bounds.maxTokenCharacters, 48),
  );
  const batchCharacters = saturatingCheckpointSum(
    bounds.maxCanonicalCharacters,
    saturatingCheckpointProduct(bounds.maxBatchRecords, 2),
    256,
  );
  const coverageCharacters = saturatingCheckpointSum(
    256,
    saturatingCheckpointProduct(
      bounds.maxCoverageEntries,
      saturatingCheckpointSum(saturatingCheckpointProduct(bounds.maxTokenCharacters, 6), 512),
    ),
  );
  const transitionValues = Math.max(
    16,
    saturatingCheckpointSum(
      8,
      saturatingCheckpointProduct(
        bounds.maxBatchRecords,
        saturatingCheckpointSum(24, saturatingCheckpointProduct(bounds.maxProvenancePerRecord, 8)),
      ),
    ),
    saturatingCheckpointSum(8, saturatingCheckpointProduct(bounds.maxCoverageEntries, 12)),
  );
  return Object.freeze({
    beginCharacters,
    beginValues: saturatingCheckpointSum(12, saturatingCheckpointProduct(bounds.maxScopes, 4)),
    transitionCharacters: Math.max(
      1_024,
      batchCharacters,
      coverageCharacters,
      saturatingCheckpointSum(
        saturatingCheckpointProduct(bounds.maxTextCharacters, 6),
        saturatingCheckpointProduct(bounds.maxTokenCharacters, 6),
        256,
      ),
    ),
    transitionValues,
  });
}

function captureCheckpointGraphData(
  value: unknown,
  subject: string,
  maximumCharacters: number,
  maximumValues: number,
  capture: ReturnType<typeof createCanonicalGraphDataCapturer>,
) {
  const captured = capture(
    value,
    "query",
    {
      code: "invalid-observation-checkpoint",
      maximum: maximumCharacters,
      message: `Observation checkpoint ${subject} exceeds its canonical-character bound`,
    },
    {
      code: "invalid-observation-checkpoint",
      maximumDepth: 12,
      maximumValues,
      message: `Observation checkpoint ${subject} exceeds its structural bound`,
    },
  );
  return captured.ok
    ? captured
    : invalidCheckpoint(`${subject} could not be captured safely within its bounds`);
}

/** Canonicalizes a Host-supplied begin descriptor without starting a session. */
export function canonicalizeObservationSessionBegin(
  beginValue: ObservationSessionBegin,
  configuredBounds?: Partial<ObservationSessionBounds>,
): Result<ObservationSessionBegin> {
  const bounds = resolveBounds(configuredBounds);
  return inspectBegin(beginValue, bounds);
}

export function createObservationSession(
  beginValue: ObservationSessionBegin,
  configuredBounds?: Partial<ObservationSessionBounds>,
): Result<ObservationSession> {
  const bounds = resolveBounds(configuredBounds);
  const parsedBegin = inspectBegin(beginValue, bounds);
  if (!parsedBegin.ok) return parsedBegin;
  const begin = parsedBegin.value;
  const scopeIds = new Set(begin.scopes.map((scope) => scope.id));
  const scopeRoots = new Map(begin.scopes.map((scope) => [scope.id, scope.resourceRoot]));
  const transitions: ObservationSessionCheckpointTransition[] = [];
  const state: MutableSessionState = {
    batchCount: 0,
    canonicalCharacters: 0,
    lastHeartbeatSequence: 0,
    lastSequence: 0,
    records: new Map(),
    signalCount: 0,
    state: "active",
  };

  const inspection = (): ObservationSessionInspection =>
    Object.freeze({
      apiVersion: observationSessionApiVersion,
      batchCount: state.batchCount,
      canonicalCharacters: state.canonicalCharacters,
      epoch: begin.epoch,
      ...(state.failure === undefined ? {} : { failure: state.failure }),
      lastHeartbeatSequence: state.lastHeartbeatSequence,
      lastSequence: state.lastSequence,
      projectId: begin.projectId,
      recordCount: state.records.size,
      scopes: begin.scopes,
      signalCount: state.signalCount,
      source: begin.source,
      state: state.state,
    });

  const terminal = (
    signalValue: ObservationTerminalSignal,
    nextState: "cancelled",
  ): Result<void> => {
    const signal = inspectSignal(
      signalValue,
      ["epoch", "sequence"],
      begin,
      bounds,
      state,
      "Observation terminal signal",
    );
    if (!signal.ok) return signal;
    const sequence = nextSequence(signal.value.sequence, state, bounds, true);
    if (!sequence.ok) return sequence;
    state.lastSequence = sequence.value;
    state.signalCount += 1;
    state.state = nextState;
    return success(undefined);
  };

  const session: ObservationSession = Object.freeze({
    cancel(signal: ObservationTerminalSignal) {
      const cancelled = terminal(signal, "cancelled");
      if (cancelled.ok) {
        transitions.push(Object.freeze({ sequence: state.lastSequence, type: "cancel" as const }));
      }
      return cancelled;
    },
    checkpoint() {
      return Object.freeze({
        apiVersion: observationSessionCheckpointApiVersion,
        begin,
        bounds,
        transitions: Object.freeze([...transitions]),
      });
    },
    complete(completionValue: ObservationCompletion) {
      const completion = inspectSignal(
        completionValue,
        ["coverage", "epoch", "sequence"],
        begin,
        bounds,
        state,
        "Observation completion",
      );
      if (!completion.ok) return completion;
      const sequence = nextSequence(completion.value.sequence, state, bounds, true);
      if (!sequence.ok) return sequence;
      const coverage = inspectCoverage(completion.value.coverage, begin, bounds);
      if (!coverage.ok) return coverage;
      const records = [...state.records.values()]
        .map((stored) => stored.value)
        .sort((left, right) =>
          compareCodeUnits(
            qualifiedKey(left.scope, left.key),
            qualifiedKey(right.scope, right.key),
          ),
        );
      const snapshot: CompletedObservationSnapshot = Object.freeze({
        apiVersion: observationSessionApiVersion,
        coverage: coverage.value,
        epoch: begin.epoch,
        projectId: begin.projectId,
        records: Object.freeze(records),
        scopes: begin.scopes,
        source: begin.source,
      });
      state.lastSequence = sequence.value;
      state.signalCount += 1;
      state.completed = snapshot;
      state.state = "completed";
      transitions.push(
        Object.freeze({
          coverage: coverage.value,
          sequence: sequence.value,
          type: "complete" as const,
        }),
      );
      return success(snapshot);
    },
    expire(expiryValue: ObservationExpiry) {
      const expiry = inspectSignal(
        expiryValue,
        ["epoch", "heartbeatSequence"],
        begin,
        bounds,
        state,
        "Observation expiry",
      );
      if (!expiry.ok) return expiry;
      if (
        typeof expiry.value.heartbeatSequence !== "number" ||
        !Number.isSafeInteger(expiry.value.heartbeatSequence) ||
        expiry.value.heartbeatSequence < 0 ||
        expiry.value.heartbeatSequence !== state.lastHeartbeatSequence
      ) {
        return failure(
          diagnostic(
            "heartbeat-expiry-stale",
            "Heartbeat expiry must name the last heartbeat observed by the host",
            { lastHeartbeatSequence: state.lastHeartbeatSequence },
          ),
        );
      }
      if (state.signalCount >= bounds.maxSignals) {
        return failure(
          diagnostic(
            "observation-session-too-large",
            "Observation session exceeds its signal bound",
            {
              maximum: bounds.maxSignals,
            },
          ),
        );
      }
      state.signalCount += 1;
      state.state = "expired";
      transitions.push(
        Object.freeze({
          heartbeatSequence: expiry.value.heartbeatSequence as number,
          type: "expire" as const,
        }),
      );
      return success(undefined);
    },
    fail(reportValue: ObservationFailure) {
      const report = inspectSignal(
        reportValue,
        ["epoch", "reason", "sequence"],
        begin,
        bounds,
        state,
        "Observation failure",
      );
      if (!report.ok) return report;
      const sequence = nextSequence(report.value.sequence, state, bounds, true);
      if (!sequence.ok) return sequence;
      const reportedReason = inspectFailureReason(report.value.reason, bounds);
      if (!reportedReason.ok) return reportedReason;
      state.lastSequence = sequence.value;
      state.failure = reportedReason.value;
      state.signalCount += 1;
      state.state = "failed";
      transitions.push(
        Object.freeze({
          reason: reportedReason.value,
          sequence: sequence.value,
          type: "fail" as const,
        }),
      );
      return success(undefined);
    },
    heartbeat(heartbeatValue: ObservationHeartbeat) {
      const heartbeat = inspectSignal(
        heartbeatValue,
        ["epoch", "sequence"],
        begin,
        bounds,
        state,
        "Observation heartbeat",
      );
      if (!heartbeat.ok) return heartbeat;
      const sequence = nextSequence(heartbeat.value.sequence, state, bounds, false);
      if (!sequence.ok) return sequence;
      state.lastHeartbeatSequence = sequence.value;
      state.lastSequence = sequence.value;
      state.signalCount += 1;
      transitions.push(Object.freeze({ sequence: sequence.value, type: "heartbeat" as const }));
      return success(undefined);
    },
    inspect: inspection,
    snapshot() {
      return state.completed === undefined
        ? failure(
            diagnostic(
              "observation-session-incomplete",
              "Only a completed observation session has an evidence snapshot",
              { state: state.state },
            ),
          )
        : success(state.completed);
    },
    submitBatch(batchValue: ObservationBatch) {
      const batch = inspectSignal(
        batchValue,
        ["epoch", "records", "sequence"],
        begin,
        bounds,
        state,
        "Observation batch",
      );
      if (!batch.ok) return batch;
      const sequence = nextSequence(batch.value.sequence, state, bounds, false);
      if (!sequence.ok) return sequence;
      if (state.batchCount >= bounds.maxBatches) {
        return failure(
          diagnostic(
            "observation-session-too-large",
            "Observation session exceeds its batch bound",
            {
              maximum: bounds.maxBatches,
            },
          ),
        );
      }
      const records = inspectArray(
        batch.value.records,
        bounds.maxBatchRecords,
        "observation-batch-too-large",
        "Observation batch records",
      );
      if (!records.ok) return records;

      const pending = new Map<string, StoredObservationRecord>();
      let pendingCanonicalCharacters = 0;
      let replayed = 0;
      for (let index = 0; index < records.value.length; index += 1) {
        const parsed = inspectRecordValue(
          records.value[index],
          scopeIds,
          scopeRoots,
          bounds,
          index,
        );
        if (!parsed.ok) return parsed;
        const identity = qualifiedKey(parsed.value.value.scope, parsed.value.value.key);
        const existing = pending.get(identity) ?? state.records.get(identity);
        if (existing !== undefined) {
          if (existing.canonical !== parsed.value.canonical) {
            return failure(
              diagnostic(
                "contradictory-observation",
                "One source and scope assigned incompatible evidence to the same observation key",
                { index, key: parsed.value.value.key, scope: parsed.value.value.scope },
              ),
            );
          }
          replayed += 1;
        } else {
          pending.set(identity, parsed.value);
          pendingCanonicalCharacters += parsed.value.canonical.length;
        }
      }
      if (state.records.size + pending.size > bounds.maxRecords) {
        return failure(
          diagnostic(
            "observation-session-too-large",
            "Observation session exceeds its cumulative record bound",
            { maximum: bounds.maxRecords },
          ),
        );
      }
      if (state.canonicalCharacters + pendingCanonicalCharacters > bounds.maxCanonicalCharacters) {
        return failure(
          diagnostic(
            "observation-session-too-large",
            "Observation session exceeds its cumulative canonical-character bound",
            { maximum: bounds.maxCanonicalCharacters },
          ),
        );
      }
      for (const [identity, record] of pending) state.records.set(identity, record);
      state.batchCount += 1;
      state.canonicalCharacters += pendingCanonicalCharacters;
      state.lastSequence = sequence.value;
      state.signalCount += 1;
      transitions.push(
        Object.freeze({
          records: Object.freeze([...pending.values()].map((record) => record.value)),
          sequence: sequence.value,
          type: "batch" as const,
        }),
      );
      return success(
        Object.freeze({
          acceptedRecords: pending.size,
          replayedRecords: replayed,
          sequence: sequence.value,
          totalRecords: state.records.size,
        }),
      );
    },
  });

  return success(session);
}

/** Restores only by validating and replaying the ordinary session contract. */
export function restoreObservationSessionCheckpoint(
  checkpointValue: unknown,
): Result<ObservationSession> {
  const envelope = inspectExactRecord(
    checkpointValue,
    [["apiVersion", "begin", "bounds", "transitions"]],
    "invalid-observation-checkpoint",
    "Observation checkpoint",
  );
  if (!envelope.ok) return invalidCheckpoint("envelope has an invalid shape");
  if (envelope.value.apiVersion !== observationSessionCheckpointApiVersion) {
    return invalidCheckpoint("apiVersion is unsupported");
  }
  const bounds = inspectCheckpointBounds(envelope.value.bounds);
  if (!bounds.ok) return bounds;
  const captureBudgets = checkpointCaptureBudgets(bounds.value);
  const reservedContainers: object[] = [];
  for (const container of [checkpointValue, envelope.value.bounds, envelope.value.transitions]) {
    if (typeof container === "object" && container !== null) reservedContainers.push(container);
  }
  const capture = createCanonicalGraphDataCapturer(reservedContainers);
  const beginCopy = captureCheckpointGraphData(
    envelope.value.begin,
    "begin",
    captureBudgets.beginCharacters,
    captureBudgets.beginValues,
    capture,
  );
  if (!beginCopy.ok) return beginCopy;
  const transitions = inspectCheckpointTransitions(
    envelope.value.transitions,
    bounds.value.maxSignals,
  );
  if (!transitions.ok) return transitions;
  const created = createObservationSession(
    beginCopy.value.value as unknown as ObservationSessionBegin,
    bounds.value,
  );
  if (!created.ok) return invalidCheckpoint("begin is invalid for the recorded bounds");
  const session = created.value;
  const ownedTransitions: unknown[] = [];
  let capturedCharacters = saturatingCheckpointSum(beginCopy.value.canonicalJson.length, 4_096);

  for (let index = 0; index < transitions.value.length; index += 1) {
    const transitionCopy = captureCheckpointGraphData(
      transitions.value[index],
      `transition ${index}`,
      captureBudgets.transitionCharacters,
      captureBudgets.transitionValues,
      capture,
    );
    if (!transitionCopy.ok) return transitionCopy;
    capturedCharacters = saturatingCheckpointSum(
      capturedCharacters,
      transitionCopy.value.canonicalJson.length,
      1,
    );
    ownedTransitions.push(transitionCopy.value.value);
    const transition = checkpointTransitionShape(transitionCopy.value.value);
    if (!transition.ok) return transition;
    let replayed: Result<unknown>;
    if (transition.value.type === "batch") {
      const records = inspectArray(
        transition.value.records,
        bounds.value.maxBatchRecords,
        "invalid-observation-checkpoint",
        "Observation checkpoint batch records",
      );
      if (!records.ok) return invalidCheckpoint("batch records have an invalid shape or size");
      replayed = session.submitBatch({
        epoch: session.inspect().epoch,
        records: transition.value.records as readonly ObservationRecord[],
        sequence: transition.value.sequence as number,
      });
      if (
        replayed.ok &&
        ((replayed.value as ObservationBatchReceipt).acceptedRecords !== records.value.length ||
          (replayed.value as ObservationBatchReceipt).replayedRecords !== 0)
      ) {
        return invalidCheckpoint("batch transitions must contain only newly accepted records");
      }
    } else if (transition.value.type === "heartbeat") {
      replayed = session.heartbeat({
        epoch: session.inspect().epoch,
        sequence: transition.value.sequence as number,
      });
    } else if (transition.value.type === "complete") {
      replayed = session.complete({
        coverage: transition.value.coverage as readonly ObservationCoverage[],
        epoch: session.inspect().epoch,
        sequence: transition.value.sequence as number,
      });
    } else if (transition.value.type === "cancel") {
      replayed = session.cancel({
        epoch: session.inspect().epoch,
        sequence: transition.value.sequence as number,
      });
    } else if (transition.value.type === "fail") {
      replayed = session.fail({
        epoch: session.inspect().epoch,
        reason: transition.value.reason as ObservationFailureReason,
        sequence: transition.value.sequence as number,
      });
    } else {
      replayed = session.expire({
        epoch: session.inspect().epoch,
        heartbeatSequence: transition.value.heartbeatSequence as number,
      });
    }
    if (!replayed.ok) {
      return invalidCheckpoint(`transition ${index} cannot be replayed`);
    }
  }
  const capturedValues = saturatingCheckpointSum(
    captureBudgets.beginValues,
    16,
    saturatingCheckpointProduct(transitions.value.length, captureBudgets.transitionValues),
  );
  const captured = copyCanonicalGraphData(
    Object.freeze({
      apiVersion: observationSessionCheckpointApiVersion,
      begin: beginCopy.value.value,
      bounds: bounds.value,
      transitions: Object.freeze(ownedTransitions),
    }),
    "query",
    {
      code: "invalid-observation-checkpoint",
      maximum: capturedCharacters,
      message: "Observation checkpoint exceeds its captured canonical-character bound",
    },
    {
      code: "invalid-observation-checkpoint",
      maximumDepth: 14,
      maximumValues: capturedValues,
      message: "Observation checkpoint exceeds its captured structural bound",
    },
  );
  const reconstructed = copyCanonicalGraphData(
    session.checkpoint(),
    "query",
    {
      code: "invalid-observation-checkpoint",
      maximum: capturedCharacters,
      message: "Replayed observation checkpoint exceeds its captured canonical-character bound",
    },
    {
      code: "invalid-observation-checkpoint",
      maximumDepth: 14,
      maximumValues: capturedValues,
      message: "Replayed observation checkpoint exceeds its captured structural bound",
    },
  );
  if (
    !captured.ok ||
    !reconstructed.ok ||
    captured.value.canonicalJson !== reconstructed.value.canonicalJson
  ) {
    return invalidCheckpoint("checkpoint does not match its replayed canonical state");
  }
  return success(session);
}
