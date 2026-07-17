import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { constants, realpathSync, type Stats } from "node:fs";
import { chmod, lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

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
  type LocalResourceFaultInjector,
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
import { defaultHostPluginRegistrationBounds } from "./plugin-runtime-bounds.ts";
import {
  scaffoldLocalPluginPackage,
  type PluginPackageScaffoldSnapshot,
  type ScaffoldPluginPackageRequest,
} from "./plugin-scaffolding.ts";

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
  scaffold(request: ScaffoldPluginPackageRequest): Promise<Result<PluginPackageScaffoldSnapshot>>;
}

export interface LoadedLocalPluginPackages {
  readonly personalPluginIds: readonly string[];
  readonly registrations: readonly PluginRegistration[];
}

export interface LocalPluginPackageManager extends PluginPackageOperations {
  loadEnabled(): Promise<Result<LoadedLocalPluginPackages>>;
}

export interface LocalPluginPackageManagerOptions {
  /** Read-only compatibility used only to compose explicit migration commands. */
  readonly allowLegacySchemasForMigration?: boolean;
  readonly bootstrap: BootstrapConfigurationLoad;
  /** Verification-only observer for deterministic file race tests. */
  readonly fileReadObserver?: (event: LocalPluginPackageFileReadEvent) => Promise<void> | void;
  readonly importModule?: (url: string) => Promise<unknown>;
  /** Total enabled blueprint and personal entries this Host can still compose. */
  readonly maxEnabledPlugins: number;
  readonly resources: LocalResourceProvider;
  /** Host-owned platform seam; production derives this from the running target. */
  readonly trustRootPlatform?: LocalPluginPackageTrustRootPlatform;
  /** Verification-only seam for deterministic personal-state publication faults. */
  readonly userResourceFaultInjector?: LocalResourceFaultInjector;
  readonly userDataRoot: string;
  readonly workspaceRoot: string;
}

export interface LocalPluginPackageFileReadEvent {
  readonly file: string;
  readonly phase: "ancestry-checked" | "opened";
}

interface BoundedRegularFileContainment {
  readonly code: "plugin-package-entry-invalid" | "plugin-package-file-invalid";
  readonly message: string;
  readonly root: string;
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
const packageStateCoordinationLocator = requiredLocator("groma", "package-state");
const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;
const pluginIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const remoteSourcePattern =
  /^(?:git:|git\+|github:|https?:|npm:|ssh:|[a-z][a-z0-9+.-]*:\/\/|(?![a-z]:[\\/])(?:[^@/:\\\s]+@)?[^/:\\\s]+:)/i;
const integrityPattern = /^sha256:[0-9a-f]{64}$/;
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const textEncoder = new TextEncoder();
const indeterminateBlueprintPackageStateMessage =
  "Blueprint plugin package state may have committed; review groma/groma.yaml and groma/packages.lock before retrying, and reconcile a mismatch with package disable or remove";
const indeterminatePersonalPackageStateMessage =
  "Personal plugin package state may have committed; inspect the personal package before retrying; not found confirms removal";
const indeterminateBlueprintTrustStateMessage =
  "Blueprint plugin trust state may have committed; verify the exact package entry and current selection before retrying";
const packageStateReadRetryDelayMilliseconds = 25;
const maximumPackageStateReadRetryWaits = 80;

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

function packageStateUnavailable<T>(): Result<T> {
  return packageFailure(
    "plugin-package-state-unavailable",
    "Local plugin package state is changing or unavailable; retry after changes settle",
  );
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

function canonicalProspectivePath(value: string): string | undefined {
  const suffix: string[] = [];
  let current = value;
  for (;;) {
    try {
      return path.resolve(realpathSync.native(current), ...suffix);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      suffix.unshift(path.basename(current));
      current = parent;
    }
  }
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
  containment?: BoundedRegularFileContainment,
): Promise<Result<Uint8Array>> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    if (containment !== undefined) {
      await observer?.(Object.freeze({ file, phase: "ancestry-checked" }));
    }
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
    if (containment !== undefined) {
      const canonicalAfterOpen = await realpath(file);
      if (canonicalAfterOpen !== file || !isPathWithin(containment.root, canonicalAfterOpen)) {
        return packageFailure(containment.code, containment.message);
      }
    }
    const buffer = Buffer.allocUnsafe(Math.min(before.size, maximumBytes) + 1);
    let total = 0;
    while (total < buffer.byteLength) {
      const read = await handle.read(buffer, total, buffer.byteLength - total, total);
      if (read.bytesRead === 0) break;
      total += read.bytesRead;
    }
    const after = await handle.stat();
    const current = await lstat(file);
    const canonicalAfterRead = containment === undefined ? undefined : await realpath(file);
    if (
      total > maximumBytes ||
      (containment !== undefined &&
        (canonicalAfterRead !== file || !isPathWithin(containment.root, canonicalAfterRead))) ||
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

function requestedPackageLocation(
  workspaceRoot: string,
  source: string,
  scope: PluginPackageScope,
): Result<string> {
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
  return success(requested);
}

async function canonicalPackageLocation(
  workspaceRoot: string,
  source: string,
  scope: PluginPackageScope,
): Promise<Result<{ readonly location: string; readonly source: string }>> {
  const requested = requestedPackageLocation(workspaceRoot, source, scope);
  if (!requested.ok) return requested;
  try {
    const location = await realpath(requested.value);
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
  const bytes = await readBoundedRegularFile(manifestFile, maximumManifestBytes, observer, {
    code: "plugin-package-file-invalid",
    message: "Plugin package files must remain within one stable package directory",
    root: located.value.location,
  });
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
    const bytes = await readBoundedRegularFile(canonical, maximumEntryBytes, observer, {
      code: "plugin-package-entry-invalid",
      message: "Plugin entry resolution escaped or changed its package directory",
      root: materialized.location,
    });
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
    grants.some(
      (grant, index) => index > 0 && trustSubjectKey(grant) === trustSubjectKey(grants[index - 1]!),
    )
  ) {
    return undefined;
  }
  return Object.freeze(grants);
}

function trustKey(grant: TrustGrant): string {
  return `${trustSubjectKey(grant)}\0${grant.manifestIntegrity}\0${grant.entryIntegrity}`;
}

function trustSubjectKey(grant: TrustGrant): string {
  return `${grant.scope}\0${grant.workspaceLocation}\0${grant.packageName}\0${grant.packageLocation}\0${grant.entry}`;
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

function parseLock(bytes: Uint8Array, allowLegacySchemaForMigration = false): Result<PackageLock> {
  const parsed = exactJsonDocument(bytes, ["packages", "schema"]);
  if (!parsed.ok)
    return packageFailure(
      "plugin-package-lock-malformed",
      "The exact plugin package lock is malformed",
    );
  const record = parsed.value as Record<string, unknown>;
  const packages = parsePackages(record.packages);
  return (record.schema === "groma.packages-lock/v1" ||
    (allowLegacySchemaForMigration && record.schema === "groma.packages-lock/v0")) &&
    packages !== undefined
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
  if (lock.packages.length > bootstrapConfigurationBounds.maxPackageDeclarations) {
    return packageFailure(
      "plugin-package-state-limit-exceeded",
      `Blueprint plugin package declarations exceed the maximum of ${bootstrapConfigurationBounds.maxPackageDeclarations}`,
    );
  }
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
  if (
    configuration.packageDeclarations.length > bootstrapConfigurationBounds.maxPackageDeclarations
  ) {
    return packageFailure(
      "plugin-package-state-limit-exceeded",
      `Blueprint plugin package declarations exceed the maximum of ${bootstrapConfigurationBounds.maxPackageDeclarations}`,
    );
  }
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
  indeterminateMessage: string,
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
      ? indeterminateMessage
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

function enabledEntryCount(packages: readonly LockedPackage[]): number {
  return packages.reduce((total, item) => total + item.enabled.length, 0);
}

function configuredEnabledEntryCount(configuration: BootstrapBaseConfiguration): number {
  return configuration.packageDeclarations.reduce((total, item) => total + item.enabled.length, 0);
}

function blueprintEnabledEntryCount(
  configuration: BootstrapBaseConfiguration,
  lock: PackageLock,
): number {
  const enabled = new Set<string>();
  for (const declaration of configuration.packageDeclarations) {
    for (const entry of declaration.enabled) enabled.add(`${declaration.name}\0${entry}`);
  }
  for (const locked of lock.packages) {
    for (const entry of locked.enabled) enabled.add(`${locked.name}\0${entry.entry}`);
  }
  return enabled.size;
}

function sameBlueprintSelection(
  declaration: ConfiguredPluginPackage,
  locked: LockedPackage,
): boolean {
  return (
    declaration.enabled.length === locked.enabled.length &&
    declaration.enabled.every((entry, index) => entry === locked.enabled[index]?.entry)
  );
}

function hasEnabledPluginIdConflict(
  pluginId: string,
  selected: {
    readonly entry: string;
    readonly name: string;
    readonly scope: PluginPackageScope;
  },
  blueprintPackages: readonly LockedPackage[],
  personalPackages: readonly LockedPackage[],
): boolean {
  for (const [scope, packages] of [
    ["blueprint", blueprintPackages],
    ["personal", personalPackages],
  ] as const) {
    for (const locked of packages) {
      for (const enabled of locked.enabled) {
        if (
          scope === selected.scope &&
          locked.name === selected.name &&
          enabled.entry === selected.entry
        ) {
          continue;
        }
        if (enabled.pluginId === pluginId) return true;
      }
    }
  }
  return false;
}

function hasDuplicateEnabledPluginIds(
  blueprintPackages: readonly LockedPackage[],
  personalPackages: readonly LockedPackage[],
): boolean {
  const pluginIds = new Set<string>();
  for (const packages of [blueprintPackages, personalPackages]) {
    for (const locked of packages) {
      for (const enabled of locked.enabled) {
        if (pluginIds.has(enabled.pluginId)) return true;
        pluginIds.add(enabled.pluginId);
      }
    }
  }
  return false;
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
    const registration = validatePluginRegistration(
      descriptor.value,
      defaultHostPluginRegistrationBounds,
    );
    if (
      !registration.ok ||
      registration.value.manifest.apiVersion !== pluginRuntimeApiVersion ||
      registration.value.manifest.phase !== 1
    )
      throw new Error();
    if (registration.value.manifest.id.startsWith("official.")) {
      return packageFailure(
        "plugin-package-plugin-id-reserved",
        "Local plugin packages must not use the Host-reserved official.* plugin namespace",
      );
    }
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
  if (!Number.isSafeInteger(options.maxEnabledPlugins) || options.maxEnabledPlugins < 0) {
    throw new TypeError("Local enabled plugin capacity must be a non-negative safe integer");
  }
  // Package and entry paths use the native fs/promises realpath binding. Keep the
  // parent in that same canonical namespace, including Windows 8.3 and substituted paths.
  const workspaceRoot = realpathSync.native(path.normalize(options.workspaceRoot));
  const requestedUserDataRoot = path.normalize(options.userDataRoot);
  const prospectiveUserDataRoot = canonicalProspectivePath(requestedUserDataRoot);
  const userDataRootContained =
    prospectiveUserDataRoot !== undefined && isPathWithin(workspaceRoot, prospectiveUserDataRoot);
  const userDataRootUnusable = prospectiveUserDataRoot === undefined || userDataRootContained;
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
  const userResourceFaultInjector = options.userResourceFaultInjector;
  const trustRootPlatform =
    options.trustRootPlatform ?? (process.platform === "win32" ? "win32" : "posix");
  const allowLegacySchemasForMigration = options.allowLegacySchemasForMigration === true;

  function unattestedWindowsTrustRoot<T>(): Result<T> {
    return packageFailure(
      "plugin-package-trust-root-unattested",
      "Local plugin trust is unavailable because this Windows Host cannot attest exclusive control of its user-data root",
    );
  }

  const requireAbsentWindowsUserDataRoot = async (): Promise<Result<void>> => {
    try {
      await lstat(requestedUserDataRoot);
      return unattestedWindowsTrustRoot();
    } catch (error) {
      return errorCode(error) === "ENOENT" ? success(undefined) : unattestedWindowsTrustRoot();
    }
  };

  const userResources = async (): Promise<LocalResourceProvider> => {
    if (userDataRootUnusable) {
      throw new TypeError("Plugin package user data must live outside the observed workspace");
    }
    const canonical = await secureUserDataRoot(requestedUserDataRoot, trustRootPlatform);
    if (isPathWithin(workspaceRoot, canonical)) {
      throw new TypeError("Plugin package user data must live outside the observed workspace");
    }
    if (userProviderPromise === undefined) {
      userProviderRoot = canonical;
      userProviderPromise = createLocalResourceProvider(
        userResourceFaultInjector === undefined
          ? { workspaceRoot: canonical }
          : { faultInjector: userResourceFaultInjector, workspaceRoot: canonical },
      );
    } else if (canonical !== userProviderRoot) {
      throw new TypeError("Plugin package user data identity changed");
    }
    return await userProviderPromise;
  };

  const readLock = async (): Promise<Result<PackageLock>> => {
    const read = await readResource(options.resources, lockLocator, maximumUserStateBytes);
    if (!read.ok) {
      return packageFailure(
        "plugin-package-lock-unavailable",
        "The exact plugin package lock is unavailable",
      );
    }
    return read.value === undefined
      ? success(emptyLock())
      : parseLock(read.value, allowLegacySchemasForMigration);
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
    if (!read.ok) {
      return packageFailure(
        "plugin-package-user-state-unavailable",
        "Local plugin package state is unavailable",
      );
    }
    return read.value === undefined ? success(emptyUserState()) : parseUserState(read.value);
  };

  const writeUserState = async (
    state: UserPackageState,
    expected: UserPackageState,
    indeterminateMessage: string,
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
    let publicationMayHaveChanged = false;
    const coordinated = await resources.withCoordination<Result<void>>(
      { context: "local-machine", locator: userStateLocator },
      async () => {
        const currentBytes = await readResource(resources, userStateLocator, maximumUserStateBytes);
        if (!currentBytes.ok) {
          return packageFailure(
            "plugin-package-user-state-unavailable",
            "Local plugin package state is unavailable",
          );
        }
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
        const written = await replaceResource(
          resources,
          userStateLocator,
          stateBytes,
          indeterminateMessage,
        );
        publicationMayHaveChanged =
          written.ok ||
          written.diagnostics.some((item) => item.code === "plugin-package-state-indeterminate");
        return written;
      },
    );
    if (!coordinated.ok) {
      return publicationMayHaveChanged
        ? packageFailure("plugin-package-state-indeterminate", indeterminateMessage)
        : packageStateUnavailable();
    }
    return coordinated.value;
  };

  const readConfiguration = async (): Promise<Result<typeof configuration>> => {
    const read = await readResource(
      options.resources,
      configurationLocator,
      bootstrapConfigurationBounds.maxConfigurationBytes,
    );
    if (!read.ok) {
      return packageFailure(
        "workspace-configuration-provider-failure",
        "Workspace configuration access failed",
      );
    }
    if (read.value === undefined) {
      return packageFailure(
        "no-workspace",
        "Initialize a Groma workspace before managing blueprint packages",
      );
    }
    const parsed = createYamlConfigurationParser({
      allowLegacySchemaForMigration: allowLegacySchemasForMigration,
    }).parse(read.value);
    return parsed.ok ? success(parsed.value) : ownedFailure(...parsed.diagnostics);
  };

  type StartupPersonalStateObservation = "state" | "unusable-root-absent" | "windows-root-absent";
  type StartupPackageStateObservation = Readonly<{
    configuration: typeof configuration;
    lock: PackageLock;
    userState?: UserPackageState;
  }>;

  const startupPersonalStateObservation: StartupPersonalStateObservation =
    trustRootPlatform === "win32"
      ? "windows-root-absent"
      : userDataRootUnusable
        ? "unusable-root-absent"
        : "state";

  const requireAbsentUnusableUserDataRoot = async (): Promise<Result<void>> => {
    try {
      await lstat(requestedUserDataRoot);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return success(undefined);
    }
    return packageFailure(
      "plugin-package-user-state-unavailable",
      "Local plugin package state is unavailable",
    );
  };

  const startupConfiguration = async (
    phase: "initial" | "revalidate",
  ): Promise<Result<typeof configuration>> => {
    const current = await readConfiguration();
    if (current.ok) return current;
    if (phase === "initial") {
      if (current.diagnostics.some((item) => item.code === "no-workspace")) {
        return packageFailure(
          "workspace-configuration-changed",
          "Workspace configuration changed during bootstrap; restart after changes settle",
        );
      }
      return current.diagnostics.every((item) => item.code.startsWith("workspace-configuration-"))
        ? current
        : packageFailure(
            "workspace-configuration-provider-failure",
            "Workspace configuration access failed",
          );
    }
    return current.diagnostics.every(
      (item) => item.code === "workspace-configuration-provider-failure",
    )
      ? current
      : packageFailure(
          "workspace-configuration-changed",
          "Workspace configuration changed during package startup; restart after changes settle",
        );
  };

  const readStartupPackageStateUncoordinated = async (
    personalState: StartupPersonalStateObservation,
    phase: "initial" | "revalidate",
  ): Promise<Result<StartupPackageStateObservation>> => {
    const currentConfiguration = await startupConfiguration(phase);
    if (!currentConfiguration.ok) return currentConfiguration;
    const lock = await readLock();
    if (!lock.ok) return lock;
    if (personalState === "state") {
      const userState = await readUserState();
      return userState.ok
        ? success(
            Object.freeze({
              configuration: currentConfiguration.value,
              lock: lock.value,
              userState: userState.value,
            }),
          )
        : userState;
    }
    const absent =
      personalState === "windows-root-absent"
        ? await requireAbsentWindowsUserDataRoot()
        : await requireAbsentUnusableUserDataRoot();
    return absent.ok
      ? success(
          Object.freeze({
            configuration: currentConfiguration.value,
            lock: lock.value,
          }),
        )
      : absent;
  };

  const readStartupPackageState = async (
    personalState: StartupPersonalStateObservation,
    phase: "initial" | "revalidate",
  ): Promise<Result<StartupPackageStateObservation>> => {
    for (let attempt = 0; attempt <= maximumPackageStateReadRetryWaits; attempt += 1) {
      let coordinated: Result<Result<StartupPackageStateObservation>>;
      try {
        coordinated = await options.resources.withCoordination(
          { context: "local-machine", locator: packageStateCoordinationLocator },
          () => readStartupPackageStateUncoordinated(personalState, phase),
        );
      } catch {
        return packageStateUnavailable();
      }
      if (coordinated.ok) return coordinated.value;
      const contended =
        coordinated.diagnostics.length === 1 &&
        coordinated.diagnostics[0]?.code === "resource-coordination-contended";
      if (!contended) return packageStateUnavailable();
      if (attempt === maximumPackageStateReadRetryWaits) break;
      await wait(packageStateReadRetryDelayMilliseconds);
    }
    return packageStateUnavailable();
  };

  const startupPackageProjectionStillCurrent = async (
    expected: StartupPackageStateObservation,
    personalState: StartupPersonalStateObservation,
  ): Promise<Result<void>> => {
    const current = await readStartupPackageState(personalState, "revalidate");
    if (!current.ok) return current;
    if (
      serializeBootstrapConfiguration(current.value.configuration) !==
      serializeBootstrapConfiguration(expected.configuration)
    ) {
      return packageFailure(
        "workspace-configuration-changed",
        "Workspace configuration changed during package startup; restart after changes settle",
      );
    }
    if (!sameBytes(encodeCanonical(current.value.lock), encodeCanonical(expected.lock))) {
      return packageFailure(
        "plugin-package-lock-changed",
        "Blueprint plugin package state changed during startup; restart after changes settle",
      );
    }
    if (
      personalState === "state" &&
      (current.value.userState === undefined ||
        expected.userState === undefined ||
        !sameBytes(encodeCanonical(current.value.userState), encodeCanonical(expected.userState)))
    ) {
      return packageFailure(
        "plugin-package-user-state-changed",
        "Local plugin package state changed during startup; restart after changes settle",
      );
    }
    return success(undefined);
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
    let publicationMayHaveChanged = false;
    const coordinated = await options.resources.withCoordination(
      { context: "local-machine", locator: lockLocator },
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
        const locked = await replaceResource(
          options.resources,
          lockLocator,
          lockBytes,
          indeterminateBlueprintPackageStateMessage,
        );
        if (!locked.ok) {
          publicationMayHaveChanged = locked.diagnostics.some(
            (item) => item.code === "plugin-package-state-indeterminate",
          );
          return locked;
        }
        publicationMayHaveChanged = true;
        const configured = await replaceResource(
          options.resources,
          configurationLocator,
          configurationBytes,
          indeterminateBlueprintPackageStateMessage,
        );
        if (configured.ok) return configured;
        return packageFailure(
          "plugin-package-state-indeterminate",
          indeterminateBlueprintPackageStateMessage,
        );
      },
    );
    if (!coordinated.ok) {
      return publicationMayHaveChanged
        ? packageFailure(
            "plugin-package-state-indeterminate",
            indeterminateBlueprintPackageStateMessage,
          )
        : packageStateUnavailable();
    }
    if (!coordinated.value.ok) return coordinated.value;
    configuration = nextConfiguration;
    return success(undefined);
  };

  const blueprintPackageProjectionStillCurrent = async (
    expectedConfiguration: typeof configuration,
    expectedLock: PackageLock,
  ): Promise<Result<void>> => {
    const configurationChangedMessage =
      "Workspace configuration changed during plugin enablement; retry after changes settle";
    const lockChangedMessage =
      "Blueprint plugin package state changed during plugin enablement; retry after changes settle";
    const currentConfiguration = await readConfiguration();
    if (!currentConfiguration.ok) {
      return currentConfiguration.diagnostics.every(
        (item) => item.code === "workspace-configuration-provider-failure",
      )
        ? currentConfiguration
        : packageFailure("workspace-configuration-changed", configurationChangedMessage);
    }
    if (
      serializeBootstrapConfiguration(currentConfiguration.value) !==
      serializeBootstrapConfiguration(expectedConfiguration)
    ) {
      return packageFailure("workspace-configuration-changed", configurationChangedMessage);
    }
    const currentLock = await readLock();
    if (!currentLock.ok) return currentLock;
    if (!sameBytes(encodeCanonical(currentLock.value), encodeCanonical(expectedLock))) {
      return packageFailure("plugin-package-lock-changed", lockChangedMessage);
    }
    return success(undefined);
  };

  const packageProjectionStillCurrent = async (
    expectedConfiguration: typeof configuration,
    expectedLock: PackageLock,
    expectedUserState: UserPackageState,
  ): Promise<Result<void>> => {
    const blueprint = await blueprintPackageProjectionStillCurrent(
      expectedConfiguration,
      expectedLock,
    );
    if (!blueprint.ok) return blueprint;
    const userStateChangedMessage =
      "Local plugin package state changed during plugin enablement; retry after changes settle";
    const currentUserState = await readUserState();
    if (!currentUserState.ok) return currentUserState;
    if (!sameBytes(encodeCanonical(currentUserState.value), encodeCanonical(expectedUserState))) {
      return packageFailure("plugin-package-user-state-changed", userStateChangedMessage);
    }
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

  function serializeMutation<T>(
    scope: PluginPackageScope,
    action: (markChanged: (message?: string) => void) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    return serialize(async () => {
      let completed: Result<T> | undefined;
      let publicationMayHaveChanged = false;
      let recoveryMessage =
        scope === "blueprint"
          ? indeterminateBlueprintPackageStateMessage
          : indeterminatePersonalPackageStateMessage;
      const coordinated = await options.resources.withCoordination<Result<T>>(
        { context: "local-machine", locator: packageStateCoordinationLocator },
        async () => {
          completed = await action((message) => {
            publicationMayHaveChanged = true;
            if (message !== undefined) recoveryMessage = message;
          });
          return completed;
        },
      );
      const completedIndeterminate =
        completed !== undefined &&
        !completed.ok &&
        completed.diagnostics.some((item) => item.code === "plugin-package-state-indeterminate");
      if (!coordinated.ok) {
        if (completedIndeterminate) return completed!;
        return publicationMayHaveChanged
          ? packageFailure("plugin-package-state-indeterminate", recoveryMessage)
          : packageStateUnavailable();
      }
      if (!coordinated.value.ok && publicationMayHaveChanged) {
        return packageFailure("plugin-package-state-indeterminate", recoveryMessage);
      }
      return coordinated.value;
    });
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
      const materialized = await materializePackage(
        workspaceRoot,
        located.value.locked.source,
        request.scope,
        fileReadObserver,
      );
      if (!materialized.ok) return materialized;
      if (request.scope === "blueprint") {
        const declaration = configuration.packageDeclarations.find(
          (item) => item.name === request.name,
        )!;
        if (!sameBlueprintSelection(declaration, located.value.locked)) {
          return packageFailure(
            "plugin-package-lock-mismatch",
            "Blueprint package enablement does not match its exact lock entry",
          );
        }
      }
      if (materialized.value.manifestIntegrity !== located.value.locked.manifestIntegrity) {
        return success(
          snapshot(
            request.scope,
            located.value.locked,
            materialized.value.manifest,
            materialized.value.manifestIntegrity,
          ),
        );
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

  const add = (request: AddPluginPackageRequest): Promise<Result<PluginPackageSnapshot>> => {
    if (request.scope !== "blueprint" && request.scope !== "personal") {
      return Promise.resolve(
        packageFailure(
          "invalid-plugin-package-scope",
          "Plugin package scope must be blueprint or personal",
        ),
      );
    }
    if (typeof request.source !== "string") {
      return Promise.resolve(
        packageFailure(
          "invalid-local-plugin-package-source",
          "Local plugin package source is malformed",
        ),
      );
    }
    const requested = requestedPackageLocation(workspaceRoot, request.source, request.scope);
    if (!requested.ok) return Promise.resolve(requested);
    return serializeMutation(request.scope, async (markChanged) => {
      if (request.scope === "personal" && userDataRootUnusable) {
        return packageFailure(
          "plugin-package-user-state-unavailable",
          "Local plugin package state is unavailable",
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
          indeterminatePersonalPackageStateMessage,
        );
        if (!written.ok) return written;
        markChanged();
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
        markChanged();
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
  };

  const enable = (
    request: SelectPluginPackageEntryRequest,
  ): Promise<Result<PluginPackageSnapshot>> =>
    serializeMutation(request.scope, async (markChanged) => {
      const located = await locate(request);
      if (!located.ok) return located;
      if (request.scope === "blueprint") {
        const declaration = configuration.packageDeclarations.find(
          (item) => item.name === request.name,
        )!;
        if (!sameBlueprintSelection(declaration, located.value.locked)) {
          return packageFailure(
            "plugin-package-lock-mismatch",
            "Blueprint package enablement does not match its exact lock entry",
          );
        }
      }
      if (userDataRootUnusable) {
        return packageFailure(
          "plugin-package-user-state-unavailable",
          "Local plugin package state is unavailable",
        );
      }
      const state =
        located.value.state === undefined ? await readUserState() : success(located.value.state);
      if (!state.ok) return state;
      const blueprintLock =
        located.value.lock === undefined ? await readLock() : success(located.value.lock);
      if (!blueprintLock.ok) return blueprintLock;
      const alreadyEnabled = located.value.locked.enabled.some(
        (item) => item.entry === request.entry,
      );
      const enabledCount =
        blueprintEnabledEntryCount(configuration, blueprintLock.value) +
        enabledEntryCount(state.value.packages);
      if (enabledCount + (alreadyEnabled ? 0 : 1) > options.maxEnabledPlugins) {
        return packageFailure(
          "plugin-package-enabled-limit-exceeded",
          "Enabled local plugins exceed this Host's runtime capacity",
        );
      }
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
      const trusted = state.value.trust.some((grant) =>
        grantMatches(grant, request.scope, workspaceRoot, materialized.value, entry.value),
      );
      if (!trusted && request.trustFullUserPermissions !== true) {
        return packageFailure(
          "plugin-full-user-permissions-trust-required",
          "Plugins run with your full user permissions. Groma verifies what was installed, not that it is safe. Re-run with --trust-full-user-permissions to execute this exact entry",
        );
      }
      const stillCurrent = await packageProjectionStillCurrent(
        configuration,
        blueprintLock.value,
        state.value,
      );
      if (!stillCurrent.ok) return stillCurrent;
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
      if (
        hasEnabledPluginIdConflict(
          exported.value.id,
          { entry: request.entry, name: request.name, scope: request.scope },
          blueprintLock.value.packages,
          state.value.packages,
        )
      ) {
        return packageFailure(
          "plugin-package-plugin-id-conflict",
          "Enabled local plugins must use distinct plugin IDs",
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
            [
              ...state.value.trust.filter(
                (existing) => trustSubjectKey(existing) !== trustSubjectKey(grant),
              ),
              grant,
            ].sort((left, right) => compareCodeUnits(trustKey(left), trustKey(right))),
          );
      if (request.scope === "personal") {
        const packages = Object.freeze(
          state.value.packages.map((item) => (item.name === nextLocked.name ? nextLocked : item)),
        );
        const written = await writeUserState(
          Object.freeze({ packages, schema: state.value.schema, trust }),
          state.value,
          indeterminatePersonalPackageStateMessage,
        );
        if (!written.ok) return written;
        markChanged();
      } else {
        if (!trusted) {
          const trustedWrite = await writeUserState(
            Object.freeze({ packages: state.value.packages, schema: state.value.schema, trust }),
            state.value,
            indeterminateBlueprintTrustStateMessage,
          );
          if (!trustedWrite.ok) return trustedWrite;
          markChanged(indeterminateBlueprintTrustStateMessage);
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
        markChanged();
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
    serializeMutation(request.scope, async (markChanged) => {
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
        if (declaration !== undefined && locked === undefined) {
          if (!declaration.enabled.includes(request.entry)) {
            return packageFailure(
              "plugin-package-entry-not-enabled",
              "The selected plugin entry is not enabled",
            );
          }
          const enabled = Object.freeze(
            declaration.enabled.filter((entry) => entry !== request.entry),
          );
          const packageDeclarations = Object.freeze(
            configuration.packageDeclarations.map((item) =>
              item.name === request.name ? Object.freeze({ ...item, enabled }) : item,
            ),
          );
          const repaired = await writeBlueprintState(
            Object.freeze({ ...configuration, packageDeclarations }),
            lock.value,
            lock.value,
          );
          if (!repaired.ok) return repaired;
          markChanged();
          return success(
            Object.freeze({ enabled, name: request.name, scope: "blueprint" as const }),
          );
        }
      }
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
            markChanged();
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
          indeterminatePersonalPackageStateMessage,
        );
        if (!written.ok) return written;
        markChanged();
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
        markChanged();
      }
      return success(selectionSnapshot(request.scope, nextLocked));
    });

  const remove = (
    request: InspectPluginPackageRequest,
  ): Promise<Result<{ readonly removed: string }>> =>
    serializeMutation(request.scope, async (markChanged) => {
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
        if (trustRootPlatform === "win32") {
          const absent = await requireAbsentWindowsUserDataRoot();
          if (!absent.ok) return absent;
        } else {
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
              indeterminateBlueprintTrustStateMessage,
            );
            if (!pruned.ok) return pruned;
            markChanged(indeterminateBlueprintTrustStateMessage);
          }
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
        markChanged();
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
        indeterminatePersonalPackageStateMessage,
      );
      if (!written.ok) return written;
      markChanged();
      return success(Object.freeze({ removed: request.name }));
    });

  const loadEnabled = (): Promise<Result<LoadedLocalPluginPackages>> =>
    serialize(async () => {
      if (options.bootstrap.state !== "configured") {
        return success(
          Object.freeze({ personalPluginIds: Object.freeze([]), registrations: Object.freeze([]) }),
        );
      }
      const observed = await readStartupPackageState(startupPersonalStateObservation, "initial");
      if (!observed.ok) return observed;
      if (
        serializeBootstrapConfiguration(observed.value.configuration) !==
        serializeBootstrapConfiguration(configuration)
      ) {
        return packageFailure(
          "workspace-configuration-changed",
          "Workspace configuration changed during bootstrap; restart after changes settle",
        );
      }
      const selections: Array<{
        readonly locked: LockedPackage;
        readonly scope: PluginPackageScope;
      }> = [];
      for (const declaration of configuration.packageDeclarations) {
        const locked = observed.value.lock.packages.find((item) => item.name === declaration.name);
        if (locked === undefined || locked.source !== declaration.source) {
          return packageFailure(
            "plugin-package-lock-missing",
            "A blueprint package declaration has no matching exact lock entry",
          );
        }
        if (!sameBlueprintSelection(declaration, locked)) {
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
        const stillCurrent = await startupPackageProjectionStillCurrent(
          observed.value,
          startupPersonalStateObservation,
        );
        if (!stillCurrent.ok) return stillCurrent;
        const stillAbsent = await requireAbsentWindowsUserDataRoot();
        if (!stillAbsent.ok) return stillAbsent;
        return success(
          Object.freeze({ personalPluginIds: Object.freeze([]), registrations: Object.freeze([]) }),
        );
      }
      if (userDataRootUnusable) {
        try {
          await lstat(requestedUserDataRoot);
        } catch (error) {
          if (
            errorCode(error) === "ENOENT" &&
            selections.every((selection) => selection.locked.enabled.length === 0)
          ) {
            const stillCurrent = await startupPackageProjectionStillCurrent(
              observed.value,
              startupPersonalStateObservation,
            );
            if (!stillCurrent.ok) return stillCurrent;
            try {
              await lstat(requestedUserDataRoot);
            } catch (finalError) {
              if (errorCode(finalError) === "ENOENT") {
                return success(
                  Object.freeze({
                    personalPluginIds: Object.freeze([]),
                    registrations: Object.freeze([]),
                  }),
                );
              }
            }
            return packageFailure(
              "plugin-package-user-state-unavailable",
              "Local plugin package state is unavailable",
            );
          }
        }
        return packageFailure(
          "plugin-package-user-state-unavailable",
          "Local plugin package state is unavailable",
        );
      }
      const state = observed.value.userState;
      if (state === undefined) return packageStateUnavailable();
      if (
        configuredEnabledEntryCount(configuration) + enabledEntryCount(state.packages) >
        options.maxEnabledPlugins
      ) {
        return packageFailure(
          "plugin-package-enabled-limit-exceeded",
          "Enabled local plugins exceed this Host's runtime capacity",
        );
      }
      if (hasDuplicateEnabledPluginIds(observed.value.lock.packages, state.packages)) {
        return packageFailure(
          "plugin-package-plugin-id-conflict",
          "Enabled local plugins must use distinct plugin IDs",
        );
      }
      for (const locked of state.packages) selections.push({ locked, scope: "personal" });
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
            !state.trust.some((grant) =>
              grantMatches(grant, selection.scope, workspaceRoot, materialized.value, entry.value),
            )
          ) {
            return packageFailure(
              "plugin-full-user-permissions-trust-required",
              "Plugins run with your full user permissions. Groma verifies what was installed, not that it is safe. Explicit trust is required before this exact entry can execute",
            );
          }
          const stillCurrent = await startupPackageProjectionStillCurrent(
            observed.value,
            startupPersonalStateObservation,
          );
          if (!stillCurrent.ok) return stillCurrent;
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
      const stillCurrent = await startupPackageProjectionStillCurrent(
        observed.value,
        startupPersonalStateObservation,
      );
      if (!stillCurrent.ok) return stillCurrent;
      return success(
        Object.freeze({
          personalPluginIds: Object.freeze(personalPluginIds.sort(compareCodeUnits)),
          registrations: Object.freeze(registrations),
        }),
      );
    });

  const scaffold = (request: ScaffoldPluginPackageRequest) =>
    scaffoldLocalPluginPackage(request, {
      workspaceRoot,
    });

  return Object.freeze({ add, disable, enable, inspect, loadEnabled, remove, scaffold });
}
