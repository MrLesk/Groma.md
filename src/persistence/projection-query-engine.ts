import {
  PROJECTION_CANONICAL_FINGERPRINT_MAX_CHARACTERS,
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseRelationId,
  success,
  type BoundedQueryContracts,
  type BoundedQueryRequest,
  type Diagnostic,
  type EntityId,
  type GraphEntity,
  type GraphEntityQuery,
  type GraphQueryEngineCapability,
  type GraphQueryPage,
  type GraphRelation,
  type GraphSearchQuery,
  type GraphTraversalHit,
  type GraphTraversalQuery,
  type PreparedBoundedQuery,
  type ProjectionCatalogEntry,
  type ProjectionReadCapability,
  type ProjectionReadIdentity,
  type ProjectionReadPage,
  type ProjectionRelationRead,
  type RelationId,
  type Result,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import {
  invokeCapturedBoundedQueryExact,
  invokeCapturedBoundedQueryPage,
  invokeCapturedBoundedQueryPrepare,
} from "../core/query.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";

const intrinsicArrayPush = Array.prototype.push;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicArraySlice = Array.prototype.slice;
const intrinsicArraySort = Array.prototype.sort;
const IntrinsicSet = Set;
const intrinsicIncludes = String.prototype.includes;
const intrinsicMathMin = Math.min;
const intrinsicNormalize = String.prototype.normalize;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectPrototype = Object.prototype;
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const intrinsicRegExpTest = RegExp.prototype.test;
const intrinsicRepeat = String.prototype.repeat;
const intrinsicSetAdd = Set.prototype.add;
const intrinsicSetHas = Set.prototype.has;
const intrinsicSetSize = Object.getOwnPropertyDescriptor(Set.prototype, "size")!.get!;
const intrinsicToLowerCase = String.prototype.toLowerCase;
const graphTokenPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const whitespacePattern = /\s/u;

export interface ProjectionQueryEngineBounds {
  readonly maxCursorCharacters: number;
  readonly maxEntities: number;
  readonly maxPageSize: number;
  readonly maxProjectionPageSize: number;
  readonly maxProviderDataDepth: number;
  readonly maxProviderDataValues: number;
  readonly maxSearchCharacters: number;
  readonly maxSearchableTextCharacters: number;
  readonly maxSearchTerms: number;
  readonly maxTokenCharacters: number;
  readonly maxTraversalDepth: number;
  readonly maxTraversalEntities: number;
  readonly maxTraversalRelationVisits: number;
  readonly maxTraversalRelations: number;
}

export interface ProjectionQueryEngineOptions {
  readonly bounds?: Partial<ProjectionQueryEngineBounds>;
  readonly projection: ProjectionReadCapability;
  readonly queries: BoundedQueryContracts;
}

const defaultMaximumSearchCharacters = 256;
const defaultMaximumSearchTerms = 32;
const defaultMaximumTokenCharacters = 128;
const maximumCanonicalJsonStringExpansion = 6;
// encodeURIComponent expands one literal BMP code unit encoded as three UTF-8
// bytes to three percent triplets. Canonical JSON deliberately leaves those
// characters literal, so nine cursor characters per input code unit is the
// exact worst case (larger than escaped controls and lone surrogates at eight).
const maximumCursorPercentEncodedStringExpansion = 9;
// Canonical JSON contributes at most 72 structural characters around the
// longest public search context. Every caller/provider string may require a
// six-character JSON escape, including an opaque projection fingerprint.
export const DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS =
  72 +
  defaultMaximumTokenCharacters +
  maximumCanonicalJsonStringExpansion * PROJECTION_CANONICAL_FINGERPRINT_MAX_CHARACTERS +
  maximumCanonicalJsonStringExpansion * defaultMaximumSearchCharacters;
// Cursor JSON/percent-encoding contributes 126 characters around the same query,
// then at most 154 characters for a 36-character entity anchor, a 16-digit
// generation, and the versioned outer envelope. The raw 256-character search
// budget already includes whitespace removed between terms: each encoded `","`
// term boundary costs the same nine characters as the worst BMP code unit it
// replaces, so additional term-count padding would double-count that space.
export const DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS =
  126 +
  defaultMaximumTokenCharacters +
  maximumCursorPercentEncodedStringExpansion * PROJECTION_CANONICAL_FINGERPRINT_MAX_CHARACTERS +
  maximumCursorPercentEncodedStringExpansion * defaultMaximumSearchCharacters +
  154;

const defaultBounds: ProjectionQueryEngineBounds = Object.freeze({
  maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
  maxEntities: 100_000,
  maxPageSize: 100,
  maxProjectionPageSize: 100,
  maxProviderDataDepth: 30,
  maxProviderDataValues: 10_000,
  maxSearchCharacters: defaultMaximumSearchCharacters,
  maxSearchableTextCharacters: 64 * 1024,
  maxSearchTerms: defaultMaximumSearchTerms,
  maxTokenCharacters: defaultMaximumTokenCharacters,
  maxTraversalDepth: 16,
  maxTraversalEntities: 100_000,
  maxTraversalRelationVisits: 2_000_000,
  maxTraversalRelations: 1_000_000,
});

const absoluteBounds: ProjectionQueryEngineBounds = Object.freeze({
  maxCursorCharacters: 64 * 1024,
  maxEntities: 1_000_000,
  maxPageSize: 10_000,
  maxProjectionPageSize: 10_000,
  maxProviderDataDepth: 100,
  maxProviderDataValues: 1_000_000,
  maxSearchCharacters: 64 * 1024,
  maxSearchableTextCharacters: 1024 * 1024,
  maxSearchTerms: 1_024,
  maxTokenCharacters: 4_096,
  maxTraversalDepth: 1_000,
  maxTraversalEntities: 1_000_000,
  maxTraversalRelationVisits: 20_000_000,
  maxTraversalRelations: 10_000_000,
});

const boundFields: readonly (keyof ProjectionQueryEngineBounds)[] = Object.freeze([
  "maxCursorCharacters",
  "maxEntities",
  "maxPageSize",
  "maxProjectionPageSize",
  "maxProviderDataDepth",
  "maxProviderDataValues",
  "maxSearchCharacters",
  "maxSearchableTextCharacters",
  "maxSearchTerms",
  "maxTokenCharacters",
  "maxTraversalDepth",
  "maxTraversalEntities",
  "maxTraversalRelationVisits",
  "maxTraversalRelations",
]);

interface PreparedRequest {
  readonly cursor?: string;
  readonly limit: number;
}

interface PreparedSearch {
  readonly kind?: string;
  readonly terms: readonly string[];
}

interface TraversalCandidate {
  readonly depth: number;
  readonly hit: ProjectionRelationRead;
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
      "graph-query-unavailable",
      "The bounded graph query engine is unavailable; retry after the projection is readable",
      { reason },
    ),
  );
}

function parseBounds(input: unknown): ProjectionQueryEngineBounds {
  const selected: Record<keyof ProjectionQueryEngineBounds, number> = {
    maxCursorCharacters: defaultBounds.maxCursorCharacters,
    maxEntities: defaultBounds.maxEntities,
    maxPageSize: defaultBounds.maxPageSize,
    maxProjectionPageSize: defaultBounds.maxProjectionPageSize,
    maxProviderDataDepth: defaultBounds.maxProviderDataDepth,
    maxProviderDataValues: defaultBounds.maxProviderDataValues,
    maxSearchCharacters: defaultBounds.maxSearchCharacters,
    maxSearchableTextCharacters: defaultBounds.maxSearchableTextCharacters,
    maxSearchTerms: defaultBounds.maxSearchTerms,
    maxTokenCharacters: defaultBounds.maxTokenCharacters,
    maxTraversalDepth: defaultBounds.maxTraversalDepth,
    maxTraversalEntities: defaultBounds.maxTraversalEntities,
    maxTraversalRelationVisits: defaultBounds.maxTraversalRelationVisits,
    maxTraversalRelations: defaultBounds.maxTraversalRelations,
  };
  if (input !== undefined) {
    let prototype: object | null;
    try {
      prototype = Reflect.apply(intrinsicObjectGetPrototypeOf, Object, [input]) as object | null;
    } catch {
      throw new RangeError("Projection query engine bounds are malformed");
    }
    if (
      typeof input !== "object" ||
      input === null ||
      (Reflect.apply(intrinsicArrayIsArray, Array, [input]) as boolean) ||
      (prototype !== intrinsicObjectPrototype && prototype !== null)
    ) {
      throw new RangeError("Projection query engine bounds are malformed");
    }
    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.apply(intrinsicReflectOwnKeys, Reflect, [input]) as readonly PropertyKey[];
    } catch {
      throw new RangeError("Projection query engine bounds are malformed");
    }
    if (keys.length > boundFields.length) {
      throw new RangeError("Projection query engine bounds are malformed");
    }
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const key = keys[keyIndex];
      let field: keyof ProjectionQueryEngineBounds | undefined;
      if (typeof key === "string") {
        for (let fieldIndex = 0; fieldIndex < boundFields.length; fieldIndex += 1) {
          if (boundFields[fieldIndex] === key) {
            field = boundFields[fieldIndex];
            break;
          }
        }
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Reflect.apply(intrinsicObjectGetOwnPropertyDescriptor, Object, [
          input,
          key,
        ]) as PropertyDescriptor | undefined;
      } catch {
        throw new RangeError("Projection query engine bounds are malformed");
      }
      if (
        field === undefined ||
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        throw new RangeError("Projection query engine bounds are malformed");
      }
      selected[field] = descriptor.value;
    }
  }
  for (let index = 0; index < boundFields.length; index += 1) {
    const field = boundFields[index]!;
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
  if (selected.maxTraversalEntities > selected.maxEntities) {
    throw new RangeError("maxTraversalEntities cannot exceed maxEntities");
  }
  if (selected.maxTraversalRelations > selected.maxTraversalRelationVisits) {
    throw new RangeError("maxTraversalRelations cannot exceed maxTraversalRelationVisits");
  }
  return Object.freeze(selected);
}

function parseOptions(value: unknown): {
  readonly bounds: ProjectionQueryEngineBounds;
  readonly projection: ProjectionReadCapability;
  readonly queries: BoundedQueryContracts;
} {
  const inspected = inspectExactRecord(
    value,
    [
      ["projection", "queries"],
      ["bounds", "projection", "queries"],
    ],
    "invalid-projection-query-engine-options",
    "Projection query engine options",
  );
  if (!inspected.ok) throw new TypeError("Projection query engine options are malformed");
  const projection = inspected.value.projection as ProjectionReadCapability;
  const queries = inspected.value.queries as BoundedQueryContracts;
  if ((typeof projection !== "object" || projection === null) && typeof projection !== "function") {
    throw new TypeError("projection must be a partial-read capability");
  }
  if ((typeof queries !== "object" || queries === null) && typeof queries !== "function") {
    throw new TypeError("queries must be bounded query contracts");
  }
  return Object.freeze({
    bounds: parseBounds("bounds" in inspected.value ? inspected.value.bounds : undefined),
    projection,
    queries,
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortInPlace<T>(values: T[], compare: (left: T, right: T) => number): T[] {
  return Reflect.apply(intrinsicArraySort, values, [compare]) as T[];
}

function pushArray<T>(values: T[], value: T): void {
  Reflect.apply(intrinsicArrayPush, values, [value]);
}

function sliceArray<T>(values: readonly T[], start: number, end?: number): T[] {
  return Reflect.apply(
    intrinsicArraySlice,
    values,
    end === undefined ? [start] : [start, end],
  ) as T[];
}

function setHas<T>(values: Set<T>, value: T): boolean {
  return Reflect.apply(intrinsicSetHas, values, [value]) as boolean;
}

function setAdd<T>(values: Set<T>, value: T): void {
  Reflect.apply(intrinsicSetAdd, values, [value]);
}

function setSize<T>(values: Set<T>): number {
  return Reflect.apply(intrinsicSetSize, values, []) as number;
}

function minimum(left: number, right: number): number {
  return Reflect.apply(intrinsicMathMin, Math, [left, right]) as number;
}

function providerDiagnosticCode(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const descriptor = Reflect.apply(intrinsicObjectGetOwnPropertyDescriptor, Object, [
      value,
      "code",
    ]) as PropertyDescriptor | undefined;
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function copyProviderArray(
  value: unknown,
  maximum: number,
  reason: string,
): Result<readonly unknown[]> {
  const length = inspectIntrinsicArrayLength(value, "graph-query-unavailable", "Provider array");
  if (!length.ok || length.value > maximum) return unavailable(reason);
  const copied: unknown[] = [];
  try {
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Reflect.apply(intrinsicObjectGetOwnPropertyDescriptor, Object, [
        value,
        `${index}`,
      ]) as PropertyDescriptor | undefined;
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return unavailable(reason);
      }
      pushArray(copied, descriptor.value);
    }
  } catch {
    return unavailable(reason);
  }
  return success(Object.freeze(copied));
}

function validToken(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    (Reflect.apply(intrinsicRegExpTest, graphTokenPattern, [value]) as boolean)
  );
}

function prepareRequest(
  request: BoundedQueryRequest,
  bounds: ProjectionQueryEngineBounds,
): Result<PreparedRequest> {
  const inspected = inspectExactRecord(
    request,
    [["limit"], ["cursor", "limit"]],
    "invalid-bounded-query-request",
    "Bounded query request",
  );
  if (!inspected.ok) return inspected;
  if (
    typeof inspected.value.limit !== "number" ||
    !Number.isSafeInteger(inspected.value.limit) ||
    inspected.value.limit <= 0 ||
    inspected.value.limit > bounds.maxPageSize
  ) {
    return failure(
      diagnostic(
        "invalid-page-limit",
        `Page limit must be a positive safe integer no greater than ${bounds.maxPageSize}`,
        { maximum: bounds.maxPageSize },
      ),
    );
  }
  if ("cursor" in inspected.value) {
    if (
      typeof inspected.value.cursor !== "string" ||
      inspected.value.cursor.length === 0 ||
      inspected.value.cursor.length > bounds.maxCursorCharacters
    ) {
      return failure(
        diagnostic(
          "malformed-continuation-cursor",
          "Continuation cursor must be a nonempty primitive string within the configured size budget",
        ),
      );
    }
    return success(Object.freeze({ cursor: inspected.value.cursor, limit: inspected.value.limit }));
  }
  return success(Object.freeze({ limit: inspected.value.limit }));
}

function prepareEntityQuery(
  value: GraphEntityQuery,
  bounds: ProjectionQueryEngineBounds,
): Result<GraphEntityQuery> {
  const inspected = inspectExactRecord(
    value,
    [[], ["kind"]],
    "invalid-graph-entity-query",
    "Graph entity query",
  );
  if (!inspected.ok) return inspected;
  if ("kind" in inspected.value && !validToken(inspected.value.kind, bounds.maxTokenCharacters)) {
    return failure(
      diagnostic(
        "invalid-entity-kind",
        "Entity kind must be a bounded lowercase dotted or dashed token",
      ),
    );
  }
  return success(
    Object.freeze("kind" in inspected.value ? { kind: inspected.value.kind as string } : {}),
  );
}

function normalizeText(
  value: string,
  maximum: number,
  overflowDiagnostic?: Diagnostic,
): Result<string> {
  const overflow = () =>
    overflowDiagnostic === undefined
      ? unavailable("normalized-search-text-bound")
      : failure(overflowDiagnostic);
  try {
    const normalized = Reflect.apply(intrinsicNormalize, value, ["NFKC"]) as string;
    if (normalized.length > maximum) return overflow();
    const lowered = Reflect.apply(intrinsicToLowerCase, normalized, []) as string;
    return lowered.length <= maximum ? success(lowered) : overflow();
  } catch {
    return unavailable("search-text-normalization");
  }
}

function invalidSearchCharacterDiagnostic(maximumCharacters: number): Diagnostic {
  return diagnostic(
    "invalid-search-text",
    `Search text must be a nonempty primitive string no longer than ${maximumCharacters} characters`,
    Object.freeze({ maximumCharacters }),
  );
}

function invalidSearchTermDiagnostic(maximumTerms: number): Diagnostic {
  return diagnostic(
    "invalid-search-text",
    `Search text must contain no more than ${maximumTerms} normalized terms`,
    Object.freeze({ maximumTerms }),
  );
}

function prepareSearch(
  value: GraphSearchQuery,
  bounds: ProjectionQueryEngineBounds,
): Result<PreparedSearch> {
  const inspected = inspectExactRecord(
    value,
    [["text"], ["kind", "text"]],
    "invalid-graph-search-query",
    "Graph search query",
  );
  if (!inspected.ok) return inspected;
  if ("kind" in inspected.value && !validToken(inspected.value.kind, bounds.maxTokenCharacters)) {
    return failure(
      diagnostic(
        "invalid-entity-kind",
        "Entity kind must be a bounded lowercase dotted or dashed token",
      ),
    );
  }
  if (typeof inspected.value.text !== "string" || inspected.value.text.length === 0) {
    return failure(
      diagnostic(
        "invalid-search-text",
        `Search text must be a nonempty primitive string no longer than ${bounds.maxSearchCharacters} characters`,
      ),
    );
  }
  if (inspected.value.text.length > bounds.maxSearchCharacters) {
    return failure(invalidSearchCharacterDiagnostic(bounds.maxSearchCharacters));
  }
  const normalized = normalizeText(
    inspected.value.text,
    bounds.maxSearchCharacters,
    invalidSearchCharacterDiagnostic(bounds.maxSearchCharacters),
  );
  if (!normalized.ok) {
    return normalized;
  }
  const terms: string[] = [];
  let term = "";
  for (let index = 0; index < normalized.value.length; index += 1) {
    const character = normalized.value[index]!;
    if (Reflect.apply(intrinsicRegExpTest, whitespacePattern, [character]) as boolean) {
      if (term.length > 0) {
        pushArray(terms, term);
        term = "";
      }
    } else {
      term += character;
    }
  }
  if (term.length > 0) pushArray(terms, term);
  if (terms.length === 0) {
    return failure(
      diagnostic(
        "invalid-search-text",
        `Search text must contain between 1 and ${bounds.maxSearchTerms} normalized terms`,
      ),
    );
  }
  if (terms.length > bounds.maxSearchTerms) {
    return failure(invalidSearchTermDiagnostic(bounds.maxSearchTerms));
  }
  const uniqueTerms: string[] = [];
  const seenTerms = new IntrinsicSet<string>();
  for (let index = 0; index < terms.length; index += 1) {
    const candidate = terms[index]!;
    if (!setHas(seenTerms, candidate)) {
      setAdd(seenTerms, candidate);
      pushArray(uniqueTerms, candidate);
    }
  }
  return success(
    Object.freeze({
      ...(inspected.value.kind === undefined ? {} : { kind: inspected.value.kind as string }),
      terms: Object.freeze(sortInPlace(uniqueTerms, compareText)),
    }),
  );
}

function prepareTraversal(
  value: GraphTraversalQuery,
  bounds: ProjectionQueryEngineBounds,
): Result<GraphTraversalQuery & { readonly entity: EntityId }> {
  const inspected = inspectExactRecord(
    value,
    [
      ["depth", "direction", "entity"],
      ["depth", "direction", "entity", "relationType"],
    ],
    "invalid-graph-traversal-query",
    "Graph traversal query",
  );
  if (!inspected.ok) return inspected;
  if (typeof inspected.value.entity !== "string") {
    return failure(diagnostic("invalid-entity-id", "Entity identity must be a string"));
  }
  const entity = parseEntityId(inspected.value.entity);
  if (!entity.ok) return entity;
  if (
    typeof inspected.value.depth !== "number" ||
    !Number.isSafeInteger(inspected.value.depth) ||
    inspected.value.depth <= 0
  ) {
    return failure(
      diagnostic(
        "invalid-traversal-depth",
        `Traversal depth must be a positive safe integer no greater than ${bounds.maxTraversalDepth}`,
      ),
    );
  }
  if (inspected.value.depth > bounds.maxTraversalDepth) {
    return failure(
      diagnostic(
        "invalid-traversal-depth",
        `Traversal depth must be a positive safe integer no greater than ${bounds.maxTraversalDepth}`,
        Object.freeze({ maximumDepth: bounds.maxTraversalDepth }),
      ),
    );
  }
  if (
    inspected.value.direction !== "incoming" &&
    inspected.value.direction !== "outgoing" &&
    inspected.value.direction !== "both"
  ) {
    return failure(
      diagnostic(
        "invalid-traversal-direction",
        "Traversal direction must be incoming, outgoing, or both",
      ),
    );
  }
  if (
    "relationType" in inspected.value &&
    !validToken(inspected.value.relationType, bounds.maxTokenCharacters)
  ) {
    return failure(
      diagnostic(
        "invalid-relation-type",
        "Relation type must be a bounded lowercase dotted or dashed token",
      ),
    );
  }
  return success(
    Object.freeze({
      depth: inspected.value.depth,
      direction: inspected.value.direction,
      entity: entity.value,
      ...(inspected.value.relationType === undefined
        ? {}
        : { relationType: inspected.value.relationType as string }),
    }),
  );
}

function queryContext<T extends object>(operation: "entities" | "search" | "traversal", value: T) {
  return Object.freeze({ operation, ...value });
}

function preflightQuery(
  queries: BoundedQueryContracts,
  context: object,
  request: PreparedRequest,
): Result<void> {
  const worstCase = Object.freeze({
    ...context,
    projectionFingerprint: Reflect.apply(intrinsicRepeat, "\u0000", [
      PROJECTION_CANONICAL_FINGERPRINT_MAX_CHARACTERS,
    ]) as string,
  });
  const prepared = invokeCapturedBoundedQueryPrepare(queries, 0, worstCase, request);
  if (
    prepared.ok ||
    prepared.diagnostics[0]?.code === "stale-cursor" ||
    prepared.diagnostics[0]?.code === "cursor-query-mismatch"
  ) {
    return success(undefined);
  }
  return prepared;
}

function validateBoundedQueryPageSize(queries: BoundedQueryContracts, maxPageSize: number): void {
  let prepared: Result<PreparedBoundedQuery>;
  try {
    prepared = invokeCapturedBoundedQueryPrepare(
      queries,
      0,
      Object.freeze({}),
      Object.freeze({ limit: maxPageSize }),
    );
  } catch {
    throw new TypeError("queries must be genuine bounded query contracts");
  }
  if (!prepared.ok && prepared.diagnostics[0]?.code === "invalid-page-limit") {
    throw new RangeError(
      "Projection query engine maxPageSize exceeds the bounded query contract maximum",
    );
  }
}

function pageFromOrdered<T>(
  queries: BoundedQueryContracts,
  prepared: PreparedBoundedQuery,
  ordered: readonly T[],
  anchorOf: (item: T) => string,
  maxCursorCharacters: number,
): Result<GraphQueryPage<T>> {
  let start = 0;
  if (prepared.after !== undefined) {
    if (typeof prepared.after !== "string") {
      return failure(diagnostic("malformed-continuation-cursor", "Continuation anchor is invalid"));
    }
    let found = -1;
    let occurrences = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      if (anchorOf(ordered[index]!) === prepared.after) {
        found = index;
        occurrences += 1;
      }
    }
    if (occurrences !== 1) {
      return failure(
        diagnostic(
          "cursor-anchor-mismatch",
          "Continuation anchor must occur exactly once in the deterministic result set",
          { occurrences },
        ),
      );
    }
    start = found + 1;
  }
  const limit = prepared.limit as number;
  const selected = sliceArray(ordered, start, start + limit);
  const hasMore = start + selected.length < ordered.length;
  const last = selected[selected.length - 1];
  return boundedQueryPage(
    queries,
    prepared,
    selected,
    hasMore && last !== undefined
      ? { hasMore: true, nextAnchor: anchorOf(last) }
      : { hasMore: false },
    maxCursorCharacters,
  );
}

function boundedQueryPage<T>(
  queries: BoundedQueryContracts,
  prepared: PreparedBoundedQuery,
  items: readonly T[],
  state: { readonly hasMore: boolean; readonly nextAnchor?: unknown },
  maxCursorCharacters: number,
): Result<GraphQueryPage<T>> {
  const page = invokeCapturedBoundedQueryPage(queries, prepared, items, state);
  if (!page.ok) return page;
  const cursor = page.value.nextCursor;
  return cursor !== undefined && cursor.length > maxCursorCharacters
    ? failure(
        diagnostic(
          "continuation-cursor-too-large",
          `Continuation cursor exceeds the configured ${maxCursorCharacters}-character engine budget`,
          { actual: cursor.length, maximum: maxCursorCharacters },
        ),
      )
    : page;
}

function copyEntity(value: unknown, bounds: ProjectionQueryEngineBounds): Result<GraphEntity> {
  const inspected = inspectExactRecord(
    value,
    [["id", "kind", "payload"]],
    "graph-query-unavailable",
    "Projected entity",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.id !== "string" ||
    !validToken(inspected.value.kind, bounds.maxTokenCharacters)
  ) {
    return unavailable("provider-entity-malformed");
  }
  const id = parseEntityId(inspected.value.id);
  const payload = copyGraphPayload(inspected.value.payload, "entity", {
    code: "provider-entity-bound-exceeded",
    maximumDepth: bounds.maxProviderDataDepth,
    maximumValues: bounds.maxProviderDataValues,
    message: "Projected entity payload exceeds the query provider bound",
  });
  return id.ok && payload.ok
    ? success(Object.freeze({ id: id.value, kind: inspected.value.kind, payload: payload.value }))
    : unavailable("provider-entity-malformed");
}

function copyRelation(value: unknown, bounds: ProjectionQueryEngineBounds): Result<GraphRelation> {
  const inspected = inspectExactRecord(
    value,
    [["id", "payload", "source", "target", "type"]],
    "graph-query-unavailable",
    "Projected relation",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.id !== "string" ||
    typeof inspected.value.source !== "string" ||
    typeof inspected.value.target !== "string" ||
    !validToken(inspected.value.type, bounds.maxTokenCharacters)
  ) {
    return unavailable("provider-relation-malformed");
  }
  const id = parseRelationId(inspected.value.id);
  const source = parseEntityId(inspected.value.source);
  const target = parseEntityId(inspected.value.target);
  const payload = copyGraphPayload(inspected.value.payload, "relation", {
    code: "provider-relation-bound-exceeded",
    maximumDepth: bounds.maxProviderDataDepth,
    maximumValues: bounds.maxProviderDataValues,
    message: "Projected relation payload exceeds the query provider bound",
  });
  return id.ok && source.ok && target.ok && payload.ok
    ? success(
        Object.freeze({
          id: id.value,
          payload: payload.value,
          source: source.value,
          target: target.value,
          type: inspected.value.type,
        }),
      )
    : unavailable("provider-relation-malformed");
}

function copyIdentity(
  value: unknown,
  reason = "provider-identity-malformed",
): Result<ProjectionReadIdentity> {
  const inspected = inspectExactRecord(
    value,
    [["fingerprint", "generation"]],
    "graph-query-unavailable",
    "Projection identity",
  );
  if (!inspected.ok) return unavailable(reason);
  const generation = parseGraphGeneration(inspected.value.generation);
  const fingerprint = parseProjectionCanonicalFingerprint(inspected.value.fingerprint);
  return generation.ok && fingerprint.ok
    ? success(Object.freeze({ fingerprint: fingerprint.value, generation: generation.value }))
    : unavailable(reason);
}

function copyCatalogEntry(
  value: unknown,
  bounds: ProjectionQueryEngineBounds,
): Result<ProjectionCatalogEntry> {
  const inspected = inspectExactRecord(
    value,
    [["id", "kind", "searchableText"]],
    "graph-query-unavailable",
    "Projection catalog entry",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.id !== "string" ||
    !validToken(inspected.value.kind, bounds.maxTokenCharacters) ||
    typeof inspected.value.searchableText !== "string" ||
    inspected.value.searchableText.length > bounds.maxSearchableTextCharacters
  ) {
    return unavailable("provider-catalog-entry-malformed");
  }
  const id = parseEntityId(inspected.value.id);
  const normalized = normalizeText(
    inspected.value.searchableText,
    bounds.maxSearchableTextCharacters,
  );
  return id.ok && normalized.ok
    ? success(
        Object.freeze({
          id: id.value,
          kind: inspected.value.kind,
          searchableText: inspected.value.searchableText,
        }),
      )
    : unavailable("provider-catalog-entry-malformed");
}

function sameIdentity(left: ProjectionReadIdentity, right: ProjectionReadIdentity): boolean {
  return left.generation === right.generation && left.fingerprint === right.fingerprint;
}

type ProviderResultOperation =
  | "catalog-page"
  | "exact-catalog-anchor"
  | "exact-entity"
  | "exact-entity-batch"
  | "identity"
  | "relation-page";

function providerFailure(
  value: unknown,
  maximumDiagnostics: number,
  operation: ProviderResultOperation,
): Result<never> {
  try {
    const diagnostics = copyProviderArray(
      value,
      maximumDiagnostics,
      "provider-diagnostics-malformed",
    );
    if (!diagnostics.ok) return unavailable("provider-diagnostics-malformed");
    let translated: "cursor-anchor-mismatch" | "unknown-entity" | undefined;
    for (let index = 0; index < diagnostics.value.length; index += 1) {
      const item = diagnostics.value[index];
      const code = providerDiagnosticCode(item);
      if (
        operation === "exact-catalog-anchor" &&
        (code === "projection-read-anchor-mismatch" || code === "unknown-entity")
      ) {
        translated = "cursor-anchor-mismatch";
        continue;
      }
      if (operation === "exact-entity" && code === "unknown-entity") {
        translated = "unknown-entity";
        continue;
      }
      return unavailable("provider-failure");
    }
    if (translated === "cursor-anchor-mismatch") {
      return failure(
        diagnostic(
          "cursor-anchor-mismatch",
          "Continuation anchor is absent from the current deterministic projection",
        ),
      );
    }
    if (translated === "unknown-entity") {
      return failure(
        diagnostic(
          "unknown-entity",
          "No entity or durable alias exists for the exact stable identity",
        ),
      );
    }
  } catch {
    // Hostile provider diagnostics collapse to one stable availability result.
  }
  return unavailable("provider-failure");
}

function resultValue(
  value: unknown,
  maximumDiagnostics: number,
  operation: ProviderResultOperation,
): Result<unknown> {
  const inspected = inspectExactRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "graph-query-unavailable",
    "Projection provider result",
  );
  if (!inspected.ok) return unavailable("provider-result-malformed");
  if (inspected.value.ok === false)
    return providerFailure(inspected.value.diagnostics, maximumDiagnostics, operation);
  return inspected.value.ok === true
    ? success(inspected.value.value)
    : unavailable("provider-result-malformed");
}

/** Creates a storage-neutral bounded graph engine over partial projection reads only. */
export function createProjectionQueryEngine(
  options: ProjectionQueryEngineOptions,
): GraphQueryEngineCapability {
  const parsed = parseOptions(options);
  const bounds = parsed.bounds;
  const projection = parsed.projection;
  const queries = parsed.queries;
  validateBoundedQueryPageSize(queries, bounds.maxPageSize);
  let identityMethod: ProjectionReadCapability["identity"];
  let exactCatalogMethod: ProjectionReadCapability["exactCatalogEntry"];
  let exactMethod: ProjectionReadCapability["exactEntity"];
  let exactEntitiesMethod: ProjectionReadCapability["exactEntities"];
  let catalogMethod: ProjectionReadCapability["pageCatalog"];
  let relationsMethod: ProjectionReadCapability["pageRelations"];
  try {
    identityMethod = projection.identity;
    exactCatalogMethod = projection.exactCatalogEntry;
    exactMethod = projection.exactEntity;
    exactEntitiesMethod = projection.exactEntities;
    catalogMethod = projection.pageCatalog;
    relationsMethod = projection.pageRelations;
  } catch {
    throw new TypeError("projection query methods must be callable");
  }
  if (
    typeof identityMethod !== "function" ||
    typeof exactCatalogMethod !== "function" ||
    typeof exactMethod !== "function" ||
    typeof exactEntitiesMethod !== "function" ||
    typeof catalogMethod !== "function" ||
    typeof relationsMethod !== "function"
  ) {
    throw new TypeError("projection query methods must be callable");
  }

  const identity = async (): Promise<Result<ProjectionReadIdentity>> => {
    try {
      const raw = await Reflect.apply(identityMethod, projection, []);
      const result = resultValue(raw, bounds.maxProviderDataValues, "identity");
      return result.ok ? copyIdentity(result.value) : result;
    } catch {
      return unavailable("provider-identity-threw");
    }
  };

  const exact = async (expected: ProjectionReadIdentity, id: EntityId) => {
    try {
      const raw = await Reflect.apply(exactMethod, projection, [expected, id]);
      const result = resultValue(raw, bounds.maxProviderDataValues, "exact-entity");
      if (!result.ok) return result;
      const inspected = inspectExactRecord(
        result.value,
        [["identity", "value"]],
        "graph-query-unavailable",
        "Projection exact entity result",
      );
      if (!inspected.ok) return unavailable("provider-exact-malformed");
      const providedIdentity = copyIdentity(inspected.value.identity);
      const entity = copyEntity(inspected.value.value, bounds);
      return providedIdentity.ok && sameIdentity(providedIdentity.value, expected) && entity.ok
        ? entity
        : unavailable("provider-exact-malformed");
    } catch {
      return unavailable("provider-exact-threw");
    }
  };

  const exactCatalog = async (
    expected: ProjectionReadIdentity,
    id: EntityId,
  ): Promise<Result<ProjectionCatalogEntry>> => {
    try {
      const raw = await Reflect.apply(exactCatalogMethod, projection, [expected, id]);
      const result = resultValue(raw, bounds.maxProviderDataValues, "exact-catalog-anchor");
      if (!result.ok) return result;
      const inspected = inspectExactRecord(
        result.value,
        [["identity", "value"]],
        "graph-query-unavailable",
        "Projection exact catalog result",
      );
      if (!inspected.ok) return unavailable("provider-catalog-exact-malformed");
      const providedIdentity = copyIdentity(inspected.value.identity);
      const entry = copyCatalogEntry(inspected.value.value, bounds);
      return providedIdentity.ok &&
        sameIdentity(providedIdentity.value, expected) &&
        entry.ok &&
        entry.value.id === id
        ? entry
        : unavailable("provider-catalog-exact-malformed");
    } catch {
      return unavailable("provider-catalog-exact-threw");
    }
  };

  const exactEntityBatch = async (
    expected: ProjectionReadIdentity,
    ids: readonly EntityId[],
    entries: readonly ProjectionCatalogEntry[],
  ): Promise<Result<readonly GraphEntity[]>> => {
    try {
      const requested = Object.freeze(sliceArray(ids, 0));
      const raw = await Reflect.apply(exactEntitiesMethod, projection, [expected, requested]);
      const result = resultValue(raw, bounds.maxProviderDataValues, "exact-entity-batch");
      if (!result.ok) return result;
      const inspected = inspectExactRecord(
        result.value,
        [["identity", "items"]],
        "graph-query-unavailable",
        "Projection exact entity batch",
      );
      if (!inspected.ok) return unavailable("provider-entity-batch-malformed");
      const providedIdentity = copyIdentity(inspected.value.identity);
      const providerItems = copyProviderArray(
        inspected.value.items,
        ids.length,
        "provider-entity-batch-malformed",
      );
      if (
        !providedIdentity.ok ||
        !sameIdentity(providedIdentity.value, expected) ||
        !providerItems.ok ||
        providerItems.value.length !== ids.length ||
        entries.length !== ids.length
      ) {
        return unavailable("provider-entity-batch-malformed");
      }
      const items: GraphEntity[] = [];
      for (let index = 0; index < providerItems.value.length; index += 1) {
        const entity = copyEntity(providerItems.value[index], bounds);
        if (
          !entity.ok ||
          entity.value.id !== ids[index] ||
          entity.value.kind !== entries[index]!.kind
        ) {
          return unavailable("provider-entity-batch-malformed");
        }
        pushArray(items, entity.value);
      }
      return success(Object.freeze(items));
    } catch {
      return unavailable("provider-entity-batch-threw");
    }
  };

  const catalogPage = async (
    expected: ProjectionReadIdentity,
    after: EntityId | undefined,
    limit: number,
  ): Promise<Result<ProjectionReadPage<ProjectionCatalogEntry>>> => {
    try {
      const raw = await Reflect.apply(catalogMethod, projection, [
        expected,
        Object.freeze({ ...(after === undefined ? {} : { after }), limit }),
      ]);
      const result = resultValue(raw, bounds.maxProviderDataValues, "catalog-page");
      if (!result.ok) return result;
      const inspected = inspectExactRecord(
        result.value,
        [
          ["hasMore", "identity", "items"],
          ["hasMore", "identity", "items", "nextAfter"],
        ],
        "graph-query-unavailable",
        "Projection catalog page",
      );
      if (!inspected.ok || typeof inspected.value.hasMore !== "boolean") {
        return unavailable("provider-catalog-page-malformed");
      }
      const pageIdentity = copyIdentity(inspected.value.identity);
      const providerItems = copyProviderArray(
        inspected.value.items,
        limit,
        "provider-catalog-page-malformed",
      );
      if (!pageIdentity.ok || !sameIdentity(pageIdentity.value, expected) || !providerItems.ok) {
        return unavailable("provider-catalog-page-malformed");
      }
      const items: ProjectionCatalogEntry[] = [];
      let previous = after;
      for (let index = 0; index < providerItems.value.length; index += 1) {
        const candidate = providerItems.value[index];
        const entry = copyCatalogEntry(candidate, bounds);
        if (!entry.ok || (previous !== undefined && previous >= entry.value.id)) {
          return unavailable("provider-catalog-order-malformed");
        }
        previous = entry.value.id;
        pushArray(items, entry.value);
      }
      const last = items[items.length - 1];
      if (
        inspected.value.hasMore !== "nextAfter" in inspected.value ||
        (inspected.value.hasMore && (last === undefined || inspected.value.nextAfter !== last.id))
      ) {
        return unavailable("provider-catalog-continuation-malformed");
      }
      return success(
        Object.freeze({
          hasMore: inspected.value.hasMore,
          identity: pageIdentity.value,
          items: Object.freeze(items),
          ...(inspected.value.hasMore ? { nextAfter: inspected.value.nextAfter as string } : {}),
        }),
      );
    } catch {
      return unavailable("provider-catalog-threw");
    }
  };

  const relationPage = async (
    expected: ProjectionReadIdentity,
    from: EntityId,
    direction: "incoming" | "outgoing",
    after: RelationId | undefined,
    limit: number,
  ): Promise<Result<ProjectionReadPage<ProjectionRelationRead>>> => {
    try {
      const raw = await Reflect.apply(relationsMethod, projection, [
        expected,
        Object.freeze({
          ...(after === undefined ? {} : { after }),
          direction,
          entity: from,
          limit,
        }),
      ]);
      const result = resultValue(raw, bounds.maxProviderDataValues, "relation-page");
      if (!result.ok) return result;
      const inspected = inspectExactRecord(
        result.value,
        [
          ["hasMore", "identity", "items"],
          ["hasMore", "identity", "items", "nextAfter"],
        ],
        "graph-query-unavailable",
        "Projection relation page",
      );
      if (!inspected.ok || typeof inspected.value.hasMore !== "boolean") {
        return unavailable("provider-relation-page-malformed");
      }
      const pageIdentity = copyIdentity(inspected.value.identity);
      const providerItems = copyProviderArray(
        inspected.value.items,
        limit,
        "provider-relation-page-malformed",
      );
      if (!pageIdentity.ok || !sameIdentity(pageIdentity.value, expected) || !providerItems.ok) {
        return unavailable("provider-relation-page-malformed");
      }
      const items: ProjectionRelationRead[] = [];
      let previous = after;
      for (let index = 0; index < providerItems.value.length; index += 1) {
        const candidate = providerItems.value[index];
        const item = inspectExactRecord(
          candidate,
          [["direction", "entity", "from", "relation"]],
          "graph-query-unavailable",
          "Projection relation read",
        );
        if (!item.ok || item.value.direction !== direction || item.value.from !== from) {
          return unavailable("provider-relation-item-malformed");
        }
        const entity = copyEntity(item.value.entity, bounds);
        const relation = copyRelation(item.value.relation, bounds);
        if (
          !entity.ok ||
          !relation.ok ||
          (previous !== undefined && previous >= relation.value.id)
        ) {
          return unavailable("provider-relation-item-malformed");
        }
        const expectedEndpoint =
          direction === "incoming" ? relation.value.target : relation.value.source;
        const neighbor = direction === "incoming" ? relation.value.source : relation.value.target;
        if (expectedEndpoint !== from || neighbor !== entity.value.id) {
          return unavailable("provider-relation-endpoint-malformed");
        }
        previous = relation.value.id;
        pushArray(
          items,
          Object.freeze({ direction, entity: entity.value, from, relation: relation.value }),
        );
      }
      const last = items[items.length - 1];
      if (
        inspected.value.hasMore !== "nextAfter" in inspected.value ||
        (inspected.value.hasMore &&
          (last === undefined || inspected.value.nextAfter !== last.relation.id))
      ) {
        return unavailable("provider-relation-continuation-malformed");
      }
      return success(
        Object.freeze({
          hasMore: inspected.value.hasMore,
          identity: pageIdentity.value,
          items: Object.freeze(items),
          ...(inspected.value.hasMore ? { nextAfter: inspected.value.nextAfter as string } : {}),
        }),
      );
    } catch {
      return unavailable("provider-relations-threw");
    }
  };

  const collectCatalog = async (
    expected: ProjectionReadIdentity,
    prepared: PreparedBoundedQuery,
    matches: (entry: ProjectionCatalogEntry) => Result<boolean>,
  ): Promise<Result<GraphQueryPage<GraphEntity>>> => {
    const after =
      prepared.after === undefined || typeof prepared.after !== "string"
        ? undefined
        : parseEntityId(prepared.after);
    if (prepared.after !== undefined && typeof prepared.after !== "string") {
      return failure(diagnostic("cursor-anchor-mismatch", "Continuation anchor is not an entity"));
    }
    if (after !== undefined && !after.ok) {
      return failure(diagnostic("cursor-anchor-mismatch", "Continuation anchor is not an entity"));
    }
    const wanted = prepared.limit as number;
    const selected: ProjectionCatalogEntry[] = [];
    let visits = 0;
    let providerAfter = after?.ok ? after.value : undefined;
    let hasProviderMore = true;
    if (after !== undefined && after.ok) {
      if (visits >= bounds.maxEntities) {
        return failure(
          diagnostic(
            "entity-scan-bound-exceeded",
            "Entity filtering exceeds its configured projection scan bound",
          ),
        );
      }
      const anchor = await exactCatalog(expected, after.value);
      visits += 1;
      if (!anchor.ok) return anchor;
      const accepted = matches(anchor.value);
      if (!accepted.ok) return accepted;
      if (!accepted.value) {
        return failure(
          diagnostic(
            "cursor-anchor-mismatch",
            "Continuation anchor is absent from the exact deterministic result set",
          ),
        );
      }
    }
    while (hasProviderMore && selected.length <= wanted) {
      if (visits >= bounds.maxEntities) {
        return failure(
          diagnostic(
            "entity-scan-bound-exceeded",
            "Entity filtering exceeds its configured projection scan bound",
          ),
        );
      }
      const page = await catalogPage(
        expected,
        providerAfter,
        minimum(bounds.maxProjectionPageSize, bounds.maxEntities - visits),
      );
      if (!page.ok) return page;
      if (page.value.items.length === 0 && page.value.hasMore) {
        return unavailable("provider-catalog-made-no-progress");
      }
      for (let index = 0; index < page.value.items.length; index += 1) {
        const item = page.value.items[index]!;
        visits += 1;
        const accepted = matches(item);
        if (!accepted.ok) return accepted;
        if (accepted.value) pushArray(selected, item);
        if (selected.length > wanted) break;
      }
      hasProviderMore = page.value.hasMore;
      if (page.value.nextAfter !== undefined) {
        const next = parseEntityId(page.value.nextAfter);
        if (!next.ok) return unavailable("provider-catalog-continuation-malformed");
        providerAfter = next.value;
      }
    }
    const hasMore = selected.length > wanted;
    const entries = sliceArray(selected, 0, wanted);
    const requestedIds: EntityId[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      pushArray(requestedIds, entries[index]!.id);
    }
    const ids = Object.freeze(requestedIds);
    const batch =
      ids.length === 0
        ? success(Object.freeze([] as GraphEntity[]))
        : await exactEntityBatch(expected, ids, entries);
    if (!batch.ok) return batch;
    const entities = batch.value;
    const last = entities[entities.length - 1];
    return boundedQueryPage(
      queries,
      prepared,
      Object.freeze(entities),
      hasMore && last !== undefined ? { hasMore: true, nextAnchor: last.id } : { hasMore: false },
      bounds.maxCursorCharacters,
    );
  };

  const traversalHits = async (
    expected: ProjectionReadIdentity,
    query: GraphTraversalQuery & { readonly entity: EntityId },
  ): Promise<Result<readonly GraphTraversalHit[]>> => {
    const start = await exact(expected, query.entity);
    if (!start.ok) return start;
    let frontier: EntityId[] = [start.value.id];
    const visitedEntities = new IntrinsicSet<EntityId>();
    setAdd(visitedEntities, start.value.id);
    const visitedRelations = new IntrinsicSet<RelationId>();
    const hits: GraphTraversalHit[] = [];
    let relationVisits = 0;

    for (let depth = 1; depth <= query.depth && frontier.length > 0; depth += 1) {
      const candidates: TraversalCandidate[] = [];
      sortInPlace(frontier, compareText);
      for (let frontierIndex = 0; frontierIndex < frontier.length; frontierIndex += 1) {
        const from = frontier[frontierIndex]!;
        const directions =
          query.direction === "both"
            ? (["incoming", "outgoing"] as const)
            : ([query.direction] as readonly ("incoming" | "outgoing")[]);
        for (let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
          const direction = directions[directionIndex]!;
          let after: RelationId | undefined;
          let hasMore = true;
          while (hasMore) {
            if (relationVisits >= bounds.maxTraversalRelationVisits) {
              return failure(
                diagnostic(
                  "traversal-relation-visit-bound-exceeded",
                  "Relationship traversal exceeds its configured examined-edge bound",
                ),
              );
            }
            const page = await relationPage(
              expected,
              from,
              direction,
              after,
              minimum(
                bounds.maxProjectionPageSize,
                bounds.maxTraversalRelationVisits - relationVisits,
              ),
            );
            if (!page.ok) return page;
            if (page.value.items.length === 0 && page.value.hasMore) {
              return unavailable("provider-relations-made-no-progress");
            }
            for (let itemIndex = 0; itemIndex < page.value.items.length; itemIndex += 1) {
              const item = page.value.items[itemIndex]!;
              relationVisits += 1;
              if (
                !setHas(visitedRelations, item.relation.id) &&
                (query.relationType === undefined || item.relation.type === query.relationType)
              ) {
                pushArray(candidates, Object.freeze({ depth, hit: item }));
              }
            }
            hasMore = page.value.hasMore;
            if (page.value.nextAfter !== undefined) {
              const next = parseRelationId(page.value.nextAfter);
              if (!next.ok) return unavailable("provider-relation-continuation-malformed");
              after = next.value;
            }
          }
        }
      }
      sortInPlace(candidates, (left, right) => {
        const byRelation = compareText(left.hit.relation.id, right.hit.relation.id);
        if (byRelation !== 0) return byRelation;
        const byFrom = compareText(left.hit.from, right.hit.from);
        return byFrom === 0 ? compareText(left.hit.direction, right.hit.direction) : byFrom;
      });

      const nextEntities: EntityId[] = [];
      for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
        const candidate = candidates[candidateIndex]!;
        if (setHas(visitedRelations, candidate.hit.relation.id)) continue;
        if (setSize(visitedRelations) >= bounds.maxTraversalRelations) {
          return failure(
            diagnostic(
              "traversal-relation-bound-exceeded",
              "Relationship traversal exceeds its configured emitted-relation bound",
            ),
          );
        }
        setAdd(visitedRelations, candidate.hit.relation.id);
        pushArray(
          hits,
          Object.freeze({
            depth: candidate.depth,
            direction: candidate.hit.direction,
            entity: candidate.hit.entity,
            from: candidate.hit.from,
            relation: candidate.hit.relation,
          }),
        );
        const neighbor = candidate.hit.entity.id;
        if (!setHas(visitedEntities, neighbor)) {
          if (setSize(visitedEntities) >= bounds.maxTraversalEntities) {
            return failure(
              diagnostic(
                "traversal-entity-bound-exceeded",
                "Relationship traversal exceeds its configured entity work bound",
              ),
            );
          }
          setAdd(visitedEntities, neighbor);
          pushArray(nextEntities, neighbor);
        }
      }
      frontier = nextEntities;
    }
    return success(Object.freeze(hits));
  };

  const exactEntity = async (expected: ProjectionReadIdentity, id: string) => {
    const selected = copyIdentity(expected, "expected-identity-malformed");
    if (!selected.ok) return selected;
    if (typeof id !== "string") {
      return failure(diagnostic("invalid-entity-id", "Entity identity must be a string"));
    }
    const requested = parseEntityId(id);
    if (!requested.ok) return requested;
    const entity = await exact(selected.value, requested.value);
    return entity.ok
      ? invokeCapturedBoundedQueryExact(queries, selected.value.generation, entity.value)
      : entity;
  };

  const pageEntities = async (
    expected: ProjectionReadIdentity,
    query: GraphEntityQuery,
    request: BoundedQueryRequest,
  ) => {
    const preparedQuery = prepareEntityQuery(query, bounds);
    if (!preparedQuery.ok) return preparedQuery;
    const preparedRequest = prepareRequest(request, bounds);
    if (!preparedRequest.ok) return preparedRequest;
    const baseContext = queryContext("entities", preparedQuery.value);
    const preflight = preflightQuery(queries, baseContext, preparedRequest.value);
    if (!preflight.ok) return preflight;
    const selected = copyIdentity(expected, "expected-identity-malformed");
    if (!selected.ok) return selected;
    const prepared = invokeCapturedBoundedQueryPrepare(
      queries,
      selected.value.generation,
      queryContext("entities", {
        ...preparedQuery.value,
        projectionFingerprint: selected.value.fingerprint,
      }),
      preparedRequest.value,
    );
    if (!prepared.ok) return prepared;
    return collectCatalog(selected.value, prepared.value, (entry) =>
      success(preparedQuery.value.kind === undefined || entry.kind === preparedQuery.value.kind),
    );
  };

  const searchEntities = async (
    expected: ProjectionReadIdentity,
    query: GraphSearchQuery,
    request: BoundedQueryRequest,
  ) => {
    const preparedQuery = prepareSearch(query, bounds);
    if (!preparedQuery.ok) return preparedQuery;
    const preparedRequest = prepareRequest(request, bounds);
    if (!preparedRequest.ok) return preparedRequest;
    const baseContext = queryContext("search", preparedQuery.value);
    const preflight = preflightQuery(queries, baseContext, preparedRequest.value);
    if (!preflight.ok) return preflight;
    const selected = copyIdentity(expected, "expected-identity-malformed");
    if (!selected.ok) return selected;
    const prepared = invokeCapturedBoundedQueryPrepare(
      queries,
      selected.value.generation,
      queryContext("search", {
        ...preparedQuery.value,
        projectionFingerprint: selected.value.fingerprint,
      }),
      preparedRequest.value,
    );
    if (!prepared.ok) return prepared;
    return collectCatalog(selected.value, prepared.value, (entry) => {
      if (preparedQuery.value.kind !== undefined && entry.kind !== preparedQuery.value.kind) {
        return success(false);
      }
      const normalized = normalizeText(entry.searchableText, bounds.maxSearchableTextCharacters);
      if (!normalized.ok) return unavailable("provider-search-text-normalization");
      for (let index = 0; index < preparedQuery.value.terms.length; index += 1) {
        if (
          !(Reflect.apply(intrinsicIncludes, normalized.value, [
            preparedQuery.value.terms[index]!,
          ]) as boolean)
        ) {
          return success(false);
        }
      }
      return success(true);
    });
  };

  const traverseRelations = async (
    expected: ProjectionReadIdentity,
    query: GraphTraversalQuery,
    request: BoundedQueryRequest,
  ) => {
    const preparedQuery = prepareTraversal(query, bounds);
    if (!preparedQuery.ok) return preparedQuery;
    const preparedRequest = prepareRequest(request, bounds);
    if (!preparedRequest.ok) return preparedRequest;
    const baseContext = queryContext("traversal", preparedQuery.value);
    const preflight = preflightQuery(queries, baseContext, preparedRequest.value);
    if (!preflight.ok) return preflight;
    const selected = copyIdentity(expected, "expected-identity-malformed");
    if (!selected.ok) return selected;
    const prepared = invokeCapturedBoundedQueryPrepare(
      queries,
      selected.value.generation,
      queryContext("traversal", {
        ...preparedQuery.value,
        projectionFingerprint: selected.value.fingerprint,
      }),
      preparedRequest.value,
    );
    if (!prepared.ok) return prepared;
    const resolved = await exact(selected.value, preparedQuery.value.entity);
    if (!resolved.ok) return resolved;
    const effectiveQuery = Object.freeze({ ...preparedQuery.value, entity: resolved.value.id });
    const hits = await traversalHits(selected.value, effectiveQuery);
    return hits.ok
      ? pageFromOrdered(
          queries,
          prepared.value,
          hits.value,
          (item) => item.relation.id,
          bounds.maxCursorCharacters,
        )
      : hits;
  };

  return Object.freeze({
    exactEntity,
    identity,
    maxPageSize: bounds.maxPageSize,
    pageEntities,
    searchEntities,
    traverseRelations,
  });
}
