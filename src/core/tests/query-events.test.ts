import { describe, expect, test } from "bun:test";

import {
  createGraphCommittedEvent,
  sequenceGraphCommittedEvent,
  type GraphCommittedEvent,
} from "../events.ts";
import type { GraphEntity, GraphRelation } from "../graph.ts";
import { parseGraphGeneration } from "../generation.ts";
import { parseEntityId, parseRelationId } from "../identity.ts";
import { copyCanonicalGraphData, copyGraphPayload, type GraphData } from "../payload.ts";
import { BoundedQueryContracts, type ContinuationCursor } from "../query.ts";

const entity = (suffix: string): string => `ent_${suffix.padStart(32, "0")}`;
const relation = (suffix: string): string => `rel_${suffix.padStart(32, "0")}`;

function createContracts(
  overrides: Partial<ConstructorParameters<typeof BoundedQueryContracts>[0]> = {},
) {
  return new BoundedQueryContracts({
    maxAnchorCharacters: 256,
    maxCursorCharacters: 2_048,
    maxPageSize: 3,
    maxQueryContextCharacters: 512,
    ...overrides,
  });
}

function prepareFirst(
  contracts: BoundedQueryContracts,
  generation = 4,
  query: unknown = { kind: "component", order: "id" },
  limit = 2,
) {
  const prepared = contracts.prepare(generation, query, { limit });
  if (!prepared.ok) throw new Error(prepared.diagnostics[0]?.message);
  return prepared.value;
}

function assertCanonicalQueryResultTypes(contracts: BoundedQueryContracts): void {
  const exact = contracts.exact(1, { nested: { labels: ["read-only"] } });
  if (exact.ok) {
    // @ts-expect-error Canonical nested arrays are deeply readonly.
    exact.value.item.nested.labels.push("mutation");
  }
  const page = contracts.page(prepareFirst(contracts, 1, {}, 1), [{ labels: ["read-only"] }], {
    hasMore: false,
  });
  if (page.ok) {
    // @ts-expect-error Canonical page item arrays are deeply readonly.
    page.value.items[0]?.labels.push("mutation");
  }
  // @ts-expect-error Date is behavior-bearing rather than canonical GraphData.
  contracts.exact(1, new Date(0));
  // @ts-expect-error Function-bearing records are not canonical GraphData.
  contracts.page(prepareFirst(contracts), [{ behavior: () => "unsafe" }], { hasMore: false });
  // @ts-expect-error Undefined fields are not canonical query data.
  contracts.exact(1, { value: undefined });
  // @ts-expect-error Bigint fields are not canonical query data.
  contracts.exact(1, { value: 1n });
  const symbolKey = Symbol("behavior");
  // @ts-expect-error Symbol-keyed records are not canonical query data.
  contracts.exact(1, { [symbolKey]: "unsafe" });
}

void assertCanonicalQueryResultTypes;

function assertCoreQueryRecordTypes(
  contracts: BoundedQueryContracts,
  graphEntity: GraphEntity,
  graphRelation: GraphRelation,
): void {
  contracts.exact(1, graphEntity);
  contracts.page(prepareFirst(contracts), [graphRelation], { hasMore: false });

  const typedEntity = contracts.exact(1, {
    id: graphEntity.id,
    kind: graphEntity.kind,
    payload: { nested: { labels: ["read-only"] } },
  });
  if (typedEntity.ok) {
    // @ts-expect-error Canonical Core-record payloads are deeply readonly.
    typedEntity.value.item.payload.nested.labels.push("mutation");
  }
}

void assertCoreQueryRecordTypes;

interface SparseQueryRecord {
  readonly description?: string;
  readonly id: string;
  readonly nested?: { readonly labels: readonly string[] };
}

function assertSparseQueryRecordTypes(
  contracts: BoundedQueryContracts,
  sparse: SparseQueryRecord,
  requiredUndefined: { readonly value: string | undefined },
  optionalUndefined: { readonly value?: string | undefined },
): void {
  const exact = contracts.exact(1, sparse);
  if (exact.ok) {
    // @ts-expect-error Canonical sparse result fields remain readonly.
    exact.value.item.description = "mutation";
    // @ts-expect-error Nested arrays in optional fields remain deeply readonly.
    exact.value.item.nested?.labels.push("mutation");
  }
  // @ts-expect-error Required fields that permit undefined are not canonical query data.
  contracts.exact(1, requiredUndefined);
  // @ts-expect-error Explicit undefined in an optional field remains noncanonical.
  contracts.exact(1, optionalUndefined);
}

void assertSparseQueryRecordTypes;

describe("bounded query contracts", () => {
  test("attaches a validated generation to exact reads", () => {
    const contracts = createContracts();
    expect(contracts.exact(0, { id: entity("1") })).toMatchObject({
      ok: true,
      value: { generation: 0, item: { id: entity("1") } },
    });
    expect(contracts.exact(-1, "item")).toMatchObject({
      diagnostics: [{ code: "invalid-graph-generation" }],
      ok: false,
    });
    expect(contracts.exact(Number.MAX_SAFE_INTEGER + 1, "item")).toMatchObject({
      diagnostics: [{ code: "invalid-graph-generation" }],
      ok: false,
    });
    const negativeZero = contracts.exact(-0, "item");
    expect(negativeZero.ok).toBeTrue();
    if (negativeZero.ok) expect(Object.is(negativeZero.value.generation, -0)).toBeFalse();
  });

  test("copies and deeply freezes exact and page items without retaining aliases", () => {
    const contracts = createContracts();
    const exactDraft = { nested: { labels: ["exact"] } };
    const exact = contracts.exact(1, exactDraft);
    if (!exact.ok) throw new Error(exact.diagnostics[0]?.message);
    exactDraft.nested.labels.push("caller mutation");
    expect(exact.value.item).toEqual({ nested: { labels: ["exact"] } });
    expect(() =>
      (exact.value.item.nested.labels as unknown as string[]).push("result mutation"),
    ).toThrow();

    const pageDraft = { nested: { labels: ["page"] } };
    const page = contracts.page(prepareFirst(contracts, 1, {}, 1), [pageDraft], {
      hasMore: false,
    });
    if (!page.ok) throw new Error(page.diagnostics[0]?.message);
    pageDraft.nested.labels.push("caller mutation");
    expect(page.value.items).toEqual([{ nested: { labels: ["page"] } }]);
    expect(() =>
      (page.value.items[0]!.nested.labels as unknown as string[]).push("result mutation"),
    ).toThrow();

    expect(contracts.exact(1, { behavior: () => "unsafe" } as unknown as GraphData)).toMatchObject({
      diagnostics: [{ code: "unsupported-payload" }],
      ok: false,
    });
  });

  test("accepts typed Core graph records directly and snapshots their payloads", () => {
    const contracts = createContracts();
    const entityId = parseEntityId(entity("1"));
    const sourceId = parseEntityId(entity("2"));
    const relationId = parseRelationId(relation("1"));
    if (!entityId.ok || !sourceId.ok || !relationId.ok) throw new Error("expected valid IDs");

    const entityPayload = { nested: { labels: ["entity"] } };
    const relationPayload = { nested: { labels: ["relation"] } };
    const graphEntity: GraphEntity = {
      id: entityId.value,
      kind: "component",
      payload: entityPayload,
    };
    const graphRelation: GraphRelation = {
      id: relationId.value,
      payload: relationPayload,
      source: sourceId.value,
      target: entityId.value,
      type: "requires",
    };
    const exact = contracts.exact(1, graphEntity);
    const page = contracts.page(prepareFirst(contracts, 1, {}, 1), [graphRelation], {
      hasMore: false,
    });
    if (!exact.ok || !page.ok) throw new Error("expected canonical Core records");

    entityPayload.nested.labels.push("caller mutation");
    relationPayload.nested.labels.push("caller mutation");
    expect(exact.value.item).toEqual({
      id: entityId.value,
      kind: "component",
      payload: { nested: { labels: ["entity"] } },
    });
    expect(page.value.items[0]).toEqual({
      id: relationId.value,
      payload: { nested: { labels: ["relation"] } },
      source: sourceId.value,
      target: entityId.value,
      type: "requires",
    });
    const exactPayload = exact.value.item.payload as {
      readonly nested: { readonly labels: readonly string[] };
    };
    expect(Object.isFrozen(exactPayload.nested.labels)).toBeTrue();
  });

  test("creates empty and exact-limit completed pages without cursors", () => {
    const contracts = createContracts();
    const prepared = prepareFirst(contracts);

    expect(contracts.page(prepared, [], { hasMore: false })).toMatchObject({
      ok: true,
      value: { generation: 4, hasMore: false, items: [] },
    });
    expect(contracts.page(prepared, [entity("1"), entity("2")], { hasMore: false })).toMatchObject({
      ok: true,
      value: {
        generation: 4,
        hasMore: false,
        items: [entity("1"), entity("2")],
      },
    });
  });

  test("continues a deterministic page from a self-contained opaque cursor", () => {
    const contracts = createContracts();
    const query = { filters: { state: "present" }, kind: "component", order: "id" };
    const prepared = prepareFirst(contracts, 12, query);
    const first = contracts.page(prepared, [entity("1"), entity("2")], {
      hasMore: true,
      nextAnchor: { id: entity("2"), order: ["id", "ascending"] },
    });
    expect(first.ok).toBeTrue();
    if (!first.ok || first.value.nextCursor === undefined) return;

    const continued = contracts.prepare(12, query, {
      cursor: first.value.nextCursor,
      limit: 2,
    });
    expect(continued).toMatchObject({
      ok: true,
      value: {
        after: { id: entity("2"), order: ["id", "ascending"] },
        generation: 12,
        limit: 2,
        query,
      },
    });
    if (!continued.ok) return;
    expect(contracts.page(continued.value, [entity("3")], { hasMore: false })).toMatchObject({
      ok: true,
      value: { generation: 12, hasMore: false, items: [entity("3")] },
    });
  });

  test("canonicalizes query context and anchors for deterministic cursors", () => {
    const contracts = createContracts();
    const left = prepareFirst(contracts, 3, { order: "id", filters: { type: "service" } }, 1);
    const right = prepareFirst(contracts, 3, { filters: { type: "service" }, order: "id" }, 1);
    const leftPage = contracts.page(left, [entity("1")], {
      hasMore: true,
      nextAnchor: { sort: "id", id: entity("1") },
    });
    const rightPage = contracts.page(right, [entity("1")], {
      hasMore: true,
      nextAnchor: { id: entity("1"), sort: "id" },
    });
    expect(leftPage).toEqual(rightPage);
  });

  test("normalizes negative zero before exposing or binding provider query context", () => {
    const contracts = createContracts();
    const negative = prepareFirst(contracts, 3, { offset: -0 }, 1);
    const positive = prepareFirst(contracts, 3, { offset: 0 }, 1);
    expect(Object.is((negative.query as { offset: number }).offset, -0)).toBeFalse();
    expect(negative.query).toEqual({ offset: 0 });

    const negativePage = contracts.page(negative, [1], { hasMore: true, nextAnchor: -0 });
    const positivePage = contracts.page(positive, [1], { hasMore: true, nextAnchor: 0 });
    expect(negativePage).toEqual(positivePage);
  });

  test("rejects invalid limits and inconsistent provider page state", () => {
    const contracts = createContracts();
    for (const limit of [0, -1, 1.5, 4, Number.MAX_SAFE_INTEGER + 1]) {
      expect(contracts.prepare(1, {}, { limit })).toMatchObject({
        diagnostics: [{ code: "invalid-page-limit" }],
        ok: false,
      });
    }

    const prepared = prepareFirst(contracts, 1, {}, 2);
    expect(contracts.page(prepared, [1, 2, 3], { hasMore: false })).toMatchObject({
      diagnostics: [{ code: "query-page-overflow" }],
      ok: false,
    });
    expect(contracts.page(prepared, [], { hasMore: true, nextAnchor: 0 })).toMatchObject({
      diagnostics: [{ code: "invalid-query-page" }],
      ok: false,
    });
    expect(contracts.page(prepared, [1], { hasMore: true })).toMatchObject({
      diagnostics: [{ code: "missing-continuation-anchor" }],
      ok: false,
    });
    expect(contracts.page(prepared, [1], { hasMore: false, nextAnchor: 1 })).toMatchObject({
      diagnostics: [{ code: "unexpected-continuation-anchor" }],
      ok: false,
    });
    expect(contracts.page(prepared, [1], {} as { hasMore: boolean })).toMatchObject({
      diagnostics: [{ code: "invalid-query-page-state" }],
      ok: false,
    });
    expect(
      contracts.page(prepared, [1], { hasMore: "false" } as unknown as { hasMore: boolean }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-query-page-state" }], ok: false });
    expect(
      contracts.page(prepared, [1], {
        hasMore: false,
        providerWatermark: 7,
      } as unknown as { hasMore: boolean }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-query-page-state" }], ok: false });

    let anchorGetterInvoked = false;
    const accessorState = { hasMore: true } as Record<string, unknown>;
    Object.defineProperty(accessorState, "nextAnchor", {
      enumerable: true,
      get: () => {
        anchorGetterInvoked = true;
        return 1;
      },
    });
    expect(
      contracts.page(prepared, [1], accessorState as unknown as { hasMore: boolean }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-query-page-state" }], ok: false });
    expect(anchorGetterInvoked).toBeFalse();
  });

  test("rejects invalid page state before traversing item contents", () => {
    const contracts = createContracts();
    const prepared = prepareFirst(contracts, 1, {}, 1);
    let itemOwnKeysInvocations = 0;
    const item = new Proxy(
      {},
      {
        ownKeys: () => {
          itemOwnKeysInvocations += 1;
          throw new Error("invalid state must fail before item traversal");
        },
      },
    ) as unknown as GraphData;

    expect(contracts.page(prepared, [item], { hasMore: true })).toMatchObject({
      diagnostics: [{ code: "missing-continuation-anchor" }],
      ok: false,
    });
    expect(
      contracts.page(prepared, [item], {
        hasMore: "yes",
      } as unknown as { hasMore: boolean }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-query-page-state" }], ok: false });
    expect(contracts.page(prepared, [item], { hasMore: false, nextAnchor: 1 })).toMatchObject({
      diagnostics: [{ code: "unexpected-continuation-anchor" }],
      ok: false,
    });
    expect(contracts.page(prepared, [item], { hasMore: true, nextAnchor: 1n })).toMatchObject({
      diagnostics: [{ code: "unsupported-payload" }],
      ok: false,
    });
    let anchorGetterInvocations = 0;
    const behaviorAnchor = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => {
        anchorGetterInvocations += 1;
        throw new Error("behavior-bearing anchor must fail safely");
      },
    });
    expect(
      contracts.page(prepared, [item], { hasMore: true, nextAnchor: behaviorAnchor }),
    ).toMatchObject({ diagnostics: [{ code: "unsupported-payload" }], ok: false });
    expect(itemOwnKeysInvocations).toBe(0);
    expect(anchorGetterInvocations).toBe(0);
  });

  test("validates intrinsic item arrays by copied contents rather than spoofable length or iteration", () => {
    const contracts = createContracts();
    const prepared = prepareFirst(contracts, 1, {}, 1);
    const iterableLengthSpoof = {
      length: 0,
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
      },
    };
    expect(() =>
      contracts.page(prepared, iterableLengthSpoof as unknown as readonly number[], {
        hasMore: false,
      }),
    ).not.toThrow();
    expect(
      contracts.page(prepared, iterableLengthSpoof as unknown as readonly number[], {
        hasMore: false,
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-query-items" }], ok: false });

    const extended = [1];
    Object.defineProperty(extended, "reportedLength", { enumerable: true, value: 0 });
    expect(contracts.page(prepared, extended, { hasMore: false })).toMatchObject({
      diagnostics: [{ code: "unsupported-payload" }],
      ok: false,
    });
  });

  test("rejects page overflow before traversing any query item", () => {
    const contracts = createContracts();
    const prepared = prepareFirst(contracts, 1, {}, 1);
    let getterInvoked = false;
    const first = Object.defineProperty({}, "throwing", {
      enumerable: true,
      get: () => {
        getterInvoked = true;
        throw new Error("must not inspect an over-limit item");
      },
    });
    const result = contracts.page(prepared, [first, 2] as unknown as readonly GraphData[], {
      hasMore: false,
    });
    expect(result).toMatchObject({
      diagnostics: [{ code: "query-page-overflow", details: { actual: 2, limit: 1 } }],
      ok: false,
    });
    expect(getterInvoked).toBeFalse();
  });

  test("rejects page overflow before enumerating array keys", () => {
    const contracts = createContracts();
    const prepared = prepareFirst(contracts, 1, {}, 1);
    let ownKeysInvocations = 0;
    const items = new Proxy([1, 2], {
      ownKeys: () => {
        ownKeysInvocations += 1;
        throw new Error("overflow must not enumerate array keys");
      },
    });
    expect(() => contracts.page(prepared, items, { hasMore: false })).not.toThrow();
    expect(contracts.page(prepared, items, { hasMore: false })).toMatchObject({
      diagnostics: [{ code: "query-page-overflow", details: { actual: 2, limit: 1 } }],
      ok: false,
    });
    expect(ownKeysInvocations).toBe(0);
  });

  test("treats prepared query objects as forged runtime input", () => {
    const contracts = createContracts();
    const forged = (query: unknown, continuation?: { readonly after: unknown }) =>
      ({
        ...(continuation === undefined ? {} : { after: continuation.after }),
        generation: 1,
        limit: 1,
        query,
      }) as unknown as ReturnType<typeof prepareFirst>;
    for (const query of [{ value: 1n }, { toJSON: () => ({ value: 1 }) }, { value: undefined }]) {
      expect(() => contracts.page(forged(query), [1], { hasMore: false })).not.toThrow();
      expect(contracts.page(forged(query), [1], { hasMore: false })).toMatchObject({
        diagnostics: [{ code: "unsupported-payload" }],
        ok: false,
      });
    }

    expect(() => contracts.page(forged({}, { after: 1n }), [1], { hasMore: false })).not.toThrow();
    expect(contracts.page(forged({}, { after: 1n }), [1], { hasMore: false })).toMatchObject({
      diagnostics: [{ code: "unsupported-payload" }],
      ok: false,
    });

    const providerOrder = { z: 2, a: 1 };
    const canonical = prepareFirst(contracts, 1, { a: 1, z: 2 }, 1);
    const forgedPage = contracts.page(forged(providerOrder), [1], {
      hasMore: true,
      nextAnchor: 1,
    });
    const canonicalPage = contracts.page(canonical, [1], {
      hasMore: true,
      nextAnchor: 1,
    });
    expect(forgedPage).toEqual(canonicalPage);

    let getterInvoked = false;
    const accessorPrepared = { generation: 1, limit: 1 } as Record<string, unknown>;
    Object.defineProperty(accessorPrepared, "query", {
      enumerable: true,
      get: () => {
        getterInvoked = true;
        return {};
      },
    });
    expect(
      contracts.page(accessorPrepared as unknown as ReturnType<typeof prepareFirst>, [1], {
        hasMore: false,
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-prepared-query" }], ok: false });
    expect(getterInvoked).toBeFalse();
  });

  test("fails closed for malformed, unsupported, mismatched, and stale cursors", () => {
    const contracts = createContracts();
    const query = { kind: "component", order: "id" };
    const first = contracts.page(prepareFirst(contracts, 7, query, 1), [entity("1")], {
      hasMore: true,
      nextAnchor: entity("1"),
    });
    if (!first.ok || first.value.nextCursor === undefined) throw new Error("expected cursor");
    const prefix = "groma.cursor.v1:";
    const suffix = first.value.nextCursor.slice(prefix.length);
    const canonicalRawState = decodeURIComponent(suffix);
    const rawEnvelope = `${prefix}${canonicalRawState}`;
    const alternateEscapes = `${prefix}${suffix.replace("%7B", "%7b")}`;
    const noncanonicalStates = [
      canonicalRawState.replace('{"anchor":', '{ "anchor":'),
      `{"query":{"kind":"component","order":"id"},"anchor":"${entity("1")}","generation":7,"version":1}`,
      canonicalRawState.replace('"generation":7', '"generation":7.0'),
      canonicalRawState.replace(
        '{"kind":"component","order":"id"}',
        '{"order":"id","kind":"component"}',
      ),
      canonicalRawState.replace(',"version":1}', ',"version":1,"version":1}'),
    ];

    for (const cursor of [
      "",
      "%",
      "groma.cursor.v1:%",
      "groma.cursor.v1:null",
      `groma.cursor.v1:${encodeURIComponent("not json")}`,
      "x".repeat(2_049),
      42 as unknown as string,
      rawEnvelope,
      alternateEscapes,
      ...noncanonicalStates.map((state) => `${prefix}${encodeURIComponent(state)}`),
    ]) {
      expect(() => contracts.prepare(7, query, { cursor, limit: 1 })).not.toThrow();
      expect(contracts.prepare(7, query, { cursor, limit: 1 })).toMatchObject({
        diagnostics: [{ code: "malformed-continuation-cursor" }],
        ok: false,
      });
    }

    const rawBudget = createContracts({ maxCursorCharacters: rawEnvelope.length });
    expect(rawBudget.prepare(7, query, { cursor: rawEnvelope, limit: 1 })).toMatchObject({
      diagnostics: [{ code: "malformed-continuation-cursor" }],
      ok: false,
    });
    expect(contracts.prepare(7, query, { cursor: first.value.nextCursor, limit: 1 })).toMatchObject(
      {
        ok: true,
      },
    );

    const unsupported = `groma.cursor.v1:${encodeURIComponent(
      JSON.stringify({
        anchor: entity("1"),
        generation: 7,
        query,
        version: 2,
      }),
    )}`;
    expect(contracts.prepare(7, query, { cursor: unsupported, limit: 1 })).toMatchObject({
      diagnostics: [{ code: "unsupported-continuation-cursor" }],
      ok: false,
    });
    expect(
      contracts.prepare(
        7,
        { kind: "relation", order: "id" },
        {
          cursor: first.value.nextCursor,
          limit: 1,
        },
      ),
    ).toMatchObject({ diagnostics: [{ code: "cursor-query-mismatch" }], ok: false });
    expect(contracts.prepare(8, query, { cursor: first.value.nextCursor, limit: 1 })).toMatchObject(
      { diagnostics: [{ code: "stale-cursor" }], ok: false },
    );
    expect(
      contracts.prepare(
        8,
        { kind: "relation", order: "id" },
        {
          cursor: first.value.nextCursor,
          limit: 1,
        },
      ),
    ).toMatchObject({ diagnostics: [{ code: "stale-cursor" }], ok: false });
  });

  test("enforces explicit query, anchor, and cursor budgets", () => {
    const queryLimited = createContracts({ maxQueryContextCharacters: 8 });
    expect(queryLimited.prepare(1, { query: "too large" }, { limit: 1 })).toMatchObject({
      diagnostics: [{ code: "query-context-too-large" }],
      ok: false,
    });

    const anchorLimited = createContracts({ maxAnchorCharacters: 8 });
    expect(
      anchorLimited.page(prepareFirst(anchorLimited, 1, {}, 1), [1], {
        hasMore: true,
        nextAnchor: { anchor: "too large" },
      }),
    ).toMatchObject({ diagnostics: [{ code: "continuation-anchor-too-large" }], ok: false });

    const cursorLimited = createContracts({ maxCursorCharacters: 32 });
    expect(
      cursorLimited.page(prepareFirst(cursorLimited, 1, {}, 1), [1], {
        hasMore: true,
        nextAnchor: 1,
      }),
    ).toMatchObject({ diagnostics: [{ code: "continuation-cursor-too-large" }], ok: false });
  });

  test("aborts query and anchor copying as soon as canonical JSON exceeds its budget", () => {
    const contracts = createContracts({
      maxAnchorCharacters: 8,
      maxQueryContextCharacters: 8,
    });
    let queryGetterInvoked = false;
    const query = { a: "already too large" } as Record<string, unknown>;
    Object.defineProperty(query, "z", {
      enumerable: true,
      get: () => {
        queryGetterInvoked = true;
        throw new Error("query traversal must already have stopped");
      },
    });
    expect(contracts.prepare(1, query, { limit: 1 })).toMatchObject({
      diagnostics: [{ code: "query-context-too-large" }],
      ok: false,
    });
    expect(queryGetterInvoked).toBeFalse();

    let anchorGetterInvoked = false;
    const anchor = new Array(2);
    Object.defineProperty(anchor, "0", { enumerable: true, value: "already too large" });
    Object.defineProperty(anchor, "1", {
      enumerable: true,
      get: () => {
        anchorGetterInvoked = true;
        throw new Error("anchor traversal must already have stopped");
      },
    });
    const page = contracts.page(prepareFirst(contracts, 1, {}, 1), [1], {
      hasMore: true,
      nextAnchor: anchor,
    });
    expect(page).toMatchObject({
      diagnostics: [{ code: "continuation-anchor-too-large" }],
      ok: false,
    });
    expect(anchorGetterInvoked).toBeFalse();
  });

  test("rejects impossible array budgets before enumerating keys", () => {
    let ownKeysInvocations = 0;
    const query = new Proxy(new Array(10_000), {
      ownKeys: () => {
        ownKeysInvocations += 1;
        throw new Error("minimum array size must fail before ownKeys");
      },
    });
    const result = createContracts({ maxQueryContextCharacters: 8 }).prepare(1, query, {
      limit: 1,
    });
    expect(result).toMatchObject({
      diagnostics: [{ code: "query-context-too-large" }],
      ok: false,
    });
    expect(ownKeysInvocations).toBe(0);
  });

  test("rejects impossible flat-record budgets before sorting keys or reading values", () => {
    const originalSort = Object.getOwnPropertyDescriptor(Array.prototype, "sort");
    if (originalSort === undefined || typeof originalSort.value !== "function") {
      throw new Error("expected intrinsic Array.prototype.sort");
    }
    let sortInvocations = 0;
    let getterInvocations = 0;
    const query: Record<string, unknown> = {};
    for (let index = 0; index < 200; index += 1) {
      Object.defineProperty(query, `key${index}`, {
        enumerable: true,
        get: () => {
          getterInvocations += 1;
          throw new Error("record budget must fail before value inspection");
        },
      });
    }

    let result: ReturnType<BoundedQueryContracts["prepare"]> | undefined;
    try {
      Object.defineProperty(Array.prototype, "sort", {
        configurable: true,
        value: function (...args: unknown[]) {
          sortInvocations += 1;
          return Reflect.apply(originalSort.value as (...values: unknown[]) => unknown, this, args);
        },
      });
      result = createContracts({ maxQueryContextCharacters: 8 }).prepare(1, query, { limit: 1 });
    } finally {
      Object.defineProperty(Array.prototype, "sort", originalSort);
    }

    expect(result).toMatchObject({
      diagnostics: [{ code: "query-context-too-large" }],
      ok: false,
    });
    expect(sortInvocations).toBe(0);
    expect(getterInvocations).toBe(0);
  });

  test("quotes canonical strings incrementally with exact escape and surrogate budgets", () => {
    const source = `"\n😀\ud800`;
    const expected = '"' + '\\"' + "\\n" + "😀" + "\\ud800" + '"';
    const exact = copyCanonicalGraphData(source, "query", {
      code: "test-budget",
      maximum: expected.length,
      message: "test budget exceeded",
    });
    expect(exact).toMatchObject({
      ok: true,
      value: { canonicalJson: expected, value: source },
    });
    expect(
      copyCanonicalGraphData(source, "query", {
        code: "test-budget",
        maximum: expected.length - 1,
        message: "test budget exceeded",
      }),
    ).toMatchObject({ diagnostics: [{ code: "test-budget" }], ok: false });
    expect(
      copyCanonicalGraphData("x".repeat(1_000_000), "query", {
        code: "test-budget",
        maximum: 8,
        message: "test budget exceeded",
      }),
    ).toMatchObject({ diagnostics: [{ code: "test-budget" }], ok: false });
  });

  test("copy-only graph data validation performs no canonical string rendering", () => {
    const charCodeAt = Object.getOwnPropertyDescriptor(String.prototype, "charCodeAt");
    const numberToString = Object.getOwnPropertyDescriptor(Number.prototype, "toString");
    if (
      charCodeAt === undefined ||
      typeof charCodeAt.value !== "function" ||
      numberToString === undefined ||
      typeof numberToString.value !== "function"
    ) {
      throw new Error("expected intrinsic string and number methods");
    }
    let serializerInvocations = 0;
    let copied: ReturnType<typeof copyGraphPayload> | undefined;
    try {
      Object.defineProperty(String.prototype, "charCodeAt", {
        configurable: true,
        value: () => {
          serializerInvocations += 1;
          throw new Error("copy-only mode must not quote strings");
        },
      });
      Object.defineProperty(Number.prototype, "toString", {
        configurable: true,
        value: () => {
          serializerInvocations += 1;
          throw new Error("copy-only mode must not render numbers");
        },
      });
      copied = copyGraphPayload({ nested: ["text", 42] }, "query");
    } finally {
      Object.defineProperty(String.prototype, "charCodeAt", charCodeAt);
      Object.defineProperty(Number.prototype, "toString", numberToString);
    }

    expect(serializerInvocations).toBe(0);
    expect(copied).toEqual({ ok: true, value: { nested: ["text", 42] } });
    if (copied?.ok) {
      expect(Object.isFrozen(copied.value)).toBeTrue();
      expect(Object.isFrozen((copied.value as { nested: readonly GraphData[] }).nested)).toBeTrue();
    }
  });

  test("preflights raw cursor size before encoding and still catches Unicode expansion", () => {
    const encodeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "encodeURIComponent");
    const decodeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "decodeURIComponent");
    if (
      encodeDescriptor === undefined ||
      typeof encodeDescriptor.value !== "function" ||
      decodeDescriptor === undefined ||
      typeof decodeDescriptor.value !== "function"
    ) {
      throw new Error("expected global URI codecs");
    }
    let globalCodecInvocations = 0;
    let impossible: ReturnType<BoundedQueryContracts["page"]> | undefined;
    let isolatedContinuation: ReturnType<BoundedQueryContracts["prepare"]> | undefined;
    const tiny = createContracts({ maxCursorCharacters: 1 });
    const tinyPrepared = prepareFirst(tiny, 1, {}, 1);
    const isolated = createContracts();
    const isolatedPrepared = prepareFirst(isolated, 1, { label: "isolated" }, 1);
    try {
      Object.defineProperty(globalThis, "encodeURIComponent", {
        configurable: true,
        value: () => {
          globalCodecInvocations += 1;
          throw new Error("cursor encoding must use the captured intrinsic");
        },
      });
      Object.defineProperty(globalThis, "decodeURIComponent", {
        configurable: true,
        value: () => {
          globalCodecInvocations += 1;
          throw new Error("cursor decoding must use the captured intrinsic");
        },
      });
      impossible = tiny.page(tinyPrepared, [1], { hasMore: true, nextAnchor: 1 });
      const isolatedPage = isolated.page(isolatedPrepared, [1], {
        hasMore: true,
        nextAnchor: { id: 1 },
      });
      if (!isolatedPage.ok || isolatedPage.value.nextCursor === undefined) {
        throw new Error("expected isolated cursor");
      }
      isolatedContinuation = isolated.prepare(
        1,
        { label: "isolated" },
        {
          cursor: isolatedPage.value.nextCursor,
          limit: 1,
        },
      );
    } finally {
      Object.defineProperty(globalThis, "encodeURIComponent", encodeDescriptor);
      Object.defineProperty(globalThis, "decodeURIComponent", decodeDescriptor);
    }
    expect(impossible).toMatchObject({
      diagnostics: [{ code: "continuation-cursor-too-large" }],
      ok: false,
    });
    expect(isolatedContinuation).toMatchObject({ ok: true, value: { after: { id: 1 } } });
    expect(globalCodecInvocations).toBe(0);

    const prefix = "groma.cursor.v1:";
    const roomy = createContracts({ maxCursorCharacters: 4_096 });
    const roomyPrepared = prepareFirst(roomy, 1, { label: "😀" }, 1);
    const roomyPage = roomy.page(roomyPrepared, [1], {
      hasMore: true,
      nextAnchor: { label: "😀" },
    });
    if (!roomyPage.ok || roomyPage.value.nextCursor === undefined) {
      throw new Error("expected Unicode cursor");
    }
    const encodedCursor = roomyPage.value.nextCursor;
    const rawCursorLength =
      prefix.length + decodeURIComponent(encodedCursor.slice(prefix.length)).length;
    expect(encodedCursor.length).toBeGreaterThan(rawCursorLength);

    const tight = createContracts({ maxCursorCharacters: rawCursorLength });
    const tightPage = tight.page(prepareFirst(tight, 1, { label: "😀" }, 1), [1], {
      hasMore: true,
      nextAnchor: { label: "😀" },
    });
    expect(tightPage).toMatchObject({
      diagnostics: [{ code: "continuation-cursor-too-large" }],
      ok: false,
    });
  });

  test("ignores inherited toJSON pollution while binding and continuing cursors", () => {
    const objectToJson = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    const arrayToJson = Object.getOwnPropertyDescriptor(Array.prototype, "toJSON");
    const charCodeAt = Object.getOwnPropertyDescriptor(String.prototype, "charCodeAt");
    const numberToString = Object.getOwnPropertyDescriptor(Number.prototype, "toString");
    let hookInvocations = 0;
    let firstCursor: ContinuationCursor | undefined;
    let secondCursor: ContinuationCursor | undefined;
    let continuedAfter: unknown;
    try {
      Object.defineProperty(Object.prototype, "toJSON", {
        configurable: true,
        value: () => {
          hookInvocations += 1;
          return { polluted: true };
        },
      });
      Object.defineProperty(Array.prototype, "toJSON", {
        configurable: true,
        value: () => {
          hookInvocations += 1;
          return ["polluted"];
        },
      });
      Object.defineProperty(String.prototype, "charCodeAt", {
        configurable: true,
        value: () => {
          hookInvocations += 1;
          throw new Error("canonical serializer must use the captured intrinsic");
        },
      });
      Object.defineProperty(Number.prototype, "toString", {
        configurable: true,
        value: () => {
          hookInvocations += 1;
          throw new Error("canonical serializer must use the captured intrinsic");
        },
      });

      const contracts = createContracts();
      const firstPrepared = prepareFirst(
        contracts,
        6,
        { order: ["id"], filters: { b: 2, a: 1 } },
        1,
      );
      const firstPage = contracts.page(firstPrepared, [{ id: entity("1") }], {
        hasMore: true,
        nextAnchor: { id: entity("1"), sort: ["id"] },
      });
      if (!firstPage.ok || firstPage.value.nextCursor === undefined) {
        throw new Error("expected first cursor");
      }
      firstCursor = firstPage.value.nextCursor;

      const secondPrepared = prepareFirst(
        contracts,
        6,
        { filters: { a: 1, b: 2 }, order: ["id"] },
        1,
      );
      const secondPage = contracts.page(secondPrepared, [{ id: entity("1") }], {
        hasMore: true,
        nextAnchor: { sort: ["id"], id: entity("1") },
      });
      if (!secondPage.ok || secondPage.value.nextCursor === undefined) {
        throw new Error("expected second cursor");
      }
      secondCursor = secondPage.value.nextCursor;

      const continued = contracts.prepare(
        6,
        { filters: { a: 1, b: 2 }, order: ["id"] },
        { cursor: firstCursor, limit: 1 },
      );
      if (!continued.ok) throw new Error("expected cursor continuation");
      continuedAfter = continued.value.after;
    } finally {
      if (objectToJson === undefined) delete (Object.prototype as { toJSON?: unknown }).toJSON;
      else Object.defineProperty(Object.prototype, "toJSON", objectToJson);
      if (arrayToJson === undefined) delete (Array.prototype as { toJSON?: unknown }).toJSON;
      else Object.defineProperty(Array.prototype, "toJSON", arrayToJson);
      if (charCodeAt !== undefined)
        Object.defineProperty(String.prototype, "charCodeAt", charCodeAt);
      if (numberToString !== undefined) {
        Object.defineProperty(Number.prototype, "toString", numberToString);
      }
    }

    expect(hookInvocations).toBe(0);
    expect(firstCursor).toBe(secondCursor);
    expect(continuedAfter).toEqual({ id: entity("1"), sort: ["id"] });
  });

  test("cursor branding remains an API boundary rather than trusted input", () => {
    const contracts = createContracts();
    const forged = "not-a-cursor" as ContinuationCursor;
    expect(contracts.prepare(1, {}, { cursor: forged, limit: 1 })).toMatchObject({
      diagnostics: [{ code: "malformed-continuation-cursor" }],
      ok: false,
    });
  });

  test("isolates cursor decoding from mutable String prototype methods", () => {
    const contracts = createContracts();
    const query = { order: "id" };
    const firstPage = contracts.page(prepareFirst(contracts, 4, query, 1), [entity("1")], {
      hasMore: true,
      nextAnchor: entity("1"),
    });
    if (!firstPage.ok || firstPage.value.nextCursor === undefined) {
      throw new Error("expected emitted cursor");
    }
    const startsWith = Object.getOwnPropertyDescriptor(String.prototype, "startsWith");
    const slice = Object.getOwnPropertyDescriptor(String.prototype, "slice");
    if (startsWith === undefined || slice === undefined) {
      throw new Error("expected intrinsic String methods");
    }
    let pollutedCalls = 0;
    let thrown: unknown;
    let valid: ReturnType<BoundedQueryContracts["prepare"]> | undefined;
    let malformedEnvelope: ReturnType<BoundedQueryContracts["prepare"]> | undefined;
    let malformedEncoding: ReturnType<BoundedQueryContracts["prepare"]> | undefined;
    const polluted = () => {
      pollutedCalls += 1;
      throw new Error("cursor decoding must use captured String intrinsics");
    };
    try {
      Object.defineProperty(String.prototype, "startsWith", {
        configurable: true,
        value: polluted,
      });
      Object.defineProperty(String.prototype, "slice", {
        configurable: true,
        value: polluted,
      });
      try {
        valid = contracts.prepare(4, query, { cursor: firstPage.value.nextCursor, limit: 1 });
        malformedEnvelope = contracts.prepare(4, query, { cursor: "not-a-cursor", limit: 1 });
        malformedEncoding = contracts.prepare(4, query, {
          cursor: "groma.cursor.v1:%",
          limit: 1,
        });
      } catch (error) {
        thrown = error;
      }
    } finally {
      Object.defineProperty(String.prototype, "startsWith", startsWith);
      Object.defineProperty(String.prototype, "slice", slice);
    }

    expect(thrown).toBeUndefined();
    expect(pollutedCalls).toBe(0);
    expect(valid).toMatchObject({ ok: true });
    expect(malformedEnvelope).toMatchObject({
      diagnostics: [{ code: "malformed-continuation-cursor" }],
      ok: false,
    });
    expect(malformedEncoding).toMatchObject({
      diagnostics: [{ code: "malformed-continuation-cursor" }],
      ok: false,
    });
  });

  test("rejects a non-advancing continuation anchor after canonical comparison", () => {
    const contracts = createContracts();
    const firstPrepared = prepareFirst(contracts, 9, { order: "id" }, 1);
    const firstPage = contracts.page(firstPrepared, [entity("1")], {
      hasMore: true,
      nextAnchor: { id: entity("1"), order: ["id", "ascending"] },
    });
    if (!firstPage.ok || firstPage.value.nextCursor === undefined) {
      throw new Error("expected first cursor");
    }
    const continued = contracts.prepare(
      9,
      { order: "id" },
      {
        cursor: firstPage.value.nextCursor,
        limit: 1,
      },
    );
    if (!continued.ok) throw new Error("expected prepared continuation");

    expect(
      contracts.page(continued.value, [entity("2")], {
        hasMore: true,
        nextAnchor: { order: ["id", "ascending"], id: entity("1") },
      }),
    ).toMatchObject({
      diagnostics: [{ code: "non-advancing-continuation-anchor" }],
      ok: false,
    });
    expect(
      contracts.page(continued.value, [entity("2")], {
        hasMore: true,
        nextAnchor: { order: ["id", "ascending"], id: entity("2") },
      }),
    ).toMatchObject({ ok: true, value: { hasMore: true } });
  });
});

describe("committed graph event contracts", () => {
  test("sorts and deduplicates validated affected identities deterministically", () => {
    const event = createGraphCommittedEvent(9, {
      entities: [entity("3"), entity("1"), entity("3"), entity("2")],
      relations: [relation("2"), relation("1"), relation("2")],
    });
    expect(event).toMatchObject({
      ok: true,
      value: {
        affected: {
          entities: [entity("1"), entity("2"), entity("3")],
          relations: [relation("1"), relation("2")],
        },
        generation: 9,
        type: "graph.committed",
      },
    });
  });

  test("orders and sequences events without mutable Array prototype methods", () => {
    const sort = Object.getOwnPropertyDescriptor(Array.prototype, "sort");
    const some = Object.getOwnPropertyDescriptor(Array.prototype, "some");
    const includes = Object.getOwnPropertyDescriptor(Array.prototype, "includes");
    if (sort === undefined || some === undefined || includes === undefined) {
      throw new Error("expected intrinsic Array methods");
    }
    let pollutedCalls = 0;
    let created: ReturnType<typeof createGraphCommittedEvent> | undefined;
    let sequenced: ReturnType<typeof sequenceGraphCommittedEvent> | undefined;
    const polluted = () => {
      pollutedCalls += 1;
      throw new Error("event contracts must not call mutable Array methods");
    };
    try {
      Object.defineProperty(Array.prototype, "sort", { configurable: true, value: polluted });
      Object.defineProperty(Array.prototype, "some", { configurable: true, value: polluted });
      Object.defineProperty(Array.prototype, "includes", { configurable: true, value: polluted });
      created = createGraphCommittedEvent(2, {
        entities: [entity("3"), entity("1"), entity("2"), entity("1")],
        relations: [relation("2"), relation("1")],
      });
      if (created.ok) sequenced = sequenceGraphCommittedEvent(1, created.value);
    } finally {
      Object.defineProperty(Array.prototype, "sort", sort);
      Object.defineProperty(Array.prototype, "some", some);
      Object.defineProperty(Array.prototype, "includes", includes);
    }

    expect(pollutedCalls).toBe(0);
    expect(created).toMatchObject({
      ok: true,
      value: {
        affected: {
          entities: [entity("1"), entity("2"), entity("3")],
          relations: [relation("1"), relation("2")],
        },
      },
    });
    expect(sequenced).toMatchObject({ ok: true, value: { generation: 2, status: "accepted" } });
  });

  test("rejects invalid affected identities and generations", () => {
    expect(createGraphCommittedEvent(-1, {})).toMatchObject({
      diagnostics: [{ code: "invalid-graph-generation" }],
      ok: false,
    });
    expect(createGraphCommittedEvent(1, { entities: ["component-name"] })).toMatchObject({
      diagnostics: [{ code: "invalid-entity-id" }],
      ok: false,
    });
    expect(createGraphCommittedEvent(1, { relations: ["relationship-name"] })).toMatchObject({
      diagnostics: [{ code: "invalid-relation-id" }],
      ok: false,
    });
    expect(() => createGraphCommittedEvent(1, null)).not.toThrow();
    expect(createGraphCommittedEvent(1, null)).toMatchObject({
      diagnostics: [{ code: "invalid-affected-identities" }],
      ok: false,
    });
    expect(createGraphCommittedEvent(1, { entities: [Symbol("id")] })).toMatchObject({
      diagnostics: [{ code: "invalid-affected-identities" }],
      ok: false,
    });
    expect(
      createGraphCommittedEvent(1, {
        entities: [{ toString: () => entity("1") }],
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-affected-identities" }], ok: false });
    expect(createGraphCommittedEvent(1, { entities: [], provider: "sqlite" })).toMatchObject({
      diagnostics: [{ code: "invalid-affected-identities" }],
      ok: false,
    });
  });

  test("accepts only the next contiguous generation", () => {
    const event = createGraphCommittedEvent(5, { entities: [entity("1")] });
    if (!event.ok) throw new Error(event.diagnostics[0]?.message);
    expect(sequenceGraphCommittedEvent(4, event.value)).toMatchObject({
      ok: true,
      value: { generation: 5, status: "accepted" },
    });
  });

  test("requires refetch after missed, duplicate, or reversed events", () => {
    const eventAt = (generation: number): GraphCommittedEvent => {
      const result = createGraphCommittedEvent(generation, { entities: [entity("1")] });
      if (!result.ok) throw new Error(result.diagnostics[0]?.message);
      return result.value;
    };

    expect(sequenceGraphCommittedEvent(4, eventAt(7))).toMatchObject({
      ok: true,
      value: {
        action: "refetch",
        currentGeneration: 4,
        expectedGeneration: 5,
        reason: "missed",
        receivedGeneration: 7,
        status: "refetch-required",
      },
    });
    expect(sequenceGraphCommittedEvent(4, eventAt(4))).toMatchObject({
      ok: true,
      value: { action: "refetch", reason: "duplicate", status: "refetch-required" },
    });
    expect(sequenceGraphCommittedEvent(4, eventAt(3))).toMatchObject({
      ok: true,
      value: { action: "refetch", reason: "reversed", status: "refetch-required" },
    });
  });

  test("revalidates event shape and affected identities before sequencing", () => {
    expect(() => sequenceGraphCommittedEvent(1, null)).not.toThrow();
    expect(sequenceGraphCommittedEvent(1, null)).toMatchObject({
      diagnostics: [{ code: "invalid-graph-event" }],
      ok: false,
    });
    expect(
      sequenceGraphCommittedEvent(1, { generation: 2, type: "graph.committed" }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-graph-event" }], ok: false });
    expect(
      sequenceGraphCommittedEvent(1, {
        affected: { entities: [], relations: [] },
        generation: 2,
        provider: "sqlite",
        type: "graph.committed",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-graph-event" }], ok: false });
    expect(
      sequenceGraphCommittedEvent(1, {
        affected: { entities: [] },
        generation: 2,
        type: "graph.committed",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-graph-event" }], ok: false });
    expect(
      sequenceGraphCommittedEvent(1, {
        affected: { entities: [Symbol("id")], relations: [] },
        generation: 2,
        type: "graph.committed",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-graph-event" }], ok: false });
    expect(
      sequenceGraphCommittedEvent(1, {
        affected: { entities: [entity("2"), entity("1")], relations: [] },
        generation: 2,
        type: "graph.committed",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-graph-event" }], ok: false });
    expect(
      sequenceGraphCommittedEvent(1, {
        affected: { entities: [entity("1"), entity("1")], relations: [] },
        generation: 2,
        type: "graph.committed",
      }),
    ).toMatchObject({ diagnostics: [{ code: "invalid-graph-event" }], ok: false });
  });

  test("classifies a duplicate at the largest generation without guessing", () => {
    const current = parseGraphGeneration(Number.MAX_SAFE_INTEGER);
    const received = createGraphCommittedEvent(Number.MAX_SAFE_INTEGER, {});
    if (!current.ok || !received.ok) throw new Error("expected valid maximum generation");
    expect(sequenceGraphCommittedEvent(current.value, received.value)).toMatchObject({
      ok: true,
      value: {
        action: "refetch",
        currentGeneration: Number.MAX_SAFE_INTEGER,
        reason: "duplicate",
        receivedGeneration: Number.MAX_SAFE_INTEGER,
        status: "refetch-required",
      },
    });
  });
});
