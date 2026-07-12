import type {
  BoundedQueryContracts,
  ContinuationCursor,
  Diagnostic,
  GraphGeneration,
  GraphKernel,
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
  StandardModelCapability,
  StandardRelationship,
} from "../standard-model/index.ts";

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

/** Structural execution seam implemented by Core's TransactionEngine. */
export interface TransactionExecutionCapability {
  execute(request: TransactionRequest): Promise<TransactionOutcome>;
}

export interface ApplicationOperationBounds {
  readonly maxComponents: number;
  readonly maxDiagnosticCount: number;
  readonly maxEmbeddedItems: number;
  readonly maxRelationshipMutations: number;
  readonly maxRelationships: number;
  readonly maxSnapshotStateDepth: number;
  readonly maxSnapshotStateValues: number;
}

export interface ApplicationOperationsOptions {
  readonly bounds: ApplicationOperationBounds;
  readonly graph: GraphKernel;
  readonly initialization: WorkspaceInitializationCapability;
  readonly maxSnapshotAttempts: number;
  readonly model: StandardModelCapability;
  readonly queries: BoundedQueryContracts;
  readonly resourceMapper: ComponentResourceMapper;
  readonly transactionExecution: TransactionExecutionCapability;
  readonly transactionProvider: Pick<TransactionProvider, "snapshot">;
}

export interface InitializeWorkspaceRequest {}

export interface BoundedPageRequest {
  readonly cursor?: ContinuationCursor | string;
  readonly limit: number;
}

export interface GetComponentRequest {
  readonly id: string;
  readonly relationships: BoundedPageRequest;
}

export interface ListComponentsRequest extends BoundedPageRequest {}

export interface ListRootComponentsRequest extends BoundedPageRequest {}

export interface ListChildComponentsRequest extends BoundedPageRequest {
  readonly parent: string;
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
  readonly component: StandardComponent;
  readonly revision: string;
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
  readonly generation: GraphGeneration;
  readonly item: ComponentView;
  readonly relationships: RelationshipPage;
}

export interface ComponentPage {
  readonly generation: GraphGeneration;
  readonly hasMore: boolean;
  readonly items: readonly ComponentView[];
  readonly nextCursor?: ContinuationCursor;
}

export interface ApplicationOperations {
  initialize(request: InitializeWorkspaceRequest): Promise<Result<WorkspaceInitializationOutcome>>;
  getComponent(request: GetComponentRequest): Promise<Result<ExactComponentRead>>;
  listComponents(request: ListComponentsRequest): Promise<Result<ComponentPage>>;
  listRoots(request: ListRootComponentsRequest): Promise<Result<ComponentPage>>;
  listChildren(request: ListChildComponentsRequest): Promise<Result<ComponentPage>>;
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
