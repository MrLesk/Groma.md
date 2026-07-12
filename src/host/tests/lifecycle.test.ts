import { describe, expect, test } from "bun:test";

import { failure, success, type Diagnostic, type Result } from "../../core/index.ts";
import {
  runHost,
  type HostBootstrapRegistry,
  type HostComposition,
  type HostSignal,
  type HostSignalSource,
  type HostSurface,
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
  return {
    surface,
    workspace: workspaceAccess,
  } as HostComposition;
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
    const diagnostic: Diagnostic = { code: "workspace-recovery-failed", message: "failed" };
    const access = workspace({ state: "configured" }, async () => failure(diagnostic));
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

    expect(outcome).toEqual({ diagnostics: [diagnostic], status: "startup-failure" });
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
          code: "invalid-host-bootstrap-result",
          message: "Host bootstrap registry returned a malformed result",
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
          code: "invalid-host-surface-session",
          message: "Host surface returned a malformed session",
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
});
