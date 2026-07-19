import type {
  ApplicationOperations,
  ApplicationSnapshotStateDecoder,
  ReconciliationOperations,
  WorkspaceInitializationCapability,
} from "../application/index.ts";
import type {
  Diagnostic,
  EntropySource,
  GraphQueryEngineCapability,
  GraphGeneration,
  ProjectionIndexCapability,
  ProjectionReadCapability,
  PluginRegistration,
  Result,
  RunningPluginGraph,
} from "../core/index.ts";
import type { LocalBootstrapTarget } from "./bootstrap-configuration.ts";
import type {
  LocalResourceFaultInjector,
  LocalResourceProvider,
  MarkdownIntentStore,
} from "../persistence/index.ts";
import type { StandardModelCapability } from "../standard-model/index.ts";
import type {
  BoundedQueryContracts,
  GraphKernel,
  TransactionEngine,
  TransactionInvariant,
  TransactionProvider,
} from "../core/index.ts";
import type { ComponentResourceMapper } from "../application/index.ts";
import type { ProjectRegistrationOperations } from "./local-project-registry.ts";
import type { ScannerExecutionRuntime } from "./scanner-runtime.ts";

export interface HostProcessContext {
  /** Listener methods must return undefined synchronously; non-void returns fail without being awaited. */
  readonly cancellation?: AbortSignal;
  readonly workspaceRoot: string;
}

export type WorkspaceStatus =
  | { readonly state: "missing" }
  | { readonly state: "configured" }
  | { readonly diagnostic: Diagnostic; readonly state: "conflict" }
  | { readonly state: "ready" };

export interface WorkspaceRecoveryReport {
  readonly generation: GraphGeneration;
  readonly status: "completed";
}

/**
 * Initialize and recover are FIFO across external callers and non-reentrant while a
 * transition is executing provider callbacks on this capability.
 */
export interface WorkspaceAccessCapability extends WorkspaceInitializationCapability {
  recover(): Promise<Result<WorkspaceRecoveryReport>>;
  requireWorkspace(): Result<ApplicationOperations>;
  status(): WorkspaceStatus;
}

export type HostInitializationOperations = Readonly<Pick<ApplicationOperations, "initialize">>;
export type ScannerSurfaceOperations = Readonly<Pick<ScannerExecutionRuntime, "recover" | "start">>;

export interface HostSurfaceContext {
  readonly cancellation: AbortSignal;
  readonly initialization: HostInitializationOperations;
  readonly projects: ProjectRegistrationOperations;
  readonly recovery: { readonly status: "completed" | "not-required" };
  readonly scanners: ScannerSurfaceOperations;
  readonly workspace: WorkspaceAccessCapability;
}

export interface HostSurfaceSession {
  readonly completion: Promise<void>;
  /** Called exactly once, including after natural completion; it must tolerate that state. */
  stop(): Promise<void>;
}

export interface HostSurface {
  start(context: HostSurfaceContext): Promise<HostSurfaceSession> | HostSurfaceSession;
}

export type HostSignal = "SIGINT" | "SIGTERM";

export interface HostProcessSignalEmitter {
  off(signal: HostSignal, listener: () => void): void;
  on(signal: HostSignal, listener: () => void): void;
}

export interface HostSignalSource {
  subscribe(listener: (signal: HostSignal) => void): () => void | Promise<void>;
}

export interface HostComposition {
  readonly graph: GraphKernel;
  readonly invariant: TransactionInvariant;
  readonly model: StandardModelCapability;
  readonly operations: ApplicationOperations;
  readonly projects: ProjectRegistrationOperations;
  /** Present for runtime-composed hosts; optional for compatible injected test/legacy registries. */
  readonly plugins?: RunningPluginGraph;
  readonly projection: ProjectionIndexCapability;
  readonly projectionRead: ProjectionReadCapability;
  readonly queryEngine: GraphQueryEngineCapability;
  readonly queries: BoundedQueryContracts;
  readonly reconciliation: ReconciliationOperations;
  readonly resourceMapper: ComponentResourceMapper;
  readonly resources: LocalResourceProvider;
  readonly scanners: ScannerExecutionRuntime;
  readonly store: MarkdownIntentStore;
  readonly surface: HostSurface;
  readonly snapshotStateDecoder: ApplicationSnapshotStateDecoder;
  readonly transactionEngine: TransactionEngine;
  readonly transactionProvider: TransactionProvider;
  readonly workspace: WorkspaceAccessCapability;
}

export interface HostBootstrapRegistry {
  compose(context: HostProcessContext): Promise<Result<HostComposition>>;
}

export interface DefaultBootstrapRegistryOptions {
  /** Verification/composition seam for replaceable Phase 0 providers. */
  readonly additionalBootstrapPlugins?: readonly PluginRegistration[];
  /** Host-owned, already validated registrations; project configuration cannot create these. */
  readonly additionalRuntimePlugins?: readonly PluginRegistration[];
  readonly coordinationRoot?: string;
  readonly entropy?: EntropySource;
  /** Explicit verification seam; production composition does not supply one. */
  readonly resourceFaultInjector?: LocalResourceFaultInjector;
  readonly surface: HostSurface;
  /** Pure target-convention seam. Production derives this from the running binary. */
  readonly target?: Omit<LocalBootstrapTarget, "workspaceRoot">;
}

export type HostRunOutcome =
  | { readonly status: "completed" }
  | { readonly signal?: HostSignal; readonly status: "cancelled" }
  | { readonly diagnostics: readonly Diagnostic[]; readonly status: "startup-failure" }
  | { readonly diagnostics: readonly Diagnostic[]; readonly status: "surface-failure" };
