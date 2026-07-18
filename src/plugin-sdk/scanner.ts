import {
  canonicalizeObservationSessionBegin,
  failure,
  observationSessionApiVersion,
  observeNativePromise,
  type Diagnostic,
  type ObservationBatch,
  type ObservationBatchReceipt,
  type ObservationCompletion,
  type ObservationFailure,
  type ObservationFailureReason,
  type ObservationHeartbeat,
  type ObservationSessionBegin,
  type ObservationSessionBounds,
  type PluginCancellation,
  type Result,
  success,
} from "../core/index.ts";
import { copyCanonicalGraphData, type GraphData } from "../core/payload.ts";
import { inspectIntrinsicArrayLength } from "../core/runtime.ts";

export {
  observationSessionApiVersion,
  type ComponentActionObservation,
  type ComponentCandidateObservation,
  type ComponentInputObservation,
  type ComponentOutputObservation,
  type CompletedObservationSnapshot,
  type DocumentationObservation,
  type ObservationBatch,
  type ObservationBatchReceipt,
  type ObservationCompletion,
  type ObservationCoverage,
  type ObservationFailure,
  type ObservationHeartbeat,
  type ObservationProvenance,
  type ObservationRecord,
  type ObservationRecordKind,
  type ObservationReference,
  type ObservationResourceRange,
  type ObservationScopeDeclaration,
  type ObservationSessionBegin,
  type ObservationSessionBounds,
  type ObservationSourceIdentity,
  type RelationshipObservation,
} from "../core/index.ts";

export const scannerApiVersion = "groma.scanner/v1" as const;
export const scannerCapabilityId = "groma.scanners/v1" as const;
export const scannerCapabilityVersion = "1.0.0" as const;
export const scannerCapability = Object.freeze({
  cardinality: "multiple" as const,
  id: scannerCapabilityId,
  version: scannerCapabilityVersion,
});

export type ScannerConfiguration = GraphData;
export type ScannerResourceKind = "directory" | "file" | "link" | "other";

export interface ScannerResourceReadRequest {
  readonly maxBytes: number;
  readonly resource: string;
  readonly scope: string;
}

export interface ScannerResourceContents {
  /** Fresh bytes owned by the caller; providers must never return a mutable backing-store alias. */
  readonly bytes: Uint8Array;
}

export interface ScannerResourceEnumerationRequest {
  readonly cursor?: string;
  readonly limit: number;
  readonly maxDepth: number;
  readonly resource: string;
  readonly scope: string;
}

export interface ScannerResourceEntry {
  readonly kind: ScannerResourceKind;
  readonly resource: string;
  readonly scope: string;
  readonly size?: number;
}

export interface ScannerResourcePage {
  readonly entries: readonly ScannerResourceEntry[];
  readonly nextCursor?: string;
  readonly truncatedByDepth: boolean;
}

/**
 * Project-resource authority intentionally has no write, coordination, canonical-store,
 * or absolute-path operation. Every request is bounded by the scanner and by the Host.
 */
export interface ScannerProjectResources {
  enumerate(request: ScannerResourceEnumerationRequest): Promise<Result<ScannerResourcePage>>;
  read(request: ScannerResourceReadRequest): Promise<Result<ScannerResourceContents>>;
}

/** One-way contribution surface. Session inspection, reconciliation, and mutation are absent. */
export interface ScannerObservationSink {
  complete(completion: ObservationCompletion): Result<void>;
  fail(report: ObservationFailure): Result<void>;
  heartbeat(heartbeat: ObservationHeartbeat): Result<void>;
  submitBatch(batch: ObservationBatch): Result<ObservationBatchReceipt>;
}

export interface ScannerRequest {
  readonly apiVersion: typeof scannerApiVersion;
  readonly cancellation: PluginCancellation;
  readonly configuration: ScannerConfiguration;
  /** Immutable identity/scope descriptor needed to form valid source-local observations. */
  readonly session: ObservationSessionBegin;
  readonly observations: ScannerObservationSink;
  readonly resources: ScannerProjectResources;
}

export interface Scanner {
  scan(request: ScannerRequest): Promise<Result<void>>;
}

export interface ScannerRequestBounds {
  readonly maxConfigurationCharacters: number;
  readonly maxCursorCharacters: number;
  readonly maxConfigurationDepth: number;
  readonly maxConfigurationValues: number;
  readonly maxDiagnosticCharacters: number;
  readonly maxDiagnostics: number;
  readonly maxEnumerationDepth: number;
  readonly maxPageSize: number;
  readonly maxPageCharacters: number;
  readonly maxReadBytes: number;
  readonly maxResourceCharacters: number;
}

const defaultScannerRequestBounds: ScannerRequestBounds = Object.freeze({
  maxConfigurationCharacters: 1024 * 1024,
  maxCursorCharacters: 16_384,
  maxConfigurationDepth: 32,
  maxConfigurationValues: 10_000,
  maxDiagnosticCharacters: 64 * 1024,
  maxDiagnostics: 64,
  maxEnumerationDepth: 64,
  maxPageSize: 1_000,
  maxPageCharacters: 4 * 1024 * 1024,
  maxReadBytes: 16 * 1024 * 1024,
  maxResourceCharacters: 4_096,
});

const scannerRequestCeilings: ScannerRequestBounds = Object.freeze({
  maxConfigurationCharacters: 16 * 1024 * 1024,
  maxCursorCharacters: 64 * 1024,
  maxConfigurationDepth: 256,
  maxConfigurationValues: 1_000_000,
  maxDiagnosticCharacters: 1024 * 1024,
  maxDiagnostics: 1_024,
  maxEnumerationDepth: 256,
  maxPageSize: 100_000,
  maxPageCharacters: 64 * 1024 * 1024,
  maxReadBytes: 64 * 1024 * 1024,
  maxResourceCharacters: 64 * 1024,
});

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function inspectKnownRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  code: string,
  subject: string,
): Result<Readonly<Record<string, unknown>>> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return failure(diagnostic(code, `${subject} must be a plain record`));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return failure(diagnostic(code, `${subject} must use a plain prototype`));
    }
    const copied: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of [...required, ...optional]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) continue;
      if (!("value" in descriptor) || !descriptor.enumerable) {
        return failure(diagnostic(code, `${subject}.${key} must be an enumerable data property`));
      }
      Object.defineProperty(copied, key, { enumerable: true, value: descriptor.value });
    }
    if (required.some((key) => !Object.hasOwn(copied, key))) {
      return failure(diagnostic(code, `${subject} is missing a required field`));
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(diagnostic(code, `${subject} could not be inspected safely`));
  }
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

function resolveBounds(configured?: Partial<ScannerRequestBounds>): ScannerRequestBounds {
  const resolved: Record<keyof ScannerRequestBounds, number> = {} as Record<
    keyof ScannerRequestBounds,
    number
  >;
  for (const name of Object.keys(defaultScannerRequestBounds) as Array<
    keyof ScannerRequestBounds
  >) {
    let configuredValue: number | undefined;
    if (configured !== undefined) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(configured, name);
      } catch {
        throw new TypeError(`Scanner request bound ${name} could not be inspected safely`);
      }
      if (descriptor !== undefined) {
        if (!("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError(`Scanner request bound ${name} must be an enumerable data property`);
        }
        configuredValue = descriptor.value as number;
      }
    }
    resolved[name] = configuredBound(
      configuredValue,
      defaultScannerRequestBounds[name],
      scannerRequestCeilings[name],
      name,
    );
  }
  return Object.freeze(resolved);
}

function validResource(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\\\u0000-\u001f\u007f]/.test(value) &&
    !/^(?:\/|[A-Za-z]:)/.test(value) &&
    (value === "." ||
      !value.split("/").some((segment) => segment === "" || segment === "." || segment === ".."))
  );
}

function resourceWithin(resource: string, root: string): boolean {
  return root === "." || resource === root || resource.startsWith(`${root}/`);
}

function resourceDepthBelow(resource: string, root: string): number {
  if (resource === root) return 0;
  const relative = root === "." ? resource : resource.slice(root.length + 1);
  return relative.split("/").length - 1;
}

function validCursor(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function positiveBounded(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function copyDiagnostics(
  value: unknown,
  maximum: number,
  maximumCharacters: number,
  failureCode: "scanner-observation-sink-failed" | "scanner-resource-provider-failed",
): readonly Diagnostic[] {
  const length = inspectIntrinsicArrayLength(
    value,
    "scanner-resource-provider-failed",
    "Scanner resource diagnostics",
  );
  if (!length.ok || length.value === 0 || length.value > maximum) {
    return Object.freeze([
      diagnostic(failureCode, "Scanner callback returned invalid diagnostics"),
    ]);
  }
  try {
    const source = value as unknown[];
    const copied: Diagnostic[] = [];
    let canonicalCharacters = 0;
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new Error();
      }
      const inspected = inspectKnownRecord(
        descriptor.value,
        ["code", "message"],
        ["details"],
        failureCode,
        "Scanner resource diagnostic",
      );
      if (
        !inspected.ok ||
        typeof inspected.value.code !== "string" ||
        inspected.value.code.length === 0 ||
        inspected.value.code.length > 256 ||
        typeof inspected.value.message !== "string" ||
        inspected.value.message.length === 0 ||
        inspected.value.message.length > 65_536
      ) {
        throw new Error();
      }
      let details: Diagnostic["details"];
      if ("details" in inspected.value) {
        const detailKeys = [
          "index",
          "key",
          "lastHeartbeatSequence",
          "lastSequence",
          "maximum",
          "operation",
          "reason",
          "received",
          "receivedType",
          "scope",
          "state",
        ] as const;
        const inspectedDetails = inspectKnownRecord(
          inspected.value.details,
          [],
          detailKeys,
          failureCode,
          "Scanner callback diagnostic details",
        );
        if (!inspectedDetails.ok) throw new Error();
        const copiedDetails: Record<string, string | number | boolean> = {};
        for (const key of detailKeys) {
          if (!Object.hasOwn(inspectedDetails.value, key)) continue;
          const item = inspectedDetails.value[key];
          if (
            (typeof item !== "string" || item.length > 256) &&
            (typeof item !== "number" || !Number.isSafeInteger(item)) &&
            typeof item !== "boolean"
          ) {
            throw new Error();
          }
          copiedDetails[key] = item as string | number | boolean;
          canonicalCharacters +=
            key.length + (typeof item === "string" ? item.length * 6 : String(item).length) + 8;
        }
        if (Object.keys(copiedDetails).length > 0) details = Object.freeze(copiedDetails);
      }
      canonicalCharacters +=
        inspected.value.code.length * 6 + inspected.value.message.length * 6 + 32;
      if (canonicalCharacters > maximumCharacters) throw new Error();
      copied.push(
        Object.freeze({
          code: inspected.value.code,
          ...(details === undefined ? {} : { details }),
          message: inspected.value.message,
        }),
      );
    }
    return Object.freeze(copied);
  } catch {
    return Object.freeze([
      diagnostic(failureCode, "Scanner callback returned invalid diagnostics"),
    ]);
  }
}

function inspectProviderResult<T>(
  value: unknown,
  bounds: ScannerRequestBounds,
  copySuccess: (value: unknown) => Result<T>,
): Result<T> {
  const inspected = inspectKnownRecord(
    value,
    ["ok"],
    ["diagnostics", "value"],
    "scanner-resource-provider-failed",
    "Scanner resource provider result",
  );
  if (!inspected.ok) {
    return failure(
      diagnostic(
        "scanner-resource-provider-failed",
        "Scanner resource provider returned an invalid result",
      ),
    );
  }
  if (
    inspected.value.ok === false &&
    "diagnostics" in inspected.value &&
    !("value" in inspected.value)
  ) {
    return {
      diagnostics: copyDiagnostics(
        inspected.value.diagnostics,
        bounds.maxDiagnostics,
        bounds.maxDiagnosticCharacters,
        "scanner-resource-provider-failed",
      ),
      ok: false,
    };
  }
  if (
    inspected.value.ok === true &&
    "value" in inspected.value &&
    !("diagnostics" in inspected.value)
  ) {
    return copySuccess(inspected.value.value);
  }
  return failure(
    diagnostic(
      "scanner-resource-provider-failed",
      "Scanner resource provider returned an invalid result",
    ),
  );
}

function observeProviderResult<T>(
  returned: unknown,
  bounds: ScannerRequestBounds,
  copySuccess: (value: unknown) => Result<T>,
): Promise<Result<T>> {
  const observed = observeNativePromise(
    returned,
    (settled) => inspectProviderResult(settled, bounds, copySuccess),
    () =>
      failure<T>(
        diagnostic(
          "scanner-resource-provider-failed",
          "Scanner resource provider rejected its request",
        ),
      ),
  );
  return observed.status === "observed"
    ? observed.promise
    : Promise.resolve(
        failure(
          diagnostic(
            "scanner-resource-provider-failed",
            "Scanner resource provider must return a containable native Promise",
          ),
        ),
      );
}

function invalidResourceRequest(message: string): Promise<Result<never>> {
  return Promise.resolve(failure(diagnostic("invalid-scanner-resource-request", message)));
}

function copyResourceContents(value: unknown, maximum: number): Result<ScannerResourceContents> {
  const inspected = inspectKnownRecord(
    value,
    ["bytes"],
    [],
    "scanner-resource-provider-failed",
    "Scanner resource contents",
  );
  if (!inspected.ok) return inspected;
  try {
    if (
      !(inspected.value.bytes instanceof Uint8Array) ||
      inspected.value.bytes.byteLength > maximum
    ) {
      throw new Error();
    }
    return success(Object.freeze({ bytes: new Uint8Array(inspected.value.bytes) }));
  } catch {
    return failure(
      diagnostic(
        "scanner-resource-provider-failed",
        "Scanner resource provider returned invalid bytes",
      ),
    );
  }
}

function copyResourcePage(
  value: unknown,
  request: ScannerResourceEnumerationRequest,
  scopeRoots: ReadonlyMap<string, string>,
  bounds: ScannerRequestBounds,
): Result<ScannerResourcePage> {
  const inspected = inspectKnownRecord(
    value,
    ["entries", "truncatedByDepth"],
    ["nextCursor"],
    "scanner-resource-provider-failed",
    "Scanner resource page",
  );
  if (!inspected.ok || typeof inspected.value.truncatedByDepth !== "boolean") {
    return failure(
      diagnostic("scanner-resource-provider-failed", "Scanner resource page is invalid"),
    );
  }
  const length = inspectIntrinsicArrayLength(
    inspected.value.entries,
    "scanner-resource-provider-failed",
    "Scanner resource entries",
  );
  if (!length.ok || length.value > request.limit) {
    return failure(
      diagnostic(
        "scanner-resource-provider-failed",
        "Scanner resource page exceeds its request bound",
      ),
    );
  }
  if (
    "nextCursor" in inspected.value &&
    (!validCursor(inspected.value.nextCursor, bounds.maxCursorCharacters) ||
      inspected.value.nextCursor === request.cursor)
  ) {
    return failure(
      diagnostic("scanner-resource-provider-failed", "Scanner resource cursor is invalid"),
    );
  }
  try {
    const source = inspected.value.entries as unknown[];
    const entries: ScannerResourceEntry[] = [];
    let canonicalCharacters =
      "nextCursor" in inspected.value ? (inspected.value.nextCursor as string).length * 6 + 32 : 32;
    if (canonicalCharacters > bounds.maxPageCharacters) throw new Error();
    let previousResource = "";
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable)
        throw new Error();
      const entry = inspectKnownRecord(
        descriptor.value,
        ["kind", "resource", "scope"],
        ["size"],
        "scanner-resource-provider-failed",
        "Scanner resource entry",
      );
      if (!entry.ok) throw new Error();
      const kind = entry.value.kind;
      if (
        (kind !== "directory" && kind !== "file" && kind !== "link" && kind !== "other") ||
        !validResource(entry.value.resource, bounds.maxResourceCharacters) ||
        entry.value.scope !== request.scope ||
        !resourceWithin(entry.value.resource, scopeRoots.get(request.scope)!) ||
        !resourceWithin(entry.value.resource, request.resource) ||
        resourceDepthBelow(entry.value.resource, request.resource) > request.maxDepth ||
        ("size" in entry.value &&
          (typeof entry.value.size !== "number" ||
            !Number.isSafeInteger(entry.value.size) ||
            entry.value.size < 0))
      ) {
        throw new Error();
      }
      if (entry.value.resource <= previousResource) throw new Error();
      previousResource = entry.value.resource;
      canonicalCharacters += entry.value.resource.length * 2 + request.scope.length * 2 + 96;
      if (canonicalCharacters > bounds.maxPageCharacters) throw new Error();
      entries.push(
        Object.freeze({
          kind,
          resource: entry.value.resource,
          scope: request.scope,
          ...("size" in entry.value ? { size: entry.value.size as number } : {}),
        }),
      );
    }
    return success(
      Object.freeze({
        entries: Object.freeze(entries),
        ...("nextCursor" in inspected.value
          ? { nextCursor: inspected.value.nextCursor as string }
          : {}),
        truncatedByDepth: inspected.value.truncatedByDepth,
      }),
    );
  } catch {
    return failure(
      diagnostic("scanner-resource-provider-failed", "Scanner resource page is invalid"),
    );
  }
}

function invokeSink<T>(
  callback: unknown,
  receiver: object,
  argument: unknown,
  maximumDiagnostics: number,
  maximumDiagnosticCharacters: number,
  copySuccess: (value: unknown) => Result<T>,
): Result<T> {
  let returned: unknown;
  try {
    returned = Reflect.apply(callback as (...values: readonly unknown[]) => unknown, receiver, [
      argument,
    ]);
  } catch {
    return failure(diagnostic("scanner-observation-sink-failed", "Scanner observation sink threw"));
  }
  const inspected = inspectKnownRecord(
    returned,
    ["ok"],
    ["diagnostics", "value"],
    "scanner-observation-sink-failed",
    "Scanner observation sink result",
  );
  if (!inspected.ok) {
    return failure(
      diagnostic(
        "scanner-observation-sink-failed",
        "Scanner observation sink returned an invalid result",
      ),
    );
  }
  if (
    inspected.value.ok === false &&
    "diagnostics" in inspected.value &&
    !("value" in inspected.value)
  ) {
    return {
      diagnostics: copyDiagnostics(
        inspected.value.diagnostics,
        maximumDiagnostics,
        maximumDiagnosticCharacters,
        "scanner-observation-sink-failed",
      ),
      ok: false,
    };
  }
  if (
    inspected.value.ok === true &&
    "value" in inspected.value &&
    !("diagnostics" in inspected.value)
  ) {
    return copySuccess(inspected.value.value);
  }
  return failure(
    diagnostic(
      "scanner-observation-sink-failed",
      "Scanner observation sink returned an invalid result",
    ),
  );
}

function voidSuccess(value: unknown): Result<void> {
  return value === undefined
    ? success(undefined)
    : failure(
        diagnostic(
          "scanner-observation-sink-failed",
          "Scanner observation sink returned a non-void success",
        ),
      );
}

interface BatchReceiptExpectation {
  readonly recordCount: number;
  readonly sequence: number;
}

function batchReceiptExpectation(batch: unknown): Result<BatchReceiptExpectation> {
  const inspected = inspectKnownRecord(
    batch,
    ["epoch", "records", "sequence"],
    [],
    "scanner-observation-sink-failed",
    "Scanner observation batch",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.sequence !== "number" ||
    !Number.isSafeInteger(inspected.value.sequence) ||
    inspected.value.sequence <= 0
  ) {
    return failure(
      diagnostic("scanner-observation-sink-failed", "Scanner observation batch is invalid"),
    );
  }
  const records = inspectIntrinsicArrayLength(
    inspected.value.records,
    "scanner-observation-sink-failed",
    "Scanner observation batch records",
  );
  if (!records.ok) {
    return failure(
      diagnostic("scanner-observation-sink-failed", "Scanner observation batch is invalid"),
    );
  }
  return success(Object.freeze({ recordCount: records.value, sequence: inspected.value.sequence }));
}

function batchReceiptSuccess(
  value: unknown,
  expected: BatchReceiptExpectation,
): Result<ObservationBatchReceipt> {
  const inspected = inspectKnownRecord(
    value,
    ["acceptedRecords", "replayedRecords", "sequence", "totalRecords"],
    [],
    "scanner-observation-sink-failed",
    "Scanner observation batch receipt",
  );
  if (!inspected.ok) return inspected;
  const { acceptedRecords, replayedRecords, sequence, totalRecords } = inspected.value;
  if (
    typeof acceptedRecords !== "number" ||
    !Number.isSafeInteger(acceptedRecords) ||
    acceptedRecords < 0 ||
    typeof replayedRecords !== "number" ||
    !Number.isSafeInteger(replayedRecords) ||
    replayedRecords < 0 ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    sequence !== expected.sequence ||
    typeof totalRecords !== "number" ||
    !Number.isSafeInteger(totalRecords) ||
    totalRecords < acceptedRecords ||
    acceptedRecords + replayedRecords !== expected.recordCount
  ) {
    return failure(
      diagnostic("scanner-observation-sink-failed", "Scanner observation batch receipt is invalid"),
    );
  }
  return success(Object.freeze({ acceptedRecords, replayedRecords, sequence, totalRecords }));
}

function callableMember(
  value: unknown,
  keys: readonly string[],
  subject: string,
): Result<{
  readonly record: Readonly<Record<string, unknown>>;
  readonly receiver: object;
}> {
  const inspected = inspectKnownRecord(value, keys, [], "invalid-scanner-request", subject);
  if (!inspected.ok || typeof value !== "object" || value === null) {
    return failure(diagnostic("invalid-scanner-request", `${subject} has an invalid shape`));
  }
  for (const key of keys) {
    if (typeof inspected.value[key] !== "function") {
      return failure(diagnostic("invalid-scanner-request", `${subject}.${key} must be callable`));
    }
  }
  return success(Object.freeze({ receiver: value, record: inspected.value }));
}

/**
 * Canonicalizes the data-bearing parts of a Host-assembled scanner request and captures
 * capability methods without exposing their backing objects. This is an authority
 * boundary, not a sandbox: scanner plugins are still trusted code.
 */
export function createScannerRequest(
  value: ScannerRequest,
  configuredBounds?: Partial<ScannerRequestBounds>,
  observationBounds?: Partial<ObservationSessionBounds>,
): Result<ScannerRequest> {
  const bounds = resolveBounds(configuredBounds);
  const inspected = inspectKnownRecord(
    value,
    ["apiVersion", "cancellation", "configuration", "observations", "resources", "session"],
    [],
    "invalid-scanner-request",
    "Scanner request",
  );
  if (!inspected.ok || inspected.value.apiVersion !== scannerApiVersion) {
    return failure(
      diagnostic("invalid-scanner-request", "Scanner request has an invalid shape or API version"),
    );
  }

  const session = canonicalizeObservationSessionBegin(
    inspected.value.session as ObservationSessionBegin,
    observationBounds,
  );
  if (!session.ok) {
    return failure(
      diagnostic("invalid-scanner-request", "Scanner session descriptor is invalid"),
      ...session.diagnostics,
    );
  }
  const canonicalSession = session.value;
  if (
    canonicalSession.scopes.some(
      (scope) => !validResource(scope.resourceRoot, bounds.maxResourceCharacters),
    )
  ) {
    return failure(
      diagnostic(
        "invalid-scanner-request",
        "Scanner session scope roots exceed the resource capability bounds",
      ),
    );
  }
  const scopeRoots = new Map(
    canonicalSession.scopes.map((scope) => [scope.id, scope.resourceRoot] as const),
  );

  const configuration = copyCanonicalGraphData(
    inspected.value.configuration,
    "query",
    {
      code: "scanner-configuration-too-large",
      maximum: bounds.maxConfigurationCharacters,
      message: "Scanner configuration exceeds its canonical character bound",
    },
    {
      code: "scanner-configuration-too-complex",
      maximumDepth: bounds.maxConfigurationDepth,
      maximumValues: bounds.maxConfigurationValues,
      message: "Scanner configuration exceeds its structural bound",
    },
  );
  if (!configuration.ok) {
    return failure(
      diagnostic("invalid-scanner-request", "Scanner configuration is not bounded canonical data"),
      ...configuration.diagnostics,
    );
  }

  const cancellation = callableMember(
    inspected.value.cancellation,
    ["isCancellationRequested"],
    "Scanner cancellation",
  );
  if (!cancellation.ok) return cancellation;
  const resources = callableMember(
    inspected.value.resources,
    ["enumerate", "read"],
    "Scanner project resources",
  );
  if (!resources.ok) return resources;
  const observations = callableMember(
    inspected.value.observations,
    ["complete", "fail", "heartbeat", "submitBatch"],
    "Scanner observation sink",
  );
  if (!observations.ok) return observations;

  const isCancellationRequested = (): boolean => {
    try {
      const cancelled = Reflect.apply(
        cancellation.value.record.isCancellationRequested as () => boolean,
        cancellation.value.receiver,
        [],
      );
      return typeof cancelled === "boolean" ? cancelled : true;
    } catch {
      return true;
    }
  };
  const capturedCancellation: PluginCancellation = Object.freeze({
    isCancellationRequested,
  });
  const capturedResources: ScannerProjectResources = Object.freeze({
    enumerate: (request: ScannerResourceEnumerationRequest) => {
      if (isCancellationRequested()) {
        return Promise.resolve(
          failure(diagnostic("scanner-request-cancelled", "Scanner request has been cancelled")),
        );
      }
      const parsed = inspectKnownRecord(
        request,
        ["limit", "maxDepth", "resource", "scope"],
        ["cursor"],
        "invalid-scanner-resource-request",
        "Scanner resource enumeration request",
      );
      if (
        !parsed.ok ||
        !positiveBounded(parsed.value.limit, bounds.maxPageSize) ||
        typeof parsed.value.maxDepth !== "number" ||
        !Number.isSafeInteger(parsed.value.maxDepth) ||
        parsed.value.maxDepth < 0 ||
        parsed.value.maxDepth > bounds.maxEnumerationDepth ||
        !validResource(parsed.value.resource, bounds.maxResourceCharacters) ||
        typeof parsed.value.scope !== "string" ||
        !scopeRoots.has(parsed.value.scope) ||
        !resourceWithin(parsed.value.resource, scopeRoots.get(parsed.value.scope)!) ||
        ("cursor" in parsed.value && !validCursor(parsed.value.cursor, bounds.maxCursorCharacters))
      ) {
        return invalidResourceRequest("Scanner enumeration request exceeds its bounded contract");
      }
      const canonicalRequest: ScannerResourceEnumerationRequest = Object.freeze({
        ...("cursor" in parsed.value ? { cursor: parsed.value.cursor as string } : {}),
        limit: parsed.value.limit,
        maxDepth: parsed.value.maxDepth,
        resource: parsed.value.resource,
        scope: parsed.value.scope,
      });
      let returned: unknown;
      try {
        returned = Reflect.apply(
          resources.value.record.enumerate as ScannerProjectResources["enumerate"],
          resources.value.receiver,
          [canonicalRequest],
        );
      } catch {
        return Promise.resolve(
          failure(
            diagnostic(
              "scanner-resource-provider-failed",
              "Scanner resource provider threw while enumerating",
            ),
          ),
        );
      }
      return observeProviderResult(returned, bounds, (settled) =>
        copyResourcePage(settled, canonicalRequest, scopeRoots, bounds),
      );
    },
    read: (request: ScannerResourceReadRequest) => {
      if (isCancellationRequested()) {
        return Promise.resolve(
          failure(diagnostic("scanner-request-cancelled", "Scanner request has been cancelled")),
        );
      }
      const parsed = inspectKnownRecord(
        request,
        ["maxBytes", "resource", "scope"],
        [],
        "invalid-scanner-resource-request",
        "Scanner resource read request",
      );
      if (
        !parsed.ok ||
        !positiveBounded(parsed.value.maxBytes, bounds.maxReadBytes) ||
        !validResource(parsed.value.resource, bounds.maxResourceCharacters) ||
        typeof parsed.value.scope !== "string" ||
        !scopeRoots.has(parsed.value.scope) ||
        !resourceWithin(parsed.value.resource, scopeRoots.get(parsed.value.scope)!)
      ) {
        return invalidResourceRequest("Scanner read request exceeds its bounded contract");
      }
      const canonicalRequest: ScannerResourceReadRequest = Object.freeze({
        maxBytes: parsed.value.maxBytes,
        resource: parsed.value.resource,
        scope: parsed.value.scope,
      });
      let returned: unknown;
      try {
        returned = Reflect.apply(
          resources.value.record.read as ScannerProjectResources["read"],
          resources.value.receiver,
          [canonicalRequest],
        );
      } catch {
        return Promise.resolve(
          failure(
            diagnostic(
              "scanner-resource-provider-failed",
              "Scanner resource provider threw while reading",
            ),
          ),
        );
      }
      return observeProviderResult(returned, bounds, (settled) =>
        copyResourceContents(settled, canonicalRequest.maxBytes),
      );
    },
  });
  const capturedObservations: ScannerObservationSink = Object.freeze({
    complete: (completion: ObservationCompletion) =>
      isCancellationRequested()
        ? failure(diagnostic("scanner-request-cancelled", "Scanner request has been cancelled"))
        : invokeSink(
            observations.value.record.complete,
            observations.value.receiver,
            completion,
            bounds.maxDiagnostics,
            bounds.maxDiagnosticCharacters,
            voidSuccess,
          ),
    fail: (report: ObservationFailure) =>
      isCancellationRequested()
        ? failure(diagnostic("scanner-request-cancelled", "Scanner request has been cancelled"))
        : invokeSink(
            observations.value.record.fail,
            observations.value.receiver,
            report,
            bounds.maxDiagnostics,
            bounds.maxDiagnosticCharacters,
            voidSuccess,
          ),
    heartbeat: (heartbeat: ObservationHeartbeat) =>
      isCancellationRequested()
        ? failure(diagnostic("scanner-request-cancelled", "Scanner request has been cancelled"))
        : invokeSink(
            observations.value.record.heartbeat,
            observations.value.receiver,
            heartbeat,
            bounds.maxDiagnostics,
            bounds.maxDiagnosticCharacters,
            voidSuccess,
          ),
    submitBatch: (batch: ObservationBatch) => {
      if (isCancellationRequested()) {
        return failure(
          diagnostic("scanner-request-cancelled", "Scanner request has been cancelled"),
        );
      }
      const expected = batchReceiptExpectation(batch);
      if (!expected.ok) return expected;
      return invokeSink(
        observations.value.record.submitBatch,
        observations.value.receiver,
        batch,
        bounds.maxDiagnostics,
        bounds.maxDiagnosticCharacters,
        (value) => batchReceiptSuccess(value, expected.value),
      );
    },
  });

  return success(
    Object.freeze({
      apiVersion: scannerApiVersion,
      cancellation: capturedCancellation,
      configuration: configuration.value.value,
      observations: capturedObservations,
      resources: capturedResources,
      session: canonicalSession,
    }),
  );
}

/** Authoring helper only; runtime compatibility remains the Host's responsibility. */
export function defineScanner<TScanner extends Scanner>(scanner: TScanner): TScanner {
  return scanner;
}
