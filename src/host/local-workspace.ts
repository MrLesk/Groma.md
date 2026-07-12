import type {
  ApplicationOperations,
  WorkspaceInitializationOutcome,
} from "../application/index.ts";
import {
  failure,
  success,
  type Diagnostic,
  type Result,
  type TransactionProvider,
} from "../core/index.ts";
import {
  workspaceResourceLocator,
  type LocalCoordinationLease,
  type LocalResourceProvider,
} from "../persistence/index.ts";
import type {
  WorkspaceAccessCapability,
  WorkspaceRecoveryReport,
  WorkspaceStatus,
} from "./contracts.ts";

const locator = workspaceResourceLocator("groma", "groma.yaml");
if (!locator.ok) throw new Error("invalid built-in workspace configuration locator");
export const workspaceConfigurationLocator = locator.value;

export const defaultWorkspaceDocument = "schema: groma/v0.1\n";
const canonicalBytes = new TextEncoder().encode(defaultWorkspaceDocument);

export interface LocalWorkspaceBounds {
  readonly maxConfigurationBytes: number;
  readonly maxSnapshotResources: number;
}

export interface LocalWorkspaceCapabilityOptions {
  readonly bounds?: Partial<LocalWorkspaceBounds>;
  readonly operations: () => ApplicationOperations;
  readonly resources: LocalResourceProvider;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

const defaultBounds: LocalWorkspaceBounds = Object.freeze({
  maxConfigurationBytes: 4_096,
  maxSnapshotResources: 100_000,
});

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

const configurationConflict = () =>
  diagnostic(
    "workspace-configuration-conflict",
    "The workspace configuration is malformed or incompatible with this Groma host",
  );

const providerFailure = () =>
  diagnostic("workspace-configuration-provider-failure", "Workspace configuration access failed");

function validateBounds(input: Partial<LocalWorkspaceBounds> | undefined): LocalWorkspaceBounds {
  const selected = { ...defaultBounds, ...input };
  for (const [name, maximum] of [
    ["maxConfigurationBytes", 64 * 1024],
    ["maxSnapshotResources", 1_000_000],
  ] as const) {
    const value = selected[name];
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
      throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
    }
  }
  return Object.freeze(selected);
}

function sameBytes(value: Uint8Array): boolean {
  if (value.byteLength !== canonicalBytes.byteLength) return false;
  for (let index = 0; index < value.byteLength; index += 1) {
    if (value[index] !== canonicalBytes[index]) return false;
  }
  return true;
}

function validSnapshot(
  value: unknown,
  maximumResources: number,
): value is {
  readonly generation: number;
  readonly revisions: readonly unknown[];
  readonly state: unknown;
} {
  if (typeof value !== "object" || value === null) return false;
  try {
    const candidate = value as Record<string, unknown>;
    return (
      Number.isSafeInteger(candidate.generation) &&
      (candidate.generation as number) >= 0 &&
      Array.isArray(candidate.revisions) &&
      candidate.revisions.length <= maximumResources &&
      Object.hasOwn(candidate, "state")
    );
  } catch {
    return false;
  }
}

export async function createLocalWorkspaceCapability(
  options: LocalWorkspaceCapabilityOptions,
): Promise<WorkspaceAccessCapability> {
  const bounds = validateBounds(options.bounds);
  let current: WorkspaceStatus;

  const inspect = async (): Promise<WorkspaceStatus> => {
    try {
      const read = await options.resources.read({
        locator: workspaceConfigurationLocator,
        maxBytes: bounds.maxConfigurationBytes,
      });
      if (typeof read !== "object" || read === null || typeof read.ok !== "boolean") {
        return { diagnostic: providerFailure(), state: "conflict" };
      }
      if (!read.ok) {
        return read.diagnostics[0]?.code === "resource-missing"
          ? Object.freeze({ state: "missing" as const })
          : Object.freeze({ diagnostic: providerFailure(), state: "conflict" as const });
      }
      if (!(read.value.bytes instanceof Uint8Array) || !sameBytes(read.value.bytes)) {
        return Object.freeze({ diagnostic: configurationConflict(), state: "conflict" as const });
      }
      return Object.freeze({ state: "configured" as const });
    } catch {
      return Object.freeze({ diagnostic: providerFailure(), state: "conflict" as const });
    }
  };

  current = await inspect();

  const recover = async (): Promise<Result<WorkspaceRecoveryReport>> => {
    if (current.state === "missing") {
      return failure(
        diagnostic("no-workspace", "This operation requires an initialized Groma workspace"),
      );
    }
    if (current.state === "conflict") return failure(current.diagnostic);
    if (current.state === "ready") return success({ generation: 0, status: "completed" });
    try {
      const snapshot = await options.transactionProvider.snapshot(Object.freeze([]));
      if (!validSnapshot(snapshot, bounds.maxSnapshotResources)) {
        return failure(
          diagnostic("invalid-workspace-recovery", "Workspace recovery returned malformed state"),
        );
      }
      current = Object.freeze({ state: "ready" });
      return success(Object.freeze({ generation: snapshot.generation, status: "completed" }));
    } catch {
      return failure(
        diagnostic("workspace-recovery-failed", "Workspace transaction recovery failed"),
      );
    }
  };

  const initialize = async (): Promise<WorkspaceInitializationOutcome> => {
    if (current.state === "conflict") {
      return Object.freeze({
        diagnostics: Object.freeze([current.diagnostic]),
        status: "conflict",
      });
    }
    if (current.state === "ready") {
      return Object.freeze({ generation: 0 as never, status: "already-initialized" });
    }

    const previouslyConfigured = current.state === "configured";
    if (!previouslyConfigured) {
      let lease: LocalCoordinationLease | undefined;
      let outcome: WorkspaceInitializationOutcome | undefined;
      try {
        const acquired = await options.resources.acquireCoordination({
          context: "local-machine",
          locator: workspaceConfigurationLocator,
        });
        if (!acquired.ok) {
          outcome = Object.freeze({
            diagnostics: Object.freeze([providerFailure()]),
            status: "provider-failure",
          });
        } else {
          lease = acquired.value;
          current = await inspect();
          if (current.state === "missing") {
            const staged = await options.resources.stageReplacement(
              workspaceConfigurationLocator,
              canonicalBytes.slice(),
            );
            if (!staged.ok) throw new Error("configuration staging failed");
            const committed = await options.resources.commitReplacement(staged.value);
            if (committed.state === "not-committed") {
              await options.resources.discardReplacement(staged.value);
              throw new Error("configuration commit failed");
            }
            current = await inspect();
          }
          if (current.state === "conflict") {
            outcome = Object.freeze({
              diagnostics: Object.freeze([current.diagnostic]),
              status: "conflict",
            });
          } else if (current.state !== "configured") {
            throw new Error("configuration was not established");
          }
        }
      } catch {
        outcome = Object.freeze({
          diagnostics: Object.freeze([providerFailure()]),
          status: "provider-failure",
        });
      } finally {
        if (lease !== undefined) {
          try {
            const released = await options.resources.releaseCoordination(lease);
            if (!released.ok) {
              outcome = Object.freeze({
                diagnostics: Object.freeze([providerFailure()]),
                status: "provider-failure",
              });
            }
          } catch {
            outcome = Object.freeze({
              diagnostics: Object.freeze([providerFailure()]),
              status: "provider-failure",
            });
          }
        }
      }
      if (outcome !== undefined) return outcome;
    }

    const recovered = await recover();
    if (!recovered.ok) {
      return Object.freeze({ diagnostics: recovered.diagnostics, status: "provider-failure" });
    }
    return Object.freeze({
      generation: recovered.value.generation as never,
      status: previouslyConfigured ? "already-initialized" : "initialized",
    });
  };

  const requireWorkspace = (): Result<ApplicationOperations> => {
    if (current.state === "ready") return success(options.operations());
    if (current.state === "missing") {
      return failure(
        diagnostic("no-workspace", "This operation requires an initialized Groma workspace"),
      );
    }
    if (current.state === "conflict") return failure(current.diagnostic);
    return failure(
      diagnostic(
        "workspace-recovery-required",
        "Workspace transaction recovery must complete before semantic operations",
      ),
    );
  };

  return Object.freeze({ initialize, recover, requireWorkspace, status: () => current });
}
