import {
  canonicalSchemaMigrationApiVersion,
  failure,
  success,
  type CanonicalSchemaDefinition,
  type CanonicalSchemaMigrationContribution,
  type CanonicalSchemaMigrator,
  type ContentRevision,
  type Diagnostic,
  type ResourceKey,
  type Result,
  type TransactionOutcome,
} from "../core/index.ts";
import type { TransactionExecutionCapability } from "./contracts.ts";
import { observeNativePromise } from "./promise-observation.ts";

const intrinsicReflectApply = Reflect.apply;
const intrinsicStringIncludes = String.prototype.includes;
const intrinsicUint8Array = Uint8Array;
const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayTag = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)?.get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")?.get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;

export interface CanonicalMigrationResource {
  readonly bytes: Uint8Array;
  readonly locator: string;
  readonly resource: ResourceKey;
  readonly revision: ContentRevision;
  readonly schema: string;
}

export interface CanonicalMigrationCatalogSnapshot {
  readonly resources: readonly CanonicalMigrationResource[];
}

export interface CanonicalMigrationCatalogCapability {
  inspect(locator: string, bytes: Uint8Array): Result<{ readonly schema: string }>;
  load(): Promise<Result<CanonicalMigrationCatalogSnapshot>>;
}

export interface SchemaMigrationBounds {
  readonly maxContributions: number;
  readonly maxDocumentBytes: number;
  readonly maxMigrators: number;
  readonly maxPathCandidates: number;
  readonly maxPathExpansions: number;
  readonly maxPathSteps: number;
  readonly maxSchemas: number;
  readonly maxTokenCharacters: number;
  readonly maxTotalBytes: number;
}

export interface SchemaMigrationOperationsOptions {
  readonly bounds: SchemaMigrationBounds;
  readonly catalog: CanonicalMigrationCatalogCapability;
  readonly contributions: readonly unknown[];
  readonly targetVersion: number;
  readonly transactionExecution: TransactionExecutionCapability;
}

export type SchemaMigrationPathState =
  "ambiguous" | "bounded" | "complete" | "incompatible" | "missing";

export interface SchemaMigrationResourceStatus {
  readonly locator: string;
  readonly migrators: readonly string[];
  readonly path: SchemaMigrationPathState;
  readonly schema: string;
  readonly targetSchema?: string;
  readonly version: number | null;
}

export interface SchemaMigrationStatusReport {
  readonly completePath: boolean;
  readonly documentVersions: readonly number[];
  readonly mixedVersions: boolean;
  readonly resources: readonly SchemaMigrationResourceStatus[];
  readonly schemaFloor: number | null;
  readonly targetVersion: number;
}

export interface SchemaMigrationPreviewResource extends SchemaMigrationResourceStatus {
  readonly changed: boolean;
}

export interface SchemaMigrationPreviewReport {
  readonly resources: readonly SchemaMigrationPreviewResource[];
  readonly status: SchemaMigrationStatusReport;
}

export type SchemaMigrationApplyOutcome =
  | {
      readonly generation?: number;
      readonly resources: readonly SchemaMigrationPreviewResource[];
      readonly status: "applied" | "current";
    }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly phase?: "commit" | "prepare" | "recovery" | "snapshot";
      readonly status: "conflict" | "indeterminate" | "provider-failure" | "validation-rejected";
    };

export interface SchemaMigrationOperations {
  apply(): Promise<SchemaMigrationApplyOutcome>;
  preview(): Promise<Result<SchemaMigrationPreviewReport>>;
  status(): Promise<Result<SchemaMigrationStatusReport>>;
}

interface RegisteredMigrator {
  readonly fromSchema: string;
  readonly fromVersion: number;
  readonly id: string;
  readonly migrate: CanonicalSchemaMigrator["migrate"];
  readonly receiver: object;
  readonly toSchema: string;
  readonly toVersion: number;
}

interface Registry {
  readonly migrators: readonly RegisteredMigrator[];
  readonly schemas: ReadonlyMap<string, number>;
}

interface ResourcePlan {
  readonly path: readonly RegisteredMigrator[];
  readonly resource: CanonicalMigrationResource;
  readonly status: SchemaMigrationResourceStatus;
}

interface ExecutedResourcePlan extends ResourcePlan {
  readonly replacement: Uint8Array;
}

interface ExecutedPlan {
  readonly catalog: readonly CanonicalMigrationResource[];
  readonly resources: readonly ExecutedResourcePlan[];
  readonly status: SchemaMigrationStatusReport;
}

type PlanningResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly ok: false;
      readonly source: "provider" | "validation";
    };

const tokenPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?:\/[a-z0-9][a-z0-9.-]*)*$/;

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze(
    details === undefined
      ? { code, message }
      : { code, details: Object.freeze({ ...details }), message },
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function planningSuccess<T>(value: T): PlanningResult<T> {
  return Object.freeze({ ok: true, value });
}

function planningFailure(
  source: "provider" | "validation",
  ...diagnostics: readonly Diagnostic[]
): PlanningResult<never> {
  return Object.freeze({ diagnostics: Object.freeze(diagnostics), ok: false, source });
}

function catalogFailureSource(diagnostics: readonly Diagnostic[]): "provider" | "validation" {
  return diagnostics.some(
    (entry) =>
      (typeof entry.code === "string" &&
        (intrinsicReflectApply(intrinsicStringIncludes, entry.code, ["provider"]) as boolean)) ||
      entry.code === "resource-missing" ||
      entry.code === "resource-unreadable" ||
      entry.code === "resource-unavailable" ||
      entry.code === "stale-resource-cursor",
  )
    ? "provider"
    : "validation";
}

function descriptorValue(record: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor !== undefined && "value" in descriptor && descriptor.enumerable
    ? descriptor.value
    : undefined;
}

function denseArray(value: unknown, maximum: number): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (
      length === undefined ||
      !("value" in length) ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0 ||
      length.value > maximum
    ) {
      return undefined;
    }
    const copied = new Array<unknown>(length.value);
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      copied[index] = descriptor.value;
    }
    return Object.freeze(copied);
  } catch {
    return undefined;
  }
}

function validToken(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    tokenPattern.test(value)
  );
}

function validVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function canonicalRegistry(
  values: readonly unknown[],
  limits: SchemaMigrationBounds,
): Result<Registry> {
  const contributions = denseArray(values, limits.maxContributions);
  if (contributions === undefined) {
    return failure(
      diagnostic(
        "schema-migration-contribution-invalid",
        "Schema migration contributions exceed or violate their bounded runtime contract",
      ),
    );
  }
  const schemaVersions = new Map<string, number>();
  const migrators: RegisteredMigrator[] = [];
  const contributionIds = new Set<string>();
  const migratorIds = new Set<string>();
  try {
    for (
      let contributionIndex = 0;
      contributionIndex < contributions.length;
      contributionIndex += 1
    ) {
      const value = contributions[contributionIndex];
      if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error();
      const apiVersion = descriptorValue(value, "apiVersion");
      const id = descriptorValue(value, "id");
      const schemaValues = denseArray(descriptorValue(value, "schemas"), limits.maxSchemas);
      const migratorValues = denseArray(descriptorValue(value, "migrators"), limits.maxMigrators);
      if (
        apiVersion !== canonicalSchemaMigrationApiVersion ||
        !validToken(id, limits.maxTokenCharacters) ||
        contributionIds.has(id) ||
        schemaValues === undefined ||
        migratorValues === undefined
      ) {
        throw new Error();
      }
      contributionIds.add(id);
      for (const schemaValue of schemaValues) {
        if (typeof schemaValue !== "object" || schemaValue === null || Array.isArray(schemaValue)) {
          throw new Error();
        }
        const schema = descriptorValue(schemaValue, "schema");
        const version = descriptorValue(schemaValue, "version");
        if (!validToken(schema, limits.maxTokenCharacters) || !validVersion(version))
          throw new Error();
        const current = schemaVersions.get(schema);
        if (current !== undefined && current !== version) throw new Error();
        schemaVersions.set(schema, version);
        if (schemaVersions.size > limits.maxSchemas) throw new Error();
      }
      for (const migratorValue of migratorValues) {
        if (
          typeof migratorValue !== "object" ||
          migratorValue === null ||
          Array.isArray(migratorValue)
        ) {
          throw new Error();
        }
        const fromSchema = descriptorValue(migratorValue, "fromSchema");
        const fromVersion = descriptorValue(migratorValue, "fromVersion");
        const migratorId = descriptorValue(migratorValue, "id");
        const migrate = descriptorValue(migratorValue, "migrate");
        const toSchema = descriptorValue(migratorValue, "toSchema");
        const toVersion = descriptorValue(migratorValue, "toVersion");
        if (
          !validToken(fromSchema, limits.maxTokenCharacters) ||
          !validVersion(fromVersion) ||
          !validToken(migratorId, limits.maxTokenCharacters) ||
          migratorIds.has(migratorId) ||
          typeof migrate !== "function" ||
          !validToken(toSchema, limits.maxTokenCharacters) ||
          !validVersion(toVersion) ||
          toVersion <= fromVersion
        ) {
          throw new Error();
        }
        migratorIds.add(migratorId);
        migrators.push(
          Object.freeze({
            fromSchema,
            fromVersion,
            id: migratorId,
            migrate: migrate as CanonicalSchemaMigrator["migrate"],
            receiver: migratorValue,
            toSchema,
            toVersion,
          }),
        );
        if (migrators.length > limits.maxMigrators) throw new Error();
      }
    }
    for (const migrator of migrators) {
      if (
        schemaVersions.get(migrator.fromSchema) !== migrator.fromVersion ||
        schemaVersions.get(migrator.toSchema) !== migrator.toVersion
      ) {
        throw new Error();
      }
    }
  } catch {
    return failure(
      diagnostic(
        "schema-migration-contribution-invalid",
        "Schema migration contributions exceed or violate their bounded runtime contract",
      ),
    );
  }
  migrators.sort((left, right) => compareText(left.id, right.id));
  return success(Object.freeze({ migrators: Object.freeze(migrators), schemas: schemaVersions }));
}

function pathsFor(
  schema: string,
  version: number,
  registry: Registry,
  targetVersion: number,
  limits: SchemaMigrationBounds,
): {
  readonly candidates: readonly (readonly RegisteredMigrator[])[];
  readonly exhausted: boolean;
} {
  if (version === targetVersion) {
    return Object.freeze({
      candidates: Object.freeze([Object.freeze([])]),
      exhausted: false,
    });
  }
  if (version > targetVersion) {
    return Object.freeze({ candidates: Object.freeze([]), exhausted: false });
  }
  const candidates: RegisteredMigrator[][] = [];
  let expansions = 0;
  let exhausted = false;
  const visit = (currentSchema: string, path: RegisteredMigrator[], visited: Set<string>): void => {
    if (exhausted || candidates.length >= limits.maxPathCandidates) return;
    if (path.length >= limits.maxPathSteps) {
      exhausted = true;
      return;
    }
    for (const migrator of registry.migrators) {
      if (migrator.fromSchema !== currentSchema || visited.has(migrator.toSchema)) continue;
      expansions += 1;
      if (expansions > limits.maxPathExpansions) {
        exhausted = true;
        return;
      }
      const next = [...path, migrator];
      if (migrator.toVersion === targetVersion) {
        candidates.push(next);
        if (candidates.length >= limits.maxPathCandidates) return;
      } else if (migrator.toVersion < targetVersion) {
        const nextVisited = new Set(visited);
        nextVisited.add(migrator.toSchema);
        visit(migrator.toSchema, next, nextVisited);
      }
    }
  };
  visit(schema, [], new Set([schema]));
  return Object.freeze({
    candidates: Object.freeze(candidates.map((path) => Object.freeze(path))),
    exhausted,
  });
}

function planResources(
  resources: readonly CanonicalMigrationResource[],
  registry: Registry,
  targetVersion: number,
  limits: SchemaMigrationBounds,
): { readonly plans: readonly ResourcePlan[]; readonly status: SchemaMigrationStatusReport } {
  const plans: ResourcePlan[] = [];
  const versions = new Set<number>();
  for (const resource of resources) {
    const version = registry.schemas.get(resource.schema);
    if (version !== undefined) versions.add(version);
    const search =
      version === undefined
        ? Object.freeze({ candidates: Object.freeze([]), exhausted: false })
        : pathsFor(resource.schema, version, registry, targetVersion, limits);
    const paths = search.candidates;
    const state: SchemaMigrationPathState =
      version !== undefined && version > targetVersion
        ? "incompatible"
        : search.exhausted
          ? "bounded"
          : paths.length === 0
            ? "missing"
            : paths.length > 1
              ? "ambiguous"
              : "complete";
    const path = state === "complete" ? paths[0]! : Object.freeze([]);
    const resourceStatus: SchemaMigrationResourceStatus = Object.freeze({
      locator: resource.locator,
      migrators: Object.freeze(path.map((entry) => entry.id)),
      path: state,
      schema: resource.schema,
      ...(path.length === 0 ? {} : { targetSchema: path[path.length - 1]!.toSchema }),
      version: version ?? null,
    });
    plans.push(Object.freeze({ path, resource, status: resourceStatus }));
  }
  const documentVersions = Object.freeze([...versions].sort((left, right) => left - right));
  const status: SchemaMigrationStatusReport = Object.freeze({
    completePath: plans.every((entry) => entry.status.path === "complete"),
    documentVersions,
    mixedVersions: documentVersions.length > 1,
    resources: Object.freeze(plans.map((entry) => entry.status)),
    schemaFloor: documentVersions[0] ?? null,
    targetVersion,
  });
  return Object.freeze({ plans: Object.freeze(plans), status });
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function migrationBytes(
  value: unknown,
  maximum: number,
  context: { readonly locator: string; readonly migrator: string },
): Result<Uint8Array> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error();
    const ok = descriptorValue(value, "ok");
    if (ok !== true) {
      return failure(
        diagnostic(
          "schema-migrator-failed",
          "A schema migrator rejected the canonical resource",
          context,
        ),
      );
    }
    const resultValue = descriptorValue(value, "value");
    if (typeof resultValue !== "object" || resultValue === null || Array.isArray(resultValue))
      throw new Error();
    const bytes = descriptorValue(resultValue, "bytes");
    if (
      typeof bytes !== "object" ||
      bytes === null ||
      typedArrayTag === undefined ||
      typedArrayBuffer === undefined ||
      typedArrayByteOffset === undefined ||
      typedArrayByteLength === undefined ||
      intrinsicReflectApply(typedArrayTag, bytes, []) !== "Uint8Array"
    ) {
      throw new Error();
    }
    const buffer = intrinsicReflectApply(typedArrayBuffer, bytes, []) as ArrayBufferLike;
    const byteOffset = intrinsicReflectApply(typedArrayByteOffset, bytes, []) as number;
    const byteLength = intrinsicReflectApply(typedArrayByteLength, bytes, []) as number;
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength === 0 ||
      byteLength > maximum ||
      !Number.isSafeInteger(byteOffset) ||
      byteOffset < 0
    ) {
      throw new Error();
    }
    return success(
      new intrinsicUint8Array(new intrinsicUint8Array(buffer, byteOffset, byteLength)),
    );
  } catch {
    return failure(
      diagnostic(
        "schema-migrator-result-invalid",
        "A schema migrator returned an invalid bounded result",
        context,
      ),
    );
  }
}

type MigratorSettlement =
  | { readonly status: "fulfilled"; readonly value: unknown }
  | { readonly status: "rejected" | "uncontained" };

async function settleMigratorValue(value: unknown): Promise<MigratorSettlement> {
  const observed = observeNativePromise<MigratorSettlement>(
    value,
    (settled) => Object.freeze({ status: "fulfilled" as const, value: settled }),
    () => Object.freeze({ status: "rejected" as const }),
  );
  if (observed.status !== "observed") {
    return observed.status === "uncontained"
      ? Object.freeze({ status: "uncontained" as const })
      : Object.freeze({ status: "fulfilled" as const, value });
  }
  try {
    return await observed.promise;
  } catch {
    return Object.freeze({ status: "rejected" as const });
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let chunk = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    chunk += base64UrlAlphabet[first >>> 2];
    chunk += base64UrlAlphabet[((first & 0x03) << 4) | ((second ?? 0) >>> 4)];
    if (second !== undefined) {
      chunk += base64UrlAlphabet[((second & 0x0f) << 2) | ((third ?? 0) >>> 6)];
    }
    if (third !== undefined) chunk += base64UrlAlphabet[third & 0x3f];
    if (chunk.length >= 16_384) {
      chunks.push(chunk);
      chunk = "";
    }
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks.join("");
}

async function invokeMigrator(
  migrator: RegisteredMigrator,
  resource: CanonicalMigrationResource,
  bytes: Uint8Array,
  schema: string,
  version: number,
  maximum: number,
): Promise<Result<Uint8Array>> {
  const invoke = async (): Promise<Result<Uint8Array>> => {
    try {
      const returned = intrinsicReflectApply(migrator.migrate, migrator.receiver, [
        Object.freeze({
          bytes: new Uint8Array(bytes),
          locator: resource.locator,
          schema,
          version,
        }),
      ]);
      const settled = await settleMigratorValue(returned);
      if (settled.status !== "fulfilled") {
        return failure(
          diagnostic(
            settled.status === "uncontained"
              ? "schema-migrator-promise-uncontained"
              : "schema-migrator-rejected",
            "A schema migrator could not be safely observed",
            { locator: resource.locator, migrator: migrator.id },
          ),
        );
      }
      return migrationBytes(settled.value, maximum, {
        locator: resource.locator,
        migrator: migrator.id,
      });
    } catch {
      return failure(
        diagnostic("schema-migrator-threw", "A schema migrator threw while migrating a resource", {
          locator: resource.locator,
          migrator: migrator.id,
        }),
      );
    }
  };
  const first = await invoke();
  if (!first.ok) return first;
  const second = await invoke();
  if (!second.ok) return second;
  if (!sameBytes(first.value, second.value)) {
    return failure(
      diagnostic(
        "schema-migrator-nondeterministic",
        "A schema migrator produced different bytes for the same input",
        {
          locator: resource.locator,
          migrator: migrator.id,
        },
      ),
    );
  }
  return first;
}

async function executePlans(
  plans: readonly ResourcePlan[],
  catalog: CanonicalMigrationCatalogCapability,
  limits: Pick<SchemaMigrationBounds, "maxDocumentBytes" | "maxTotalBytes">,
): Promise<PlanningResult<readonly ExecutedResourcePlan[]>> {
  const executed: ExecutedResourcePlan[] = [];
  let totalBytes = 0;
  for (const plan of plans) {
    if (plan.status.path !== "complete") {
      return planningFailure(
        "validation",
        diagnostic(
          plan.status.path === "ambiguous"
            ? "schema-migration-path-ambiguous"
            : plan.status.path === "bounded"
              ? "schema-migration-path-search-exhausted"
              : plan.status.path === "incompatible"
                ? "schema-migration-version-incompatible"
                : "schema-migration-path-missing",
          "Canonical resource does not have exactly one complete migration path",
          { locator: plan.resource.locator, schema: plan.resource.schema },
        ),
      );
    }
    let bytes = new Uint8Array(plan.resource.bytes);
    let schema = plan.resource.schema;
    let version = plan.status.version!;
    for (const migrator of plan.path) {
      const migrated = await invokeMigrator(
        migrator,
        plan.resource,
        bytes,
        schema,
        version,
        limits.maxDocumentBytes,
      );
      if (!migrated.ok) return planningFailure("validation", ...migrated.diagnostics);
      const inspected = catalog.inspect(plan.resource.locator, migrated.value);
      if (!inspected.ok) {
        if (catalogFailureSource(inspected.diagnostics) === "provider") {
          return planningFailure("provider", ...inspected.diagnostics);
        }
        return planningFailure(
          "validation",
          diagnostic(
            "schema-migrator-output-incompatible",
            "A schema migrator did not produce its declared target schema",
            { locator: plan.resource.locator, migrator: migrator.id },
          ),
        );
      }
      if (inspected.value.schema !== migrator.toSchema) {
        return planningFailure(
          "validation",
          diagnostic(
            "schema-migrator-output-incompatible",
            "A schema migrator did not produce its declared target schema",
            { locator: plan.resource.locator, migrator: migrator.id },
          ),
        );
      }
      bytes = new Uint8Array(migrated.value);
      schema = migrator.toSchema;
      version = migrator.toVersion;
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > limits.maxTotalBytes) {
      return planningFailure(
        "validation",
        diagnostic(
          "schema-migration-total-bytes-exceeded",
          "Migrated canonical resources exceed their aggregate byte bound",
          { maximum: limits.maxTotalBytes },
        ),
      );
    }
    executed.push(Object.freeze({ ...plan, replacement: bytes }));
  }
  return planningSuccess(Object.freeze(executed));
}

function previewResources(
  plans: readonly ExecutedResourcePlan[],
): readonly SchemaMigrationPreviewResource[] {
  return Object.freeze(
    plans.map((plan) =>
      Object.freeze({
        ...plan.status,
        changed: !sameBytes(plan.resource.bytes, plan.replacement),
      }),
    ),
  );
}

function failedApply(diagnostics: readonly Diagnostic[]): SchemaMigrationApplyOutcome {
  return Object.freeze({
    diagnostics: Object.freeze([...diagnostics]),
    status: "validation-rejected",
  });
}

function failedCatalogApply(diagnostics: readonly Diagnostic[]): SchemaMigrationApplyOutcome {
  return Object.freeze({
    diagnostics: Object.freeze([...diagnostics]),
    phase: "snapshot",
    status: "provider-failure",
  });
}

function applyOutcome(
  outcome: TransactionOutcome,
  resources: readonly SchemaMigrationPreviewResource[],
): SchemaMigrationApplyOutcome {
  switch (outcome.status) {
    case "committed":
      return Object.freeze({ generation: outcome.generation, resources, status: "applied" });
    case "provider-failure":
      return Object.freeze({
        diagnostics: outcome.diagnostics,
        phase: outcome.phase,
        status: outcome.status,
      });
    case "indeterminate":
      return Object.freeze({ diagnostics: outcome.diagnostics, status: outcome.status });
    default:
      return Object.freeze({ diagnostics: outcome.diagnostics, status: outcome.status });
  }
}

export function createSchemaMigrationOperations(
  options: SchemaMigrationOperationsOptions,
): SchemaMigrationOperations {
  const bounds = Object.freeze({ ...options.bounds });
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new RangeError(`${name} must be positive`);
  }
  if (bounds.maxPathCandidates < 2)
    throw new RangeError("maxPathCandidates must allow ambiguity detection");
  const targetVersion = options.targetVersion;
  if (!validVersion(targetVersion)) throw new RangeError("targetVersion must be nonnegative");
  const catalogReceiver = options.catalog;
  const catalogInspect = catalogReceiver.inspect;
  const catalogLoad = catalogReceiver.load;
  const transactionReceiver = options.transactionExecution;
  const transactionExecute = transactionReceiver.execute;
  if (
    typeof catalogInspect !== "function" ||
    typeof catalogLoad !== "function" ||
    typeof transactionExecute !== "function"
  ) {
    throw new TypeError("Schema migration capabilities are invalid");
  }
  const catalog: CanonicalMigrationCatalogCapability = Object.freeze({
    inspect: (locator: string, bytes: Uint8Array) =>
      intrinsicReflectApply(catalogInspect, catalogReceiver, [locator, bytes]),
    load: () => intrinsicReflectApply(catalogLoad, catalogReceiver, []),
  });
  const executeTransaction = (request: Parameters<typeof transactionExecute>[0]) =>
    intrinsicReflectApply(transactionExecute, transactionReceiver, [request]);
  const registry = canonicalRegistry(options.contributions, bounds);

  const loadPlan = async (): Promise<
    PlanningResult<{
      readonly plans: readonly ResourcePlan[];
      readonly snapshot: CanonicalMigrationCatalogSnapshot;
      readonly status: SchemaMigrationStatusReport;
    }>
  > => {
    if (!registry.ok) return planningFailure("validation", ...registry.diagnostics);
    const snapshot = await catalog.load();
    if (!snapshot.ok) {
      return planningFailure(catalogFailureSource(snapshot.diagnostics), ...snapshot.diagnostics);
    }
    const planned = planResources(snapshot.value.resources, registry.value, targetVersion, bounds);
    return planningSuccess(
      Object.freeze({ plans: planned.plans, snapshot: snapshot.value, status: planned.status }),
    );
  };

  const executePlan = async (): Promise<PlanningResult<ExecutedPlan>> => {
    const planned = await loadPlan();
    if (!planned.ok) return planned;
    const executed = await executePlans(planned.value.plans, catalog, bounds);
    if (!executed.ok) return executed;
    return planningSuccess(
      Object.freeze({
        catalog: planned.value.snapshot.resources,
        resources: executed.value,
        status: planned.value.status,
      }),
    );
  };

  return Object.freeze({
    apply: async () => {
      const planned = await executePlan();
      if (!planned.ok)
        return planned.source === "provider"
          ? failedCatalogApply(planned.diagnostics)
          : failedApply(planned.diagnostics);
      const publicResources = previewResources(planned.value.resources);
      const changed = planned.value.resources.filter(
        (entry) => !sameBytes(entry.resource.bytes, entry.replacement),
      );
      if (changed.length === 0) {
        return Object.freeze({ resources: publicResources, status: "current" as const });
      }
      const outcome = await executeTransaction(
        Object.freeze({
          affected: Object.freeze({}),
          context: Object.freeze({}),
          expectedRevisions: Object.freeze(
            planned.value.resources.map((entry) =>
              Object.freeze({
                expected: entry.resource.revision,
                resource: entry.resource.resource,
              }),
            ),
          ),
          mutation: Object.freeze({
            catalog: Object.freeze(
              planned.value.catalog.map((entry) =>
                Object.freeze({ resource: entry.resource, revision: entry.revision }),
              ),
            ),
            kind: "canonical-schema-migration",
            targets: Object.freeze(
              planned.value.resources.map((entry) =>
                Object.freeze({
                  locator: entry.resource.locator,
                  replacement: encodeBase64Url(entry.replacement),
                  resource: entry.resource.resource,
                }),
              ),
            ),
          }),
        }),
      );
      return applyOutcome(outcome, publicResources);
    },
    preview: async () => {
      const planned = await executePlan();
      return planned.ok
        ? success(
            Object.freeze({
              resources: previewResources(planned.value.resources),
              status: planned.value.status,
            }),
          )
        : failure(...planned.diagnostics);
    },
    status: async () => {
      const planned = await loadPlan();
      return planned.ok ? success(planned.value.status) : failure(...planned.diagnostics);
    },
  });
}
