import {
  failure,
  parseGraphGeneration,
  success,
  type Diagnostic,
  type Result,
} from "../core/index.ts";
import type {
  HostBootstrapRegistry,
  HostComposition,
  HostProcessContext,
  HostProcessSignalEmitter,
  HostRunOutcome,
  HostSignal,
  HostSignalSource,
  HostSurface,
  HostSurfaceContext,
  HostSurfaceSession,
  WorkspaceAccessCapability,
  WorkspaceRecoveryReport,
  WorkspaceStatus,
} from "./contracts.ts";
import { copyHostDiagnostics, inspectHostRecord, isHostProxy } from "./runtime-validation.ts";
import { observeNativePromise } from "../application/promise-observation.ts";

export interface RunHostOptions {
  readonly context: HostProcessContext;
  readonly registry: HostBootstrapRegistry;
  readonly signalSource: HostSignalSource;
}

interface ContainedHostSurfaceSession {
  readonly completion: Promise<{ readonly state: "completed" | "failed" }>;
  readonly stop: () => unknown;
}

const intrinsicPromise = Promise;
const intrinsicPromiseReject = Promise.reject;
const intrinsicPromiseResolve = Promise.resolve;
const intrinsicReflectApply = Reflect.apply;

function resolvedPromise(): Promise<void> {
  return intrinsicReflectApply(intrinsicPromiseResolve, intrinsicPromise, [
    undefined,
  ]) as Promise<void>;
}

function rejectedPromise(message: string): Promise<void> {
  return intrinsicReflectApply(intrinsicPromiseReject, intrinsicPromise, [new Error(message)]);
}

function observeRequiredCleanup(value: unknown, message: string): Promise<void> {
  const observed = observeNativePromise(
    value,
    () => undefined,
    () => {
      throw new Error(message);
    },
  );
  return observed.status === "observed" ? observed.promise : rejectedPromise(message);
}

function observeOptionalCleanup(value: unknown, message: string): Promise<void> {
  return value === undefined ? resolvedPromise() : observeRequiredCleanup(value, message);
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function startupFailure(code: string, message: string): HostRunOutcome {
  return Object.freeze({
    diagnostics: Object.freeze([diagnostic(code, message)]),
    status: "startup-failure",
  });
}

function surfaceFailure(code: string, message: string): HostRunOutcome {
  return Object.freeze({
    diagnostics: Object.freeze([diagnostic(code, message)]),
    status: "surface-failure",
  });
}

function cancelled(signal?: HostSignal): HostRunOutcome {
  return Object.freeze(
    signal === undefined
      ? { status: "cancelled" as const }
      : { signal, status: "cancelled" as const },
  );
}

type ValidatedRecoveryOutcome =
  | { readonly state: "failed" }
  | { readonly report: WorkspaceRecoveryReport; readonly state: "completed" };

function validatedRecoveryOutcome(value: unknown): Result<ValidatedRecoveryOutcome> {
  const result = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-host-recovery-result",
    "Workspace recovery result",
  );
  if (!result.ok) return result;
  if (result.value.ok === false) {
    const diagnostics = copyHostDiagnostics(
      result.value.diagnostics,
      100,
      "invalid-host-recovery-result",
    );
    return diagnostics.ok ? success(Object.freeze({ state: "failed" })) : diagnostics;
  }
  if (result.value.ok !== true) {
    return failure(
      diagnostic("invalid-host-recovery-result", "Workspace recovery result status is malformed"),
    );
  }
  const report = inspectHostRecord(
    result.value.value,
    [["generation", "status"]],
    "invalid-host-recovery-result",
    "Workspace recovery report",
  );
  if (!report.ok || report.value.status !== "completed") {
    return failure(
      diagnostic("invalid-host-recovery-result", "Workspace recovery report is malformed"),
    );
  }
  const generation = parseGraphGeneration(report.value.generation);
  return generation.ok
    ? success(
        Object.freeze({
          report: Object.freeze({ generation: generation.value, status: "completed" }),
          state: "completed",
        }),
      )
    : failure(
        diagnostic("invalid-host-recovery-result", "Workspace recovery generation is malformed"),
      );
}

function canonicalStatus(value: unknown): Result<WorkspaceStatus> {
  const status = inspectHostRecord(
    value,
    [["state"], ["diagnostic", "state"]],
    "invalid-host-workspace-status",
    "Workspace status",
  );
  if (!status.ok) return status;
  if (
    status.value.state === "missing" ||
    status.value.state === "configured" ||
    status.value.state === "ready"
  ) {
    return Object.hasOwn(status.value, "diagnostic")
      ? failure(diagnostic("invalid-host-workspace-status", "Workspace status is malformed"))
      : success(Object.freeze({ state: status.value.state }));
  }
  if (status.value.state === "conflict" && Object.hasOwn(status.value, "diagnostic")) {
    const sourceDiagnostic = copyHostDiagnostics(
      Object.freeze([status.value.diagnostic]),
      1,
      "invalid-host-workspace-status",
    );
    if (!sourceDiagnostic.ok) return sourceDiagnostic;
    return success(
      Object.freeze({
        diagnostic: diagnostic(
          "workspace-configuration-conflict",
          "Workspace configuration is incompatible with this host",
        ),
        state: "conflict",
      }),
    );
  }
  return failure(diagnostic("invalid-host-workspace-status", "Workspace status is malformed"));
}

function canonicalWorkspace(value: unknown): Result<WorkspaceAccessCapability> {
  const workspace = inspectHostRecord(
    value,
    [["initialize", "recover", "requireWorkspace", "status"]],
    "invalid-host-composition",
    "Workspace capability",
  );
  if (
    !workspace.ok ||
    typeof workspace.value.initialize !== "function" ||
    typeof workspace.value.recover !== "function" ||
    typeof workspace.value.requireWorkspace !== "function" ||
    typeof workspace.value.status !== "function"
  ) {
    return failure(diagnostic("invalid-host-composition", "Workspace capability is malformed"));
  }
  const source = value as object;
  const initialize = workspace.value.initialize;
  const recover = workspace.value.recover;
  const requireWorkspace = workspace.value.requireWorkspace;
  const status = workspace.value.status;
  return success(
    Object.freeze({
      initialize: () => Reflect.apply(initialize, source, []),
      recover: () => Reflect.apply(recover, source, []),
      requireWorkspace: () => Reflect.apply(requireWorkspace, source, []),
      status: () => Reflect.apply(status, source, []),
    }) as WorkspaceAccessCapability,
  );
}

function canonicalSurface(value: unknown): Result<HostSurface> {
  const surface = inspectHostRecord(value, [["start"]], "invalid-host-composition", "Host surface");
  if (!surface.ok || typeof surface.value.start !== "function") {
    return failure(diagnostic("invalid-host-composition", "Host surface is malformed"));
  }
  const source = value as object;
  const start = surface.value.start;
  return success(
    Object.freeze({
      start: (context: HostSurfaceContext) => Reflect.apply(start, source, [context]),
    }),
  );
}

function canonicalComposition(value: unknown): Result<HostComposition> {
  const composition = inspectHostRecord(
    value,
    [
      [
        "graph",
        "invariant",
        "model",
        "operations",
        "queries",
        "resourceMapper",
        "resources",
        "snapshotStateDecoder",
        "store",
        "surface",
        "transactionEngine",
        "transactionProvider",
        "workspace",
      ],
    ],
    "invalid-host-composition",
    "Host composition",
  );
  if (!composition.ok) return composition;
  const workspace = canonicalWorkspace(composition.value.workspace);
  if (!workspace.ok) return workspace;
  const surface = canonicalSurface(composition.value.surface);
  if (!surface.ok) return surface;
  for (const field of [
    "graph",
    "invariant",
    "model",
    "operations",
    "queries",
    "resourceMapper",
    "resources",
    "snapshotStateDecoder",
    "store",
    "transactionEngine",
    "transactionProvider",
  ] as const) {
    if (
      typeof composition.value[field] !== "object" ||
      composition.value[field] === null ||
      isHostProxy(composition.value[field])
    ) {
      return failure(diagnostic("invalid-host-composition", "Host composition is malformed"));
    }
  }
  return success(
    Object.freeze({
      graph: composition.value.graph,
      invariant: composition.value.invariant,
      model: composition.value.model,
      operations: composition.value.operations,
      queries: composition.value.queries,
      resourceMapper: composition.value.resourceMapper,
      resources: composition.value.resources,
      snapshotStateDecoder: composition.value.snapshotStateDecoder,
      store: composition.value.store,
      surface: surface.value,
      transactionEngine: composition.value.transactionEngine,
      transactionProvider: composition.value.transactionProvider,
      workspace: workspace.value,
    }) as HostComposition,
  );
}

function canonicalRegistry(
  value: unknown,
): Result<(context: HostProcessContext) => Promise<unknown>> {
  const registry = inspectHostRecord(
    value,
    [["compose"]],
    "invalid-host-bootstrap-registry",
    "Host bootstrap registry",
  );
  if (!registry.ok || typeof registry.value.compose !== "function") {
    return failure(
      diagnostic("invalid-host-bootstrap-registry", "Host bootstrap registry is malformed"),
    );
  }
  const source = value as object;
  const compose = registry.value.compose;
  return success((context) => Promise.resolve(Reflect.apply(compose, source, [context])));
}

function canonicalSignalSource(
  value: unknown,
): Result<(listener: (signal: HostSignal) => void) => unknown> {
  const source = inspectHostRecord(
    value,
    [["subscribe"]],
    "invalid-host-signal-source",
    "Host signal source",
  );
  if (!source.ok || typeof source.value.subscribe !== "function") {
    return failure(diagnostic("invalid-host-signal-source", "Host signal source is malformed"));
  }
  const receiver = value as object;
  const subscribe = source.value.subscribe;
  return success((listener) => Reflect.apply(subscribe, receiver, [listener]));
}

function canonicalSession(value: unknown): Result<ContainedHostSurfaceSession> {
  const session = inspectHostRecord(
    value,
    [["completion", "stop"]],
    "invalid-host-surface-session",
    "Host surface session",
  );
  if (
    !session.ok ||
    typeof session.value.stop !== "function" ||
    isHostProxy(session.value.completion)
  ) {
    return failure(
      diagnostic("invalid-host-surface-session", "Host surface returned a malformed session"),
    );
  }
  const source = value as object;
  const completion = observeNativePromise<{ readonly state: "completed" | "failed" }>(
    session.value.completion,
    () => ({ state: "completed" as const }),
    () => ({ state: "failed" as const }),
  );
  if (completion.status !== "observed") {
    return failure(
      diagnostic("invalid-host-surface-session", "Host surface returned a malformed session"),
    );
  }
  const stop = session.value.stop;
  return success(
    Object.freeze({
      completion: completion.promise,
      stop: () => intrinsicReflectApply(stop, source, []),
    }),
  );
}

export function createProcessSignalSource(
  emitter: HostProcessSignalEmitter = process,
): HostSignalSource {
  return Object.freeze({
    subscribe(listener: (signal: HostSignal) => void) {
      const interrupt = () => listener("SIGINT");
      const terminate = () => listener("SIGTERM");
      try {
        emitter.on("SIGINT", interrupt);
      } catch {
        try {
          emitter.off("SIGINT", interrupt);
        } catch {
          // Registration rollback is best-effort; the original failure remains authoritative.
        }
        throw new Error("Process signal registration failed");
      }
      try {
        emitter.on("SIGTERM", terminate);
      } catch {
        for (const [signal, registered] of [
          ["SIGTERM", terminate],
          ["SIGINT", interrupt],
        ] as const) {
          try {
            emitter.off(signal, registered);
          } catch {
            // Registration rollback is best-effort; the original failure remains authoritative.
          }
        }
        throw new Error("Process signal registration failed");
      }
      let interruptRegistered = true;
      let terminateRegistered = true;
      return () => {
        let failed = false;
        if (interruptRegistered) {
          try {
            emitter.off("SIGINT", interrupt);
            interruptRegistered = false;
          } catch {
            failed = true;
          }
        }
        if (terminateRegistered) {
          try {
            emitter.off("SIGTERM", terminate);
            terminateRegistered = false;
          } catch {
            failed = true;
          }
        }
        if (failed) throw new Error("Process signal cleanup failed");
      };
    },
  });
}

export async function runHost(options: RunHostOptions): Promise<HostRunOutcome> {
  const registry = canonicalRegistry(options.registry);
  if (!registry.ok) {
    return startupFailure(
      "invalid-host-bootstrap-registry",
      "Host bootstrap registry is malformed",
    );
  }
  const signalSource = canonicalSignalSource(options.signalSource);
  if (!signalSource.ok) {
    return startupFailure("invalid-host-signal-source", "Host signal source is malformed");
  }

  const hostCancellation = new AbortController();
  let cancellationSignal: HostSignal | undefined;
  let resolveCancellation!: () => void;
  const cancellation = new Promise<void>((resolve) => {
    resolveCancellation = resolve;
  });
  const requestCancellation = (signal?: HostSignal) => {
    if (hostCancellation.signal.aborted) return;
    cancellationSignal = signal;
    hostCancellation.abort();
    resolveCancellation();
  };
  const onAbort = () => requestCancellation();
  options.context.cancellation?.addEventListener("abort", onAbort, { once: true });
  if (options.context.cancellation?.aborted) requestCancellation();

  let unsubscribe: (() => void | Promise<void>) | undefined;
  let session: ContainedHostSurfaceSession | undefined;
  let stopPromise: Promise<void> | undefined;
  const stopOnce = (): Promise<void> => {
    if (stopPromise !== undefined) return stopPromise;
    if (session === undefined) return resolvedPromise();
    try {
      stopPromise = observeRequiredCleanup(session.stop(), "Host surface cleanup failed");
    } catch {
      stopPromise = rejectedPromise("Host surface cleanup failed");
    }
    return stopPromise;
  };

  let outcome: HostRunOutcome = startupFailure("host-startup-failed", "Host startup failed");
  try {
    const subscribed = signalSource.value((signal) => requestCancellation(signal));
    if (typeof subscribed !== "function") {
      outcome = startupFailure(
        "invalid-host-signal-source",
        "Host signal source returned malformed cleanup",
      );
    } else {
      unsubscribe = () => Reflect.apply(subscribed, undefined, []) as void | Promise<void>;
      if (hostCancellation.signal.aborted) {
        outcome = cancelled(cancellationSignal);
      } else {
        let rawComposition: unknown;
        try {
          rawComposition = await registry.value(options.context);
        } catch {
          rawComposition = undefined;
        }
        const result = inspectHostRecord(
          rawComposition,
          [
            ["ok", "value"],
            ["diagnostics", "ok"],
          ],
          "invalid-host-bootstrap-result",
          "Host bootstrap result",
        );
        if (!result.ok || result.value.ok !== true) {
          outcome = startupFailure("host-bootstrap-failed", "Host bootstrap failed");
        } else {
          const composition = canonicalComposition(result.value.value);
          if (!composition.ok) {
            outcome = startupFailure(
              "invalid-host-composition",
              "Host bootstrap returned malformed capabilities",
            );
          } else if (hostCancellation.signal.aborted) {
            outcome = cancelled(cancellationSignal);
          } else {
            const rawStatus = composition.value.workspace.status();
            const status = canonicalStatus(rawStatus);
            let recovery: "completed" | "not-required" | undefined;
            if (!status.ok) {
              outcome = startupFailure(
                "invalid-host-workspace-status",
                "Workspace status capability returned malformed state",
              );
            } else if (status.value.state === "missing") {
              recovery = "not-required";
            } else if (status.value.state === "conflict") {
              outcome = startupFailure(
                "workspace-configuration-conflict",
                "Workspace configuration is incompatible with this host",
              );
            } else {
              const recovered = validatedRecoveryOutcome(
                await composition.value.workspace.recover(),
              );
              if (!recovered.ok) {
                outcome = startupFailure(
                  "invalid-host-recovery-result",
                  "Workspace recovery capability returned a malformed result",
                );
              } else if (recovered.value.state === "failed") {
                outcome = startupFailure("workspace-recovery-failed", "Workspace recovery failed");
              } else {
                recovery = "completed";
              }
            }

            if (recovery !== undefined) {
              if (hostCancellation.signal.aborted) {
                outcome = cancelled(cancellationSignal);
              } else {
                const context = Object.freeze({
                  cancellation: hostCancellation.signal,
                  recovery: Object.freeze({ status: recovery }),
                  workspace: composition.value.workspace,
                });
                const start = Promise.resolve()
                  .then(() => composition.value.surface.start(context))
                  .then(
                    (value) => {
                      const validated = canonicalSession(value);
                      return validated.ok
                        ? ({ session: validated.value, state: "started" } as const)
                        : ({ state: "invalid" } as const);
                    },
                    () => ({ state: "failed" as const }),
                  );
                const first = await Promise.race([
                  start,
                  cancellation.then(() => ({ state: "cancelled" as const })),
                ]);
                if (first.state === "cancelled") {
                  void start.then(
                    async (late) => {
                      if (late.state !== "started") return;
                      try {
                        void late.session.completion;
                        await observeRequiredCleanup(
                          late.session.stop(),
                          "Host surface cleanup failed",
                        );
                      } catch {
                        // Late completion and cleanup are contained after cancellation returns.
                      }
                    },
                    () => undefined,
                  );
                  outcome = cancelled(cancellationSignal);
                } else if (first.state !== "started") {
                  outcome = surfaceFailure(
                    "host-surface-start-failed",
                    "Host surface start failed",
                  );
                } else {
                  session = first.session;
                  const completed = first.session.completion;
                  const winner = await Promise.race([
                    completed,
                    cancellation.then(() => ({ state: "cancelled" as const })),
                  ]);
                  if (winner.state === "cancelled") {
                    await stopOnce();
                    outcome = cancelled(cancellationSignal);
                  } else if (winner.state === "failed") {
                    outcome = surfaceFailure("host-surface-failed", "Host surface session failed");
                  } else {
                    outcome = Object.freeze({ status: "completed" });
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch {
    outcome =
      session === undefined
        ? startupFailure("host-startup-failed", "Host startup failed")
        : surfaceFailure("host-surface-failed", "Host surface session failed");
  }

  try {
    await stopOnce();
  } catch {
    outcome = surfaceFailure("host-surface-cleanup-failed", "Host surface cleanup failed");
  }
  options.context.cancellation?.removeEventListener("abort", onAbort);
  if (unsubscribe !== undefined) {
    try {
      await observeOptionalCleanup(unsubscribe(), "Host signal cleanup failed");
    } catch {
      outcome = surfaceFailure("host-signal-cleanup-failed", "Host signal cleanup failed");
    }
  }
  return outcome;
}
