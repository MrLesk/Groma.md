import {
  failure,
  parseContentRevision,
  parseEntityId,
  parseGraphGeneration,
  parseResourceKey,
  success,
  type ContentRevision,
  type Diagnostic,
  type EntityDraft,
  type GraphGeneration,
  type GraphRelation,
  type GraphSnapshot,
  type PreparedBoundedQuery,
  type ResourceKey,
  type Result,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  STANDARD_COMPONENT_KIND,
  type StandardComponent,
  type StandardModelTransactionState,
  type StandardRelationship,
} from "../standard-model/index.ts";
import type {
  ApplicationOperations,
  ApplicationOperationsOptions,
  BoundedPageRequest,
  ComponentPage,
  ComponentView,
  ExactComponentRead,
  GetComponentRequest,
  InitializeWorkspaceRequest,
  ListChildComponentsRequest,
  ListComponentsRequest,
  ListRootComponentsRequest,
  RelationshipPage,
  RelationshipView,
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function validatePositiveBound(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
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

function denseArray(value: unknown, subject: string): Result<readonly unknown[]> {
  const length = inspectIntrinsicArrayLength(value, "invalid-standard-model-state", subject);
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

function validatedInitializationOutcome(value: unknown): Result<WorkspaceInitializationOutcome> {
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
  const values = denseArray(record.value.diagnostics, "Workspace initialization diagnostics");
  if (!values.ok) return values;
  const diagnostics: Diagnostic[] = [];
  for (let index = 0; index < values.value.length; index += 1) {
    const entry = inspectExactRecord(
      values.value[index],
      [["code", "message"]],
      "invalid-workspace-initialization-outcome",
      "Workspace initialization diagnostic",
    );
    if (
      !entry.ok ||
      typeof entry.value.code !== "string" ||
      typeof entry.value.message !== "string"
    ) {
      return failure(
        diagnostic(
          "invalid-workspace-initialization-outcome",
          "Workspace initialization diagnostics are malformed",
        ),
      );
    }
    diagnostics[index] = diagnostic(entry.value.code, entry.value.message);
  }
  return success(
    Object.freeze({
      diagnostics: Object.freeze(diagnostics),
      status: record.value.status,
    }),
  );
}

function loadState(value: unknown, options: ApplicationOperationsOptions): Result<LoadedState> {
  const copied = copyGraphPayload(value, "transaction");
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
  );
  if (!componentValues.ok) return componentValues;
  const relationshipValues = denseArray(
    envelope.value.relationships,
    "Standard Model transaction state relationships",
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
  const entries = denseArray(inspected.value.revisions, "Transaction provider revisions");
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
    if (!initial.ok) return initial;
    const prepared = options.queries.prepare(initial.value.generation, query, request);
    if (!prepared.ok) return prepared;
    const initialItems = initial.value.components.filter(filter);
    const initialPage = selectPage(initialItems, prepared.value);
    if (!initialPage.ok) return initialPage;
    const resources: ResourceKey[] = [];
    for (let index = 0; index < initialPage.value.items.length; index += 1) {
      const mapped = options.resourceMapper.resourceForComponent(
        initialPage.value.items[index]!.id,
      );
      if (!mapped.ok) return mapped;
      resources[index] = mapped.value;
    }
    const confirmed = await snapshot(Object.freeze(resources), options);
    if (!confirmed.ok) return confirmed;
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

export function createApplicationOperations(
  options: ApplicationOperationsOptions,
): ApplicationOperations {
  validatePositiveBound(options.maxSnapshotAttempts, "maxSnapshotAttempts");

  const initialize = async (
    request: InitializeWorkspaceRequest,
  ): Promise<Result<WorkspaceInitializationOutcome>> => {
    const validated = exactRequest(request, [[]], "Workspace initialization request");
    if (!validated.ok) return validated;
    try {
      return validatedInitializationOutcome(await options.initialization.initialize());
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
    const mapped = options.resourceMapper.resourceForComponent(id.value);
    if (!mapped.ok) return mapped;
    const read = await snapshot(Object.freeze([mapped.value]), options);
    if (!read.ok) return read;
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

  return Object.freeze({ getComponent, initialize, listChildren, listComponents, listRoots });
}
