import type { EntityAlias } from "./aliases.ts";
import type { GraphCommittedEvent } from "./events.ts";
import type { GraphGeneration } from "./generation.ts";
import type { GraphEntity, GraphRelation } from "./graph.ts";
import type { EntityId, RelationId } from "./identity.ts";
import { failure, type Result, success } from "./result.ts";

declare const projectionCanonicalFingerprintBrand: unique symbol;
declare const projectionReadIntegrityBrand: unique symbol;
export const PROJECTION_CANONICAL_FINGERPRINT_MAX_CHARACTERS = 128;
export const PROJECTION_READ_INTEGRITY_MAX_CHARACTERS = 71;
export const PROJECTION_READ_RESOURCE_COUNT_MAX = 64_000_000;
const projectionReadIntegrityPattern = /^sha256:[0-9a-f]{64}$/;
const intrinsicRegExpTest = RegExp.prototype.test;

/** Provider-defined bounded identity of the exact canonical content represented by a projection. */
export type ProjectionCanonicalFingerprint = string & {
  readonly [projectionCanonicalFingerprintBrand]: true;
};

export function parseProjectionCanonicalFingerprint(
  value: unknown,
): Result<ProjectionCanonicalFingerprint> {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > PROJECTION_CANONICAL_FINGERPRINT_MAX_CHARACTERS
  ) {
    return failure({
      code: "invalid-projection-canonical-fingerprint",
      details: { maximumCharacters: PROJECTION_CANONICAL_FINGERPRINT_MAX_CHARACTERS },
      message: "Projection canonical fingerprint must be a bounded nonempty primitive string",
    });
  }
  return success(value as ProjectionCanonicalFingerprint);
}

/** Bounded content root authenticating one disposable partial-read publication. */
export type ProjectionReadIntegrity = string & {
  readonly [projectionReadIntegrityBrand]: true;
};

export function parseProjectionReadIntegrity(value: unknown): Result<ProjectionReadIntegrity> {
  if (
    typeof value !== "string" ||
    value.length !== PROJECTION_READ_INTEGRITY_MAX_CHARACTERS ||
    !(Reflect.apply(intrinsicRegExpTest, projectionReadIntegrityPattern, [value]) as boolean)
  ) {
    return failure({
      code: "invalid-projection-read-integrity",
      details: { maximumCharacters: PROJECTION_READ_INTEGRITY_MAX_CHARACTERS },
      message: "Projection read integrity must be one exact bounded SHA-256 content root",
    });
  }
  return success(value as ProjectionReadIntegrity);
}

export function parseProjectionReadResourceCount(value: unknown): Result<number> {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > PROJECTION_READ_RESOURCE_COUNT_MAX
  ) {
    return failure({
      code: "invalid-projection-read-resource-count",
      details: { maximum: PROJECTION_READ_RESOURCE_COUNT_MAX },
      message: "Projection read resource count must be one bounded positive safe integer",
    });
  }
  return success(value);
}

/** One exact canonical generation supplied to a replaceable projection provider. */
export interface ProjectionCanonicalSnapshot {
  readonly aliases: readonly EntityAlias[];
  readonly entities: readonly GraphEntity[];
  readonly generation: GraphGeneration;
  readonly relations: readonly GraphRelation[];
}

/** Storage-neutral source used to reconstruct a disposable projection. */
export interface ProjectionCanonicalSource {
  snapshot(): Promise<Result<ProjectionCanonicalSnapshot>>;
}

export interface ProjectedEntity {
  readonly entity: GraphEntity;
  /** Deterministic, provider-derived text. It is never canonical meaning. */
  readonly searchableText: string;
}

export interface ProjectionAdjacency {
  readonly entity: EntityId;
  readonly incoming: readonly RelationId[];
  readonly outgoing: readonly RelationId[];
}

/** Exact identity of one disposable projection generation. */
export interface ProjectionReadIdentity {
  readonly fingerprint: ProjectionCanonicalFingerprint;
  readonly generation: GraphGeneration;
}

/**
 * Tracked operational marker for the last projection publication confirmed by the
 * canonical transaction provider. It is continuity metadata, never graph meaning.
 */
export interface ProjectionContinuityCheckpoint {
  readonly generation: GraphGeneration;
  readonly projection: ProjectionReadIdentity | null;
  readonly projectionIntegrity: ProjectionReadIntegrity | null;
  readonly projectionResourceCount: number | null;
}

export interface ProjectionContinuityCapability {
  readProjectionCheckpoint(): Promise<Result<ProjectionContinuityCheckpoint>>;
  recordProjectionCheckpoint(
    identity: ProjectionReadIdentity,
    integrity: ProjectionReadIntegrity,
    resourceCount: number,
  ): Promise<Result<void>>;
}

export interface ProjectionCatalogReadRequest {
  readonly after?: EntityId;
  readonly limit: number;
}

export interface ProjectionCatalogEntry {
  readonly id: EntityId;
  readonly kind: string;
  /** Provider text whose NFKC/lowercase form fits the bound; the engine repeats that normalization. */
  readonly searchableText: string;
}

export interface ProjectionRelationReadRequest {
  readonly after?: RelationId;
  readonly direction: "incoming" | "outgoing";
  readonly entity: EntityId;
  readonly limit: number;
}

export interface ProjectionRelationRead {
  readonly direction: "incoming" | "outgoing";
  readonly entity: GraphEntity;
  readonly from: EntityId;
  readonly relation: GraphRelation;
}

export interface ProjectionReadPage<T> {
  readonly hasMore: boolean;
  readonly identity: ProjectionReadIdentity;
  readonly items: readonly T[];
  readonly nextAfter?: string;
}

export interface ProjectionReadExact<T> {
  readonly identity: ProjectionReadIdentity;
  readonly value: T;
}

export interface ProjectionReadBatch<T> {
  readonly identity: ProjectionReadIdentity;
  readonly items: readonly T[];
}

/**
 * Storage-neutral partial reads over one exact disposable projection. Providers may
 * use files, a database, or another index; callers never request a whole snapshot.
 */
export interface ProjectionReadCapability {
  /** Reads one live catalog entry without resolving durable aliases. */
  exactCatalogEntry(
    identity: ProjectionReadIdentity,
    id: EntityId,
  ): Promise<Result<ProjectionReadExact<ProjectionCatalogEntry>>>;
  identity(): Promise<Result<ProjectionReadIdentity>>;
  exactEntity(
    identity: ProjectionReadIdentity,
    id: EntityId,
  ): Promise<Result<ProjectionReadExact<GraphEntity>>>;
  /** Reads one bounded, strictly ordered batch of known live entity identities. */
  exactEntities(
    identity: ProjectionReadIdentity,
    ids: readonly EntityId[],
  ): Promise<Result<ProjectionReadBatch<GraphEntity>>>;
  pageCatalog(
    identity: ProjectionReadIdentity,
    request: ProjectionCatalogReadRequest,
  ): Promise<Result<ProjectionReadPage<ProjectionCatalogEntry>>>;
  pageRelations(
    identity: ProjectionReadIdentity,
    request: ProjectionRelationReadRequest,
  ): Promise<Result<ProjectionReadPage<ProjectionRelationRead>>>;
}

/** A complete disposable view of one exact canonical generation. */
export interface ProjectionSnapshot {
  readonly adjacency: readonly ProjectionAdjacency[];
  readonly aliases: readonly EntityAlias[];
  readonly entities: readonly ProjectedEntity[];
  /** Exact content identity checked in addition to the local generation. */
  readonly fingerprint: ProjectionCanonicalFingerprint;
  readonly generation: GraphGeneration;
  readonly relations: readonly GraphRelation[];
}

/**
 * Replaceable projection capability. Implementations may use any disposable storage
 * technology, but every result is reconstructable from ProjectionCanonicalSource.
 */
export interface ProjectionIndexCapability {
  /** Returns the current projection, rebuilding safely when local derived state is stale. */
  load(): Promise<Result<ProjectionSnapshot>>;
  /** Reconstructs and atomically replaces all derived state from canonical records. */
  rebuild(): Promise<Result<ProjectionSnapshot>>;
  /** Applies one committed generation or rebuilds when the event sequence has a gap. */
  update(event: GraphCommittedEvent): Promise<Result<ProjectionSnapshot>>;
}
