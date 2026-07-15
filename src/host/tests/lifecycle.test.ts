import { describe, expect, test } from "bun:test";

import type { ApplicationOperations } from "../../application/index.ts";
import {
  failure,
  parseGraphGeneration,
  pluginRuntimeApiVersion,
  success,
  type Result,
  type RunningPluginGraph,
} from "../../core/index.ts";
import {
  createProcessSignalSource,
  runHost,
  type HostBootstrapRegistry,
  type HostComposition,
  type HostProcessSignalEmitter,
  type HostSignal,
  type HostSignalSource,
  type HostSurface,
  type HostSurfaceSession,
  type WorkspaceAccessCapability,
  type WorkspaceRecoveryReport,
  type WorkspaceStatus,
} from "../index.ts";

function generation(value: number) {
  const parsed = parseGraphGeneration(value);
  if (!parsed.ok) throw new Error("invalid test generation");
  return parsed.value;
}

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
  recover: () => Promise<Result<WorkspaceRecoveryReport>> = async () =>
    success({ generation: generation(0), status: "completed" }),
): WorkspaceAccessCapability {
  return {
    initialize: async () => ({ generation: generation(0), status: "already-initialized" }),
    recover,
    requireWorkspace: () => failure({ code: "unused", message: "unused" }),
    status: () => status,
  };
}

function applicationOperations(
  initialize: ApplicationOperations["initialize"] = async () =>
    failure({ code: "unused", message: "unused" }),
): ApplicationOperations {
  const unused = async (): Promise<never> => {
    throw new Error("unused application operation");
  };
  return {
    createComponent: unused,
    getComponent: unused,
    initialize,
    listChildren: unused,
    listComponents: unused,
    listRoots: unused,
    removeComponent: unused,
    reparentComponent: unused,
    updateComponent: unused,
  };
}

function composition(
  surface: HostSurface,
  workspaceAccess: WorkspaceAccessCapability,
  operations: ApplicationOperations = applicationOperations(),
): HostComposition {
  const capability = Object.freeze({});
  const packages = Object.freeze({
    add: async () => failure({ code: "unused", message: "unused" }),
    disable: async () => failure({ code: "unused", message: "unused" }),
    enable: async () => failure({ code: "unused", message: "unused" }),
    inspect: async () => failure({ code: "unused", message: "unused" }),
    remove: async () => failure({ code: "unused", message: "unused" }),
  });
  return Object.freeze({
    graph: capability,
    invariant: capability,
    model: capability,
    operations,
    packages,
    queries: capability,
    resourceMapper: capability,
    resources: capability,
    snapshotStateDecoder: capability,
    store: capability,
    surface,
    transactionEngine: capability,
    transactionProvider: capability,
    workspace: workspaceAccess,
  }) as unknown as HostComposition;
}

function registry(value: HostComposition): HostBootstrapRegistry {
  return { compose: async () => success(value) };
}

function pluginLifecycle(
  cancel: () => ReturnType<RunningPluginGraph["cancel"]>,
  shutdown: () => ReturnType<RunningPluginGraph["shutdown"]>,
): RunningPluginGraph {
  return Object.freeze({
    cancel,
    capabilities: () => Object.freeze([]),
    inspect: () =>
      Object.freeze({
        apiVersion: pluginRuntimeApiVersion,
        plugins: Object.freeze([]),
        state: "running" as const,
      }),
    shutdown,
  });
}

function compositionWithPlugins(
  surface: HostSurface,
  workspaceAccess: WorkspaceAccessCapability,
  plugins: RunningPluginGraph,
): HostComposition {
  return Object.freeze({ ...composition(surface, workspaceAccess), plugins });
}

describe("host lifecycle", () => {
  test("shuts the plugin graph down after surface cleanup", async () => {
    const events: string[] = [];
    let cancels = 0;
    const plugins = pluginLifecycle(
      async () => {
        cancels += 1;
        return success({ state: "cancelled", stoppedPluginIds: [] });
      },
      async () => {
        events.push("plugins:shutdown");
        return success({ state: "stopped", stoppedPluginIds: ["official.surface"] });
      },
    );
    const outcome = await runHost({
      context: { workspaceRoot: "/workspace" },
      registry: registry(
        compositionWithPlugins(
          {
            start: () => ({
              completion: Promise.resolve(),
              stop: async () => {
                events.push("surface:stop");
              },
            }),
          },
          workspace({ state: "missing" }),
          plugins,
        ),
      ),
      signalSource: { subscribe: () => () => {} },
    });

    expect(outcome).toEqual({ status: "completed" });
    expect(events).toEqual(["surface:stop", "plugins:shutdown"]);
    expect(cancels).toBe(0);
  });

  test("adapts process cancellation to plugin cancellation after surface stop", async () => {
    const events: string[] = [];
    const source = signals();
    const started = deferred<void>();
    const completion = deferred<void>();
    const plugins = pluginLifecycle(
      async () => {
        events.push("plugins:cancel");
        return success({ state: "cancelled", stoppedPluginIds: ["official.surface"] });
      },
      async () => {
        events.push("plugins:shutdown");
        return success({ state: "stopped", stoppedPluginIds: ["official.surface"] });
      },
    );
    const running = runHost({
      context: { workspaceRoot: "/workspace" },
      registry: registry(
        compositionWithPlugins(
          {
            start: () => {
              started.resolve();
              return {
                completion: completion.promise,
                stop: async () => {
                  events.push("surface:stop");
                },
              };
            },
          },
          workspace({ state: "missing" }),
          plugins,
        ),
      ),
      signalSource: source.source,
    });
    await started.promise;
    source.emit("SIGTERM");

    expect(await running).toEqual({ signal: "SIGTERM", status: "cancelled" });
    expect(events).toEqual(["surface:stop", "plugins:cancel"]);
  });

  test("preserves cancellation as the plugin cleanup cause after surface stop failure", async () => {
    const events: string[] = [];
    const source = signals();
    const started = deferred<void>();
    let cancels = 0;
    let shutdowns = 0;
    const plugins = pluginLifecycle(
      async () => {
        cancels += 1;
        events.push("plugins:cancel");
        return success({ state: "cancelled", stoppedPluginIds: ["official.surface"] });
      },
      async () => {
        shutdowns += 1;
        return success({ state: "stopped", stoppedPluginIds: ["official.surface"] });
      },
    );
    const running = runHost({
      context: { workspaceRoot: "/workspace" },
      registry: registry(
        compositionWithPlugins(
          {
            start: () => {
              started.resolve();
              return {
                completion: new Promise<void>(() => {}),
                stop: async () => {
                  events.push("surface:stop");
                  throw new Error("/private/stop-failure");
                },
              };
            },
          },
          workspace({ state: "missing" }),
          plugins,
        ),
      ),
      signalSource: source.source,
    });
    await started.promise;
    source.emit("SIGTERM");

    expect(await running).toEqual({
      diagnostics: [
        { code: "host-surface-cleanup-failed", message: "Host surface cleanup failed" },
      ],
      status: "surface-failure",
    });
    expect(events).toEqual(["surface:stop", "plugins:cancel"]);
    expect(cancels).toBe(1);
    expect(shutdowns).toBe(0);
  });

  test("contains malformed or failed plugin cleanup exactly once", async () => {
    let shutdowns = 0;
    const plugins = pluginLifecycle(
      async () => success({ state: "cancelled", stoppedPluginIds: [] }),
      async () => {
        shutdowns += 1;
        return failure({ code: "private-plugin-error", message: "/private/plugin" });
      },
    );
    const outcome = await runHost({
      context: { workspaceRoot: "/workspace" },
      registry: registry(
        compositionWithPlugins(
          {
            start: () => ({ completion: Promise.resolve(), stop: async () => {} }),
          },
          workspace({ state: "missing" }),
          plugins,
        ),
      ),
      signalSource: { subscribe: () => () => {} },
    });

    expect(outcome).toEqual({
      diagnostics: [{ code: "host-plugin-cleanup-failed", message: "Host plugin cleanup failed" }],
      status: "surface-failure",
    });
    expect(shutdowns).toBe(1);
  });

  test("contains nested rejected plugin cleanup values before reporting failure", async () => {
    const secret = "/private/plugin-cleanup";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const plugins = pluginLifecycle(
        async () => success({ state: "cancelled", stoppedPluginIds: [] }),
        async () =>
          ({
            diagnostics: [
              {
                code: "private-plugin-error",
                details: { rejected: Promise.reject(new Error(secret)) },
                message: secret,
              },
            ],
            ok: false,
          }) as never,
      );
      const outcome = await runHost({
        context: { workspaceRoot: "/workspace" },
        registry: registry(
          compositionWithPlugins(
            { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
            workspace({ state: "missing" }),
            plugins,
          ),
        ),
        signalSource: { subscribe: () => () => {} },
      });

      expect(outcome).toEqual({
        diagnostics: [
          { code: "host-plugin-cleanup-failed", message: "Host plugin cleanup failed" },
        ],
        status: "surface-failure",
      });
      expect(JSON.stringify(outcome)).not.toContain(secret);
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("process signal source forwards both signals and unsubscribes idempotently", () => {
    const listeners = new Map<HostSignal, Set<() => void>>();
    const onCalls: HostSignal[] = [];
    const offCalls: HostSignal[] = [];
    const emitter: HostProcessSignalEmitter = {
      off: (signal, listener) => {
        offCalls.push(signal);
        listeners.get(signal)?.delete(listener);
      },
      on: (signal, listener) => {
        onCalls.push(signal);
        const registered = listeners.get(signal) ?? new Set<() => void>();
        registered.add(listener);
        listeners.set(signal, registered);
      },
    };
    const source = createProcessSignalSource(emitter);
    const received: HostSignal[] = [];
    const unsubscribe = source.subscribe((signal) => received.push(signal));
    for (const listener of listeners.get("SIGINT") ?? []) listener();
    for (const listener of listeners.get("SIGTERM") ?? []) listener();
    unsubscribe();
    unsubscribe();
    for (const listener of listeners.get("SIGINT") ?? []) listener();

    expect(Object.isFrozen(source)).toBeTrue();
    expect(received).toEqual(["SIGINT", "SIGTERM"]);
    expect(onCalls).toEqual(["SIGINT", "SIGTERM"]);
    expect(offCalls).toEqual(["SIGINT", "SIGTERM"]);
  });

  test("rolls back every possibly-added listener when signal registration throws", () => {
    for (const failingSignal of ["SIGINT", "SIGTERM"] as const) {
      const listeners = new Map<HostSignal, Set<() => void>>();
      const offCalls: HostSignal[] = [];
      const emitter: HostProcessSignalEmitter = {
        off: (signal, listener) => {
          offCalls.push(signal);
          listeners.get(signal)?.delete(listener);
        },
        on: (signal, listener) => {
          const registered = listeners.get(signal) ?? new Set<() => void>();
          registered.add(listener);
          listeners.set(signal, registered);
          if (signal === failingSignal) throw new Error(`/private/${signal}-registration`);
        },
      };

      expect(() => createProcessSignalSource(emitter).subscribe(() => {})).toThrow(
        "Process signal registration failed",
      );
      expect(Array.from(listeners.values()).every((entries) => entries.size === 0)).toBeTrue();
      expect(offCalls).toEqual(failingSignal === "SIGINT" ? ["SIGINT"] : ["SIGTERM", "SIGINT"]);
    }
  });

  test("attempts both signal removals and retries only failed cleanup", () => {
    for (const failingSignals of [["SIGINT"], ["SIGTERM"], ["SIGINT", "SIGTERM"]] as const) {
      const listeners = new Map<HostSignal, Set<() => void>>();
      const offCalls: HostSignal[] = [];
      const remainingFailures = new Set<HostSignal>(failingSignals);
      const emitter: HostProcessSignalEmitter = {
        off: (signal, listener) => {
          offCalls.push(signal);
          if (remainingFailures.delete(signal)) {
            throw new Error(`/private/${signal}-cleanup`);
          }
          listeners.get(signal)?.delete(listener);
        },
        on: (signal, listener) => {
          const registered = listeners.get(signal) ?? new Set<() => void>();
          registered.add(listener);
          listeners.set(signal, registered);
        },
      };
      const unsubscribe = createProcessSignalSource(emitter).subscribe(() => {});

      expect(unsubscribe).toThrow("Process signal cleanup failed");
      expect(offCalls.slice(0, 2)).toEqual(["SIGINT", "SIGTERM"]);
      unsubscribe();
      const afterRetry = offCalls.length;
      unsubscribe();

      expect(Array.from(listeners.values()).every((entries) => entries.size === 0)).toBeTrue();
      expect(offCalls).toHaveLength(afterRetry);
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        const expectedCalls = failingSignals.includes(signal as never) ? 2 : 1;
        expect(offCalls.filter((called) => called === signal)).toHaveLength(expectedCalls);
      }
    }
  });

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

  test("exposes only captured application initialization while the workspace is missing", async () => {
    const signal = signals();
    let initializeCalls = 0;
    let replacementCalls = 0;
    let receivedOriginalReceiver = false;
    let initializationFrozen = false;
    let initializationKeys: PropertyKey[] = [];
    let initializationResult: unknown;
    let workspaceGate: unknown;
    let operations!: ApplicationOperations;
    const initialize: ApplicationOperations["initialize"] = async function (
      this: ApplicationOperations,
      request,
    ) {
      initializeCalls += 1;
      receivedOriginalReceiver = this === operations;
      expect(request).toEqual({});
      return success({ generation: generation(1), status: "initialized" });
    };
    operations = applicationOperations(initialize);
    const workspaceAccess = workspace({ state: "missing" });
    workspaceAccess.status = () => {
      operations.initialize = async () => {
        replacementCalls += 1;
        return success({ generation: generation(2), status: "already-initialized" });
      };
      return { state: "missing" };
    };
    const surface: HostSurface = {
      start: async (context) => {
        initializationFrozen = Object.isFrozen(context.initialization);
        initializationKeys = Reflect.ownKeys(context.initialization);
        workspaceGate = context.workspace.requireWorkspace();
        initializationResult = await context.initialization.initialize({});
        return { completion: Promise.resolve(), stop: async () => {} };
      },
    };

    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(composition(surface, workspaceAccess, operations)),
      signalSource: signal.source,
    });

    expect(outcome).toEqual({ status: "completed" });
    expect({ initializeCalls, replacementCalls, receivedOriginalReceiver }).toEqual({
      initializeCalls: 1,
      receivedOriginalReceiver: true,
      replacementCalls: 0,
    });
    expect({ initializationFrozen, initializationKeys }).toEqual({
      initializationFrozen: true,
      initializationKeys: ["initialize"],
    });
    expect(initializationResult).toEqual({
      ok: true,
      value: { generation: generation(1), status: "initialized" },
    });
    expect(workspaceGate).toEqual({
      diagnostics: [{ code: "unused", message: "unused" }],
      ok: false,
    });
  });

  test("contains external cancellation registration failure and rolls back a possibly-added listener", async () => {
    const secret = "/private/external-cancellation-registration";
    let adds = 0;
    let listener: unknown;
    let removes = 0;
    const externalCancellation = {
      aborted: false,
      addEventListener: (_type: string, next: unknown) => {
        adds += 1;
        listener = next;
        throw new Error(secret);
      },
      removeEventListener: (_type: string, next: unknown) => {
        removes += 1;
        if (listener === next) listener = undefined;
      },
    } as unknown as AbortSignal;
    const signal = signals();

    const outcome = await runHost({
      context: { cancellation: externalCancellation, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: signal.source,
    });

    expect(outcome).toEqual({
      diagnostics: [{ code: "host-startup-failed", message: "Host startup failed" }],
      status: "startup-failure",
    });
    expect({ adds, removes, signalUnsubscribes: signal.unsubscribes() }).toEqual({
      adds: 1,
      removes: 1,
      signalUnsubscribes: 0,
    });
    expect(listener).toBeUndefined();
    expect(JSON.stringify(outcome)).not.toContain(secret);
  });

  test("contains external cancellation removal failure without skipping signal cleanup", async () => {
    const cancellationSecret = "/private/external-cancellation-removal";
    const signalSecret = "/private/process-signal-removal";
    for (const signalCleanupFails of [false, true]) {
      let adds = 0;
      let processUnsubscribes = 0;
      let removes = 0;
      const externalCancellation = {
        aborted: false,
        addEventListener: () => {
          adds += 1;
        },
        removeEventListener: () => {
          removes += 1;
          throw new Error(cancellationSecret);
        },
      } as unknown as AbortSignal;
      const signalSource: HostSignalSource = {
        subscribe: () => () => {
          processUnsubscribes += 1;
          if (signalCleanupFails) throw new Error(signalSecret);
        },
      };

      const outcome = await runHost({
        context: { cancellation: externalCancellation, workspaceRoot: "/absolute/workspace" },
        registry: registry(
          composition(
            { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
            workspace({ state: "missing" }),
          ),
        ),
        signalSource,
      });

      expect(outcome, String(signalCleanupFails)).toEqual({
        diagnostics: [
          signalCleanupFails
            ? { code: "host-signal-cleanup-failed", message: "Host signal cleanup failed" }
            : {
                code: "host-cancellation-cleanup-failed",
                message: "Host cancellation cleanup failed",
              },
        ],
        status: "surface-failure",
      });
      expect({ adds, processUnsubscribes, removes }, String(signalCleanupFails)).toEqual({
        adds: 1,
        processUnsubscribes: 1,
        removes: 1,
      });
      expect(JSON.stringify(outcome), String(signalCleanupFails)).not.toContain(cancellationSecret);
      expect(JSON.stringify(outcome), String(signalCleanupFails)).not.toContain(signalSecret);
    }
  });

  test("observes rejected cancellation registration Promises without hostile then access or leaks", async () => {
    const secret = "/private/rejected-cancellation-registration";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    let adds = 0;
    let removes = 0;
    let thenCalls = 0;
    process.on("unhandledRejection", onUnhandled);
    try {
      const rejected = Promise.reject(new Error(secret));
      Object.defineProperty(rejected, "then", {
        configurable: true,
        get: () => {
          thenCalls += 1;
          throw new Error(secret);
        },
      });
      const thenDescriptor = Object.getOwnPropertyDescriptor(rejected, "then");
      const externalCancellation = {
        aborted: false,
        addEventListener: () => {
          adds += 1;
          return rejected;
        },
        removeEventListener: () => {
          removes += 1;
        },
      } as unknown as AbortSignal;
      const signal = signals();

      const outcome = await runHost({
        context: { cancellation: externalCancellation, workspaceRoot: "/absolute/workspace" },
        registry: registry(
          composition(
            { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
            workspace({ state: "missing" }),
          ),
        ),
        signalSource: signal.source,
      });

      expect(outcome).toEqual({
        diagnostics: [{ code: "host-startup-failed", message: "Host startup failed" }],
        status: "startup-failure",
      });
      expect({ adds, removes, signalUnsubscribes: signal.unsubscribes() }).toEqual({
        adds: 1,
        removes: 1,
        signalUnsubscribes: 0,
      });
      expect(thenCalls).toBe(0);
      expect(Object.getOwnPropertyDescriptor(rejected, "then")).toEqual(thenDescriptor);
      expect(JSON.stringify(outcome)).not.toContain(secret);
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("observes rejected cancellation removal Promises before exact signal cleanup", async () => {
    const cancellationSecret = "/private/rejected-cancellation-removal";
    const signalSecret = "/private/rejected-process-signal-removal";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    let speciesCalls = 0;
    process.on("unhandledRejection", onUnhandled);
    try {
      class HostilePromise<T> extends Promise<T> {
        static override get [Symbol.species](): PromiseConstructor {
          speciesCalls += 1;
          throw new Error(cancellationSecret);
        }
      }
      for (const signalCleanupFails of [false, true]) {
        let processUnsubscribes = 0;
        let removes = 0;
        const rejected = HostilePromise.reject(new Error(cancellationSecret));
        const constructorDescriptor = Object.getOwnPropertyDescriptor(rejected, "constructor");
        const externalCancellation = {
          aborted: false,
          addEventListener: () => undefined,
          removeEventListener: () => {
            removes += 1;
            return rejected;
          },
        } as unknown as AbortSignal;
        const signalSource: HostSignalSource = {
          subscribe: () => () => {
            processUnsubscribes += 1;
            if (signalCleanupFails) throw new Error(signalSecret);
          },
        };

        const outcome = await runHost({
          context: { cancellation: externalCancellation, workspaceRoot: "/absolute/workspace" },
          registry: registry(
            composition(
              { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
              workspace({ state: "missing" }),
            ),
          ),
          signalSource,
        });

        expect(outcome, String(signalCleanupFails)).toEqual({
          diagnostics: [
            signalCleanupFails
              ? { code: "host-signal-cleanup-failed", message: "Host signal cleanup failed" }
              : {
                  code: "host-cancellation-cleanup-failed",
                  message: "Host cancellation cleanup failed",
                },
          ],
          status: "surface-failure",
        });
        expect({ processUnsubscribes, removes }, String(signalCleanupFails)).toEqual({
          processUnsubscribes: 1,
          removes: 1,
        });
        expect(Object.getOwnPropertyDescriptor(rejected, "constructor")).toEqual(
          constructorDescriptor,
        );
        expect(JSON.stringify(outcome), String(signalCleanupFails)).not.toContain(
          cancellationSecret,
        );
        expect(JSON.stringify(outcome), String(signalCleanupFails)).not.toContain(signalSecret);
      }
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(speciesCalls).toBe(0);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("rejects resolving and pending listener returns synchronously without hanging", async () => {
    for (const returnState of ["resolved", "pending"] as const) {
      for (const location of ["add", "remove"] as const) {
        const malformedReturn =
          returnState === "resolved" ? Promise.resolve() : new Promise<void>(() => {});
        let adds = 0;
        let removes = 0;
        const externalCancellation = {
          aborted: false,
          addEventListener: () => {
            adds += 1;
            return location === "add" ? malformedReturn : undefined;
          },
          removeEventListener: () => {
            removes += 1;
            return location === "remove" ? malformedReturn : undefined;
          },
        } as unknown as AbortSignal;
        const signal = signals();
        const running = runHost({
          context: { cancellation: externalCancellation, workspaceRoot: "/absolute/workspace" },
          registry: registry(
            composition(
              { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
              workspace({ state: "missing" }),
            ),
          ),
          signalSource: signal.source,
        });
        const raced = await Promise.race([
          running.then((outcome) => ({ outcome, state: "returned" as const })),
          new Promise<{ readonly state: "hung" }>((resolve) =>
            setImmediate(() => resolve({ state: "hung" })),
          ),
        ]);

        expect(raced.state, `${location}:${returnState}`).toBe("returned");
        if (raced.state !== "returned") continue;
        expect(raced.outcome, `${location}:${returnState}`).toEqual(
          location === "add"
            ? {
                diagnostics: [{ code: "host-startup-failed", message: "Host startup failed" }],
                status: "startup-failure",
              }
            : {
                diagnostics: [
                  {
                    code: "host-cancellation-cleanup-failed",
                    message: "Host cancellation cleanup failed",
                  },
                ],
                status: "surface-failure",
              },
        );
        expect(
          { adds, removes, signalUnsubscribes: signal.unsubscribes() },
          `${location}:${returnState}`,
        ).toEqual({
          adds: 1,
          removes: 1,
          signalUnsubscribes: location === "add" ? 0 : 1,
        });
      }
    }
  });

  test("rejects proxied cleanup and listener returns before Promise observation", async () => {
    for (const location of ["add", "remove", "stop", "unsubscribe"] as const) {
      let adds = 0;
      let removes = 0;
      let stops = 0;
      let unsubscribes = 0;
      let traps = 0;
      const malformedReturn = new Proxy(Promise.resolve(), {
        getOwnPropertyDescriptor: () => {
          traps += 1;
          throw new Error("/private/proxied-cleanup-descriptor");
        },
        getPrototypeOf: () => {
          traps += 1;
          throw new Error("/private/proxied-cleanup-prototype");
        },
      });
      const externalCancellation = {
        aborted: false,
        addEventListener: () => {
          adds += 1;
          return location === "add" ? malformedReturn : undefined;
        },
        removeEventListener: () => {
          removes += 1;
          return location === "remove" ? malformedReturn : undefined;
        },
      } as unknown as AbortSignal;
      const outcome = await runHost({
        context: { cancellation: externalCancellation, workspaceRoot: "/absolute/workspace" },
        registry: registry(
          composition(
            {
              start: () => ({
                completion: Promise.resolve(),
                stop: () => {
                  stops += 1;
                  return location === "stop" ? malformedReturn : Promise.resolve();
                },
              }),
            },
            workspace({ state: "missing" }),
          ),
        ),
        signalSource: {
          subscribe: () => () => {
            unsubscribes += 1;
            return location === "unsubscribe" ? malformedReturn : Promise.resolve();
          },
        },
      });

      const expectedCode =
        location === "add"
          ? "host-startup-failed"
          : location === "remove"
            ? "host-cancellation-cleanup-failed"
            : location === "stop"
              ? "host-surface-cleanup-failed"
              : "host-signal-cleanup-failed";
      expect("diagnostics" in outcome && outcome.diagnostics[0]?.code, location).toBe(expectedCode);
      expect(traps, location).toBe(0);
      expect({ adds, removes, stops, unsubscribes }, location).toEqual(
        location === "add"
          ? { adds: 1, removes: 1, stops: 0, unsubscribes: 0 }
          : { adds: 1, removes: 1, stops: 1, unsubscribes: 1 },
      );
    }
  });

  test("finishes recovery before semantic surface dispatch", async () => {
    const recovery = deferred<Result<WorkspaceRecoveryReport>>();
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
    recovery.resolve(success({ generation: generation(4), status: "completed" }));
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

  test("awaits asynchronous signal cleanup exactly once before returning", async () => {
    const cleanupEntered = deferred<void>();
    const cleanupGate = deferred<void>();
    let cleanups = 0;
    let settled = false;
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: {
        subscribe: () => async () => {
          cleanups += 1;
          cleanupEntered.resolve();
          await cleanupGate.promise;
        },
      },
    });
    const observed = running.then((outcome) => {
      settled = true;
      return outcome;
    });

    await cleanupEntered.promise;
    await Promise.resolve();
    expect(settled).toBeFalse();
    expect(cleanups).toBe(1);
    cleanupGate.resolve();

    expect(await observed).toEqual({ status: "completed" });
    expect(cleanups).toBe(1);
  });

  test("contains synchronous and asynchronous signal cleanup failure with final precedence", async () => {
    const secret = "/Users/alex/private unsubscribe secret";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    const cancellation = new AbortController();
    cancellation.abort();
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const entry of [
        {
          cleanup: () => {
            throw new Error(secret);
          },
          context: { workspaceRoot: "/absolute/workspace" },
          name: "synchronous after completion",
        },
        {
          cleanup: async () => {
            throw new Error(secret);
          },
          context: {
            cancellation: cancellation.signal,
            workspaceRoot: "/absolute/workspace",
          },
          name: "asynchronous after cancellation",
        },
      ]) {
        let cleanups = 0;
        const outcome = await runHost({
          context: entry.context,
          registry: registry(
            composition(
              { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
              workspace({ state: "missing" }),
            ),
          ),
          signalSource: {
            subscribe: () => () => {
              cleanups += 1;
              return entry.cleanup();
            },
          },
        });

        expect(outcome, entry.name).toEqual({
          diagnostics: [
            { code: "host-signal-cleanup-failed", message: "Host signal cleanup failed" },
          ],
          status: "surface-failure",
        });
        expect(cleanups, entry.name).toBe(1);
        expect(Object.isFrozen(outcome), entry.name).toBeTrue();
        expect(
          "diagnostics" in outcome && Object.isFrozen(outcome.diagnostics),
          entry.name,
        ).toBeTrue();
        expect(
          "diagnostics" in outcome && Object.isFrozen(outcome.diagnostics[0]),
          entry.name,
        ).toBeTrue();
        expect(JSON.stringify(outcome), entry.name).not.toContain(secret);
      }
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
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

  test("passes frozen cancellation into pending composition and contains late settlement", async () => {
    const secret = "/private/late-compose-secret";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const settlement of ["reject", "resolve"] as const) {
        const entered = deferred<void>();
        const late = deferred<Result<HostComposition>>();
        const signal = signals();
        let receivedContext: Parameters<HostBootstrapRegistry["compose"]>[0] | undefined;
        let starts = 0;
        const surface: HostSurface = {
          start: () => {
            starts += 1;
            return { completion: Promise.resolve(), stop: async () => {} };
          },
        };
        const running = runHost({
          context: { workspaceRoot: "/absolute/workspace" },
          registry: {
            compose: async (context) => {
              receivedContext = context;
              entered.resolve();
              return late.promise;
            },
          },
          signalSource: signal.source,
        });
        await entered.promise;
        signal.emit("SIGTERM");
        expect(await running, settlement).toEqual({ signal: "SIGTERM", status: "cancelled" });
        expect(Object.isFrozen(receivedContext), settlement).toBeTrue();
        expect(receivedContext?.workspaceRoot, settlement).toBe("/absolute/workspace");
        expect(receivedContext?.cancellation?.aborted, settlement).toBeTrue();
        expect(signal.unsubscribes(), settlement).toBe(1);
        if (settlement === "reject") {
          late.reject(new Error(secret));
        } else {
          late.resolve(success(composition(surface, workspace({ state: "missing" }))));
        }
        await Promise.resolve();
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(starts, settlement).toBe(0);
      }
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("cancels a valid plugin graph delivered after composition cancellation", async () => {
    const entered = deferred<void>();
    const late = deferred<Result<HostComposition>>();
    const cancelledPlugins = deferred<void>();
    const cancellation = new AbortController();
    let cancels = 0;
    let shutdowns = 0;
    let starts = 0;
    const plugins = pluginLifecycle(
      async () => {
        cancels += 1;
        cancelledPlugins.resolve();
        return success({ state: "cancelled", stoppedPluginIds: ["official.surface"] });
      },
      async () => {
        shutdowns += 1;
        return success({ state: "stopped", stoppedPluginIds: ["official.surface"] });
      },
    );
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: {
        compose: async () => {
          entered.resolve();
          return late.promise;
        },
      },
      signalSource: signals().source,
    });
    await entered.promise;
    cancellation.abort();

    expect(await running).toEqual({ status: "cancelled" });
    expect(cancels).toBe(0);
    late.resolve(
      success(
        compositionWithPlugins(
          {
            start: () => {
              starts += 1;
              return { completion: Promise.resolve(), stop: async () => {} };
            },
          },
          workspace({ state: "missing" }),
          plugins,
        ),
      ),
    );
    await cancelledPlugins.promise;

    expect(cancels).toBe(1);
    expect(shutdowns).toBe(0);
    expect(starts).toBe(0);
  });

  test("turns a malformed injected signal into generic cancellation with exact cleanup", async () => {
    const started = deferred<void>();
    let listener: ((signal: HostSignal) => void) | undefined;
    let stops = 0;
    let unsubscribes = 0;
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => {
              started.resolve();
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
      signalSource: {
        subscribe: (next) => {
          listener = next;
          return () => {
            unsubscribes += 1;
          };
        },
      },
    });
    await started.promise;
    (listener as unknown as (signal: unknown) => void)("SIGHUP");

    expect(await running).toEqual({ status: "cancelled" });
    expect(stops).toBe(1);
    expect(unsubscribes).toBe(1);
  });

  test("cancellation during recovery prevents dispatch after recovery releases", async () => {
    const recovery = deferred<Result<WorkspaceRecoveryReport>>();
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
    recovery.resolve(success({ generation: generation(0), status: "completed" }));

    expect(await running).toEqual({ status: "cancelled" });
    expect(starts).toBe(0);
  });

  test("returns from pending recovery and contains late rejection or malformed success", async () => {
    const secret = "/private/late-recovery-secret";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    let getterCalls = 0;
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const settlement of ["reject", "malformed"] as const) {
        const cancellation = new AbortController();
        const entered = deferred<void>();
        const recovery = deferred<Result<WorkspaceRecoveryReport>>();
        let cancels = 0;
        let shutdowns = 0;
        let starts = 0;
        const plugins = pluginLifecycle(
          async () => {
            cancels += 1;
            return success({ state: "cancelled", stoppedPluginIds: [] });
          },
          async () => {
            shutdowns += 1;
            return success({ state: "stopped", stoppedPluginIds: [] });
          },
        );
        const malformed = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(malformed, "ok", {
          enumerable: true,
          get: () => {
            getterCalls += 1;
            return true;
          },
        });
        Object.defineProperty(malformed, "value", {
          enumerable: true,
          value: { generation: 0, status: "completed" },
        });
        const running = runHost({
          context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
          registry: registry(
            compositionWithPlugins(
              {
                start: () => {
                  starts += 1;
                  return { completion: Promise.resolve(), stop: async () => {} };
                },
              },
              workspace({ state: "configured" }, async () => {
                entered.resolve();
                return recovery.promise;
              }),
              plugins,
            ),
          ),
          signalSource: signals().source,
        });
        await entered.promise;
        cancellation.abort();
        expect(await running, settlement).toEqual({ status: "cancelled" });
        expect(cancels, settlement).toBe(0);
        if (settlement === "reject") {
          recovery.reject(new Error(secret));
        } else {
          recovery.resolve(malformed as never);
        }
        await Promise.resolve();
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(starts, settlement).toBe(0);
        expect(cancels, settlement).toBe(1);
        expect(shutdowns, settlement).toBe(0);
      }
      expect(getterCalls).toBe(0);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("waits for late recovery settlement before cancelling plugins", async () => {
    const events: string[] = [];
    const cancellation = new AbortController();
    const entered = deferred<void>();
    const recovery = deferred<Result<WorkspaceRecoveryReport>>();
    const cancelledPlugins = deferred<void>();
    let cancels = 0;
    let starts = 0;
    const plugins = pluginLifecycle(
      async () => {
        cancels += 1;
        events.push("plugins:cancel");
        cancelledPlugins.resolve();
        return success({ state: "cancelled", stoppedPluginIds: [] });
      },
      async () => success({ state: "stopped", stoppedPluginIds: [] }),
    );
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        compositionWithPlugins(
          {
            start: () => {
              starts += 1;
              return { completion: Promise.resolve(), stop: async () => {} };
            },
          },
          workspace({ state: "configured" }, async () => {
            entered.resolve();
            const result = await recovery.promise;
            events.push("recovery:settled");
            return result;
          }),
          plugins,
        ),
      ),
      signalSource: signals().source,
    });
    await entered.promise;
    cancellation.abort();

    expect(await running).toEqual({ status: "cancelled" });
    expect(cancels).toBe(0);
    recovery.resolve(success({ generation: generation(0), status: "completed" }));
    await cancelledPlugins.promise;

    expect(events).toEqual(["recovery:settled", "plugins:cancel"]);
    expect(cancels).toBe(1);
    expect(starts).toBe(0);
  });

  test("routes retryable workspace provider status without claiming incompatibility", async () => {
    const secret = "/private/provider-status-secret";
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
          workspace({
            diagnostic: {
              code: "workspace-configuration-provider-failure",
              message: secret,
            },
            state: "conflict",
          }),
        ),
      ),
      signalSource: signals().source,
    });

    expect(outcome).toEqual({
      diagnostics: [
        {
          code: "workspace-configuration-provider-failure",
          message: "Workspace configuration access failed",
        },
      ],
      status: "startup-failure",
    });
    expect(JSON.stringify(outcome)).not.toContain(secret);
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

  test("rejects proxied bootstrap and recovery Promises before observation", async () => {
    for (const location of ["bootstrap", "recovery"] as const) {
      let traps = 0;
      const result =
        location === "bootstrap"
          ? success(
              composition(
                { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
                workspace({ state: "missing" }),
              ),
            )
          : success({ generation: generation(0), status: "completed" as const });
      const proxiedPromise = new Proxy(Promise.resolve(result), {
        getOwnPropertyDescriptor: () => {
          traps += 1;
          throw new Error("/private/proxied-host-promise-descriptor");
        },
        getPrototypeOf: () => {
          traps += 1;
          throw new Error("/private/proxied-host-promise-prototype");
        },
      });
      const outcome = await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry:
          location === "bootstrap"
            ? ({ compose: () => proxiedPromise } as never)
            : registry(
                composition(
                  { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
                  workspace({ state: "configured" }, () => proxiedPromise as never),
                ),
              ),
        signalSource: signals().source,
      });

      expect("diagnostics" in outcome && outcome.diagnostics[0]?.code, location).toBe(
        location === "bootstrap" ? "host-bootstrap-failed" : "invalid-host-recovery-result",
      );
      expect(traps, location).toBe(0);
    }
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
    const stopReleased = deferred<void>();
    const cancelledPlugins = deferred<void>();
    const events: string[] = [];
    let cancels = 0;
    let shutdowns = 0;
    let stops = 0;
    const plugins = pluginLifecycle(
      async () => {
        cancels += 1;
        events.push("plugins:cancel");
        cancelledPlugins.resolve();
        return success({ state: "cancelled", stoppedPluginIds: [] });
      },
      async () => {
        shutdowns += 1;
        return success({ state: "stopped", stoppedPluginIds: [] });
      },
    );
    const running = runHost({
      context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
      registry: registry(
        compositionWithPlugins(
          {
            start: () => {
              started.resolve();
              return late.promise as never;
            },
          },
          workspace({ state: "missing" }),
          plugins,
        ),
      ),
      signalSource: signal.source,
    });
    await started.promise;
    cancellation.abort();
    expect(await running).toEqual({ status: "cancelled" });
    expect(signal.unsubscribes()).toBe(1);
    expect(cancels).toBe(0);

    late.resolve({
      completion: Promise.resolve(),
      stop: async () => {
        stops += 1;
        events.push("surface:stop");
        stopEntered.resolve();
        await stopReleased.promise;
      },
    });
    await stopEntered.promise;
    expect(stops).toBe(1);
    expect(cancels).toBe(0);
    stopReleased.resolve();
    await cancelledPlugins.promise;
    expect(events).toEqual(["surface:stop", "plugins:cancel"]);
    expect(cancels).toBe(1);
    expect(shutdowns).toBe(0);
  });

  test("cancels plugins after a late surface stop rejects without leaking", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const cancellation = new AbortController();
      const started = deferred<void>();
      const late = deferred<HostSurfaceSession>();
      const cancelledPlugins = deferred<void>();
      let cancels = 0;
      const plugins = pluginLifecycle(
        async () => {
          cancels += 1;
          cancelledPlugins.resolve();
          return success({ state: "cancelled", stoppedPluginIds: [] });
        },
        async () => success({ state: "stopped", stoppedPluginIds: [] }),
      );
      const running = runHost({
        context: { cancellation: cancellation.signal, workspaceRoot: "/absolute/workspace" },
        registry: registry(
          compositionWithPlugins(
            {
              start: () => {
                started.resolve();
                return late.promise as never;
              },
            },
            workspace({ state: "missing" }),
            plugins,
          ),
        ),
        signalSource: signals().source,
      });
      await started.promise;
      cancellation.abort();
      expect(await running).toEqual({ status: "cancelled" });

      late.resolve({
        completion: Promise.resolve(),
        stop: async () => {
          throw new Error("/private/late-stop-secret");
        },
      });
      await cancelledPlugins.promise;
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(cancels).toBe(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
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
      return success({ generation: generation(3), status: "completed" });
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

  test("preserves every known bootstrap diagnostic in canonical deterministic order", async () => {
    const signal = signals();
    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: {
        compose: async () =>
          failure(
            {
              code: "unsupported-plugin-package-manifest-version",
              details: { token: "/private/manifest" },
              message: "/private/manifest",
            },
            {
              code: "incompatible-plugin-sdk-version",
              message: "/private/sdk",
            },
            {
              code: "incompatible-plugin-runtime-version",
              message: "/private/runtime",
            },
            {
              code: "incompatible-plugin-sdk-version",
              message: "/private/duplicate-sdk",
            },
          ),
      },
      signalSource: signal.source,
    });

    expect(outcome).toEqual({
      diagnostics: [
        {
          code: "incompatible-plugin-runtime-version",
          message: "Plugin runtime API version is incompatible",
        },
        {
          code: "incompatible-plugin-sdk-version",
          message: "Plugin SDK version is incompatible",
        },
        {
          code: "unsupported-plugin-package-manifest-version",
          message: "Plugin package manifest version is unsupported",
        },
      ],
      status: "startup-failure",
    });
    expect(Object.isFrozen(outcome)).toBe(true);
    if (!("diagnostics" in outcome)) throw new Error("expected startup diagnostics");
    expect(Object.isFrozen(outcome.diagnostics)).toBe(true);
    expect(outcome.diagnostics.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain("/private/");
    expect(signal.unsubscribes()).toBe(1);
  });

  test("fails closed when known and unknown bootstrap diagnostics are mixed", async () => {
    const signal = signals();
    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: {
        compose: async () =>
          failure(
            {
              code: "incompatible-plugin-sdk-version",
              message: "/private/sdk",
            },
            { code: "unknown-bootstrap-failure", message: "/private/unknown" },
          ),
      },
      signalSource: signal.source,
    });

    expect(outcome).toEqual({
      diagnostics: [{ code: "host-bootstrap-failed", message: "Host bootstrap failed" }],
      status: "startup-failure",
    });
    expect(JSON.stringify(outcome)).not.toContain("/private/");
    expect(signal.unsubscribes()).toBe(1);
  });

  test("preserves stable package-store startup diagnostics", async () => {
    for (const [code, message] of [
      ["plugin-package-lock-unavailable", "The exact plugin package lock is unavailable"],
      ["plugin-package-user-state-unavailable", "Local plugin package state is unavailable"],
      [
        "plugin-package-enabled-limit-exceeded",
        "Enabled local plugins exceed this Host's runtime capacity",
      ],
    ] as const) {
      const signal = signals();
      const outcome = await runHost({
        context: { workspaceRoot: "/absolute/workspace" },
        registry: {
          compose: async () => failure({ code, message: `/private/${code}` }),
        },
        signalSource: signal.source,
      });

      expect(outcome, code).toEqual({
        diagnostics: [{ code, message }],
        status: "startup-failure",
      });
      expect(JSON.stringify(outcome), code).not.toContain("/private/");
      expect(signal.unsubscribes(), code).toBe(1);
    }
  });

  test("preserves the actionable canonical diagnostic for bootstrap configuration changes", async () => {
    const signal = signals();
    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: {
        compose: async () =>
          failure({
            code: "workspace-configuration-changed",
            message: "/private/configuration-race",
          }),
      },
      signalSource: signal.source,
    });

    expect(outcome).toEqual({
      diagnostics: [
        {
          code: "workspace-configuration-changed",
          message: "Workspace configuration changed during bootstrap; restart after changes settle",
        },
      ],
      status: "startup-failure",
    });
    expect(signal.unsubscribes()).toBe(1);
  });

  test("preserves the canonical unattested Windows plugin trust diagnostic", async () => {
    const signal = signals();
    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: {
        compose: async () =>
          failure({
            code: "plugin-package-trust-root-unattested",
            message: "untrusted platform detail",
          }),
      },
      signalSource: signal.source,
    });

    expect(outcome).toEqual({
      diagnostics: [
        {
          code: "plugin-package-trust-root-unattested",
          message:
            "Local plugin trust is unavailable because this Windows Host cannot attest exclusive control of its user-data root",
        },
      ],
      status: "startup-failure",
    });
    expect(signal.unsubscribes()).toBe(1);
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
    const operationsAccessor = { ...base.operations } as Record<string, unknown>;
    Object.defineProperty(operationsAccessor, "initialize", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return async () => success({ generation: generation(0), status: "initialized" });
      },
    });
    for (const value of [
      new Proxy(base, {}),
      { ...base, extra: true },
      accessor,
      symbol,
      nestedProxy,
      { ...base, operations: new Proxy(base.operations, {}) },
      { ...base, operations: { ...base.operations, extra: true } },
      { ...base, operations: operationsAccessor },
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

  test("contains Promise-valued workspace diagnostics before rejecting their status", async () => {
    const secret = "/private/workspace-diagnostic-promise";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const location of ["diagnostic", "details", "details-siblings"] as const) {
        const rejected = Promise.reject(new Error(secret));
        const diagnostic =
          location === "diagnostic"
            ? rejected
            : {
                code: "private-workspace-diagnostic",
                details:
                  location === "details"
                    ? { rejected }
                    : {
                        first: rejected,
                        second: Promise.reject(new Error(`${secret}:second`)),
                      },
                message: secret,
              };
        const signal = signals();
        const outcome = await runHost({
          context: { workspaceRoot: "/absolute/workspace" },
          registry: registry(
            composition(
              { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
              workspace({ diagnostic, state: "conflict" } as never),
            ),
          ),
          signalSource: signal.source,
        });

        expect(outcome, location).toEqual({
          diagnostics: [
            {
              code: "invalid-host-workspace-status",
              message: "Workspace status capability returned malformed state",
            },
          ],
          status: "startup-failure",
        });
        expect(signal.unsubscribes(), location).toBe(1);
        expect(JSON.stringify(outcome), location).not.toContain(secret);
      }
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
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

  test("observes hostile rejecting completion and cleanup Promises without accessors or leaks", async () => {
    const secret = "/private/host-promise-secret";
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const location of ["completion", "stop", "unsubscribe"] as const) {
        let accessorCalls = 0;
        let speciesCalls = 0;
        let promise: Promise<void>;
        let descriptor: PropertyDescriptor | undefined;
        if (location === "completion") {
          promise = Promise.reject(new Error(secret));
          Object.defineProperty(promise, "then", {
            configurable: true,
            get: () => {
              accessorCalls += 1;
              throw new Error(secret);
            },
          });
          descriptor = Object.getOwnPropertyDescriptor(promise, "then");
        } else if (location === "stop") {
          promise = Promise.reject(new Error(secret));
          Object.defineProperty(promise, "constructor", {
            configurable: true,
            get: () => {
              accessorCalls += 1;
              throw new Error(secret);
            },
          });
          descriptor = Object.getOwnPropertyDescriptor(promise, "constructor");
        } else {
          class HostilePromise<T> extends Promise<T> {
            static override get [Symbol.species](): PromiseConstructor {
              speciesCalls += 1;
              throw new Error(secret);
            }
          }
          promise = HostilePromise.reject(new Error(secret));
          descriptor = Object.getOwnPropertyDescriptor(promise, "constructor");
        }

        const outcome = await runHost({
          context: { workspaceRoot: "/absolute/workspace" },
          registry: registry(
            composition(
              {
                start: () => ({
                  completion: location === "completion" ? promise : Promise.resolve(),
                  stop: () => (location === "stop" ? promise : Promise.resolve()),
                }),
              },
              workspace({ state: "missing" }),
            ),
          ),
          signalSource: {
            subscribe: () => () => (location === "unsubscribe" ? promise : undefined),
          },
        });
        const expectedCode =
          location === "completion"
            ? "host-surface-failed"
            : location === "stop"
              ? "host-surface-cleanup-failed"
              : "host-signal-cleanup-failed";
        expect("diagnostics" in outcome && outcome.diagnostics[0]?.code, location).toBe(
          expectedCode,
        );
        expect(JSON.stringify(outcome), location).not.toContain(secret);
        expect(accessorCalls, location).toBe(0);
        expect(speciesCalls, location).toBe(0);
        const descriptorName = location === "completion" ? "then" : "constructor";
        expect(Object.getOwnPropertyDescriptor(promise, descriptorName), location).toEqual(
          descriptor,
        );
      }
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("awaits resolving hostile stop and unsubscribe Promises once and restores descriptors", async () => {
    const stopGate = deferred<void>();
    const unsubscribeGate = deferred<void>();
    let accessorCalls = 0;
    let stops = 0;
    let unsubscribes = 0;
    let settled = false;
    for (const promise of [stopGate.promise, unsubscribeGate.promise]) {
      Object.defineProperty(promise, "constructor", {
        configurable: true,
        get: () => {
          accessorCalls += 1;
          throw new Error("/private/resolving-constructor-secret");
        },
      });
    }
    const stopDescriptor = Object.getOwnPropertyDescriptor(stopGate.promise, "constructor");
    const unsubscribeDescriptor = Object.getOwnPropertyDescriptor(
      unsubscribeGate.promise,
      "constructor",
    );
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition(
          {
            start: () => ({
              completion: Promise.resolve(),
              stop: () => {
                stops += 1;
                return stopGate.promise;
              },
            }),
          },
          workspace({ state: "missing" }),
        ),
      ),
      signalSource: {
        subscribe: () => () => {
          unsubscribes += 1;
          return unsubscribeGate.promise;
        },
      },
    });
    void running.then(() => {
      settled = true;
    });
    while (stops === 0) await Promise.resolve();
    expect(settled).toBeFalse();
    expect(stops).toBe(1);
    expect(Object.getOwnPropertyDescriptor(stopGate.promise, "constructor")).toEqual(
      stopDescriptor,
    );
    stopGate.resolve();
    while (unsubscribes === 0) await Promise.resolve();
    expect(settled).toBeFalse();
    expect(unsubscribes).toBe(1);
    expect(Object.getOwnPropertyDescriptor(unsubscribeGate.promise, "constructor")).toEqual(
      unsubscribeDescriptor,
    );
    unsubscribeGate.resolve();
    expect(await running).toEqual({ status: "completed" });
    expect(stops).toBe(1);
    expect(unsubscribes).toBe(1);
    expect(accessorCalls).toBe(0);
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

    const proxiedSession = new Proxy(
      { completion: Promise.resolve(), stop: async () => {} },
      {
        getPrototypeOf: () => {
          getters += 1;
          return Object.prototype;
        },
      },
    );
    const proxiedSessionOutcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition({ start: () => proxiedSession }, workspace({ state: "missing" })),
      ),
      signalSource: signals().source,
    });
    expect(proxiedSessionOutcome).toMatchObject({ status: "surface-failure" });
    expect(getters).toBe(0);
  });

  test("validates synchronous surface sessions without thenable assimilation", async () => {
    const secret = "/private/session-then-accessor";
    const signal = signals();
    let stops = 0;
    let thenCalls = 0;
    const session = {
      completion: Promise.resolve(),
      stop: async () => {
        stops += 1;
      },
    } as Record<string, unknown>;
    Object.defineProperty(session, "then", {
      configurable: true,
      enumerable: true,
      get: () => {
        thenCalls += 1;
        throw new Error(secret);
      },
    });

    const outcome = await runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: registry(
        composition({ start: () => session as never }, workspace({ state: "missing" })),
      ),
      signalSource: signal.source,
    });

    expect(outcome).toEqual({
      diagnostics: [{ code: "host-surface-start-failed", message: "Host surface start failed" }],
      status: "surface-failure",
    });
    expect({ stops, thenCalls, unsubscribes: signal.unsubscribes() }).toEqual({
      stops: 0,
      thenCalls: 0,
      unsubscribes: 1,
    });
    expect(JSON.stringify(outcome)).not.toContain(secret);
  });

  test("uses the captured apply intrinsic after asynchronous composition", async () => {
    const composeEntered = deferred<void>();
    const composed = deferred<Result<HostComposition>>();
    const signal = signals();
    const applyDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply");
    let hostileApplyCalls = 0;
    const running = runHost({
      context: { workspaceRoot: "/absolute/workspace" },
      registry: {
        compose: async () => {
          composeEntered.resolve();
          return composed.promise;
        },
      },
      signalSource: signal.source,
    });
    await composeEntered.promise;

    let outcome: Awaited<ReturnType<typeof runHost>> | undefined;
    try {
      Object.defineProperty(Reflect, "apply", {
        configurable: true,
        value: () => {
          hostileApplyCalls += 1;
          throw new Error("/private/mutable-reflect-apply");
        },
        writable: true,
      });
      composed.resolve(
        success(
          composition(
            { start: () => ({ completion: Promise.resolve(), stop: async () => {} }) },
            workspace({ state: "missing" }),
          ),
        ),
      );
      outcome = await running;
    } finally {
      if (applyDescriptor !== undefined) {
        Object.defineProperty(Reflect, "apply", applyDescriptor);
      }
    }

    expect(outcome).toEqual({ status: "completed" });
    expect(hostileApplyCalls).toBe(0);
    expect(signal.unsubscribes()).toBe(1);
  });
});
