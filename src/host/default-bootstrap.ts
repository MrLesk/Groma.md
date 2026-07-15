import { randomBytes } from "node:crypto";

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
  type Result,
  type RunningPluginGraph,
  type StagedPluginGraph,
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
import {
  createLocalConfigurationDiscovery,
  createYamlConfigurationParser,
  loadBootstrapConfiguration,
  localBootstrapConvention,
  parseBootstrapConfiguration,
  sameBootstrapConfigurationLoad,
  type BootstrapConfigurationLoad,
  type ConfigurationDiscoveryProvider,
  type ConfigurationParserProvider,
} from "./bootstrap-configuration.ts";
import type {
  DefaultBootstrapRegistryOptions,
  HostBootstrapRegistry,
  HostComposition,
  HostProcessContext,
} from "./contracts.ts";
import { createLocalWorkspaceCapability, defaultWorkspaceDocument } from "./local-workspace.ts";

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
  configurationDiscovery: "official.configuration-discovery",
  configurationParser: "official.configuration-parser",
  kernel: "official.kernel",
  model: "official.model",
  persistence: "official.persistence",
  resources: "official.resources",
  surface: "official.surface",
});

export const defaultHostCapabilityIds = Object.freeze({
  configurationDiscovery: "groma.configuration-discovery/v1",
  configurationParser: "groma.configuration-parser/v1",
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
  const additionalBootstrapPlugins = Object.freeze([...(options.additionalBootstrapPlugins ?? [])]);
  const additionalRuntimePlugins = Object.freeze([...(options.additionalRuntimePlugins ?? [])]);
  const coordinationRoot = options.coordinationRoot;
  const entropyOption = options.entropy;
  const resourceFaultInjector = options.resourceFaultInjector;
  const selectedTarget = Object.freeze({
    architecture: options.target?.architecture ?? process.arch,
    platform: options.target?.platform ?? process.platform,
  });
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
    const convention =
      typeof context.workspaceRoot === "string"
        ? localBootstrapConvention({
            architecture: selectedTarget.architecture as "arm64" | "x64",
            platform: selectedTarget.platform as "darwin" | "linux" | "win32",
            workspaceRoot: context.workspaceRoot,
          })
        : failure(
            diagnostic(
              "invalid-host-process-context",
              "Host workspace root must be an absolute path",
            ),
          );
    if (!convention.ok) {
      return failure<HostComposition>(
        diagnostic("invalid-host-process-context", "Host workspace root must be an absolute path"),
      );
    }
    const isCancellationRequested = () => context.cancellation?.aborted === true;
    let plugins: RunningPluginGraph | undefined;
    let staged: StagedPluginGraph | undefined;
    try {
      let bootstrap: BootstrapConfigurationLoad;
      let selectedParser: ConfigurationParserProvider;
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
              workspaceRoot: convention.value.workspaceRoot,
            });
            return Object.freeze({
              capabilities: Object.freeze([output(defaultHostCapabilityIds.resources, resources)]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(
            defaultHostPluginIds.configurationDiscovery,
            0,
            [capability(defaultHostCapabilityIds.configurationDiscovery)],
            [capability(defaultHostCapabilityIds.resources)],
          ),
          start: (pluginContext: PluginStartContext) => {
            const resources = requiredCapability<HostComposition["resources"]>(
              pluginContext,
              defaultHostCapabilityIds.resources,
            );
            const discovery = createLocalConfigurationDiscovery(resources);
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.configurationDiscovery, discovery),
              ]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(defaultHostPluginIds.configurationParser, 0, [
            capability(defaultHostCapabilityIds.configurationParser),
          ]),
          start: () => {
            const parser = createYamlConfigurationParser();
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.configurationParser, parser),
              ]),
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
              configuration: Object.freeze({
                initialDocument: new TextEncoder().encode(defaultWorkspaceDocument),
                isCompatible: (bytes: Uint8Array) => {
                  const parsed = parseBootstrapConfiguration(selectedParser, bytes);
                  if (!parsed.ok) return false;
                  return sameBootstrapConfigurationLoad(bootstrap, {
                    configuration: parsed.value,
                    locator: bootstrap.locator,
                    state: "configured",
                  });
                },
                locator: bootstrap.locator.configuration,
                missingIsCompatible: bootstrap.state === "missing",
              }),
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
        maxPlugins: 128,
        maxTokenCharacters: 128,
      });
      const builtInPhaseZero = registrations.filter(
        (registration) => registration.manifest.phase === 0,
      );
      const builtInPhaseOne = registrations.filter(
        (registration) => registration.manifest.phase === 1,
      );
      const phaseZeroRegistrations = Object.freeze([
        ...builtInPhaseZero,
        ...additionalBootstrapPlugins,
      ]);
      const phaseZero = runtime.resolve(phaseZeroRegistrations);
      if (!phaseZero.ok) {
        const bootstrapCapabilityIds = new Set<string>([
          defaultHostCapabilityIds.resources,
          defaultHostCapabilityIds.configurationDiscovery,
          defaultHostCapabilityIds.configurationParser,
        ]);
        const bootstrapPluginIds = new Set<string>([
          defaultHostPluginIds.resources,
          defaultHostPluginIds.configurationDiscovery,
          defaultHostPluginIds.configurationParser,
        ]);
        const ambiguous = phaseZero.diagnostics.some(
          (item) =>
            ((item.code === "capability-provider-collision" ||
              item.code === "invalid-capability-cardinality") &&
              typeof item.details?.capabilityId === "string" &&
              bootstrapCapabilityIds.has(item.details.capabilityId)) ||
            (item.code === "duplicate-plugin-registration" &&
              typeof item.details?.pluginId === "string" &&
              bootstrapPluginIds.has(item.details.pluginId)),
        );
        return failure<HostComposition>(
          ambiguous
            ? diagnostic(
                "bootstrap-provider-ambiguous",
                "Bootstrap capabilities must have exactly one compatible provider",
              )
            : diagnostic("host-composition-failed", "Bootstrap plugin resolution failed"),
        );
      }
      const phaseZeroStarted = await runtime.startPhaseZero(
        phaseZero.value,
        Object.freeze({
          isCancellationRequested,
        }),
      );
      if (!phaseZeroStarted.ok) {
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Bootstrap plugin startup failed"),
        );
      }
      staged = phaseZeroStarted.value;
      const failAfterStage = async (
        ...diagnostics: readonly Diagnostic[]
      ): Promise<Result<HostComposition>> => {
        const current = staged;
        staged = undefined;
        if (current !== undefined) {
          const cleanup = await current.shutdown();
          if (!cleanup.ok) {
            return failure<HostComposition>(
              diagnostic("host-plugin-cleanup-failed", "Host plugin cleanup failed"),
            );
          }
        }
        return failure<HostComposition>(...diagnostics);
      };
      const resources = runningCapability<HostComposition["resources"]>(
        staged,
        defaultHostCapabilityIds.resources,
      );
      const configurationDiscovery = runningCapability<ConfigurationDiscoveryProvider>(
        staged,
        defaultHostCapabilityIds.configurationDiscovery,
      );
      const configurationParser = runningCapability<ConfigurationParserProvider>(
        staged,
        defaultHostCapabilityIds.configurationParser,
      );
      selectedParser = configurationParser;
      const loaded = await loadBootstrapConfiguration(configurationDiscovery, configurationParser);
      if (!loaded.ok) return failAfterStage(...loaded.diagnostics);
      bootstrap = loaded.value;
      if (isCancellationRequested()) {
        const current = staged;
        staged = undefined;
        if (current !== undefined) await current.cancel();
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Bootstrap plugin startup was cancelled"),
        );
      }
      const requested =
        bootstrap.state === "configured"
          ? bootstrap.configuration.requestedRuntimePlugins
          : Object.freeze([]);
      if (requested.some((plugin) => plugin.source === "project")) {
        return failAfterStage(
          diagnostic(
            "project-plugin-validation-required",
            "Project-provided plugins require validated package and trust state before loading",
          ),
        );
      }
      const requestedIds = new Set(requested.map((plugin) => plugin.id));
      const availableBuiltIns = new Set(
        builtInPhaseOne.map((registration) => registration.manifest.id),
      );
      const selectedAdditional: PluginRegistration[] = [];
      for (const registration of additionalRuntimePlugins) {
        const id = registration.manifest.id;
        if (!id.startsWith("official.")) {
          return failAfterStage(
            diagnostic(
              "project-plugin-validation-required",
              "Only host-owned official registrations can enter bootstrap selection",
            ),
          );
        }
        if (requestedIds.has(id)) {
          availableBuiltIns.add(id);
          selectedAdditional.push(registration);
        }
      }
      const unavailable = [...requestedIds].filter((id) => !availableBuiltIns.has(id)).sort();
      if (unavailable.length > 0) {
        return failAfterStage(
          diagnostic(
            "runtime-plugin-unavailable",
            "A requested official runtime plugin is unavailable in this host",
          ),
        );
      }
      const selectedRegistrations = Object.freeze([
        ...phaseZeroRegistrations,
        ...builtInPhaseOne,
        ...selectedAdditional,
      ]);
      const resolved = runtime.resolve(selectedRegistrations);
      if (!resolved.ok) {
        return failAfterStage(
          diagnostic("host-composition-failed", "Selected plugin resolution failed"),
        );
      }
      const reloaded = await loadBootstrapConfiguration(
        configurationDiscovery,
        configurationParser,
      );
      if (!reloaded.ok) return failAfterStage(...reloaded.diagnostics);
      if (!sameBootstrapConfigurationLoad(bootstrap, reloaded.value)) {
        return failAfterStage(
          diagnostic(
            "workspace-configuration-changed",
            "Workspace configuration changed during bootstrap; restart after changes settle",
          ),
        );
      }
      bootstrap = reloaded.value;
      const started = await runtime.continue(
        resolved.value,
        staged,
        Object.freeze({
          isCancellationRequested,
        }),
      );
      if (!started.ok) {
        staged = undefined;
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Selected plugin startup failed"),
        );
      }
      plugins = started.value;
      staged = undefined;
      if (isCancellationRequested()) {
        const running = plugins;
        plugins = undefined;
        await running.cancel();
        return failure<HostComposition>(
          diagnostic("host-composition-failed", "Built-in plugin startup was cancelled"),
        );
      }
      const workspace = runningCapability<HostComposition["workspace"]>(
        plugins,
        defaultHostCapabilityIds.workspace,
      );
      const workspaceStatus = workspace.status();
      if (workspaceStatus.state === "conflict") {
        const providerFailure =
          workspaceStatus.diagnostic.code === "workspace-configuration-provider-failure" &&
          workspaceStatus.diagnostic.message === "Workspace configuration access failed" &&
          workspaceStatus.diagnostic.details === undefined;
        const configurationConflict =
          workspaceStatus.diagnostic.code === "workspace-configuration-conflict" &&
          workspaceStatus.diagnostic.message ===
            "The workspace configuration is malformed or incompatible with this Groma host" &&
          workspaceStatus.diagnostic.details === undefined;
        const startupDiagnostic = providerFailure
          ? diagnostic(
              "workspace-configuration-provider-failure",
              "Workspace configuration access failed",
            )
          : configurationConflict
            ? diagnostic(
                "workspace-configuration-changed",
                "Workspace configuration changed during bootstrap; restart after changes settle",
              )
            : diagnostic("host-composition-failed", "Default local host composition failed");
        const running = plugins;
        plugins = undefined;
        const cleanup = await running.shutdown();
        return failure<HostComposition>(
          cleanup.ok
            ? startupDiagnostic
            : diagnostic("host-plugin-cleanup-failed", "Host plugin cleanup failed"),
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
        if (isCancellationRequested()) await running.cancel();
        else await running.shutdown();
      } else if (staged !== undefined) {
        const current = staged;
        staged = undefined;
        if (isCancellationRequested()) await current.cancel();
        else await current.shutdown();
      }
      return failure<HostComposition>(
        diagnostic("host-composition-failed", "Default local host composition failed"),
      );
    }
  };

  return Object.freeze({ compose });
}
