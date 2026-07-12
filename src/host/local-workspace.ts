import type {
  ApplicationOperations,
  WorkspaceInitializationOutcome,
} from "../application/index.ts";
import {
  failure,
  parseEntityId,
  parseRelationId,
  success,
  type Diagnostic,
  type Result,
  type TransactionProvider,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import {
  workspaceResourceLocator,
  type LocalCoordinationLease,
  type LocalResourceProvider,
  type StagedReplacementHandle,
} from "../persistence/index.ts";
import { STANDARD_COMPONENT_KIND } from "../standard-model/index.ts";
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
  readonly maxSnapshotStateDepth: number;
  readonly maxSnapshotStateValues: number;
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
  maxSnapshotStateDepth: 30,
  maxSnapshotStateValues: 100_000,
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

function initializationFailure(
  conflict: Extract<WorkspaceStatus, { readonly state: "conflict" }>,
): WorkspaceInitializationOutcome {
  return Object.freeze({
    diagnostics: Object.freeze([conflict.diagnostic]),
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

function sameBytes(value: Uint8Array): boolean {
  if (value.byteLength !== canonicalBytes.byteLength) return false;
  for (let index = 0; index < value.byteLength; index += 1) {
    if (value[index] !== canonicalBytes[index]) return false;
  }
  return true;
}

function validSnapshot(
  value: unknown,
  bounds: LocalWorkspaceBounds,
): value is {
  readonly generation: number;
  readonly revisions: readonly unknown[];
  readonly state: unknown;
} {
  if (typeof value !== "object" || value === null) return false;
  try {
    const candidate = value as Record<string, unknown>;
    if (
      !Number.isSafeInteger(candidate.generation) ||
      (candidate.generation as number) < 0 ||
      !Array.isArray(candidate.revisions) ||
      candidate.revisions.length !== 0 ||
      !Object.hasOwn(candidate, "state")
    ) {
      return false;
    }
    const copied = copyGraphPayload(candidate.state, "transaction", {
      code: "invalid-workspace-recovery",
      maximumDepth: bounds.maxSnapshotStateDepth,
      maximumValues: bounds.maxSnapshotStateValues,
      message: "Workspace recovery state exceeds its configured bound",
    });
    if (
      !copied.ok ||
      typeof copied.value !== "object" ||
      copied.value === null ||
      Array.isArray(copied.value)
    ) {
      return false;
    }
    const state = copied.value as Readonly<Record<string, unknown>>;
    const keys = Object.keys(state);
    if (keys.length !== 2 || !keys.includes("components") || !keys.includes("relationships")) {
      return false;
    }
    const components = state.components;
    const relationships = state.relationships;
    if (
      !Array.isArray(components) ||
      !Array.isArray(relationships) ||
      components.length > bounds.maxSnapshotResources ||
      relationships.length > bounds.maxSnapshotResources
    ) {
      return false;
    }
    for (const component of components) {
      if (
        typeof component !== "object" ||
        component === null ||
        Array.isArray(component) ||
        component.kind !== STANDARD_COMPONENT_KIND ||
        typeof component.id !== "string" ||
        !parseEntityId(component.id).ok ||
        !Object.hasOwn(component, "payload")
      ) {
        return false;
      }
    }
    for (const relationship of relationships) {
      if (
        typeof relationship !== "object" ||
        relationship === null ||
        Array.isArray(relationship) ||
        typeof relationship.id !== "string" ||
        !parseRelationId(relationship.id).ok ||
        typeof relationship.source !== "string" ||
        !parseEntityId(relationship.source).ok ||
        typeof relationship.target !== "string" ||
        !parseEntityId(relationship.target).ok ||
        typeof relationship.type !== "string" ||
        !Object.hasOwn(relationship, "payload")
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function createLocalWorkspaceCapability(
  options: LocalWorkspaceCapabilityOptions,
): Promise<WorkspaceAccessCapability> {
  const bounds = validateBounds(options.bounds);
  let current: WorkspaceStatus;
  let recoveredGeneration = 0;

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
        if (read.diagnostics[0]?.code === "resource-missing") {
          return Object.freeze({ state: "missing" as const });
        }
        return read.diagnostics[0]?.code === "resource-too-large"
          ? Object.freeze({ diagnostic: configurationConflict(), state: "conflict" as const })
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
    if (current.state === "ready") {
      return success({ generation: recoveredGeneration, status: "completed" });
    }
    try {
      const snapshot = await options.transactionProvider.snapshot(Object.freeze([]));
      if (!validSnapshot(snapshot, bounds)) {
        return failure(
          diagnostic("invalid-workspace-recovery", "Workspace recovery returned malformed state"),
        );
      }
      recoveredGeneration = snapshot.generation;
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
      return initializationFailure(current);
    }
    if (current.state === "ready") {
      return Object.freeze({
        generation: recoveredGeneration as never,
        status: "already-initialized",
      });
    }

    const previouslyConfigured = current.state === "configured";
    if (!previouslyConfigured) {
      let lease: LocalCoordinationLease | undefined;
      let pendingStage: StagedReplacementHandle | undefined;
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
            pendingStage = staged.value;
            const committed = await options.resources.commitReplacement(staged.value);
            if (committed.state === "not-committed") {
              await options.resources.discardReplacement(staged.value);
              pendingStage = undefined;
              throw new Error("configuration commit failed");
            }
            pendingStage = undefined;
            current = await inspect();
          }
          if (current.state === "conflict") {
            outcome = initializationFailure(current);
          } else if (current.state !== "configured") {
            throw new Error("configuration was not established");
          }
        }
      } catch {
        if (pendingStage !== undefined) {
          current = await inspect();
          if (current.state !== "configured") {
            try {
              await options.resources.discardReplacement(pendingStage);
            } catch {
              // The host-owned diagnostic below remains stable and path-free.
            }
            outcome = Object.freeze({
              diagnostics: Object.freeze([providerFailure()]),
              status: "provider-failure",
            });
          }
          pendingStage = undefined;
        } else {
          outcome = Object.freeze({
            diagnostics: Object.freeze([providerFailure()]),
            status: "provider-failure",
          });
        }
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
