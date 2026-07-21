import {
  failure,
  parseContentRevision,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseRelationId,
  parseResourceKey,
  success,
  type ContentRevision,
  type ContinuationCursor,
  type Diagnostic,
  type EntityId,
  type GraphData,
  type GraphDataRecord,
  type GraphEntity,
  type GraphEntityQuery,
  type GraphGeneration,
  type GraphQueryEngineCapability,
  type GraphRelation,
  type GraphSnapshot,
  type GraphSearchQuery,
  type GraphTraversalQuery,
  type ObservationRecord,
  type ObservationReference,
  type ObservationSourceIdentity,
  type PreparedBoundedQuery,
  type ProjectionReadIdentity,
  type ResourceKey,
  type Result,
  type TransactionOutcome,
  type TransactionRequest,
} from "../core/index.ts";
import { copyCanonicalGraphData, copyGraphPayload } from "../core/payload.ts";
import {
  invokeCapturedBoundedQueryExact,
  invokeCapturedBoundedQueryPage,
  invokeCapturedBoundedQueryPrepare,
  type BoundedQueryContracts,
} from "../core/query.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  STANDARD_COMPONENT_KIND,
  isCoarserStandardScale,
  isStandardComponentScale,
  type StandardComponent,
  type StandardComponentPatch,
  type StandardComponentScale,
  type StandardRelationship,
} from "../standard-model/index.ts";
import type {
  ApplicationDiagnostic,
  ApplicationMutationOutcome,
  ApplicationOperationBounds,
  ApplicationOperations,
  ApplicationOperationsOptions,
  BoundedPageRequest,
  BlueprintComponentPage,
  BlueprintExportItem,
  BlueprintExportPage,
  BlueprintSearchItem,
  BlueprintSearchPage,
  BlueprintTraversalHit,
  BlueprintTraversalPage,
  ComponentCognitiveComplexityEvidence,
  ComponentEvidenceView,
  ComponentScaleEvidenceView,
  ComponentPage,
  ComponentRelationshipChanges,
  ComponentRelationshipInput,
  ComponentView,
  CreateComponentRequest,
  ExactComponentRead,
  ExportBlueprintRequest,
  GetComponentRequest,
  InitializeWorkspaceRequest,
  ListChildComponentsRequest,
  ListComponentsRequest,
  ListRootComponentsRequest,
  MergeComponentRequest,
  RemoveComponentRequest,
  ReparentComponentRequest,
  SearchBlueprintRequest,
  RelationshipPage,
  RelationshipView,
  TraverseBlueprintRequest,
  UpdateComponentRequest,
  WorkspaceInitializationOutcome,
} from "./contracts.ts";
import {
  applicationSnapshotStateDecoderMetadata,
  isCanonicalApplicationSnapshotComponent,
  isCanonicalApplicationSnapshotRelationship,
  type ApplicationSnapshotStateDecoderMetadata,
  type DecodedApplicationSnapshotState,
} from "./snapshot-state.ts";
import { containCapabilityValue } from "./capability-value.ts";
import { measureCanonicalJsonUtf8Bytes } from "./canonical-json-utf8.ts";
import { observeNativePromise } from "./promise-observation.ts";
import { parseEvidenceState, type ComponentBinding } from "./reconciliation.ts";

type LoadedState = DecodedApplicationSnapshotState;

interface ReadSnapshot extends LoadedState {
  readonly generation: GraphGeneration;
  readonly revisions: ReadonlyMap<ResourceKey, ContentRevision | null>;
}

interface SelectedPage<T> {
  readonly hasMore: boolean;
  readonly items: readonly T[];
  readonly nextAnchor?: string;
}

type ComponentFilter = (state: ReadSnapshot) => (component: StandardComponent) => boolean;

interface ValidatedComponentReadFilters extends BoundedPageRequest {
  readonly scale?: StandardComponentScale;
  readonly shared?: boolean;
}

interface ApplicationCapabilityCalls {
  readonly aliasResourceMapper?: NonNullable<ApplicationOperationsOptions["aliasResourceMapper"]>;
  readonly exactGraphEntity: ApplicationOperationsOptions["graphQueries"]["exactEntity"];
  readonly graphQueryIdentity: ApplicationOperationsOptions["graphQueries"]["identity"];
  readonly graphQueryMaxPageSize: number;
  readonly initialize: ApplicationOperationsOptions["initialization"]["initialize"];
  readonly graphQueries: ApplicationOperationsOptions["graphQueries"];
  readonly pageGraphEntities: ApplicationOperationsOptions["graphQueries"]["pageEntities"];
  readonly searchGraphEntities: ApplicationOperationsOptions["graphQueries"]["searchEntities"];
  readonly traverseGraphRelations: ApplicationOperationsOptions["graphQueries"]["traverseRelations"];
  readonly queries: ApplicationOperationsOptions["queries"];
  readonly resourceForComponent: ApplicationOperationsOptions["resourceMapper"]["resourceForComponent"];
  readonly resourceForAliases?: NonNullable<
    ApplicationOperationsOptions["aliasResourceMapper"]
  >["resourceForAliases"];
  readonly resourceMapper: ApplicationOperationsOptions["resourceMapper"];
  readonly snapshot: ApplicationOperationsOptions["transactionProvider"]["snapshot"];
  readonly transactionProvider: ApplicationOperationsOptions["transactionProvider"];
  readonly execute: ApplicationOperationsOptions["transactionExecution"]["execute"];
  readonly transactionExecution: ApplicationOperationsOptions["transactionExecution"];
  readonly initialization: ApplicationOperationsOptions["initialization"];
}

interface CapturedGraphQueryEngineCalls {
  readonly exactGraphEntity: ApplicationOperationsOptions["graphQueries"]["exactEntity"];
  readonly graphQueryIdentity: ApplicationOperationsOptions["graphQueries"]["identity"];
  readonly graphQueryMaxPageSize: number;
  readonly graphQueries: ApplicationOperationsOptions["graphQueries"];
  readonly pageGraphEntities: ApplicationOperationsOptions["graphQueries"]["pageEntities"];
  readonly searchGraphEntities: ApplicationOperationsOptions["graphQueries"]["searchEntities"];
  readonly traverseGraphRelations: ApplicationOperationsOptions["graphQueries"]["traverseRelations"];
}

interface ApplicationOperationsContext extends ApplicationOperationsOptions {
  readonly calls: ApplicationCapabilityCalls;
  readonly isProxy: (value: unknown) => boolean;
}

const intrinsicReflectApply = Reflect.apply;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const applicationCapabilityContainmentFailure = Object.freeze({ ok: false as const });
const rejectedApplicationCapabilitySettlement = Object.freeze({ status: "rejected" as const });
const failedApplicationProxyPolicy = Object.freeze({ status: "proxy-policy-failed" as const });
const APPLICATION_MAX_GRAPH_QUERY_CURSOR_CHARACTERS = 4_096;

type ApplicationCapabilitySettlement =
  | typeof failedApplicationProxyPolicy
  | typeof rejectedApplicationCapabilitySettlement
  | { readonly status: "fulfilled"; readonly value: unknown };

async function settleApplicationCapabilityValue(
  value: unknown,
  isProxy: (value: unknown) => boolean,
): Promise<ApplicationCapabilitySettlement> {
  try {
    if (typeof value === "object" && value !== null && isProxy(value)) {
      return rejectedApplicationCapabilitySettlement;
    }
  } catch {
    return failedApplicationProxyPolicy;
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
  if (observed.status === "uncontained") return rejectedApplicationCapabilitySettlement;
  if (observed.status === "observed") {
    try {
      if (!(await observed.promise)) return rejectedApplicationCapabilitySettlement;
    } catch {
      return rejectedApplicationCapabilitySettlement;
    }
    try {
      if (
        typeof fulfilledValue === "object" &&
        fulfilledValue !== null &&
        isProxy(fulfilledValue)
      ) {
        return rejectedApplicationCapabilitySettlement;
      }
    } catch {
      return failedApplicationProxyPolicy;
    }
    return Object.freeze({ status: "fulfilled" as const, value: fulfilledValue });
  }
  return Object.freeze({ status: "fulfilled" as const, value });
}

const absoluteBounds = Object.freeze({
  maxBlueprintPageBytes: 64 * 1024 * 1024,
  maxBlueprintPageDepth: 100,
  maxComponents: 1_000_000,
  maxDiagnosticCount: 1_000,
  maxEmbeddedItems: 100_000,
  maxRelationshipMutations: 100_000,
  maxRelationships: 1_000_000,
  maxRequestDataDepth: 100,
  maxRequestDataValues: 10_000_000,
  maxSnapshotAttempts: 16,
  maxSnapshotStateDepth: 100,
  maxSnapshotStateValues: 10_000_000,
});

function maximumCanonicalResourceCount(bounds: ApplicationOperationBounds): number {
  // Component mutations normally touch at most one resource per component. A merge may
  // additionally persist the single canonical alias resource.
  return bounds.maxComponents + 1;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function frozenFailure<T>(...diagnostics: readonly Diagnostic[]): Result<T> {
  return Object.freeze({ diagnostics: Object.freeze([...diagnostics]), ok: false as const });
}

function componentResourceDiagnostic(componentId: string): Diagnostic {
  return Object.freeze({
    code: "component-resource-unavailable",
    details: Object.freeze({ componentId }),
    message: "The canonical resource for the component could not be resolved",
  });
}

function componentResource(
  componentId: string,
  options: ApplicationOperationsContext,
): Result<ResourceKey> {
  let value: unknown;
  try {
    value = intrinsicReflectApply(
      options.calls.resourceForComponent,
      options.calls.resourceMapper,
      [componentId],
    );
  } catch {
    return frozenFailure(componentResourceDiagnostic(componentId));
  }
  const contained = containApplicationCapabilityValue(value, options, 4, 16);
  if (!contained.ok) return frozenFailure(componentResourceDiagnostic(componentId));
  const result = inspectExactRecord(
    contained.value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-component-resource-result",
    "Component resource mapping result",
  );
  if (!result.ok || result.value.ok !== true) {
    return frozenFailure(componentResourceDiagnostic(componentId));
  }
  const resource = parseResourceKey(result.value.value);
  return resource.ok ? resource : frozenFailure(componentResourceDiagnostic(componentId));
}

function aliasResource(options: ApplicationOperationsContext): Result<ResourceKey> {
  const mapper = options.calls.aliasResourceMapper;
  const method = options.calls.resourceForAliases;
  if (mapper === undefined || method === undefined) {
    return frozenFailure(
      diagnostic("alias-store-unavailable", "Canonical alias persistence is unavailable"),
    );
  }
  let value: unknown;
  try {
    value = intrinsicReflectApply(method, mapper, []);
  } catch {
    return frozenFailure(
      diagnostic("alias-store-unavailable", "Canonical alias persistence is unavailable"),
    );
  }
  const contained = containApplicationCapabilityValue(value, options, 4, 16);
  if (!contained.ok) {
    return frozenFailure(
      diagnostic("alias-store-unavailable", "Canonical alias persistence is unavailable"),
    );
  }
  const result = inspectExactRecord(
    contained.value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-alias-resource-result",
    "Alias resource mapping result",
  );
  if (!result.ok || result.value.ok !== true) {
    return frozenFailure(
      diagnostic("alias-store-unavailable", "Canonical alias persistence is unavailable"),
    );
  }
  const resource = parseResourceKey(result.value.value);
  return resource.ok
    ? resource
    : frozenFailure(
        diagnostic("alias-store-unavailable", "Canonical alias persistence is unavailable"),
      );
}

function validatePositiveBound(value: number, name: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
  }
}

function captureApplicationOperationsOptions(
  source: ApplicationOperationsOptions,
): ApplicationOperationsOptions {
  const bounds = {
    maxBlueprintPageBytes: source.bounds.maxBlueprintPageBytes,
    maxBlueprintPageDepth: source.bounds.maxBlueprintPageDepth,
    maxComponents: source.bounds.maxComponents,
    maxDiagnosticCount: source.bounds.maxDiagnosticCount,
    maxEmbeddedItems: source.bounds.maxEmbeddedItems,
    maxRelationshipMutations: source.bounds.maxRelationshipMutations,
    maxRelationships: source.bounds.maxRelationships,
    maxRequestDataDepth: source.bounds.maxRequestDataDepth,
    maxRequestDataValues: source.bounds.maxRequestDataValues,
    maxSnapshotStateDepth: source.bounds.maxSnapshotStateDepth,
    maxSnapshotStateValues: source.bounds.maxSnapshotStateValues,
  };
  return {
    ...(source.aliasResourceMapper === undefined
      ? {}
      : { aliasResourceMapper: source.aliasResourceMapper }),
    bounds,
    graph: source.graph,
    graphQueries: source.graphQueries,
    initialization: source.initialization,
    maxSnapshotAttempts: source.maxSnapshotAttempts,
    model: source.model,
    queries: source.queries,
    resourceMapper: source.resourceMapper,
    snapshotStateDecoder: source.snapshotStateDecoder,
    transactionExecution: source.transactionExecution,
    transactionProvider: source.transactionProvider,
  };
}

function freezeApplicationOperationsOptions(
  source: ApplicationOperationsOptions,
): ApplicationOperationsOptions {
  return Object.freeze({
    ...source,
    bounds: Object.freeze({ ...source.bounds }),
  });
}

function validateSnapshotStateDecoder(
  options: ApplicationOperationsOptions,
): ApplicationSnapshotStateDecoderMetadata {
  const metadata = applicationSnapshotStateDecoderMetadata(options.snapshotStateDecoder);
  if (metadata === undefined || !Object.isFrozen(options.snapshotStateDecoder)) {
    throw new TypeError(
      "snapshotStateDecoder must be created by createApplicationSnapshotStateDecoder",
    );
  }
  if (metadata.graph !== options.graph) {
    throw new TypeError("snapshotStateDecoder graph must match the application graph");
  }
  if (metadata.model !== options.model) {
    throw new TypeError("snapshotStateDecoder model must match the application model");
  }
  for (const name of [
    "maxComponents",
    "maxDiagnosticCount",
    "maxEmbeddedItems",
    "maxRelationships",
    "maxSnapshotStateDepth",
    "maxSnapshotStateValues",
  ] as const) {
    if (metadata.bounds[name] !== options.bounds[name]) {
      throw new RangeError(`snapshotStateDecoder ${name} must match the application bound`);
    }
  }
  return metadata;
}

function captureApplicationCapabilityCalls(
  options: ApplicationOperationsOptions,
  graphQueryCalls: CapturedGraphQueryEngineCalls,
): ApplicationCapabilityCalls {
  const calls: ApplicationCapabilityCalls = {
    ...(options.aliasResourceMapper === undefined
      ? {}
      : {
          aliasResourceMapper: options.aliasResourceMapper,
          resourceForAliases: options.aliasResourceMapper.resourceForAliases,
        }),
    execute: options.transactionExecution.execute,
    exactGraphEntity: graphQueryCalls.exactGraphEntity,
    graphQueryIdentity: graphQueryCalls.graphQueryIdentity,
    graphQueryMaxPageSize: graphQueryCalls.graphQueryMaxPageSize,
    graphQueries: graphQueryCalls.graphQueries,
    initialization: options.initialization,
    initialize: options.initialization.initialize,
    pageGraphEntities: graphQueryCalls.pageGraphEntities,
    queries: options.queries,
    resourceForComponent: options.resourceMapper.resourceForComponent,
    resourceMapper: options.resourceMapper,
    snapshot: options.transactionProvider.snapshot,
    searchGraphEntities: graphQueryCalls.searchGraphEntities,
    transactionExecution: options.transactionExecution,
    transactionProvider: options.transactionProvider,
    traverseGraphRelations: graphQueryCalls.traverseGraphRelations,
  };
  for (const [name, value] of Object.entries(calls)) {
    if (
      name !== "initialization" &&
      name !== "aliasResourceMapper" &&
      name !== "graphQueries" &&
      name !== "graphQueryMaxPageSize" &&
      name !== "queries" &&
      name !== "resourceMapper" &&
      name !== "transactionExecution" &&
      name !== "transactionProvider" &&
      typeof value !== "function"
    ) {
      throw new TypeError(`Application capability ${name} must be callable`);
    }
  }
  return Object.freeze(calls);
}

function validateGraphQueryEngineReceiver(
  graphQueries: unknown,
  isProxy: (value: unknown) => boolean,
  maximumPageSize: number,
): CapturedGraphQueryEngineCalls {
  if (typeof graphQueries !== "object" || graphQueries === null) {
    throw new TypeError("graphQueries must be a GraphQueryEngineCapability");
  }
  let recognizedProxy = false;
  try {
    recognizedProxy = isProxy(graphQueries);
  } catch {
    // Exact descriptor inspection below still fails closed for observable hostile shapes.
  }
  if (recognizedProxy) throw new TypeError("graphQueries must not be a proxy");
  const inspected = inspectExactRecord(
    graphQueries,
    [
      [
        "exactEntity",
        "identity",
        "maxPageSize",
        "pageEntities",
        "searchEntities",
        "traverseRelations",
      ],
    ],
    "graph-query-unavailable",
    "Graph query engine",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.exactEntity !== "function" ||
    typeof inspected.value.identity !== "function" ||
    typeof inspected.value.pageEntities !== "function" ||
    typeof inspected.value.searchEntities !== "function" ||
    typeof inspected.value.traverseRelations !== "function" ||
    typeof inspected.value.maxPageSize !== "number" ||
    !Number.isSafeInteger(inspected.value.maxPageSize) ||
    inspected.value.maxPageSize <= 0 ||
    inspected.value.maxPageSize > maximumPageSize
  ) {
    throw new TypeError("graphQueries must be an exact bounded GraphQueryEngineCapability");
  }
  return Object.freeze({
    exactGraphEntity: inspected.value.exactEntity as GraphQueryEngineCapability["exactEntity"],
    graphQueryIdentity: inspected.value.identity as GraphQueryEngineCapability["identity"],
    graphQueryMaxPageSize: inspected.value.maxPageSize,
    graphQueries: graphQueries as GraphQueryEngineCapability,
    pageGraphEntities: inspected.value.pageEntities as GraphQueryEngineCapability["pageEntities"],
    searchGraphEntities: inspected.value
      .searchEntities as GraphQueryEngineCapability["searchEntities"],
    traverseGraphRelations: inspected.value
      .traverseRelations as GraphQueryEngineCapability["traverseRelations"],
  });
}

function validateBoundedQueryReceiver(
  queries: unknown,
  isProxy: (value: unknown) => boolean,
): asserts queries is BoundedQueryContracts {
  if (typeof queries !== "object" || queries === null) {
    throw new TypeError("queries must be a genuine BoundedQueryContracts instance");
  }
  let recognizedProxy = false;
  try {
    recognizedProxy = isProxy(queries);
  } catch {
    // The exact Core private-brand probe below is trap-free for genuine instances and proxies.
  }
  if (recognizedProxy) {
    throw new TypeError("queries must be a genuine BoundedQueryContracts instance");
  }
  try {
    invokeCapturedBoundedQueryPrepare(
      queries as BoundedQueryContracts,
      0,
      Object.freeze({}),
      Object.freeze({ limit: 1 }),
    );
  } catch {
    throw new TypeError("queries must be a genuine BoundedQueryContracts instance");
  }
}

function containApplicationCapabilityValue(
  value: unknown,
  options: Pick<ApplicationOperationsContext, "bounds" | "isProxy">,
  depthAllowance = 8,
  valueAllowance = 0,
) {
  const contained = containCapabilityValue(value, {
    isProxy: options.isProxy,
    maximumContainerEntries: Math.max(
      64,
      maximumCanonicalResourceCount(options.bounds),
      options.bounds.maxDiagnosticCount,
      options.bounds.maxEmbeddedItems,
      options.bounds.maxRelationships,
    ),
    maximumDepth: options.bounds.maxSnapshotStateDepth + depthAllowance,
    maximumValues:
      options.bounds.maxSnapshotStateValues +
      valueAllowance +
      options.bounds.maxComponents * 3 +
      options.bounds.maxDiagnosticCount * 67,
  });
  return contained.ok ? contained : applicationCapabilityContainmentFailure;
}

function precontainApplicationSnapshotProperties(
  value: unknown,
  options: ApplicationOperationsContext,
): void {
  if (typeof value !== "object" || value === null) return;
  for (const key of ["revisions", "state"] as const) {
    try {
      const descriptor = intrinsicObjectGetOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor && descriptor.enumerable) {
        containApplicationCapabilityValue(descriptor.value, options);
      }
    } catch {
      // Exact snapshot inspection below owns the public failure.
    }
  }
}

function exactRequest(
  value: unknown,
  shapes: readonly (readonly string[])[],
  subject: string,
): Result<Readonly<Record<string, unknown>>> {
  return inspectExactRecord(value, shapes, "invalid-application-request", subject);
}

function boundedRequest(value: unknown, subject: string): Result<BoundedPageRequest> {
  const inspected = exactRequest(value, [["limit"], ["cursor", "limit"]], subject);
  if (!inspected.ok) return inspected;
  return success(
    Object.freeze({
      ...(Object.hasOwn(inspected.value, "cursor")
        ? { cursor: inspected.value.cursor as string }
        : {}),
      limit: inspected.value.limit as number,
    }),
  );
}

const filteredPageShapes = Object.freeze([
  Object.freeze(["limit"]),
  Object.freeze(["cursor", "limit"]),
  Object.freeze(["limit", "scale"]),
  Object.freeze(["limit", "shared"]),
  Object.freeze(["cursor", "limit", "scale"]),
  Object.freeze(["cursor", "limit", "shared"]),
  Object.freeze(["limit", "scale", "shared"]),
  Object.freeze(["cursor", "limit", "scale", "shared"]),
]);

function filteredBoundedRequest(
  value: unknown,
  subject: string,
): Result<ValidatedComponentReadFilters> {
  const inspected = exactRequest(value, filteredPageShapes, subject);
  if (!inspected.ok) return inspected;
  const hasScale = Object.hasOwn(inspected.value, "scale");
  const hasShared = Object.hasOwn(inspected.value, "shared");
  if (
    hasScale &&
    (typeof inspected.value.scale !== "string" || !isStandardComponentScale(inspected.value.scale))
  ) {
    return failure(
      diagnostic(
        "invalid-component-scale",
        "Component scale filter must be system, domain, part, or element",
      ),
    );
  }
  if (hasShared && typeof inspected.value.shared !== "boolean") {
    return failure(
      diagnostic("invalid-component-shared", "Component shared filter must be a boolean"),
    );
  }
  const page = boundedRequest(
    Object.freeze({
      ...(Object.hasOwn(inspected.value, "cursor")
        ? { cursor: inspected.value.cursor as string }
        : {}),
      limit: inspected.value.limit as number,
    }),
    subject,
  );
  return page.ok
    ? success(
        Object.freeze({
          ...page.value,
          ...(hasScale ? { scale: inspected.value.scale as StandardComponentScale } : {}),
          ...(hasShared ? { shared: inspected.value.shared as boolean } : {}),
        }),
      )
    : page;
}

function componentMatchesFilters(
  component: StandardComponent,
  filters: ValidatedComponentReadFilters,
): boolean {
  return (
    (filters.scale === undefined || component.scale === filters.scale) &&
    (filters.shared === undefined || (component.shared ?? false) === filters.shared)
  );
}

function componentFilterQuery(filters: ValidatedComponentReadFilters) {
  return Object.freeze({
    ...(filters.scale === undefined ? {} : { scale: filters.scale }),
    ...(filters.shared === undefined ? {} : { shared: filters.shared }),
  });
}

function componentPayloadQuery(filters: ValidatedComponentReadFilters) {
  return Object.freeze({
    ...(filters.scale === undefined ? {} : { scale: filters.scale }),
    ...(filters.shared === undefined ? {} : { shared: filters.shared }),
  });
}

function denseArray(
  value: unknown,
  subject: string,
  maximum: number,
  isProxy?: (value: unknown) => boolean,
): Result<readonly unknown[]> {
  if (typeof value === "object" && value !== null && isProxy?.(value)) {
    return failure(diagnostic("invalid-standard-model-state", `${subject} must not be a proxy`));
  }
  const length = boundedArrayLength(value, subject, maximum);
  if (!length.ok) return length;
  try {
    const keys = Reflect.ownKeys(value as object);
    if (keys.length !== length.value + 1) {
      return failure(diagnostic("invalid-standard-model-state", `${subject} must be dense`));
    }
    const items = new Array<unknown>(length.value);
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          diagnostic("invalid-standard-model-state", `${subject} entries must be data properties`),
        );
      }
      items[index] = descriptor.value;
    }
    return success(Object.freeze(items));
  } catch {
    return failure(
      diagnostic("invalid-standard-model-state", `${subject} could not be inspected safely`),
    );
  }
}

function boundedArrayLength(value: unknown, subject: string, maximum: number): Result<number> {
  const length = inspectIntrinsicArrayLength(value, "invalid-standard-model-state", subject);
  if (!length.ok) return length;
  return length.value <= maximum
    ? length
    : failure(
        Object.freeze({
          code: "application-bound-exceeded",
          details: Object.freeze({ maximum }),
          message: `${subject} exceeds the configured item count`,
        }),
      );
}

function preflightEmbeddedItems(value: unknown, maximum: number): Result<void> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return success(undefined);
  let total = 0;
  try {
    for (const field of ["actions", "inputs", "outputs"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (descriptor === undefined) continue;
      if (!("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          diagnostic(
            "invalid-component-items",
            `Component ${field} must be an enumerable data property`,
          ),
        );
      }
      if (descriptor.value === null || descriptor.value === undefined) continue;
      const length = inspectIntrinsicArrayLength(
        descriptor.value,
        "invalid-component-items",
        `Component ${field}`,
      );
      if (!length.ok) return length;
      if (length.value > maximum - total) {
        return failure(
          Object.freeze({
            code: "application-bound-exceeded",
            details: Object.freeze({ maximum }),
            message: "Embedded component items exceed the configured item count",
          }),
        );
      }
      total += length.value;
    }
  } catch {
    return failure(
      diagnostic(
        "invalid-component-items",
        "Embedded component items could not be inspected safely",
      ),
    );
  }
  return success(undefined);
}

function preflightRelationshipChanges(
  value: ComponentRelationshipChanges | undefined,
  maximum: number,
): Result<void> {
  if (value === undefined) return success(undefined);
  const envelope = exactRequest(
    value,
    [[], ["remove"], ["upsert"], ["remove", "upsert"]],
    "Relationship changes",
  );
  if (!envelope.ok) return envelope;
  let total = 0;
  for (const field of ["remove", "upsert"] as const) {
    if (!(field in envelope.value)) continue;
    const length = inspectIntrinsicArrayLength(
      envelope.value[field],
      "invalid-relationship-changes",
      `Relationship ${field}`,
    );
    if (!length.ok) return length;
    if (length.value > maximum - total) {
      return failure(
        Object.freeze({
          code: "application-bound-exceeded",
          details: Object.freeze({ maximum }),
          message: "Relationship changes exceed the configured mutation count",
        }),
      );
    }
    total += length.value;
  }
  return success(undefined);
}

function preflightDiagnostics(
  value: unknown,
  bounds: ApplicationOperationBounds,
  isProxy?: (value: unknown) => boolean,
): Result<void> {
  const entries = denseArray(value, "Diagnostics", bounds.maxDiagnosticCount, isProxy);
  if (!entries.ok) return entries;
  for (let index = 0; index < entries.value.length; index += 1) {
    if (
      typeof entries.value[index] === "object" &&
      entries.value[index] !== null &&
      isProxy?.(entries.value[index])
    ) {
      return failure(diagnostic("invalid-diagnostic", "Diagnostic is malformed"));
    }
    const entry = inspectExactRecord(
      entries.value[index],
      [
        ["code", "message"],
        ["code", "details", "message"],
      ],
      "invalid-diagnostic",
      "Diagnostic",
    );
    if (
      !entry.ok ||
      typeof entry.value.code !== "string" ||
      entry.value.code.length === 0 ||
      entry.value.code.length > 4_096 ||
      typeof entry.value.message !== "string" ||
      entry.value.message.length === 0 ||
      entry.value.message.length > 4_096
    ) {
      return failure(diagnostic("invalid-diagnostic", "Diagnostic scalar fields are malformed"));
    }
    if (!("details" in entry.value)) continue;
    if (isProxy?.(entry.value.details)) {
      return failure(diagnostic("invalid-diagnostic", "Diagnostic details are malformed"));
    }
    if (
      typeof entry.value.details !== "object" ||
      entry.value.details === null ||
      Array.isArray(entry.value.details)
    ) {
      return failure(diagnostic("invalid-diagnostic", "Diagnostic details are malformed"));
    }
    try {
      const keys = Reflect.ownKeys(entry.value.details);
      if (keys.length > 64) {
        return failure(diagnostic("invalid-diagnostic", "Diagnostic details are malformed"));
      }
      for (let detailIndex = 0; detailIndex < keys.length; detailIndex += 1) {
        const key = keys[detailIndex];
        if (typeof key !== "string" || key.length > 4_096) {
          return failure(diagnostic("invalid-diagnostic", "Diagnostic details are malformed"));
        }
        const descriptor = Object.getOwnPropertyDescriptor(entry.value.details, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return failure(diagnostic("invalid-diagnostic", "Diagnostic details are malformed"));
        }
        const detail = descriptor.value;
        if (
          (typeof detail !== "string" || detail.length > 4_096) &&
          (typeof detail !== "number" || !Number.isFinite(detail)) &&
          typeof detail !== "boolean"
        ) {
          return failure(diagnostic("invalid-diagnostic", "Diagnostic details are malformed"));
        }
      }
    } catch {
      return failure(diagnostic("invalid-diagnostic", "Diagnostic details are malformed"));
    }
  }
  return success(undefined);
}

function validatedInitializationOutcome(
  value: unknown,
  bounds: ApplicationOperationBounds,
  isProxy?: (value: unknown) => boolean,
): Result<WorkspaceInitializationOutcome> {
  const raw = inspectExactRecord(
    value,
    [
      ["generation", "status"],
      ["diagnostics", "status"],
    ],
    "invalid-workspace-initialization-outcome",
    "Workspace initialization outcome",
  );
  if (!raw.ok) return raw;
  if ("diagnostics" in raw.value) {
    const diagnostics = preflightDiagnostics(raw.value.diagnostics, bounds, isProxy);
    if (!diagnostics.ok) return diagnostics;
  }
  const copied = copyGraphPayload(value, "transaction");
  if (!copied.ok) return copied;
  const record = inspectExactRecord(
    copied.value,
    [
      ["generation", "status"],
      ["diagnostics", "status"],
    ],
    "invalid-workspace-initialization-outcome",
    "Workspace initialization outcome",
  );
  if (!record.ok) return record;
  if (record.value.status === "initialized" || record.value.status === "already-initialized") {
    if (!("generation" in record.value)) {
      return failure(
        diagnostic(
          "invalid-workspace-initialization-outcome",
          "Successful workspace initialization requires a graph generation",
        ),
      );
    }
    const generation = parseGraphGeneration(record.value.generation);
    return generation.ok
      ? success(Object.freeze({ generation: generation.value, status: record.value.status }))
      : generation;
  }
  if (record.value.status !== "conflict" && record.value.status !== "provider-failure") {
    return failure(
      diagnostic(
        "invalid-workspace-initialization-outcome",
        "Workspace initialization returned an unsupported status",
      ),
    );
  }
  if (!("diagnostics" in record.value)) {
    return failure(
      diagnostic(
        "invalid-workspace-initialization-outcome",
        "Failed workspace initialization requires diagnostics",
      ),
    );
  }
  const values = denseArray(
    record.value.diagnostics,
    "Workspace initialization diagnostics",
    bounds.maxDiagnosticCount,
  );
  if (!values.ok) return values;
  const diagnostics: Diagnostic[] = [];
  for (let index = 0; index < values.value.length; index += 1) {
    const entry = inspectExactRecord(
      values.value[index],
      [
        ["code", "message"],
        ["code", "details", "message"],
      ],
      "invalid-workspace-initialization-outcome",
      "Workspace initialization diagnostic",
    );
    if (
      !entry.ok ||
      typeof entry.value.code !== "string" ||
      entry.value.code.length === 0 ||
      entry.value.code.length > 4_096 ||
      typeof entry.value.message !== "string" ||
      entry.value.message.length === 0 ||
      entry.value.message.length > 4_096
    ) {
      return failure(
        diagnostic(
          "invalid-workspace-initialization-outcome",
          "Workspace initialization diagnostics are malformed",
        ),
      );
    }
    let details: Readonly<Record<string, string | number | boolean>> | undefined;
    if ("details" in entry.value) {
      if (
        typeof entry.value.details !== "object" ||
        entry.value.details === null ||
        Array.isArray(entry.value.details)
      ) {
        return failure(
          diagnostic(
            "invalid-workspace-initialization-outcome",
            "Workspace initialization diagnostic details are malformed",
          ),
        );
      }
      const entries = Object.entries(entry.value.details);
      if (entries.length > 64) {
        return failure(
          diagnostic(
            "invalid-workspace-initialization-outcome",
            "Workspace initialization diagnostic details are malformed",
          ),
        );
      }
      const copiedDetails = Object.create(null) as Record<string, string | number | boolean>;
      for (let detailIndex = 0; detailIndex < entries.length; detailIndex += 1) {
        const [key, detail] = entries[detailIndex]!;
        if (
          key.length > 4_096 ||
          (typeof detail !== "string" &&
            (typeof detail !== "number" || !Number.isFinite(detail)) &&
            typeof detail !== "boolean") ||
          (typeof detail === "string" && detail.length > 4_096)
        ) {
          return failure(
            diagnostic(
              "invalid-workspace-initialization-outcome",
              "Workspace initialization diagnostic details are malformed",
            ),
          );
        }
        Object.defineProperty(copiedDetails, key, { enumerable: true, value: detail });
      }
      details = Object.freeze(copiedDetails);
    }
    diagnostics[index] = applicationDiagnostic(
      Object.freeze({
        code: entry.value.code,
        ...(details === undefined ? {} : { details }),
        message: entry.value.message,
      }),
      record.value.status === "conflict" ? "conflict" : "provider",
    );
  }
  return success(
    Object.freeze({
      diagnostics: Object.freeze(diagnostics),
      status: record.value.status,
    }),
  );
}

async function snapshot(
  resources: readonly ResourceKey[],
  options: ApplicationOperationsContext,
): Promise<Result<ReadSnapshot>> {
  let raw: unknown;
  try {
    const invoked = intrinsicReflectApply(
      options.calls.snapshot,
      options.calls.transactionProvider,
      [resources],
    );
    const settled = await settleApplicationCapabilityValue(invoked, options.isProxy);
    if (settled.status === "proxy-policy-failed") return snapshotDecodeFailure();
    if (settled.status !== "fulfilled") {
      return failure(
        diagnostic("provider-snapshot-failed", "The transaction snapshot capability failed"),
      );
    }
    raw = settled.value;
  } catch {
    return failure(
      diagnostic("provider-snapshot-failed", "The transaction snapshot capability failed"),
    );
  }
  precontainApplicationSnapshotProperties(raw, options);
  const inspected = inspectExactRecord(
    raw,
    [["generation", "revisions", "state"]],
    "invalid-provider-snapshot",
    "Transaction provider snapshot",
  );
  if (!inspected.ok) return inspected;
  const containedRevisions = containApplicationCapabilityValue(inspected.value.revisions, options);
  if (!containedRevisions.ok) {
    return failure(
      diagnostic("invalid-provider-snapshot", "Transaction provider revisions are malformed"),
    );
  }
  const generation = parseGraphGeneration(inspected.value.generation);
  if (!generation.ok) return generation;
  const entries = denseArray(
    containedRevisions.value,
    "Transaction provider revisions",
    resources.length,
    options.isProxy,
  );
  if (!entries.ok) return entries;
  if (entries.value.length !== resources.length) {
    return failure(
      diagnostic(
        "invalid-provider-snapshot",
        "Transaction provider revisions must exactly match requested resources",
      ),
    );
  }
  const revisions = new Map<ResourceKey, ContentRevision | null>();
  for (let index = 0; index < entries.value.length; index += 1) {
    const entry = inspectExactRecord(
      entries.value[index],
      [["resource", "revision"]],
      "invalid-provider-snapshot",
      "Transaction provider revision",
    );
    if (!entry.ok) return entry;
    const resource = parseResourceKey(entry.value.resource);
    if (!resource.ok) return resource;
    const revision =
      entry.value.revision === null ? success(null) : parseContentRevision(entry.value.revision);
    if (!revision.ok) return revision;
    if (!resources.includes(resource.value) || revisions.has(resource.value)) {
      return failure(
        diagnostic(
          "invalid-provider-snapshot",
          "Transaction provider revisions must exactly match requested resources",
        ),
      );
    }
    revisions.set(resource.value, revision.value);
  }
  const state = decodeSnapshotState(inspected.value.state, options);
  if (!state.ok) return state;
  return success(Object.freeze({ generation: generation.value, revisions, ...state.value }));
}

function snapshotDecodeFailure(): Result<never> {
  return frozenFailure(
    diagnostic(
      "application-snapshot-decode-failed",
      "The application snapshot decoder could not safely decode provider state",
    ),
  );
}

function decodeSnapshotState(
  value: unknown,
  options: ApplicationOperationsContext,
): Result<DecodedApplicationSnapshotState> {
  try {
    const isProxy = options.isProxy;
    const decoded: unknown = options.snapshotStateDecoder.decode(value);
    if (typeof decoded === "object" && decoded !== null && isProxy?.(decoded)) {
      return snapshotDecodeFailure();
    }
    const result = inspectExactRecord(
      decoded,
      [
        ["ok", "value"],
        ["diagnostics", "ok"],
      ],
      "application-snapshot-decode-failed",
      "Application snapshot decoder result",
    );
    if (!result.ok) return snapshotDecodeFailure();
    if (result.value.ok === false) {
      const diagnostics = applicationDiagnostics(
        result.value.diagnostics,
        "provider",
        options.bounds,
        isProxy,
      );
      return diagnostics.ok && diagnostics.value.length > 0
        ? frozenFailure(...diagnostics.value)
        : snapshotDecodeFailure();
    }
    if (result.value.ok !== true) return snapshotDecodeFailure();
    if (
      typeof result.value.value === "object" &&
      result.value.value !== null &&
      isProxy?.(result.value.value)
    ) {
      return snapshotDecodeFailure();
    }
    const state = inspectExactRecord(
      result.value.value,
      [
        ["aliases", "components", "graph", "relationships"],
        ["aliases", "components", "evidence", "graph", "relationships"],
      ],
      "application-snapshot-decode-failed",
      "Decoded application snapshot state",
    );
    if (!state.ok) return snapshotDecodeFailure();
    const aliases = denseArray(
      state.value.aliases,
      "Decoded application snapshot aliases",
      options.bounds.maxComponents,
      isProxy,
    );
    if (!aliases.ok) return snapshotDecodeFailure();
    const components = denseArray(
      state.value.components,
      "Decoded application snapshot components",
      options.bounds.maxComponents,
      isProxy,
    );
    if (!components.ok) return snapshotDecodeFailure();
    const relationships = denseArray(
      state.value.relationships,
      "Decoded application snapshot relationships",
      options.bounds.maxRelationships,
      isProxy,
    );
    if (!relationships.ok) return snapshotDecodeFailure();
    for (const component of components.value) {
      if (
        typeof component !== "object" ||
        component === null ||
        isProxy?.(component) ||
        !Object.isFrozen(component) ||
        !isCanonicalApplicationSnapshotComponent(component)
      ) {
        return snapshotDecodeFailure();
      }
    }
    for (const relationship of relationships.value) {
      if (
        typeof relationship !== "object" ||
        relationship === null ||
        isProxy?.(relationship) ||
        !Object.isFrozen(relationship) ||
        !isCanonicalApplicationSnapshotRelationship(relationship)
      ) {
        return snapshotDecodeFailure();
      }
    }
    const graph = state.value.graph;
    if (typeof graph === "object" && graph !== null && isProxy?.(graph)) {
      return snapshotDecodeFailure();
    }
    const entityCount =
      typeof graph === "object" && graph !== null
        ? Object.getOwnPropertyDescriptor(graph, "entityCount")
        : undefined;
    const relationCount =
      typeof graph === "object" && graph !== null
        ? Object.getOwnPropertyDescriptor(graph, "relationCount")
        : undefined;
    if (
      typeof graph !== "object" ||
      graph === null ||
      !Object.isFrozen(graph) ||
      entityCount === undefined ||
      !("value" in entityCount) ||
      !entityCount.enumerable ||
      entityCount.value !== components.value.length ||
      relationCount === undefined ||
      !("value" in relationCount) ||
      !relationCount.enumerable ||
      relationCount.value !== relationships.value.length
    ) {
      return snapshotDecodeFailure();
    }
    return success(
      Object.freeze({
        aliases: aliases.value as DecodedApplicationSnapshotState["aliases"],
        components: components.value as readonly StandardComponent[],
        ...(Object.hasOwn(state.value, "evidence")
          ? { evidence: state.value.evidence as GraphData }
          : {}),
        graph: graph as GraphSnapshot,
        relationships: relationships.value as readonly StandardRelationship[],
      }),
    );
  } catch {
    return snapshotDecodeFailure();
  }
}

function queryCapabilityFailure<T>(): Result<T> {
  return frozenFailure(
    diagnostic("query-capability-failed", "The bounded query capability failed safely"),
  );
}

function evidenceReferenceMatches(
  reference: ObservationReference,
  binding: ComponentBinding,
): boolean {
  return reference.scope === binding.scope && reference.key === binding.key;
}

function evidenceRecordMatches(record: ObservationRecord, binding: ComponentBinding): boolean {
  switch (record.kind) {
    case "component-candidate":
      return record.scope === binding.scope && record.key === binding.key;
    case "action":
    case "input":
    case "output":
      return evidenceReferenceMatches(record.component, binding);
    case "documentation":
      return record.subject !== undefined && evidenceReferenceMatches(record.subject, binding);
    case "relationship":
      return (
        evidenceReferenceMatches(record.from, binding) ||
        evidenceReferenceMatches(record.to, binding)
      );
  }
}

function componentEvidence(
  snapshot: ReadSnapshot,
  component: StandardComponent,
  options: ApplicationOperationsContext,
): Result<readonly ComponentEvidenceView[]> {
  if (snapshot.evidence === undefined) return success(Object.freeze([]));
  const parsed = parseEvidenceState(snapshot.evidence, {
    maxComponents: options.bounds.maxEmbeddedItems,
    maxRecords: options.bounds.maxRequestDataValues,
    maxRelationships: options.bounds.maxRelationshipMutations,
    maxSources: options.bounds.maxComponents,
  });
  if (!parsed.ok) return parsed;
  const views: ComponentEvidenceView[] = [];
  for (const source of parsed.value.sources) {
    for (const binding of source.componentBindings) {
      const resolved = options.graph.resolveEntityIdentity(snapshot.graph, binding.componentId);
      // Removal can leave a durable observation binding behind until reconciliation
      // refreshes that source. It cannot support any currently readable component.
      if (!resolved.ok) continue;
      if (resolved.value.resolved !== component.id) continue;
      const records = Object.freeze(
        source.snapshot.records.filter((record) => evidenceRecordMatches(record, binding)),
      );
      const scopes = new Set<string>([binding.scope, ...records.map((record) => record.scope)]);
      views.push(
        Object.freeze({
          binding: Object.freeze({
            key: binding.key,
            present: binding.present,
            scope: binding.scope,
          }),
          coverage: Object.freeze(
            source.snapshot.coverage.filter((entry) => scopes.has(entry.scope)),
          ),
          projectId: source.snapshot.projectId,
          records,
          ...(binding.scaleAssessment === undefined
            ? {}
            : { scale: componentScaleEvidence(binding.scaleAssessment, component.scale) }),
          scanner: source.snapshot.source,
        }),
      );
    }
  }
  return success(Object.freeze(views));
}

/**
 * Projects the one scanner scalar the visual blueprint currently understands.
 * Invalid, stale, or conflicting observations disappear from this optional view
 * rather than making a canonical component read fail or inviting a guessed score.
 */
function cognitiveComplexityEvidence(
  snapshot: ReadSnapshot,
  components: readonly StandardComponent[],
  options: ApplicationOperationsContext,
): ReadonlyMap<string, readonly ComponentCognitiveComplexityEvidence[]> {
  if (snapshot.evidence === undefined || components.length === 0) return new Map();
  const parsed = parseEvidenceState(snapshot.evidence, {
    maxComponents: options.bounds.maxEmbeddedItems,
    maxRecords: options.bounds.maxRequestDataValues,
    maxRelationships: options.bounds.maxRelationshipMutations,
    maxSources: options.bounds.maxComponents,
  });
  if (!parsed.ok) return new Map();

  const wanted = new Set(components.map((component) => component.id));
  const collected = new Map<
    string,
    Map<
      string,
      {
        readonly projectId: string;
        readonly scanner: ObservationSourceIdentity;
        readonly values: Set<number>;
      }
    >
  >();
  for (const source of parsed.value.sources) {
    const scanner = source.snapshot.source;
    const provenance = `${source.snapshot.projectId}\u0000${scanner.id}\u0000${scanner.instance}\u0000${scanner.version}`;
    const scoresByBinding = new Map<string, number[]>();
    for (const record of source.snapshot.records) {
      if (
        record.kind !== "component-candidate" ||
        record.signals?.cognitiveComplexity === undefined
      )
        continue;
      const identity = `${record.scope}\u0000${record.key}`;
      const scores = scoresByBinding.get(identity);
      if (scores === undefined) scoresByBinding.set(identity, [record.signals.cognitiveComplexity]);
      else scores.push(record.signals.cognitiveComplexity);
    }
    for (const binding of source.componentBindings) {
      if (!binding.present) continue;
      const resolved = options.graph.resolveEntityIdentity(snapshot.graph, binding.componentId);
      if (!resolved.ok || !wanted.has(resolved.value.resolved)) continue;
      const scores = scoresByBinding.get(`${binding.scope}\u0000${binding.key}`) ?? [];
      if (scores.length === 0) continue;
      const bySource = collected.get(resolved.value.resolved) ?? new Map();
      const measured = bySource.get(provenance) ?? {
        projectId: source.snapshot.projectId,
        scanner,
        values: new Set<number>(),
      };
      for (const score of scores) measured.values.add(score);
      bySource.set(provenance, measured);
      collected.set(resolved.value.resolved, bySource);
    }
  }

  const views = new Map<string, readonly ComponentCognitiveComplexityEvidence[]>();
  for (const [componentId, bySource] of collected) {
    const entries = [...bySource.values()]
      .flatMap((measured) =>
        measured.values.size === 1
          ? [
              Object.freeze({
                projectId: measured.projectId,
                scanner: measured.scanner,
                value: [...measured.values][0]!,
              }),
            ]
          : [],
      )
      .sort((left, right) =>
        compareText(
          `${left.projectId}\u0000${left.scanner.id}\u0000${left.scanner.instance}\u0000${left.scanner.version}`,
          `${right.projectId}\u0000${right.scanner.id}\u0000${right.scanner.instance}\u0000${right.scanner.version}`,
        ),
      );
    if (entries.length > 0) views.set(componentId, Object.freeze(entries));
  }
  return views;
}

/** Current evidence support, projected without exposing scanner identities or records. */
function evidenceBoundComponents(
  snapshot: ReadSnapshot,
  components: readonly StandardComponent[],
  options: ApplicationOperationsContext,
): ReadonlySet<string> {
  if (snapshot.evidence === undefined || components.length === 0) return new Set();
  const parsed = parseEvidenceState(snapshot.evidence, {
    maxComponents: options.bounds.maxEmbeddedItems,
    maxRecords: options.bounds.maxRequestDataValues,
    maxRelationships: options.bounds.maxRelationshipMutations,
    maxSources: options.bounds.maxComponents,
  });
  if (!parsed.ok) return new Set();
  const wanted = new Set(components.map((component) => component.id));
  const bound = new Set<string>();
  for (const source of parsed.value.sources) {
    for (const binding of source.componentBindings) {
      if (!binding.present) continue;
      const resolved = options.graph.resolveEntityIdentity(snapshot.graph, binding.componentId);
      if (resolved.ok && wanted.has(resolved.value.resolved)) bound.add(resolved.value.resolved);
    }
  }
  return bound;
}

function componentScaleEvidence(
  assessment: NonNullable<ComponentBinding["scaleAssessment"]>,
  curated: StandardComponent["scale"],
): ComponentScaleEvidenceView {
  if (assessment.status === "insufficient") return assessment;
  if (assessment.status === "ambiguous") return assessment;
  if (curated === undefined) return assessment;
  return Object.freeze({
    curated,
    derivation: assessment.derivation,
    proposal: assessment.proposal,
    status: curated === assessment.proposal ? "aligned" : "drift",
  });
}

const boundedQueryDiagnosticCodes = new Set([
  "continuation-anchor-too-large",
  "continuation-cursor-too-large",
  "cursor-query-mismatch",
  "invalid-bounded-query-request",
  "invalid-page-limit",
  "invalid-prepared-query",
  "invalid-query-items",
  "invalid-query-page",
  "invalid-query-page-state",
  "malformed-continuation-cursor",
  "missing-continuation-anchor",
  "non-advancing-continuation-anchor",
  "query-context-too-large",
  "query-page-overflow",
  "stale-cursor",
  "unexpected-continuation-anchor",
  "unsupported-continuation-cursor",
]);

function containedQueryCapabilityResult(
  value: unknown,
  options: ApplicationOperationsContext,
): Result<unknown> {
  const contained = containApplicationCapabilityValue(value, options);
  if (!contained.ok) return queryCapabilityFailure();
  const envelope = inspectExactRecord(
    contained.value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "query-capability-failed",
    "Bounded query capability result",
  );
  if (!envelope.ok) return queryCapabilityFailure();
  if (envelope.value.ok === false) {
    const diagnostics = applicationDiagnostics(
      envelope.value.diagnostics,
      "validation",
      options.bounds,
      options.isProxy,
    );
    return diagnostics.ok &&
      diagnostics.value.length > 0 &&
      diagnostics.value.every((entry) => boundedQueryDiagnosticCodes.has(entry.code))
      ? frozenFailure(...diagnostics.value)
      : queryCapabilityFailure();
  }
  return envelope.value.ok === true ? success(envelope.value.value) : queryCapabilityFailure();
}

function sameCanonicalGraphData(
  left: unknown,
  right: unknown,
  bounds: ApplicationOperationBounds,
  owner: "entity" | "query",
): boolean {
  try {
    const budget = {
      code: "canonical-comparison-failed",
      maximumDepth: bounds.maxSnapshotStateDepth,
      maximumValues: bounds.maxSnapshotStateValues,
      message: "Bounded graph data exceeds the configured structural budget",
    };
    const leftCopy = copyCanonicalGraphData(left, owner, undefined, budget);
    const rightCopy = copyCanonicalGraphData(right, owner, undefined, budget);
    return (
      leftCopy.ok && rightCopy.ok && leftCopy.value.canonicalJson === rightCopy.value.canonicalJson
    );
  } catch {
    return false;
  }
}

function prepareQuery(
  generation: GraphGeneration,
  query: GraphData,
  request: BoundedPageRequest,
  options: ApplicationOperationsContext,
): Result<PreparedBoundedQuery> {
  let raw: unknown;
  try {
    raw = invokeCapturedBoundedQueryPrepare(options.calls.queries, generation, query, request);
  } catch {
    return queryCapabilityFailure();
  }
  const result = containedQueryCapabilityResult(raw, options);
  if (!result.ok) return result;
  const prepared = inspectExactRecord(
    result.value,
    [
      ["generation", "limit", "query"],
      ["after", "generation", "limit", "query"],
    ],
    "query-capability-failed",
    "Prepared bounded query",
  );
  if (!prepared.ok) return queryCapabilityFailure();
  const parsedGeneration = parseGraphGeneration(prepared.value.generation);
  const cursorPresent = Object.hasOwn(request, "cursor");
  if (
    !parsedGeneration.ok ||
    parsedGeneration.value !== generation ||
    prepared.value.limit !== request.limit ||
    !Number.isSafeInteger(prepared.value.limit) ||
    (prepared.value.limit as number) <= 0 ||
    Object.hasOwn(prepared.value, "after") !== cursorPresent ||
    !sameCanonicalGraphData(prepared.value.query, query, options.bounds, "query")
  ) {
    return queryCapabilityFailure();
  }
  let after: GraphData | undefined;
  if (cursorPresent) {
    const copied = copyGraphPayload(prepared.value.after, "query", {
      code: "query-capability-failed",
      maximumDepth: options.bounds.maxSnapshotStateDepth,
      maximumValues: options.bounds.maxSnapshotStateValues,
      message: "Bounded query anchor exceeds the configured structural budget",
    });
    if (!copied.ok) return queryCapabilityFailure();
    after = copied.value;
  }
  return success(
    Object.freeze({
      ...(cursorPresent ? { after: after! } : {}),
      generation,
      limit: request.limit as PreparedBoundedQuery["limit"],
      query,
    }),
  );
}

function pageQuery<T>(
  prepared: PreparedBoundedQuery,
  items: readonly T[],
  state: Readonly<{ readonly hasMore: boolean; readonly nextAnchor?: string }>,
  options: ApplicationOperationsContext,
): Result<{
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly T[];
  readonly nextCursor?: ContinuationCursor;
}> {
  const ownedItems = Object.freeze([...items]);
  let raw: unknown;
  try {
    raw = invokeCapturedBoundedQueryPage(options.calls.queries, prepared, ownedItems, state);
  } catch {
    return queryCapabilityFailure();
  }
  const result = containedQueryCapabilityResult(raw, options);
  if (!result.ok) return result;
  const page = inspectExactRecord(
    result.value,
    [
      ["generation", "hasMore", "items"],
      ["generation", "hasMore", "items", "nextCursor"],
    ],
    "query-capability-failed",
    "Bounded query page",
  );
  if (!page.ok) return queryCapabilityFailure();
  const generation = parseGraphGeneration(page.value.generation);
  const expectsCursor = state.hasMore;
  if (
    !generation.ok ||
    generation.value !== prepared.generation ||
    page.value.hasMore !== state.hasMore ||
    Object.hasOwn(page.value, "nextCursor") !== expectsCursor ||
    !sameCanonicalGraphData(page.value.items, ownedItems, options.bounds, "query")
  ) {
    return queryCapabilityFailure();
  }
  if (expectsCursor && typeof page.value.nextCursor !== "string") {
    return queryCapabilityFailure();
  }
  if (expectsCursor) {
    if (typeof state.nextAnchor !== "string") return queryCapabilityFailure();
    const continuation = prepareQuery(
      prepared.generation,
      prepared.query,
      Object.freeze({
        cursor: page.value.nextCursor as ContinuationCursor,
        limit: prepared.limit,
      }),
      options,
    );
    if (
      !continuation.ok ||
      !sameCanonicalGraphData(continuation.value.after, state.nextAnchor, options.bounds, "query")
    ) {
      return queryCapabilityFailure();
    }
  }
  return success(
    Object.freeze({
      generation: prepared.generation,
      hasMore: state.hasMore,
      items: ownedItems,
      ...(expectsCursor ? { nextCursor: page.value.nextCursor as ContinuationCursor } : {}),
    }),
  );
}

function exactQuery<T>(
  generation: GraphGeneration,
  item: T,
  options: ApplicationOperationsContext,
): Result<{ readonly generation: GraphGeneration; readonly item: T }> {
  let raw: unknown;
  try {
    raw = invokeCapturedBoundedQueryExact(options.calls.queries, generation, item);
  } catch {
    return queryCapabilityFailure();
  }
  const result = containedQueryCapabilityResult(raw, options);
  if (!result.ok) return result;
  const exact = inspectExactRecord(
    result.value,
    [["generation", "item"]],
    "query-capability-failed",
    "Exact bounded query result",
  );
  if (!exact.ok) return queryCapabilityFailure();
  const parsedGeneration = parseGraphGeneration(exact.value.generation);
  if (
    !parsedGeneration.ok ||
    parsedGeneration.value !== generation ||
    !sameCanonicalGraphData(exact.value.item, item, options.bounds, "query")
  ) {
    return queryCapabilityFailure();
  }
  return success(Object.freeze({ generation, item }));
}

function selectPage<T extends { readonly id: string }>(
  items: readonly T[],
  prepared: PreparedBoundedQuery,
): Result<SelectedPage<T>> {
  let start = 0;
  if (prepared.after !== undefined) {
    if (typeof prepared.after !== "string") {
      return failure(
        diagnostic("invalid-page-anchor", "The continuation anchor is not a stable identity"),
      );
    }
    const index = items.findIndex((item) => item.id === prepared.after);
    if (index < 0) {
      return failure(
        diagnostic(
          "unknown-page-anchor",
          "The continuation anchor is not present in this bounded result set",
        ),
      );
    }
    start = index + 1;
  }
  const pageItems = Object.freeze(items.slice(start, start + prepared.limit));
  const hasMore = start + pageItems.length < items.length;
  const last = pageItems.at(-1);
  return success(
    Object.freeze({
      hasMore,
      items: pageItems,
      ...(hasMore && last !== undefined ? { nextAnchor: last.id } : {}),
    }),
  );
}

function componentById(state: LoadedState, id: string): StandardComponent | undefined {
  return state.components.find((component) => component.id === id);
}

function revisionFor(
  state: ReadSnapshot,
  resource: ResourceKey,
  subject: string,
): Result<ContentRevision> {
  const revision = state.revisions.get(resource);
  return revision === undefined || revision === null
    ? failure(
        diagnostic(
          "missing-component-revision",
          `${subject} does not have a canonical content revision`,
        ),
      )
    : success(revision);
}

function relationshipPage(
  generation: GraphGeneration,
  source: string,
  revision: ContentRevision,
  relationships: readonly StandardRelationship[],
  request: BoundedPageRequest,
  options: ApplicationOperationsContext,
): Result<RelationshipPage> {
  const prepared = prepareQuery(
    generation,
    Object.freeze({ operation: "component-outgoing-relationships", source }),
    request,
    options,
  );
  if (!prepared.ok) return prepared;
  const outgoing = relationships
    .filter((relationship) => relationship.source === source)
    .sort((left, right) => compareText(left.id, right.id));
  const selected = selectPage(outgoing, prepared.value);
  if (!selected.ok) return selected;
  const views: RelationshipView[] = selected.value.items.map((relationship) =>
    Object.freeze({ relationship, revision }),
  );
  const page = pageQuery(
    prepared.value,
    Object.freeze(views),
    Object.freeze({
      hasMore: selected.value.hasMore,
      ...(selected.value.nextAnchor === undefined ? {} : { nextAnchor: selected.value.nextAnchor }),
    }),
    options,
  );
  return page.ok ? success(page.value as RelationshipPage) : page;
}

async function componentPage(
  request: BoundedPageRequest,
  query: GraphDataRecord,
  filter: ComponentFilter,
  options: ApplicationOperationsContext,
): Promise<Result<ComponentPage>> {
  const pageRequest = Object.freeze({
    ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
    limit: request.limit,
  });
  for (let attempt = 0; attempt < options.maxSnapshotAttempts; attempt += 1) {
    const initial = await snapshot(Object.freeze([]), options);
    if (!initial.ok) return readProviderFailure(initial.diagnostics);
    const prepared = prepareQuery(initial.value.generation, query, pageRequest, options);
    if (!prepared.ok) return prepared;
    const initialItems = initial.value.components.filter(filter(initial.value));
    const initialPage = selectPage(initialItems, prepared.value);
    if (!initialPage.ok) return initialPage;
    const resources: ResourceKey[] = [];
    for (let index = 0; index < initialPage.value.items.length; index += 1) {
      const mapped = componentResource(initialPage.value.items[index]!.id, options);
      if (!mapped.ok) return mapped;
      resources[index] = mapped.value;
    }
    const confirmed = await snapshot(Object.freeze(resources), options);
    if (!confirmed.ok) return readProviderFailure(confirmed.diagnostics);
    if (confirmed.value.generation !== initial.value.generation) continue;

    const confirmedItems = confirmed.value.components.filter(filter(confirmed.value));
    const confirmedPage = selectPage(confirmedItems, prepared.value);
    if (!confirmedPage.ok) return confirmedPage;
    if (
      confirmedPage.value.items.length !== initialPage.value.items.length ||
      confirmedPage.value.items.some(
        (item, index) => item.id !== initialPage.value.items[index]!.id,
      )
    ) {
      return failure(
        diagnostic(
          "inconsistent-provider-snapshot",
          "Equal graph generations returned different component pages",
        ),
      );
    }
    const cognitive = cognitiveComplexityEvidence(
      confirmed.value,
      confirmedPage.value.items,
      options,
    );
    const evidenceBound = evidenceBoundComponents(
      confirmed.value,
      confirmedPage.value.items,
      options,
    );
    const views: ComponentView[] = [];
    for (let index = 0; index < confirmedPage.value.items.length; index += 1) {
      const component = confirmedPage.value.items[index]!;
      const revision = revisionFor(confirmed.value, resources[index]!, "Component");
      if (!revision.ok) return revision;
      const measured = cognitive.get(component.id);
      views[index] = Object.freeze({
        ...(measured === undefined ? {} : { cognitiveComplexity: measured }),
        component,
        evidenceBound: evidenceBound.has(component.id),
        revision: revision.value,
      });
    }
    const page = pageQuery(
      prepared.value,
      Object.freeze(views),
      Object.freeze({
        hasMore: confirmedPage.value.hasMore,
        ...(confirmedPage.value.nextAnchor === undefined
          ? {}
          : { nextAnchor: confirmedPage.value.nextAnchor }),
      }),
      options,
    );
    return page.ok ? success(page.value as ComponentPage) : page;
  }
  return failure(
    diagnostic(
      "snapshot-generation-conflict",
      "The graph generation changed during every bounded read attempt",
    ),
  );
}

const extensionKeyPattern = /^[A-Za-z][A-Za-z0-9_.-]*(?::|\/)[A-Za-z][A-Za-z0-9_.-]*$/;
const relationTypePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

interface PlannedRelationship {
  readonly graph: GraphSnapshot;
  readonly view: StandardRelationship;
}

interface PlannedRelationshipChanges {
  readonly affected: readonly string[];
  readonly mutations: readonly GraphDataRecord[];
}

type DiagnosticCategory = "conflict" | "indeterminate" | "provider" | "validation";

const semanticMessages: Readonly<Record<string, string>> = Object.freeze({
  "alias-store-unavailable": "Canonical alias persistence is unavailable",
  "ambiguous-component-supersession":
    "An obsolete component identity can have only one superseding target",
  "application-request-data-too-large":
    "Mutation request data exceeds the configured structural budget",
  "component-alias-cycle": "Component alias chains must remain acyclic",
  "component-containment-cycle": "Component containment must remain acyclic",
  "component-has-children": "Component children must be handled explicitly first",
  "component-has-relationships": "Component relationships must be handled explicitly first",
  "component-is-alias-target":
    "A component that preserves obsolete identities must be merged onward rather than removed",
  "component-resource-unavailable": "The component resource could not be resolved",
  "content-revision-conflict": "The component revision conflicts with canonical state",
  "continuation-anchor-too-large": "The continuation anchor exceeds the configured size budget",
  "continuation-cursor-too-large": "The continuation cursor exceeds the configured size budget",
  "cursor-query-mismatch": "The continuation cursor belongs to a different query",
  "explicit-reparent-required": "Structural parent changes require explicit reparenting",
  "invalid-bounded-query-request": "The bounded query request is malformed",
  "invalid-page-limit": "The page limit is outside the configured bound",
  "invalid-prepared-query": "The prepared bounded query is malformed",
  "invalid-query-items": "The query items are malformed",
  "invalid-query-page": "The query page is malformed",
  "invalid-query-page-state": "The query page state is malformed",
  "malformed-continuation-cursor": "The continuation cursor is malformed",
  "missing-continuation-anchor": "A continuing page requires a deterministic anchor",
  "missing-component-alias-target": "The component alias target does not exist",
  "non-advancing-continuation-anchor": "The continuation anchor must advance",
  "query-context-too-large": "The query context exceeds the configured size budget",
  "query-page-overflow": "The query page exceeds the validated item limit",
  "relationship-id-hijack": "The relationship identity belongs to another component",
  "component-scale-coarser-than-parent":
    "A component scale can never be coarser than its parent scale",
  "self-component-parent": "A component cannot be its own structural parent",
  "self-component-alias": "A component identity cannot supersede itself",
  "stale-cursor": "The continuation cursor belongs to a different graph generation",
  "unexpected-continuation-anchor": "A completed page must not include a continuation anchor",
  "unknown-component": "The exact component does not exist",
  "unknown-component-alias-source": "The obsolete component identity does not exist",
  "unknown-component-parent": "The exact component parent does not exist",
  "unknown-relationship": "The exact relationship does not exist",
  "unsupported-continuation-cursor": "The continuation cursor version is not supported",
});

const safeIdentityDetailKeys = new Set(["componentId", "id", "parent", "source", "target"]);
const safeNumericDetailKeys = new Set([
  "actual",
  "attempts",
  "currentGeneration",
  "cursorGeneration",
  "limit",
  "maximum",
  "receivedLength",
  "sourceMessageLength",
]);
const safeBooleanDetailKeys = new Set([
  "actualAbsent",
  "expectedAbsent",
  "overwritePrevented",
  "retryable",
]);
const safeReceivedTypes = new Set([
  "bigint",
  "boolean",
  "function",
  "number",
  "object",
  "string",
  "symbol",
  "undefined",
]);
const semanticPathPattern =
  /^(?:component|context|finalState|mutation|patch|priorState|request)(?:\.|\[|$)[A-Za-z0-9_.\[\]-]*$/;
const safeDiagnosticCodePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const safeDiagnosticDetailKeys = Object.freeze([
  ...safeIdentityDetailKeys,
  ...safeNumericDetailKeys,
  ...safeBooleanDetailKeys,
  "path",
  "receivedType",
  "state",
]);

function stableDiagnosticCode(code: string, category: DiagnosticCategory): string {
  if (code.length <= 128 && safeDiagnosticCodePattern.test(code)) return code;
  if (category === "conflict") return "application-conflict";
  if (category === "provider") return "application-provider-failure";
  if (category === "indeterminate") return "application-indeterminate";
  return "application-validation-rejected";
}

function stableDiagnosticMessage(code: string, category: DiagnosticCategory): string {
  if (category === "conflict") return "The operation conflicts with current canonical state";
  if (category === "provider") return "The provider could not complete the operation";
  if (category === "indeterminate") return "The operation commit state is indeterminate";
  return semanticMessages[code] ?? "The requested semantic operation was rejected";
}

function safeDiagnosticDetails(
  source: unknown,
  isProxy?: (value: unknown) => boolean,
): Result<Readonly<Record<string, string | number | boolean>> | undefined> {
  if (source === undefined) return success(undefined);
  const malformed = () =>
    failure(
      diagnostic("invalid-transaction-outcome", "Transaction diagnostic details are malformed"),
    );
  const details = Object.create(null) as Record<string, string | number | boolean>;
  let copied = 0;
  try {
    if (typeof source !== "object" || source === null || Array.isArray(source)) return malformed();
    if (isProxy?.(source)) return malformed();
    const prototype = Object.getPrototypeOf(source);
    if (prototype !== Object.prototype && prototype !== null) return malformed();
    for (const key of safeDiagnosticDetailKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor === undefined) continue;
      if (!("value" in descriptor) || !descriptor.enumerable) return malformed();
      const value = descriptor.value;
      let safe = false;
      if (safeIdentityDetailKeys.has(key) && typeof value === "string") {
        safe = parseEntityId(value).ok || parseRelationId(value).ok;
      } else if (key === "path" && typeof value === "string") {
        safe = semanticPathPattern.test(value);
      } else if (key === "receivedType" && typeof value === "string") {
        safe = safeReceivedTypes.has(value);
      } else if (key === "state" && typeof value === "string") {
        safe = value === "absent" || value === "incompatible" || value === "initialized";
      } else if (safeNumericDetailKeys.has(key) && typeof value === "number") {
        safe = Number.isFinite(value);
      } else if (safeBooleanDetailKeys.has(key) && typeof value === "boolean") {
        safe = true;
      }
      if (safe) {
        Object.defineProperty(details, key, { enumerable: true, value });
        copied += 1;
      }
    }
  } catch {
    return malformed();
  }
  return success(copied === 0 ? undefined : Object.freeze(details));
}

function applicationDiagnostic(
  source: Diagnostic,
  category: DiagnosticCategory,
): ApplicationDiagnostic {
  const inspected = inspectExactRecord(
    source,
    [
      ["code", "message"],
      ["code", "details", "message"],
    ],
    "invalid-transaction-outcome",
    "Transaction outcome diagnostic",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.code !== "string" ||
    typeof inspected.value.message !== "string"
  ) {
    const code = stableDiagnosticCode("", category);
    return Object.freeze({ code, message: stableDiagnosticMessage(code, category) });
  }
  const details = safeDiagnosticDetails(inspected.value.details);
  if (!details.ok) {
    const code = stableDiagnosticCode("", category);
    return Object.freeze({ code, message: stableDiagnosticMessage(code, category) });
  }
  const code = stableDiagnosticCode(inspected.value.code, category);
  return Object.freeze({
    code,
    ...(details.value === undefined ? {} : { details: details.value }),
    message: stableDiagnosticMessage(code, category),
  });
}

function copyMutationRequestData(
  value: GraphDataRecord,
  bounds: ApplicationOperationBounds,
): Result<GraphDataRecord> {
  const copied = copyGraphPayload(value, "transaction", {
    code: "application-request-data-too-large",
    maximumDepth: bounds.maxRequestDataDepth,
    maximumValues: bounds.maxRequestDataValues,
    message: "Mutation request data exceeds the configured structural budget",
  });
  if (!copied.ok) return copied;
  if (typeof copied.value !== "object" || copied.value === null || Array.isArray(copied.value)) {
    return failure(diagnostic("invalid-application-request", "Mutation request data is malformed"));
  }
  return success(copied.value as GraphDataRecord);
}

function applicationDiagnostics(
  value: unknown,
  category: DiagnosticCategory,
  bounds: ApplicationOperationBounds,
  isProxy?: (value: unknown) => boolean,
): Result<readonly ApplicationDiagnostic[]> {
  const entries = denseArray(
    value,
    "Transaction outcome diagnostics",
    bounds.maxDiagnosticCount,
    isProxy,
  );
  if (!entries.ok) return entries;
  const diagnostics: ApplicationDiagnostic[] = [];
  for (let index = 0; index < entries.value.length; index += 1) {
    if (
      typeof entries.value[index] === "object" &&
      entries.value[index] !== null &&
      isProxy?.(entries.value[index])
    ) {
      return failure(
        diagnostic("invalid-transaction-outcome", "Transaction diagnostics are malformed"),
      );
    }
    const entry = inspectExactRecord(
      entries.value[index],
      [
        ["code", "message"],
        ["code", "details", "message"],
      ],
      "invalid-transaction-outcome",
      "Transaction outcome diagnostic",
    );
    if (
      !entry.ok ||
      typeof entry.value.code !== "string" ||
      typeof entry.value.message !== "string"
    ) {
      return failure(
        diagnostic("invalid-transaction-outcome", "Transaction diagnostics are malformed"),
      );
    }
    const details = safeDiagnosticDetails(entry.value.details, isProxy);
    if (!details.ok) return details;
    const code = stableDiagnosticCode(entry.value.code, category);
    diagnostics[index] = Object.freeze({
      code,
      ...(details.value === undefined ? {} : { details: details.value }),
      message: stableDiagnosticMessage(code, category),
    });
  }
  return success(Object.freeze(diagnostics));
}

function rejected<T>(...diagnostics: readonly Diagnostic[]): ApplicationMutationOutcome<T> {
  return Object.freeze({
    diagnostics: Object.freeze(
      diagnostics.map((entry) => applicationDiagnostic(entry, "validation")),
    ),
    status: "validation-rejected" as const,
  });
}

function snapshotFailure<T>(diagnostics: readonly Diagnostic[]): ApplicationMutationOutcome<T> {
  return Object.freeze({
    diagnostics: Object.freeze(
      diagnostics.map((entry) => applicationDiagnostic(entry, "provider")),
    ),
    phase: "snapshot" as const,
    status: "provider-failure" as const,
  });
}

function readProviderFailure<T>(diagnostics: readonly Diagnostic[]): Result<T> {
  return frozenFailure(...diagnostics.map((entry) => applicationDiagnostic(entry, "provider")));
}

function revisionConflict<T>(): ApplicationMutationOutcome<T> {
  return Object.freeze({
    diagnostics: Object.freeze([
      Object.freeze({
        code: "content-revision-conflict",
        message: "Component content revision does not match the expected value",
      }),
    ]),
    status: "conflict" as const,
  });
}

function malformedOutcome<T>(): ApplicationMutationOutcome<T> {
  return Object.freeze({
    diagnostics: Object.freeze([
      Object.freeze({
        code: "invalid-transaction-outcome",
        message: "Transaction execution returned an outcome that could not be trusted",
      }),
    ]),
    status: "indeterminate" as const,
  });
}

function stringIdentities(
  value: unknown,
  kind: "component" | "relationship",
  maximum: number,
  isProxy?: (value: unknown) => boolean,
): Result<readonly string[]> {
  const values = denseArray(value, `Affected ${kind} identities`, maximum, isProxy);
  if (!values.ok) return values;
  const identities: string[] = [];
  for (let index = 0; index < values.value.length; index += 1) {
    const candidate = values.value[index];
    if (typeof candidate !== "string") {
      return failure(
        diagnostic("invalid-transaction-outcome", `Affected ${kind} identity is malformed`),
      );
    }
    const parsed = kind === "component" ? parseEntityId(candidate) : parseRelationId(candidate);
    if (!parsed.ok) return parsed;
    identities[index] = parsed.value;
  }
  identities.sort(compareText);
  for (let index = 1; index < identities.length; index += 1) {
    if (identities[index - 1] === identities[index]) {
      return failure(
        diagnostic("invalid-transaction-outcome", `Affected ${kind} identities are ambiguous`),
      );
    }
  }
  return success(Object.freeze(identities));
}

function preflightTransactionOutcome(
  outcome: unknown,
  bounds: ApplicationOperationBounds,
  isProxy?: (value: unknown) => boolean,
): Result<void> {
  if (typeof outcome === "object" && outcome !== null && isProxy?.(outcome)) {
    return failure(diagnostic("invalid-transaction-outcome", "Transaction outcome is malformed"));
  }
  const envelope = inspectExactRecord(
    outcome,
    [
      ["diagnostics", "status"],
      ["committed", "diagnostics", "phase", "status"],
      ["diagnostics", "recovery", "status"],
      ["event", "generation", "revisions", "status"],
    ],
    "invalid-transaction-outcome",
    "Transaction execution outcome",
  );
  if (!envelope.ok) return envelope;
  if ("diagnostics" in envelope.value) {
    const diagnostics = preflightDiagnostics(envelope.value.diagnostics, bounds, isProxy);
    if (!diagnostics.ok) return diagnostics;
  }
  if ("revisions" in envelope.value) {
    const count = denseArray(
      envelope.value.revisions,
      "Committed revisions",
      maximumCanonicalResourceCount(bounds),
      isProxy,
    );
    if (!count.ok) return count;
    const event = inspectExactRecord(
      envelope.value.event,
      [["affected", "generation", "type"]],
      "invalid-transaction-outcome",
      "Committed graph event",
    );
    if (!event.ok) return event;
    const affected = inspectExactRecord(
      event.value.affected,
      [["entities", "relations"]],
      "invalid-transaction-outcome",
      "Committed affected identities",
    );
    if (!affected.ok) return affected;
    const entities = denseArray(
      affected.value.entities,
      "Committed affected component identities",
      bounds.maxComponents,
      isProxy,
    );
    if (!entities.ok) return entities;
    const relations = denseArray(
      affected.value.relations,
      "Committed affected relationship identities",
      bounds.maxRelationships,
      isProxy,
    );
    if (!relations.ok) return relations;
  }
  if ("recovery" in envelope.value) {
    const recovery = inspectExactRecord(
      envelope.value.recovery,
      [["baseGeneration", "generation", "resources", "token"]],
      "invalid-transaction-outcome",
      "Transaction recovery state",
    );
    if (!recovery.ok) return recovery;
    if (
      typeof recovery.value.token !== "string" ||
      recovery.value.token.length === 0 ||
      recovery.value.token.length > 4_096
    ) {
      return failure(diagnostic("invalid-transaction-outcome", "Recovery token is malformed"));
    }
    const resources = denseArray(
      recovery.value.resources,
      "Transaction recovery resources",
      maximumCanonicalResourceCount(bounds),
      isProxy,
    );
    if (!resources.ok) return resources;
    for (let index = 0; index < resources.value.length; index += 1) {
      if (!parseResourceKey(resources.value[index]).ok) {
        return failure(diagnostic("invalid-transaction-outcome", "Recovery resource is malformed"));
      }
    }
  }
  return success(undefined);
}

function mapTransactionOutcome<T>(
  outcome: unknown,
  resourceOwners: ReadonlyMap<ResourceKey, string | null>,
  expectedAffected: {
    readonly components: readonly string[];
    readonly relationships: readonly string[];
  },
  value: T,
  bounds: ApplicationOperationBounds,
  isProxy: (value: unknown) => boolean,
): ApplicationMutationOutcome<T> {
  const contained = containCapabilityValue(outcome, {
    isProxy,
    maximumContainerEntries: Math.max(
      64,
      maximumCanonicalResourceCount(bounds),
      bounds.maxDiagnosticCount,
      bounds.maxRelationships,
    ),
    maximumDepth: bounds.maxSnapshotStateDepth,
    maximumValues: bounds.maxSnapshotStateValues,
  });
  if (!contained.ok) return malformedOutcome();
  outcome = contained.value;
  const preflight = preflightTransactionOutcome(outcome, bounds, isProxy);
  if (!preflight.ok) return malformedOutcome();
  const copied = copyGraphPayload(outcome, "transaction", {
    code: "application-transaction-outcome-too-large",
    maximumDepth: bounds.maxSnapshotStateDepth,
    maximumValues: bounds.maxSnapshotStateValues,
    message: "Transaction outcome exceeds the configured structural budget",
  });
  if (!copied.ok) return malformedOutcome();
  const envelope = inspectExactRecord(
    copied.value,
    [
      ["diagnostics", "status"],
      ["committed", "diagnostics", "phase", "status"],
      ["diagnostics", "recovery", "status"],
      ["event", "generation", "revisions", "status"],
    ],
    "invalid-transaction-outcome",
    "Transaction execution outcome",
  );
  if (!envelope.ok || typeof envelope.value.status !== "string") return malformedOutcome();

  if (envelope.value.status === "committed") {
    if (!("event" in envelope.value) || !("generation" in envelope.value)) {
      return malformedOutcome();
    }
    const generation = parseGraphGeneration(envelope.value.generation);
    if (!generation.ok) return malformedOutcome();
    const event = inspectExactRecord(
      envelope.value.event,
      [["affected", "generation", "type"]],
      "invalid-transaction-outcome",
      "Committed graph event",
    );
    if (!event.ok || event.value.type !== "graph.committed") return malformedOutcome();
    const eventGeneration = parseGraphGeneration(event.value.generation);
    if (!eventGeneration.ok || eventGeneration.value !== generation.value)
      return malformedOutcome();
    const affected = inspectExactRecord(
      event.value.affected,
      [["entities", "relations"]],
      "invalid-transaction-outcome",
      "Committed affected identities",
    );
    if (!affected.ok) return malformedOutcome();
    const components = stringIdentities(
      affected.value.entities,
      "component",
      bounds.maxComponents,
      isProxy,
    );
    const relationships = stringIdentities(
      affected.value.relations,
      "relationship",
      bounds.maxRelationships,
      isProxy,
    );
    if (!components.ok || !relationships.ok) return malformedOutcome();
    if (
      !sameStrings(components.value, expectedAffected.components) ||
      !sameStrings(relationships.value, expectedAffected.relationships)
    ) {
      return malformedOutcome();
    }

    const revisionEntries = denseArray(
      envelope.value.revisions,
      "Committed revisions",
      maximumCanonicalResourceCount(bounds),
      isProxy,
    );
    if (!revisionEntries.ok || revisionEntries.value.length !== resourceOwners.size) {
      return malformedOutcome();
    }
    const revisions = [];
    const received = new Set<ResourceKey>();
    for (let index = 0; index < revisionEntries.value.length; index += 1) {
      const entry = inspectExactRecord(
        revisionEntries.value[index],
        [["resource", "revision"]],
        "invalid-transaction-outcome",
        "Committed revision",
      );
      if (!entry.ok) return malformedOutcome();
      const resource = parseResourceKey(entry.value.resource);
      const revision =
        entry.value.revision === null ? success(null) : parseContentRevision(entry.value.revision);
      if (!resource.ok || !revision.ok || received.has(resource.value)) return malformedOutcome();
      const componentId = resourceOwners.get(resource.value);
      if (componentId === undefined) return malformedOutcome();
      received.add(resource.value);
      if (componentId !== null) {
        revisions.push(Object.freeze({ componentId, revision: revision.value }));
      }
    }
    revisions.sort((left, right) => compareText(left.componentId, right.componentId));
    return Object.freeze({
      affected: Object.freeze({
        components: expectedAffected.components,
        relationships: expectedAffected.relationships,
      }),
      generation: generation.value,
      revisions: Object.freeze(revisions),
      status: "committed" as const,
      value,
    });
  }

  if (!("diagnostics" in envelope.value)) return malformedOutcome();
  const category: DiagnosticCategory =
    envelope.value.status === "conflict"
      ? "conflict"
      : envelope.value.status === "provider-failure"
        ? "provider"
        : envelope.value.status === "indeterminate"
          ? "indeterminate"
          : "validation";
  const diagnostics = applicationDiagnostics(envelope.value.diagnostics, category, bounds, isProxy);
  if (!diagnostics.ok) return malformedOutcome();
  if (envelope.value.status === "conflict" || envelope.value.status === "validation-rejected") {
    return Object.freeze({ diagnostics: diagnostics.value, status: envelope.value.status });
  }
  if (envelope.value.status === "provider-failure") {
    if (envelope.value.committed !== false) return malformedOutcome();
    const phase = envelope.value.phase;
    if (phase !== "commit" && phase !== "prepare" && phase !== "recovery" && phase !== "snapshot") {
      return malformedOutcome();
    }
    return Object.freeze({ diagnostics: diagnostics.value, phase, status: "provider-failure" });
  }
  if (envelope.value.status === "indeterminate") {
    if (!("recovery" in envelope.value)) return malformedOutcome();
    const recovery = inspectExactRecord(
      envelope.value.recovery,
      [["baseGeneration", "generation", "resources", "token"]],
      "invalid-transaction-outcome",
      "Transaction recovery state",
    );
    if (
      !recovery.ok ||
      typeof recovery.value.token !== "string" ||
      recovery.value.token.length === 0
    ) {
      return malformedOutcome();
    }
    const baseGeneration = parseGraphGeneration(recovery.value.baseGeneration);
    const recoveryGeneration = parseGraphGeneration(recovery.value.generation);
    const recoveryResources = denseArray(
      recovery.value.resources,
      "Transaction recovery resources",
      maximumCanonicalResourceCount(bounds),
      isProxy,
    );
    if (!baseGeneration.ok || !recoveryGeneration.ok || !recoveryResources.ok) {
      return malformedOutcome();
    }
    for (let index = 0; index < recoveryResources.value.length; index += 1) {
      if (!parseResourceKey(recoveryResources.value[index]).ok) return malformedOutcome();
    }
    return Object.freeze({ diagnostics: diagnostics.value, status: "indeterminate" });
  }
  return malformedOutcome();
}

async function executeMutation<T>(
  request: TransactionRequest,
  resourceOwners: ReadonlyMap<ResourceKey, string | null>,
  value: T,
  options: ApplicationOperationsContext,
): Promise<ApplicationMutationOutcome<T>> {
  const expectedComponents = stringIdentities(
    request.affected.entities,
    "component",
    options.bounds.maxComponents,
  );
  const expectedRelationships = stringIdentities(
    request.affected.relations,
    "relationship",
    options.bounds.maxRelationships,
  );
  if (!expectedComponents.ok || !expectedRelationships.ok) return malformedOutcome();
  const expectedAffected = Object.freeze({
    components: expectedComponents.value,
    relationships: expectedRelationships.value,
  });
  let outcome: unknown;
  try {
    const invoked = intrinsicReflectApply(
      options.calls.execute,
      options.calls.transactionExecution,
      [request],
    );
    const settled = await settleApplicationCapabilityValue(invoked, options.isProxy);
    if (settled.status !== "fulfilled") throw new Error("transaction execution rejected");
    outcome = settled.value;
  } catch {
    return Object.freeze({
      diagnostics: Object.freeze([
        Object.freeze({
          code: "transaction-execution-failed",
          message: "Transaction execution failed with an unknown commit state",
        }),
      ]),
      status: "indeterminate" as const,
    });
  }
  try {
    return mapTransactionOutcome(
      outcome,
      resourceOwners,
      expectedAffected,
      value,
      options.bounds,
      options.isProxy,
    );
  } catch {
    return malformedOutcome();
  }
}

function relationshipInput(
  value: unknown,
  source: EntityId,
  graph: GraphSnapshot,
  state: LoadedState,
  options: ApplicationOperationsContext,
): Result<PlannedRelationship> {
  const copied = copyGraphPayload(value, "relation");
  if (!copied.ok) return copied;
  if (typeof copied.value !== "object" || copied.value === null || Array.isArray(copied.value)) {
    return failure(
      diagnostic("invalid-relationship-input", "Component relationship must be a plain record"),
    );
  }
  const record = copied.value as GraphDataRecord;
  const keys = Object.keys(record);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    if (
      key !== "description" &&
      key !== "id" &&
      key !== "target" &&
      key !== "type" &&
      !extensionKeyPattern.test(key)
    ) {
      return failure(
        diagnostic(
          "unknown-relationship-field",
          "Relationship fields must be standard fields or namespaced extensions",
        ),
      );
    }
  }
  if (typeof record.target !== "string") {
    return failure(
      diagnostic("invalid-entity-id", "Relationship target must be a stable identity"),
    );
  }
  const target = parseEntityId(record.target);
  if (!target.ok) return target;
  const resolvedTarget = options.graph.resolveEntity(graph, {
    expectedKind: STANDARD_COMPONENT_KIND,
    id: target.value,
  });
  if (!resolvedTarget.ok) return resolvedTarget;
  if (typeof record.type !== "string" || !relationTypePattern.test(record.type)) {
    return failure(
      diagnostic("invalid-relation-type", "Relationship type must be a lowercase graph token"),
    );
  }
  if (record.description !== undefined && typeof record.description !== "string") {
    return failure(
      diagnostic("invalid-relationship-description", "Relationship description must be a string"),
    );
  }
  const payload: Record<string, GraphData> = {};
  for (const key of keys.sort(compareText)) {
    if (key === "id" || key === "target" || key === "type") continue;
    payload[key] = record[key]!;
  }

  const existing =
    typeof record.id === "string"
      ? state.relationships.find((relationship) => relationship.id === record.id)
      : undefined;
  let relation: GraphRelation;
  let nextGraph = graph;
  if (existing !== undefined) {
    if (existing.source !== source) {
      return failure(
        diagnostic(
          "relationship-id-hijack",
          "An existing relationship identity belongs to a different source component",
        ),
      );
    }
    const id = parseRelationId(record.id as string);
    if (!id.ok) return id;
    relation = Object.freeze({
      id: id.value,
      payload,
      source,
      target: resolvedTarget.value.id,
      type: record.type,
    });
  } else {
    if (record.id !== undefined && typeof record.id !== "string") {
      return failure(
        diagnostic("invalid-relation-id", "Relationship identity must be a string when supplied"),
      );
    }
    const added = options.graph.addRelation(graph, {
      ...(record.id === undefined ? {} : { id: record.id as string }),
      payload,
      source: { expectedKind: STANDARD_COMPONENT_KIND, id: source },
      target: { expectedKind: STANDARD_COMPONENT_KIND, id: target.value },
      type: record.type,
    });
    if (!added.ok) return added;
    relation = added.value.relation;
    nextGraph = added.value.snapshot;
  }
  const viewed = options.snapshotStateDecoder.canonicalizeRelationships(Object.freeze([relation]));
  if (!viewed.ok) return viewed;
  return success(Object.freeze({ graph: nextGraph, view: viewed.value[0]! }));
}

function relationshipMutation(relationship: StandardRelationship): GraphDataRecord {
  const payload: Record<string, GraphData> = {};
  if (relationship.description !== undefined) payload.description = relationship.description;
  for (const key of Object.keys(relationship.extensions).sort(compareText)) {
    payload[key] = relationship.extensions[key]!;
  }
  return Object.freeze({
    relationship: Object.freeze({
      id: relationship.id,
      payload: Object.freeze(payload),
      source: relationship.source,
      target: relationship.target,
      type: relationship.type,
    }),
    type: "upsert",
  });
}

function planRelationshipChanges(
  value: ComponentRelationshipChanges | undefined,
  source: EntityId,
  state: LoadedState,
  options: ApplicationOperationsContext,
): Result<PlannedRelationshipChanges> {
  if (value === undefined) {
    return success(Object.freeze({ affected: Object.freeze([]), mutations: Object.freeze([]) }));
  }
  const envelope = exactRequest(
    value,
    [[], ["remove"], ["upsert"], ["remove", "upsert"]],
    "Relationship changes",
  );
  if (!envelope.ok) return envelope;
  const removals =
    "remove" in envelope.value
      ? denseArray(
          envelope.value.remove,
          "Relationship removals",
          options.bounds.maxRelationshipMutations,
        )
      : success(Object.freeze([]));
  if (!removals.ok) return removals;
  const upserts =
    "upsert" in envelope.value
      ? denseArray(
          envelope.value.upsert,
          "Relationship upserts",
          options.bounds.maxRelationshipMutations,
        )
      : success(Object.freeze([]));
  if (!upserts.ok) return upserts;
  if (removals.value.length + upserts.value.length > options.bounds.maxRelationshipMutations) {
    return failure(
      diagnostic(
        "application-bound-exceeded",
        "Relationship changes exceed the configured mutation count",
      ),
    );
  }
  const mutations: GraphDataRecord[] = [];
  const targeted = new Set<string>();
  if (removals.value.length > 0) {
    for (let index = 0; index < removals.value.length; index += 1) {
      const candidate = removals.value[index];
      if (typeof candidate !== "string") {
        return failure(
          diagnostic("invalid-relation-id", "Relationship removal requires a stable identity"),
        );
      }
      const id = parseRelationId(candidate);
      if (!id.ok) return id;
      if (targeted.has(id.value)) {
        return failure(
          diagnostic("ambiguous-relationship-mutation", "Relationship is targeted more than once"),
        );
      }
      const existing = state.relationships.find((relationship) => relationship.id === id.value);
      if (existing === undefined) {
        return failure(
          diagnostic("unknown-relationship", "Relationship removal target does not exist"),
        );
      }
      if (existing.source !== source) {
        return failure(
          diagnostic(
            "relationship-id-hijack",
            "Only the source component may remove an outgoing relationship",
          ),
        );
      }
      targeted.add(id.value);
      mutations.push(Object.freeze({ id: id.value, type: "remove" }));
    }
  }
  let graph = state.graph;
  if (upserts.value.length > 0) {
    for (let index = 0; index < upserts.value.length; index += 1) {
      const planned = relationshipInput(upserts.value[index], source, graph, state, options);
      if (!planned.ok) return planned;
      if (targeted.has(planned.value.view.id)) {
        return failure(
          diagnostic("ambiguous-relationship-mutation", "Relationship is targeted more than once"),
        );
      }
      targeted.add(planned.value.view.id);
      graph = planned.value.graph;
      mutations.push(relationshipMutation(planned.value.view));
    }
  }
  mutations.sort((left, right) => {
    const leftId =
      "id" in left ? String(left.id) : String((left.relationship as GraphDataRecord).id);
    const rightId =
      "id" in right ? String(right.id) : String((right.relationship as GraphDataRecord).id);
    return compareText(leftId, rightId);
  });
  return success(
    Object.freeze({
      affected: Object.freeze(Array.from(targeted).sort(compareText)),
      mutations: Object.freeze(mutations),
    }),
  );
}

const graphQueryDiagnosticMessages = Object.freeze({
  "continuation-cursor-too-large": "The continuation cursor exceeds the supported size budget",
  "cursor-anchor-mismatch": "The continuation cursor anchor is absent from this result set",
  "cursor-query-mismatch": "The continuation cursor belongs to a different query",
  "entity-scan-bound-exceeded": "The bounded entity query exceeded its work budget",
  "graph-query-unavailable": "The bounded graph query engine is unavailable",
  "invalid-entity-kind": "The component kind filter is malformed",
  "invalid-page-limit": "The bounded graph query page limit is invalid",
  "invalid-relation-type": "The relationship type filter is malformed",
  "invalid-search-text": "The component search text is invalid",
  "invalid-traversal-depth": "The relationship traversal depth is invalid",
  "malformed-continuation-cursor": "The continuation cursor is malformed",
  "query-context-too-large": "The bounded graph query context exceeds its size budget",
  "stale-cursor": "The continuation cursor belongs to a different graph generation",
  "traversal-entity-bound-exceeded": "The relationship traversal exceeded its entity budget",
  "traversal-relation-bound-exceeded":
    "The relationship traversal exceeded its emitted-relationship budget",
  "traversal-relation-visit-bound-exceeded":
    "The relationship traversal exceeded its examined-relationship budget",
  "unknown-entity": "No component exists for the stable identity or alias",
  "unsupported-continuation-cursor": "The continuation cursor version is not supported",
} as const);

function graphQueryUnavailable<T>(): Result<T> {
  return frozenFailure(
    diagnostic("graph-query-unavailable", graphQueryDiagnosticMessages["graph-query-unavailable"]),
  );
}

type BlueprintExportPageBound = "depth" | "relationships" | "structural-values" | "utf8-bytes";

function blueprintExportPageBoundExceeded<T>(
  bound: BlueprintExportPageBound,
  maximum: number,
): Result<T> {
  return frozenFailure(
    Object.freeze({
      code: "blueprint-export-page-bound-exceeded",
      details: Object.freeze({ bound, maximum }),
      message:
        "The blueprint export page exceeds local aggregate bounds; retry with a smaller --limit. If --limit 1 fails, one export item exceeds the local export bounds",
    }),
  );
}

type BlueprintPageBoundOperation = "export" | "search" | "traverse";
type BlueprintFinalPageBound = "depth" | "utf8-bytes";

function blueprintFinalPageBoundExceeded<T>(
  operation: BlueprintPageBoundOperation,
  bound: BlueprintFinalPageBound,
  maximum: number,
): Result<T> {
  if (operation === "export") {
    return blueprintExportPageBoundExceeded(bound, maximum);
  }
  const noun = operation === "search" ? "component" : "traversal hit";
  const capacity = bound === "depth" ? "canonical-JSON depth" : "UTF-8 byte";
  return frozenFailure(
    Object.freeze({
      code:
        operation === "search"
          ? "blueprint-search-page-bound-exceeded"
          : "blueprint-traverse-page-bound-exceeded",
      details: Object.freeze({ bound, maximum }),
      message: `The blueprint ${operation} page exceeds the local ${capacity} bound; retry with a smaller --limit. If --limit 1 fails, one ${noun} exceeds the local page bound`,
    }),
  );
}

function boundedBlueprintPage<T>(
  page: T,
  operation: BlueprintPageBoundOperation,
  options: ApplicationOperationsContext,
): Result<T> {
  const measured = measureCanonicalJsonUtf8Bytes(page, {
    isProxy: options.isProxy,
    maximumBytes: options.bounds.maxBlueprintPageBytes,
    maximumDepth: options.bounds.maxBlueprintPageDepth,
  });
  if (measured.status === "accepted") return success(page);
  if (measured.status === "bound-exceeded") {
    return blueprintFinalPageBoundExceeded(
      operation,
      "utf8-bytes",
      options.bounds.maxBlueprintPageBytes,
    );
  }
  return measured.status === "depth-exceeded"
    ? blueprintFinalPageBoundExceeded(operation, "depth", options.bounds.maxBlueprintPageDepth)
    : graphQueryUnavailable();
}

type GraphQueryInvocationOperation = "export" | "identity" | "search" | "traverse";

interface GraphQueryDiagnosticScope {
  readonly hasCursor: boolean;
  readonly operation: GraphQueryInvocationOperation;
}

function graphQueryDiagnosticAllowed(code: string, scope: GraphQueryDiagnosticScope): boolean {
  if (scope.operation === "identity") return code === "graph-query-unavailable";
  if (
    code === "graph-query-unavailable" ||
    code === "invalid-page-limit" ||
    code === "query-context-too-large" ||
    code === "continuation-cursor-too-large"
  ) {
    return true;
  }
  if (
    scope.hasCursor &&
    (code === "cursor-anchor-mismatch" ||
      code === "cursor-query-mismatch" ||
      code === "malformed-continuation-cursor" ||
      code === "stale-cursor" ||
      code === "unsupported-continuation-cursor")
  ) {
    return true;
  }
  if (scope.operation === "export") {
    return code === "entity-scan-bound-exceeded" || code === "invalid-entity-kind";
  }
  if (scope.operation === "search") {
    return (
      code === "entity-scan-bound-exceeded" ||
      code === "invalid-entity-kind" ||
      code === "invalid-search-text"
    );
  }
  return (
    code === "invalid-relation-type" ||
    code === "invalid-traversal-depth" ||
    code === "traversal-entity-bound-exceeded" ||
    code === "traversal-relation-bound-exceeded" ||
    code === "traversal-relation-visit-bound-exceeded" ||
    code === "unknown-entity"
  );
}

function invalidSearchTextDiagnosticDetails(
  source: unknown,
  isProxy: (value: unknown) => boolean,
): Result<Readonly<Record<string, string | number | boolean>> | undefined> {
  if (source === undefined) return success(undefined);
  try {
    if (typeof source === "object" && source !== null && isProxy(source)) {
      return graphQueryUnavailable();
    }
  } catch {
    return graphQueryUnavailable();
  }
  const inspected = inspectExactRecord(
    source,
    [["maximumCharacters"], ["maximumTerms"]],
    "graph-query-unavailable",
    "Invalid search text diagnostic details",
  );
  if (!inspected.ok) return graphQueryUnavailable();
  const key = Object.hasOwn(inspected.value, "maximumCharacters")
    ? "maximumCharacters"
    : "maximumTerms";
  const maximum = inspected.value[key];
  if (typeof maximum !== "number" || !Number.isSafeInteger(maximum) || maximum <= 0) {
    return graphQueryUnavailable();
  }
  return success(Object.freeze({ [key]: maximum }));
}

function invalidTraversalDepthDiagnosticDetails(
  source: unknown,
  isProxy: (value: unknown) => boolean,
): Result<Readonly<Record<string, string | number | boolean>> | undefined> {
  if (source === undefined) return success(undefined);
  try {
    if (typeof source === "object" && source !== null && isProxy(source)) {
      return graphQueryUnavailable();
    }
  } catch {
    return graphQueryUnavailable();
  }
  const inspected = inspectExactRecord(
    source,
    [["maximumDepth"]],
    "graph-query-unavailable",
    "Invalid traversal depth diagnostic details",
  );
  if (!inspected.ok) return graphQueryUnavailable();
  const maximumDepth = inspected.value.maximumDepth;
  if (
    typeof maximumDepth !== "number" ||
    !Number.isSafeInteger(maximumDepth) ||
    maximumDepth <= 0
  ) {
    return graphQueryUnavailable();
  }
  return success(Object.freeze({ maximumDepth }));
}

function graphQueryFailureDiagnostics(
  value: unknown,
  scope: GraphQueryDiagnosticScope,
  options: ApplicationOperationsContext,
): Result<readonly Diagnostic[]> {
  const entries = denseArray(
    value,
    "Graph query diagnostics",
    options.bounds.maxDiagnosticCount,
    options.isProxy,
  );
  if (!entries.ok || entries.value.length === 0) return graphQueryUnavailable();
  const copied: Diagnostic[] = [];
  for (let index = 0; index < entries.value.length; index += 1) {
    const entry = inspectExactRecord(
      entries.value[index],
      [
        ["code", "message"],
        ["code", "details", "message"],
      ],
      "graph-query-unavailable",
      "Graph query diagnostic",
    );
    if (
      !entry.ok ||
      typeof entry.value.code !== "string" ||
      typeof entry.value.message !== "string" ||
      entry.value.message.length === 0 ||
      entry.value.message.length > 4_096
    ) {
      return graphQueryUnavailable();
    }
    const code = entry.value.code;
    if (
      !Object.hasOwn(graphQueryDiagnosticMessages, code) ||
      !graphQueryDiagnosticAllowed(code, scope)
    ) {
      return graphQueryUnavailable();
    }
    const details =
      code === "invalid-search-text"
        ? invalidSearchTextDiagnosticDetails(entry.value.details, options.isProxy)
        : code === "invalid-traversal-depth"
          ? invalidTraversalDepthDiagnosticDetails(entry.value.details, options.isProxy)
          : safeDiagnosticDetails(entry.value.details, options.isProxy);
    if (!details.ok) return graphQueryUnavailable();
    copied[index] = Object.freeze({
      code,
      ...(details.value === undefined || code === "graph-query-unavailable"
        ? {}
        : { details: details.value }),
      message: graphQueryDiagnosticMessages[code as keyof typeof graphQueryDiagnosticMessages],
    });
  }
  return success(Object.freeze(copied));
}

async function invokeGraphQueryCapability(
  method: CallableFunction,
  args: readonly unknown[],
  scope: GraphQueryDiagnosticScope,
  options: ApplicationOperationsContext,
): Promise<Result<unknown>> {
  let invoked: unknown;
  try {
    invoked = intrinsicReflectApply(method, options.calls.graphQueries, args);
  } catch {
    return graphQueryUnavailable();
  }
  const settled = await settleApplicationCapabilityValue(invoked, options.isProxy);
  if (settled.status !== "fulfilled") return graphQueryUnavailable();
  const contained = containApplicationCapabilityValue(settled.value, options, 12);
  if (!contained.ok) return graphQueryUnavailable();
  const envelope = inspectExactRecord(
    contained.value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "graph-query-unavailable",
    "Graph query result",
  );
  if (!envelope.ok) return graphQueryUnavailable();
  if (envelope.value.ok === false) {
    const diagnostics = graphQueryFailureDiagnostics(envelope.value.diagnostics, scope, options);
    return diagnostics.ok ? frozenFailure(...diagnostics.value) : diagnostics;
  }
  return envelope.value.ok === true ? success(envelope.value.value) : graphQueryUnavailable();
}

function canonicalGraphQueryIdentity(value: unknown): Result<ProjectionReadIdentity> {
  const identity = inspectExactRecord(
    value,
    [["fingerprint", "generation"]],
    "graph-query-unavailable",
    "Graph query identity",
  );
  if (!identity.ok) return graphQueryUnavailable();
  const generation = parseGraphGeneration(identity.value.generation);
  const fingerprint = parseProjectionCanonicalFingerprint(identity.value.fingerprint);
  return generation.ok && fingerprint.ok
    ? success(
        Object.freeze({
          fingerprint: fingerprint.value,
          generation: generation.value,
        }),
      )
    : graphQueryUnavailable();
}

async function projectedGraphQueryIdentity(
  options: ApplicationOperationsContext,
): Promise<Result<ProjectionReadIdentity>> {
  const invoked = await invokeGraphQueryCapability(
    options.calls.graphQueryIdentity,
    [],
    Object.freeze({ hasCursor: false, operation: "identity" }),
    options,
  );
  return invoked.ok ? canonicalGraphQueryIdentity(invoked.value) : invoked;
}

function graphPageRequest(
  value: unknown,
  subject: string,
  maximumLimit: number,
  options: ApplicationOperationsContext,
): Result<BoundedPageRequest> {
  const request = boundedRequest(value, subject);
  if (!request.ok) return request;
  if (
    !Number.isSafeInteger(request.value.limit) ||
    request.value.limit <= 0 ||
    request.value.limit > maximumLimit
  ) {
    return failure(
      diagnostic(
        "invalid-page-limit",
        "The graph query page limit is outside the application bound",
      ),
    );
  }
  if (
    request.value.cursor !== undefined &&
    (typeof request.value.cursor !== "string" ||
      request.value.cursor.length === 0 ||
      request.value.cursor.length > APPLICATION_MAX_GRAPH_QUERY_CURSOR_CHARACTERS)
  ) {
    return failure(
      diagnostic("malformed-continuation-cursor", "The continuation cursor is malformed"),
    );
  }
  return request;
}

interface ValidatedGraphQueryPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly unknown[];
  readonly nextCursor?: ContinuationCursor;
}

function validatedGraphQueryPage(
  value: unknown,
  request: BoundedPageRequest,
  maximumItems: number,
  options: ApplicationOperationsContext,
): Result<ValidatedGraphQueryPage> {
  const page = inspectExactRecord(
    value,
    [
      ["generation", "hasMore", "items"],
      ["generation", "hasMore", "items", "nextCursor"],
    ],
    "graph-query-unavailable",
    "Graph query page",
  );
  if (!page.ok || typeof page.value.hasMore !== "boolean") return graphQueryUnavailable();
  const generation = parseGraphGeneration(page.value.generation);
  const items = denseArray(
    page.value.items,
    "Graph query page items",
    Math.min(request.limit, maximumItems),
    options.isProxy,
  );
  const hasCursor = Object.hasOwn(page.value, "nextCursor");
  if (
    !generation.ok ||
    !items.ok ||
    hasCursor !== page.value.hasMore ||
    (page.value.hasMore && items.value.length === 0) ||
    (request.cursor !== undefined && page.value.nextCursor === request.cursor)
  ) {
    return graphQueryUnavailable();
  }
  if (
    hasCursor &&
    (typeof page.value.nextCursor !== "string" ||
      page.value.nextCursor.length === 0 ||
      page.value.nextCursor.length > APPLICATION_MAX_GRAPH_QUERY_CURSOR_CHARACTERS)
  ) {
    return graphQueryUnavailable();
  }
  return success(
    Object.freeze({
      generation: generation.value,
      hasMore: page.value.hasMore,
      items: items.value,
      ...(hasCursor ? { nextCursor: page.value.nextCursor as ContinuationCursor } : {}),
    }),
  );
}

type BlueprintStructuralConsumption = "accepted" | "bound-exceeded" | "invalid";

function consumeBlueprintStructuralValues(
  value: unknown,
  remaining: { value: number },
  options: ApplicationOperationsContext,
): BlueprintStructuralConsumption {
  const active = new WeakSet<object>();
  const visit = (candidate: unknown, depth: number): BlueprintStructuralConsumption => {
    if (depth > options.bounds.maxSnapshotStateDepth) return "invalid";
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "boolean" ||
      (typeof candidate === "number" && Number.isFinite(candidate))
    ) {
      if (remaining.value < 1) return "bound-exceeded";
      remaining.value -= 1;
      return "accepted";
    }
    if (typeof candidate !== "object" || options.isProxy(candidate) || active.has(candidate)) {
      return "invalid";
    }
    try {
      if (Array.isArray(candidate)) {
        if (intrinsicObjectGetPrototypeOf(candidate) !== Array.prototype) return "invalid";
        const length = inspectIntrinsicArrayLength(
          candidate,
          "graph-query-unavailable",
          "Blueprint aggregate array",
        );
        if (!length.ok) return "invalid";
        const keys = Reflect.ownKeys(candidate);
        if (keys.length !== length.value + 1) return "invalid";
        const descriptors = new Array<PropertyDescriptor>(length.value);
        for (let index = 0; index < length.value; index += 1) {
          const descriptor = intrinsicObjectGetOwnPropertyDescriptor(candidate, String(index));
          if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
            return "invalid";
          }
          descriptors[index] = descriptor;
        }
        if (remaining.value < 1) return "bound-exceeded";
        remaining.value -= 1;
        if (length.value > remaining.value) return "bound-exceeded";
        active.add(candidate);
        for (let index = 0; index < descriptors.length; index += 1) {
          const consumed = visit(descriptors[index]!.value, depth + 1);
          if (consumed !== "accepted") return consumed;
        }
        return "accepted";
      }
      const prototype = intrinsicObjectGetPrototypeOf(candidate);
      if (prototype !== Object.prototype && prototype !== null) return "invalid";
      const keys = Reflect.ownKeys(candidate);
      const descriptors = new Array<PropertyDescriptor>(keys.length);
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index]!;
        const descriptor = intrinsicObjectGetOwnPropertyDescriptor(candidate, key);
        if (
          typeof key !== "string" ||
          descriptor === undefined ||
          !("value" in descriptor) ||
          !descriptor.enumerable
        ) {
          return "invalid";
        }
        descriptors[index] = descriptor;
      }
      if (remaining.value < 1) return "bound-exceeded";
      remaining.value -= 1;
      if (keys.length > remaining.value) return "bound-exceeded";
      active.add(candidate);
      for (let index = 0; index < descriptors.length; index += 1) {
        const consumed = visit(descriptors[index]!.value, depth + 1);
        if (consumed !== "accepted") return consumed;
      }
      return "accepted";
    } catch {
      return "invalid";
    } finally {
      active.delete(candidate);
    }
  };
  try {
    return visit(value, 1);
  } catch {
    return "invalid";
  }
}

function canonicalGraphComponent(
  value: unknown,
  options: ApplicationOperationsContext,
): Result<StandardComponent> {
  const entity = inspectExactRecord(
    value,
    [["id", "kind", "payload"]],
    "graph-query-unavailable",
    "Projected component entity",
  );
  if (
    !entity.ok ||
    typeof entity.value.id !== "string" ||
    entity.value.kind !== STANDARD_COMPONENT_KIND
  ) {
    return graphQueryUnavailable();
  }
  const id = parseEntityId(entity.value.id);
  if (!id.ok) return graphQueryUnavailable();
  const canonical = options.snapshotStateDecoder.canonicalizeEntity(entity.value, {
    id: id.value,
    kind: STANDARD_COMPONENT_KIND,
  });
  return canonical.ok ? success(canonical.value.component) : graphQueryUnavailable();
}

function canonicalExactGraphComponent(
  value: unknown,
  options: ApplicationOperationsContext,
): Result<{ readonly component: StandardComponent; readonly generation: GraphGeneration }> {
  const exact = inspectExactRecord(
    value,
    [["generation", "item"]],
    "graph-query-unavailable",
    "Exact projected component",
  );
  if (!exact.ok) return graphQueryUnavailable();
  const generation = parseGraphGeneration(exact.value.generation);
  const component = canonicalGraphComponent(exact.value.item, options);
  return generation.ok && component.ok
    ? success(Object.freeze({ component: component.value, generation: generation.value }))
    : graphQueryUnavailable();
}

function canonicalGraphRelationship(
  value: unknown,
  options: ApplicationOperationsContext,
): Result<StandardRelationship> {
  const relation = inspectExactRecord(
    value,
    [["id", "payload", "source", "target", "type"]],
    "graph-query-unavailable",
    "Projected component relationship",
  );
  if (
    !relation.ok ||
    typeof relation.value.id !== "string" ||
    typeof relation.value.source !== "string" ||
    typeof relation.value.target !== "string" ||
    typeof relation.value.type !== "string"
  ) {
    return graphQueryUnavailable();
  }
  const id = parseRelationId(relation.value.id);
  const source = parseEntityId(relation.value.source);
  const target = parseEntityId(relation.value.target);
  if (!id.ok || !source.ok || !target.ok || !relationTypePattern.test(relation.value.type)) {
    return graphQueryUnavailable();
  }
  const canonical = options.snapshotStateDecoder.canonicalizeRelationships(
    Object.freeze([
      Object.freeze({
        id: id.value,
        payload: relation.value.payload as GraphData,
        source: source.value,
        target: target.value,
        type: relation.value.type,
      }),
    ]),
  );
  return canonical.ok && canonical.value.length === 1
    ? success(canonical.value[0]!)
    : graphQueryUnavailable();
}

async function projectedComponentPage(
  identity: ProjectionReadIdentity,
  method:
    | ApplicationOperationsOptions["graphQueries"]["pageEntities"]
    | ApplicationOperationsOptions["graphQueries"]["searchEntities"],
  query: GraphEntityQuery | GraphSearchQuery,
  request: BoundedPageRequest,
  operation: "export" | "search",
  options: ApplicationOperationsContext,
): Promise<Result<BlueprintComponentPage>> {
  const invoked = await invokeGraphQueryCapability(
    method,
    [identity, query, request],
    Object.freeze({ hasCursor: request.cursor !== undefined, operation }),
    options,
  );
  if (!invoked.ok) return invoked;
  const page = validatedGraphQueryPage(
    invoked.value,
    request,
    options.bounds.maxComponents,
    options,
  );
  if (!page.ok) return page;
  if (page.value.generation !== identity.generation) return graphQueryUnavailable();
  const items: StandardComponent[] = [];
  let previous: string | undefined;
  for (let index = 0; index < page.value.items.length; index += 1) {
    const component = canonicalGraphComponent(page.value.items[index], options);
    if (!component.ok || (previous !== undefined && previous >= component.value.id)) {
      return graphQueryUnavailable();
    }
    previous = component.value.id;
    items[index] = component.value;
  }
  return success(
    Object.freeze({
      generation: page.value.generation,
      hasMore: page.value.hasMore,
      items: Object.freeze(items),
      ...(page.value.nextCursor === undefined ? {} : { nextCursor: page.value.nextCursor }),
    }),
  );
}

async function projectedTraversalPage(
  identity: ProjectionReadIdentity,
  query: GraphTraversalQuery,
  request: BoundedPageRequest,
  options: ApplicationOperationsContext,
  expectedRoot?: string,
): Promise<Result<BlueprintTraversalPage>> {
  const invoked = await invokeGraphQueryCapability(
    options.calls.traverseGraphRelations,
    [identity, query, request],
    Object.freeze({ hasCursor: request.cursor !== undefined, operation: "traverse" }),
    options,
  );
  if (!invoked.ok) return invoked;
  const page = validatedGraphQueryPage(
    invoked.value,
    request,
    options.bounds.maxRelationships,
    options,
  );
  if (!page.ok || page.value.generation !== identity.generation) {
    return graphQueryUnavailable();
  }
  let canonicalRoot = expectedRoot;
  if (canonicalRoot === undefined) {
    const invokedRoot = await invokeGraphQueryCapability(
      options.calls.exactGraphEntity,
      [identity, query.entity],
      Object.freeze({ hasCursor: false, operation: "traverse" }),
      options,
    );
    if (!invokedRoot.ok) return invokedRoot;
    const root = canonicalExactGraphComponent(invokedRoot.value, options);
    if (
      !root.ok ||
      root.value.generation !== identity.generation ||
      root.value.generation !== page.value.generation
    ) {
      return graphQueryUnavailable();
    }
    canonicalRoot = root.value.component.id;
  }
  const items: BlueprintTraversalHit[] = [];
  const relations = new Set<string>();
  const validateFrontier = request.cursor === undefined;
  const visitedEntities = new Set<string>(canonicalRoot === undefined ? [] : [canonicalRoot]);
  let frontier = new Set<string>(canonicalRoot === undefined ? [] : [canonicalRoot]);
  let nextFrontier = new Set<string>();
  let previousDepth: number | undefined;
  let previousRelation: string | undefined;
  for (let index = 0; index < page.value.items.length; index += 1) {
    const hit = inspectExactRecord(
      page.value.items[index],
      [["depth", "direction", "entity", "from", "relation"]],
      "graph-query-unavailable",
      "Graph traversal hit",
    );
    if (
      !hit.ok ||
      typeof hit.value.depth !== "number" ||
      !Number.isSafeInteger(hit.value.depth) ||
      hit.value.depth <= 0 ||
      hit.value.depth > query.depth ||
      (hit.value.direction !== "incoming" && hit.value.direction !== "outgoing") ||
      (query.direction !== "both" && hit.value.direction !== query.direction) ||
      typeof hit.value.from !== "string" ||
      (index === 0 && request.cursor === undefined && hit.value.depth !== 1) ||
      (previousDepth !== undefined &&
        (hit.value.depth < previousDepth || hit.value.depth > previousDepth + 1))
    ) {
      return graphQueryUnavailable();
    }
    const from = parseEntityId(hit.value.from);
    const component = canonicalGraphComponent(hit.value.entity, options);
    const relationship = canonicalGraphRelationship(hit.value.relation, options);
    if (!from.ok || !component.ok || !relationship.ok) return graphQueryUnavailable();
    if (validateFrontier && previousDepth !== undefined && hit.value.depth > previousDepth) {
      frontier = nextFrontier;
      nextFrontier = new Set<string>();
    }
    if (
      (hit.value.depth === 1 && from.value !== canonicalRoot) ||
      (validateFrontier && !frontier.has(from.value)) ||
      (hit.value.depth === previousDepth &&
        previousRelation !== undefined &&
        previousRelation >= relationship.value.id) ||
      relations.has(relationship.value.id) ||
      (query.relationType !== undefined && relationship.value.type !== query.relationType)
    ) {
      return graphQueryUnavailable();
    }
    const expectedFrom =
      hit.value.direction === "incoming" ? relationship.value.target : relationship.value.source;
    const expectedNeighbor =
      hit.value.direction === "incoming" ? relationship.value.source : relationship.value.target;
    if (expectedFrom !== from.value || expectedNeighbor !== component.value.id) {
      return graphQueryUnavailable();
    }
    if (validateFrontier && !visitedEntities.has(component.value.id)) {
      visitedEntities.add(component.value.id);
      nextFrontier.add(component.value.id);
    }
    relations.add(relationship.value.id);
    previousDepth = hit.value.depth;
    previousRelation = relationship.value.id;
    items[index] = Object.freeze({
      component: component.value,
      depth: hit.value.depth,
      direction: hit.value.direction,
      from: from.value,
      relationship: relationship.value,
    });
  }
  return success(
    Object.freeze({
      generation: page.value.generation,
      hasMore: page.value.hasMore,
      items: Object.freeze(items),
      ...(page.value.nextCursor === undefined ? {} : { nextCursor: page.value.nextCursor }),
    }),
  );
}

function standardTransactionRequest(
  componentMutations: readonly GraphDataRecord[],
  relationshipMutations: readonly GraphDataRecord[],
  affectedComponents: readonly string[],
  affectedRelationships: readonly string[],
  resource: ResourceKey,
  expectedRevision: ContentRevision | null,
  aliasMutations: readonly GraphDataRecord[] = Object.freeze([]),
  additionalExpectedRevisions: readonly {
    readonly expected: ContentRevision | null;
    readonly resource: ResourceKey;
  }[] = Object.freeze([]),
): TransactionRequest {
  return Object.freeze({
    affected: Object.freeze({
      entities: Object.freeze([...affectedComponents].sort(compareText)),
      relations: Object.freeze([...affectedRelationships].sort(compareText)),
    }),
    context: Object.freeze({
      ownership: Object.freeze({ owner: "groma.application", plane: "intent" }),
      pinnedComponentIds: Object.freeze([]),
    }),
    expectedRevisions: Object.freeze(
      [
        Object.freeze({ expected: expectedRevision, resource }),
        ...additionalExpectedRevisions,
      ].sort((left, right) => compareText(left.resource, right.resource)),
    ),
    mutation: Object.freeze({
      ...(aliasMutations.length === 0 ? {} : { aliases: Object.freeze(aliasMutations) }),
      components: Object.freeze(componentMutations),
      relationships: Object.freeze(relationshipMutations),
    }),
  });
}

function readableLabelDependents(
  state: LoadedState,
  target: EntityId,
  options: Pick<ApplicationOperationsContext, "graph">,
): Result<readonly EntityId[]> {
  const dependents = new Set<EntityId>();
  for (const component of state.components) {
    if (component.parent === undefined) continue;
    const parent = options.graph.resolveEntityIdentity(state.graph, component.parent);
    if (!parent.ok) return parent;
    if (parent.value.resolved === target && component.id !== target) dependents.add(component.id);
  }
  for (const relationship of state.relationships) {
    const resolvedTarget = options.graph.resolveEntityIdentity(state.graph, relationship.target);
    if (!resolvedTarget.ok) return resolvedTarget;
    if (resolvedTarget.value.resolved === target && relationship.source !== target) {
      dependents.add(relationship.source);
    }
  }
  return success(Object.freeze([...dependents].sort(compareText)));
}

export function createApplicationOperations(
  source: ApplicationOperationsOptions,
): ApplicationOperations {
  const captured = captureApplicationOperationsOptions(source);
  validatePositiveBound(
    captured.maxSnapshotAttempts,
    "maxSnapshotAttempts",
    absoluteBounds.maxSnapshotAttempts,
  );
  for (const name of [
    "maxBlueprintPageBytes",
    "maxBlueprintPageDepth",
    "maxComponents",
    "maxDiagnosticCount",
    "maxEmbeddedItems",
    "maxRelationshipMutations",
    "maxRelationships",
    "maxRequestDataDepth",
    "maxRequestDataValues",
    "maxSnapshotStateDepth",
    "maxSnapshotStateValues",
  ] as const) {
    validatePositiveBound(captured.bounds[name], name, absoluteBounds[name]);
  }
  const metadata = validateSnapshotStateDecoder(captured);
  const frozenOptions = freezeApplicationOperationsOptions(captured);
  validateBoundedQueryReceiver(frozenOptions.queries, metadata.isProxy);
  const graphQueryCalls = validateGraphQueryEngineReceiver(
    frozenOptions.graphQueries,
    metadata.isProxy,
    Math.max(absoluteBounds.maxComponents, absoluteBounds.maxRelationships),
  );
  const options: ApplicationOperationsContext = Object.freeze({
    ...frozenOptions,
    calls: captureApplicationCapabilityCalls(frozenOptions, graphQueryCalls),
    isProxy: metadata.isProxy,
  });

  const initialize = async (
    request: InitializeWorkspaceRequest,
  ): Promise<Result<WorkspaceInitializationOutcome>> => {
    const validated = exactRequest(request, [[]], "Workspace initialization request");
    if (!validated.ok) return validated;
    try {
      const invoked = intrinsicReflectApply(
        options.calls.initialize,
        options.calls.initialization,
        [],
      );
      const settled = await settleApplicationCapabilityValue(invoked, options.isProxy);
      if (settled.status !== "fulfilled") {
        return frozenFailure(
          diagnostic(
            "workspace-initialization-failed",
            "Workspace initialization capability failed",
          ),
        );
      }
      const raw = settled.value;
      const contained = containApplicationCapabilityValue(raw, options);
      return contained.ok
        ? validatedInitializationOutcome(contained.value, options.bounds, options.isProxy)
        : frozenFailure(
            diagnostic(
              "workspace-initialization-failed",
              "Workspace initialization capability failed",
            ),
          );
    } catch {
      return frozenFailure(
        diagnostic("workspace-initialization-failed", "Workspace initialization capability failed"),
      );
    }
  };

  const exportBlueprint = async (
    request: ExportBlueprintRequest,
  ): Promise<Result<BlueprintExportPage>> => {
    const page = graphPageRequest(
      request,
      "Blueprint export request",
      options.bounds.maxComponents,
      options,
    );
    if (!page.ok) return page;
    const identity = await projectedGraphQueryIdentity(options);
    if (!identity.ok) return identity;
    const components = await projectedComponentPage(
      identity.value,
      options.calls.pageGraphEntities,
      Object.freeze({ kind: STANDARD_COMPONENT_KIND }),
      page.value,
      "export",
      options,
    );
    if (!components.ok) return components;
    if (components.value.generation !== identity.value.generation) return graphQueryUnavailable();
    const observed = await snapshot(Object.freeze([]), options);
    if (!observed.ok) return readProviderFailure(observed.diagnostics);
    if (observed.value.generation !== components.value.generation) return graphQueryUnavailable();
    const cognitive = cognitiveComplexityEvidence(observed.value, components.value.items, options);
    const evidenceBound = evidenceBoundComponents(observed.value, components.value.items, options);
    const items: BlueprintExportItem[] = [];
    const exportedRelationshipIds = new Set<string>();
    const structuralRemaining = { value: options.bounds.maxSnapshotStateValues };
    const pageStructuralValues = components.value.nextCursor === undefined ? 4 : 5;
    if (structuralRemaining.value < pageStructuralValues) {
      return blueprintExportPageBoundExceeded(
        "structural-values",
        options.bounds.maxSnapshotStateValues,
      );
    }
    structuralRemaining.value -= pageStructuralValues;
    for (
      let componentIndex = 0;
      componentIndex < components.value.items.length;
      componentIndex += 1
    ) {
      const component = components.value.items[componentIndex]!;
      const measured = cognitive.get(component.id);
      const itemFields = measured === undefined ? 3 : 4;
      if (structuralRemaining.value < itemFields) {
        return blueprintExportPageBoundExceeded(
          "structural-values",
          options.bounds.maxSnapshotStateValues,
        );
      }
      structuralRemaining.value -= itemFields;
      const componentConsumption = consumeBlueprintStructuralValues(
        component,
        structuralRemaining,
        options,
      );
      if (componentConsumption !== "accepted") {
        return componentConsumption === "bound-exceeded"
          ? blueprintExportPageBoundExceeded(
              "structural-values",
              options.bounds.maxSnapshotStateValues,
            )
          : graphQueryUnavailable();
      }
      if (measured !== undefined) {
        const measuredConsumption = consumeBlueprintStructuralValues(
          measured,
          structuralRemaining,
          options,
        );
        if (measuredConsumption !== "accepted") {
          return measuredConsumption === "bound-exceeded"
            ? blueprintExportPageBoundExceeded(
                "structural-values",
                options.bounds.maxSnapshotStateValues,
              )
            : graphQueryUnavailable();
        }
      }
      const relationships: StandardRelationship[] = [];
      let traversalCursor: ContinuationCursor | undefined;
      let previousRelationship: string | undefined;
      do {
        const remaining = options.bounds.maxRelationships - exportedRelationshipIds.size;
        const traversalRequest = Object.freeze({
          ...(traversalCursor === undefined ? {} : { cursor: traversalCursor }),
          limit: remaining === 0 ? 1 : Math.min(options.calls.graphQueryMaxPageSize, remaining),
        });
        const traversal = await projectedTraversalPage(
          identity.value,
          Object.freeze({
            depth: 1,
            direction: "outgoing",
            entity: component.id,
          }),
          traversalRequest,
          options,
          component.id,
        );
        if (
          !traversal.ok ||
          traversal.value.generation !== identity.value.generation ||
          traversal.value.generation !== components.value.generation
        ) {
          return graphQueryUnavailable();
        }
        for (let hitIndex = 0; hitIndex < traversal.value.items.length; hitIndex += 1) {
          const relationship = traversal.value.items[hitIndex]!.relationship;
          if (
            (previousRelationship !== undefined && previousRelationship >= relationship.id) ||
            exportedRelationshipIds.has(relationship.id)
          ) {
            return graphQueryUnavailable();
          }
          if (exportedRelationshipIds.size >= options.bounds.maxRelationships) {
            return blueprintExportPageBoundExceeded(
              "relationships",
              options.bounds.maxRelationships,
            );
          }
          const relationshipConsumption = consumeBlueprintStructuralValues(
            relationship,
            structuralRemaining,
            options,
          );
          if (relationshipConsumption !== "accepted") {
            return relationshipConsumption === "bound-exceeded"
              ? blueprintExportPageBoundExceeded(
                  "structural-values",
                  options.bounds.maxSnapshotStateValues,
                )
              : graphQueryUnavailable();
          }
          previousRelationship = relationship.id;
          exportedRelationshipIds.add(relationship.id);
          relationships.push(relationship);
        }
        if (
          traversal.value.hasMore &&
          exportedRelationshipIds.size >= options.bounds.maxRelationships
        ) {
          return blueprintExportPageBoundExceeded("relationships", options.bounds.maxRelationships);
        }
        traversalCursor = traversal.value.nextCursor;
      } while (traversalCursor !== undefined);
      items[componentIndex] = Object.freeze({
        ...(measured === undefined ? {} : { cognitiveComplexity: measured }),
        component,
        evidenceBound: evidenceBound.has(component.id),
        relationships: Object.freeze(relationships),
      });
    }
    return boundedBlueprintPage(
      Object.freeze({
        generation: components.value.generation,
        hasMore: components.value.hasMore,
        items: Object.freeze(items),
        ...(components.value.nextCursor === undefined
          ? {}
          : { nextCursor: components.value.nextCursor }),
      }),
      "export",
      options,
    );
  };

  const searchBlueprint = async (
    request: SearchBlueprintRequest,
  ): Promise<Result<BlueprintSearchPage>> => {
    const inspected = exactRequest(
      request,
      [
        ["limit", "text"],
        ["cursor", "limit", "text"],
        ["limit", "scale", "text"],
        ["limit", "shared", "text"],
        ["cursor", "limit", "scale", "text"],
        ["cursor", "limit", "shared", "text"],
        ["limit", "scale", "shared", "text"],
        ["cursor", "limit", "scale", "shared", "text"],
      ],
      "Blueprint search request",
    );
    if (!inspected.ok) return inspected;
    if (
      typeof inspected.value.text !== "string" ||
      inspected.value.text.length === 0 ||
      inspected.value.text.length > 4_096
    ) {
      return failure(diagnostic("invalid-search-text", "Blueprint search text is malformed"));
    }
    const filters = filteredBoundedRequest(
      Object.freeze({
        ...(Object.hasOwn(inspected.value, "cursor")
          ? { cursor: inspected.value.cursor as string }
          : {}),
        limit: inspected.value.limit as number,
        ...(Object.hasOwn(inspected.value, "scale")
          ? { scale: inspected.value.scale as string }
          : {}),
        ...(Object.hasOwn(inspected.value, "shared")
          ? { shared: inspected.value.shared as boolean }
          : {}),
      }),
      "Blueprint search request",
    );
    if (!filters.ok) return filters;
    const page = graphPageRequest(
      Object.freeze({
        ...(filters.value.cursor === undefined ? {} : { cursor: filters.value.cursor }),
        limit: filters.value.limit,
      }),
      "Blueprint search page request",
      options.bounds.maxComponents,
      options,
    );
    if (!page.ok) return page;
    const identity = await projectedGraphQueryIdentity(options);
    if (!identity.ok) return identity;
    const projected = await projectedComponentPage(
      identity.value,
      options.calls.searchGraphEntities,
      Object.freeze({
        kind: STANDARD_COMPONENT_KIND,
        ...(filters.value.scale === undefined && filters.value.shared === undefined
          ? {}
          : { payload: componentPayloadQuery(filters.value) }),
        text: inspected.value.text,
      }),
      page.value,
      "search",
      options,
    );
    if (!projected.ok) return projected;
    const observed = await snapshot(Object.freeze([]), options);
    if (!observed.ok) return readProviderFailure(observed.diagnostics);
    if (observed.value.generation !== projected.value.generation) return graphQueryUnavailable();
    const evidenceBound = evidenceBoundComponents(observed.value, projected.value.items, options);
    const items: BlueprintSearchItem[] = projected.value.items.map((component) =>
      Object.freeze({ component, evidenceBound: evidenceBound.has(component.id) }),
    );
    return boundedBlueprintPage(
      Object.freeze({
        generation: projected.value.generation,
        hasMore: projected.value.hasMore,
        items: Object.freeze(items),
        ...(projected.value.nextCursor === undefined
          ? {}
          : { nextCursor: projected.value.nextCursor }),
      }),
      "search",
      options,
    );
  };

  const traverseBlueprint = async (
    request: TraverseBlueprintRequest,
  ): Promise<Result<BlueprintTraversalPage>> => {
    const inspected = exactRequest(
      request,
      [
        ["depth", "direction", "id", "limit"],
        ["cursor", "depth", "direction", "id", "limit"],
        ["depth", "direction", "id", "limit", "relationType"],
        ["cursor", "depth", "direction", "id", "limit", "relationType"],
      ],
      "Blueprint traversal request",
    );
    if (!inspected.ok) return inspected;
    if (typeof inspected.value.id !== "string") {
      return failure(diagnostic("invalid-entity-id", "Traversal identity must be a string"));
    }
    const id = parseEntityId(inspected.value.id);
    if (!id.ok) return id;
    const direction = inspected.value.direction;
    if (direction !== "incoming" && direction !== "outgoing" && direction !== "both") {
      return failure(
        diagnostic(
          "invalid-traversal-direction",
          "Traversal direction must be incoming, outgoing, or both",
        ),
      );
    }
    const depth = inspected.value.depth;
    if (
      typeof depth !== "number" ||
      !Number.isSafeInteger(depth) ||
      depth <= 0 ||
      depth > options.bounds.maxComponents
    ) {
      return failure(
        diagnostic("invalid-traversal-depth", "Traversal depth is outside the application bound"),
      );
    }
    const relationType = inspected.value.relationType;
    if (
      relationType !== undefined &&
      (typeof relationType !== "string" ||
        relationType.length > 128 ||
        !relationTypePattern.test(relationType))
    ) {
      return failure(
        diagnostic("invalid-relation-type", "Traversal relationship type is malformed"),
      );
    }
    const pageRequest = graphPageRequest(
      Object.freeze({
        ...(Object.hasOwn(inspected.value, "cursor")
          ? { cursor: inspected.value.cursor as string }
          : {}),
        limit: inspected.value.limit as number,
      }),
      "Blueprint traversal page request",
      options.bounds.maxRelationships,
      options,
    );
    if (!pageRequest.ok) return pageRequest;
    const query = Object.freeze({
      depth,
      direction,
      entity: id.value,
      ...(relationType === undefined ? {} : { relationType }),
    });
    const identity = await projectedGraphQueryIdentity(options);
    if (!identity.ok) return identity;
    const projected = await projectedTraversalPage(
      identity.value,
      query,
      pageRequest.value,
      options,
    );
    return projected.ok ? boundedBlueprintPage(projected.value, "traverse", options) : projected;
  };

  const getComponent = async (
    request: GetComponentRequest,
  ): Promise<Result<ExactComponentRead>> => {
    const validated = exactRequest(request, [["id", "relationships"]], "Get component request");
    if (!validated.ok) return validated;
    if (typeof validated.value.id !== "string") {
      return failure(diagnostic("invalid-entity-id", "Component identity must be a string"));
    }
    const id = parseEntityId(validated.value.id);
    if (!id.ok) return id;
    const relationshipsRequest = boundedRequest(
      validated.value.relationships,
      "Outgoing relationship page request",
    );
    if (!relationshipsRequest.ok) return relationshipsRequest;
    const requestedResource = componentResource(id.value, options);
    if (!requestedResource.ok) return requestedResource;
    for (let attempt = 0; attempt < options.maxSnapshotAttempts; attempt += 1) {
      const initial = await snapshot(Object.freeze([requestedResource.value]), options);
      if (!initial.ok) return readProviderFailure(initial.diagnostics);
      const resolved = options.graph.resolveEntityIdentity(initial.value.graph, id.value);
      if (!resolved.ok) {
        return failure(
          diagnostic("unknown-component", "No component exists for the stable identity or alias"),
        );
      }
      const mapped =
        resolved.value.resolved === id.value
          ? requestedResource
          : componentResource(resolved.value.resolved, options);
      if (!mapped.ok) return mapped;
      const read =
        resolved.value.resolved === id.value
          ? initial
          : await snapshot(Object.freeze([mapped.value]), options);
      if (!read.ok) return readProviderFailure(read.diagnostics);
      if (read.value.generation !== initial.value.generation) continue;
      const confirmed = options.graph.resolveEntityIdentity(read.value.graph, id.value);
      if (!confirmed.ok || confirmed.value.resolved !== resolved.value.resolved) {
        return failure(
          diagnostic(
            "inconsistent-provider-snapshot",
            "Equal graph generations returned different component alias resolution",
          ),
        );
      }
      const component = componentById(read.value, confirmed.value.resolved);
      if (component === undefined) {
        return failure(
          diagnostic("unknown-component", "No component exists for the stable identity or alias"),
        );
      }
      const revision = revisionFor(read.value, mapped.value, "Component");
      if (!revision.ok) return revision;
      const relationships = relationshipPage(
        read.value.generation,
        component.id,
        revision.value,
        read.value.relationships,
        relationshipsRequest.value,
        options,
      );
      if (!relationships.ok) return relationships;
      const evidence = componentEvidence(read.value, component, options);
      if (!evidence.ok) return evidence;
      const cognitive = cognitiveComplexityEvidence(read.value, [component], options).get(
        component.id,
      );
      const evidenceBound = evidenceBoundComponents(read.value, [component], options).has(
        component.id,
      );
      const exact = exactQuery(
        read.value.generation,
        Object.freeze({
          evidence: evidence.value,
          generation: read.value.generation,
          item: Object.freeze({
            ...(cognitive === undefined ? {} : { cognitiveComplexity: cognitive }),
            component,
            evidenceBound,
            revision: revision.value,
          }),
          relationships: relationships.value,
        }),
        options,
      );
      return exact.ok ? success(exact.value.item as ExactComponentRead) : exact;
    }
    return failure(
      diagnostic(
        "snapshot-generation-conflict",
        "The graph generation changed during every bounded read attempt",
      ),
    );
  };

  const createComponent = async (
    request: CreateComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>> => {
    const validated = exactRequest(
      request,
      [["component"], ["component", "relationships"]],
      "Create component request",
    );
    if (!validated.ok) return rejected(...validated.diagnostics);
    const embedded = preflightEmbeddedItems(
      validated.value.component,
      options.bounds.maxEmbeddedItems,
    );
    if (!embedded.ok) return rejected(...embedded.diagnostics);
    const relationships =
      "relationships" in validated.value
        ? denseArray(
            validated.value.relationships,
            "Created component relationships",
            options.bounds.maxRelationshipMutations,
          )
        : success(Object.freeze([]));
    if (!relationships.ok) return rejected(...relationships.diagnostics);
    const requestData = copyMutationRequestData(
      Object.freeze({
        component: validated.value.component as GraphData,
        relationships: relationships.value as GraphData,
      }),
      options.bounds,
    );
    if (!requestData.ok) return rejected(...requestData.diagnostics);
    const copiedComponent = requestData.value.component;
    const copiedRelationships = requestData.value.relationships;
    if (!Array.isArray(copiedRelationships)) {
      return rejected(
        diagnostic("invalid-application-request", "Created component relationships are malformed"),
      );
    }
    const componentRecord =
      typeof copiedComponent === "object" &&
      copiedComponent !== null &&
      !Array.isArray(copiedComponent)
        ? (copiedComponent as GraphDataRecord)
        : undefined;
    const expectedIdentity =
      componentRecord !== undefined && Object.hasOwn(componentRecord, "id")
        ? Object.freeze({ present: true as const, value: componentRecord.id })
        : Object.freeze({ present: false as const });
    const normalized = options.snapshotStateDecoder.normalizeComponent(
      copiedComponent as CreateComponentRequest["component"],
      expectedIdentity,
    );
    if (!normalized.ok) return rejected(...normalized.diagnostics);
    let current: ReadSnapshot | undefined;
    let added: { readonly entity: GraphEntity; readonly snapshot: GraphSnapshot } | undefined;
    let component: StandardComponent | undefined;
    let mapped: ResourceKey | undefined;
    for (let attempt = 0; attempt < options.maxSnapshotAttempts; attempt += 1) {
      const initial = await snapshot(Object.freeze([]), options);
      if (!initial.ok) return snapshotFailure(initial.diagnostics);
      const proposed = options.graph.addEntity(initial.value.graph, normalized.value);
      if (!proposed.ok) {
        return proposed.diagnostics.some((entry) => entry.code === "ambiguous-entity-identity")
          ? revisionConflict()
          : rejected(...proposed.diagnostics);
      }
      const parsed = options.snapshotStateDecoder.canonicalizeEntity(proposed.value.entity, {
        id: proposed.value.entity.id,
        kind: STANDARD_COMPONENT_KIND,
      });
      if (!parsed.ok) return rejected(...parsed.diagnostics);
      const resource = componentResource(parsed.value.component.id, options);
      if (!resource.ok) return rejected(...resource.diagnostics);
      const confirmed = await snapshot(Object.freeze([resource.value]), options);
      if (!confirmed.ok) return snapshotFailure(confirmed.diagnostics);
      if (confirmed.value.generation !== initial.value.generation) continue;
      if (
        componentById(confirmed.value, parsed.value.component.id) !== undefined ||
        confirmed.value.revisions.get(resource.value) !== null
      ) {
        return revisionConflict();
      }
      added = proposed.value;
      component = parsed.value.component;
      current = confirmed.value;
      mapped = resource.value;
      break;
    }
    if (
      current === undefined ||
      component === undefined ||
      mapped === undefined ||
      added === undefined
    ) {
      return Object.freeze({
        diagnostics: Object.freeze([
          Object.freeze({
            code: "snapshot-generation-conflict",
            message: "The operation conflicts with current canonical state",
          }),
        ]),
        status: "conflict" as const,
      });
    }
    if (component.parent !== undefined) {
      const parent = options.graph.resolveEntityIdentity(current.graph, component.parent);
      if (!parent.ok) {
        return rejected(
          diagnostic("unknown-component-parent", "Nested component parent does not exist"),
        );
      }
      component = Object.freeze({ ...component, parent: parent.value.resolved });
      const parentComponent = componentById(current, component.parent as string);
      if (
        component.scale !== undefined &&
        parentComponent?.scale !== undefined &&
        isCoarserStandardScale(component.scale, parentComponent.scale)
      ) {
        return rejected(
          diagnostic(
            "component-scale-coarser-than-parent",
            `A ${component.scale}-scale component cannot live inside its ${parentComponent.scale}-scale parent`,
          ),
        );
      }
    }
    const relationshipMutations: GraphDataRecord[] = [];
    const affectedRelationships = new Set<string>();
    let graph = added.snapshot;
    if (copiedRelationships.length > 0) {
      for (let index = 0; index < copiedRelationships.length; index += 1) {
        const planned = relationshipInput(
          copiedRelationships[index],
          component.id,
          graph,
          current,
          options,
        );
        if (!planned.ok) return rejected(...planned.diagnostics);
        if (affectedRelationships.has(planned.value.view.id)) {
          return rejected(
            diagnostic(
              "ambiguous-relationship-mutation",
              "Created relationship identity is duplicated",
            ),
          );
        }
        affectedRelationships.add(planned.value.view.id);
        relationshipMutations.push(relationshipMutation(planned.value.view));
        graph = planned.value.graph;
      }
    }
    if (
      typeof added.entity.payload !== "object" ||
      added.entity.payload === null ||
      Array.isArray(added.entity.payload)
    ) {
      return rejected(
        diagnostic("invalid-standard-model-value", "Normalized component payload is malformed"),
      );
    }
    const componentInput = Object.freeze({
      id: component.id,
      ...(added.entity.payload as GraphDataRecord),
      ...(component.parent === undefined ? {} : { parent: component.parent }),
    });
    relationshipMutations.sort((left, right) =>
      compareText(
        String((left.relationship as GraphDataRecord).id),
        String((right.relationship as GraphDataRecord).id),
      ),
    );
    const transaction = standardTransactionRequest(
      Object.freeze([Object.freeze({ component: componentInput, type: "create" })]),
      Object.freeze(relationshipMutations),
      Object.freeze([component.id]),
      Object.freeze(Array.from(affectedRelationships)),
      mapped,
      null,
    );
    return executeMutation(transaction, new Map([[mapped, component.id]]), component, options);
  };

  const updateExisting = async (
    idValue: unknown,
    expectedRevisionValue: unknown,
    patchValue: unknown,
    relationshipChanges: ComponentRelationshipChanges | undefined,
    allowParent: boolean,
  ): Promise<ApplicationMutationOutcome<StandardComponent>> => {
    if (typeof idValue !== "string") {
      return rejected(diagnostic("invalid-entity-id", "Component identity must be a string"));
    }
    const id = parseEntityId(idValue);
    if (!id.ok) return rejected(...id.diagnostics);
    const expectedRevision = parseContentRevision(expectedRevisionValue);
    if (!expectedRevision.ok) return rejected(...expectedRevision.diagnostics);
    const embedded = preflightEmbeddedItems(patchValue, options.bounds.maxEmbeddedItems);
    if (!embedded.ok) return rejected(...embedded.diagnostics);
    const relationshipBound = preflightRelationshipChanges(
      relationshipChanges,
      options.bounds.maxRelationshipMutations,
    );
    if (!relationshipBound.ok) return rejected(...relationshipBound.diagnostics);
    const requestData = copyMutationRequestData(
      Object.freeze({
        patch: patchValue as GraphData,
        relationships: (relationshipChanges ?? null) as GraphData,
      }),
      options.bounds,
    );
    if (!requestData.ok) return rejected(...requestData.diagnostics);
    const copiedRelationshipChanges =
      requestData.value.relationships === null
        ? undefined
        : (requestData.value.relationships as ComponentRelationshipChanges);
    const mapped = componentResource(id.value, options);
    if (!mapped.ok) return rejected(...mapped.diagnostics);
    let current = await snapshot(Object.freeze([mapped.value]), options);
    if (!current.ok) return snapshotFailure(current.diagnostics);
    const component = componentById(current.value, id.value);
    if (component === undefined) {
      return rejected(diagnostic("unknown-component", "Component mutation target does not exist"));
    }
    if (current.value.revisions.get(mapped.value) !== expectedRevision.value) {
      return revisionConflict();
    }
    if (
      typeof requestData.value.patch !== "object" ||
      requestData.value.patch === null ||
      Array.isArray(requestData.value.patch)
    ) {
      return rejected(diagnostic("invalid-component-patch", "Component patch must be a record"));
    }
    let patch = requestData.value.patch as GraphDataRecord;
    if (!allowParent && Object.hasOwn(patch, "parent")) {
      return rejected(
        diagnostic(
          "explicit-reparent-required",
          "Structural parent changes must use the reparent operation",
        ),
      );
    }
    if (allowParent && patch.parent !== null) {
      if (typeof patch.parent !== "string") {
        return rejected(
          diagnostic(
            "invalid-component-parent",
            "Component parent must be a stable identity or null",
          ),
        );
      }
      const parent = parseEntityId(patch.parent);
      if (!parent.ok) return rejected(...parent.diagnostics);
      const resolved = options.graph.resolveEntityIdentity(current.value.graph, parent.value);
      if (!resolved.ok) {
        return rejected(diagnostic("unknown-component-parent", "Reparent target does not exist"));
      }
      patch = Object.freeze({ ...patch, parent: resolved.value.resolved });
    }
    const entity = options.graph.resolveEntity(current.value.graph, {
      expectedKind: STANDARD_COMPONENT_KIND,
      id: id.value,
    });
    if (!entity.ok) return rejected(...entity.diagnostics);
    const computed = options.snapshotStateDecoder.patchComponent(
      entity.value,
      patch as StandardComponentPatch,
      id.value,
    );
    if (!computed.ok) return rejected(...computed.diagnostics);
    let labelDependentIds: readonly EntityId[] = Object.freeze([]);
    if (component.name !== computed.value.component.name) {
      const dependents = readableLabelDependents(current.value, id.value, options);
      if (!dependents.ok) return rejected(...dependents.diagnostics);
      labelDependentIds = dependents.value;
    }
    const labelDependentResources = new Map<EntityId, ResourceKey>();
    for (const dependentId of labelDependentIds) {
      const resource = componentResource(dependentId, options);
      if (!resource.ok) return rejected(...resource.diagnostics);
      labelDependentResources.set(dependentId, resource.value);
    }
    if (labelDependentResources.size > 0) {
      const resources = Object.freeze(
        [mapped.value, ...labelDependentResources.values()].sort(compareText),
      );
      const confirmed = await snapshot(resources, options);
      if (!confirmed.ok) return snapshotFailure(confirmed.diagnostics);
      if (
        confirmed.value.generation !== current.value.generation ||
        confirmed.value.revisions.get(mapped.value) !== expectedRevision.value
      ) {
        return revisionConflict();
      }
      current = confirmed;
    }
    const resultingScale = computed.value.component.scale;
    const resultingParent = computed.value.component.parent;
    if (resultingScale !== undefined && resultingParent !== undefined) {
      const parentComponent = componentById(current.value, resultingParent);
      if (
        parentComponent?.scale !== undefined &&
        isCoarserStandardScale(resultingScale, parentComponent.scale)
      ) {
        return rejected(
          diagnostic(
            "component-scale-coarser-than-parent",
            `A ${resultingScale}-scale component cannot live inside its ${parentComponent.scale}-scale parent`,
          ),
        );
      }
    }
    if (resultingScale !== undefined) {
      const coarserChild = current.value.components.find(
        (candidate) =>
          candidate.parent === id.value &&
          candidate.scale !== undefined &&
          isCoarserStandardScale(candidate.scale, resultingScale),
      );
      if (coarserChild !== undefined) {
        return rejected(
          diagnostic(
            "component-scale-coarser-than-parent",
            `The ${coarserChild.scale}-scale child ${coarserChild.id} cannot live inside a ${resultingScale}-scale parent`,
          ),
        );
      }
    }
    const finalEmbedded = preflightEmbeddedItems(
      computed.value.entity.payload,
      options.bounds.maxEmbeddedItems,
    );
    if (!finalEmbedded.ok) return rejected(...finalEmbedded.diagnostics);
    const plannedRelationships = planRelationshipChanges(
      copiedRelationshipChanges,
      id.value,
      current.value,
      options,
    );
    if (!plannedRelationships.ok) return rejected(...plannedRelationships.diagnostics);
    const patchKeys = Object.keys(patch);
    const hasComponentChanges =
      patchKeys.length > 0 &&
      !sameCanonicalGraphData(
        entity.value.payload,
        computed.value.entity.payload,
        options.bounds,
        "entity",
      );
    if (!hasComponentChanges && plannedRelationships.value.mutations.length === 0) {
      return rejected(diagnostic("empty-component-mutation", "Component update has no changes"));
    }
    const componentMutations = !hasComponentChanges
      ? Object.freeze([])
      : Object.freeze([
          Object.freeze({ id: id.value, patch: patch as GraphDataRecord, type: "patch" }),
        ]);
    const transaction = standardTransactionRequest(
      componentMutations,
      plannedRelationships.value.mutations,
      Object.freeze([id.value, ...labelDependentIds].sort(compareText)),
      plannedRelationships.value.affected,
      mapped.value,
      expectedRevision.value,
      Object.freeze([]),
      Object.freeze(
        labelDependentIds.map((dependentId) => {
          const resource = labelDependentResources.get(dependentId)!;
          return Object.freeze({
            expected: current.value.revisions.get(resource) ?? null,
            resource,
          });
        }),
      ),
    );
    const resourceOwners = new Map<ResourceKey, string | null>([[mapped.value, id.value]]);
    for (const [dependentId, resource] of labelDependentResources) {
      resourceOwners.set(resource, dependentId);
    }
    return executeMutation(transaction, resourceOwners, computed.value.component, options);
  };

  const updateComponent = async (
    request: UpdateComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>> => {
    const validated = exactRequest(
      request,
      [
        ["expectedRevision", "id", "patch"],
        ["expectedRevision", "id", "patch", "relationships"],
      ],
      "Update component request",
    );
    if (!validated.ok) return rejected(...validated.diagnostics);
    return updateExisting(
      validated.value.id,
      validated.value.expectedRevision,
      validated.value.patch,
      "relationships" in validated.value
        ? (validated.value.relationships as ComponentRelationshipChanges)
        : undefined,
      false,
    );
  };

  const reparentComponent = async (
    request: ReparentComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>> => {
    const validated = exactRequest(
      request,
      [["expectedRevision", "id", "parent"]],
      "Reparent component request",
    );
    if (!validated.ok) return rejected(...validated.diagnostics);
    if (validated.value.parent !== null && typeof validated.value.parent !== "string") {
      return rejected(
        diagnostic(
          "invalid-component-parent",
          "Component parent must be a stable identity or null",
        ),
      );
    }
    return updateExisting(
      validated.value.id,
      validated.value.expectedRevision,
      Object.freeze({ parent: validated.value.parent }),
      undefined,
      true,
    );
  };

  const mergeComponent = async (
    request: MergeComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>> => {
    const validated = exactRequest(
      request,
      [["expectedRevision", "obsolete", "survivor"]],
      "Merge component request",
    );
    if (!validated.ok) return rejected(...validated.diagnostics);
    if (
      typeof validated.value.obsolete !== "string" ||
      typeof validated.value.survivor !== "string"
    ) {
      return rejected(diagnostic("invalid-entity-id", "Merge identities must be strings"));
    }
    const obsolete = parseEntityId(validated.value.obsolete);
    const requestedSurvivor = parseEntityId(validated.value.survivor);
    const expectedRevision = parseContentRevision(validated.value.expectedRevision);
    if (!obsolete.ok) return rejected(...obsolete.diagnostics);
    if (!requestedSurvivor.ok) return rejected(...requestedSurvivor.diagnostics);
    if (!expectedRevision.ok) return rejected(...expectedRevision.diagnostics);
    if (obsolete.value === requestedSurvivor.value) {
      return rejected(
        diagnostic("self-component-alias", "A component identity cannot supersede itself"),
      );
    }
    const aliasesResource = aliasResource(options);
    if (!aliasesResource.ok) return rejected(...aliasesResource.diagnostics);

    for (let attempt = 0; attempt < options.maxSnapshotAttempts; attempt += 1) {
      const initial = await snapshot(Object.freeze([]), options);
      if (!initial.ok) return snapshotFailure(initial.diagnostics);
      if (componentById(initial.value, obsolete.value) === undefined) {
        return rejected(
          initial.value.aliases.some((alias) => alias.source === obsolete.value)
            ? diagnostic(
                "ambiguous-component-supersession",
                "The obsolete component identity is already superseded",
              )
            : diagnostic("unknown-component", "The obsolete component does not exist"),
        );
      }
      const resolvedSurvivor = options.graph.resolveEntityIdentity(
        initial.value.graph,
        requestedSurvivor.value,
      );
      if (!resolvedSurvivor.ok) {
        return rejected(
          diagnostic(
            "missing-component-alias-target",
            "The surviving component identity does not exist",
          ),
        );
      }
      if (resolvedSurvivor.value.resolved === obsolete.value) {
        return rejected(
          diagnostic(
            "component-alias-cycle",
            "A merge cannot supersede a component through itself",
          ),
        );
      }
      const obsoleteResource = componentResource(obsolete.value, options);
      if (!obsoleteResource.ok) return rejected(...obsoleteResource.diagnostics);
      const outgoing = initial.value.relationships.filter(
        (relationship) => relationship.source === obsolete.value,
      );
      const survivingAffectedIds = new Set<EntityId>();
      if (outgoing.length > 0) survivingAffectedIds.add(resolvedSurvivor.value.resolved);
      for (const component of initial.value.components) {
        if (component.parent === obsolete.value) survivingAffectedIds.add(component.id);
      }
      for (const relationship of initial.value.relationships) {
        if (relationship.target !== obsolete.value) continue;
        survivingAffectedIds.add(
          relationship.source === obsolete.value
            ? resolvedSurvivor.value.resolved
            : relationship.source,
        );
      }
      survivingAffectedIds.delete(obsolete.value);
      const affectedResources = new Map<EntityId, ResourceKey>();
      for (const affectedId of survivingAffectedIds) {
        const resource = componentResource(affectedId, options);
        if (!resource.ok) return rejected(...resource.diagnostics);
        affectedResources.set(affectedId, resource.value);
      }
      const resources = Object.freeze(
        [aliasesResource.value, obsoleteResource.value, ...affectedResources.values()].sort(
          compareText,
        ),
      );
      const current = await snapshot(resources, options);
      if (!current.ok) return snapshotFailure(current.diagnostics);
      if (current.value.generation !== initial.value.generation) continue;
      const currentObsolete = componentById(current.value, obsolete.value);
      const currentSurvivorResolution = options.graph.resolveEntityIdentity(
        current.value.graph,
        requestedSurvivor.value,
      );
      if (
        currentObsolete === undefined ||
        !currentSurvivorResolution.ok ||
        currentSurvivorResolution.value.resolved !== resolvedSurvivor.value.resolved
      ) {
        return revisionConflict();
      }
      if (current.value.revisions.get(obsoleteResource.value) !== expectedRevision.value) {
        return revisionConflict();
      }
      const survivor = componentById(current.value, resolvedSurvivor.value.resolved);
      if (survivor === undefined) {
        return rejected(diagnostic("unknown-component", "The surviving component does not exist"));
      }
      const currentOutgoing = current.value.relationships
        .filter((relationship) => relationship.source === obsolete.value)
        .sort((left, right) => compareText(left.id, right.id));
      if (
        currentOutgoing.length !== outgoing.length ||
        currentOutgoing.some((relationship, index) => relationship.id !== outgoing[index]!.id)
      ) {
        return revisionConflict();
      }
      const relationshipMutations = Object.freeze(
        currentOutgoing.map((relationship) =>
          relationshipMutation(
            Object.freeze({
              ...relationship,
              source: survivor.id,
              target: relationship.target === obsolete.value ? survivor.id : relationship.target,
            }),
          ),
        ),
      );
      const affectedComponents = Object.freeze(
        [obsolete.value, ...survivingAffectedIds].sort(compareText),
      );
      const affectedRelationshipIds = new Set(
        currentOutgoing.map((relationship) => relationship.id),
      );
      for (const relationship of current.value.relationships) {
        if (relationship.target === obsolete.value) affectedRelationshipIds.add(relationship.id);
      }
      const additionalExpected = [
        Object.freeze({
          expected: current.value.revisions.get(aliasesResource.value) ?? null,
          resource: aliasesResource.value,
        }),
        ...[...affectedResources].map(([, resource]) =>
          Object.freeze({
            expected: current.value.revisions.get(resource) ?? null,
            resource,
          }),
        ),
      ];
      const transaction = standardTransactionRequest(
        Object.freeze([Object.freeze({ id: obsolete.value, type: "remove" })]),
        relationshipMutations,
        affectedComponents,
        Object.freeze([...affectedRelationshipIds].sort(compareText)),
        obsoleteResource.value,
        expectedRevision.value,
        Object.freeze([
          Object.freeze({
            source: obsolete.value,
            target: survivor.id,
            type: "upsert",
          }),
        ]),
        Object.freeze(additionalExpected),
      );
      const owners = new Map<ResourceKey, string | null>([
        [obsoleteResource.value, obsolete.value],
        [aliasesResource.value, null],
        ...[...affectedResources].map(
          ([affectedId, resource]) => [resource, affectedId] as [ResourceKey, string | null],
        ),
      ]);
      return executeMutation(transaction, owners, survivor, options);
    }
    return Object.freeze({
      diagnostics: Object.freeze([
        Object.freeze({
          code: "snapshot-generation-conflict",
          message: "The operation conflicts with current canonical state",
        }),
      ]),
      status: "conflict" as const,
    });
  };

  const removeComponent = async (
    request: RemoveComponentRequest,
  ): Promise<ApplicationMutationOutcome<string>> => {
    const validated = exactRequest(
      request,
      [["expectedRevision", "id"]],
      "Remove component request",
    );
    if (!validated.ok) return rejected(...validated.diagnostics);
    if (typeof validated.value.id !== "string") {
      return rejected(diagnostic("invalid-entity-id", "Component identity must be a string"));
    }
    const id = parseEntityId(validated.value.id);
    if (!id.ok) return rejected(...id.diagnostics);
    const expectedRevision = parseContentRevision(validated.value.expectedRevision);
    if (!expectedRevision.ok) return rejected(...expectedRevision.diagnostics);
    const mapped = componentResource(id.value, options);
    if (!mapped.ok) return rejected(...mapped.diagnostics);
    const current = await snapshot(Object.freeze([mapped.value]), options);
    if (!current.ok) return snapshotFailure(current.diagnostics);
    const component = componentById(current.value, id.value);
    if (component === undefined) {
      return rejected(diagnostic("unknown-component", "Component removal target does not exist"));
    }
    if (current.value.revisions.get(mapped.value) !== expectedRevision.value) {
      return revisionConflict();
    }
    if (current.value.aliases.some((alias) => alias.target === id.value)) {
      return rejected(
        diagnostic(
          "component-is-alias-target",
          "A merge survivor must be merged onward instead of removed directly",
        ),
      );
    }
    if (current.value.components.some((candidate) => candidate.parent === id.value)) {
      return rejected(
        diagnostic(
          "component-has-children",
          "Component children must be explicitly reparented or removed first",
        ),
      );
    }
    if (
      current.value.relationships.some(
        (relationship) => relationship.source === id.value || relationship.target === id.value,
      )
    ) {
      return rejected(
        diagnostic(
          "component-has-relationships",
          "Incident relationships must be explicitly removed first",
        ),
      );
    }
    const transaction = standardTransactionRequest(
      Object.freeze([Object.freeze({ id: id.value, type: "remove" })]),
      Object.freeze([]),
      Object.freeze([id.value]),
      Object.freeze([]),
      mapped.value,
      expectedRevision.value,
    );
    return executeMutation(transaction, new Map([[mapped.value, id.value]]), id.value, options);
  };

  const listComponents = async (request: ListComponentsRequest): Promise<Result<ComponentPage>> => {
    const validated = filteredBoundedRequest(request, "List components request");
    return validated.ok
      ? componentPage(
          validated.value,
          Object.freeze({
            operation: "list-components",
            ...componentFilterQuery(validated.value),
          }),
          () => (component) => componentMatchesFilters(component, validated.value),
          options,
        )
      : validated;
  };

  const listRoots = async (request: ListRootComponentsRequest): Promise<Result<ComponentPage>> => {
    const validated = filteredBoundedRequest(request, "List root components request");
    return validated.ok
      ? componentPage(
          validated.value,
          Object.freeze({
            operation: "list-root-components",
            ...componentFilterQuery(validated.value),
          }),
          () => (component) =>
            component.parent === undefined && componentMatchesFilters(component, validated.value),
          options,
        )
      : validated;
  };

  const listChildren = async (
    request: ListChildComponentsRequest,
  ): Promise<Result<ComponentPage>> => {
    const validated = exactRequest(
      request,
      [
        ["limit", "parent"],
        ["cursor", "limit", "parent"],
        ["limit", "parent", "scale"],
        ["limit", "parent", "shared"],
        ["cursor", "limit", "parent", "scale"],
        ["cursor", "limit", "parent", "shared"],
        ["limit", "parent", "scale", "shared"],
        ["cursor", "limit", "parent", "scale", "shared"],
      ],
      "List child components request",
    );
    if (!validated.ok) return validated;
    if (typeof validated.value.parent !== "string") {
      return failure(diagnostic("invalid-entity-id", "Parent identity must be a string"));
    }
    const parent = parseEntityId(validated.value.parent);
    if (!parent.ok) return parent;
    const pageRequest = filteredBoundedRequest(
      Object.freeze({
        ...(Object.hasOwn(validated.value, "cursor")
          ? { cursor: validated.value.cursor as string }
          : {}),
        limit: validated.value.limit as number,
        ...(Object.hasOwn(validated.value, "scale")
          ? { scale: validated.value.scale as string }
          : {}),
        ...(Object.hasOwn(validated.value, "shared")
          ? { shared: validated.value.shared as boolean }
          : {}),
      }),
      "List child components page request",
    );
    return pageRequest.ok
      ? componentPage(
          pageRequest.value,
          Object.freeze({
            operation: "list-child-components",
            parent: parent.value,
            ...componentFilterQuery(pageRequest.value),
          }),
          (state) => {
            const resolved = options.graph.resolveEntityIdentity(state.graph, parent.value);
            return resolved.ok
              ? (component) =>
                  component.parent === resolved.value.resolved &&
                  componentMatchesFilters(component, pageRequest.value)
              : () => false;
          },
          options,
        )
      : pageRequest;
  };

  return Object.freeze({
    createComponent,
    exportBlueprint,
    getComponent,
    initialize,
    listChildren,
    listComponents,
    listRoots,
    mergeComponent,
    removeComponent,
    reparentComponent,
    searchBlueprint,
    traverseBlueprint,
    updateComponent,
  });
}
