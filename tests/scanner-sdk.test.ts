import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  createScannerRequest,
  observationSessionApiVersion,
  scannerApiVersion,
  scannerCapability,
  scannerCapabilityId,
  scannerCapabilityVersion,
  type ObservationBatch,
  type ObservationCompletion,
  type ObservationFailure,
  type ObservationHeartbeat,
  type Result,
  type ScannerObservationSink,
  type ScannerProjectResources,
  type ScannerRequest,
} from "groma/plugin-sdk";
import { createObservationSession, type ObservationSession } from "../src/core/index.ts";

import { conformingScanner } from "./fixtures/conforming-scanner.ts";

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  return result.value;
}

function session(): ObservationSession {
  return valueOf(
    createObservationSession({
      apiVersion: observationSessionApiVersion,
      epoch: "epoch-001",
      projectId: "project.local",
      scopes: [{ id: "app", resourceRoot: "src" }],
      source: { id: "example.typescript", instance: "workspace", version: "1.2.3" },
    }),
  );
}

function sinkFor(observed: ObservationSession): ScannerObservationSink {
  return {
    complete(completion: ObservationCompletion) {
      const completed = observed.complete(completion);
      return completed.ok ? { ok: true, value: undefined } : completed;
    },
    fail(report: ObservationFailure) {
      return observed.fail(report);
    },
    heartbeat(heartbeat: ObservationHeartbeat) {
      return observed.heartbeat(heartbeat);
    },
    submitBatch(batch: ObservationBatch) {
      return observed.submitBatch(batch);
    },
  };
}

function requestWith(
  resources: ScannerProjectResources,
  overrides: Partial<ScannerRequest> = {},
  observed = session(),
): { readonly observed: ObservationSession; readonly request: ScannerRequest } {
  const request = valueOf(
    createScannerRequest({
      apiVersion: scannerApiVersion,
      cancellation: { isCancellationRequested: () => false },
      configuration: { extensions: [".ts"], parser: { mode: "strict" } },
      observations: sinkFor(observed),
      resources,
      session: {
        apiVersion: observationSessionApiVersion,
        epoch: "epoch-001",
        projectId: "project.local",
        scopes: [{ id: "app", resourceRoot: "src" }],
        source: { id: "example.typescript", instance: "workspace", version: "1.2.3" },
      },
      ...overrides,
    }),
  );
  return { observed, request };
}

function resourcesWith(overrides: Partial<ScannerProjectResources> = {}): ScannerProjectResources {
  return {
    enumerate: async (request) => ({
      ok: true,
      value: {
        entries: [
          { kind: "file", resource: `${request.resource}/a.ts`, scope: request.scope, size: 10 },
          { kind: "file", resource: `${request.resource}/b.ts`, scope: request.scope, size: 20 },
        ],
        truncatedByDepth: false,
      },
    }),
    read: async () => ({ ok: true, value: { bytes: new Uint8Array([1, 2, 3]) } }),
    ...overrides,
  };
}

function codes(result: Result<unknown>): readonly string[] {
  return result.ok ? [] : result.diagnostics.map((item) => item.code);
}

describe("scanner SDK", () => {
  test("publishes an exact multiple-provider scanner capability", () => {
    expect(scannerCapability).toEqual({
      cardinality: "multiple",
      id: scannerCapabilityId,
      version: scannerCapabilityVersion,
    });
    expect(Object.isFrozen(scannerCapability)).toBeTrue();
  });

  test("builds an exact frozen blind request with owned canonical configuration", () => {
    const configuration = { extensions: [".ts"], parser: { mode: "strict" } };
    const { request } = requestWith(resourcesWith(), { configuration });
    configuration.extensions[0] = ".js";
    configuration.parser.mode = "loose";

    expect(Object.keys(request).sort()).toEqual([
      "apiVersion",
      "cancellation",
      "configuration",
      "observations",
      "resources",
      "session",
    ]);
    expect(request.configuration).toEqual({ extensions: [".ts"], parser: { mode: "strict" } });
    expect(Object.isFrozen(request)).toBeTrue();
    expect(Object.isFrozen(request.configuration)).toBeTrue();
    expect(Object.isFrozen((request.configuration as { parser: object }).parser)).toBeTrue();
    expect(Object.isFrozen(request.session)).toBeTrue();
    expect(Object.isFrozen(request.session.scopes)).toBeTrue();

    for (const forbidden of [
      "aliases",
      "bindings",
      "blueprint",
      "entities",
      "intent",
      "reconciliation",
      "snapshot",
    ]) {
      expect(forbidden in request).toBeFalse();
      expect(forbidden in request.observations).toBeFalse();
      expect(forbidden in request.resources).toBeFalse();
    }
    expect(Object.keys(request.observations).sort()).toEqual([
      "complete",
      "fail",
      "heartbeat",
      "submitBatch",
    ]);
    expect(Object.keys(request.resources).sort()).toEqual(["enumerate", "read"]);
  });

  test("bounds configuration characters and rejects incompatible scope/resource ceilings", () => {
    const base = requestWith(resourcesWith()).request;
    expect(
      codes(
        createScannerRequest(
          { ...base, configuration: { text: "x".repeat(128) } },
          { maxConfigurationCharacters: 32 },
        ),
      ),
    ).toContain("invalid-scanner-request");
    expect(codes(createScannerRequest(base, { maxResourceCharacters: 2 }))).toEqual([
      "invalid-scanner-request",
    ]);
  });

  test("runs a third-party-shaped scanner using only the public SDK", async () => {
    const source = await readFile(
      new URL("./fixtures/conforming-scanner.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('from "groma/plugin-sdk"');
    expect(source).not.toContain("/src/");

    const harness = requestWith(resourcesWith());
    expect(await conformingScanner.scan(harness.request)).toEqual({ ok: true, value: undefined });
    expect(harness.observed.inspect()).toMatchObject({ recordCount: 1, state: "completed" });
  });

  test("rejects unbounded, escaped, and undeclared resource requests before provider invocation", async () => {
    let calls = 0;
    const harness = requestWith(
      resourcesWith({
        enumerate: async () => {
          calls += 1;
          return { ok: true, value: { entries: [], truncatedByDepth: false } };
        },
        read: async () => {
          calls += 1;
          return { ok: true, value: { bytes: new Uint8Array() } };
        },
      }),
    );

    const reads = [
      harness.request.resources.read({
        maxBytes: Number.MAX_SAFE_INTEGER,
        resource: "src/a",
        scope: "app",
      }),
      harness.request.resources.read({ maxBytes: 1, resource: "groma/intent.md", scope: "app" }),
      harness.request.resources.read({ maxBytes: 1, resource: "src/a", scope: "other" }),
    ];
    const pages = [
      harness.request.resources.enumerate({
        limit: 100_001,
        maxDepth: 1,
        resource: "src",
        scope: "app",
      }),
      harness.request.resources.enumerate({
        limit: 1,
        maxDepth: 257,
        resource: "src",
        scope: "app",
      }),
      harness.request.resources.enumerate({
        cursor: "bad\u0000cursor",
        limit: 1,
        maxDepth: 1,
        resource: "src",
        scope: "app",
      }),
    ];
    for (const result of await Promise.all([...reads, ...pages])) {
      expect(codes(result)).toEqual(["invalid-scanner-resource-request"]);
    }
    expect(calls).toBe(0);
  });

  test("returns owned bounded bytes and frozen deterministic scoped pages", async () => {
    const backing = new Uint8Array([1, 2, 3]);
    const harness = requestWith(
      resourcesWith({ read: async () => ({ ok: true, value: { bytes: backing } }) }),
    );
    const read = valueOf(
      await harness.request.resources.read({ maxBytes: 3, resource: "src/index.ts", scope: "app" }),
    );
    backing[0] = 9;
    expect([...read.bytes]).toEqual([1, 2, 3]);
    expect(read.bytes).not.toBe(backing);
    expect(Object.isFrozen(read)).toBeTrue();

    const page = valueOf(
      await harness.request.resources.enumerate({
        limit: 2,
        maxDepth: 1,
        resource: "src",
        scope: "app",
      }),
    );
    expect(page.entries).toEqual([
      { kind: "file", resource: "src/a.ts", scope: "app", size: 10 },
      { kind: "file", resource: "src/b.ts", scope: "app", size: 20 },
    ]);
    expect(Object.isFrozen(page)).toBeTrue();
    expect(Object.isFrozen(page.entries)).toBeTrue();
    expect(Object.isFrozen(page.entries[0])).toBeTrue();

    const pageBounded = valueOf(createScannerRequest(harness.request, { maxPageCharacters: 32 }));
    expect(
      codes(
        await pageBounded.resources.enumerate({
          limit: 2,
          maxDepth: 1,
          resource: "src",
          scope: "app",
        }),
      ),
    ).toEqual(["scanner-resource-provider-failed"]);
  });

  test("charges fixed and cursor overhead against the resource page character bound", async () => {
    const emptyPage = requestWith(
      resourcesWith({
        enumerate: async () => ({
          ok: true,
          value: { entries: [], truncatedByDepth: false },
        }),
      }),
    ).request;
    const request = {
      limit: 1,
      maxDepth: 0,
      resource: "src",
      scope: "app",
    } as const;

    const exact = valueOf(createScannerRequest(emptyPage, { maxPageCharacters: 32 }));
    expect(valueOf(await exact.resources.enumerate(request))).toEqual({
      entries: [],
      truncatedByDepth: false,
    });

    const below = valueOf(createScannerRequest(emptyPage, { maxPageCharacters: 31 }));
    expect(codes(await below.resources.enumerate(request))).toEqual([
      "scanner-resource-provider-failed",
    ]);

    const emptyPageWithCursor = requestWith(
      resourcesWith({
        enumerate: async () => ({
          ok: true,
          value: { entries: [], nextCursor: "x", truncatedByDepth: false },
        }),
      }),
    ).request;
    const cursorBelow = valueOf(
      createScannerRequest(emptyPageWithCursor, { maxPageCharacters: 37 }),
    );
    expect(codes(await cursorBelow.resources.enumerate(request))).toEqual([
      "scanner-resource-provider-failed",
    ]);
  });

  test("enforces returned entry depth as directory descent below the requested resource", async () => {
    const enumerate = async (
      maxDepth: number,
      entries: readonly {
        readonly kind: "directory" | "file";
        readonly resource: string;
        readonly scope: "app";
      }[],
    ) => {
      const harness = requestWith(
        resourcesWith({
          enumerate: async () => ({
            ok: true,
            value: { entries, truncatedByDepth: false },
          }),
        }),
      );
      return harness.request.resources.enumerate({
        limit: Math.max(1, entries.length),
        maxDepth,
        resource: "src",
        scope: "app",
      });
    };

    expect(
      valueOf(
        await enumerate(0, [
          { kind: "directory", resource: "src/dir", scope: "app" },
          { kind: "file", resource: "src/file.ts", scope: "app" },
        ]),
      ).entries,
    ).toEqual([
      { kind: "directory", resource: "src/dir", scope: "app" },
      { kind: "file", resource: "src/file.ts", scope: "app" },
    ]);
    expect(
      codes(await enumerate(0, [{ kind: "file", resource: "src/dir/nested.ts", scope: "app" }])),
    ).toEqual(["scanner-resource-provider-failed"]);
    expect(
      valueOf(await enumerate(1, [{ kind: "file", resource: "src/dir/nested.ts", scope: "app" }]))
        .entries,
    ).toEqual([{ kind: "file", resource: "src/dir/nested.ts", scope: "app" }]);
    expect(
      codes(
        await enumerate(1, [{ kind: "file", resource: "src/dir/deeper/nested.ts", scope: "app" }]),
      ),
    ).toEqual(["scanner-resource-provider-failed"]);
  });

  test("contains malformed, oversized, thrown, rejected, and non-native resource providers", async () => {
    const cases: ScannerProjectResources["read"][] = [
      async () => ({ ok: true, value: { bytes: new Uint8Array(5) } }),
      async () => ({ ok: true, value: { bytes: "not-bytes" as never } }),
      (() => {
        throw new Error("private throw");
      }) as ScannerProjectResources["read"],
      () => Promise.reject(new Error("private rejection")),
      (() => ({ ok: true, value: { bytes: new Uint8Array() } })) as never,
      (async () => ({
        diagnostics: [],
        ok: true,
        value: { bytes: new Uint8Array() },
      })) as never,
    ];
    for (const readProvider of cases) {
      const harness = requestWith(resourcesWith({ read: readProvider }));
      const result = await harness.request.resources.read({
        maxBytes: 4,
        resource: "src/index.ts",
        scope: "app",
      });
      expect(codes(result)).toEqual(["scanner-resource-provider-failed"]);
    }

    const actionable = requestWith(
      resourcesWith({
        read: async () => ({
          diagnostics: [
            {
              code: "resource-missing",
              details: { index: 2, privateContext: "discarded", scope: "app" },
              message: "Resource is missing",
            },
          ],
          ok: false,
        }),
      }),
    );
    expect(
      await actionable.request.resources.read({
        maxBytes: 4,
        resource: "src/index.ts",
        scope: "app",
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "resource-missing",
          details: { index: 2, scope: "app" },
          message: "Resource is missing",
        },
      ],
      ok: false,
    });
  });

  test("rejects malformed, unsorted, duplicated, escaped, oversized, and stalled pages", async () => {
    const invalidPages = [
      {
        entries: [
          { kind: "file", resource: "src/b", scope: "app" },
          { kind: "file", resource: "src/a", scope: "app" },
        ],
        truncatedByDepth: false,
      },
      {
        entries: [
          { kind: "file", resource: "src/a", scope: "app" },
          { kind: "link", resource: "src/a", scope: "app" },
        ],
        truncatedByDepth: false,
      },
      {
        entries: [{ kind: "file", resource: "groma/intent.md", scope: "app" }],
        truncatedByDepth: false,
      },
      { entries: [{ kind: "file", resource: "src/a", scope: "other" }], truncatedByDepth: false },
      {
        entries: [
          { kind: "file", resource: "src/a", scope: "app" },
          { kind: "file", resource: "src/b", scope: "app" },
        ],
        truncatedByDepth: false,
      },
      { entries: [], nextCursor: "same", truncatedByDepth: false },
    ];
    for (const [index, page] of invalidPages.entries()) {
      const harness = requestWith(
        resourcesWith({ enumerate: async () => ({ ok: true, value: page as never }) }),
      );
      const result = await harness.request.resources.enumerate({
        ...(index === invalidPages.length - 1 ? { cursor: "same" } : {}),
        limit: index === 4 ? 1 : 2,
        maxDepth: 1,
        resource: "src",
        scope: "app",
      });
      expect(codes(result)).toEqual(["scanner-resource-provider-failed"]);
    }
  });

  test("fails cancellation closed and contains malformed observation sinks", async () => {
    for (const callback of [
      () => undefined as never,
      () => {
        throw new Error("private cancellation failure");
      },
    ]) {
      const { request } = requestWith(resourcesWith(), {
        cancellation: { isCancellationRequested: callback },
      });
      expect(request.cancellation.isCancellationRequested()).toBeTrue();
    }

    const malformed = requestWith(resourcesWith(), {
      observations: {
        ...sinkFor(session()),
        submitBatch: () => ({
          ok: true,
          value: { acceptedRecords: 99, replayedRecords: 0, sequence: 9, totalRecords: 99 },
        }),
      },
    }).request;
    const batch: ObservationBatch = { epoch: "epoch-001", records: [], sequence: 1 };
    expect(codes(malformed.observations.submitBatch(batch))).toEqual([
      "scanner-observation-sink-failed",
    ]);

    const hostileHarness = requestWith(resourcesWith());
    const hostileBatch = new Proxy(
      { epoch: "epoch-001", records: [], sequence: 1 } satisfies ObservationBatch,
      {
        get: () => {
          throw new Error("receipt validation must not read scanner properties after acceptance");
        },
        ownKeys: () => {
          throw new Error("receipt validation must not enumerate scanner properties");
        },
      },
    );
    let hostileResult: Result<unknown> | undefined;
    expect(() => {
      hostileResult = hostileHarness.request.observations.submitBatch(hostileBatch);
    }).not.toThrow();
    expect(hostileResult).toEqual({
      ok: true,
      value: { acceptedRecords: 0, replayedRecords: 0, sequence: 1, totalRecords: 0 },
    });
    expect(hostileHarness.observed.inspect()).toMatchObject({ batchCount: 1, state: "active" });

    const throwing = requestWith(resourcesWith(), {
      observations: {
        ...sinkFor(session()),
        heartbeat: () => {
          throw new Error("private sink failure");
        },
      },
    }).request;
    expect(codes(throwing.observations.heartbeat({ epoch: "epoch-001", sequence: 1 }))).toEqual([
      "scanner-observation-sink-failed",
    ]);

    const base = requestWith(resourcesWith()).request;
    const mixed = requestWith(resourcesWith(), {
      observations: {
        ...sinkFor(session()),
        heartbeat: () =>
          ({
            diagnostics: [],
            ok: true,
            value: undefined,
          }) as never,
      },
    }).request;
    expect(codes(mixed.observations.heartbeat({ epoch: "epoch-001", sequence: 1 }))).toEqual([
      "scanner-observation-sink-failed",
    ]);

    let gatedCalls = 0;
    const cancelled = requestWith(
      resourcesWith({
        read: async () => {
          gatedCalls += 1;
          return { ok: true, value: { bytes: new Uint8Array() } };
        },
      }),
      { cancellation: { isCancellationRequested: () => true } },
    ).request;
    expect(
      codes(
        await cancelled.resources.read({ maxBytes: 1, resource: "src/index.ts", scope: "app" }),
      ),
    ).toEqual(["scanner-request-cancelled"]);
    expect(codes(cancelled.observations.heartbeat({ epoch: "epoch-001", sequence: 1 }))).toEqual([
      "scanner-request-cancelled",
    ]);
    expect(gatedCalls).toBe(0);
    expect(base.cancellation.isCancellationRequested()).toBeFalse();
  });
});
