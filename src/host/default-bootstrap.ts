import { randomBytes } from "node:crypto";
import path from "node:path";

import {
  createApplicationOperations,
  createApplicationSnapshotStateDecoder,
  type ApplicationOperations,
  type ComponentResourceMapper,
} from "../application/index.ts";
import {
  BoundedQueryContracts,
  createOpaqueIdSource,
  failure,
  GraphKernel,
  parseEntityId,
  parseResourceKey,
  success,
  TransactionEngine,
  type Diagnostic,
} from "../core/index.ts";
import {
  createLocalResourceProvider,
  createLocalTransactionJournal,
  createMarkdownIntentStore,
  createMarkdownIntentTransactionAdapter,
  markdownIntentLocator,
} from "../persistence/index.ts";
import {
  createStandardModelCapability,
  createStandardModelInvariant,
} from "../standard-model/index.ts";
import { isHostProxy } from "./runtime-validation.ts";
import type {
  DefaultBootstrapRegistryOptions,
  HostBootstrapRegistry,
  HostComposition,
  HostProcessContext,
} from "./contracts.ts";
import { createLocalWorkspaceCapability } from "./local-workspace.ts";

export const defaultHostBounds = Object.freeze({
  maxComponents: 1_000,
  maxDiagnosticCount: 100,
  maxEmbeddedItems: 100,
  maxOwnerCharacters: 100,
  maxPageSize: 100,
  maxPinnedComponentIds: 100,
  maxRelationshipMutations: 100,
  maxRelationships: 1_000,
  maxRequestDataDepth: 30,
  maxRequestDataValues: 10_000,
  maxSnapshotAttempts: 3,
  maxSnapshotStateDepth: 30,
  maxSnapshotStateValues: 100_000,
});

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

export function createDefaultBootstrapRegistry(
  options: DefaultBootstrapRegistryOptions,
): HostBootstrapRegistry {
  if (
    typeof options.surface !== "object" ||
    options.surface === null ||
    typeof options.surface.start !== "function"
  ) {
    throw new TypeError("surface must implement the host surface contract");
  }
  const entropy = options.entropy ?? ((length: number) => randomBytes(length));

  const compose = async (context: HostProcessContext) => {
    if (typeof context.workspaceRoot !== "string" || !path.isAbsolute(context.workspaceRoot)) {
      return failure<HostComposition>(
        diagnostic("invalid-host-process-context", "Host workspace root must be an absolute path"),
      );
    }
    try {
      const resources = await createLocalResourceProvider({
        ...(options.coordinationRoot === undefined
          ? {}
          : { coordinationRoot: options.coordinationRoot }),
        workspaceRoot: context.workspaceRoot,
      });
      const model = createStandardModelCapability();
      const store = createMarkdownIntentStore({
        bounds: {
          maxDocuments: defaultHostBounds.maxComponents,
          maxEntriesPerDirectory: defaultHostBounds.maxComponents,
          pageSize: defaultHostBounds.maxPageSize,
        },
        model,
        resources,
      });
      const transactionProvider = createLocalTransactionJournal({
        adapter: createMarkdownIntentTransactionAdapter({ model, store }),
        bounds: { maxTargets: defaultHostBounds.maxComponents },
        resources,
      });
      const transactionEngine = new TransactionEngine({
        maxAffectedIdentities: defaultHostBounds.maxComponents + defaultHostBounds.maxRelationships,
        maxRequestDataDepth: defaultHostBounds.maxRequestDataDepth,
        maxRequestDataValues: defaultHostBounds.maxRequestDataValues,
        maxSnapshotStateDepth: defaultHostBounds.maxSnapshotStateDepth,
        maxSnapshotStateValues: defaultHostBounds.maxSnapshotStateValues,
        provider: transactionProvider,
      });
      const invariant = createStandardModelInvariant({
        maxComponentMutations: defaultHostBounds.maxEmbeddedItems,
        maxComponents: defaultHostBounds.maxComponents,
        maxOwnerCharacters: defaultHostBounds.maxOwnerCharacters,
        maxPinnedComponentIds: defaultHostBounds.maxPinnedComponentIds,
        maxRelationshipMutations: defaultHostBounds.maxRelationshipMutations,
        maxRelationships: defaultHostBounds.maxRelationships,
      });
      const registered = transactionEngine.registerInvariant(invariant);
      if (!registered.ok) {
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Built-in invariant registration failed"),
        );
      }
      const graph = new GraphKernel({
        idSource: createOpaqueIdSource(entropy),
        maxPageSize: defaultHostBounds.maxPageSize,
      });
      const queries = new BoundedQueryContracts({
        maxAnchorCharacters: 256,
        maxCursorCharacters: 2_048,
        maxPageSize: defaultHostBounds.maxPageSize,
        maxQueryContextCharacters: 512,
      });
      const resourceMapper: ComponentResourceMapper = Object.freeze({
        resourceForComponent: (value: string) => {
          const id = parseEntityId(value);
          if (!id.ok) return id;
          const intent = markdownIntentLocator(id.value);
          return intent.ok ? parseResourceKey(intent.value) : intent;
        },
      });
      const snapshotStateDecoder = createApplicationSnapshotStateDecoder({
        bounds: defaultHostBounds,
        graph,
        isProxy: isHostProxy,
        model,
      });
      let operations: ApplicationOperations | undefined;
      const workspace = await createLocalWorkspaceCapability({
        bounds: {
          maxProviderDiagnostics: defaultHostBounds.maxDiagnosticCount,
          maxSnapshotResources: Math.max(
            defaultHostBounds.maxComponents,
            defaultHostBounds.maxRelationships,
          ),
          maxSnapshotStateDepth: defaultHostBounds.maxSnapshotStateDepth,
          maxSnapshotStateValues: defaultHostBounds.maxSnapshotStateValues,
        },
        operations: () => {
          if (operations === undefined) throw new Error("application operations are not composed");
          return operations;
        },
        resources,
        stateDecoder: snapshotStateDecoder,
        transactionProvider,
      });
      operations = createApplicationOperations({
        bounds: {
          maxComponents: defaultHostBounds.maxComponents,
          maxDiagnosticCount: defaultHostBounds.maxDiagnosticCount,
          maxEmbeddedItems: defaultHostBounds.maxEmbeddedItems,
          maxRelationshipMutations: defaultHostBounds.maxRelationshipMutations,
          maxRelationships: defaultHostBounds.maxRelationships,
          maxRequestDataDepth: defaultHostBounds.maxRequestDataDepth,
          maxRequestDataValues: defaultHostBounds.maxRequestDataValues,
          maxSnapshotStateDepth: defaultHostBounds.maxSnapshotStateDepth,
          maxSnapshotStateValues: defaultHostBounds.maxSnapshotStateValues,
        },
        graph,
        initialization: workspace,
        maxSnapshotAttempts: defaultHostBounds.maxSnapshotAttempts,
        model,
        queries,
        resourceMapper,
        transactionExecution: transactionEngine,
        transactionProvider,
      });

      return success<HostComposition>(
        Object.freeze({
          graph,
          invariant,
          model,
          operations,
          queries,
          resourceMapper,
          resources,
          store,
          surface: options.surface,
          snapshotStateDecoder,
          transactionEngine,
          transactionProvider,
          workspace,
        }),
      );
    } catch {
      return failure<HostComposition>(
        diagnostic("host-composition-failed", "Default local host composition failed"),
      );
    }
  };

  return Object.freeze({ compose });
}
