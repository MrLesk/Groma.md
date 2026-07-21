import {
  observedContainmentRelationshipType,
  canonicalizeCompletedObservationSnapshot,
  createOpaqueIdSource,
  failure,
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
  type GraphKernel,
  type ObservationRecord,
  type ResourceKey,
  type Result,
  type TransactionRecovery,
  type TransactionOutcome,
  type TransactionProvider,
} from "../core/index.ts";
import type {
  StandardComponent,
  StandardComponentInput,
  StandardComponentPatch,
  StandardComponentScale,
  StandardRelationship,
} from "../standard-model/index.ts";
import { isStandardComponentScale, STANDARD_COMPONENT_SCALES } from "../standard-model/index.ts";
import type { ComponentResourceMapper, TransactionExecutionCapability } from "./contracts.ts";
import type { ApplicationSnapshotStateDecoder } from "./snapshot-state.ts";
import { copyGraphPayload } from "../core/payload.ts";
import {
  DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1,
  deriveStructuralScaleProposalV1,
  STRUCTURAL_SCALE_DERIVATION_V1,
  validateStructuralScaleProposalConfigurationV1,
  type StructuralScaleAssessmentV1,
  type StructuralScaleProposalConfigurationV1,
} from "./scale-proposal.ts";
import {
  observedScaleForDepth,
  observedSharedFromSignals,
  resolveObservedStructure,
} from "./observed-structure.ts";
import { observedSummaryFromDocumentation } from "./observed-documentation.ts";

export interface EvidenceResourceMapper {
  resourceForEvidence(): Result<ResourceKey>;
  resourceForEvidenceSource(sourceKey: string): Result<ResourceKey>;
}

export interface ReconciliationBounds {
  readonly maxComponents: number;
  readonly maxEmbeddedItems: number;
  readonly maxRecords: number;
  readonly maxRelationships: number;
  readonly maxSnapshotAttempts: number;
  readonly maxSources: number;
  readonly maxTransactionDataDepth: number;
  readonly maxTransactionDataValues: number;
}

export interface ReconciliationOptions {
  readonly bounds: ReconciliationBounds;
  readonly entropy: EntropySource;
  readonly evidenceResourceMapper: EvidenceResourceMapper;
  readonly graph: Pick<GraphKernel, "resolveEntityIdentity">;
  readonly resourceMapper: ComponentResourceMapper;
  readonly snapshotStateDecoder: ApplicationSnapshotStateDecoder;
  readonly structuralScaleProposal?: StructuralScaleProposalConfigurationV1;
  readonly transactionExecution: TransactionExecutionCapability;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

export type ReconciliationOutcome =
  | { readonly generation: number; readonly status: "committed" }
  | {
      readonly diagnostics: readonly Diagnostic[];
      readonly recovery: TransactionRecovery;
      readonly status: "indeterminate";
    }
  | { readonly generation: number; readonly status: "unchanged" };

export interface ReconciliationOperations {
  reconcile(snapshot: CompletedObservationSnapshot): Promise<Result<ReconciliationOutcome>>;
}

interface ComponentProjection {
  readonly iconDomain?: string;
  readonly label?: string;
  readonly name?: string;
  readonly parent?: string;
  readonly scale?: string;
  readonly shared?: boolean;
  readonly summary?: string;
  readonly type?: string;
}

export interface ComponentBinding {
  readonly componentId: string;
  readonly key: string;
  readonly present: boolean;
  readonly projection: ComponentProjection;
  readonly scaleAssessment?: StructuralScaleAssessmentV1;
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
  readonly removed: boolean;
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

function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return false;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => same(value, right[index]));
  }
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) => key === rightKeys[index] && same(leftRecord[key], rightRecord[key]),
    )
  );
}

function sameObservationContent(
  left: CompletedObservationSnapshot,
  right: CompletedObservationSnapshot,
): boolean {
  return same(
    [left.apiVersion, left.projectId, left.scopes, left.source, left.records, left.coverage],
    [right.apiVersion, right.projectId, right.scopes, right.source, right.records, right.coverage],
  );
}

function canonicalSnapshot(
  value: unknown,
  maximumRecords: number,
): Result<CompletedObservationSnapshot> {
  const snapshot = canonicalizeCompletedObservationSnapshot(value, {
    maxRecords: maximumRecords,
  });
  return snapshot.ok
    ? snapshot
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
    "iconDomain",
    "label",
    "name",
    "parent",
    "scale",
    "shared",
    "summary",
    "type",
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    return failure(
      diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
    );
  }
  if (record.shared !== undefined && typeof record.shared !== "boolean") {
    return failure(
      diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
    );
  }
  for (const field of [
    "iconDomain",
    "label",
    "name",
    "parent",
    "scale",
    "summary",
    "type",
  ] as const) {
    if (record[field] !== undefined && typeof record[field] !== "string") {
      return failure(
        diagnostic("invalid-evidence-state", "Stored component projection is malformed"),
      );
    }
  }
  return success(record as unknown as ComponentProjection);
}

function scaleAssessmentValue(value: unknown): Result<StructuralScaleAssessmentV1> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(
      diagnostic("invalid-evidence-state", "Stored structural scale assessment is malformed"),
    );
  }
  const assessment = value as Readonly<Record<string, unknown>>;
  if (assessment.derivation !== STRUCTURAL_SCALE_DERIVATION_V1) {
    return failure(
      diagnostic("invalid-evidence-state", "Stored structural scale assessment is malformed"),
    );
  }
  if (
    assessment.status === "insufficient" &&
    Object.keys(assessment).sort().join(",") === "derivation,status"
  ) {
    return success(
      Object.freeze({
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        status: "insufficient" as const,
      }),
    );
  }
  if (
    assessment.status === "proposed" &&
    Object.keys(assessment).sort().join(",") === "derivation,proposal,status" &&
    typeof assessment.proposal === "string" &&
    isStandardComponentScale(assessment.proposal)
  ) {
    return success(
      Object.freeze({
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        proposal: assessment.proposal,
        status: "proposed" as const,
      }),
    );
  }
  if (
    assessment.status === "ambiguous" &&
    Object.keys(assessment).sort().join(",") === "candidates,derivation,status" &&
    Array.isArray(assessment.candidates) &&
    assessment.candidates.length >= 2 &&
    assessment.candidates.length <= STANDARD_COMPONENT_SCALES.length &&
    assessment.candidates.every(
      (candidate, index) =>
        typeof candidate === "string" &&
        isStandardComponentScale(candidate) &&
        candidate ===
          STANDARD_COMPONENT_SCALES.filter((scale) =>
            (assessment.candidates as readonly unknown[]).includes(scale),
          )[index],
    )
  ) {
    return success(
      Object.freeze({
        candidates: Object.freeze(
          (assessment.candidates as readonly StandardComponentScale[]).slice(),
        ),
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        status: "ambiguous" as const,
      }),
    );
  }
  return failure(
    diagnostic("invalid-evidence-state", "Stored structural scale assessment is malformed"),
  );
}

export function parseEvidenceState(
  value: unknown,
  bounds: Pick<
    ReconciliationBounds,
    "maxComponents" | "maxRecords" | "maxRelationships" | "maxSources"
  >,
): Result<EvidenceState> {
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
        ![
          "componentId,key,present,projection,scope",
          "componentId,key,present,projection,scaleAssessment,scope",
        ].includes(Object.keys(inputBinding).sort().join(","))
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
      const scaleAssessment = Object.hasOwn(binding, "scaleAssessment")
        ? scaleAssessmentValue(binding.scaleAssessment)
        : success(undefined);
      const identity = `${binding.scope}\u0000${binding.key}`;
      if (
        !id.ok ||
        !projection.ok ||
        !scaleAssessment.ok ||
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
          ...(scaleAssessment.value === undefined
            ? {}
            : { scaleAssessment: scaleAssessment.value }),
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
        Object.keys(inputBinding).sort().join(",") !==
          "key,present,projection,relationId,removed,scope"
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
        typeof binding.removed !== "boolean" ||
        (binding.present && binding.removed) ||
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
          removed: binding.removed,
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

function hasCompleteCoverage(
  snapshot: CompletedObservationSnapshot,
  scope: string,
  kind: ObservationRecord["kind"],
): boolean {
  return snapshot.coverage.some(
    (entry) => entry.scope === scope && entry.state === "complete" && entry.kinds.includes(kind),
  );
}

/** How deeply a documented resource is buried, so the nearest one can win. */
function documentationDepth(record: Extract<ObservationRecord, { kind: "documentation" }>): number {
  let shallowest = Number.POSITIVE_INFINITY;
  for (const item of record.provenance ?? []) {
    const resource = (item as { readonly resource?: unknown }).resource;
    if (typeof resource !== "string") continue;
    shallowest = Math.min(shallowest, resource.split("/").length);
  }
  return shallowest;
}

/**
 * Repeats what the source says about a component, when it says anything.
 *
 * Documentation that sits at the component's own level describes the component;
 * documentation buried deeper inside it describes one of its parts. So the
 * shallowest record wins, and ties break on key so one snapshot always yields
 * one sentence. A project that documents nothing simply has no summary: the
 * blueprint never writes a description on the source's behalf.
 */
function observedSummary(
  snapshot: CompletedObservationSnapshot,
  componentKey: string,
  name?: string,
): string | undefined {
  const documents = snapshot.records
    .filter(
      (record): record is Extract<ObservationRecord, { kind: "documentation" }> =>
        record.kind === "documentation" &&
        record.subject !== undefined &&
        qualified(record.subject.scope, record.subject.key) === componentKey,
    )
    .sort(
      (left, right) =>
        documentationDepth(left) - documentationDepth(right) || compareText(left.key, right.key),
    );
  for (const document of documents) {
    const summary = observedSummaryFromDocumentation(document.content, document.format, name);
    if (summary !== undefined) return summary;
  }
  return undefined;
}

function componentProjection(
  record: Extract<ObservationRecord, { kind: "component-candidate" }>,
  snapshot: CompletedObservationSnapshot,
): ComponentProjection {
  const key = qualified(record.scope, record.key);
  // A summary the scanner stated itself is already the candidate's own claim;
  // the derived one only fills the gap where the candidate offered none.
  const summary = record.candidate.summary ?? observedSummary(snapshot, key, record.candidate.name);
  return Object.freeze({
    ...record.candidate,
    ...(summary === undefined ? {} : { summary }),
  });
}

function componentInput(id: string, projection: ComponentProjection): StandardComponentInput {
  return Object.freeze({ id, ...projection }) as unknown as StandardComponentInput;
}

function ownedUpdate(
  component: StandardComponent,
  previous: ComponentProjection,
  next: ComponentProjection,
): {
  readonly patch: StandardComponentPatch;
  readonly projection: ComponentProjection;
} {
  const patch: Record<string, unknown> = {};
  const projection: Record<string, unknown> = {};
  for (const field of ["iconDomain", "label", "name", "summary", "type"] as const) {
    const owned = component[field] === previous[field];
    const value = owned ? next[field] : previous[field];
    if (owned && component[field] !== next[field]) {
      patch[field] = next[field] ?? null;
    }
    if (value !== undefined) projection[field] = value;
  }
  // Structural values are carried forward untouched: the structural pass owns
  // them, and it needs the previous projection to tell evidence-owned values
  // apart from ones a person has since changed.
  for (const field of ["parent", "scale", "shared"] as const) {
    const value = previous[field];
    if (value !== undefined) projection[field] = value;
  }
  return Object.freeze({
    patch: Object.freeze(patch) as StandardComponentPatch,
    projection: Object.freeze(projection) as ComponentProjection,
  });
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
  if (outcome.status === "indeterminate") {
    return success(
      Object.freeze({
        diagnostics: outcome.diagnostics,
        recovery: outcome.recovery,
        status: "indeterminate" as const,
      }),
    );
  }
  return failure(...outcome.diagnostics);
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
  const structuralScaleProposal = validateStructuralScaleProposalConfigurationV1(
    options.structuralScaleProposal ?? DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1,
  );
  if (!structuralScaleProposal.ok) {
    throw new RangeError("structuralScaleProposal must contain valid ordered v1 thresholds");
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
      const storedEvidence = evidenceFromSnapshotState(initial.state);
      const evidence = parseEvidenceState(
        storedEvidence === undefined ? { sources: [], version: 1 } : storedEvidence,
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
      const componentRecords = snapshot.value.records.filter(
        (record): record is Extract<ObservationRecord, { kind: "component-candidate" }> =>
          record.kind === "component-candidate",
      );
      const currentComponentIdentities = new Set(
        componentRecords.map((record) => qualified(record.scope, record.key)),
      );
      if (componentRecords.length > options.bounds.maxComponents) {
        return failure(
          diagnostic("reconciliation-component-limit", "Observed component capacity is exceeded"),
        );
      }
      const priorComponents = new Map<string, ComponentBinding>();
      const resolvedComponentIds = new Set<string>();
      const otherSourceComponentIds = new Set<string>();
      for (const source of evidence.value.sources) {
        if (source.sourceKey === key) continue;
        for (const binding of source.componentBindings) {
          const resolved = options.graph.resolveEntityIdentity(
            decoded.value.graph,
            binding.componentId,
          );
          if (resolved.ok) otherSourceComponentIds.add(resolved.value.resolved);
        }
      }
      for (const binding of priorSource?.componentBindings ?? []) {
        const identity = qualified(binding.scope, binding.key);
        const notObserved = !currentComponentIdentities.has(identity);
        const resolved = options.graph.resolveEntityIdentity(
          decoded.value.graph,
          binding.componentId,
        );
        if (!resolved.ok || !existingComponents.has(resolved.value.resolved)) {
          // Canonical intent is already absent. A successful snapshot with no
          // matching record can retire only this dangling scanner binding; a
          // present record still needs an exact target and fails below.
          if (notObserved) {
            priorComponents.set(identity, Object.freeze({ ...binding, present: false }));
            continue;
          }
          return failure(
            diagnostic("reconciliation-binding-missing", "A component binding target is missing"),
          );
        }
        if (
          resolvedComponentIds.has(resolved.value.resolved) ||
          otherSourceComponentIds.has(resolved.value.resolved)
        ) {
          return failure(
            diagnostic(
              "reconciliation-binding-ambiguous",
              "Several component bindings resolve to one target",
            ),
          );
        }
        resolvedComponentIds.add(resolved.value.resolved);
        priorComponents.set(
          identity,
          binding.componentId === resolved.value.resolved
            ? binding
            : Object.freeze({ ...binding, componentId: resolved.value.resolved }),
        );
      }
      const componentBindings = new Map(priorComponents);
      const unavailableComponents = new Set([
        ...evidence.value.sources.flatMap((source) =>
          source.componentBindings.map((binding) => binding.componentId),
        ),
        ...existingComponents.keys(),
      ]);
      const componentMutations: GraphDataRecord[] = [];
      const touchedComponents = new Set<string>();
      const renamedComponents = new Set<string>();
      for (const record of componentRecords) {
        const identity = qualified(record.scope, record.key);
        const scaleAssessment =
          record.signals === undefined
            ? success(undefined)
            : deriveStructuralScaleProposalV1(record.signals, structuralScaleProposal.value);
        if (!scaleAssessment.ok) return scaleAssessment;
        let binding = componentBindings.get(identity);
        if (binding === undefined) {
          const projection = componentProjection(record, snapshot.value);
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
            projection,
            ...(scaleAssessment.value === undefined
              ? {}
              : { scaleAssessment: scaleAssessment.value }),
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
        const nextProjection = componentProjection(record, snapshot.value);
        const existing = existingComponents.get(binding.componentId);
        if (existing === undefined)
          return failure(
            diagnostic("reconciliation-binding-missing", "A component binding target is missing"),
          );
        const update = ownedUpdate(existing, binding.projection, nextProjection);
        if (Object.hasOwn(update.patch, "name")) renamedComponents.add(binding.componentId);
        if (Object.keys(update.patch).length > 0) {
          componentMutations.push(
            Object.freeze({
              id: binding.componentId,
              patch: update.patch as unknown as GraphData,
              type: "patch",
            }),
          );
          touchedComponents.add(binding.componentId);
        }
        componentBindings.set(
          identity,
          Object.freeze({
            componentId: binding.componentId,
            key: binding.key,
            present: true,
            projection: update.projection,
            ...(scaleAssessment.value === undefined
              ? {}
              : { scaleAssessment: scaleAssessment.value }),
            scope: binding.scope,
          }),
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
      const containmentRecords = snapshot.value.records.filter(
        (record): record is Extract<ObservationRecord, { kind: "relationship" }> =>
          record.kind === "relationship" &&
          record.relationshipType === observedContainmentRelationshipType,
      );
      const structure = resolveObservedStructure(
        containmentRecords.map((record) =>
          Object.freeze({
            contained: qualified(record.to.scope, record.to.key),
            container: qualified(record.from.scope, record.from.key),
          }),
        ),
      );
      if (!structure.ok) return structure;
      for (const record of containmentRecords) {
        const container = qualified(record.from.scope, record.from.key);
        const contained = qualified(record.to.scope, record.to.key);
        if (
          !componentIds.has(container) ||
          !componentIds.has(contained) ||
          !currentComponentIdentities.has(container) ||
          !currentComponentIdentities.has(contained)
        ) {
          return failure(
            diagnostic(
              "unresolved-observation-reference",
              "An observed containment endpoint is not exactly bound in this snapshot",
            ),
          );
        }
      }
      const structuralProjections = new Map<string, ComponentProjection>();
      for (const record of componentRecords) {
        const identity = qualified(record.scope, record.key);
        const containerIdentity = structure.value.parentOf.get(identity);
        const parent =
          containerIdentity === undefined ? undefined : componentIds.get(containerIdentity);
        // Scale follows position in the observed structure. A component nobody
        // observed containing and that contains nothing has no observed position,
        // so it stays unscaled rather than being sized by how much we depend on it.
        const positioned =
          parent !== undefined || structure.value.depthOf.has(identity)
            ? observedScaleForDepth(structure.value.depthOf.get(identity) ?? 0)
            : undefined;
        const shared = observedSharedFromSignals(record.signals);
        structuralProjections.set(
          identity,
          Object.freeze({
            ...(parent === undefined ? {} : { parent }),
            ...(positioned === undefined ? {} : { scale: positioned }),
            ...(shared === undefined ? {} : { shared }),
          }),
        );
      }
      const structuralFields = ["parent", "scale", "shared"] as const;
      for (const [identity, binding] of componentBindings) {
        const next = structuralProjections.get(identity);
        if (next === undefined || !currentComponentIdentities.has(identity)) continue;
        const existing = existingComponents.get(binding.componentId);
        const patch: Record<string, unknown> = {};
        const projected: Record<string, unknown> = {};
        for (const field of structuralFields) {
          const previous = binding.projection[field];
          // Evidence may only move a value it still owns: one a person has not
          // changed since the last scan projected it.
          const owned = existing === undefined || existing[field] === previous;
          const value = owned ? next[field] : previous;
          if (owned && existing !== undefined && existing[field] !== next[field]) {
            patch[field] = next[field] ?? null;
          }
          if (value !== undefined) projected[field] = value;
        }
        componentBindings.set(
          identity,
          Object.freeze({
            ...binding,
            projection: Object.freeze({ ...binding.projection, ...projected }),
          }),
        );
        const creating = existing === undefined;
        if (!creating && Object.keys(patch).length === 0) continue;
        if (creating && Object.keys(projected).length === 0) continue;
        const planned = componentMutations.findIndex((mutation) => {
          const record = mutation as Readonly<Record<string, unknown>>;
          if (record.type === "patch") return record.id === binding.componentId;
          const created = record.component as Readonly<Record<string, unknown>> | undefined;
          return created?.id === binding.componentId;
        });
        if (planned === -1) {
          componentMutations.push(
            Object.freeze({
              id: binding.componentId,
              patch: patch as unknown as GraphData,
              type: "patch",
            }),
          );
        } else {
          const record = componentMutations[planned]! as Readonly<Record<string, unknown>>;
          componentMutations[planned] =
            record.type === "patch"
              ? Object.freeze({
                  ...record,
                  patch: Object.freeze({
                    ...(record.patch as Readonly<Record<string, unknown>>),
                    ...patch,
                  }) as unknown as GraphData,
                })
              : Object.freeze({
                  ...record,
                  component: Object.freeze({
                    ...(record.component as Readonly<Record<string, unknown>>),
                    ...projected,
                  }) as unknown as GraphData,
                });
        }
        touchedComponents.add(binding.componentId);
      }

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
      }
      const relationshipRecords = snapshot.value.records.filter(
        (record): record is Extract<ObservationRecord, { kind: "relationship" }> =>
          record.kind === "relationship" &&
          record.relationshipType !== observedContainmentRelationshipType,
      );
      if (relationshipRecords.length > options.bounds.maxRelationships) {
        return failure(
          diagnostic(
            "reconciliation-relationship-limit",
            "Observed relationship capacity is exceeded",
          ),
        );
      }
      const currentRelationshipIdentities = new Set(
        relationshipRecords.map((record) => qualified(record.scope, record.key)),
      );
      const priorRelationships = new Map<string, RelationshipBinding>();
      const resolvedRelationshipProjections = new Map<string, RelationshipProjection>();
      for (const binding of priorSource?.relationshipBindings ?? []) {
        const identity = qualified(binding.scope, binding.key);
        const notObserved = !currentRelationshipIdentities.has(identity);
        const missingRelationship = !existingRelationships.has(binding.relationId);
        const source = options.graph.resolveEntityIdentity(
          decoded.value.graph,
          binding.projection.source,
        );
        const target = options.graph.resolveEntityIdentity(
          decoded.value.graph,
          binding.projection.target,
        );
        if (
          !source.ok ||
          !target.ok ||
          !resolvedComponentIds.has(source.value.resolved) ||
          !resolvedComponentIds.has(target.value.resolved)
        ) {
          // Both the relation and at least one endpoint are already absent. A
          // successful snapshot that omits the record can retire the dangling
          // binding without choosing a replacement identity.
          if (notObserved && missingRelationship) {
            priorRelationships.set(
              identity,
              Object.freeze({ ...binding, present: false, removed: true }),
            );
            resolvedRelationshipProjections.set(identity, binding.projection);
            continue;
          }
          return failure(
            diagnostic(
              "reconciliation-binding-missing",
              "A relationship binding endpoint is missing or ambiguous",
            ),
          );
        }
        // The endpoints can remain live after an explicit relation removal.
        // Retire only that missing relation when this snapshot also omits it.
        priorRelationships.set(
          identity,
          missingRelationship && notObserved
            ? Object.freeze({ ...binding, present: false, removed: true })
            : binding,
        );
        resolvedRelationshipProjections.set(
          identity,
          Object.freeze({
            source: source.value.resolved,
            target: target.value.resolved,
            type: binding.projection.type,
          }),
        );
      }
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
        const sourceReference = qualified(record.from.scope, record.from.key);
        const targetReference = qualified(record.to.scope, record.to.key);
        const source = componentIds.get(sourceReference);
        const target = componentIds.get(targetReference);
        if (
          source === undefined ||
          target === undefined ||
          !currentComponentIdentities.has(sourceReference) ||
          !currentComponentIdentities.has(targetReference)
        )
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
            removed: false,
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
          if (binding.present || !binding.removed) {
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
            Object.freeze({ ...binding, present: true, projection, removed: false }),
          );
          continue;
        }
        const resolvedPriorProjection =
          resolvedRelationshipProjections.get(identity) ?? binding.projection;
        let appliedProjection = resolvedPriorProjection;
        if (
          relationshipMatches(existing, binding.projection) ||
          relationshipMatches(existing, resolvedPriorProjection)
        ) {
          if (!relationshipMatches(existing, projection)) {
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
            touchedComponents.add(resolvedPriorProjection.source);
            touchedComponents.add(source);
            touchedRelationships.add(binding.relationId);
          }
          appliedProjection = projection;
        }
        relationshipBindings.set(
          identity,
          Object.freeze({
            ...binding,
            present: true,
            projection: appliedProjection,
            removed: false,
          }),
        );
      }
      for (const [identity, binding] of relationshipBindings) {
        if (relationshipRecords.some((record) => qualified(record.scope, record.key) === identity))
          continue;
        const resolvedProjection =
          resolvedRelationshipProjections.get(identity) ?? binding.projection;
        if (!hasCompleteCoverage(snapshot.value, binding.scope, "relationship")) {
          if (!same(binding.projection, resolvedProjection)) {
            relationshipBindings.set(
              identity,
              Object.freeze({ ...binding, projection: resolvedProjection }),
            );
          }
          continue;
        }
        const existing = existingRelationships.get(binding.relationId);
        let removed = existing === undefined ? binding.removed : false;
        if (
          existing !== undefined &&
          (relationshipMatches(existing, binding.projection) ||
            relationshipMatches(existing, resolvedProjection))
        ) {
          relationshipMutations.push(Object.freeze({ id: binding.relationId, type: "remove" }));
          touchedComponents.add(resolvedProjection.source);
          touchedRelationships.add(binding.relationId);
          removed = true;
        }
        relationshipBindings.set(
          identity,
          Object.freeze({
            ...binding,
            present: false,
            projection: resolvedProjection,
            removed,
          }),
        );
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
      for (const component of existingComponents.values()) {
        if (component.parent === undefined) continue;
        const parent = options.graph.resolveEntityIdentity(decoded.value.graph, component.parent);
        if (!parent.ok) return parent;
        if (renamedComponents.has(parent.value.resolved)) touchedComponents.add(component.id);
      }
      for (const relationship of existingRelationships.values()) {
        const target = options.graph.resolveEntityIdentity(
          decoded.value.graph,
          relationship.target,
        );
        if (!target.ok) return target;
        if (renamedComponents.has(target.value.resolved)) {
          touchedComponents.add(relationship.source);
        }
      }
      if (
        priorSource !== undefined &&
        sameObservationContent(priorSource.snapshot, snapshot.value) &&
        same(priorSource.componentBindings, nextSource.componentBindings) &&
        same(priorSource.relationshipBindings, nextSource.relationshipBindings) &&
        componentMutations.length === 0 &&
        relationshipMutations.length === 0
      ) {
        return success(Object.freeze({ generation: generation.value, status: "unchanged" }));
      }
      const sources = evidence.value.sources
        .filter((source) => source.sourceKey !== key)
        .concat(nextSource)
        .sort((left, right) => compareText(left.sourceKey, right.sourceKey));
      const nextEvidence: EvidenceState = Object.freeze({
        sources: Object.freeze(sources),
        version: 1,
      });
      const evidenceSourceResource = options.evidenceResourceMapper.resourceForEvidenceSource(key);
      if (!evidenceSourceResource.ok) return evidenceSourceResource;
      const expectedRevisions: Array<{ expected: string | null; resource: string }> = [
        {
          expected: initialRevisions.value.get(evidenceResource.value) ?? null,
          resource: evidenceResource.value,
        },
        {
          expected: null,
          resource: evidenceSourceResource.value,
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
      {
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
      const request = Object.freeze({
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
      });
      const boundedRequest = copyGraphPayload(request as unknown as GraphData, "transaction", {
        code: "reconciliation-transaction-limit",
        maximumDepth: options.bounds.maxTransactionDataDepth,
        maximumValues: options.bounds.maxTransactionDataValues,
        message: "Reconciliation exceeds the atomic transaction envelope",
      });
      if (!boundedRequest.ok) return boundedRequest;
      const outcome = await options.transactionExecution.execute(request);
      if (outcome.status === "conflict") continue;
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
