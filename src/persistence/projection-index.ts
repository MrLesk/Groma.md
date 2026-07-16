import { createHash } from "node:crypto";

import {
  createEntityAliasResolver,
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseGraphCommittedEvent,
  parseProjectionCanonicalFingerprint,
  parseRelationId,
  sequenceGraphCommittedEvent,
  success,
  type Diagnostic,
  type EntityAlias,
  type EntityId,
  type GraphCommittedEvent,
  type GraphData,
  type GraphEntity,
  type GraphGeneration,
  type GraphRelation,
  type ProjectionAdjacency,
  type ProjectionCanonicalSnapshot,
  type ProjectionCanonicalFingerprint,
  type ProjectionCanonicalSource,
  type ProjectionContinuityCapability,
  type ProjectedEntity,
  type ProjectionIndexCapability,
  type ProjectionReadCapability,
  type ProjectionSnapshot,
  type RelationId,
  type Result,
  type TransactionProvider,
} from "../core/index.ts";
import { copyCanonicalGraphData, copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import type { StandardModelCapability } from "../standard-model/index.ts";
import {
  createLocalProjectionReadIndex,
  type LocalProjectionReadIndex,
} from "./projection-read-index.ts";
import {
  workspaceResourceLocator,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "./contracts.ts";

const projectionSchema = "groma.projection-index/v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const intrinsicArrayJoin = Array.prototype.join;
const intrinsicArrayMap = Array.prototype.map;
const intrinsicArraySort = Array.prototype.sort;
const intrinsicCharCodeAt = String.prototype.charCodeAt;
const intrinsicDecode = TextDecoder.prototype.decode;
const intrinsicEncodeInto = TextEncoder.prototype.encodeInto;
const intrinsicJsonParse = JSON.parse;
const intrinsicNormalize = String.prototype.normalize;
const intrinsicObjectKeys = Object.keys;
const intrinsicToLowerCase = String.prototype.toLowerCase;

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
  readonly checkpoint?: ProjectionContinuityCapability;
  readonly resources: LocalResourceProvider;
}

export interface TransactionProjectionCanonicalSourceOptions {
  readonly bounds?: Pick<
    Partial<ProjectionIndexBounds>,
    "maxAliases" | "maxEntities" | "maxRelations"
  >;
  readonly model: StandardModelCapability;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

const defaultBounds: ProjectionIndexBounds = Object.freeze({
  maxAliases: 100_000,
  maxBytes: 16 * 1024 * 1024,
  maxEntities: 100_000,
  maxPageSize: 100,
  maxRelations: 1_000_000,
  maxSearchableTextCharacters: 64 * 1024,
});

const absoluteBounds: ProjectionIndexBounds = Object.freeze({
  maxAliases: 1_000_000,
  maxBytes: 1024 * 1024 * 1024,
  maxEntities: 1_000_000,
  maxPageSize: 10_000,
  maxRelations: 10_000_000,
  maxSearchableTextCharacters: 1024 * 1024,
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortInPlace<T>(values: T[], compare: (left: T, right: T) => number): T[] {
  return Reflect.apply(intrinsicArraySort, values, [compare]) as T[];
}

function mapArray<TInput, TOutput>(
  values: readonly TInput[],
  callback: (value: TInput) => TOutput,
): TOutput[] {
  return Reflect.apply(intrinsicArrayMap, values, [callback]) as TOutput[];
}

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze({ code, ...(details === undefined ? {} : { details }), message });
}

function unavailable(reason: string): Result<never> {
  return failure(
    diagnostic(
      "projection-index-unavailable",
      "The disposable projection index is unavailable; retry or delete it to rebuild",
      { reason },
    ),
  );
}

function parseBounds(input: Partial<ProjectionIndexBounds> | undefined): ProjectionIndexBounds {
  const selected = { ...defaultBounds, ...input };
  for (const field of [
    "maxAliases",
    "maxBytes",
    "maxEntities",
    "maxPageSize",
    "maxRelations",
    "maxSearchableTextCharacters",
  ] as const) {
    if (
      !Number.isSafeInteger(selected[field]) ||
      selected[field] <= 0 ||
      selected[field] > absoluteBounds[field]
    ) {
      throw new RangeError(
        `${field} must be a positive safe integer no greater than ${absoluteBounds[field]}`,
      );
    }
  }
  return Object.freeze(selected);
}

function preflightCommittedEventBounds(
  event: unknown,
  bounds: ProjectionIndexBounds,
): "accepted" | "bound-exceeded" | "malformed" {
  const envelope = inspectExactRecord(
    event,
    [["affected", "generation", "type"]],
    "invalid-graph-event",
    "Committed graph event",
  );
  if (!envelope.ok) return "malformed";
  const affected = inspectExactRecord(
    envelope.value.affected,
    [["entities", "relations"]],
    "invalid-graph-event",
    "Committed event affected identities",
  );
  if (!affected.ok) return "malformed";
  const entities = inspectIntrinsicArrayLength(
    affected.value.entities,
    "invalid-graph-event",
    "Committed event affected entities",
  );
  const relations = inspectIntrinsicArrayLength(
    affected.value.relations,
    "invalid-graph-event",
    "Committed event affected relations",
  );
  if (!entities.ok || !relations.ok) return "malformed";
  return entities.value <= bounds.maxEntities && relations.value <= bounds.maxRelations
    ? "accepted"
    : "bound-exceeded";
}

export function localProjectionIndexLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator(".groma-cache", "projection-index.json");
}

function localProjectionIgnoreLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator(".groma-cache", ".gitignore");
}

const projectionIgnoreBytes = new Uint8Array([0x2a, 0x0a]);

function exactRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const keys = sortInPlace(
    Reflect.apply(intrinsicObjectKeys, Object, [value]) as string[],
    compareText,
  );
  if (keys.length !== expected.length) return false;
  const sorted = sortInPlace([...expected], compareText);
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index] !== sorted[index]) return false;
  }
  return true;
}

function boundedArray(value: unknown, maximum: number): value is readonly unknown[] {
  return Array.isArray(value) && value.length <= maximum;
}

function normalizeEntity(value: unknown): Result<GraphEntity> {
  if (!exactRecord(value) || !exactKeys(value, ["id", "kind", "payload"])) {
    return unavailable("canonical-entity-malformed");
  }
  if (typeof value.id !== "string" || typeof value.kind !== "string") {
    return unavailable("canonical-entity-malformed");
  }
  const id = parseEntityId(value.id);
  if (!id.ok) return unavailable("canonical-entity-malformed");
  const payload = copyGraphPayload(value.payload, "entity");
  return payload.ok
    ? success(Object.freeze({ id: id.value, kind: value.kind, payload: payload.value }))
    : unavailable("canonical-entity-malformed");
}

function normalizeRelation(value: unknown): Result<GraphRelation> {
  if (!exactRecord(value) || !exactKeys(value, ["id", "payload", "source", "target", "type"])) {
    return unavailable("canonical-relation-malformed");
  }
  if (
    typeof value.id !== "string" ||
    typeof value.source !== "string" ||
    typeof value.target !== "string" ||
    typeof value.type !== "string"
  ) {
    return unavailable("canonical-relation-malformed");
  }
  const id = parseRelationId(value.id);
  const source = parseEntityId(value.source);
  const target = parseEntityId(value.target);
  const payload = copyGraphPayload(value.payload, "relation");
  if (!id.ok || !source.ok || !target.ok || !payload.ok) {
    return unavailable("canonical-relation-malformed");
  }
  return success(
    Object.freeze({
      id: id.value,
      payload: payload.value,
      source: source.value,
      target: target.value,
      type: value.type,
    }),
  );
}

function normalizeAlias(value: unknown): Result<EntityAlias> {
  if (!exactRecord(value) || !exactKeys(value, ["source", "target"])) {
    return unavailable("canonical-alias-malformed");
  }
  if (typeof value.source !== "string" || typeof value.target !== "string") {
    return unavailable("canonical-alias-malformed");
  }
  const source = parseEntityId(value.source);
  const target = parseEntityId(value.target);
  return source.ok && target.ok
    ? success(Object.freeze({ source: source.value, target: target.value }))
    : unavailable("canonical-alias-malformed");
}

function normalizeCanonicalSnapshot(
  value: unknown,
  bounds: ProjectionIndexBounds,
  model?: StandardModelCapability,
): Result<ProjectionCanonicalSnapshot> {
  if (
    !exactRecord(value) ||
    !exactKeys(value, ["aliases", "entities", "generation", "relations"])
  ) {
    return unavailable("canonical-snapshot-malformed");
  }
  const generation = parseGraphGeneration(value.generation);
  if (!generation.ok) return unavailable("canonical-generation-malformed");
  if (
    !boundedArray(value.aliases, bounds.maxAliases) ||
    !boundedArray(value.entities, bounds.maxEntities) ||
    !boundedArray(value.relations, bounds.maxRelations)
  ) {
    return unavailable("canonical-snapshot-bound-exceeded");
  }

  const entities: GraphEntity[] = [];
  const entityIds = new Set<EntityId>();
  for (const candidate of value.entities) {
    const entity = normalizeEntity(candidate);
    if (!entity.ok || entityIds.has(entity.value.id)) {
      return unavailable("canonical-entity-malformed");
    }
    if (model !== undefined && !model.parse(entity.value).ok) {
      return unavailable("canonical-entity-malformed");
    }
    entityIds.add(entity.value.id);
    entities.push(entity.value);
  }
  sortInPlace(entities, (left, right) => compareText(left.id, right.id));

  const aliases: EntityAlias[] = [];
  for (const candidate of value.aliases) {
    const alias = normalizeAlias(candidate);
    if (!alias.ok) return alias;
    aliases.push(alias.value);
  }
  sortInPlace(aliases, (left, right) => compareText(left.source, right.source));
  const resolver = createEntityAliasResolver(aliases, entityIds, Math.max(1, bounds.maxAliases));
  if (!resolver.ok) return unavailable("canonical-alias-malformed");

  const relations: GraphRelation[] = [];
  const relationIds = new Set<RelationId>();
  for (const candidate of value.relations) {
    const relation = normalizeRelation(candidate);
    if (!relation.ok || relationIds.has(relation.value.id)) {
      return unavailable("canonical-relation-malformed");
    }
    const source = resolver.value.resolve(relation.value.source);
    const target = resolver.value.resolve(relation.value.target);
    if (!source.ok || !target.ok) return unavailable("canonical-relation-endpoint-missing");
    const resolved = Object.freeze({
      ...relation.value,
      source: source.value.resolved,
      target: target.value.resolved,
    });
    if (model !== undefined && !model.relationships([resolved]).ok) {
      return unavailable("canonical-relation-malformed");
    }
    relationIds.add(resolved.id);
    relations.push(resolved);
  }
  sortInPlace(relations, (left, right) => compareText(left.id, right.id));
  return success(
    Object.freeze({
      aliases: Object.freeze(aliases),
      entities: Object.freeze(entities),
      generation: generation.value,
      relations: Object.freeze(relations),
    }),
  );
}

function resolveStandardContainment(
  snapshot: ProjectionCanonicalSnapshot,
  bounds: ProjectionIndexBounds,
  model: StandardModelCapability,
): Result<ProjectionCanonicalSnapshot> {
  const live = new Set(mapArray(snapshot.entities, (entity) => entity.id));
  const resolver = createEntityAliasResolver(
    snapshot.aliases,
    live,
    Math.max(1, bounds.maxAliases),
  );
  if (!resolver.ok) return unavailable("canonical-alias-malformed");
  const entities: GraphEntity[] = [];
  for (const entity of snapshot.entities) {
    const component = model.parse(entity);
    if (!component.ok) return unavailable("canonical-entity-malformed");
    if (component.value.parent === undefined) {
      entities.push(entity);
      continue;
    }
    const parent = resolver.value.resolve(component.value.parent);
    if (!parent.ok) return unavailable("canonical-parent-missing");
    if (parent.value.resolved === component.value.parent) {
      entities.push(entity);
      continue;
    }
    if (!exactRecord(entity.payload)) return unavailable("canonical-entity-malformed");
    const payload = copyGraphPayload(
      { ...entity.payload, parent: parent.value.resolved },
      "entity",
    );
    if (!payload.ok) return unavailable("canonical-entity-malformed");
    const resolved = Object.freeze({ ...entity, payload: payload.value });
    if (!model.parse(resolved).ok) return unavailable("canonical-entity-malformed");
    entities.push(resolved);
  }
  return success(Object.freeze({ ...snapshot, entities: Object.freeze(entities) }));
}

function snapshotState(value: unknown): Result<Readonly<Record<string, unknown>>> {
  const copied = copyGraphPayload(value, "transaction");
  return copied.ok && exactRecord(copied.value)
    ? success(copied.value)
    : unavailable("canonical-snapshot-malformed");
}

export function createTransactionProjectionCanonicalSource(
  options: TransactionProjectionCanonicalSourceOptions,
): ProjectionCanonicalSource {
  const bounds = parseBounds(options.bounds);
  const model = options.model;
  const transactionProvider = options.transactionProvider;
  const snapshot = transactionProvider.snapshot;
  const source: ProjectionCanonicalSource = Object.freeze({
    snapshot: async () => {
      try {
        const raw: unknown = await Reflect.apply(snapshot, transactionProvider, [
          Object.freeze([]),
        ]);
        if (!exactRecord(raw)) return unavailable("canonical-snapshot-malformed");
        const generation = parseGraphGeneration(raw.generation);
        const state = snapshotState(raw.state);
        if (!generation.ok || !state.ok) return unavailable("canonical-snapshot-malformed");
        const aliases = Object.hasOwn(state.value, "aliases") ? state.value.aliases : [];
        const normalized = normalizeCanonicalSnapshot(
          {
            aliases,
            entities: state.value.components,
            generation: generation.value,
            relations: state.value.relationships,
          },
          bounds,
          model,
        );
        return normalized.ok
          ? resolveStandardContainment(normalized.value, bounds, model)
          : normalized;
      } catch {
        return unavailable("canonical-snapshot-failed");
      }
    },
  });
  return source;
}

interface SearchTextState {
  readonly maximum: number;
  readonly parts: string[];
  characters: number;
}

function appendSearchText(value: string, state: SearchTextState): boolean {
  if (value.length > state.maximum - state.characters) return false;
  const normalized = Reflect.apply(intrinsicNormalize, value, ["NFKC"]) as string;
  if (normalized.length > state.maximum - state.characters) return false;
  const lowered = Reflect.apply(intrinsicToLowerCase, normalized, []) as string;
  const separator = state.parts.length === 0 ? 0 : 1;
  if (lowered.length > state.maximum - state.characters - separator) return false;
  state.characters += separator + lowered.length;
  state.parts.push(lowered);
  return true;
}

function collectSearchableText(value: GraphData, state: SearchTextState): boolean {
  if (typeof value === "string") {
    return appendSearchText(value, state);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!collectSearchableText(item, state)) return false;
    }
    return true;
  }
  if (typeof value !== "object" || value === null) return true;
  const record = value as Readonly<Record<string, GraphData>>;
  const keys = sortInPlace(
    Reflect.apply(intrinsicObjectKeys, Object, [record]) as string[],
    compareText,
  );
  for (const key of keys) {
    if (!collectSearchableText(record[key]!, state)) return false;
  }
  return true;
}

function projectedEntity(
  entity: GraphEntity,
  maxSearchableTextCharacters: number,
): Result<ProjectedEntity> {
  const state: SearchTextState = {
    characters: 0,
    maximum: maxSearchableTextCharacters,
    parts: [],
  };
  if (
    !appendSearchText(entity.id, state) ||
    !appendSearchText(entity.kind, state) ||
    !collectSearchableText(entity.payload, state)
  ) {
    return unavailable("projection-searchable-text-bound-exceeded");
  }
  const searchableText = Reflect.apply(intrinsicArrayJoin, state.parts, ["\n"]) as string;
  return success(Object.freeze({ entity, searchableText }));
}

function adjacency(
  entities: readonly ProjectedEntity[],
  relations: readonly GraphRelation[],
): readonly ProjectionAdjacency[] {
  const byEntity = new Map<
    EntityId,
    { entity: EntityId; incoming: RelationId[]; outgoing: RelationId[] }
  >();
  for (const projected of entities) {
    byEntity.set(projected.entity.id, {
      entity: projected.entity.id,
      incoming: [],
      outgoing: [],
    });
  }
  for (const relation of relations) {
    byEntity.get(relation.source)?.outgoing.push(relation.id);
    byEntity.get(relation.target)?.incoming.push(relation.id);
  }
  const entries = sortInPlace(Array.from(byEntity.values()), (left, right) =>
    compareText(left.entity, right.entity),
  );
  return Object.freeze(
    mapArray(entries, (entry) =>
      Object.freeze({
        entity: entry.entity,
        incoming: Object.freeze(sortInPlace(entry.incoming, compareText)),
        outgoing: Object.freeze(sortInPlace(entry.outgoing, compareText)),
      }),
    ),
  );
}

function canonicalFingerprint(
  canonical: Pick<ProjectionCanonicalSnapshot, "aliases" | "entities" | "relations">,
  bounds: ProjectionIndexBounds,
): Result<ProjectionCanonicalFingerprint> {
  const copied = copyCanonicalGraphData(
    {
      aliases: canonical.aliases,
      entities: canonical.entities,
      relations: canonical.relations,
    },
    "query",
    {
      code: "projection-fingerprint-bound-exceeded",
      maximum: bounds.maxBytes,
      message: "Canonical projection content exceeds its configured fingerprint bound",
    },
  );
  if (!copied.ok) return unavailable("projection-fingerprint-bound-exceeded");
  const parsed = parseLocalProjectionCanonicalFingerprint(
    `sha256:${createHash("sha256").update(copied.value.canonicalJson, "utf8").digest("hex")}`,
  );
  return parsed.ok ? parsed : unavailable("projection-fingerprint-failed");
}

function parseLocalProjectionCanonicalFingerprint(
  value: unknown,
): Result<ProjectionCanonicalFingerprint> {
  const parsed = parseProjectionCanonicalFingerprint(value);
  const prefix = "sha256:";
  if (!parsed.ok || parsed.value.length !== prefix.length + 64) {
    return unavailable("projection-fingerprint-malformed");
  }
  for (let index = 0; index < prefix.length; index += 1) {
    if (parsed.value[index] !== prefix[index]) {
      return unavailable("projection-fingerprint-malformed");
    }
  }
  for (let index = prefix.length; index < parsed.value.length; index += 1) {
    const code = Reflect.apply(intrinsicCharCodeAt, parsed.value, [index]) as number;
    if (!((code >= 0x30 && code <= 0x39) || (code >= 0x61 && code <= 0x66))) {
      return unavailable("projection-fingerprint-malformed");
    }
  }
  return parsed;
}

function materialize(
  canonical: ProjectionCanonicalSnapshot,
  bounds: ProjectionIndexBounds,
  fingerprint?: ProjectionCanonicalFingerprint,
): Result<ProjectionSnapshot> {
  const canonicalIdentity =
    fingerprint === undefined ? canonicalFingerprint(canonical, bounds) : success(fingerprint);
  if (!canonicalIdentity.ok) return canonicalIdentity;
  const entities: ProjectedEntity[] = [];
  for (const entity of canonical.entities) {
    const projected = projectedEntity(entity, bounds.maxSearchableTextCharacters);
    if (!projected.ok) return projected;
    entities.push(projected.value);
  }
  sortInPlace(entities, (left, right) => compareText(left.entity.id, right.entity.id));
  return success(
    Object.freeze({
      adjacency: adjacency(entities, canonical.relations),
      aliases: canonical.aliases,
      entities: Object.freeze(entities),
      fingerprint: canonicalIdentity.value,
      generation: canonical.generation,
      relations: canonical.relations,
    }),
  );
}

function incremental(
  current: ProjectionSnapshot,
  canonical: ProjectionCanonicalSnapshot,
  event: GraphCommittedEvent,
  bounds: ProjectionIndexBounds,
): Result<ProjectionSnapshot> {
  const canonicalEntities = new Map(
    mapArray(canonical.entities, (entity) => [entity.id, entity] as const),
  );
  const entities = new Map(
    mapArray(current.entities, (entity) => [entity.entity.id, entity] as const),
  );
  for (const id of event.affected.entities) {
    const entity = canonicalEntities.get(id);
    if (entity === undefined) entities.delete(id);
    else {
      const projected = projectedEntity(entity, bounds.maxSearchableTextCharacters);
      if (!projected.ok) return projected;
      entities.set(id, projected.value);
    }
  }

  let aliasesChanged = current.aliases.length !== canonical.aliases.length;
  for (let index = 0; index < current.aliases.length && !aliasesChanged; index += 1) {
    const alias = current.aliases[index]!;
    aliasesChanged =
      alias.source !== canonical.aliases[index]?.source ||
      alias.target !== canonical.aliases[index]?.target;
  }
  if (aliasesChanged) {
    for (const id of entities.keys()) {
      const entity = canonicalEntities.get(id);
      if (entity === undefined) continue;
      const projected = projectedEntity(entity, bounds.maxSearchableTextCharacters);
      if (!projected.ok) return projected;
      entities.set(id, projected.value);
    }
  }

  const canonicalRelations = new Map(
    mapArray(canonical.relations, (relation) => [relation.id, relation] as const),
  );
  const relations = new Map(
    mapArray(current.relations, (relation) => [relation.id, relation] as const),
  );
  for (const id of event.affected.relations) {
    const relation = canonicalRelations.get(id);
    if (relation === undefined) relations.delete(id);
    else relations.set(id, relation);
  }
  // An alias can change the resolved endpoint of a byte-unchanged incoming relation.
  // Refresh every existing relation view when the canonical alias set changes.
  if (aliasesChanged) {
    for (const id of relations.keys()) {
      const relation = canonicalRelations.get(id);
      if (relation !== undefined) relations.set(id, relation);
    }
  }
  const orderedEntities = sortInPlace(Array.from(entities.values()), (left, right) =>
    compareText(left.entity.id, right.entity.id),
  );
  const orderedRelations = sortInPlace(Array.from(relations.values()), (left, right) =>
    compareText(left.id, right.id),
  );
  const fingerprint = canonicalFingerprint(
    {
      aliases: canonical.aliases,
      entities: mapArray(orderedEntities, (projected) => projected.entity),
      relations: orderedRelations,
    },
    bounds,
  );
  if (!fingerprint.ok) return fingerprint;
  return success(
    Object.freeze({
      adjacency: adjacency(orderedEntities, orderedRelations),
      aliases: canonical.aliases,
      entities: Object.freeze(orderedEntities),
      fingerprint: fingerprint.value,
      generation: canonical.generation,
      relations: Object.freeze(orderedRelations),
    }),
  );
}

function serializable(snapshot: ProjectionSnapshot) {
  return {
    adjacency: snapshot.adjacency,
    aliases: snapshot.aliases,
    entities: snapshot.entities,
    fingerprint: snapshot.fingerprint,
    generation: snapshot.generation,
    relations: snapshot.relations,
    schema: projectionSchema,
  };
}

function boundedUtf8Length(value: string, maximum: number): number | undefined {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = Reflect.apply(intrinsicCharCodeAt, value, [index]) as number;
    if (unit <= 0x7f) bytes += 1;
    else if (unit <= 0x7ff) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < value.length) {
      const next = Reflect.apply(intrinsicCharCodeAt, value, [index + 1]) as number;
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (bytes > maximum) return undefined;
  }
  return bytes;
}

function encode(snapshot: ProjectionSnapshot, bounds: ProjectionIndexBounds): Result<Uint8Array> {
  const copied = copyCanonicalGraphData(serializable(snapshot), "query", {
    code: "projection-byte-bound-exceeded",
    maximum: bounds.maxBytes,
    message: "The disposable projection index exceeds its configured byte bound",
  });
  if (!copied.ok) return unavailable("projection-byte-bound-exceeded");
  const source = `${copied.value.canonicalJson}\n`;
  const byteLength = boundedUtf8Length(source, bounds.maxBytes);
  if (byteLength === undefined) return unavailable("projection-byte-bound-exceeded");
  const bytes = new Uint8Array(byteLength);
  const encoded = Reflect.apply(intrinsicEncodeInto, encoder, [source, bytes]) as {
    readonly read: number;
    readonly written: number;
  };
  return encoded.read === source.length && encoded.written === byteLength
    ? success(bytes)
    : unavailable("projection-byte-bound-exceeded");
}

function decode(bytes: Uint8Array, bounds: ProjectionIndexBounds): Result<ProjectionSnapshot> {
  if (bytes.byteLength > bounds.maxBytes) return unavailable("projection-byte-bound-exceeded");
  let value: unknown;
  try {
    const source = Reflect.apply(intrinsicDecode, decoder, [bytes]) as string;
    value = Reflect.apply(intrinsicJsonParse, JSON, [source]);
  } catch {
    return unavailable("projection-corrupt");
  }
  if (
    !exactRecord(value) ||
    !exactKeys(value, [
      "adjacency",
      "aliases",
      "entities",
      "fingerprint",
      "generation",
      "relations",
      "schema",
    ]) ||
    value.schema !== projectionSchema ||
    !boundedArray(value.entities, bounds.maxEntities)
  ) {
    return unavailable("projection-corrupt");
  }
  const storedFingerprint = parseLocalProjectionCanonicalFingerprint(value.fingerprint);
  if (!storedFingerprint.ok) return unavailable("projection-corrupt");
  const canonicalEntities: unknown[] = [];
  for (const candidate of value.entities) {
    if (!exactRecord(candidate) || !exactKeys(candidate, ["entity", "searchableText"])) {
      return unavailable("projection-corrupt");
    }
    canonicalEntities.push(candidate.entity);
  }
  const canonical = normalizeCanonicalSnapshot(
    {
      aliases: value.aliases,
      entities: canonicalEntities,
      generation: value.generation,
      relations: value.relations,
    },
    bounds,
  );
  if (!canonical.ok) return unavailable("projection-corrupt");
  const rebuilt = materialize(canonical.value, bounds);
  if (!rebuilt.ok) return rebuilt;
  if (rebuilt.value.fingerprint !== storedFingerprint.value) {
    return unavailable("projection-corrupt");
  }
  const exact = encode(rebuilt.value, bounds);
  if (!exact.ok || exact.value.byteLength !== bytes.byteLength)
    return unavailable("projection-corrupt");
  for (let index = 0; index < bytes.byteLength; index += 1) {
    if (bytes[index] !== exact.value[index]) return unavailable("projection-corrupt");
  }
  return rebuilt;
}

type ReadProjection =
  | { readonly state: "missing-or-corrupt" }
  | { readonly snapshot: ProjectionSnapshot; readonly state: "loaded" }
  | { readonly result: Result<never>; readonly state: "unavailable" };

async function readProjection(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  bounds: ProjectionIndexBounds,
): Promise<ReadProjection> {
  const read = await resources.read({ locator, maxBytes: bounds.maxBytes });
  if (!read.ok) {
    return read.diagnostics.length === 1 &&
      (read.diagnostics[0]?.code === "resource-missing" ||
        read.diagnostics[0]?.code === "resource-too-large")
      ? { state: "missing-or-corrupt" }
      : { result: unavailable("projection-read-failed"), state: "unavailable" };
  }
  let parsed: Result<ProjectionSnapshot>;
  try {
    parsed = decode(read.value.bytes, bounds);
  } catch {
    return { state: "missing-or-corrupt" };
  }
  return parsed.ok ? { snapshot: parsed.value, state: "loaded" } : { state: "missing-or-corrupt" };
}

async function publish(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  snapshot: ProjectionSnapshot,
  bounds: ProjectionIndexBounds,
): Promise<Result<ProjectionSnapshot>> {
  const bytes = encode(snapshot, bounds);
  if (!bytes.ok) return bytes;
  const ignoreLocator = localProjectionIgnoreLocator();
  if (!ignoreLocator.ok) return unavailable("projection-ignore-invalid");
  const ignored = await ensureCacheIgnored(resources, ignoreLocator.value);
  if (!ignored.ok) return ignored;
  const committed = await publishBytes(resources, locator, bytes.value);
  return committed.ok ? success(snapshot) : committed;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function publishBytes(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  bytes: Uint8Array,
): Promise<Result<void>> {
  const staged = await resources.stageReplacement(locator, bytes);
  if (!staged.ok) return unavailable("projection-stage-failed");
  const committed = await resources.commitReplacement(staged.value);
  if (committed.state === "committed") return success(undefined);
  if (committed.state === "committed-indeterminate") {
    const read = await resources.read({ locator, maxBytes: bytes.byteLength });
    if (read.ok && sameBytes(read.value.bytes, bytes)) {
      return success(undefined);
    }
    return unavailable("projection-publication-indeterminate");
  }
  await resources.discardReplacement(staged.value);
  return unavailable("projection-publication-failed");
}

async function ensureCacheIgnored(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
): Promise<Result<void>> {
  const read = await resources.read({ locator, maxBytes: projectionIgnoreBytes.byteLength });
  if (read.ok && sameBytes(read.value.bytes, projectionIgnoreBytes)) return success(undefined);
  if (!read.ok) {
    let replaceable = false;
    for (const item of read.diagnostics) {
      if (item.code === "resource-missing" || item.code === "resource-too-large") {
        replaceable = true;
        break;
      }
    }
    if (!replaceable) return unavailable("projection-ignore-unavailable");
  }
  return publishBytes(resources, locator, projectionIgnoreBytes);
}

export function createLocalProjectionIndex(
  options: LocalProjectionIndexOptions,
): ProjectionIndexCapability & ProjectionReadCapability {
  const bounds = parseBounds(options.bounds);
  const canonical = options.canonical;
  const resources = options.resources;
  const locator = localProjectionIndexLocator();
  if (!locator.ok) throw new Error("The fixed local projection locator is invalid");
  const canonicalSnapshot = canonical.snapshot;
  let partialReads: LocalProjectionReadIndex;

  const loadCanonical = async (): Promise<Result<ProjectionCanonicalSnapshot>> => {
    let value: unknown;
    try {
      value = await Reflect.apply(canonicalSnapshot, canonical, []);
    } catch {
      return unavailable("canonical-snapshot-failed");
    }
    try {
      if (!exactRecord(value) || value.ok !== true || !("value" in value)) {
        return unavailable("canonical-snapshot-failed");
      }
      return normalizeCanonicalSnapshot(value.value, bounds);
    } catch {
      return unavailable("canonical-snapshot-failed");
    }
  };

  const coordinated = async (
    action: () => Promise<Result<ProjectionSnapshot>>,
  ): Promise<Result<ProjectionSnapshot>> => {
    const result = await resources.withCoordination(
      { context: "local-machine", locator: locator.value },
      action,
    );
    if (!result.ok) return unavailable("projection-coordination-failed");
    return result.value;
  };

  const publishComplete = async (
    snapshot: ProjectionSnapshot,
  ): Promise<Result<ProjectionSnapshot>> => {
    const complete = await publish(resources, locator.value, snapshot, bounds);
    if (!complete.ok) return complete;
    const partial = await partialReads.publish(complete.value);
    return partial.ok ? complete : partial;
  };

  const rebuild = () =>
    coordinated(async () => {
      const canonical = await loadCanonical();
      if (!canonical.ok) return canonical;
      const rebuilt = materialize(canonical.value, bounds);
      return rebuilt.ok ? publishComplete(rebuilt.value) : rebuilt;
    });

  const load = () =>
    coordinated(async () => {
      const canonical = await loadCanonical();
      if (!canonical.ok) return canonical;
      const fingerprint = canonicalFingerprint(canonical.value, bounds);
      if (!fingerprint.ok) return fingerprint;
      const current = await readProjection(resources, locator.value, bounds);
      if (current.state === "unavailable") return current.result;
      if (
        current.state === "loaded" &&
        current.snapshot.generation === canonical.value.generation &&
        current.snapshot.fingerprint === fingerprint.value
      ) {
        const adopted = await partialReads.adopt(current.snapshot);
        if (!adopted.ok) return adopted;
        if (adopted.value === undefined) return publishComplete(current.snapshot);
        const ignoreLocator = localProjectionIgnoreLocator();
        if (!ignoreLocator.ok) return unavailable("projection-ignore-invalid");
        const ignored = await ensureCacheIgnored(resources, ignoreLocator.value);
        if (!ignored.ok) return ignored;
        const committed = adopted.value.commit();
        return committed.ok ? success(current.snapshot) : committed;
      }
      const rebuilt = materialize(canonical.value, bounds, fingerprint.value);
      return rebuilt.ok ? publishComplete(rebuilt.value) : rebuilt;
    });

  const update = (event: GraphCommittedEvent) => {
    let captured: Result<GraphCommittedEvent>;
    try {
      const preflight = preflightCommittedEventBounds(event, bounds);
      if (preflight !== "accepted") {
        return Promise.resolve(
          unavailable(
            preflight === "bound-exceeded"
              ? "committed-event-bound-exceeded"
              : "committed-event-malformed",
          ),
        );
      }
      captured = parseGraphCommittedEvent(event);
    } catch {
      return Promise.resolve(unavailable("committed-event-malformed"));
    }
    if (!captured.ok) return Promise.resolve(unavailable("committed-event-malformed"));
    const committedEvent = captured.value;
    return coordinated(async () => {
      const canonical = await loadCanonical();
      if (!canonical.ok) return canonical;
      const fingerprint = canonicalFingerprint(canonical.value, bounds);
      if (!fingerprint.ok) return fingerprint;
      const current = await readProjection(resources, locator.value, bounds);
      if (current.state === "unavailable") return current.result;
      let next: Result<ProjectionSnapshot>;
      if (current.state === "loaded") {
        const sequenced = sequenceGraphCommittedEvent(current.snapshot.generation, committedEvent);
        if (
          sequenced.ok &&
          sequenced.value.status === "accepted" &&
          sequenced.value.generation === canonical.value.generation
        ) {
          next = incremental(current.snapshot, canonical.value, committedEvent, bounds);
          if (next.ok && next.value.fingerprint !== fingerprint.value) {
            next = materialize(canonical.value, bounds, fingerprint.value);
          }
        } else {
          next = materialize(canonical.value, bounds, fingerprint.value);
        }
      } else {
        next = materialize(canonical.value, bounds, fingerprint.value);
      }
      return next.ok ? publishComplete(next.value) : next;
    });
  };

  partialReads = createLocalProjectionReadIndex({
    bounds: {
      maxAliases: bounds.maxAliases,
      maxBytes: bounds.maxBytes,
      maxEntities: bounds.maxEntities,
      maxPageSize: bounds.maxPageSize,
      maxRelations: bounds.maxRelations,
      maxSearchableTextCharacters: bounds.maxSearchableTextCharacters,
    },
    ...(options.checkpoint === undefined ? {} : { checkpoint: options.checkpoint }),
    ensureProjection: load,
    repairProjection: rebuild,
    resources,
  });

  return Object.freeze({
    ...partialReads.capability,
    load,
    rebuild,
    update,
  });
}
