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
const cursorBeforeAnchor = '{"anchor":';
const cursorBeforeGeneration = ',"generation":';
const cursorBeforeQuery = ',"query":';
const cursorAfterQuery = ',"version":1}';
const intrinsicEncodeURIComponent = globalThis.encodeURIComponent;
const intrinsicDecodeURIComponent = globalThis.decodeURIComponent;
const intrinsicStartsWith = String.prototype.startsWith;
const intrinsicSlice = String.prototype.slice;

interface CursorRawStateParts {
  readonly anchorCanonicalJson: string;
  readonly generationJson: string;
  readonly queryCanonicalJson: string;
}

function cursorRawStateParts(
  anchorCanonicalJson: string,
  generation: GraphGeneration,
  queryCanonicalJson: string,
): CursorRawStateParts {
  return { anchorCanonicalJson, generationJson: `${generation}`, queryCanonicalJson };
}

function cursorRawStateFits(parts: CursorRawStateParts, maximum: number): boolean {
  let remaining = maximum;
  const consume = (length: number): boolean => {
    if (length > remaining) return false;
    remaining -= length;
    return true;
  };
  return (
    consume(cursorPrefix.length) &&
    consume(cursorBeforeAnchor.length) &&
    consume(parts.anchorCanonicalJson.length) &&
    consume(cursorBeforeGeneration.length) &&
    consume(parts.generationJson.length) &&
    consume(cursorBeforeQuery.length) &&
    consume(parts.queryCanonicalJson.length) &&
    consume(cursorAfterQuery.length)
  );
}

function renderCursorRawState(parts: CursorRawStateParts): string {
  return `${cursorBeforeAnchor}${parts.anchorCanonicalJson}${cursorBeforeGeneration}${parts.generationJson}${cursorBeforeQuery}${parts.queryCanonicalJson}${cursorAfterQuery}`;
}

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
    let previousAnchorCanonicalJson: string | undefined;
    if ("after" in inspectedPrepared.value) {
      const after = canonicalAnchor(inspectedPrepared.value.after, this.#maxAnchorCharacters);
      if (!after.ok) return after;
      previousAnchorCanonicalJson = after.value.canonicalJson;
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
    if (inspectedState.value.hasMore && itemArray.value === 0) {
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
    let nextCursor: Result<ContinuationCursor> | undefined;
    if (inspectedState.value.hasMore) {
      const nextAnchor = canonicalAnchor(
        inspectedState.value.nextAnchor,
        this.#maxAnchorCharacters,
      );
      if (!nextAnchor.ok) return nextAnchor;
      if (nextAnchor.value.canonicalJson === previousAnchorCanonicalJson) {
        return failure({
          code: "non-advancing-continuation-anchor",
          message: "Continuation anchor must advance beyond the previous page anchor",
        });
      }
      nextCursor = this.#encodeCursor(generation.value, query.value, nextAnchor.value);
      if (!nextCursor.ok) return nextCursor;
    }
    const copiedItems = copyGraphPayload(items, "query");
    if (!copiedItems.ok) return copiedItems;
    if (!Array.isArray(copiedItems.value)) {
      return failure({
        code: "invalid-query-items",
        message: "Query items must be an intrinsic array of canonical graph data",
      });
    }
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
    anchor: CanonicalGraphDataCopy,
  ): Result<ContinuationCursor> {
    const parts = cursorRawStateParts(anchor.canonicalJson, generation, query.canonicalJson);
    if (!cursorRawStateFits(parts, this.#maxCursorCharacters)) {
      return failure({
        code: "continuation-cursor-too-large",
        message: `Continuation cursor exceeds the configured ${this.#maxCursorCharacters}-character budget`,
        details: { maximum: this.#maxCursorCharacters },
      });
    }
    const canonicalState = renderCursorRawState(parts);
    const encodedState = Reflect.apply(intrinsicEncodeURIComponent, undefined, [canonicalState]);
    const cursor = `${cursorPrefix}${encodedState}`;
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
    if (!Reflect.apply(intrinsicStartsWith, cursor, [cursorPrefix])) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor has an invalid envelope",
      );
    }

    const suffix = Reflect.apply(intrinsicSlice, cursor, [cursorPrefix.length]);
    let decodedState: string;
    let parsed: unknown;
    try {
      decodedState = Reflect.apply(intrinsicDecodeURIComponent, undefined, [suffix]);
      const canonicalSuffix = Reflect.apply(intrinsicEncodeURIComponent, undefined, [decodedState]);
      if (canonicalSuffix !== suffix) {
        return cursorFailure(
          "malformed-continuation-cursor",
          "Continuation cursor does not use the canonical encoded envelope",
        );
      }
      parsed = JSON.parse(decodedState);
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
    const canonicalState = renderCursorRawState(
      cursorRawStateParts(anchor.value.canonicalJson, generation.value, query.value.canonicalJson),
    );
    if (canonicalState !== decodedState) {
      return cursorFailure(
        "malformed-continuation-cursor",
        "Continuation cursor state is not in canonical form",
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

const intrinsicReflectApply = Reflect.apply;
const intrinsicBoundedQueryExact = BoundedQueryContracts.prototype.exact;
const intrinsicBoundedQueryPage = BoundedQueryContracts.prototype.page;
const intrinsicBoundedQueryPrepare = BoundedQueryContracts.prototype.prepare;

/** @internal Application boundary invocation that cannot be redirected through the public prototype. */
export function invokeCapturedBoundedQueryExact<T>(
  receiver: BoundedQueryContracts,
  generation: number,
  item: T,
): Result<ExactGraphRead<T>> {
  return intrinsicReflectApply(intrinsicBoundedQueryExact, receiver, [generation, item]) as Result<
    ExactGraphRead<T>
  >;
}

/** @internal Application boundary invocation that cannot be redirected through the public prototype. */
export function invokeCapturedBoundedQueryPage<T>(
  receiver: BoundedQueryContracts,
  prepared: PreparedBoundedQuery,
  items: readonly T[],
  state: QueryPageState,
): Result<GraphQueryPage<T>> {
  return intrinsicReflectApply(intrinsicBoundedQueryPage, receiver, [
    prepared,
    items,
    state,
  ]) as Result<GraphQueryPage<T>>;
}

/** @internal Application boundary invocation that also proves the receiver's private brand. */
export function invokeCapturedBoundedQueryPrepare(
  receiver: BoundedQueryContracts,
  generation: number,
  query: unknown,
  request: BoundedQueryRequest,
): Result<PreparedBoundedQuery> {
  return intrinsicReflectApply(intrinsicBoundedQueryPrepare, receiver, [
    generation,
    query,
    request,
  ]) as Result<PreparedBoundedQuery>;
}
