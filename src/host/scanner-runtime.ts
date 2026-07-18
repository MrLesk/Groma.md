import {
  createObservationSession,
  failure,
  observationSessionApiVersion,
  observeNativePromise,
  success,
  type CompletedObservationSnapshot,
  type Diagnostic,
  type EntropySource,
  type ObservationBatch,
  type ObservationBatchReceipt,
  type ObservationCompletion,
  type ObservationFailure,
  type ObservationHeartbeat,
  type ObservationSession,
  type ObservationSessionBegin,
  type ObservationSessionCheckpointTransition,
  type PluginCapabilityProvider,
  type Result,
  type RunningPluginGraph,
} from "../core/index.ts";
import {
  localObservationJournalSessionBounds,
  type DurableObservationSession,
  type LocalObservationJournal,
  type ObservationHandoff,
  type ObservationJournalRecovery,
  type ObservationLaneRequest,
} from "../persistence/index.ts";
import {
  createScannerRequest,
  scannerApiVersion,
  scannerCapabilityId,
  scannerCapabilityVersion,
  type Scanner,
  type ScannerObservationSink,
  type ScannerProjectResources,
  type ScannerRequest,
} from "../plugin-sdk/index.ts";
import type {
  ProjectRegistrationOperations,
  ProjectRegistrationSnapshot,
} from "./local-project-registry.ts";
import { canonicalizeProjectRegistration } from "./bootstrap-configuration.ts";
import { copyHostDiagnostics, inspectHostRecord, isHostProxy } from "./runtime-validation.ts";

export const scannerExecutionApiVersion = "groma.scanner-execution/v1" as const;

export type ScannerExecutionStatus =
  | "cancelled"
  | "completed"
  | "completing"
  | "delivering"
  | "draining"
  | "expired"
  | "failed"
  | "running";

export type ScannerExecutionTerminalStatus = Extract<
  ScannerExecutionStatus,
  "cancelled" | "completed" | "expired" | "failed"
>;

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

export interface ScannerRuntimeRecoveryReport {
  readonly abandoned: number;
  readonly acknowledged: number;
  readonly consumed: number;
}

export interface CompletedObservationConsumer {
  /**
   * Delivery is at least once until the durable handoff is acknowledged. Consumers
   * must handle repeated delivery of the same completed snapshot idempotently.
   */
  consume(snapshot: CompletedObservationSnapshot): Promise<Result<void>>;
}

export type ScannerProjectResourcesFactory = (
  project: ProjectRegistrationSnapshot,
) => Promise<Result<ScannerProjectResources>>;

export interface ScannerRuntimeTimer {
  cancel(): void;
}

export interface ScannerRuntimeScheduler {
  schedule(delayMilliseconds: number, callback: () => void): ScannerRuntimeTimer;
}

export interface ScannerExecutionRuntimeBounds {
  readonly heartbeatTimeoutMilliseconds: number;
  readonly maxDiagnostics: number;
  readonly maxDurationMilliseconds: number;
  readonly maxEpochAttempts: number;
}

export interface ScannerExecutionRuntimeOptions {
  readonly bounds?: Partial<ScannerExecutionRuntimeBounds>;
  readonly consumer: CompletedObservationConsumer;
  readonly entropy: EntropySource;
  readonly journal: LocalObservationJournal;
  readonly plugins: RunningPluginGraph;
  readonly projectResources: ScannerProjectResourcesFactory;
  readonly projects: Pick<ProjectRegistrationOperations, "get">;
  readonly scheduler?: ScannerRuntimeScheduler;
}

export interface ScannerExecutionRuntime {
  cancelAll(): Promise<readonly ScannerExecutionReport[]>;
  recover(): Promise<Result<ScannerRuntimeRecoveryReport>>;
  start(request: ScannerExecutionRequest): Promise<Result<ScannerExecutionSession>>;
}

interface CanonicalScannerProvider {
  readonly pluginId: string;
  readonly receiver: object;
  readonly scan: Scanner["scan"];
  readonly version: string;
}

interface LaneRecoveryWork {
  readonly abandoned: ObservationJournalRecovery["abandoned"];
  readonly acknowledged: ObservationJournalRecovery["acknowledged"];
  readonly handoffs: ObservationJournalRecovery["handoffs"];
}

type ExecutionCause =
  | Readonly<{ readonly diagnostics: readonly Diagnostic[]; readonly type: "cancelled" }>
  | Readonly<{ readonly diagnostics: readonly Diagnostic[]; readonly type: "expired" }>
  | Readonly<{ readonly diagnostics: readonly Diagnostic[]; readonly type: "failed" }>;

type ScannerSettlement =
  | Readonly<{ readonly result: Result<void>; readonly type: "settled" }>
  | Readonly<{ readonly diagnostics: readonly Diagnostic[]; readonly type: "invalid" }>;

type ExecutionOperationOutcome<T> =
  | Readonly<{ readonly result: Result<T>; readonly type: "settled" }>
  | Readonly<{
      readonly cause: ExecutionCause;
      readonly operation: string;
      readonly type: "interrupted";
    }>;

const defaultBounds: ScannerExecutionRuntimeBounds = Object.freeze({
  heartbeatTimeoutMilliseconds: 30_000,
  maxDiagnostics: 64,
  maxDurationMilliseconds: 10 * 60_000,
  maxEpochAttempts: 16,
});

const absoluteBounds: ScannerExecutionRuntimeBounds = Object.freeze({
  heartbeatTimeoutMilliseconds: 24 * 60 * 60_000,
  maxDiagnostics: 1_024,
  maxDurationMilliseconds: 24 * 60 * 60_000,
  maxEpochAttempts: 1_024,
});

const projectIdPattern = /^(?:project\.default|project_[0-9a-f]{32})$/;
const scannerIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const projectRevisionPattern = /^sha256:[0-9a-f]{64}$/;
const exactVersionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const intrinsicReflectApply = Reflect.apply;

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze({
    code,
    ...(details === undefined ? {} : { details: Object.freeze({ ...details }) }),
    message,
  });
}

function configuredBound(
  value: number | undefined,
  fallback: number,
  maximum: number,
  name: string,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0 || selected > maximum) {
    throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
  }
  return selected;
}

function resolveBounds(
  configured?: Partial<ScannerExecutionRuntimeBounds>,
): ScannerExecutionRuntimeBounds {
  return Object.freeze({
    heartbeatTimeoutMilliseconds: configuredBound(
      configured?.heartbeatTimeoutMilliseconds,
      defaultBounds.heartbeatTimeoutMilliseconds,
      absoluteBounds.heartbeatTimeoutMilliseconds,
      "heartbeatTimeoutMilliseconds",
    ),
    maxDiagnostics: configuredBound(
      configured?.maxDiagnostics,
      defaultBounds.maxDiagnostics,
      absoluteBounds.maxDiagnostics,
      "maxDiagnostics",
    ),
    maxDurationMilliseconds: configuredBound(
      configured?.maxDurationMilliseconds,
      defaultBounds.maxDurationMilliseconds,
      absoluteBounds.maxDurationMilliseconds,
      "maxDurationMilliseconds",
    ),
    maxEpochAttempts: configuredBound(
      configured?.maxEpochAttempts,
      defaultBounds.maxEpochAttempts,
      absoluteBounds.maxEpochAttempts,
      "maxEpochAttempts",
    ),
  });
}

const defaultScheduler: ScannerRuntimeScheduler = Object.freeze({
  schedule(delayMilliseconds: number, callback: () => void): ScannerRuntimeTimer {
    const timer = setTimeout(callback, delayMilliseconds);
    let active = true;
    return Object.freeze({
      cancel() {
        if (!active) return;
        active = false;
        clearTimeout(timer);
      },
    });
  },
});

function boundedDiagnostics(values: readonly Diagnostic[], maximum: number): readonly Diagnostic[] {
  if (values.length <= maximum) return Object.freeze([...values]);
  return Object.freeze([
    ...values.slice(0, Math.max(0, maximum - 1)),
    diagnostic(
      "scanner-runtime-diagnostic-limit-exceeded",
      "Scanner execution produced more diagnostics than its configured bound",
      { maximum },
    ),
  ]);
}

function copyResult<T>(
  value: unknown,
  maximumDiagnostics: number,
  failureCode: string,
  copySuccess: (value: unknown) => Result<T>,
): Result<T> {
  const inspected = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    failureCode,
    "Scanner runtime result",
  );
  if (!inspected.ok) {
    return failure(
      diagnostic(failureCode, "Scanner runtime dependency returned an invalid result"),
    );
  }
  if (inspected.value.ok === true) return copySuccess(inspected.value.value);
  if (inspected.value.ok !== false) {
    return failure(
      diagnostic(failureCode, "Scanner runtime dependency returned an invalid result"),
    );
  }
  const diagnostics = copyHostDiagnostics(
    inspected.value.diagnostics,
    maximumDiagnostics,
    failureCode,
  );
  return diagnostics.ok && diagnostics.value.length > 0
    ? failure(...diagnostics.value)
    : failure(diagnostic(failureCode, "Scanner runtime dependency returned invalid diagnostics"));
}

function voidResult(value: unknown, maximumDiagnostics: number, failureCode: string): Result<void> {
  return copyResult(value, maximumDiagnostics, failureCode, (settled) =>
    settled === undefined
      ? success(undefined)
      : failure(diagnostic(failureCode, "Scanner runtime dependency returned non-void success")),
  );
}

function voidSuccess(value: unknown, failureCode: string): Result<void> {
  return value === undefined
    ? success(undefined)
    : failure(diagnostic(failureCode, "Scanner runtime dependency returned non-void success"));
}

async function invokeResult<T>(
  invoke: () => unknown,
  maximumDiagnostics: number,
  failureCode: string,
  copySuccess: (value: unknown) => Result<T>,
): Promise<Result<T>> {
  let returned: unknown;
  try {
    returned = invoke();
  } catch {
    return failure(diagnostic(failureCode, "Scanner runtime dependency threw"));
  }
  const observed = observeNativePromise(
    returned,
    (settled) => copyResult(settled, maximumDiagnostics, failureCode, copySuccess),
    () => failure<T>(diagnostic(failureCode, "Scanner runtime dependency rejected")),
  );
  return observed.status === "observed"
    ? observed.promise
    : failure(diagnostic(failureCode, "Scanner runtime dependency returned an invalid Promise"));
}

function copyProjectSnapshot(value: unknown): Result<ProjectRegistrationSnapshot> {
  const inspected = inspectHostRecord(
    value,
    [["availability", "coverage", "id", "name", "revision", "scanners", "source"]],
    "scanner-project-unavailable",
    "Scanner project registration",
  );
  if (
    !inspected.ok ||
    (inspected.value.availability !== "available" &&
      inspected.value.availability !== "unavailable") ||
    typeof inspected.value.id !== "string" ||
    !projectIdPattern.test(inspected.value.id) ||
    typeof inspected.value.name !== "string" ||
    typeof inspected.value.revision !== "string" ||
    !projectRevisionPattern.test(inspected.value.revision) ||
    typeof inspected.value.source !== "string" ||
    !Array.isArray(inspected.value.coverage) ||
    !Array.isArray(inspected.value.scanners)
  ) {
    return failure(
      diagnostic("scanner-project-unavailable", "Scanner project registration is invalid"),
    );
  }
  const canonical = canonicalizeProjectRegistration(
    Object.freeze({
      coverage: inspected.value.coverage,
      id: inspected.value.id,
      name: inspected.value.name,
      scanners: inspected.value.scanners,
      source: inspected.value.source,
    }),
  );
  if (!canonical.ok) {
    return failure(
      diagnostic("scanner-project-unavailable", "Scanner project registration is invalid"),
    );
  }
  return success(
    Object.freeze({
      ...canonical.value,
      availability: inspected.value.availability,
      revision: inspected.value.revision,
    }),
  );
}

function copyScannerResources(value: unknown): Result<ScannerProjectResources> {
  if (typeof value !== "object" || value === null || isHostProxy(value)) {
    return failure(
      diagnostic("scanner-project-resources-unavailable", "Scanner project resources are invalid"),
    );
  }
  try {
    const enumerate = Object.getOwnPropertyDescriptor(value, "enumerate");
    const read = Object.getOwnPropertyDescriptor(value, "read");
    if (
      enumerate === undefined ||
      !("value" in enumerate) ||
      typeof enumerate.value !== "function" ||
      read === undefined ||
      !("value" in read) ||
      typeof read.value !== "function"
    ) {
      throw new Error();
    }
    const receiver = value;
    const enumerateMethod = enumerate.value as ScannerProjectResources["enumerate"];
    const readMethod = read.value as ScannerProjectResources["read"];
    return success(
      Object.freeze({
        enumerate(request) {
          return intrinsicReflectApply(enumerateMethod, receiver, [request]) as ReturnType<
            ScannerProjectResources["enumerate"]
          >;
        },
        read(request) {
          return intrinsicReflectApply(readMethod, receiver, [request]) as ReturnType<
            ScannerProjectResources["read"]
          >;
        },
      } satisfies ScannerProjectResources),
    );
  } catch {
    return failure(
      diagnostic("scanner-project-resources-unavailable", "Scanner project resources are invalid"),
    );
  }
}

function scannerProvider(
  provider: PluginCapabilityProvider,
  manifests: ReadonlyMap<
    string,
    Readonly<{ readonly requires: readonly unknown[]; readonly version: string }>
  >,
): Result<CanonicalScannerProvider> {
  const manifest = manifests.get(provider.pluginId);
  const version = manifest?.version;
  if (
    manifest === undefined ||
    version === undefined ||
    !exactVersionPattern.test(version) ||
    typeof provider.value !== "object" ||
    provider.value === null ||
    isHostProxy(provider.value)
  ) {
    return failure(
      diagnostic("invalid-scanner-provider", "Scanner capability provider is invalid", {
        pluginId: provider.pluginId,
      }),
    );
  }
  if (manifest.requires.length > 0) {
    return failure(
      diagnostic(
        "scanner-provider-authority-invalid",
        "Scanner providers must not retain runtime capability requirements",
        { pluginId: provider.pluginId },
      ),
    );
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(provider.value, "scan");
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      typeof descriptor.value !== "function"
    ) {
      throw new Error();
    }
    return success(
      Object.freeze({
        pluginId: provider.pluginId,
        receiver: provider.value,
        scan: descriptor.value as Scanner["scan"],
        version,
      }),
    );
  } catch {
    return failure(
      diagnostic("invalid-scanner-provider", "Scanner capability provider is invalid", {
        pluginId: provider.pluginId,
      }),
    );
  }
}

function catalogScannerProviders(
  plugins: RunningPluginGraph,
): Result<ReadonlyMap<string, CanonicalScannerProvider>> {
  try {
    const inspection = plugins.inspect();
    const manifests = new Map(
      inspection.plugins.map((plugin) => [
        plugin.id,
        Object.freeze({ requires: plugin.requires, version: plugin.version }),
      ]),
    );
    const catalog = new Map<string, CanonicalScannerProvider>();
    for (const raw of plugins.capabilities(scannerCapabilityId, scannerCapabilityVersion)) {
      const parsed = scannerProvider(raw, manifests);
      if (!parsed.ok) return parsed;
      if (catalog.has(parsed.value.pluginId)) {
        return failure(
          diagnostic("invalid-scanner-provider", "Scanner provider identity is duplicated", {
            pluginId: parsed.value.pluginId,
          }),
        );
      }
      catalog.set(parsed.value.pluginId, parsed.value);
    }
    return success(catalog);
  } catch {
    return failure(
      diagnostic("invalid-scanner-provider", "Scanner capability catalog is unavailable"),
    );
  }
}

function generateEpoch(entropy: EntropySource): Result<string> {
  try {
    const bytes = entropy(16);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 16) throw new Error();
    let hex = "";
    for (let index = 0; index < bytes.byteLength; index += 1) {
      hex += bytes[index]!.toString(16).padStart(2, "0");
    }
    return success(`epoch_${hex}`);
  } catch {
    return failure(
      diagnostic("scanner-epoch-unavailable", "Scanner execution epoch could not be generated"),
    );
  }
}

function laneKey(projectId: string, scannerId: string): string {
  return JSON.stringify([projectId, scannerId, "default"]);
}

function laneRequest(begin: ObservationSessionBegin): ObservationLaneRequest {
  return Object.freeze({
    epoch: begin.epoch,
    projectId: begin.projectId,
    source: Object.freeze({ id: begin.source.id, instance: begin.source.instance }),
  });
}

function finalReport(
  inspect: () => ScannerExecutionInspection,
  status: ScannerExecutionTerminalStatus,
  diagnostics: readonly Diagnostic[],
  maximumDiagnostics: number,
): ScannerExecutionReport {
  return Object.freeze({
    ...inspect(),
    diagnostics: boundedDiagnostics(diagnostics, maximumDiagnostics),
    status,
  });
}

function latestTransition(session: ObservationSession): ObservationSessionCheckpointTransition {
  const transitions = session.checkpoint().transitions;
  const transition = transitions[transitions.length - 1];
  if (transition === undefined) throw new Error("accepted observation transition was not recorded");
  return transition;
}

function nextTerminalSequence(lastSequence: number): number {
  return lastSequence < Number.MAX_SAFE_INTEGER ? lastSequence + 1 : Number.MAX_SAFE_INTEGER;
}

export function createScannerExecutionRuntime(
  options: ScannerExecutionRuntimeOptions,
): ScannerExecutionRuntime {
  const bounds = resolveBounds(options.bounds);
  const scheduler = options.scheduler ?? defaultScheduler;
  if (typeof options.entropy !== "function" || typeof options.projectResources !== "function") {
    throw new TypeError("Scanner execution runtime requires callable Host capabilities");
  }
  const catalog = catalogScannerProviders(options.plugins);
  const activeLanes = new Set<string>();
  const activeExecutions = new Map<string, ScannerExecutionSession>();
  const quarantinedLanes = new Map<string, symbol>();
  const recoveryWork = new Map<string, LaneRecoveryWork>();
  const dirtyRecoveryLanes = new Set<string>();
  const laneRecoveryInFlight = new Map<string, Promise<Result<ScannerRuntimeRecoveryReport>>>();
  let shutdownRequested = false;
  let recoveryLoaded = false;
  let refreshInFlight: Promise<Result<ScannerRuntimeRecoveryReport>> | undefined;
  let recoveryInFlight: Promise<Result<ScannerRuntimeRecoveryReport>> | undefined;

  const markLaneDirty = (key: string): void => {
    recoveryWork.delete(key);
    dirtyRecoveryLanes.add(key);
  };

  const queueHandoffRecovery = (handoff: ObservationHandoff): void => {
    const key = laneKey(handoff.lane.projectId, handoff.lane.source.id);
    recoveryWork.set(
      key,
      Object.freeze({
        abandoned: Object.freeze([]),
        acknowledged: Object.freeze([]),
        handoffs: Object.freeze([handoff]),
      }),
    );
    dirtyRecoveryLanes.delete(key);
  };

  const consumeHandoff = async (handoff: ObservationHandoff): Promise<Result<void>> => {
    const consumed = await invokeResult(
      () => options.consumer.consume(handoff.snapshot),
      bounds.maxDiagnostics,
      "scanner-handoff-consumer-failed",
      (value) => voidSuccess(value, "scanner-handoff-consumer-failed"),
    );
    if (!consumed.ok) return consumed;
    const acknowledged = await invokeResult(
      () =>
        options.journal.acknowledge({
          epoch: handoff.epoch,
          projectId: handoff.lane.projectId,
          source: handoff.lane.source,
          token: handoff.token,
        }),
      bounds.maxDiagnostics,
      "scanner-handoff-acknowledgement-failed",
      (value) => voidSuccess(value, "scanner-handoff-acknowledgement-failed"),
    );
    if (!acknowledged.ok) return acknowledged;
    return invokeResult(
      () =>
        options.journal.cleanup({
          epoch: handoff.epoch,
          projectId: handoff.lane.projectId,
          source: handoff.lane.source,
        }),
      bounds.maxDiagnostics,
      "scanner-session-cleanup-failed",
      (value) => voidSuccess(value, "scanner-session-cleanup-failed"),
    );
  };

  const runRecoveryRefresh = async (): Promise<Result<ScannerRuntimeRecoveryReport>> => {
    if (activeLanes.size > 0 || quarantinedLanes.size > 0) {
      return failure(
        diagnostic(
          "scanner-recovery-conflict",
          "Scanner recovery cannot inspect the journal while executions are active or quarantined",
        ),
      );
    }
    const recovery = await invokeResult(
      () => options.journal.recover(),
      bounds.maxDiagnostics,
      "scanner-recovery-failed",
      (value) => success(value as ObservationJournalRecovery),
    );
    if (!recovery.ok) return recovery;
    const distributed = new Map<
      string,
      {
        abandoned: ObservationJournalRecovery["abandoned"][number][];
        acknowledged: ObservationJournalRecovery["acknowledged"][number][];
        handoffs: ObservationJournalRecovery["handoffs"][number][];
      }
    >();
    const workFor = (key: string) => {
      const current = distributed.get(key) ?? { abandoned: [], acknowledged: [], handoffs: [] };
      distributed.set(key, current);
      return current;
    };
    for (const abandoned of recovery.value.abandoned) {
      workFor(laneKey(abandoned.lane.projectId, abandoned.lane.source.id)).abandoned.push(
        abandoned,
      );
    }
    for (const acknowledged of recovery.value.acknowledged) {
      workFor(laneKey(acknowledged.projectId, acknowledged.source.id)).acknowledged.push(
        acknowledged,
      );
    }
    for (const handoff of recovery.value.handoffs) {
      workFor(laneKey(handoff.lane.projectId, handoff.lane.source.id)).handoffs.push(handoff);
    }
    recoveryWork.clear();
    for (const [key, work] of distributed) {
      recoveryWork.set(
        key,
        Object.freeze({
          abandoned: Object.freeze(work.abandoned),
          acknowledged: Object.freeze(work.acknowledged),
          handoffs: Object.freeze(work.handoffs),
        }),
      );
    }
    recoveryLoaded = true;
    dirtyRecoveryLanes.clear();
    return success(Object.freeze({ abandoned: 0, acknowledged: 0, consumed: 0 }));
  };

  const refreshRecovery = (): Promise<Result<ScannerRuntimeRecoveryReport>> => {
    if (refreshInFlight !== undefined) return refreshInFlight;
    refreshInFlight = runRecoveryRefresh().then((result) => {
      refreshInFlight = undefined;
      return result;
    });
    return refreshInFlight;
  };

  const recoverLaneWork = async (key: string): Promise<Result<ScannerRuntimeRecoveryReport>> => {
    const work = recoveryWork.get(key);
    if (work === undefined) {
      return success(Object.freeze({ abandoned: 0, acknowledged: 0, consumed: 0 }));
    }
    let abandonedCount = 0;
    let acknowledgedCount = 0;
    let consumedCount = 0;
    for (let index = 0; index < work.abandoned.length; index += 1) {
      const abandoned = work.abandoned[index]!;
      const cleaned = await invokeResult(
        () =>
          options.journal.cleanup({
            epoch: abandoned.epoch,
            projectId: abandoned.lane.projectId,
            source: abandoned.lane.source,
          }),
        bounds.maxDiagnostics,
        "scanner-session-cleanup-failed",
        (value) => voidSuccess(value, "scanner-session-cleanup-failed"),
      );
      if (!cleaned.ok) return cleaned;
      abandonedCount += 1;
    }
    for (let index = 0; index < work.acknowledged.length; index += 1) {
      const acknowledged = work.acknowledged[index]!;
      const cleaned = await invokeResult(
        () => options.journal.cleanup(acknowledged),
        bounds.maxDiagnostics,
        "scanner-session-cleanup-failed",
        (value) => voidSuccess(value, "scanner-session-cleanup-failed"),
      );
      if (!cleaned.ok) return cleaned;
      acknowledgedCount += 1;
    }
    for (let index = 0; index < work.handoffs.length; index += 1) {
      const handoff = work.handoffs[index]!;
      const consumed = await consumeHandoff(handoff);
      if (!consumed.ok) {
        markLaneDirty(key);
        return consumed;
      }
      consumedCount += 1;
    }
    recoveryWork.delete(key);
    dirtyRecoveryLanes.delete(key);
    return success(
      Object.freeze({
        abandoned: abandonedCount,
        acknowledged: acknowledgedCount,
        consumed: consumedCount,
      }),
    );
  };

  const runLaneRecovery = async (key: string): Promise<Result<ScannerRuntimeRecoveryReport>> => {
    if (quarantinedLanes.has(key)) {
      return failure(
        diagnostic(
          "scanner-session-quarantined",
          "Scanner lane is quarantined until an interrupted Host operation settles",
        ),
      );
    }
    if (!recoveryLoaded || dirtyRecoveryLanes.has(key)) {
      const refreshed = await refreshRecovery();
      if (!refreshed.ok) return refreshed;
    }
    return recoverLaneWork(key);
  };

  const recoverLane = (key: string): Promise<Result<ScannerRuntimeRecoveryReport>> => {
    if (
      recoveryInFlight !== undefined &&
      (!recoveryLoaded || dirtyRecoveryLanes.size > 0 || recoveryWork.has(key))
    ) {
      return Promise.resolve(
        failure(
          diagnostic(
            "scanner-recovery-conflict",
            "Scanner lane recovery cannot race full recovery for the same pending journal work",
          ),
        ),
      );
    }
    const current = laneRecoveryInFlight.get(key);
    if (current !== undefined) return current;
    const pending = runLaneRecovery(key).then((result) => {
      if (laneRecoveryInFlight.get(key) === pending) laneRecoveryInFlight.delete(key);
      return result;
    });
    laneRecoveryInFlight.set(key, pending);
    return pending;
  };

  const recover = (): Promise<Result<ScannerRuntimeRecoveryReport>> => {
    if (recoveryInFlight !== undefined) return recoveryInFlight;
    recoveryInFlight = (async () => {
      if (activeLanes.size > 0 || quarantinedLanes.size > 0 || laneRecoveryInFlight.size > 0) {
        return failure(
          diagnostic(
            "scanner-recovery-conflict",
            "Scanner recovery cannot run while executions or targeted recovery are active or quarantined",
          ),
        );
      }
      if (!recoveryLoaded || dirtyRecoveryLanes.size > 0) {
        const refreshed = await refreshRecovery();
        if (!refreshed.ok) return refreshed;
      }
      const totals = { abandoned: 0, acknowledged: 0, consumed: 0 };
      for (const key of [...recoveryWork.keys()].sort()) {
        const recovered = await recoverLaneWork(key);
        if (!recovered.ok) return recovered;
        totals.abandoned += recovered.value.abandoned;
        totals.acknowledged += recovered.value.acknowledged;
        totals.consumed += recovered.value.consumed;
      }
      return success(Object.freeze(totals));
    })().then((result) => {
      recoveryInFlight = undefined;
      return result;
    });
    return recoveryInFlight;
  };

  const getProject = async (projectId: string): Promise<Result<ProjectRegistrationSnapshot>> =>
    invokeResult(
      () => options.projects.get({ id: projectId }),
      bounds.maxDiagnostics,
      "scanner-project-unavailable",
      copyProjectSnapshot,
    );

  const start = async (
    requestValue: ScannerExecutionRequest,
  ): Promise<Result<ScannerExecutionSession>> => {
    const request = inspectHostRecord(
      requestValue,
      [
        ["projectId", "scannerId"],
        ["cancellation", "projectId", "scannerId"],
      ],
      "invalid-scanner-execution-request",
      "Scanner execution request",
    );
    if (
      !request.ok ||
      typeof request.value.projectId !== "string" ||
      !projectIdPattern.test(request.value.projectId) ||
      typeof request.value.scannerId !== "string" ||
      !scannerIdPattern.test(request.value.scannerId) ||
      (Object.hasOwn(request.value, "cancellation") &&
        !(request.value.cancellation instanceof AbortSignal))
    ) {
      return failure(
        diagnostic("invalid-scanner-execution-request", "Scanner execution request is invalid"),
      );
    }
    const cancellation = request.value.cancellation as AbortSignal | undefined;
    const admissionCancelled = (): boolean => shutdownRequested || cancellation?.aborted === true;
    if (admissionCancelled()) {
      return failure(
        diagnostic(
          shutdownRequested ? "scanner-runtime-cancelled" : "scanner-execution-cancelled",
          shutdownRequested
            ? "Scanner runtime has been cancelled"
            : "Scanner execution was cancelled",
        ),
      );
    }
    if (!catalog.ok) return catalog;
    const project = await getProject(request.value.projectId);
    if (!project.ok) return project;
    if (admissionCancelled()) {
      return failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"));
    }
    if (project.value.availability !== "available") {
      return failure(
        diagnostic("scanner-project-unavailable", "Scanner project source is unavailable", {
          projectId: project.value.id,
        }),
      );
    }
    const configured = project.value.scanners.find(
      (scanner) => scanner.id === request.value.scannerId,
    );
    if (configured === undefined) {
      return failure(
        diagnostic("scanner-not-enabled", "Scanner is not enabled for the requested project", {
          projectId: project.value.id,
          scannerId: request.value.scannerId,
        }),
      );
    }
    const provider = catalog.value.get(configured.id);
    if (provider === undefined) {
      return failure(
        diagnostic("scanner-provider-unavailable", "Enabled scanner provider is unavailable", {
          scannerId: configured.id,
        }),
      );
    }
    const key = laneKey(project.value.id, configured.id);
    const laneRecovery = await recoverLane(key);
    if (!laneRecovery.ok) return laneRecovery;
    if (admissionCancelled()) {
      return failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"));
    }
    if (activeLanes.has(key)) {
      return failure(
        diagnostic(
          "scanner-session-conflict",
          "A scanner execution is already active for this project and source lane",
          { projectId: project.value.id, scannerId: configured.id },
        ),
      );
    }
    activeLanes.add(key);

    const resources = await invokeResult(
      () => options.projectResources(project.value),
      bounds.maxDiagnostics,
      "scanner-project-resources-unavailable",
      copyScannerResources,
    );
    if (!resources.ok) {
      activeLanes.delete(key);
      return resources;
    }
    if (admissionCancelled()) {
      activeLanes.delete(key);
      return failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"));
    }
    const preflightProject = await getProject(project.value.id);
    if (
      !preflightProject.ok ||
      preflightProject.value.revision !== project.value.revision ||
      preflightProject.value.availability !== "available"
    ) {
      activeLanes.delete(key);
      return preflightProject.ok
        ? failure(
            diagnostic(
              "scanner-project-changed",
              "Project registration changed while scanner resources were constructed",
            ),
          )
        : preflightProject;
    }
    if (admissionCancelled()) {
      activeLanes.delete(key);
      return failure(diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"));
    }

    let begin: ObservationSessionBegin | undefined;
    let durable: DurableObservationSession | undefined;
    for (let attempt = 0; attempt < bounds.maxEpochAttempts; attempt += 1) {
      if (admissionCancelled()) {
        activeLanes.delete(key);
        return failure(
          diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"),
        );
      }
      const epoch = generateEpoch(options.entropy);
      if (!epoch.ok) {
        activeLanes.delete(key);
        return epoch;
      }
      begin = Object.freeze({
        apiVersion: observationSessionApiVersion,
        epoch: epoch.value,
        projectId: project.value.id,
        scopes: Object.freeze(
          project.value.coverage.map((scope) =>
            Object.freeze({ id: scope.id, resourceRoot: scope.resourceRoot }),
          ),
        ),
        source: Object.freeze({
          id: provider.pluginId,
          instance: "default",
          version: provider.version,
        }),
      });
      let supersededRetry = false;
      for (let retry = 0; retry < 2; retry += 1) {
        const started = await invokeResult(
          () => options.journal.begin(begin!),
          bounds.maxDiagnostics,
          "scanner-session-begin-failed",
          (value) => success(value as DurableObservationSession),
        );
        if (started.ok) {
          durable = started.value;
          break;
        }
        const superseded = started.diagnostics.some(
          (item) => item.code === "observation-session-superseded",
        );
        if (superseded && retry === 0) {
          supersededRetry = true;
          continue;
        }
        const collision = started.diagnostics.some(
          (item) => item.code === "observation-epoch-already-recorded",
        );
        if (!collision) {
          activeLanes.delete(key);
          return started;
        }
        break;
      }
      if (durable !== undefined) break;
      if (supersededRetry) {
        activeLanes.delete(key);
        return failure(
          diagnostic(
            "scanner-session-begin-failed",
            "Scanner session could not begin after deterministic supersession",
          ),
        );
      }
    }
    if (begin === undefined || durable === undefined) {
      activeLanes.delete(key);
      return failure(
        diagnostic("scanner-epoch-unavailable", "Scanner execution epoch attempts were exhausted"),
      );
    }

    const shadowCreated = createObservationSession(begin, localObservationJournalSessionBounds);
    if (!shadowCreated.ok) {
      activeLanes.delete(key);
      return shadowCreated;
    }
    const shadow = shadowCreated.value;
    let status: ScannerExecutionStatus = "running";
    let cancelRequested = false;
    let authorityClosed = false;
    let cause: ExecutionCause | undefined;
    let executionFinished = false;
    let resolveCause!: (cause: ExecutionCause) => void;
    const causePromise = new Promise<ExecutionCause>((resolve) => {
      resolveCause = resolve;
    });
    let interruptionSelected = false;
    let resolveInterruption!: () => void;
    const interruptionPromise = new Promise<void>((resolve) => {
      resolveInterruption = resolve;
    });
    let hardTimer: ScannerRuntimeTimer | undefined;
    let hardDeadlineAvailable = false;
    let heartbeatTimer: ScannerRuntimeTimer | undefined;
    let terminalTransition: ObservationSessionCheckpointTransition | undefined;
    let durabilityFailure: readonly Diagnostic[] | undefined;
    let durabilityAbandoned = false;
    let durabilityTail: Promise<Result<void>> = Promise.resolve(success(undefined));

    const cancelHeartbeatTimer = (): void => {
      try {
        heartbeatTimer?.cancel();
      } catch {
        // Timer cancellation is best effort after scanner authority is fenced.
      }
      heartbeatTimer = undefined;
    };
    const closeScannerAuthority = (): void => {
      authorityClosed = true;
      cancelHeartbeatTimer();
    };
    const trigger = (next: ExecutionCause): void => {
      if ((next.type === "cancelled" || next.type === "expired") && !interruptionSelected) {
        interruptionSelected = true;
        resolveInterruption();
      }
      if (cause !== undefined || executionFinished) return;
      cause = next;
      cancelRequested = true;
      closeScannerAuthority();
      resolveCause(next);
    };
    const quarantineOperation = (operation: string, pending: Promise<unknown>): void => {
      if (operation === "durability-drain") durabilityAbandoned = true;
      const token = Symbol(operation);
      quarantinedLanes.set(key, token);
      void pending.then(
        () => {
          if (quarantinedLanes.get(key) !== token) return;
          quarantinedLanes.delete(key);
          markLaneDirty(key);
        },
        () => {
          if (quarantinedLanes.get(key) !== token) return;
          quarantinedLanes.delete(key);
          markLaneDirty(key);
        },
      );
    };
    async function raceExecutionOperation<T>(
      operation: string,
      pending: Promise<Result<T>>,
    ): Promise<ExecutionOperationOutcome<T>> {
      let immediate: Result<T> | undefined;
      const contained = pending.then(
        (result) => {
          immediate = result;
          return result;
        },
        () => {
          const rejected = failure<T>(
            diagnostic(
              "scanner-session-publication-failed",
              "Scanner Host operation rejected unexpectedly",
              { operation },
            ),
          );
          immediate = rejected;
          return rejected;
        },
      );
      await Promise.resolve();
      if (immediate !== undefined) {
        return Object.freeze({ result: immediate, type: "settled" as const });
      }
      const outcome = await Promise.race([
        contained.then((result) => Object.freeze({ result, type: "settled" as const })),
        causePromise.then((selected) =>
          Object.freeze({ cause: selected, operation, type: "interrupted" as const }),
        ),
      ]);
      if (outcome.type === "interrupted") quarantineOperation(operation, contained);
      return outcome;
    }
    async function raceFailurePublication<T>(
      operation: string,
      pending: Promise<Result<T>>,
    ): Promise<Readonly<{ readonly interrupted: boolean; readonly result?: Result<T> }>> {
      let immediate: Result<T> | undefined;
      const contained = pending.then(
        (result) => {
          immediate = result;
          return result;
        },
        () => {
          const rejected = failure<T>(
            diagnostic(
              "scanner-session-publication-failed",
              "Scanner Host operation rejected unexpectedly",
              { operation },
            ),
          );
          immediate = rejected;
          return rejected;
        },
      );
      await Promise.resolve();
      if (immediate !== undefined) {
        return Object.freeze({ interrupted: false, result: immediate });
      }
      const outcome = await Promise.race([
        contained.then((result) => Object.freeze({ interrupted: false as const, result })),
        interruptionPromise.then(() => Object.freeze({ interrupted: true as const })),
      ]);
      if (outcome.interrupted) quarantineOperation(operation, contained);
      return outcome;
    }
    const cancelTimers = (): void => {
      try {
        hardTimer?.cancel();
      } catch {
        // Timer cancellation is best effort after its callback authority is fenced.
      }
      hardTimer = undefined;
      cancelHeartbeatTimer();
    };
    const scheduleTimer = (delay: number, callback: () => void): Result<ScannerRuntimeTimer> => {
      try {
        const timer = scheduler.schedule(delay, callback);
        if (typeof timer !== "object" || timer === null || typeof timer.cancel !== "function") {
          throw new Error();
        }
        return success(timer);
      } catch {
        return failure(
          diagnostic("scanner-timer-unavailable", "Scanner execution timer is unavailable"),
        );
      }
    };
    const resetHeartbeatTimer = (): void => {
      cancelHeartbeatTimer();
      if (authorityClosed) return;
      const scheduled = scheduleTimer(bounds.heartbeatTimeoutMilliseconds, () => {
        if (authorityClosed) return;
        trigger(
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic("scanner-heartbeat-expired", "Scanner heartbeat expired"),
            ]),
            type: "expired" as const,
          }),
        );
      });
      if (!scheduled.ok) {
        trigger(Object.freeze({ diagnostics: scheduled.diagnostics, type: "failed" as const }));
      } else {
        heartbeatTimer = scheduled.value;
      }
    };
    const enqueue = (
      operation: (session: DurableObservationSession) => Promise<Result<unknown>>,
    ): void => {
      durabilityTail = durabilityTail.then(async (previous) => {
        if (!previous.ok) return previous;
        if (durabilityAbandoned) {
          return failure(
            diagnostic(
              "scanner-durability-abandoned",
              "Scanner durability pipeline was abandoned after interruption",
            ),
          );
        }
        let result: Result<unknown>;
        try {
          result = await operation(durable!);
        } catch {
          result = failure(
            diagnostic("scanner-session-publication-failed", "Scanner session publication failed"),
          );
        }
        if (!result.ok) {
          const copied = copyHostDiagnostics(
            result.diagnostics,
            bounds.maxDiagnostics,
            "scanner-session-publication-failed",
          );
          durabilityFailure = copied.ok
            ? copied.value
            : Object.freeze([
                diagnostic(
                  "scanner-session-publication-failed",
                  "Scanner session publication failed",
                ),
              ]);
          trigger(Object.freeze({ diagnostics: durabilityFailure, type: "failed" as const }));
          return failure(...durabilityFailure);
        }
        return success(undefined);
      });
    };
    function observationResult<T>(result: Result<T>): Result<T> {
      if (!result.ok) {
        trigger(Object.freeze({ diagnostics: result.diagnostics, type: "failed" as const }));
      }
      return result;
    }

    const observations: ScannerObservationSink = Object.freeze({
      complete(completion: ObservationCompletion): Result<void> {
        const completed = shadow.complete(completion);
        if (!completed.ok) return observationResult(completed);
        terminalTransition = latestTransition(shadow);
        return success(undefined);
      },
      fail(report: ObservationFailure): Result<void> {
        const failed = shadow.fail(report);
        if (!failed.ok) return observationResult(failed);
        terminalTransition = latestTransition(shadow);
        if (terminalTransition.type !== "fail") {
          return observationResult(
            failure(
              diagnostic("scanner-runtime-state-invalid", "Scanner failure state is invalid"),
            ),
          );
        }
        trigger(
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic("scanner-reported-failure", "Scanner reported an observation failure", {
                reasonCode: terminalTransition.reason.code,
              }),
            ]),
            type: "failed" as const,
          }),
        );
        return success(undefined);
      },
      heartbeat(heartbeat: ObservationHeartbeat): Result<void> {
        const accepted = shadow.heartbeat(heartbeat);
        if (!accepted.ok) return observationResult(accepted);
        const transition = latestTransition(shadow);
        if (transition.type !== "heartbeat") {
          return observationResult(
            failure(
              diagnostic("scanner-runtime-state-invalid", "Scanner heartbeat state is invalid"),
            ),
          );
        }
        enqueue(async (session) => {
          const published = await session.heartbeat({
            epoch: begin!.epoch,
            sequence: transition.sequence,
          });
          if (!published.ok) return published;
          const inspection = session.inspect();
          return inspection.lastHeartbeatSequence === transition.sequence &&
            inspection.lastSequence === transition.sequence
            ? success(undefined)
            : failure(
                diagnostic(
                  "scanner-session-diverged",
                  "Durable scanner heartbeat diverged from accepted observation state",
                ),
              );
        });
        resetHeartbeatTimer();
        return success(undefined);
      },
      submitBatch(batch: ObservationBatch): Result<ObservationBatchReceipt> {
        const accepted = shadow.submitBatch(batch);
        if (!accepted.ok) return observationResult(accepted);
        const transition = latestTransition(shadow);
        if (transition.type !== "batch") {
          return observationResult(
            failure(diagnostic("scanner-runtime-state-invalid", "Scanner batch state is invalid")),
          );
        }
        const receipt = accepted.value;
        enqueue(async (session) => {
          const published = await session.submitBatch({
            epoch: begin!.epoch,
            records: transition.records,
            sequence: transition.sequence,
          });
          if (!published.ok) return published;
          return published.value.acceptedRecords === receipt.acceptedRecords &&
            published.value.replayedRecords === receipt.replayedRecords &&
            published.value.sequence === receipt.sequence &&
            published.value.totalRecords === receipt.totalRecords
            ? success(undefined)
            : failure(
                diagnostic(
                  "scanner-session-diverged",
                  "Durable scanner batch diverged from accepted observation state",
                ),
              );
        });
        return accepted;
      },
    });

    const combinedCancellation = Object.freeze({
      isCancellationRequested: () => cancelRequested || authorityClosed,
    });
    const scannerRequest = createScannerRequest(
      Object.freeze({
        apiVersion: scannerApiVersion,
        cancellation: combinedCancellation,
        configuration: configured.configuration,
        observations,
        resources: resources.value,
        session: begin,
      }),
      undefined,
      localObservationJournalSessionBounds,
    );
    if (!scannerRequest.ok) {
      const sequence = nextTerminalSequence(durable.inspect().lastSequence);
      await durable.fail({
        epoch: begin.epoch,
        reason: Object.freeze({
          code: "scanner-request-invalid",
          message: "Scanner request could not be constructed",
        }),
        sequence,
      });
      await options.journal.cleanup(laneRequest(begin));
      activeLanes.delete(key);
      return scannerRequest;
    }

    let removeAbortListener: (() => void) | undefined;
    if (cancellation !== undefined) {
      const listener = () => {
        trigger(
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"),
            ]),
            type: "cancelled" as const,
          }),
        );
      };
      try {
        cancellation.addEventListener("abort", listener, { once: true });
        removeAbortListener = () => cancellation.removeEventListener("abort", listener);
        if (cancellation.aborted) listener();
      } catch {
        trigger(
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic(
                "scanner-execution-cancellation-invalid",
                "Scanner cancellation signal is invalid",
              ),
            ]),
            type: "failed" as const,
          }),
        );
      }
    }

    if (cause === undefined) {
      const hardScheduled = scheduleTimer(bounds.maxDurationMilliseconds, () => {
        trigger(
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic("scanner-duration-expired", "Scanner execution duration expired"),
            ]),
            type: "expired" as const,
          }),
        );
      });
      if (hardScheduled.ok) {
        hardTimer = hardScheduled.value;
        hardDeadlineAvailable = true;
      } else
        trigger(Object.freeze({ diagnostics: hardScheduled.diagnostics, type: "failed" as const }));
      if (cause === undefined) resetHeartbeatTimer();
    }

    const inspect = (): ScannerExecutionInspection => {
      const observation = shadow.inspect();
      return Object.freeze({
        apiVersion: scannerExecutionApiVersion,
        batchCount: observation.batchCount,
        epoch: begin!.epoch,
        lastHeartbeatSequence: observation.lastHeartbeatSequence,
        lastSequence: observation.lastSequence,
        projectId: begin!.projectId,
        recordCount: observation.recordCount,
        scannerId: configured.id,
        signalCount: observation.signalCount,
        status,
      });
    };
    const causeReport = (
      selected: ExecutionCause,
      additionalDiagnostics: readonly Diagnostic[] = Object.freeze([]),
    ): ScannerExecutionReport => {
      markLaneDirty(key);
      const terminalStatus: ScannerExecutionTerminalStatus =
        selected.type === "cancelled"
          ? "cancelled"
          : selected.type === "expired"
            ? "expired"
            : "failed";
      status = terminalStatus;
      return finalReport(
        inspect,
        terminalStatus,
        [...selected.diagnostics, ...additionalDiagnostics],
        bounds.maxDiagnostics,
      );
    };
    const interruptedReport = (
      interrupted: Extract<ExecutionOperationOutcome<unknown>, { readonly type: "interrupted" }>,
    ): ScannerExecutionReport => {
      const terminalStatus: ScannerExecutionTerminalStatus =
        interrupted.cause.type === "cancelled"
          ? "cancelled"
          : interrupted.cause.type === "expired"
            ? "expired"
            : "failed";
      status = terminalStatus;
      return finalReport(
        inspect,
        terminalStatus,
        [
          ...interrupted.cause.diagnostics,
          diagnostic(
            "scanner-host-operation-interrupted",
            "Scanner execution stopped while a Host operation remained unsettled",
            { operation: interrupted.operation },
          ),
        ],
        bounds.maxDiagnostics,
      );
    };

    let resolveCompletion!: (report: ScannerExecutionReport) => void;
    const completion = new Promise<ScannerExecutionReport>((resolve) => {
      resolveCompletion = resolve;
    });
    const session: ScannerExecutionSession = Object.freeze({
      cancel() {
        trigger(
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic("scanner-execution-cancelled", "Scanner execution was cancelled"),
            ]),
            type: "cancelled" as const,
          }),
        );
      },
      completion,
      inspect,
    });
    activeExecutions.set(key, session);
    if (shutdownRequested) {
      trigger(
        Object.freeze({
          diagnostics: Object.freeze([
            diagnostic("scanner-runtime-cancelled", "Scanner runtime has been cancelled"),
          ]),
          type: "cancelled" as const,
        }),
      );
    }

    const invokeScanner = (): Promise<ScannerSettlement> => {
      let returned: unknown;
      try {
        returned = intrinsicReflectApply(provider.scan, provider.receiver, [
          scannerRequest.value as ScannerRequest,
        ]);
      } catch {
        return Promise.resolve(
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic("scanner-plugin-failed", "Scanner plugin threw during execution"),
            ]),
            type: "invalid" as const,
          }),
        );
      }
      const observed = observeNativePromise(
        returned,
        (settled): ScannerSettlement => {
          const result = voidResult(settled, bounds.maxDiagnostics, "scanner-plugin-failed");
          return result.ok
            ? Object.freeze({ result, type: "settled" as const })
            : Object.freeze({ diagnostics: result.diagnostics, type: "invalid" as const });
        },
        (): ScannerSettlement =>
          Object.freeze({
            diagnostics: Object.freeze([
              diagnostic("scanner-plugin-failed", "Scanner plugin rejected during execution"),
            ]),
            type: "invalid" as const,
          }),
      );
      return observed.status === "observed"
        ? observed.promise
        : Promise.resolve(
            Object.freeze({
              diagnostics: Object.freeze([
                diagnostic(
                  "scanner-plugin-failed",
                  "Scanner plugin must return a containable native Promise",
                ),
              ]),
              type: "invalid" as const,
            }),
          );
    };

    const execute = async (): Promise<ScannerExecutionReport> => {
      try {
        let settled: ScannerSettlement | undefined;
        if (cause === undefined) {
          const scannerSettlement = invokeScanner();
          const first = await Promise.race([
            scannerSettlement,
            causePromise.then((selected) =>
              Object.freeze({ cause: selected, type: "cause" as const }),
            ),
          ]);
          if (first.type !== "cause") settled = first;
        }
        closeScannerAuthority();
        status = "draining";
        const drainBarrier = durabilityTail;
        const drainOutcome = await raceFailurePublication("durability-drain", drainBarrier);
        if (drainOutcome.interrupted) {
          return interruptedReport(
            Object.freeze({
              cause:
                cause ??
                Object.freeze({
                  diagnostics: Object.freeze([
                    diagnostic("scanner-duration-expired", "Scanner execution duration expired"),
                  ]),
                  type: "expired" as const,
                }),
              operation: "durability-drain",
              type: "interrupted" as const,
            }),
          );
        }
        const drained =
          drainOutcome.result ??
          failure(
            diagnostic("scanner-session-publication-failed", "Scanner durability drain failed"),
          );
        if (!drained.ok && cause === undefined) {
          trigger(Object.freeze({ diagnostics: drained.diagnostics, type: "failed" as const }));
        }

        if (cause === undefined && settled !== undefined) {
          if (settled.type === "invalid") {
            trigger(Object.freeze({ diagnostics: settled.diagnostics, type: "failed" as const }));
          } else if (!settled.result.ok) {
            trigger(
              Object.freeze({ diagnostics: settled.result.diagnostics, type: "failed" as const }),
            );
          }
        }

        if (cause === undefined) {
          const projectOutcome = await raceExecutionOperation(
            "project-revision-read",
            getProject(project.value.id),
          );
          if (projectOutcome.type === "interrupted") return interruptedReport(projectOutcome);
          const currentProject = projectOutcome.result;
          if (
            !currentProject.ok ||
            currentProject.value.revision !== project.value.revision ||
            currentProject.value.availability !== "available"
          ) {
            trigger(
              Object.freeze({
                diagnostics: currentProject.ok
                  ? Object.freeze([
                      diagnostic(
                        "scanner-project-changed",
                        "Project registration changed during scanner execution",
                      ),
                    ])
                  : currentProject.diagnostics,
                type: "failed" as const,
              }),
            );
          }
        }

        const shadowState = shadow.inspect().state;
        if (cause === undefined && shadowState !== "completed") {
          const sequence = nextTerminalSequence(shadow.inspect().lastSequence);
          if (shadowState === "active") {
            const failed = shadow.fail({
              epoch: begin!.epoch,
              reason: Object.freeze({
                code: "scanner-session-incomplete",
                message: "Scanner returned without completing its observation session",
              }),
              sequence,
            });
            if (failed.ok) terminalTransition = latestTransition(shadow);
          }
          trigger(
            Object.freeze({
              diagnostics: Object.freeze([
                diagnostic(
                  "scanner-session-incomplete",
                  "Scanner returned without completing its observation session",
                ),
              ]),
              type: "failed" as const,
            }),
          );
        }

        if (cause !== undefined) {
          const current = cause;
          if (current.type !== "failed" || interruptionSelected || !hardDeadlineAvailable) {
            return causeReport(current);
          }
          const durableInspection = durable!.inspect();
          const sequence =
            terminalTransition !== undefined &&
            "sequence" in terminalTransition &&
            terminalTransition.sequence > durableInspection.lastSequence
              ? terminalTransition.sequence
              : nextTerminalSequence(durableInspection.lastSequence);
          if (shadow.inspect().state === "active") {
            const failed = shadow.fail({
              epoch: begin!.epoch,
              reason: Object.freeze({
                code: "scanner-plugin-failed",
                message: "Scanner plugin did not complete successfully",
              }),
              sequence,
            });
            if (failed.ok) terminalTransition = latestTransition(shadow);
          }
          const reportedReason =
            terminalTransition?.type === "fail"
              ? terminalTransition.reason
              : Object.freeze({
                  code: "scanner-plugin-failed",
                  message: "Scanner plugin did not complete successfully",
                });
          const terminal = await raceFailurePublication(
            "failure-publication",
            invokeResult(
              () =>
                durable!.fail({
                  epoch: begin!.epoch,
                  reason: reportedReason,
                  sequence,
                }),
              bounds.maxDiagnostics,
              "scanner-session-publication-failed",
              (value) => voidSuccess(value, "scanner-session-publication-failed"),
            ),
          );
          if (terminal.interrupted) {
            return interruptedReport(
              Object.freeze({
                cause: current,
                operation: "failure-publication",
                type: "interrupted" as const,
              }),
            );
          }
          if (terminal.result === undefined || !terminal.result.ok) {
            return causeReport(current, [
              ...(durabilityFailure ?? []),
              ...(terminal.result?.ok === false ? terminal.result.diagnostics : []),
            ]);
          }
          const cleaned = await raceFailurePublication(
            "failure-cleanup",
            invokeResult(
              () => options.journal.cleanup(laneRequest(begin!)),
              bounds.maxDiagnostics,
              "scanner-session-cleanup-failed",
              (value) => voidSuccess(value, "scanner-session-cleanup-failed"),
            ),
          );
          if (cleaned.interrupted) {
            return interruptedReport(
              Object.freeze({
                cause: current,
                operation: "failure-cleanup",
                type: "interrupted" as const,
              }),
            );
          }
          if (cleaned.result === undefined || !cleaned.result.ok) {
            return causeReport(
              current,
              cleaned.result?.ok === false ? cleaned.result.diagnostics : Object.freeze([]),
            );
          }
          recoveryWork.delete(key);
          dirtyRecoveryLanes.delete(key);
          status = "failed";
          return finalReport(inspect, "failed", current.diagnostics, bounds.maxDiagnostics);
        }

        status = "completing";
        cancelRequested = true;
        if (terminalTransition?.type !== "complete") {
          markLaneDirty(key);
          status = "failed";
          return finalReport(
            inspect,
            "failed",
            Object.freeze([
              diagnostic("scanner-runtime-state-invalid", "Scanner completion state is invalid"),
            ]),
            bounds.maxDiagnostics,
          );
        }
        const completionTransition = terminalTransition;
        if (cause !== undefined) return causeReport(cause);
        const completed = await raceExecutionOperation(
          "completion-publication",
          invokeResult(
            () =>
              durable!.complete({
                coverage: completionTransition.coverage,
                epoch: begin!.epoch,
                sequence: completionTransition.sequence,
              }),
            bounds.maxDiagnostics,
            "scanner-session-publication-failed",
            (value) => voidSuccess(value, "scanner-session-publication-failed"),
          ),
        );
        if (completed.type === "interrupted") return interruptedReport(completed);
        if (!completed.result.ok) {
          markLaneDirty(key);
          status = "failed";
          return finalReport(
            inspect,
            "failed",
            completed.result.diagnostics,
            bounds.maxDiagnostics,
          );
        }
        if (cause !== undefined) return causeReport(cause);
        const handoff = await raceExecutionOperation(
          "handoff-publication",
          invokeResult(
            () => options.journal.handoff(laneRequest(begin!)),
            bounds.maxDiagnostics,
            "scanner-handoff-failed",
            (value) => success(value as ObservationHandoff),
          ),
        );
        if (handoff.type === "interrupted") return interruptedReport(handoff);
        if (!handoff.result.ok) {
          markLaneDirty(key);
          status = "failed";
          return finalReport(inspect, "failed", handoff.result.diagnostics, bounds.maxDiagnostics);
        }
        const deliveredHandoff = handoff.result.value;
        status = "delivering";
        if (cause !== undefined) return causeReport(cause);
        const consumed = await raceExecutionOperation(
          "handoff-consumer",
          invokeResult(
            () => options.consumer.consume(deliveredHandoff.snapshot),
            bounds.maxDiagnostics,
            "scanner-handoff-consumer-failed",
            (value) => voidSuccess(value, "scanner-handoff-consumer-failed"),
          ),
        );
        if (consumed.type === "interrupted") return interruptedReport(consumed);
        if (!consumed.result.ok) {
          queueHandoffRecovery(deliveredHandoff);
          status = "failed";
          return finalReport(inspect, "failed", consumed.result.diagnostics, bounds.maxDiagnostics);
        }
        if (cause !== undefined) return causeReport(cause);
        const acknowledged = await raceExecutionOperation(
          "handoff-acknowledgement",
          invokeResult(
            () =>
              options.journal.acknowledge({
                epoch: deliveredHandoff.epoch,
                projectId: deliveredHandoff.lane.projectId,
                source: deliveredHandoff.lane.source,
                token: deliveredHandoff.token,
              }),
            bounds.maxDiagnostics,
            "scanner-handoff-acknowledgement-failed",
            (value) => voidSuccess(value, "scanner-handoff-acknowledgement-failed"),
          ),
        );
        if (acknowledged.type === "interrupted") return interruptedReport(acknowledged);
        if (!acknowledged.result.ok) {
          markLaneDirty(key);
          status = "failed";
          return finalReport(
            inspect,
            "failed",
            acknowledged.result.diagnostics,
            bounds.maxDiagnostics,
          );
        }
        if (cause !== undefined) return causeReport(cause);
        const cleaned = await raceExecutionOperation(
          "handoff-cleanup",
          invokeResult(
            () => options.journal.cleanup(laneRequest(begin!)),
            bounds.maxDiagnostics,
            "scanner-session-cleanup-failed",
            (value) => voidSuccess(value, "scanner-session-cleanup-failed"),
          ),
        );
        if (cleaned.type === "interrupted") return interruptedReport(cleaned);
        if (!cleaned.result.ok) {
          markLaneDirty(key);
          status = "failed";
          return finalReport(inspect, "failed", cleaned.result.diagnostics, bounds.maxDiagnostics);
        }
        recoveryWork.delete(key);
        dirtyRecoveryLanes.delete(key);
        executionFinished = true;
        status = "completed";
        return finalReport(inspect, "completed", Object.freeze([]), bounds.maxDiagnostics);
      } catch {
        cancelRequested = true;
        authorityClosed = true;
        markLaneDirty(key);
        status = "failed";
        return finalReport(
          inspect,
          "failed",
          Object.freeze([
            diagnostic("scanner-runtime-failed", "Scanner execution failed unexpectedly"),
          ]),
          bounds.maxDiagnostics,
        );
      } finally {
        executionFinished = true;
        cancelTimers();
        try {
          removeAbortListener?.();
        } catch {
          // Execution authority is already fenced.
        }
        activeLanes.delete(key);
        if (activeExecutions.get(key) === session) activeExecutions.delete(key);
      }
    };

    void execute().then(resolveCompletion, () => {
      cancelTimers();
      cancelRequested = true;
      authorityClosed = true;
      executionFinished = true;
      markLaneDirty(key);
      status = "failed";
      activeLanes.delete(key);
      if (activeExecutions.get(key) === session) activeExecutions.delete(key);
      resolveCompletion(
        finalReport(
          inspect,
          "failed",
          Object.freeze([
            diagnostic("scanner-runtime-failed", "Scanner execution failed unexpectedly"),
          ]),
          bounds.maxDiagnostics,
        ),
      );
    });
    return success(session);
  };

  const cancelAll = async (): Promise<readonly ScannerExecutionReport[]> => {
    shutdownRequested = true;
    const sessions = [...activeExecutions.values()];
    for (const session of sessions) session.cancel();
    return Object.freeze(await Promise.all(sessions.map((session) => session.completion)));
  };

  return Object.freeze({ cancelAll, recover, start });
}
