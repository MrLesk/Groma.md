import {
  failure,
  parseContentRevision,
  parseEntityId,
  parseGraphGeneration,
  parseRelationId,
  parseResourceKey,
  success,
  type ContentRevision,
  type Diagnostic,
  type EntityDraft,
  type EntityId,
  type GraphData,
  type GraphDataRecord,
  type GraphEntity,
  type GraphGeneration,
  type GraphRelation,
  type GraphSnapshot,
  type PreparedBoundedQuery,
  type ResourceKey,
  type Result,
  type TransactionOutcome,
  type TransactionRequest,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  STANDARD_COMPONENT_KIND,
  type StandardComponent,
  type StandardComponentPatch,
  type StandardModelTransactionState,
  type StandardRelationship,
} from "../standard-model/index.ts";
import type {
  ApplicationDiagnostic,
  ApplicationMutationOutcome,
  ApplicationOperationBounds,
  ApplicationOperations,
  ApplicationOperationsOptions,
  BoundedPageRequest,
  ComponentPage,
  ComponentRelationshipChanges,
  ComponentRelationshipInput,
  ComponentView,
  CreateComponentRequest,
  ExactComponentRead,
  GetComponentRequest,
  InitializeWorkspaceRequest,
  ListChildComponentsRequest,
  ListComponentsRequest,
  ListRootComponentsRequest,
  RemoveComponentRequest,
  ReparentComponentRequest,
  RelationshipPage,
  RelationshipView,
  UpdateComponentRequest,
  WorkspaceInitializationOutcome,
} from "./contracts.ts";

interface LoadedState {
  readonly components: readonly StandardComponent[];
  readonly graph: GraphSnapshot;
  readonly relationships: readonly StandardRelationship[];
}

interface ReadSnapshot extends LoadedState {
  readonly generation: GraphGeneration;
  readonly revisions: ReadonlyMap<ResourceKey, ContentRevision | null>;
}

interface SelectedPage<T> {
  readonly hasMore: boolean;
  readonly items: readonly T[];
  readonly nextAnchor?: string;
}

type ComponentFilter = (component: StandardComponent) => boolean;

const absoluteBounds = Object.freeze({
  maxComponents: 1_000_000,
  maxDiagnosticCount: 1_000,
  maxEmbeddedItems: 100_000,
  maxRelationshipMutations: 100_000,
  maxRelationships: 1_000_000,
  maxSnapshotAttempts: 16,
  maxSnapshotStateDepth: 100,
  maxSnapshotStateValues: 10_000_000,
});

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

function componentResourceDiagnostic(componentId: string): Diagnostic {
  return Object.freeze({
    code: "component-resource-unavailable",
    details: Object.freeze({ componentId }),
    message: "The canonical resource for the component could not be resolved",
  });
}

function componentResource(
  componentId: string,
  options: ApplicationOperationsOptions,
): Result<ResourceKey> {
  let value: unknown;
  try {
    value = options.resourceMapper.resourceForComponent(componentId);
  } catch {
    return failure(componentResourceDiagnostic(componentId));
  }
  const result = inspectExactRecord(
    value,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "invalid-component-resource-result",
    "Component resource mapping result",
  );
  if (!result.ok || result.value.ok !== true) {
    return failure(componentResourceDiagnostic(componentId));
  }
  const resource = parseResourceKey(result.value.value);
  return resource.ok ? resource : failure(componentResourceDiagnostic(componentId));
}

function validatePositiveBound(value: number, name: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
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

function denseArray(value: unknown, subject: string, maximum: number): Result<readonly unknown[]> {
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

function preflightDiagnostics(value: unknown, bounds: ApplicationOperationBounds): Result<void> {
  const entries = denseArray(value, "Diagnostics", bounds.maxDiagnosticCount);
  if (!entries.ok) return entries;
  for (let index = 0; index < entries.value.length; index += 1) {
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
    const diagnostics = preflightDiagnostics(raw.value.diagnostics, bounds);
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

function loadState(value: unknown, options: ApplicationOperationsOptions): Result<LoadedState> {
  const rawEnvelope = inspectExactRecord(
    value,
    [["components", "relationships"]],
    "invalid-standard-model-state",
    "Standard Model transaction state",
  );
  if (!rawEnvelope.ok) return rawEnvelope;
  const rawComponents = boundedArrayLength(
    rawEnvelope.value.components,
    "Standard Model transaction state components",
    options.bounds.maxComponents,
  );
  if (!rawComponents.ok) return rawComponents;
  const rawRelationships = boundedArrayLength(
    rawEnvelope.value.relationships,
    "Standard Model transaction state relationships",
    options.bounds.maxRelationships,
  );
  if (!rawRelationships.ok) return rawRelationships;
  const copied = copyGraphPayload(value, "transaction", {
    code: "application-snapshot-state-too-large",
    maximumDepth: options.bounds.maxSnapshotStateDepth,
    maximumValues: options.bounds.maxSnapshotStateValues,
    message: "Transaction snapshot state exceeds the configured structural budget",
  });
  if (!copied.ok) return copied;
  const envelope = inspectExactRecord(
    copied.value,
    [["components", "relationships"]],
    "invalid-standard-model-state",
    "Standard Model transaction state",
  );
  if (!envelope.ok) return envelope;
  const componentValues = denseArray(
    envelope.value.components,
    "Standard Model transaction state components",
    options.bounds.maxComponents,
  );
  if (!componentValues.ok) return componentValues;
  const relationshipValues = denseArray(
    envelope.value.relationships,
    "Standard Model transaction state relationships",
    options.bounds.maxRelationships,
  );
  if (!relationshipValues.ok) return relationshipValues;

  const entityDrafts: EntityDraft[] = [];
  for (let index = 0; index < componentValues.value.length; index += 1) {
    const record = inspectExactRecord(
      componentValues.value[index],
      [["id", "kind", "payload"]],
      "invalid-standard-model-state",
      `Standard Model component ${index}`,
    );
    if (!record.ok) return record;
    entityDrafts[index] = Object.freeze({
      id: record.value.id as string,
      kind: record.value.kind as string,
      payload: record.value.payload,
    });
  }

  const relationDrafts = [];
  for (let index = 0; index < relationshipValues.value.length; index += 1) {
    const record = inspectExactRecord(
      relationshipValues.value[index],
      [["id", "payload", "source", "target", "type"]],
      "invalid-standard-model-state",
      `Standard Model relationship ${index}`,
    );
    if (!record.ok) return record;
    relationDrafts[index] = Object.freeze({
      id: record.value.id as string,
      payload: record.value.payload,
      source: Object.freeze({ id: record.value.source as string }),
      target: Object.freeze({ id: record.value.target as string }),
      type: record.value.type as string,
    });
  }

  const loaded = options.graph.load(entityDrafts, relationDrafts);
  if (!loaded.ok) return loaded;
  const components: StandardComponent[] = [];
  for (let index = 0; index < entityDrafts.length; index += 1) {
    const draft = entityDrafts[index]!;
    const resolved = options.graph.resolveEntity(loaded.value, {
      expectedKind: STANDARD_COMPONENT_KIND,
      id: draft.id!,
    });
    if (!resolved.ok) return resolved;
    const component = options.model.parse(resolved.value);
    if (!component.ok) return component;
    components[index] = component.value;
  }
  components.sort((left, right) => compareText(left.id, right.id));

  const graphRelations: GraphRelation[] = [];
  for (let index = 0; index < relationDrafts.length; index += 1) {
    const relation = options.graph.resolveRelation(loaded.value, relationDrafts[index]!.id!);
    if (!relation.ok) return relation;
    graphRelations[index] = relation.value;
  }
  const relationships = options.model.relationships(graphRelations);
  if (!relationships.ok) return relationships;
  return success(
    Object.freeze({
      components: Object.freeze(components),
      graph: loaded.value,
      relationships: relationships.value,
    }),
  );
}

async function snapshot(
  resources: readonly ResourceKey[],
  options: ApplicationOperationsOptions,
): Promise<Result<ReadSnapshot>> {
  let raw: unknown;
  try {
    raw = await options.transactionProvider.snapshot(resources);
  } catch {
    return failure(
      diagnostic("provider-snapshot-failed", "The transaction snapshot capability failed"),
    );
  }
  const inspected = inspectExactRecord(
    raw,
    [["generation", "revisions", "state"]],
    "invalid-provider-snapshot",
    "Transaction provider snapshot",
  );
  if (!inspected.ok) return inspected;
  const generation = parseGraphGeneration(inspected.value.generation);
  if (!generation.ok) return generation;
  const entries = denseArray(
    inspected.value.revisions,
    "Transaction provider revisions",
    options.bounds.maxComponents,
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
  const state = loadState(inspected.value.state as StandardModelTransactionState, options);
  if (!state.ok) return state;
  return success(Object.freeze({ generation: generation.value, revisions, ...state.value }));
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
  options: ApplicationOperationsOptions,
): Result<RelationshipPage> {
  const prepared = options.queries.prepare(
    generation,
    Object.freeze({ operation: "component-outgoing-relationships", source }),
    request,
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
  const page = options.queries.page(prepared.value, views, {
    hasMore: selected.value.hasMore,
    ...(selected.value.nextAnchor === undefined ? {} : { nextAnchor: selected.value.nextAnchor }),
  });
  return page.ok ? success(page.value as RelationshipPage) : page;
}

async function componentPage(
  request: BoundedPageRequest,
  query: Readonly<Record<string, string>>,
  filter: ComponentFilter,
  options: ApplicationOperationsOptions,
): Promise<Result<ComponentPage>> {
  for (let attempt = 0; attempt < options.maxSnapshotAttempts; attempt += 1) {
    const initial = await snapshot(Object.freeze([]), options);
    if (!initial.ok) return readProviderFailure(initial.diagnostics);
    const prepared = options.queries.prepare(initial.value.generation, query, request);
    if (!prepared.ok) return prepared;
    const initialItems = initial.value.components.filter(filter);
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

    const confirmedItems = confirmed.value.components.filter(filter);
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
    const views: ComponentView[] = [];
    for (let index = 0; index < confirmedPage.value.items.length; index += 1) {
      const component = confirmedPage.value.items[index]!;
      const revision = revisionFor(confirmed.value, resources[index]!, "Component");
      if (!revision.ok) return revision;
      views[index] = Object.freeze({ component, revision: revision.value });
    }
    const page = options.queries.page(prepared.value, views, {
      hasMore: confirmedPage.value.hasMore,
      ...(confirmedPage.value.nextAnchor === undefined
        ? {}
        : { nextAnchor: confirmedPage.value.nextAnchor }),
    });
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
  readonly relation: GraphRelation;
  readonly view: StandardRelationship;
}

interface PlannedRelationshipChanges {
  readonly affected: readonly string[];
  readonly mutations: readonly GraphDataRecord[];
}

type DiagnosticCategory = "conflict" | "indeterminate" | "provider" | "validation";

const semanticMessages: Readonly<Record<string, string>> = Object.freeze({
  "component-containment-cycle": "Component containment must remain acyclic",
  "component-has-children": "Component children must be handled explicitly first",
  "component-has-relationships": "Component relationships must be handled explicitly first",
  "component-resource-unavailable": "The component resource could not be resolved",
  "content-revision-conflict": "The component revision conflicts with canonical state",
  "explicit-reparent-required": "Structural parent changes require explicit reparenting",
  "relationship-id-hijack": "The relationship identity belongs to another component",
  "self-component-parent": "A component cannot be its own structural parent",
  "unknown-component": "The exact component does not exist",
  "unknown-component-parent": "The exact component parent does not exist",
  "unknown-relationship": "The exact relationship does not exist",
});

const safeIdentityDetailKeys = new Set(["componentId", "id", "parent", "source", "target"]);
const safeNumericDetailKeys = new Set([
  "actual",
  "attempts",
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

function stableDiagnosticMessage(code: string, category: DiagnosticCategory): string {
  if (category === "conflict") return "The operation conflicts with current canonical state";
  if (category === "provider") return "The provider could not complete the operation";
  if (category === "indeterminate") return "The operation commit state is indeterminate";
  return semanticMessages[code] ?? "The requested semantic operation was rejected";
}

function safeDiagnosticDetails(
  source: Diagnostic["details"],
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (source === undefined) return undefined;
  const details = Object.create(null) as Record<string, string | number | boolean>;
  for (const [key, value] of Object.entries(source)) {
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
    if (safe) Object.defineProperty(details, key, { enumerable: true, value });
  }
  return Object.keys(details).length === 0 ? undefined : Object.freeze(details);
}

function applicationDiagnostic(
  source: Diagnostic,
  category: DiagnosticCategory,
): ApplicationDiagnostic {
  const details = safeDiagnosticDetails(source.details);
  return Object.freeze({
    code: source.code,
    ...(details === undefined ? {} : { details }),
    message: stableDiagnosticMessage(source.code, category),
  });
}

function applicationDiagnostics(
  value: unknown,
  category: DiagnosticCategory,
  bounds: ApplicationOperationBounds,
): Result<readonly ApplicationDiagnostic[]> {
  const entries = denseArray(value, "Transaction outcome diagnostics", bounds.maxDiagnosticCount);
  if (!entries.ok) return entries;
  const diagnostics: ApplicationDiagnostic[] = [];
  for (let index = 0; index < entries.value.length; index += 1) {
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
    let details: Readonly<Record<string, string | number | boolean>> | undefined;
    if ("details" in entry.value) {
      const record = entry.value.details;
      if (typeof record !== "object" || record === null || Array.isArray(record)) {
        return failure(
          diagnostic("invalid-transaction-outcome", "Transaction diagnostic details are malformed"),
        );
      }
      const safe = Object.create(null) as Record<string, string | number | boolean>;
      for (const [key, detail] of Object.entries(record)) {
        if (
          typeof detail !== "string" &&
          typeof detail !== "number" &&
          typeof detail !== "boolean"
        ) {
          return failure(
            diagnostic(
              "invalid-transaction-outcome",
              "Transaction diagnostic details are malformed",
            ),
          );
        }
        Object.defineProperty(safe, key, { enumerable: true, value: detail });
      }
      if (Object.keys(safe).length > 0) details = Object.freeze(safe);
    }
    diagnostics[index] = applicationDiagnostic(
      Object.freeze({
        code: entry.value.code,
        ...(details === undefined ? {} : { details }),
        message: entry.value.message,
      }),
      category,
    );
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
  return failure(...diagnostics.map((entry) => applicationDiagnostic(entry, "provider")));
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
): Result<readonly string[]> {
  const values = denseArray(value, `Affected ${kind} identities`, maximum);
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
): Result<void> {
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
    const diagnostics = preflightDiagnostics(envelope.value.diagnostics, bounds);
    if (!diagnostics.ok) return diagnostics;
  }
  if ("revisions" in envelope.value) {
    const count = boundedArrayLength(
      envelope.value.revisions,
      "Committed revisions",
      bounds.maxComponents,
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
    const entities = boundedArrayLength(
      affected.value.entities,
      "Committed affected component identities",
      bounds.maxComponents,
    );
    if (!entities.ok) return entities;
    const relations = boundedArrayLength(
      affected.value.relations,
      "Committed affected relationship identities",
      bounds.maxRelationships,
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
      bounds.maxComponents,
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
  resourceOwners: ReadonlyMap<ResourceKey, string>,
  expectedAffected: {
    readonly components: readonly string[];
    readonly relationships: readonly string[];
  },
  value: T,
  bounds: ApplicationOperationBounds,
): ApplicationMutationOutcome<T> {
  const preflight = preflightTransactionOutcome(outcome, bounds);
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
    const components = stringIdentities(affected.value.entities, "component", bounds.maxComponents);
    const relationships = stringIdentities(
      affected.value.relations,
      "relationship",
      bounds.maxRelationships,
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
      bounds.maxComponents,
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
      revisions[index] = Object.freeze({ componentId, revision: revision.value });
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
  const diagnostics = applicationDiagnostics(envelope.value.diagnostics, category, bounds);
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
      bounds.maxComponents,
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
  resourceOwners: ReadonlyMap<ResourceKey, string>,
  value: T,
  options: ApplicationOperationsOptions,
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
  let outcome: TransactionOutcome;
  try {
    outcome = await options.transactionExecution.execute(request);
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
  return mapTransactionOutcome(outcome, resourceOwners, expectedAffected, value, options.bounds);
}

function relationshipInput(
  value: unknown,
  source: EntityId,
  graph: GraphSnapshot,
  state: LoadedState,
  options: ApplicationOperationsOptions,
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
      target: target.value,
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
  const viewed = options.model.relationships(Object.freeze([relation]));
  if (!viewed.ok) return viewed;
  return success(Object.freeze({ graph: nextGraph, relation, view: viewed.value[0]! }));
}

function relationshipMutation(relation: GraphRelation): GraphDataRecord {
  return Object.freeze({
    relationship: Object.freeze({
      id: relation.id,
      payload: relation.payload,
      source: relation.source,
      target: relation.target,
      type: relation.type,
    }),
    type: "upsert",
  });
}

function planRelationshipChanges(
  value: ComponentRelationshipChanges | undefined,
  source: EntityId,
  state: LoadedState,
  options: ApplicationOperationsOptions,
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
      if (targeted.has(planned.value.relation.id)) {
        return failure(
          diagnostic("ambiguous-relationship-mutation", "Relationship is targeted more than once"),
        );
      }
      targeted.add(planned.value.relation.id);
      graph = planned.value.graph;
      mutations.push(relationshipMutation(planned.value.relation));
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

function standardTransactionRequest(
  componentMutations: readonly GraphDataRecord[],
  relationshipMutations: readonly GraphDataRecord[],
  affectedComponents: readonly string[],
  affectedRelationships: readonly string[],
  resource: ResourceKey,
  expectedRevision: ContentRevision | null,
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
    expectedRevisions: Object.freeze([Object.freeze({ expected: expectedRevision, resource })]),
    mutation: Object.freeze({
      components: Object.freeze(componentMutations),
      relationships: Object.freeze(relationshipMutations),
    }),
  });
}

export function createApplicationOperations(
  options: ApplicationOperationsOptions,
): ApplicationOperations {
  validatePositiveBound(
    options.maxSnapshotAttempts,
    "maxSnapshotAttempts",
    absoluteBounds.maxSnapshotAttempts,
  );
  for (const name of [
    "maxComponents",
    "maxDiagnosticCount",
    "maxEmbeddedItems",
    "maxRelationshipMutations",
    "maxRelationships",
    "maxSnapshotStateDepth",
    "maxSnapshotStateValues",
  ] as const) {
    validatePositiveBound(options.bounds[name], name, absoluteBounds[name]);
  }

  const initialize = async (
    request: InitializeWorkspaceRequest,
  ): Promise<Result<WorkspaceInitializationOutcome>> => {
    const validated = exactRequest(request, [[]], "Workspace initialization request");
    if (!validated.ok) return validated;
    try {
      return validatedInitializationOutcome(
        await options.initialization.initialize(),
        options.bounds,
      );
    } catch {
      return failure(
        diagnostic("workspace-initialization-failed", "Workspace initialization capability failed"),
      );
    }
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
    const mapped = componentResource(id.value, options);
    if (!mapped.ok) return mapped;
    const read = await snapshot(Object.freeze([mapped.value]), options);
    if (!read.ok) return readProviderFailure(read.diagnostics);
    const component = componentById(read.value, id.value);
    if (component === undefined) {
      return failure(
        diagnostic("unknown-component", "No component exists for the exact stable identity"),
      );
    }
    const revision = revisionFor(read.value, mapped.value, "Component");
    if (!revision.ok) return revision;
    const relationships = relationshipPage(
      read.value.generation,
      id.value,
      revision.value,
      read.value.relationships,
      relationshipsRequest.value,
      options,
    );
    if (!relationships.ok) return relationships;
    const exact = options.queries.exact(read.value.generation, {
      generation: read.value.generation,
      item: Object.freeze({ component, revision: revision.value }),
      relationships: relationships.value,
    });
    return exact.ok ? success(exact.value.item as ExactComponentRead) : exact;
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
    const normalized = options.model.normalize(
      validated.value.component as CreateComponentRequest["component"],
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
        return normalized.value.id === undefined
          ? rejected(...proposed.diagnostics)
          : revisionConflict();
      }
      const parsed = options.model.parse(proposed.value.entity);
      if (!parsed.ok) return rejected(...parsed.diagnostics);
      const resource = componentResource(parsed.value.id, options);
      if (!resource.ok) return rejected(...resource.diagnostics);
      const confirmed = await snapshot(Object.freeze([resource.value]), options);
      if (!confirmed.ok) return snapshotFailure(confirmed.diagnostics);
      if (confirmed.value.generation !== initial.value.generation) continue;
      if (
        componentById(confirmed.value, parsed.value.id) !== undefined ||
        confirmed.value.revisions.get(resource.value) !== null
      ) {
        return revisionConflict();
      }
      added = proposed.value;
      component = parsed.value;
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
    if (component.parent !== undefined && componentById(current, component.parent) === undefined) {
      return rejected(
        diagnostic("unknown-component-parent", "Nested component parent does not exist"),
      );
    }
    const relationshipMutations: GraphDataRecord[] = [];
    const affectedRelationships = new Set<string>();
    let graph = added.snapshot;
    if (relationships.value.length > 0) {
      for (let index = 0; index < relationships.value.length; index += 1) {
        const planned = relationshipInput(
          relationships.value[index],
          component.id,
          graph,
          current,
          options,
        );
        if (!planned.ok) return rejected(...planned.diagnostics);
        if (affectedRelationships.has(planned.value.relation.id)) {
          return rejected(
            diagnostic(
              "ambiguous-relationship-mutation",
              "Created relationship identity is duplicated",
            ),
          );
        }
        affectedRelationships.add(planned.value.relation.id);
        relationshipMutations.push(relationshipMutation(planned.value.relation));
        graph = planned.value.graph;
      }
    }
    if (
      typeof normalized.value.payload !== "object" ||
      normalized.value.payload === null ||
      Array.isArray(normalized.value.payload)
    ) {
      return rejected(
        diagnostic("invalid-standard-model-value", "Normalized component payload is malformed"),
      );
    }
    const componentInput = Object.freeze({
      id: component.id,
      ...(normalized.value.payload as GraphDataRecord),
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
    const mapped = componentResource(id.value, options);
    if (!mapped.ok) return rejected(...mapped.diagnostics);
    const current = await snapshot(Object.freeze([mapped.value]), options);
    if (!current.ok) return snapshotFailure(current.diagnostics);
    const component = componentById(current.value, id.value);
    if (component === undefined) {
      return rejected(diagnostic("unknown-component", "Component mutation target does not exist"));
    }
    if (current.value.revisions.get(mapped.value) !== expectedRevision.value) {
      return revisionConflict();
    }
    const copiedPatch = copyGraphPayload(patchValue, "entity");
    if (!copiedPatch.ok) return rejected(...copiedPatch.diagnostics);
    if (
      typeof copiedPatch.value !== "object" ||
      copiedPatch.value === null ||
      Array.isArray(copiedPatch.value)
    ) {
      return rejected(diagnostic("invalid-component-patch", "Component patch must be a record"));
    }
    const patch = copiedPatch.value as GraphDataRecord;
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
      if (componentById(current.value, parent.value) === undefined) {
        return rejected(diagnostic("unknown-component-parent", "Reparent target does not exist"));
      }
    }
    const entity = options.graph.resolveEntity(current.value.graph, {
      expectedKind: STANDARD_COMPONENT_KIND,
      id: id.value,
    });
    if (!entity.ok) return rejected(...entity.diagnostics);
    const patched = options.model.patch(entity.value, patch as StandardComponentPatch);
    if (!patched.ok) return rejected(...patched.diagnostics);
    const computedEntity = Object.freeze({
      id: id.value,
      kind: STANDARD_COMPONENT_KIND,
      payload: patched.value.payload as GraphData,
    });
    const computed = options.model.parse(computedEntity);
    if (!computed.ok) return rejected(...computed.diagnostics);
    const plannedRelationships = planRelationshipChanges(
      relationshipChanges,
      id.value,
      current.value,
      options,
    );
    if (!plannedRelationships.ok) return rejected(...plannedRelationships.diagnostics);
    const patchKeys = Object.keys(patch);
    if (patchKeys.length === 0 && plannedRelationships.value.mutations.length === 0) {
      return rejected(diagnostic("empty-component-mutation", "Component update has no changes"));
    }
    const componentMutations =
      patchKeys.length === 0
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({ id: id.value, patch: patch as GraphDataRecord, type: "patch" }),
          ]);
    const transaction = standardTransactionRequest(
      componentMutations,
      plannedRelationships.value.mutations,
      Object.freeze([id.value]),
      plannedRelationships.value.affected,
      mapped.value,
      expectedRevision.value,
    );
    return executeMutation(
      transaction,
      new Map([[mapped.value, id.value]]),
      computed.value,
      options,
    );
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
    const validated = boundedRequest(request, "List components request");
    return validated.ok
      ? componentPage(
          validated.value,
          Object.freeze({ operation: "list-components" }),
          () => true,
          options,
        )
      : validated;
  };

  const listRoots = async (request: ListRootComponentsRequest): Promise<Result<ComponentPage>> => {
    const validated = boundedRequest(request, "List root components request");
    return validated.ok
      ? componentPage(
          validated.value,
          Object.freeze({ operation: "list-root-components" }),
          (component) => component.parent === undefined,
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
      ],
      "List child components request",
    );
    if (!validated.ok) return validated;
    if (typeof validated.value.parent !== "string") {
      return failure(diagnostic("invalid-entity-id", "Parent identity must be a string"));
    }
    const parent = parseEntityId(validated.value.parent);
    if (!parent.ok) return parent;
    const pageRequest = boundedRequest(
      Object.freeze({
        ...(Object.hasOwn(validated.value, "cursor")
          ? { cursor: validated.value.cursor as string }
          : {}),
        limit: validated.value.limit as number,
      }),
      "List child components page request",
    );
    return pageRequest.ok
      ? componentPage(
          pageRequest.value,
          Object.freeze({ operation: "list-child-components", parent: parent.value }),
          (component) => component.parent === parent.value,
          options,
        )
      : pageRequest;
  };

  return Object.freeze({
    createComponent,
    getComponent,
    initialize,
    listChildren,
    listComponents,
    listRoots,
    removeComponent,
    reparentComponent,
    updateComponent,
  });
}
