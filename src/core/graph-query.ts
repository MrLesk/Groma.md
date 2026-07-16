import type { GraphEntity, GraphRelation } from "./graph.ts";
import type { EntityId } from "./identity.ts";
import type { BoundedQueryRequest, ExactGraphRead, GraphQueryPage } from "./query.ts";
import type { Result } from "./result.ts";

/** Storage-neutral filter for deterministic entity pages. */
export interface GraphEntityQuery {
  /** Open graph kind token. `component` selects Standard Model components. */
  readonly kind?: string;
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
  exactEntity(id: string): Promise<Result<ExactGraphRead<GraphEntity>>>;
  pageEntities(
    query: GraphEntityQuery,
    request: BoundedQueryRequest,
  ): Promise<Result<GraphQueryPage<GraphEntity>>>;
  searchEntities(
    query: GraphSearchQuery,
    request: BoundedQueryRequest,
  ): Promise<Result<GraphQueryPage<GraphEntity>>>;
  traverseRelations(
    query: GraphTraversalQuery,
    request: BoundedQueryRequest,
  ): Promise<Result<GraphQueryPage<GraphTraversalHit>>>;
}
