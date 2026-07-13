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
  HostInitializationOperations,
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
import {
  observeNativePromise,
  type NativePromiseObservation,
} from "../application/promise-observation.ts";

export interface RunHostOptions {
  readonly context: HostProcessContext;
  readonly registry: HostBootstrapRegistry;
  readonly signalSource: HostSignalSource;
}

interface ContainedHostSurfaceSession {
  readonly completion: Promise<{ readonly state: "completed" | "failed" }>;
  readonly stop: () => unknown;
}

interface ContainedHostComposition extends HostComposition {
  readonly initialization: HostInitializationOperations;
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

function resolvedValue<TValue>(value: TValue): Promise<TValue> {
  return intrinsicReflectApply(intrinsicPromiseResolve, intrinsicPromise, [
    value,
  ]) as Promise<TValue>;
}

function rejectedPromise(message: string): Promise<void> {
  return intrinsicReflectApply(intrinsicPromiseReject, intrinsicPromise, [new Error(message)]);
}

function observeHostNativePromise<TResult>(
  value: unknown,
  fulfilled: (value: unknown) => TResult,
  rejected: (reason: unknown) => TResult,
): NativePromiseObservation<TResult> {
  return isHostProxy(value)
    ? { status: "uncontained" }
    : observeNativePromise(value, fulfilled, rejected);
}

function observeRequiredCleanup(value: unknown, message: string): Promise<void> {
  const observed = observeHostNativePromise(
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

function isExactSynchronousVoid(value: unknown): value is undefined {
  if (value === undefined) return true;
  observeHostNativePromise(
    value,
    () => undefined,
    () => undefined,
  );
  return false;
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

type ObservedBootstrapOutcome =
  | { readonly state: "bootstrap-failed" }
  | { readonly state: "cancelled" }
  | { readonly state: "invalid-composition" }
  | { readonly composition: ContainedHostComposition; readonly state: "composed" };

type ObservedRecoveryOutcome =
  | { readonly state: "cancelled" }
  | { readonly state: "malformed" }
  | { readonly state: "rejected" }
  | { readonly recovered: ValidatedRecoveryOutcome; readonly state: "validated" };

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
    const providerFailure =
      sourceDiagnostic.value[0]?.code === "workspace-configuration-provider-failure";
    return success(
      Object.freeze({
        diagnostic: providerFailure
          ? diagnostic(
              "workspace-configuration-provider-failure",
              "Workspace configuration access failed",
            )
          : diagnostic(
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
      initialize: () => intrinsicReflectApply(initialize, source, []),
      recover: () => intrinsicReflectApply(recover, source, []),
      requireWorkspace: () => intrinsicReflectApply(requireWorkspace, source, []),
      status: () => intrinsicReflectApply(status, source, []),
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
      start: (context: HostSurfaceContext) => intrinsicReflectApply(start, source, [context]),
    }),
  );
}

function canonicalInitializationOperations(value: unknown): Result<HostInitializationOperations> {
  const operations = inspectHostRecord(
    value,
    [
      [
        "createComponent",
        "getComponent",
        "initialize",
        "listChildren",
        "listComponents",
        "listRoots",
        "removeComponent",
        "reparentComponent",
        "updateComponent",
      ],
    ],
    "invalid-host-composition",
    "Application operations",
  );
  if (
    !operations.ok ||
    typeof operations.value.createComponent !== "function" ||
    typeof operations.value.getComponent !== "function" ||
    typeof operations.value.initialize !== "function" ||
    typeof operations.value.listChildren !== "function" ||
    typeof operations.value.listComponents !== "function" ||
    typeof operations.value.listRoots !== "function" ||
    typeof operations.value.removeComponent !== "function" ||
    typeof operations.value.reparentComponent !== "function" ||
    typeof operations.value.updateComponent !== "function"
  ) {
    return failure(diagnostic("invalid-host-composition", "Application operations are malformed"));
  }
  const source = value as object;
  const initialize = operations.value.initialize;
  return success(
    Object.freeze({
      initialize: (request: Parameters<HostInitializationOperations["initialize"]>[0]) =>
        intrinsicReflectApply(initialize, source, [request]),
    }) as HostInitializationOperations,
  );
}

function canonicalComposition(value: unknown): Result<ContainedHostComposition> {
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
  const initialization = canonicalInitializationOperations(composition.value.operations);
  if (!initialization.ok) return initialization;
  for (const field of [
    "graph",
    "invariant",
    "model",
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
      initialization: initialization.value,
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
    }) as ContainedHostComposition,
  );
}

function canonicalRegistry(value: unknown): Result<(context: HostProcessContext) => unknown> {
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
  return success((context) => intrinsicReflectApply(compose, source, [context]));
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
  return success((listener) => intrinsicReflectApply(subscribe, receiver, [listener]));
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
  const completion = observeHostNativePromise<{ readonly state: "completed" | "failed" }>(
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

type ObservedSurfaceStartOutcome =
  | { readonly state: "failed" | "invalid" }
  | { readonly session: ContainedHostSurfaceSession; readonly state: "started" };

function validatedSurfaceStart(value: unknown): ObservedSurfaceStartOutcome {
  const validated = canonicalSession(value);
  return validated.ok ? { session: validated.value, state: "started" } : { state: "invalid" };
}

function observeSurfaceStart(value: unknown): Promise<ObservedSurfaceStartOutcome> {
  if (isHostProxy(value)) return resolvedValue({ state: "invalid" });
  const observed = observeHostNativePromise<ObservedSurfaceStartOutcome>(
    value,
    validatedSurfaceStart,
    () => ({ state: "failed" }),
  );
  if (observed.status === "observed") return observed.promise;
  return resolvedValue(
    observed.status === "not-native" ? validatedSurfaceStart(value) : { state: "invalid" },
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
  const requestCancellation = (signal?: unknown) => {
    if (hostCancellation.signal.aborted) return;
    cancellationSignal = signal === "SIGINT" || signal === "SIGTERM" ? signal : undefined;
    hostCancellation.abort();
    resolveCancellation();
  };
  const hostContext: HostProcessContext = Object.freeze({
    cancellation: hostCancellation.signal,
    workspaceRoot: options.context.workspaceRoot,
  });
  const onAbort = () => requestCancellation();
  let externalCancellation: AbortSignal | undefined;
  let externalCancellationMayBeRegistered = false;

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
    externalCancellation = options.context.cancellation;
    if (externalCancellation !== undefined) {
      externalCancellationMayBeRegistered = true;
      const registered = externalCancellation.addEventListener("abort", onAbort, { once: true });
      if (!isExactSynchronousVoid(registered)) {
        throw new Error("Host cancellation listener registration was malformed");
      }
      if (externalCancellation.aborted) requestCancellation();
    }
    const subscribed = signalSource.value((signal) => requestCancellation(signal));
    if (typeof subscribed !== "function") {
      outcome = startupFailure(
        "invalid-host-signal-source",
        "Host signal source returned malformed cleanup",
      );
    } else {
      unsubscribe = () => intrinsicReflectApply(subscribed, undefined, []) as void | Promise<void>;
      if (hostCancellation.signal.aborted) {
        outcome = cancelled(cancellationSignal);
      } else {
        let rawComposition: unknown;
        try {
          rawComposition = registry.value(hostContext);
        } catch {
          rawComposition = undefined;
        }
        const composed = observeHostNativePromise<ObservedBootstrapOutcome>(
          rawComposition,
          (value) => {
            if (hostCancellation.signal.aborted) return { state: "cancelled" as const };
            const result = inspectHostRecord(
              value,
              [
                ["ok", "value"],
                ["diagnostics", "ok"],
              ],
              "invalid-host-bootstrap-result",
              "Host bootstrap result",
            );
            if (!result.ok || result.value.ok !== true) {
              return { state: "bootstrap-failed" as const };
            }
            const composition = canonicalComposition(result.value.value);
            return composition.ok
              ? ({ composition: composition.value, state: "composed" } as const)
              : ({ state: "invalid-composition" } as const);
          },
          () => ({ state: "bootstrap-failed" as const }),
        );
        if (composed.status !== "observed") {
          outcome = hostCancellation.signal.aborted
            ? cancelled(cancellationSignal)
            : startupFailure("host-bootstrap-failed", "Host bootstrap failed");
        } else {
          const first = await Promise.race([
            composed.promise,
            cancellation.then(() => ({ state: "cancelled" as const })),
          ]);
          if (first.state === "cancelled") {
            outcome = cancelled(cancellationSignal);
          } else if (first.state === "bootstrap-failed") {
            outcome = startupFailure("host-bootstrap-failed", "Host bootstrap failed");
          } else if (first.state === "invalid-composition") {
            outcome = startupFailure(
              "invalid-host-composition",
              "Host bootstrap returned malformed capabilities",
            );
          } else if (hostCancellation.signal.aborted) {
            outcome = cancelled(cancellationSignal);
          } else {
            const composition = first.composition;
            const rawStatus = composition.workspace.status();
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
              outcome =
                status.value.diagnostic.code === "workspace-configuration-provider-failure"
                  ? startupFailure(
                      "workspace-configuration-provider-failure",
                      "Workspace configuration access failed",
                    )
                  : startupFailure(
                      "workspace-configuration-conflict",
                      "Workspace configuration is incompatible with this host",
                    );
            } else if (hostCancellation.signal.aborted) {
              outcome = cancelled(cancellationSignal);
            } else {
              let rawRecovery: unknown;
              try {
                rawRecovery = composition.workspace.recover();
              } catch {
                rawRecovery = undefined;
              }
              const observedRecovery = observeHostNativePromise<ObservedRecoveryOutcome>(
                rawRecovery,
                (value) => {
                  if (hostCancellation.signal.aborted) return { state: "cancelled" as const };
                  const recovered = validatedRecoveryOutcome(value);
                  return recovered.ok
                    ? ({ recovered: recovered.value, state: "validated" } as const)
                    : ({ state: "malformed" } as const);
                },
                () => ({ state: "rejected" as const }),
              );
              if (observedRecovery.status !== "observed") {
                outcome = hostCancellation.signal.aborted
                  ? cancelled(cancellationSignal)
                  : startupFailure(
                      "invalid-host-recovery-result",
                      "Workspace recovery capability returned a malformed result",
                    );
              } else {
                const recovered = await Promise.race([
                  observedRecovery.promise,
                  cancellation.then(() => ({ state: "cancelled" as const })),
                ]);
                if (recovered.state === "cancelled") {
                  outcome = cancelled(cancellationSignal);
                } else if (recovered.state === "malformed") {
                  outcome = startupFailure(
                    "invalid-host-recovery-result",
                    "Workspace recovery capability returned a malformed result",
                  );
                } else if (recovered.state === "rejected") {
                  outcome = startupFailure(
                    "workspace-recovery-failed",
                    "Workspace recovery failed",
                  );
                } else if (recovered.recovered.state === "failed") {
                  outcome = startupFailure(
                    "workspace-recovery-failed",
                    "Workspace recovery failed",
                  );
                } else {
                  recovery = "completed";
                }
              }
            }

            if (recovery !== undefined) {
              if (hostCancellation.signal.aborted) {
                outcome = cancelled(cancellationSignal);
              } else {
                const context = Object.freeze({
                  cancellation: hostCancellation.signal,
                  initialization: composition.initialization,
                  recovery: Object.freeze({ status: recovery }),
                  workspace: composition.workspace,
                });
                let start: Promise<ObservedSurfaceStartOutcome>;
                try {
                  start = observeSurfaceStart(composition.surface.start(context));
                } catch {
                  start = resolvedValue({ state: "failed" });
                }
                const first = await Promise.race([
                  start,
                  cancellation.then(() => ({ state: "cancelled" as const })),
                ]);
                if (first.state === "cancelled") {
                  void start.then(
                    async (late) => {
                      if (late.state !== "started") return;
                      try {
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
  if (externalCancellationMayBeRegistered && externalCancellation !== undefined) {
    try {
      const removed = externalCancellation.removeEventListener("abort", onAbort);
      if (!isExactSynchronousVoid(removed)) {
        throw new Error("Host cancellation listener cleanup was malformed");
      }
    } catch {
      outcome = surfaceFailure(
        "host-cancellation-cleanup-failed",
        "Host cancellation cleanup failed",
      );
    }
  }
  if (unsubscribe !== undefined) {
    try {
      await observeOptionalCleanup(unsubscribe(), "Host signal cleanup failed");
    } catch {
      outcome = surfaceFailure("host-signal-cleanup-failed", "Host signal cleanup failed");
    }
  }
  return outcome;
}
