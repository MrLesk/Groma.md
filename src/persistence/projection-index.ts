import { createHash } from "node:crypto";
import {
  createEntityAliasResolver,
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseRelationId,
  success,
  type Diagnostic,
  type EntityAlias,
  type EntityId,
  type GraphCommittedEvent,
  type GraphData,
  type GraphEntity,
  type GraphRelation,
  type ProjectedEntity,
  type ProjectionAdjacency,
  type ProjectionCanonicalSnapshot,
  type ProjectionCanonicalSource,
  type ProjectionCatalogEntry,
  type ProjectionIndexCapability,
  type ProjectionReadCapability,
  type ProjectionReadIdentity,
  type ProjectionRelationRead,
  type ProjectionSnapshot,
  type RelationId,
  type Result,
  type TransactionProvider,
} from "../core/index.ts";
import { copyCanonicalGraphData, copyGraphPayload } from "../core/payload.ts";
import type { StandardModelCapability } from "../standard-model/index.ts";

export interface ProjectionIndexBounds {
  readonly maxAliases: number;
  readonly maxBytes: number;
  readonly maxEntities: number;
  readonly maxPageSize: number;
  readonly maxRelations: number;
  readonly maxSearchableTextCharacters: number;
}
export interface LocalProjectionIndexOptions {
  readonly bounds?: Partial<ProjectionIndexBounds>;
  readonly canonical: ProjectionCanonicalSource;
}
export interface TransactionProjectionCanonicalSourceOptions {
  readonly bounds?: Pick<
    Partial<ProjectionIndexBounds>,
    "maxAliases" | "maxEntities" | "maxRelations"
  >;
  readonly model: StandardModelCapability;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

const defaults: ProjectionIndexBounds = Object.freeze({
  maxAliases: 100_000,
  maxBytes: 16 * 1024 * 1024,
  maxEntities: 100_000,
  maxPageSize: 100,
  maxRelations: 1_000_000,
  maxSearchableTextCharacters: 64 * 1024,
});
const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const diagnostic = (code: string, message: string): Diagnostic => Object.freeze({ code, message });
const unavailable = (reason: string): Result<never> =>
  failure(diagnostic("projection-unavailable", `Disposable projection is unavailable: ${reason}`));

function resolveBounds(input?: Partial<ProjectionIndexBounds>): ProjectionIndexBounds {
  const selected = { ...defaults, ...input };
  for (const [name, value] of Object.entries(selected)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new RangeError(`${name} must be a positive safe integer`);
  }
  return Object.freeze(selected);
}

function copyEntity(value: unknown, model?: StandardModelCapability): Result<GraphEntity> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return unavailable("entity-malformed");
  const input = value as Record<string, unknown>;
  const id =
    typeof input.id === "string" ? parseEntityId(input.id) : unavailable("entity-id-malformed");
  const payload = copyGraphPayload(input.payload, "entity");
  if (!id.ok || typeof input.kind !== "string" || !payload.ok)
    return unavailable("entity-malformed");
  const copied = Object.freeze({ id: id.value, kind: input.kind, payload: payload.value });
  return model === undefined || model.parse(copied).ok
    ? success(copied)
    : unavailable("entity-malformed");
}

function copyRelation(value: unknown): Result<GraphRelation> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return unavailable("relation-malformed");
  const input = value as Record<string, unknown>;
  const id =
    typeof input.id === "string" ? parseRelationId(input.id) : unavailable("relation-id-malformed");
  const source =
    typeof input.source === "string"
      ? parseEntityId(input.source)
      : unavailable("relation-source-malformed");
  const target =
    typeof input.target === "string"
      ? parseEntityId(input.target)
      : unavailable("relation-target-malformed");
  const payload = copyGraphPayload(input.payload, "relation");
  if (!id.ok || !source.ok || !target.ok || typeof input.type !== "string" || !payload.ok)
    return unavailable("relation-malformed");
  return success(
    Object.freeze({
      id: id.value,
      payload: payload.value,
      source: source.value,
      target: target.value,
      type: input.type,
    }),
  );
}

function normalizeCanonical(
  value: unknown,
  selected: ProjectionIndexBounds,
  model?: StandardModelCapability,
): Result<ProjectionCanonicalSnapshot> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return unavailable("snapshot-malformed");
  const input = value as Record<string, unknown>;
  const generation = parseGraphGeneration(input.generation);
  if (
    !generation.ok ||
    !Array.isArray(input.entities) ||
    !Array.isArray(input.relations) ||
    !Array.isArray(input.aliases ?? [])
  )
    return unavailable("snapshot-malformed");
  if (
    input.entities.length > selected.maxEntities ||
    input.relations.length > selected.maxRelations ||
    (input.aliases as unknown[]).length > selected.maxAliases
  )
    return unavailable("snapshot-bound-exceeded");
  const entities: GraphEntity[] = [];
  for (const item of input.entities) {
    const copied = copyEntity(item, model);
    if (!copied.ok) return copied;
    entities.push(copied.value);
  }
  entities.sort((a, b) => compare(a.id, b.id));
  const live = new Set(entities.map((item) => item.id));
  if (live.size !== entities.length) return unavailable("entity-identity-duplicated");
  const resolver = createEntityAliasResolver(
    input.aliases as readonly EntityAlias[],
    live,
    selected.maxAliases,
  );
  if (!resolver.ok) return unavailable("aliases-malformed");
  const resolvedEntities: GraphEntity[] = [];
  for (const entity of entities) {
    if (model === undefined) {
      resolvedEntities.push(entity);
      continue;
    }
    const component = model.parse(entity);
    if (!component.ok) return unavailable("entity-malformed");
    if (component.value.parent === undefined) {
      resolvedEntities.push(entity);
      continue;
    }
    const parent = resolver.value.resolve(component.value.parent);
    if (!parent.ok) return unavailable("entity-parent-missing");
    if (parent.value.resolved === component.value.parent) {
      resolvedEntities.push(entity);
      continue;
    }
    if (
      typeof entity.payload !== "object" ||
      entity.payload === null ||
      Array.isArray(entity.payload)
    )
      return unavailable("entity-malformed");
    const payload = copyGraphPayload(
      { ...entity.payload, parent: parent.value.resolved },
      "entity",
    );
    if (!payload.ok) return unavailable("entity-malformed");
    const resolved = Object.freeze({ ...entity, payload: payload.value });
    if (!model.parse(resolved).ok) return unavailable("entity-malformed");
    resolvedEntities.push(resolved);
  }
  const relations: GraphRelation[] = [];
  for (const item of input.relations) {
    const copied = copyRelation(item);
    if (!copied.ok) return unavailable("relation-malformed");
    const source = resolver.value.resolve(copied.value.source);
    const target = resolver.value.resolve(copied.value.target);
    if (!source.ok || !target.ok) return unavailable("relation-endpoint-missing");
    const resolved = Object.freeze({
      ...copied.value,
      source: source.value.resolved,
      target: target.value.resolved,
    });
    if (model !== undefined && !model.relationships([resolved]).ok)
      return unavailable("relation-malformed");
    relations.push(resolved);
  }
  relations.sort((a, b) => compare(a.id, b.id));
  if (new Set(relations.map((item) => item.id)).size !== relations.length)
    return unavailable("relation-identity-duplicated");
  return success(
    Object.freeze({
      aliases: resolver.value.records,
      entities: Object.freeze(resolvedEntities),
      generation: generation.value,
      relations: Object.freeze(relations),
    }),
  );
}

export function createTransactionProjectionCanonicalSource(
  options: TransactionProjectionCanonicalSourceOptions,
): ProjectionCanonicalSource {
  const selected = resolveBounds(options.bounds);
  return Object.freeze({
    snapshot: async () => {
      try {
        const raw = await options.transactionProvider.snapshot(Object.freeze([]));
        const generation = parseGraphGeneration(raw.generation);
        const state = copyGraphPayload(raw.state, "transaction");
        if (
          !generation.ok ||
          !state.ok ||
          typeof state.value !== "object" ||
          state.value === null ||
          Array.isArray(state.value)
        )
          return unavailable("canonical-snapshot-malformed");
        const record = state.value as Record<string, GraphData>;
        return normalizeCanonical(
          {
            aliases: record.aliases ?? [],
            entities: record.components,
            generation: generation.value,
            relations: record.relationships,
          },
          selected,
          options.model,
        );
      } catch {
        return unavailable("canonical-snapshot-failed");
      }
    },
  });
}

function collectText(value: GraphData, parts: string[]): void {
  if (typeof value === "string") parts.push(value.normalize("NFKC").toLowerCase());
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, parts));
  else if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, GraphData>>;
    for (const key of Object.keys(record).sort(compare)) collectText(record[key]!, parts);
  }
}

function materialize(
  canonical: ProjectionCanonicalSnapshot,
  selected: ProjectionIndexBounds,
): Result<ProjectionSnapshot> {
  const copied = copyCanonicalGraphData(
    { aliases: canonical.aliases, entities: canonical.entities, relations: canonical.relations },
    "query",
    {
      code: "projection-bound-exceeded",
      maximum: selected.maxBytes,
      message: "Projection exceeds its byte bound",
    },
  );
  if (!copied.ok) return unavailable("projection-bound-exceeded");
  const fingerprint = parseProjectionCanonicalFingerprint(
    `sha256:${createHash("sha256").update(copied.value.canonicalJson).digest("hex")}`,
  );
  if (!fingerprint.ok) return unavailable("fingerprint-invalid");
  const entities: ProjectedEntity[] = [];
  for (const item of canonical.entities) {
    const parts = [item.id.toLowerCase(), item.kind.toLowerCase()];
    collectText(item.payload, parts);
    const searchableText = parts.join("\n");
    if (searchableText.length > selected.maxSearchableTextCharacters)
      return unavailable("searchable-text-bound-exceeded");
    entities.push(Object.freeze({ entity: item, searchableText }));
  }
  const byEntity = new Map<EntityId, { incoming: RelationId[]; outgoing: RelationId[] }>();
  entities.forEach((item) => byEntity.set(item.entity.id, { incoming: [], outgoing: [] }));
  canonical.relations.forEach((item) => {
    byEntity.get(item.source)!.outgoing.push(item.id);
    byEntity.get(item.target)!.incoming.push(item.id);
  });
  const adjacency: ProjectionAdjacency[] = [...byEntity.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([entity, item]) =>
      Object.freeze({
        entity,
        incoming: Object.freeze(item.incoming.sort(compare)),
        outgoing: Object.freeze(item.outgoing.sort(compare)),
      }),
    );
  return success(
    Object.freeze({
      adjacency: Object.freeze(adjacency),
      aliases: canonical.aliases,
      entities: Object.freeze(entities),
      fingerprint: fingerprint.value,
      generation: canonical.generation,
      relations: canonical.relations,
    }),
  );
}

const sameIdentity = (left: ProjectionReadIdentity, right: ProjectionReadIdentity) =>
  left.generation === right.generation && left.fingerprint === right.fingerprint;

export function createLocalProjectionIndex(
  options: LocalProjectionIndexOptions,
): ProjectionIndexCapability & ProjectionReadCapability {
  const selected = resolveBounds(options.bounds);
  let current: ProjectionSnapshot | undefined;
  const rebuild = async (): Promise<Result<ProjectionSnapshot>> => {
    current = undefined;
    const source = await options.canonical.snapshot();
    if (!source.ok) return source;
    const canonical = normalizeCanonical(source.value, selected);
    if (!canonical.ok) return canonical;
    const built = materialize(canonical.value, selected);
    if (built.ok) current = built.value;
    return built;
  };
  const load = async () => (current === undefined ? rebuild() : success(current));
  const snapshotFor = async (identity: ProjectionReadIdentity) => {
    const snapshot = await load();
    return snapshot.ok && sameIdentity(snapshot.value, identity)
      ? snapshot
      : unavailable("stale-identity");
  };
  const identity = async (): Promise<Result<ProjectionReadIdentity>> => {
    const snapshot = await load();
    return snapshot.ok
      ? success(
          Object.freeze({
            fingerprint: snapshot.value.fingerprint,
            generation: snapshot.value.generation,
          }),
        )
      : snapshot;
  };
  const exactEntity: ProjectionReadCapability["exactEntity"] = async (expected, id) => {
    const snapshot = await snapshotFor(expected);
    if (!snapshot.ok) return snapshot;
    const live = new Map(snapshot.value.entities.map((item) => [item.entity.id, item.entity]));
    const resolver = createEntityAliasResolver(
      snapshot.value.aliases,
      new Set(live.keys()),
      selected.maxAliases,
    );
    const resolved = resolver.ok ? resolver.value.resolve(id) : resolver;
    const value = resolved.ok ? live.get(resolved.value.resolved) : undefined;
    return value === undefined
      ? failure(diagnostic("unknown-entity", "No entity or alias exists for that identity"))
      : success(Object.freeze({ identity: expected, value }));
  };
  const exactCatalogEntry: ProjectionReadCapability["exactCatalogEntry"] = async (expected, id) => {
    const snapshot = await snapshotFor(expected);
    if (!snapshot.ok) return snapshot;
    const found = snapshot.value.entities.find((item) => item.entity.id === id);
    return found === undefined
      ? failure(diagnostic("unknown-entity", "No live entity exists for that identity"))
      : success(
          Object.freeze({
            identity: expected,
            value: Object.freeze({
              id,
              kind: found.entity.kind,
              searchableText: found.searchableText,
            }),
          }),
        );
  };
  const exactEntities: ProjectionReadCapability["exactEntities"] = async (expected, ids) => {
    const snapshot = await snapshotFor(expected);
    if (!snapshot.ok) return snapshot;
    const live = new Map(snapshot.value.entities.map((item) => [item.entity.id, item.entity]));
    const items: GraphEntity[] = [];
    for (const id of ids) {
      const item = live.get(id);
      if (item === undefined)
        return failure(diagnostic("unknown-entity", "No live entity exists for that identity"));
      items.push(item);
    }
    return success(Object.freeze({ identity: expected, items: Object.freeze(items) }));
  };
  const pageCatalog: ProjectionReadCapability["pageCatalog"] = async (expected, request) => {
    const snapshot = await snapshotFor(expected);
    if (!snapshot.ok) return snapshot;
    if (
      !Number.isSafeInteger(request.limit) ||
      request.limit <= 0 ||
      request.limit > selected.maxPageSize
    )
      return unavailable("invalid-page-limit");
    const catalog: ProjectionCatalogEntry[] = snapshot.value.entities.map((item) =>
      Object.freeze({
        id: item.entity.id,
        kind: item.entity.kind,
        searchableText: item.searchableText,
      }),
    );
    let start = 0;
    if (request.after !== undefined) {
      const index = catalog.findIndex((item) => item.id === request.after);
      if (index < 0)
        return failure(
          diagnostic("projection-read-anchor-mismatch", "Projection page anchor is absent"),
        );
      start = index + 1;
    }
    const items = Object.freeze(catalog.slice(start, start + request.limit));
    const hasMore = start + items.length < catalog.length;
    return success(
      Object.freeze({
        hasMore,
        identity: expected,
        items,
        ...(hasMore ? { nextAfter: items.at(-1)!.id } : {}),
      }),
    );
  };
  const pageRelations: ProjectionReadCapability["pageRelations"] = async (expected, request) => {
    const snapshot = await snapshotFor(expected);
    if (!snapshot.ok) return snapshot;
    if (
      !Number.isSafeInteger(request.limit) ||
      request.limit <= 0 ||
      request.limit > selected.maxPageSize
    )
      return unavailable("invalid-page-limit");
    const live = new Map(snapshot.value.entities.map((item) => [item.entity.id, item.entity]));
    if (!live.has(request.entity))
      return failure(diagnostic("unknown-entity", "No live entity exists for that identity"));
    const matches = snapshot.value.relations.filter((item) =>
      request.direction === "incoming"
        ? item.target === request.entity
        : item.source === request.entity,
    );
    let start = 0;
    if (request.after !== undefined) {
      const index = matches.findIndex((item) => item.id === request.after);
      if (index < 0)
        return failure(
          diagnostic("projection-read-anchor-mismatch", "Projection relation anchor is absent"),
        );
      start = index + 1;
    }
    const chosen = matches.slice(start, start + request.limit);
    const items: ProjectionRelationRead[] = chosen.map((item) =>
      Object.freeze({
        direction: request.direction,
        entity: live.get(request.direction === "incoming" ? item.source : item.target)!,
        from: request.entity,
        relation: item,
      }),
    );
    const hasMore = start + items.length < matches.length;
    return success(
      Object.freeze({
        hasMore,
        identity: expected,
        items: Object.freeze(items),
        ...(hasMore ? { nextAfter: items.at(-1)!.relation.id } : {}),
      }),
    );
  };
  const update = async (_event: GraphCommittedEvent) => rebuild();
  return Object.freeze({
    exactCatalogEntry,
    exactEntities,
    exactEntity,
    identity,
    load,
    pageCatalog,
    pageRelations,
    rebuild,
    update,
  });
}
