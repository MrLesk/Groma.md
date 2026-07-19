import { createHash } from "node:crypto";

import { parse } from "@babel/parser";

import {
  pluginRuntimeApiVersion,
  scannerApiVersion,
  scannerCapabilityId,
  scannerCapabilityVersion,
  type Diagnostic,
  type DocumentationObservation,
  type ObservationProvenance,
  type ObservationRecord,
  type ObservationRecordKind,
  type ObservationReference,
  type PluginRegistration,
  type Result,
  type Scanner,
  type ScannerRequest,
  type ScannerResourceEntry,
} from "../plugin-sdk/index.ts";

const scannerId = "official.typescript";
const scannerVersion = "1.0.0";

const inventoryPageSize = 1_000;
const observationBatchSize = 128;
const heartbeatWorkInterval = 256;
const maxDirectories = 5_000;
const maxEnumerationPages = 10_000;
const maxPagesPerDirectory = 1_024;
const maxResources = 20_000;
const maxReadableBytes = 64 * 1024 * 1024;
const maxSourceBytes = 2 * 1024 * 1024;
const maxDocumentationCharacters = 32 * 1024;
const maxRecords = 4_096;
const maxCanonicalCharacters = 1_500_000;
const maxExtractionWork = 2_000_000;
const maxRelationshipProvenance = 32;
const maxActionProvenance = 32;
const maxAstNodesPerFile = 200_000;
const maxAstDepth = 512;
const maxReexportDepth = 32;
const maxPackageEntryLiterals = 256;

const sourceExtensionPattern = /\.(?:[cm]?[jt]sx?|d\.[cm]?ts)$/;
const testFilePattern = /(?:^|\/)(?:[^/]+\.)?(?:test|spec)\.(?:[cm]?[jt]sx?|d\.[cm]?ts)$/i;
const generatedFilePattern = /(?:^|\/)(?:[^/]+\.)?(?:generated|gen)\.(?:[cm]?[jt]sx?|d\.[cm]?ts)$/i;
const portableResourcePattern =
  /^(?:\.|[^/\\\u0000-\u001f\u007f]+(?:\/[^/\\\u0000-\u001f\u007f]+)*)$/;
const knownExcludedDirectories = new Set([
  ".cache",
  ".git",
  ".groma",
  ".groma-cache",
  ".hg",
  ".next",
  ".nuxt",
  ".svn",
  ".svelte-kit",
  ".turbo",
  "__generated__",
  "__tests__",
  "bower_components",
  "build",
  "coverage",
  "dist",
  "generated",
  "groma",
  "fixtures",
  "node_modules",
  "out",
  "target",
  "temp",
  "test",
  "tests",
  "tmp",
  "vendor",
]);
const conventionalSourceDirectories = new Set(["app", "lib", "server", "src"]);
const coverageKinds: readonly ObservationRecordKind[] = Object.freeze([
  "action",
  "component-candidate",
  "documentation",
  "relationship",
]);
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const textEncoder = new TextEncoder();

function success<T>(value: T): Result<T> {
  return Object.freeze({ ok: true as const, value });
}

function failure<T = never>(...diagnostics: readonly Diagnostic[]): Result<T> {
  return Object.freeze({ diagnostics: Object.freeze([...diagnostics]), ok: false as const });
}

interface AstNode {
  readonly end?: number | null;
  readonly start?: number | null;
  readonly type: string;
  readonly [key: string]: unknown;
}

interface ScannerConfiguration {
  readonly exclude: readonly string[];
  readonly include: readonly string[];
}

interface FileEvidence {
  readonly byteOffsets: Map<number, number>;
  readonly bytes: Uint8Array;
  readonly fingerprint: string;
  readonly resource: string;
  readonly scope: string;
  readonly text: string;
}

interface PackageEvidence {
  readonly entries: readonly PackageEntryEvidence[];
  readonly imports: ModuleAliasPolicy;
  readonly name: string;
  readonly provenance: ObservationProvenance;
  readonly resource: string;
  readonly root: string;
  readonly scope: string;
  readonly workspacePatterns: readonly string[];
}

interface PackageEntryEvidence {
  readonly publicSubpath: string;
  readonly target: string;
}

interface ModuleAliasRule {
  readonly key: string;
  readonly targets: readonly string[];
}

interface ModuleAliasPolicy {
  readonly baseResource: string;
  readonly fallback: boolean;
  readonly rules: readonly ModuleAliasRule[];
  readonly unknown: boolean;
}

interface BoundaryEvidence {
  readonly files: readonly string[];
  readonly key: string;
  readonly name: string;
  readonly packageKey: string;
  readonly provenance: ObservationProvenance;
  readonly resource: string;
  readonly scope: string;
}

interface ImportEvidence {
  readonly end: number;
  readonly source: string;
  readonly start: number;
}

interface ImportedBindingEvidence {
  readonly imported: string;
  readonly source: string;
}

interface CallableEvidence {
  readonly end: number;
  readonly jsdoc?: Readonly<{ readonly end: number; readonly start: number }>;
  readonly name: string;
  readonly resource: string;
  readonly start: number;
}

interface PublicCallableEvidence {
  readonly callable: CallableEvidence;
  readonly proofResources: readonly string[];
}

interface ReexportEvidence {
  readonly exported?: readonly Readonly<{ readonly imported: string; readonly name: string }>[];
  readonly source: string;
}

interface RouteEvidence {
  readonly end: number;
  readonly name: string;
  readonly start: number;
}

interface ParsedSource {
  readonly callables: ReadonlyMap<string, CallableEvidence>;
  readonly imports: readonly ImportEvidence[];
  readonly partial: boolean;
  readonly reexports: readonly ReexportEvidence[];
  readonly routes: readonly RouteEvidence[];
}

interface ScopeInventory {
  readonly aliases: ModuleAliasPolicy;
  readonly configuredSourceRoots: readonly string[];
  readonly files: readonly string[];
  readonly partial: boolean;
}

interface ExtractionBudget {
  canonicalCharacters: number;
  records: number;
  work: number;
}

type CommonJsTrackedName = "Object" | "exports" | "module" | "require";

interface CommonJsLexicalScope {
  readonly bindings: Set<CommonJsTrackedName>;
  readonly kind: "class" | "function" | "lexical" | "program" | "var-boundary";
  readonly parent?: CommonJsLexicalScope;
}

interface CommonJsUse {
  readonly names: readonly CommonJsTrackedName[];
  readonly scope: CommonJsLexicalScope;
}

interface IgnoreRule {
  readonly directoryOnly: boolean;
  readonly expression: RegExp;
}

interface ScanState {
  bytes: number;
  pages: number;
  sequence: number;
  work: number;
}

class ScannerStop {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly diagnostics: readonly Diagnostic[] = Object.freeze([]),
    readonly reportFailure = true,
  ) {}
}

function chargeExtractionWork(budget: ExtractionBudget, amount = 1): void {
  budget.work += amount;
  if (budget.work > maxExtractionWork) {
    throw new ScannerStop(
      "typescript-scanner-budget-exceeded",
      "TypeScript scanner extraction work budget was exceeded",
    );
  }
}

function reserveRecordSlot(budget: ExtractionBudget): void {
  budget.records += 1;
  if (budget.records > maxRecords) {
    throw new ScannerStop(
      "typescript-scanner-budget-exceeded",
      "TypeScript scanner observation budget was exceeded",
    );
  }
}

function appendObservation(
  records: ObservationRecord[],
  budget: ExtractionBudget,
  record: ObservationRecord,
  reserved = false,
): void {
  chargeExtractionWork(budget);
  if (!reserved) reserveRecordSlot(budget);
  budget.canonicalCharacters += boundedStructuralCharacters(record);
  if (budget.canonicalCharacters > maxCanonicalCharacters) {
    throw new ScannerStop(
      "typescript-scanner-budget-exceeded",
      "TypeScript scanner observation character budget was exceeded",
    );
  }
  records.push(record);
}

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validObservationText(value: string, maximum: number): boolean {
  return (
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

function boundedStructuralCharacters(value: unknown): number {
  if (typeof value === "string") return value.length * 2 + 16;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return 32;
  if (Array.isArray(value)) {
    return 16 + value.reduce((total, item) => total + boundedStructuralCharacters(item), 0);
  }
  if (typeof value === "object" && value !== null) {
    let total = 16;
    for (const key of Object.keys(value)) {
      total +=
        key.length * 2 +
        16 +
        boundedStructuralCharacters((value as Readonly<Record<string, unknown>>)[key]);
    }
    return total;
  }
  return 32;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function observationKey(kind: ObservationRecordKind, ...parts: readonly string[]): string {
  return `candidate.${kind}.${sha256(parts.join("\u0000"))}`;
}

function reference(scope: string, key: string): ObservationReference {
  return Object.freeze({ key, scope });
}

function fullProvenance(file: FileEvidence): ObservationProvenance {
  return Object.freeze({
    fingerprint: file.fingerprint,
    resource: file.resource,
    scope: file.scope,
  });
}

function cacheByteOffsets(file: FileEvidence, offsets: readonly number[]): boolean {
  const requested = [...new Set(offsets)].sort((left, right) => left - right);
  let codeUnitOffset = 0;
  let byteOffset = 0;
  for (const target of requested) {
    if (!Number.isInteger(target) || target < 0 || target > file.text.length) return false;
    const cached = file.byteOffsets.get(target);
    if (cached !== undefined) continue;
    while (codeUnitOffset < target) {
      const codePoint = file.text.codePointAt(codeUnitOffset);
      if (codePoint === undefined) return false;
      const width = codePoint > 0xffff ? 2 : 1;
      if (codeUnitOffset + width > target) return false;
      byteOffset += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
      codeUnitOffset += width;
    }
    file.byteOffsets.set(target, byteOffset);
  }
  return true;
}

function rangeProvenance(
  file: FileEvidence,
  startCodeUnit: number,
  endCodeUnit: number,
): ObservationProvenance {
  const startByte = file.byteOffsets.get(startCodeUnit);
  const endByteExclusive = file.byteOffsets.get(endCodeUnit);
  if (startByte === undefined || endByteExclusive === undefined) {
    throw new ScannerStop(
      "typescript-scanner-invalid-range",
      "TypeScript scanner could not map a parsed source range",
    );
  }
  return Object.freeze({
    fingerprint: file.fingerprint,
    range: Object.freeze({
      endByteExclusive,
      startByte,
    }),
    resource: file.resource,
    scope: file.scope,
  });
}

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { readonly type?: unknown }).type === "string"
  );
}

function identifierName(value: unknown): string | undefined {
  return isAstNode(value) && value.type === "Identifier" && typeof value.name === "string"
    ? value.name
    : undefined;
}

function literalString(value: unknown): string | undefined {
  if (!isAstNode(value)) return undefined;
  if (value.type === "StringLiteral" && typeof value.value === "string") return value.value;
  if (
    value.type === "TemplateLiteral" &&
    Array.isArray(value.expressions) &&
    value.expressions.length === 0 &&
    Array.isArray(value.quasis) &&
    value.quasis.length === 1
  ) {
    const quasi = value.quasis[0];
    if (isAstNode(quasi) && typeof quasi.value === "object" && quasi.value !== null) {
      const cooked = (quasi.value as { readonly cooked?: unknown }).cooked;
      return typeof cooked === "string" ? cooked : undefined;
    }
  }
  return undefined;
}

function nodeRange(node: AstNode): Readonly<{ readonly end: number; readonly start: number }> {
  return Object.freeze({
    end: typeof node.end === "number" ? node.end : 0,
    start: typeof node.start === "number" ? node.start : 0,
  });
}

function dirname(resource: string): string {
  const index = resource.lastIndexOf("/");
  return index < 0 ? "." : resource.slice(0, index);
}

function basename(resource: string): string {
  const index = resource.lastIndexOf("/");
  return index < 0 ? resource : resource.slice(index + 1);
}

function joinResource(root: string, child: string): string {
  return root === "." ? child : `${root}/${child}`;
}

function relativeResource(resource: string, root: string): string | undefined {
  if (resource === root) return ".";
  if (root === ".") return resource;
  return resource.startsWith(`${root}/`) ? resource.slice(root.length + 1) : undefined;
}

function normalizeRelative(base: string, specifier: string): string | undefined {
  const output = base === "." ? [] : base.split("/");
  for (const segment of specifier.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (output.length === 0) return undefined;
      output.pop();
    } else {
      output.push(segment);
    }
  }
  return output.length === 0 ? "." : output.join("/");
}

function hasOwnDataRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validatePattern(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    !portableResourcePattern.test(value) ||
    /^(?:\/|[A-Za-z]:)/.test(value)
  ) {
    return false;
  }
  for (const segment of value.split("/")) {
    if (segment === "." || segment === "..") return false;
    if (segment.includes("**") && segment !== "**") return false;
    if (/[[\]{}?]/.test(segment)) return false;
  }
  return true;
}

function configuration(value: unknown): Result<ScannerConfiguration> {
  if (!hasOwnDataRecord(value)) {
    return failure(
      diagnostic("typescript-scanner-invalid-config", "Scanner configuration must be a record"),
    );
  }
  const keys = Object.keys(value).sort(compareCodeUnits);
  if (keys.some((key) => key !== "exclude" && key !== "include")) {
    return failure(
      diagnostic(
        "typescript-scanner-invalid-config",
        "Scanner configuration contains an unsupported field",
      ),
    );
  }
  const copy = (name: "exclude" | "include"): Result<readonly string[]> => {
    const candidate = value[name];
    if (candidate === undefined) return success(Object.freeze([]));
    if (!Array.isArray(candidate) || candidate.length > 128) {
      return failure(
        diagnostic("typescript-scanner-invalid-config", `${name} must be a bounded string array`),
      );
    }
    const copied: string[] = [];
    const seen = new Set<string>();
    for (const pattern of candidate) {
      if (!validatePattern(pattern) || seen.has(pattern)) {
        return failure(
          diagnostic(
            "typescript-scanner-invalid-config",
            `${name} contains an invalid or duplicate pattern`,
          ),
        );
      }
      seen.add(pattern);
      copied.push(pattern);
    }
    copied.sort(compareCodeUnits);
    return success(Object.freeze(copied));
  };
  const include = copy("include");
  if (!include.ok) return include;
  const exclude = copy("exclude");
  if (!exclude.ok) return exclude;
  return success(Object.freeze({ exclude: exclude.value, include: include.value }));
}

function escapeExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globExpression(pattern: string, anywhere: boolean, directoryOnly: boolean): RegExp {
  const segments = pattern.split("/");
  let source = anywhere ? "(?:^|/)" : "^";
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    if (segment === "**") {
      source += index === segments.length - 1 ? ".*" : "(?:[^/]+/)*";
      continue;
    }
    source += escapeExpression(segment).replace(/\\\*/g, "[^/]*");
    if (index < segments.length - 1) source += "/";
  }
  source += directoryOnly ? "(?:/.*)?$" : "$";
  return new RegExp(source);
}

function matchesPatterns(resource: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    if (!pattern.includes("*")) return resource === pattern || resource.startsWith(`${pattern}/`);
    return globExpression(pattern, false, false).test(resource);
  });
}

function included(resource: string, patterns: readonly string[]): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => {
    if (!pattern.includes("*")) return resource === pattern || resource.startsWith(`${pattern}/`);
    return globExpression(pattern, false, false).test(resource);
  });
}

function excludedByKnownRule(relative: string, directory: boolean): boolean {
  const segments = relative.split("/");
  if (directory && knownExcludedDirectories.has(segments.at(-1)?.toLowerCase() ?? "")) return true;
  if (segments.some((segment) => knownExcludedDirectories.has(segment.toLowerCase()))) return true;
  return testFilePattern.test(relative) || generatedFilePattern.test(relative);
}

function ignored(relative: string, directory: boolean, rules: readonly IgnoreRule[]): boolean {
  return rules.some((rule) => (!rule.directoryOnly || directory) && rule.expression.test(relative));
}

function parseGitignore(
  text: string,
): Readonly<{ readonly partial: boolean; readonly rules: readonly IgnoreRule[] }> {
  const rules: IgnoreRule[] = [];
  let partial = false;
  for (const original of text.split(/\r?\n/)) {
    if (original !== original.trim()) {
      partial = true;
      continue;
    }
    const line = original;
    if (line.length === 0 || line.startsWith("#")) continue;
    if (
      line.startsWith("!") ||
      line.startsWith("\\") ||
      /[[\]{}?]/.test(line) ||
      line.includes("***")
    ) {
      partial = true;
      continue;
    }
    const directoryOnly = line.endsWith("/");
    const rooted = line.startsWith("/");
    const pattern = line.slice(rooted ? 1 : 0, directoryOnly ? -1 : undefined);
    if (!validatePattern(pattern)) {
      partial = true;
      continue;
    }
    rules.push(
      Object.freeze({
        directoryOnly,
        expression: globExpression(pattern, !rooted && !pattern.includes("/"), directoryOnly),
      }),
    );
  }
  return Object.freeze({ partial, rules: Object.freeze(rules) });
}

function stripJsonComments(source: string): string | undefined {
  let output = "";
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    if (quoted) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      output += character;
      continue;
    }
    if (character === "/" && next === "/") {
      output += "  ";
      index += 1;
      while (index + 1 < source.length && source[index + 1] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }
    if (character === "/" && next === "*") {
      output += "  ";
      index += 1;
      let closed = false;
      while (index + 1 < source.length) {
        index += 1;
        if (source[index] === "*" && source[index + 1] === "/") {
          output += "  ";
          index += 1;
          closed = true;
          break;
        }
        output += source[index] === "\n" ? "\n" : " ";
      }
      if (!closed) return undefined;
      continue;
    }
    output += character;
  }
  return quoted ? undefined : output;
}

function stripTrailingCommas(source: string): string {
  let output = "";
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      output += character;
      continue;
    }
    if (character === ",") {
      let cursor = index + 1;
      while (/\s/.test(source[cursor] ?? "")) cursor += 1;
      if (source[cursor] === "}" || source[cursor] === "]") continue;
    }
    output += character;
  }
  return output;
}

function validModulePattern(value: unknown, allowHash: boolean): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    /[\\\u0000-\u001f\u007f]/.test(value) ||
    value.startsWith("/") ||
    (!allowHash && value.startsWith("#")) ||
    (value.match(/\*/g)?.length ?? 0) > 1
  ) {
    return false;
  }
  return !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function validAliasTarget(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const relative = value.startsWith("./") ? value.slice(2) : value;
  return validModulePattern(relative, true) && !relative.startsWith("#");
}

function validPackagePath(
  value: unknown,
  requireRelativePrefix: boolean,
  allowWildcard = false,
): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return false;
  if (requireRelativePrefix && !value.startsWith("./")) return false;
  const relative = value.startsWith("./") ? value.slice(2) : value;
  if (
    relative.length === 0 ||
    (!allowWildcard && relative.includes("*")) ||
    (relative.match(/\*/g)?.length ?? 0) > 1 ||
    /[:\\\u0000-\u001f\u007f]/.test(relative) ||
    relative.startsWith("/")
  )
    return false;
  return !relative
    .split("/")
    .some((segment) => segment === "" || segment === "." || segment === "..");
}

function validPublicSubpath(value: string): boolean {
  if (value === ".") return true;
  if (!value.startsWith("./") || value.length > 256) return false;
  const relative = value.slice(2);
  return (
    relative.length > 0 &&
    !relative.includes("*") &&
    !/[:\\\u0000-\u001f\u007f]/.test(relative) &&
    !relative.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  );
}

function parseAliasRules(
  value: unknown,
  allowHash: boolean,
): Readonly<{ readonly rules: readonly ModuleAliasRule[]; readonly unknown: boolean }> {
  if (value === undefined) return Object.freeze({ rules: Object.freeze([]), unknown: false });
  if (!hasOwnDataRecord(value)) {
    return Object.freeze({ rules: Object.freeze([]), unknown: true });
  }
  const keys = Object.keys(value).sort(compareCodeUnits);
  if (keys.length > 128) return Object.freeze({ rules: Object.freeze([]), unknown: true });
  const rules: ModuleAliasRule[] = [];
  for (const key of keys) {
    const targets = value[key];
    if (
      !validModulePattern(key, allowHash) ||
      (allowHash && !key.startsWith("#")) ||
      !Array.isArray(targets) ||
      targets.length === 0 ||
      targets.length > 8 ||
      targets.some((target) => !validAliasTarget(target))
    ) {
      return Object.freeze({ rules: Object.freeze([]), unknown: true });
    }
    rules.push(
      Object.freeze({ key, targets: Object.freeze((targets as string[]).sort(compareCodeUnits)) }),
    );
  }
  return Object.freeze({ rules: Object.freeze(rules), unknown: false });
}

function parseTsconfig(text: string): Readonly<{
  readonly baseUrl: string;
  readonly baseUrlEnabled: boolean;
  readonly exclude: readonly string[];
  readonly files: readonly string[];
  readonly filesPresent: boolean;
  readonly hardExclude: readonly string[];
  readonly include: readonly string[];
  readonly includePresent: boolean;
  readonly partial: boolean;
  readonly rootDir?: string;
  readonly rules: readonly ModuleAliasRule[];
  readonly unsafe: boolean;
}> {
  const stripped = stripJsonComments(text);
  const invalid = Object.freeze({
    baseUrl: ".",
    baseUrlEnabled: false,
    exclude: Object.freeze([]),
    files: Object.freeze([]),
    filesPresent: false,
    hardExclude: Object.freeze([]),
    include: Object.freeze([]),
    includePresent: false,
    partial: true,
    rules: Object.freeze([]),
    unsafe: true,
  });
  if (stripped === undefined) return invalid;
  try {
    const parsed: unknown = JSON.parse(stripTrailingCommas(stripped));
    if (!hasOwnDataRecord(parsed)) return invalid;
    let unsafe = Object.hasOwn(parsed, "extends");
    let partial = unsafe;
    const copyPatterns = (value: unknown, present: boolean): readonly string[] => {
      if (!present) return Object.freeze([]);
      if (!Array.isArray(value) || value.length > 128) {
        partial = true;
        unsafe = true;
        return Object.freeze([]);
      }
      const copied: string[] = [];
      for (const item of value) {
        if (!validatePattern(item)) {
          partial = true;
          unsafe = true;
        } else copied.push(item);
      }
      return Object.freeze(copied.sort(compareCodeUnits));
    };
    const includePresent = Object.hasOwn(parsed, "include");
    const include = copyPatterns(parsed.include, includePresent);
    const exclude = copyPatterns(parsed.exclude, Object.hasOwn(parsed, "exclude"));
    const filesPresent = Object.hasOwn(parsed, "files");
    const explicitFiles: string[] = [];
    if (filesPresent) {
      if (!Array.isArray(parsed.files) || parsed.files.length > 128) partial = true;
      else {
        const seenFiles = new Set<string>();
        for (const item of parsed.files) {
          const candidate =
            typeof item === "string" && item.startsWith("./") ? item.slice(2) : item;
          if (
            !validatePattern(candidate) ||
            candidate.includes("*") ||
            !sourceExtensionPattern.test(candidate)
          ) {
            partial = true;
            continue;
          }
          if (!seenFiles.has(candidate)) {
            seenFiles.add(candidate);
            explicitFiles.push(candidate);
          }
        }
      }
    }
    const compilerOptions = parsed.compilerOptions;
    if (compilerOptions !== undefined && !hasOwnDataRecord(compilerOptions)) {
      partial = true;
      unsafe = true;
    }
    const outputDirectories: string[] = [];
    for (const field of ["outDir", "declarationDir"] as const) {
      const candidate = hasOwnDataRecord(compilerOptions) ? compilerOptions[field] : undefined;
      if (candidate === undefined) continue;
      if (
        typeof candidate !== "string" ||
        candidate === "." ||
        !validatePattern(candidate) ||
        candidate.includes("*")
      ) {
        partial = true;
        unsafe = true;
      } else outputDirectories.push(candidate);
    }
    const rootDir = hasOwnDataRecord(compilerOptions) ? compilerOptions.rootDir : undefined;
    let copiedRootDir: string | undefined;
    if (rootDir !== undefined) {
      if (
        typeof rootDir === "string" &&
        (rootDir === "." || (validatePattern(rootDir) && !rootDir.includes("*")))
      ) {
        copiedRootDir = rootDir;
      } else {
        partial = true;
        unsafe = true;
      }
    }
    const baseUrlValue = hasOwnDataRecord(compilerOptions) ? compilerOptions.baseUrl : undefined;
    let baseUrl = ".";
    if (baseUrlValue !== undefined) {
      if (
        typeof baseUrlValue === "string" &&
        (baseUrlValue === "." || (validatePattern(baseUrlValue) && !baseUrlValue.includes("*")))
      ) {
        baseUrl = baseUrlValue;
      } else {
        partial = true;
        unsafe = true;
      }
    }
    const aliases = parseAliasRules(
      hasOwnDataRecord(compilerOptions) ? compilerOptions.paths : undefined,
      false,
    );
    if (aliases.unknown) {
      partial = true;
      unsafe = true;
    }
    return Object.freeze({
      baseUrl,
      baseUrlEnabled: baseUrlValue !== undefined,
      exclude,
      files: Object.freeze(explicitFiles.sort(compareCodeUnits)),
      filesPresent,
      hardExclude: Object.freeze([...new Set(outputDirectories)].sort(compareCodeUnits)),
      include,
      includePresent,
      partial,
      ...(copiedRootDir === undefined ? {} : { rootDir: copiedRootDir }),
      rules: aliases.rules,
      unsafe,
    });
  } catch {
    return invalid;
  }
}

function exactText(bytes: Uint8Array): string | undefined {
  try {
    const text = textDecoder.decode(bytes);
    const encoded = textEncoder.encode(text);
    if (encoded.byteLength !== bytes.byteLength) return undefined;
    for (let index = 0; index < bytes.byteLength; index += 1) {
      if (bytes[index] !== encoded[index]) return undefined;
    }
    return text;
  } catch {
    return undefined;
  }
}

async function work(request: ScannerRequest, state: ScanState): Promise<void> {
  if (request.cancellation.isCancellationRequested()) {
    throw new ScannerStop(
      "typescript-scanner-cancelled",
      "TypeScript scanner execution was cancelled",
    );
  }
  state.work += 1;
  if (state.work % heartbeatWorkInterval !== 0) return;
  state.sequence += 1;
  const heartbeat = request.observations.heartbeat({
    epoch: request.session.epoch,
    sequence: state.sequence,
  });
  if (!heartbeat.ok) {
    throw new ScannerStop(
      "typescript-scanner-sink-failed",
      "TypeScript scanner heartbeat was rejected",
      heartbeat.diagnostics,
    );
  }
  await Promise.resolve();
}

async function readFile(
  request: ScannerRequest,
  state: ScanState,
  scope: string,
  resource: string,
): Promise<FileEvidence> {
  await work(request, state);
  const read = await request.resources.read({ maxBytes: maxSourceBytes, resource, scope });
  if (!read.ok) {
    throw new ScannerStop(
      "typescript-scanner-resource-failed",
      "TypeScript scanner could not read a selected project resource",
      read.diagnostics,
    );
  }
  const bytes = new Uint8Array(read.value.bytes);
  state.bytes += bytes.byteLength;
  if (bytes.byteLength > maxSourceBytes || state.bytes > maxReadableBytes) {
    throw new ScannerStop(
      "typescript-scanner-budget-exceeded",
      "TypeScript scanner byte budget was exceeded",
    );
  }
  const text = exactText(bytes);
  if (text === undefined) {
    throw new ScannerStop(
      "typescript-scanner-invalid-text",
      "TypeScript scanner selected a resource that is not exact UTF-8 text",
    );
  }
  return Object.freeze({
    byteOffsets: new Map([[0, 0]]),
    bytes,
    fingerprint: `sha256:${sha256(bytes)}`,
    resource,
    scope,
    text,
  });
}

async function enumerateDirectory(
  request: ScannerRequest,
  state: ScanState,
  scope: string,
  resource: string,
): Promise<readonly ScannerResourceEntry[]> {
  const entries: ScannerResourceEntry[] = [];
  const seenCursors = new Set<string>();
  const seenResources = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  do {
    pages += 1;
    state.pages += 1;
    if (pages > maxPagesPerDirectory || state.pages > maxEnumerationPages) {
      throw new ScannerStop(
        "typescript-scanner-budget-exceeded",
        "TypeScript scanner enumeration page budget was exceeded",
      );
    }
    await work(request, state);
    const page = await request.resources.enumerate({
      ...(cursor === undefined ? {} : { cursor }),
      limit: inventoryPageSize,
      maxDepth: 0,
      resource,
      scope,
    });
    if (!page.ok) {
      throw new ScannerStop(
        "typescript-scanner-resource-failed",
        "TypeScript scanner could not enumerate a selected project directory",
        page.diagnostics,
      );
    }
    for (const entry of page.value.entries) {
      if (seenResources.has(entry.resource)) {
        throw new ScannerStop(
          "typescript-scanner-resource-failed",
          "TypeScript scanner received a repeated project resource page entry",
        );
      }
      seenResources.add(entry.resource);
      entries.push(entry);
    }
    const nextCursor = page.value.nextCursor;
    if (
      nextCursor !== undefined &&
      (page.value.entries.length === 0 || nextCursor === cursor || seenCursors.has(nextCursor))
    ) {
      throw new ScannerStop(
        "typescript-scanner-resource-failed",
        "TypeScript scanner received a nonadvancing resource cursor",
      );
    }
    if (nextCursor !== undefined) seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor !== undefined);
  return Object.freeze(
    entries.sort((left, right) => compareCodeUnits(left.resource, right.resource)),
  );
}

async function inventoryScope(
  request: ScannerRequest,
  state: ScanState,
  config: ScannerConfiguration,
  scope: string,
  root: string,
): Promise<ScopeInventory> {
  const queue = [root];
  const files: string[] = [];
  const normalizedResources = new Map<string, string>();
  let directories = 0;
  let resources = 0;
  let partial = false;
  const conflictingAliases = new Set<string>();
  let ignoreRules: readonly IgnoreRule[] = Object.freeze([]);
  let tsExclude: readonly string[] = Object.freeze([]);
  let tsFiles: readonly string[] = Object.freeze([]);
  let tsFilesPresent = false;
  let tsHardExclude: readonly string[] = Object.freeze([]);
  let tsInclude: readonly string[] = Object.freeze([]);
  let tsIncludePresent = false;
  let configuredSourceRoots: readonly string[] = Object.freeze([]);
  let aliases: ModuleAliasPolicy = Object.freeze({
    baseResource: root,
    fallback: false,
    rules: Object.freeze([]),
    unknown: false,
  });
  const emptyPartial = (): ScopeInventory =>
    Object.freeze({
      aliases,
      configuredSourceRoots: Object.freeze([]),
      files: Object.freeze([]),
      partial: true,
    });
  while (queue.length > 0) {
    const directory = queue.shift()!;
    directories += 1;
    if (directories > maxDirectories) {
      throw new ScannerStop(
        "typescript-scanner-budget-exceeded",
        "TypeScript scanner directory budget was exceeded",
      );
    }
    const entries = await enumerateDirectory(request, state, scope, directory);
    resources += entries.length;
    if (resources > maxResources) {
      throw new ScannerStop(
        "typescript-scanner-budget-exceeded",
        "TypeScript scanner resource budget was exceeded",
      );
    }
    if (
      directory !== root &&
      entries.some((entry) => [".gitignore", "tsconfig.json"].includes(basename(entry.resource)))
    ) {
      partial = true;
      continue;
    }
    if (directory === root) {
      const byName = new Map(entries.map((entry) => [basename(entry.resource), entry] as const));
      const gitignore = byName.get(".gitignore");
      if (gitignore !== undefined && gitignore.kind !== "file") return emptyPartial();
      if (gitignore?.kind === "file") {
        if (gitignore.size === undefined || gitignore.size > maxSourceBytes) return emptyPartial();
        else {
          const file = await readFile(request, state, scope, gitignore.resource);
          const parsed = parseGitignore(file.text);
          ignoreRules = parsed.rules;
          if (parsed.partial) return emptyPartial();
        }
      }
      const tsconfig = byName.get("tsconfig.json");
      if (tsconfig !== undefined && tsconfig.kind !== "file") return emptyPartial();
      if (tsconfig?.kind === "file") {
        if (tsconfig.size === undefined || tsconfig.size > maxSourceBytes) return emptyPartial();
        else {
          const file = await readFile(request, state, scope, tsconfig.resource);
          const parsed = parseTsconfig(file.text);
          tsExclude = parsed.exclude;
          tsFiles = parsed.files;
          tsFilesPresent = parsed.filesPresent;
          tsHardExclude = parsed.hardExclude;
          tsInclude = parsed.include;
          tsIncludePresent = parsed.includePresent;
          if (parsed.unsafe) return emptyPartial();
          partial ||= parsed.partial;
          configuredSourceRoots = Object.freeze(
            parsed.rootDir === undefined
              ? []
              : [parsed.rootDir === "." ? root : joinResource(root, parsed.rootDir)],
          );
          aliases = Object.freeze({
            baseResource: parsed.baseUrl === "." ? root : joinResource(root, parsed.baseUrl),
            fallback: parsed.baseUrlEnabled,
            rules: parsed.rules,
            unknown: false,
          });
        }
      }
    }
    for (const entry of entries) {
      const normalized = entry.resource.normalize("NFC").toLowerCase();
      const alias = normalizedResources.get(normalized);
      if (alias !== undefined && alias !== entry.resource) {
        partial = true;
        conflictingAliases.add(normalized);
      } else {
        normalizedResources.set(normalized, entry.resource);
      }
    }
    for (const entry of entries) {
      const relative = relativeResource(entry.resource, root);
      if (relative === undefined || !portableResourcePattern.test(entry.resource)) {
        partial = true;
        continue;
      }
      const normalized = entry.resource.normalize("NFC").toLowerCase();
      if (conflictingAliases.has(normalized)) continue;
      const directoryEntry = entry.kind === "directory";
      if (
        excludedByKnownRule(relative, directoryEntry) ||
        matchesPatterns(relative, config.exclude) ||
        matchesPatterns(relative, tsHardExclude) ||
        ignored(relative, directoryEntry, ignoreRules)
      ) {
        continue;
      }
      if (entry.kind === "directory") {
        queue.push(entry.resource);
      } else if (entry.kind === "file") {
        if (
          entry.resource !== joinResource(root, ".gitignore") &&
          entry.resource.endsWith("/.gitignore")
        ) {
          partial = true;
        }
        if (
          entry.resource !== joinResource(root, "tsconfig.json") &&
          entry.resource.endsWith("/tsconfig.json")
        ) {
          partial = true;
        }
        const selectable =
          basename(entry.resource) === "package.json" ||
          /^README(?:\.[^/]*)?$/i.test(basename(entry.resource)) ||
          sourceExtensionPattern.test(entry.resource);
        const projectMetadata =
          basename(entry.resource) === "package.json" ||
          /^README(?:\.[^/]*)?$/i.test(basename(entry.resource));
        if (!selectable || (!projectMetadata && !included(relative, config.include))) continue;
        if (sourceExtensionPattern.test(entry.resource)) {
          const explicit = tsFilesPresent && tsFiles.includes(relative);
          const includedByTsconfig =
            tsIncludePresent &&
            tsInclude.length > 0 &&
            included(relative, tsInclude) &&
            !matchesPatterns(relative, tsExclude);
          const implicit =
            !tsFilesPresent && !tsIncludePresent && !matchesPatterns(relative, tsExclude);
          if (!explicit && !includedByTsconfig && !implicit) continue;
        }
        const size = entry.size ?? maxSourceBytes;
        if (size > maxSourceBytes) {
          partial = true;
          continue;
        }
        files.push(entry.resource);
      } else {
        partial = true;
      }
    }
    queue.sort(compareCodeUnits);
  }
  for (const explicit of tsFiles) {
    const resource = joinResource(root, explicit);
    if (
      !included(explicit, config.include) ||
      excludedByKnownRule(explicit, false) ||
      matchesPatterns(explicit, config.exclude) ||
      matchesPatterns(explicit, tsHardExclude) ||
      ignored(explicit, false, ignoreRules)
    )
      continue;
    if (!files.includes(resource)) partial = true;
  }
  return Object.freeze({
    aliases,
    configuredSourceRoots,
    files: Object.freeze(
      files
        .filter((resource) => !conflictingAliases.has(resource.normalize("NFC").toLowerCase()))
        .sort(compareCodeUnits),
    ),
    partial,
  });
}

function collectConditionalTargets(
  value: unknown,
  output: string[],
  depth = 0,
  allowWildcard = false,
): boolean {
  if (depth > 16 || output.length >= maxPackageEntryLiterals) return false;
  if (typeof value === "string") {
    if (!validAliasTarget(value) || (!allowWildcard && value.includes("*"))) return false;
    output.push(value);
    return true;
  }
  if (Array.isArray(value)) {
    if (value.length > maxPackageEntryLiterals) return false;
    let complete = true;
    for (const item of value)
      complete = collectConditionalTargets(item, output, depth + 1, allowWildcard) && complete;
    return complete;
  }
  if (hasOwnDataRecord(value)) {
    const keys = Object.keys(value).sort(compareCodeUnits);
    if (keys.length > maxPackageEntryLiterals) return false;
    let complete = true;
    for (const key of keys) {
      if (
        key.startsWith(".") ||
        !validObservationText(key, 128) ||
        key.includes("/") ||
        key.includes("*") ||
        key.includes("\\")
      )
        return false;
      complete =
        collectConditionalTargets(value[key], output, depth + 1, allowWildcard) && complete;
    }
    return complete;
  }
  return value === undefined || value === null;
}

function matchingResources(
  baseResource: string,
  specifier: string,
  resources: ReadonlySet<string>,
): readonly string[] {
  const base = normalizeRelative(baseResource, specifier);
  if (base === undefined) return Object.freeze([]);
  const candidates = new Set<string>([
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.d.ts`,
    `${base}.d.mts`,
    `${base}.d.cts`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.mts`,
    `${base}/index.cts`,
    `${base}/index.js`,
    `${base}/index.jsx`,
    `${base}/index.d.ts`,
    `${base}/index.d.mts`,
    `${base}/index.d.cts`,
  ]);
  if (/\.[cm]?jsx?$/.test(base)) {
    const stem = base.replace(/\.[cm]?jsx?$/, "");
    candidates.add(`${stem}.ts`);
    candidates.add(`${stem}.tsx`);
    candidates.add(`${stem}.mts`);
    candidates.add(`${stem}.cts`);
    if (/\.mjs$/.test(base)) candidates.add(`${stem}.d.mts`);
    else if (/\.cjs$/.test(base)) candidates.add(`${stem}.d.cts`);
    else if (/\.jsx?$/.test(base)) candidates.add(`${stem}.d.ts`);
  }
  return Object.freeze(
    [...candidates].filter((candidate) => resources.has(candidate)).sort(compareCodeUnits),
  );
}

function resolveFromBase(
  baseResource: string,
  specifier: string,
  resources: ReadonlySet<string>,
): string | undefined {
  const matches = matchingResources(baseResource, specifier, resources);
  return matches.length === 1 ? matches[0] : undefined;
}

function resolveResource(
  fromResource: string,
  specifier: string,
  resources: ReadonlySet<string>,
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  return resolveFromBase(dirname(fromResource), specifier, resources);
}

function packageEntries(
  manifest: Readonly<Record<string, unknown>>,
  manifestResource: string,
  resources: ReadonlySet<string>,
): Readonly<{ readonly entries: readonly PackageEntryEvidence[]; readonly partial: boolean }> {
  const literals: Array<Readonly<{ publicSubpath: string; target: string }>> = [];
  let complete = true;
  const hasExports = Object.hasOwn(manifest, "exports");
  const appendExports = (publicSubpath: string, value: unknown): void => {
    const targets: string[] = [];
    if (
      !validPublicSubpath(publicSubpath) ||
      !collectConditionalTargets(value, targets) ||
      targets.some((target) => !validPackagePath(target, true))
    ) {
      complete = false;
      return;
    }
    for (const target of targets) literals.push(Object.freeze({ publicSubpath, target }));
  };
  if (hasExports) {
    const exportsValue = manifest.exports;
    if (hasOwnDataRecord(exportsValue)) {
      const keys = Object.keys(exportsValue).sort(compareCodeUnits);
      const subpathKeys = keys.filter((key) => key.startsWith("."));
      if (keys.length > maxPackageEntryLiterals) {
        complete = false;
      } else if (subpathKeys.length === keys.length) {
        for (const publicSubpath of keys) appendExports(publicSubpath, exportsValue[publicSubpath]);
      } else if (subpathKeys.length === 0) {
        appendExports(".", exportsValue);
      } else {
        complete = false;
      }
    } else {
      appendExports(".", exportsValue);
    }
  } else {
    for (const key of ["main", "module", "types"] as const) {
      const target = manifest[key];
      if (target === undefined) continue;
      if (!validPackagePath(target, false)) complete = false;
      else literals.push(Object.freeze({ publicSubpath: ".", target }));
    }
  }
  const resolved = new Map<string, PackageEntryEvidence>();
  for (const literal of literals.sort(
    (left, right) =>
      compareCodeUnits(left.publicSubpath, right.publicSubpath) ||
      compareCodeUnits(left.target, right.target),
  )) {
    const entry = literal.target.startsWith("./")
      ? resolveResource(manifestResource, literal.target, resources)
      : resolveFromBase(dirname(manifestResource), literal.target, resources);
    if (entry === undefined) complete = false;
    else {
      const identity = `${literal.publicSubpath}\u0000${entry}`;
      resolved.set(
        identity,
        Object.freeze({ publicSubpath: literal.publicSubpath, target: entry }),
      );
    }
  }
  return Object.freeze({
    entries: Object.freeze([...resolved.values()]),
    partial: !complete,
  });
}

function packageImportRules(value: unknown): Readonly<{
  readonly partial: boolean;
  readonly rules: readonly ModuleAliasRule[];
  readonly unknown: boolean;
}> {
  if (value === undefined)
    return Object.freeze({ partial: false, rules: Object.freeze([]), unknown: false });
  if (!hasOwnDataRecord(value)) {
    return Object.freeze({ partial: true, rules: Object.freeze([]), unknown: true });
  }
  const keys = Object.keys(value).sort(compareCodeUnits);
  if (keys.length > 128)
    return Object.freeze({ partial: true, rules: Object.freeze([]), unknown: true });
  const rules: ModuleAliasRule[] = [];
  let partial = false;
  for (const key of keys) {
    const targets: string[] = [];
    if (
      !validModulePattern(key, true) ||
      !key.startsWith("#") ||
      key === "#" ||
      !collectConditionalTargets(value[key], targets, 0, true) ||
      targets.length === 0 ||
      targets.length > 8
    ) {
      return Object.freeze({ partial: true, rules: Object.freeze([]), unknown: true });
    }
    const local = targets.every((target) => target.startsWith("./"));
    if (local && targets.some((target) => !validPackagePath(target, true, true))) {
      return Object.freeze({ partial: true, rules: Object.freeze([]), unknown: true });
    }
    partial ||= !local;
    rules.push(
      Object.freeze({
        key,
        targets: Object.freeze(local ? [...new Set(targets)].sort(compareCodeUnits) : []),
      }),
    );
  }
  return Object.freeze({ partial, rules: Object.freeze(rules), unknown: false });
}

function workspacePatterns(
  value: unknown,
): Readonly<{ readonly partial: boolean; readonly patterns: readonly string[] }> {
  if (value === undefined) {
    return Object.freeze({ partial: false, patterns: Object.freeze([]) });
  }
  let candidate: unknown = value;
  if (hasOwnDataRecord(value)) {
    const keys = Object.keys(value).sort(compareCodeUnits);
    if (keys.length !== 1 || keys[0] !== "packages") {
      return Object.freeze({ partial: true, patterns: Object.freeze([]) });
    }
    candidate = value.packages;
  }
  if (!Array.isArray(candidate) || candidate.length > 128) {
    return Object.freeze({ partial: true, patterns: Object.freeze([]) });
  }
  const patterns: string[] = [];
  const seen = new Set<string>();
  for (const item of candidate) {
    if (!validatePattern(item) || item === "." || seen.has(item)) {
      return Object.freeze({ partial: true, patterns: Object.freeze([]) });
    }
    seen.add(item);
    patterns.push(item);
  }
  return Object.freeze({
    partial: false,
    patterns: Object.freeze(patterns.sort(compareCodeUnits)),
  });
}

function workspacePatternMatches(root: string, pattern: string): boolean {
  return pattern.includes("*")
    ? globExpression(pattern, false, false).test(root)
    : root === pattern;
}

function parsePackage(
  file: FileEvidence,
  resources: ReadonlySet<string>,
  scopeRoot: string,
): Readonly<{
  readonly description?: string;
  readonly package?: PackageEvidence;
  readonly partial: boolean;
}> {
  try {
    const parsed: unknown = JSON.parse(file.text);
    if (!hasOwnDataRecord(parsed)) return Object.freeze({ partial: true });
    const name = parsed.name;
    if (typeof name !== "string" || !validObservationText(name, 256)) {
      return Object.freeze({ partial: true });
    }
    const entries = packageEntries(parsed, file.resource, resources);
    const imports = packageImportRules(parsed.imports);
    const root = dirname(file.resource);
    const workspaces =
      root === scopeRoot
        ? workspacePatterns(parsed.workspaces)
        : Object.freeze({ partial: false, patterns: Object.freeze([]) });
    return Object.freeze({
      ...(typeof parsed.description === "string" && parsed.description.length > 0
        ? { description: parsed.description }
        : {}),
      package: Object.freeze({
        entries: entries.entries,
        imports: Object.freeze({
          baseResource: root,
          fallback: false,
          rules: imports.rules,
          unknown: imports.unknown,
        }),
        name,
        provenance: fullProvenance(file),
        resource: file.resource,
        root,
        scope: file.scope,
        workspacePatterns: workspaces.patterns,
      }),
      partial: entries.partial || imports.partial || workspaces.partial,
    });
  } catch {
    return Object.freeze({ partial: true });
  }
}

function propertyName(value: unknown, computed: unknown): string | undefined {
  if (computed === true) return literalString(value);
  return identifierName(value) ?? literalString(value);
}

function leadingJsdoc(
  node: AstNode,
): Readonly<{ readonly end: number; readonly start: number }> | undefined {
  const comments = node.leadingComments;
  if (!Array.isArray(comments) || comments.length === 0) return undefined;
  const candidate = comments.at(-1);
  if (
    !isAstNode(candidate) ||
    candidate.type !== "CommentBlock" ||
    typeof candidate.value !== "string"
  )
    return undefined;
  if (!candidate.value.startsWith("*")) return undefined;
  const range = nodeRange(candidate);
  return range.end > range.start ? range : undefined;
}

function callableDeclaration(
  node: AstNode,
): Readonly<{ readonly name: string; readonly node: AstNode }> | undefined {
  if (node.type === "FunctionDeclaration" || node.type === "TSDeclareFunction") {
    const name = identifierName(node.id);
    return name === undefined ? undefined : Object.freeze({ name, node });
  }
  return undefined;
}

function variableCallables(
  node: AstNode,
): readonly Readonly<{ readonly name: string; readonly node: AstNode }>[] {
  if (node.type !== "VariableDeclaration" || !Array.isArray(node.declarations))
    return Object.freeze([]);
  const output: Array<Readonly<{ readonly name: string; readonly node: AstNode }>> = [];
  for (const declaration of node.declarations) {
    if (!isAstNode(declaration)) continue;
    const name = identifierName(declaration.id);
    const initializer = declaration.init;
    if (
      name !== undefined &&
      isAstNode(initializer) &&
      (initializer.type === "ArrowFunctionExpression" || initializer.type === "FunctionExpression")
    ) {
      output.push(Object.freeze({ name, node: declaration }));
    }
  }
  return Object.freeze(output);
}

function bindingContainsBun(value: unknown, consume: () => void): boolean {
  if (!isAstNode(value)) return false;
  const stack: Array<Readonly<{ readonly depth: number; readonly node: AstNode }>> = [
    Object.freeze({ depth: 0, node: value }),
  ];
  let inspected = 0;
  while (stack.length > 0) {
    consume();
    const current = stack.pop()!;
    inspected += 1;
    if (inspected > 256 || current.depth > 32) return true;
    if (current.node.type === "Identifier") {
      if (current.node.name === "Bun") return true;
      continue;
    }
    const children: unknown[] = [];
    if (current.node.type === "RestElement") children.push(current.node.argument);
    else if (current.node.type === "AssignmentPattern") children.push(current.node.left);
    else if (current.node.type === "ArrayPattern" && Array.isArray(current.node.elements))
      children.push(...current.node.elements);
    else if (current.node.type === "ObjectPattern" && Array.isArray(current.node.properties)) {
      for (const property of current.node.properties) {
        if (!isAstNode(property)) continue;
        children.push(property.type === "RestElement" ? property.argument : property.value);
      }
    }
    for (const child of children) {
      if (isAstNode(child)) stack.push({ depth: current.depth + 1, node: child });
    }
  }
  return false;
}

function nodeDeclaresBun(value: AstNode, consume: () => void): boolean {
  if (
    (value.type === "VariableDeclarator" && bindingContainsBun(value.id, consume)) ||
    ((value.type === "FunctionDeclaration" ||
      value.type === "FunctionExpression" ||
      value.type === "ClassDeclaration" ||
      value.type === "ClassExpression" ||
      value.type === "TSDeclareFunction") &&
      bindingContainsBun(value.id, consume)) ||
    (value.type === "CatchClause" && bindingContainsBun(value.param, consume)) ||
    ((value.type === "ImportSpecifier" ||
      value.type === "ImportDefaultSpecifier" ||
      value.type === "ImportNamespaceSpecifier") &&
      bindingContainsBun(value.local, consume))
  ) {
    return true;
  }
  if (
    (value.type === "FunctionDeclaration" ||
      value.type === "FunctionExpression" ||
      value.type === "ArrowFunctionExpression" ||
      value.type === "ObjectMethod" ||
      value.type === "ClassMethod") &&
    Array.isArray(value.params) &&
    value.params.some((parameter) => bindingContainsBun(parameter, consume))
  ) {
    return true;
  }
  return false;
}

function commonJsTrackedName(value: unknown): CommonJsTrackedName | undefined {
  const name = identifierName(value);
  return name === "Object" || name === "exports" || name === "module" || name === "require"
    ? name
    : undefined;
}

function collectCommonJsPatternBindings(
  scope: CommonJsLexicalScope,
  value: unknown,
  consume: () => void,
): boolean {
  if (!isAstNode(value)) return true;
  const stack: Array<Readonly<{ readonly depth: number; readonly node: AstNode }>> = [
    Object.freeze({ depth: 0, node: value }),
  ];
  let inspected = 0;
  while (stack.length > 0) {
    consume();
    const current = stack.pop()!;
    inspected += 1;
    if (inspected > 256 || current.depth > 32) return false;
    const binding = commonJsTrackedName(current.node);
    if (binding !== undefined) {
      scope.bindings.add(binding);
      continue;
    }
    const children: unknown[] = [];
    if (current.node.type === "RestElement") children.push(current.node.argument);
    else if (current.node.type === "AssignmentPattern") children.push(current.node.left);
    else if (current.node.type === "TSParameterProperty") children.push(current.node.parameter);
    else if (current.node.type === "ArrayPattern" && Array.isArray(current.node.elements))
      children.push(...current.node.elements);
    else if (current.node.type === "ObjectPattern" && Array.isArray(current.node.properties)) {
      for (const property of current.node.properties) {
        if (!isAstNode(property)) continue;
        children.push(property.type === "RestElement" ? property.argument : property.value);
      }
    }
    for (const child of children) {
      if (isAstNode(child)) stack.push({ depth: current.depth + 1, node: child });
    }
  }
  return true;
}

function commonJsScopeKind(node: AstNode): CommonJsLexicalScope["kind"] | undefined {
  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "ObjectMethod" ||
    node.type === "ClassMethod" ||
    node.type === "ClassPrivateMethod" ||
    node.type === "TSDeclareFunction" ||
    node.type === "TSDeclareMethod"
  )
    return "function";
  if (node.type === "ClassDeclaration" || node.type === "ClassExpression") return "class";
  if (
    node.type === "BlockStatement" ||
    node.type === "CatchClause" ||
    node.type === "ForStatement" ||
    node.type === "ForInStatement" ||
    node.type === "ForOfStatement" ||
    node.type === "SwitchStatement"
  )
    return "lexical";
  if (node.type === "StaticBlock" || node.type === "TSModuleBlock") return "var-boundary";
  return undefined;
}

function nearestCommonJsVarScope(scope: CommonJsLexicalScope): CommonJsLexicalScope {
  let current = scope;
  while (
    current.kind !== "function" &&
    current.kind !== "program" &&
    current.kind !== "var-boundary" &&
    current.parent !== undefined
  )
    current = current.parent;
  return current;
}

function isCommonJsFunctionScope(node: AstNode): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "ObjectMethod" ||
    node.type === "ClassMethod" ||
    node.type === "ClassPrivateMethod" ||
    node.type === "TSDeclareFunction" ||
    node.type === "TSDeclareMethod"
  );
}

function commonJsMemberRoot(
  value: unknown,
  consume: () => void,
): Readonly<{ readonly bounded: boolean; readonly name?: "exports" | "module" }> {
  let current = value;
  for (let depth = 0; depth <= 32; depth += 1) {
    consume();
    if (!isAstNode(current) || current.type !== "MemberExpression") {
      return Object.freeze({ bounded: true });
    }
    const object = current.object;
    if (identifierName(object) === "exports") {
      return Object.freeze({ bounded: true, name: "exports" });
    }
    if (
      identifierName(object) === "module" &&
      propertyName(current.property, current.computed) === "exports"
    ) {
      return Object.freeze({ bounded: true, name: "module" });
    }
    current = object;
  }
  return Object.freeze({ bounded: false });
}

function commonJsUse(scope: CommonJsLexicalScope, ...names: CommonJsTrackedName[]): CommonJsUse {
  return Object.freeze({ names: Object.freeze(names), scope });
}

function hasUnshadowedCommonJsUsage(root: AstNode, consume: () => void): boolean {
  const program: CommonJsLexicalScope = {
    bindings: new Set(),
    kind: "program",
  };
  const uses: CommonJsUse[] = [];
  const stack: Array<
    Readonly<{
      readonly depth: number;
      readonly enclosing: CommonJsLexicalScope;
      readonly node: AstNode;
      readonly scope: CommonJsLexicalScope;
    }>
  > = [Object.freeze({ depth: 0, enclosing: program, node: root, scope: program })];
  let bounded = true;
  let nodes = 0;
  while (stack.length > 0) {
    consume();
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > maxAstNodesPerFile || current.depth > maxAstDepth) return true;
    const node = current.node;
    const scope = current.scope;
    const enclosing = current.enclosing;
    if (node.type === "VariableDeclaration" && Array.isArray(node.declarations)) {
      const target = node.kind === "var" ? nearestCommonJsVarScope(scope) : scope;
      for (const declaration of node.declarations) {
        if (!isAstNode(declaration)) continue;
        bounded = collectCommonJsPatternBindings(target, declaration.id, consume) && bounded;
      }
    } else if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression" ||
      node.type === "ObjectMethod" ||
      node.type === "ClassMethod" ||
      node.type === "ClassPrivateMethod" ||
      node.type === "TSDeclareFunction" ||
      node.type === "TSDeclareMethod"
    ) {
      const name = commonJsTrackedName(node.id);
      if (name !== undefined) {
        if (node.type === "FunctionDeclaration") enclosing.bindings.add(name);
        scope.bindings.add(name);
      }
      if (Array.isArray(node.params)) {
        for (const parameter of node.params)
          bounded = collectCommonJsPatternBindings(scope, parameter, consume) && bounded;
      }
    } else if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      const name = commonJsTrackedName(node.id);
      if (name !== undefined) {
        if (node.type === "ClassDeclaration") enclosing.bindings.add(name);
        scope.bindings.add(name);
      }
    } else if (node.type === "ImportDeclaration" && Array.isArray(node.specifiers)) {
      for (const specifier of node.specifiers) {
        if (!isAstNode(specifier)) continue;
        const name = commonJsTrackedName(specifier.local);
        if (name !== undefined) scope.bindings.add(name);
      }
    } else if (node.type === "TSImportEqualsDeclaration") {
      const name = commonJsTrackedName(node.id);
      if (name !== undefined) scope.bindings.add(name);
    } else if (node.type === "CatchClause") {
      bounded = collectCommonJsPatternBindings(scope, node.param, consume) && bounded;
    }
    if (
      (node.type === "CallExpression" || node.type === "OptionalCallExpression") &&
      identifierName(node.callee) === "require"
    ) {
      uses.push(commonJsUse(scope, "require"));
    }
    if (node.type === "MemberExpression") {
      const rootName = commonJsMemberRoot(node, consume);
      bounded &&= rootName.bounded;
      if (rootName.name !== undefined) uses.push(commonJsUse(scope, rootName.name));
    }
    if (
      (node.type === "CallExpression" || node.type === "OptionalCallExpression") &&
      isAstNode(node.callee) &&
      node.callee.type === "MemberExpression" &&
      identifierName(node.callee.object) === "Object" &&
      propertyName(node.callee.property, node.callee.computed) === "defineProperty" &&
      Array.isArray(node.arguments)
    ) {
      const target = node.arguments[0];
      if (identifierName(target) === "exports") uses.push(commonJsUse(scope, "Object", "exports"));
      else {
        const rootName = commonJsMemberRoot(target, consume);
        bounded &&= rootName.bounded;
        if (rootName.name !== undefined) uses.push(commonJsUse(scope, "Object", rootName.name));
      }
    }
    const children: Array<Readonly<{ readonly key: string; readonly node: AstNode }>> = [];
    for (const [key, child] of Object.entries(node)) {
      if (isAstNode(child)) children.push(Object.freeze({ key, node: child }));
      else if (Array.isArray(child)) {
        for (const item of child)
          if (isAstNode(item)) children.push(Object.freeze({ key, node: item }));
      }
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index]!;
      const evaluatesOutsideFunction =
        child.key === "key" &&
        node.computed === true &&
        (node.type === "ObjectMethod" ||
          node.type === "ClassMethod" ||
          node.type === "ClassPrivateMethod");
      const parentScope = evaluatesOutsideFunction ? enclosing : scope;
      const kind =
        child.key === "body" &&
        child.node.type === "BlockStatement" &&
        isCommonJsFunctionScope(node)
          ? "var-boundary"
          : commonJsScopeKind(child.node);
      const childScope: CommonJsLexicalScope =
        kind === undefined ? parentScope : { bindings: new Set(), kind, parent: parentScope };
      stack.push({
        depth: current.depth + 1,
        enclosing: parentScope,
        node: child.node,
        scope: childScope,
      });
    }
  }
  if (uses.length === 0) return false;
  if (!bounded) return true;
  return uses.some((use) => {
    return use.names.every((name) => {
      let scope: CommonJsLexicalScope | undefined = use.scope;
      while (scope !== undefined) {
        if (scope.bindings.has(name)) return false;
        scope = scope.parent;
      }
      return true;
    });
  });
}

function walkAst(root: AstNode, visit: (node: AstNode) => void, consume: () => void): boolean {
  const stack: Array<Readonly<{ readonly depth: number; readonly node: AstNode }>> = [
    Object.freeze({ depth: 0, node: root }),
  ];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > maxAstNodesPerFile || current.depth > maxAstDepth) return false;
    consume();
    visit(current.node);
    const children: AstNode[] = [];
    for (const child of Object.values(current.node)) {
      if (isAstNode(child)) children.push(child);
      else if (Array.isArray(child)) {
        for (const item of child) if (isAstNode(item)) children.push(item);
      }
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: current.depth + 1, node: children[index]! });
    }
  }
  return true;
}

function extractStaticRoutes(
  call: AstNode,
  bunShadowed: boolean,
): Readonly<{ readonly partial: boolean; readonly routes: readonly RouteEvidence[] }> {
  if (bunShadowed || !Array.isArray(call.arguments) || !isAstNode(call.arguments[0])) {
    return Object.freeze({ partial: true, routes: Object.freeze([]) });
  }
  const configuration = call.arguments[0];
  if (configuration.type !== "ObjectExpression" || !Array.isArray(configuration.properties)) {
    return Object.freeze({ partial: true, routes: Object.freeze([]) });
  }
  const properties: AstNode[] = [];
  for (const property of configuration.properties) {
    if (!isAstNode(property) || property.type !== "ObjectProperty") {
      return Object.freeze({ partial: true, routes: Object.freeze([]) });
    }
    if (propertyName(property.key, property.computed) === undefined) {
      return Object.freeze({ partial: true, routes: Object.freeze([]) });
    }
    properties.push(property);
  }
  const routeProperties = properties.filter(
    (property) => propertyName(property.key, property.computed) === "routes",
  );
  if (routeProperties.length === 0) {
    return Object.freeze({ partial: false, routes: Object.freeze([]) });
  }
  if (routeProperties.length !== 1 || !isAstNode(routeProperties[0]!.value)) {
    return Object.freeze({ partial: true, routes: Object.freeze([]) });
  }
  const routesObject = routeProperties[0]!.value;
  if (routesObject.type !== "ObjectExpression" || !Array.isArray(routesObject.properties)) {
    return Object.freeze({ partial: true, routes: Object.freeze([]) });
  }
  const output: RouteEvidence[] = [];
  const callRange = nodeRange(call);
  const routeNames = new Set<string>();
  for (const route of routesObject.properties) {
    if (!isAstNode(route) || route.type !== "ObjectProperty") {
      return Object.freeze({ partial: true, routes: Object.freeze([]) });
    }
    const routePath = propertyName(route.key, route.computed);
    if (
      routePath === undefined ||
      !routePath.startsWith("/") ||
      !validObservationText(routePath, 248) ||
      routeNames.has(routePath)
    ) {
      return Object.freeze({ partial: true, routes: Object.freeze([]) });
    }
    routeNames.add(routePath);
    if (
      isAstNode(route.value) &&
      route.value.type === "ObjectExpression" &&
      Array.isArray(route.value.properties)
    ) {
      const methods: string[] = [];
      for (const method of route.value.properties) {
        if (
          !isAstNode(method) ||
          (method.type !== "ObjectMethod" && method.type !== "ObjectProperty")
        ) {
          return Object.freeze({ partial: true, routes: Object.freeze([]) });
        }
        const methodName = propertyName(method.key, method.computed);
        if (
          methodName === undefined ||
          !/^[A-Z]+$/.test(methodName) ||
          methods.includes(methodName)
        ) {
          return Object.freeze({ partial: true, routes: Object.freeze([]) });
        }
        methods.push(methodName);
      }
      if (methods.length === 0) {
        return Object.freeze({ partial: true, routes: Object.freeze([]) });
      }
      for (const method of methods.sort(compareCodeUnits)) {
        const name = `${method} ${routePath}`;
        if (!validObservationText(name, 256)) {
          return Object.freeze({ partial: true, routes: Object.freeze([]) });
        }
        output.push(
          Object.freeze({
            end: callRange.end,
            name,
            start: callRange.start,
          }),
        );
      }
    } else {
      output.push(
        Object.freeze({
          end: callRange.end,
          name: `ROUTE ${routePath}`,
          start: callRange.start,
        }),
      );
    }
  }
  return Object.freeze({ partial: false, routes: Object.freeze(output) });
}

function typeOnlySpecifier(node: AstNode): boolean {
  return node.importKind === "type" || node.importKind === "typeof" || node.exportKind === "type";
}

function parseSource(file: FileEvidence, budget: ExtractionBudget): ParsedSource {
  let tree: unknown;
  try {
    tree = parse(file.text, {
      allowAwaitOutsideFunction: true,
      errorRecovery: false,
      plugins: ["typescript", "jsx"],
      sourceType: "unambiguous",
    });
  } catch {
    return Object.freeze({
      callables: new Map(),
      imports: Object.freeze([]),
      partial: true,
      reexports: Object.freeze([]),
      routes: Object.freeze([]),
    });
  }
  if (!isAstNode(tree) || !isAstNode(tree.program) || !Array.isArray(tree.program.body)) {
    return Object.freeze({
      callables: new Map(),
      imports: [],
      partial: true,
      reexports: [],
      routes: [],
    });
  }
  const body = tree.program.body;
  let bunShadowed = false;
  let traversalPartial = hasUnshadowedCommonJsUsage(tree.program, () =>
    chargeExtractionWork(budget),
  );
  const bunServeCalls: AstNode[] = [];
  const nestedTypeImports: ImportEvidence[] = [];
  const unsupportedImportedBindings = new Set<string>();
  const boundedAst = walkAst(
    tree.program,
    (node) => {
      bunShadowed ||= nodeDeclaresBun(node, () => chargeExtractionWork(budget));
      if (node.type === "ImportExpression") {
        traversalPartial = true;
      } else if (node.type === "CallExpression" || node.type === "OptionalCallExpression") {
        const callee = node.callee;
        if (isAstNode(callee) && callee.type === "Import") traversalPartial = true;
        if (
          isAstNode(callee) &&
          callee.type === "MemberExpression" &&
          identifierName(callee.object) === "Bun" &&
          propertyName(callee.property, callee.computed) === "serve"
        ) {
          bunServeCalls.push(node);
        }
      } else if (node.type === "TSExportAssignment") {
        traversalPartial = true;
      } else if (node.type === "TSImportType") {
        const sourceNode = isAstNode(node.source) ? node.source : node.argument;
        const source = literalString(sourceNode);
        const range = isAstNode(sourceNode) ? nodeRange(sourceNode) : nodeRange(node);
        if (source === undefined) traversalPartial = true;
        else nestedTypeImports.push(Object.freeze({ end: range.end, source, start: range.start }));
      } else if (node.type === "TSImportEqualsDeclaration") {
        const local = identifierName(node.id);
        if (local === undefined || node.isExport === true) traversalPartial = true;
        else unsupportedImportedBindings.add(local);
        const moduleReference = node.moduleReference;
        const expression =
          isAstNode(moduleReference) && moduleReference.type === "TSExternalModuleReference"
            ? moduleReference.expression
            : undefined;
        const source = literalString(expression);
        const range = isAstNode(expression) ? nodeRange(expression) : nodeRange(node);
        if (source === undefined) traversalPartial = true;
        else nestedTypeImports.push(Object.freeze({ end: range.end, source, start: range.start }));
      }
    },
    () => chargeExtractionWork(budget),
  );
  if (!boundedAst) {
    return Object.freeze({
      callables: new Map(),
      imports: Object.freeze([]),
      partial: true,
      reexports: Object.freeze([]),
      routes: Object.freeze([]),
    });
  }
  let partial = traversalPartial;
  const importedBindings = new Map<string, ImportedBindingEvidence>();
  const locals = new Map<string, Readonly<{ readonly name: string; readonly node: AstNode }>>();
  for (const statement of body) {
    if (!isAstNode(statement)) continue;
    if (
      statement.type === "ExportNamedDeclaration" &&
      isAstNode(statement.declaration) &&
      statement.declaration.type === "TSImportEqualsDeclaration"
    ) {
      partial = true;
    }
    if (
      statement.type === "ImportDeclaration" &&
      statement.importKind !== "type" &&
      statement.importKind !== "typeof" &&
      Array.isArray(statement.specifiers)
    ) {
      const source = literalString(statement.source);
      if (source === undefined) partial = true;
      else {
        for (const specifier of statement.specifiers) {
          if (!isAstNode(specifier) || typeOnlySpecifier(specifier)) continue;
          const local = identifierName(specifier.local);
          const imported =
            specifier.type === "ImportDefaultSpecifier"
              ? "default"
              : specifier.type === "ImportSpecifier"
                ? propertyName(specifier.imported, false)
                : undefined;
          if (specifier.type === "ImportNamespaceSpecifier") continue;
          if (
            local === undefined ||
            imported === undefined ||
            !validObservationText(local, 256) ||
            !validObservationText(imported, 256) ||
            importedBindings.has(local)
          ) {
            partial = true;
            continue;
          }
          importedBindings.set(local, Object.freeze({ imported, source }));
        }
      }
    }
    const localDeclaration =
      statement.type === "ExportNamedDeclaration" &&
      isAstNode(statement.declaration) &&
      (statement.exportKind !== "type" || statement.declaration.type === "TSDeclareFunction")
        ? statement.declaration
        : statement;
    const declared = callableDeclaration(localDeclaration);
    if (declared !== undefined) locals.set(declared.name, declared);
    for (const variable of variableCallables(localDeclaration)) locals.set(variable.name, variable);
  }
  const callables = new Map<string, CallableEvidence>();
  const imports: ImportEvidence[] = [...nestedTypeImports];
  const reexports: ReexportEvidence[] = [];
  const routes: RouteEvidence[] = [];
  const addCallable = (name: string, declaration: AstNode, exportNode: AstNode): void => {
    const range = nodeRange(declaration);
    if (range.end <= range.start || !validObservationText(name, 256)) {
      partial = true;
      return;
    }
    const jsdoc = leadingJsdoc(declaration) ?? leadingJsdoc(exportNode);
    callables.set(
      name,
      Object.freeze({
        end: range.end,
        ...(jsdoc === undefined ? {} : { jsdoc }),
        name,
        resource: file.resource,
        start: range.start,
      }),
    );
  };
  for (const statement of body) {
    if (!isAstNode(statement)) continue;
    if (statement.type === "ImportDeclaration") {
      const source = literalString(statement.source);
      const range = isAstNode(statement.source)
        ? nodeRange(statement.source)
        : nodeRange(statement);
      if (source === undefined) partial = true;
      else imports.push(Object.freeze({ end: range.end, source, start: range.start }));
    }
    if (statement.type === "ExportNamedDeclaration") {
      if (
        isAstNode(statement.declaration) &&
        (statement.exportKind !== "type" || statement.declaration.type === "TSDeclareFunction")
      ) {
        const declared = callableDeclaration(statement.declaration);
        if (declared !== undefined) addCallable(declared.name, declared.node, statement);
        for (const variable of variableCallables(statement.declaration))
          addCallable(variable.name, variable.node, statement);
      }
      const source = literalString(statement.source);
      if (source !== undefined) {
        const range = isAstNode(statement.source)
          ? nodeRange(statement.source)
          : nodeRange(statement);
        imports.push(Object.freeze({ end: range.end, source, start: range.start }));
        const exported: Array<Readonly<{ readonly imported: string; readonly name: string }>> = [];
        if (statement.exportKind !== "type" && Array.isArray(statement.specifiers)) {
          for (const specifier of statement.specifiers) {
            if (!isAstNode(specifier) || typeOnlySpecifier(specifier)) continue;
            const imported = propertyName(specifier.local, false);
            const name = propertyName(specifier.exported, false);
            if (
              imported === undefined ||
              name === undefined ||
              !validObservationText(imported, 256) ||
              !validObservationText(name, 256)
            )
              partial = true;
            else exported.push(Object.freeze({ imported, name }));
          }
        }
        if (exported.length > 0) {
          reexports.push(Object.freeze({ exported: Object.freeze(exported), source }));
        }
      } else if (statement.exportKind !== "type" && Array.isArray(statement.specifiers)) {
        for (const specifier of statement.specifiers) {
          if (!isAstNode(specifier) || typeOnlySpecifier(specifier)) continue;
          const localName = propertyName(specifier.local, false);
          const exportedName = propertyName(specifier.exported, false);
          if (
            localName === undefined ||
            exportedName === undefined ||
            !validObservationText(localName, 256) ||
            !validObservationText(exportedName, 256)
          ) {
            partial = true;
            continue;
          }
          const local = locals.get(localName);
          if (local !== undefined && exportedName !== undefined)
            addCallable(exportedName, local.node, statement);
          else {
            const imported = importedBindings.get(localName);
            if (imported !== undefined) {
              reexports.push(
                Object.freeze({
                  exported: Object.freeze([
                    Object.freeze({ imported: imported.imported, name: exportedName }),
                  ]),
                  source: imported.source,
                }),
              );
            } else if (unsupportedImportedBindings.has(localName)) partial = true;
          }
        }
      }
    } else if (statement.type === "ExportAllDeclaration") {
      const source = literalString(statement.source);
      const range = isAstNode(statement.source)
        ? nodeRange(statement.source)
        : nodeRange(statement);
      if (source === undefined) partial = true;
      else {
        imports.push(Object.freeze({ end: range.end, source, start: range.start }));
        if (statement.exportKind !== "type") reexports.push(Object.freeze({ source }));
      }
    } else if (statement.type === "ExportDefaultDeclaration" && isAstNode(statement.declaration)) {
      if (
        statement.declaration.type === "FunctionDeclaration" ||
        statement.declaration.type === "FunctionExpression" ||
        statement.declaration.type === "ArrowFunctionExpression"
      ) {
        addCallable("default", statement.declaration, statement);
      } else if (statement.declaration.type === "Identifier") {
        const localName = identifierName(statement.declaration) ?? "";
        const local = locals.get(localName);
        if (local !== undefined) addCallable("default", local.node, statement);
        else {
          const imported = importedBindings.get(localName);
          if (imported !== undefined) {
            reexports.push(
              Object.freeze({
                exported: Object.freeze([
                  Object.freeze({ imported: imported.imported, name: "default" }),
                ]),
                source: imported.source,
              }),
            );
          } else if (unsupportedImportedBindings.has(localName)) partial = true;
        }
      }
    }
  }
  for (const call of bunServeCalls) {
    const extracted = extractStaticRoutes(call, bunShadowed);
    partial ||= extracted.partial;
    routes.push(...extracted.routes);
  }
  const offsets: number[] = [];
  for (const callable of callables.values()) {
    offsets.push(callable.start, callable.end);
    if (callable.jsdoc !== undefined) offsets.push(callable.jsdoc.start, callable.jsdoc.end);
  }
  for (const imported of imports) offsets.push(imported.start, imported.end);
  for (const route of routes) offsets.push(route.start, route.end);
  if (!cacheByteOffsets(file, offsets)) {
    return Object.freeze({
      callables: new Map(),
      imports: Object.freeze([]),
      partial: true,
      reexports: Object.freeze([]),
      routes: Object.freeze([]),
    });
  }
  return Object.freeze({
    callables,
    imports: Object.freeze(
      imports.sort(
        (left, right) => compareCodeUnits(left.source, right.source) || left.start - right.start,
      ),
    ),
    partial,
    reexports: Object.freeze(reexports),
    routes: Object.freeze(
      routes.sort(
        (left, right) => compareCodeUnits(left.name, right.name) || left.start - right.start,
      ),
    ),
  });
}

function boundaryForFile(
  file: string,
  packages: readonly PackageEvidence[],
  configuredSourceRoots: readonly string[],
  consume: () => void,
):
  | Readonly<{
      readonly name: string;
      readonly package: PackageEvidence;
      readonly resource: string;
    }>
  | undefined {
  let owner: PackageEvidence | undefined;
  for (const candidate of packages) {
    consume();
    if (candidate.root !== "." && !file.startsWith(`${candidate.root}/`)) continue;
    if (
      owner === undefined ||
      candidate.root.length > owner.root.length ||
      (candidate.root.length === owner.root.length &&
        compareCodeUnits(candidate.root, owner.root) < 0)
    )
      owner = candidate;
  }
  if (owner === undefined) return undefined;
  const relative = relativeResource(file, owner.root);
  if (relative === undefined || relative === ".") return undefined;
  const segments = relative.split("/");
  let sourceRoot: string | undefined;
  for (const candidate of configuredSourceRoots) {
    consume();
    if (
      (owner.root !== "." && candidate !== owner.root && !candidate.startsWith(`${owner.root}/`)) ||
      (file !== candidate && !file.startsWith(`${candidate}/`))
    )
      continue;
    if (
      sourceRoot === undefined ||
      candidate.length > sourceRoot.length ||
      (candidate.length === sourceRoot.length && compareCodeUnits(candidate, sourceRoot) < 0)
    )
      sourceRoot = candidate;
  }
  if (sourceRoot === undefined) {
    const sourceIndex = segments.findIndex((segment) =>
      conventionalSourceDirectories.has(segment.toLowerCase()),
    );
    if (sourceIndex >= 0) {
      sourceRoot = joinResource(owner.root, segments.slice(0, sourceIndex + 1).join("/"));
    }
  }
  if (sourceRoot === undefined) {
    return segments.length === 1
      ? Object.freeze({ name: "source", package: owner, resource: owner.root })
      : undefined;
  }
  const withinSource = relativeResource(file, sourceRoot);
  if (withinSource === undefined || withinSource === ".") return undefined;
  const sourceSegments = withinSource.split("/");
  const resource =
    sourceSegments.length === 1 ? sourceRoot : joinResource(sourceRoot, sourceSegments[0]!);
  return Object.freeze({
    name: resource === owner.root ? "source" : basename(resource),
    package: owner,
    resource,
  });
}

function externalPackageName(specifier: string): string | undefined {
  if (
    specifier.length > 512 ||
    /[\\\u0000-\u001f\u007f]/.test(specifier) ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("#") ||
    specifier.length === 0
  )
    return undefined;
  const validSegment = (segment: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(segment);
  const safeSubpathSegment = (segment: string): boolean =>
    segment !== "" &&
    segment !== "." &&
    segment !== ".." &&
    !/[\\\u0000-\u001f\u007f]/.test(segment);
  for (const runtime of ["node:", "bun:"] as const) {
    if (!specifier.startsWith(runtime)) continue;
    const runtimeSegments = specifier.slice(runtime.length).split("/");
    if (
      !validSegment(runtimeSegments[0] ?? "") ||
      runtimeSegments.slice(1).some((segment) => !safeSubpathSegment(segment))
    )
      return undefined;
    const name = runtime + runtimeSegments[0]!;
    return validObservationText(name, 256) ? name : undefined;
  }
  const segments = specifier.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".."))
    return undefined;
  if (specifier.startsWith("@")) {
    const scope = segments[0]!.slice(1);
    const packageName = segments[1];
    if (segments.length < 2 || !validSegment(scope) || !validSegment(packageName ?? ""))
      return undefined;
    if (segments.slice(2).some((segment) => !safeSubpathSegment(segment))) return undefined;
    const name = "@" + scope + "/" + packageName;
    return validObservationText(name, 256) ? name : undefined;
  }
  if (
    !validSegment(segments[0]!) ||
    segments.slice(1).some((segment) => !safeSubpathSegment(segment))
  )
    return undefined;
  return validObservationText(segments[0]!, 256) ? segments[0] : undefined;
}

function aliasCapture(pattern: string, specifier: string): string | undefined {
  const star = pattern.indexOf("*");
  if (star < 0) return pattern === specifier ? "" : undefined;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return specifier.startsWith(prefix) && specifier.endsWith(suffix)
    ? specifier.slice(prefix.length, specifier.length - suffix.length)
    : undefined;
}

function resolveAlias(
  policy: ModuleAliasPolicy,
  specifier: string,
  resources: ReadonlySet<string>,
  consume: () => void,
): Readonly<{ readonly matched: boolean; readonly partial: boolean; readonly resource?: string }> {
  if (policy.unknown) return Object.freeze({ matched: true, partial: true });
  const matching = policy.rules
    .map((rule) => {
      consume();
      return Object.freeze({ capture: aliasCapture(rule.key, specifier), rule });
    })
    .filter((item) => item.capture !== undefined);
  if (matching.length > 1) return Object.freeze({ matched: true, partial: true });
  const selected = matching[0];
  if (selected !== undefined) {
    if (selected.rule.targets.length !== 1) {
      return Object.freeze({ matched: true, partial: true });
    }
    const target = selected.rule.targets[0]!.replace("*", () => selected.capture!);
    const matches = matchingResources(policy.baseResource, target, resources);
    return matches.length === 1
      ? Object.freeze({ matched: true, partial: false, resource: matches[0]! })
      : Object.freeze({ matched: true, partial: true });
  }
  if (policy.fallback) {
    const matches = matchingResources(policy.baseResource, specifier, resources);
    if (matches.length === 1)
      return Object.freeze({ matched: true, partial: false, resource: matches[0]! });
    if (matches.length > 1) return Object.freeze({ matched: true, partial: true });
  }
  return Object.freeze({ matched: false, partial: false });
}

function documentationRecord(
  scope: string,
  identity: readonly string[],
  content: string,
  format: "markdown" | "text",
  provenance: ObservationProvenance,
  subject?: ObservationReference,
): DocumentationObservation {
  return Object.freeze({
    content,
    format,
    key: observationKey("documentation", scope, ...identity),
    kind: "documentation",
    provenance: Object.freeze([provenance]),
    scope,
    ...(subject === undefined ? {} : { subject }),
  });
}

function commonJsImplementationResource(resource: string): boolean {
  return /\.(?:cjs|cts)$/.test(resource) && !/\.d\.cts$/.test(resource);
}

function publicCallables(
  entry: string,
  parsed: ReadonlyMap<string, ParsedSource>,
  resources: ReadonlySet<string>,
  consume: () => void,
  visiting = new Set<string>(),
  depth = 0,
): ReadonlyMap<string, PublicCallableEvidence> | undefined {
  if (commonJsImplementationResource(entry) || visiting.has(entry) || depth > maxReexportDepth)
    return undefined;
  const source = parsed.get(entry);
  if (source === undefined) return undefined;
  visiting.add(entry);
  const output = new Map<string, PublicCallableEvidence>();
  const directNames = new Set<string>();
  const starNames = new Set<string>();
  const explicitNames = new Set<string>();
  const declaredExplicitNames = new Set<string>();
  for (const reexport of source.reexports) {
    consume();
    for (const item of reexport.exported ?? []) {
      consume();
      if (declaredExplicitNames.has(item.name)) {
        visiting.delete(entry);
        return undefined;
      }
      declaredExplicitNames.add(item.name);
    }
  }
  for (const [name, callable] of source.callables) {
    consume();
    directNames.add(name);
    output.set(name, Object.freeze({ callable, proofResources: Object.freeze([entry]) }));
  }
  for (const reexport of source.reexports) {
    consume();
    const target = resolveResource(entry, reexport.source, resources);
    if (target === undefined) {
      visiting.delete(entry);
      return undefined;
    }
    const targetCallables = publicCallables(
      target,
      parsed,
      resources,
      consume,
      visiting,
      depth + 1,
    );
    if (targetCallables === undefined) {
      visiting.delete(entry);
      return undefined;
    }
    if (reexport.exported === undefined) {
      for (const [name, callable] of targetCallables) {
        consume();
        if (name === "default" || directNames.has(name) || declaredExplicitNames.has(name))
          continue;
        if (starNames.has(name)) {
          visiting.delete(entry);
          return undefined;
        }
        const proofResources = [...new Set([entry, ...callable.proofResources])];
        if (proofResources.length > maxActionProvenance - 2) {
          visiting.delete(entry);
          return undefined;
        }
        starNames.add(name);
        output.set(name, Object.freeze({ callable: callable.callable, proofResources }));
      }
    } else {
      for (const item of reexport.exported) {
        consume();
        const callable = targetCallables.get(item.imported);
        if (callable === undefined) continue;
        if (directNames.has(item.name) || explicitNames.has(item.name)) {
          visiting.delete(entry);
          return undefined;
        }
        const proofResources = [...new Set([entry, ...callable.proofResources])];
        if (proofResources.length > maxActionProvenance - 2) {
          visiting.delete(entry);
          return undefined;
        }
        explicitNames.add(item.name);
        starNames.delete(item.name);
        output.set(item.name, Object.freeze({ callable: callable.callable, proofResources }));
      }
    }
  }
  visiting.delete(entry);
  return output;
}

function provenanceIdentity(provenance: ObservationProvenance): string {
  return `${provenance.scope}\u0000${provenance.resource}\u0000${provenance.fingerprint}\u0000${
    provenance.range?.startByte ?? -1
  }\u0000${provenance.range?.endByteExclusive ?? -1}`;
}

async function scanScope(
  request: ScannerRequest,
  state: ScanState,
  budget: ExtractionBudget,
  config: ScannerConfiguration,
  scope: string,
  root: string,
): Promise<
  Readonly<{ readonly partial: boolean; readonly records: readonly ObservationRecord[] }>
> {
  const inventory = await inventoryScope(request, state, config, scope, root);
  const resourceSet = new Set(inventory.files);
  const fileCache = new Map<string, FileEvidence>();
  let partial = inventory.partial;
  const getFile = async (resource: string): Promise<FileEvidence | undefined> => {
    const cached = fileCache.get(resource);
    if (cached !== undefined) return cached;
    try {
      const file = await readFile(request, state, scope, resource);
      fileCache.set(resource, file);
      return file;
    } catch (error) {
      if (error instanceof ScannerStop && error.code === "typescript-scanner-invalid-text") {
        partial = true;
        return undefined;
      }
      throw error;
    }
  };
  const packages: PackageEvidence[] = [];
  const packageDescriptions = new Map<string, string>();
  for (const resource of inventory.files.filter((item) => basename(item) === "package.json")) {
    chargeExtractionWork(budget);
    const file = await getFile(resource);
    if (file === undefined) continue;
    const parsed = parsePackage(file, resourceSet, root);
    partial ||= parsed.partial;
    if (parsed.package !== undefined) {
      packages.push(parsed.package);
      if (parsed.description !== undefined)
        packageDescriptions.set(parsed.package.resource, parsed.description);
    }
  }
  packages.sort((left, right) => compareCodeUnits(left.root, right.root));
  const sourceFiles = inventory.files.filter((item) => sourceExtensionPattern.test(item));
  const boundaryBuilders = new Map<
    string,
    { files: string[]; name: string; owner: PackageEvidence; resource: string }
  >();
  for (const resource of sourceFiles) {
    chargeExtractionWork(budget);
    const boundary = boundaryForFile(resource, packages, inventory.configuredSourceRoots, () =>
      chargeExtractionWork(budget),
    );
    if (boundary === undefined) continue;
    const identity = `${boundary.package.root}\u0000${boundary.resource}`;
    const existing = boundaryBuilders.get(identity);
    if (existing === undefined) {
      boundaryBuilders.set(identity, {
        files: [resource],
        name: boundary.name,
        owner: boundary.package,
        resource: boundary.resource,
      });
    } else existing.files.push(resource);
  }
  const boundaries: BoundaryEvidence[] = [];
  for (const builder of [...boundaryBuilders.values()].sort((left, right) =>
    compareCodeUnits(left.resource, right.resource),
  )) {
    chargeExtractionWork(budget);
    if (!validObservationText(builder.name, 256)) {
      partial = true;
      continue;
    }
    builder.files.sort(compareCodeUnits);
    const evidence = await getFile(builder.files[0]!);
    if (evidence === undefined) continue;
    boundaries.push(
      Object.freeze({
        files: Object.freeze(builder.files),
        key: observationKey(
          "component-candidate",
          scope,
          "source-boundary",
          builder.owner.root,
          builder.resource,
        ),
        name: builder.name,
        packageKey: observationKey(
          "component-candidate",
          scope,
          "package",
          builder.owner.root,
          builder.owner.name,
        ),
        provenance: fullProvenance(evidence),
        resource: builder.resource,
        scope,
      }),
    );
  }
  const boundaryByFile = new Map<string, BoundaryEvidence>();
  for (const boundary of boundaries)
    for (const file of boundary.files) boundaryByFile.set(file, boundary);
  const parsedSources = new Map<string, ParsedSource>();
  for (const resource of sourceFiles) {
    chargeExtractionWork(budget);
    const file = await getFile(resource);
    if (file === undefined) continue;
    const parsed = parseSource(file, budget);
    parsedSources.set(resource, parsed);
    partial ||= parsed.partial;
  }
  const records: ObservationRecord[] = [];
  const append = (record: ObservationRecord, reserved = false): void =>
    appendObservation(records, budget, record, reserved);
  const packageByKey = new Map<string, PackageEvidence>();
  const workspaceMemberPackages = new Set<PackageEvidence>();
  for (const item of packages) {
    chargeExtractionWork(budget);
    const key = observationKey("component-candidate", scope, "package", item.root, item.name);
    packageByKey.set(key, item);
    append(
      Object.freeze({
        candidate: Object.freeze({ name: item.name, type: "package" }),
        key,
        kind: "component-candidate",
        provenance: Object.freeze([item.provenance]),
        scope,
      }),
    );
    const description = packageDescriptions.get(item.resource);
    if (
      description !== undefined &&
      validObservationText(description, maxDocumentationCharacters)
    ) {
      append(
        documentationRecord(
          scope,
          ["package-description", item.root, item.name],
          description,
          "text",
          item.provenance,
          reference(scope, key),
        ),
      );
    } else if (description !== undefined) partial = true;
  }
  for (const declaration of packages) {
    chargeExtractionWork(budget);
    if (declaration.workspacePatterns.length === 0) continue;
    const fromKey = observationKey(
      "component-candidate",
      scope,
      "package",
      declaration.root,
      declaration.name,
    );
    for (const member of packages) {
      chargeExtractionWork(budget);
      if (member === declaration || member.root === declaration.root) continue;
      const relativeMember = relativeResource(member.root, declaration.root);
      if (relativeMember === undefined || relativeMember === ".") continue;
      const matches = declaration.workspacePatterns.filter((pattern) => {
        chargeExtractionWork(budget);
        return workspacePatternMatches(relativeMember, pattern);
      });
      if (matches.length > 1) {
        partial = true;
        continue;
      }
      if (matches.length !== 1) continue;
      workspaceMemberPackages.add(member);
      const toKey = observationKey(
        "component-candidate",
        scope,
        "package",
        member.root,
        member.name,
      );
      append(
        Object.freeze({
          from: reference(scope, fromKey),
          key: observationKey("relationship", scope, "workspace-member", fromKey, toKey),
          kind: "relationship",
          provenance: Object.freeze([declaration.provenance, member.provenance]),
          relationshipType: "workspace-member",
          scope,
          to: reference(scope, toKey),
        }),
      );
    }
  }
  const workspaceByName = new Map<string, PackageEvidence>();
  const ambiguousWorkspaceNames = new Set<string>();
  for (const member of workspaceMemberPackages) {
    chargeExtractionWork(budget);
    if (workspaceByName.has(member.name)) ambiguousWorkspaceNames.add(member.name);
    else workspaceByName.set(member.name, member);
  }
  for (const boundary of boundaries) {
    chargeExtractionWork(budget);
    append(
      Object.freeze({
        candidate: Object.freeze({ name: boundary.name, type: "source-boundary" }),
        key: boundary.key,
        kind: "component-candidate",
        provenance: Object.freeze([boundary.provenance]),
        scope,
      }),
    );
    append(
      Object.freeze({
        from: reference(scope, boundary.packageKey),
        key: observationKey(
          "relationship",
          scope,
          "package-source",
          boundary.packageKey,
          boundary.key,
        ),
        kind: "relationship",
        provenance: Object.freeze([boundary.provenance]),
        relationshipType: "source-boundary",
        scope,
        to: reference(scope, boundary.key),
      }),
    );
  }
  for (const resource of inventory.files.filter((item) =>
    /^README(?:\.[^/]*)?$/i.test(basename(item)),
  )) {
    chargeExtractionWork(budget);
    const file = await getFile(resource);
    if (file === undefined) continue;
    if (!validObservationText(file.text, maxDocumentationCharacters)) {
      partial = true;
      continue;
    }
    let owner: PackageEvidence | undefined;
    for (const candidate of packages) {
      chargeExtractionWork(budget);
      if (candidate.root !== "." && !resource.startsWith(`${candidate.root}/`)) continue;
      if (owner === undefined || candidate.root.length > owner.root.length) owner = candidate;
    }
    const subject =
      owner === undefined
        ? undefined
        : reference(
            scope,
            observationKey("component-candidate", scope, "package", owner.root, owner.name),
          );
    append(
      documentationRecord(
        scope,
        ["readme", resource],
        file.text,
        "markdown",
        fullProvenance(file),
        subject,
      ),
    );
  }
  for (const item of packages) {
    chargeExtractionWork(budget);
    const packageKey = observationKey(
      "component-candidate",
      scope,
      "package",
      item.root,
      item.name,
    );
    for (const entry of item.entries) {
      chargeExtractionWork(budget);
      const callables = publicCallables(entry.target, parsedSources, resourceSet, () =>
        chargeExtractionWork(budget),
      );
      if (callables === undefined) {
        partial = true;
        continue;
      }
      for (const [publicName, publicCallable] of [...callables.entries()].sort((left, right) =>
        compareCodeUnits(left[0], right[0]),
      )) {
        chargeExtractionWork(budget);
        const callable = publicCallable.callable;
        const file = await getFile(callable.resource);
        if (file === undefined) continue;
        const proof: ObservationProvenance[] = [item.provenance];
        let proofComplete = true;
        for (const proofResource of publicCallable.proofResources) {
          const proofFile = await getFile(proofResource);
          if (proofFile === undefined) {
            proofComplete = false;
            break;
          }
          proof.push(fullProvenance(proofFile));
        }
        if (!proofComplete) {
          partial = true;
          continue;
        }
        proof.push(rangeProvenance(file, callable.start, callable.end));
        const uniqueProof = [
          ...new Map(proof.map((item) => [provenanceIdentity(item), item])).values(),
        ].sort((left, right) =>
          compareCodeUnits(provenanceIdentity(left), provenanceIdentity(right)),
        );
        if (uniqueProof.length > maxActionProvenance) {
          partial = true;
          continue;
        }
        const actionKey = observationKey(
          "action",
          scope,
          "public-export",
          item.root,
          entry.publicSubpath,
          entry.target,
          publicName,
        );
        append(
          Object.freeze({
            component: reference(scope, packageKey),
            description: `Public export at ${entry.publicSubpath}`,
            key: actionKey,
            kind: "action",
            name: publicName,
            provenance: Object.freeze(uniqueProof),
            scope,
          }),
        );
        if (callable.jsdoc !== undefined) {
          const content = file.text.slice(callable.jsdoc.start, callable.jsdoc.end);
          if (validObservationText(content, maxDocumentationCharacters)) {
            append(
              documentationRecord(
                scope,
                ["public-jsdoc", item.root, entry.publicSubpath, entry.target, publicName],
                content,
                "text",
                rangeProvenance(file, callable.jsdoc.start, callable.jsdoc.end),
                reference(scope, actionKey),
              ),
            );
          } else partial = true;
        }
      }
    }
  }
  const externalCandidates = new Set<string>();
  const relationships = new Map<
    string,
    { from: string; provenance: ObservationProvenance[]; to: string }
  >();
  for (const [resource, parsed] of parsedSources) {
    chargeExtractionWork(budget);
    const from = boundaryByFile.get(resource);
    const file = await getFile(resource);
    if (from === undefined || file === undefined) continue;
    const owner = packageByKey.get(from.packageKey);
    for (const imported of parsed.imports) {
      chargeExtractionWork(budget);
      let toKey: string | undefined;
      if (imported.source.startsWith(".")) {
        const resolved = resolveResource(resource, imported.source, resourceSet);
        if (resolved === undefined) {
          partial = true;
          continue;
        }
        const target = boundaryByFile.get(resolved);
        if (target === undefined || target.key === from.key) continue;
        toKey = target.key;
      } else {
        const alias = imported.source.startsWith("#")
          ? owner === undefined
            ? Object.freeze({ matched: true, partial: true })
            : resolveAlias(owner.imports, imported.source, resourceSet, () =>
                chargeExtractionWork(budget),
              )
          : resolveAlias(inventory.aliases, imported.source, resourceSet, () =>
              chargeExtractionWork(budget),
            );
        if (alias.matched) {
          if (alias.partial || alias.resource === undefined) {
            partial = true;
            continue;
          }
          const target = boundaryByFile.get(alias.resource);
          if (target === undefined) {
            partial = true;
            continue;
          }
          if (target.key === from.key) continue;
          toKey = target.key;
        } else if (imported.source.startsWith("#")) {
          partial = true;
          continue;
        } else {
          const externalName = externalPackageName(imported.source);
          if (externalName === undefined || !validObservationText(externalName, 256)) {
            partial = true;
            continue;
          }
          if (ambiguousWorkspaceNames.has(externalName)) {
            partial = true;
            continue;
          }
          let workspace: PackageEvidence | undefined;
          if (owner?.name === externalName) {
            const suffix = imported.source.slice(externalName.length);
            const publicSubpath = suffix.length === 0 ? "." : `.${suffix}`;
            if (!owner.entries.some((entry) => entry.publicSubpath === publicSubpath)) {
              partial = true;
              continue;
            }
            workspace = owner;
          } else workspace = workspaceByName.get(externalName);
          toKey =
            workspace === undefined
              ? observationKey("component-candidate", scope, "external", externalName)
              : observationKey(
                  "component-candidate",
                  scope,
                  "package",
                  workspace.root,
                  workspace.name,
                );
          if (workspace === undefined && !externalCandidates.has(toKey)) {
            externalCandidates.add(toKey);
            append(
              Object.freeze({
                candidate: Object.freeze({ name: externalName, type: "external" }),
                key: toKey,
                kind: "component-candidate",
                provenance: Object.freeze([rangeProvenance(file, imported.start, imported.end)]),
                scope,
              }),
            );
          }
        }
      }
      const relationshipIdentity = `${from.key}\u0000${toKey}`;
      const aggregate = relationships.get(relationshipIdentity);
      const provenance = rangeProvenance(file, imported.start, imported.end);
      if (aggregate === undefined) {
        reserveRecordSlot(budget);
        relationships.set(relationshipIdentity, {
          from: from.key,
          provenance: [provenance],
          to: toKey,
        });
      } else if (aggregate.provenance.length < maxRelationshipProvenance)
        aggregate.provenance.push(provenance);
      else partial = true;
    }
    for (const route of parsed.routes) {
      chargeExtractionWork(budget);
      append(
        Object.freeze({
          component: reference(scope, from.key),
          key: observationKey("action", scope, "bun-route", from.key, route.name),
          kind: "action",
          name: route.name,
          provenance: Object.freeze([rangeProvenance(file, route.start, route.end)]),
          scope,
        }),
      );
    }
  }
  for (const aggregate of relationships.values()) {
    chargeExtractionWork(budget);
    aggregate.provenance.sort((left, right) =>
      compareCodeUnits(
        `${left.resource}\u0000${left.range?.startByte ?? 0}`,
        `${right.resource}\u0000${right.range?.startByte ?? 0}`,
      ),
    );
    append(
      Object.freeze({
        from: reference(scope, aggregate.from),
        key: observationKey("relationship", scope, "imports", aggregate.from, aggregate.to),
        kind: "relationship",
        provenance: Object.freeze(aggregate.provenance),
        relationshipType: "imports",
        scope,
        to: reference(scope, aggregate.to),
      }),
      true,
    );
  }
  records.sort((left, right) =>
    compareCodeUnits(`${left.kind}\u0000${left.key}`, `${right.kind}\u0000${right.key}`),
  );
  const unique: ObservationRecord[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    chargeExtractionWork(budget);
    const identity = `${record.scope}\u0000${record.key}`;
    if (seen.has(identity)) {
      partial = true;
      continue;
    }
    seen.add(identity);
    unique.push(record);
  }
  return Object.freeze({ partial, records: Object.freeze(unique) });
}

async function runScanner(request: ScannerRequest): Promise<Result<void>> {
  const state: ScanState = { bytes: 0, pages: 0, sequence: 0, work: 0 };
  const extraction: ExtractionBudget = { canonicalCharacters: 0, records: 0, work: 0 };
  try {
    const parsedConfiguration = configuration(request.configuration);
    if (!parsedConfiguration.ok) {
      throw new ScannerStop(
        "typescript-scanner-invalid-config",
        "TypeScript scanner configuration is invalid",
        parsedConfiguration.diagnostics,
      );
    }
    const records: ObservationRecord[] = [];
    const partialScopes = new Set<string>();
    for (const scope of request.session.scopes) {
      const result = await scanScope(
        request,
        state,
        extraction,
        parsedConfiguration.value,
        scope.id,
        scope.resourceRoot,
      );
      records.push(...result.records);
      if (result.partial) partialScopes.add(scope.id);
    }
    records.sort((left, right) =>
      compareCodeUnits(
        `${left.scope}\u0000${left.kind}\u0000${left.key}`,
        `${right.scope}\u0000${right.kind}\u0000${right.key}`,
      ),
    );
    if (records.length > maxRecords || extraction.records > maxRecords) {
      throw new ScannerStop(
        "typescript-scanner-budget-exceeded",
        "TypeScript scanner observation budget was exceeded",
      );
    }
    let canonicalCharacters = 0;
    for (const record of records) {
      canonicalCharacters += boundedStructuralCharacters(record);
      if (canonicalCharacters > maxCanonicalCharacters) {
        throw new ScannerStop(
          "typescript-scanner-budget-exceeded",
          "TypeScript scanner observation character budget was exceeded",
        );
      }
    }
    if (canonicalCharacters > extraction.canonicalCharacters) {
      throw new ScannerStop(
        "typescript-scanner-budget-exceeded",
        "TypeScript scanner observation character budget was exceeded",
      );
    }
    for (let offset = 0; offset < records.length; offset += observationBatchSize) {
      await work(request, state);
      state.sequence += 1;
      const batch = request.observations.submitBatch({
        epoch: request.session.epoch,
        records: Object.freeze(records.slice(offset, offset + observationBatchSize)),
        sequence: state.sequence,
      });
      if (!batch.ok) {
        throw new ScannerStop(
          "typescript-scanner-sink-failed",
          "TypeScript scanner observation batch was rejected",
          batch.diagnostics,
        );
      }
    }
    state.sequence += 1;
    const completion = request.observations.complete({
      coverage: Object.freeze(
        request.session.scopes.map((scope) =>
          Object.freeze({
            kinds: coverageKinds,
            scope: scope.id,
            state: partialScopes.has(scope.id) ? ("partial" as const) : ("complete" as const),
          }),
        ),
      ),
      epoch: request.session.epoch,
      sequence: state.sequence,
    });
    if (!completion.ok) {
      throw new ScannerStop(
        "typescript-scanner-sink-failed",
        "TypeScript scanner completion was rejected",
        completion.diagnostics,
      );
    }
    return success(undefined);
  } catch (error) {
    const stop =
      error instanceof ScannerStop
        ? error
        : new ScannerStop(
            "typescript-scanner-failed",
            "TypeScript scanner failed without exposing project details",
          );
    return stopScanner(request, state, stop);
  }
}

function stopScanner(request: ScannerRequest, state: ScanState, stop: ScannerStop): Result<void> {
  if (stop.reportFailure) {
    state.sequence += 1;
    const failed = request.observations.fail({
      epoch: request.session.epoch,
      reason: Object.freeze({ code: stop.code, message: stop.message }),
      sequence: state.sequence,
    });
    if (!failed.ok) return failure(...failed.diagnostics);
  }
  return failure(diagnostic(stop.code, stop.message), ...stop.diagnostics);
}

export const typescriptBunScanner: Scanner = Object.freeze({
  scan: async (request: ScannerRequest) => runScanner(request),
});

export const typescriptBunScannerRegistration: PluginRegistration = Object.freeze({
  manifest: Object.freeze({
    apiVersion: pluginRuntimeApiVersion,
    id: scannerId,
    phase: 1,
    provides: Object.freeze([
      Object.freeze({
        cardinality: "multiple" as const,
        id: scannerCapabilityId,
        version: scannerCapabilityVersion,
      }),
    ]),
    requires: Object.freeze([]),
    version: scannerVersion,
  }),
  start: () =>
    Object.freeze({
      capabilities: Object.freeze([
        Object.freeze({
          id: scannerCapabilityId,
          value: typescriptBunScanner,
          version: scannerCapabilityVersion,
        }),
      ]),
    }),
});

export const typescriptBunScannerIdentity = Object.freeze({
  apiVersion: scannerApiVersion,
  id: scannerId,
  version: scannerVersion,
});
