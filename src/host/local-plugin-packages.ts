import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { constants, realpathSync, type Stats } from "node:fs";
import { chmod, lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";

import { parseDocument } from "yaml";

import {
  failure,
  pluginRuntimeApiVersion,
  success,
  validatePluginRegistration,
  type Diagnostic,
  type PluginRegistration,
  type Result,
} from "../core/index.ts";
import {
  checkPluginPackageCompatibility,
  type SupportedPluginPackageManifest,
} from "../plugin-sdk/index.ts";
import {
  createLocalResourceProvider,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "../persistence/index.ts";
import {
  bootstrapConfigurationBounds,
  createYamlConfigurationParser,
  isBlueprintPackageSource,
  serializeBootstrapConfiguration,
  type BootstrapBaseConfiguration,
  type BootstrapConfigurationLoad,
  type ConfiguredPluginPackage,
} from "./bootstrap-configuration.ts";
import { importLocalPluginModule } from "./plugin-module-loader.ts";
import { isPathWithin } from "./path-containment.ts";

export type PluginPackageScope = "blueprint" | "personal";
export type LocalPluginPackageTrustRootPlatform = "posix" | "win32";

export interface AddPluginPackageRequest {
  readonly scope: PluginPackageScope;
  readonly source: string;
}

export interface InspectPluginPackageRequest {
  readonly name: string;
  readonly scope: PluginPackageScope;
}

export interface SelectPluginPackageEntryRequest extends InspectPluginPackageRequest {
  readonly entry: string;
  readonly trustFullUserPermissions?: boolean;
}

export interface PluginPackageSnapshot {
  readonly available: readonly string[];
  readonly enabled: readonly string[];
  readonly integrity: "entry-drift" | "exact" | "manifest-drift";
  readonly name: string;
  readonly scope: PluginPackageScope;
  readonly source: string;
  readonly version: string;
}

export interface PluginPackageSelectionSnapshot {
  readonly enabled: readonly string[];
  readonly name: string;
  readonly scope: PluginPackageScope;
}

export interface PluginPackageOperations {
  add(request: AddPluginPackageRequest): Promise<Result<PluginPackageSnapshot>>;
  disable(
    request: SelectPluginPackageEntryRequest,
  ): Promise<Result<PluginPackageSelectionSnapshot>>;
  enable(request: SelectPluginPackageEntryRequest): Promise<Result<PluginPackageSnapshot>>;
  inspect(request: InspectPluginPackageRequest): Promise<Result<PluginPackageSnapshot>>;
  remove(request: InspectPluginPackageRequest): Promise<Result<{ readonly removed: string }>>;
}

export interface LoadedLocalPluginPackages {
  readonly personalPluginIds: readonly string[];
  readonly registrations: readonly PluginRegistration[];
}

export interface LocalPluginPackageManager extends PluginPackageOperations {
  loadEnabled(): Promise<Result<LoadedLocalPluginPackages>>;
}

export interface LocalPluginPackageManagerOptions {
  readonly bootstrap: BootstrapConfigurationLoad;
  /** Verification-only observer for deterministic file race tests. */
  readonly fileReadObserver?: (event: LocalPluginPackageFileReadEvent) => Promise<void> | void;
  readonly importModule?: (url: string) => Promise<unknown>;
  readonly resources: LocalResourceProvider;
  /** Host-owned platform seam; production derives this from the running target. */
  readonly trustRootPlatform?: LocalPluginPackageTrustRootPlatform;
  readonly userDataRoot: string;
  readonly workspaceRoot: string;
}

export interface LocalPluginPackageFileReadEvent {
  readonly file: string;
  readonly phase: "opened";
}

interface LockedEntry {
  readonly entry: string;
  readonly integrity: string;
  readonly pluginId: string;
}

interface LockedPackage {
  readonly enabled: readonly LockedEntry[];
  readonly manifestIntegrity: string;
  readonly name: string;
  readonly source: string;
  readonly version: string;
}

interface PackageLock {
  readonly packages: readonly LockedPackage[];
  readonly schema: "groma.packages-lock/v1";
}

interface TrustGrant {
  readonly entry: string;
  readonly entryIntegrity: string;
  readonly manifestIntegrity: string;
  readonly packageLocation: string;
  readonly packageName: string;
  readonly scope: PluginPackageScope;
  readonly workspaceLocation: string;
}

interface UserPackageState {
  readonly packages: readonly LockedPackage[];
  readonly schema: "groma.user-packages/v1";
  readonly trust: readonly TrustGrant[];
}

interface MaterializedPackage {
  readonly location: string;
  readonly manifest: SupportedPluginPackageManifest;
  readonly manifestIntegrity: string;
  readonly source: string;
}

interface MaterializedEntry {
  readonly bytes: Uint8Array;
  readonly entry: string;
  readonly integrity: string;
}

const maximumManifestBytes = 256 * 1024;
const maximumEntryBytes = 4 * 1024 * 1024;
const maximumUserStateBytes = 1024 * 1024;
const lockLocator = requiredLocator("groma", "packages.lock");
const configurationLocator = requiredLocator("groma", "groma.yaml");
const packageCoordinationLocator = requiredLocator("groma", "packages.lock");
const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;
const pluginIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const remoteSourcePattern =
  /^(?:git:|git\+|git@[^:]+:|github:|https?:|npm:|ssh:|[a-z][a-z0-9+.-]*:\/\/)/i;
const integrityPattern = /^sha256:[0-9a-f]{64}$/;
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const textEncoder = new TextEncoder();

function requiredLocator(...segments: string[]): WorkspaceResourceLocator {
  const locator = workspaceResourceLocator(...segments);
  if (!locator.ok) throw new Error("Invalid built-in package resource locator");
  return locator.value;
}

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

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ownedFailure<T>(...diagnostics: readonly Diagnostic[]): Result<T> {
  return failure(...diagnostics.map((item) => diagnostic(item.code, item.message, item.details)));
}

function packageFailure<T>(code: string, message: string): Result<T> {
  return failure(diagnostic(code, message));
}

function hashBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function isMissing(value: Result<unknown>): boolean {
  return (
    !value.ok && value.diagnostics.length === 1 && value.diagnostics[0]?.code === "resource-missing"
  );
}

function isRemoteSource(source: string): boolean {
  return remoteSourcePattern.test(source);
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { readonly code?: unknown }).code)
    : undefined;
}

function exactJsonDocument(bytes: Uint8Array, expectedKeys: readonly string[]): Result<unknown> {
  let source: string;
  let value: unknown;
  try {
    source = textDecoder.decode(bytes);
    value = JSON.parse(source) as unknown;
    const duplicateCheck = parseDocument(source, { schema: "json", uniqueKeys: true });
    if (duplicateCheck.errors.length > 0 || duplicateCheck.warnings.length > 0) {
      return packageFailure(
        "invalid-plugin-package-document",
        "Plugin package JSON is malformed or contains duplicate keys",
      );
    }
  } catch {
    return packageFailure(
      "invalid-plugin-package-document",
      "Plugin package JSON is malformed or contains duplicate keys",
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return packageFailure(
      "invalid-plugin-package-document",
      "Plugin package JSON must be one exact object",
    );
  }
  const keys = Object.keys(value).sort(compareCodeUnits);
  const expected = [...expectedKeys].sort(compareCodeUnits);
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return packageFailure(
      "invalid-plugin-package-document",
      "Plugin package JSON must contain exactly the documented fields",
    );
  }
  return success(value);
}

async function readBoundedRegularFile(
  file: string,
  maximumBytes: number,
  observer?: LocalPluginPackageManagerOptions["fileReadObserver"],
): Promise<Result<Uint8Array>> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
    handle = await open(file, constants.O_RDONLY | noFollow);
    const before = await handle.stat();
    if (!before.isFile() || before.size > maximumBytes) {
      return packageFailure(
        "plugin-package-file-invalid",
        "Plugin package files must be bounded regular files, not links",
      );
    }
    await observer?.(Object.freeze({ file, phase: "opened" }));
    const buffer = Buffer.allocUnsafe(maximumBytes + 1);
    let total = 0;
    while (total < buffer.byteLength) {
      const read = await handle.read(buffer, total, buffer.byteLength - total, total);
      if (read.bytesRead === 0) break;
      total += read.bytesRead;
    }
    const after = await handle.stat();
    const current = await lstat(file);
    if (
      total > maximumBytes ||
      current.isSymbolicLink() ||
      !current.isFile() ||
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(after, current) ||
      before.size !== after.size ||
      after.size !== total ||
      after.size !== current.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      after.mtimeMs !== current.mtimeMs ||
      after.ctimeMs !== current.ctimeMs
    ) {
      return packageFailure(
        "plugin-package-file-invalid",
        "Plugin package files must remain bounded regular files with one stable identity",
      );
    }
    return success(Uint8Array.from(buffer.subarray(0, total)));
  } catch {
    try {
      const current = await lstat(file);
      if (current.isSymbolicLink() || !current.isFile()) {
        return packageFailure(
          "plugin-package-file-invalid",
          "Plugin package files must be bounded regular files, not links",
        );
      }
    } catch {
      // Preserve the bounded unavailable diagnostic below.
    }
    return packageFailure(
      "plugin-package-file-unavailable",
      "A required local plugin package file is unavailable",
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function sameFileIdentity(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

async function canonicalPackageLocation(
  workspaceRoot: string,
  source: string,
  scope: PluginPackageScope,
): Promise<Result<{ readonly location: string; readonly source: string }>> {
  if (isRemoteSource(source)) {
    return packageFailure(
      "remote-plugin-package-acquisition-out-of-scope",
      "Remote npm, Git, and URL plugin package acquisition is not supported in this delivery",
    );
  }
  if (
    source.length === 0 ||
    source.length > bootstrapConfigurationBounds.maxPackageSourceCharacters ||
    source.includes("\0")
  ) {
    return packageFailure(
      "invalid-local-plugin-package-source",
      "Local plugin package source is malformed",
    );
  }
  if (scope === "blueprint" && !isBlueprintPackageSource(source)) {
    return packageFailure(
      "invalid-blueprint-plugin-package-source",
      "Blueprint plugin package sources must be portable workspace-relative paths",
    );
  }
  const requested = path.isAbsolute(source)
    ? path.normalize(source)
    : path.resolve(workspaceRoot, source);
  if (scope === "blueprint" && !isPathWithin(workspaceRoot, requested)) {
    return packageFailure(
      "invalid-blueprint-plugin-package-source",
      "Blueprint plugin package sources must remain inside the observed workspace",
    );
  }
  try {
    const location = await realpath(requested);
    const stats = await lstat(location);
    if (!stats.isDirectory() || (scope === "blueprint" && !isPathWithin(workspaceRoot, location))) {
      return packageFailure(
        "invalid-local-plugin-package-source",
        "Local plugin package source must identify one directory",
      );
    }
    return success(Object.freeze({ location, source: scope === "personal" ? location : source }));
  } catch {
    return packageFailure(
      "plugin-package-source-unavailable",
      "Local plugin package source is unavailable",
    );
  }
}

async function materializePackage(
  workspaceRoot: string,
  source: string,
  scope: PluginPackageScope,
  observer?: LocalPluginPackageManagerOptions["fileReadObserver"],
): Promise<Result<MaterializedPackage>> {
  const located = await canonicalPackageLocation(workspaceRoot, source, scope);
  if (!located.ok) return located;
  const manifestFile = path.join(located.value.location, "groma.package.json");
  const bytes = await readBoundedRegularFile(manifestFile, maximumManifestBytes, observer);
  if (!bytes.ok) return bytes;
  const parsed = exactJsonDocument(bytes.value, [
    "apiVersion",
    "name",
    "plugins",
    "runtimeApiVersion",
    "sdkApiVersion",
    "version",
  ]);
  if (!parsed.ok) return parsed;
  const compatible = checkPluginPackageCompatibility(parsed.value);
  if (!compatible.ok) return ownedFailure(...compatible.diagnostics);
  return success(
    Object.freeze({
      location: located.value.location,
      manifest: compatible.value,
      manifestIntegrity: hashBytes(bytes.value),
      source: located.value.source,
    }),
  );
}

async function materializeEntry(
  materialized: MaterializedPackage,
  entry: string,
  observer?: LocalPluginPackageManagerOptions["fileReadObserver"],
): Promise<Result<MaterializedEntry>> {
  if (!materialized.manifest.plugins.includes(entry)) {
    return packageFailure(
      "plugin-package-entry-undeclared",
      "The selected plugin entry is absent from the exact package manifest",
    );
  }
  const requested = path.resolve(materialized.location, ...entry.slice(2).split("/"));
  if (!isPathWithin(materialized.location, requested)) {
    return packageFailure(
      "plugin-package-entry-invalid",
      "Plugin entry resolution escaped its package directory",
    );
  }
  try {
    const canonical = await realpath(requested);
    if (!isPathWithin(materialized.location, canonical)) {
      return packageFailure(
        "plugin-package-entry-invalid",
        "Plugin entry resolution escaped its package directory",
      );
    }
    let current = materialized.location;
    for (const segment of entry.slice(2).split("/")) {
      current = path.join(current, segment);
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) {
        return packageFailure(
          "plugin-package-entry-invalid",
          "Plugin entry paths must not contain symbolic links",
        );
      }
    }
    const bytes = await readBoundedRegularFile(canonical, maximumEntryBytes, observer);
    if (!bytes.ok) return bytes;
    return success(Object.freeze({ bytes: bytes.value, entry, integrity: hashBytes(bytes.value) }));
  } catch {
    return packageFailure(
      "plugin-package-entry-unavailable",
      "The selected local plugin entry is unavailable",
    );
  }
}

function parseLockedEntry(value: unknown): LockedEntry | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort(compareCodeUnits).join("\0") !== "entry\0integrity\0pluginId" ||
    typeof record.entry !== "string" ||
    typeof record.integrity !== "string" ||
    typeof record.pluginId !== "string" ||
    record.entry.length > bootstrapConfigurationBounds.maxPackageEntryCharacters ||
    !integrityPattern.test(record.integrity) ||
    !pluginIdPattern.test(record.pluginId) ||
    record.pluginId.length > 128
  ) {
    return undefined;
  }
  return Object.freeze({
    entry: record.entry,
    integrity: record.integrity,
    pluginId: record.pluginId,
  });
}

function parseLockedPackage(value: unknown): LockedPackage | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort(compareCodeUnits).join("\0") !==
      "enabled\0manifestIntegrity\0name\0source\0version" ||
    typeof record.manifestIntegrity !== "string" ||
    typeof record.name !== "string" ||
    typeof record.source !== "string" ||
    typeof record.version !== "string" ||
    record.source.length > bootstrapConfigurationBounds.maxPackageSourceCharacters ||
    record.version.length > 128 ||
    !integrityPattern.test(record.manifestIntegrity) ||
    !packageNamePattern.test(record.name) ||
    !Array.isArray(record.enabled) ||
    record.enabled.length > 64
  ) {
    return undefined;
  }
  const enabled = record.enabled.map(parseLockedEntry);
  if (enabled.some((entry) => entry === undefined)) return undefined;
  const entries = enabled as LockedEntry[];
  entries.sort((left, right) => compareCodeUnits(left.entry, right.entry));
  if (entries.some((entry, index) => entry.entry === entries[index - 1]?.entry)) return undefined;
  return Object.freeze({
    enabled: Object.freeze(entries),
    manifestIntegrity: record.manifestIntegrity,
    name: record.name,
    source: record.source,
    version: record.version,
  });
}

function parsePackages(value: unknown): readonly LockedPackage[] | undefined {
  if (!Array.isArray(value) || value.length > 64) return undefined;
  const packages = value.map(parseLockedPackage);
  if (packages.some((entry) => entry === undefined)) return undefined;
  const canonical = packages as LockedPackage[];
  canonical.sort((left, right) => compareCodeUnits(left.name, right.name));
  if (canonical.some((entry, index) => entry.name === canonical[index - 1]?.name)) return undefined;
  return Object.freeze(canonical);
}

function parseTrust(value: unknown): readonly TrustGrant[] | undefined {
  if (!Array.isArray(value) || value.length > 4_096) return undefined;
  const grants: TrustGrant[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return undefined;
    const record = item as Record<string, unknown>;
    if (
      Object.keys(record).sort(compareCodeUnits).join("\0") !==
        "entry\0entryIntegrity\0manifestIntegrity\0packageLocation\0packageName\0scope\0workspaceLocation" ||
      typeof record.entry !== "string" ||
      typeof record.entryIntegrity !== "string" ||
      typeof record.manifestIntegrity !== "string" ||
      typeof record.packageLocation !== "string" ||
      typeof record.packageName !== "string" ||
      (record.scope !== "blueprint" && record.scope !== "personal") ||
      typeof record.workspaceLocation !== "string" ||
      record.entry.length > bootstrapConfigurationBounds.maxPackageEntryCharacters ||
      record.packageLocation.length > bootstrapConfigurationBounds.maxPackageSourceCharacters ||
      record.workspaceLocation.length > bootstrapConfigurationBounds.maxPackageSourceCharacters ||
      !integrityPattern.test(record.entryIntegrity) ||
      !integrityPattern.test(record.manifestIntegrity) ||
      !packageNamePattern.test(record.packageName)
    ) {
      return undefined;
    }
    grants.push(
      Object.freeze({
        entry: record.entry,
        entryIntegrity: record.entryIntegrity,
        manifestIntegrity: record.manifestIntegrity,
        packageLocation: record.packageLocation,
        packageName: record.packageName,
        scope: record.scope,
        workspaceLocation: record.workspaceLocation,
      }),
    );
  }
  grants.sort((left, right) => compareCodeUnits(trustKey(left), trustKey(right)));
  if (
    grants.some((grant, index) => index > 0 && trustKey(grant) === trustKey(grants[index - 1]!))
  ) {
    return undefined;
  }
  return Object.freeze(grants);
}

function trustKey(grant: TrustGrant): string {
  return `${grant.scope}\0${grant.workspaceLocation}\0${grant.packageName}\0${grant.packageLocation}\0${grant.entry}\0${grant.manifestIntegrity}\0${grant.entryIntegrity}`;
}

function emptyLock(): PackageLock {
  return Object.freeze({ packages: Object.freeze([]), schema: "groma.packages-lock/v1" });
}

function emptyUserState(): UserPackageState {
  return Object.freeze({
    packages: Object.freeze([]),
    schema: "groma.user-packages/v1",
    trust: Object.freeze([]),
  });
}

function parseLock(bytes: Uint8Array): Result<PackageLock> {
  const parsed = exactJsonDocument(bytes, ["packages", "schema"]);
  if (!parsed.ok)
    return packageFailure(
      "plugin-package-lock-malformed",
      "The exact plugin package lock is malformed",
    );
  const record = parsed.value as Record<string, unknown>;
  const packages = parsePackages(record.packages);
  return record.schema === "groma.packages-lock/v1" && packages !== undefined
    ? success(Object.freeze({ packages, schema: "groma.packages-lock/v1" as const }))
    : packageFailure("plugin-package-lock-malformed", "The exact plugin package lock is malformed");
}

function parseUserState(bytes: Uint8Array): Result<UserPackageState> {
  const parsed = exactJsonDocument(bytes, ["packages", "schema", "trust"]);
  if (!parsed.ok)
    return packageFailure(
      "plugin-package-user-state-malformed",
      "Local plugin package state is malformed",
    );
  const record = parsed.value as Record<string, unknown>;
  const packages = parsePackages(record.packages);
  const trust = parseTrust(record.trust);
  return record.schema === "groma.user-packages/v1" && packages !== undefined && trust !== undefined
    ? success(Object.freeze({ packages, schema: "groma.user-packages/v1" as const, trust }))
    : packageFailure(
        "plugin-package-user-state-malformed",
        "Local plugin package state is malformed",
      );
}

function encodeCanonical(value: PackageLock | UserPackageState): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(value, null, 2)}\n`);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function preflightUserState(state: UserPackageState): Result<Uint8Array> {
  const bytes = encodeCanonical(state);
  if (bytes.byteLength > maximumUserStateBytes) {
    return packageFailure(
      "plugin-package-state-limit-exceeded",
      "Local plugin package state exceeds its configured byte bound",
    );
  }
  const parsed = parseUserState(bytes);
  if (!parsed.ok || !sameBytes(bytes, encodeCanonical(parsed.value))) {
    return packageFailure(
      "plugin-package-state-invalid",
      "Local plugin package state does not match its canonical bounded reader",
    );
  }
  return success(bytes);
}

function preflightLock(lock: PackageLock): Result<Uint8Array> {
  const bytes = encodeCanonical(lock);
  if (bytes.byteLength > maximumUserStateBytes) {
    return packageFailure(
      "plugin-package-state-limit-exceeded",
      "Blueprint plugin package state exceeds its configured byte bound",
    );
  }
  const parsed = parseLock(bytes);
  if (!parsed.ok || !sameBytes(bytes, encodeCanonical(parsed.value))) {
    return packageFailure(
      "plugin-package-state-invalid",
      "Blueprint plugin package lock does not match its canonical bounded reader",
    );
  }
  return success(bytes);
}

function preflightConfiguration(configuration: BootstrapBaseConfiguration): Result<Uint8Array> {
  const source = serializeBootstrapConfiguration(configuration);
  const bytes = textEncoder.encode(source);
  if (bytes.byteLength > bootstrapConfigurationBounds.maxConfigurationBytes) {
    return packageFailure(
      "plugin-package-state-limit-exceeded",
      "Blueprint plugin package state exceeds its configured byte bound",
    );
  }
  const parsed = createYamlConfigurationParser().parse(bytes);
  if (!parsed.ok || serializeBootstrapConfiguration(parsed.value) !== source) {
    return packageFailure(
      "plugin-package-state-invalid",
      "Blueprint plugin package configuration does not match its canonical bounded reader",
    );
  }
  return success(bytes);
}

async function readResource(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  maximum: number,
): Promise<Result<Uint8Array | undefined>> {
  const read = await resources.read({ locator, maxBytes: maximum });
  if (!read.ok) return isMissing(read) ? success(undefined) : ownedFailure(...read.diagnostics);
  return success(read.value.bytes);
}

async function replaceResource(
  resources: LocalResourceProvider,
  locator: WorkspaceResourceLocator,
  bytes: Uint8Array,
): Promise<Result<void>> {
  const staged = await resources.stageReplacement(locator, bytes);
  if (!staged.ok) return ownedFailure(...staged.diagnostics);
  const committed = await resources.commitReplacement(staged.value);
  if (committed.state === "committed") return success(undefined);
  return packageFailure(
    committed.state === "committed-indeterminate"
      ? "plugin-package-state-indeterminate"
      : "plugin-package-state-not-committed",
    committed.state === "committed-indeterminate"
      ? "Plugin package state may have committed; inspect it before retrying"
      : "Plugin package state was not committed",
  );
}

function lockFor(
  declaration: ConfiguredPluginPackage,
  materialized: MaterializedPackage,
): LockedPackage {
  return Object.freeze({
    enabled: Object.freeze([]),
    manifestIntegrity: materialized.manifestIntegrity,
    name: declaration.name,
    source: declaration.source,
    version: materialized.manifest.version,
  });
}

function snapshot(
  scope: PluginPackageScope,
  locked: LockedPackage,
  manifest: SupportedPluginPackageManifest,
  manifestIntegrity: string,
  entryIntegrity: "entry-drift" | "exact" = "exact",
): PluginPackageSnapshot {
  return Object.freeze({
    available: Object.freeze([...manifest.plugins]),
    enabled: Object.freeze(locked.enabled.map((entry) => entry.entry)),
    integrity: locked.manifestIntegrity === manifestIntegrity ? entryIntegrity : "manifest-drift",
    name: locked.name,
    scope,
    source: locked.source,
    version: locked.version,
  });
}

function selectionSnapshot(
  scope: PluginPackageScope,
  locked: LockedPackage,
): PluginPackageSelectionSnapshot {
  return Object.freeze({
    enabled: Object.freeze(locked.enabled.map((entry) => entry.entry)),
    name: locked.name,
    scope,
  });
}

async function importVerifiedEntry(
  entry: MaterializedEntry,
  importer: (url: string) => Promise<unknown>,
): Promise<unknown> {
  const moduleUrl = URL.createObjectURL(new Blob([entry.bytes], { type: "text/javascript" }));
  try {
    return await importer(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

function grantMatches(
  grant: TrustGrant,
  scope: PluginPackageScope,
  workspaceLocation: string,
  materialized: MaterializedPackage,
  entry: MaterializedEntry,
): boolean {
  return (
    grant.scope === scope &&
    grant.workspaceLocation === workspaceLocation &&
    grant.packageLocation === materialized.location &&
    grant.packageName === materialized.manifest.name &&
    grant.manifestIntegrity === materialized.manifestIntegrity &&
    grant.entry === entry.entry &&
    grant.entryIntegrity === entry.integrity
  );
}

function trustGrant(
  scope: PluginPackageScope,
  workspaceLocation: string,
  materialized: MaterializedPackage,
  entry: MaterializedEntry,
): TrustGrant {
  return Object.freeze({
    entry: entry.entry,
    entryIntegrity: entry.integrity,
    manifestIntegrity: materialized.manifestIntegrity,
    packageLocation: materialized.location,
    packageName: materialized.manifest.name,
    scope,
    workspaceLocation,
  });
}

function presentationOnly(value: PluginRegistration): boolean {
  return [...value.manifest.provides, ...value.manifest.requires].every((declaration) =>
    declaration.id.startsWith("groma.presentation."),
  );
}

function exportedPlugin(
  module: unknown,
  scope: PluginPackageScope,
): Result<{ readonly id: string; readonly registration: PluginRegistration }> {
  try {
    if (typeof module !== "object" || module === null) throw new Error();
    const descriptor = Object.getOwnPropertyDescriptor(module, "plugin");
    if (descriptor === undefined || !("value" in descriptor)) throw new Error();
    const registration = validatePluginRegistration(descriptor.value);
    if (
      !registration.ok ||
      registration.value.manifest.apiVersion !== pluginRuntimeApiVersion ||
      registration.value.manifest.phase !== 1
    )
      throw new Error();
    if (scope === "personal" && !presentationOnly(registration.value)) {
      return packageFailure(
        "personal-plugin-capability-forbidden",
        "Personal plugins may provide or require only groma.presentation.* capabilities",
      );
    }
    return success(
      Object.freeze({
        id: registration.value.manifest.id,
        registration: registration.value,
      }),
    );
  } catch {
    return packageFailure(
      "plugin-package-entry-invalid",
      "Plugin entry must export one bounded Phase 1 plugin registration as plugin",
    );
  }
}

async function secureUserDataRoot(
  root: string,
  platform: LocalPluginPackageTrustRootPlatform,
): Promise<string> {
  if (platform === "win32") {
    throw new TypeError("Windows plugin trust roots require owner and ACL attestation");
  }
  try {
    await lstat(root);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
    await mkdir(root, { mode: 0o700, recursive: true });
    await chmod(root, 0o700);
  }
  const before = await lstat(root);
  if (before.isSymbolicLink() || !before.isDirectory()) {
    throw new TypeError("Plugin package user data must be one real directory");
  }
  const currentUser = process.getuid?.();
  if (
    (currentUser !== undefined && before.uid !== currentUser) ||
    (before.mode & 0o777) !== 0o700
  ) {
    throw new TypeError(
      "Plugin package user data must be owner-controlled and inaccessible to group or other users",
    );
  }
  const canonical = await realpath(root);
  const after = await lstat(root);
  if (after.isSymbolicLink() || !after.isDirectory() || !sameFileIdentity(before, after)) {
    throw new TypeError("Plugin package user data changed during validation");
  }
  return canonical;
}

export function createLocalPluginPackageManager(
  options: LocalPluginPackageManagerOptions,
): LocalPluginPackageManager {
  if (!path.isAbsolute(options.workspaceRoot) || !path.isAbsolute(options.userDataRoot)) {
    throw new TypeError("Plugin package roots must be absolute host paths");
  }
  const workspaceRoot = realpathSync(path.normalize(options.workspaceRoot));
  const requestedUserDataRoot = path.normalize(options.userDataRoot);
  if (isPathWithin(workspaceRoot, requestedUserDataRoot)) {
    throw new TypeError("Plugin package user data must live outside the observed workspace");
  }
  const initialConfiguration =
    options.bootstrap.state === "configured"
      ? options.bootstrap.configuration
      : Object.freeze({
          packageDeclarations: Object.freeze([]),
          requestedRuntimePlugins: Object.freeze([]),
          schema: "groma/v0.1" as const,
        });
  let configuration = initialConfiguration;
  let operationTail = Promise.resolve();
  let userProviderPromise: Promise<LocalResourceProvider> | undefined;
  let userProviderRoot: string | undefined;
  const workspaceIdentity = createHash("sha256").update(workspaceRoot).digest("hex");
  const userStateLocator = requiredLocator("workspaces", `${workspaceIdentity}.json`);
  const importModule = options.importModule ?? importLocalPluginModule;
  const fileReadObserver = options.fileReadObserver;
  const trustRootPlatform =
    options.trustRootPlatform ?? (process.platform === "win32" ? "win32" : "posix");

  function unattestedWindowsTrustRoot<T>(): Result<T> {
    return packageFailure(
      "plugin-package-trust-root-unattested",
      "Local plugin trust is unavailable because this Windows Host cannot attest exclusive control of its user-data root",
    );
  }

  const userResources = async (): Promise<LocalResourceProvider> => {
    const canonical = await secureUserDataRoot(requestedUserDataRoot, trustRootPlatform);
    if (isPathWithin(workspaceRoot, canonical)) {
      throw new TypeError("Plugin package user data must live outside the observed workspace");
    }
    if (userProviderPromise === undefined) {
      userProviderRoot = canonical;
      userProviderPromise = createLocalResourceProvider({ workspaceRoot: canonical });
    } else if (canonical !== userProviderRoot) {
      throw new TypeError("Plugin package user data identity changed");
    }
    return await userProviderPromise;
  };

  const readLock = async (): Promise<Result<PackageLock>> => {
    const read = await readResource(options.resources, lockLocator, maximumUserStateBytes);
    if (!read.ok) return read;
    return read.value === undefined ? success(emptyLock()) : parseLock(read.value);
  };

  const readUserState = async (): Promise<Result<UserPackageState>> => {
    if (trustRootPlatform === "win32") return unattestedWindowsTrustRoot();
    try {
      await lstat(requestedUserDataRoot);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return success(emptyUserState());
      return packageFailure(
        "plugin-package-user-state-unavailable",
        "Local plugin package state is unavailable",
      );
    }
    let resources: LocalResourceProvider;
    try {
      resources = await userResources();
    } catch {
      return packageFailure(
        "plugin-package-user-state-unavailable",
        "Local plugin package state is unavailable",
      );
    }
    const read = await readResource(resources, userStateLocator, maximumUserStateBytes);
    if (!read.ok) return read;
    return read.value === undefined ? success(emptyUserState()) : parseUserState(read.value);
  };

  const writeUserState = async (
    state: UserPackageState,
    expected: UserPackageState,
  ): Promise<Result<void>> => {
    if (trustRootPlatform === "win32") return unattestedWindowsTrustRoot();
    const preflight = preflightUserState(state);
    if (!preflight.ok) return preflight;
    const stateBytes = preflight.value;
    let resources: LocalResourceProvider;
    try {
      resources = await userResources();
    } catch {
      return packageFailure(
        "plugin-package-user-state-unavailable",
        "Local plugin package state is unavailable",
      );
    }
    const coordinated = await resources.withCoordination<Result<void>>(
      { context: "local-machine", locator: userStateLocator },
      async () => {
        const currentBytes = await readResource(resources, userStateLocator, maximumUserStateBytes);
        if (!currentBytes.ok) return ownedFailure<void>(...currentBytes.diagnostics);
        const current =
          currentBytes.value === undefined
            ? success(emptyUserState())
            : parseUserState(currentBytes.value);
        if (!current.ok) return ownedFailure<void>(...current.diagnostics);
        if (hashBytes(encodeCanonical(current.value)) !== hashBytes(encodeCanonical(expected))) {
          return packageFailure(
            "plugin-package-user-state-changed",
            "Local plugin package state changed; retry after changes settle",
          );
        }
        return replaceResource(resources, userStateLocator, stateBytes);
      },
    );
    if (!coordinated.ok) return ownedFailure(...coordinated.diagnostics);
    return coordinated.value;
  };

  const readConfiguration = async (): Promise<Result<typeof configuration>> => {
    const read = await readResource(
      options.resources,
      configurationLocator,
      bootstrapConfigurationBounds.maxConfigurationBytes,
    );
    if (!read.ok) return read;
    if (read.value === undefined) {
      return packageFailure(
        "no-workspace",
        "Initialize a Groma workspace before managing blueprint packages",
      );
    }
    const parsed = createYamlConfigurationParser().parse(read.value);
    return parsed.ok ? success(parsed.value) : ownedFailure(...parsed.diagnostics);
  };

  const writeBlueprintState = async (
    nextConfiguration: typeof configuration,
    nextLock: PackageLock,
    expectedLock: PackageLock,
  ): Promise<Result<void>> => {
    const configurationPreflight = preflightConfiguration(nextConfiguration);
    if (!configurationPreflight.ok) return configurationPreflight;
    const lockPreflight = preflightLock(nextLock);
    if (!lockPreflight.ok) return lockPreflight;
    const expectedLockPreflight = preflightLock(expectedLock);
    if (!expectedLockPreflight.ok) return expectedLockPreflight;
    const configurationBytes = configurationPreflight.value;
    const lockBytes = lockPreflight.value;
    const coordinated = await options.resources.withCoordination(
      { context: "local-machine", locator: packageCoordinationLocator },
      async () => {
        const current = await readConfiguration();
        if (!current.ok) return current;
        if (
          serializeBootstrapConfiguration(current.value) !==
          serializeBootstrapConfiguration(configuration)
        ) {
          return packageFailure(
            "workspace-configuration-changed",
            "Workspace package configuration changed; retry after changes settle",
          );
        }
        const currentLock = await readLock();
        if (!currentLock.ok) return currentLock;
        if (!sameBytes(encodeCanonical(currentLock.value), expectedLockPreflight.value)) {
          return packageFailure(
            "plugin-package-lock-changed",
            "Blueprint plugin package lock changed; retry after changes settle",
          );
        }
        const locked = await replaceResource(options.resources, lockLocator, lockBytes);
        if (!locked.ok) return locked;
        return replaceResource(options.resources, configurationLocator, configurationBytes);
      },
    );
    if (!coordinated.ok) return ownedFailure(...coordinated.diagnostics);
    if (!coordinated.value.ok) return coordinated.value;
    configuration = nextConfiguration;
    return success(undefined);
  };

  function serialize<T>(action: () => Promise<Result<T>>): Promise<Result<T>> {
    const next = operationTail
      .then(action, action)
      .catch(() =>
        packageFailure<T>(
          "plugin-package-operation-failed",
          "The local plugin package operation failed",
        ),
      );
    operationTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  const materializedFor = async (
    locked: LockedPackage,
    scope: PluginPackageScope,
  ): Promise<Result<MaterializedPackage>> => {
    const materialized = await materializePackage(
      workspaceRoot,
      locked.source,
      scope,
      fileReadObserver,
    );
    if (!materialized.ok) return materialized;
    if (
      materialized.value.manifest.name !== locked.name ||
      materialized.value.manifest.version !== locked.version
    ) {
      return packageFailure(
        "plugin-package-lock-mismatch",
        "The local package identity does not match its exact lock entry",
      );
    }
    return materialized;
  };

  const locate = async (
    request: InspectPluginPackageRequest,
  ): Promise<
    Result<{
      readonly locked: LockedPackage;
      readonly lock?: PackageLock;
      readonly state?: UserPackageState;
    }>
  > => {
    if (!packageNamePattern.test(request.name)) {
      return packageFailure("invalid-plugin-package-name", "Plugin package name is malformed");
    }
    if (request.scope === "blueprint") {
      const lock = await readLock();
      if (!lock.ok) return lock;
      const declaration = configuration.packageDeclarations.find(
        (item) => item.name === request.name,
      );
      const locked = lock.value.packages.find((item) => item.name === request.name);
      if (locked === undefined || declaration === undefined) {
        return packageFailure(
          "plugin-package-not-found",
          "The requested blueprint plugin package is not fully declared",
        );
      }
      return locked.source !== declaration.source
        ? packageFailure(
            "plugin-package-lock-mismatch",
            "Blueprint package configuration does not match its exact lock entry",
          )
        : success(Object.freeze({ lock: lock.value, locked }));
    }
    if (request.scope !== "personal") {
      return packageFailure(
        "invalid-plugin-package-scope",
        "Plugin package scope must be blueprint or personal",
      );
    }
    const state = await readUserState();
    if (!state.ok) return state;
    const locked = state.value.packages.find((item) => item.name === request.name);
    return locked === undefined
      ? packageFailure(
          "plugin-package-not-found",
          "The requested personal plugin package is not installed",
        )
      : success(Object.freeze({ locked, state: state.value }));
  };

  const inspect = (request: InspectPluginPackageRequest): Promise<Result<PluginPackageSnapshot>> =>
    serialize(async () => {
      const located = await locate(request);
      if (!located.ok) return located;
      const materialized = await materializedFor(located.value.locked, request.scope);
      if (!materialized.ok) return materialized;
      if (request.scope === "blueprint") {
        const declaration = configuration.packageDeclarations.find(
          (item) => item.name === request.name,
        )!;
        if (
          declaration.enabled.length !== located.value.locked.enabled.length ||
          declaration.enabled.some(
            (entry, index) => entry !== located.value.locked.enabled[index]?.entry,
          )
        ) {
          return packageFailure(
            "plugin-package-lock-mismatch",
            "Blueprint package enablement does not match its exact lock entry",
          );
        }
      }
      let entryIntegrity: "entry-drift" | "exact" = "exact";
      for (const lockedEntry of located.value.locked.enabled) {
        const entry = await materializeEntry(
          materialized.value,
          lockedEntry.entry,
          fileReadObserver,
        );
        if (!entry.ok) return entry;
        if (entry.value.integrity !== lockedEntry.integrity) entryIntegrity = "entry-drift";
      }
      return success(
        snapshot(
          request.scope,
          located.value.locked,
          materialized.value.manifest,
          materialized.value.manifestIntegrity,
          entryIntegrity,
        ),
      );
    });

  const add = (request: AddPluginPackageRequest): Promise<Result<PluginPackageSnapshot>> =>
    serialize(async () => {
      if (request.scope !== "blueprint" && request.scope !== "personal") {
        return packageFailure(
          "invalid-plugin-package-scope",
          "Plugin package scope must be blueprint or personal",
        );
      }
      if (typeof request.source !== "string") {
        return packageFailure(
          "invalid-local-plugin-package-source",
          "Local plugin package source is malformed",
        );
      }
      const materialized = await materializePackage(
        workspaceRoot,
        request.source,
        request.scope,
        fileReadObserver,
      );
      if (!materialized.ok) return materialized;
      const declaration = Object.freeze({
        enabled: Object.freeze([]),
        name: materialized.value.manifest.name,
        source: materialized.value.source,
      });
      const locked = lockFor(declaration, materialized.value);
      if (request.scope === "personal") {
        const state = await readUserState();
        if (!state.ok) return state;
        if (state.value.packages.some((item) => item.name === declaration.name)) {
          return packageFailure(
            "plugin-package-already-present",
            "The personal plugin package is already installed",
          );
        }
        const packages = Object.freeze(
          [...state.value.packages, locked].sort((left, right) =>
            compareCodeUnits(left.name, right.name),
          ),
        );
        const written = await writeUserState(
          Object.freeze({ packages, schema: state.value.schema, trust: state.value.trust }),
          state.value,
        );
        if (!written.ok) return written;
      } else {
        if (options.bootstrap.state !== "configured") {
          return packageFailure(
            "no-workspace",
            "Initialize a Groma workspace before managing blueprint packages",
          );
        }
        const lock = await readLock();
        if (!lock.ok) return lock;
        if (configuration.packageDeclarations.some((item) => item.name === declaration.name)) {
          return packageFailure(
            "plugin-package-already-present",
            "The blueprint plugin package is already declared",
          );
        }
        const packageDeclarations = Object.freeze(
          [...configuration.packageDeclarations, declaration].sort((left, right) =>
            compareCodeUnits(left.name, right.name),
          ),
        );
        const packages = Object.freeze(
          [...lock.value.packages.filter((item) => item.name !== locked.name), locked].sort(
            (left, right) => compareCodeUnits(left.name, right.name),
          ),
        );
        const written = await writeBlueprintState(
          Object.freeze({ ...configuration, packageDeclarations }),
          Object.freeze({ packages, schema: lock.value.schema }),
          lock.value,
        );
        if (!written.ok) return written;
      }
      return success(
        snapshot(
          request.scope,
          locked,
          materialized.value.manifest,
          materialized.value.manifestIntegrity,
        ),
      );
    });

  const enable = (
    request: SelectPluginPackageEntryRequest,
  ): Promise<Result<PluginPackageSnapshot>> =>
    serialize(async () => {
      const located = await locate(request);
      if (!located.ok) return located;
      const materialized = await materializedFor(located.value.locked, request.scope);
      if (!materialized.ok) return materialized;
      if (materialized.value.manifestIntegrity !== located.value.locked.manifestIntegrity) {
        return packageFailure(
          "plugin-package-integrity-drift",
          "The local package manifest changed after its exact lock was written",
        );
      }
      const entry = await materializeEntry(materialized.value, request.entry, fileReadObserver);
      if (!entry.ok) return entry;
      const state =
        located.value.state === undefined ? await readUserState() : success(located.value.state);
      if (!state.ok) return state;
      const trusted = state.value.trust.some((grant) =>
        grantMatches(grant, request.scope, workspaceRoot, materialized.value, entry.value),
      );
      if (!trusted && request.trustFullUserPermissions !== true) {
        return packageFailure(
          "plugin-full-user-permissions-trust-required",
          "Plugins run with your full user permissions. Groma verifies what was installed, not that it is safe. Re-run with --trust-full-user-permissions to execute this exact entry",
        );
      }
      let loaded: unknown;
      try {
        loaded = await importVerifiedEntry(entry.value, importModule);
      } catch {
        return packageFailure(
          "plugin-package-entry-load-failed",
          "The trusted local plugin entry could not be loaded",
        );
      }
      const exported = exportedPlugin(loaded, request.scope);
      if (!exported.ok) return exported;
      const existing = located.value.locked.enabled.find((item) => item.entry === request.entry);
      if (existing !== undefined && existing.pluginId !== exported.value.id) {
        return packageFailure(
          "plugin-package-lock-mismatch",
          "The plugin ID changed from its exact lock entry",
        );
      }
      const nextEntry = Object.freeze({
        entry: request.entry,
        integrity: entry.value.integrity,
        pluginId: exported.value.id,
      });
      const enabled = Object.freeze(
        [
          ...located.value.locked.enabled.filter((item) => item.entry !== request.entry),
          nextEntry,
        ].sort((left, right) => compareCodeUnits(left.entry, right.entry)),
      );
      const nextLocked = Object.freeze({ ...located.value.locked, enabled });
      const grant = trustGrant(request.scope, workspaceRoot, materialized.value, entry.value);
      const trust = trusted
        ? state.value.trust
        : Object.freeze(
            [...state.value.trust, grant].sort((left, right) =>
              compareCodeUnits(trustKey(left), trustKey(right)),
            ),
          );
      if (request.scope === "personal") {
        const packages = Object.freeze(
          state.value.packages.map((item) => (item.name === nextLocked.name ? nextLocked : item)),
        );
        const written = await writeUserState(
          Object.freeze({ packages, schema: state.value.schema, trust }),
          state.value,
        );
        if (!written.ok) return written;
      } else {
        if (!trusted) {
          const trustedWrite = await writeUserState(
            Object.freeze({ packages: state.value.packages, schema: state.value.schema, trust }),
            state.value,
          );
          if (!trustedWrite.ok) return trustedWrite;
        }
        const lock = located.value.lock!;
        const packages = Object.freeze(
          lock.packages.map((item) => (item.name === nextLocked.name ? nextLocked : item)),
        );
        const packageDeclarations = Object.freeze(
          configuration.packageDeclarations.map((item) =>
            item.name === nextLocked.name
              ? Object.freeze({
                  ...item,
                  enabled: Object.freeze([...enabled.map((selected) => selected.entry)]),
                })
              : item,
          ),
        );
        const written = await writeBlueprintState(
          Object.freeze({ ...configuration, packageDeclarations }),
          Object.freeze({ packages, schema: lock.schema }),
          lock,
        );
        if (!written.ok) return written;
      }
      return success(
        snapshot(
          request.scope,
          nextLocked,
          materialized.value.manifest,
          materialized.value.manifestIntegrity,
        ),
      );
    });

  const disable = (
    request: SelectPluginPackageEntryRequest,
  ): Promise<Result<PluginPackageSelectionSnapshot>> =>
    serialize(async () => {
      const located = await locate(request);
      if (!located.ok) return located;
      if (!located.value.locked.enabled.some((item) => item.entry === request.entry)) {
        if (request.scope === "blueprint") {
          const declaration = configuration.packageDeclarations.find(
            (item) => item.name === request.name,
          )!;
          if (declaration.enabled.includes(request.entry)) {
            const packageDeclarations = Object.freeze(
              configuration.packageDeclarations.map((item) =>
                item.name === located.value.locked.name
                  ? Object.freeze({
                      ...item,
                      enabled: Object.freeze(
                        located.value.locked.enabled.map((selected) => selected.entry),
                      ),
                    })
                  : item,
              ),
            );
            const repaired = await writeBlueprintState(
              Object.freeze({ ...configuration, packageDeclarations }),
              located.value.lock!,
              located.value.lock!,
            );
            if (!repaired.ok) return repaired;
            return success(selectionSnapshot(request.scope, located.value.locked));
          }
        }
        return packageFailure(
          "plugin-package-entry-not-enabled",
          "The selected plugin entry is not enabled",
        );
      }
      const nextLocked = Object.freeze({
        ...located.value.locked,
        enabled: Object.freeze(
          located.value.locked.enabled.filter((item) => item.entry !== request.entry),
        ),
      });
      if (request.scope === "personal") {
        const state = located.value.state!;
        const packages = Object.freeze(
          state.packages.map((item) => (item.name === nextLocked.name ? nextLocked : item)),
        );
        const written = await writeUserState(
          Object.freeze({ packages, schema: state.schema, trust: state.trust }),
          state,
        );
        if (!written.ok) return written;
      } else {
        const lock = located.value.lock!;
        const packages = Object.freeze(
          lock.packages.map((item) => (item.name === nextLocked.name ? nextLocked : item)),
        );
        const packageDeclarations = Object.freeze(
          configuration.packageDeclarations.map((item) =>
            item.name === nextLocked.name
              ? Object.freeze({
                  ...item,
                  enabled: Object.freeze(nextLocked.enabled.map((selected) => selected.entry)),
                })
              : item,
          ),
        );
        const written = await writeBlueprintState(
          Object.freeze({ ...configuration, packageDeclarations }),
          Object.freeze({ packages, schema: lock.schema }),
          lock,
        );
        if (!written.ok) return written;
      }
      return success(selectionSnapshot(request.scope, nextLocked));
    });

  const remove = (
    request: InspectPluginPackageRequest,
  ): Promise<Result<{ readonly removed: string }>> =>
    serialize(async () => {
      if (request.scope === "blueprint") {
        if (!packageNamePattern.test(request.name)) {
          return packageFailure("invalid-plugin-package-name", "Plugin package name is malformed");
        }
        const lock = await readLock();
        if (!lock.ok) return lock;
        const declaration = configuration.packageDeclarations.find(
          (item) => item.name === request.name,
        );
        const locked = lock.value.packages.find((item) => item.name === request.name);
        if (declaration === undefined && locked === undefined) {
          return packageFailure(
            "plugin-package-not-found",
            "The requested blueprint plugin package is not declared",
          );
        }
        if ((declaration?.enabled.length ?? 0) > 0 || (locked?.enabled.length ?? 0) > 0) {
          return packageFailure(
            "plugin-package-still-enabled",
            "Disable every package entry before removing the package",
          );
        }
        const state = await readUserState();
        if (!state.ok) return state;
        const trust = Object.freeze(
          state.value.trust.filter(
            (grant) => grant.scope !== "blueprint" || grant.packageName !== request.name,
          ),
        );
        if (trust.length !== state.value.trust.length) {
          const pruned = await writeUserState(
            Object.freeze({ packages: state.value.packages, schema: state.value.schema, trust }),
            state.value,
          );
          if (!pruned.ok) return pruned;
        }
        const packageDeclarations = Object.freeze(
          configuration.packageDeclarations.filter((item) => item.name !== request.name),
        );
        const packages = Object.freeze(
          lock.value.packages.filter((item) => item.name !== request.name),
        );
        const written = await writeBlueprintState(
          Object.freeze({ ...configuration, packageDeclarations }),
          Object.freeze({ packages, schema: lock.value.schema }),
          lock.value,
        );
        if (!written.ok) return written;
        return success(Object.freeze({ removed: request.name }));
      }
      const located = await locate(request);
      if (!located.ok) return located;
      if (located.value.locked.enabled.length > 0) {
        return packageFailure(
          "plugin-package-still-enabled",
          "Disable every package entry before removing the package",
        );
      }
      const state = located.value.state!;
      const packages = Object.freeze(state.packages.filter((item) => item.name !== request.name));
      const trust = Object.freeze(
        state.trust.filter(
          (grant) => grant.scope !== "personal" || grant.packageName !== request.name,
        ),
      );
      const written = await writeUserState(
        Object.freeze({ packages, schema: state.schema, trust }),
        state,
      );
      if (!written.ok) return written;
      return success(Object.freeze({ removed: request.name }));
    });

  const loadEnabled = (): Promise<Result<LoadedLocalPluginPackages>> =>
    serialize(async () => {
      if (options.bootstrap.state !== "configured") {
        return success(
          Object.freeze({ personalPluginIds: Object.freeze([]), registrations: Object.freeze([]) }),
        );
      }
      const lock =
        configuration.packageDeclarations.length === 0 ? success(emptyLock()) : await readLock();
      if (!lock.ok) return lock;
      const selections: Array<{
        readonly locked: LockedPackage;
        readonly scope: PluginPackageScope;
      }> = [];
      for (const declaration of configuration.packageDeclarations) {
        const locked = lock.value.packages.find((item) => item.name === declaration.name);
        if (locked === undefined || locked.source !== declaration.source) {
          return packageFailure(
            "plugin-package-lock-missing",
            "A blueprint package declaration has no matching exact lock entry",
          );
        }
        const configured = declaration.enabled;
        if (
          configured.length !== locked.enabled.length ||
          configured.some((entry, index) => entry !== locked.enabled[index]?.entry)
        ) {
          return packageFailure(
            "plugin-package-lock-mismatch",
            "Blueprint package enablement does not match its exact lock entry",
          );
        }
        selections.push({ locked, scope: "blueprint" });
      }
      if (trustRootPlatform === "win32") {
        if (selections.some((selection) => selection.locked.enabled.length > 0)) {
          return unattestedWindowsTrustRoot();
        }
        try {
          await lstat(requestedUserDataRoot);
          return unattestedWindowsTrustRoot();
        } catch (error) {
          if (errorCode(error) !== "ENOENT") return unattestedWindowsTrustRoot();
        }
        return success(
          Object.freeze({ personalPluginIds: Object.freeze([]), registrations: Object.freeze([]) }),
        );
      }
      const state = await readUserState();
      if (!state.ok) return state;
      for (const locked of state.value.packages) selections.push({ locked, scope: "personal" });
      const registrations: PluginRegistration[] = [];
      const personalPluginIds: string[] = [];
      for (const selection of selections.sort((left, right) =>
        compareCodeUnits(
          `${left.scope}\0${left.locked.name}`,
          `${right.scope}\0${right.locked.name}`,
        ),
      )) {
        if (selection.locked.enabled.length === 0) continue;
        const materialized = await materializedFor(selection.locked, selection.scope);
        if (!materialized.ok) return materialized;
        if (materialized.value.manifestIntegrity !== selection.locked.manifestIntegrity) {
          return packageFailure(
            "plugin-package-integrity-drift",
            "A local package manifest changed after its exact lock was written",
          );
        }
        for (const lockedEntry of selection.locked.enabled) {
          const entry = await materializeEntry(
            materialized.value,
            lockedEntry.entry,
            fileReadObserver,
          );
          if (!entry.ok) return entry;
          if (entry.value.integrity !== lockedEntry.integrity) {
            return packageFailure(
              "plugin-package-integrity-drift",
              "An enabled plugin entry changed after its exact lock was written",
            );
          }
          if (
            !state.value.trust.some((grant) =>
              grantMatches(grant, selection.scope, workspaceRoot, materialized.value, entry.value),
            )
          ) {
            return packageFailure(
              "plugin-full-user-permissions-trust-required",
              "Plugins run with your full user permissions. Groma verifies what was installed, not that it is safe. Explicit trust is required before this exact entry can execute",
            );
          }
          let module: unknown;
          try {
            module = await importVerifiedEntry(entry.value, importModule);
          } catch {
            return packageFailure(
              "plugin-package-entry-load-failed",
              "A trusted local plugin entry could not be loaded",
            );
          }
          const exported = exportedPlugin(module, selection.scope);
          if (!exported.ok) return exported;
          if (exported.value.id !== lockedEntry.pluginId) {
            return packageFailure(
              "plugin-package-lock-mismatch",
              "A loaded plugin ID does not match its exact lock entry",
            );
          }
          registrations.push(exported.value.registration);
          if (selection.scope === "personal") personalPluginIds.push(exported.value.id);
        }
      }
      return success(
        Object.freeze({
          personalPluginIds: Object.freeze(personalPluginIds.sort(compareCodeUnits)),
          registrations: Object.freeze(registrations),
        }),
      );
    });

  return Object.freeze({ add, disable, enable, inspect, loadEnabled, remove });
}
