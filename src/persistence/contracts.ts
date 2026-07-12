import { failure, type Diagnostic, type Result, success } from "../core/result.ts";

declare const workspaceResourceLocatorBrand: unique symbol;
declare const resourceContinuationCursorBrand: unique symbol;
declare const stagedReplacementHandleBrand: unique symbol;

export type WorkspaceResourceLocator = string & {
  readonly [workspaceResourceLocatorBrand]: true;
};

export type ResourceContinuationCursor = string & {
  readonly [resourceContinuationCursorBrand]: true;
};

export interface StagedReplacementHandle {
  readonly [stagedReplacementHandleBrand]: true;
}

export type ResourceKind = "directory" | "file" | "link" | "other";

export interface ReadResourceRequest {
  readonly locator: WorkspaceResourceLocator;
  readonly maxBytes: number;
}

export interface ResourceContents {
  readonly bytes: Uint8Array;
}

export interface EnumerateResourcesRequest {
  readonly cursor?: ResourceContinuationCursor;
  readonly limit: number;
  readonly locator: WorkspaceResourceLocator;
  readonly maxDepth: number;
  readonly maxEntriesPerDirectory: number;
}

export interface ResourceEntry {
  readonly kind: ResourceKind;
  readonly locator: WorkspaceResourceLocator;
  readonly size?: number;
}

export interface ResourceEnumerationPage {
  readonly entries: readonly ResourceEntry[];
  readonly nextCursor?: ResourceContinuationCursor;
  readonly truncatedByDepth: boolean;
}

export type CoordinationContext = "local-machine" | "multi-host" | "shared-filesystem";

export interface LocalCoordinationRequest {
  readonly context: CoordinationContext;
  readonly locator: WorkspaceResourceLocator;
}

export interface ReplacementCommitOutcome {
  readonly diagnostics?: readonly Diagnostic[];
  readonly state: "committed" | "committed-indeterminate" | "not-committed";
}

export interface LocalResourceProvider {
  read(request: ReadResourceRequest): Promise<Result<ResourceContents>>;
  enumerate(request: EnumerateResourcesRequest): Promise<Result<ResourceEnumerationPage>>;
  stageReplacement(
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Promise<Result<StagedReplacementHandle>>;
  commitReplacement(handle: StagedReplacementHandle): Promise<ReplacementCommitOutcome>;
  discardReplacement(handle: StagedReplacementHandle): Promise<Result<void>>;
  withCoordination<T>(
    request: LocalCoordinationRequest,
    action: () => T | Promise<T>,
  ): Promise<Result<T>>;
}

const maximumLocatorBytes = 4096;
const maximumSegmentBytes = 255;
const maximumFactorySegments = Math.floor((maximumLocatorBytes + 1) / 2);
export const reservedWorkspaceResourceStagePrefix = ".groma-stage-";
const reservedWindowsName =
  /^(?:aux|clock\$|con|conin\$|conout\$|nul|prn|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;
const forbiddenWindowsCharacters = /[<>:"|?*\\\u0000-\u001f]/;
const absoluteOrDrivePrefix = /^(?:\/|\\|[a-z]:)/i;
const intrinsicTextEncoder = new TextEncoder();
const intrinsicEncode = TextEncoder.prototype.encode;
const intrinsicCharCodeAt = String.prototype.charCodeAt;
const intrinsicEndsWith = String.prototype.endsWith;
const intrinsicIncludes = String.prototype.includes;
const intrinsicSplit = String.prototype.split;
const intrinsicStartsWith = String.prototype.startsWith;
const intrinsicToLowerCase = String.prototype.toLowerCase;
const intrinsicTest = RegExp.prototype.test;

export function isReservedWorkspaceResourceSegment(value: string): boolean {
  const lowered = Reflect.apply(intrinsicToLowerCase, value, []) as string;
  return Reflect.apply(intrinsicStartsWith, lowered, [
    reservedWorkspaceResourceStagePrefix,
  ]) as boolean;
}

function invalidLocator(reason: string): Result<never> {
  return failure({
    code: "invalid-resource-locator",
    message: `Workspace resource locator is malformed: ${reason}`,
    details: { reason },
  });
}

function containsUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = Reflect.apply(intrinsicCharCodeAt, value, [index]) as number;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return true;
      const next = Reflect.apply(intrinsicCharCodeAt, value, [index + 1]) as number;
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function validateSegment(segment: string): Result<string> {
  if (segment.length === 0) return invalidLocator("segments must not be empty");
  if (segment === "." || segment === "..") {
    return invalidLocator("dot and traversal segments are not allowed");
  }
  if (segment.length > maximumSegmentBytes) {
    return invalidLocator(`segments must not exceed ${maximumSegmentBytes} UTF-8 bytes`);
  }
  if (isReservedWorkspaceResourceSegment(segment)) {
    return invalidLocator("segments must not use the provider-owned staging namespace");
  }
  if (
    (Reflect.apply(intrinsicEndsWith, segment, ["."]) as boolean) ||
    (Reflect.apply(intrinsicEndsWith, segment, [" "]) as boolean)
  ) {
    return invalidLocator("segments must not end with a dot or space");
  }
  if (Reflect.apply(intrinsicTest, forbiddenWindowsCharacters, [segment]) as boolean) {
    return invalidLocator("segments contain a non-portable or reserved path character");
  }
  if (Reflect.apply(intrinsicTest, reservedWindowsName, [segment]) as boolean) {
    return invalidLocator("segments must not use a reserved Windows device name");
  }
  if (containsUnpairedSurrogate(segment)) {
    return invalidLocator("segments must contain well-formed Unicode scalar values");
  }
  if (
    Reflect.apply(intrinsicEncode, intrinsicTextEncoder, [segment]).byteLength > maximumSegmentBytes
  ) {
    return invalidLocator(`segments must not exceed ${maximumSegmentBytes} UTF-8 bytes`);
  }
  return success(segment);
}

export function parseWorkspaceResourceLocator(value: unknown): Result<WorkspaceResourceLocator> {
  if (typeof value !== "string") return invalidLocator("expected a string");
  if (value === ".") return success(value as WorkspaceResourceLocator);
  if (value.length === 0) return invalidLocator("the empty string is not a locator");
  if (value.length > maximumLocatorBytes) {
    return invalidLocator(`locators must not exceed ${maximumLocatorBytes} UTF-8 bytes`);
  }
  if (Reflect.apply(intrinsicTest, absoluteOrDrivePrefix, [value]) as boolean) {
    return invalidLocator("absolute, UNC, and drive-qualified paths are not allowed");
  }
  if (
    Reflect.apply(intrinsicEncode, intrinsicTextEncoder, [value]).byteLength > maximumLocatorBytes
  ) {
    return invalidLocator(`locators must not exceed ${maximumLocatorBytes} UTF-8 bytes`);
  }
  const segments = Reflect.apply(intrinsicSplit, value, ["/"]) as string[];
  for (let index = 0; index < segments.length; index += 1) {
    const validated = validateSegment(segments[index]!);
    if (!validated.ok) return validated;
  }
  return success(value as WorkspaceResourceLocator);
}

export function workspaceResourceLocator(
  ...segments: readonly unknown[]
): Result<WorkspaceResourceLocator> {
  if (segments.length === 0) return success("." as WorkspaceResourceLocator);
  if (segments.length > maximumFactorySegments) {
    return invalidLocator(`locators must not exceed ${maximumLocatorBytes} UTF-8 bytes`);
  }
  const validated: string[] = [];
  let totalCodeUnits = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (typeof segment !== "string") return invalidLocator("expected every segment to be a string");
    totalCodeUnits += (index === 0 ? 0 : 1) + segment.length;
    if (totalCodeUnits > maximumLocatorBytes) {
      return invalidLocator(`locators must not exceed ${maximumLocatorBytes} UTF-8 bytes`);
    }
    if (Reflect.apply(intrinsicIncludes, segment, ["/"]) as boolean) {
      return invalidLocator("factory segments must not contain resource separators");
    }
    const parsed = validateSegment(segment);
    if (!parsed.ok) return parsed;
    validated.push(parsed.value);
  }
  return parseWorkspaceResourceLocator(validated.join("/"));
}
