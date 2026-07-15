import {
  failure,
  pluginRuntimeApiVersion,
  success,
  type Diagnostic,
  type PluginManifest,
  type PluginRegistration,
  type Result,
} from "../core/index.ts";

export const pluginSdkApiVersion = "groma.sdk/v1" as const;
export const pluginPackageManifestApiVersion = "groma.package/v1" as const;

export interface SupportedPluginManifest extends Omit<PluginManifest, "apiVersion"> {
  readonly apiVersion: typeof pluginRuntimeApiVersion;
}

export interface SupportedPluginRegistration extends Omit<PluginRegistration, "manifest"> {
  readonly manifest: SupportedPluginManifest;
}

/**
 * The distributable package contract. Loading, trust, acquisition, and pinning are
 * deliberately Host concerns; this manifest only describes the declared entry points
 * and the exact public contracts against which they were authored.
 */
export interface PluginPackageManifest {
  readonly apiVersion: string;
  readonly name: string;
  readonly plugins: readonly string[];
  readonly runtimeApiVersion: string;
  readonly sdkApiVersion: string;
  readonly version: string;
}

export interface SupportedPluginPackageManifest extends PluginPackageManifest {
  readonly apiVersion: typeof pluginPackageManifestApiVersion;
  readonly runtimeApiVersion: typeof pluginRuntimeApiVersion;
  readonly sdkApiVersion: typeof pluginSdkApiVersion;
}

export interface PluginPackageCompatibility {
  readonly packageManifestApiVersion: typeof pluginPackageManifestApiVersion;
  readonly runtimeApiVersion: typeof pluginRuntimeApiVersion;
  readonly sdkApiVersion: typeof pluginSdkApiVersion;
}

export const currentPluginPackageCompatibility: PluginPackageCompatibility = Object.freeze({
  packageManifestApiVersion: pluginPackageManifestApiVersion,
  runtimeApiVersion: pluginRuntimeApiVersion,
  sdkApiVersion: pluginSdkApiVersion,
});

const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;
const exactVersionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const maximumEntryPoints = 64;
const maximumEntryPointCharacters = 512;
const maximumPackageNameCharacters = 214;
const maximumTokenCharacters = 128;

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze(
    details === undefined
      ? { code, message }
      : { code, details: Object.freeze({ ...details }), message },
  );
}

function invalidPackageManifest(reason: string): Result<never> {
  return failure(
    diagnostic(
      "invalid-plugin-package-manifest",
      "Plugin package manifest does not match the bounded public SDK contract",
      { reason },
    ),
  );
}

function exactRecord(value: unknown, fields: readonly string[]): Result<Record<string, unknown>> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return invalidPackageManifest("manifest must be a record");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidPackageManifest("manifest must be a plain record");
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== fields.length ||
      keys.some((key) => typeof key !== "string" || !fields.includes(key))
    ) {
      return invalidPackageManifest("manifest fields must match the versioned contract exactly");
    }
    const copied: Record<string, unknown> = {};
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return invalidPackageManifest("manifest fields must be enumerable data properties");
      }
      copied[field] = descriptor.value;
    }
    return success(copied);
  } catch {
    return invalidPackageManifest("manifest inspection failed");
  }
}

function entryPoints(value: unknown): Result<readonly string[]> {
  let keys: readonly PropertyKey[];
  let length: number;
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return invalidPackageManifest("plugins must be an intrinsic array");
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return invalidPackageManifest("plugins length must be an intrinsic safe data value");
    }
    length = lengthDescriptor.value;
    keys = Reflect.ownKeys(value);
  } catch {
    return invalidPackageManifest("plugins inspection failed");
  }
  if (length === 0 || length > maximumEntryPoints || keys.length !== length + 1) {
    return invalidPackageManifest("plugins must contain between 1 and 64 dense entry points");
  }
  const copied: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      typeof descriptor.value !== "string"
    ) {
      return invalidPackageManifest("plugin entry points must be dense string data properties");
    }
    const entry = descriptor.value;
    const segments = entry.split("/");
    if (
      entry.length === 0 ||
      entry.length > maximumEntryPointCharacters ||
      !entry.startsWith("./") ||
      entry.includes("\\") ||
      entry.includes("\0") ||
      segments.some((segment, segmentIndex) =>
        segmentIndex === 0
          ? segment !== "."
          : segment.length === 0 || segment === "." || segment === "..",
      )
    ) {
      return invalidPackageManifest("plugin entry points must be bounded relative package paths");
    }
    if (seen.has(entry)) {
      return invalidPackageManifest("plugin entry points must be unique");
    }
    seen.add(entry);
    copied.push(entry);
  }
  return success(Object.freeze(copied));
}

/** Compile-time helper that preserves the supported runtime API literal. */
export function definePlugin(
  registration: SupportedPluginRegistration,
): SupportedPluginRegistration {
  return registration;
}

/** Compile-time helper for an already supported package manifest. */
export function definePluginPackage(
  manifest: SupportedPluginPackageManifest,
): SupportedPluginPackageManifest {
  return manifest;
}

/**
 * Canonicalize a package manifest and classify compatibility before any package entry
 * point is loaded or executed.
 */
export function checkPluginPackageCompatibility(
  value: unknown,
): Result<SupportedPluginPackageManifest> {
  const inspected = exactRecord(value, [
    "apiVersion",
    "name",
    "plugins",
    "runtimeApiVersion",
    "sdkApiVersion",
    "version",
  ]);
  if (!inspected.ok) return inspected;
  const manifest = inspected.value;
  if (
    typeof manifest.apiVersion !== "string" ||
    typeof manifest.name !== "string" ||
    typeof manifest.runtimeApiVersion !== "string" ||
    typeof manifest.sdkApiVersion !== "string" ||
    typeof manifest.version !== "string" ||
    manifest.apiVersion.length > maximumTokenCharacters ||
    manifest.runtimeApiVersion.length > maximumTokenCharacters ||
    manifest.sdkApiVersion.length > maximumTokenCharacters
  ) {
    return invalidPackageManifest("manifest identity and compatibility fields must be strings");
  }

  const incompatibilities: Diagnostic[] = [];
  if (manifest.apiVersion !== pluginPackageManifestApiVersion) {
    incompatibilities.push(
      diagnostic(
        "unsupported-plugin-package-manifest-version",
        "Plugin package manifest version is unsupported",
        {
          actualVersion: manifest.apiVersion,
          expectedVersion: pluginPackageManifestApiVersion,
        },
      ),
    );
  }
  if (manifest.sdkApiVersion !== pluginSdkApiVersion) {
    incompatibilities.push(
      diagnostic("incompatible-plugin-sdk-version", "Plugin SDK version is incompatible", {
        actualVersion: manifest.sdkApiVersion,
        expectedVersion: pluginSdkApiVersion,
      }),
    );
  }
  if (manifest.runtimeApiVersion !== pluginRuntimeApiVersion) {
    incompatibilities.push(
      diagnostic(
        "incompatible-plugin-runtime-version",
        "Plugin runtime API version is incompatible",
        {
          actualVersion: manifest.runtimeApiVersion,
          expectedVersion: pluginRuntimeApiVersion,
        },
      ),
    );
  }
  if (incompatibilities.length > 0) return failure(...incompatibilities);

  if (
    manifest.name.length === 0 ||
    manifest.name.length > maximumPackageNameCharacters ||
    !packageNamePattern.test(manifest.name) ||
    !exactVersionPattern.test(manifest.version)
  ) {
    return invalidPackageManifest("package name or exact package version is invalid");
  }
  const plugins = entryPoints(manifest.plugins);
  if (!plugins.ok) return plugins;

  return success(
    Object.freeze({
      apiVersion: pluginPackageManifestApiVersion,
      name: manifest.name,
      plugins: plugins.value,
      runtimeApiVersion: pluginRuntimeApiVersion,
      sdkApiVersion: pluginSdkApiVersion,
      version: manifest.version,
    }),
  );
}
