import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as wait } from "node:timers/promises";

import type {
  ApplicationSnapshotStateDecoder,
  ApplicationOperations,
  DecodedApplicationSnapshotState,
  WorkspaceInitializationOutcome,
} from "../application/index.ts";
import {
  applicationSnapshotStateDecoderMetadata,
  type ApplicationSnapshotStateDecoderMetadata,
} from "../application/index.ts";
import { containCapabilityValue } from "../application/capability-value.ts";
import { containNativePromise, observeNativePromise } from "../application/promise-observation.ts";
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
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalCoordinationLease,
  type LocalResourceProvider,
  type StagedReplacementHandle,
  type WorkspaceResourceLocator,
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
  isHostProxy,
} from "./runtime-validation.ts";

const locator = workspaceResourceLocator("groma", "groma.yaml");
if (!locator.ok) throw new Error("invalid built-in workspace configuration locator");
export const workspaceConfigurationLocator = locator.value;

export const defaultWorkspaceDocument = "schema: groma/v0.1\n";
const canonicalBytes = new TextEncoder().encode(defaultWorkspaceDocument);
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectIsFrozen = Object.isFrozen;
const intrinsicObjectHasOwn = Object.hasOwn;
const intrinsicReflectApply = Reflect.apply;
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const intrinsicUint8Array = Uint8Array;
const intrinsicUint8ArrayPrototype = Uint8Array.prototype;
const intrinsicTypedArrayPrototype = intrinsicObjectGetPrototypeOf(intrinsicUint8ArrayPrototype);
const intrinsicTypedArrayByteLength = (() => {
  const getter = intrinsicObjectGetOwnPropertyDescriptor(
    intrinsicTypedArrayPrototype,
    "byteLength",
  )?.get;
  if (getter === undefined) {
    throw new Error("Uint8Array byte length intrinsic is unavailable");
  }
  return getter;
})();

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
  readonly configuration?: LocalWorkspaceConfiguration;
  readonly operations: () => ApplicationOperations;
  readonly resources: LocalResourceProvider;
  readonly stateDecoder: ApplicationSnapshotStateDecoder;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

export interface LocalWorkspaceConfiguration {
  readonly initialDocument: Uint8Array;
  isCompatible(bytes: Uint8Array): boolean;
  readonly locator: WorkspaceResourceLocator;
  readonly missingIsCompatible?: boolean;
}

const defaultBounds: LocalWorkspaceBounds = Object.freeze({
  maxConfigurationBytes: 4_096,
  maxProviderDiagnostics: 100,
  maxSnapshotResources: 100_000,
  maxSnapshotStateDepth: 30,
  maxSnapshotStateValues: 100_000,
});

const localWorkspaceBoundNames = Object.freeze([
  "maxConfigurationBytes",
  "maxProviderDiagnostics",
  "maxSnapshotResources",
  "maxSnapshotStateDepth",
  "maxSnapshotStateValues",
] as const);

const localWorkspaceBoundKeySets = Object.freeze(
  Array.from({ length: 1 << localWorkspaceBoundNames.length }, (_, mask) =>
    Object.freeze(localWorkspaceBoundNames.filter((_, index) => (mask & (1 << index)) !== 0)),
  ),
);

type LocalWorkspaceResources = Pick<
  LocalResourceProvider,
  | "acquireCoordination"
  | "commitReplacement"
  | "discardReplacement"
  | "read"
  | "releaseCoordination"
  | "stageReplacement"
>;

interface CapturedLocalWorkspaceOptions {
  readonly bounds: LocalWorkspaceBounds;
  readonly configuration: LocalWorkspaceConfiguration;
  readonly decoderProxyPolicy: (value: unknown) => boolean;
  readonly operations: () => ApplicationOperations;
  readonly resources: LocalWorkspaceResources;
  readonly stateDecoder: Pick<ApplicationSnapshotStateDecoder, "decode">;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

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

type LocalWorkspaceState =
  | { readonly state: "configured" | "missing" | "ready" }
  | { readonly diagnostic: Diagnostic; readonly state: "configuration-conflict" }
  | { readonly diagnostic: Diagnostic; readonly state: "provider-failure" };

const missingState = (): LocalWorkspaceState => Object.freeze({ state: "missing" });
const configuredState = (): LocalWorkspaceState => Object.freeze({ state: "configured" });
const readyState = (): LocalWorkspaceState => Object.freeze({ state: "ready" });
const configurationConflictState = (): LocalWorkspaceState =>
  Object.freeze({ diagnostic: configurationConflict(), state: "configuration-conflict" });
const providerFailureState = (): LocalWorkspaceState =>
  Object.freeze({ diagnostic: providerFailure(), state: "provider-failure" });

function publicStatus(value: LocalWorkspaceState): WorkspaceStatus {
  if (value.state === "configuration-conflict" || value.state === "provider-failure") {
    return conflictStatus(value.diagnostic);
  }
  return value;
}

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

function initializationFailure(value: Diagnostic): WorkspaceInitializationOutcome {
  return Object.freeze({
    diagnostics: ownedDiagnostics([value]),
    status: value.code === "workspace-configuration-conflict" ? "conflict" : "provider-failure",
  });
}

function validateBounds(input: Partial<LocalWorkspaceBounds>): LocalWorkspaceBounds {
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

function captureBounds(value: unknown): LocalWorkspaceBounds {
  if (value === undefined) return validateBounds(Object.freeze({}));
  const inspected = inspectHostRecord(
    value,
    localWorkspaceBoundKeySets,
    "invalid-local-workspace-options",
    "Local workspace bounds",
  );
  if (!inspected.ok) throw new TypeError("Local workspace bounds are malformed");
  const copied: Partial<LocalWorkspaceBounds> = Object.create(
    null,
  ) as Partial<LocalWorkspaceBounds>;
  for (const name of localWorkspaceBoundNames) {
    if (intrinsicObjectHasOwn(inspected.value, name)) {
      Object.defineProperty(copied, name, {
        enumerable: true,
        value: inspected.value[name] as number,
      });
    }
  }
  return validateBounds(Object.freeze(copied));
}

function requireCapabilityReceiver(value: unknown, subject: string): object {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${subject} must be a capability object`);
  }
  return value;
}

function captureCapabilityMethod<TFunction extends Function>(
  receiver: object,
  name: string,
  subject: string,
): TFunction {
  let current: object | null = receiver;
  for (let depth = 0; current !== null && depth < 32; depth += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = intrinsicObjectGetOwnPropertyDescriptor(current, name);
    } catch {
      throw new TypeError(`${subject}.${name} could not be inspected safely`);
    }
    if (descriptor !== undefined) {
      if (!("value" in descriptor) || typeof descriptor.value !== "function") {
        throw new TypeError(`${subject}.${name} must be a callable data method`);
      }
      return descriptor.value as TFunction;
    }
    try {
      current = intrinsicObjectGetPrototypeOf(current) as object | null;
    } catch {
      throw new TypeError(`${subject}.${name} could not be inspected safely`);
    }
  }
  throw new TypeError(`${subject}.${name} must be a callable data method`);
}

function validateStateDecoder(
  value: ApplicationSnapshotStateDecoder,
  bounds: LocalWorkspaceBounds,
): ApplicationSnapshotStateDecoderMetadata {
  const metadata = applicationSnapshotStateDecoderMetadata(value);
  if (
    metadata === undefined ||
    !intrinsicObjectIsFrozen(value) ||
    !intrinsicObjectIsFrozen(metadata) ||
    !intrinsicObjectIsFrozen(metadata.bounds)
  ) {
    throw new TypeError("stateDecoder must be created by createApplicationSnapshotStateDecoder");
  }
  for (const name of ["maxSnapshotStateDepth", "maxSnapshotStateValues"] as const) {
    const decoderLimit = metadata.bounds[name];
    if (!Number.isSafeInteger(decoderLimit) || decoderLimit <= 0 || decoderLimit > bounds[name]) {
      throw new RangeError(`stateDecoder ${name} must not exceed the local workspace bound`);
    }
  }
  if (typeof metadata.isProxy !== "function") {
    throw new TypeError("stateDecoder proxy policy is malformed");
  }
  return metadata;
}

function captureWorkspaceConfiguration(
  value: unknown,
  bounds: LocalWorkspaceBounds,
): LocalWorkspaceConfiguration {
  if (value === undefined) {
    return Object.freeze({
      initialDocument: canonicalBytes.slice(),
      isCompatible: sameBytes,
      locator: workspaceConfigurationLocator,
      missingIsCompatible: true,
    });
  }
  const inspected = inspectHostRecord(
    value,
    [
      ["initialDocument", "isCompatible", "locator"],
      ["initialDocument", "isCompatible", "locator", "missingIsCompatible"],
    ],
    "invalid-local-workspace-options",
    "Local workspace configuration",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.isCompatible !== "function" ||
    typeof inspected.value.locator !== "string" ||
    (Object.hasOwn(inspected.value, "missingIsCompatible") &&
      typeof inspected.value.missingIsCompatible !== "boolean")
  ) {
    throw new TypeError("Local workspace configuration is malformed");
  }
  const parsedLocator = parseWorkspaceResourceLocator(inspected.value.locator);
  if (!parsedLocator.ok || parsedLocator.value !== inspected.value.locator) {
    throw new TypeError("Local workspace configuration locator is malformed");
  }
  const bytes = inspected.value.initialDocument;
  if (
    typeof bytes !== "object" ||
    bytes === null ||
    isHostProxy(bytes) ||
    intrinsicObjectGetPrototypeOf(bytes) !== intrinsicUint8ArrayPrototype
  ) {
    throw new TypeError("Local workspace initial configuration is malformed");
  }
  let byteLength: number;
  try {
    byteLength = intrinsicReflectApply(intrinsicTypedArrayByteLength, bytes, []) as number;
  } catch {
    throw new TypeError("Local workspace initial configuration is malformed");
  }
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength <= 0 ||
    byteLength > bounds.maxConfigurationBytes
  ) {
    throw new TypeError("Local workspace initial configuration is malformed");
  }
  const copied = new intrinsicUint8Array(byteLength);
  copied.set(bytes as Uint8Array);
  const receiver = value as object;
  const isCompatible = inspected.value.isCompatible;
  const missingIsCompatible = inspected.value.missingIsCompatible;
  return Object.freeze({
    initialDocument: copied,
    isCompatible: (candidate: Uint8Array) => {
      const result = intrinsicReflectApply(isCompatible, receiver, [candidate]);
      return result === true;
    },
    locator: parsedLocator.value,
    missingIsCompatible: typeof missingIsCompatible === "boolean" ? missingIsCompatible : true,
  });
}

function captureLocalWorkspaceOptions(
  value: LocalWorkspaceCapabilityOptions,
): CapturedLocalWorkspaceOptions {
  const inspected = inspectHostRecord(
    value,
    [
      ["operations", "resources", "stateDecoder", "transactionProvider"],
      ["bounds", "operations", "resources", "stateDecoder", "transactionProvider"],
      ["configuration", "operations", "resources", "stateDecoder", "transactionProvider"],
      ["bounds", "configuration", "operations", "resources", "stateDecoder", "transactionProvider"],
    ],
    "invalid-local-workspace-options",
    "Local workspace options",
  );
  if (!inspected.ok) throw new TypeError("Local workspace options are malformed");

  const optionsReceiver = value as object;
  const operations = inspected.value.operations;
  if (typeof operations !== "function") {
    throw new TypeError("Local workspace operations must be a function");
  }
  const bounds = captureBounds(inspected.value.bounds);
  const configuration = captureWorkspaceConfiguration(inspected.value.configuration, bounds);
  const resourcesReceiver = requireCapabilityReceiver(
    inspected.value.resources,
    "Local workspace resources",
  );
  const transactionReceiver = requireCapabilityReceiver(
    inspected.value.transactionProvider,
    "Local workspace transaction provider",
  );
  const decoderReceiver = requireCapabilityReceiver(
    inspected.value.stateDecoder,
    "Local workspace state decoder",
  ) as ApplicationSnapshotStateDecoder;
  const decoderMetadata = validateStateDecoder(decoderReceiver, bounds);

  const read = captureCapabilityMethod<LocalResourceProvider["read"]>(
    resourcesReceiver,
    "read",
    "Local workspace resources",
  );
  const stageReplacement = captureCapabilityMethod<LocalResourceProvider["stageReplacement"]>(
    resourcesReceiver,
    "stageReplacement",
    "Local workspace resources",
  );
  const commitReplacement = captureCapabilityMethod<LocalResourceProvider["commitReplacement"]>(
    resourcesReceiver,
    "commitReplacement",
    "Local workspace resources",
  );
  const discardReplacement = captureCapabilityMethod<LocalResourceProvider["discardReplacement"]>(
    resourcesReceiver,
    "discardReplacement",
    "Local workspace resources",
  );
  const acquireCoordination = captureCapabilityMethod<LocalResourceProvider["acquireCoordination"]>(
    resourcesReceiver,
    "acquireCoordination",
    "Local workspace resources",
  );
  const releaseCoordination = captureCapabilityMethod<LocalResourceProvider["releaseCoordination"]>(
    resourcesReceiver,
    "releaseCoordination",
    "Local workspace resources",
  );
  const snapshot = captureCapabilityMethod<TransactionProvider["snapshot"]>(
    transactionReceiver,
    "snapshot",
    "Local workspace transaction provider",
  );
  const decode = captureCapabilityMethod<ApplicationSnapshotStateDecoder["decode"]>(
    decoderReceiver,
    "decode",
    "Local workspace state decoder",
  );

  const resources: LocalWorkspaceResources = Object.freeze({
    acquireCoordination: (request) =>
      intrinsicReflectApply(acquireCoordination, resourcesReceiver, [request]),
    commitReplacement: (handle) =>
      intrinsicReflectApply(commitReplacement, resourcesReceiver, [handle]),
    discardReplacement: (handle) =>
      intrinsicReflectApply(discardReplacement, resourcesReceiver, [handle]),
    read: (request) => intrinsicReflectApply(read, resourcesReceiver, [request]),
    releaseCoordination: (lease) =>
      intrinsicReflectApply(releaseCoordination, resourcesReceiver, [lease]),
    stageReplacement: (locator, bytes) =>
      intrinsicReflectApply(stageReplacement, resourcesReceiver, [locator, bytes]),
  });
  const stateDecoder = Object.freeze({
    decode: (state: unknown) => intrinsicReflectApply(decode, decoderReceiver, [state]),
  });
  const transactionProvider = Object.freeze({
    snapshot: (resources: Parameters<TransactionProvider["snapshot"]>[0]) =>
      intrinsicReflectApply(snapshot, transactionReceiver, [resources]),
  });

  return Object.freeze({
    bounds,
    configuration,
    decoderProxyPolicy: decoderMetadata.isProxy,
    operations: () => intrinsicReflectApply(operations, optionsReceiver, []),
    resources,
    stateDecoder,
    transactionProvider,
  });
}

function recognizedProxy(value: unknown, decoderProxyPolicy: (value: unknown) => boolean): boolean {
  if (isHostProxy(value)) return true;
  try {
    return decoderProxyPolicy(value) === true;
  } catch {
    return true;
  }
}

const rejectedLocalCapabilitySettlement = Object.freeze({ status: "rejected" as const });

async function settleLocalCapabilityValue(
  value: unknown,
  decoderProxyPolicy: (value: unknown) => boolean,
): Promise<
  | typeof rejectedLocalCapabilitySettlement
  | { readonly status: "fulfilled"; readonly value: unknown }
> {
  if (typeof value === "object" && value !== null && recognizedProxy(value, decoderProxyPolicy)) {
    return Object.freeze({ status: "fulfilled" as const, value });
  }
  let fulfilledValue: unknown;
  const observed = observeNativePromise(
    value,
    (settled) => {
      fulfilledValue = settled;
      return true;
    },
    () => false,
  );
  if (observed.status !== "observed") {
    return observed.status === "not-native"
      ? Object.freeze({ status: "fulfilled" as const, value })
      : rejectedLocalCapabilitySettlement;
  }
  try {
    return (await observed.promise)
      ? Object.freeze({ status: "fulfilled" as const, value: fulfilledValue })
      : rejectedLocalCapabilitySettlement;
  } catch {
    return rejectedLocalCapabilitySettlement;
  }
}

function exactDetails(
  value: Diagnostic["details"],
  expected: Readonly<Record<string, string | number | boolean>>,
): boolean {
  if (value === undefined) return false;
  try {
    const keys = intrinsicReflectOwnKeys(value);
    const expectedKeys = intrinsicReflectOwnKeys(expected);
    if (keys.length !== expectedKeys.length) return false;
    for (const key of expectedKeys) {
      if (typeof key !== "string") return false;
      const descriptor = intrinsicObjectGetOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.value !== expected[key]
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function isCanonicalMissingFailure(diagnostics: readonly Diagnostic[]): boolean {
  const value = diagnostics[0];
  return (
    diagnostics.length === 1 &&
    value?.code === "resource-missing" &&
    value.message === "Workspace resource does not exist" &&
    exactDetails(value.details, Object.freeze({ operation: "resolve a resource" }))
  );
}

function isCanonicalTooLargeFailure(
  diagnostics: readonly Diagnostic[],
  bounds: LocalWorkspaceBounds,
): boolean {
  const value = diagnostics[0];
  return (
    diagnostics.length === 1 &&
    value?.code === "resource-too-large" &&
    value.message === "Workspace resource exceeds the requested byte limit" &&
    exactDetails(value.details, Object.freeze({ maximum: bounds.maxConfigurationBytes }))
  );
}

function copyConfigurationBytes(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  decoderProxyPolicy: (value: unknown) => boolean,
): Result<Uint8Array> {
  if (typeof value !== "object" || value === null || recognizedProxy(value, decoderProxyPolicy)) {
    return failure(providerFailure());
  }
  try {
    if (intrinsicObjectGetPrototypeOf(value) !== intrinsicUint8ArrayPrototype) {
      return failure(providerFailure());
    }
    const byteLength = intrinsicReflectApply(intrinsicTypedArrayByteLength, value, []) as number;
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      byteLength > bounds.maxConfigurationBytes
    ) {
      return failure(providerFailure());
    }
    const copied = new intrinsicUint8Array(byteLength);
    for (let index = 0; index < byteLength; index += 1) {
      copied[index] = (value as Uint8Array)[index]!;
    }
    return success(copied);
  } catch {
    return failure(providerFailure());
  }
}

function validatedConfigurationRead(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  configuration: LocalWorkspaceConfiguration,
  decoderProxyPolicy: (value: unknown) => boolean,
): LocalWorkspaceState {
  const result = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-workspace-provider-result",
    "Workspace configuration read result",
  );
  if (!result.ok) return providerFailureState();
  if (result.value.ok === false) {
    const diagnostics = copyHostDiagnostics(
      result.value.diagnostics,
      bounds.maxProviderDiagnostics,
      "invalid-workspace-provider-result",
    );
    if (!diagnostics.ok) return providerFailureState();
    if (isCanonicalMissingFailure(diagnostics.value)) {
      return configuration.missingIsCompatible === false
        ? configurationConflictState()
        : missingState();
    }
    return isCanonicalTooLargeFailure(diagnostics.value, bounds)
      ? configurationConflictState()
      : providerFailureState();
  }
  if (result.value.ok !== true) return providerFailureState();
  const contents = inspectHostRecord(
    result.value.value,
    [["bytes"]],
    "invalid-workspace-provider-result",
    "Workspace configuration read success",
  );
  if (!contents.ok) return providerFailureState();
  const bytes = copyConfigurationBytes(contents.value.bytes, bounds, decoderProxyPolicy);
  if (!bytes.ok) return providerFailureState();
  try {
    return configuration.isCompatible(bytes.value)
      ? configuredState()
      : configurationConflictState();
  } catch {
    return providerFailureState();
  }
}

type ValidatedCoordinationAcquisition =
  | { readonly lease: LocalCoordinationLease; readonly state: "acquired" }
  | { readonly state: "contended" }
  | { readonly state: "failed" };

function isCanonicalCoordinationLease(
  value: unknown,
  decoderProxyPolicy: (value: unknown) => boolean,
): value is object {
  if (
    typeof value !== "object" ||
    value === null ||
    recognizedProxy(value, decoderProxyPolicy) ||
    containNativePromise(value) !== "not-native"
  ) {
    return false;
  }
  try {
    return (
      intrinsicObjectIsFrozen(value) &&
      intrinsicObjectGetPrototypeOf(value) === null &&
      intrinsicReflectOwnKeys(value).length === 0
    );
  } catch {
    return false;
  }
}

function isOpaqueProviderHandle(
  value: unknown,
  decoderProxyPolicy: (value: unknown) => boolean,
): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    !recognizedProxy(value, decoderProxyPolicy) &&
    containNativePromise(value) === "not-native"
  );
}

function validatedCoordinationAcquisition(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  decoderProxyPolicy: (value: unknown) => boolean,
): Result<ValidatedCoordinationAcquisition> {
  const result = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-workspace-provider-result",
    "Workspace coordination acquisition result",
  );
  if (!result.ok) return result;
  if (result.value.ok === false) {
    const diagnostics = copyHostDiagnostics(
      result.value.diagnostics,
      bounds.maxProviderDiagnostics,
      "invalid-workspace-provider-result",
    );
    return diagnostics.ok && diagnostics.value.length > 0
      ? success(
          Object.freeze({
            state:
              diagnostics.value.length === 1 &&
              diagnostics.value[0]?.code === "resource-coordination-contended"
                ? ("contended" as const)
                : ("failed" as const),
          }),
        )
      : failure(providerFailure());
  }
  if (result.value.ok !== true) return failure(providerFailure());
  const lease = result.value.value;
  if (!isCanonicalCoordinationLease(lease, decoderProxyPolicy)) {
    return failure(providerFailure());
  }
  return success(Object.freeze({ lease: lease as LocalCoordinationLease, state: "acquired" }));
}

type ValidatedStagedReplacement =
  | { readonly handle: StagedReplacementHandle; readonly state: "staged" }
  | { readonly state: "failed" };

function observeStagedResultValue(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  decoderProxyPolicy: (value: unknown) => boolean,
): void {
  if (typeof value !== "object" || value === null || recognizedProxy(value, decoderProxyPolicy)) {
    return;
  }
  try {
    const handle = intrinsicObjectGetOwnPropertyDescriptor(value, "value");
    if (handle !== undefined && "value" in handle) {
      const candidate = handle.value;
      if (
        typeof candidate === "object" &&
        candidate !== null &&
        !recognizedProxy(candidate, decoderProxyPolicy)
      ) {
        containNativePromise(candidate);
      }
    }
    const diagnostics = intrinsicObjectGetOwnPropertyDescriptor(value, "diagnostics");
    if (diagnostics !== undefined && "value" in diagnostics) {
      copyHostDiagnostics(
        diagnostics.value,
        bounds.maxProviderDiagnostics,
        "invalid-workspace-provider-result",
      );
    }
  } catch {
    // Exact result inspection below owns the public failure.
  }
}

function validatedStagedReplacement(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  decoderProxyPolicy: (value: unknown) => boolean,
): Result<ValidatedStagedReplacement> {
  observeStagedResultValue(value, bounds, decoderProxyPolicy);
  const result = inspectHostRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-workspace-provider-result",
    "Workspace configuration stage result",
  );
  if (!result.ok) return result;
  if (result.value.ok === false) {
    const diagnostics = copyHostDiagnostics(
      result.value.diagnostics,
      bounds.maxProviderDiagnostics,
      "invalid-workspace-provider-result",
    );
    return diagnostics.ok && diagnostics.value.length > 0
      ? success(Object.freeze({ state: "failed" }))
      : failure(providerFailure());
  }
  if (result.value.ok !== true) return failure(providerFailure());
  const handle = result.value.value;
  return isOpaqueProviderHandle(handle, decoderProxyPolicy)
    ? success(
        Object.freeze({
          handle: handle as StagedReplacementHandle,
          state: "staged",
        }),
      )
    : failure(providerFailure());
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
  if (intrinsicObjectHasOwn(outcome.value, "diagnostics")) {
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

const workspaceStateContainmentFailure = Object.freeze({ ok: false as const });

function containWorkspaceSnapshotState(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  decoderProxyPolicy: (value: unknown) => boolean,
) {
  if (typeof value !== "object" || value === null || recognizedProxy(value, decoderProxyPolicy)) {
    return workspaceStateContainmentFailure;
  }
  try {
    const containment = {
      isProxy: (candidate: unknown) => recognizedProxy(candidate, decoderProxyPolicy),
      maximumContainerEntries: bounds.maxSnapshotStateValues,
      maximumDepth: bounds.maxSnapshotStateDepth,
      maximumValues: bounds.maxSnapshotStateValues,
    };
    const revisions = intrinsicObjectGetOwnPropertyDescriptor(value, "revisions");
    if (revisions !== undefined && "value" in revisions && revisions.enumerable) {
      containCapabilityValue(revisions.value, containment);
    }
    const descriptor = intrinsicObjectGetOwnPropertyDescriptor(value, "state");
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return workspaceStateContainmentFailure;
    }
    return containCapabilityValue(descriptor.value, containment);
  } catch {
    return workspaceStateContainmentFailure;
  }
}

function canonicalSnapshot(
  value: unknown,
  bounds: LocalWorkspaceBounds,
  decoderProxyPolicy: (value: unknown) => boolean,
  stateDecoder: Pick<ApplicationSnapshotStateDecoder, "decode">,
): Result<CanonicalWorkspaceSnapshot> {
  const containedState = containWorkspaceSnapshotState(value, bounds, decoderProxyPolicy);
  const snapshot = inspectHostRecord(
    value,
    [["generation", "revisions", "state"]],
    "invalid-workspace-recovery",
    "Workspace recovery snapshot",
  );
  if (!snapshot.ok) return snapshot;
  if (!containedState.ok) {
    return failure(
      diagnostic("invalid-workspace-recovery", "Workspace recovery state is malformed"),
    );
  }
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
  const state = stateDecoder.decode(containedState.value);
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
  const captured = captureLocalWorkspaceOptions(options);
  const bounds = captured.bounds;
  const decoderProxyPolicy = captured.decoderProxyPolicy;
  let current: LocalWorkspaceState;
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
      const raw = await captured.resources.releaseCoordination(retained);
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

  const inspect = async (): Promise<LocalWorkspaceState> => {
    try {
      const read = await captured.resources.read({
        locator: captured.configuration.locator,
        maxBytes: bounds.maxConfigurationBytes,
      });
      return validatedConfigurationRead(read, bounds, captured.configuration, decoderProxyPolicy);
    } catch {
      return providerFailureState();
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
        const raw = await captured.resources.discardReplacement(pending.handle);
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
        await captured.resources.commitReplacement(pending.handle),
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
    if (current.state === "provider-failure") current = await inspect();
    if (current.state === "provider-failure") {
      return recoveryFailure(current.diagnostic);
    }
    if (current.state === "missing") {
      return recoveryFailure(
        diagnostic("no-workspace", "This operation requires an initialized Groma workspace"),
      );
    }
    if (current.state === "configuration-conflict") return recoveryFailure(current.diagnostic);
    if (current.state === "ready") {
      return recoverySuccess(recoveredGeneration);
    }
    try {
      const invoked = captured.transactionProvider.snapshot(Object.freeze([]));
      const settled = await settleLocalCapabilityValue(invoked, decoderProxyPolicy);
      if (settled.status !== "fulfilled") {
        return recoveryFailure(
          diagnostic("workspace-recovery-failed", "Workspace transaction recovery failed"),
        );
      }
      const snapshot = canonicalSnapshot(
        settled.value,
        bounds,
        decoderProxyPolicy,
        captured.stateDecoder,
      );
      if (!snapshot.ok) {
        return recoveryFailure(
          diagnostic("invalid-workspace-recovery", "Workspace recovery returned malformed state"),
        );
      }
      recoveredGeneration = snapshot.value.generation;
      current = readyState();
      return recoverySuccess(recoveredGeneration);
    } catch {
      return recoveryFailure(
        diagnostic("workspace-recovery-failed", "Workspace transaction recovery failed"),
      );
    }
  };

  const recoverDiscardedPublication = async (): Promise<WorkspaceInitializationOutcome> => {
    if (current.state === "configuration-conflict" || current.state === "provider-failure") {
      return initializationFailure(current.diagnostic);
    }
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
    if (current.state === "provider-failure") current = await inspect();
    if (current.state === "provider-failure" || current.state === "configuration-conflict") {
      return initializationFailure(current.diagnostic);
    }
    if (current.state === "ready") {
      return initializationSuccess(recoveredGeneration, "already-initialized");
    }

    if (current.state === "missing") {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          const acquired = validatedCoordinationAcquisition(
            await captured.resources.acquireCoordination({
              context: "local-machine",
              locator: captured.configuration.locator,
            }),
            bounds,
            decoderProxyPolicy,
          );
          if (!acquired.ok || acquired.value.state === "failed") {
            return initializationProviderFailure();
          }
          if (acquired.value.state === "acquired") {
            retainedInitializationLease = acquired.value.lease;
            current = await inspect();
            break;
          }
          current = await inspect();
          if (current.state !== "missing") break;
          if (attempt === 39) return initializationProviderFailure();
          await wait(10);
        } catch {
          return initializationProviderFailure();
        }
      }

      if (current.state === "missing") {
        try {
          const staged = validatedStagedReplacement(
            await captured.resources.stageReplacement(
              captured.configuration.locator,
              captured.configuration.initialDocument.slice(),
            ),
            bounds,
            decoderProxyPolicy,
          );
          if (!staged.ok || staged.value.state !== "staged") {
            const released = await releaseRetainedInitializationLease();
            return initializationProviderFailure(
              released.ok ? Object.freeze([providerFailure()]) : released.diagnostics,
            );
          }
          pendingPublication = { action: "commit", handle: staged.value.handle };
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
        if (current.state === "configuration-conflict") {
          return initializationFailure(current.diagnostic);
        }
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
    if (current.state === "ready") {
      return Object.freeze({ ok: true, value: captured.operations() });
    }
    if (current.state === "missing") {
      return hostFailure(
        diagnostic("no-workspace", "This operation requires an initialized Groma workspace"),
      );
    }
    if (current.state === "configuration-conflict" || current.state === "provider-failure") {
      return hostFailure(current.diagnostic);
    }
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

  return Object.freeze({
    initialize,
    recover,
    requireWorkspace,
    status: () => publicStatus(current),
  });
}
