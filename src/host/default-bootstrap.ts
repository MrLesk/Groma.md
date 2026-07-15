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
  PluginRuntime,
  pluginRuntimeApiVersion,
  success,
  TransactionEngine,
  type Diagnostic,
  type PluginCapabilityDeclaration,
  type PluginRegistration,
  type PluginStartContext,
  type RunningPluginGraph,
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

const intrinsicReflectApply = Reflect.apply;

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

const defaultCapabilityVersion = "1.0.0";

export const defaultHostPluginIds = Object.freeze({
  application: "official.application",
  kernel: "official.kernel",
  model: "official.model",
  persistence: "official.persistence",
  resources: "official.resources",
  surface: "official.surface",
});

export const defaultHostCapabilityIds = Object.freeze({
  graph: "groma.graph/v1",
  invariant: "groma.invariant/v1",
  model: "groma.model/v1",
  operations: "groma.operations/v1",
  queries: "groma.queries/v1",
  resourceMapper: "groma.resource-mapper/v1",
  resources: "groma.resources/v1",
  snapshotStateDecoder: "groma.snapshot-state-decoder/v1",
  store: "groma.intent-store/v1",
  surface: "groma.host-surface/v1",
  transactionEngine: "groma.transaction-engine/v1",
  transactionProvider: "groma.transaction-provider/v1",
  workspace: "groma.workspace/v1",
});

function capability(id: string): PluginCapabilityDeclaration {
  return Object.freeze({ cardinality: "single", id, version: defaultCapabilityVersion });
}

function manifest(
  id: string,
  phase: 0 | 1,
  provides: readonly PluginCapabilityDeclaration[],
  requires: readonly PluginCapabilityDeclaration[] = [],
) {
  return Object.freeze({
    apiVersion: pluginRuntimeApiVersion,
    id,
    phase,
    provides: Object.freeze(provides),
    requires: Object.freeze(requires),
    version: "1.0.0",
  });
}

function output(id: string, value: unknown) {
  return Object.freeze({ id, value, version: defaultCapabilityVersion });
}

function requiredCapability<T>(context: PluginStartContext, id: string): T {
  const requirement = context.requirements.find(
    (item) => item.id === id && item.version === defaultCapabilityVersion,
  );
  if (requirement?.providers.length !== 1) {
    throw new Error(`Built-in capability ${id} did not resolve exactly once`);
  }
  return requirement.providers[0]!.value as T;
}

function runningCapability<T>(plugins: RunningPluginGraph, id: string): T {
  const providers = plugins.capabilities(id, defaultCapabilityVersion);
  if (providers.length !== 1) {
    throw new Error(`Built-in capability ${id} is unavailable after startup`);
  }
  return providers[0]!.value as T;
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

export function createDefaultBootstrapRegistry(
  options: DefaultBootstrapRegistryOptions,
): HostBootstrapRegistry {
  const coordinationRoot = options.coordinationRoot;
  const entropyOption = options.entropy;
  const resourceFaultInjector = options.resourceFaultInjector;
  const surfaceReceiver = options.surface;
  const surfaceStart =
    typeof surfaceReceiver === "object" && surfaceReceiver !== null
      ? surfaceReceiver.start
      : undefined;
  if (
    typeof surfaceReceiver !== "object" ||
    surfaceReceiver === null ||
    typeof surfaceStart !== "function"
  ) {
    throw new TypeError("surface must implement the host surface contract");
  }
  const surface = Object.freeze({
    start: (context: Parameters<typeof surfaceStart>[0]) =>
      intrinsicReflectApply(surfaceStart, surfaceReceiver, [context]),
  });
  const entropy = entropyOption ?? ((length: number) => randomBytes(length));

  const compose = async (context: HostProcessContext) => {
    if (typeof context.workspaceRoot !== "string" || !path.isAbsolute(context.workspaceRoot)) {
      return failure<HostComposition>(
        diagnostic("invalid-host-process-context", "Host workspace root must be an absolute path"),
      );
    }
    let plugins: RunningPluginGraph | undefined;
    try {
      const registrations: readonly PluginRegistration[] = Object.freeze([
        Object.freeze({
          manifest: manifest(defaultHostPluginIds.resources, 0, [
            capability(defaultHostCapabilityIds.resources),
          ]),
          start: async () => {
            const resources = await createLocalResourceProvider({
              ...(coordinationRoot === undefined ? {} : { coordinationRoot }),
              ...(resourceFaultInjector === undefined
                ? {}
                : { faultInjector: resourceFaultInjector }),
              workspaceRoot: context.workspaceRoot,
            });
            return Object.freeze({
              capabilities: Object.freeze([output(defaultHostCapabilityIds.resources, resources)]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(defaultHostPluginIds.model, 1, [
            capability(defaultHostCapabilityIds.invariant),
            capability(defaultHostCapabilityIds.model),
          ]),
          start: () => {
            const model = createStandardModelCapability();
            const invariant = createStandardModelInvariant({
              maxComponentMutations: defaultHostBounds.maxEmbeddedItems,
              maxComponents: defaultHostBounds.maxComponents,
              maxOwnerCharacters: defaultHostBounds.maxOwnerCharacters,
              maxPinnedComponentIds: defaultHostBounds.maxPinnedComponentIds,
              maxRelationshipMutations: defaultHostBounds.maxRelationshipMutations,
              maxRelationships: defaultHostBounds.maxRelationships,
            });
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.invariant, invariant),
                output(defaultHostCapabilityIds.model, model),
              ]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(defaultHostPluginIds.kernel, 1, [
            capability(defaultHostCapabilityIds.graph),
            capability(defaultHostCapabilityIds.queries),
          ]),
          start: () => {
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
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.graph, graph),
                output(defaultHostCapabilityIds.queries, queries),
              ]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(
            defaultHostPluginIds.persistence,
            1,
            [
              capability(defaultHostCapabilityIds.store),
              capability(defaultHostCapabilityIds.transactionProvider),
            ],
            [
              capability(defaultHostCapabilityIds.model),
              capability(defaultHostCapabilityIds.resources),
            ],
          ),
          start: (pluginContext: PluginStartContext) => {
            const model = requiredCapability<HostComposition["model"]>(
              pluginContext,
              defaultHostCapabilityIds.model,
            );
            const resources = requiredCapability<HostComposition["resources"]>(
              pluginContext,
              defaultHostCapabilityIds.resources,
            );
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
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.store, store),
                output(defaultHostCapabilityIds.transactionProvider, transactionProvider),
              ]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(
            defaultHostPluginIds.application,
            1,
            [
              capability(defaultHostCapabilityIds.operations),
              capability(defaultHostCapabilityIds.resourceMapper),
              capability(defaultHostCapabilityIds.snapshotStateDecoder),
              capability(defaultHostCapabilityIds.transactionEngine),
              capability(defaultHostCapabilityIds.workspace),
            ],
            [
              capability(defaultHostCapabilityIds.graph),
              capability(defaultHostCapabilityIds.invariant),
              capability(defaultHostCapabilityIds.model),
              capability(defaultHostCapabilityIds.queries),
              capability(defaultHostCapabilityIds.resources),
              capability(defaultHostCapabilityIds.transactionProvider),
            ],
          ),
          start: async (pluginContext: PluginStartContext) => {
            const graph = requiredCapability<HostComposition["graph"]>(
              pluginContext,
              defaultHostCapabilityIds.graph,
            );
            const invariant = requiredCapability<HostComposition["invariant"]>(
              pluginContext,
              defaultHostCapabilityIds.invariant,
            );
            const model = requiredCapability<HostComposition["model"]>(
              pluginContext,
              defaultHostCapabilityIds.model,
            );
            const queries = requiredCapability<HostComposition["queries"]>(
              pluginContext,
              defaultHostCapabilityIds.queries,
            );
            const resources = requiredCapability<HostComposition["resources"]>(
              pluginContext,
              defaultHostCapabilityIds.resources,
            );
            const transactionProvider = requiredCapability<HostComposition["transactionProvider"]>(
              pluginContext,
              defaultHostCapabilityIds.transactionProvider,
            );
            const transactionEngine = new TransactionEngine({
              maxAffectedIdentities:
                defaultHostBounds.maxComponents + defaultHostBounds.maxRelationships,
              maxRequestDataDepth: defaultHostBounds.maxRequestDataDepth,
              maxRequestDataValues: defaultHostBounds.maxRequestDataValues,
              maxSnapshotStateDepth: defaultHostBounds.maxSnapshotStateDepth,
              maxSnapshotStateValues: defaultHostBounds.maxSnapshotStateValues,
              provider: transactionProvider,
            });
            const registered = transactionEngine.registerInvariant(invariant);
            if (!registered.ok) throw new Error("Built-in invariant registration failed");
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
                if (operations === undefined) {
                  throw new Error("application operations are not composed");
                }
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
              snapshotStateDecoder,
              transactionExecution: transactionEngine,
              transactionProvider,
            });
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.operations, operations),
                output(defaultHostCapabilityIds.resourceMapper, resourceMapper),
                output(defaultHostCapabilityIds.snapshotStateDecoder, snapshotStateDecoder),
                output(defaultHostCapabilityIds.transactionEngine, transactionEngine),
                output(defaultHostCapabilityIds.workspace, workspace),
              ]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(
            defaultHostPluginIds.surface,
            1,
            [capability(defaultHostCapabilityIds.surface)],
            [
              capability(defaultHostCapabilityIds.operations),
              capability(defaultHostCapabilityIds.workspace),
            ],
          ),
          start: () =>
            Object.freeze({
              capabilities: Object.freeze([output(defaultHostCapabilityIds.surface, surface)]),
            }),
        }),
      ]);
      const runtime = new PluginRuntime({
        maxCapabilitiesPerPlugin: 16,
        maxDiagnostics: defaultHostBounds.maxDiagnosticCount,
        maxPlugins: 16,
        maxTokenCharacters: 128,
      });
      const resolved = runtime.resolve(registrations);
      if (!resolved.ok) {
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Built-in plugin resolution failed"),
        );
      }
      const started = await runtime.start(
        resolved.value,
        Object.freeze({
          isCancellationRequested: () => context.cancellation?.aborted === true,
        }),
      );
      if (!started.ok) {
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Built-in plugin startup failed"),
        );
      }
      plugins = started.value;
      if (context.cancellation?.aborted === true) {
        const running = plugins;
        plugins = undefined;
        await running.cancel();
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Built-in plugin startup was cancelled"),
        );
      }
      const graph = runningCapability<HostComposition["graph"]>(
        plugins,
        defaultHostCapabilityIds.graph,
      );
      const invariant = runningCapability<HostComposition["invariant"]>(
        plugins,
        defaultHostCapabilityIds.invariant,
      );
      const model = runningCapability<HostComposition["model"]>(
        plugins,
        defaultHostCapabilityIds.model,
      );
      const operations = runningCapability<HostComposition["operations"]>(
        plugins,
        defaultHostCapabilityIds.operations,
      );
      const queries = runningCapability<HostComposition["queries"]>(
        plugins,
        defaultHostCapabilityIds.queries,
      );
      const resourceMapper = runningCapability<HostComposition["resourceMapper"]>(
        plugins,
        defaultHostCapabilityIds.resourceMapper,
      );
      const resources = runningCapability<HostComposition["resources"]>(
        plugins,
        defaultHostCapabilityIds.resources,
      );
      const snapshotStateDecoder = runningCapability<HostComposition["snapshotStateDecoder"]>(
        plugins,
        defaultHostCapabilityIds.snapshotStateDecoder,
      );
      const store = runningCapability<HostComposition["store"]>(
        plugins,
        defaultHostCapabilityIds.store,
      );
      const runningSurface = runningCapability<HostComposition["surface"]>(
        plugins,
        defaultHostCapabilityIds.surface,
      );
      const transactionEngine = runningCapability<HostComposition["transactionEngine"]>(
        plugins,
        defaultHostCapabilityIds.transactionEngine,
      );
      const transactionProvider = runningCapability<HostComposition["transactionProvider"]>(
        plugins,
        defaultHostCapabilityIds.transactionProvider,
      );
      const workspace = runningCapability<HostComposition["workspace"]>(
        plugins,
        defaultHostCapabilityIds.workspace,
      );
      return success<HostComposition>(
        Object.freeze({
          graph,
          invariant,
          model,
          operations,
          plugins,
          queries,
          resourceMapper,
          resources,
          store,
          surface: runningSurface,
          snapshotStateDecoder,
          transactionEngine,
          transactionProvider,
          workspace,
        }),
      );
    } catch {
      if (plugins !== undefined) {
        const running = plugins;
        plugins = undefined;
        if (context.cancellation?.aborted === true) await running.cancel();
        else await running.shutdown();
      }
      return failure<HostComposition>(
        diagnostic("host-composition-failed", "Default local host composition failed"),
      );
    }
  };

  return Object.freeze({ compose });
}
