import { createHash } from "node:crypto";

import { isAlias, parseDocument, stringify, visit } from "yaml";

import {
  canonicalizeObservationSessionBegin,
  createObservationSession,
  failure,
  observationSessionApiVersion,
  parseContentRevision,
  parseEntityId,
  parseGraphGeneration,
  parseResourceKey,
  success,
  type CompletedObservationSnapshot,
  type ContentRevision,
  type Diagnostic,
  type EntityAliasResolver,
  type EntityId,
  type GraphGeneration,
  type ObservationCoverage,
  type ObservationRecord,
  type ObservationScopeDeclaration,
  type ObservationSourceIdentity,
  type ResourceKey,
  type Result,
} from "../core/index.ts";
import { copyCanonicalGraphData } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type ResourceEntry,
  type WorkspaceResourceLocator,
} from "./contracts.ts";
import type { CanonicalTransactionTarget } from "./local-transaction-journal.ts";

export const evidenceSourceSchema = "groma/evidence-source/v0.1" as const;
export const evidenceShardSchema = "groma/evidence-shard/v0.1" as const;
export const bindingShardSchema = "groma/binding-shard/v0.1" as const;
export const canonicalEvidenceBucketCount = 256 as const;

const fingerprintPattern = /^sha256:[0-9a-f]{64}$/;
const bucketPattern = /^[0-9a-f]{2}$/;
const sourceDocumentPattern = /^groma\/evidence\/sources\/[0-9a-f]{2}\/[0-9a-f]{64}\.md$/;
const evidenceShardPattern = /^groma\/evidence\/shards\/([0-9a-f]{2})\.md$/;
const bindingShardPattern = /^groma\/bindings\/shards\/([0-9a-f]{2})\.md$/;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const intrinsicUint8Array = Uint8Array;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayTag = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)?.get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")?.get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;

export interface EvidenceBindingStoreBounds {
  readonly maxBindingHistoryEntries: number;
  readonly maxBindings: number;
  readonly maxDocumentBytes: number;
  readonly maxEntriesPerDirectory: number;
  readonly maxEvidenceRecords: number;
  readonly maxSources: number;
  readonly maxTotalBindingHistoryEntries: number;
  readonly maxTotalDocumentBytes: number;
  readonly pageSize: number;
}

export interface EvidenceSourceLane {
  readonly projectId: string;
  readonly sourceId: string;
  readonly sourceInstance: string;
}

export interface EvidenceObservationIdentity extends EvidenceSourceLane {
  readonly key: string;
  readonly scope: string;
}

export interface CanonicalEvidenceSource extends EvidenceSourceLane {
  readonly coverage: readonly ObservationCoverage[];
  readonly generation: GraphGeneration;
  readonly recordCount: number;
  readonly scopes: readonly ObservationScopeDeclaration[];
  readonly snapshotFingerprint: string;
  readonly sourceVersion: string;
}

export interface CanonicalEvidenceRecord {
  readonly declaredScopes: readonly string[];
  readonly identity: EvidenceObservationIdentity;
  readonly observation: ObservationRecord;
  readonly observedGeneration: GraphGeneration;
  readonly scopeRoot: string;
  readonly sourceVersion: string;
}

export type EvidenceBindingDecision =
  | Readonly<{ readonly componentId: EntityId; readonly type: "automatic" }>
  | Readonly<{ readonly componentId: EntityId; readonly type: "explicit" }>
  | Readonly<{ readonly type: "ignored" }>
  | Readonly<{
      readonly successor: EvidenceObservationIdentity;
      readonly type: "superseded";
    }>;

export interface EvidenceBindingHistoryEntry {
  readonly decision: EvidenceBindingDecision;
  readonly generation: GraphGeneration;
}

export interface CanonicalEvidenceBinding {
  readonly history: readonly EvidenceBindingHistoryEntry[];
  readonly identity: EvidenceObservationIdentity;
}

export interface EvidenceBindingMutation {
  readonly decision: EvidenceBindingDecision;
  readonly identity: EvidenceObservationIdentity;
}

export interface EvidenceBindingDocument {
  readonly bucket?: string;
  readonly bytes: Uint8Array;
  readonly kind: "binding-shard" | "evidence-shard" | "source";
  readonly locator: WorkspaceResourceLocator;
  readonly resource: ResourceKey;
  readonly revision: ContentRevision;
}

export interface EvidenceBindingSnapshot {
  readonly bindings: readonly CanonicalEvidenceBinding[];
  readonly documents: readonly EvidenceBindingDocument[];
  readonly evidence: readonly CanonicalEvidenceRecord[];
  readonly sources: readonly CanonicalEvidenceSource[];
}

export interface EvidenceFanoutBucketStatistic {
  readonly bucket: string;
  readonly currentCount: number;
  readonly distinctSourceCount: number;
  readonly retainedCount: number;
  readonly serializedBytes: number;
}

export interface EvidenceBindingPlanInput {
  readonly bindingMutations?: readonly EvidenceBindingMutation[];
  readonly completedSnapshot?: CompletedObservationSnapshot;
  readonly generation: GraphGeneration;
}

export interface EvidenceBindingPlan {
  readonly changed: boolean;
  readonly fanout: readonly EvidenceFanoutBucketStatistic[];
  readonly snapshot: EvidenceBindingSnapshot;
  readonly targets: readonly CanonicalTransactionTarget[];
}

export type ResolvedEvidenceBinding =
  | Readonly<{
      readonly componentAliasChain: readonly EntityId[];
      readonly decision: "automatic" | "explicit";
      readonly observationChain: readonly EvidenceObservationIdentity[];
      readonly requested: EvidenceObservationIdentity;
      readonly resolvedComponentId: EntityId;
      readonly storedComponentId: EntityId;
      readonly terminal: EvidenceObservationIdentity;
    }>
  | Readonly<{
      readonly decision: "ignored";
      readonly observationChain: readonly EvidenceObservationIdentity[];
      readonly requested: EvidenceObservationIdentity;
      readonly terminal: EvidenceObservationIdentity;
    }>;

export interface EvidenceBindingStore {
  decodeBindingShard(
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Result<readonly CanonicalEvidenceBinding[]>;
  decodeEvidenceShard(
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Result<readonly CanonicalEvidenceRecord[]>;
  decodeSource(
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Result<CanonicalEvidenceSource>;
  load(): Promise<Result<EvidenceBindingSnapshot>>;
  plan(
    current: EvidenceBindingSnapshot,
    input: EvidenceBindingPlanInput,
  ): Result<EvidenceBindingPlan>;
  resolve(
    snapshot: EvidenceBindingSnapshot,
    identity: EvidenceObservationIdentity,
    aliases: EntityAliasResolver,
  ): Result<ResolvedEvidenceBinding>;
}

const defaultBounds: EvidenceBindingStoreBounds = Object.freeze({
  maxBindingHistoryEntries: 1_024,
  maxBindings: 100_000,
  maxDocumentBytes: 16 * 1024 * 1024,
  maxEntriesPerDirectory: 10_000,
  maxEvidenceRecords: 100_000,
  maxSources: 10_000,
  maxTotalBindingHistoryEntries: 1_000_000,
  maxTotalDocumentBytes: 256 * 1024 * 1024,
  pageSize: 1_000,
});

const absoluteBounds: EvidenceBindingStoreBounds = Object.freeze({
  maxBindingHistoryEntries: 1_000_000,
  maxBindings: 1_000_000,
  maxDocumentBytes: 64 * 1024 * 1024,
  maxEntriesPerDirectory: 100_000,
  maxEvidenceRecords: 1_000_000,
  maxSources: 100_000,
  maxTotalBindingHistoryEntries: 4_000_000,
  maxTotalDocumentBytes: 1024 * 1024 * 1024,
  pageSize: 10_000,
});

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze({
    code,
    ...(details === undefined ? {} : { details: Object.freeze({ ...details }) }),
    message,
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseBounds(input?: Partial<EvidenceBindingStoreBounds>): EvidenceBindingStoreBounds {
  const value = { ...defaultBounds, ...(input ?? {}) };
  for (const key of Object.keys(defaultBounds) as (keyof EvidenceBindingStoreBounds)[]) {
    if (!Number.isSafeInteger(value[key]) || value[key] <= 0 || value[key] > absoluteBounds[key]) {
      throw new RangeError(
        `${key} must be a positive safe integer no greater than ${absoluteBounds[key]}`,
      );
    }
  }
  if (value.pageSize > value.maxEntriesPerDirectory) {
    throw new RangeError("Evidence store paging bounds are inconsistent");
  }
  return Object.freeze(value);
}

function hashFramed(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts), "utf8").digest("hex");
}

function laneHash(lane: EvidenceSourceLane): string {
  return hashFramed([
    "groma-evidence-source-lane-v1",
    lane.projectId,
    lane.sourceId,
    lane.sourceInstance,
  ]);
}

function observationHash(identity: EvidenceObservationIdentity): string {
  return hashFramed([
    "groma-evidence-observation-v1",
    identity.projectId,
    identity.sourceId,
    identity.sourceInstance,
    identity.scope,
    identity.key,
  ]);
}

function laneKey(lane: EvidenceSourceLane): string {
  return JSON.stringify([lane.projectId, lane.sourceId, lane.sourceInstance]);
}

function identityKey(identity: EvidenceObservationIdentity): string {
  return JSON.stringify([
    identity.projectId,
    identity.sourceId,
    identity.sourceInstance,
    identity.scope,
    identity.key,
  ]);
}

function evidenceBucket(identity: EvidenceObservationIdentity): string {
  return observationHash(identity).slice(0, 2);
}

export function evidenceSourceLocator(lane: EvidenceSourceLane): Result<WorkspaceResourceLocator> {
  const hash = laneHash(lane);
  return workspaceResourceLocator("groma", "evidence", "sources", hash.slice(0, 2), `${hash}.md`);
}

export function evidenceShardLocator(bucket: string): Result<WorkspaceResourceLocator> {
  return bucketPattern.test(bucket)
    ? workspaceResourceLocator("groma", "evidence", "shards", `${bucket}.md`)
    : failure(
        diagnostic(
          "invalid-evidence-bucket",
          "Evidence bucket must be two lowercase hex characters",
        ),
      );
}

export function bindingShardLocator(bucket: string): Result<WorkspaceResourceLocator> {
  return bucketPattern.test(bucket)
    ? workspaceResourceLocator("groma", "bindings", "shards", `${bucket}.md`)
    : failure(
        diagnostic(
          "invalid-evidence-bucket",
          "Binding bucket must be two lowercase hex characters",
        ),
      );
}

function exactBytes(value: unknown, maximum: number): Result<Uint8Array> {
  const invalid = () =>
    failure(
      diagnostic("invalid-evidence-bytes", "Canonical evidence bytes must be a genuine Uint8Array"),
    );
  if (
    typeof value !== "object" ||
    value === null ||
    typedArrayTag === undefined ||
    typedArrayBuffer === undefined ||
    typedArrayByteOffset === undefined ||
    typedArrayByteLength === undefined
  ) {
    return invalid();
  }
  try {
    if (Reflect.apply(typedArrayTag, value, []) !== "Uint8Array") return invalid();
    const buffer = Reflect.apply(typedArrayBuffer, value, []) as ArrayBufferLike;
    const offset = Reflect.apply(typedArrayByteOffset, value, []) as number;
    const length = Reflect.apply(typedArrayByteLength, value, []) as number;
    if (!Number.isSafeInteger(length) || length < 0) return invalid();
    if (length > maximum) {
      return failure(
        diagnostic(
          "evidence-document-byte-limit-exceeded",
          "Canonical evidence document exceeds its configured byte bound",
          {
            maximum,
          },
        ),
      );
    }
    return success(new intrinsicUint8Array(new intrinsicUint8Array(buffer, offset, length)));
  } catch {
    return invalid();
  }
}

function accountDocumentBytes(
  value: unknown,
  totalBytes: number,
  limits: Pick<EvidenceBindingStoreBounds, "maxDocumentBytes" | "maxTotalDocumentBytes">,
): Result<Readonly<{ bytes: Uint8Array; totalBytes: number }>> {
  const copied = exactBytes(value, limits.maxDocumentBytes);
  if (!copied.ok) return copied;
  if (copied.value.byteLength > limits.maxTotalDocumentBytes - totalBytes) {
    return failure(
      diagnostic(
        "evidence-total-byte-limit-exceeded",
        "Canonical evidence exceeds its aggregate retained-byte bound",
      ),
    );
  }
  return success(
    Object.freeze({
      bytes: copied.value,
      totalBytes: totalBytes + copied.value.byteLength,
    }),
  );
}

function revision(bytes: Uint8Array): ContentRevision {
  const parsed = parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  if (!parsed.ok) throw new Error("Canonical evidence revision is invalid");
  return parsed.value;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function resource(locator: WorkspaceResourceLocator): ResourceKey {
  const parsed = parseResourceKey(String(locator));
  if (!parsed.ok) throw new Error("Canonical evidence resource key is invalid");
  return parsed.value;
}

function document(
  kind: EvidenceBindingDocument["kind"],
  locator: WorkspaceResourceLocator,
  bytesValue: Uint8Array,
  bucket?: string,
): EvidenceBindingDocument {
  const bytes = new intrinsicUint8Array(bytesValue);
  return Object.freeze({
    ...(bucket === undefined ? {} : { bucket }),
    get bytes(): Uint8Array {
      return new intrinsicUint8Array(bytes);
    },
    kind,
    locator,
    resource: resource(locator),
    revision: revision(bytes),
  });
}

function markdown(frontmatter: Record<string, unknown>): Result<Uint8Array> {
  try {
    const source = `---\n${stringify(frontmatter, {
      aliasDuplicateObjects: false,
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
    })}---\n`;
    return success(textEncoder.encode(source));
  } catch (error) {
    return failure(
      diagnostic(
        "evidence-serialization-failed",
        `Canonical evidence could not be encoded as deterministic YAML: ${error instanceof Error ? error.message : "unknown error"}`,
      ),
    );
  }
}

function yamlFrontmatter(
  bytesValue: Uint8Array,
  maximum: number,
): Result<
  Readonly<{
    bytes: Uint8Array;
    value: Readonly<Record<string, unknown>>;
  }>
> {
  const copied = exactBytes(bytesValue, maximum);
  if (!copied.ok) return copied;
  let source: string;
  try {
    source = textDecoder.decode(copied.value);
  } catch {
    return failure(diagnostic("evidence-invalid-utf8", "Canonical evidence is not valid UTF-8"));
  }
  if (!source.startsWith("---\n") || !source.endsWith("---\n") || source.length < 8) {
    return failure(
      diagnostic(
        "evidence-malformed-markdown",
        "Canonical evidence must be one Markdown YAML-frontmatter document",
      ),
    );
  }
  let parsed: ReturnType<typeof parseDocument>;
  try {
    parsed = parseDocument(source.slice(4, -4), {
      logLevel: "silent",
      prettyErrors: false,
      schema: "core",
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });
  } catch {
    return failure(
      diagnostic("evidence-malformed-yaml", "Canonical evidence contains malformed YAML"),
    );
  }
  if (parsed.errors.some((error) => error.code === "DUPLICATE_KEY")) {
    return failure(
      diagnostic("evidence-duplicate-yaml-key", "Canonical evidence contains a duplicate YAML key"),
    );
  }
  let unsupported = false;
  let invalidNumber = false;
  visit(parsed, {
    Alias: () => {
      unsupported = true;
      return visit.BREAK;
    },
    Node: (_key, node) => {
      if (isAlias(node) || node.anchor !== undefined || node.tag !== undefined) {
        unsupported = true;
        return visit.BREAK;
      }
    },
    Scalar: (_key, node) => {
      if (
        typeof node.value === "bigint" ||
        (typeof node.value === "number" &&
          (!Number.isFinite(node.value) || !Number.isSafeInteger(node.value)))
      ) {
        invalidNumber = true;
        return visit.BREAK;
      }
    },
  });
  if (unsupported) {
    return failure(
      diagnostic(
        "evidence-unsupported-yaml",
        "Canonical evidence must not contain YAML aliases, anchors, or explicit tags",
      ),
    );
  }
  if (invalidNumber) {
    return failure(
      diagnostic(
        "evidence-invalid-number",
        "Canonical evidence numbers must be safe finite integers",
      ),
    );
  }
  if (parsed.errors.length > 0 || parsed.warnings.length > 0) {
    return failure(
      diagnostic("evidence-malformed-yaml", "Canonical evidence contains unsupported YAML"),
    );
  }
  let value: unknown;
  try {
    value = parsed.toJS({ maxAliasCount: 0 });
  } catch {
    return failure(
      diagnostic("evidence-malformed-yaml", "Canonical evidence could not be converted from YAML"),
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(
      diagnostic("invalid-evidence-document", "Canonical evidence frontmatter must be one mapping"),
    );
  }
  return success(
    Object.freeze({
      bytes: copied.value,
      value: value as Readonly<Record<string, unknown>>,
    }),
  );
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  subject: string,
): Result<Readonly<Record<string, unknown>>> {
  return inspectExactRecord(value, [keys], "invalid-evidence-document", subject);
}

function intrinsicArray(
  value: unknown,
  maximum: number,
  subject: string,
): Result<readonly unknown[]> {
  const length = inspectIntrinsicArrayLength(value, "invalid-evidence-document", subject);
  if (!length.ok) return length;
  if (length.value > maximum) {
    return failure(
      diagnostic("evidence-item-limit-exceeded", `${subject} exceeds its configured item bound`, {
        maximum,
      }),
    );
  }
  const output: unknown[] = [];
  try {
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          diagnostic(
            "invalid-evidence-document",
            `${subject} entries must be enumerable data properties`,
          ),
        );
      }
      output.push(descriptor.value);
    }
  } catch {
    return failure(
      diagnostic("invalid-evidence-document", `${subject} could not be inspected safely`),
    );
  }
  return success(Object.freeze(output));
}

function identityRecord(identity: EvidenceObservationIdentity): Record<string, string> {
  return {
    key: identity.key,
    projectId: identity.projectId,
    scope: identity.scope,
    sourceId: identity.sourceId,
    sourceInstance: identity.sourceInstance,
  };
}

function laneRecord(lane: EvidenceSourceLane): Record<string, string> {
  return {
    projectId: lane.projectId,
    sourceId: lane.sourceId,
    sourceInstance: lane.sourceInstance,
  };
}

function parseLane(value: unknown): Result<EvidenceSourceLane> {
  const record = exactRecord(
    value,
    ["projectId", "sourceId", "sourceInstance"],
    "Evidence source lane",
  );
  if (!record.ok) return record;
  if (
    typeof record.value.projectId !== "string" ||
    typeof record.value.sourceId !== "string" ||
    typeof record.value.sourceInstance !== "string"
  ) {
    return failure(
      diagnostic("invalid-evidence-lane", "Evidence source lane values must be strings"),
    );
  }
  const candidate = {
    apiVersion: observationSessionApiVersion,
    epoch: "canonical-validation",
    projectId: record.value.projectId,
    scopes: [{ id: "canonical", resourceRoot: "." }],
    source: { id: record.value.sourceId, instance: record.value.sourceInstance, version: "0.0.0" },
  } as const;
  const validated = canonicalizeObservationSessionBegin(candidate);
  if (!validated.ok) return validated;
  return success(
    Object.freeze({
      projectId: validated.value.projectId,
      sourceId: validated.value.source.id,
      sourceInstance: validated.value.source.instance,
    }),
  );
}

function parseIdentity(value: unknown): Result<EvidenceObservationIdentity> {
  const record = exactRecord(
    value,
    ["key", "projectId", "scope", "sourceId", "sourceInstance"],
    "Evidence observation identity",
  );
  if (!record.ok) return record;
  const lane = parseLane({
    projectId: record.value.projectId,
    sourceId: record.value.sourceId,
    sourceInstance: record.value.sourceInstance,
  });
  if (!lane.ok) return lane;
  if (typeof record.value.scope !== "string" || typeof record.value.key !== "string") {
    return failure(
      diagnostic("invalid-evidence-identity", "Evidence scope and key must be strings"),
    );
  }
  const begin = createObservationSession({
    apiVersion: observationSessionApiVersion,
    epoch: "canonical-validation",
    projectId: lane.value.projectId,
    scopes: [{ id: record.value.scope, resourceRoot: "." }],
    source: { id: lane.value.sourceId, instance: lane.value.sourceInstance, version: "0.0.0" },
  });
  if (!begin.ok) return begin;
  const submitted = begin.value.submitBatch({
    epoch: "canonical-validation",
    records: [
      {
        candidate: {},
        key: record.value.key,
        kind: "component-candidate",
        provenance: [{ fingerprint: "sha256:a", resource: ".", scope: record.value.scope }],
        scope: record.value.scope,
      },
    ],
    sequence: 1,
  });
  if (!submitted.ok) return submitted;
  return success(
    Object.freeze({ ...lane.value, key: record.value.key, scope: record.value.scope }),
  );
}

function canonicalSnapshot(
  value: CompletedObservationSnapshot,
  maximumRecords: number,
): Result<CompletedObservationSnapshot> {
  const inspected = exactRecord(
    value,
    ["apiVersion", "coverage", "epoch", "projectId", "records", "scopes", "source"],
    "Completed observation snapshot",
  );
  if (!inspected.ok) return inspected;
  const records = intrinsicArray(
    inspected.value.records,
    maximumRecords,
    "Completed observation records",
  );
  if (!records.ok) return records;
  const batchSize = Math.min(2_048, maximumRecords);
  const created = createObservationSession(
    {
      apiVersion: inspected.value.apiVersion as typeof observationSessionApiVersion,
      epoch: inspected.value.epoch as string,
      projectId: inspected.value.projectId as string,
      scopes: inspected.value.scopes as readonly ObservationScopeDeclaration[],
      source: inspected.value.source as ObservationSourceIdentity,
    },
    { maxBatchRecords: batchSize, maxRecords: maximumRecords },
  );
  if (!created.ok) return created;
  let sequence = 0;
  for (let start = 0; start < records.value.length; start += batchSize) {
    sequence += 1;
    const submitted = created.value.submitBatch({
      epoch: inspected.value.epoch as string,
      records: records.value.slice(start, start + batchSize) as readonly ObservationRecord[],
      sequence,
    });
    if (!submitted.ok) return submitted;
  }
  sequence += 1;
  return created.value.complete({
    coverage: inspected.value.coverage as readonly ObservationCoverage[],
    epoch: inspected.value.epoch as string,
    sequence,
  });
}

function semanticSnapshotFingerprint(snapshot: CompletedObservationSnapshot): Result<string> {
  const canonical = copyCanonicalGraphData(
    {
      coverage: snapshot.coverage,
      projectId: snapshot.projectId,
      records: snapshot.records,
      scopes: snapshot.scopes,
      source: snapshot.source,
    },
    "query",
    {
      code: "evidence-snapshot-too-large",
      maximum: 256 * 1024 * 1024,
      message: "Completed observation snapshot exceeds the canonical evidence bound",
    },
    {
      code: "evidence-snapshot-too-large",
      maximumDepth: 16,
      maximumValues: 8_000_000,
      message: "Completed observation snapshot exceeds the canonical evidence structural bound",
    },
  );
  return canonical.ok
    ? success(
        `sha256:${createHash("sha256").update(canonical.value.canonicalJson, "utf8").digest("hex")}`,
      )
    : canonical;
}

function sourceFrontmatter(source: CanonicalEvidenceSource): Record<string, unknown> {
  return {
    schema: evidenceSourceSchema,
    lane: laneRecord(source),
    sourceVersion: source.sourceVersion,
    generation: source.generation,
    snapshotFingerprint: source.snapshotFingerprint,
    recordCount: source.recordCount,
    scopes: source.scopes,
    coverage: source.coverage,
  };
}

function evidenceFrontmatter(
  bucket: string,
  records: readonly CanonicalEvidenceRecord[],
): Record<string, unknown> {
  return {
    schema: evidenceShardSchema,
    bucket,
    records: records.map((entry) => ({
      identity: identityRecord(entry.identity),
      sourceVersion: entry.sourceVersion,
      observedGeneration: entry.observedGeneration,
      scopeRoot: entry.scopeRoot,
      declaredScopes: entry.declaredScopes,
      observation: entry.observation,
    })),
  };
}

function decisionRecord(decision: EvidenceBindingDecision): Record<string, unknown> {
  if (decision.type === "automatic" || decision.type === "explicit") {
    return { type: decision.type, componentId: decision.componentId };
  }
  if (decision.type === "superseded") {
    return { type: decision.type, successor: identityRecord(decision.successor) };
  }
  return { type: decision.type };
}

function bindingFrontmatter(
  bucket: string,
  bindings: readonly CanonicalEvidenceBinding[],
): Record<string, unknown> {
  return {
    schema: bindingShardSchema,
    bucket,
    bindings: bindings.map((binding) => ({
      identity: identityRecord(binding.identity),
      history: binding.history.map((entry) => ({
        generation: entry.generation,
        decision: decisionRecord(entry.decision),
      })),
    })),
  };
}

function parseSourceValue(
  value: unknown,
  locator: WorkspaceResourceLocator,
  maximumRecords: number,
): Result<CanonicalEvidenceSource> {
  const record = exactRecord(
    value,
    [
      "coverage",
      "generation",
      "lane",
      "recordCount",
      "schema",
      "scopes",
      "snapshotFingerprint",
      "sourceVersion",
    ],
    "Canonical evidence source",
  );
  if (!record.ok) return record;
  if (record.value.schema !== evidenceSourceSchema) {
    return failure(
      diagnostic("evidence-schema-unsupported", "Canonical evidence source schema is unsupported"),
    );
  }
  const lane = parseLane(record.value.lane);
  if (!lane.ok) return lane;
  const generation = parseGraphGeneration(record.value.generation);
  if (!generation.ok) return generation;
  if (
    typeof record.value.recordCount !== "number" ||
    !Number.isSafeInteger(record.value.recordCount) ||
    record.value.recordCount < 0 ||
    record.value.recordCount > maximumRecords
  ) {
    return failure(
      diagnostic("invalid-evidence-source", "Canonical source recordCount exceeds its bound", {
        maximum: maximumRecords,
      }),
    );
  }
  if (
    typeof record.value.snapshotFingerprint !== "string" ||
    !fingerprintPattern.test(record.value.snapshotFingerprint) ||
    typeof record.value.sourceVersion !== "string"
  ) {
    return failure(
      diagnostic("invalid-evidence-source", "Canonical source provenance is malformed"),
    );
  }
  const begin = createObservationSession({
    apiVersion: observationSessionApiVersion,
    epoch: "canonical-validation",
    projectId: lane.value.projectId,
    scopes: record.value.scopes as readonly ObservationScopeDeclaration[],
    source: {
      id: lane.value.sourceId,
      instance: lane.value.sourceInstance,
      version: record.value.sourceVersion,
    },
  });
  if (!begin.ok) return begin;
  const completed = begin.value.complete({
    coverage: record.value.coverage as readonly ObservationCoverage[],
    epoch: "canonical-validation",
    sequence: 1,
  });
  if (!completed.ok) return completed;
  const expected = evidenceSourceLocator(lane.value);
  if (!expected.ok || expected.value !== locator || !sourceDocumentPattern.test(locator)) {
    return failure(
      diagnostic(
        "evidence-wrong-location",
        "Canonical source is not stored at its lane-derived locator",
        {
          locator: String(locator),
        },
      ),
    );
  }
  return success(
    Object.freeze({
      ...lane.value,
      coverage: completed.value.coverage,
      generation: generation.value,
      recordCount: record.value.recordCount,
      scopes: completed.value.scopes,
      snapshotFingerprint: record.value.snapshotFingerprint,
      sourceVersion: completed.value.source.version,
    }),
  );
}

function parseEvidenceValue(
  value: unknown,
  maximum: number,
): Result<readonly CanonicalEvidenceRecord[]> {
  const front = exactRecord(value, ["bucket", "records", "schema"], "Canonical evidence shard");
  if (!front.ok) return front;
  if (
    front.value.schema !== evidenceShardSchema ||
    typeof front.value.bucket !== "string" ||
    !bucketPattern.test(front.value.bucket)
  ) {
    return failure(
      diagnostic(
        "evidence-schema-unsupported",
        "Canonical evidence shard schema or bucket is invalid",
      ),
    );
  }
  const records = intrinsicArray(front.value.records, maximum, "Canonical evidence records");
  if (!records.ok) return records;
  if (records.value.length === 0) {
    return failure(
      diagnostic(
        "empty-evidence-shard",
        "Canonical evidence shards must be absent when they contain no records",
      ),
    );
  }
  const output: CanonicalEvidenceRecord[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < records.value.length; index += 1) {
    const item = exactRecord(
      records.value[index],
      [
        "declaredScopes",
        "identity",
        "observation",
        "observedGeneration",
        "scopeRoot",
        "sourceVersion",
      ],
      `Canonical evidence record ${index}`,
    );
    if (!item.ok) return item;
    const identity = parseIdentity(item.value.identity);
    if (!identity.ok) return identity;
    if (evidenceBucket(identity.value) !== front.value.bucket) {
      return failure(
        diagnostic(
          "evidence-wrong-bucket",
          "Canonical evidence record is stored in the wrong hash bucket",
          {
            bucket: front.value.bucket,
            key: identity.value.key,
          },
        ),
      );
    }
    const key = identityKey(identity.value);
    if (seen.has(key)) {
      return failure(
        diagnostic("duplicate-evidence-record", "Canonical evidence identity is duplicated"),
      );
    }
    seen.add(key);
    const generation = parseGraphGeneration(item.value.observedGeneration);
    if (!generation.ok) return generation;
    if (typeof item.value.scopeRoot !== "string" || typeof item.value.sourceVersion !== "string") {
      return failure(
        diagnostic("invalid-evidence-record", "Canonical evidence provenance context is malformed"),
      );
    }
    const declared = intrinsicArray(item.value.declaredScopes, 256, "Evidence declared scopes");
    if (!declared.ok) return declared;
    const declaredScopes: string[] = [];
    for (const scope of declared.value) {
      if (typeof scope !== "string" || declaredScopes.includes(scope)) {
        return failure(
          diagnostic("invalid-evidence-record", "Evidence declared scopes must be unique strings"),
        );
      }
      declaredScopes.push(scope);
    }
    if (!declaredScopes.includes(identity.value.scope)) {
      return failure(
        diagnostic(
          "invalid-evidence-record",
          "Evidence declared scopes must include the owning scope",
        ),
      );
    }
    if (
      [...declaredScopes]
        .sort(compareText)
        .some((scope, scopeIndex) => scope !== declaredScopes[scopeIndex])
    ) {
      return failure(
        diagnostic("noncanonical-evidence-order", "Evidence declared scopes must be source-sorted"),
      );
    }
    const session = createObservationSession({
      apiVersion: observationSessionApiVersion,
      epoch: "canonical-validation",
      projectId: identity.value.projectId,
      scopes: declaredScopes.map((scope) => ({
        id: scope,
        resourceRoot: scope === identity.value.scope ? (item.value.scopeRoot as string) : ".",
      })),
      source: {
        id: identity.value.sourceId,
        instance: identity.value.sourceInstance,
        version: item.value.sourceVersion,
      },
    });
    if (!session.ok) return session;
    const submitted = session.value.submitBatch({
      epoch: "canonical-validation",
      records: [item.value.observation as ObservationRecord],
      sequence: 1,
    });
    if (!submitted.ok) return submitted;
    const observation = session.value.complete({
      coverage: declaredScopes.map((scope) => ({
        kinds: Object.freeze([]),
        scope,
        state: "partial" as const,
      })),
      epoch: "canonical-validation",
      sequence: 2,
    });
    if (!observation.ok) return observation;
    const owned = observation.value.records[0]!;
    if (owned.scope !== identity.value.scope || owned.key !== identity.value.key) {
      return failure(
        diagnostic(
          "evidence-identity-mismatch",
          "Evidence identity does not match its exact observation",
        ),
      );
    }
    output.push(
      Object.freeze({
        declaredScopes: Object.freeze(declaredScopes),
        identity: identity.value,
        observation: owned,
        observedGeneration: generation.value,
        scopeRoot: item.value.scopeRoot,
        sourceVersion: observation.value.source.version,
      }),
    );
  }
  output.sort((left, right) =>
    compareText(identityKey(left.identity), identityKey(right.identity)),
  );
  for (let index = 0; index < output.length; index += 1) {
    if (
      identityKey(output[index]!.identity) !==
      identityKey((records.value[index] as { identity: EvidenceObservationIdentity }).identity)
    ) {
      return failure(
        diagnostic("noncanonical-evidence-order", "Evidence shard records must be identity-sorted"),
      );
    }
  }
  return success(Object.freeze(output));
}

function parseDecision(value: unknown): Result<EvidenceBindingDecision> {
  const inspected = inspectExactRecord(
    value,
    [["type"], ["componentId", "type"], ["successor", "type"]],
    "invalid-binding-decision",
    "Evidence binding decision",
  );
  if (!inspected.ok) return inspected;
  if (inspected.value.type === "ignored" && Object.keys(inspected.value).length === 1) {
    return success(Object.freeze({ type: "ignored" as const }));
  }
  if (inspected.value.type === "automatic" || inspected.value.type === "explicit") {
    const component = parseEntityId(
      typeof inspected.value.componentId === "string" ? inspected.value.componentId : "",
    );
    return component.ok
      ? success(Object.freeze({ componentId: component.value, type: inspected.value.type }))
      : component;
  }
  if (inspected.value.type === "superseded") {
    const successor = parseIdentity(inspected.value.successor);
    return successor.ok
      ? success(Object.freeze({ successor: successor.value, type: "superseded" as const }))
      : successor;
  }
  return failure(
    diagnostic("invalid-binding-decision", "Evidence binding decision type is unsupported"),
  );
}

function parseBindingValue(
  value: unknown,
  maximumBindings: number,
  maximumHistory: number,
  maximumTotalHistory: number,
  retainedHistoryEntries = 0,
): Result<readonly CanonicalEvidenceBinding[]> {
  const front = exactRecord(value, ["bindings", "bucket", "schema"], "Canonical binding shard");
  if (!front.ok) return front;
  if (
    front.value.schema !== bindingShardSchema ||
    typeof front.value.bucket !== "string" ||
    !bucketPattern.test(front.value.bucket)
  ) {
    return failure(
      diagnostic(
        "evidence-schema-unsupported",
        "Canonical binding shard schema or bucket is invalid",
      ),
    );
  }
  const bindings = intrinsicArray(
    front.value.bindings,
    maximumBindings,
    "Canonical binding records",
  );
  if (!bindings.ok) return bindings;
  if (bindings.value.length === 0) {
    return failure(
      diagnostic(
        "empty-binding-shard",
        "Canonical binding shards must be absent when they contain no bindings",
      ),
    );
  }
  const output: CanonicalEvidenceBinding[] = [];
  const seen = new Set<string>();
  let totalHistoryEntries = retainedHistoryEntries;
  let previousKey: string | undefined;
  for (let index = 0; index < bindings.value.length; index += 1) {
    const item = exactRecord(
      bindings.value[index],
      ["history", "identity"],
      `Canonical binding ${index}`,
    );
    if (!item.ok) return item;
    const identity = parseIdentity(item.value.identity);
    if (!identity.ok) return identity;
    if (evidenceBucket(identity.value) !== front.value.bucket) {
      return failure(
        diagnostic("binding-wrong-bucket", "Canonical binding is stored in the wrong hash bucket"),
      );
    }
    const key = identityKey(identity.value);
    if (seen.has(key))
      return failure(
        diagnostic("duplicate-evidence-binding", "Canonical binding identity is duplicated"),
      );
    if (previousKey !== undefined && compareText(previousKey, key) >= 0) {
      return failure(
        diagnostic("noncanonical-binding-order", "Canonical bindings must be identity-sorted"),
      );
    }
    previousKey = key;
    seen.add(key);
    const historyLength = inspectIntrinsicArrayLength(
      item.value.history,
      "invalid-evidence-document",
      "Binding history",
    );
    if (!historyLength.ok) return historyLength;
    if (historyLength.value > maximumHistory) {
      return failure(
        diagnostic(
          "evidence-item-limit-exceeded",
          "Binding history exceeds its configured item bound",
          { maximum: maximumHistory },
        ),
      );
    }
    if (historyLength.value > maximumTotalHistory - totalHistoryEntries) {
      return failure(
        diagnostic(
          "evidence-item-limit-exceeded",
          "Aggregate binding history exceeds its configured item bound",
          { maximum: maximumTotalHistory },
        ),
      );
    }
    totalHistoryEntries += historyLength.value;
    const historyValues = intrinsicArray(
      item.value.history,
      historyLength.value,
      "Binding history",
    );
    if (!historyValues.ok) return historyValues;
    if (historyValues.value.length === 0) {
      return failure(
        diagnostic("invalid-binding-history", "Canonical binding history must not be empty"),
      );
    }
    const history: EvidenceBindingHistoryEntry[] = [];
    let priorGeneration = -1;
    for (let historyIndex = 0; historyIndex < historyValues.value.length; historyIndex += 1) {
      const entry = exactRecord(
        historyValues.value[historyIndex],
        ["decision", "generation"],
        `Binding history ${historyIndex}`,
      );
      if (!entry.ok) return entry;
      const generation = parseGraphGeneration(entry.value.generation);
      if (!generation.ok) return generation;
      if (generation.value <= priorGeneration) {
        return failure(
          diagnostic(
            "invalid-binding-history",
            "Binding history generations must increase strictly",
          ),
        );
      }
      priorGeneration = generation.value;
      const decision = parseDecision(entry.value.decision);
      if (!decision.ok) return decision;
      history.push(Object.freeze({ decision: decision.value, generation: generation.value }));
    }
    output.push(Object.freeze({ history: Object.freeze(history), identity: identity.value }));
  }
  return success(Object.freeze(output));
}

function latestDecision(binding: CanonicalEvidenceBinding): EvidenceBindingDecision {
  return binding.history[binding.history.length - 1]!.decision;
}

function sameIdentity(
  left: EvidenceObservationIdentity,
  right: EvidenceObservationIdentity,
): boolean {
  return identityKey(left) === identityKey(right);
}

function sameDecision(left: EvidenceBindingDecision, right: EvidenceBindingDecision): boolean {
  if (left.type !== right.type) return false;
  if (left.type === "automatic" || left.type === "explicit") {
    return (
      (right.type === "automatic" || right.type === "explicit") &&
      left.componentId === right.componentId
    );
  }
  if (left.type === "superseded") {
    return right.type === "superseded" && sameIdentity(left.successor, right.successor);
  }
  return true;
}

function validateBindingGraph(
  evidence: ReadonlyMap<string, CanonicalEvidenceRecord>,
  bindings: ReadonlyMap<string, CanonicalEvidenceBinding>,
  maximumHistoryEntries: number,
  maximumTotalHistoryEntries: number,
): Result<void> {
  const events: Array<
    Readonly<{
      decision: EvidenceBindingDecision;
      generation: GraphGeneration;
      key: string;
    }>
  > = [];
  let totalHistoryEntries = 0;
  for (const key of [...bindings.keys()].sort(compareText)) {
    const binding = bindings.get(key)!;
    if (!evidence.has(key)) {
      return failure(
        diagnostic("binding-evidence-missing", "A binding must name retained canonical evidence"),
      );
    }
    if (
      !Array.isArray(binding.history) ||
      binding.history.length === 0 ||
      binding.history.length > maximumHistoryEntries
    ) {
      return failure(
        diagnostic(
          "invalid-binding-history",
          "Canonical binding history must be nonempty and remain within its configured bound",
          { maximum: maximumHistoryEntries },
        ),
      );
    }
    if (binding.history.length > maximumTotalHistoryEntries - totalHistoryEntries) {
      return failure(
        diagnostic(
          "evidence-item-limit-exceeded",
          "Aggregate binding history exceeds its configured item bound",
          { maximum: maximumTotalHistoryEntries },
        ),
      );
    }
    totalHistoryEntries += binding.history.length;
    let priorGeneration = -1;
    for (const entry of binding.history) {
      const generation = parseGraphGeneration(entry.generation);
      if (!generation.ok || generation.value <= priorGeneration) {
        return failure(
          diagnostic(
            "invalid-binding-history",
            "Binding history generations must increase strictly",
          ),
        );
      }
      priorGeneration = generation.value;
      const decision = parseDecision(entry.decision);
      if (!decision.ok) return decision;
      if (
        decision.value.type === "superseded" &&
        laneKey(binding.identity) !== laneKey(decision.value.successor)
      ) {
        return failure(
          diagnostic(
            "binding-cross-lane-supersession",
            "Every historical evidence supersession must remain inside one source lane",
          ),
        );
      }
      if (
        decision.value.type === "superseded" &&
        sameIdentity(binding.identity, decision.value.successor)
      ) {
        return failure(
          diagnostic("binding-supersession-cycle", "Historical evidence cannot supersede itself"),
        );
      }
      events.push(
        Object.freeze({
          decision: decision.value,
          generation: generation.value,
          key,
        }),
      );
    }
  }

  events.sort(
    (left, right) => left.generation - right.generation || compareText(left.key, right.key),
  );
  const effective = new Map<
    string,
    Readonly<{
      decision: EvidenceBindingDecision;
    }>
  >();
  const reverse = new Map<string, Set<string>>();
  for (let eventIndex = 0; eventIndex < events.length;) {
    const generation = events[eventIndex]!.generation;
    const changed = new Set<string>();
    while (eventIndex < events.length && events[eventIndex]!.generation === generation) {
      const event = events[eventIndex]!;
      const prior = effective.get(event.key);
      if (prior?.decision.type === "superseded") {
        const priorTarget = identityKey(prior.decision.successor);
        const predecessors = reverse.get(priorTarget);
        predecessors?.delete(event.key);
        if (predecessors?.size === 0) reverse.delete(priorTarget);
      }
      effective.set(event.key, Object.freeze({ decision: event.decision }));
      if (event.decision.type === "superseded") {
        const target = identityKey(event.decision.successor);
        const predecessors = reverse.get(target) ?? new Set<string>();
        predecessors.add(event.key);
        reverse.set(target, predecessors);
      }
      changed.add(event.key);
      eventIndex += 1;
    }

    const affected = new Set(changed);
    const pending = [...changed].sort(compareText);
    for (let pendingIndex = 0; pendingIndex < pending.length; pendingIndex += 1) {
      const predecessors = [...(reverse.get(pending[pendingIndex]!) ?? [])].sort(compareText);
      for (const predecessor of predecessors) {
        if (affected.has(predecessor)) continue;
        affected.add(predecessor);
        pending.push(predecessor);
      }
    }
    const validation = new Map<string, "valid" | "visiting">();
    for (const start of [...affected].sort(compareText)) {
      if (validation.get(start) === "valid") continue;
      const path: string[] = [];
      let current = start;
      while (true) {
        const currentBinding = effective.get(current);
        if (currentBinding === undefined) {
          return failure(
            diagnostic(
              "binding-terminal-missing",
              "Evidence supersession must end at one effective decision at every recorded generation",
            ),
          );
        }
        if (!affected.has(current) || validation.get(current) === "valid") {
          for (const key of path) validation.set(key, "valid");
          break;
        }
        if (validation.get(current) === "visiting") {
          return failure(
            diagnostic(
              "binding-supersession-cycle",
              "Evidence supersession chains must be acyclic at every recorded generation",
            ),
          );
        }
        validation.set(current, "visiting");
        path.push(current);
        if (currentBinding.decision.type !== "superseded") {
          for (const key of path) validation.set(key, "valid");
          break;
        }
        current = identityKey(currentBinding.decision.successor);
      }
    }
  }
  return success(undefined);
}

function serializeSource(source: CanonicalEvidenceSource): Result<EvidenceBindingDocument> {
  const locator = evidenceSourceLocator(source);
  if (!locator.ok) return locator;
  const bytes = markdown(sourceFrontmatter(source));
  return bytes.ok ? success(document("source", locator.value, bytes.value)) : bytes;
}

function serializeEvidenceShard(
  bucket: string,
  records: readonly CanonicalEvidenceRecord[],
): Result<EvidenceBindingDocument> {
  const locator = evidenceShardLocator(bucket);
  if (!locator.ok) return locator;
  const bytes = markdown(evidenceFrontmatter(bucket, records));
  return bytes.ok ? success(document("evidence-shard", locator.value, bytes.value, bucket)) : bytes;
}

function serializeBindingShard(
  bucket: string,
  bindings: readonly CanonicalEvidenceBinding[],
): Result<EvidenceBindingDocument> {
  const locator = bindingShardLocator(bucket);
  if (!locator.ok) return locator;
  const bytes = markdown(bindingFrontmatter(bucket, bindings));
  return bytes.ok ? success(document("binding-shard", locator.value, bytes.value, bucket)) : bytes;
}

function snapshotFromValues(
  sourcesValue: readonly CanonicalEvidenceSource[],
  evidenceValue: readonly CanonicalEvidenceRecord[],
  bindingsValue: readonly CanonicalEvidenceBinding[],
  documentsValue: readonly EvidenceBindingDocument[],
  limits: EvidenceBindingStoreBounds,
): Result<EvidenceBindingSnapshot> {
  if (
    sourcesValue.length > limits.maxSources ||
    evidenceValue.length > limits.maxEvidenceRecords ||
    bindingsValue.length > limits.maxBindings
  ) {
    return failure(
      diagnostic(
        "evidence-item-limit-exceeded",
        "Canonical evidence snapshot exceeds its configured item bounds",
      ),
    );
  }
  const sources = [...sourcesValue].sort((left, right) =>
    compareText(laneKey(left), laneKey(right)),
  );
  const sourceContexts = new Map<
    string,
    {
      readonly currentRecords: ObservationRecord[];
      readonly scopeIds: readonly string[];
      readonly scopeRoots: ReadonlyMap<string, string>;
      readonly source: CanonicalEvidenceSource;
    }
  >();
  for (const source of sources) {
    const key = laneKey(source);
    if (sourceContexts.has(key))
      return failure(
        diagnostic("duplicate-evidence-source", "Canonical source lane is duplicated"),
      );
    sourceContexts.set(key, {
      currentRecords: [],
      scopeIds: Object.freeze(source.scopes.map((scope) => scope.id).sort(compareText)),
      scopeRoots: new Map(source.scopes.map((scope) => [scope.id, scope.resourceRoot])),
      source,
    });
  }
  const evidence = [...evidenceValue].sort((left, right) =>
    compareText(identityKey(left.identity), identityKey(right.identity)),
  );
  const evidenceMap = new Map<string, CanonicalEvidenceRecord>();
  for (const entry of evidence) {
    const key = identityKey(entry.identity);
    if (evidenceMap.has(key))
      return failure(
        diagnostic("duplicate-evidence-record", "Canonical evidence identity is duplicated"),
      );
    const sourceContext = sourceContexts.get(laneKey(entry.identity));
    if (sourceContext === undefined) {
      return failure(
        diagnostic(
          "evidence-source-missing",
          "Canonical evidence must name one persisted source lane",
        ),
      );
    }
    const source = sourceContext.source;
    if (entry.observedGeneration > source.generation) {
      return failure(
        diagnostic(
          "evidence-generation-ahead",
          "Evidence generation cannot be newer than its source snapshot",
        ),
      );
    }
    if (entry.observedGeneration === source.generation) {
      if (
        entry.sourceVersion !== source.sourceVersion ||
        sourceContext.scopeRoots.get(entry.identity.scope) !== entry.scopeRoot ||
        entry.declaredScopes.length !== sourceContext.scopeIds.length ||
        entry.declaredScopes.some((scope, index) => scope !== sourceContext.scopeIds[index])
      ) {
        return failure(
          diagnostic(
            "evidence-source-context-mismatch",
            "Current evidence provenance context must match its completed source snapshot",
          ),
        );
      }
      sourceContext.currentRecords.push(entry.observation);
    }
    evidenceMap.set(key, entry);
  }
  for (const source of sources) {
    const sourceContext = sourceContexts.get(laneKey(source))!;
    if (sourceContext.currentRecords.length !== source.recordCount) {
      return failure(
        diagnostic(
          "evidence-source-count-mismatch",
          "Canonical source recordCount does not match its current evidence generation",
        ),
      );
    }
    const fingerprint = semanticSnapshotFingerprint({
      apiVersion: observationSessionApiVersion,
      coverage: source.coverage,
      epoch: "canonical-validation",
      projectId: source.projectId,
      records: Object.freeze(sourceContext.currentRecords),
      scopes: source.scopes,
      source: Object.freeze({
        id: source.sourceId,
        instance: source.sourceInstance,
        version: source.sourceVersion,
      }),
    });
    if (!fingerprint.ok || fingerprint.value !== source.snapshotFingerprint) {
      return failure(
        diagnostic(
          "evidence-source-fingerprint-mismatch",
          "Canonical source fingerprint does not match its current completed snapshot",
        ),
      );
    }
  }
  const bindings = [...bindingsValue].sort((left, right) =>
    compareText(identityKey(left.identity), identityKey(right.identity)),
  );
  const bindingMap = new Map<string, CanonicalEvidenceBinding>();
  for (const binding of bindings) {
    const key = identityKey(binding.identity);
    if (bindingMap.has(key))
      return failure(
        diagnostic("duplicate-evidence-binding", "Canonical binding identity is duplicated"),
      );
    bindingMap.set(key, binding);
  }
  const validBindings = validateBindingGraph(
    evidenceMap,
    bindingMap,
    limits.maxBindingHistoryEntries,
    limits.maxTotalBindingHistoryEntries,
  );
  if (!validBindings.ok) return validBindings;
  const documents = [...documentsValue].sort((left, right) =>
    compareText(left.resource, right.resource),
  );
  const documentResources = new Set<string>();
  for (const item of documents) {
    if (documentResources.has(item.resource)) {
      return failure(
        diagnostic("duplicate-evidence-document", "Canonical evidence resource is duplicated"),
      );
    }
    documentResources.add(item.resource);
  }
  return success(
    Object.freeze({
      bindings: Object.freeze(bindings),
      documents: Object.freeze(documents),
      evidence: Object.freeze(evidence),
      sources: Object.freeze(sources),
    }),
  );
}

function sourceFromSnapshot(
  snapshot: CompletedObservationSnapshot,
  generation: GraphGeneration,
  fingerprint: string,
): CanonicalEvidenceSource {
  return Object.freeze({
    coverage: snapshot.coverage,
    generation,
    projectId: snapshot.projectId,
    recordCount: snapshot.records.length,
    scopes: snapshot.scopes,
    snapshotFingerprint: fingerprint,
    sourceId: snapshot.source.id,
    sourceInstance: snapshot.source.instance,
    sourceVersion: snapshot.source.version,
  });
}

function evidenceFromObservation(
  snapshot: CompletedObservationSnapshot,
  observation: ObservationRecord,
  generation: GraphGeneration,
  context: Readonly<{
    declaredScopes: readonly string[];
    scopeRoots: ReadonlyMap<string, string>;
  }>,
): CanonicalEvidenceRecord {
  return Object.freeze({
    declaredScopes: context.declaredScopes,
    identity: Object.freeze({
      key: observation.key,
      projectId: snapshot.projectId,
      scope: observation.scope,
      sourceId: snapshot.source.id,
      sourceInstance: snapshot.source.instance,
    }),
    observation,
    observedGeneration: generation,
    scopeRoot: context.scopeRoots.get(observation.scope)!,
    sourceVersion: snapshot.source.version,
  });
}

function maximumGeneration(snapshot: EvidenceBindingSnapshot): number {
  let maximum = -1;
  for (const source of snapshot.sources) maximum = Math.max(maximum, source.generation);
  for (const binding of snapshot.bindings) {
    maximum = Math.max(maximum, binding.history[binding.history.length - 1]?.generation ?? -1);
  }
  return maximum;
}

function parseMutation(value: unknown): Result<EvidenceBindingMutation> {
  const record = exactRecord(value, ["decision", "identity"], "Evidence binding mutation");
  if (!record.ok) return record;
  const identity = parseIdentity(record.value.identity);
  if (!identity.ok) return identity;
  const decision = parseDecision(record.value.decision);
  return decision.ok
    ? success(Object.freeze({ decision: decision.value, identity: identity.value }))
    : decision;
}

function fanoutStatistics(
  sources: readonly CanonicalEvidenceSource[],
  evidence: readonly CanonicalEvidenceRecord[],
  documents: readonly EvidenceBindingDocument[],
): readonly EvidenceFanoutBucketStatistic[] {
  const sourceGenerations = new Map(sources.map((source) => [laneKey(source), source.generation]));
  const documentsByBucket = new Map(
    documents
      .filter((item) => item.kind === "evidence-shard" && item.bucket !== undefined)
      .map((item) => [item.bucket!, item]),
  );
  const retained = new Map<string, number>();
  const current = new Map<string, number>();
  const distinct = new Map<string, Set<string>>();
  for (const entry of evidence) {
    const bucket = evidenceBucket(entry.identity);
    retained.set(bucket, (retained.get(bucket) ?? 0) + 1);
    if (sourceGenerations.get(laneKey(entry.identity)) === entry.observedGeneration) {
      current.set(bucket, (current.get(bucket) ?? 0) + 1);
    }
    const lanes = distinct.get(bucket) ?? new Set<string>();
    lanes.add(laneKey(entry.identity));
    distinct.set(bucket, lanes);
  }
  return Object.freeze(
    Array.from({ length: canonicalEvidenceBucketCount }, (_, index) => {
      const bucket = index.toString(16).padStart(2, "0");
      return Object.freeze({
        bucket,
        currentCount: current.get(bucket) ?? 0,
        distinctSourceCount: distinct.get(bucket)?.size ?? 0,
        retainedCount: retained.get(bucket) ?? 0,
        serializedBytes: documentsByBucket.get(bucket)?.bytes.byteLength ?? 0,
      });
    }),
  );
}

function materializeDocuments(
  sources: readonly CanonicalEvidenceSource[],
  evidence: readonly CanonicalEvidenceRecord[],
  bindings: readonly CanonicalEvidenceBinding[],
): Result<readonly EvidenceBindingDocument[]> {
  const documents: EvidenceBindingDocument[] = [];
  for (const source of sources) {
    const serialized = serializeSource(source);
    if (!serialized.ok) return serialized;
    documents.push(serialized.value);
  }
  const evidenceBuckets = new Map<string, CanonicalEvidenceRecord[]>();
  for (const entry of evidence) {
    const bucket = evidenceBucket(entry.identity);
    const entries = evidenceBuckets.get(bucket) ?? [];
    entries.push(entry);
    evidenceBuckets.set(bucket, entries);
  }
  for (const [bucket, records] of [...evidenceBuckets].sort(([left], [right]) =>
    compareText(left, right),
  )) {
    records.sort((left, right) =>
      compareText(identityKey(left.identity), identityKey(right.identity)),
    );
    const serialized = serializeEvidenceShard(bucket, records);
    if (!serialized.ok) return serialized;
    documents.push(serialized.value);
  }
  const bindingBuckets = new Map<string, CanonicalEvidenceBinding[]>();
  for (const binding of bindings) {
    const bucket = evidenceBucket(binding.identity);
    const entries = bindingBuckets.get(bucket) ?? [];
    entries.push(binding);
    bindingBuckets.set(bucket, entries);
  }
  for (const [bucket, records] of [...bindingBuckets].sort(([left], [right]) =>
    compareText(left, right),
  )) {
    records.sort((left, right) =>
      compareText(identityKey(left.identity), identityKey(right.identity)),
    );
    const serialized = serializeBindingShard(bucket, records);
    if (!serialized.ok) return serialized;
    documents.push(serialized.value);
  }
  documents.sort((left, right) => compareText(left.resource, right.resource));
  return success(Object.freeze(documents));
}

function transactionTargets(
  current: readonly EvidenceBindingDocument[],
  next: readonly EvidenceBindingDocument[],
): readonly CanonicalTransactionTarget[] {
  const prior = new Map(current.map((item) => [item.resource, item]));
  const future = new Map(next.map((item) => [item.resource, item]));
  const resources = [...new Set([...prior.keys(), ...future.keys()])].sort(compareText);
  const targets: CanonicalTransactionTarget[] = [];
  for (const key of resources) {
    const before = prior.get(key);
    const after = future.get(key);
    if (before?.revision === after?.revision) continue;
    if (after === undefined) {
      targets.push(
        Object.freeze({
          expected: before!.revision,
          locator: before!.locator,
          resource: before!.resource,
          result: null,
        }),
      );
    } else {
      targets.push(
        Object.freeze({
          expected: before?.revision ?? null,
          locator: after.locator,
          replacement: after.bytes,
          resource: after.resource,
          result: after.revision,
        }),
      );
    }
  }
  return Object.freeze(targets);
}

function validatePlaneEntry(
  entry: ResourceEntry,
  plane: "bindings" | "evidence",
): Result<"document" | "directory"> {
  const locator = String(entry.locator);
  const validFile =
    plane === "evidence"
      ? sourceDocumentPattern.test(locator) || evidenceShardPattern.test(locator)
      : bindingShardPattern.test(locator);
  if (entry.kind === "file" && validFile) return success("document");
  const validDirectory =
    plane === "evidence"
      ? /^groma\/evidence\/(?:sources|shards)$/.test(locator) ||
        /^groma\/evidence\/sources\/[0-9a-f]{2}$/.test(locator)
      : locator === "groma/bindings/shards";
  return entry.kind === "directory" && validDirectory
    ? success("directory")
    : failure(
        diagnostic(
          "evidence-resource-layout-invalid",
          "Canonical evidence plane contains an unsupported kind or locator",
          {
            locator,
          },
        ),
      );
}

async function enumeratePlane(
  resources: Pick<LocalResourceProvider, "enumerate">,
  root: WorkspaceResourceLocator,
  plane: "bindings" | "evidence",
  limits: EvidenceBindingStoreBounds,
): Promise<Result<readonly WorkspaceResourceLocator[]>> {
  const locators: WorkspaceResourceLocator[] = [];
  let cursor: Parameters<LocalResourceProvider["enumerate"]>[0]["cursor"];
  let receivedPage = false;
  let pageCount = 0;
  const maximumDocuments = limits.maxSources + canonicalEvidenceBucketCount * 2;
  const maximumPages = maximumDocuments + canonicalEvidenceBucketCount + 4;
  do {
    pageCount += 1;
    if (pageCount > maximumPages) {
      return failure(
        diagnostic(
          "evidence-provider-failure",
          "Canonical evidence enumeration did not complete within its progress bound",
        ),
      );
    }
    const page = await resources.enumerate({
      ...(cursor === undefined ? {} : { cursor }),
      limit: limits.pageSize,
      locator: root,
      maxDepth: plane === "evidence" ? 3 : 2,
      maxEntriesPerDirectory: limits.maxEntriesPerDirectory,
    });
    if (!page.ok) {
      if (!receivedPage && page.diagnostics[0]?.code === "resource-missing") {
        return success(Object.freeze([]));
      }
      if (receivedPage && page.diagnostics[0]?.code === "resource-missing") {
        return failure(
          diagnostic(
            "evidence-provider-failure",
            "Canonical evidence plane disappeared during enumeration",
          ),
        );
      }
      return page;
    }
    receivedPage = true;
    if (page.value.nextCursor !== undefined && page.value.entries.length === 0) {
      return failure(
        diagnostic(
          "evidence-provider-failure",
          "Canonical evidence provider returned a non-progressing page",
        ),
      );
    }
    if (page.value.truncatedByDepth) {
      return failure(
        diagnostic(
          "evidence-resource-layout-invalid",
          "Canonical evidence resources exceed their exact layout depth",
        ),
      );
    }
    for (const entry of page.value.entries) {
      const valid = validatePlaneEntry(entry, plane);
      if (!valid.ok) return valid;
      if (valid.value === "document") {
        locators.push(entry.locator);
        if (locators.length > maximumDocuments) {
          return failure(
            diagnostic(
              "evidence-document-limit-exceeded",
              "Canonical evidence document count exceeds its bound",
            ),
          );
        }
      }
    }
    cursor = page.value.nextCursor;
  } while (cursor !== undefined);
  locators.sort(compareText);
  for (let index = 1; index < locators.length; index += 1) {
    if (locators[index - 1] === locators[index]) {
      return failure(
        diagnostic(
          "duplicate-evidence-document",
          "Canonical evidence enumeration returned a duplicate locator",
        ),
      );
    }
  }
  return success(Object.freeze(locators));
}

export function createEvidenceBindingStore(options: {
  readonly bounds?: Partial<EvidenceBindingStoreBounds>;
  readonly resources: Pick<LocalResourceProvider, "enumerate" | "read">;
}): EvidenceBindingStore {
  const limits = parseBounds(options.bounds);

  const decodeSource = (
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Result<CanonicalEvidenceSource> => {
    const front = yamlFrontmatter(bytes, limits.maxDocumentBytes);
    if (!front.ok) return front;
    const parsed = parseSourceValue(front.value.value, locator, limits.maxEvidenceRecords);
    if (!parsed.ok) return parsed;
    const canonical = serializeSource(parsed.value);
    return canonical.ok && sameBytes(canonical.value.bytes, front.value.bytes)
      ? parsed
      : failure(
          diagnostic(
            "noncanonical-evidence-document",
            "Canonical evidence source bytes do not match deterministic serialization",
          ),
        );
  };

  const decodeEvidenceShardWithin = (
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
    maximumRecords: number,
  ): Result<readonly CanonicalEvidenceRecord[]> => {
    const match = String(locator).match(evidenceShardPattern);
    if (match === null)
      return failure(diagnostic("evidence-wrong-location", "Evidence shard locator is invalid"));
    const front = yamlFrontmatter(bytes, limits.maxDocumentBytes);
    if (!front.ok) return front;
    const parsed = parseEvidenceValue(front.value.value, maximumRecords);
    if (!parsed.ok) return parsed;
    const bucket = (front.value.value as { bucket: string }).bucket;
    if (bucket !== match[1]) {
      return failure(
        diagnostic(
          "evidence-wrong-location",
          "Evidence shard frontmatter does not match its locator",
        ),
      );
    }
    const canonical = serializeEvidenceShard(bucket, parsed.value);
    return canonical.ok && sameBytes(canonical.value.bytes, front.value.bytes)
      ? parsed
      : failure(
          diagnostic(
            "noncanonical-evidence-document",
            "Canonical evidence shard bytes do not match deterministic serialization",
          ),
        );
  };

  const decodeEvidenceShard = (
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Result<readonly CanonicalEvidenceRecord[]> =>
    decodeEvidenceShardWithin(locator, bytes, limits.maxEvidenceRecords);

  const decodeBindingShardWithin = (
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
    maximumBindings: number,
    retainedHistoryEntries: number,
  ): Result<readonly CanonicalEvidenceBinding[]> => {
    const match = String(locator).match(bindingShardPattern);
    if (match === null)
      return failure(diagnostic("evidence-wrong-location", "Binding shard locator is invalid"));
    const front = yamlFrontmatter(bytes, limits.maxDocumentBytes);
    if (!front.ok) return front;
    const parsed = parseBindingValue(
      front.value.value,
      maximumBindings,
      limits.maxBindingHistoryEntries,
      limits.maxTotalBindingHistoryEntries,
      retainedHistoryEntries,
    );
    if (!parsed.ok) return parsed;
    const bucket = (front.value.value as { bucket: string }).bucket;
    if (bucket !== match[1]) {
      return failure(
        diagnostic(
          "evidence-wrong-location",
          "Binding shard frontmatter does not match its locator",
        ),
      );
    }
    const canonical = serializeBindingShard(bucket, parsed.value);
    return canonical.ok && sameBytes(canonical.value.bytes, front.value.bytes)
      ? parsed
      : failure(
          diagnostic(
            "noncanonical-evidence-document",
            "Canonical binding shard bytes do not match deterministic serialization",
          ),
        );
  };

  const decodeBindingShard = (
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Result<readonly CanonicalEvidenceBinding[]> =>
    decodeBindingShardWithin(locator, bytes, limits.maxBindings, 0);

  const load = async (): Promise<Result<EvidenceBindingSnapshot>> => {
    const evidenceRoot = workspaceResourceLocator("groma", "evidence");
    const bindingRoot = workspaceResourceLocator("groma", "bindings");
    if (!evidenceRoot.ok || !bindingRoot.ok) throw new Error("Built-in evidence roots are invalid");
    const evidenceLocators = await enumeratePlane(
      options.resources,
      evidenceRoot.value,
      "evidence",
      limits,
    );
    if (!evidenceLocators.ok) return evidenceLocators;
    const bindingLocators = await enumeratePlane(
      options.resources,
      bindingRoot.value,
      "bindings",
      limits,
    );
    if (!bindingLocators.ok) return bindingLocators;
    const sources: CanonicalEvidenceSource[] = [];
    const evidence: CanonicalEvidenceRecord[] = [];
    const bindings: CanonicalEvidenceBinding[] = [];
    const documents: EvidenceBindingDocument[] = [];
    let totalBytes = 0;
    let totalBindingHistoryEntries = 0;
    for (const locator of [...evidenceLocators.value, ...bindingLocators.value].sort(compareText)) {
      const loaded = await options.resources.read({ locator, maxBytes: limits.maxDocumentBytes });
      if (!loaded.ok) return loaded;
      const accounted = accountDocumentBytes(loaded.value.bytes, totalBytes, limits);
      if (!accounted.ok) return accounted;
      const copied = accounted.value.bytes;
      totalBytes = accounted.value.totalBytes;
      if (sourceDocumentPattern.test(locator)) {
        if (sources.length >= limits.maxSources) {
          return failure(
            diagnostic(
              "evidence-item-limit-exceeded",
              "Canonical evidence sources exceed their configured item bound",
              { maximum: limits.maxSources },
            ),
          );
        }
        const decoded = decodeSource(locator, copied);
        if (!decoded.ok) return decoded;
        sources.push(decoded.value);
        documents.push(document("source", locator, copied));
      } else if (evidenceShardPattern.test(locator)) {
        const decoded = decodeEvidenceShardWithin(
          locator,
          copied,
          limits.maxEvidenceRecords - evidence.length,
        );
        if (!decoded.ok) return decoded;
        for (const entry of decoded.value) evidence.push(entry);
        documents.push(document("evidence-shard", locator, copied, locator.slice(-5, -3)));
      } else {
        const decoded = decodeBindingShardWithin(
          locator,
          copied,
          limits.maxBindings - bindings.length,
          totalBindingHistoryEntries,
        );
        if (!decoded.ok) return decoded;
        for (const binding of decoded.value) {
          totalBindingHistoryEntries += binding.history.length;
          bindings.push(binding);
        }
        documents.push(document("binding-shard", locator, copied, locator.slice(-5, -3)));
      }
    }
    return snapshotFromValues(sources, evidence, bindings, documents, limits);
  };

  const plan = (
    current: EvidenceBindingSnapshot,
    input: EvidenceBindingPlanInput,
  ): Result<EvidenceBindingPlan> => {
    const generation = parseGraphGeneration(input.generation);
    if (!generation.ok) return generation;
    if (
      current.sources.length > limits.maxSources ||
      current.evidence.length > limits.maxEvidenceRecords ||
      current.bindings.length > limits.maxBindings
    ) {
      return failure(
        diagnostic(
          "evidence-item-limit-exceeded",
          "Loaded canonical evidence exceeds its configured item bounds",
        ),
      );
    }
    const sourceMap = new Map(current.sources.map((source) => [laneKey(source), source]));
    const evidenceMap = new Map(
      current.evidence.map((entry) => [identityKey(entry.identity), entry]),
    );
    const bindingMap = new Map<string, CanonicalEvidenceBinding>();
    let totalBindingHistoryEntries = 0;
    for (const binding of current.bindings) {
      if (
        binding.history.length >
        limits.maxTotalBindingHistoryEntries - totalBindingHistoryEntries
      ) {
        return failure(
          diagnostic(
            "evidence-item-limit-exceeded",
            "Aggregate binding history exceeds its configured item bound",
            { maximum: limits.maxTotalBindingHistoryEntries },
          ),
        );
      }
      totalBindingHistoryEntries += binding.history.length;
      bindingMap.set(identityKey(binding.identity), binding);
    }
    let semanticChange = false;
    if (input.completedSnapshot !== undefined) {
      const canonical = canonicalSnapshot(input.completedSnapshot, limits.maxEvidenceRecords);
      if (!canonical.ok) return canonical;
      const fingerprint = semanticSnapshotFingerprint(canonical.value);
      if (!fingerprint.ok) return fingerprint;
      const lane: EvidenceSourceLane = {
        projectId: canonical.value.projectId,
        sourceId: canonical.value.source.id,
        sourceInstance: canonical.value.source.instance,
      };
      const prior = sourceMap.get(laneKey(lane));
      if (prior?.snapshotFingerprint !== fingerprint.value) {
        if (prior === undefined && sourceMap.size >= limits.maxSources) {
          return failure(
            diagnostic(
              "evidence-item-limit-exceeded",
              "Planned canonical sources exceed their configured item bound",
              { maximum: limits.maxSources },
            ),
          );
        }
        semanticChange = true;
        sourceMap.set(
          laneKey(lane),
          sourceFromSnapshot(canonical.value, generation.value, fingerprint.value),
        );
        const observationContext = Object.freeze({
          declaredScopes: Object.freeze(
            canonical.value.scopes.map((scope) => scope.id).sort(compareText),
          ),
          scopeRoots: new Map(
            canonical.value.scopes.map((scope) => [scope.id, scope.resourceRoot]),
          ),
        });
        for (const observation of canonical.value.records) {
          const entry = evidenceFromObservation(
            canonical.value,
            observation,
            generation.value,
            observationContext,
          );
          const key = identityKey(entry.identity);
          if (!evidenceMap.has(key) && evidenceMap.size >= limits.maxEvidenceRecords) {
            return failure(
              diagnostic(
                "evidence-item-limit-exceeded",
                "Planned canonical evidence exceeds its configured item bound",
                { maximum: limits.maxEvidenceRecords },
              ),
            );
          }
          evidenceMap.set(key, entry);
        }
      }
    }
    const mutationsValue = input.bindingMutations ?? Object.freeze([]);
    const mutationValues = intrinsicArray(
      mutationsValue,
      limits.maxBindings,
      "Evidence binding mutations",
    );
    if (!mutationValues.ok) return mutationValues;
    const mutated = new Set<string>();
    for (const value of mutationValues.value) {
      const mutation = parseMutation(value);
      if (!mutation.ok) return mutation;
      const key = identityKey(mutation.value.identity);
      if (mutated.has(key)) {
        return failure(
          diagnostic(
            "duplicate-binding-mutation",
            "One plan cannot decide the same evidence identity twice",
          ),
        );
      }
      mutated.add(key);
      if (!evidenceMap.has(key)) {
        return failure(
          diagnostic(
            "binding-evidence-missing",
            "A binding mutation must name retained or newly completed evidence",
          ),
        );
      }
      const prior = bindingMap.get(key);
      if (prior !== undefined && sameDecision(latestDecision(prior), mutation.value.decision))
        continue;
      if (prior === undefined && bindingMap.size >= limits.maxBindings) {
        return failure(
          diagnostic(
            "evidence-item-limit-exceeded",
            "Planned canonical bindings exceed their configured item bound",
            { maximum: limits.maxBindings },
          ),
        );
      }
      const nextHistoryLength = (prior?.history.length ?? 0) + 1;
      if (nextHistoryLength > limits.maxBindingHistoryEntries) {
        return failure(
          diagnostic(
            "evidence-item-limit-exceeded",
            "Planned binding history exceeds its configured item bound",
            { maximum: limits.maxBindingHistoryEntries },
          ),
        );
      }
      if (totalBindingHistoryEntries >= limits.maxTotalBindingHistoryEntries) {
        return failure(
          diagnostic(
            "evidence-item-limit-exceeded",
            "Aggregate binding history exceeds its configured item bound",
            { maximum: limits.maxTotalBindingHistoryEntries },
          ),
        );
      }
      semanticChange = true;
      totalBindingHistoryEntries += 1;
      bindingMap.set(
        key,
        Object.freeze({
          history: Object.freeze([
            ...(prior?.history ?? []),
            Object.freeze({ decision: mutation.value.decision, generation: generation.value }),
          ]),
          identity: mutation.value.identity,
        }),
      );
    }
    if (semanticChange && generation.value <= maximumGeneration(current)) {
      return failure(
        diagnostic(
          "evidence-generation-not-advanced",
          "A canonical evidence change requires a graph generation newer than loaded state",
        ),
      );
    }
    if (
      evidenceMap.size > limits.maxEvidenceRecords ||
      sourceMap.size > limits.maxSources ||
      bindingMap.size > limits.maxBindings
    ) {
      return failure(
        diagnostic(
          "evidence-item-limit-exceeded",
          "Planned canonical evidence exceeds its configured item bounds",
        ),
      );
    }
    const validBindings = validateBindingGraph(
      evidenceMap,
      bindingMap,
      limits.maxBindingHistoryEntries,
      limits.maxTotalBindingHistoryEntries,
    );
    if (!validBindings.ok) return validBindings;
    const sources = [...sourceMap.values()].sort((left, right) =>
      compareText(laneKey(left), laneKey(right)),
    );
    const evidence = [...evidenceMap.values()].sort((left, right) =>
      compareText(identityKey(left.identity), identityKey(right.identity)),
    );
    const bindings = [...bindingMap.values()].sort((left, right) =>
      compareText(identityKey(left.identity), identityKey(right.identity)),
    );
    const materialized = materializeDocuments(sources, evidence, bindings);
    if (!materialized.ok) return materialized;
    let totalDocumentBytes = 0;
    for (const item of materialized.value) {
      const accounted = accountDocumentBytes(item.bytes, totalDocumentBytes, limits);
      if (!accounted.ok) return accounted;
      totalDocumentBytes = accounted.value.totalBytes;
    }
    const snapshot = snapshotFromValues(sources, evidence, bindings, materialized.value, limits);
    if (!snapshot.ok) return snapshot;
    const targets = transactionTargets(current.documents, snapshot.value.documents);
    return success(
      Object.freeze({
        changed: targets.length > 0,
        fanout: fanoutStatistics(
          snapshot.value.sources,
          snapshot.value.evidence,
          snapshot.value.documents,
        ),
        snapshot: snapshot.value,
        targets,
      }),
    );
  };

  const resolve = (
    snapshot: EvidenceBindingSnapshot,
    identity: EvidenceObservationIdentity,
    aliases: EntityAliasResolver,
  ): Result<ResolvedEvidenceBinding> => {
    const requested = parseIdentity(identity);
    if (!requested.ok) return requested;
    const bindings = new Map(
      snapshot.bindings.map((binding) => [identityKey(binding.identity), binding]),
    );
    const chain: EvidenceObservationIdentity[] = [];
    const seen = new Set<string>();
    let current = requested.value;
    while (true) {
      const key = identityKey(current);
      if (seen.has(key))
        return failure(
          diagnostic("binding-supersession-cycle", "Evidence supersession chains must be acyclic"),
        );
      seen.add(key);
      const binding = bindings.get(key);
      if (binding === undefined)
        return failure(
          diagnostic(
            "binding-terminal-missing",
            "No binding decision exists for the evidence identity",
          ),
        );
      const decision = latestDecision(binding);
      if (decision.type === "superseded") {
        if (laneKey(current) !== laneKey(decision.successor)) {
          return failure(
            diagnostic(
              "binding-cross-lane-supersession",
              "Evidence supersession must remain inside one source lane",
            ),
          );
        }
        chain.push(decision.successor);
        current = decision.successor;
        continue;
      }
      if (decision.type === "ignored") {
        return success(
          Object.freeze({
            decision: "ignored" as const,
            observationChain: Object.freeze(chain),
            requested: requested.value,
            terminal: current,
          }),
        );
      }
      const resolved = aliases.resolve(decision.componentId);
      if (!resolved.ok) return resolved;
      return success(
        Object.freeze({
          componentAliasChain: resolved.value.chain,
          decision: decision.type,
          observationChain: Object.freeze(chain),
          requested: requested.value,
          resolvedComponentId: resolved.value.resolved,
          storedComponentId: decision.componentId,
          terminal: current,
        }),
      );
    }
  };

  return Object.freeze({
    decodeBindingShard,
    decodeEvidenceShard,
    decodeSource,
    load,
    plan,
    resolve,
  });
}
