import type { GraphEntity, GraphRelation } from "./graph.ts";
import type { EntityId } from "./identity.ts";
import type { GraphDataScalar } from "./payload.ts";
import type { ProjectionReadIdentity } from "./projection.ts";
import type { BoundedQueryRequest, ExactGraphRead, GraphQueryPage } from "./query.ts";
import type { Result } from "./result.ts";

/** Storage-neutral filter for deterministic entity pages. */
export interface GraphEntityQuery {
  /** Open graph kind token. `component` selects Standard Model components. */
  readonly kind?: string;
  /** Exact top-level scalar payload criteria, interpreted without model-specific field knowledge. */
  readonly payload?: Readonly<Record<string, GraphDataScalar>>;
}

/** Full-text query over provider-derived searchable projection text. */
export interface GraphSearchQuery extends GraphEntityQuery {
  readonly text: string;
}

export type GraphTraversalDirection = "incoming" | "outgoing" | "both";

/** A bounded relationship walk starting at one exact entity or durable alias. */
export interface GraphTraversalQuery {
  readonly depth: number;
  readonly direction: GraphTraversalDirection;
  readonly entity: string;
  readonly relationType?: string;
}

/** One deterministic edge discovery in a bounded breadth-first relationship walk. */
export interface GraphTraversalHit {
  readonly depth: number;
  /** Relation orientation from `from` toward `entity` in this walk. */
  readonly direction: Exclude<GraphTraversalDirection, "both">;
  readonly entity: GraphEntity;
  readonly from: EntityId;
  readonly relation: GraphRelation;
}

/**
 * Replaceable bounded graph-read capability. Callers know graph semantics, generations,
 * and opaque cursors, never the disposable projection's storage technology.
 */
export interface GraphQueryEngineCapability {
  /** Construction-captured maximum accepted by every public bounded page request. */
  readonly maxPageSize: number;
  /** Captures one exact disposable projection identity for a caller-owned read flow. */
  identity(): Promise<Result<ProjectionReadIdentity>>;
  exactEntity(
    expected: ProjectionReadIdentity,
    id: string,
  ): Promise<Result<ExactGraphRead<GraphEntity>>>;
  pageEntities(
    expected: ProjectionReadIdentity,
    query: GraphEntityQuery,
    request: BoundedQueryRequest,
  ): Promise<Result<GraphQueryPage<GraphEntity>>>;
  searchEntities(
    expected: ProjectionReadIdentity,
    query: GraphSearchQuery,
    request: BoundedQueryRequest,
  ): Promise<Result<GraphQueryPage<GraphEntity>>>;
  traverseRelations(
    expected: ProjectionReadIdentity,
    query: GraphTraversalQuery,
    request: BoundedQueryRequest,
  ): Promise<Result<GraphQueryPage<GraphTraversalHit>>>;
}
