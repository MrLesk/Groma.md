import type {
  ApplicationOperations,
  WorkspaceInitializationCapability,
} from "../application/index.ts";
import type { Diagnostic, EntropySource, Result } from "../core/index.ts";
import type { LocalResourceProvider, MarkdownIntentStore } from "../persistence/index.ts";
import type { StandardModelCapability } from "../standard-model/index.ts";
import type {
  BoundedQueryContracts,
  GraphKernel,
  TransactionEngine,
  TransactionInvariant,
  TransactionProvider,
} from "../core/index.ts";
import type { ComponentResourceMapper } from "../application/index.ts";

export interface HostProcessContext {
  readonly cancellation?: AbortSignal;
  readonly workspaceRoot: string;
}

export type WorkspaceStatus =
  | { readonly state: "missing" }
  | { readonly state: "configured" }
  | { readonly diagnostic: Diagnostic; readonly state: "conflict" }
  | { readonly state: "ready" };

export interface WorkspaceRecoveryReport {
  readonly generation: number;
  readonly status: "completed";
}

export interface WorkspaceAccessCapability extends WorkspaceInitializationCapability {
  recover(): Promise<Result<WorkspaceRecoveryReport>>;
  requireWorkspace(): Result<ApplicationOperations>;
  status(): WorkspaceStatus;
}

export interface HostSurfaceContext {
  readonly recovery: { readonly status: "completed" | "not-required" };
  readonly workspace: WorkspaceAccessCapability;
}

export interface HostSurfaceSession {
  readonly completion: Promise<void>;
  stop(): Promise<void>;
}

export interface HostSurface {
  start(context: HostSurfaceContext): Promise<HostSurfaceSession> | HostSurfaceSession;
}

export type HostSignal = "SIGINT" | "SIGTERM";

export interface HostSignalSource {
  subscribe(listener: (signal: HostSignal) => void): () => void;
}

export interface HostComposition {
  readonly graph: GraphKernel;
  readonly invariant: TransactionInvariant;
  readonly model: StandardModelCapability;
  readonly operations: ApplicationOperations;
  readonly queries: BoundedQueryContracts;
  readonly resourceMapper: ComponentResourceMapper;
  readonly resources: LocalResourceProvider;
  readonly store: MarkdownIntentStore;
  readonly surface: HostSurface;
  readonly transactionEngine: TransactionEngine;
  readonly transactionProvider: TransactionProvider;
  readonly workspace: WorkspaceAccessCapability;
}

export interface HostBootstrapRegistry {
  compose(context: HostProcessContext): Promise<Result<HostComposition>>;
}

export interface DefaultBootstrapRegistryOptions {
  readonly coordinationRoot?: string;
  readonly entropy?: EntropySource;
  readonly surface: HostSurface;
}

export type HostRunOutcome =
  | { readonly status: "completed" }
  | { readonly signal?: HostSignal; readonly status: "cancelled" }
  | { readonly diagnostics: readonly Diagnostic[]; readonly status: "startup-failure" }
  | { readonly diagnostics: readonly Diagnostic[]; readonly status: "surface-failure" };
