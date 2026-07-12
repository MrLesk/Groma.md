import { describe, expect, test } from "bun:test";

import {
  createGraphCommittedEvent,
  sequenceGraphCommittedEvent,
  type GraphCommittedEvent,
} from "../events.ts";
import { parseGraphGeneration } from "../generation.ts";
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
    expect(() => exact.value.item.nested.labels.push("result mutation")).toThrow();

    const pageDraft = { nested: { labels: ["page"] } };
    const page = contracts.page(prepareFirst(contracts, 1, {}, 1), [pageDraft], {
      hasMore: false,
    });
    if (!page.ok) throw new Error(page.diagnostics[0]?.message);
    pageDraft.nested.labels.push("caller mutation");
    expect(page.value.items).toEqual([{ nested: { labels: ["page"] } }]);
    expect(() => page.value.items[0]!.nested.labels.push("result mutation")).toThrow();

    expect(contracts.exact(1, { behavior: () => "unsafe" })).toMatchObject({
      diagnostics: [{ code: "unsupported-payload" }],
      ok: false,
    });
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
    ).toMatchObject({ diagnostics: [{ code: "unsupported-payload" }], ok: false });

    const extended = [1];
    Object.defineProperty(extended, "reportedLength", { enumerable: true, value: 0 });
    expect(contracts.page(prepared, extended, { hasMore: false })).toMatchObject({
      diagnostics: [{ code: "unsupported-payload" }],
      ok: false,
    });
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

    for (const cursor of [
      "",
      "%",
      "groma.cursor.v1:%",
      "groma.cursor.v1:null",
      `groma.cursor.v1:${encodeURIComponent("not json")}`,
      "x".repeat(2_049),
      42 as unknown as string,
    ]) {
      expect(() => contracts.prepare(7, query, { cursor, limit: 1 })).not.toThrow();
      expect(contracts.prepare(7, query, { cursor, limit: 1 })).toMatchObject({
        diagnostics: [{ code: "malformed-continuation-cursor" }],
        ok: false,
      });
    }

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

  test("cursor branding remains an API boundary rather than trusted input", () => {
    const contracts = createContracts();
    const forged = "not-a-cursor" as ContinuationCursor;
    expect(contracts.prepare(1, {}, { cursor: forged, limit: 1 })).toMatchObject({
      diagnostics: [{ code: "malformed-continuation-cursor" }],
      ok: false,
    });
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
