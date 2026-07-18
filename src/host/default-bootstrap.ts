import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { isAlias, isMap, isScalar, parseDocument, visit } from "yaml";

import {
  createApplicationOperations,
  createApplicationSnapshotStateDecoder,
  createSchemaMigrationOperations,
  type ApplicationOperations,
  type CanonicalMigrationCatalogCapability,
  type ComponentResourceMapper,
  type SchemaMigrationOperations,
} from "../application/index.ts";
import {
  BoundedQueryContracts,
  canonicalSchemaMigrationApiVersion,
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
  type GraphQueryEngineCapability,
  type PluginCapabilityDeclaration,
  type PluginRegistration,
  type PluginStartContext,
  type ProjectionContinuityCapability,
  type ProjectionIndexCapability,
  type Result,
  type ResourceKey,
  type RunningPluginGraph,
  type StagedPluginGraph,
  type TransactionOutcome,
  type TransactionProvider,
} from "../core/index.ts";
import {
  aliasStoreLocator,
  createAliasStore,
  createLocalResourceProvider,
  createLocalCanonicalMigrationCatalog,
  createLocalTransactionJournal,
  createLocalProjectionIndex,
  createProjectionQueryEngine,
  createCanonicalMigrationTransactionAdapter,
  createMarkdownIntentStore,
  createTransactionProjectionCanonicalSource,
  createMarkdownIntentTransactionAdapter,
  DEFAULT_PROJECTION_QUERY_CONTEXT_CHARACTERS,
  DEFAULT_PROJECTION_QUERY_CURSOR_CHARACTERS,
  markdownIntentLocator,
} from "../persistence/index.ts";
import {
  createStandardModelCapability,
  createStandardModelInvariant,
} from "../standard-model/index.ts";
import { isHostProxy } from "./runtime-validation.ts";
import {
  bootstrapConfigurationBounds,
  bootstrapConfigurationStillUsable,
  createLocalConfigurationDiscovery,
  createYamlConfigurationParser,
  loadBootstrapConfiguration,
  localBootstrapConvention,
  parseBootstrapConfiguration,
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
import { createLocalPluginPackageManager } from "./local-plugin-packages.ts";
import { defaultHostPluginRegistrationBounds } from "./plugin-runtime-bounds.ts";
import { defaultHostCapabilityIds, defaultHostPluginIds } from "./default-host-identities.ts";

const intrinsicReflectApply = Reflect.apply;

export const defaultHostBounds = Object.freeze({
  // Leaves one fixed 64-KiB envelope below the CLI's independent eight-MiB result cap.
  maxBlueprintPageBytes: 8 * 1024 * 1024 - 64 * 1024,
  // Leaves the CLI's independent command and Application-result envelope levels.
  maxBlueprintPageDepth: 28,
  maxCanonicalMigrationResources: 2_003,
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

function multipleCapability(id: string): PluginCapabilityDeclaration {
  return Object.freeze({ cardinality: "multiple", id, version: defaultCapabilityVersion });
}

const migrationUtf8 = new TextDecoder("utf-8", { fatal: true });
const migrationEncoder = new TextEncoder();

function replaceDeclaredSchema(
  input: { readonly bytes: Uint8Array; readonly locator: string; readonly schema: string },
  fromSchema: string,
  toSchema: string,
) {
  try {
    if (input.schema !== fromSchema) throw new Error();
    const text = migrationUtf8.decode(input.bytes);
    const json = input.locator === "groma/packages.lock";
    let source = text;
    let sourceOffset = 0;
    if (input.locator.endsWith(".md")) {
      const lines = text.split("\n");
      if (lines[0] !== "---") throw new Error();
      const closing = lines.indexOf("---", 1);
      if (closing < 0) throw new Error();
      source = lines.slice(1, closing).join("\n");
      sourceOffset = 4;
    }
    const document = parseDocument(source, {
      logLevel: "silent",
      prettyErrors: false,
      schema: json ? "json" : "core",
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });
    let unsupported = false;
    visit(document, {
      Alias: () => {
        unsupported = true;
        return visit.BREAK;
      },
      Node: (_key, node) => {
        if (isAlias(node) || node.anchor !== undefined || node.tag !== undefined) {
          unsupported = true;
          return visit.BREAK;
        }
      },
    });
    if (
      unsupported ||
      document.errors.length > 0 ||
      document.warnings.length > 0 ||
      !isMap(document.contents)
    )
      throw new Error();
    const schemas = document.contents.items.filter(
      (pair) => isScalar(pair.key) && pair.key.value === "schema",
    );
    if (schemas.length !== 1) throw new Error();
    const schema = schemas[0]!.value;
    if (!isScalar(schema) || schema.value !== fromSchema || schema.range === undefined)
      throw new Error();
    const [rangeStart, rangeEnd] = schema.range;
    if (
      !Number.isSafeInteger(rangeStart) ||
      !Number.isSafeInteger(rangeEnd) ||
      rangeStart < 0 ||
      rangeEnd < rangeStart ||
      rangeEnd > source.length
    )
      throw new Error();
    const replacementValue =
      json || schema.type === "QUOTE_DOUBLE"
        ? JSON.stringify(toSchema)
        : schema.type === "QUOTE_SINGLE"
          ? `'${toSchema}'`
          : toSchema;
    const scalarSource = source.slice(rangeStart, rangeEnd);
    const trailingLineBreak = scalarSource.endsWith("\r\n")
      ? "\r\n"
      : scalarSource.endsWith("\n")
        ? "\n"
        : scalarSource.endsWith("\r")
          ? "\r"
          : "";
    const replacement =
      schema.type === "BLOCK_FOLDED" || schema.type === "BLOCK_LITERAL"
        ? `${replacementValue}${trailingLineBreak}`
        : replacementValue;
    const absoluteStart = sourceOffset + rangeStart;
    const absoluteEnd = sourceOffset + rangeEnd;
    const replaced = `${text.slice(0, absoluteStart)}${replacement}${text.slice(absoluteEnd)}`;
    return success(Object.freeze({ bytes: migrationEncoder.encode(replaced) }));
  } catch {
    return failure(
      diagnostic(
        "official-schema-migrator-input-invalid",
        "Canonical resource does not match the declared older schema",
      ),
    );
  }
}

const officialSchemaMigrationContribution = Object.freeze({
  apiVersion: canonicalSchemaMigrationApiVersion,
  id: "official.canonical-schemas",
  migrators: Object.freeze([
    Object.freeze({
      fromSchema: "groma/v0",
      fromVersion: 0,
      id: "official.groma-v0-to-v1",
      migrate: (input: Parameters<typeof replaceDeclaredSchema>[0]) =>
        replaceDeclaredSchema(input, "groma/v0", "groma/v0.1"),
      toSchema: "groma/v0.1",
      toVersion: 1,
    }),
    Object.freeze({
      fromSchema: "groma/aliases/v0",
      fromVersion: 0,
      id: "official.aliases-v0-to-v1",
      migrate: (input: Parameters<typeof replaceDeclaredSchema>[0]) =>
        replaceDeclaredSchema(input, "groma/aliases/v0", "groma/aliases/v0.1"),
      toSchema: "groma/aliases/v0.1",
      toVersion: 1,
    }),
    Object.freeze({
      fromSchema: "groma.packages-lock/v0",
      fromVersion: 0,
      id: "official.packages-lock-v0-to-v1",
      migrate: (input: Parameters<typeof replaceDeclaredSchema>[0]) =>
        replaceDeclaredSchema(input, "groma.packages-lock/v0", "groma.packages-lock/v1"),
      toSchema: "groma.packages-lock/v1",
      toVersion: 1,
    }),
  ]),
  schemas: Object.freeze([
    Object.freeze({ schema: "groma/v0", version: 0 }),
    Object.freeze({ schema: "groma/v0.1", version: 1 }),
    Object.freeze({ schema: "groma/aliases/v0", version: 0 }),
    Object.freeze({ schema: "groma/aliases/v0.1", version: 1 }),
    Object.freeze({ schema: "groma.packages-lock/v0", version: 0 }),
    Object.freeze({ schema: "groma.packages-lock/v1", version: 1 }),
    Object.freeze({ schema: "groma/evidence-source/v0.1", version: 1 }),
    Object.freeze({ schema: "groma/evidence-shard/v0.1", version: 1 }),
    Object.freeze({ schema: "groma/binding-shard/v0.1", version: 1 }),
  ]),
});

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
  const loadLocalPluginPackages = options.loadLocalPluginPackages ?? true;
  const migrationOnly = options.migrationOnly ?? false;
  const resourceFaultInjector = options.resourceFaultInjector;
  const userDataRoot = options.userDataRoot ?? path.join(homedir(), ".groma");
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
            const parser = createYamlConfigurationParser({
              allowLegacySchemaForMigration: migrationOnly,
            });
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
              capability(defaultHostCapabilityIds.schemaMigrationCatalog),
              capability(defaultHostCapabilityIds.schemaMigrationTransactionProvider),
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
                maxAliases: defaultHostBounds.maxComponents,
                model,
                store: rawStore,
              }),
              bounds: { maxTargets: defaultHostBounds.maxComponents },
              resources,
            });
            const schemaMigrationCatalog = createLocalCanonicalMigrationCatalog({
              bounds: {
                maxDocuments: defaultHostBounds.maxCanonicalMigrationResources,
                maxEntriesPerDirectory: defaultHostBounds.maxCanonicalMigrationResources,
                maxTotalBytes: 8 * 1024 * 1024,
                pageSize: defaultHostBounds.maxPageSize,
              },
              resources,
            });
            const schemaMigrationTransactionProvider = createLocalTransactionJournal({
              adapter: createCanonicalMigrationTransactionAdapter(schemaMigrationCatalog, {
                maxReplacementBytes: 8 * 1024 * 1024,
                maxTargetBytes: 8 * 1024 * 1024,
                maxTargets: defaultHostBounds.maxCanonicalMigrationResources,
              }),
              bounds: {
                maxJournalBytes: 16 * 1024 * 1024,
                maxReplacementBytes: 8 * 1024 * 1024,
                maxTargetBytes: 8 * 1024 * 1024,
                maxTargets: defaultHostBounds.maxCanonicalMigrationResources,
              },
              resources,
            });
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.schemaMigrationCatalog, schemaMigrationCatalog),
                output(
                  defaultHostCapabilityIds.schemaMigrationTransactionProvider,
                  schemaMigrationTransactionProvider,
                ),
                output(defaultHostCapabilityIds.store, store),
                output(defaultHostCapabilityIds.transactionProvider, transactionProvider),
              ]),
            });
          },
        }),
        Object.freeze({
          manifest: manifest(defaultHostPluginIds.schemaMigrations, 1, [
            multipleCapability(defaultHostCapabilityIds.schemaMigrators),
          ]),
          start: () =>
            Object.freeze({
              capabilities: Object.freeze([
                output(
                  defaultHostCapabilityIds.schemaMigrators,
                  officialSchemaMigrationContribution,
                ),
              ]),
            }),
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
              capability(defaultHostCapabilityIds.resources),
              capability(defaultHostCapabilityIds.transactionProvider),
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
            const transactionProvider = requiredCapability<
              HostComposition["transactionProvider"] & ProjectionContinuityCapability
            >(pluginContext, defaultHostCapabilityIds.transactionProvider);
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
              checkpoint: transactionProvider,
              isCancellationRequested: () => pluginContext.cancellation.isCancellationRequested(),
              resources,
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
              capability(defaultHostCapabilityIds.resourceMapper),
              capability(defaultHostCapabilityIds.snapshotStateDecoder),
              capability(defaultHostCapabilityIds.transactionEngine),
              capability(defaultHostCapabilityIds.workspace),
              capability(defaultHostCapabilityIds.schemaMigrationOperations),
            ],
            [
              capability(defaultHostCapabilityIds.graph),
              capability(defaultHostCapabilityIds.invariant),
              capability(defaultHostCapabilityIds.queryEngine),
              capability(defaultHostCapabilityIds.model),
              capability(defaultHostCapabilityIds.projection),
              capability(defaultHostCapabilityIds.queries),
              capability(defaultHostCapabilityIds.resources),
              capability(defaultHostCapabilityIds.schemaMigrationCatalog),
              capability(defaultHostCapabilityIds.schemaMigrationTransactionProvider),
              multipleCapability(defaultHostCapabilityIds.schemaMigrators),
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
            const schemaMigrationCatalog = requiredCapability<CanonicalMigrationCatalogCapability>(
              pluginContext,
              defaultHostCapabilityIds.schemaMigrationCatalog,
            );
            const schemaMigrationTransactionProvider = requiredCapability<TransactionProvider>(
              pluginContext,
              defaultHostCapabilityIds.schemaMigrationTransactionProvider,
            );
            const schemaMigrationContributions = pluginContext.requirements.find(
              (item) =>
                item.id === defaultHostCapabilityIds.schemaMigrators &&
                item.version === defaultCapabilityVersion,
            )?.providers;
            if (
              schemaMigrationContributions === undefined ||
              schemaMigrationContributions.length === 0
            ) {
              throw new Error("Built-in schema migration contributors are unavailable");
            }
            const schemaMigrationTransactionEngine = new TransactionEngine({
              maxAffectedIdentities: 1,
              maxRequestDataDepth: defaultHostBounds.maxRequestDataDepth,
              maxRequestDataValues: defaultHostBounds.maxSnapshotStateValues,
              maxSnapshotStateDepth: defaultHostBounds.maxSnapshotStateDepth,
              maxSnapshotStateValues: defaultHostBounds.maxSnapshotStateValues,
              provider: schemaMigrationTransactionProvider,
            });
            const migrations = createSchemaMigrationOperations({
              bounds: {
                maxContributions: defaultHostBounds.maxPluginRegistrations,
                maxDocumentBytes: 8 * 1024 * 1024,
                maxMigrators: defaultHostBounds.maxPluginRegistrations,
                maxPathCandidates: 2,
                maxPathExpansions: 2_048,
                maxPathSteps: 16,
                maxSchemas: defaultHostBounds.maxPluginRegistrations * 2,
                maxTokenCharacters: 128,
                maxTotalBytes: 8 * 1024 * 1024,
              },
              catalog: schemaMigrationCatalog,
              contributions: Object.freeze(
                schemaMigrationContributions.map((provider) => provider.value),
              ),
              targetVersion: 1,
              transactionExecution: schemaMigrationTransactionEngine,
            });
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
                initialDocument: new TextEncoder().encode(defaultWorkspaceDocument),
                isCompatible: (bytes: Uint8Array) => {
                  const parsed = parseBootstrapConfiguration(selectedParser, bytes);
                  if (!parsed.ok) return false;
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
              transactionProvider: migrationOnly
                ? Object.freeze({
                    ...schemaMigrationTransactionProvider,
                    snapshot: async (requested: readonly ResourceKey[]) => {
                      const snapshot = await schemaMigrationTransactionProvider.snapshot(requested);
                      return requested.length === 0
                        ? Object.freeze({
                            ...snapshot,
                            state: Object.freeze({
                              components: Object.freeze([]),
                              relationships: Object.freeze([]),
                            }),
                          })
                        : snapshot;
                    },
                  })
                : transactionProvider,
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
            return Object.freeze({
              capabilities: Object.freeze([
                output(defaultHostCapabilityIds.operations, operations),
                output(defaultHostCapabilityIds.resourceMapper, resourceMapper),
                output(defaultHostCapabilityIds.snapshotStateDecoder, snapshotStateDecoder),
                output(defaultHostCapabilityIds.transactionEngine, transactionEngine),
                output(defaultHostCapabilityIds.workspace, workspace),
                output(defaultHostCapabilityIds.schemaMigrationOperations, migrations),
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
              capability(defaultHostCapabilityIds.schemaMigrationOperations),
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
      const packageManager = createLocalPluginPackageManager({
        allowLegacySchemasForMigration: migrationOnly,
        bootstrap,
        maxEnabledPlugins: Math.max(
          0,
          defaultHostBounds.maxPluginRegistrations -
            phaseZeroRegistrations.length -
            builtInPhaseOne.length -
            bootstrapConfigurationBounds.maxRequestedRuntimePlugins,
        ),
        resources,
        trustRootPlatform: selectedTarget.platform === "win32" ? "win32" : "posix",
        userDataRoot,
        workspaceRoot: convention.value.workspaceRoot,
      });
      const packageOperations = Object.freeze({
        add: packageManager.add,
        disable: packageManager.disable,
        enable: packageManager.enable,
        inspect: packageManager.inspect,
        remove: packageManager.remove,
        scaffold: packageManager.scaffold,
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
      const loadedPackages = loadLocalPluginPackages
        ? await packageManager.loadEnabled()
        : success(
            Object.freeze({
              personalPluginIds: Object.freeze([]),
              registrations: Object.freeze([]),
            }),
          );
      if (!loadedPackages.ok) return failAfterStage(...loadedPackages.diagnostics);
      const selectedRegistrations = Object.freeze([
        ...selectedHostRegistrations,
        ...loadedPackages.value.registrations,
      ]);
      const resolved = runtime.resolve(selectedRegistrations);
      if (!resolved.ok) {
        return failAfterStage(
          diagnostic("host-composition-failed", "Selected plugin resolution failed"),
        );
      }
      const resolvedInspection = resolved.value.inspect();
      for (const pluginId of loadedPackages.value.personalPluginIds) {
        const plugin = resolvedInspection.plugins.find((entry) => entry.id === pluginId);
        if (
          plugin === undefined ||
          plugin.phase !== 1 ||
          [...plugin.provides, ...plugin.requires].some(
            (declaration) => !declaration.id.startsWith("groma.presentation."),
          )
        ) {
          return failAfterStage(
            diagnostic(
              "personal-plugin-capability-forbidden",
              "Personal plugins may provide or require only groma.presentation.* capabilities",
            ),
          );
        }
      }
      const reloaded = await loadBootstrapConfiguration(
        configurationDiscovery,
        configurationParser,
      );
      if (!reloaded.ok) return failAfterStage(...reloaded.diagnostics);
      if (!bootstrapConfigurationStillUsable(bootstrap, reloaded.value)) {
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
      const migrations = runningCapability<SchemaMigrationOperations>(
        plugins,
        defaultHostCapabilityIds.schemaMigrationOperations,
      );
      const queries = runningCapability<HostComposition["queries"]>(
        plugins,
        defaultHostCapabilityIds.queries,
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
      return success<HostComposition>(
        Object.freeze({
          graph,
          invariant,
          model,
          migrations,
          operations,
          packages: packageOperations,
          plugins,
          projection,
          projectionRead,
          queryEngine,
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
