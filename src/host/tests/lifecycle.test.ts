import { describe, expect, test } from "bun:test";

import { failure, success, type Result } from "../../core/index.ts";
import {
  runHost,
  type HostBootstrapRegistry,
  type HostComposition,
  type HostSignal,
  type HostSignalSource,
  type HostSurface,
  type HostSurfaceSession,
  type WorkspaceAccessCapability,
  type WorkspaceStatus,
} from "../index.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function signals() {
  let listener: ((signal: HostSignal) => void) | undefined;
  let unsubscribes = 0;
  const source: HostSignalSource = {
    subscribe: (next) => {
      listener = next;
      return () => {
        unsubscribes += 1;
        listener = undefined;
      };
    },
  };
  return {
    emit: (signal: HostSignal) => listener?.(signal),
    source,
    unsubscribes: () => unsubscribes,
  };
}

function workspace(
  status: WorkspaceStatus,
  recover: () => Promise<Result<{ generation: number; status: "completed" }>> = async () =>
    success({ generation: 0, status: "completed" }),
): WorkspaceAccessCapability {
  return {
    initialize: async () => ({ generation: 0 as never, status: "already-initialized" }),
    recover,
    requireWorkspace: () => failure({ code: "unused", message: "unused" }),
    status: () => status,
  };
}

function composition(
  surface: HostSurface,
  workspaceAccess: WorkspaceAccessCapability,
): HostComposition {
  const capability = Object.freeze({});
  return Object.freeze({
    graph: capability,
    invariant: capability,
    model: capability,
    operations: capability,
    queries: capability,
    resourceMapper: capability,
    resources: capability,
    snapshotStateDecoder: capability,
    store: capability,
    surface,
    transactionEngine: capability,
    transactionProvider: capability,
    workspace: workspaceAccess,
  }) as HostComposition;
}

function registry(value: HostComposition): HostBootstrapRegistry {
  return { compose: async () => success(value) };
}

describe("host lifecycle", () => {
  test("starts without a workspace and cleans a normally completed session exactly once", async () => {
    const completion = deferred<void>();
    const started = deferred<void>();
    const signal = signals();
    let stops = 0;
    let contextRecovery: string | undefined;
    const surface: HostSurface = {
      start: (context) => {
        contextRecovery = context.recovery.status;
        started.resolve();
        return {
          completion: completion.promise,
          stop: async () => {
            stops += 1;
          },
        };
      },
    };
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(composition(surface, workspace({ state: "missing" }))),
      signalSource: signal.source,
    });
    await started.promise;
    completion.resolve();

    expect(await running).toEqual({ status: "completed" });
    expect(contextRecovery).toBe("not-required");
    expect(stops).toBe(1);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("finishes recovery before semantic surface dispatch", async () => {
    const recovery = deferred<Result<{ generation: number; status: "completed" }>>();
    const recoveryEntered = deferred<void>();
    const started = deferred<void>();
    const completion = deferred<void>();
    const trace: string[] = [];
    const signal = signals();
    const access = workspace({ state: "configured" }, async () => {
      trace.push("recovery:start");
      recoveryEntered.resolve();
      const result = await recovery.promise;
      trace.push("recovery:complete");
      return result;
    });
    const surface: HostSurface = {
      start: (context) => {
        trace.push(`surface:${context.recovery.status}`);
        started.resolve();
        return { completion: completion.promise, stop: async () => {} };
      },
    };
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(composition(surface, access)),
      signalSource: signal.source,
    });
    await recoveryEntered.promise;
    expect(trace).toEqual(["recovery:start"]);
    recovery.resolve(success({ generation: 4, status: "completed" }));
    await started.promise;
    expect(trace).toEqual(["recovery:start", "recovery:complete", "surface:completed"]);
    completion.resolve();
    expect(await running).toEqual({ status: "completed" });
  });

  test("reports recovery failure without dispatching a surface", async () => {
    const signal = signals();
    let starts = 0;
    const access = workspace({ state: "configured" }, async () =>
      failure({ code: "workspace-recovery-failed", message: "failed" }),
    );
    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              starts += 1;
              throw new Error("must not start");
            },
          },
          access,
        ),
      ),
      signalSource: signal.source,
    });

    expect(outcome).toEqual({
      diagnostics: [{ code: "workspace-recovery-failed", message: "Workspace recovery failed" }],
      status: "startup-failure",
    });
    expect(starts).toBe(0);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("rejects malformed and hostile recovery success reports before dispatch", async () => {
    let getterCalls = 0;
    const accessorReport = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorReport, "generation", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 0;
      },
    });
    Object.defineProperty(accessorReport, "status", {
      enumerable: true,
      value: "completed",
    });
    const values: unknown[] = [
      { ok: true, value: null },
      { ok: true, value: accessorReport },
      { ok: true, value: new Proxy({ generation: 0, status: "completed" }, {}) },
      { ok: true, value: { extra: true, generation: 0, status: "completed" } },
      { ok: true, value: { generation: Number.NaN, status: "completed" } },
      new Proxy({ ok: true, value: { generation: 0, status: "completed" } }, {}),
    ];

    for (const value of values) {
      const signal = signals();
      let starts = 0;
      const outcome = await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: registry(
          composition(
            {
              start: () => {
                starts += 1;
                return { completion: Promise.resolve(), stop: async () => {} };
              },
            },
            workspace({ state: "configured" }, async () => value as never),
          ),
        ),
        signalSource: signal.source,
      });

      expect(outcome).toEqual({
        diagnostics: [
          {
            code: "invalid-host-recovery-result",
            message: "Workspace recovery capability returned a malformed result",
          },
        ],
        status: "startup-failure",
      });
      expect(starts).toBe(0);
      expect(signal.unsubscribes()).toBe(1);
    }
    expect(getterCalls).toBe(0);
  });

  test("a process signal stops active work once and awaits cleanup", async () => {
    const completion = deferred<void>();
    const started = deferred<void>();
    const stopEntered = deferred<void>();
    const cleanup = deferred<void>();
    const signal = signals();
    let stops = 0;
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              started.resolve();
              return {
                completion: completion.promise,
                stop: async () => {
                  stops += 1;
                  stopEntered.resolve();
                  completion.resolve();
                  await cleanup.promise;
                },
              };
            },
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });
    await started.promise;
    signal.emit("SIGTERM");
    signal.emit("SIGINT");
    await stopEntered.promise;
    expect(stops).toBe(1);
    cleanup.resolve();

    expect(await running).toEqual({ signal: "SIGTERM", status: "cancelled" });
    expect(stops).toBe(1);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("cancellation that wins during composition prevents surface dispatch", async () => {
    const composed = deferred<Result<HostComposition>>();
    const composeEntered = deferred<void>();
    const cancellation = new AbortController();
    const signal = signals();
    let starts = 0;
    const surface: HostSurface = {
      start: () => {
        starts += 1;
        return { completion: Promise.resolve(), stop: async () => {} };
      },
    };
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: {
        compose: async () => {
          composeEntered.resolve();
          return composed.promise;
        },
      },
      signalSource: signal.source,
    });
    await composeEntered.promise;
    cancellation.abort();
    composed.resolve(success(composition(surface, workspace({ state: "missing" }))));

    expect(await running).toEqual({ status: "cancelled" });
    expect(starts).toBe(0);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("cancellation during recovery prevents dispatch after recovery releases", async () => {
    const recovery = deferred<Result<{ generation: number; status: "completed" }>>();
    const entered = deferred<void>();
    const cancellation = new AbortController();
    const signal = signals();
    let starts = 0;
    const access = workspace({ state: "configured" }, async () => {
      entered.resolve();
      return recovery.promise;
    });
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              starts += 1;
              return { completion: Promise.resolve(), stop: async () => {} };
            },
          },
          access,
        ),
      ),
      signalSource: signal.source,
    });
    await entered.promise;
    cancellation.abort();
    recovery.resolve(success({ generation: 0, status: "completed" }));

    expect(await running).toEqual({ status: "cancelled" });
    expect(starts).toBe(0);
  });

  test("surface failure still stops and unsubscribes exactly once", async () => {
    const completion = deferred<void>();
    const started = deferred<void>();
    const signal = signals();
    let stops = 0;
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              started.resolve();
              return {
                completion: completion.promise,
                stop: async () => {
                  stops += 1;
                },
              };
            },
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });
    await started.promise;
    completion.reject(new Error("private failure"));

    expect(await running).toEqual({
      diagnostics: [{ code: "host-surface-failed", message: "Host surface session failed" }],
      status: "surface-failure",
    });
    expect(stops).toBe(1);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("rejects hostile bootstrap and surface capability outcomes", async () => {
    const firstSignals = signals();
    expect(
      await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: { compose: async () => null as never },
        signalSource: firstSignals.source,
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "host-bootstrap-failed",
          message: "Host bootstrap failed",
        },
      ],
      status: "startup-failure",
    });
    expect(firstSignals.unsubscribes()).toBe(1);

    const secondSignals = signals();
    expect(
      await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: registry(
          composition(
            {
              start: () => ({ completion: Promise.resolve(), stop: 1 }) as never,
            },
            workspace({ state: "missing" }),
          ),
        ),
        signalSource: secondSignals.source,
      }),
    ).toEqual({
      diagnostics: [
        {
          code: "host-surface-start-failed",
          message: "Host surface start failed",
        },
      ],
      status: "surface-failure",
    });
    expect(secondSignals.unsubscribes()).toBe(1);
  });

  test("cancellation raised while a surface starts stops the resulting session once", async () => {
    const cancellation = new AbortController();
    const signal = signals();
    let stops = 0;
    const outcome = await runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              cancellation.abort();
              return {
                completion: new Promise<void>(() => {}),
                stop: async () => {
                  stops += 1;
                },
              };
            },
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });

    expect(outcome).toEqual({ status: "cancelled" });
    expect(stops).toBe(1);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("does not call start when cancellation is already requested", async () => {
    const cancellation = new AbortController();
    cancellation.abort();
    const signal = signals();
    let starts = 0;
    const outcome = await runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              starts += 1;
              return { completion: Promise.resolve(), stop: async () => {} };
            },
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });

    expect(outcome).toEqual({ status: "cancelled" });
    expect(starts).toBe(0);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("passes cancellation to cooperative start and awaits its session cleanup", async () => {
    const cancellation = new AbortController();
    const signal = signals();
    const started = deferred<void>();
    const cleaned = deferred<void>();
    let stops = 0;
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: (context) => {
              started.resolve();
              return new Promise((resolve) => {
                context.cancellation.addEventListener(
                  "abort",
                  () =>
                    resolve({
                      completion: new Promise<void>(() => {}),
                      stop: async () => {
                        stops += 1;
                        cleaned.resolve();
                      },
                    }),
                  { once: true },
                );
              });
            },
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });
    await started.promise;
    cancellation.abort();

    expect(await running).toEqual({ status: "cancelled" });
    await cleaned.promise;
    expect(stops).toBe(1);
    expect(signal.unsubscribes()).toBe(1);
  });

  test("returns on permanently pending start and cleans a late session exactly once", async () => {
    const cancellation = new AbortController();
    const signal = signals();
    const started = deferred<void>();
    const late = deferred<HostSurfaceSession>();
    const stopEntered = deferred<void>();
    let stops = 0;
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              started.resolve();
              return late.promise as never;
            },
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });
    await started.promise;
    cancellation.abort();
    expect(await running).toEqual({ status: "cancelled" });
    expect(signal.unsubscribes()).toBe(1);

    late.resolve({
      completion: Promise.resolve(),
      stop: async () => {
        stops += 1;
        stopEntered.resolve();
      },
    });
    await stopEntered.promise;
    expect(stops).toBe(1);
  });

  test("contains rejecting and resolving completion from a late cancelled-start session", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const settlement of ["reject", "resolve"] as const) {
        const cancellation = new AbortController();
        const started = deferred<void>();
        const late = deferred<HostSurfaceSession>();
        const completion = deferred<void>();
        const stopEntered = deferred<void>();
        let stops = 0;
        const running = runHost({
          context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
          registry: registry(
            composition(
              {
                start: () => {
                  started.resolve();
                  return late.promise as never;
                },
              },
              workspace({ state: "missing" }),
            ),
          ),
          signalSource: signals().source,
        });
        await started.promise;
        cancellation.abort();
        expect(await running).toEqual({ status: "cancelled" });

        late.resolve({
          completion: completion.promise,
          stop: async () => {
            stops += 1;
            stopEntered.resolve();
          },
        });
        await stopEntered.promise;
        if (settlement === "reject") {
          completion.reject(new Error("late completion secret"));
        } else {
          completion.resolve();
        }
        await Promise.resolve();
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(stops, settlement).toBe(1);
      }
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("contains a late start rejection after cancellation", async () => {
    const cancellation = new AbortController();
    const signal = signals();
    const started = deferred<void>();
    const late = deferred<never>();
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              started.resolve();
              return late.promise;
            },
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });
    await started.promise;
    cancellation.abort();
    expect(await running).toEqual({ status: "cancelled" });
    late.reject(new Error("/Users/alex/private late-secret-token"));
    await Promise.resolve();
    expect(signal.unsubscribes()).toBe(1);
  });

  test("always invokes recover for a validated ready status", async () => {
    const signal = signals();
    let recoveries = 0;
    const access = workspace({ state: "ready" }, async () => {
      recoveries += 1;
      return success({ generation: 3, status: "completed" });
    });
    expect(
      await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: registry(
          composition(
            { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
            access,
          ),
        ),
        signalSource: signal.source,
      }),
    ).toEqual({ status: "completed" });
    expect(recoveries).toBe(1);
  });

  test("owns diagnostics and never retains hostile failure details", async () => {
    const secret = "/Users/alex/private secret-token";
    const source = { code: "source-secret", details: { token: secret }, message: secret };
    const signal = signals();
    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: { compose: async () => failure(source) },
      signalSource: signal.source,
    });
    const serialized = JSON.stringify(outcome);
    source.message = "mutated-after-return";
    source.details.token = "mutated-after-return";

    expect(outcome).toEqual({
      diagnostics: [{ code: "host-bootstrap-failed", message: "Host bootstrap failed" }],
      status: "startup-failure",
    });
    expect(JSON.stringify(outcome)).toBe(serialized);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("source-secret");
  });

  test("rejects non-exact compositions and statuses without invoking accessors", async () => {
    const signal = signals();
    let getterCalls = 0;
    let starts = 0;
    const surface: HostSurface = {
      start: () => {
        starts += 1;
        return { completion: Promise.resolve(), stop: async () => {} };
      },
    };
    const base = composition(surface, workspace({ state: "missing" }));
    const accessor = { ...base } as Record<string, unknown>;
    Object.defineProperty(accessor, "graph", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return {};
      },
    });
    const symbol = { ...base };
    Object.defineProperty(symbol, Symbol("secret"), { enumerable: true, value: true });
    const nestedProxy = { ...base, graph: new Proxy({}, {}) };
    for (const value of [
      new Proxy(base, {}),
      { ...base, extra: true },
      accessor,
      symbol,
      nestedProxy,
    ]) {
      const outcome = await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: { compose: async () => success(value as never) },
        signalSource: signal.source,
      });
      expect(outcome).toEqual({
        diagnostics: [
          {
            code: "invalid-host-composition",
            message: "Host bootstrap returned malformed capabilities",
          },
        ],
        status: "startup-failure",
      });
    }

    const statusAccessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(statusAccessor, "state", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "ready";
      },
    });
    for (const value of [
      new Proxy({ state: "ready" }, {}),
      { extra: true, state: "ready" },
      statusAccessor,
    ]) {
      const outcome = await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: registry(
          composition(
            surface,
            workspace(value as WorkspaceStatus, async () => {
              throw new Error("must not recover");
            }),
          ),
        ),
        signalSource: signal.source,
      });
      expect(outcome).toMatchObject({ status: "startup-failure" });
    }
    expect(getterCalls).toBe(0);
    expect(starts).toBe(0);
  });

  test("contains recovery, start, completion, and stop secrets in host-owned outcomes", async () => {
    const secret = "/Users/alex/private secret-token";
    const cases: Array<{
      expectedCode: string;
      registry: HostBootstrapRegistry;
    }> = [
      {
        expectedCode: "workspace-recovery-failed",
        registry: registry(
          composition(
            { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
            workspace({ state: "configured" }, async () =>
              failure({ code: secret, details: { token: secret }, message: secret }),
            ),
          ),
        ),
      },
      {
        expectedCode: "host-surface-start-failed",
        registry: registry(
          composition(
            {
              start: () => {
                throw new Error(secret);
              },
            },
            workspace({ state: "missing" }),
          ),
        ),
      },
      {
        expectedCode: "host-surface-failed",
        registry: registry(
          composition(
            {
              start: () => ({
                completion: Promise.reject(new Error(secret)),
                stop: async () => {},
              }),
            },
            workspace({ state: "missing" }),
          ),
        ),
      },
      {
        expectedCode: "host-surface-cleanup-failed",
        registry: registry(
          composition(
            {
              start: () => ({
                completion: Promise.resolve(),
                stop: async () => {
                  throw new Error(secret);
                },
              }),
            },
            workspace({ state: "missing" }),
          ),
        ),
      },
    ];
    for (const entry of cases) {
      const outcome = await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: entry.registry,
        signalSource: signals().source,
      });
      expect("diagnostics" in outcome && outcome.diagnostics[0]?.code).toBe(entry.expectedCode);
      expect(JSON.stringify(outcome)).not.toContain(secret);
    }
  });

  test("rejects accessor-bearing and proxied sessions without invoking traps", async () => {
    let getters = 0;
    const session = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(session, "completion", {
      enumerable: true,
      get: () => {
        getters += 1;
        return Promise.resolve();
      },
    });
    Object.defineProperty(session, "stop", { enumerable: true, value: async () => {} });
    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition({ start: () => session as never }, workspace({ state: "missing" })),
      ),
      signalSource: signals().source,
    });
    expect(outcome).toMatchObject({ status: "surface-failure" });
    expect(getters).toBe(0);

    const completion = new Proxy(Promise.resolve(), {
      getPrototypeOf: () => {
        getters += 1;
        return Promise.prototype;
      },
    });
    const proxiedOutcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          { start: () => ({ completion, stop: async () => {} }) },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signals().source,
    });
    expect(proxiedOutcome).toMatchObject({ status: "surface-failure" });
    expect(getters).toBe(0);
  });
});
