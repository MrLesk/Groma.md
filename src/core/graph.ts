import {
  parseEntityId,
  parseRelationId,
  type EntityId,
  type OpaqueIdSource,
  type RelationId,
} from "./identity.ts";
import { copyGraphPayload, type GraphData } from "./payload.ts";
import { failure, type Diagnostic, type Result, success } from "./result.ts";

export type { GraphData, GraphDataRecord, GraphDataScalar } from "./payload.ts";

const snapshotBrand: unique symbol = Symbol("GraphSnapshot");

export interface GraphSnapshot {
  readonly entityCount: number;
  readonly relationCount: number;
  readonly [snapshotBrand]: true;
}

export interface GraphEntity {
  readonly id: EntityId;
  readonly kind: string;
  readonly payload: GraphData;
}

export interface EntityDraft {
  readonly id?: string;
  readonly kind: string;
  readonly payload: unknown;
}

export interface EntityReference {
  readonly id: string;
  readonly expectedKind?: string;
}

export interface GraphRelation {
  readonly id: RelationId;
  readonly type: string;
  readonly source: EntityId;
  readonly target: EntityId;
  readonly payload: GraphData;
}

export interface RelationDraft {
  readonly id?: string;
  readonly type: string;
  readonly source: EntityReference;
  readonly target: EntityReference;
  readonly payload: unknown;
}

export interface GraphPage<TItem, TAfter extends string> {
  readonly items: readonly TItem[];
  readonly hasMore: boolean;
  readonly nextAfter?: TAfter;
}

export interface PageRequest<TAfter extends string> {
  readonly limit: number;
  readonly after?: TAfter | string;
}

export interface EntityPageRequest extends PageRequest<EntityId> {
  readonly kind?: string;
}

export interface RelationTraversalRequest extends PageRequest<RelationId> {
  readonly direction: "incoming" | "outgoing" | "both";
  readonly entity: EntityReference;
}

export interface GraphKernelOptions {
  readonly idSource: OpaqueIdSource;
  readonly maxPageSize: number;
  readonly identityAttempts?: number;
}

interface SnapshotState {
  readonly entities: ReadonlyMap<EntityId, GraphEntity>;
  readonly relations: ReadonlyMap<RelationId, GraphRelation>;
}

const snapshotStates = new WeakMap<GraphSnapshot, SnapshotState>();
const tokenPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

function makeSnapshot(state: SnapshotState): GraphSnapshot {
  const snapshot = Object.freeze({
    entityCount: state.entities.size,
    relationCount: state.relations.size,
    [snapshotBrand]: true as const,
  });
  snapshotStates.set(snapshot, state);
  return snapshot;
}

function stateFor(snapshot: GraphSnapshot): SnapshotState {
  const state = snapshotStates.get(snapshot);
  if (state === undefined) {
    throw new TypeError("Graph snapshot was not created by this graph kernel module");
  }
  return state;
}

function validateToken(
  value: string,
  field: "entity kind" | "relation type",
): Diagnostic | undefined {
  return tokenPattern.test(value)
    ? undefined
    : {
        code: field === "entity kind" ? "invalid-entity-kind" : "invalid-relation-type",
        message: `${field} must be a lowercase dotted or dashed token`,
        details: { value },
      };
}

function validateLimit(limit: number, maximum: number): Result<number> {
  return Number.isSafeInteger(limit) && limit > 0 && limit <= maximum
    ? success(limit)
    : failure({
        code: "invalid-page-limit",
        message: `Page limit must be a positive integer no greater than ${maximum}`,
        details: { limit, maximum },
      });
}

function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function freezeEntity(entity: GraphEntity): GraphEntity {
  return Object.freeze(entity);
}

function freezeRelation(relation: GraphRelation): GraphRelation {
  return Object.freeze(relation);
}

function resolveEntityFrom(
  entities: ReadonlyMap<EntityId, GraphEntity>,
  reference: EntityReference,
): Result<GraphEntity> {
  if (reference.expectedKind !== undefined) {
    const kindDiagnostic = validateToken(reference.expectedKind, "entity kind");
    if (kindDiagnostic !== undefined) return failure(kindDiagnostic);
  }
  const identity = parseEntityId(reference.id);
  if (!identity.ok) return identity;

  const entity = entities.get(identity.value);
  if (entity === undefined) {
    return failure({
      code: "unknown-entity",
      message: "No entity exists for the exact stable identity",
      details: { id: reference.id },
    });
  }

  if (reference.expectedKind !== undefined && entity.kind !== reference.expectedKind) {
    return failure({
      code: "wrong-entity-kind",
      message: "Entity exists but does not have the required kind",
      details: { actual: entity.kind, expected: reference.expectedKind, id: entity.id },
    });
  }

  return success(entity);
}

export class GraphKernel {
  readonly #idSource: OpaqueIdSource;
  readonly #identityAttempts: number;
  readonly #maxPageSize: number;

  constructor(options: GraphKernelOptions) {
    if (!Number.isSafeInteger(options.maxPageSize) || options.maxPageSize <= 0) {
      throw new RangeError("maxPageSize must be a positive safe integer");
    }
    const identityAttempts = options.identityAttempts ?? 8;
    if (!Number.isSafeInteger(identityAttempts) || identityAttempts <= 0) {
      throw new RangeError("identityAttempts must be a positive safe integer");
    }

    this.#idSource = options.idSource;
    this.#identityAttempts = identityAttempts;
    this.#maxPageSize = options.maxPageSize;
  }

  empty(): GraphSnapshot {
    return makeSnapshot({ entities: new Map(), relations: new Map() });
  }

  load(
    entities: readonly EntityDraft[],
    relations: readonly RelationDraft[],
  ): Result<GraphSnapshot> {
    const loadedEntities = new Map<EntityId, GraphEntity>();
    const loadedRelations = new Map<RelationId, GraphRelation>();

    for (const draft of entities) {
      if (draft.id === undefined) {
        return failure({
          code: "missing-persisted-identity",
          message: "Loaded entities must already have stable identities",
        });
      }
      const kindDiagnostic = validateToken(draft.kind, "entity kind");
      if (kindDiagnostic !== undefined) return failure(kindDiagnostic);
      const identity = parseEntityId(draft.id);
      if (!identity.ok) return identity;
      if (loadedEntities.has(identity.value)) {
        return failure({
          code: "ambiguous-entity-identity",
          message: "Entity identity occurs more than once and cannot be resolved safely",
          details: { id: identity.value },
        });
      }
      const payload = copyGraphPayload(draft.payload, "entity");
      if (!payload.ok) return payload;
      const entity = freezeEntity({ id: identity.value, kind: draft.kind, payload: payload.value });
      loadedEntities.set(entity.id, entity);
    }

    for (const draft of relations) {
      if (draft.id === undefined) {
        return failure({
          code: "missing-persisted-identity",
          message: "Loaded relations must already have stable identities",
        });
      }
      const typeDiagnostic = validateToken(draft.type, "relation type");
      if (typeDiagnostic !== undefined) return failure(typeDiagnostic);
      const source = resolveEntityFrom(loadedEntities, draft.source);
      if (!source.ok) return source;
      const target = resolveEntityFrom(loadedEntities, draft.target);
      if (!target.ok) return target;
      const identity = parseRelationId(draft.id);
      if (!identity.ok) return identity;
      if (loadedRelations.has(identity.value)) {
        return failure({
          code: "ambiguous-relation-identity",
          message: "Relation identity occurs more than once and cannot be resolved safely",
          details: { id: identity.value },
        });
      }
      const payload = copyGraphPayload(draft.payload, "relation");
      if (!payload.ok) return payload;
      const relation = freezeRelation({
        id: identity.value,
        payload: payload.value,
        source: source.value.id,
        target: target.value.id,
        type: draft.type,
      });
      loadedRelations.set(relation.id, relation);
    }

    return success(makeSnapshot({ entities: loadedEntities, relations: loadedRelations }));
  }

  addEntity(
    snapshot: GraphSnapshot,
    draft: EntityDraft,
  ): Result<{ readonly snapshot: GraphSnapshot; readonly entity: GraphEntity }> {
    const state = stateFor(snapshot);
    const kindDiagnostic = validateToken(draft.kind, "entity kind");
    if (kindDiagnostic !== undefined) return failure(kindDiagnostic);

    const identity =
      draft.id === undefined ? this.#mintEntityId(state.entities) : parseEntityId(draft.id);
    if (!identity.ok) return identity;

    if (state.entities.has(identity.value)) {
      return failure({
        code: "ambiguous-entity-identity",
        message: "Entity identity occurs more than once and cannot be resolved safely",
        details: { id: identity.value },
      });
    }

    const payload = copyGraphPayload(draft.payload, "entity");
    if (!payload.ok) return payload;
    const entity = freezeEntity({ id: identity.value, kind: draft.kind, payload: payload.value });
    const entities = new Map(state.entities);
    entities.set(entity.id, entity);
    return success({ entity, snapshot: makeSnapshot({ entities, relations: state.relations }) });
  }

  updateEntity(
    snapshot: GraphSnapshot,
    reference: EntityReference,
    payload: unknown,
  ): Result<{ readonly snapshot: GraphSnapshot; readonly entity: GraphEntity }> {
    const resolved = this.resolveEntity(snapshot, reference);
    if (!resolved.ok) return resolved;

    const state = stateFor(snapshot);
    const copiedPayload = copyGraphPayload(payload, "entity");
    if (!copiedPayload.ok) return copiedPayload;
    const entity = freezeEntity({ ...resolved.value, payload: copiedPayload.value });
    const entities = new Map(state.entities);
    entities.set(entity.id, entity);
    return success({ entity, snapshot: makeSnapshot({ entities, relations: state.relations }) });
  }

  addRelation(
    snapshot: GraphSnapshot,
    draft: RelationDraft,
  ): Result<{ readonly snapshot: GraphSnapshot; readonly relation: GraphRelation }> {
    const state = stateFor(snapshot);
    const typeDiagnostic = validateToken(draft.type, "relation type");
    if (typeDiagnostic !== undefined) return failure(typeDiagnostic);

    const source = resolveEntityFrom(state.entities, draft.source);
    if (!source.ok) return source;
    const target = resolveEntityFrom(state.entities, draft.target);
    if (!target.ok) return target;

    const identity =
      draft.id === undefined ? this.#mintRelationId(state.relations) : parseRelationId(draft.id);
    if (!identity.ok) return identity;
    if (state.relations.has(identity.value)) {
      return failure({
        code: "ambiguous-relation-identity",
        message: "Relation identity occurs more than once and cannot be resolved safely",
        details: { id: identity.value },
      });
    }

    const payload = copyGraphPayload(draft.payload, "relation");
    if (!payload.ok) return payload;
    const relation = freezeRelation({
      id: identity.value,
      payload: payload.value,
      source: source.value.id,
      target: target.value.id,
      type: draft.type,
    });
    const relations = new Map(state.relations);
    relations.set(relation.id, relation);
    return success({ relation, snapshot: makeSnapshot({ entities: state.entities, relations }) });
  }

  resolveEntity(snapshot: GraphSnapshot, reference: EntityReference): Result<GraphEntity> {
    return resolveEntityFrom(stateFor(snapshot).entities, reference);
  }

  resolveRelation(snapshot: GraphSnapshot, id: string): Result<GraphRelation> {
    const identity = parseRelationId(id);
    if (!identity.ok) return identity;
    const relation = stateFor(snapshot).relations.get(identity.value);
    return relation === undefined
      ? failure({
          code: "unknown-relation",
          message: "No relation exists for the exact stable identity",
          details: { id },
        })
      : success(relation);
  }

  pageEntities(
    snapshot: GraphSnapshot,
    request: EntityPageRequest,
  ): Result<GraphPage<GraphEntity, EntityId>> {
    const limit = validateLimit(request.limit, this.#maxPageSize);
    if (!limit.ok) return limit;
    if (request.kind !== undefined) {
      const diagnostic = validateToken(request.kind, "entity kind");
      if (diagnostic !== undefined) return failure(diagnostic);
    }

    const items = [...stateFor(snapshot).entities.values()]
      .filter((entity) => request.kind === undefined || entity.kind === request.kind)
      .sort((left, right) => compareIdentity(left.id, right.id));
    return this.#page(items, request.after, limit.value, (item) => item.id, parseEntityId);
  }

  pageRelations(
    snapshot: GraphSnapshot,
    request: PageRequest<RelationId>,
  ): Result<GraphPage<GraphRelation, RelationId>> {
    const limit = validateLimit(request.limit, this.#maxPageSize);
    if (!limit.ok) return limit;
    const items = [...stateFor(snapshot).relations.values()].sort((left, right) =>
      compareIdentity(left.id, right.id),
    );
    return this.#page(items, request.after, limit.value, (item) => item.id, parseRelationId);
  }

  traverseRelations(
    snapshot: GraphSnapshot,
    request: RelationTraversalRequest,
  ): Result<GraphPage<GraphRelation, RelationId>> {
    if (!(["incoming", "outgoing", "both"] as const).includes(request.direction)) {
      return failure({
        code: "invalid-traversal-direction",
        message: "Traversal direction must be incoming, outgoing, or both",
        details: { direction: request.direction },
      });
    }
    const entity = this.resolveEntity(snapshot, request.entity);
    if (!entity.ok) return entity;
    const limit = validateLimit(request.limit, this.#maxPageSize);
    if (!limit.ok) return limit;

    const items = [...stateFor(snapshot).relations.values()]
      .filter((relation) => {
        return (
          (request.direction !== "incoming" && relation.source === entity.value.id) ||
          (request.direction !== "outgoing" && relation.target === entity.value.id)
        );
      })
      .sort((left, right) => compareIdentity(left.id, right.id));
    return this.#page(items, request.after, limit.value, (item) => item.id, parseRelationId);
  }

  #mintEntityId(existing: ReadonlyMap<EntityId, GraphEntity>): Result<EntityId> {
    for (let attempt = 0; attempt < this.#identityAttempts; attempt += 1) {
      let candidate: string;
      try {
        candidate = this.#idSource.nextEntityId();
      } catch (error) {
        return failure({
          code: "identity-source-failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      const parsed = parseEntityId(candidate);
      if (!parsed.ok) return parsed;
      if (!existing.has(parsed.value)) return parsed;
    }
    return failure({
      code: "entity-id-collision",
      message: `Could not mint a unique entity identity after ${this.#identityAttempts} attempts`,
    });
  }

  #mintRelationId(existing: ReadonlyMap<RelationId, GraphRelation>): Result<RelationId> {
    for (let attempt = 0; attempt < this.#identityAttempts; attempt += 1) {
      let candidate: string;
      try {
        candidate = this.#idSource.nextRelationId();
      } catch (error) {
        return failure({
          code: "identity-source-failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      const parsed = parseRelationId(candidate);
      if (!parsed.ok) return parsed;
      if (!existing.has(parsed.value)) return parsed;
    }
    return failure({
      code: "relation-id-collision",
      message: `Could not mint a unique relation identity after ${this.#identityAttempts} attempts`,
    });
  }

  #page<TItem, TAfter extends string>(
    items: readonly TItem[],
    after: string | undefined,
    limit: number,
    identityOf: (item: TItem) => TAfter,
    parseAfter: (value: string) => Result<TAfter>,
  ): Result<GraphPage<TItem, TAfter>> {
    let start = 0;
    if (after !== undefined) {
      const parsed = parseAfter(after);
      if (!parsed.ok) return parsed;
      const index = items.findIndex((item) => identityOf(item) === parsed.value);
      if (index < 0) {
        return failure({
          code: "unknown-page-anchor",
          message: "Page anchor does not identify an item in this bounded result set",
          details: { after },
        });
      }
      start = index + 1;
    }

    const pageItems = Object.freeze(items.slice(start, start + limit));
    const hasMore = start + pageItems.length < items.length;
    const last = pageItems.at(-1);
    return success({
      hasMore,
      items: pageItems,
      ...(hasMore && last !== undefined ? { nextAfter: identityOf(last) } : {}),
    });
  }
}
