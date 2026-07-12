import { type Diagnostic } from "../core/index.ts";
import type {
  HostComposition,
  HostRunOutcome,
  HostSignal,
  HostSignalSource,
  HostSurfaceSession,
} from "./contracts.ts";
import type { HostBootstrapRegistry, HostProcessContext } from "./contracts.ts";

export interface RunHostOptions {
  readonly context: HostProcessContext;
  readonly registry: HostBootstrapRegistry;
  readonly signalSource: HostSignalSource;
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function isSession(value: unknown): value is HostSurfaceSession {
  if (typeof value !== "object" || value === null) return false;
  try {
    const candidate = value as Partial<HostSurfaceSession>;
    return (
      typeof candidate.stop === "function" &&
      typeof candidate.completion === "object" &&
      candidate.completion !== null &&
      typeof candidate.completion.then === "function"
    );
  } catch {
    return false;
  }
}

function isComposition(value: unknown): value is HostComposition {
  if (typeof value !== "object" || value === null) return false;
  try {
    const candidate = value as Partial<HostComposition>;
    return (
      typeof candidate.surface === "object" &&
      candidate.surface !== null &&
      typeof candidate.surface.start === "function" &&
      typeof candidate.workspace === "object" &&
      candidate.workspace !== null &&
      typeof candidate.workspace.recover === "function" &&
      typeof candidate.workspace.status === "function"
    );
  } catch {
    return false;
  }
}

export function createProcessSignalSource(): HostSignalSource {
  return Object.freeze({
    subscribe(listener: (signal: HostSignal) => void) {
      const interrupt = () => listener("SIGINT");
      const terminate = () => listener("SIGTERM");
      process.on("SIGINT", interrupt);
      process.on("SIGTERM", terminate);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        process.off("SIGINT", interrupt);
        process.off("SIGTERM", terminate);
      };
    },
  });
}

export async function runHost(options: RunHostOptions): Promise<HostRunOutcome> {
  let cancelled = options.context.cancellation?.aborted ?? false;
  let cancellationSignal: HostSignal | undefined;
  let resolveCancellation!: () => void;
  const cancellation = new Promise<void>((resolve) => {
    resolveCancellation = resolve;
  });
  if (cancelled) resolveCancellation();
  const requestCancellation = (signal?: HostSignal) => {
    if (cancelled) return;
    cancelled = true;
    cancellationSignal = signal;
    resolveCancellation();
  };

  let unsubscribe: (() => void) | undefined;
  const onAbort = () => requestCancellation();
  let session: HostSurfaceSession | undefined;
  let stopPromise: Promise<void> | undefined;
  const stopOnce = (): Promise<void> => {
    if (stopPromise !== undefined) return stopPromise;
    if (session === undefined) return Promise.resolve();
    try {
      stopPromise = Promise.resolve(session.stop());
    } catch (error) {
      stopPromise = Promise.reject(error);
    }
    return stopPromise;
  };

  let outcome: HostRunOutcome = {
    diagnostics: [diagnostic("host-startup-failed", "Host startup failed")],
    status: "startup-failure",
  };
  try {
    const subscribed = options.signalSource.subscribe((signal) => requestCancellation(signal));
    if (typeof subscribed !== "function") {
      outcome = {
        diagnostics: [
          diagnostic("invalid-host-signal-source", "Host signal source returned malformed cleanup"),
        ],
        status: "startup-failure",
      };
    } else {
      unsubscribe = subscribed;
      options.context.cancellation?.addEventListener("abort", onAbort, { once: true });
      if (options.context.cancellation?.aborted) requestCancellation();
      if (cancelled) {
        outcome =
          cancellationSignal === undefined
            ? { status: "cancelled" }
            : { signal: cancellationSignal, status: "cancelled" };
      } else {
        const composed = await options.registry.compose(options.context);
        if (typeof composed !== "object" || composed === null || typeof composed.ok !== "boolean") {
          outcome = {
            diagnostics: [
              diagnostic(
                "invalid-host-bootstrap-result",
                "Host bootstrap registry returned a malformed result",
              ),
            ],
            status: "startup-failure",
          };
        } else if (!composed.ok) {
          outcome = { diagnostics: composed.diagnostics, status: "startup-failure" };
        } else if (!isComposition(composed.value)) {
          outcome = {
            diagnostics: [
              diagnostic(
                "invalid-host-composition",
                "Host bootstrap registry returned malformed capabilities",
              ),
            ],
            status: "startup-failure",
          };
        } else if (cancelled) {
          outcome =
            cancellationSignal === undefined
              ? { status: "cancelled" }
              : { signal: cancellationSignal, status: "cancelled" };
        } else {
          const composition = composed.value;
          const workspaceStatus = composition.workspace.status();
          let recovery: "completed" | "not-required" | undefined;
          if (workspaceStatus.state === "missing") {
            recovery = "not-required";
          } else if (workspaceStatus.state === "conflict") {
            outcome = {
              diagnostics: [workspaceStatus.diagnostic],
              status: "startup-failure",
            };
          } else if (workspaceStatus.state === "ready") {
            recovery = "completed";
          } else {
            const recovered = await composition.workspace.recover();
            if (!recovered.ok) {
              outcome = { diagnostics: recovered.diagnostics, status: "startup-failure" };
            } else {
              recovery = "completed";
            }
          }

          if (recovery !== undefined) {
            if (cancelled) {
              outcome =
                cancellationSignal === undefined
                  ? { status: "cancelled" }
                  : { signal: cancellationSignal, status: "cancelled" };
            } else {
              const started = await composition.surface.start({
                recovery: Object.freeze({ status: recovery }),
                workspace: composition.workspace,
              });
              if (!isSession(started)) {
                outcome = {
                  diagnostics: [
                    diagnostic(
                      "invalid-host-surface-session",
                      "Host surface returned a malformed session",
                    ),
                  ],
                  status: "surface-failure",
                };
              } else {
                session = started;
                const settled = Promise.resolve(started.completion).then(
                  () => ({ state: "completed" as const }),
                  () => ({ state: "failed" as const }),
                );
                const winner = await Promise.race([
                  settled,
                  cancellation.then(() => ({ state: "cancelled" as const })),
                ]);
                if (winner.state === "cancelled") {
                  await stopOnce();
                  outcome =
                    cancellationSignal === undefined
                      ? { status: "cancelled" }
                      : { signal: cancellationSignal, status: "cancelled" };
                } else if (winner.state === "failed") {
                  outcome = {
                    diagnostics: [diagnostic("host-surface-failed", "Host surface session failed")],
                    status: "surface-failure",
                  };
                } else {
                  outcome = { status: "completed" };
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
        ? {
            diagnostics: [diagnostic("host-startup-failed", "Host startup failed")],
            status: "startup-failure",
          }
        : {
            diagnostics: [diagnostic("host-surface-failed", "Host surface session failed")],
            status: "surface-failure",
          };
  }

  try {
    await stopOnce();
  } catch {
    outcome = {
      diagnostics: [diagnostic("host-surface-cleanup-failed", "Host surface cleanup failed")],
      status: "surface-failure",
    };
  }
  options.context.cancellation?.removeEventListener("abort", onAbort);
  if (unsubscribe !== undefined) {
    try {
      unsubscribe();
    } catch {
      outcome = {
        diagnostics: [diagnostic("host-signal-cleanup-failed", "Host signal cleanup failed")],
        status: "surface-failure",
      };
    }
  }
  return outcome;
}
