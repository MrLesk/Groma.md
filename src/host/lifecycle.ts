import {
  failure,
  observeNativePromise,
  parseGraphGeneration,
  success,
  type Diagnostic,
  type NativePromiseObservation,
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
import type { PluginPackageOperations } from "./local-plugin-packages.ts";
import type { ApplicationOperations, SchemaMigrationOperations } from "../application/index.ts";
import {
  copyHostDiagnostics,
  inspectHostDenseArray,
  inspectHostRecord,
  isHostProxy,
} from "./runtime-validation.ts";
import { containCapabilityValue } from "../application/capability-value.ts";

export interface RunHostOptions {
  readonly context: HostProcessContext;
  readonly registry: HostBootstrapRegistry;
  readonly signalSource: HostSignalSource;
}

interface ContainedHostSurfaceSession {
  readonly completion: Promise<{ readonly state: "completed" | "failed" }>;
  readonly stop: () => unknown;
}

interface ContainedPluginLifecycle {
  cancel(): unknown;
  shutdown(): unknown;
}

type PluginCleanupMode = "cancelled" | "stopped";

interface PluginCleanupCoordinator {
  cleanup(mode: PluginCleanupMode): Promise<void>;
}

interface ContainedHostComposition extends Omit<HostComposition, "operations" | "plugins"> {
  readonly initialization: HostInitializationOperations;
  readonly plugins?: ContainedPluginLifecycle;
}

interface CanonicalApplicationOperations {
  readonly full?: ApplicationOperations;
  readonly initialization: HostInitializationOperations;
  readonly source: object;
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

function startupFailures(diagnostics: readonly Diagnostic[]): HostRunOutcome {
  return Object.freeze({
    diagnostics,
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
  | {
      readonly diagnostics?: readonly Diagnostic[];
      readonly state: "bootstrap-failed";
    }
  | { readonly state: "cancelled" }
  | { readonly state: "invalid-composition" }
  | { readonly composition: ContainedHostComposition; readonly state: "composed" };

type ObservedRecoveryOutcome =
  | { readonly state: "cancelled" }
  | { readonly state: "malformed" }
  | { readonly state: "rejected" }
  | { readonly recovered: ValidatedRecoveryOutcome; readonly state: "validated" };

const bootstrapFailureMessages = Object.freeze({
  "bootstrap-provider-ambiguous":
    "Bootstrap capabilities must have exactly one compatible provider",
  "host-runtime-registration-invalid": "Host runtime registrations must use the official namespace",
  "incompatible-plugin-runtime-version": "Plugin runtime API version is incompatible",
  "incompatible-plugin-sdk-version": "Plugin SDK version is incompatible",
  "invalid-local-plugin-package-source": "Local plugin package source is malformed",
  "invalid-plugin-package-document":
    "Plugin package JSON must contain exactly the documented fields",
  "invalid-plugin-package-manifest":
    "Plugin package manifest does not match the bounded public SDK contract",
  "personal-plugin-capability-forbidden":
    "Personal plugins may provide or require only groma.presentation.* capabilities",
  "plugin-full-user-permissions-trust-required":
    "Plugins run with your full user permissions. Groma verifies what was installed, not that it is safe. Explicit trust is required before this exact entry can execute",
  "plugin-package-entry-invalid":
    "Plugin entry must export one bounded Phase 1 plugin registration as plugin",
  "plugin-package-entry-undeclared":
    "The selected plugin entry is absent from the exact package manifest",
  "plugin-package-entry-load-failed": "A trusted local plugin entry could not be loaded",
  "plugin-package-entry-unavailable": "The selected local plugin entry is unavailable",
  "plugin-package-file-invalid": "Plugin package files must be bounded regular files, not links",
  "plugin-package-file-unavailable": "A required local plugin package file is unavailable",
  "plugin-package-integrity-drift": "A local package changed after its exact lock was written",
  "plugin-package-enabled-limit-exceeded":
    "Enabled local plugins exceed this Host's runtime capacity",
  "plugin-package-lock-changed":
    "Blueprint plugin package state changed during startup; restart after changes settle",
  "plugin-package-lock-malformed": "The exact plugin package lock is malformed",
  "plugin-package-lock-mismatch":
    "Plugin package configuration does not match its exact lock entry",
  "plugin-package-lock-missing": "A blueprint package declaration has no matching exact lock entry",
  "plugin-package-lock-unavailable": "The exact plugin package lock is unavailable",
  "plugin-package-plugin-id-reserved":
    "Local plugin packages must not use the Host-reserved official.* plugin namespace",
  "plugin-package-plugin-id-conflict": "Enabled local plugins must use distinct plugin IDs",
  "plugin-package-source-unavailable": "Local plugin package source is unavailable",
  "plugin-package-state-limit-exceeded":
    "Local plugin package state exceeds its configured byte bound",
  "plugin-package-state-unavailable":
    "Local plugin package state is changing or unavailable; retry after changes settle",
  "plugin-package-trust-root-unattested":
    "Local plugin trust is unavailable because this Windows Host cannot attest exclusive control of its user-data root",
  "plugin-package-user-state-changed":
    "Local plugin package state changed during startup; restart after changes settle",
  "plugin-package-user-state-malformed": "Local plugin package state is malformed",
  "plugin-package-user-state-unavailable": "Local plugin package state is unavailable",
  "project-plugin-validation-required":
    "Project-provided plugins are unsupported in this release pending package and trust validation",
  "runtime-plugin-unavailable": "A requested official runtime plugin is unavailable in this host",
  "remote-plugin-package-acquisition-out-of-scope":
    "Remote npm, Git, and URL plugin package acquisition is not supported in this delivery",
  "unsupported-plugin-package-manifest-version": "Plugin package manifest version is unsupported",
  "unsupported-bootstrap-target":
    "Workspace bootstrap does not support this runtime platform or architecture",
  "workspace-configuration-conflict": "Workspace configuration is incompatible with this host",
  "workspace-configuration-changed":
    "Workspace configuration changed during bootstrap; restart after changes settle",
  "workspace-configuration-malformed":
    "Workspace configuration must use the documented groma/v0.1 schema",
  "workspace-configuration-parser-failed": "Workspace configuration parsing failed",
  "workspace-configuration-provider-failure": "Workspace configuration access failed",
  "workspace-discovery-conflict": "More than one workspace configuration was discovered",
  "workspace-discovery-failed": "Workspace configuration discovery failed",
} as const);

function containedBootstrapFailure(value: unknown): ObservedBootstrapOutcome {
  const diagnostics = copyHostDiagnostics(value, 100, "invalid-host-bootstrap-result");
  if (!diagnostics.ok || diagnostics.value.length === 0) {
    return { state: "bootstrap-failed" };
  }

  const canonical: Diagnostic[] = [];
  for (const source of diagnostics.value) {
    if (!Object.hasOwn(bootstrapFailureMessages, source.code)) {
      return { state: "bootstrap-failed" };
    }
    let index = 0;
    while (index < canonical.length && canonical[index]!.code < source.code) index += 1;
    if (canonical[index]?.code === source.code) continue;
    for (let move = canonical.length; move > index; move -= 1) {
      canonical[move] = canonical[move - 1]!;
    }
    canonical[index] = diagnostic(
      source.code,
      bootstrapFailureMessages[source.code as keyof typeof bootstrapFailureMessages],
    );
  }

  return {
    diagnostics: Object.freeze(canonical),
    state: "bootstrap-failed",
  };
}

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

function workspaceCapabilityFailure(): Result<never> {
  return Object.freeze({
    diagnostics: Object.freeze([
      diagnostic("workspace-capability-failed", "Workspace operation access failed safely"),
    ]),
    ok: false,
  });
}

const workspaceFailureMessages = Object.freeze({
  "no-workspace": "This operation requires an initialized Groma workspace",
  "workspace-configuration-conflict": "Workspace configuration is incompatible with this host",
  "workspace-configuration-provider-failure": "Workspace configuration access failed",
  "workspace-recovery-required":
    "Workspace transaction recovery must complete before semantic operations",
} as const);

function canonicalWorkspaceFailure(value: unknown): Result<never> {
  const diagnostics = copyHostDiagnostics(value, 1, "workspace-capability-failed");
  if (!diagnostics.ok || diagnostics.value.length !== 1) return workspaceCapabilityFailure();
  const code = diagnostics.value[0]!.code;
  if (!Object.hasOwn(workspaceFailureMessages, code)) return workspaceCapabilityFailure();
  return Object.freeze({
    diagnostics: Object.freeze([
      diagnostic(code, workspaceFailureMessages[code as keyof typeof workspaceFailureMessages]),
    ]),
    ok: false,
  });
}

function canonicalWorkspace(
  value: unknown,
  operations: CanonicalApplicationOperations,
): Result<WorkspaceAccessCapability> {
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
      requireWorkspace: () => {
        let raw: unknown;
        try {
          raw = intrinsicReflectApply(requireWorkspace, source, []);
        } catch {
          return workspaceCapabilityFailure();
        }
        const promise = observeHostNativePromise(
          raw,
          () => undefined,
          () => undefined,
        );
        if (promise.status !== "not-native") return workspaceCapabilityFailure();
        const result = inspectHostRecord(
          raw,
          [
            ["ok", "value"],
            ["diagnostics", "ok"],
          ],
          "workspace-capability-failed",
          "Workspace operation result",
        );
        if (!result.ok) return workspaceCapabilityFailure();
        if (result.value.ok === false) {
          return canonicalWorkspaceFailure(result.value.diagnostics);
        }
        if (
          result.value.ok !== true ||
          result.value.value !== operations.source ||
          operations.full === undefined
        ) {
          return workspaceCapabilityFailure();
        }
        return Object.freeze({ ok: true as const, value: operations.full });
      },
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

function canonicalPackageOperations(value: unknown): Result<PluginPackageOperations> {
  const packages = inspectHostRecord(
    value,
    [["add", "disable", "enable", "inspect", "remove", "scaffold"]],
    "invalid-host-composition",
    "Plugin package operations",
  );
  if (
    !packages.ok ||
    typeof packages.value.add !== "function" ||
    typeof packages.value.disable !== "function" ||
    typeof packages.value.enable !== "function" ||
    typeof packages.value.inspect !== "function" ||
    typeof packages.value.remove !== "function" ||
    typeof packages.value.scaffold !== "function"
  ) {
    return failure(
      diagnostic("invalid-host-composition", "Plugin package operations are malformed"),
    );
  }
  const receiver = value as object;
  const add = packages.value.add as PluginPackageOperations["add"];
  const disable = packages.value.disable as PluginPackageOperations["disable"];
  const enable = packages.value.enable as PluginPackageOperations["enable"];
  const inspect = packages.value.inspect as PluginPackageOperations["inspect"];
  const remove = packages.value.remove as PluginPackageOperations["remove"];
  const scaffold = packages.value.scaffold as PluginPackageOperations["scaffold"];
  return success(
    Object.freeze({
      add: (request: Parameters<PluginPackageOperations["add"]>[0]) =>
        intrinsicReflectApply(add, receiver, [request]),
      disable: (request: Parameters<PluginPackageOperations["disable"]>[0]) =>
        intrinsicReflectApply(disable, receiver, [request]),
      enable: (request: Parameters<PluginPackageOperations["enable"]>[0]) =>
        intrinsicReflectApply(enable, receiver, [request]),
      inspect: (request: Parameters<PluginPackageOperations["inspect"]>[0]) =>
        intrinsicReflectApply(inspect, receiver, [request]),
      remove: (request: Parameters<PluginPackageOperations["remove"]>[0]) =>
        intrinsicReflectApply(remove, receiver, [request]),
      scaffold: (request: Parameters<PluginPackageOperations["scaffold"]>[0]) =>
        intrinsicReflectApply(scaffold, receiver, [request]),
    }) as PluginPackageOperations,
  );
}

function canonicalSchemaMigrationOperations(value: unknown): Result<SchemaMigrationOperations> {
  const migrations = inspectHostRecord(
    value,
    [["apply", "preview", "status"]],
    "invalid-host-composition",
    "Schema migration operations",
  );
  if (
    !migrations.ok ||
    typeof migrations.value.apply !== "function" ||
    typeof migrations.value.preview !== "function" ||
    typeof migrations.value.status !== "function"
  ) {
    return failure(
      diagnostic("invalid-host-composition", "Schema migration operations are malformed"),
    );
  }
  const receiver = value as object;
  const apply = migrations.value.apply as SchemaMigrationOperations["apply"];
  const preview = migrations.value.preview as SchemaMigrationOperations["preview"];
  const status = migrations.value.status as SchemaMigrationOperations["status"];
  return success(
    Object.freeze({
      apply: () => intrinsicReflectApply(apply, receiver, []),
      preview: () => intrinsicReflectApply(preview, receiver, []),
      status: () => intrinsicReflectApply(status, receiver, []),
    }),
  );
}

function canonicalPluginLifecycle(value: unknown): Result<ContainedPluginLifecycle> {
  const plugins = inspectHostRecord(
    value,
    [["cancel", "capabilities", "inspect", "shutdown"]],
    "invalid-host-composition",
    "Plugin runtime",
  );
  if (
    !plugins.ok ||
    typeof plugins.value.cancel !== "function" ||
    typeof plugins.value.capabilities !== "function" ||
    typeof plugins.value.inspect !== "function" ||
    typeof plugins.value.shutdown !== "function"
  ) {
    return failure(diagnostic("invalid-host-composition", "Plugin runtime is malformed"));
  }
  const receiver = value as object;
  const cancel = plugins.value.cancel;
  const shutdown = plugins.value.shutdown;
  return success(
    Object.freeze({
      cancel: () => intrinsicReflectApply(cancel, receiver, []),
      shutdown: () => intrinsicReflectApply(shutdown, receiver, []),
    }),
  );
}

function canonicalApplicationOperations(value: unknown): Result<CanonicalApplicationOperations> {
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
        "mergeComponent",
        "removeComponent",
        "reparentComponent",
        "updateComponent",
      ],
      [
        "createComponent",
        "exportBlueprint",
        "getComponent",
        "initialize",
        "listChildren",
        "listComponents",
        "listRoots",
        "mergeComponent",
        "removeComponent",
        "reparentComponent",
        "searchBlueprint",
        "traverseBlueprint",
        "updateComponent",
      ],
    ],
    "invalid-host-composition",
    "Application operations",
  );
  const expanded = operations.ok && Object.hasOwn(operations.value, "exportBlueprint");
  if (
    !operations.ok ||
    typeof operations.value.createComponent !== "function" ||
    typeof operations.value.getComponent !== "function" ||
    typeof operations.value.initialize !== "function" ||
    typeof operations.value.listChildren !== "function" ||
    typeof operations.value.listComponents !== "function" ||
    typeof operations.value.listRoots !== "function" ||
    typeof operations.value.mergeComponent !== "function" ||
    typeof operations.value.removeComponent !== "function" ||
    typeof operations.value.reparentComponent !== "function" ||
    typeof operations.value.updateComponent !== "function" ||
    (expanded &&
      (typeof operations.value.exportBlueprint !== "function" ||
        typeof operations.value.searchBlueprint !== "function" ||
        typeof operations.value.traverseBlueprint !== "function"))
  ) {
    return failure(diagnostic("invalid-host-composition", "Application operations are malformed"));
  }
  const source = value as object;
  const createComponent = operations.value
    .createComponent as ApplicationOperations["createComponent"];
  const exportBlueprint = operations.value.exportBlueprint as
    ApplicationOperations["exportBlueprint"] | undefined;
  const getComponent = operations.value.getComponent as ApplicationOperations["getComponent"];
  const initialize = operations.value.initialize;
  const listChildren = operations.value.listChildren as ApplicationOperations["listChildren"];
  const listComponents = operations.value.listComponents as ApplicationOperations["listComponents"];
  const listRoots = operations.value.listRoots as ApplicationOperations["listRoots"];
  const mergeComponent = operations.value.mergeComponent as ApplicationOperations["mergeComponent"];
  const removeComponent = operations.value
    .removeComponent as ApplicationOperations["removeComponent"];
  const reparentComponent = operations.value
    .reparentComponent as ApplicationOperations["reparentComponent"];
  const searchBlueprint = operations.value.searchBlueprint as
    ApplicationOperations["searchBlueprint"] | undefined;
  const traverseBlueprint = operations.value.traverseBlueprint as
    ApplicationOperations["traverseBlueprint"] | undefined;
  const updateComponent = operations.value
    .updateComponent as ApplicationOperations["updateComponent"];
  const initialization = Object.freeze({
    initialize: (request: Parameters<HostInitializationOperations["initialize"]>[0]) =>
      intrinsicReflectApply(initialize, source, [request]),
  }) as HostInitializationOperations;
  const full = expanded
    ? (Object.freeze({
        createComponent: (request: Parameters<ApplicationOperations["createComponent"]>[0]) =>
          intrinsicReflectApply(createComponent, source, [request]),
        exportBlueprint: (request: Parameters<ApplicationOperations["exportBlueprint"]>[0]) =>
          intrinsicReflectApply(exportBlueprint!, source, [request]),
        getComponent: (request: Parameters<ApplicationOperations["getComponent"]>[0]) =>
          intrinsicReflectApply(getComponent, source, [request]),
        initialize: (request: Parameters<ApplicationOperations["initialize"]>[0]) =>
          intrinsicReflectApply(initialize, source, [request]),
        listChildren: (request: Parameters<ApplicationOperations["listChildren"]>[0]) =>
          intrinsicReflectApply(listChildren, source, [request]),
        listComponents: (request: Parameters<ApplicationOperations["listComponents"]>[0]) =>
          intrinsicReflectApply(listComponents, source, [request]),
        listRoots: (request: Parameters<ApplicationOperations["listRoots"]>[0]) =>
          intrinsicReflectApply(listRoots, source, [request]),
        mergeComponent: (request: Parameters<ApplicationOperations["mergeComponent"]>[0]) =>
          intrinsicReflectApply(mergeComponent, source, [request]),
        removeComponent: (request: Parameters<ApplicationOperations["removeComponent"]>[0]) =>
          intrinsicReflectApply(removeComponent, source, [request]),
        reparentComponent: (request: Parameters<ApplicationOperations["reparentComponent"]>[0]) =>
          intrinsicReflectApply(reparentComponent, source, [request]),
        searchBlueprint: (request: Parameters<ApplicationOperations["searchBlueprint"]>[0]) =>
          intrinsicReflectApply(searchBlueprint!, source, [request]),
        traverseBlueprint: (request: Parameters<ApplicationOperations["traverseBlueprint"]>[0]) =>
          intrinsicReflectApply(traverseBlueprint!, source, [request]),
        updateComponent: (request: Parameters<ApplicationOperations["updateComponent"]>[0]) =>
          intrinsicReflectApply(updateComponent, source, [request]),
      }) as ApplicationOperations)
    : undefined;
  return success(
    Object.freeze({
      ...(full === undefined ? {} : { full }),
      initialization,
      source,
    }),
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
        "packages",
        "projection",
        "projectionRead",
        "queryEngine",
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
      [
        "graph",
        "invariant",
        "model",
        "migrations",
        "operations",
        "packages",
        "projection",
        "projectionRead",
        "queryEngine",
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
      [
        "graph",
        "invariant",
        "model",
        "operations",
        "packages",
        "plugins",
        "projection",
        "projectionRead",
        "queryEngine",
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
      [
        "graph",
        "invariant",
        "model",
        "migrations",
        "operations",
        "packages",
        "plugins",
        "projection",
        "projectionRead",
        "queryEngine",
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
  const operations = canonicalApplicationOperations(composition.value.operations);
  if (!operations.ok) return operations;
  const workspace = canonicalWorkspace(composition.value.workspace, operations.value);
  if (!workspace.ok) return workspace;
  const surface = canonicalSurface(composition.value.surface);
  if (!surface.ok) return surface;
  const packages = canonicalPackageOperations(composition.value.packages);
  if (!packages.ok) return packages;
  const migrations = Object.hasOwn(composition.value, "migrations")
    ? canonicalSchemaMigrationOperations(composition.value.migrations)
    : undefined;
  if (migrations !== undefined && !migrations.ok) return migrations;
  const plugins = Object.hasOwn(composition.value, "plugins")
    ? canonicalPluginLifecycle(composition.value.plugins)
    : undefined;
  if (plugins !== undefined && !plugins.ok) return plugins;
  for (const field of [
    "graph",
    "invariant",
    "model",
    "projection",
    "projectionRead",
    "queryEngine",
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
      initialization: operations.value.initialization,
      invariant: composition.value.invariant,
      model: composition.value.model,
      ...(migrations === undefined ? {} : { migrations: migrations.value }),
      packages: packages.value,
      ...(plugins === undefined ? {} : { plugins: plugins.value }),
      projection: composition.value.projection,
      projectionRead: composition.value.projectionRead,
      queryEngine: composition.value.queryEngine,
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

function validPluginShutdownReport(
  value: unknown,
  expectedState: "cancelled" | "stopped",
): boolean {
  const report = inspectHostRecord(
    value,
    [["state", "stoppedPluginIds"]],
    "invalid-host-plugin-cleanup",
    "Plugin shutdown report",
  );
  if (!report.ok || report.value.state !== expectedState) return false;
  const ids = inspectHostDenseArray(
    report.value.stoppedPluginIds,
    256,
    "invalid-host-plugin-cleanup",
    "Stopped plugin IDs",
  );
  return (
    ids.ok && ids.value.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128)
  );
}

async function observePluginCleanup(
  value: unknown,
  expectedState: "cancelled" | "stopped",
): Promise<void> {
  const observed = observeHostNativePromise(
    value,
    (settled) => {
      const contained = containCapabilityValue(settled, {
        isProxy: isHostProxy,
        maximumContainerEntries: 256,
        maximumDepth: 8,
        maximumValues: 4_096,
      });
      if (!contained.ok) return false;
      const result = inspectHostRecord(
        contained.value,
        [
          ["ok", "value"],
          ["diagnostics", "ok"],
        ],
        "invalid-host-plugin-cleanup",
        "Plugin cleanup result",
      );
      return (
        result.ok &&
        result.value.ok === true &&
        validPluginShutdownReport(result.value.value, expectedState)
      );
    },
    () => false,
  );
  if (observed.status !== "observed" || !(await observed.promise)) {
    throw new Error("Host plugin cleanup failed");
  }
}

function createPluginCleanupCoordinator(
  plugins: ContainedPluginLifecycle,
): PluginCleanupCoordinator {
  let cleanup: Promise<void> | undefined;
  return Object.freeze({
    cleanup(mode: PluginCleanupMode): Promise<void> {
      if (cleanup !== undefined) return cleanup;
      let resolveCleanup!: () => void;
      let rejectCleanup!: () => void;
      cleanup = new Promise<void>((resolve, reject) => {
        resolveCleanup = resolve;
        rejectCleanup = () => reject(new Error("Host plugin cleanup failed"));
      });
      let raw: unknown;
      try {
        raw = mode === "cancelled" ? plugins.cancel() : plugins.shutdown();
      } catch {
        rejectCleanup();
        return cleanup;
      }
      void observePluginCleanup(raw, mode).then(resolveCleanup, rejectCleanup);
      return cleanup;
    },
  });
}

function containDetached(value: Promise<unknown>): void {
  void value.then(
    () => undefined,
    () => undefined,
  );
}

function schedulePluginCleanupAfter(
  settlement: Promise<unknown>,
  plugins: PluginCleanupCoordinator,
): void {
  containDetached(
    settlement.then(
      () => plugins.cleanup("cancelled"),
      () => plugins.cleanup("cancelled"),
    ),
  );
}

function scheduleLateSurfaceCleanup(
  start: Promise<ObservedSurfaceStartOutcome>,
  plugins?: PluginCleanupCoordinator,
): void {
  containDetached(
    start.then(
      async (late) => {
        if (late.state === "started") {
          try {
            await observeRequiredCleanup(late.session.stop(), "Host surface cleanup failed");
          } catch {
            // A late surface stop failure must not skip provider cancellation.
          }
        }
        if (plugins !== undefined) {
          await plugins.cleanup("cancelled");
        }
      },
      async () => {
        if (plugins !== undefined) {
          await plugins.cleanup("cancelled");
        }
      },
    ),
  );
}

function scheduleLateCompositionCleanup(composition: Promise<ObservedBootstrapOutcome>): void {
  containDetached(
    composition.then(
      async (late) => {
        if (late.state === "composed" && late.composition.plugins !== undefined) {
          await createPluginCleanupCoordinator(late.composition.plugins).cleanup("cancelled");
        }
      },
      () => undefined,
    ),
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
  let pluginCleanupMode: PluginCleanupMode = "stopped";
  let resolveCancellation!: () => void;
  const cancellation = new Promise<void>((resolve) => {
    resolveCancellation = resolve;
  });
  const requestCancellation = (signal?: unknown) => {
    if (hostCancellation.signal.aborted) return;
    pluginCleanupMode = "cancelled";
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
  let pluginCleanup: PluginCleanupCoordinator | undefined;
  let pluginCleanupDeferred = false;
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
            const result = inspectHostRecord(
              value,
              [
                ["ok", "value"],
                ["diagnostics", "ok"],
              ],
              "invalid-host-bootstrap-result",
              "Host bootstrap result",
            );
            if (!result.ok) {
              return { state: "bootstrap-failed" as const };
            }
            if (result.value.ok === false) {
              return containedBootstrapFailure(result.value.diagnostics);
            }
            if (result.value.ok !== true) {
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
            scheduleLateCompositionCleanup(composed.promise);
            outcome = cancelled(cancellationSignal);
          } else if (first.state === "bootstrap-failed") {
            outcome =
              first.diagnostics === undefined
                ? startupFailure("host-bootstrap-failed", "Host bootstrap failed")
                : startupFailures(first.diagnostics);
          } else if (first.state === "invalid-composition") {
            outcome = startupFailure(
              "invalid-host-composition",
              "Host bootstrap returned malformed capabilities",
            );
          } else {
            const composition = first.composition;
            pluginCleanup =
              composition.plugins === undefined
                ? undefined
                : createPluginCleanupCoordinator(composition.plugins);
            if (hostCancellation.signal.aborted) {
              outcome = cancelled(cancellationSignal);
            } else {
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
                    if (pluginCleanup !== undefined) {
                      pluginCleanupDeferred = true;
                      schedulePluginCleanupAfter(observedRecovery.promise, pluginCleanup);
                    }
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
                    ...(composition.migrations === undefined
                      ? {}
                      : { migrations: composition.migrations }),
                    packages: composition.packages,
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
                    if (pluginCleanup !== undefined) pluginCleanupDeferred = true;
                    scheduleLateSurfaceCleanup(start, pluginCleanup);
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
                      outcome = surfaceFailure(
                        "host-surface-failed",
                        "Host surface session failed",
                      );
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
  if (pluginCleanup !== undefined && !pluginCleanupDeferred) {
    try {
      await pluginCleanup.cleanup(pluginCleanupMode);
    } catch {
      outcome = surfaceFailure("host-plugin-cleanup-failed", "Host plugin cleanup failed");
    }
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
