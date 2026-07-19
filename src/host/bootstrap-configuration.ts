import path from "node:path";

import { isAlias, parseDocument, visit } from "yaml";

import { failure, success, type Diagnostic, type Result } from "../core/index.ts";
import { copyCanonicalGraphData, type GraphData } from "../core/payload.ts";
import {
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "../persistence/index.ts";
import {
  copyHostDiagnostics,
  inspectHostDenseArray,
  inspectHostRecord,
  isHostProxy,
} from "./runtime-validation.ts";

export type BootstrapPlatform = "darwin" | "linux" | "win32";
export type BootstrapArchitecture = "arm64" | "x64";

export interface LocalBootstrapTarget {
  readonly architecture: BootstrapArchitecture;
  readonly platform: BootstrapPlatform;
  readonly workspaceRoot: string;
}

export interface LocalBootstrapConvention {
  readonly absoluteConfigurationPath: string;
  readonly configurationLocator: WorkspaceResourceLocator;
  readonly workspaceRoot: string;
}

export interface WorkspaceLocator {
  readonly configuration: WorkspaceResourceLocator;
  readonly root: WorkspaceResourceLocator;
}

export interface RequestedRuntimePlugin {
  readonly id: string;
  readonly namespace: "official" | "project";
}

export interface ConfiguredProjectScanner {
  readonly configuration: GraphData;
  readonly id: string;
}

export interface ConfiguredProjectCoverageScope {
  readonly id: string;
  readonly resourceRoot: WorkspaceResourceLocator;
}

export interface ConfiguredProjectRegistration {
  readonly coverage: readonly ConfiguredProjectCoverageScope[];
  readonly id: string;
  readonly name: string;
  readonly scanners: readonly ConfiguredProjectScanner[];
  readonly source: WorkspaceResourceLocator;
}

export interface BootstrapBaseConfiguration {
  readonly projectRegistrations?: readonly ConfiguredProjectRegistration[];
  readonly requestedRuntimePlugins: readonly RequestedRuntimePlugin[];
  readonly retiredProjectIds?: readonly string[];
  readonly schema: "groma/v0.1";
}

export interface WorkspaceConfigurationCandidate {
  readonly bytes: Uint8Array;
  readonly locator: WorkspaceLocator;
}

export interface ConfigurationDiscoveryProvider {
  discover():
    | Promise<Result<readonly WorkspaceConfigurationCandidate[]>>
    | Result<readonly WorkspaceConfigurationCandidate[]>;
}

export interface ConfigurationParserProvider {
  parse(bytes: Uint8Array): Result<BootstrapBaseConfiguration>;
}

export type BootstrapConfigurationLoad =
  | {
      readonly configuration: BootstrapBaseConfiguration;
      readonly locator: WorkspaceLocator;
      readonly state: "configured";
    }
  | {
      readonly locator: WorkspaceLocator;
      readonly state: "missing";
    };

export const bootstrapConfigurationBounds = Object.freeze({
  maxConfigurationBytes: 64 * 1_024,
  maxDiscoveryCandidates: 8,
  maxProjectCoverageScopes: 64,
  maxProjectDisplayNameCharacters: 256,
  maxProjectRegistrations: 64,
  maxRetiredProjectIds: 1_024,
  maxProjectScannerConfigurationCharacters: 16_384,
  maxProjectScannerConfigurationDepth: 16,
  maxProjectScannerConfigurationValues: 1_000,
  maxProjectScanners: 64,
  maxProjectScannersTotal: 256,
  maxProviderDiagnostics: 100,
  maxRequestedRuntimePlugins: 64,
  maxTokenCharacters: 128,
});

const config = workspaceResourceLocator("groma", "groma.yaml");
const root = workspaceResourceLocator();
const coordination = workspaceResourceLocator("groma", "package-state");
if (!config.ok || !root.ok || !coordination.ok) {
  throw new Error("Built-in bootstrap locators are invalid");
}
/** Shared outer lease for every official mutation of groma/groma.yaml. */
export const workspaceConfigurationCoordinationLocator = coordination.value;
export const localWorkspaceLocator: WorkspaceLocator = Object.freeze({
  configuration: config.value,
  root: root.value,
});

const pluginIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const projectIdPattern = /^(?:project\.default|project_[0-9a-f]{32})$/;
const projectCoverageIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
const intrinsicTextDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const intrinsicUint8Array = Uint8Array;
const intrinsicUint8ArrayPrototype = Uint8Array.prototype;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicTypedArrayPrototype = intrinsicObjectGetPrototypeOf(intrinsicUint8ArrayPrototype);
const intrinsicTypedArrayByteLengthDescriptor = Object.getOwnPropertyDescriptor(
  intrinsicTypedArrayPrototype,
  "byteLength",
)?.get;
if (intrinsicTypedArrayByteLengthDescriptor === undefined) {
  throw new Error("Uint8Array byte length intrinsic is unavailable");
}
const intrinsicTypedArrayByteLength = intrinsicTypedArrayByteLengthDescriptor;

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function malformed(): Result<never> {
  return failure(
    diagnostic(
      "workspace-configuration-malformed",
      "The workspace configuration must use the documented bounded groma/v0.1 schema",
    ),
  );
}

function incompatible(): Result<never> {
  return failure(
    diagnostic(
      "workspace-configuration-conflict",
      "The workspace configuration schema is incompatible with this Groma host",
    ),
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isSafeProjectDisplayName(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) return false;
  let codePoints = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit <= 0x1f || (unit >= 0x7f && unit <= 0x9f) || unit === 0x2028 || unit === 0x2029) {
      return false;
    }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
    codePoints += 1;
    if (codePoints > bootstrapConfigurationBounds.maxProjectDisplayNameCharacters) return false;
  }
  return codePoints > 0;
}

export function isProjectRegistrationId(value: unknown): value is string {
  return typeof value === "string" && projectIdPattern.test(value);
}

function parseProjectLocator(value: unknown): Result<WorkspaceResourceLocator> {
  if (typeof value !== "string") return malformed();
  const parsed = parseWorkspaceResourceLocator(value);
  return parsed.ok && parsed.value === value ? parsed : malformed();
}

function targetsReservedAggregateState(locator: WorkspaceResourceLocator): boolean {
  if (locator === ".") return false;
  const topLevelSegment = locator.split("/", 1)[0]?.toLowerCase();
  return (
    topLevelSegment === "groma" || topLevelSegment === ".groma-cache" || topLevelSegment === ".git"
  );
}

function parseProjectScannerConfiguration(
  value: unknown,
  boundary: "configuration" | "parser",
): Result<{ readonly canonicalJson: string; readonly value: GraphData }> {
  const copied = copyCanonicalGraphData(
    value,
    "query",
    {
      code: "workspace-project-scanner-configuration-too-large",
      maximum: bootstrapConfigurationBounds.maxProjectScannerConfigurationCharacters,
      message: "Project scanner configuration exceeds its canonical character bound",
    },
    {
      code: "workspace-project-scanner-configuration-too-complex",
      maximumDepth: bootstrapConfigurationBounds.maxProjectScannerConfigurationDepth,
      maximumValues: bootstrapConfigurationBounds.maxProjectScannerConfigurationValues,
      message: "Project scanner configuration exceeds its structural bound",
    },
  );
  if (copied.ok) return success(copied.value);
  return boundary === "configuration"
    ? malformed()
    : failure(
        diagnostic(
          "workspace-configuration-parser-failed",
          "Workspace configuration parsing failed",
        ),
      );
}

function parseConfiguredProjects(
  value: unknown,
  boundary: "configuration" | "parser" = "configuration",
): Result<readonly ConfiguredProjectRegistration[]> {
  const invalid = () =>
    boundary === "configuration"
      ? malformed()
      : failure(
          diagnostic(
            "workspace-configuration-parser-failed",
            "Workspace configuration parsing failed",
          ),
        );
  const inspected = inspectHostDenseArray(
    value,
    bootstrapConfigurationBounds.maxProjectRegistrations,
    "workspace-configuration-parser-failed",
    "Configured projects",
  );
  if (!inspected.ok) return invalid();
  const projects: ConfiguredProjectRegistration[] = [];
  const ids = new Set<string>();
  let scannerCount = 0;
  for (const item of inspected.value) {
    const project = inspectHostRecord(
      item,
      [["coverage", "id", "name", "scanners", "source"]],
      "workspace-configuration-parser-failed",
      "Configured project",
    );
    if (
      !project.ok ||
      !isProjectRegistrationId(project.value.id) ||
      ids.has(project.value.id) ||
      !isSafeProjectDisplayName(project.value.name)
    ) {
      return invalid();
    }
    const source = parseProjectLocator(project.value.source);
    const coverage = inspectHostDenseArray(
      project.value.coverage,
      bootstrapConfigurationBounds.maxProjectCoverageScopes,
      "workspace-configuration-parser-failed",
      "Configured project coverage",
    );
    const scanners = inspectHostDenseArray(
      project.value.scanners,
      bootstrapConfigurationBounds.maxProjectScanners,
      "workspace-configuration-parser-failed",
      "Configured project scanners",
    );
    if (
      !source.ok ||
      targetsReservedAggregateState(source.value) ||
      !coverage.ok ||
      !scanners.ok ||
      coverage.value.length === 0
    ) {
      return invalid();
    }
    const canonicalCoverage: ConfiguredProjectCoverageScope[] = [];
    const coverageSet = new Set<string>();
    for (const scope of coverage.value) {
      const declaration = inspectHostRecord(
        scope,
        [["id", "resourceRoot"]],
        "workspace-configuration-parser-failed",
        "Configured project coverage scope",
      );
      if (
        !declaration.ok ||
        typeof declaration.value.id !== "string" ||
        declaration.value.id.length > bootstrapConfigurationBounds.maxTokenCharacters ||
        !projectCoverageIdPattern.test(declaration.value.id) ||
        coverageSet.has(declaration.value.id)
      ) {
        return invalid();
      }
      const resourceRoot = parseProjectLocator(declaration.value.resourceRoot);
      if (
        !resourceRoot.ok ||
        (source.value === "." && targetsReservedAggregateState(resourceRoot.value))
      ) {
        return invalid();
      }
      coverageSet.add(declaration.value.id);
      canonicalCoverage.push(
        Object.freeze({ id: declaration.value.id, resourceRoot: resourceRoot.value }),
      );
    }
    canonicalCoverage.sort((left, right) => compareCodeUnits(left.id, right.id));
    const canonicalScanners: ConfiguredProjectScanner[] = [];
    const scannerIds = new Set<string>();
    for (const entry of scanners.value) {
      const scanner = inspectHostRecord(
        entry,
        [["configuration", "id"]],
        "workspace-configuration-parser-failed",
        "Configured project scanner",
      );
      if (
        !scanner.ok ||
        typeof scanner.value.id !== "string" ||
        scanner.value.id.length > bootstrapConfigurationBounds.maxTokenCharacters ||
        !pluginIdPattern.test(scanner.value.id) ||
        scannerIds.has(scanner.value.id)
      ) {
        return invalid();
      }
      const configuration = parseProjectScannerConfiguration(scanner.value.configuration, boundary);
      if (!configuration.ok) return invalid();
      scannerIds.add(scanner.value.id);
      canonicalScanners.push(
        Object.freeze({ configuration: configuration.value.value, id: scanner.value.id }),
      );
    }
    scannerCount += canonicalScanners.length;
    if (scannerCount > bootstrapConfigurationBounds.maxProjectScannersTotal) return invalid();
    canonicalScanners.sort((left, right) => compareCodeUnits(left.id, right.id));
    ids.add(project.value.id);
    projects.push(
      Object.freeze({
        coverage: Object.freeze(canonicalCoverage),
        id: project.value.id,
        name: project.value.name,
        scanners: Object.freeze(canonicalScanners),
        source: source.value,
      }),
    );
  }
  projects.sort((left, right) => compareCodeUnits(left.id, right.id));
  return success(Object.freeze(projects));
}

/** Strict Host boundary used by configuration parsing and project-management requests. */
export function canonicalizeProjectRegistration(
  value: unknown,
): Result<ConfiguredProjectRegistration> {
  const parsed = parseConfiguredProjects(Object.freeze([value]), "parser");
  return parsed.ok
    ? success(parsed.value[0]!)
    : failure(diagnostic("invalid-project-registration", "Project registration is malformed"));
}

export function serializeBootstrapConfiguration(configuration: BootstrapBaseConfiguration): string {
  const lines = [`schema: ${configuration.schema}`];
  const projectRegistrations = configuration.projectRegistrations ?? Object.freeze([]);
  const retiredProjectIds = configuration.retiredProjectIds ?? Object.freeze([]);
  if (configuration.requestedRuntimePlugins.length > 0) {
    lines.push("plugins:");
    for (const plugin of configuration.requestedRuntimePlugins) {
      lines.push(`  - ${JSON.stringify(plugin.id)}`);
    }
  }
  if (projectRegistrations.length > 0) {
    lines.push("projects:");
    for (const project of projectRegistrations) {
      lines.push(`  - id: ${JSON.stringify(project.id)}`);
      lines.push(`    name: ${JSON.stringify(project.name)}`);
      lines.push(`    source: ${JSON.stringify(project.source)}`);
      lines.push("    scanners:");
      for (const scanner of project.scanners) {
        const configuration = parseProjectScannerConfiguration(scanner.configuration, "parser");
        if (!configuration.ok) throw new TypeError("Project scanner configuration is malformed");
        lines.push(`      - id: ${JSON.stringify(scanner.id)}`);
        lines.push(`        configuration: ${configuration.value.canonicalJson}`);
      }
      if (project.scanners.length === 0) lines[lines.length - 1] = "    scanners: []";
      lines.push("    coverage:");
      for (const scope of project.coverage) {
        lines.push(`      - id: ${JSON.stringify(scope.id)}`);
        lines.push(`        resourceRoot: ${JSON.stringify(scope.resourceRoot)}`);
      }
    }
  }
  if (retiredProjectIds.length > 0) {
    lines.push("retiredProjectIds:");
    for (const id of retiredProjectIds) lines.push(`  - ${JSON.stringify(id)}`);
  }
  return `${lines.join("\n")}\n`;
}

function copyBytes(value: unknown): Result<Uint8Array> {
  if (typeof value !== "object" || value === null) {
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
  try {
    if (intrinsicObjectGetPrototypeOf(value) !== intrinsicUint8ArrayPrototype) {
      return failure(
        diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
      );
    }
    const length = Reflect.apply(intrinsicTypedArrayByteLength, value, []) as number;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > bootstrapConfigurationBounds.maxConfigurationBytes
    ) {
      return failure(
        diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
      );
    }
    const copied = new intrinsicUint8Array(length);
    copied.set(value as Uint8Array);
    return success(copied);
  } catch {
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
}

function isMissingResource(value: readonly Diagnostic[]): boolean {
  const item = value[0];
  if (
    value.length !== 1 ||
    item?.code !== "resource-missing" ||
    item.message !== "Workspace resource does not exist" ||
    item.details === undefined
  ) {
    return false;
  }
  try {
    const keys = Reflect.ownKeys(item.details);
    const operation = Object.getOwnPropertyDescriptor(item.details, "operation");
    return (
      keys.length === 1 &&
      keys[0] === "operation" &&
      operation !== undefined &&
      "value" in operation &&
      operation.value === "resolve a resource"
    );
  } catch {
    return false;
  }
}

function isOversizedResource(value: readonly Diagnostic[]): boolean {
  const item = value[0];
  if (
    value.length !== 1 ||
    item?.code !== "resource-too-large" ||
    item.message !== "Workspace resource exceeds the requested byte limit" ||
    item.details === undefined
  ) {
    return false;
  }
  try {
    const keys = Reflect.ownKeys(item.details);
    const maximum = Object.getOwnPropertyDescriptor(item.details, "maximum");
    return (
      keys.length === 1 &&
      keys[0] === "maximum" &&
      maximum !== undefined &&
      "value" in maximum &&
      maximum.value === bootstrapConfigurationBounds.maxConfigurationBytes
    );
  } catch {
    return false;
  }
}

export function localBootstrapConvention(
  target: LocalBootstrapTarget,
): Result<LocalBootstrapConvention> {
  if (
    typeof target !== "object" ||
    target === null ||
    typeof target.architecture !== "string" ||
    typeof target.platform !== "string" ||
    typeof target.workspaceRoot !== "string"
  ) {
    return failure(
      diagnostic(
        "unsupported-bootstrap-target",
        "Workspace bootstrap does not support this runtime platform or architecture",
      ),
    );
  }
  const supportedPlatform =
    target.platform === "darwin" || target.platform === "linux" || target.platform === "win32";
  const supportedArchitecture = target.architecture === "x64" || target.architecture === "arm64";
  if (!supportedPlatform || !supportedArchitecture) {
    return failure(
      diagnostic(
        "unsupported-bootstrap-target",
        "Workspace bootstrap does not support this runtime platform or architecture",
      ),
    );
  }
  const paths = target.platform === "win32" ? path.win32 : path.posix;
  if (!paths.isAbsolute(target.workspaceRoot)) {
    return failure(
      diagnostic(
        "invalid-bootstrap-workspace-root",
        "Workspace configuration discovery requires an absolute workspace root",
      ),
    );
  }
  const normalizedRoot = paths.normalize(target.workspaceRoot);
  return success(
    Object.freeze({
      absoluteConfigurationPath: paths.join(normalizedRoot, "groma", "groma.yaml"),
      configurationLocator: localWorkspaceLocator.configuration,
      workspaceRoot: normalizedRoot,
    }),
  );
}

export function createLocalConfigurationDiscovery(
  resources: Pick<LocalResourceProvider, "read">,
  locator: WorkspaceLocator = localWorkspaceLocator,
): ConfigurationDiscoveryProvider {
  const receiver = resources as object;
  const read = resources.read;
  if (typeof read !== "function") {
    throw new TypeError("Local configuration discovery requires a resource read capability");
  }
  return Object.freeze({
    discover: async (): Promise<Result<readonly WorkspaceConfigurationCandidate[]>> => {
      let raw: unknown;
      try {
        raw = await Reflect.apply(read, receiver, [
          {
            locator: locator.configuration,
            maxBytes: bootstrapConfigurationBounds.maxConfigurationBytes,
          },
        ]);
      } catch {
        return failure(
          diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
        );
      }
      const result = inspectHostRecord(
        raw,
        [
          ["ok", "value"],
          ["diagnostics", "ok"],
        ],
        "workspace-discovery-failed",
        "Workspace discovery resource result",
      );
      if (!result.ok) {
        return failure(
          diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
        );
      }
      if (result.value.ok === false) {
        const diagnostics = copyHostDiagnostics(
          result.value.diagnostics,
          bootstrapConfigurationBounds.maxProviderDiagnostics,
          "workspace-discovery-failed",
        );
        if (diagnostics.ok && isMissingResource(diagnostics.value)) {
          return success(Object.freeze([]));
        }
        if (diagnostics.ok && isOversizedResource(diagnostics.value)) {
          return incompatible();
        }
        return failure(
          diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
        );
      }
      if (result.value.ok !== true) {
        return failure(
          diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
        );
      }
      const contents = inspectHostRecord(
        result.value.value,
        [["bytes"]],
        "workspace-discovery-failed",
        "Workspace discovery resource contents",
      );
      if (!contents.ok) {
        return failure(
          diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
        );
      }
      const bytes = copyBytes(contents.value.bytes);
      return bytes.ok
        ? success(Object.freeze([Object.freeze({ bytes: bytes.value, locator })]))
        : bytes;
    },
  });
}

export function createYamlConfigurationParser(): ConfigurationParserProvider {
  return Object.freeze({
    parse: (bytes: Uint8Array): Result<BootstrapBaseConfiguration> => {
      const copied = copyBytes(bytes);
      if (!copied.ok) return malformed();
      let value: unknown;
      try {
        const source = intrinsicTextDecoder.decode(copied.value);
        const document = parseDocument(source, {
          schema: "core",
          uniqueKeys: true,
        });
        if (document.errors.length > 0 || document.warnings.length > 0) return malformed();
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
        if (unsupported) return malformed();
        value = document.toJS({ maxAliasCount: 0 });
      } catch {
        return malformed();
      }
      if (typeof value !== "object" || value === null || Array.isArray(value)) return malformed();
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      const schemaAccepted = record.schema === "groma/v0.1";
      if (Object.hasOwn(record, "schema") && typeof record.schema === "string" && !schemaAccepted) {
        return incompatible();
      }
      if (
        keys.length < 1 ||
        keys.length > 4 ||
        !keys.includes("schema") ||
        keys.some(
          (key) =>
            key !== "plugins" &&
            key !== "projects" &&
            key !== "retiredProjectIds" &&
            key !== "schema",
        ) ||
        !schemaAccepted
      ) {
        return malformed();
      }
      const requested: RequestedRuntimePlugin[] = [];
      if (Object.hasOwn(record, "plugins")) {
        if (!Array.isArray(record.plugins)) return malformed();
        if (record.plugins.length > bootstrapConfigurationBounds.maxRequestedRuntimePlugins) {
          return malformed();
        }
        const seen = new Set<string>();
        for (const entry of record.plugins) {
          if (
            typeof entry !== "string" ||
            entry.length > bootstrapConfigurationBounds.maxTokenCharacters ||
            !pluginIdPattern.test(entry) ||
            seen.has(entry)
          ) {
            return malformed();
          }
          seen.add(entry);
          requested.push(
            Object.freeze({
              id: entry,
              namespace: entry.startsWith("official.") ? "official" : "project",
            }),
          );
        }
      }
      requested.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
      const projectRegistrations = Object.hasOwn(record, "projects")
        ? parseConfiguredProjects(record.projects)
        : success(Object.freeze([]));
      if (!projectRegistrations.ok) return projectRegistrations;
      const retired = Object.hasOwn(record, "retiredProjectIds")
        ? inspectHostDenseArray(
            record.retiredProjectIds,
            bootstrapConfigurationBounds.maxRetiredProjectIds,
            "workspace-configuration-parser-failed",
            "Retired project identities",
          )
        : success(Object.freeze([]));
      if (!retired.ok) return malformed();
      const retiredProjectIds: string[] = [];
      const retiredSet = new Set<string>();
      const activeIds = new Set(projectRegistrations.value.map((project) => project.id));
      for (const id of retired.value) {
        if (!isProjectRegistrationId(id) || retiredSet.has(id) || activeIds.has(id)) {
          return malformed();
        }
        retiredSet.add(id);
        retiredProjectIds.push(id);
      }
      retiredProjectIds.sort(compareCodeUnits);
      return success(
        Object.freeze({
          projectRegistrations: projectRegistrations.value,
          requestedRuntimePlugins: Object.freeze(requested),
          retiredProjectIds: Object.freeze(retiredProjectIds),
          schema: "groma/v0.1" as const,
        }),
      );
    },
  });
}

export function parseBootstrapConfiguration(
  parser: ConfigurationParserProvider,
  bytes: Uint8Array,
): Result<BootstrapBaseConfiguration> {
  const copied = copyBytes(bytes);
  if (!copied.ok) {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  let rawParsed: unknown;
  try {
    rawParsed = parser.parse(copied.value);
  } catch {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  const parsed = inspectHostRecord(
    rawParsed,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "workspace-configuration-parser-failed",
    "Workspace configuration parser result",
  );
  if (!parsed.ok) {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  if (parsed.value.ok === false) {
    const diagnostics = copyHostDiagnostics(
      parsed.value.diagnostics,
      bootstrapConfigurationBounds.maxProviderDiagnostics,
      "workspace-configuration-parser-failed",
    );
    return diagnostics.ok && diagnostics.value[0]?.code === "workspace-configuration-conflict"
      ? incompatible()
      : malformed();
  }
  if (parsed.value.ok !== true) {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  const configuration = inspectHostRecord(
    parsed.value.value,
    [
      ["requestedRuntimePlugins", "schema"],
      ["projectRegistrations", "requestedRuntimePlugins", "schema"],
      ["requestedRuntimePlugins", "retiredProjectIds", "schema"],
      ["projectRegistrations", "requestedRuntimePlugins", "retiredProjectIds", "schema"],
    ],
    "workspace-configuration-parser-failed",
    "Bootstrap base configuration",
  );
  if (!configuration.ok || configuration.value.schema !== "groma/v0.1") {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  const requested = inspectHostDenseArray(
    configuration.value.requestedRuntimePlugins,
    bootstrapConfigurationBounds.maxRequestedRuntimePlugins,
    "workspace-configuration-parser-failed",
    "Requested runtime plugins",
  );
  if (!requested.ok) {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  const canonicalRequested: RequestedRuntimePlugin[] = [];
  const seen = new Set<string>();
  for (const item of requested.value) {
    const plugin = inspectHostRecord(
      item,
      [["id", "namespace"]],
      "workspace-configuration-parser-failed",
      "Requested runtime plugin",
    );
    if (
      !plugin.ok ||
      typeof plugin.value.id !== "string" ||
      plugin.value.id.length > bootstrapConfigurationBounds.maxTokenCharacters ||
      !pluginIdPattern.test(plugin.value.id) ||
      (plugin.value.namespace !== "official" && plugin.value.namespace !== "project") ||
      (plugin.value.id.startsWith("official.") ? "official" : "project") !==
        plugin.value.namespace ||
      seen.has(plugin.value.id)
    ) {
      return failure(
        diagnostic(
          "workspace-configuration-parser-failed",
          "Workspace configuration parsing failed",
        ),
      );
    }
    seen.add(plugin.value.id);
    canonicalRequested.push(
      Object.freeze({ id: plugin.value.id, namespace: plugin.value.namespace }),
    );
  }
  canonicalRequested.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const projectRegistrations = Object.hasOwn(configuration.value, "projectRegistrations")
    ? parseConfiguredProjects(configuration.value.projectRegistrations, "parser")
    : success(Object.freeze([]));
  if (!projectRegistrations.ok) {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  const retired = Object.hasOwn(configuration.value, "retiredProjectIds")
    ? inspectHostDenseArray(
        configuration.value.retiredProjectIds,
        bootstrapConfigurationBounds.maxRetiredProjectIds,
        "workspace-configuration-parser-failed",
        "Retired project identities",
      )
    : success(Object.freeze([]));
  if (!retired.ok) {
    return failure(
      diagnostic("workspace-configuration-parser-failed", "Workspace configuration parsing failed"),
    );
  }
  const activeProjectIds = new Set(projectRegistrations.value.map((project) => project.id));
  const retiredProjectIds: string[] = [];
  const retiredSet = new Set<string>();
  for (const id of retired.value) {
    if (!isProjectRegistrationId(id) || activeProjectIds.has(id) || retiredSet.has(id)) {
      return failure(
        diagnostic(
          "workspace-configuration-parser-failed",
          "Workspace configuration parsing failed",
        ),
      );
    }
    retiredSet.add(id);
    retiredProjectIds.push(id);
  }
  retiredProjectIds.sort(compareCodeUnits);
  return success(
    Object.freeze({
      projectRegistrations: projectRegistrations.value,
      requestedRuntimePlugins: Object.freeze(canonicalRequested),
      retiredProjectIds: Object.freeze(retiredProjectIds),
      schema: "groma/v0.1" as const,
    }),
  );
}

export function bootstrapConfigurationStillUsable(
  expected: BootstrapConfigurationLoad,
  actual: BootstrapConfigurationLoad,
): boolean {
  if (
    expected.locator.configuration !== actual.locator.configuration ||
    expected.locator.root !== actual.locator.root
  ) {
    return false;
  }
  if (expected.state === "missing") {
    return (
      actual.state === "missing" ||
      (actual.configuration.requestedRuntimePlugins.length === 0 &&
        (actual.configuration.projectRegistrations?.length ?? 0) === 0 &&
        (actual.configuration.retiredProjectIds?.length ?? 0) === 0)
    );
  }
  if (actual.state === "missing") return false;
  const expectedPlugins = expected.configuration.requestedRuntimePlugins;
  const actualPlugins = actual.configuration.requestedRuntimePlugins;
  const expectedProjects = expected.configuration.projectRegistrations ?? Object.freeze([]);
  const actualProjects = actual.configuration.projectRegistrations ?? Object.freeze([]);
  const expectedRetiredProjectIds = expected.configuration.retiredProjectIds ?? Object.freeze([]);
  const actualRetiredProjectIds = actual.configuration.retiredProjectIds ?? Object.freeze([]);
  return (
    expected.configuration.schema === actual.configuration.schema &&
    expectedPlugins.length === actualPlugins.length &&
    expectedPlugins.every(
      (plugin, index) =>
        plugin.id === actualPlugins[index]?.id &&
        plugin.namespace === actualPlugins[index]?.namespace,
    ) &&
    expectedRetiredProjectIds.length === actualRetiredProjectIds.length &&
    expectedRetiredProjectIds.every((id, index) => id === actualRetiredProjectIds[index]) &&
    expectedProjects.length === actualProjects.length &&
    expectedProjects.every((project, index) => {
      const current = actualProjects[index];
      return (
        current !== undefined &&
        project.id === current.id &&
        project.name === current.name &&
        project.source === current.source &&
        project.coverage.length === current.coverage.length &&
        project.coverage.every(
          (scope, scopeIndex) =>
            scope.id === current.coverage[scopeIndex]?.id &&
            scope.resourceRoot === current.coverage[scopeIndex]?.resourceRoot,
        ) &&
        project.scanners.length === current.scanners.length &&
        project.scanners.every((scanner, scannerIndex) => {
          const currentScanner = current.scanners[scannerIndex];
          if (currentScanner === undefined || scanner.id !== currentScanner.id) return false;
          const expectedConfiguration = parseProjectScannerConfiguration(
            scanner.configuration,
            "parser",
          );
          const actualConfiguration = parseProjectScannerConfiguration(
            currentScanner.configuration,
            "parser",
          );
          return (
            expectedConfiguration.ok &&
            actualConfiguration.ok &&
            expectedConfiguration.value.canonicalJson === actualConfiguration.value.canonicalJson
          );
        })
      );
    })
  );
}

export async function loadBootstrapConfiguration(
  discovery: ConfigurationDiscoveryProvider,
  parser: ConfigurationParserProvider,
  fallbackLocator: WorkspaceLocator = localWorkspaceLocator,
): Promise<Result<BootstrapConfigurationLoad>> {
  let raw: unknown;
  try {
    raw = await discovery.discover();
  } catch {
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
  const result = inspectHostRecord(
    raw,
    [
      ["ok", "value"],
      ["diagnostics", "ok"],
    ],
    "workspace-discovery-failed",
    "Configuration discovery result",
  );
  if (!result.ok || result.value.ok !== true) {
    if (result.ok && result.value.ok === false) {
      const diagnostics = copyHostDiagnostics(
        result.value.diagnostics,
        bootstrapConfigurationBounds.maxProviderDiagnostics,
        "workspace-discovery-failed",
      );
      if (diagnostics.ok && diagnostics.value[0]?.code === "workspace-configuration-conflict") {
        return incompatible();
      }
    }
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
  const candidates = inspectHostDenseArray(
    result.value.value,
    bootstrapConfigurationBounds.maxDiscoveryCandidates,
    "workspace-discovery-failed",
    "Workspace configuration candidates",
  );
  if (!candidates.ok) {
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
  if (candidates.value.length === 0) {
    return success(Object.freeze({ locator: fallbackLocator, state: "missing" as const }));
  }
  if (candidates.value.length > 1) {
    return failure(
      diagnostic(
        "workspace-discovery-conflict",
        "More than one workspace configuration was discovered; remove the ambiguity before startup",
      ),
    );
  }
  const candidate = inspectHostRecord(
    candidates.value[0],
    [["bytes", "locator"]],
    "workspace-discovery-failed",
    "Workspace configuration candidate",
  );
  if (!candidate.ok) {
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
  const bytes = copyBytes(candidate.value.bytes);
  const locator = inspectHostRecord(
    candidate.value.locator,
    [["configuration", "root"]],
    "workspace-discovery-failed",
    "Workspace locator",
  );
  if (!bytes.ok || !locator.ok) {
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
  const configurationLocator = parseWorkspaceResourceLocator(locator.value.configuration);
  const rootLocator = parseWorkspaceResourceLocator(locator.value.root);
  if (!configurationLocator.ok || !rootLocator.ok) {
    return failure(
      diagnostic("workspace-discovery-failed", "Workspace configuration discovery failed"),
    );
  }
  const parsed = parseBootstrapConfiguration(parser, bytes.value);
  if (!parsed.ok) return parsed;
  return success(
    Object.freeze({
      configuration: parsed.value,
      locator: Object.freeze({
        configuration: configurationLocator.value,
        root: rootLocator.value,
      }),
      state: "configured" as const,
    }),
  );
}
