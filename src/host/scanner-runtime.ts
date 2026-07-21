import {
  canonicalizeCompletedObservationSnapshot,
  createObservationSession,
  failure,
  observationSessionApiVersion,
  success,
  type CompletedObservationSnapshot,
  type Diagnostic,
  type EntropySource,
  type Result,
  type RunningPluginGraph,
  type TransactionRecovery,
} from "../core/index.ts";
import {
  createScannerRequest,
  scannerApiVersion,
  scannerCapabilityId,
  scannerCapabilityVersion,
  type Scanner,
  type ScannerObservationSink,
  type ScannerProjectResources,
} from "../plugin-sdk/index.ts";
import type {
  ProjectRegistrationOperations,
  ProjectRegistrationSnapshot,
} from "./local-project-registry.ts";

export const scannerExecutionApiVersion = "groma.scanner-execution/v1" as const;
export type ScannerExecutionStatus =
  "cancelled" | "completed" | "failed" | "indeterminate" | "running";
export type ScannerExecutionTerminalStatus = Exclude<ScannerExecutionStatus, "running">;
export interface ScannerExecutionInspection {
  readonly apiVersion: typeof scannerExecutionApiVersion;
  readonly batchCount: number;
  readonly epoch: string;
  readonly lastHeartbeatSequence: number;
  readonly lastSequence: number;
  readonly projectId: string;
  readonly recordCount: number;
  readonly scannerId: string;
  readonly signalCount: number;
  readonly status: ScannerExecutionStatus;
}
export interface ScannerExecutionReport extends ScannerExecutionInspection {
  readonly diagnostics: readonly Diagnostic[];
  readonly recovery?: TransactionRecovery;
  readonly status: ScannerExecutionTerminalStatus;
}
export interface ScannerExecutionSession {
  readonly completion: Promise<ScannerExecutionReport>;
  cancel(): void;
  inspect(): ScannerExecutionInspection;
}
export interface ScannerExecutionRequest {
  readonly cancellation?: AbortSignal;
  readonly projectId: string;
  readonly scannerId: string;
}
export interface ExternalObservationSubmissionRequest {
  readonly cancellation?: AbortSignal;
  readonly snapshot: unknown;
}
export interface ExternalObservationSubmissionReport {
  readonly diagnostics: readonly Diagnostic[];
  readonly project: { readonly id: string; readonly name: string };
  readonly recordCount: number;
  readonly recovery?: TransactionRecovery;
  readonly scannerId: string;
  readonly status: "completed" | "indeterminate";
}
export interface ScannerRuntimeRecoveryReport {
  readonly abandoned: number;
  readonly acknowledged: number;
  readonly consumed: number;
}
export interface CompletedObservationConsumer {
  consume(
    snapshot: CompletedObservationSnapshot,
    cancellation: AbortSignal,
  ): Promise<Result<void | CompletedObservationIndeterminate>>;
}
export interface CompletedObservationIndeterminate {
  readonly diagnostics: readonly Diagnostic[];
  readonly recovery: TransactionRecovery;
  readonly status: "indeterminate";
}
export type ScannerProjectResourcesFactory = (
  project: ProjectRegistrationSnapshot,
) => Promise<Result<ScannerProjectResources>>;
export interface ScannerExecutionRuntimeBounds {
  readonly maxDiagnostics: number;
  readonly maxDurationMilliseconds: number;
}
export interface ScannerExecutionRuntimeOptions {
  readonly bounds?: Partial<ScannerExecutionRuntimeBounds>;
  readonly consumer: CompletedObservationConsumer;
  readonly entropy: EntropySource;
  readonly plugins: RunningPluginGraph;
  readonly projectResources: ScannerProjectResourcesFactory;
  readonly projects: Pick<ProjectRegistrationOperations, "get">;
}
export interface ScannerExecutionRuntime {
  cancelAll(): Promise<readonly ScannerExecutionReport[]>;
  recover(): Promise<Result<ScannerRuntimeRecoveryReport>>;
  start(request: ScannerExecutionRequest): Promise<Result<ScannerExecutionSession>>;
  submit(
    request: ExternalObservationSubmissionRequest,
  ): Promise<Result<ExternalObservationSubmissionReport>>;
}

interface Provider {
  readonly pluginId: string;
  readonly receiver: object;
  readonly scan: Scanner["scan"];
  readonly version: string;
}
const defaults = Object.freeze({ maxDiagnostics: 32, maxDurationMilliseconds: 10 * 60_000 });
const projectPattern = /^(?:project\.default|project_[0-9a-f]{32})$/;
const scannerPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const diagnostic = (code: string, message: string): Diagnostic => Object.freeze({ code, message });

function resolveBounds(
  input?: Partial<ScannerExecutionRuntimeBounds>,
): ScannerExecutionRuntimeBounds {
  const selected = { ...defaults, ...input };
  if (
    !Number.isSafeInteger(selected.maxDiagnostics) ||
    selected.maxDiagnostics <= 0 ||
    !Number.isSafeInteger(selected.maxDurationMilliseconds) ||
    selected.maxDurationMilliseconds <= 0
  )
    throw new RangeError("Scanner runtime bounds must be positive safe integers");
  return Object.freeze(selected);
}

function epoch(entropy: EntropySource): Result<string> {
  try {
    const bytes = entropy(16);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 16) throw new Error();
    return success(
      `epoch_${[...bytes].map((value) => value.toString(16).padStart(2, "0")).join("")}`,
    );
  } catch {
    return failure(
      diagnostic("scanner-epoch-unavailable", "Scanner execution identity could not be generated"),
    );
  }
}

function providers(plugins: RunningPluginGraph): Result<ReadonlyMap<string, Provider>> {
  try {
    const manifests = new Map(plugins.inspect().plugins.map((item) => [item.id, item]));
    const result = new Map<string, Provider>();
    for (const candidate of plugins.capabilities(scannerCapabilityId, scannerCapabilityVersion)) {
      const manifest = manifests.get(candidate.pluginId);
      const value = candidate.value as Partial<Scanner> | null;
      if (
        manifest === undefined ||
        manifest.requires.length > 0 ||
        typeof value !== "object" ||
        value === null ||
        typeof value.scan !== "function" ||
        result.has(candidate.pluginId)
      )
        return failure(
          diagnostic("invalid-scanner-provider", "Scanner capability provider is invalid"),
        );
      result.set(
        candidate.pluginId,
        Object.freeze({
          pluginId: candidate.pluginId,
          receiver: value,
          scan: value.scan,
          version: manifest.version,
        }),
      );
    }
    return success(result);
  } catch {
    return failure(
      diagnostic("invalid-scanner-provider", "Scanner capability catalog is unavailable"),
    );
  }
}

function boundedDiagnostics(values: readonly Diagnostic[], maximum: number): readonly Diagnostic[] {
  return Object.freeze(
    values
      .slice(0, maximum)
      .map((item) => Object.freeze({ code: String(item.code), message: String(item.message) })),
  );
}

function scopesMatch(
  snapshot: CompletedObservationSnapshot,
  project: ProjectRegistrationSnapshot,
): boolean {
  return (
    snapshot.scopes.length === project.coverage.length &&
    snapshot.scopes.every(
      (scope, index) =>
        scope.id === project.coverage[index]?.id &&
        scope.resourceRoot === project.coverage[index]?.resourceRoot,
    )
  );
}

export function createScannerExecutionRuntime(
  options: ScannerExecutionRuntimeOptions,
): ScannerExecutionRuntime {
  const selected = resolveBounds(options.bounds);
  const catalog = providers(options.plugins);
  const active = new Map<string, ScannerExecutionSession>();
  const reservations = new Set<string>();
  let stopping = false;
  const recover = async () =>
    success(Object.freeze({ abandoned: 0, acknowledged: 0, consumed: 0 }));

  const submit = async (
    request: ExternalObservationSubmissionRequest,
  ): Promise<Result<ExternalObservationSubmissionReport>> => {
    if (stopping)
      return failure(
        diagnostic("scanner-runtime-shutting-down", "Scanner runtime is shutting down"),
      );
    if (!catalog.ok) return catalog;
    if (request.cancellation?.aborted)
      return failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"));
    const snapshot = canonicalizeCompletedObservationSnapshot(request.snapshot);
    if (!snapshot.ok) return snapshot;
    let projectResult: Result<ProjectRegistrationSnapshot>;
    try {
      projectResult = await options.projects.get({ id: snapshot.value.projectId });
    } catch {
      return failure(
        diagnostic("scanner-project-unavailable", "Scanner project registration is unavailable"),
      );
    }
    if (!projectResult.ok) return projectResult;
    const project = projectResult.value;
    if (catalog.value.has(snapshot.value.source.id)) {
      return failure(
        diagnostic(
          "external-scan-provider-conflict",
          "External observations cannot replace a loaded scanner provider's evidence",
        ),
      );
    }
    if (
      project.availability !== "available" ||
      !project.scanners.some((scanner) => scanner.id === snapshot.value.source.id) ||
      !scopesMatch(snapshot.value, project)
    ) {
      return failure(
        diagnostic(
          "external-scan-registration-mismatch",
          "External observations do not match the registered project, scanner, and coverage",
        ),
      );
    }
    const key = JSON.stringify([project.id, snapshot.value.source.id]);
    if (active.has(key) || reservations.has(key)) {
      return failure(
        diagnostic(
          "scanner-session-conflict",
          "A scanner execution is already active for this project and scanner",
        ),
      );
    }
    reservations.add(key);
    try {
      if (stopping)
        return failure(
          diagnostic("scanner-runtime-shutting-down", "Scanner runtime is shutting down"),
        );
      if (request.cancellation?.aborted)
        return failure(
          diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"),
        );
      const consumed = await Promise.resolve()
        .then(() => options.consumer.consume(snapshot.value, new AbortController().signal))
        .catch(() =>
          failure(
            diagnostic(
              "scanner-handoff-consumer-failed",
              "Completed scanner observations could not be consumed",
            ),
          ),
        );
      if (!consumed.ok) return consumed;
      return success(
        Object.freeze({
          diagnostics:
            consumed.value === undefined
              ? Object.freeze([])
              : boundedDiagnostics(consumed.value.diagnostics, selected.maxDiagnostics),
          project: Object.freeze({ id: project.id, name: project.name }),
          recordCount: snapshot.value.records.length,
          ...(consumed.value === undefined ? {} : { recovery: consumed.value.recovery }),
          scannerId: snapshot.value.source.id,
          status:
            consumed.value === undefined ? ("completed" as const) : ("indeterminate" as const),
        }),
      );
    } finally {
      reservations.delete(key);
    }
  };

  const start = async (
    request: ScannerExecutionRequest,
  ): Promise<Result<ScannerExecutionSession>> => {
    if (stopping)
      return failure(
        diagnostic("scanner-runtime-shutting-down", "Scanner runtime is shutting down"),
      );
    if (!catalog.ok) return catalog;
    if (
      typeof request !== "object" ||
      request === null ||
      !projectPattern.test(request.projectId) ||
      !scannerPattern.test(request.scannerId)
    )
      return failure(
        diagnostic("invalid-scanner-execution-request", "Scanner execution request is invalid"),
      );
    if (request.cancellation?.aborted)
      return failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"));
    let projectResult: Result<ProjectRegistrationSnapshot>;
    try {
      projectResult = await options.projects.get({ id: request.projectId });
    } catch {
      return failure(
        diagnostic("scanner-project-unavailable", "Scanner project registration is unavailable"),
      );
    }
    if (!projectResult.ok) return projectResult;
    if (stopping)
      return failure(
        diagnostic("scanner-runtime-shutting-down", "Scanner runtime is shutting down"),
      );
    if (request.cancellation?.aborted)
      return failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"));
    const project = projectResult.value;
    if (project.availability !== "available")
      return failure(
        diagnostic("scanner-project-unavailable", "Scanner project source is unavailable"),
      );
    const configured = project.scanners.find((item) => item.id === request.scannerId);
    if (configured === undefined)
      return failure(
        diagnostic("scanner-not-configured", "Scanner is not enabled for this project"),
      );
    const provider = catalog.value.get(request.scannerId);
    if (provider === undefined)
      return failure(
        diagnostic("scanner-provider-unavailable", "Configured scanner provider is unavailable"),
      );
    const key = JSON.stringify([project.id, provider.pluginId]);
    if (active.has(key) || reservations.has(key))
      return failure(
        diagnostic(
          "scanner-session-conflict",
          "A scanner execution is already active for this project and scanner",
        ),
      );
    reservations.add(key);
    function releaseReservation<T>(result: Result<T>): Result<T> {
      reservations.delete(key);
      return result;
    }
    let resources: Result<ScannerProjectResources>;
    try {
      resources = await options.projectResources(project);
    } catch {
      return releaseReservation(
        failure(
          diagnostic(
            "scanner-project-resources-unavailable",
            "Scanner project resources are unavailable",
          ),
        ),
      );
    }
    if (!resources.ok) return releaseReservation(resources);
    if (stopping)
      return releaseReservation(
        failure(diagnostic("scanner-runtime-shutting-down", "Scanner runtime is shutting down")),
      );
    if (request.cancellation?.aborted)
      return releaseReservation(
        failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled")),
      );
    const createdEpoch = epoch(options.entropy);
    if (!createdEpoch.ok) return releaseReservation(createdEpoch);
    const begin = Object.freeze({
      apiVersion: observationSessionApiVersion,
      epoch: createdEpoch.value,
      projectId: project.id,
      scopes: Object.freeze(
        project.coverage.map((scope) =>
          Object.freeze({ id: scope.id, resourceRoot: scope.resourceRoot }),
        ),
      ),
      source: Object.freeze({
        id: provider.pluginId,
        instance: "default",
        version: provider.version,
      }),
    });
    const created = createObservationSession(begin);
    if (!created.ok) return releaseReservation(created);
    const observation = created.value;
    let status: ScannerExecutionStatus = "running";
    let cancelled = false;
    let publicationStarted = false;
    const cancellationController = new AbortController();
    let resolveCancellation!: () => void;
    const cancellation = new Promise<void>((resolve) => {
      resolveCancellation = resolve;
    });
    const inspect = (): ScannerExecutionInspection => {
      const state = observation.inspect();
      return Object.freeze({
        apiVersion: scannerExecutionApiVersion,
        batchCount: state.batchCount,
        epoch: state.epoch,
        lastHeartbeatSequence: state.lastHeartbeatSequence,
        lastSequence: state.lastSequence,
        projectId: state.projectId,
        recordCount: state.recordCount,
        scannerId: provider.pluginId,
        signalCount: state.signalCount,
        status,
      });
    };
    const cancel = () => {
      if (status !== "running" || publicationStarted) return;
      cancelled = true;
      cancellationController.abort();
      observation.cancel({ epoch: begin.epoch, sequence: observation.inspect().lastSequence + 1 });
      resolveCancellation();
    };
    const sink: ScannerObservationSink = Object.freeze({
      complete(value: Parameters<ScannerObservationSink["complete"]>[0]) {
        if (cancelled)
          return failure(
            diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"),
          );
        const completed = observation.complete(value);
        return completed.ok ? success(undefined) : completed;
      },
      fail(value: Parameters<ScannerObservationSink["fail"]>[0]) {
        return cancelled
          ? failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"))
          : observation.fail(value);
      },
      heartbeat(value: Parameters<ScannerObservationSink["heartbeat"]>[0]) {
        return cancelled
          ? failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"))
          : observation.heartbeat(value);
      },
      submitBatch(value: Parameters<ScannerObservationSink["submitBatch"]>[0]) {
        return cancelled
          ? failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"))
          : observation.submitBatch(value);
      },
    });
    const scannerRequest = createScannerRequest(
      Object.freeze({
        apiVersion: scannerApiVersion,
        cancellation: Object.freeze({ isCancellationRequested: () => cancelled }),
        configuration: configured.configuration,
        observations: sink,
        resources: resources.value,
        session: begin,
      }),
    );
    if (!scannerRequest.ok) return releaseReservation(scannerRequest);
    const timeout = setTimeout(cancel, selected.maxDurationMilliseconds);
    const abort = () => cancel();
    request.cancellation?.addEventListener("abort", abort, { once: true });
    if (request.cancellation?.aborted) cancel();
    const completion = Promise.resolve().then(async (): Promise<ScannerExecutionReport> => {
      const failures: Diagnostic[] = [];
      let recovery: TransactionRecovery | undefined;
      const settled = cancelled
        ? ({ type: "cancelled" } as const)
        : await (async () => {
            let scan: Promise<unknown>;
            try {
              scan = Promise.resolve(provider.scan.call(provider.receiver, scannerRequest.value));
            } catch {
              scan = Promise.reject(new Error("scanner threw"));
            }
            return Promise.race([
              scan.then(
                (value) => ({ type: "scan" as const, value }),
                () => ({ type: "rejected" as const }),
              ),
              cancellation.then(() => ({ type: "cancelled" as const })),
            ]);
          })();
      if (settled.type === "cancelled") status = "cancelled";
      else if (
        settled.type === "rejected" ||
        typeof settled.value !== "object" ||
        settled.value === null ||
        (settled.value as { ok?: unknown }).ok !== true
      ) {
        status = "failed";
        failures.push(diagnostic("scanner-execution-failed", "Scanner execution failed"));
      } else {
        const snapshot = observation.snapshot();
        if (!snapshot.ok) {
          status = "failed";
          failures.push(
            diagnostic(
              "scanner-session-incomplete",
              "Scanner returned without completing its observation session",
            ),
          );
        } else if (cancelled) {
          status = "cancelled";
        } else {
          publicationStarted = true;
          const consumed = await Promise.resolve()
            .then(() => options.consumer.consume(snapshot.value, cancellationController.signal))
            .catch(() =>
              failure(
                diagnostic(
                  "scanner-handoff-consumer-failed",
                  "Completed scanner observations could not be consumed",
                ),
              ),
            );
          if (consumed.ok) {
            if (consumed.value === undefined) status = "completed";
            else {
              status = "indeterminate";
              recovery = consumed.value.recovery;
              failures.push(...consumed.value.diagnostics);
            }
          } else {
            status = "failed";
            failures.push(...consumed.diagnostics);
          }
        }
      }
      clearTimeout(timeout);
      request.cancellation?.removeEventListener("abort", abort);
      active.delete(key);
      return Object.freeze({
        ...inspect(),
        diagnostics: boundedDiagnostics(failures, selected.maxDiagnostics),
        ...(recovery === undefined ? {} : { recovery }),
        status: status as ScannerExecutionTerminalStatus,
      });
    });
    const session = Object.freeze({ cancel, completion, inspect });
    reservations.delete(key);
    active.set(key, session);
    return success(session);
  };

  const cancelAll = async () => {
    stopping = true;
    const sessions = [...active.values()];
    sessions.forEach((session) => session.cancel());
    return Object.freeze(await Promise.all(sessions.map((session) => session.completion)));
  };
  return Object.freeze({ cancelAll, recover, start, submit });
}
