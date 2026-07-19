import {
  createObservationSession,
  createOpaqueIdSource,
  failure,
  observationSessionApiVersion,
  parseContentRevision,
  parseEntityId,
  parseGraphGeneration,
  parseRelationId,
  success,
  type CompletedObservationSnapshot,
  type ContentRevision,
  type Diagnostic,
  type EntropySource,
  type GraphData,
  type GraphDataRecord,
  type ObservationRecord,
  type ResourceKey,
  type Result,
  type TransactionOutcome,
  type TransactionProvider,
} from "../core/index.ts";
import type {
  StandardComponent,
  StandardComponentInput,
  StandardComponentPatch,
  StandardRelationship,
} from "../standard-model/index.ts";
import type { ComponentResourceMapper, TransactionExecutionCapability } from "./contracts.ts";
import type { ApplicationSnapshotStateDecoder } from "./snapshot-state.ts";

export interface EvidenceResourceMapper {
  resourceForEvidence(): Result<ResourceKey>;
}

export interface ReconciliationBounds {
  readonly maxComponents: number;
  readonly maxEmbeddedItems: number;
  readonly maxRecords: number;
  readonly maxRelationships: number;
  readonly maxSnapshotAttempts: number;
  readonly maxSources: number;
}

export interface ReconciliationOptions {
  readonly bounds: ReconciliationBounds;
  readonly entropy: EntropySource;
  readonly evidenceResourceMapper: EvidenceResourceMapper;
  readonly resourceMapper: ComponentResourceMapper;
  readonly snapshotStateDecoder: ApplicationSnapshotStateDecoder;
  readonly transactionExecution: TransactionExecutionCapability;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

export type ReconciliationOutcome =
  | { readonly generation: number; readonly status: "committed" }
  | { readonly generation: number; readonly status: "unchanged" };

export interface ReconciliationOperations {
  reconcile(snapshot: CompletedObservationSnapshot): Promise<Result<ReconciliationOutcome>>;
}

interface AutomaticItem {
  readonly description?: string;
  readonly id: string;
  readonly name?: string;
}

interface ComponentProjection {
  readonly actions?: readonly AutomaticItem[];
  readonly iconDomain?: string;
  readonly inputs?: readonly AutomaticItem[];
  readonly label?: string;
  readonly name?: string;
  readonly outputs?: readonly AutomaticItem[];
  readonly summary?: string;
  readonly type?: string;
}

interface ComponentBinding {
  readonly componentId: string;
  readonly key: string;
  readonly present: boolean;
  readonly projection: ComponentProjection;
  readonly scope: string;
}

interface RelationshipProjection {
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

interface RelationshipBinding {
  readonly key: string;
  readonly present: boolean;
  readonly projection: RelationshipProjection;
  readonly relationId: string;
  readonly scope: string;
}

interface EvidenceSourceState {
  readonly componentBindings: readonly ComponentBinding[];
  readonly relationshipBindings: readonly RelationshipBinding[];
  readonly snapshot: CompletedObservationSnapshot;
  readonly sourceKey: string;
}

interface EvidenceState {
  readonly sources: readonly EvidenceSourceState[];
  readonly version: 1;
}

const maximumIdentityAttempts = 16;

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourceKey(snapshot: CompletedObservationSnapshot): string {
  return JSON.stringify([snapshot.projectId, snapshot.source.id, snapshot.source.instance]);
}

function qualified(scope: string, key: string): string {
  return `${scope}\u0000${key}`;
}

function itemId(scope: string, key: string): string {
  return `observation:${scope}:${key}`;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameObservationContent(
  left: CompletedObservationSnapshot,
  right: CompletedObservationSnapshot,
): boolean {
  return same({ ...left, epoch: undefined }, { ...right, epoch: undefined });
}

function canonicalSnapshot(
  value: unknown,
  maximumRecords: number,
): Result<CompletedObservationSnapshot> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(diagnostic("invalid-evidence-state", "Stored evidence snapshot is malformed"));
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (
    Object.keys(record).sort().join(",") !==
      "apiVersion,coverage,epoch,projectId,records,scopes,source" ||
    record.apiVersion !== observationSessionApiVersion ||
    !Array.isArray(record.records) ||
    record.records.length > maximumRecords
  ) {
    return failure(diagnostic("invalid-evidence-state", "Stored evidence snapshot is malformed"));
  }
  const session = createObservationSession({
    apiVersion: observationSessionApiVersion,
    epoch: record.epoch as string,
    projectId: record.projectId as string,
    scopes: record.scopes as CompletedObservationSnapshot["scopes"],
    source: record.source as CompletedObservationSnapshot["source"],
  });
  if (!session.ok)
    return failure(diagnostic("invalid-evidence-state", "Stored evidence snapshot is malformed"));
  let sequence = 0;
  for (let index = 0; index < record.records.length; index += 2_048) {
    sequence += 1;
    const submitted = session.value.submitBatch({
      epoch: record.epoch as string,
      records: record.records.slice(index, index + 2_048) as readonly ObservationRecord[],
      sequence,
    });
    if (!submitted.ok)
      return failure(diagnostic("invalid-evidence-state", "Stored evidence snapshot is malformed"));
  }
  const completed = session.value.complete({
    coverage: record.coverage as CompletedObservationSnapshot["coverage"],
    epoch: record.epoch as string,
    sequence: sequence + 1,
  });
  return completed.ok
    ? completed
    : failure(diagnostic("invalid-evidence-state", "Stored evidence snapshot is malformed"));
}

function projectionValue(value: unknown): Result<ComponentProjection> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(
      diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
    );
  }
  const record = value as Readonly<Record<string, unknown>>;
  const allowed = new Set([
    "actions",
    "iconDomain",
    "inputs",
    "label",
    "name",
    "outputs",
    "summary",
    "type",
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    return failure(
      diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
    );
  }
  for (const field of ["iconDomain", "label", "name", "summary", "type"] as const) {
    if (record[field] !== undefined && typeof record[field] !== "string") {
      return failure(
        diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
      );
    }
  }
  for (const field of ["actions", "inputs", "outputs"] as const) {
    if (record[field] === undefined) continue;
    if (!Array.isArray(record[field])) {
      return failure(
        diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
      );
    }
    for (const item of record[field]) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return failure(
          diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
        );
      }
      const entry = item as Readonly<Record<string, unknown>>;
      if (
        !["id", "id,name", "description,id", "description,id,name"].includes(
          Object.keys(entry).sort().join(","),
        ) ||
        typeof entry.id !== "string" ||
        (entry.name !== undefined && typeof entry.name !== "string") ||
        (entry.description !== undefined && typeof entry.description !== "string")
      ) {
        return failure(
          diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
        );
      }
    }
  }
  return success(record as unknown as ComponentProjection);
}

function parseEvidenceState(value: unknown, bounds: ReconciliationBounds): Result<EvidenceState> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "sources,version"
  ) {
    return failure(diagnostic("invalid-evidence-state", "Canonical evidence state is malformed"));
  }
  const envelope = value as Readonly<Record<string, unknown>>;
  if (
    envelope.version !== 1 ||
    !Array.isArray(envelope.sources) ||
    envelope.sources.length > bounds.maxSources
  ) {
    return failure(diagnostic("invalid-evidence-state", "Canonical evidence state is malformed"));
  }
  const sources: EvidenceSourceState[] = [];
  const globallyBoundComponents = new Set<string>();
  const globallyBoundRelations = new Set<string>();
  let previous = "";
  for (const input of envelope.sources) {
    if (
      typeof input !== "object" ||
      input === null ||
      Array.isArray(input) ||
      Object.keys(input).sort().join(",") !==
        "componentBindings,relationshipBindings,snapshot,sourceKey"
    ) {
      return failure(
        diagnostic("invalid-evidence-state", "Canonical evidence source is malformed"),
      );
    }
    const source = input as Readonly<Record<string, unknown>>;
    if (
      typeof source.sourceKey !== "string" ||
      source.sourceKey <= previous ||
      !Array.isArray(source.componentBindings) ||
      source.componentBindings.length > bounds.maxComponents ||
      !Array.isArray(source.relationshipBindings) ||
      source.relationshipBindings.length > bounds.maxRelationships
    ) {
      return failure(
        diagnostic("invalid-evidence-state", "Canonical evidence source is malformed"),
      );
    }
    const snapshot = canonicalSnapshot(source.snapshot, bounds.maxRecords);
    if (!snapshot.ok || source.sourceKey !== sourceKey(snapshot.value)) {
      return failure(
        diagnostic("invalid-evidence-state", "Canonical evidence source is malformed"),
      );
    }
    const componentBindings: ComponentBinding[] = [];
    let priorBinding = "";
    const sourceComponents = new Set<string>();
    for (const inputBinding of source.componentBindings) {
      if (
        typeof inputBinding !== "object" ||
        inputBinding === null ||
        Array.isArray(inputBinding) ||
        Object.keys(inputBinding).sort().join(",") !== "componentId,key,present,projection,scope"
      ) {
        return failure(
          diagnostic("invalid-evidence-state", "Canonical component binding is malformed"),
        );
      }
      const binding = inputBinding as Readonly<Record<string, unknown>>;
      const id =
        typeof binding.componentId === "string"
          ? parseEntityId(binding.componentId)
          : failure(diagnostic("invalid", "invalid"));
      const projection = projectionValue(binding.projection);
      const identity = `${binding.scope}\u0000${binding.key}`;
      if (
        !id.ok ||
        !projection.ok ||
        typeof binding.scope !== "string" ||
        typeof binding.key !== "string" ||
        typeof binding.present !== "boolean" ||
        identity <= priorBinding ||
        globallyBoundComponents.has(id.value)
      ) {
        return failure(
          diagnostic("invalid-evidence-state", "Canonical component binding is malformed"),
        );
      }
      globallyBoundComponents.add(id.value);
      sourceComponents.add(id.value);
      priorBinding = identity;
      componentBindings.push(
        Object.freeze({
          componentId: id.value,
          key: binding.key,
          present: binding.present,
          projection: projection.value,
          scope: binding.scope,
        }),
      );
    }
    const relationshipBindings: RelationshipBinding[] = [];
    priorBinding = "";
    for (const inputBinding of source.relationshipBindings) {
      if (
        typeof inputBinding !== "object" ||
        inputBinding === null ||
        Array.isArray(inputBinding) ||
        Object.keys(inputBinding).sort().join(",") !== "key,present,projection,relationId,scope"
      ) {
        return failure(
          diagnostic("invalid-evidence-state", "Canonical relationship binding is malformed"),
        );
      }
      const binding = inputBinding as Readonly<Record<string, unknown>>;
      const id =
        typeof binding.relationId === "string"
          ? parseRelationId(binding.relationId)
          : failure(diagnostic("invalid", "invalid"));
      const projection = binding.projection as Readonly<Record<string, unknown>>;
      const identity = `${binding.scope}\u0000${binding.key}`;
      if (
        !id.ok ||
        typeof binding.scope !== "string" ||
        typeof binding.key !== "string" ||
        typeof binding.present !== "boolean" ||
        identity <= priorBinding ||
        globallyBoundRelations.has(id.value) ||
        typeof projection !== "object" ||
        projection === null ||
        Array.isArray(projection) ||
        Object.keys(projection).sort().join(",") !== "source,target,type" ||
        !parseEntityId(projection.source as string).ok ||
        !parseEntityId(projection.target as string).ok ||
        !sourceComponents.has(projection.source as string) ||
        !sourceComponents.has(projection.target as string) ||
        typeof projection.type !== "string"
      ) {
        return failure(
          diagnostic("invalid-evidence-state", "Canonical relationship binding is malformed"),
        );
      }
      globallyBoundRelations.add(id.value);
      priorBinding = identity;
      relationshipBindings.push(
        Object.freeze({
          key: binding.key,
          present: binding.present,
          projection: Object.freeze({
            source: projection.source as string,
            target: projection.target as string,
            type: projection.type,
          }),
          relationId: id.value,
          scope: binding.scope,
        }),
      );
    }
    sources.push(
      Object.freeze({
        componentBindings: Object.freeze(componentBindings),
        relationshipBindings: Object.freeze(relationshipBindings),
        snapshot: snapshot.value,
        sourceKey: source.sourceKey,
      }),
    );
    previous = source.sourceKey;
  }
  return success(Object.freeze({ sources: Object.freeze(sources), version: 1 }));
}

function automaticItems(
  records: readonly ObservationRecord[],
  kind: "action" | "input" | "output",
  componentKey: string,
): readonly AutomaticItem[] | undefined {
  const items: AutomaticItem[] = [];
  for (const record of records) {
    if (
      (record.kind !== "action" && record.kind !== "input" && record.kind !== "output") ||
      record.kind !== kind ||
      qualified(record.component.scope, record.component.key) !== componentKey
    ) {
      continue;
    }
    items.push(
      Object.freeze({
        ...(record.description === undefined ? {} : { description: record.description }),
        id: itemId(record.scope, record.key),
        ...(record.name === undefined ? {} : { name: record.name }),
      }),
    );
  }
  items.sort((left, right) => compareText(left.id, right.id));
  return items.length === 0 ? undefined : Object.freeze(items);
}

function hasCompleteCoverage(
  snapshot: CompletedObservationSnapshot,
  scope: string,
  kind: ObservationRecord["kind"],
): boolean {
  return snapshot.coverage.some(
    (entry) => entry.scope === scope && entry.state === "complete" && entry.kinds.includes(kind),
  );
}

function componentProjection(
  record: Extract<ObservationRecord, { kind: "component-candidate" }>,
  snapshot: CompletedObservationSnapshot,
  previous?: ComponentProjection,
): ComponentProjection {
  const key = qualified(record.scope, record.key);
  const inputs = hasCompleteCoverage(snapshot, record.scope, "input")
    ? automaticItems(snapshot.records, "input", key)
    : previous?.inputs;
  const outputs = hasCompleteCoverage(snapshot, record.scope, "output")
    ? automaticItems(snapshot.records, "output", key)
    : previous?.outputs;
  const actions = hasCompleteCoverage(snapshot, record.scope, "action")
    ? automaticItems(snapshot.records, "action", key)
    : previous?.actions;
  return Object.freeze({
    ...record.candidate,
    ...(inputs === undefined ? {} : { inputs }),
    ...(outputs === undefined ? {} : { outputs }),
    ...(actions === undefined ? {} : { actions }),
  });
}

function componentInput(id: string, projection: ComponentProjection): StandardComponentInput {
  return Object.freeze({ id, ...projection }) as unknown as StandardComponentInput;
}

function currentItems(value: StandardComponent["actions"]): readonly AutomaticItem[] | undefined {
  if (value === undefined) return undefined;
  const items: AutomaticItem[] = [];
  for (const item of value) {
    if (Object.keys(item.extensions).length > 0) return undefined;
    items.push(
      Object.freeze({
        ...(item.description === undefined ? {} : { description: item.description }),
        id: item.id,
        ...(item.name === undefined ? {} : { name: item.name }),
      }),
    );
  }
  return Object.freeze(items);
}

function ownedPatch(
  component: StandardComponent,
  previous: ComponentProjection,
  next: ComponentProjection,
): StandardComponentPatch {
  const patch: Record<string, unknown> = {};
  for (const field of ["iconDomain", "label", "name", "summary", "type"] as const) {
    if (component[field] === previous[field] && component[field] !== next[field]) {
      patch[field] = next[field] ?? null;
    }
  }
  for (const field of ["actions", "inputs", "outputs"] as const) {
    if (
      same(currentItems(component[field]), previous[field]) &&
      !same(previous[field], next[field])
    ) {
      patch[field] = next[field] ?? null;
    }
  }
  return Object.freeze(patch) as StandardComponentPatch;
}

function relationshipMatches(
  value: StandardRelationship,
  projection: RelationshipProjection,
): boolean {
  return (
    value.source === projection.source &&
    value.target === projection.target &&
    value.type === projection.type &&
    value.description === undefined &&
    Object.keys(value.extensions).length === 0
  );
}

function evidenceGraphData(state: EvidenceState): GraphData {
  return state as unknown as GraphData;
}

function evidenceFromSnapshotState(value: unknown): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>).evidence
    : undefined;
}

function revisionMap(value: unknown): Result<Map<string, ContentRevision | null>> {
  if (!Array.isArray(value))
    return failure(
      diagnostic("reconciliation-snapshot-failed", "Canonical revisions are malformed"),
    );
  const result = new Map<string, ContentRevision | null>();
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return failure(
        diagnostic("reconciliation-snapshot-failed", "Canonical revisions are malformed"),
      );
    const record = item as Readonly<Record<string, unknown>>;
    if (typeof record.resource !== "string" || result.has(record.resource))
      return failure(
        diagnostic("reconciliation-snapshot-failed", "Canonical revisions are malformed"),
      );
    const parsed =
      record.revision === null ? null : parseContentRevision(record.revision as string);
    if (parsed !== null && !parsed.ok)
      return failure(
        diagnostic("reconciliation-snapshot-failed", "Canonical revisions are malformed"),
      );
    result.set(record.resource, parsed === null ? null : parsed.value);
  }
  return success(result);
}

function outcomeResult(outcome: TransactionOutcome): Result<ReconciliationOutcome> {
  if (outcome.status === "committed")
    return success(Object.freeze({ generation: outcome.generation, status: "committed" }));
  return failure(
    ...outcome.diagnostics.map((item) => Object.freeze({ code: item.code, message: item.message })),
  );
}

function mintIdentity(
  next: () => string,
  unavailable: ReadonlySet<string>,
  code: string,
): Result<string> {
  for (let attempt = 0; attempt < maximumIdentityAttempts; attempt += 1) {
    try {
      const id = next();
      if (!unavailable.has(id)) return success(id);
    } catch {
      break;
    }
  }
  return failure(diagnostic(code, "A unique opaque reconciliation identity is unavailable"));
}

export function createReconciliationOperations(
  options: ReconciliationOptions,
): ReconciliationOperations {
  for (const [name, value] of Object.entries(options.bounds)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new RangeError(`${name} must be a positive safe integer`);
  }
  const ids = createOpaqueIdSource(options.entropy);

  const reconcile = async (
    input: CompletedObservationSnapshot,
  ): Promise<Result<ReconciliationOutcome>> => {
    const snapshot = canonicalSnapshot(input, options.bounds.maxRecords);
    if (!snapshot.ok) return snapshot;
    const evidenceResource = options.evidenceResourceMapper.resourceForEvidence();
    if (!evidenceResource.ok) return evidenceResource;

    for (let attempt = 0; attempt < options.bounds.maxSnapshotAttempts; attempt += 1) {
      let initial: Awaited<ReturnType<TransactionProvider["snapshot"]>>;
      try {
        initial = await options.transactionProvider.snapshot([evidenceResource.value]);
      } catch {
        return failure(
          diagnostic("reconciliation-snapshot-failed", "Canonical state could not be read"),
        );
      }
      const generation = parseGraphGeneration(initial.generation);
      const decoded = options.snapshotStateDecoder.decode(initial.state);
      const evidence = parseEvidenceState(
        evidenceFromSnapshotState(initial.state) ?? { sources: [], version: 1 },
        options.bounds,
      );
      const initialRevisions = revisionMap(initial.revisions);
      if (!generation.ok || !decoded.ok || !evidence.ok || !initialRevisions.ok) {
        return failure(
          diagnostic("reconciliation-snapshot-failed", "Canonical state could not be read"),
        );
      }
      const key = sourceKey(snapshot.value);
      const priorSource = evidence.value.sources.find((source) => source.sourceKey === key);
      if (priorSource === undefined && evidence.value.sources.length >= options.bounds.maxSources) {
        return failure(
          diagnostic(
            "reconciliation-source-limit",
            "Canonical evidence source capacity is exhausted",
          ),
        );
      }
      const existingComponents = new Map<string, StandardComponent>(
        decoded.value.components.map((component) => [component.id, component]),
      );
      const existingRelationships = new Map<string, StandardRelationship>(
        decoded.value.relationships.map((relationship) => [relationship.id, relationship]),
      );
      if (
        priorSource?.componentBindings.some(
          (binding) => !existingComponents.has(binding.componentId),
        ) ||
        priorSource?.relationshipBindings.some(
          (binding) => binding.present && !existingRelationships.has(binding.relationId),
        )
      ) {
        return failure(
          diagnostic("reconciliation-binding-missing", "A durable binding target is missing"),
        );
      }
      if (
        priorSource !== undefined &&
        sameObservationContent(priorSource.snapshot, snapshot.value)
      ) {
        return success(Object.freeze({ generation: generation.value, status: "unchanged" }));
      }
      const componentRecords = snapshot.value.records.filter(
        (record): record is Extract<ObservationRecord, { kind: "component-candidate" }> =>
          record.kind === "component-candidate",
      );
      if (componentRecords.length > options.bounds.maxComponents) {
        return failure(
          diagnostic("reconciliation-component-limit", "Observed component capacity is exceeded"),
        );
      }
      const priorComponents = new Map(
        (priorSource?.componentBindings ?? []).map((binding) => [
          qualified(binding.scope, binding.key),
          binding,
        ]),
      );
      const componentBindings = new Map(priorComponents);
      const unavailableComponents = new Set([
        ...evidence.value.sources.flatMap((source) =>
          source.componentBindings.map((binding) => binding.componentId),
        ),
        ...existingComponents.keys(),
      ]);
      const componentMutations: GraphDataRecord[] = [];
      const touchedComponents = new Set<string>();
      for (const record of componentRecords) {
        const identity = qualified(record.scope, record.key);
        let binding = componentBindings.get(identity);
        if (binding === undefined) {
          const componentId = mintIdentity(
            ids.nextEntityId,
            unavailableComponents,
            "component-identity-unavailable",
          );
          if (!componentId.ok) return componentId;
          unavailableComponents.add(componentId.value);
          binding = Object.freeze({
            componentId: componentId.value,
            key: record.key,
            present: true,
            projection: componentProjection(record, snapshot.value),
            scope: record.scope,
          });
          componentBindings.set(identity, binding);
          componentMutations.push(
            Object.freeze({
              component: componentInput(
                componentId.value,
                binding.projection,
              ) as unknown as GraphData,
              type: "create",
            }),
          );
          touchedComponents.add(componentId.value);
          continue;
        }
        const nextProjection = componentProjection(record, snapshot.value, binding.projection);
        const existing = existingComponents.get(binding.componentId);
        if (existing === undefined)
          return failure(
            diagnostic("reconciliation-binding-missing", "A component binding target is missing"),
          );
        const patch = ownedPatch(existing, binding.projection, nextProjection);
        if (Object.keys(patch).length > 0) {
          componentMutations.push(
            Object.freeze({
              id: binding.componentId,
              patch: patch as unknown as GraphData,
              type: "patch",
            }),
          );
          touchedComponents.add(binding.componentId);
        }
        componentBindings.set(
          identity,
          Object.freeze({ ...binding, present: true, projection: nextProjection }),
        );
      }
      for (const [identity, binding] of componentBindings) {
        if (
          !componentRecords.some((record) => qualified(record.scope, record.key) === identity) &&
          hasCompleteCoverage(snapshot.value, binding.scope, "component-candidate")
        )
          componentBindings.set(identity, Object.freeze({ ...binding, present: false }));
      }
      if (componentBindings.size > options.bounds.maxComponents) {
        return failure(
          diagnostic(
            "reconciliation-component-limit",
            "Canonical component binding capacity is exceeded",
          ),
        );
      }
      const componentIds = new Map(
        [...componentBindings].map(([identity, binding]) => [identity, binding.componentId]),
      );
      const currentComponentIdentities = new Set(
        componentRecords.map((record) => qualified(record.scope, record.key)),
      );
      const embeddedItemCounts = new Map<string, number>();
      for (const record of snapshot.value.records) {
        if (record.kind !== "action" && record.kind !== "input" && record.kind !== "output") {
          continue;
        }
        const reference = qualified(record.component.scope, record.component.key);
        if (!componentIds.has(reference) || !currentComponentIdentities.has(reference)) {
          return failure(
            diagnostic(
              "unresolved-observation-reference",
              "An observed component member is not exactly bound in this snapshot",
            ),
          );
        }
        const count = (embeddedItemCounts.get(reference) ?? 0) + 1;
        if (count > options.bounds.maxEmbeddedItems) {
          return failure(
            diagnostic(
              "reconciliation-item-limit",
              "Observed component member capacity is exceeded",
            ),
          );
        }
        embeddedItemCounts.set(reference, count);
      }
      const relationshipRecords = snapshot.value.records.filter(
        (record): record is Extract<ObservationRecord, { kind: "relationship" }> =>
          record.kind === "relationship",
      );
      if (relationshipRecords.length > options.bounds.maxRelationships) {
        return failure(
          diagnostic(
            "reconciliation-relationship-limit",
            "Observed relationship capacity is exceeded",
          ),
        );
      }
      const priorRelationships = new Map(
        (priorSource?.relationshipBindings ?? []).map((binding) => [
          qualified(binding.scope, binding.key),
          binding,
        ]),
      );
      const relationshipBindings = new Map(priorRelationships);
      const unavailableRelations = new Set([
        ...evidence.value.sources.flatMap((source) =>
          source.relationshipBindings.map((binding) => binding.relationId),
        ),
        ...existingRelationships.keys(),
      ]);
      const relationshipMutations: GraphDataRecord[] = [];
      const touchedRelationships = new Set<string>();
      for (const record of relationshipRecords) {
        const identity = qualified(record.scope, record.key);
        const source = componentIds.get(qualified(record.from.scope, record.from.key));
        const target = componentIds.get(qualified(record.to.scope, record.to.key));
        if (source === undefined || target === undefined)
          return failure(
            diagnostic(
              "unresolved-observation-reference",
              "An observed relationship endpoint is not exactly bound",
            ),
          );
        const projection = Object.freeze({ source, target, type: record.relationshipType });
        let binding = relationshipBindings.get(identity);
        if (binding === undefined) {
          const relationId = mintIdentity(
            ids.nextRelationId,
            unavailableRelations,
            "relationship-identity-unavailable",
          );
          if (!relationId.ok) return relationId;
          unavailableRelations.add(relationId.value);
          binding = Object.freeze({
            key: record.key,
            present: true,
            projection,
            relationId: relationId.value,
            scope: record.scope,
          });
          relationshipBindings.set(identity, binding);
          relationshipMutations.push(
            Object.freeze({
              relationship: Object.freeze({
                id: relationId.value,
                payload: Object.freeze({}),
                source,
                target,
                type: record.relationshipType,
              }),
              type: "upsert",
            }),
          );
          touchedComponents.add(source);
          touchedRelationships.add(relationId.value);
          continue;
        }
        const existing = existingRelationships.get(binding.relationId);
        if (existing === undefined) {
          if (binding.present) {
            return failure(
              diagnostic(
                "reconciliation-binding-missing",
                "A relationship binding target is missing",
              ),
            );
          }
          relationshipMutations.push(
            Object.freeze({
              relationship: Object.freeze({
                id: binding.relationId,
                payload: Object.freeze({}),
                source,
                target,
                type: record.relationshipType,
              }),
              type: "upsert",
            }),
          );
          touchedComponents.add(source);
          touchedRelationships.add(binding.relationId);
          relationshipBindings.set(
            identity,
            Object.freeze({ ...binding, present: true, projection }),
          );
          continue;
        }
        if (
          relationshipMatches(existing, binding.projection) &&
          !same(binding.projection, projection)
        ) {
          relationshipMutations.push(
            Object.freeze({
              relationship: Object.freeze({
                id: binding.relationId,
                payload: Object.freeze({}),
                source,
                target,
                type: record.relationshipType,
              }),
              type: "upsert",
            }),
          );
          touchedComponents.add(binding.projection.source);
          touchedComponents.add(source);
          touchedRelationships.add(binding.relationId);
        }
        relationshipBindings.set(
          identity,
          Object.freeze({ ...binding, present: true, projection }),
        );
      }
      for (const [identity, binding] of relationshipBindings) {
        if (relationshipRecords.some((record) => qualified(record.scope, record.key) === identity))
          continue;
        if (!hasCompleteCoverage(snapshot.value, binding.scope, "relationship")) continue;
        const existing = existingRelationships.get(binding.relationId);
        if (existing !== undefined && relationshipMatches(existing, binding.projection)) {
          relationshipMutations.push(Object.freeze({ id: binding.relationId, type: "remove" }));
          touchedComponents.add(binding.projection.source);
          touchedRelationships.add(binding.relationId);
        }
        relationshipBindings.set(identity, Object.freeze({ ...binding, present: false }));
      }
      if (relationshipBindings.size > options.bounds.maxRelationships) {
        return failure(
          diagnostic(
            "reconciliation-relationship-limit",
            "Canonical relationship binding capacity is exceeded",
          ),
        );
      }
      const nextSource: EvidenceSourceState = Object.freeze({
        componentBindings: Object.freeze(
          [...componentBindings.values()].sort((left, right) =>
            compareText(qualified(left.scope, left.key), qualified(right.scope, right.key)),
          ),
        ),
        relationshipBindings: Object.freeze(
          [...relationshipBindings.values()].sort((left, right) =>
            compareText(qualified(left.scope, left.key), qualified(right.scope, right.key)),
          ),
        ),
        snapshot: snapshot.value,
        sourceKey: key,
      });
      const sources = evidence.value.sources
        .filter((source) => source.sourceKey !== key)
        .concat(nextSource)
        .sort((left, right) => compareText(left.sourceKey, right.sourceKey));
      const nextEvidence: EvidenceState = Object.freeze({
        sources: Object.freeze(sources),
        version: 1,
      });
      const expectedRevisions: Array<{ expected: string | null; resource: string }> = [
        {
          expected: initialRevisions.value.get(evidenceResource.value) ?? null,
          resource: evidenceResource.value,
        },
      ];
      for (const id of touchedComponents) {
        const resource = options.resourceMapper.resourceForComponent(id);
        if (!resource.ok) return resource;
        const component = existingComponents.get(id);
        expectedRevisions.push({
          expected:
            component === undefined ? null : (initialRevisions.value.get(resource.value) ?? null),
          resource: resource.value,
        });
      }
      const requestedResources = expectedRevisions.map((entry) => entry.resource).sort(compareText);
      if (
        requestedResources.some(
          (resource, index) => index > 0 && requestedResources[index - 1] === resource,
        )
      ) {
        return failure(
          diagnostic("reconciliation-resource-conflict", "Reconciliation resources are ambiguous"),
        );
      }
      if (touchedComponents.size > 0) {
        try {
          const confirmed = await options.transactionProvider.snapshot(
            requestedResources as ResourceKey[],
          );
          if (confirmed.generation !== initial.generation || !same(confirmed.state, initial.state))
            continue;
          const confirmedRevisions = revisionMap(confirmed.revisions);
          if (!confirmedRevisions.ok) continue;
          for (const entry of expectedRevisions)
            entry.expected = confirmedRevisions.value.get(entry.resource) ?? null;
        } catch {
          return failure(
            diagnostic("reconciliation-snapshot-failed", "Canonical state could not be confirmed"),
          );
        }
      }
      const outcome = await options.transactionExecution.execute(
        Object.freeze({
          affected: Object.freeze({
            entities: Object.freeze([...touchedComponents].sort(compareText)),
            relations: Object.freeze([...touchedRelationships].sort(compareText)),
          }),
          context: Object.freeze({
            ownership: Object.freeze({ owner: key, plane: "evidence" }),
            pinnedComponentIds: Object.freeze([]),
          }),
          expectedRevisions: Object.freeze(
            expectedRevisions.sort((left, right) => compareText(left.resource, right.resource)),
          ),
          mutation: Object.freeze({
            components: Object.freeze(componentMutations),
            evidence: evidenceGraphData(nextEvidence),
            relationships: Object.freeze(relationshipMutations),
          }),
        }),
      );
      return outcomeResult(outcome);
    }
    return failure(
      diagnostic(
        "reconciliation-snapshot-conflict",
        "Canonical state changed repeatedly during reconciliation",
      ),
    );
  };

  return Object.freeze({ reconcile });
}
