import type { EntityAlias } from "./aliases.ts";
import type { GraphCommittedEvent } from "./events.ts";
import type { GraphGeneration } from "./generation.ts";
import type { GraphEntity, GraphRelation } from "./graph.ts";
import type { EntityId, RelationId } from "./identity.ts";
import { failure, type Result, success } from "./result.ts";

declare const projectionCanonicalFingerprintBrand: unique symbol;
const maximumProjectionCanonicalFingerprintCharacters = 128;

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
    value.length > maximumProjectionCanonicalFingerprintCharacters
  ) {
    return failure({
      code: "invalid-projection-canonical-fingerprint",
      details: { maximumCharacters: maximumProjectionCanonicalFingerprintCharacters },
      message: "Projection canonical fingerprint must be a bounded nonempty primitive string",
    });
  }
  return success(value as ProjectionCanonicalFingerprint);
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
