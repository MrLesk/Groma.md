import { describe, expect, test } from "bun:test";

import {
  pluginRuntimeApiVersion,
  success,
  type CompletedObservationSnapshot,
  type Result,
  type RunningPluginGraph,
} from "../../core/index.ts";
import {
  scannerCapabilityId,
  scannerCapabilityVersion,
  type Scanner,
  type ScannerProjectResources,
  type ScannerRequest,
} from "../../plugin-sdk/index.ts";
import { createScannerExecutionRuntime } from "../scanner-runtime.ts";

const scannerId = "official.test";
const project = Object.freeze({
  availability: "available" as const,
  coverage: Object.freeze([Object.freeze({ id: "source", resourceRoot: "." })]),
  id: "project_11111111111111111111111111111111",
  name: "Fixture",
  revision: `sha256:${"a".repeat(64)}`,
  scanners: Object.freeze([Object.freeze({ configuration: Object.freeze({}), id: scannerId })]),
  source: ".",
});
const resources: ScannerProjectResources = Object.freeze({
  enumerate: async () =>
    success(Object.freeze({ entries: Object.freeze([]), truncatedByDepth: false })),
  read: async () => success(Object.freeze({ bytes: new Uint8Array() })),
});

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.code).join(","));
  return result.value;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function plugins(scanner: Scanner): RunningPluginGraph {
  return Object.freeze({
    cancel: async () =>
      success(Object.freeze({ state: "cancelled" as const, stoppedPluginIds: Object.freeze([]) })),
    capabilities: (id: string, version: string) =>
      id === scannerCapabilityId && version === scannerCapabilityVersion
        ? Object.freeze([Object.freeze({ pluginId: scannerId, value: scanner })])
        : Object.freeze([]),
    inspect: () =>
      Object.freeze({
        apiVersion: pluginRuntimeApiVersion,
        plugins: Object.freeze([
          Object.freeze({
            dependencies: Object.freeze([]),
            id: scannerId,
            phase: 1 as const,
            provides: Object.freeze([
              Object.freeze({
                cardinality: "multiple" as const,
                id: scannerCapabilityId,
                version: scannerCapabilityVersion,
              }),
            ]),
            requires: Object.freeze([]),
            state: "running" as const,
            version: "1.0.0",
          }),
        ]),
        state: "running" as const,
      }),
    shutdown: async () =>
      success(Object.freeze({ state: "stopped" as const, stoppedPluginIds: Object.freeze([]) })),
  });
}

function runtime(
  scanner: Scanner,
  overrides: Partial<Parameters<typeof createScannerExecutionRuntime>[0]> = {},
) {
  return createScannerExecutionRuntime({
    consumer: Object.freeze({ consume: async () => success(undefined) }),
    entropy: () => new Uint8Array(16),
    plugins: plugins(scanner),
    projectResources: async () => success(resources),
    projects: Object.freeze({ get: async () => success(project) }),
    ...overrides,
  });
}

describe("scanner execution runtime", () => {
  test("reserves a project and scanner before asynchronous resource setup", async () => {
    const setupStarted = deferred<void>();
    const setup = deferred<Result<ScannerProjectResources>>();
    const scanner: Scanner = Object.freeze({
      scan: async (): Promise<Result<void>> => new Promise<Result<void>>(() => {}),
    });
    const execution = runtime(scanner, {
      projectResources: async () => {
        setupStarted.resolve();
        return setup.promise;
      },
    });

    const first = execution.start({ projectId: project.id, scannerId });
    await setupStarted.promise;
    expect(await execution.start({ projectId: project.id, scannerId })).toMatchObject({
      diagnostics: [{ code: "scanner-session-conflict" }],
      ok: false,
    });
    setup.resolve(success(resources));
    const session = valueOf(await first);
    session.cancel();
    expect(await session.completion).toMatchObject({ status: "cancelled" });
  });

  test("does not invoke a scanner for an already cancelled request", async () => {
    let calls = 0;
    const scanner: Scanner = Object.freeze({
      scan: async () => {
        calls += 1;
        return success(undefined);
      },
    });
    const controller = new AbortController();
    controller.abort();
    expect(
      await runtime(scanner).start({
        cancellation: controller.signal,
        projectId: project.id,
        scannerId,
      }),
    ).toMatchObject({ diagnostics: [{ code: "scanner-execution-cancelled" }], ok: false });
    expect(calls).toBe(0);
  });

  test("cancels completed-snapshot consumption without publishing it", async () => {
    const consuming = deferred<void>();
    let published = false;
    const scanner: Scanner = Object.freeze({
      scan: async (request: ScannerRequest) => {
        expect(
          request.observations.complete({
            coverage: Object.freeze([
              Object.freeze({
                kinds: Object.freeze(["component-candidate" as const]),
                scope: "source",
                state: "complete" as const,
              }),
            ]),
            epoch: request.session.epoch,
            sequence: 1,
          }),
        ).toMatchObject({ ok: true });
        return success(undefined);
      },
    });
    const execution = runtime(scanner, {
      consumer: Object.freeze({
        consume: async (_snapshot: CompletedObservationSnapshot, cancellation: AbortSignal) => {
          consuming.resolve();
          await new Promise<void>((resolve) =>
            cancellation.addEventListener("abort", () => resolve(), { once: true }),
          );
          if (!cancellation.aborted) published = true;
          return success(undefined);
        },
      }),
    });
    const session = valueOf(await execution.start({ projectId: project.id, scannerId }));
    await consuming.promise;
    session.cancel();
    expect(await session.completion).toMatchObject({ status: "cancelled" });
    expect(published).toBeFalse();
  });
});
