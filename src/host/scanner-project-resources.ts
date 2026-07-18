import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { failure, success, type Diagnostic, type Result } from "../core/index.ts";
import { inspectExactRecord } from "../core/runtime.ts";
import {
  createLocalResourceProvider,
  localResourceProviderDefaultMaxEntriesPerDirectory,
  parseWorkspaceResourceLocator,
  type ResourceContinuationCursor,
  type WorkspaceResourceLocator,
} from "../persistence/index.ts";
import type {
  ScannerProjectResources,
  ScannerResourceEnumerationRequest,
  ScannerResourcePage,
  ScannerResourceReadRequest,
} from "../plugin-sdk/scanner.ts";
import type { BootstrapArchitecture, BootstrapPlatform } from "./bootstrap-configuration.ts";
import { resolveProjectSourcePath } from "./local-project-registry.ts";

export interface LocalScannerProjectResourcesOptions {
  readonly architecture: BootstrapArchitecture;
  readonly coordinationRoot?: string;
  readonly platform: BootstrapPlatform;
  readonly source: string;
  readonly workspaceRoot: string;
}

export const localScannerProjectResourcesBounds = Object.freeze({
  maxCursorCharacters: 16 * 1_024,
  maxEnumerationDepth: 64,
  maxEntriesPerDirectory: localResourceProviderDefaultMaxEntriesPerDirectory,
  maxPageSize: 1_000,
  maxReadBytes: 16 * 1_024 * 1_024,
  maxResourceCharacters: 4_096,
  maxScopeCharacters: 128,
});

const rootProjectExclusions = Object.freeze(["groma", ".groma-cache", ".git"]);
const scopePattern = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
const cursorControls = /[\u0000-\u001f\u007f]/;

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function unavailable(): Result<never> {
  return failure(
    diagnostic(
      "scanner-project-resources-unavailable",
      "The configured project source is unavailable to scanners",
    ),
  );
}

function invalidRequest(message: string): Result<never> {
  return failure(diagnostic("invalid-scanner-resource-request", message));
}

function positiveBounded(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function validDepth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= localScannerProjectResourcesBounds.maxEnumerationDepth
  );
}

function canonicalResource(value: unknown): Result<WorkspaceResourceLocator> {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > localScannerProjectResourcesBounds.maxResourceCharacters
  ) {
    return invalidRequest("Scanner resource must be a bounded portable locator");
  }
  const parsed = parseWorkspaceResourceLocator(value);
  return parsed.ok && parsed.value === value
    ? parsed
    : invalidRequest("Scanner resource must be a bounded portable locator");
}

function validScope(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= localScannerProjectResourcesBounds.maxScopeCharacters &&
    scopePattern.test(value)
  );
}

function validCursor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= localScannerProjectResourcesBounds.maxCursorCharacters &&
    !cursorControls.test(value)
  );
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

async function confinedProjectSource(
  workspaceRoot: string,
  source: string,
): Promise<Result<string>> {
  try {
    const canonicalWorkspaceRoot = await realpath(workspaceRoot);
    const rootStats = await lstat(canonicalWorkspaceRoot);
    if (!rootStats.isDirectory()) return unavailable();
    let current = canonicalWorkspaceRoot;
    for (const segment of source === "." ? [] : source.split("/")) {
      current = path.join(current, segment);
      const stats = await lstat(current);
      if (stats.isSymbolicLink() || !stats.isDirectory()) return unavailable();
      const canonical = await realpath(current);
      if (!isWithin(canonicalWorkspaceRoot, canonical)) return unavailable();
      current = canonical;
    }
    return success(current);
  } catch {
    return unavailable();
  }
}

/**
 * Builds the scanner's read-only view as a separate provider rooted at the project source.
 * Provider cursors and resource locators consequently remain project-relative.
 */
export async function createLocalScannerProjectResources(
  options: LocalScannerProjectResourcesOptions,
): Promise<Result<ScannerProjectResources>> {
  const resolved = resolveProjectSourcePath(options);
  if (!resolved.ok) return resolved;
  const source = await confinedProjectSource(options.workspaceRoot, resolved.value.source);
  if (!source.ok) return source;

  try {
    const provider = await createLocalResourceProvider({
      ...(options.coordinationRoot === undefined
        ? {}
        : { coordinationRoot: options.coordinationRoot }),
      ...(resolved.value.source === "."
        ? { excludedTopLevelResourceSegments: rootProjectExclusions }
        : {}),
      maxCursorBytes: localScannerProjectResourcesBounds.maxCursorCharacters,
      maxDepth: localScannerProjectResourcesBounds.maxEnumerationDepth,
      maxEntriesPerDirectory: localScannerProjectResourcesBounds.maxEntriesPerDirectory,
      maxPageSize: localScannerProjectResourcesBounds.maxPageSize,
      maxReadBytes: localScannerProjectResourcesBounds.maxReadBytes,
      confinementRoot: options.workspaceRoot,
      workspaceRoot: source.value,
    });

    const resources: ScannerProjectResources = Object.freeze({
      enumerate: async (request: ScannerResourceEnumerationRequest) => {
        const inspected = inspectExactRecord(
          request,
          [
            ["limit", "maxDepth", "resource", "scope"],
            ["cursor", "limit", "maxDepth", "resource", "scope"],
          ],
          "invalid-scanner-resource-request",
          "Scanner resource enumeration request",
        );
        if (!inspected.ok) return inspected;
        const resource = canonicalResource(inspected.value.resource);
        if (
          !resource.ok ||
          !positiveBounded(inspected.value.limit, localScannerProjectResourcesBounds.maxPageSize) ||
          !validDepth(inspected.value.maxDepth) ||
          !validScope(inspected.value.scope) ||
          ("cursor" in inspected.value && !validCursor(inspected.value.cursor))
        ) {
          return invalidRequest("Scanner enumeration request exceeds its bounded contract");
        }
        const page = await provider.enumerate({
          ...(inspected.value.cursor === undefined
            ? {}
            : { cursor: inspected.value.cursor as ResourceContinuationCursor }),
          limit: inspected.value.limit,
          locator: resource.value,
          maxDepth: inspected.value.maxDepth,
          maxEntriesPerDirectory: localScannerProjectResourcesBounds.maxEntriesPerDirectory,
        });
        if (!page.ok) return page;
        const scope = inspected.value.scope;
        const mapped: ScannerResourcePage = Object.freeze({
          entries: Object.freeze(
            page.value.entries.map((entry) =>
              Object.freeze({
                kind: entry.kind,
                resource: entry.locator,
                scope,
                ...(entry.size === undefined ? {} : { size: entry.size }),
              }),
            ),
          ),
          ...(page.value.nextCursor === undefined ? {} : { nextCursor: page.value.nextCursor }),
          truncatedByDepth: page.value.truncatedByDepth,
        });
        return success(mapped);
      },
      read: async (request: ScannerResourceReadRequest) => {
        const inspected = inspectExactRecord(
          request,
          [["maxBytes", "resource", "scope"]],
          "invalid-scanner-resource-request",
          "Scanner resource read request",
        );
        if (!inspected.ok) return inspected;
        const resource = canonicalResource(inspected.value.resource);
        if (
          !resource.ok ||
          !positiveBounded(
            inspected.value.maxBytes,
            localScannerProjectResourcesBounds.maxReadBytes,
          ) ||
          !validScope(inspected.value.scope)
        ) {
          return invalidRequest("Scanner read request exceeds its bounded contract");
        }
        const contents = await provider.read({
          locator: resource.value,
          maxBytes: inspected.value.maxBytes,
        });
        return contents.ok
          ? success(Object.freeze({ bytes: contents.value.bytes }))
          : failure(...contents.diagnostics);
      },
    });
    return success(resources);
  } catch {
    return unavailable();
  }
}
