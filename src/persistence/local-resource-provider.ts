import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, opendir, realpath, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { failure, type Diagnostic, type Result, success } from "../core/result.ts";
import { inspectExactRecord } from "../core/runtime.ts";
import {
  type EnumerateResourcesRequest,
  isReservedWorkspaceResourceSegment,
  type LocalCoordinationRequest,
  type LocalCoordinationLease,
  type LocalResourceProvider,
  parseWorkspaceResourceLocator,
  type ReadResourceRequest,
  type ReplacementCommitOutcome,
  type ResourceContents,
  type ResourceContinuationCursor,
  type ResourceEntry,
  type ResourceEnumerationPage,
  type ResourceKind,
  reservedWorkspaceResourceStagePrefix,
  type StagedReplacementHandle,
  type WorkspaceResourceLocator,
  workspaceResourceLocator,
} from "./contracts.ts";

export type LocalResourceFaultPhase =
  | "after-rename"
  | "cleanup"
  | "coordination-claim"
  | "coordination-cleanup"
  | "coordination-reacquire"
  | "coordination-release"
  | "enumerate"
  | "enumeration-directory"
  | "flush"
  | "parent-directory"
  | "read"
  | "removal-after-unlink"
  | "removal-parent-directory-sync"
  | "removal-unlink"
  | "rename"
  | "replacement-after-rename-before-mode"
  | "replacement-parent-creation-sync"
  | "replacement-parent-directory-sync"
  | "replacement-target-file-sync"
  | "write";

export interface LocalResourceFaultContext {
  readonly locator?: WorkspaceResourceLocator;
}

export type LocalResourceFaultInjector = (
  phase: LocalResourceFaultPhase,
  context?: LocalResourceFaultContext,
) => void | Promise<void>;

export interface LocalResourceProviderOptions {
  /** Absolute host configuration. It is never returned through capability results. */
  readonly workspaceRoot: string;
  /** Absolute POSIX-only volatile host location. Windows always uses the per-user default. */
  readonly coordinationRoot?: string;
  readonly faultInjector?: LocalResourceFaultInjector;
  readonly maxCursorBytes?: number;
  readonly maxDepth?: number;
  readonly maxEntriesPerDirectory?: number;
  readonly maxPageSize?: number;
  readonly maxReadBytes?: number;
  readonly maxReplacementBytes?: number;
  readonly staleLockMilliseconds?: number;
}

interface ResolvedResource {
  readonly absolutePath: string;
  readonly locator: WorkspaceResourceLocator;
  readonly stats?: Awaited<ReturnType<typeof lstat>>;
}

interface StagedRecord {
  intendedTargetMode?: number;
  readonly locator: WorkspaceResourceLocator;
  mutationTail: Promise<void>;
  readonly stagePath: string;
  readonly targetPath: string;
  state:
    | "committed"
    | "discarded"
    | "finalization-abandoned"
    | "renamed-pending-finalization"
    | "staged";
  targetFinalizationHandle?: Awaited<ReturnType<typeof open>>;
  targetFileFinalized?: boolean;
  targetModeApplied?: boolean;
}

interface CoordinationOwner {
  readonly createdAt: number;
  readonly pid: number;
  readonly token: string;
}

interface CoordinationLeaseRecord {
  readonly identity: string;
  readonly owner: CoordinationOwner;
  released: boolean;
}

type CoordinationRecoveryPolicy = "proven-dead" | "stale-age";

interface CursorState {
  readonly after: WorkspaceResourceLocator;
  readonly limit: number;
  readonly locator: WorkspaceResourceLocator;
  readonly maxDepth: number;
  readonly maxEntriesPerDirectory: number;
  readonly version: 1;
}

interface WalkState {
  readonly after?: WorkspaceResourceLocator;
  afterSeen: boolean;
  readonly collected: ResourceEntry[];
  stopped: boolean;
  truncatedByDepth: boolean;
}

const processCoordination = new Set<string>();
const liveStagePaths = new Set<string>();
const settledStageMutation = Promise.resolve();
export const localResourceProviderCeilings = Object.freeze({
  maxCursorBytes: 64 * 1024,
  maxDepth: 256,
  maxEntriesPerDirectory: 100_000,
  maxPageSize: 10_000,
  maxReadBytes: 64 * 1024 * 1024,
  maxReplacementBytes: 64 * 1024 * 1024,
  staleLockMilliseconds: 24 * 60 * 60 * 1000,
});

export function allowsCustomLocalCoordinationRoot(platform: NodeJS.Platform): boolean {
  return platform !== "win32";
}

export function shouldSyncLocalCoordinationDirectory(platform: NodeJS.Platform): boolean {
  return platform !== "win32";
}

export function shouldSyncLocalReplacementDirectory(platform: NodeJS.Platform): boolean {
  return platform !== "win32";
}
const defaultMaxReadBytes = 16 * 1024 * 1024;
const defaultMaxReplacementBytes = 16 * 1024 * 1024;
const defaultMaxPageSize = 1000;
const defaultMaxDepth = 64;
const defaultMaxEntriesPerDirectory = 10_000;
const defaultMaxCursorBytes = 16 * 1024;
const defaultStaleLockMilliseconds = 5 * 60 * 1000;
const maximumOwnerBytes = 1024;
const maximumCoordinationReacquisitionAttempts = 8;
const writeChunkBytes = 64 * 1024;
const exactOwnerToken = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const intrinsicTextDecoder = new TextDecoder();
const intrinsicTextEncoder = new TextEncoder();
const intrinsicArrayPush = Array.prototype.push;
const intrinsicArraySlice = Array.prototype.slice;
const intrinsicArraySort = Array.prototype.sort;
const intrinsicDecode = TextDecoder.prototype.decode;
const intrinsicEncode = TextEncoder.prototype.encode;
const intrinsicNormalize = String.prototype.normalize;
const intrinsicStringSlice = String.prototype.slice;
const intrinsicSplit = String.prototype.split;
const intrinsicStartsWith = String.prototype.startsWith;
const intrinsicToLowerCase = String.prototype.toLowerCase;
const intrinsicTest = RegExp.prototype.test;
const intrinsicUint8ArraySlice = Uint8Array.prototype.slice;

function stageTargetIdentity(locator: WorkspaceResourceLocator): string {
  return createHash("sha256").update(locator).digest("hex");
}

function stagePrefix(locator: WorkspaceResourceLocator): string {
  return `${reservedWorkspaceResourceStagePrefix}${stageTargetIdentity(locator)}-`;
}

function diagnostic(code: string, message: string, details?: Diagnostic["details"]): Diagnostic {
  return Object.freeze({ code, message, ...(details === undefined ? {} : { details }) });
}

function providerFailure(operation: string): Diagnostic {
  return diagnostic(
    "resource-provider-failure",
    `Local resource provider failed while attempting to ${operation}`,
    { operation },
  );
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function resourceError(error: unknown, operation: string): Diagnostic {
  const code = errorCode(error);
  if (code === "ENOENT") {
    return diagnostic("resource-missing", "Workspace resource does not exist", { operation });
  }
  if (code === "EACCES" || code === "EPERM") {
    return diagnostic("resource-unreadable", "Workspace resource cannot be accessed", {
      operation,
    });
  }
  return providerFailure(operation);
}

function positiveBound(
  value: unknown,
  maximum: number,
  code: string,
  name: string,
): Result<number> {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum
    ? success(value)
    : failure(
        diagnostic(code, `${name} must be a positive safe integer no greater than ${maximum}`, {
          maximum,
          receivedType: typeof value,
        }),
      );
}

function depthBound(value: unknown, maximum: number): Result<number> {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum
    ? success(value)
    : failure(
        diagnostic(
          "invalid-enumeration-depth",
          `Enumeration depth must be a non-negative safe integer no greater than ${maximum}`,
          { maximum, receivedType: typeof value },
        ),
      );
}

function configuredBound(
  value: number | undefined,
  fallback: number,
  maximum: number,
  name: string,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0 || selected > maximum) {
    throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
  }
  return selected;
}

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayTag = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)?.get;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")?.get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;

function snapshotReplacementBytes(value: unknown, maximum: number): Result<Uint8Array> {
  if (
    typeof value !== "object" ||
    value === null ||
    typedArrayTag === undefined ||
    typedArrayBuffer === undefined ||
    typedArrayByteOffset === undefined ||
    typedArrayByteLength === undefined
  ) {
    return failure(
      diagnostic("invalid-replacement-bytes", "Replacement contents must be a genuine Uint8Array"),
    );
  }
  try {
    if (Reflect.apply(typedArrayTag, value, []) !== "Uint8Array") {
      return failure(
        diagnostic(
          "invalid-replacement-bytes",
          "Replacement contents must be a genuine Uint8Array",
        ),
      );
    }
    const buffer = Reflect.apply(typedArrayBuffer, value, []) as ArrayBufferLike;
    const byteOffset = Reflect.apply(typedArrayByteOffset, value, []) as number;
    const byteLength = Reflect.apply(typedArrayByteLength, value, []) as number;
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new TypeError("invalid length");
    if (byteLength > maximum) {
      return failure(
        diagnostic("replacement-too-large", "Replacement exceeds the configured byte limit", {
          maximum,
        }),
      );
    }
    return success(new Uint8Array(new Uint8Array(buffer, byteOffset, byteLength)));
  } catch {
    return failure(
      diagnostic("invalid-replacement-bytes", "Replacement contents must be a genuine Uint8Array"),
    );
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!(Reflect.apply(intrinsicStartsWith, relative, [`..${path.sep}`]) as boolean) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function locatorSegments(locator: WorkspaceResourceLocator): readonly string[] {
  return locator === "." ? [] : (Reflect.apply(intrinsicSplit, locator, ["/"]) as string[]);
}

function coordinationIdentity(root: string, locator: WorkspaceResourceLocator): string {
  const absoluteResource = path.resolve(root, ...locatorSegments(locator));
  const joined = `${root}\0${absoluteResource}`;
  const normalized = Reflect.apply(intrinsicNormalize, joined, ["NFC"]) as string;
  const lowered = Reflect.apply(intrinsicToLowerCase, normalized, []) as string;
  const conservativeKey = Reflect.apply(intrinsicNormalize, lowered, ["NFC"]) as string;
  return createHash("sha256").update(conservativeKey).digest("hex");
}

function resourceKind(stats: Awaited<ReturnType<typeof lstat>>): ResourceKind {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "link";
  return "other";
}

function notCommitted(...diagnostics: readonly Diagnostic[]): ReplacementCommitOutcome {
  return Object.freeze({ diagnostics, state: "not-committed" });
}

function removalIndeterminate(): ReplacementCommitOutcome {
  return Object.freeze({
    diagnostics: Object.freeze([
      diagnostic(
        "resource-removal-indeterminate",
        "Resource removal happened but durability finalization or acknowledgement failed",
        { commitState: "committed-indeterminate" },
      ),
    ]),
    state: "committed-indeterminate",
  });
}

async function readBoundedFile(absolutePath: string, maximum: number): Promise<Uint8Array> {
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const handle = await open(absolutePath, constants.O_RDONLY | noFollow);
  try {
    const buffer = new Uint8Array(maximum + 1);
    let total = 0;
    while (total < buffer.byteLength) {
      const result = await handle.read(buffer, total, buffer.byteLength - total, null);
      if (result.bytesRead === 0) break;
      total += result.bytesRead;
    }
    if (total > maximum)
      throw Object.assign(new Error("bounded file overflow"), { code: "ETOOLARGE" });
    return Reflect.apply(intrinsicUint8ArraySlice, buffer, [0, total]) as Uint8Array;
  } finally {
    await handle.close();
  }
}

function canonicalOwner(value: unknown): CoordinationOwner | undefined {
  const inspected = inspectExactRecord(
    value,
    [["createdAt", "pid", "token"]],
    "invalid-coordination-owner",
    "Coordination owner",
  );
  if (!inspected.ok) return undefined;
  const { createdAt, pid, token } = inspected.value;
  if (
    typeof createdAt !== "number" ||
    !Number.isSafeInteger(createdAt) ||
    createdAt < 0 ||
    typeof pid !== "number" ||
    !Number.isSafeInteger(pid) ||
    pid <= 0 ||
    typeof token !== "string" ||
    !(Reflect.apply(intrinsicTest, exactOwnerToken, [token]) as boolean)
  ) {
    return undefined;
  }
  return { createdAt, pid, token };
}

function ownerIsDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return errorCode(error) === "ESRCH";
  }
}

export async function createLocalResourceProvider(
  options: LocalResourceProviderOptions,
): Promise<LocalResourceProvider> {
  if (
    options.coordinationRoot !== undefined &&
    !allowsCustomLocalCoordinationRoot(process.platform)
  ) {
    throw new TypeError("Windows local coordination does not accept a custom root");
  }
  if (typeof options.workspaceRoot !== "string" || !path.isAbsolute(options.workspaceRoot)) {
    throw new TypeError("workspaceRoot must be an absolute host path");
  }
  if (
    options.coordinationRoot !== undefined &&
    (typeof options.coordinationRoot !== "string" || !path.isAbsolute(options.coordinationRoot))
  ) {
    throw new TypeError("coordinationRoot must be an absolute host path");
  }
  const canonicalRoot = await realpath(options.workspaceRoot);
  const rootStats = await lstat(canonicalRoot);
  if (!rootStats.isDirectory()) throw new TypeError("workspaceRoot must identify a directory");
  const userSuffix = process.platform === "win32" ? "user" : String(process.getuid?.() ?? "user");
  const requestedCoordinationRoot =
    options.coordinationRoot ?? path.join(tmpdir(), `groma-resource-locks-v1-${userSuffix}`);
  const canonicalCoordinationParent = await realpath(path.dirname(requestedCoordinationRoot));
  const preflightCoordinationRoot = path.resolve(
    canonicalCoordinationParent,
    path.basename(requestedCoordinationRoot),
  );
  if (isWithin(canonicalRoot, preflightCoordinationRoot)) {
    throw new TypeError("coordinationRoot must be a directory outside the canonical workspace");
  }
  let coordinationRootExisted = false;
  try {
    const existing = await lstat(requestedCoordinationRoot);
    coordinationRootExisted = true;
    if (existing.isSymbolicLink()) {
      throw new TypeError("coordinationRoot must not be a symbolic link or junction");
    }
  } catch (error) {
    if (error instanceof TypeError) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
  await mkdir(requestedCoordinationRoot, { mode: 0o700, recursive: true });
  let coordinationStats = await lstat(requestedCoordinationRoot);
  if (coordinationStats.isSymbolicLink() || !coordinationStats.isDirectory()) {
    throw new TypeError("coordinationRoot must be a non-link directory");
  }
  if (process.platform !== "win32") {
    if (!coordinationRootExisted || options.coordinationRoot === undefined) {
      await chmod(requestedCoordinationRoot, 0o700);
      coordinationStats = await lstat(requestedCoordinationRoot);
      if (coordinationStats.isSymbolicLink() || !coordinationStats.isDirectory()) {
        throw new TypeError("coordinationRoot must be a non-link directory");
      }
    }
    const currentUser = process.getuid?.();
    if (currentUser === undefined || coordinationStats.uid !== currentUser) {
      throw new TypeError("coordinationRoot must be owned by the current user");
    }
    if ((coordinationStats.mode & 0o077) !== 0) {
      throw new TypeError("coordinationRoot must not grant group or other permissions");
    }
    if ((coordinationStats.mode & 0o300) !== 0o300) {
      throw new TypeError("coordinationRoot must grant owner write and search permissions");
    }
  }
  const coordinationRoot = await realpath(requestedCoordinationRoot);
  if (isWithin(canonicalRoot, coordinationRoot)) {
    throw new TypeError("coordinationRoot must be a directory outside the canonical workspace");
  }
  return new BunLocalResourceProvider(canonicalRoot, coordinationRoot, options);
}

class BunLocalResourceProvider implements LocalResourceProvider {
  readonly #coordinationRoot: string;
  readonly #faultInjector: LocalResourceFaultInjector | undefined;
  readonly #maxCursorBytes: number;
  readonly #maxDepth: number;
  readonly #maxEntriesPerDirectory: number;
  readonly #maxPageSize: number;
  readonly #maxReadBytes: number;
  readonly #maxReplacementBytes: number;
  readonly #root: string;
  readonly #leases = new WeakMap<object, CoordinationLeaseRecord>();
  readonly #stages = new WeakMap<object, StagedRecord>();
  readonly #staleLockMilliseconds: number;

  constructor(root: string, coordinationRoot: string, options: LocalResourceProviderOptions) {
    this.#root = root;
    this.#coordinationRoot = coordinationRoot;
    this.#faultInjector = options.faultInjector;
    this.#maxCursorBytes = configuredBound(
      options.maxCursorBytes,
      defaultMaxCursorBytes,
      localResourceProviderCeilings.maxCursorBytes,
      "maxCursorBytes",
    );
    this.#maxDepth = configuredBound(
      options.maxDepth,
      defaultMaxDepth,
      localResourceProviderCeilings.maxDepth,
      "maxDepth",
    );
    this.#maxEntriesPerDirectory = configuredBound(
      options.maxEntriesPerDirectory,
      defaultMaxEntriesPerDirectory,
      localResourceProviderCeilings.maxEntriesPerDirectory,
      "maxEntriesPerDirectory",
    );
    this.#maxPageSize = configuredBound(
      options.maxPageSize,
      defaultMaxPageSize,
      localResourceProviderCeilings.maxPageSize,
      "maxPageSize",
    );
    this.#maxReadBytes = configuredBound(
      options.maxReadBytes,
      defaultMaxReadBytes,
      localResourceProviderCeilings.maxReadBytes,
      "maxReadBytes",
    );
    this.#maxReplacementBytes = configuredBound(
      options.maxReplacementBytes,
      defaultMaxReplacementBytes,
      localResourceProviderCeilings.maxReplacementBytes,
      "maxReplacementBytes",
    );
    this.#staleLockMilliseconds = configuredBound(
      options.staleLockMilliseconds,
      defaultStaleLockMilliseconds,
      localResourceProviderCeilings.staleLockMilliseconds,
      "staleLockMilliseconds",
    );
  }

  async read(request: ReadResourceRequest): Promise<Result<ResourceContents>> {
    const inspected = inspectExactRecord(
      request,
      [["locator", "maxBytes"]],
      "invalid-read-request",
      "Resource read request",
    );
    if (!inspected.ok) return inspected;
    const locator = parseWorkspaceResourceLocator(inspected.value.locator);
    if (!locator.ok) return locator;
    const maxBytes = positiveBound(
      inspected.value.maxBytes,
      this.#maxReadBytes,
      "invalid-read-byte-limit",
      "Read byte limit",
    );
    if (!maxBytes.ok) return maxBytes;

    try {
      await this.#inject("read");
      const resolved = await this.#resolve(locator.value, false);
      if (!resolved.ok) return resolved;
      if (resolved.value.stats?.isSymbolicLink() || !resolved.value.stats?.isFile()) {
        return failure(
          diagnostic(
            "resource-unsupported-kind",
            "Resource reads require a regular file and do not follow links",
          ),
        );
      }
      const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
      const handle = await open(resolved.value.absolutePath, constants.O_RDONLY | noFollow);
      try {
        const openedStats = await handle.stat();
        if (!openedStats.isFile()) {
          return failure(
            diagnostic("resource-unsupported-kind", "Resource changed to an unsupported kind"),
          );
        }
        if (openedStats.size > maxBytes.value) {
          return failure(
            diagnostic(
              "resource-too-large",
              "Workspace resource exceeds the requested byte limit",
              { maximum: maxBytes.value },
            ),
          );
        }
        // The probe byte detects growth after stat without silently returning truncated contents.
        const buffer = new Uint8Array(maxBytes.value + 1);
        let total = 0;
        while (total < buffer.byteLength) {
          const result = await handle.read(buffer, total, buffer.byteLength - total, null);
          if (result.bytesRead === 0) break;
          total += result.bytesRead;
        }
        if (total > maxBytes.value) {
          return failure(
            diagnostic(
              "resource-too-large",
              "Workspace resource exceeds the requested byte limit",
              {
                maximum: maxBytes.value,
              },
            ),
          );
        }
        const verified = await this.#resolve(locator.value, false);
        if (
          !verified.ok ||
          verified.value.stats === undefined ||
          verified.value.stats.dev !== openedStats.dev ||
          verified.value.stats.ino !== openedStats.ino
        ) {
          return failure(
            diagnostic(
              "resource-provider-failure",
              "Workspace resource changed while its confined read was in progress",
              { operation: "read" },
            ),
          );
        }
        const bytes = Reflect.apply(intrinsicUint8ArraySlice, buffer, [0, total]) as Uint8Array;
        return success(Object.freeze({ bytes }));
      } finally {
        await handle.close();
      }
    } catch (error) {
      return failure(resourceError(error, "read a resource"));
    }
  }

  async enumerate(request: EnumerateResourcesRequest): Promise<Result<ResourceEnumerationPage>> {
    const inspected = inspectExactRecord(
      request,
      [
        ["limit", "locator", "maxDepth", "maxEntriesPerDirectory"],
        ["cursor", "limit", "locator", "maxDepth", "maxEntriesPerDirectory"],
      ],
      "invalid-enumeration-request",
      "Resource enumeration request",
    );
    if (!inspected.ok) return inspected;
    const locator = parseWorkspaceResourceLocator(inspected.value.locator);
    if (!locator.ok) return locator;
    const limit = positiveBound(
      inspected.value.limit,
      this.#maxPageSize,
      "invalid-enumeration-limit",
      "Enumeration page limit",
    );
    if (!limit.ok) return limit;
    const maxDepth = depthBound(inspected.value.maxDepth, this.#maxDepth);
    if (!maxDepth.ok) return maxDepth;
    const directoryLimit = positiveBound(
      inspected.value.maxEntriesPerDirectory,
      this.#maxEntriesPerDirectory,
      "invalid-directory-entry-limit",
      "Per-directory entry limit",
    );
    if (!directoryLimit.ok) return directoryLimit;

    let after: WorkspaceResourceLocator | undefined;
    if ("cursor" in inspected.value) {
      const decoded = this.#decodeCursor(inspected.value.cursor);
      if (!decoded.ok) return decoded;
      if (
        decoded.value.locator !== locator.value ||
        decoded.value.limit !== limit.value ||
        decoded.value.maxDepth !== maxDepth.value ||
        decoded.value.maxEntriesPerDirectory !== directoryLimit.value
      ) {
        return failure(
          diagnostic(
            "cursor-request-mismatch",
            "Resource continuation cursor belongs to a different enumeration request",
          ),
        );
      }
      after = decoded.value.after;
    }

    try {
      await this.#inject("enumerate");
      const base = await this.#resolve(locator.value, false);
      if (!base.ok) return base;
      if (base.value.stats?.isSymbolicLink() || !base.value.stats?.isDirectory()) {
        return failure(
          diagnostic(
            "resource-unsupported-kind",
            "Resource enumeration requires a directory and does not follow links",
          ),
        );
      }
      const state: WalkState = {
        ...(after === undefined ? {} : { after }),
        afterSeen: after === undefined,
        collected: [],
        stopped: false,
        truncatedByDepth: false,
      };
      const walked = await this.#walkDirectory(
        base.value.absolutePath,
        locator.value,
        0,
        maxDepth.value,
        directoryLimit.value,
        limit.value,
        state,
      );
      if (!walked.ok) return walked;
      if (!state.afterSeen) {
        return failure(
          diagnostic(
            "stale-resource-cursor",
            "Resource continuation anchor is no longer present in the enumeration",
          ),
        );
      }
      const hasMore = state.collected.length > limit.value;
      const entries = Reflect.apply(intrinsicArraySlice, state.collected, [
        0,
        limit.value,
      ]) as ResourceEntry[];
      let nextCursor: ResourceContinuationCursor | undefined;
      if (hasMore) {
        const anchor = entries[entries.length - 1]?.locator;
        if (anchor === undefined) {
          return failure(providerFailure("create an enumeration continuation"));
        }
        const encoded = this.#encodeCursor({
          after: anchor,
          limit: limit.value,
          locator: locator.value,
          maxDepth: maxDepth.value,
          maxEntriesPerDirectory: directoryLimit.value,
          version: 1,
        });
        if (!encoded.ok) return encoded;
        nextCursor = encoded.value;
      }
      return success(
        Object.freeze({
          entries: Object.freeze(entries),
          ...(nextCursor === undefined ? {} : { nextCursor }),
          truncatedByDepth: state.truncatedByDepth,
        }),
      );
    } catch (error) {
      return failure(resourceError(error, "enumerate resources"));
    }
  }

  async stageReplacement(
    locatorInput: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Promise<Result<StagedReplacementHandle>> {
    const locator = parseWorkspaceResourceLocator(locatorInput);
    if (!locator.ok) return locator;
    if (locator.value === ".") {
      return failure(
        diagnostic("invalid-replacement-target", "The workspace root cannot be replaced"),
      );
    }
    const snapshot = snapshotReplacementBytes(bytes, this.#maxReplacementBytes);
    if (!snapshot.ok) return snapshot;
    const copied = snapshot.value;
    let stagePath: string | undefined;
    try {
      const parents = await this.#ensureParentDirectories(locator.value);
      if (!parents.ok) return parents;
      const target = await this.#resolve(locator.value, true);
      if (!target.ok) return target;
      if (target.value.stats !== undefined && !target.value.stats.isFile()) {
        return failure(
          diagnostic(
            "resource-unsupported-kind",
            "Replacement targets must be missing or regular files and must not be links",
          ),
        );
      }
      const parentPath = path.dirname(target.value.absolutePath);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = path.join(
          parentPath,
          `${stagePrefix(locator.value)}${process.pid}-${randomUUID()}`,
        );
        try {
          const handle = await open(candidate, "wx", 0o600);
          stagePath = candidate;
          liveStagePaths.add(candidate);
          try {
            let offset = 0;
            let writeBoundaryInjected = false;
            while (offset < copied.byteLength) {
              const length = Math.min(writeChunkBytes, copied.byteLength - offset);
              const result = await handle.write(copied, offset, length, null);
              if (result.bytesWritten <= 0) throw new Error("replacement write did not advance");
              offset += result.bytesWritten;
              if (!writeBoundaryInjected) {
                writeBoundaryInjected = true;
                await this.#inject("write", locator.value);
              }
            }
            if (!writeBoundaryInjected) await this.#inject("write", locator.value);
            await handle.chmod(0o600);
            await this.#inject("flush", locator.value);
            await handle.sync();
          } finally {
            await handle.close();
          }
          break;
        } catch (error) {
          if (errorCode(error) === "EEXIST") continue;
          throw error;
        }
      }
      if (stagePath === undefined) throw new Error("could not allocate an exclusive stage");
      const handle = Object.freeze(Object.create(null)) as StagedReplacementHandle;
      this.#stages.set(handle as object, {
        locator: locator.value,
        mutationTail: settledStageMutation,
        stagePath,
        state: "staged",
        targetPath: target.value.absolutePath,
      });
      return success(handle);
    } catch {
      if (stagePath !== undefined) {
        liveStagePaths.delete(stagePath);
        await this.#cleanupPath(stagePath);
      }
      return failure(
        diagnostic("replacement-stage-failed", "Replacement could not be staged completely", {
          commitState: "not-committed",
        }),
      );
    }
  }

  async commitReplacement(handle: StagedReplacementHandle): Promise<ReplacementCommitOutcome> {
    if (typeof handle !== "object" || handle === null) {
      return notCommitted(
        diagnostic(
          "invalid-replacement-handle",
          "Replacement handle is not owned by this provider",
        ),
      );
    }
    const record = this.#stages.get(handle as object);
    if (record === undefined) {
      return notCommitted(
        diagnostic(
          "invalid-replacement-handle",
          "Replacement handle is not owned by this provider",
        ),
      );
    }
    return this.#serializeStageMutation(record, () => this.#commitReplacementRecord(record));
  }

  async #commitReplacementRecord(record: StagedRecord): Promise<ReplacementCommitOutcome> {
    if (record.state === "committed") return Object.freeze({ state: "committed" });
    if (record.state === "finalization-abandoned") {
      return Object.freeze({
        diagnostics: Object.freeze([
          diagnostic(
            "replacement-finalization-abandoned",
            "Replacement was renamed and its durability finalization was explicitly abandoned",
            { commitState: "committed-indeterminate" },
          ),
        ]),
        state: "committed-indeterminate",
      });
    }
    if (record.state === "discarded") {
      return notCommitted(
        diagnostic("replacement-discarded", "Replacement handle has already been discarded"),
      );
    }
    if (record.state === "staged") {
      try {
        const target = await this.#resolve(record.locator, true);
        if (!target.ok) return notCommitted(...target.diagnostics);
        if (target.value.absolutePath !== record.targetPath) {
          return notCommitted(providerFailure("validate a replacement target"));
        }
        if (target.value.stats !== undefined && !target.value.stats.isFile()) {
          return notCommitted(
            diagnostic(
              "resource-unsupported-kind",
              "Replacement target changed to an unsupported kind",
            ),
          );
        }
        const targetMode =
          target.value.stats === undefined
            ? 0o666 & ~process.umask()
            : typeof target.value.stats.mode === "bigint"
              ? Number(target.value.stats.mode & 0o777n)
              : target.value.stats.mode & 0o777;
        await this.#inject("rename", record.locator);
        record.intendedTargetMode = targetMode;
        await rename(record.stagePath, record.targetPath);
        liveStagePaths.delete(record.stagePath);
        record.state = "renamed-pending-finalization";
      } catch (error) {
        return notCommitted(resourceError(error, "commit a staged replacement"));
      }
    }
    try {
      if (record.intendedTargetMode === undefined) {
        throw new Error("replacement target mode was not recorded before rename");
      }
      if (record.targetFileFinalized !== true) {
        if (record.targetModeApplied !== true) {
          await this.#inject("replacement-after-rename-before-mode", record.locator);
        }
        await this.#finalizeReplacementTarget(record, record.intendedTargetMode);
      }
      await this.#syncReplacementDirectory(
        path.dirname(record.targetPath),
        "replacement-parent-directory-sync",
        record.locator,
      );
      await this.#inject("after-rename", record.locator);
      record.state = "committed";
      return Object.freeze({ state: "committed" });
    } catch {
      return Object.freeze({
        diagnostics: Object.freeze([
          diagnostic(
            "replacement-commit-indeterminate",
            "Replacement was renamed but durability finalization or acknowledgement failed",
            { commitState: "committed-indeterminate" },
          ),
        ]),
        state: "committed-indeterminate",
      });
    }
  }

  async #finalizeReplacementTarget(record: StagedRecord, mode: number): Promise<void> {
    let handle = record.targetFinalizationHandle;
    if (handle === undefined) {
      const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
      handle = await open(record.targetPath, constants.O_RDWR | noFollow);
      try {
        const stats = await handle.stat();
        if (!stats.isFile()) throw new Error("replacement target is not a regular file");
        record.targetFinalizationHandle = handle;
      } catch (error) {
        await handle.close();
        throw error;
      }
    }
    if (record.targetModeApplied !== true) {
      await handle.chmod(mode);
      record.targetModeApplied = true;
    }
    await this.#inject("replacement-target-file-sync", record.locator);
    await handle.sync();
    record.targetFileFinalized = true;
    delete record.targetFinalizationHandle;
    await handle.close();
  }

  async #syncReplacementDirectory(
    directoryPath: string,
    phase: "replacement-parent-creation-sync" | "replacement-parent-directory-sync",
    locator: WorkspaceResourceLocator,
  ): Promise<void> {
    if (!shouldSyncLocalReplacementDirectory(process.platform)) return;
    await this.#inject(phase, locator);
    const handle = await open(
      directoryPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async discardReplacement(handle: StagedReplacementHandle): Promise<Result<void>> {
    if (typeof handle !== "object" || handle === null) {
      return failure(
        diagnostic(
          "invalid-replacement-handle",
          "Replacement handle is not owned by this provider",
        ),
      );
    }
    const record = this.#stages.get(handle as object);
    if (record === undefined) {
      return failure(
        diagnostic(
          "invalid-replacement-handle",
          "Replacement handle is not owned by this provider",
        ),
      );
    }
    return this.#serializeStageMutation(record, () => this.#discardReplacementRecord(record));
  }

  async #discardReplacementRecord(record: StagedRecord): Promise<Result<void>> {
    if (record.state === "renamed-pending-finalization") {
      const retained = record.targetFinalizationHandle;
      if (retained !== undefined) {
        try {
          await retained.close();
        } catch (error) {
          return failure(resourceError(error, "abandon replacement finalization"));
        }
        delete record.targetFinalizationHandle;
      }
      record.state = "finalization-abandoned";
      return success(undefined);
    }
    if (record.state !== "staged") return success(undefined);
    const cleanup = await this.#cleanupPath(record.stagePath);
    if (cleanup.ok) {
      liveStagePaths.delete(record.stagePath);
      record.state = "discarded";
    }
    return cleanup;
  }

  async cleanupReplacementStages(locatorInput: WorkspaceResourceLocator): Promise<Result<void>> {
    const locator = parseWorkspaceResourceLocator(locatorInput);
    if (!locator.ok) return locator;
    if (locator.value === ".") {
      return failure(
        diagnostic("invalid-replacement-target", "The workspace root has no replacement stages"),
      );
    }
    const target = await this.#resolve(locator.value, true);
    if (!target.ok) return target;
    const parentPath = path.dirname(target.value.absolutePath);
    const prefix = stagePrefix(locator.value);
    try {
      const directory = await opendir(parentPath);
      let encountered = 0;
      try {
        while (true) {
          const entry = await directory.read();
          if (entry === null) break;
          encountered += 1;
          if (encountered > this.#maxEntriesPerDirectory) {
            return failure(
              diagnostic(
                "resource-directory-overflow",
                "Replacement-stage cleanup exceeded its explicit directory-entry bound",
                { maximum: this.#maxEntriesPerDirectory },
              ),
            );
          }
          if (!entry.isFile() || !entry.name.startsWith(prefix)) continue;
          const candidate = path.join(parentPath, entry.name);
          if (liveStagePaths.has(candidate)) continue;
          const suffix = entry.name.slice(prefix.length);
          const separator = suffix.indexOf("-");
          const ownerPid = separator < 1 ? Number.NaN : Number(suffix.slice(0, separator));
          // Malformed ownership and a reused live PID are retained rather than risking deletion
          // of another process's active stage. A later bounded cleanup can retry.
          if (!Number.isSafeInteger(ownerPid) || ownerPid <= 0 || !ownerIsDead(ownerPid)) continue;
          const cleanup = await this.#cleanupPath(candidate);
          if (!cleanup.ok) return cleanup;
        }
      } finally {
        try {
          await directory.close();
        } catch {
          // Bun closes a directory after the terminal read.
        }
      }
      return success(undefined);
    } catch (error) {
      return failure(resourceError(error, "clean up orphaned replacement stages"));
    }
  }

  async removeResource(locatorInput: WorkspaceResourceLocator): Promise<ReplacementCommitOutcome> {
    const locator = parseWorkspaceResourceLocator(locatorInput);
    if (!locator.ok) return notCommitted(...locator.diagnostics);
    if (locator.value === ".") {
      return notCommitted(
        diagnostic("invalid-removal-target", "The workspace root cannot be removed"),
      );
    }
    let targetPath: string;
    try {
      const target = await this.#resolve(locator.value, true);
      if (!target.ok) return notCommitted(...target.diagnostics);
      targetPath = target.value.absolutePath;
      if (target.value.stats === undefined) {
        try {
          await this.#finalizeRemovedTarget(path.dirname(targetPath), locator.value);
          return Object.freeze({ state: "committed" });
        } catch {
          return removalIndeterminate();
        }
      }
      if (target.value.stats.isSymbolicLink() || !target.value.stats.isFile()) {
        return notCommitted(
          diagnostic(
            "resource-unsupported-kind",
            "Removal targets must be missing or regular files and must not be links",
          ),
        );
      }
      await this.#inject("removal-unlink", locator.value);
      await rm(targetPath);
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        try {
          await this.#finalizeRemovedTarget(path.dirname(targetPath!), locator.value);
          return Object.freeze({ state: "committed" });
        } catch {
          return removalIndeterminate();
        }
      }
      return notCommitted(resourceError(error, "remove a resource"));
    }
    try {
      await this.#finalizeRemovedTarget(path.dirname(targetPath), locator.value);
      return Object.freeze({ state: "committed" });
    } catch {
      return removalIndeterminate();
    }
  }

  async #finalizeRemovedTarget(
    directoryPath: string,
    locator: WorkspaceResourceLocator,
  ): Promise<void> {
    await this.#finalizeRemovalDirectory(directoryPath, locator);
    await this.#inject("removal-after-unlink", locator);
  }

  async #finalizeRemovalDirectory(
    directoryPath: string,
    locator: WorkspaceResourceLocator,
  ): Promise<void> {
    if (!shouldSyncLocalReplacementDirectory(process.platform)) return;
    await this.#inject("removal-parent-directory-sync", locator);
    const directory = await open(
      directoryPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }

  async #serializeStageMutation<T>(record: StagedRecord, operation: () => Promise<T>): Promise<T> {
    const predecessor = record.mutationTail;
    let settle!: () => void;
    const current = new Promise<void>((resolve) => {
      settle = resolve;
    });
    record.mutationTail = current;
    try {
      await predecessor;
      return await operation();
    } finally {
      settle();
      if (record.mutationTail === current) record.mutationTail = settledStageMutation;
    }
  }

  async withCoordination<T>(
    request: LocalCoordinationRequest,
    action: () => T | Promise<T>,
  ): Promise<Result<T>> {
    if (typeof action !== "function") {
      return failure(
        diagnostic("invalid-coordination-action", "Coordination action must be callable"),
      );
    }
    const acquired = await this.#acquireCoordinationLease(request, "stale-age");
    if (!acquired.ok) return acquired;
    let actionResult: Result<T>;
    let actionCompleted = false;
    try {
      actionResult = success(await action());
      actionCompleted = true;
    } catch {
      actionResult = failure(
        diagnostic("coordination-action-failed", "The coordinated action failed"),
      );
    }
    const released = await this.releaseCoordination(acquired.value);
    if (released.ok) return actionResult;
    const releaseFailure = diagnostic(
      "coordination-release-failed",
      "Local coordination could not be released cleanly",
      { actionCompleted },
    );
    return actionResult.ok
      ? failure(releaseFailure, ...released.diagnostics)
      : failure(...actionResult.diagnostics, releaseFailure, ...released.diagnostics);
  }

  async acquireCoordination(
    request: LocalCoordinationRequest,
  ): Promise<Result<LocalCoordinationLease>> {
    return this.#acquireCoordinationLease(request, "proven-dead");
  }

  async #acquireCoordinationLease(
    request: LocalCoordinationRequest,
    recoveryPolicy: CoordinationRecoveryPolicy,
  ): Promise<Result<LocalCoordinationLease>> {
    const inspected = inspectExactRecord(
      request,
      [["context", "locator"]],
      "invalid-coordination-request",
      "Local coordination request",
    );
    if (!inspected.ok) return inspected;
    const locator = parseWorkspaceResourceLocator(inspected.value.locator);
    if (!locator.ok) return locator;
    if (inspected.value.context !== "local-machine") {
      if (
        inspected.value.context === "multi-host" ||
        inspected.value.context === "shared-filesystem"
      ) {
        return failure(
          diagnostic(
            "unsupported-coordination-context",
            "The local provider supports coordination only between processes on one machine",
          ),
        );
      }
      return failure(
        diagnostic("invalid-coordination-context", "Coordination context is not recognized"),
      );
    }
    const identity = coordinationIdentity(this.#root, locator.value);
    if (processCoordination.has(identity)) {
      return failure(
        diagnostic(
          "resource-coordination-contended",
          "Local resource coordination is already held",
        ),
      );
    }
    processCoordination.add(identity);
    try {
      const acquired = await this.#acquireCoordination(identity, recoveryPolicy);
      if (!acquired.ok) {
        processCoordination.delete(identity);
        return acquired;
      }
      const lease = Object.freeze(Object.create(null)) as LocalCoordinationLease;
      this.#leases.set(lease as object, {
        identity,
        owner: acquired.value,
        released: false,
      });
      return success(lease);
    } catch (error) {
      processCoordination.delete(identity);
      return failure(resourceError(error, "acquire local coordination"));
    }
  }

  async releaseCoordination(lease: LocalCoordinationLease): Promise<Result<void>> {
    if (typeof lease !== "object" || lease === null) {
      return failure(
        diagnostic(
          "invalid-coordination-lease",
          "Coordination lease is not owned by this provider",
        ),
      );
    }
    const record = this.#leases.get(lease as object);
    if (record === undefined) {
      return failure(
        diagnostic(
          "invalid-coordination-lease",
          "Coordination lease is not owned by this provider",
        ),
      );
    }
    if (record.released) return success(undefined);
    try {
      const released = await this.#releaseCoordination(record.identity, record.owner);
      if (!released.ok) return released;
      record.released = true;
      return success(undefined);
    } finally {
      processCoordination.delete(record.identity);
    }
  }

  async #resolve(
    locator: WorkspaceResourceLocator,
    allowMissingFinal: boolean,
  ): Promise<Result<ResolvedResource>> {
    const parsed = parseWorkspaceResourceLocator(locator);
    if (!parsed.ok) return parsed;
    const segments = locatorSegments(parsed.value);
    const absolutePath = path.resolve(this.#root, ...segments);
    if (!isWithin(this.#root, absolutePath)) {
      return failure(
        diagnostic(
          "resource-outside-workspace",
          "Resource resolution escaped the workspace boundary",
        ),
      );
    }
    if (segments.length === 0) {
      return success({
        absolutePath: this.#root,
        locator: parsed.value,
        stats: await lstat(this.#root),
      });
    }
    let current = this.#root;
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]!);
      let stats: Awaited<ReturnType<typeof lstat>>;
      try {
        stats = await lstat(current);
      } catch (error) {
        if (allowMissingFinal && index === segments.length - 1 && errorCode(error) === "ENOENT") {
          const parentReal = await realpath(path.dirname(current));
          if (!isWithin(this.#root, parentReal)) {
            return failure(
              diagnostic(
                "resource-outside-workspace",
                "Resource parent resolved outside the workspace boundary",
              ),
            );
          }
          return success({ absolutePath, locator: parsed.value });
        }
        return failure(resourceError(error, "resolve a resource"));
      }
      if (stats.isSymbolicLink()) {
        return failure(
          diagnostic(
            "resource-unsupported-kind",
            "Workspace resource paths must not contain symbolic links or junctions",
          ),
        );
      }
      if (index < segments.length - 1 && !stats.isDirectory()) {
        return failure(
          diagnostic("resource-unsupported-kind", "A resource parent is not a directory"),
        );
      }
      const canonical = await realpath(current);
      if (!isWithin(this.#root, canonical)) {
        return failure(
          diagnostic(
            "resource-outside-workspace",
            "Resource resolved outside the workspace boundary",
          ),
        );
      }
      if (index === segments.length - 1) {
        return success({ absolutePath, locator: parsed.value, stats });
      }
    }
    return failure(providerFailure("resolve a resource"));
  }

  async #ensureParentDirectories(locator: WorkspaceResourceLocator): Promise<Result<void>> {
    const segments = locatorSegments(locator);
    let current = this.#root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      current = path.join(current, segments[index]!);
      let created = false;
      try {
        await mkdir(current);
        created = true;
      } catch (error) {
        if (errorCode(error) !== "EEXIST") {
          return failure(resourceError(error, "create a resource parent directory"));
        }
      }
      await this.#inject("parent-directory");
      let stats: Awaited<ReturnType<typeof lstat>>;
      try {
        stats = await lstat(current);
      } catch (error) {
        return failure(resourceError(error, "validate a resource parent directory"));
      }
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return failure(
          diagnostic(
            "resource-unsupported-kind",
            "Replacement parent paths must be directories and must not be links",
          ),
        );
      }
      if (created && process.platform !== "win32") {
        const actualMode = stats.mode & 0o7777;
        const usableMode = actualMode | 0o700;
        if (usableMode !== actualMode) {
          try {
            await chmod(current, usableMode);
            stats = await lstat(current);
          } catch (error) {
            return failure(resourceError(error, "make a resource parent directory usable"));
          }
          if (stats.isSymbolicLink() || !stats.isDirectory()) {
            return failure(
              diagnostic(
                "resource-unsupported-kind",
                "Replacement parent paths must be directories and must not be links",
              ),
            );
          }
        }
      }
      let canonical: string;
      try {
        canonical = await realpath(current);
      } catch (error) {
        return failure(resourceError(error, "validate a resource parent directory"));
      }
      if (!isWithin(this.#root, canonical)) {
        return failure(
          diagnostic(
            "resource-outside-workspace",
            "Replacement parent resolved outside the workspace boundary",
          ),
        );
      }
      await this.#syncReplacementDirectory(
        path.dirname(current),
        "replacement-parent-creation-sync",
        locator,
      );
    }
    return success(undefined);
  }

  async #walkDirectory(
    absoluteDirectory: string,
    directoryLocator: WorkspaceResourceLocator,
    depth: number,
    maxDepth: number,
    directoryLimit: number,
    pageLimit: number,
    state: WalkState,
  ): Promise<Result<void>> {
    if (state.stopped) return success(undefined);
    const revalidated = await this.#revalidateEnumerationDirectory(
      absoluteDirectory,
      directoryLocator,
    );
    if (!revalidated.ok) return revalidated;
    const dir = await opendir(revalidated.value);
    const names: string[] = [];
    let encountered = 0;
    try {
      while (true) {
        const entry = await dir.read();
        if (entry === null) break;
        encountered += 1;
        if (encountered > directoryLimit) {
          return failure(
            diagnostic(
              "resource-directory-overflow",
              "A directory exceeds the explicit enumeration entry bound",
              { maximum: directoryLimit },
            ),
          );
        }
        if (!isReservedWorkspaceResourceSegment(entry.name)) {
          Reflect.apply(intrinsicArrayPush, names, [entry.name]);
        }
      }
    } finally {
      try {
        await dir.close();
      } catch {
        // Bun closes a Dir after the terminal read; explicit close remains portable cleanup.
      }
    }
    Reflect.apply(intrinsicArraySort, names, [
      (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0),
    ]);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index]!;
      const locatorResult =
        directoryLocator === "."
          ? workspaceResourceLocator(name)
          : parseWorkspaceResourceLocator(`${directoryLocator}/${name}`);
      if (!locatorResult.ok) {
        return failure(
          diagnostic(
            "unsupported-resource-name",
            "A directory contains a name that cannot be represented by a portable locator",
          ),
        );
      }
      const childPath = path.join(absoluteDirectory, name);
      let stats: Awaited<ReturnType<typeof lstat>>;
      try {
        stats = await lstat(childPath);
      } catch (error) {
        return failure(resourceError(error, "inspect an enumerated resource"));
      }
      const kind = resourceKind(stats);
      const entry: ResourceEntry = Object.freeze({
        kind,
        locator: locatorResult.value,
        ...(kind === "file" && Number.isSafeInteger(stats.size) ? { size: stats.size } : {}),
      });
      let traverseDirectory = kind === "directory";
      if (!state.afterSeen) {
        if (entry.locator === state.after) {
          state.afterSeen = true;
        } else {
          traverseDirectory =
            kind === "directory" &&
            state.after !== undefined &&
            (Reflect.apply(intrinsicStartsWith, state.after, [`${entry.locator}/`]) as boolean);
        }
      } else {
        Reflect.apply(intrinsicArrayPush, state.collected, [entry]);
        if (state.collected.length > pageLimit) {
          state.stopped = true;
          return success(undefined);
        }
      }
      if (traverseDirectory) {
        if (depth >= maxDepth) {
          state.truncatedByDepth = true;
        } else {
          const nested = await this.#walkDirectory(
            childPath,
            locatorResult.value,
            depth + 1,
            maxDepth,
            directoryLimit,
            pageLimit,
            state,
          );
          if (!nested.ok) return nested;
          if (state.stopped) return success(undefined);
        }
      }
    }
    return success(undefined);
  }

  async #revalidateEnumerationDirectory(
    expectedPath: string,
    locator: WorkspaceResourceLocator,
  ): Promise<Result<string>> {
    await this.#inject("enumeration-directory");
    const resolved = await this.#resolve(locator, false);
    if (!resolved.ok) return resolved;
    if (
      resolved.value.absolutePath !== expectedPath ||
      resolved.value.stats?.isSymbolicLink() ||
      !resolved.value.stats?.isDirectory()
    ) {
      return failure(
        diagnostic(
          "resource-unsupported-kind",
          "Enumerated directories must remain confined non-link directories",
        ),
      );
    }
    return success(resolved.value.absolutePath);
  }

  #encodeCursor(state: CursorState): Result<ResourceContinuationCursor> {
    const serializableState = Object.assign(Object.create(null) as Record<string, unknown>, {
      after: state.after,
      limit: state.limit,
      locator: state.locator,
      maxDepth: state.maxDepth,
      maxEntriesPerDirectory: state.maxEntriesPerDirectory,
      version: state.version,
    });
    const raw = JSON.stringify(serializableState);
    const cursor = `groma-resource-v1.${Buffer.from(raw, "utf8").toString("base64url")}`;
    return Buffer.byteLength(cursor, "utf8") <= this.#maxCursorBytes
      ? success(cursor as ResourceContinuationCursor)
      : failure(
          diagnostic(
            "resource-cursor-overflow",
            "Resource continuation cursor exceeds the provider cursor bound",
            { maximum: this.#maxCursorBytes },
          ),
        );
  }

  #decodeCursor(value: unknown): Result<CursorState> {
    if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > this.#maxCursorBytes) {
      return failure(
        diagnostic("malformed-resource-cursor", "Resource continuation cursor is malformed"),
      );
    }
    const prefix = "groma-resource-v1.";
    if (!(Reflect.apply(intrinsicStartsWith, value, [prefix]) as boolean)) {
      return failure(
        diagnostic(
          "malformed-resource-cursor",
          "Resource continuation cursor has an invalid envelope",
        ),
      );
    }
    try {
      const suffix = Reflect.apply(intrinsicStringSlice, value, [prefix.length]) as string;
      const decoded = Buffer.from(suffix, "base64url").toString("utf8");
      if (Buffer.from(decoded, "utf8").toString("base64url") !== suffix)
        throw new Error("noncanonical");
      const inspected = inspectExactRecord(
        JSON.parse(decoded) as unknown,
        [["after", "limit", "locator", "maxDepth", "maxEntriesPerDirectory", "version"]],
        "malformed-resource-cursor",
        "Resource continuation cursor",
      );
      if (!inspected.ok) return inspected;
      const after = parseWorkspaceResourceLocator(inspected.value.after);
      const locator = parseWorkspaceResourceLocator(inspected.value.locator);
      if (!after.ok || !locator.ok || inspected.value.version !== 1)
        throw new Error("invalid state");
      const limit = positiveBound(
        inspected.value.limit,
        this.#maxPageSize,
        "malformed-resource-cursor",
        "Cursor page limit",
      );
      const maxDepth = depthBound(inspected.value.maxDepth, this.#maxDepth);
      const directoryLimit = positiveBound(
        inspected.value.maxEntriesPerDirectory,
        this.#maxEntriesPerDirectory,
        "malformed-resource-cursor",
        "Cursor directory limit",
      );
      if (!limit.ok || !maxDepth.ok || !directoryLimit.ok) throw new Error("invalid bounds");
      return success({
        after: after.value,
        limit: limit.value,
        locator: locator.value,
        maxDepth: maxDepth.value,
        maxEntriesPerDirectory: directoryLimit.value,
        version: 1,
      });
    } catch {
      return failure(
        diagnostic("malformed-resource-cursor", "Resource continuation cursor cannot be decoded"),
      );
    }
  }

  async #inject(phase: LocalResourceFaultPhase, locator?: WorkspaceResourceLocator): Promise<void> {
    await this.#faultInjector?.(
      phase,
      locator === undefined ? undefined : Object.freeze({ locator }),
    );
  }

  async #cleanupPath(stagePath: string): Promise<Result<void>> {
    let injectedFailure = false;
    try {
      await this.#inject("cleanup");
    } catch {
      injectedFailure = true;
    }
    try {
      await rm(stagePath, { force: true });
    } catch (error) {
      return failure(resourceError(error, "clean up a staged replacement"));
    }
    return injectedFailure
      ? failure(providerFailure("clean up a staged replacement"))
      : success(undefined);
  }

  async #readOwner(artifactPath: string): Promise<CoordinationOwner | undefined> {
    try {
      const artifactStats = await lstat(artifactPath);
      if (artifactStats.isSymbolicLink() || !artifactStats.isDirectory()) return undefined;
      const ownerPath = path.join(artifactPath, "owner.json");
      const stats = await lstat(ownerPath);
      if (!stats.isFile() || stats.isSymbolicLink() || stats.size > maximumOwnerBytes)
        return undefined;
      const bytes = await readBoundedFile(ownerPath, maximumOwnerBytes);
      const decoded = Reflect.apply(intrinsicDecode, intrinsicTextDecoder, [bytes]) as string;
      return canonicalOwner(JSON.parse(decoded) as unknown);
    } catch {
      return undefined;
    }
  }

  async #coordinationPathExists(candidate: string): Promise<boolean> {
    try {
      await lstat(candidate);
      return true;
    } catch (error) {
      if (errorCode(error) === "ENOENT") return false;
      throw error;
    }
  }

  async #publishCoordinationDirectory(
    canonicalPath: string,
    owner: CoordinationOwner,
    injectClaim: boolean,
  ): Promise<Result<void>> {
    const candidatePath = `${canonicalPath}.claim-${owner.token}-${randomUUID()}`;
    try {
      await mkdir(candidatePath, { mode: 0o700 });
      if (process.platform !== "win32") await chmod(candidatePath, 0o700);
      const serializableOwner = Object.assign(Object.create(null) as Record<string, unknown>, {
        createdAt: owner.createdAt,
        pid: owner.pid,
        token: owner.token,
      });
      const encoded = Reflect.apply(intrinsicEncode, intrinsicTextEncoder, [
        JSON.stringify(serializableOwner),
      ]) as Uint8Array;
      const ownerHandle = await open(path.join(candidatePath, "owner.json"), "wx", 0o600);
      try {
        let offset = 0;
        while (offset < encoded.byteLength) {
          const written = await ownerHandle.write(
            encoded,
            offset,
            encoded.byteLength - offset,
            null,
          );
          if (written.bytesWritten <= 0) throw new Error("owner write did not advance");
          offset += written.bytesWritten;
        }
        if (process.platform !== "win32") await ownerHandle.chmod(0o600);
        await ownerHandle.sync();
      } finally {
        await ownerHandle.close();
      }
      if (shouldSyncLocalCoordinationDirectory(process.platform)) {
        const directoryHandle = await open(
          candidatePath,
          constants.O_RDONLY | constants.O_DIRECTORY,
        );
        try {
          await directoryHandle.sync();
        } finally {
          await directoryHandle.close();
        }
      }
      if (injectClaim) await this.#inject("coordination-claim");
      if (await this.#coordinationPathExists(canonicalPath)) {
        await this.#bestEffortCoordinationCleanup(candidatePath);
        return failure(
          diagnostic("resource-coordination-contended", "Local resource coordination is held"),
        );
      }
      await rename(candidatePath, canonicalPath);
      return success(undefined);
    } catch (error) {
      await this.#bestEffortCoordinationCleanup(candidatePath);
      if (
        errorCode(error) === "EEXIST" ||
        errorCode(error) === "ENOTEMPTY" ||
        errorCode(error) === "EACCES" ||
        errorCode(error) === "EPERM"
      ) {
        return failure(
          diagnostic("resource-coordination-contended", "Local resource coordination is held"),
        );
      }
      return failure(resourceError(error, "publish local coordination ownership"));
    }
  }

  async #bestEffortCoordinationCleanup(artifactPath: string): Promise<void> {
    try {
      await this.#inject("coordination-cleanup");
    } catch {
      return;
    }
    await rm(artifactPath, { force: true, recursive: true }).catch(() => undefined);
  }

  async #moveCoordinationDirectory(
    canonicalPath: string,
    owner: CoordinationOwner,
    label: string,
  ): Promise<Result<string>> {
    const current = await this.#readOwner(canonicalPath);
    if (current === undefined || current.token !== owner.token) {
      return failure(
        diagnostic(
          "resource-coordination-ownership-lost",
          "Local coordination ownership could not be verified",
        ),
      );
    }
    const artifactPath = `${canonicalPath}.${label}-${owner.token}-${randomUUID()}`;
    try {
      await rename(canonicalPath, artifactPath);
      return success(artifactPath);
    } catch (error) {
      return failure(resourceError(error, "move local coordination ownership"));
    }
  }

  async #acquireCoordination(
    identity: string,
    recoveryPolicy: CoordinationRecoveryPolicy,
    staleReplacementCount = 0,
  ): Promise<Result<CoordinationOwner>> {
    const lockPath = path.join(this.#coordinationRoot, `${identity}.lock`);
    const reapingPath = path.join(this.#coordinationRoot, `${identity}.reaping`);
    try {
      if (await this.#coordinationPathExists(reapingPath)) {
        const reapingOwner = await this.#readOwner(reapingPath);
        if (
          reapingOwner === undefined ||
          (recoveryPolicy === "stale-age" &&
            Date.now() - reapingOwner.createdAt < this.#staleLockMilliseconds) ||
          !ownerIsDead(reapingOwner.pid)
        ) {
          return failure(
            diagnostic("resource-coordination-contended", "Local coordination reaping is active"),
          );
        }
        const staleGuard = await this.#moveCoordinationDirectory(
          reapingPath,
          reapingOwner,
          "quarantine",
        );
        if (!staleGuard.ok) {
          return failure(
            diagnostic("resource-coordination-contended", "Local coordination reaping is active"),
          );
        }
        await this.#bestEffortCoordinationCleanup(staleGuard.value);
      }
    } catch {
      return failure(providerFailure("inspect local coordination state"));
    }
    const owner = { createdAt: Date.now(), pid: process.pid, token: randomUUID() };
    const first = await this.#publishCoordinationDirectory(lockPath, owner, true);
    if (first.ok) {
      if (await this.#coordinationPathExists(reapingPath)) {
        const moved = await this.#moveCoordinationDirectory(lockPath, owner, "abandoned");
        if (moved.ok) await this.#bestEffortCoordinationCleanup(moved.value);
        return failure(
          diagnostic("resource-coordination-contended", "Local coordination reaping won the race"),
        );
      }
      return success(owner);
    }
    if (first.diagnostics[0]?.code !== "resource-coordination-contended") return first;
    const existing = await this.#readOwner(lockPath);
    if (
      existing === undefined ||
      (recoveryPolicy === "stale-age" &&
        Date.now() - existing.createdAt < this.#staleLockMilliseconds) ||
      !ownerIsDead(existing.pid)
    ) {
      return first;
    }
    const reaper = { createdAt: Date.now(), pid: process.pid, token: randomUUID() };
    const guarded = await this.#publishCoordinationDirectory(reapingPath, reaper, false);
    if (!guarded.ok) return first;
    let quarantinePath: string | undefined;
    try {
      const confirmed = await this.#readOwner(lockPath);
      if (
        confirmed === undefined ||
        confirmed.token !== existing.token ||
        (recoveryPolicy === "stale-age" &&
          Date.now() - confirmed.createdAt < this.#staleLockMilliseconds) ||
        !ownerIsDead(confirmed.pid)
      ) {
        return first;
      }
      const moved = await this.#moveCoordinationDirectory(lockPath, confirmed, "quarantine");
      if (!moved.ok) return first;
      quarantinePath = moved.value;
    } finally {
      const releasedGuard = await this.#moveCoordinationDirectory(reapingPath, reaper, "released");
      if (releasedGuard.ok) await this.#bestEffortCoordinationCleanup(releasedGuard.value);
    }
    if (quarantinePath !== undefined) {
      await this.#bestEffortCoordinationCleanup(quarantinePath);
      const nextReplacementCount = staleReplacementCount + 1;
      try {
        await this.#inject("coordination-reacquire");
      } catch (error) {
        return failure(resourceError(error, "prepare another local coordination attempt"));
      }
      if (nextReplacementCount >= maximumCoordinationReacquisitionAttempts) {
        return failure(
          diagnostic(
            "resource-coordination-retry-exhausted",
            "Local coordination changed repeatedly while stale ownership was replaced",
            { maximumAttempts: maximumCoordinationReacquisitionAttempts },
          ),
        );
      }
      return this.#acquireCoordination(identity, recoveryPolicy, nextReplacementCount);
    }
    return first;
  }

  async #releaseCoordination(identity: string, owner: CoordinationOwner): Promise<Result<void>> {
    const lockPath = path.join(this.#coordinationRoot, `${identity}.lock`);
    const moved = await this.#moveCoordinationDirectory(lockPath, owner, "released");
    if (!moved.ok) return moved;
    try {
      await this.#inject("coordination-release");
    } catch (error) {
      await this.#bestEffortCoordinationCleanup(moved.value);
      return failure(resourceError(error, "finalize local coordination release"));
    }
    await this.#bestEffortCoordinationCleanup(moved.value);
    return success(undefined);
  }
}
