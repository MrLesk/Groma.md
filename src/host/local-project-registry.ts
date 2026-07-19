import { createHash } from "node:crypto";
import path from "node:path";

import {
  containNativePromise,
  createOpaqueIdSource,
  failure,
  success,
  type Diagnostic,
  type EntropySource,
  type Result,
} from "../core/index.ts";
import type { GraphData } from "../core/payload.ts";
import {
  localResourceProviderCeilings,
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type StagedReplacementHandle,
  type WorkspaceResourceLocator,
} from "../persistence/index.ts";
import {
  bootstrapConfigurationBounds,
  canonicalizeProjectRegistration,
  createYamlConfigurationParser,
  localBootstrapConvention,
  isProjectRegistrationId,
  serializeBootstrapConfiguration,
  workspaceConfigurationCoordinationLocator,
  type BootstrapArchitecture,
  type BootstrapBaseConfiguration,
  type BootstrapPlatform,
  type ConfiguredProjectRegistration,
  type ConfiguredProjectScanner,
} from "./bootstrap-configuration.ts";
import {
  copyHostDiagnostics,
  inspectHostDenseArray,
  inspectHostRecord,
  isHostProxy,
} from "./runtime-validation.ts";

export interface ProjectRegistrationInput {
  readonly coverage: readonly {
    readonly id: string;
    readonly resourceRoot: string;
  }[];
  readonly name: string;
  readonly scanners: readonly {
    readonly configuration: GraphData;
    readonly id: string;
  }[];
  readonly source: string;
}

export interface AddProjectRegistrationRequest extends ProjectRegistrationInput {}

export interface GetProjectRegistrationRequest {
  readonly id: string;
}

export interface UpdateProjectRegistrationRequest extends ProjectRegistrationInput {
  readonly expectedRevision: string;
  readonly id: string;
}

export interface RemoveProjectRegistrationRequest {
  readonly expectedRevision: string;
  readonly id: string;
}

export interface ProjectRegistrationSnapshot {
  readonly availability: "available" | "unavailable";
  readonly coverage: readonly {
    readonly id: string;
    readonly resourceRoot: string;
  }[];
  readonly id: string;
  readonly name: string;
  readonly revision: string;
  readonly scanners: readonly ConfiguredProjectScanner[];
  readonly source: string;
}

export interface ProjectRegistrationOperations {
  add(request: AddProjectRegistrationRequest): Promise<Result<ProjectRegistrationSnapshot>>;
  get(request: GetProjectRegistrationRequest): Promise<Result<ProjectRegistrationSnapshot>>;
  list(): Promise<Result<readonly ProjectRegistrationSnapshot[]>>;
  remove(
    request: RemoveProjectRegistrationRequest,
  ): Promise<Result<{ readonly removed: string; readonly revision: string }>>;
  update(request: UpdateProjectRegistrationRequest): Promise<Result<ProjectRegistrationSnapshot>>;
}

export interface LocalProjectRegistryOptions {
  readonly entropy: EntropySource;
  readonly resources: LocalResourceProvider;
}

export interface ProjectSourcePathTarget {
  readonly architecture: BootstrapArchitecture;
  readonly platform: BootstrapPlatform;
  readonly source: string;
  readonly workspaceRoot: string;
}

export interface ProjectSourcePathConvention {
  readonly absoluteSourcePath: string;
  readonly source: WorkspaceResourceLocator;
}

export interface ProjectObservationBoundary {
  readonly projectId: string;
  /** Aggregate-blueprint-relative root used to confine the project resource provider. */
  readonly projectSource: WorkspaceResourceLocator;
  /** Roots remain project-source-relative for the future scanner session. */
  readonly scopes: readonly {
    readonly id: string;
    readonly resourceRoot: string;
  }[];
}

const configurationLocatorResult = workspaceResourceLocator("groma", "groma.yaml");
if (!configurationLocatorResult.ok)
  throw new Error("Invalid project registry configuration locator");
const configurationLocator = configurationLocatorResult.value;
const textEncoder = new TextEncoder();
const maximumIdentityAttempts = 16;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicReflectApply = Reflect.apply;
const intrinsicUint8Array = Uint8Array;
const intrinsicUint8ArrayPrototype = Uint8Array.prototype;
const intrinsicTypedArrayPrototype = intrinsicObjectGetPrototypeOf(intrinsicUint8ArrayPrototype);
const intrinsicTypedArrayByteLength = (() => {
  const getter = Object.getOwnPropertyDescriptor(intrinsicTypedArrayPrototype, "byteLength")?.get;
  if (getter === undefined) throw new Error("Uint8Array byte length intrinsic is unavailable");
  return getter;
})();

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function projectFailure<T>(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Result<T> {
  return failure(Object.freeze({ code, ...(details === undefined ? {} : { details }), message }));
}

function isExactMissing(diagnostics: readonly Diagnostic[]): boolean {
  const item = diagnostics[0];
  if (
    diagnostics.length !== 1 ||
    item?.code !== "resource-missing" ||
    item.message !== "Workspace resource does not exist" ||
    item.details === undefined
  ) {
    return false;
  }
  try {
    const keys = Reflect.ownKeys(item.details);
    const operation = Object.getOwnPropertyDescriptor(item.details, "operation");
    return (
      keys.length === 1 &&
      keys[0] === "operation" &&
      operation !== undefined &&
      "value" in operation &&
      operation.value === "resolve a resource"
    );
  } catch {
    return false;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function copyBoundedConfigurationBytes(value: unknown): Result<Uint8Array> {
  if (typeof value !== "object" || value === null) {
    return projectFailure(
      "project-registry-unavailable",
      "Project registration state is unavailable",
    );
  }
  try {
    if (intrinsicObjectGetPrototypeOf(value) !== intrinsicUint8ArrayPrototype) {
      return projectFailure(
        "project-registry-unavailable",
        "Project registration state is unavailable",
      );
    }
    const byteLength = intrinsicReflectApply(intrinsicTypedArrayByteLength, value, []) as number;
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      byteLength > bootstrapConfigurationBounds.maxConfigurationBytes
    ) {
      return projectFailure(
        "project-registry-unavailable",
        "Project registration state is unavailable",
      );
    }
    const copied = new intrinsicUint8Array(byteLength);
    for (let index = 0; index < byteLength; index += 1) {
      copied[index] = (value as Uint8Array)[index]!;
    }
    return success(copied);
  } catch {
    return projectFailure(
      "project-registry-unavailable",
      "Project registration state is unavailable",
    );
  }
}

function isOpaqueStageHandle(value: unknown): value is StagedReplacementHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    !isHostProxy(value) &&
    containNativePromise(value) === "not-native"
  );
}

function containedStageResult(value: unknown): Result<StagedReplacementHandle> {
  const result = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "project-registry-unavailable",
    "Project registry stage result",
  );
  if (!result.ok) {
    return projectFailure(
      "project-registry-unavailable",
      "Project registration state is unavailable",
    );
  }
  if (result.value.ok === false) {
    const diagnostics = copyHostDiagnostics(
      result.value.diagnostics,
      bootstrapConfigurationBounds.maxProviderDiagnostics,
      "project-registry-unavailable",
    );
    return diagnostics.ok && diagnostics.value.length > 0
      ? projectFailure(
          "project-registry-not-committed",
          "Project registration state was not committed",
        )
      : projectFailure("project-registry-unavailable", "Project registration state is unavailable");
  }
  return result.value.ok === true && isOpaqueStageHandle(result.value.value)
    ? success(result.value.value)
    : projectFailure("project-registry-unavailable", "Project registration state is unavailable");
}

function containedReadbackBytes(value: unknown): Result<Uint8Array> {
  const read = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "project-registry-state-indeterminate",
    "Project registry readback result",
  );
  if (!read.ok) {
    return projectFailure(
      "project-registry-state-indeterminate",
      "Project registration state may have committed; inspect the project before retrying",
    );
  }
  if (read.value.ok === false) {
    const diagnostics = copyHostDiagnostics(
      read.value.diagnostics,
      bootstrapConfigurationBounds.maxProviderDiagnostics,
      "project-registry-state-indeterminate",
    );
    if (!diagnostics.ok) {
      return projectFailure(
        "project-registry-state-indeterminate",
        "Project registration state may have committed; inspect the project before retrying",
      );
    }
    return projectFailure(
      "project-registry-state-indeterminate",
      "Project registration state may have committed; inspect the project before retrying",
    );
  }
  if (read.value.ok !== true) {
    return projectFailure(
      "project-registry-state-indeterminate",
      "Project registration state may have committed; inspect the project before retrying",
    );
  }
  const contents = inspectHostRecord(
    read.value.value,
    [["bytes"]],
    "project-registry-state-indeterminate",
    "Project registry readback contents",
  );
  if (!contents.ok) {
    return projectFailure(
      "project-registry-state-indeterminate",
      "Project registration state may have committed; inspect the project before retrying",
    );
  }
  const bytes = copyBoundedConfigurationBytes(contents.value.bytes);
  return bytes.ok
    ? bytes
    : projectFailure(
        "project-registry-state-indeterminate",
        "Project registration state may have committed; inspect the project before retrying",
      );
}

function directoryOverflowProvesAvailability(diagnostics: readonly Diagnostic[]): boolean {
  if (diagnostics.length !== 1) return false;
  const item = diagnostics[0];
  if (
    item?.code !== "resource-directory-overflow" ||
    item.message !== "A directory exceeds the explicit enumeration entry bound" ||
    item.details === undefined
  ) {
    return false;
  }
  try {
    const keys = Reflect.ownKeys(item.details);
    const maximum = Object.getOwnPropertyDescriptor(item.details, "maximum");
    return (
      keys.length === 1 &&
      keys[0] === "maximum" &&
      maximum !== undefined &&
      "value" in maximum &&
      maximum.value === 1
    );
  } catch {
    return false;
  }
}

function validEnumerationEntry(value: unknown): boolean {
  const entry = inspectHostRecord(
    value,
    [
      ["kind", "locator"],
      ["kind", "locator", "size"],
    ],
    "project-source-unavailable",
    "Project source enumeration entry",
  );
  if (!entry.ok) return false;
  if (
    entry.value.kind !== "directory" &&
    entry.value.kind !== "file" &&
    entry.value.kind !== "link" &&
    entry.value.kind !== "other"
  ) {
    return false;
  }
  if (!parseWorkspaceResourceLocator(entry.value.locator).ok) return false;
  if (Object.hasOwn(entry.value, "size")) {
    return (
      entry.value.kind === "file" &&
      Number.isSafeInteger(entry.value.size) &&
      (entry.value.size as number) >= 0
    );
  }
  return true;
}

function validEnumerationPage(value: unknown): boolean {
  const page = inspectHostRecord(
    value,
    [
      ["entries", "truncatedByDepth"],
      ["entries", "nextCursor", "truncatedByDepth"],
    ],
    "project-source-unavailable",
    "Project source enumeration page",
  );
  if (!page.ok || typeof page.value.truncatedByDepth !== "boolean") return false;
  const entries = inspectHostDenseArray(
    page.value.entries,
    1,
    "project-source-unavailable",
    "Project source enumeration entries",
  );
  if (!entries.ok || entries.value.some((entry) => !validEnumerationEntry(entry))) return false;
  if (!Object.hasOwn(page.value, "nextCursor")) return true;
  const cursor = page.value.nextCursor;
  return (
    typeof cursor === "string" &&
    cursor.length > 0 &&
    cursor.length <= localResourceProviderCeilings.maxCursorBytes &&
    textEncoder.encode(cursor).byteLength <= localResourceProviderCeilings.maxCursorBytes
  );
}

function enumerationProvesAvailability(value: unknown): boolean {
  const result = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "project-source-unavailable",
    "Project source enumeration result",
  );
  if (!result.ok) return false;
  if (result.value.ok === true) return validEnumerationPage(result.value.value);
  if (result.value.ok !== false) return false;
  const diagnostics = copyHostDiagnostics(
    result.value.diagnostics,
    bootstrapConfigurationBounds.maxProviderDiagnostics,
    "project-source-unavailable",
  );
  return diagnostics.ok && directoryOverflowProvesAvailability(diagnostics.value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function projects(
  configuration: BootstrapBaseConfiguration,
): readonly ConfiguredProjectRegistration[] {
  return configuration.projectRegistrations ?? Object.freeze([]);
}

function retiredProjectIds(configuration: BootstrapBaseConfiguration): readonly string[] {
  return configuration.retiredProjectIds ?? Object.freeze([]);
}

export function resolveProjectSourcePath(
  target: ProjectSourcePathTarget,
): Result<ProjectSourcePathConvention> {
  const convention = localBootstrapConvention(target);
  const source = parseWorkspaceResourceLocator(target.source);
  if (!convention.ok || !source.ok || source.value !== target.source) {
    return projectFailure(
      "invalid-project-source-locator",
      "Project source must be a portable workspace-relative locator",
    );
  }
  const paths = target.platform === "win32" ? path.win32 : path.posix;
  const segments = source.value === "." ? [] : source.value.split("/");
  return success(
    Object.freeze({
      absoluteSourcePath: paths.join(convention.value.workspaceRoot, ...segments),
      source: source.value,
    }),
  );
}

export function projectObservationBoundary(
  project: ConfiguredProjectRegistration,
): ProjectObservationBoundary {
  return Object.freeze({
    projectId: project.id,
    projectSource: project.source,
    scopes: Object.freeze(
      project.coverage.map((scope) =>
        Object.freeze({ id: scope.id, resourceRoot: scope.resourceRoot }),
      ),
    ),
  });
}

function projectRevision(project: ConfiguredProjectRegistration): string {
  const canonical = serializeBootstrapConfiguration(
    Object.freeze({
      projectRegistrations: Object.freeze([project]),
      requestedRuntimePlugins: Object.freeze([]),
      retiredProjectIds: Object.freeze([]),
      schema: "groma/v0.1" as const,
    }),
  );
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

function canonicalInput(value: unknown, id: string): Result<ConfiguredProjectRegistration> {
  const input = inspectHostRecord(
    value,
    [["coverage", "name", "scanners", "source"]],
    "invalid-project-registration",
    "Project registration input",
  );
  if (!input.ok)
    return projectFailure("invalid-project-registration", "Project registration is malformed");
  return canonicalizeProjectRegistration(
    Object.freeze({
      coverage: input.value.coverage,
      id,
      name: input.value.name,
      scanners: input.value.scanners,
      source: input.value.source,
    }),
  );
}

function canonicalGet(value: unknown): Result<string> {
  const request = inspectHostRecord(value, [["id"]], "invalid-project-request", "Project request");
  if (!request.ok || !isProjectRegistrationId(request.value.id)) {
    return projectFailure("invalid-project-request", "Project request is malformed");
  }
  return success(request.value.id);
}

function canonicalMutation(
  value: unknown,
  includeRegistration: boolean,
): Result<{
  readonly expectedRevision: string;
  readonly id: string;
  readonly project?: ConfiguredProjectRegistration;
}> {
  const request = inspectHostRecord(
    value,
    [
      includeRegistration
        ? ["coverage", "expectedRevision", "id", "name", "scanners", "source"]
        : ["expectedRevision", "id"],
    ],
    "invalid-project-request",
    "Project mutation request",
  );
  if (
    !request.ok ||
    !isProjectRegistrationId(request.value.id) ||
    typeof request.value.expectedRevision !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(request.value.expectedRevision)
  ) {
    return projectFailure("invalid-project-request", "Project mutation request is malformed");
  }
  if (!includeRegistration) {
    return success(
      Object.freeze({ expectedRevision: request.value.expectedRevision, id: request.value.id }),
    );
  }
  const project = canonicalInput(
    Object.freeze({
      coverage: request.value.coverage,
      name: request.value.name,
      scanners: request.value.scanners,
      source: request.value.source,
    }),
    request.value.id,
  );
  return project.ok
    ? success(
        Object.freeze({
          expectedRevision: request.value.expectedRevision,
          id: request.value.id,
          project: project.value,
        }),
      )
    : project;
}

export function createLocalProjectRegistry(
  options: LocalProjectRegistryOptions,
): ProjectRegistrationOperations {
  if (typeof options.entropy !== "function") {
    throw new TypeError("Project registry entropy must be callable");
  }
  const resources = options.resources;
  const parser = createYamlConfigurationParser();
  let operationTail = Promise.resolve();

  const readConfiguration = async (): Promise<Result<BootstrapBaseConfiguration>> => {
    let raw: unknown;
    try {
      raw = await resources.read({
        locator: configurationLocator,
        maxBytes: bootstrapConfigurationBounds.maxConfigurationBytes,
      });
    } catch {
      return projectFailure(
        "project-registry-unavailable",
        "Project registration state is unavailable",
      );
    }
    const read = inspectHostRecord(
      raw,
      [
        ["ok", "value"],
        ["diagnostics", "ok"],
      ],
      "project-registry-unavailable",
      "Project registry resource result",
    );
    if (!read.ok) {
      return projectFailure(
        "project-registry-unavailable",
        "Project registration state is unavailable",
      );
    }
    if (read.value.ok === false) {
      const diagnostics = copyHostDiagnostics(
        read.value.diagnostics,
        bootstrapConfigurationBounds.maxProviderDiagnostics,
        "project-registry-unavailable",
      );
      return diagnostics.ok && isExactMissing(diagnostics.value)
        ? projectFailure("no-workspace", "Initialize a Groma workspace before managing projects")
        : projectFailure(
            "project-registry-unavailable",
            "Project registration state is unavailable",
          );
    }
    if (read.value.ok !== true) {
      return projectFailure(
        "project-registry-unavailable",
        "Project registration state is unavailable",
      );
    }
    const contents = inspectHostRecord(
      read.value.value,
      [["bytes"]],
      "project-registry-unavailable",
      "Project registry resource contents",
    );
    if (!contents.ok) {
      return projectFailure(
        "project-registry-unavailable",
        "Project registration state is unavailable",
      );
    }
    const copied = copyBoundedConfigurationBytes(contents.value.bytes);
    if (!copied.ok) return copied;
    const parsed = parser.parse(copied.value);
    return parsed.ok
      ? success(parsed.value)
      : projectFailure(
          "workspace-configuration-conflict",
          "Workspace configuration is malformed or incompatible",
        );
  };

  const availability = async (
    project: ConfiguredProjectRegistration,
  ): Promise<"available" | "unavailable"> => {
    try {
      const enumerated = await resources.enumerate({
        limit: 1,
        locator: project.source,
        maxDepth: 0,
        maxEntriesPerDirectory: 1,
      });
      return enumerationProvesAvailability(enumerated) ? "available" : "unavailable";
    } catch {
      return "unavailable";
    }
  };

  const snapshot = async (
    project: ConfiguredProjectRegistration,
  ): Promise<ProjectRegistrationSnapshot> =>
    Object.freeze({
      availability: await availability(project),
      coverage: Object.freeze(
        project.coverage.map((scope) =>
          Object.freeze({ id: scope.id, resourceRoot: scope.resourceRoot }),
        ),
      ),
      id: project.id,
      name: project.name,
      revision: projectRevision(project),
      scanners: Object.freeze(
        project.scanners.map((scanner) =>
          Object.freeze({ configuration: scanner.configuration, id: scanner.id }),
        ),
      ),
      source: project.source,
    });

  function serialize<T>(action: () => Promise<Result<T>>): Promise<Result<T>> {
    const next = operationTail
      .then(action, action)
      .catch(() =>
        projectFailure<T>("project-registry-operation-failed", "Project registry operation failed"),
      );
    operationTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  const publish = async (
    update: (current: BootstrapBaseConfiguration) => Result<BootstrapBaseConfiguration>,
  ): Promise<Result<BootstrapBaseConfiguration>> => {
    let publicationMayHaveChanged = false;
    let ownedSettlement: Result<BootstrapBaseConfiguration> | undefined;
    const coordinationWitness = Object.freeze(Object.create(null)) as Readonly<
      Record<string, never>
    >;
    const refusedCoordinationWitness = Object.freeze(Object.create(null)) as Readonly<
      Record<string, never>
    >;
    const coordinationState: {
      admissionOpen: boolean;
      admittedExecutions: number;
      executionState: "not-started" | "running" | "completed" | "failed";
      misuseObserved: boolean;
    } = {
      admissionOpen: true,
      admittedExecutions: 0,
      executionState: "not-started",
      misuseObserved: false,
    };
    let ownedExecutionFence: Promise<void> | undefined;
    const unsettled = (): Result<BootstrapBaseConfiguration> =>
      publicationMayHaveChanged
        ? projectFailure(
            "project-registry-state-indeterminate",
            "Project registration state may have committed; inspect the project before retrying",
          )
        : projectFailure(
            "project-registry-unavailable",
            "Project registration state is unavailable",
          );
    const publication = async (): Promise<Result<BootstrapBaseConfiguration>> => {
      const current = await readConfiguration();
      if (!current.ok) return current;
      const next = update(current.value);
      if (!next.ok) return next;
      const source = serializeBootstrapConfiguration(next.value);
      if (source === serializeBootstrapConfiguration(current.value)) {
        return success(current.value);
      }
      const bytes = textEncoder.encode(source);
      if (bytes.byteLength > bootstrapConfigurationBounds.maxConfigurationBytes) {
        return projectFailure(
          "project-registry-limit-exceeded",
          "Project registration state exceeds the workspace configuration byte bound",
        );
      }
      const roundTrip = parser.parse(bytes);
      if (!roundTrip.ok || serializeBootstrapConfiguration(roundTrip.value) !== source) {
        return projectFailure(
          "project-registry-invalid",
          "Project registration state is not canonical",
        );
      }
      const rawStaged = await resources.stageReplacement(configurationLocator, bytes);
      const staged = containedStageResult(rawStaged);
      if (!staged.ok) return staged;
      publicationMayHaveChanged = true;
      const committed = await resources.commitReplacement(staged.value);
      const outcome = inspectHostRecord(
        committed,
        [["state"], ["diagnostics", "state"]],
        "project-registry-state-indeterminate",
        "Project registry publication outcome",
      );
      if (!outcome.ok) {
        return projectFailure(
          "project-registry-state-indeterminate",
          "Project registration state may have committed; inspect the project before retrying",
        );
      }
      if (Object.hasOwn(outcome.value, "diagnostics")) {
        const diagnostics = copyHostDiagnostics(
          outcome.value.diagnostics,
          bootstrapConfigurationBounds.maxProviderDiagnostics,
          "project-registry-state-indeterminate",
        );
        if (!diagnostics.ok) {
          return projectFailure(
            "project-registry-state-indeterminate",
            "Project registration state may have committed; inspect the project before retrying",
          );
        }
      }
      const state = outcome.value.state;
      if (
        state !== "committed" &&
        state !== "committed-indeterminate" &&
        state !== "not-committed"
      ) {
        return projectFailure(
          "project-registry-state-indeterminate",
          "Project registration state may have committed; inspect the project before retrying",
        );
      }
      if (state === "not-committed") publicationMayHaveChanged = false;
      if (state !== "committed") {
        return projectFailure(
          state === "committed-indeterminate"
            ? "project-registry-state-indeterminate"
            : "project-registry-not-committed",
          state === "committed-indeterminate"
            ? "Project registration state may have committed; inspect the project before retrying"
            : "Project registration state was not committed",
        );
      }
      const rawConfirmed = await resources.read({
        locator: configurationLocator,
        maxBytes: bootstrapConfigurationBounds.maxConfigurationBytes,
      });
      const confirmed = containedReadbackBytes(rawConfirmed);
      if (!confirmed.ok || !sameBytes(confirmed.value, bytes)) {
        return projectFailure(
          "project-registry-state-indeterminate",
          "Project registration state may have committed; inspect the project before retrying",
        );
      }
      return success(roundTrip.value);
    };
    const coordinatedAction = ():
      Readonly<Record<string, never>> | Promise<Readonly<Record<string, never>>> => {
      if (!coordinationState.admissionOpen || coordinationState.admittedExecutions !== 0) {
        coordinationState.misuseObserved = true;
        return refusedCoordinationWitness;
      }
      coordinationState.admissionOpen = false;
      coordinationState.admittedExecutions = 1;
      coordinationState.executionState = "running";
      const execution = (async () => {
        try {
          ownedSettlement = await publication();
          coordinationState.executionState = "completed";
          return coordinationWitness;
        } catch {
          coordinationState.executionState = "failed";
          throw new Error("Project registry coordinated publication failed");
        }
      })();
      ownedExecutionFence = (async () => {
        try {
          await execution;
        } catch {
          // The state above owns classification; the fence only contains and awaits rejection.
        }
      })();
      return execution;
    };

    let rawCoordinated: unknown;
    let coordinationFailed = false;
    try {
      rawCoordinated = await resources.withCoordination(
        { context: "local-machine", locator: workspaceConfigurationCoordinationLocator },
        coordinatedAction,
      );
    } catch {
      coordinationFailed = true;
    }
    coordinationState.admissionOpen = false;
    if (ownedExecutionFence !== undefined) await ownedExecutionFence;
    if (
      coordinationFailed ||
      coordinationState.misuseObserved ||
      coordinationState.admittedExecutions !== 1 ||
      coordinationState.executionState !== "completed" ||
      ownedSettlement === undefined
    ) {
      return unsettled();
    }
    const coordinated = inspectHostRecord(
      rawCoordinated,
      [
        ["ok", "value"],
        ["diagnostics", "ok"],
      ],
      "project-registry-unavailable",
      "Project registry coordination result",
    );
    if (!coordinated.ok) return unsettled();
    if (coordinated.value.ok === false) {
      const diagnostics = copyHostDiagnostics(
        coordinated.value.diagnostics,
        bootstrapConfigurationBounds.maxProviderDiagnostics,
        "project-registry-unavailable",
      );
      if (!diagnostics.ok) return unsettled();
      return unsettled();
    }
    if (coordinated.value.ok !== true || coordinated.value.value !== coordinationWitness) {
      return unsettled();
    }
    const settlement = inspectHostRecord(
      ownedSettlement,
      [
        ["ok", "value"],
        ["diagnostics", "ok"],
      ],
      "project-registry-unavailable",
      "Project registry coordinated settlement",
    );
    if (!settlement.ok) return unsettled();
    if (settlement.value.ok === false) {
      const diagnostics = copyHostDiagnostics(
        settlement.value.diagnostics,
        bootstrapConfigurationBounds.maxProviderDiagnostics,
        "project-registry-unavailable",
      );
      return diagnostics.ok ? failure(...diagnostics.value) : unsettled();
    }
    return settlement.value.ok === true
      ? success(settlement.value.value as BootstrapBaseConfiguration)
      : unsettled();
  };

  const nextIdentity = (configuration: BootstrapBaseConfiguration): Result<string> => {
    const unavailable = new Set([
      ...projects(configuration).map((project) => project.id),
      ...retiredProjectIds(configuration),
    ]);
    for (let attempt = 0; attempt < maximumIdentityAttempts; attempt += 1) {
      try {
        const entity = createOpaqueIdSource(options.entropy).nextEntityId();
        const id = `project_${entity.slice("ent_".length)}`;
        if (!unavailable.has(id)) return success(id);
      } catch {
        return projectFailure(
          "project-identity-unavailable",
          "A stable project identity could not be generated",
        );
      }
    }
    return projectFailure(
      "project-identity-unavailable",
      "A stable project identity could not be generated",
    );
  };

  const add = (
    request: AddProjectRegistrationRequest,
  ): Promise<Result<ProjectRegistrationSnapshot>> => {
    const input = canonicalInput(request, "project.default");
    return serialize(async () => {
      if (!input.ok) return failure(...input.diagnostics);
      let added: ConfiguredProjectRegistration | undefined;
      const written = await publish((current) => {
        if (projects(current).length >= bootstrapConfigurationBounds.maxProjectRegistrations) {
          return projectFailure(
            "project-registry-limit-exceeded",
            "Project registration capacity is exhausted",
          );
        }
        const id = nextIdentity(current);
        if (!id.ok) return id;
        const project = Object.freeze({
          coverage: input.value.coverage,
          id: id.value,
          name: input.value.name,
          scanners: input.value.scanners,
          source: input.value.source,
        });
        added = project;
        return success(
          Object.freeze({
            ...current,
            projectRegistrations: Object.freeze(
              [...projects(current), project].sort((left, right) =>
                compareCodeUnits(left.id, right.id),
              ),
            ),
          }),
        );
      });
      if (!written.ok) {
        if (
          added !== undefined &&
          written.diagnostics.some((item) => item.code === "project-registry-state-indeterminate")
        ) {
          return projectFailure(
            "project-registry-state-indeterminate",
            "Project registration state may have committed; inspect the attempted project identity before retrying",
            Object.freeze({ attemptedProjectId: added.id }),
          );
        }
        return failure(...written.diagnostics);
      }
      return added !== undefined
        ? success(await snapshot(added))
        : projectFailure("project-registry-operation-failed", "Project registry operation failed");
    });
  };

  const get = (
    request: GetProjectRegistrationRequest,
  ): Promise<Result<ProjectRegistrationSnapshot>> => {
    const id = canonicalGet(request);
    return serialize(async () => {
      if (!id.ok) return id;
      const current = await readConfiguration();
      if (!current.ok) return current;
      const project = projects(current.value).find((item) => item.id === id.value);
      return project === undefined
        ? projectFailure("project-not-found", "The requested project is not registered")
        : success(await snapshot(project));
    });
  };

  const list = (): Promise<Result<readonly ProjectRegistrationSnapshot[]>> =>
    serialize(async () => {
      const current = await readConfiguration();
      if (!current.ok) return current;
      const snapshots: ProjectRegistrationSnapshot[] = [];
      for (const project of projects(current.value)) snapshots.push(await snapshot(project));
      return success(Object.freeze(snapshots));
    });

  const update = (
    request: UpdateProjectRegistrationRequest,
  ): Promise<Result<ProjectRegistrationSnapshot>> => {
    const parsed = canonicalMutation(request, true);
    return serialize(async () => {
      if (!parsed.ok) return failure(...parsed.diagnostics);
      if (parsed.value.project === undefined) {
        return projectFailure("invalid-project-request", "Project mutation request is malformed");
      }
      const replacement = parsed.value.project;
      const written = await publish((current) => {
        const existing = projects(current).find((project) => project.id === parsed.value.id);
        if (existing === undefined)
          return projectFailure("project-not-found", "The requested project is not registered");
        if (projectRevision(existing) !== parsed.value.expectedRevision) {
          return projectFailure(
            "project-revision-conflict",
            "Project registration changed; inspect it before retrying",
          );
        }
        return success(
          Object.freeze({
            ...current,
            projectRegistrations: Object.freeze(
              projects(current).map((project) =>
                project.id === replacement.id ? replacement : project,
              ),
            ),
          }),
        );
      });
      return written.ok ? success(await snapshot(replacement)) : failure(...written.diagnostics);
    });
  };

  const remove = (
    request: RemoveProjectRegistrationRequest,
  ): Promise<Result<{ readonly removed: string; readonly revision: string }>> => {
    const parsed = canonicalMutation(request, false);
    return serialize(async () => {
      if (!parsed.ok) return failure(...parsed.diagnostics);
      let removedRevision: string | undefined;
      const written = await publish((current) => {
        const existing = projects(current).find((project) => project.id === parsed.value.id);
        if (existing === undefined)
          return projectFailure("project-not-found", "The requested project is not registered");
        removedRevision = projectRevision(existing);
        if (removedRevision !== parsed.value.expectedRevision) {
          return projectFailure(
            "project-revision-conflict",
            "Project registration changed; inspect it before retrying",
          );
        }
        if (
          retiredProjectIds(current).length >= bootstrapConfigurationBounds.maxRetiredProjectIds
        ) {
          return projectFailure(
            "project-registry-limit-exceeded",
            "Retired project identity capacity is exhausted",
          );
        }
        return success(
          Object.freeze({
            ...current,
            projectRegistrations: Object.freeze(
              projects(current).filter((project) => project.id !== parsed.value.id),
            ),
            retiredProjectIds: Object.freeze(
              [...retiredProjectIds(current), parsed.value.id].sort(compareCodeUnits),
            ),
          }),
        );
      });
      if (!written.ok) return failure(...written.diagnostics);
      return removedRevision !== undefined
        ? success(Object.freeze({ removed: parsed.value.id, revision: removedRevision }))
        : projectFailure("project-registry-operation-failed", "Project registry operation failed");
    });
  };

  return Object.freeze({ add, get, list, remove, update });
}
