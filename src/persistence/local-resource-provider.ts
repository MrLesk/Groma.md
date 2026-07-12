import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, opendir, realpath, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { failure, type Diagnostic, type Result, success } from "../core/result.ts";
import { inspectExactRecord } from "../core/runtime.ts";
import {
  type EnumerateResourcesRequest,
  type LocalCoordinationRequest,
  type LocalResourceProvider,
  parseWorkspaceResourceLocator,
  type ReadResourceRequest,
  type ReplacementCommitOutcome,
  type ResourceContents,
  type ResourceContinuationCursor,
  type ResourceEntry,
  type ResourceEnumerationPage,
  type ResourceKind,
  type StagedReplacementHandle,
  type WorkspaceResourceLocator,
  workspaceResourceLocator,
} from "./contracts.ts";

export type LocalResourceFaultPhase =
  "after-rename" | "cleanup" | "enumerate" | "flush" | "read" | "rename" | "write";

export type LocalResourceFaultInjector = (phase: LocalResourceFaultPhase) => void | Promise<void>;

export interface LocalResourceProviderOptions {
  /** Absolute host configuration. It is never returned through capability results. */
  readonly workspaceRoot: string;
  /** Absolute volatile host location used for cross-process coordination. */
  readonly coordinationRoot?: string;
  readonly faultInjector?: LocalResourceFaultInjector;
  readonly maxCursorBytes?: number;
  readonly maxDepth?: number;
  readonly maxEntriesPerDirectory?: number;
  readonly maxPageSize?: number;
  readonly maxReadBytes?: number;
  readonly staleLockMilliseconds?: number;
}

interface ResolvedResource {
  readonly absolutePath: string;
  readonly locator: WorkspaceResourceLocator;
  readonly stats?: Awaited<ReturnType<typeof lstat>>;
}

interface StagedRecord {
  readonly locator: WorkspaceResourceLocator;
  readonly stagePath: string;
  readonly targetPath: string;
  state: "committed" | "discarded" | "staged";
}

interface CoordinationOwner {
  readonly createdAt: number;
  readonly pid: number;
  readonly token: string;
}

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
const defaultMaxReadBytes = 16 * 1024 * 1024;
const defaultMaxPageSize = 1000;
const defaultMaxDepth = 64;
const defaultMaxEntriesPerDirectory = 10_000;
const defaultMaxCursorBytes = 4096;
const defaultStaleLockMilliseconds = 5 * 60 * 1000;
const maximumOwnerBytes = 1024;
const writeChunkBytes = 64 * 1024;

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

function configuredPositive(value: number | undefined, fallback: number, name: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return selected;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function locatorSegments(locator: WorkspaceResourceLocator): readonly string[] {
  return locator === "." ? [] : locator.split("/");
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
    return buffer.slice(0, total);
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
    !/^[0-9a-f-]{36}$/.test(token)
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
  const requestedCoordinationRoot =
    options.coordinationRoot ?? path.join(tmpdir(), "groma-resource-locks-v1");
  await mkdir(requestedCoordinationRoot, { mode: 0o700, recursive: true });
  const coordinationRoot = await realpath(requestedCoordinationRoot);
  const coordinationStats = await lstat(coordinationRoot);
  if (!coordinationStats.isDirectory() || isWithin(canonicalRoot, coordinationRoot)) {
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
  readonly #root: string;
  readonly #stages = new WeakMap<object, StagedRecord>();
  readonly #staleLockMilliseconds: number;

  constructor(root: string, coordinationRoot: string, options: LocalResourceProviderOptions) {
    this.#root = root;
    this.#coordinationRoot = coordinationRoot;
    this.#faultInjector = options.faultInjector;
    this.#maxCursorBytes = configuredPositive(
      options.maxCursorBytes,
      defaultMaxCursorBytes,
      "maxCursorBytes",
    );
    this.#maxDepth = configuredPositive(options.maxDepth, defaultMaxDepth, "maxDepth");
    this.#maxEntriesPerDirectory = configuredPositive(
      options.maxEntriesPerDirectory,
      defaultMaxEntriesPerDirectory,
      "maxEntriesPerDirectory",
    );
    this.#maxPageSize = configuredPositive(options.maxPageSize, defaultMaxPageSize, "maxPageSize");
    this.#maxReadBytes = configuredPositive(
      options.maxReadBytes,
      defaultMaxReadBytes,
      "maxReadBytes",
    );
    this.#staleLockMilliseconds = configuredPositive(
      options.staleLockMilliseconds,
      defaultStaleLockMilliseconds,
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
        return success(Object.freeze({ bytes: buffer.slice(0, total) }));
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
      const entries = state.collected.slice(0, limit.value);
      let nextCursor: ResourceContinuationCursor | undefined;
      if (hasMore) {
        const anchor = entries.at(-1)?.locator;
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
    if (!(bytes instanceof Uint8Array)) {
      return failure(
        diagnostic("invalid-replacement-bytes", "Replacement contents must be a Uint8Array"),
      );
    }
    const copied = new Uint8Array(bytes);
    let stagePath: string | undefined;
    try {
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
        const candidate = path.join(parentPath, `.groma-stage-${randomUUID()}`);
        try {
          const handle = await open(candidate, "wx", 0o600);
          stagePath = candidate;
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
                await this.#inject("write");
              }
            }
            if (!writeBoundaryInjected) await this.#inject("write");
            await this.#inject("flush");
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
        stagePath,
        state: "staged",
        targetPath: target.value.absolutePath,
      });
      return success(handle);
    } catch {
      if (stagePath !== undefined) await this.#cleanupPath(stagePath);
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
    if (record.state === "committed") return Object.freeze({ state: "committed" });
    if (record.state === "discarded") {
      return notCommitted(
        diagnostic("replacement-discarded", "Replacement handle has already been discarded"),
      );
    }
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
      await this.#inject("rename");
      await rename(record.stagePath, record.targetPath);
      record.state = "committed";
    } catch (error) {
      return notCommitted(resourceError(error, "commit a staged replacement"));
    }
    try {
      await this.#inject("after-rename");
      return Object.freeze({ state: "committed" });
    } catch {
      return Object.freeze({
        diagnostics: Object.freeze([
          diagnostic(
            "replacement-commit-indeterminate",
            "Replacement was renamed but commit acknowledgement failed",
            { commitState: "committed-indeterminate" },
          ),
        ]),
        state: "committed-indeterminate",
      });
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
    if (record.state !== "staged") return success(undefined);
    const cleanup = await this.#cleanupPath(record.stagePath);
    if (cleanup.ok) record.state = "discarded";
    return cleanup;
  }

  async withCoordination<T>(
    request: LocalCoordinationRequest,
    action: () => T | Promise<T>,
  ): Promise<Result<T>> {
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
    if (typeof action !== "function") {
      return failure(
        diagnostic("invalid-coordination-action", "Coordination action must be callable"),
      );
    }
    const identity = createHash("sha256")
      .update(this.#root)
      .update("\0")
      .update(locator.value)
      .digest("hex");
    if (processCoordination.has(identity)) {
      return failure(
        diagnostic(
          "resource-coordination-contended",
          "Local resource coordination is already held",
        ),
      );
    }
    processCoordination.add(identity);
    const acquired = await this.#acquireCoordination(identity);
    if (!acquired.ok) {
      processCoordination.delete(identity);
      return acquired;
    }
    let result: Result<T>;
    try {
      result = success(await action());
    } catch {
      result = failure(providerFailure("run a coordinated action"));
    }
    const released = await this.#releaseCoordination(identity, acquired.value);
    processCoordination.delete(identity);
    return released.ok ? result : released;
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
    const dir = await opendir(absoluteDirectory);
    const names: string[] = [];
    try {
      while (true) {
        const entry = await dir.read();
        if (entry === null) break;
        names.push(entry.name);
        if (names.length > directoryLimit) {
          return failure(
            diagnostic(
              "resource-directory-overflow",
              "A directory exceeds the explicit enumeration entry bound",
              { maximum: directoryLimit },
            ),
          );
        }
      }
    } finally {
      try {
        await dir.close();
      } catch {
        // Bun closes a Dir after the terminal read; explicit close remains portable cleanup.
      }
    }
    names.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
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
            kind === "directory" && state.after?.startsWith(`${entry.locator}/`) === true;
        }
      } else {
        state.collected.push(entry);
        if (state.collected.length > pageLimit) {
          state.stopped = true;
          return success(undefined);
        }
      }
      if (traverseDirectory) {
        if (depth >= maxDepth) {
          const child = await opendir(childPath);
          try {
            const deeper = await child.read();
            if (deeper !== null) state.truncatedByDepth = true;
          } finally {
            try {
              await child.close();
            } catch {
              // See the directory close note above.
            }
          }
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

  #encodeCursor(state: CursorState): Result<ResourceContinuationCursor> {
    const raw = JSON.stringify(state);
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
    if (!value.startsWith(prefix)) {
      return failure(
        diagnostic(
          "malformed-resource-cursor",
          "Resource continuation cursor has an invalid envelope",
        ),
      );
    }
    try {
      const suffix = value.slice(prefix.length);
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

  async #inject(phase: LocalResourceFaultPhase): Promise<void> {
    await this.#faultInjector?.(phase);
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

  async #readOwner(ownerPath: string): Promise<CoordinationOwner | undefined> {
    try {
      const stats = await lstat(ownerPath);
      if (!stats.isFile() || stats.isSymbolicLink() || stats.size > maximumOwnerBytes)
        return undefined;
      const bytes = await readBoundedFile(ownerPath, maximumOwnerBytes);
      return canonicalOwner(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
    } catch {
      return undefined;
    }
  }

  async #acquireCoordination(identity: string): Promise<Result<CoordinationOwner>> {
    const lockPath = path.join(this.#coordinationRoot, `${identity}.lock`);
    const reaperPath = path.join(this.#coordinationRoot, `${identity}.reap`);
    const tryCreate = async (): Promise<Result<CoordinationOwner>> => {
      try {
        await lstat(reaperPath);
        return failure(
          diagnostic(
            "resource-coordination-contended",
            "Local coordination cleanup is in progress",
          ),
        );
      } catch (error) {
        if (errorCode(error) !== "ENOENT")
          return failure(providerFailure("inspect coordination state"));
      }
      try {
        await mkdir(lockPath, { mode: 0o700 });
      } catch (error) {
        if (errorCode(error) === "EEXIST") {
          return failure(
            diagnostic(
              "resource-coordination-contended",
              "Local resource coordination is already held",
            ),
          );
        }
        return failure(resourceError(error, "acquire local coordination"));
      }
      try {
        await lstat(reaperPath);
        await rm(lockPath, { recursive: true, force: true });
        return failure(
          diagnostic("resource-coordination-contended", "Local coordination cleanup won the race"),
        );
      } catch (error) {
        if (errorCode(error) !== "ENOENT") {
          await rm(lockPath, { recursive: true, force: true });
          return failure(providerFailure("verify coordination ownership"));
        }
      }
      const owner = { createdAt: Date.now(), pid: process.pid, token: randomUUID() };
      try {
        await Bun.write(path.join(lockPath, "owner.json"), JSON.stringify(owner));
        return success(owner);
      } catch {
        await rm(lockPath, { recursive: true, force: true });
        return failure(providerFailure("record coordination ownership"));
      }
    };

    const first = await tryCreate();
    if (first.ok || first.diagnostics[0]?.code !== "resource-coordination-contended") return first;
    const existing = await this.#readOwner(path.join(lockPath, "owner.json"));
    if (
      existing === undefined ||
      Date.now() - existing.createdAt < this.#staleLockMilliseconds ||
      !ownerIsDead(existing.pid)
    ) {
      return first;
    }
    try {
      await mkdir(reaperPath, { mode: 0o700 });
    } catch (error) {
      return errorCode(error) === "EEXIST"
        ? first
        : failure(resourceError(error, "serialize stale coordination cleanup"));
    }
    try {
      const confirmed = await this.#readOwner(path.join(lockPath, "owner.json"));
      if (
        confirmed === undefined ||
        confirmed.token !== existing.token ||
        Date.now() - confirmed.createdAt < this.#staleLockMilliseconds ||
        !ownerIsDead(confirmed.pid)
      ) {
        return first;
      }
      await rm(lockPath, { recursive: true, force: true });
    } catch (error) {
      return failure(resourceError(error, "remove stale coordination state"));
    } finally {
      await rm(reaperPath, { recursive: true, force: true }).catch(() => undefined);
    }
    return tryCreate();
  }

  async #releaseCoordination(identity: string, owner: CoordinationOwner): Promise<Result<void>> {
    const lockPath = path.join(this.#coordinationRoot, `${identity}.lock`);
    const current = await this.#readOwner(path.join(lockPath, "owner.json"));
    if (current === undefined || current.token !== owner.token) {
      return failure(
        diagnostic(
          "resource-coordination-ownership-lost",
          "Local coordination ownership could not be verified during release",
        ),
      );
    }
    try {
      await rm(lockPath, { recursive: true });
      return success(undefined);
    } catch (error) {
      return failure(resourceError(error, "release local coordination"));
    }
  }
}
