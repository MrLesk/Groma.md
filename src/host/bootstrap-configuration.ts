import path from "node:path";
import { isProxy as isNativeProxy } from "node:util/types";

import { isAlias, parseDocument, visit } from "yaml";

import { failure, success, type Diagnostic, type Result } from "../core/index.ts";
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
  readonly source: "official" | "project";
}

export interface BootstrapBaseConfiguration {
  readonly requestedRuntimePlugins: readonly RequestedRuntimePlugin[];
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
  maxConfigurationBytes: 4_096,
  maxDiscoveryCandidates: 8,
  maxProviderDiagnostics: 100,
  maxRequestedRuntimePlugins: 64,
  maxTokenCharacters: 128,
});

const config = workspaceResourceLocator("groma", "groma.yaml");
const root = workspaceResourceLocator();
if (!config.ok || !root.ok) throw new Error("Built-in bootstrap locators are invalid");
export const localWorkspaceLocator: WorkspaceLocator = Object.freeze({
  configuration: config.value,
  root: root.value,
});

const pluginIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
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

function copyBytes(value: unknown): Result<Uint8Array> {
  if (typeof value !== "object" || value === null || isHostProxy(value) || isNativeProxy(value)) {
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
        "Workspace configuration discovery requires a supported target and absolute workspace root",
      ),
    );
  }
  const supported =
    (target.platform === "darwin" && target.architecture === "arm64") ||
    (target.platform === "linux" && target.architecture === "x64") ||
    (target.platform === "win32" &&
      (target.architecture === "x64" || target.architecture === "arm64"));
  const paths = target.platform === "win32" ? path.win32 : path.posix;
  if (!supported || !paths.isAbsolute(target.workspaceRoot)) {
    return failure(
      diagnostic(
        "unsupported-bootstrap-target",
        "Workspace configuration discovery requires a supported target and absolute workspace root",
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
      if (
        Object.hasOwn(record, "schema") &&
        typeof record.schema === "string" &&
        record.schema !== "groma/v0.1"
      ) {
        return incompatible();
      }
      if (
        (keys.length !== 1 && keys.length !== 2) ||
        !keys.includes("schema") ||
        (keys.length === 2 && !keys.includes("plugins")) ||
        record.schema !== "groma/v0.1"
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
              source: entry.startsWith("official.") ? "official" : "project",
            }),
          );
        }
      }
      requested.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
      return success(
        Object.freeze({
          requestedRuntimePlugins: Object.freeze(requested),
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
    [["requestedRuntimePlugins", "schema"]],
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
      [["id", "source"]],
      "workspace-configuration-parser-failed",
      "Requested runtime plugin",
    );
    if (
      !plugin.ok ||
      typeof plugin.value.id !== "string" ||
      plugin.value.id.length > bootstrapConfigurationBounds.maxTokenCharacters ||
      !pluginIdPattern.test(plugin.value.id) ||
      (plugin.value.source !== "official" && plugin.value.source !== "project") ||
      (plugin.value.id.startsWith("official.") ? "official" : "project") !== plugin.value.source ||
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
    canonicalRequested.push(Object.freeze({ id: plugin.value.id, source: plugin.value.source }));
  }
  canonicalRequested.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return success(
    Object.freeze({
      requestedRuntimePlugins: Object.freeze(canonicalRequested),
      schema: "groma/v0.1" as const,
    }),
  );
}

export function sameBootstrapConfigurationLoad(
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
    return actual.state === "missing" || actual.configuration.requestedRuntimePlugins.length === 0;
  }
  if (actual.state === "missing") return false;
  const expectedPlugins = expected.configuration.requestedRuntimePlugins;
  const actualPlugins = actual.configuration.requestedRuntimePlugins;
  return (
    expected.configuration.schema === actual.configuration.schema &&
    expectedPlugins.length === actualPlugins.length &&
    expectedPlugins.every(
      (plugin, index) =>
        plugin.id === actualPlugins[index]?.id && plugin.source === actualPlugins[index]?.source,
    )
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
