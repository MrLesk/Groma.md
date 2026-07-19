import { randomBytes } from "node:crypto";

import {
  createApplicationOperations,
  createApplicationSnapshotStateDecoder,
  createReconciliationOperations,
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
  type CompletedObservationSnapshot,
  type GraphQueryEngineCapability,
  type PluginCapabilityDeclaration,
  type PluginRegistration,
  type PluginStartContext,
  type ProjectionIndexCapability,
  type Result,
  type RunningPluginGraph,
  type StagedPluginGraph,
  type TransactionOutcome,
  type TransactionProvider,
} from "../core/index.ts";
import {
  aliasStoreLocator,
  createAliasStore,
  createLocalResourceProvider,
  createLocalTransactionJournal,
  createLocalProjectionIndex,
  createProjectionQueryEngine,
  createMarkdownIntentStore,
  createMarkdownEvidenceStore,
  createTransactionProjectionCanonicalSource,
  createMarkdownIntentTransactionAdapter,
  DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
  DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
  markdownIntentLocator,
  markdownEvidenceLocator,
} from "../persistence/index.ts";
import {
  createStandardModelCapability,
  createStandardModelInvariant,
} from "../standard-model/index.ts";
import { scannerCapabilityId, scannerCapabilityVersion } from "../plugin-sdk/index.ts";
import { isHostProxy } from "./runtime-validation.ts";
import {
  bootstrapConfigurationBounds,
  bootstrapConfigurationStillUsable,
  canonicalizeProjectRegistration,
  createLocalConfigurationDiscovery,
  createYamlConfigurationParser,
  loadBootstrapConfiguration,
  localBootstrapConvention,
  parseBootstrapConfiguration,
  serializeBootstrapConfiguration,
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
import { createLocalWorkspaceCapability } from "./local-workspace.ts";
import { createLocalProjectRegistry } from "./local-project-registry.ts";
import { createLocalScannerProjectResources } from "./scanner-project-resources.ts";
import { createScannerExecutionRuntime } from "./scanner-runtime.ts";
import { typescriptBunScannerRegistration } from "./typescript-bun-scanner.ts";
import { defaultHostPluginRegistrationBounds } from "./plugin-runtime-bounds.ts";
import { defaultHostCapabilityIds, defaultHostPluginIds } from "./default-host-identities.ts";

const intrinsicReflectApply = Reflect.apply;

export function initialProjectDisplayName(
  workspaceRoot: string,
  platform: "darwin" | "linux" | "win32",
): string {
  const isSeparator = (unit: number) => unit === 0x2f || (platform === "win32" && unit === 0x5c);
  let end = workspaceRoot.length;
  while (end > 0 && isSeparator(workspaceRoot.charCodeAt(end - 1))) end -= 1;
  let start = end;
  while (start > 0 && !isSeparator(workspaceRoot.charCodeAt(start - 1))) start -= 1;
  const candidate = workspaceRoot.slice(start, end);
  const raw = platform === "win32" && /^[A-Za-z]:$/.test(candidate) && start === 0 ? "" : candidate;
  const safe: string[] = [];
  for (const character of raw) {
    const code = character.codePointAt(0)!;
    safe.push(
      code <= 0x1f ||
        (code >= 0x7f && code <= 0x9f) ||
        code === 0x2028 ||
        code === 0x2029 ||
        (code >= 0xd800 && code <= 0xdfff)
        ? "-"
        : character,
    );
    if (safe.length === bootstrapConfigurationBounds.maxProjectDisplayNameCharacters) break;
  }
  const bounded = safe.join("").trim();
  return bounded.length === 0 ? "workspace" : bounded;
}

export const defaultHostBounds = Object.freeze({
  // Leaves one fixed 64-KiB envelope below the CLI's independent eight-MiB result cap.
  maxBlueprintPageBytes: 8 * 1024 * 1024 - 64 * 1024,
  // Leaves the CLI's independent command and Application-result envelope levels.
  maxBlueprintPageDepth: 28,
  maxComponents: 1_000,
  maxDiagnosticCount: 100,
  maxEmbeddedItems: 100,
  maxOwnerCharacters: 100,
  maxPageSize: 100,
  maxPluginRegistrations: 128,
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

class ProjectionAwareTransactionEngine extends TransactionEngine {
  readonly #projection: ProjectionIndexCapability;
  readonly #update: ProjectionIndexCapability["update"];

  constructor(
    options: ConstructorParameters<typeof TransactionEngine>[0],
    projection: ProjectionIndexCapability,
  ) {
    super(options);
    this.#projection = projection;
    this.#update = projection.update;
  }

  async #afterConfirmedCommit(outcome: TransactionOutcome): Promise<TransactionOutcome> {
    if (outcome.status === "committed") {
      try {
        await Reflect.apply(this.#update, this.#projection, [outcome.event]);
      } catch {
        // Projection state is disposable. A later load rebuilds it from canonical state.
      }
    }
    return outcome;
  }

  override async execute(request: Parameters<TransactionEngine["execute"]>[0]) {
    return this.#afterConfirmedCommit(await super.execute(request));
  }

  override async recover(recovery: Parameters<TransactionEngine["recover"]>[0]) {
    return this.#afterConfirmedCommit(await super.recover(recovery));
  }
}

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

function localPhaseOneProviderCanRepair(
  item: Diagnostic,
  registrations: readonly PluginRegistration[],
): boolean {
  if (
    item.code !== "missing-capability-provider" &&
    item.code !== "incompatible-capability-version"
  ) {
    return false;
  }
  const capabilityId = item.details?.capabilityId;
  const pluginId = item.details?.pluginId;
  const requiredVersion = item.details?.requiredVersion;
  if (
    typeof capabilityId !== "string" ||
    typeof pluginId !== "string" ||
    typeof requiredVersion !== "string"
  ) {
    return false;
  }
  const consumer = registrations.find(
    (registration) => registration.manifest.id === pluginId && registration.manifest.phase === 1,
  );
  const requirement = consumer?.manifest.requires.find(
    (candidate) => candidate.id === capabilityId && candidate.version === requiredVersion,
  );
  if (requirement === undefined) return false;
  if (item.code === "missing-capability-provider") return true;
  const existingProviders = registrations.flatMap((registration) =>
    registration.manifest.provides.filter((provided) => provided.id === capabilityId),
  );
  return (
    requirement.cardinality === "multiple" &&
    existingProviders.length > 0 &&
    existingProviders.every((provided) => provided.cardinality === "multiple")
  );
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
      const unsupported = convention.diagnostics[0];
      if (
        convention.diagnostics.length === 1 &&
        unsupported?.code === "unsupported-bootstrap-target" &&
        unsupported.message ===
          "Workspace bootstrap does not support this runtime platform or architecture" &&
        unsupported.details === undefined
      ) {
        return failure<HostComposition>(
          diagnostic(
            "unsupported-bootstrap-target",
            "Workspace bootstrap does not support this runtime platform or architecture",
          ),
        );
      }
      return failure<HostComposition>(
        diagnostic("invalid-host-process-context", "Host workspace root must be an absolute path"),
      );
    }
    const isCancellationRequested = () => context.cancellation?.aborted === true;
    const initialProject = canonicalizeProjectRegistration(
      Object.freeze({
        coverage: Object.freeze([Object.freeze({ id: "workspace", resourceRoot: "." })]),
        id: "project.default",
        name: initialProjectDisplayName(
          convention.value.workspaceRoot,
          selectedTarget.platform as "darwin" | "linux" | "win32",
        ),
        scanners: Object.freeze([]),
        source: ".",
      }),
    );
    if (!initialProject.ok) {
      return failure<HostComposition>(
        diagnostic("host-composition-failed", "Default project registration is invalid"),
      );
    }
    const initialConfiguration = Object.freeze({
      projectRegistrations: Object.freeze([initialProject.value]),
      requestedRuntimePlugins: Object.freeze([]),
      retiredProjectIds: Object.freeze([]),
      schema: "groma/v0.1" as const,
    });
    const initialConfigurationSource = serializeBootstrapConfiguration(initialConfiguration);
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
              maxAliases: defaultHostBounds.maxComponents,
              maxPageSize: defaultHostBounds.maxPageSize,
            });
            const queries = new BoundedQueryContracts({
              maxAnchorCharacters: 256,
              maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
              maxPageSize: defaultHostBounds.maxPageSize,
              maxQueryContextCharacters: DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
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
            const rawStore = createMarkdownIntentStore({
              bounds: {
                maxDocuments: defaultHostBounds.maxComponents,
                maxEntriesPerDirectory: defaultHostBounds.maxComponents,
                pageSize: defaultHostBounds.maxPageSize,
              },
              model,
              resources,
            });
            const aliases = createAliasStore({
              bounds: {
                maxAliases: defaultHostBounds.maxComponents,
              },
              resources,
            });
            const evidence = createMarkdownEvidenceStore({
              bounds: {
                maxDepth: defaultHostBounds.maxSnapshotStateDepth,
                maxValues: defaultHostBounds.maxSnapshotStateValues,
              },
              resources,
            });
            const store = Object.freeze({
              decode: rawStore.decode,
              load: async () => {
                const loadedAliases = await aliases.load();
                return loadedAliases.ok
                  ? rawStore.load(loadedAliases.value.aliases)
                  : loadedAliases;
              },
              read: rawStore.read,
              serialize: rawStore.serialize,
            });
            const transactionProvider = createLocalTransactionJournal({
              adapter: createMarkdownIntentTransactionAdapter({
                aliases,
                evidence,
                maxAliases: defaultHostBounds.maxComponents,
                model,
                store: rawStore,
              }),
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
            defaultHostPluginIds.projection,
            1,
            [
              capability(defaultHostCapabilityIds.projection),
              capability(defaultHostCapabilityIds.projectionRead),
            ],
            [
              capability(defaultHostCapabilityIds.model),
              capability(defaultHostCapabilityIds.transactionProvider),
            ],
          ),
          start: (pluginContext: PluginStartContext) => {
            const model = requiredCapability<HostComposition["model"]>(
              pluginContext,
              defaultHostCapabilityIds.model,
            );
            const transactionProvider = requiredCapability<HostComposition["transactionProvider"]>(
              pluginContext,
              defaultHostCapabilityIds.transactionProvider,
            );
            const projection = createLocalProjectionIndex({
              bounds: {
                maxAliases: defaultHostBounds.maxComponents,
                maxEntities: defaultHostBounds.maxComponents,
                maxPageSize: defaultHostBounds.maxPageSize,
                maxRelations: defaultHostBounds.maxRelationships,
              },
              canonical: createTransactionProjectionCanonicalSource({
                bounds: {
                  maxAliases: defaultHostBounds.maxComponents,
                  maxEntities: defaultHostBounds.maxComponents,
                  maxRelations: defaultHostBounds.maxRelationships,
                },
                model,
                transactionProvider,
              }),
            });
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.projection, projection),
                output(defaultHostCapabilityIds.projectionRead, projection),
              ]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(
            defaultHostPluginIds.queryEngine,
            1,
            [capability(defaultHostCapabilityIds.queryEngine)],
            [
              capability(defaultHostCapabilityIds.projectionRead),
              capability(defaultHostCapabilityIds.queries),
            ],
          ),
          start: (pluginContext: PluginStartContext) => {
            const projection = requiredCapability<HostComposition["projectionRead"]>(
              pluginContext,
              defaultHostCapabilityIds.projectionRead,
            );
            const queries = requiredCapability<HostComposition["queries"]>(
              pluginContext,
              defaultHostCapabilityIds.queries,
            );
            const queryEngine = createProjectionQueryEngine({
              bounds: {
                maxCursorCharacters: DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
                maxEntities: defaultHostBounds.maxComponents,
                maxPageSize: defaultHostBounds.maxPageSize,
                maxProjectionPageSize: defaultHostBounds.maxPageSize,
                maxTraversalEntities: defaultHostBounds.maxComponents,
                maxTraversalRelationVisits: defaultHostBounds.maxRelationships * 2,
                maxTraversalRelations: defaultHostBounds.maxRelationships,
              },
              projection,
              queries,
            });
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.queryEngine, queryEngine),
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
              capability(defaultHostCapabilityIds.reconciliation),
              capability(defaultHostCapabilityIds.resourceMapper),
              capability(defaultHostCapabilityIds.snapshotStateDecoder),
              capability(defaultHostCapabilityIds.transactionEngine),
              capability(defaultHostCapabilityIds.workspace),
            ],
            [
              capability(defaultHostCapabilityIds.graph),
              capability(defaultHostCapabilityIds.invariant),
              capability(defaultHostCapabilityIds.queryEngine),
              capability(defaultHostCapabilityIds.model),
              capability(defaultHostCapabilityIds.projection),
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
            const queryEngine = requiredCapability<HostComposition["queryEngine"]>(
              pluginContext,
              defaultHostCapabilityIds.queryEngine,
            );
            const model = requiredCapability<HostComposition["model"]>(
              pluginContext,
              defaultHostCapabilityIds.model,
            );
            const projection = requiredCapability<HostComposition["projection"]>(
              pluginContext,
              defaultHostCapabilityIds.projection,
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
            const transactionEngine = new ProjectionAwareTransactionEngine(
              {
                maxAffectedIdentities:
                  defaultHostBounds.maxComponents + defaultHostBounds.maxRelationships,
                maxRequestDataDepth: defaultHostBounds.maxRequestDataDepth,
                maxRequestDataValues: defaultHostBounds.maxRequestDataValues,
                maxSnapshotStateDepth: defaultHostBounds.maxSnapshotStateDepth,
                maxSnapshotStateValues: defaultHostBounds.maxSnapshotStateValues,
                provider: transactionProvider,
              },
              projection,
            );
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
            const aliasResourceMapper = Object.freeze({
              resourceForAliases: () => {
                const locator = aliasStoreLocator();
                return locator.ok ? parseResourceKey(locator.value) : locator;
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
                maxConfigurationBytes: bootstrapConfigurationBounds.maxConfigurationBytes,
                maxProviderDiagnostics: defaultHostBounds.maxDiagnosticCount,
                maxSnapshotResources: Math.max(
                  defaultHostBounds.maxComponents,
                  defaultHostBounds.maxRelationships,
                ),
                maxSnapshotStateDepth: defaultHostBounds.maxSnapshotStateDepth,
                maxSnapshotStateValues: defaultHostBounds.maxSnapshotStateValues,
              },
              configuration: Object.freeze({
                initialDocument: new TextEncoder().encode(initialConfigurationSource),
                isCompatible: (bytes: Uint8Array) => {
                  const parsed = parseBootstrapConfiguration(selectedParser, bytes);
                  if (!parsed.ok) return false;
                  if (bootstrap.state === "missing") {
                    return (
                      serializeBootstrapConfiguration(parsed.value) === initialConfigurationSource
                    );
                  }
                  return bootstrapConfigurationStillUsable(bootstrap, {
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
              aliasResourceMapper,
              bounds: {
                maxBlueprintPageBytes: defaultHostBounds.maxBlueprintPageBytes,
                maxBlueprintPageDepth: defaultHostBounds.maxBlueprintPageDepth,
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
              graphQueries: queryEngine,
              initialization: workspace,
              maxSnapshotAttempts: defaultHostBounds.maxSnapshotAttempts,
              model,
              queries,
              resourceMapper,
              snapshotStateDecoder,
              transactionExecution: transactionEngine,
              transactionProvider,
            });
            const evidenceResourceMapper = Object.freeze({
              resourceForEvidence: () => {
                const locator = markdownEvidenceLocator();
                return locator.ok ? parseResourceKey(locator.value) : locator;
              },
            });
            const reconciliation = createReconciliationOperations({
              bounds: {
                maxComponents: defaultHostBounds.maxEmbeddedItems,
                maxEmbeddedItems: defaultHostBounds.maxEmbeddedItems,
                maxRecords: defaultHostBounds.maxComponents * defaultHostBounds.maxEmbeddedItems,
                maxRelationships: defaultHostBounds.maxRelationshipMutations,
                maxSnapshotAttempts: defaultHostBounds.maxSnapshotAttempts,
                maxSources: defaultHostBounds.maxComponents,
              },
              entropy,
              evidenceResourceMapper,
              resourceMapper,
              snapshotStateDecoder,
              transactionExecution: transactionEngine,
              transactionProvider,
            });
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.operations, operations),
                output(defaultHostCapabilityIds.reconciliation, reconciliation),
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
        typescriptBunScannerRegistration,
      ]);
      const runtime = new PluginRuntime({
        maxCapabilitiesPerPlugin: defaultHostPluginRegistrationBounds.maxCapabilitiesPerPlugin,
        maxDiagnostics: defaultHostBounds.maxDiagnosticCount,
        maxPlugins: defaultHostBounds.maxPluginRegistrations,
        maxTokenCharacters: defaultHostPluginRegistrationBounds.maxTokenCharacters,
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
      const projectRegistry = createLocalProjectRegistry({ entropy, resources });
      const projectOperations = Object.freeze({
        add: projectRegistry.add,
        get: projectRegistry.get,
        list: projectRegistry.list,
        remove: projectRegistry.remove,
        update: projectRegistry.update,
      });
      const requested =
        bootstrap.state === "configured"
          ? bootstrap.configuration.requestedRuntimePlugins
          : Object.freeze([]);
      if (requested.some((plugin) => plugin.namespace === "project")) {
        return failAfterStage(
          diagnostic(
            "project-plugin-validation-required",
            "Project-provided plugins are unsupported in this release pending package and trust validation",
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
              "host-runtime-registration-invalid",
              "Host runtime registrations must use the official namespace",
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
      const selectedHostRegistrations = Object.freeze([
        ...phaseZeroRegistrations,
        ...builtInPhaseOne,
        ...selectedAdditional,
      ]);
      const hostPreflight = runtime.resolve(selectedHostRegistrations);
      if (
        !hostPreflight.ok &&
        hostPreflight.diagnostics.some(
          (item) => !localPhaseOneProviderCanRepair(item, selectedHostRegistrations),
        )
      ) {
        return failAfterStage(
          diagnostic("host-composition-failed", "Selected plugin resolution failed"),
        );
      }
      const resolved = runtime.resolve(selectedHostRegistrations);
      if (!resolved.ok) {
        return failAfterStage(
          diagnostic("host-composition-failed", "Selected plugin resolution failed"),
        );
      }
      const resolvedInspection = resolved.value.inspect();
      const overpoweredScanner = resolvedInspection.plugins.find(
        (plugin) =>
          plugin.requires.length > 0 &&
          plugin.provides.some(
            (declaration) =>
              declaration.id === scannerCapabilityId &&
              declaration.version === scannerCapabilityVersion,
          ),
      );
      if (overpoweredScanner !== undefined) {
        return failAfterStage(
          diagnostic(
            "scanner-provider-authority-invalid",
            "Scanner providers must not retain runtime capability requirements",
          ),
        );
      }
      const reloaded = await loadBootstrapConfiguration(
        configurationDiscovery,
        configurationParser,
      );
      if (!reloaded.ok) return failAfterStage(...reloaded.diagnostics);
      const bootstrapStillUsable =
        bootstrap.state === "missing" && reloaded.value.state === "configured"
          ? serializeBootstrapConfiguration(reloaded.value.configuration) ===
            initialConfigurationSource
          : bootstrapConfigurationStillUsable(bootstrap, reloaded.value);
      if (!bootstrapStillUsable) {
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
      const reconciliation = runningCapability<HostComposition["reconciliation"]>(
        plugins,
        defaultHostCapabilityIds.reconciliation,
      );
      const projection = runningCapability<HostComposition["projection"]>(
        plugins,
        defaultHostCapabilityIds.projection,
      );
      const projectionRead = runningCapability<HostComposition["projectionRead"]>(
        plugins,
        defaultHostCapabilityIds.projectionRead,
      );
      const queryEngine = runningCapability<GraphQueryEngineCapability>(
        plugins,
        defaultHostCapabilityIds.queryEngine,
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
      const scanners = createScannerExecutionRuntime({
        consumer: Object.freeze({
          async consume(snapshot: CompletedObservationSnapshot) {
            const outcome = await reconciliation.reconcile(snapshot);
            return outcome.ok ? success(undefined) : failure(...outcome.diagnostics);
          },
        }),
        entropy,
        plugins,
        projectResources: (project) =>
          createLocalScannerProjectResources({
            architecture: selectedTarget.architecture as "arm64" | "x64",
            ...(coordinationRoot === undefined ? {} : { coordinationRoot }),
            platform: selectedTarget.platform as "darwin" | "linux" | "win32",
            source: project.source,
            workspaceRoot: convention.value.workspaceRoot,
          }),
        projects: projectOperations,
      });
      return success<HostComposition>(
        Object.freeze({
          graph,
          invariant,
          model,
          operations,
          projects: projectOperations,
          plugins,
          projection,
          projectionRead,
          queryEngine,
          queries,
          reconciliation,
          resourceMapper,
          resources,
          scanners,
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
