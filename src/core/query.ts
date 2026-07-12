import { parseGraphGeneration, type GraphGeneration } from "./generation.ts";
import {
  copyCanonicalGraphData,
  copyGraphPayload,
  type CanonicalGraphDataCopy,
  type GraphData,
  type GraphDataScalar,
} from "./payload.ts";
import { failure, type Result, success } from "./result.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "./runtime.ts";

declare const continuationCursorBrand: unique symbol;
declare const pageLimitBrand: unique symbol;

export type ContinuationCursor = string & { readonly [continuationCursorBrand]: true };
export type PageLimit = number & { readonly [pageLimitBrand]: true };

type CanonicalMemberCheck<T> = T extends GraphDataScalar
  ? true
  : T extends CallableFunction
    ? false
    : T extends readonly (infer TItem)[]
      ? IsCanonicalQueryData<TItem>
      : T extends object
        ? false extends {
            [TKey in keyof T]-?: [Required<T>[TKey]] extends [never]
              ? false
              : IsCanonicalQueryData<Required<T>[TKey]>;
          }[keyof T]
          ? false
          : true
        : false;

type HasUnsupportedSymbolKey<T> = T extends GraphDataScalar
  ? false
  : T extends readonly unknown[]
    ? false
    : T extends object
      ? Extract<keyof T, symbol> extends never
        ? false
        : true
      : false;

type IsCanonicalQueryData<T> = true extends (T extends unknown ? HasUnsupportedSymbolKey<T> : never)
  ? false
  : [T] extends [GraphData]
    ? true
    : false extends (T extends unknown ? CanonicalMemberCheck<T> : never)
      ? false
      : true;

type RequireCanonicalQueryData<T> = IsCanonicalQueryData<T> extends true ? unknown : never;

export type CanonicalQueryData<T> = T extends GraphDataScalar
  ? T
  : T extends readonly (infer TItem)[]
    ? readonly CanonicalQueryData<TItem>[]
    : T extends CallableFunction
      ? never
      : T extends object
        ? string extends keyof T
          ? GraphData
          : { readonly [TKey in keyof T]: CanonicalQueryData<T[TKey]> }
        : never;

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
  readonly item: CanonicalQueryData<T>;
}

export interface GraphQueryPage<T> {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly CanonicalQueryData<T>[];
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

interface DecodedCursorState extends CursorState {
  readonly queryCanonicalJson: string;
}

const cursorPrefix = "groma.cursor.v1:";

function validatePositiveBudget(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function canonicalQueryContext(value: unknown, maximum: number): Result<CanonicalGraphDataCopy> {
  return copyCanonicalGraphData(value, "query", {
    code: "query-context-too-large",
    maximum,
    message: `Query context exceeds the configured ${maximum}-character budget`,
  });
}

function canonicalAnchor(value: unknown, maximum: number): Result<CanonicalGraphDataCopy> {
  return copyCanonicalGraphData(value, "query", {
    code: "continuation-anchor-too-large",
    maximum,
    message: `Continuation anchor exceeds the configured ${maximum}-character budget`,
  });
}

function cursorFailure(code: string, message: string): Result<never> {
  return failure({ code, message });
}

function isExactCursorShape(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 4) return false;
  let anchor = false;
  let generation = false;
  let query = false;
  let version = false;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key === "anchor") anchor = true;
    else if (key === "generation") generation = true;
    else if (key === "query") query = true;
    else if (key === "version") version = true;
    else return false;
  }
  return anchor && generation && query && version;
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

  exact<T>(
    generation: number,
    item: T & RequireCanonicalQueryData<NoInfer<T>>,
  ): Result<ExactGraphRead<T>> {
    const parsedGeneration = parseGraphGeneration(generation);
    if (!parsedGeneration.ok) return parsedGeneration;
    const copiedItem = copyGraphPayload(item, "query");
    if (!copiedItem.ok) return copiedItem;
    return success(
      Object.freeze({
        generation: parsedGeneration.value,
        item: copiedItem.value as CanonicalQueryData<T>,
      }),
    );
  }

  prepare(
    generation: number,
    query: unknown,
    request: BoundedQueryRequest,
  ): Result<PreparedBoundedQuery> {
    const inspectedRequest = inspectExactRecord(
      request,
      [["limit"], ["cursor", "limit"]],
      "invalid-bounded-query-request",
      "Bounded query request",
    );
    if (!inspectedRequest.ok) return inspectedRequest;
    const parsedGeneration = parseGraphGeneration(generation);
    if (!parsedGeneration.ok) return parsedGeneration;
    const limit = this.#parseLimit(inspectedRequest.value.limit);
    if (!limit.ok) return limit;
    const canonicalQuery = canonicalQueryContext(query, this.#maxQueryContextCharacters);
    if (!canonicalQuery.ok) return canonicalQuery;

    if (!("cursor" in inspectedRequest.value)) {
      return success(
        Object.freeze({
          generation: parsedGeneration.value,
          limit: limit.value,
          query: canonicalQuery.value.value,
        }),
      );
    }

    const decoded = this.#decodeCursor(inspectedRequest.value.cursor);
    if (!decoded.ok) return decoded;
    if (decoded.value.queryCanonicalJson !== canonicalQuery.value.canonicalJson) {
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
        query: canonicalQuery.value.value,
      }),
    );
  }

  page<T>(
    prepared: PreparedBoundedQuery,
    items: readonly T[] & RequireCanonicalQueryData<NoInfer<T>>,
    state: QueryPageState,
  ): Result<GraphQueryPage<T>> {
    const inspectedPrepared = inspectExactRecord(
      prepared,
      [
        ["generation", "limit", "query"],
        ["after", "generation", "limit", "query"],
      ],
      "invalid-prepared-query",
      "Prepared bounded query",
    );
    if (!inspectedPrepared.ok) return inspectedPrepared;
    const generation = parseGraphGeneration(inspectedPrepared.value.generation);
    if (!generation.ok) return generation;
    const limit = this.#parseLimit(inspectedPrepared.value.limit);
    if (!limit.ok) return limit;
    const query = canonicalQueryContext(
      inspectedPrepared.value.query,
      this.#maxQueryContextCharacters,
    );
    if (!query.ok) return query;
    if ("after" in inspectedPrepared.value) {
      const after = canonicalAnchor(inspectedPrepared.value.after, this.#maxAnchorCharacters);
      if (!after.ok) return after;
    }
    const itemArray = inspectIntrinsicArrayLength(items, "invalid-query-items", "Query items");
    if (!itemArray.ok) return itemArray;
    if (itemArray.value > limit.value) {
      return failure({
        code: "query-page-overflow",
        message: "Query provider returned more items than the validated page limit",
        details: { actual: itemArray.value, limit: limit.value },
      });
    }
    const copiedItems = copyGraphPayload(items, "query");
    if (!copiedItems.ok) return copiedItems;
    if (!Array.isArray(copiedItems.value)) {
      return failure({
        code: "invalid-query-items",
        message: "Query items must be an intrinsic array of canonical graph data",
      });
    }
    const inspectedState = inspectExactRecord(
      state,
      [["hasMore"], ["hasMore", "nextAnchor"]],
      "invalid-query-page-state",
      "Query page state",
    );
    if (!inspectedState.ok) return inspectedState;
    if (typeof inspectedState.value.hasMore !== "boolean") {
      return failure({
        code: "invalid-query-page-state",
        message: "Query page hasMore state must be a boolean",
      });
    }
    const hasAnchor = "nextAnchor" in inspectedState.value;
    if (inspectedState.value.hasMore && copiedItems.value.length === 0) {
      return failure({
        code: "invalid-query-page",
        message: "An empty page cannot claim that more items are available",
      });
    }
    if (inspectedState.value.hasMore && !hasAnchor) {
      return failure({
        code: "missing-continuation-anchor",
        message: "A page with more items must provide a deterministic continuation anchor",
      });
    }
    if (!inspectedState.value.hasMore && hasAnchor) {
      return failure({
        code: "unexpected-continuation-anchor",
        message: "A completed page must not provide a continuation anchor",
      });
    }

    const nextCursor = inspectedState.value.hasMore
      ? this.#encodeCursor(generation.value, query.value, inspectedState.value.nextAnchor)
      : undefined;
    if (nextCursor !== undefined && !nextCursor.ok) return nextCursor;
    return success(
      Object.freeze({
        generation: generation.value,
        hasMore: inspectedState.value.hasMore,
        items: copiedItems.value as readonly CanonicalQueryData<T>[],
        ...(nextCursor?.ok ? { nextCursor: nextCursor.value } : {}),
      }),
    );
  }

  #parseLimit(value: unknown): Result<PageLimit> {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      value <= this.#maxPageSize
      ? success(value as PageLimit)
      : failure({
          code: "invalid-page-limit",
          message: `Page limit must be a positive safe integer no greater than ${this.#maxPageSize}`,
          details: {
            maximum: this.#maxPageSize,
            receivedType: typeof value,
          },
        });
  }

  #encodeCursor(
    generation: GraphGeneration,
    query: CanonicalGraphDataCopy,
    anchorValue: unknown,
  ): Result<ContinuationCursor> {
    const anchor = canonicalAnchor(anchorValue, this.#maxAnchorCharacters);
    if (!anchor.ok) return anchor;
    const canonicalState = `{"anchor":${anchor.value.canonicalJson},"generation":${generation},"query":${query.canonicalJson},"version":1}`;
    const cursor = `${cursorPrefix}${encodeURIComponent(canonicalState)}`;
    return cursor.length <= this.#maxCursorCharacters
      ? success(cursor as ContinuationCursor)
      : failure({
          code: "continuation-cursor-too-large",
          message: `Continuation cursor exceeds the configured ${this.#maxCursorCharacters}-character budget`,
          details: { actual: cursor.length, maximum: this.#maxCursorCharacters },
        });
  }

  #decodeCursor(cursor: unknown): Result<DecodedCursorState> {
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
      anchor: anchor.value.value,
      generation: generation.value,
      query: query.value.value,
      queryCanonicalJson: query.value.canonicalJson,
      version: 1,
    });
  }
}
