import { AsyncLocalStorage } from "node:async_hooks";

import type {
  ApplicationSnapshotStateDecoder,
  ApplicationOperations,
  DecodedApplicationSnapshotState,
  WorkspaceInitializationOutcome,
} from "../application/index.ts";
import {
  failure,
  parseGraphGeneration,
  success,
  type Diagnostic,
  type GraphGeneration,
  type Result,
  type TransactionProvider,
} from "../core/index.ts";
import {
  workspaceResourceLocator,
  type LocalCoordinationLease,
  type LocalResourceProvider,
  type StagedReplacementHandle,
} from "../persistence/index.ts";
import type {
  WorkspaceAccessCapability,
  WorkspaceRecoveryReport,
  WorkspaceStatus,
} from "./contracts.ts";
import {
  copyHostDiagnostics,
  inspectHostDenseArray,
  inspectHostRecord,
} from "./runtime-validation.ts";

const locator = workspaceResourceLocator("groma", "groma.yaml");
if (!locator.ok) throw new Error("invalid built-in workspace configuration locator");
export const workspaceConfigurationLocator = locator.value;

export const defaultWorkspaceDocument = "schema: groma/v0.1\n";
const canonicalBytes = new TextEncoder().encode(defaultWorkspaceDocument);

export interface LocalWorkspaceBounds {
  readonly maxConfigurationBytes: number;
  readonly maxProviderDiagnostics: number;
  readonly maxSnapshotResources: number;
  readonly maxSnapshotStateDepth: number;
  readonly maxSnapshotStateValues: number;
}

/**
 * Resource and transaction-provider callbacks must not reenter initialize or recover
 * on the workspace capability whose transition invoked them.
 */
export interface LocalWorkspaceCapabilityOptions {
  readonly bounds?: Partial<LocalWorkspaceBounds>;
  readonly operations: () => ApplicationOperations;
  readonly resources: LocalResourceProvider;
  readonly stateDecoder: ApplicationSnapshotStateDecoder;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

const defaultBounds: LocalWorkspaceBounds = Object.freeze({
  maxConfigurationBytes: 4_096,
  maxProviderDiagnostics: 100,
  maxSnapshotResources: 100_000,
  maxSnapshotStateDepth: 30,
  maxSnapshotStateValues: 100_000,
});

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function ownedDiagnostic(value: Diagnostic): Diagnostic {
  return Object.freeze({
    code: value.code,
    ...(value.details === undefined ? {} : { details: Object.freeze({ ...value.details }) }),
    message: value.message,
  });
}

function ownedDiagnostics(values: readonly Diagnostic[]): readonly Diagnostic[] {
  return Object.freeze(values.map(ownedDiagnostic));
}

function hostFailure<T>(...diagnostics: readonly Diagnostic[]): Result<T> {
  return Object.freeze({ diagnostics: ownedDiagnostics(diagnostics), ok: false });
}

const configurationConflict = () =>
  diagnostic(
    "workspace-configuration-conflict",
    "The workspace configuration is malformed or incompatible with this Groma host",
  );

const providerFailure = () =>
  diagnostic("workspace-configuration-provider-failure", "Workspace configuration access failed");

const transitionReentrant = () =>
  diagnostic("workspace-transition-reentrant", "Workspace transition reentrancy is not supported");

const missingStatus = (): WorkspaceStatus => Object.freeze({ state: "missing" });
const configuredStatus = (): WorkspaceStatus => Object.freeze({ state: "configured" });
const readyStatus = (): WorkspaceStatus => Object.freeze({ state: "ready" });
const conflictStatus = (value: Diagnostic): WorkspaceStatus =>
  Object.freeze({ diagnostic: ownedDiagnostic(value), state: "conflict" });

function initializationProviderFailure(
  diagnostics: readonly Diagnostic[] = Object.freeze([providerFailure()]),
): WorkspaceInitializationOutcome {
  return Object.freeze({ diagnostics: ownedDiagnostics(diagnostics), status: "provider-failure" });
}

function initializationSuccess(
  generation: GraphGeneration,
  status: "already-initialized" | "initialized",
): WorkspaceInitializationOutcome {
  return Object.freeze({ generation, status });
}

function recoveryFailure(...diagnostics: readonly Diagnostic[]): Result<WorkspaceRecoveryReport> {
  return hostFailure(...diagnostics);
}

function recoverySuccess(generation: GraphGeneration): Result<WorkspaceRecoveryReport> {
  return Object.freeze({
    ok: true,
    value: Object.freeze({ generation, status: "completed" }),
  });
}

function initializationFailure(
  conflict: Extract<WorkspaceStatus, { readonly state: "conflict" }>,
): WorkspaceInitializationOutcome {
  return Object.freeze({
    diagnostics: ownedDiagnostics([conflict.diagnostic]),
    status:
      conflict.diagnostic.code === "workspace-configuration-conflict"
        ? "conflict"
        : "provider-failure",
  });
}

function validateBounds(input: Partial<LocalWorkspaceBounds> | undefined): LocalWorkspaceBounds {
  const selected = { ...defaultBounds, ...input };
  for (const [name, maximum] of [
    ["maxConfigurationBytes", 64 * 1024],
    ["maxProviderDiagnostics", 1_000],
    ["maxSnapshotResources", 1_000_000],
    ["maxSnapshotStateDepth", 100],
    ["maxSnapshotStateValues", 1_000_000],
  ] as const) {
    const value = selected[name];
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
      throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
    }
  }
  return Object.freeze(selected);
}

type ValidatedCommitState = "committed" | "committed-indeterminate" | "not-committed";

function validatedCommitState(
  value: unknown,
  bounds: LocalWorkspaceBounds,
): Result<ValidatedCommitState> {
  const outcome = inspectHostRecord(
    value,
    [["state"], ["diagnostics", "state"]],
    "invalid-workspace-publication",
    "Workspace configuration publication outcome",
  );
  if (!outcome.ok) return outcome;
  if (Object.hasOwn(outcome.value, "diagnostics")) {
    const diagnostics = copyHostDiagnostics(
      outcome.value.diagnostics,
      bounds.maxProviderDiagnostics,
      "invalid-workspace-publication",
    );
    if (!diagnostics.ok) return diagnostics;
  }
  if (
    outcome.value.state !== "committed" &&
    outcome.value.state !== "committed-indeterminate" &&
    outcome.value.state !== "not-committed"
  ) {
    return failure(
      diagnostic("invalid-workspace-publication", "Workspace publication state is malformed"),
    );
  }
  return success(outcome.value.state);
}

function validatedVoidResult(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  subject: string,
): Result<"failed" | "succeeded"> {
  const outcome = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-workspace-provider-result",
    subject,
  );
  if (!outcome.ok) return outcome;
  if (outcome.value.ok === true) {
    return outcome.value.value === undefined
      ? success("succeeded")
      : failure(diagnostic("invalid-workspace-provider-result", `${subject} success is malformed`));
  }
  if (outcome.value.ok !== false) {
    return failure(
      diagnostic("invalid-workspace-provider-result", `${subject} status is malformed`),
    );
  }
  const diagnostics = copyHostDiagnostics(
    outcome.value.diagnostics,
    bounds.maxProviderDiagnostics,
    "invalid-workspace-provider-result",
  );
  return diagnostics.ok ? success("failed") : diagnostics;
}

function sameBytes(value: Uint8Array): boolean {
  if (value.byteLength !== canonicalBytes.byteLength) return false;
  for (let index = 0; index < value.byteLength; index += 1) {
    if (value[index] !== canonicalBytes[index]) return false;
  }
  return true;
}

interface CanonicalWorkspaceSnapshot {
  readonly generation: GraphGeneration;
  readonly state: DecodedApplicationSnapshotState;
}

function canonicalSnapshot(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  stateDecoder: ApplicationSnapshotStateDecoder,
): Result<CanonicalWorkspaceSnapshot> {
  const snapshot = inspectHostRecord(
    value,
    [["generation", "revisions", "state"]],
    "invalid-workspace-recovery",
    "Workspace recovery snapshot",
  );
  if (!snapshot.ok) return snapshot;
  const generation = parseGraphGeneration(snapshot.value.generation);
  if (!generation.ok) {
    return failure(
      diagnostic("invalid-workspace-recovery", "Workspace recovery generation is malformed"),
    );
  }
  const revisions = inspectHostDenseArray(
    snapshot.value.revisions,
    bounds.maxSnapshotResources,
    "invalid-workspace-recovery",
    "Workspace recovery revisions",
  );
  if (!revisions.ok || revisions.value.length !== 0) {
    return failure(
      diagnostic("invalid-workspace-recovery", "Workspace recovery returned unexpected revisions"),
    );
  }
  const state = stateDecoder.decode(snapshot.value.state);
  if (!state.ok) return state;
  return success(
    Object.freeze({
      generation: generation.value,
      state: state.value,
    }),
  );
}

export async function createLocalWorkspaceCapability(
  options: LocalWorkspaceCapabilityOptions,
): Promise<WorkspaceAccessCapability> {
  const bounds = validateBounds(options.bounds);
  let current: WorkspaceStatus;
  let configurationPublishedBySession = false;
  let pendingPublication:
    { action: "commit" | "discard"; readonly handle: StagedReplacementHandle } | undefined;
  const zero = parseGraphGeneration(0);
  if (!zero.ok) throw new Error("zero graph generation must be valid");
  let recoveredGeneration = zero.value;
  let retainedInitializationLease: LocalCoordinationLease | undefined;

  const releaseRetainedInitializationLease = async (): Promise<Result<void>> => {
    if (pendingPublication !== undefined) return failure(providerFailure());
    const retained = retainedInitializationLease;
    if (retained === undefined) return success(undefined);
    try {
      const raw = await options.resources.releaseCoordination(retained);
      const released = validatedVoidResult(
        raw,
        bounds,
        "Workspace initialization coordination release",
      );
      if (!released.ok || released.value !== "succeeded") return failure(providerFailure());
      retainedInitializationLease = undefined;
      return success(undefined);
    } catch {
      return failure(providerFailure());
    }
  };

  const inspect = async (): Promise<WorkspaceStatus> => {
    try {
      const read = await options.resources.read({
        locator: workspaceConfigurationLocator,
        maxBytes: bounds.maxConfigurationBytes,
      });
      if (typeof read !== "object" || read === null || typeof read.ok !== "boolean") {
        return conflictStatus(providerFailure());
      }
      if (!read.ok) {
        if (read.diagnostics[0]?.code === "resource-missing") {
          return missingStatus();
        }
        return read.diagnostics[0]?.code === "resource-too-large"
          ? conflictStatus(configurationConflict())
          : conflictStatus(providerFailure());
      }
      if (!(read.value.bytes instanceof Uint8Array) || !sameBytes(read.value.bytes)) {
        return conflictStatus(configurationConflict());
      }
      return configuredStatus();
    } catch {
      return conflictStatus(providerFailure());
    }
  };

  current = await inspect();

  const settlePendingPublication = async (): Promise<
    Result<"committed" | "discarded" | "none">
  > => {
    const pending = pendingPublication;
    if (pending === undefined) return success("none");
    if (pending.action === "discard") {
      try {
        const raw = await options.resources.discardReplacement(pending.handle);
        const discarded = validatedVoidResult(raw, bounds, "Workspace publication discard");
        if (!discarded.ok || discarded.value !== "succeeded") return failure(providerFailure());
      } catch {
        return failure(providerFailure());
      }
      pendingPublication = undefined;
      current = await inspect();
      const released = await releaseRetainedInitializationLease();
      return released.ok ? success("discarded") : released;
    }

    let state: Result<ValidatedCommitState>;
    try {
      state = validatedCommitState(
        await options.resources.commitReplacement(pending.handle),
        bounds,
      );
    } catch {
      return failure(providerFailure());
    }
    if (!state.ok || state.value === "committed-indeterminate") {
      return failure(providerFailure());
    }
    if (state.value === "not-committed") {
      pendingPublication = { action: "discard", handle: pending.handle };
      return settlePendingPublication();
    }

    const observed = await inspect();
    if (observed.state !== "configured") return failure(providerFailure());
    current = observed;
    configurationPublishedBySession = true;
    pendingPublication = undefined;
    const released = await releaseRetainedInitializationLease();
    return released.ok ? success("committed") : released;
  };

  const recoverUnlocked = async (): Promise<Result<WorkspaceRecoveryReport>> => {
    const settled = await settlePendingPublication();
    if (!settled.ok) return recoveryFailure(...settled.diagnostics);
    const released = await releaseRetainedInitializationLease();
    if (!released.ok) return recoveryFailure(...released.diagnostics);
    if (current.state === "missing") {
      return recoveryFailure(
        diagnostic("no-workspace", "This operation requires an initialized Groma workspace"),
      );
    }
    if (current.state === "conflict") return recoveryFailure(current.diagnostic);
    if (current.state === "ready") {
      return recoverySuccess(recoveredGeneration);
    }
    try {
      const snapshot = canonicalSnapshot(
        await options.transactionProvider.snapshot(Object.freeze([])),
        bounds,
        options.stateDecoder,
      );
      if (!snapshot.ok) {
        return recoveryFailure(
          diagnostic("invalid-workspace-recovery", "Workspace recovery returned malformed state"),
        );
      }
      recoveredGeneration = snapshot.value.generation;
      current = readyStatus();
      return recoverySuccess(recoveredGeneration);
    } catch {
      return recoveryFailure(
        diagnostic("workspace-recovery-failed", "Workspace transaction recovery failed"),
      );
    }
  };

  const recoverDiscardedPublication = async (): Promise<WorkspaceInitializationOutcome> => {
    if (current.state === "conflict") return initializationFailure(current);
    if (current.state !== "configured") return initializationProviderFailure();
    const recovered = await recoverUnlocked();
    return recovered.ok
      ? initializationSuccess(recovered.value.generation, "already-initialized")
      : initializationProviderFailure(recovered.diagnostics);
  };

  const initializeUnlocked = async (): Promise<WorkspaceInitializationOutcome> => {
    const settled = await settlePendingPublication();
    if (!settled.ok) return initializationProviderFailure();
    if (settled.value === "discarded") return recoverDiscardedPublication();
    const retainedRelease = await releaseRetainedInitializationLease();
    if (!retainedRelease.ok) {
      return initializationProviderFailure(retainedRelease.diagnostics);
    }
    if (current.state === "conflict") {
      return initializationFailure(current);
    }
    if (current.state === "ready") {
      return initializationSuccess(recoveredGeneration, "already-initialized");
    }

    if (current.state === "missing") {
      try {
        const acquired = await options.resources.acquireCoordination({
          context: "local-machine",
          locator: workspaceConfigurationLocator,
        });
        if (!acquired.ok) {
          return initializationProviderFailure();
        }
        retainedInitializationLease = acquired.value;
        current = await inspect();
      } catch {
        return initializationProviderFailure();
      }

      if (current.state === "missing") {
        try {
          const staged = await options.resources.stageReplacement(
            workspaceConfigurationLocator,
            canonicalBytes.slice(),
          );
          if (!staged.ok) {
            const released = await releaseRetainedInitializationLease();
            return initializationProviderFailure(
              released.ok ? Object.freeze([providerFailure()]) : released.diagnostics,
            );
          }
          pendingPublication = { action: "commit", handle: staged.value };
        } catch {
          const released = await releaseRetainedInitializationLease();
          return initializationProviderFailure(
            released.ok ? Object.freeze([providerFailure()]) : released.diagnostics,
          );
        }
        const published = await settlePendingPublication();
        if (!published.ok) return initializationProviderFailure();
        if (published.value === "discarded") return recoverDiscardedPublication();
        if (published.value !== "committed") return initializationProviderFailure();
      } else {
        const released = await releaseRetainedInitializationLease();
        if (!released.ok) {
          return initializationProviderFailure(released.diagnostics);
        }
        if (current.state === "conflict") return initializationFailure(current);
        if (current.state !== "configured") {
          try {
            current = await inspect();
          } catch {
            // The path-free provider failure below is the only exposed diagnostic.
          }
          return initializationProviderFailure();
        }
      }
    }

    const recovered = await recoverUnlocked();
    if (!recovered.ok) {
      return initializationProviderFailure(recovered.diagnostics);
    }
    return initializationSuccess(
      recovered.value.generation,
      configurationPublishedBySession ? "initialized" : "already-initialized",
    );
  };

  const requireWorkspace = (): Result<ApplicationOperations> => {
    if (current.state === "ready") return Object.freeze({ ok: true, value: options.operations() });
    if (current.state === "missing") {
      return hostFailure(
        diagnostic("no-workspace", "This operation requires an initialized Groma workspace"),
      );
    }
    if (current.state === "conflict") return hostFailure(current.diagnostic);
    return hostFailure(
      diagnostic(
        "workspace-recovery-required",
        "Workspace transaction recovery must complete before semantic operations",
      ),
    );
  };

  const transitionContext = new AsyncLocalStorage<object>();
  let activeTransition: object | undefined;
  let operationTail: Promise<void> = Promise.resolve();
  function serialized<T>(
    action: () => Promise<T>,
    fallback: () => T,
    reentrant: () => T,
  ): Promise<T> {
    if (activeTransition !== undefined && transitionContext.getStore() === activeTransition) {
      return Promise.resolve(reentrant());
    }
    const previous = operationTail;
    let release!: () => void;
    operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return (async () => {
      await previous;
      const transition = Object.freeze({});
      activeTransition = transition;
      try {
        return await transitionContext.run(transition, action);
      } catch {
        return fallback();
      } finally {
        activeTransition = undefined;
        release();
      }
    })();
  }
  const recover = (): Promise<Result<WorkspaceRecoveryReport>> =>
    serialized(
      recoverUnlocked,
      () =>
        recoveryFailure(
          diagnostic("workspace-recovery-failed", "Workspace transaction recovery failed"),
        ),
      () => recoveryFailure(transitionReentrant()),
    );
  const initialize = (): Promise<WorkspaceInitializationOutcome> =>
    serialized(
      initializeUnlocked,
      () => initializationProviderFailure(),
      () => initializationProviderFailure([transitionReentrant()]),
    );

  return Object.freeze({ initialize, recover, requireWorkspace, status: () => current });
}
