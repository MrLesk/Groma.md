import type {
  BoundedQueryContracts,
  ContinuationCursor,
  Diagnostic,
  GraphGeneration,
  GraphQueryEngineCapability,
  GraphTraversalDirection,
  GraphKernel,
  ObservationCoverage,
  ObservationRecord,
  ObservationSourceIdentity,
  ResourceKey,
  Result,
  TransactionOutcome,
  TransactionProvider,
  TransactionRequest,
} from "../core/index.ts";
import type {
  StandardComponent,
  StandardComponentInput,
  StandardComponentPatch,
  StandardComponentScale,
  StandardModelCapability,
  StandardRelationship,
} from "../standard-model/index.ts";
import type { ApplicationSnapshotStateDecoder } from "./snapshot-state.ts";
import type { StructuralScaleAssessmentV1 } from "./scale-proposal.ts";

export type WorkspaceInitializationOutcome =
  | { readonly generation: GraphGeneration; readonly status: "initialized" }
  | { readonly generation: GraphGeneration; readonly status: "already-initialized" }
  | { readonly diagnostics: readonly Diagnostic[]; readonly status: "conflict" }
  | { readonly diagnostics: readonly Diagnostic[]; readonly status: "provider-failure" };

/**
 * Host-supplied atomic bootstrap. Implementations must establish the minimal canonical
 * workspace exactly once, report compatible prior initialization, and never overwrite
 * existing or conflicting state. Application code does not own a configuration format.
 */
export interface WorkspaceInitializationCapability {
  initialize(): Promise<WorkspaceInitializationOutcome>;
}

/** Maps semantic identity to an opaque transaction resource without exposing its locator. */
export interface ComponentResourceMapper {
  resourceForComponent(id: string): Result<ResourceKey>;
}

/** Maps the shared canonical alias plane without exposing its persistence locator. */
export interface AliasResourceMapper {
  resourceForAliases(): Result<ResourceKey>;
}

/** Structural execution seam implemented by Core's TransactionEngine. */
export interface TransactionExecutionCapability {
  execute(request: TransactionRequest): Promise<TransactionOutcome>;
}

export interface ApplicationOperationBounds {
  readonly maxBlueprintPageBytes: number;
  readonly maxBlueprintPageDepth: number;
  readonly maxComponents: number;
  readonly maxDiagnosticCount: number;
  readonly maxEmbeddedItems: number;
  readonly maxRelationshipMutations: number;
  readonly maxRelationships: number;
  readonly maxRequestDataDepth: number;
  readonly maxRequestDataValues: number;
  readonly maxSnapshotStateDepth: number;
  readonly maxSnapshotStateValues: number;
}

export interface ApplicationOperationsOptions {
  readonly aliasResourceMapper?: AliasResourceMapper;
  readonly bounds: ApplicationOperationBounds;
  readonly graph: GraphKernel;
  readonly graphQueries: GraphQueryEngineCapability;
  readonly initialization: WorkspaceInitializationCapability;
  readonly maxSnapshotAttempts: number;
  readonly model: StandardModelCapability;
  readonly queries: BoundedQueryContracts;
  readonly resourceMapper: ComponentResourceMapper;
  readonly snapshotStateDecoder: ApplicationSnapshotStateDecoder;
  readonly transactionExecution: TransactionExecutionCapability;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

export interface InitializeWorkspaceRequest {}

export interface BoundedPageRequest {
  readonly cursor?: ContinuationCursor | string;
  readonly limit: number;
}

export interface ComponentReadFilters {
  readonly scale?: StandardComponentScale;
  readonly shared?: boolean;
}

export interface GetComponentRequest {
  readonly id: string;
  readonly relationships: BoundedPageRequest;
}

export interface ListComponentsRequest extends BoundedPageRequest, ComponentReadFilters {}

export interface ListRootComponentsRequest extends BoundedPageRequest, ComponentReadFilters {}

export interface ListChildComponentsRequest extends BoundedPageRequest, ComponentReadFilters {
  readonly parent: string;
}

export interface ExportBlueprintRequest extends BoundedPageRequest {}

export interface SearchBlueprintRequest extends BoundedPageRequest, ComponentReadFilters {
  readonly text: string;
}

export interface TraverseBlueprintRequest extends BoundedPageRequest {
  readonly depth: number;
  readonly direction: GraphTraversalDirection;
  readonly id: string;
  readonly relationType?: string;
}

export interface ComponentRevision {
  readonly componentId: string;
  readonly revision: string | null;
}

export interface ComponentRelationshipInput {
  readonly description?: string;
  readonly id?: string;
  readonly target: string;
  readonly type: string;
  readonly [field: string]: unknown;
}

export interface CreateComponentRequest {
  readonly component: StandardComponentInput;
  readonly relationships?: readonly ComponentRelationshipInput[];
}

export interface ComponentRelationshipChanges {
  readonly remove?: readonly string[];
  readonly upsert?: readonly ComponentRelationshipInput[];
}

export interface UpdateComponentRequest {
  readonly expectedRevision: string;
  readonly id: string;
  readonly patch: StandardComponentPatch;
  readonly relationships?: ComponentRelationshipChanges;
}

export interface ReparentComponentRequest {
  readonly expectedRevision: string;
  readonly id: string;
  readonly parent: string | null;
}

export interface RemoveComponentRequest {
  readonly expectedRevision: string;
  readonly id: string;
}

export interface MergeComponentRequest {
  readonly expectedRevision: string;
  readonly obsolete: string;
  readonly survivor: string;
}

export interface ApplicationDiagnostic {
  readonly code: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
  readonly message: string;
}

export type ApplicationMutationOutcome<T> =
  | {
      readonly affected: {
        readonly components: readonly string[];
        readonly relationships: readonly string[];
      };
      readonly generation: GraphGeneration;
      readonly revisions: readonly ComponentRevision[];
      readonly status: "committed";
      readonly value: T;
    }
  | {
      readonly diagnostics: readonly ApplicationDiagnostic[];
      readonly status: "conflict" | "validation-rejected";
    }
  | {
      readonly diagnostics: readonly ApplicationDiagnostic[];
      readonly phase: "commit" | "prepare" | "recovery" | "snapshot";
      readonly status: "provider-failure";
    }
  | {
      readonly diagnostics: readonly ApplicationDiagnostic[];
      readonly status: "indeterminate";
    };

export interface ComponentView {
  /**
   * Scanner evidence about how difficult a component's own source is to follow.
   * It is deliberately separate from canonical component intent and is comparable
   * only among entries with the same project and scanner identity.
   */
  readonly cognitiveComplexity?: readonly ComponentCognitiveComplexityEvidence[];
  readonly component: StandardComponent;
  /** True when at least one current scanner binding supports this component. */
  readonly evidenceBound: boolean;
  readonly revision: string;
}

export interface ComponentCognitiveComplexityEvidence {
  readonly projectId: string;
  readonly scanner: ObservationSourceIdentity;
  readonly value: number;
}

export interface RelationshipView {
  readonly relationship: StandardRelationship;
  readonly revision: string;
}

export interface RelationshipPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly RelationshipView[];
  readonly nextCursor?: ContinuationCursor;
}

export interface ExactComponentRead {
  readonly evidence: readonly ComponentEvidenceView[];
  readonly generation: GraphGeneration;
  readonly item: ComponentView;
  readonly relationships: RelationshipPage;
}

export interface ComponentEvidenceView {
  readonly binding: {
    readonly key: string;
    readonly present: boolean;
    readonly scope: string;
  };
  readonly coverage: readonly ObservationCoverage[];
  readonly projectId: string;
  readonly records: readonly ObservationRecord[];
  readonly scale?: ComponentScaleEvidenceView;
  readonly scanner: ObservationSourceIdentity;
}

export type ComponentScaleEvidenceView =
  | {
      readonly derivation: StructuralScaleAssessmentV1["derivation"];
      readonly status: "insufficient";
    }
  | {
      readonly candidates: readonly StandardComponentScale[];
      readonly derivation: StructuralScaleAssessmentV1["derivation"];
      readonly status: "ambiguous";
    }
  | {
      readonly derivation: StructuralScaleAssessmentV1["derivation"];
      readonly proposal: StandardComponentScale;
      readonly status: "proposed";
    }
  | {
      readonly curated: StandardComponentScale;
      readonly derivation: StructuralScaleAssessmentV1["derivation"];
      readonly proposal: StandardComponentScale;
      readonly status: "aligned" | "drift";
    };

export interface ComponentPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly ComponentView[];
  readonly nextCursor?: ContinuationCursor;
}

/**
 * Projection-backed component page without canonical resource revisions.
 * Items are ordered by ascending stable component identity.
 */
export interface BlueprintComponentPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly StandardComponent[];
  readonly nextCursor?: ContinuationCursor;
}

export interface BlueprintSearchItem {
  readonly component: StandardComponent;
  readonly evidenceBound: boolean;
}

export interface BlueprintSearchPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly BlueprintSearchItem[];
  readonly nextCursor?: ContinuationCursor;
}

/** One component and every canonical outgoing depth-1 relationship from that source. */
export interface BlueprintExportItem {
  readonly cognitiveComplexity?: readonly ComponentCognitiveComplexityEvidence[];
  readonly component: StandardComponent;
  readonly evidenceBound: boolean;
  readonly relationships: readonly StandardRelationship[];
}

/** One self-contained bounded export page carried by the projection component cursor. */
export interface BlueprintExportPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly BlueprintExportItem[];
  readonly nextCursor?: ContinuationCursor;
}

export interface BlueprintTraversalHit {
  readonly component: StandardComponent;
  readonly depth: number;
  readonly direction: Exclude<GraphTraversalDirection, "both">;
  readonly from: string;
  readonly relationship: StandardRelationship;
}

/**
 * One bounded page from a deterministic projection-backed relationship traversal.
 * Hits are ordered by breadth-first depth and then stable relationship identity.
 */
export interface BlueprintTraversalPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly BlueprintTraversalHit[];
  readonly nextCursor?: ContinuationCursor;
}

export interface ApplicationOperations {
  initialize(request: InitializeWorkspaceRequest): Promise<Result<WorkspaceInitializationOutcome>>;
  exportBlueprint(request: ExportBlueprintRequest): Promise<Result<BlueprintExportPage>>;
  searchBlueprint(request: SearchBlueprintRequest): Promise<Result<BlueprintSearchPage>>;
  traverseBlueprint(request: TraverseBlueprintRequest): Promise<Result<BlueprintTraversalPage>>;
  getComponent(request: GetComponentRequest): Promise<Result<ExactComponentRead>>;
  listComponents(request: ListComponentsRequest): Promise<Result<ComponentPage>>;
  listRoots(request: ListRootComponentsRequest): Promise<Result<ComponentPage>>;
  listChildren(request: ListChildComponentsRequest): Promise<Result<ComponentPage>>;
  mergeComponent(
    request: MergeComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>>;
  createComponent(
    request: CreateComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>>;
  updateComponent(
    request: UpdateComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>>;
  reparentComponent(
    request: ReparentComponentRequest,
  ): Promise<ApplicationMutationOutcome<StandardComponent>>;
  removeComponent(request: RemoveComponentRequest): Promise<ApplicationMutationOutcome<string>>;
}
