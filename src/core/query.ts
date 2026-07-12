import { parseGraphGeneration, type GraphGeneration } from "./generation.ts";
import { copyGraphPayload, type GraphData } from "./payload.ts";
import { failure, type Result, success } from "./result.ts";

declare const continuationCursorBrand: unique symbol;
declare const pageLimitBrand: unique symbol;

export type ContinuationCursor = string & { readonly [continuationCursorBrand]: true };
export type PageLimit = number & { readonly [pageLimitBrand]: true };

export interface BoundedQueryRequest {
  readonly cursor?: ContinuationCursor | string;
  readonly limit: number;
}

export interface BoundedQueryOptions {
  readonly maxAnchorCharacters: number;
  readonly maxCursorCharacters: number;
  readonly maxPageSize: number;
  readonly maxQueryContextCharacters: number;
}

export interface PreparedBoundedQuery {
  readonly after?: GraphData;
  readonly generation: GraphGeneration;
  readonly limit: PageLimit;
  readonly query: GraphData;
}

export interface ExactGraphRead<T> {
  readonly generation: GraphGeneration;
  readonly item: T;
}

export interface GraphQueryPage<T> {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly T[];
  readonly nextCursor?: ContinuationCursor;
}

export interface QueryPageState {
  readonly hasMore: boolean;
  readonly nextAnchor?: unknown;
}

interface CursorState {
  readonly anchor: GraphData;
  readonly generation: GraphGeneration;
  readonly query: GraphData;
  readonly version: 1;
}

const cursorPrefix = "groma.cursor.v1:";
const cursorStateKeys = ["anchor", "generation", "query", "version"] as const;

function validatePositiveBudget(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function serializeCanonicalData(value: GraphData): string {
  return JSON.stringify(value);
}

function canonicalQueryContext(value: unknown, maximum: number): Result<GraphData> {
  const copied = copyGraphPayload(value, "query");
  if (!copied.ok) return copied;
  const serialized = serializeCanonicalData(copied.value);
  return serialized.length <= maximum
    ? copied
    : failure({
        code: "query-context-too-large",
        message: `Query context exceeds the configured ${maximum}-character budget`,
        details: { actual: serialized.length, maximum },
      });
}

function canonicalAnchor(value: unknown, maximum: number): Result<GraphData> {
  const copied = copyGraphPayload(value, "query");
  if (!copied.ok) return copied;
  const serialized = serializeCanonicalData(copied.value);
  return serialized.length <= maximum
    ? copied
    : failure({
        code: "continuation-anchor-too-large",
        message: `Continuation anchor exceeds the configured ${maximum}-character budget`,
        details: { actual: serialized.length, maximum },
      });
}

function cursorFailure(code: string, message: string): Result<never> {
  return failure({ code, message });
}

function isExactCursorShape(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === cursorStateKeys.length &&
    keys.every((key, index) => key === cursorStateKeys[index])
  );
}

export class BoundedQueryContracts {
  readonly #maxAnchorCharacters: number;
  readonly #maxCursorCharacters: number;
  readonly #maxPageSize: number;
  readonly #maxQueryContextCharacters: number;

  constructor(options: BoundedQueryOptions) {
    validatePositiveBudget(options.maxAnchorCharacters, "maxAnchorCharacters");
    validatePositiveBudget(options.maxCursorCharacters, "maxCursorCharacters");
    validatePositiveBudget(options.maxPageSize, "maxPageSize");
    validatePositiveBudget(options.maxQueryContextCharacters, "maxQueryContextCharacters");
    this.#maxAnchorCharacters = options.maxAnchorCharacters;
    this.#maxCursorCharacters = options.maxCursorCharacters;
    this.#maxPageSize = options.maxPageSize;
    this.#maxQueryContextCharacters = options.maxQueryContextCharacters;
  }

  exact<T>(generation: number, item: T): Result<ExactGraphRead<T>> {
    const parsedGeneration = parseGraphGeneration(generation);
    if (!parsedGeneration.ok) return parsedGeneration;
    return success(Object.freeze({ generation: parsedGeneration.value, item }));
  }

  prepare(
    generation: number,
    query: unknown,
    request: BoundedQueryRequest,
  ): Result<PreparedBoundedQuery> {
    const parsedGeneration = parseGraphGeneration(generation);
    if (!parsedGeneration.ok) return parsedGeneration;
    const limit = this.#parseLimit(request.limit);
    if (!limit.ok) return limit;
    const canonicalQuery = canonicalQueryContext(query, this.#maxQueryContextCharacters);
    if (!canonicalQuery.ok) return canonicalQuery;

    if (request.cursor === undefined) {
      return success(
        Object.freeze({
          generation: parsedGeneration.value,
          limit: limit.value,
          query: canonicalQuery.value,
        }),
      );
    }

    const decoded = this.#decodeCursor(request.cursor);
    if (!decoded.ok) return decoded;
    if (
      serializeCanonicalData(decoded.value.query) !== serializeCanonicalData(canonicalQuery.value)
    ) {
      return cursorFailure(
        "cursor-query-mismatch",
        "Continuation cursor belongs to a different canonical query",
      );
    }
    if (decoded.value.generation !== parsedGeneration.value) {
      return failure({
        code: "stale-cursor",
        message: "Continuation cursor belongs to a different graph generation",
        details: {
          cursorGeneration: decoded.value.generation,
          currentGeneration: parsedGeneration.value,
        },
      });
    }

    return success(
      Object.freeze({
        after: decoded.value.anchor,
        generation: parsedGeneration.value,
        limit: limit.value,
        query: canonicalQuery.value,
      }),
    );
  }

  page<T>(
    prepared: PreparedBoundedQuery,
    items: readonly T[],
    state: QueryPageState,
  ): Result<GraphQueryPage<T>> {
    const generation = parseGraphGeneration(prepared.generation);
    if (!generation.ok) return generation;
    const limit = this.#parseLimit(prepared.limit);
    if (!limit.ok) return limit;
    if (items.length > limit.value) {
      return failure({
        code: "query-page-overflow",
        message: "Query provider returned more items than the validated page limit",
        details: { actual: items.length, limit: limit.value },
      });
    }
    if (state.hasMore && items.length === 0) {
      return failure({
        code: "invalid-query-page",
        message: "An empty page cannot claim that more items are available",
      });
    }
    if (state.hasMore && state.nextAnchor === undefined) {
      return failure({
        code: "missing-continuation-anchor",
        message: "A page with more items must provide a deterministic continuation anchor",
      });
    }
    if (!state.hasMore && state.nextAnchor !== undefined) {
      return failure({
        code: "unexpected-continuation-anchor",
        message: "A completed page must not provide a continuation anchor",
      });
    }

    const nextCursor = state.hasMore
      ? this.#encodeCursor(prepared.generation, prepared.query, state.nextAnchor)
      : undefined;
    if (nextCursor !== undefined && !nextCursor.ok) return nextCursor;
    return success(
      Object.freeze({
        generation: generation.value,
        hasMore: state.hasMore,
        items: Object.freeze([...items]),
        ...(nextCursor?.ok ? { nextCursor: nextCursor.value } : {}),
      }),
    );
  }

  #parseLimit(value: number): Result<PageLimit> {
    return Number.isSafeInteger(value) && value > 0 && value <= this.#maxPageSize
      ? success(value as PageLimit)
      : failure({
          code: "invalid-page-limit",
          message: `Page limit must be a positive safe integer no greater than ${this.#maxPageSize}`,
          details: { limit: value, maximum: this.#maxPageSize },
        });
  }

  #encodeCursor(
    generation: GraphGeneration,
    query: GraphData,
    anchorValue: unknown,
  ): Result<ContinuationCursor> {
    const anchor = canonicalAnchor(anchorValue, this.#maxAnchorCharacters);
    if (!anchor.ok) return anchor;
    const state: CursorState = {
      anchor: anchor.value,
      generation,
      query,
      version: 1,
    };
    const cursor = `${cursorPrefix}${encodeURIComponent(JSON.stringify(state))}`;
    return cursor.length <= this.#maxCursorCharacters
      ? success(cursor as ContinuationCursor)
      : failure({
          code: "continuation-cursor-too-large",
          message: `Continuation cursor exceeds the configured ${this.#maxCursorCharacters}-character budget`,
          details: { actual: cursor.length, maximum: this.#maxCursorCharacters },
        });
  }

  #decodeCursor(cursor: unknown): Result<CursorState> {
    if (typeof cursor !== "string") {
      return cursorFailure("malformed-continuation-cursor", "Continuation cursor must be a string");
    }
    if (cursor.length > this.#maxCursorCharacters) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor exceeds the configured size budget",
      );
    }
    if (!cursor.startsWith(cursorPrefix)) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor has an invalid envelope",
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeURIComponent(cursor.slice(cursorPrefix.length)));
    } catch {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor cannot be decoded",
      );
    }
    if (!isExactCursorShape(parsed)) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor has an invalid shape",
      );
    }
    if (parsed.version !== 1) {
      return cursorFailure(
        "unsupported-continuation-cursor",
        "Continuation cursor version is not supported",
      );
    }
    const generation = parseGraphGeneration(parsed.generation);
    if (!generation.ok) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor contains an invalid graph generation",
      );
    }
    const query = canonicalQueryContext(parsed.query, this.#maxQueryContextCharacters);
    if (!query.ok) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor contains an invalid query context",
      );
    }
    const anchor = canonicalAnchor(parsed.anchor, this.#maxAnchorCharacters);
    if (!anchor.ok) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor contains an invalid continuation anchor",
      );
    }
    return success({
      anchor: anchor.value,
      generation: generation.value,
      query: query.value,
      version: 1,
    });
  }
}
