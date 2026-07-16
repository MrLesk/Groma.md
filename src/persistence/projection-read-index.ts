import { createHash } from "node:crypto";

import {
  createEntityAliasResolver,
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseProjectionCanonicalFingerprint,
  parseProjectionReadIntegrity,
  parseRelationId,
  success,
  type Diagnostic,
  type EntityAlias,
  type EntityId,
  type GraphEntity,
  type GraphData,
  type GraphRelation,
  type ProjectedEntity,
  type ProjectionCatalogEntry,
  type ProjectionCatalogReadRequest,
  type ProjectionContinuityCapability,
  type ProjectionReadCapability,
  type ProjectionReadBatch,
  type ProjectionReadExact,
  type ProjectionReadIdentity,
  type ProjectionReadIntegrity,
  type ProjectionReadPage,
  type ProjectionRelationRead,
  type ProjectionRelationReadRequest,
  type ProjectionSnapshot,
  type RelationId,
  type Result,
} from "../core/index.ts";
import { copyCanonicalGraphData, copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  workspaceResourceLocator,
  type LocalResourceProvider,
  type ResourceContinuationCursor,
  type WorkspaceResourceLocator,
} from "./contracts.ts";
import { localResourceProviderDefaultMaxEntriesPerDirectory } from "./local-resource-provider.ts";

const bundleSchema = "groma.projection-read-bundle/v1";
const catalogSchema = "groma.projection-read-catalog/v1";
const adjacencySchema = "groma.projection-read-adjacency/v1";
const aliasesSchema = "groma.projection-read-aliases/v1";
const integrityProofSchema = "groma.projection-read-integrity-proof/v1";
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();
const sha256FingerprintPattern = /^sha256:[0-9a-f]{64}$/;
const chunkNamePattern = /^[0-9]{8}\.json$/;
const intrinsicArrayJoin = Array.prototype.join;
const intrinsicArrayMap = Array.prototype.map;
const intrinsicArrayPush = Array.prototype.push;
const intrinsicArraySlice = Array.prototype.slice;
const intrinsicArraySort = Array.prototype.sort;
const intrinsicJsonParse = JSON.parse;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectKeys = Object.keys;
const intrinsicPromiseFinally = Promise.prototype.finally;
const intrinsicRegExpTest = RegExp.prototype.test;
const intrinsicNormalize = String.prototype.normalize;
const intrinsicStringSlice = String.prototype.slice;
const intrinsicTextDecode = TextDecoder.prototype.decode;
const intrinsicTextEncode = TextEncoder.prototype.encode;
const intrinsicToLowerCase = String.prototype.toLowerCase;
const intrinsicWeakSetAdd = WeakSet.prototype.add;
const intrinsicWeakSetHas = WeakSet.prototype.has;

function pushArray<T>(values: T[], value: T): void {
  Reflect.apply(intrinsicArrayPush, values, [value]);
}

function mapArray<TInput, TOutput>(
  values: readonly TInput[],
  callback: (value: TInput, index: number) => TOutput,
): TOutput[] {
  return Reflect.apply(intrinsicArrayMap, values, [callback]) as TOutput[];
}

function sliceArray<T>(values: readonly T[], start: number, end?: number): T[] {
  return Reflect.apply(
    intrinsicArraySlice,
    values,
    end === undefined ? [start] : [start, end],
  ) as T[];
}

function sortInPlace<T>(values: T[], compare: (left: T, right: T) => number): T[] {
  return Reflect.apply(intrinsicArraySort, values, [compare]) as T[];
}

export interface LocalProjectionReadBounds {
  readonly maxAliases: number;
  readonly maxBytes: number;
  readonly maxEntities: number;
  readonly maxPageSize: number;
  readonly maxRelations: number;
  readonly maxSearchableTextCharacters: number;
}

export interface LocalProjectionReadIndexOptions {
  readonly bounds: LocalProjectionReadBounds;
  readonly checkpoint?: ProjectionContinuityCapability;
  readonly ensureProjection: () => Promise<Result<ProjectionSnapshot>>;
  readonly repairProjection: () => Promise<Result<ProjectionSnapshot>>;
  readonly resources: LocalResourceProvider;
}

export interface LocalProjectionReadIndex {
  readonly capability: ProjectionReadCapability;
  adopt(
    snapshot: ProjectionSnapshot,
  ): Promise<Result<{ readonly commit: () => Result<void> } | undefined>>;
  publish(snapshot: ProjectionSnapshot): Promise<Result<void>>;
}

interface ChunkDescriptor {
  readonly count: number;
  readonly first: string;
  readonly last: string;
  readonly name: string;
}

interface ChunkManifest {
  readonly chunks: readonly ChunkDescriptor[];
  readonly schema: typeof catalogSchema | typeof adjacencySchema | typeof aliasesSchema;
}

interface CurrentManifest extends ProjectionReadIdentity {
  readonly bundle: string;
  readonly integrity: ProjectionReadIntegrity;
  readonly resourceCount: number;
  readonly schema: typeof bundleSchema;
}

type ProjectionVisibility<T> =
  | { readonly state: "rebuildable" }
  | { readonly result: Result<never>; readonly state: "unavailable" }
  | { readonly state: "visible"; readonly value: T };

interface EncodedResource {
  readonly bytes: Uint8Array;
  readonly path: string;
  readonly segments: readonly string[];
}

interface IntegritySibling {
  readonly hash: string;
  readonly side: "left" | "right";
}

interface IntegrityProof {
  readonly index: number;
  readonly path: string;
  readonly resourceCount: number;
  readonly schema: typeof integrityProofSchema;
  readonly siblings: readonly IntegritySibling[];
}

function diagnostic(code: string, message: string, details?: Record<string, string | number>) {
  return Object.freeze({ code, ...(details === undefined ? {} : { details }), message });
}

function unavailable(reason: string): Result<never> {
  return failure(
    diagnostic(
      "projection-read-unavailable",
      "The bounded projection read index is unavailable; rebuild the disposable projection",
      { reason },
    ),
  );
}

const repairableProjectionFailures = new WeakSet<object>();

function repairableUnavailable(reason: string): Result<never> {
  const result = unavailable(reason);
  Reflect.apply(intrinsicWeakSetAdd, repairableProjectionFailures, [result]);
  return result;
}

function markRepairable<T>(result: Result<T>): Result<T> {
  if (!result.ok) Reflect.apply(intrinsicWeakSetAdd, repairableProjectionFailures, [result]);
  return result;
}

function isRepairable(result: Result<unknown>): boolean {
  return (
    !result.ok &&
    (Reflect.apply(intrinsicWeakSetHas, repairableProjectionFailures, [result]) as boolean)
  );
}

function anchorMismatch(): Result<never> {
  return failure(
    diagnostic(
      "projection-read-anchor-mismatch",
      "The partial-read continuation anchor is absent from this exact projection",
    ),
  );
}

function unknownEntity(): Result<never> {
  return failure(
    diagnostic("unknown-entity", "No entity or durable alias exists for the exact stable identity"),
  );
}

function firstDiagnosticCode(value: unknown): string | undefined {
  const result = inspectExactRecord(
    value,
    [
      ["diagnostics", "ok"],
      ["ok", "value"],
    ],
    "projection-read-unavailable",
    "Resource result",
  );
  if (!result.ok || result.value.ok !== false) return undefined;
  const length = inspectIntrinsicArrayLength(
    result.value.diagnostics,
    "projection-read-unavailable",
    "Resource diagnostics",
  );
  if (!length.ok || length.value === 0) return undefined;
  const descriptor = Reflect.apply(intrinsicObjectGetOwnPropertyDescriptor, Object, [
    result.value.diagnostics,
    "0",
  ]) as PropertyDescriptor | undefined;
  if (descriptor === undefined || !("value" in descriptor)) return undefined;
  const item = inspectExactRecord(
    descriptor.value,
    [
      ["code", "message"],
      ["code", "details", "message"],
    ],
    "projection-read-unavailable",
    "Resource diagnostic",
  );
  return item.ok && typeof item.value.code === "string" ? item.value.code : undefined;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameIdentity(left: ProjectionReadIdentity, right: ProjectionReadIdentity): boolean {
  return left.generation === right.generation && left.fingerprint === right.fingerprint;
}

function identityOf(snapshot: ProjectionSnapshot): ProjectionReadIdentity {
  return Object.freeze({ fingerprint: snapshot.fingerprint, generation: snapshot.generation });
}

function locator(...segments: readonly string[]): Result<WorkspaceResourceLocator> {
  const args = [".groma-cache", "projection-reads"];
  for (let index = 0; index < segments.length; index += 1) pushArray(args, segments[index]!);
  return Reflect.apply(
    workspaceResourceLocator,
    undefined,
    args,
  ) as Result<WorkspaceResourceLocator>;
}

function bundledLocator(
  bundle: string,
  segments: readonly string[],
): Result<WorkspaceResourceLocator> {
  const args = [bundle];
  for (let index = 0; index < segments.length; index += 1) pushArray(args, segments[index]!);
  return Reflect.apply(locator, undefined, args) as Result<WorkspaceResourceLocator>;
}

function currentLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator(".groma-cache", "projection-read-current.json");
}

function bundleName(identity: ProjectionReadIdentity): Result<string> {
  if (
    !(Reflect.apply(intrinsicRegExpTest, sha256FingerprintPattern, [
      identity.fingerprint,
    ]) as boolean)
  )
    return unavailable("fingerprint-format");
  const suffix = Reflect.apply(intrinsicStringSlice, identity.fingerprint, ["sha256:".length]);
  return success(`g${identity.generation}-${suffix}`);
}

const absoluteBounds: LocalProjectionReadBounds = Object.freeze({
  maxAliases: 1_000_000,
  maxBytes: 1024 * 1024 * 1024,
  maxEntities: 1_000_000,
  maxPageSize: 1_000_000,
  maxRelations: 10_000_000,
  maxSearchableTextCharacters: 1024 * 1024,
});
const localProjectionChunkItems = 100;
const boundFields = Object.freeze([
  "maxAliases",
  "maxBytes",
  "maxEntities",
  "maxPageSize",
  "maxRelations",
  "maxSearchableTextCharacters",
] as const);

function parseBounds(value: unknown): LocalProjectionReadBounds {
  const inspected = inspectExactRecord(
    value,
    [
      [
        "maxAliases",
        "maxBytes",
        "maxEntities",
        "maxPageSize",
        "maxRelations",
        "maxSearchableTextCharacters",
      ],
    ],
    "invalid-projection-read-bounds",
    "Local projection read bounds",
  );
  if (!inspected.ok) throw new RangeError("Local projection read bounds are malformed");
  const parsed = {} as Record<keyof LocalProjectionReadBounds, number>;
  for (let fieldIndex = 0; fieldIndex < boundFields.length; fieldIndex += 1) {
    const field = boundFields[fieldIndex]!;
    const candidate = inspected.value[field];
    if (
      typeof candidate !== "number" ||
      !Number.isSafeInteger(candidate) ||
      candidate <= 0 ||
      candidate > absoluteBounds[field]
    ) {
      throw new RangeError(
        `${field} must be a positive safe integer no greater than ${absoluteBounds[field]}`,
      );
    }
    parsed[field] = candidate;
  }
  return Object.freeze(parsed);
}

function digest(parts: readonly (string | Uint8Array)[]): string {
  const hash = createHash("sha256");
  for (let index = 0; index < parts.length; index += 1) hash.update(parts[index]!);
  return `sha256:${hash.digest("hex")}`;
}

function leafDigest(path: string, bytes: Uint8Array): string {
  return digest(["groma-projection-read-leaf-v1\0", path, "\0", bytes]);
}

function parentDigest(left: string, right: string): string {
  return digest(["groma-projection-read-node-v1\0", left, "\0", right]);
}

function resourcePath(segments: readonly string[]): string {
  return Reflect.apply(intrinsicArrayJoin, segments, ["/"]) as string;
}

function integrityLocator(bundle: string, path: string): Result<WorkspaceResourceLocator> {
  const name = `${createHash("sha256").update(path).digest("hex")}.json`;
  return locator(bundle, "integrity", name);
}

function maximumResources(bounds: LocalProjectionReadBounds): number {
  const catalogChunks = Math.ceil(bounds.maxEntities / localProjectionChunkItems);
  const aliasChunks = Math.ceil(bounds.maxAliases / localProjectionChunkItems);
  // Exact entities and relations, both top-level manifests, all entity-direction
  // manifests, and at most two adjacency references per relation.
  return 2 + catalogChunks + aliasChunks + bounds.maxEntities * 3 + bounds.maxRelations * 3;
}

function maximumProofBytes(maximumResourceCount: number): number {
  return 1024 + Math.ceil(Math.log2(Math.max(2, maximumResourceCount))) * 192;
}

function encodeJson(value: unknown, maximum: number): Result<Uint8Array> {
  const copied = copyCanonicalGraphData(value, "query", {
    code: "projection-read-byte-bound-exceeded",
    maximum,
    message: "A projection read resource exceeds its configured byte bound",
  });
  if (!copied.ok) return unavailable("resource-byte-bound");
  const bytes = Reflect.apply(intrinsicTextEncode, encoder, [
    `${copied.value.canonicalJson}\n`,
  ]) as Uint8Array;
  return bytes.byteLength <= maximum ? success(bytes) : unavailable("resource-byte-bound");
}

function encodeResource(
  segments: readonly string[],
  value: unknown,
  maximum: number,
): Result<EncodedResource> {
  const bytes = encodeJson(value, maximum);
  return bytes.ok
    ? success(
        Object.freeze({
          bytes: bytes.value,
          path: resourcePath(segments),
          segments: Object.freeze(sliceArray(segments, 0)),
        }),
      )
    : bytes;
}

function merkleLevels(resources: readonly EncodedResource[]): readonly (readonly string[])[] {
  const levels: (readonly string[])[] = [
    Object.freeze(mapArray(resources, (resource) => leafDigest(resource.path, resource.bytes))),
  ];
  while (levels[levels.length - 1]!.length > 1) {
    const previous = levels[levels.length - 1]!;
    const next: string[] = [];
    for (let index = 0; index < previous.length; index += 2) {
      pushArray(
        next,
        index + 1 < previous.length
          ? parentDigest(previous[index]!, previous[index + 1]!)
          : previous[index]!,
      );
    }
    pushArray(levels, Object.freeze(next));
  }
  return Object.freeze(levels);
}

function proofFor(
  resources: readonly EncodedResource[],
  levels: readonly (readonly string[])[],
  resourceIndex: number,
): IntegrityProof {
  const siblings: IntegritySibling[] = [];
  let index = resourceIndex;
  for (let level = 0; level < levels.length - 1; level += 1) {
    const values = levels[level]!;
    if (index % 2 === 1) {
      pushArray(siblings, Object.freeze({ hash: values[index - 1]!, side: "left" }));
    } else if (index + 1 < values.length) {
      pushArray(siblings, Object.freeze({ hash: values[index + 1]!, side: "right" }));
    }
    index = Math.floor(index / 2);
  }
  return Object.freeze({
    index: resourceIndex,
    path: resources[resourceIndex]!.path,
    resourceCount: resources.length,
    schema: integrityProofSchema,
    siblings: Object.freeze(siblings),
  });
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function publishBytes(
  resources: LocalResourceProvider,
  target: WorkspaceResourceLocator,
  bytes: Uint8Array,
): Promise<Result<void>> {
  const staged = await resources.stageReplacement(target, bytes);
  if (!staged.ok) return unavailable("resource-stage");
  const committed = await resources.commitReplacement(staged.value);
  if (committed.state === "committed") return success(undefined);
  if (committed.state === "committed-indeterminate") {
    const readback = await resources.read({ locator: target, maxBytes: bytes.byteLength });
    if (readback.ok && sameBytes(readback.value.bytes, bytes)) return success(undefined);
    return unavailable("resource-publication-indeterminate");
  }
  await resources.discardReplacement(staged.value);
  return unavailable("resource-publication");
}

async function publishJson(
  resources: LocalResourceProvider,
  target: Result<WorkspaceResourceLocator>,
  value: unknown,
  maximum: number,
): Promise<Result<void>> {
  if (!target.ok) return unavailable("resource-locator");
  const bytes = encodeJson(value, maximum);
  return bytes.ok ? publishBytes(resources, target.value, bytes.value) : bytes;
}

async function readJson(
  resources: LocalResourceProvider,
  target: Result<WorkspaceResourceLocator>,
  maximum: number,
): Promise<Result<unknown>> {
  if (!target.ok) return unavailable("resource-locator");
  const read = await resources.read({ locator: target.value, maxBytes: maximum });
  if (!read.ok) return unavailable("resource-read");
  try {
    const source = Reflect.apply(intrinsicTextDecode, decoder, [read.value.bytes]) as string;
    return success(Reflect.apply(intrinsicJsonParse, JSON, [source]) as unknown);
  } catch {
    return unavailable("resource-malformed");
  }
}

function parseIdentity(value: unknown): Result<ProjectionReadIdentity> {
  const inspected = inspectExactRecord(
    value,
    [["fingerprint", "generation"]],
    "projection-read-unavailable",
    "Projection read identity",
  );
  if (!inspected.ok) return unavailable("identity-malformed");
  const generation = parseGraphGeneration(inspected.value.generation);
  const fingerprint = parseProjectionCanonicalFingerprint(inspected.value.fingerprint);
  return generation.ok && fingerprint.ok
    ? success(Object.freeze({ fingerprint: fingerprint.value, generation: generation.value }))
    : unavailable("identity-malformed");
}

function parseCurrentManifest(value: unknown): Result<CurrentManifest> {
  const inspected = inspectExactRecord(
    value,
    [["bundle", "fingerprint", "generation", "integrity", "resourceCount", "schema"]],
    "projection-read-unavailable",
    "Projection read manifest",
  );
  if (!inspected.ok || inspected.value.schema !== bundleSchema) {
    return unavailable("manifest-malformed");
  }
  const identity = parseIdentity({
    fingerprint: inspected.value.fingerprint,
    generation: inspected.value.generation,
  });
  const integrity = parseProjectionReadIntegrity(inspected.value.integrity);
  if (
    !identity.ok ||
    !integrity.ok ||
    typeof inspected.value.bundle !== "string" ||
    typeof inspected.value.resourceCount !== "number" ||
    !Number.isSafeInteger(inspected.value.resourceCount) ||
    inspected.value.resourceCount <= 0
  ) {
    return unavailable("manifest-malformed");
  }
  const expected = bundleName(identity.value);
  return expected.ok && expected.value === inspected.value.bundle
    ? success(
        Object.freeze({
          ...identity.value,
          bundle: expected.value,
          integrity: integrity.value,
          resourceCount: inspected.value.resourceCount,
          schema: bundleSchema,
        }),
      )
    : unavailable("manifest-malformed");
}

function parseChunkManifest(
  value: unknown,
  schema: typeof catalogSchema | typeof adjacencySchema | typeof aliasesSchema,
  maximumItems: number,
  maximumChunks: number,
  maximumChunkItems: number,
  parseIdentityValue: (value: string) => boolean,
): Result<ChunkManifest> {
  const inspected = inspectExactRecord(
    value,
    [["chunks", "schema"]],
    "projection-read-unavailable",
    "Projection chunk manifest",
  );
  if (
    !inspected.ok ||
    inspected.value.schema !== schema ||
    !Array.isArray(inspected.value.chunks)
  ) {
    return unavailable("chunk-manifest-malformed");
  }
  if (inspected.value.chunks.length > maximumChunks) {
    return unavailable("chunk-manifest-bound");
  }
  const chunks: ChunkDescriptor[] = [];
  let total = 0;
  for (let chunkIndex = 0; chunkIndex < inspected.value.chunks.length; chunkIndex += 1) {
    const candidate = inspected.value.chunks[chunkIndex];
    const chunk = inspectExactRecord(
      candidate,
      [["count", "first", "last", "name"]],
      "projection-read-unavailable",
      "Projection chunk descriptor",
    );
    if (
      !chunk.ok ||
      typeof chunk.value.count !== "number" ||
      !Number.isSafeInteger(chunk.value.count) ||
      chunk.value.count <= 0 ||
      chunk.value.count > maximumChunkItems ||
      typeof chunk.value.first !== "string" ||
      typeof chunk.value.last !== "string" ||
      typeof chunk.value.name !== "string" ||
      !(Reflect.apply(intrinsicRegExpTest, chunkNamePattern, [chunk.value.name]) as boolean) ||
      !parseIdentityValue(chunk.value.first) ||
      !parseIdentityValue(chunk.value.last) ||
      chunk.value.first > chunk.value.last ||
      chunk.value.count > maximumItems - total ||
      (chunks.length > 0 && chunks[chunks.length - 1]!.last >= chunk.value.first)
    ) {
      return unavailable("chunk-manifest-malformed");
    }
    total += chunk.value.count;
    pushArray(
      chunks,
      Object.freeze({
        count: chunk.value.count,
        first: chunk.value.first,
        last: chunk.value.last,
        name: chunk.value.name,
      }),
    );
  }
  return success(Object.freeze({ chunks: Object.freeze(chunks), schema }));
}

function verifyProof(
  value: unknown,
  manifest: CurrentManifest,
  path: string,
  bytes: Uint8Array,
  maximumDepth: number,
): Result<void> {
  const inspected = inspectExactRecord(
    value,
    [["index", "path", "resourceCount", "schema", "siblings"]],
    "projection-read-unavailable",
    "Projection integrity proof",
  );
  if (
    !inspected.ok ||
    inspected.value.schema !== integrityProofSchema ||
    inspected.value.path !== path ||
    inspected.value.resourceCount !== manifest.resourceCount ||
    typeof inspected.value.index !== "number" ||
    !Number.isSafeInteger(inspected.value.index) ||
    inspected.value.index < 0 ||
    inspected.value.index >= manifest.resourceCount
  ) {
    return unavailable("integrity-proof-malformed");
  }
  const siblingLength = inspectIntrinsicArrayLength(
    inspected.value.siblings,
    "projection-read-unavailable",
    "Projection integrity proof siblings",
  );
  if (!siblingLength.ok || siblingLength.value > maximumDepth) {
    return unavailable("integrity-proof-bound");
  }
  const siblings = inspected.value.siblings as readonly unknown[];
  let current = leafDigest(path, bytes);
  let index = inspected.value.index;
  let width = manifest.resourceCount;
  let siblingIndex = 0;
  while (width > 1) {
    const expectsSibling = index % 2 === 1 || index + 1 < width;
    if (expectsSibling) {
      if (siblingIndex >= siblingLength.value) return unavailable("integrity-proof-malformed");
      const sibling = inspectExactRecord(
        siblings[siblingIndex],
        [["hash", "side"]],
        "projection-read-unavailable",
        "Projection integrity proof sibling",
      );
      const expectedSide = index % 2 === 1 ? "left" : "right";
      const hash = sibling.ok ? parseProjectionReadIntegrity(sibling.value.hash) : sibling;
      if (!sibling.ok || !hash.ok || sibling.value.side !== expectedSide) {
        return unavailable("integrity-proof-malformed");
      }
      current =
        expectedSide === "left"
          ? parentDigest(hash.value, current)
          : parentDigest(current, hash.value);
      siblingIndex += 1;
    }
    index = Math.floor(index / 2);
    width = Math.ceil(width / 2);
  }
  return siblingIndex === siblingLength.value && current === manifest.integrity
    ? success(undefined)
    : unavailable("integrity-proof-mismatch");
}

function chunked<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: (readonly T[])[] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    pushArray(chunks, Object.freeze(sliceArray(values, offset, offset + size)));
  }
  return Object.freeze(chunks);
}

function descriptors<T>(
  chunks: readonly (readonly T[])[],
  identity: (value: T) => string,
): readonly ChunkDescriptor[] {
  return Object.freeze(
    mapArray(chunks, (chunk, index) =>
      Object.freeze({
        count: chunk.length,
        first: identity(chunk[0]!),
        last: identity(chunk[chunk.length - 1]!),
        name: `${String(index).padStart(8, "0")}.json`,
      }),
    ),
  );
}

function parseEntity(value: unknown): Result<GraphEntity> {
  const inspected = inspectExactRecord(
    value,
    [["id", "kind", "payload"]],
    "projection-read-unavailable",
    "Projected entity",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.id !== "string" ||
    typeof inspected.value.kind !== "string"
  ) {
    return unavailable("entity-malformed");
  }
  const id = parseEntityId(inspected.value.id);
  const payload = copyGraphPayload(inspected.value.payload, "entity");
  return id.ok && payload.ok
    ? success(Object.freeze({ id: id.value, kind: inspected.value.kind, payload: payload.value }))
    : unavailable("entity-malformed");
}

function parseRelation(value: unknown): Result<GraphRelation> {
  const inspected = inspectExactRecord(
    value,
    [["id", "payload", "source", "target", "type"]],
    "projection-read-unavailable",
    "Projected relation",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.id !== "string" ||
    typeof inspected.value.source !== "string" ||
    typeof inspected.value.target !== "string" ||
    typeof inspected.value.type !== "string"
  ) {
    return unavailable("relation-malformed");
  }
  const id = parseRelationId(inspected.value.id);
  const source = parseEntityId(inspected.value.source);
  const target = parseEntityId(inspected.value.target);
  const payload = copyGraphPayload(inspected.value.payload, "relation");
  return id.ok && source.ok && target.ok && payload.ok
    ? success(
        Object.freeze({
          id: id.value,
          payload: payload.value,
          source: source.value,
          target: target.value,
          type: inspected.value.type,
        }),
      )
    : unavailable("relation-malformed");
}

function parseAlias(value: unknown): Result<EntityAlias> {
  const inspected = inspectExactRecord(
    value,
    [["source", "target"]],
    "projection-read-unavailable",
    "Projection alias",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.source !== "string" ||
    typeof inspected.value.target !== "string"
  ) {
    return unavailable("alias-malformed");
  }
  const source = parseEntityId(inspected.value.source);
  const target = parseEntityId(inspected.value.target);
  return source.ok && target.ok
    ? success(Object.freeze({ source: source.value, target: target.value }))
    : unavailable("alias-malformed");
}

function parseCatalogEntry(value: unknown, maximumText: number): Result<ProjectionCatalogEntry> {
  const inspected = inspectExactRecord(
    value,
    [["id", "kind", "searchableText"]],
    "projection-read-unavailable",
    "Projection catalog entry",
  );
  if (
    !inspected.ok ||
    typeof inspected.value.id !== "string" ||
    typeof inspected.value.kind !== "string" ||
    typeof inspected.value.searchableText !== "string" ||
    inspected.value.searchableText.length > maximumText
  ) {
    return unavailable("catalog-entry-malformed");
  }
  const id = parseEntityId(inspected.value.id);
  return id.ok
    ? success(
        Object.freeze({
          id: id.value,
          kind: inspected.value.kind,
          searchableText: inspected.value.searchableText,
        }),
      )
    : unavailable("catalog-entry-malformed");
}

function copyLiveEntityIds(value: unknown, maximum: number): Result<readonly EntityId[]> {
  const length = inspectIntrinsicArrayLength(
    value,
    "projection-read-unavailable",
    "Exact entity batch identities",
  );
  if (!length.ok || length.value === 0 || length.value > maximum) {
    return unavailable("entity-batch-malformed");
  }
  const ids: EntityId[] = [];
  let previous: EntityId | undefined;
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Reflect.apply(intrinsicObjectGetOwnPropertyDescriptor, Object, [
      value,
      String(index),
    ]) as PropertyDescriptor | undefined;
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      return unavailable("entity-batch-malformed");
    }
    const id = parseEntityId(descriptor.value);
    if (!id.ok || (previous !== undefined && previous >= id.value)) {
      return unavailable("entity-batch-malformed");
    }
    previous = id.value;
    pushArray(ids, id.value);
  }
  return success(Object.freeze(ids));
}

function catalogEntry(projected: ProjectedEntity): ProjectionCatalogEntry {
  return Object.freeze({
    id: projected.entity.id,
    kind: projected.entity.kind,
    searchableText: projected.searchableText,
  });
}

function derivedSearchableText(entity: GraphEntity, maximum: number): Result<string> {
  const parts: string[] = [];
  let characters = 0;
  const append = (value: string): boolean => {
    if (value.length > maximum - characters) return false;
    const normalized = Reflect.apply(intrinsicNormalize, value, ["NFKC"]) as string;
    if (normalized.length > maximum - characters) return false;
    const lowered = Reflect.apply(intrinsicToLowerCase, normalized, []) as string;
    const separator = parts.length === 0 ? 0 : 1;
    if (lowered.length > maximum - characters - separator) return false;
    characters += separator + lowered.length;
    pushArray(parts, lowered);
    return true;
  };
  const collect = (value: GraphData): boolean => {
    if (typeof value === "string") return append(value);
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!collect(value[index]!)) return false;
      }
      return true;
    }
    if (typeof value !== "object" || value === null) return true;
    const record = value as Readonly<Record<string, GraphData>>;
    const keys = sortInPlace(
      Reflect.apply(intrinsicObjectKeys, Object, [record]) as string[],
      compareText,
    );
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
      if (!collect(record[key]!)) return false;
    }
    return true;
  };
  return append(entity.id) && append(entity.kind) && collect(entity.payload)
    ? success(Reflect.apply(intrinsicArrayJoin, parts, ["\n"]) as string)
    : unavailable("publication-searchable-text-bound");
}

function publicationFingerprint(
  aliases: readonly EntityAlias[],
  entities: readonly GraphEntity[],
  relations: readonly GraphRelation[],
  maximum: number,
): Result<string> {
  const copied = copyCanonicalGraphData({ aliases, entities, relations }, "query", {
    code: "projection-read-publication-bound-exceeded",
    maximum,
    message: "Canonical projection content exceeds its configured fingerprint bound",
  });
  return copied.ok
    ? success(`sha256:${createHash("sha256").update(copied.value.canonicalJson).digest("hex")}`)
    : unavailable("publication-fingerprint-bound");
}

function normalizePublicationSnapshot(
  value: unknown,
  bounds: LocalProjectionReadBounds,
): Result<ProjectionSnapshot> {
  const copied = copyCanonicalGraphData(value, "query", {
    code: "projection-read-publication-bound-exceeded",
    maximum: bounds.maxBytes,
    message: "A partial-read publication exceeds its configured total byte bound",
  });
  if (!copied.ok) return unavailable("publication-byte-bound");
  const root = inspectExactRecord(
    copied.value.value,
    [["adjacency", "aliases", "entities", "fingerprint", "generation", "relations"]],
    "projection-read-unavailable",
    "Projection read publication",
  );
  if (!root.ok) return unavailable("publication-malformed");
  const generation = parseGraphGeneration(root.value.generation);
  const fingerprint = parseProjectionCanonicalFingerprint(root.value.fingerprint);
  const arrays = [
    root.value.entities,
    root.value.aliases,
    root.value.relations,
    root.value.adjacency,
  ];
  let arraysValid = true;
  for (let index = 0; index < arrays.length; index += 1) {
    const value = arrays[index];
    if (!Array.isArray(value)) {
      arraysValid = false;
      break;
    }
  }
  if (
    !generation.ok ||
    !fingerprint.ok ||
    !(Reflect.apply(intrinsicRegExpTest, sha256FingerprintPattern, [
      fingerprint.value,
    ]) as boolean) ||
    !arraysValid ||
    (root.value.entities as readonly unknown[]).length > bounds.maxEntities ||
    (root.value.aliases as readonly unknown[]).length > bounds.maxAliases ||
    (root.value.relations as readonly unknown[]).length > bounds.maxRelations ||
    (root.value.adjacency as readonly unknown[]).length > bounds.maxEntities
  ) {
    return unavailable("publication-malformed-or-bound");
  }

  const entities: ProjectedEntity[] = [];
  const entityIds = new Set<EntityId>();
  const rawEntities = root.value.entities as readonly unknown[];
  for (let index = 0; index < rawEntities.length; index += 1) {
    const candidate = rawEntities[index];
    const projected = inspectExactRecord(
      candidate,
      [["entity", "searchableText"]],
      "projection-read-unavailable",
      "Projected publication entity",
    );
    if (
      !projected.ok ||
      typeof projected.value.searchableText !== "string" ||
      projected.value.searchableText.length > bounds.maxSearchableTextCharacters
    ) {
      return unavailable("publication-entity-malformed");
    }
    const entity = parseEntity(projected.value.entity);
    const searchable = entity.ok
      ? derivedSearchableText(entity.value, bounds.maxSearchableTextCharacters)
      : entity;
    if (
      !entity.ok ||
      !searchable.ok ||
      searchable.value !== projected.value.searchableText ||
      entityIds.has(entity.value.id) ||
      (entities.length > 0 && entities[entities.length - 1]!.entity.id >= entity.value.id)
    ) {
      return unavailable("publication-entity-malformed");
    }
    entityIds.add(entity.value.id);
    pushArray(entities, Object.freeze({ entity: entity.value, searchableText: searchable.value }));
  }

  const aliases: EntityAlias[] = [];
  const rawAliases = root.value.aliases as readonly unknown[];
  for (let index = 0; index < rawAliases.length; index += 1) {
    const candidate = rawAliases[index];
    const alias = parseAlias(candidate);
    if (
      !alias.ok ||
      entityIds.has(alias.value.source) ||
      (aliases.length > 0 && aliases[aliases.length - 1]!.source >= alias.value.source)
    ) {
      return unavailable("publication-alias-malformed");
    }
    pushArray(aliases, alias.value);
  }
  if (!createEntityAliasResolver(aliases, entityIds, Math.max(1, bounds.maxAliases)).ok) {
    return unavailable("publication-alias-malformed");
  }

  const relations: GraphRelation[] = [];
  const relationById = new Map<RelationId, GraphRelation>();
  const rawRelations = root.value.relations as readonly unknown[];
  for (let index = 0; index < rawRelations.length; index += 1) {
    const candidate = rawRelations[index];
    const relation = parseRelation(candidate);
    if (
      !relation.ok ||
      !entityIds.has(relation.value.source) ||
      !entityIds.has(relation.value.target) ||
      relationById.has(relation.value.id) ||
      (relations.length > 0 && relations[relations.length - 1]!.id >= relation.value.id)
    ) {
      return unavailable("publication-relation-malformed");
    }
    relationById.set(relation.value.id, relation.value);
    pushArray(relations, relation.value);
  }
  const expectedFingerprint = publicationFingerprint(
    aliases,
    mapArray(entities, (projected) => projected.entity),
    relations,
    bounds.maxBytes,
  );
  if (!expectedFingerprint.ok || expectedFingerprint.value !== fingerprint.value) {
    return unavailable("publication-fingerprint-mismatch");
  }

  const adjacency: {
    readonly entity: EntityId;
    readonly incoming: readonly RelationId[];
    readonly outgoing: readonly RelationId[];
  }[] = [];
  const incomingSeen = new Set<RelationId>();
  const outgoingSeen = new Set<RelationId>();
  const rawAdjacency = root.value.adjacency as readonly unknown[];
  for (let entryIndex = 0; entryIndex < rawAdjacency.length; entryIndex += 1) {
    const candidate = rawAdjacency[entryIndex];
    const entry = inspectExactRecord(
      candidate,
      [["entity", "incoming", "outgoing"]],
      "projection-read-unavailable",
      "Projection adjacency publication",
    );
    if (
      !entry.ok ||
      typeof entry.value.entity !== "string" ||
      !Array.isArray(entry.value.incoming) ||
      !Array.isArray(entry.value.outgoing) ||
      entry.value.incoming.length > bounds.maxRelations ||
      entry.value.outgoing.length > bounds.maxRelations
    ) {
      return unavailable("publication-adjacency-malformed");
    }
    const entity = parseEntityId(entry.value.entity);
    if (
      !entity.ok ||
      !entityIds.has(entity.value) ||
      (adjacency.length > 0 && adjacency[adjacency.length - 1]!.entity >= entity.value)
    ) {
      return unavailable("publication-adjacency-malformed");
    }
    const parsedDirections: Record<"incoming" | "outgoing", RelationId[]> = {
      incoming: [],
      outgoing: [],
    };
    const directions = ["incoming", "outgoing"] as const;
    for (let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
      const direction = directions[directionIndex]!;
      const seen = direction === "incoming" ? incomingSeen : outgoingSeen;
      const rawIds = entry.value[direction] as readonly unknown[];
      for (let relationIndex = 0; relationIndex < rawIds.length; relationIndex += 1) {
        const rawId = rawIds[relationIndex];
        if (typeof rawId !== "string") return unavailable("publication-adjacency-malformed");
        const id = parseRelationId(rawId);
        const prior = parsedDirections[direction][parsedDirections[direction].length - 1];
        const relation = id.ok ? relationById.get(id.value) : undefined;
        if (
          !id.ok ||
          relation === undefined ||
          seen.has(id.value) ||
          (prior !== undefined && prior >= id.value) ||
          (direction === "incoming" ? relation.target : relation.source) !== entity.value
        ) {
          return unavailable("publication-adjacency-malformed");
        }
        seen.add(id.value);
        pushArray(parsedDirections[direction], id.value);
      }
    }
    pushArray(
      adjacency,
      Object.freeze({
        entity: entity.value,
        incoming: Object.freeze(parsedDirections.incoming),
        outgoing: Object.freeze(parsedDirections.outgoing),
      }),
    );
  }
  if (
    adjacency.length !== entities.length ||
    incomingSeen.size !== relations.length ||
    outgoingSeen.size !== relations.length
  ) {
    return unavailable("publication-adjacency-incomplete");
  }
  return success(
    Object.freeze({
      adjacency: Object.freeze(adjacency),
      aliases: Object.freeze(aliases),
      entities: Object.freeze(entities),
      fingerprint: fingerprint.value,
      generation: generation.value,
      relations: Object.freeze(relations),
    }),
  );
}

export function createLocalProjectionReadIndex(
  options: LocalProjectionReadIndexOptions,
): LocalProjectionReadIndex {
  const bounds = parseBounds(options.bounds);
  const { checkpoint, resources } = options;
  const ensureProjection = options.ensureProjection;
  const repairProjection = options.repairProjection;
  if (typeof ensureProjection !== "function") {
    throw new TypeError("ensureProjection must be one callable reconstruction boundary");
  }
  if (typeof repairProjection !== "function") {
    throw new TypeError("repairProjection must be one callable forced reconstruction boundary");
  }
  const maximumEntityChunks = Math.ceil(bounds.maxEntities / localProjectionChunkItems);
  const maximumAliasChunks = Math.ceil(bounds.maxAliases / localProjectionChunkItems);
  const maximumRelationChunks = Math.ceil(bounds.maxRelations / localProjectionChunkItems);
  const maximumResourceCount = maximumResources(bounds);
  const proofByteBound = maximumProofBytes(maximumResourceCount);
  const maximumProofDepth = Math.ceil(Math.log2(Math.max(2, maximumResourceCount)));
  let validated: ProjectionReadIdentity | undefined;
  let validatedIntegrity: ProjectionReadIntegrity | undefined;
  let validatedResourceCount: number | undefined;
  let ensureInFlight: Promise<Result<ProjectionSnapshot>> | undefined;
  let repairInFlight: Promise<Result<ProjectionSnapshot>> | undefined;
  let adoptionEpoch = 0;

  const ensure = async (): Promise<Result<ProjectionSnapshot>> => {
    if (ensureInFlight === undefined) {
      const pending = Reflect.apply(ensureProjection, undefined, []) as Promise<
        Result<ProjectionSnapshot>
      >;
      ensureInFlight = Reflect.apply(intrinsicPromiseFinally, pending, [
        () => {
          ensureInFlight = undefined;
        },
      ]) as Promise<Result<ProjectionSnapshot>>;
    }
    return ensureInFlight;
  };

  const repair = async (): Promise<Result<ProjectionSnapshot>> => {
    if (repairInFlight === undefined) {
      const pending = Reflect.apply(repairProjection, undefined, []) as Promise<
        Result<ProjectionSnapshot>
      >;
      repairInFlight = Reflect.apply(intrinsicPromiseFinally, pending, [
        () => {
          repairInFlight = undefined;
        },
      ]) as Promise<Result<ProjectionSnapshot>>;
    }
    return repairInFlight;
  };

  const readManifestVisibility = async (): Promise<ProjectionVisibility<CurrentManifest>> => {
    try {
      const target = currentLocator();
      if (!target.ok) {
        return { result: unavailable("manifest-locator"), state: "unavailable" };
      }
      const read = await resources.read({ locator: target.value, maxBytes: bounds.maxBytes });
      if (!read.ok) {
        const code = firstDiagnosticCode(read);
        return code === "resource-missing" || code === "resource-too-large"
          ? { state: "rebuildable" }
          : { result: unavailable("manifest-read"), state: "unavailable" };
      }
      let raw: unknown;
      try {
        const source = Reflect.apply(intrinsicTextDecode, decoder, [read.value.bytes]) as string;
        raw = Reflect.apply(intrinsicJsonParse, JSON, [source]) as unknown;
      } catch {
        return { state: "rebuildable" };
      }
      const parsed = parseCurrentManifest(raw);
      return parsed.ok && parsed.value.resourceCount <= maximumResourceCount
        ? { state: "visible", value: parsed.value }
        : { state: "rebuildable" };
    } catch {
      return { result: unavailable("manifest-read"), state: "unavailable" };
    }
  };

  const readCheckpointVisibility = async (
    manifest: CurrentManifest,
  ): Promise<ProjectionVisibility<void>> => {
    if (checkpoint === undefined) return { state: "visible", value: undefined };
    let raw: unknown;
    try {
      raw = await checkpoint.readProjectionCheckpoint();
    } catch {
      return { result: unavailable("checkpoint-unavailable"), state: "unavailable" };
    }
    const envelope = inspectExactRecord(
      raw,
      [
        ["diagnostics", "ok"],
        ["ok", "value"],
      ],
      "projection-read-unavailable",
      "Projection checkpoint result",
    );
    if (!envelope.ok || envelope.value.ok !== true) {
      return { result: unavailable("checkpoint-unavailable"), state: "unavailable" };
    }
    const inspected = inspectExactRecord(
      envelope.value.value,
      [["generation", "projection", "projectionIntegrity", "projectionResourceCount"]],
      "projection-read-unavailable",
      "Projection continuity checkpoint",
    );
    if (!inspected.ok) {
      return { result: unavailable("checkpoint-unavailable"), state: "unavailable" };
    }
    const generation = parseGraphGeneration(inspected.value.generation);
    if (!generation.ok) {
      return { result: unavailable("checkpoint-unavailable"), state: "unavailable" };
    }
    if (
      inspected.value.projection === null &&
      inspected.value.projectionIntegrity === null &&
      inspected.value.projectionResourceCount === null
    ) {
      return { state: "rebuildable" };
    }
    const projection = parseIdentity(inspected.value.projection);
    const integrity = parseProjectionReadIntegrity(inspected.value.projectionIntegrity);
    if (
      !projection.ok ||
      !integrity.ok ||
      typeof inspected.value.projectionResourceCount !== "number" ||
      !Number.isSafeInteger(inspected.value.projectionResourceCount) ||
      inspected.value.projectionResourceCount <= 0
    ) {
      return { result: unavailable("checkpoint-unavailable"), state: "unavailable" };
    }
    return generation.value === projection.value.generation &&
      sameIdentity(projection.value, manifest) &&
      integrity.value === manifest.integrity &&
      inspected.value.projectionResourceCount === manifest.resourceCount
      ? { state: "visible", value: undefined }
      : { state: "rebuildable" };
  };

  const adopt = async (
    snapshot: ProjectionSnapshot,
  ): Promise<Result<{ readonly commit: () => Result<void> } | undefined>> => {
    adoptionEpoch += 1;
    const epoch = adoptionEpoch;
    validated = undefined;
    validatedIntegrity = undefined;
    validatedResourceCount = undefined;
    try {
      const normalized = normalizePublicationSnapshot(snapshot, bounds);
      if (!normalized.ok) return normalized;
      if (checkpoint === undefined) return success(undefined);
      const manifestState = await readManifestVisibility();
      if (manifestState.state === "unavailable") return manifestState.result;
      if (manifestState.state === "rebuildable") return success(undefined);
      const manifest = manifestState.value;
      const expected = identityOf(normalized.value);
      if (!sameIdentity(manifest, expected)) {
        return success(undefined);
      }
      const checkpointState = await readCheckpointVisibility(manifest);
      if (checkpointState.state === "unavailable") return checkpointState.result;
      if (checkpointState.state === "rebuildable") return success(undefined);
      const provisionalIntegrity = manifest.integrity;
      const provisionalResourceCount = manifest.resourceCount;
      return success(
        Object.freeze({
          commit: (): Result<void> => {
            if (epoch !== adoptionEpoch) return unavailable("adoption-stale");
            validated = expected;
            validatedIntegrity = provisionalIntegrity;
            validatedResourceCount = provisionalResourceCount;
            return success(undefined);
          },
        }),
      );
    } catch {
      return unavailable("adoption-read");
    }
  };

  const readVerifiedJson = async (
    manifest: CurrentManifest,
    ...segments: readonly string[]
  ): Promise<Result<unknown>> => {
    const path = resourcePath(segments);
    const target = bundledLocator(manifest.bundle, segments);
    if (!target.ok) return unavailable("resource-locator");
    const raw = await resources.read({ locator: target.value, maxBytes: bounds.maxBytes });
    if (!raw.ok) {
      const code = firstDiagnosticCode(raw);
      return code === "resource-missing" || code === "resource-too-large"
        ? repairableUnavailable("resource-read")
        : unavailable("resource-read");
    }
    const proofTarget = integrityLocator(manifest.bundle, path);
    if (!proofTarget.ok) return unavailable("proof-locator");
    const proofRead = await resources.read({
      locator: proofTarget.value,
      maxBytes: proofByteBound,
    });
    if (!proofRead.ok) {
      const code = firstDiagnosticCode(proofRead);
      return code === "resource-missing" || code === "resource-too-large"
        ? repairableUnavailable("proof-read")
        : unavailable("proof-read");
    }
    let proof: unknown;
    try {
      const source = Reflect.apply(intrinsicTextDecode, decoder, [proofRead.value.bytes]) as string;
      proof = Reflect.apply(intrinsicJsonParse, JSON, [source]) as unknown;
    } catch {
      return repairableUnavailable("proof-malformed");
    }
    const verified = verifyProof(proof, manifest, path, raw.value.bytes, maximumProofDepth);
    if (!verified.ok) return markRepairable(verified);
    try {
      const source = Reflect.apply(intrinsicTextDecode, decoder, [raw.value.bytes]) as string;
      return success(Reflect.apply(intrinsicJsonParse, JSON, [source]) as unknown);
    } catch {
      return repairableUnavailable("resource-malformed");
    }
  };

  const cleanupOldBundleFiles = async (currentBundle: string): Promise<void> => {
    const root = locator();
    const current = locator(currentBundle);
    if (!root.ok || !current.ok) return;
    const removals: WorkspaceResourceLocator[] = [];
    const staleRoots: WorkspaceResourceLocator[] = [];
    const maximumRemovalLocatorCharacters = 4 * 1024 * 1024;
    const maximumCleanupEntries = 10_000;
    const maximumDirectoryEntries = Math.min(
      maximumResourceCount,
      localResourceProviderDefaultMaxEntriesPerDirectory,
    );
    let removalLocatorCharacters = 0;
    let cursor: ResourceContinuationCursor | undefined;
    let remaining = maximumCleanupEntries;
    let capped = false;
    // Discover bundle roots without descending into the current bundle. Root paging
    // has its own bound, so current projection files cannot spend the stale-file budget.
    while (remaining > 0) {
      const page = await resources.enumerate({
        ...(cursor === undefined ? {} : { cursor }),
        limit: Math.min(100, remaining),
        locator: root.value,
        maxDepth: 0,
        maxEntriesPerDirectory: maximumDirectoryEntries,
      });
      if (!page.ok) return;
      remaining -= page.value.entries.length;
      for (let index = 0; index < page.value.entries.length; index += 1) {
        const entry = page.value.entries[index]!;
        if (entry.locator === current.value) continue;
        if (entry.kind === "directory") {
          pushArray(staleRoots, entry.locator);
        } else if (entry.kind === "file") {
          if (
            removals.length >= maximumCleanupEntries ||
            entry.locator.length > maximumRemovalLocatorCharacters - removalLocatorCharacters
          ) {
            capped = true;
            break;
          }
          removalLocatorCharacters += entry.locator.length;
          pushArray(removals, entry.locator);
        }
      }
      if (capped || page.value.nextCursor === undefined || page.value.entries.length === 0) break;
      cursor = page.value.nextCursor;
    }
    let remainingStaleEntries = maximumCleanupEntries;
    for (
      let rootIndex = 0;
      rootIndex < staleRoots.length && remainingStaleEntries > 0 && !capped;
      rootIndex += 1
    ) {
      cursor = undefined;
      while (remainingStaleEntries > 0) {
        const page = await resources.enumerate({
          ...(cursor === undefined ? {} : { cursor }),
          limit: Math.min(100, remainingStaleEntries),
          locator: staleRoots[rootIndex]!,
          maxDepth: 4,
          maxEntriesPerDirectory: maximumDirectoryEntries,
        });
        if (!page.ok) return;
        remainingStaleEntries -= page.value.entries.length;
        for (let index = 0; index < page.value.entries.length; index += 1) {
          const entry = page.value.entries[index]!;
          if (entry.kind !== "file") continue;
          if (
            removals.length >= maximumCleanupEntries ||
            entry.locator.length > maximumRemovalLocatorCharacters - removalLocatorCharacters
          ) {
            capped = true;
            break;
          }
          removalLocatorCharacters += entry.locator.length;
          pushArray(removals, entry.locator);
        }
        if (capped || page.value.nextCursor === undefined || page.value.entries.length === 0) break;
        cursor = page.value.nextCursor;
      }
    }
    // Enumeration cursors name an existing entry. Deleting only after enumeration
    // completes keeps every continuation anchor stable across all collected pages.
    for (let index = 0; index < removals.length; index += 1) {
      await resources.removeResource(removals[index]!);
    }
  };

  const readVisibleManifest = async (): Promise<ProjectionVisibility<CurrentManifest>> => {
    const manifestState = await readManifestVisibility();
    if (manifestState.state !== "visible") return manifestState;
    const manifest = manifestState.value;
    if (checkpoint !== undefined) {
      const checkpointState = await readCheckpointVisibility(manifest);
      if (checkpointState.state !== "visible") return checkpointState;
    } else if (
      validatedIntegrity !== manifest.integrity ||
      validatedResourceCount !== manifest.resourceCount
    ) {
      return { state: "rebuildable" };
    }
    return { state: "visible", value: manifest };
  };

  const identity = async (): Promise<Result<ProjectionReadIdentity>> => {
    try {
      if (validated === undefined) {
        const ensured = await ensure();
        if (!ensured.ok) return unavailable("initial-validation");
        validated = identityOf(ensured.value);
      }
      let visible = await readVisibleManifest();
      if (visible.state === "unavailable") return visible.result;
      if (visible.state === "rebuildable" || !sameIdentity(visible.value, validated)) {
        const ensured = await ensure();
        if (!ensured.ok) return unavailable("continuity-rebuild");
        validated = identityOf(ensured.value);
        visible = await readVisibleManifest();
      }
      if (visible.state === "unavailable") return visible.result;
      return visible.state === "visible" && sameIdentity(visible.value, validated)
        ? success(
            Object.freeze({
              fingerprint: visible.value.fingerprint,
              generation: visible.value.generation,
            }),
          )
        : unavailable("continuity-mismatch");
    } catch {
      return unavailable("identity-read");
    }
  };

  const requireIdentity = async (
    expected: ProjectionReadIdentity,
  ): Promise<Result<CurrentManifest>> => {
    const current = await identity();
    if (!current.ok) return current;
    if (!sameIdentity(expected, current.value)) return unavailable("identity-changed");
    const manifest = await readVisibleManifest();
    if (manifest.state === "unavailable") return manifest.result;
    return manifest.state === "visible" && sameIdentity(manifest.value, current.value)
      ? success(manifest.value)
      : unavailable("identity-changed");
  };

  const readLiveEntity = async (
    manifest: CurrentManifest,
    id: EntityId,
  ): Promise<Result<GraphEntity>> => {
    const read = await readVerifiedJson(manifest, "entities", `${id}.json`);
    return read.ok ? markRepairable(parseEntity(read.value)) : read;
  };

  const readCatalogManifest = async (manifest: CurrentManifest): Promise<Result<ChunkManifest>> => {
    const raw = await readVerifiedJson(manifest, "catalog.json");
    return raw.ok
      ? markRepairable(
          parseChunkManifest(
            raw.value,
            catalogSchema,
            bounds.maxEntities,
            maximumEntityChunks,
            localProjectionChunkItems,
            (value) => parseEntityId(value).ok,
          ),
        )
      : raw;
  };

  const lookupCatalog = async (
    manifest: CurrentManifest,
    id: EntityId,
  ): Promise<Result<ProjectionCatalogEntry | undefined>> => {
    const catalog = await readCatalogManifest(manifest);
    if (!catalog.ok) return catalog;
    let descriptor: ChunkDescriptor | undefined;
    for (let index = 0; index < catalog.value.chunks.length; index += 1) {
      const candidate = catalog.value.chunks[index]!;
      if (candidate.first <= id && id <= candidate.last) {
        descriptor = candidate;
        break;
      }
    }
    if (descriptor === undefined) return success(undefined);
    const raw = await readVerifiedJson(manifest, "catalog", descriptor.name);
    if (!raw.ok || !Array.isArray(raw.value) || raw.value.length !== descriptor.count) {
      return raw.ok ? repairableUnavailable("catalog-chunk-malformed") : raw;
    }
    let previous: string | undefined;
    let selected: ProjectionCatalogEntry | undefined;
    for (let index = 0; index < raw.value.length; index += 1) {
      const candidate = raw.value[index];
      const entry = parseCatalogEntry(candidate, bounds.maxSearchableTextCharacters);
      if (!entry.ok || (previous !== undefined && previous >= entry.value.id)) {
        return repairableUnavailable("catalog-chunk-malformed");
      }
      previous = entry.value.id;
      if (entry.value.id === id) selected = entry.value;
    }
    return raw.value[0]?.id === descriptor.first &&
      raw.value[raw.value.length - 1]?.id === descriptor.last
      ? success(selected)
      : repairableUnavailable("catalog-chunk-malformed");
  };

  const lookupAlias = async (
    manifest: CurrentManifest,
    source: EntityId,
  ): Promise<Result<EntityAlias | undefined>> => {
    const rawManifest = await readVerifiedJson(manifest, "aliases.json");
    if (!rawManifest.ok) return rawManifest;
    const aliases = markRepairable(
      parseChunkManifest(
        rawManifest.value,
        aliasesSchema,
        bounds.maxAliases,
        maximumAliasChunks,
        localProjectionChunkItems,
        (value) => parseEntityId(value).ok,
      ),
    );
    if (!aliases.ok) return aliases;
    let descriptor: ChunkDescriptor | undefined;
    for (let index = 0; index < aliases.value.chunks.length; index += 1) {
      const candidate = aliases.value.chunks[index]!;
      if (candidate.first <= source && source <= candidate.last) {
        descriptor = candidate;
        break;
      }
    }
    if (descriptor === undefined) return success(undefined);
    const raw = await readVerifiedJson(manifest, "aliases", descriptor.name);
    if (!raw.ok || !Array.isArray(raw.value) || raw.value.length !== descriptor.count) {
      return raw.ok ? repairableUnavailable("alias-chunk-malformed") : raw;
    }
    let previous: string | undefined;
    let selected: EntityAlias | undefined;
    for (let index = 0; index < raw.value.length; index += 1) {
      const candidate = raw.value[index];
      const alias = parseAlias(candidate);
      if (!alias.ok || (previous !== undefined && previous >= alias.value.source)) {
        return repairableUnavailable("alias-chunk-malformed");
      }
      previous = alias.value.source;
      if (alias.value.source === source) selected = alias.value;
    }
    return raw.value[0]?.source === descriptor.first &&
      raw.value[raw.value.length - 1]?.source === descriptor.last
      ? success(selected)
      : repairableUnavailable("alias-chunk-malformed");
  };

  const retryAfterRepair = async <T>(
    expected: ProjectionReadIdentity,
    result: Result<T>,
    action: () => Promise<Result<T>>,
  ): Promise<Result<T>> => {
    if (!isRepairable(result)) return result;
    const repaired = await repair();
    if (!repaired.ok || !sameIdentity(identityOf(repaired.value), expected)) {
      return unavailable("repair-identity-changed");
    }
    return action();
  };

  const exactCatalogEntry = async (expected: ProjectionReadIdentity, requested: EntityId) => {
    try {
      const capturedExpected = parseIdentity(expected);
      if (!capturedExpected.ok) return capturedExpected;
      const id = parseEntityId(requested);
      if (!id.ok) return id;
      const action = async (): Promise<Result<ProjectionReadExact<ProjectionCatalogEntry>>> => {
        const manifest = await requireIdentity(capturedExpected.value);
        if (!manifest.ok) return manifest;
        const catalog = await lookupCatalog(manifest.value, id.value);
        if (!catalog.ok) return catalog;
        if (catalog.value === undefined) return anchorMismatch();
        return success(
          Object.freeze({
            identity: Object.freeze({
              fingerprint: manifest.value.fingerprint,
              generation: manifest.value.generation,
            }),
            value: catalog.value,
          }),
        );
      };
      const result = await action();
      return retryAfterRepair(capturedExpected.value, result, action);
    } catch {
      return unavailable("catalog-exact-read");
    }
  };

  const exactEntities = async (
    expected: ProjectionReadIdentity,
    requested: readonly EntityId[],
  ) => {
    try {
      const capturedExpected = parseIdentity(expected);
      if (!capturedExpected.ok) return capturedExpected;
      const ids = copyLiveEntityIds(requested, bounds.maxPageSize);
      if (!ids.ok) return ids;
      const action = async (): Promise<Result<ProjectionReadBatch<GraphEntity>>> => {
        const manifest = await requireIdentity(capturedExpected.value);
        if (!manifest.ok) return manifest;
        const items: GraphEntity[] = [];
        for (let index = 0; index < ids.value.length; index += 1) {
          const entity = await readLiveEntity(manifest.value, ids.value[index]!);
          if (!entity.ok || entity.value.id !== ids.value[index]) {
            return entity.ok ? repairableUnavailable("entity-batch-identity-mismatch") : entity;
          }
          pushArray(items, entity.value);
        }
        return success(
          Object.freeze({
            identity: Object.freeze({
              fingerprint: manifest.value.fingerprint,
              generation: manifest.value.generation,
            }),
            items: Object.freeze(items),
          }),
        );
      };
      const result = await action();
      return retryAfterRepair(capturedExpected.value, result, action);
    } catch {
      return unavailable("entity-batch-read");
    }
  };

  const exactEntity = async (expected: ProjectionReadIdentity, requested: EntityId) => {
    try {
      const capturedExpected = parseIdentity(expected);
      if (!capturedExpected.ok) return capturedExpected;
      const id = parseEntityId(requested);
      if (!id.ok) return id;
      const action = async (): Promise<Result<ProjectionReadExact<GraphEntity>>> => {
        const manifest = await requireIdentity(capturedExpected.value);
        if (!manifest.ok) return manifest;
        let current = id.value;
        const visited = new Set<EntityId>();
        for (let depth = 0; depth <= bounds.maxAliases; depth += 1) {
          const catalog = await lookupCatalog(manifest.value, current);
          if (!catalog.ok) return catalog;
          if (catalog.value !== undefined) {
            const entity = await readLiveEntity(manifest.value, current);
            return entity.ok
              ? success(
                  Object.freeze({
                    identity: Object.freeze({
                      fingerprint: manifest.value.fingerprint,
                      generation: manifest.value.generation,
                    }),
                    value: entity.value,
                  }),
                )
              : entity;
          }
          if (visited.has(current) || depth === bounds.maxAliases) {
            return repairableUnavailable("alias-cycle-or-bound");
          }
          visited.add(current);
          const alias = await lookupAlias(manifest.value, current);
          if (!alias.ok) return alias;
          if (alias.value === undefined) return unknownEntity();
          current = alias.value.target;
        }
        return unknownEntity();
      };
      const result = await action();
      return retryAfterRepair(capturedExpected.value, result, action);
    } catch {
      return unavailable("exact-read");
    }
  };

  const pageCatalog = async (
    expected: ProjectionReadIdentity,
    request: ProjectionCatalogReadRequest,
  ): Promise<Result<ProjectionReadPage<ProjectionCatalogEntry>>> => {
    try {
      const capturedExpected = parseIdentity(expected);
      if (!capturedExpected.ok) return capturedExpected;
      const inspected = inspectExactRecord(
        request,
        [["limit"], ["after", "limit"]],
        "projection-read-unavailable",
        "Projection catalog request",
      );
      if (
        !inspected.ok ||
        !Number.isSafeInteger(inspected.value.limit) ||
        (inspected.value.limit as number) <= 0 ||
        (inspected.value.limit as number) > bounds.maxPageSize
      ) {
        return unavailable("catalog-request-malformed");
      }
      const limit = inspected.value.limit as number;
      const afterValue = "after" in inspected.value ? inspected.value.after : undefined;
      if (afterValue !== undefined && typeof afterValue !== "string") {
        return unavailable("catalog-request-malformed");
      }
      const after = afterValue === undefined ? undefined : parseEntityId(afterValue);
      if (after !== undefined && !after.ok) return after;
      const action = async (): Promise<Result<ProjectionReadPage<ProjectionCatalogEntry>>> => {
        const manifest = await requireIdentity(capturedExpected.value);
        if (!manifest.ok) return manifest;
        const rawChunks = await readVerifiedJson(manifest.value, "catalog.json");
        if (!rawChunks.ok) return rawChunks;
        const parsedManifest = markRepairable(
          parseChunkManifest(
            rawChunks.value,
            catalogSchema,
            bounds.maxEntities,
            maximumEntityChunks,
            localProjectionChunkItems,
            (value) => parseEntityId(value).ok,
          ),
        );
        if (!parsedManifest.ok) return parsedManifest;
        let chunkIndex = 0;
        let anchorFound = after === undefined;
        if (after !== undefined) {
          chunkIndex = parsedManifest.value.chunks.findIndex(
            (chunk) => chunk.first <= after.value && after.value <= chunk.last,
          );
          if (chunkIndex < 0) return anchorMismatch();
        }
        const selected: ProjectionCatalogEntry[] = [];
        for (
          ;
          chunkIndex < parsedManifest.value.chunks.length && selected.length <= limit;
          chunkIndex += 1
        ) {
          const descriptor = parsedManifest.value.chunks[chunkIndex]!;
          const raw = await readVerifiedJson(manifest.value, "catalog", descriptor.name);
          if (!raw.ok || !Array.isArray(raw.value) || raw.value.length !== descriptor.count) {
            return raw.ok ? repairableUnavailable("catalog-chunk-malformed") : raw;
          }
          let previous: string | undefined;
          for (let itemIndex = 0; itemIndex < raw.value.length; itemIndex += 1) {
            const candidate = raw.value[itemIndex];
            const entry = parseCatalogEntry(candidate, bounds.maxSearchableTextCharacters);
            if (!entry.ok || (previous !== undefined && previous >= entry.value.id)) {
              return repairableUnavailable("catalog-chunk-malformed");
            }
            previous = entry.value.id;
            if (!anchorFound) {
              if (entry.value.id === after!.value) anchorFound = true;
              continue;
            }
            if (after !== undefined && entry.value.id === after.value) continue;
            pushArray(selected, entry.value);
            if (selected.length > limit) break;
          }
          if (raw.value.length > 0) {
            const first = (raw.value[0] as { id?: unknown }).id;
            const last = (raw.value[raw.value.length - 1] as { id?: unknown }).id;
            if (first !== descriptor.first || last !== descriptor.last) {
              return repairableUnavailable("catalog-chunk-malformed");
            }
          }
          if (!anchorFound) return anchorMismatch();
        }
        if (!anchorFound) return anchorMismatch();
        const hasMore = selected.length > limit;
        const items = Object.freeze(sliceArray(selected, 0, limit));
        const last = items[items.length - 1];
        return success(
          Object.freeze({
            hasMore,
            identity: Object.freeze({
              fingerprint: manifest.value.fingerprint,
              generation: manifest.value.generation,
            }),
            items,
            ...(hasMore && last !== undefined ? { nextAfter: last.id } : {}),
          }),
        );
      };
      const result = await action();
      return retryAfterRepair(capturedExpected.value, result, action);
    } catch {
      return unavailable("catalog-read");
    }
  };

  const pageRelations = async (
    expected: ProjectionReadIdentity,
    request: ProjectionRelationReadRequest,
  ): Promise<Result<ProjectionReadPage<ProjectionRelationRead>>> => {
    try {
      const capturedExpected = parseIdentity(expected);
      if (!capturedExpected.ok) return capturedExpected;
      const inspected = inspectExactRecord(
        request,
        [
          ["direction", "entity", "limit"],
          ["after", "direction", "entity", "limit"],
        ],
        "projection-read-unavailable",
        "Projection relation request",
      );
      if (
        !inspected.ok ||
        (inspected.value.direction !== "incoming" && inspected.value.direction !== "outgoing") ||
        typeof inspected.value.entity !== "string" ||
        !Number.isSafeInteger(inspected.value.limit) ||
        (inspected.value.limit as number) <= 0 ||
        (inspected.value.limit as number) > bounds.maxPageSize
      ) {
        return unavailable("relation-request-malformed");
      }
      const direction = inspected.value.direction;
      const limit = inspected.value.limit as number;
      const entity = parseEntityId(inspected.value.entity);
      const afterValue = "after" in inspected.value ? inspected.value.after : undefined;
      if (afterValue !== undefined && typeof afterValue !== "string") {
        return unavailable("relation-request-malformed");
      }
      const after = afterValue === undefined ? undefined : parseRelationId(afterValue);
      if (!entity.ok || (after !== undefined && !after.ok))
        return unavailable("relation-request-malformed");
      const action = async (): Promise<Result<ProjectionReadPage<ProjectionRelationRead>>> => {
        const manifest = await requireIdentity(capturedExpected.value);
        if (!manifest.ok) return manifest;
        const catalog = await lookupCatalog(manifest.value, entity.value);
        if (!catalog.ok) return catalog;
        if (catalog.value === undefined) return unknownEntity();
        const rawChunks = await readVerifiedJson(
          manifest.value,
          "adjacency",
          entity.value,
          `${direction}.json`,
        );
        if (!rawChunks.ok) return rawChunks;
        const parsedManifest = markRepairable(
          parseChunkManifest(
            rawChunks.value,
            adjacencySchema,
            bounds.maxRelations,
            maximumRelationChunks,
            localProjectionChunkItems,
            (value) => parseRelationId(value).ok,
          ),
        );
        if (!parsedManifest.ok) return parsedManifest;
        let chunkIndex = 0;
        let anchorFound = after === undefined;
        if (after !== undefined) {
          chunkIndex = parsedManifest.value.chunks.findIndex(
            (chunk) => chunk.first <= after.value && after.value <= chunk.last,
          );
          if (chunkIndex < 0) return anchorMismatch();
        }
        const ids: RelationId[] = [];
        for (
          ;
          chunkIndex < parsedManifest.value.chunks.length && ids.length <= limit;
          chunkIndex += 1
        ) {
          const descriptor = parsedManifest.value.chunks[chunkIndex]!;
          const raw = await readVerifiedJson(
            manifest.value,
            "adjacency",
            entity.value,
            direction,
            descriptor.name,
          );
          if (!raw.ok || !Array.isArray(raw.value) || raw.value.length !== descriptor.count) {
            return raw.ok ? repairableUnavailable("adjacency-chunk-malformed") : raw;
          }
          let previous: string | undefined;
          for (let itemIndex = 0; itemIndex < raw.value.length; itemIndex += 1) {
            const candidate = raw.value[itemIndex];
            if (typeof candidate !== "string") {
              return repairableUnavailable("adjacency-chunk-malformed");
            }
            const id = parseRelationId(candidate);
            if (!id.ok || (previous !== undefined && previous >= id.value)) {
              return repairableUnavailable("adjacency-chunk-malformed");
            }
            previous = id.value;
            if (!anchorFound) {
              if (id.value === after!.value) anchorFound = true;
              continue;
            }
            if (after !== undefined && id.value === after.value) continue;
            pushArray(ids, id.value);
            if (ids.length > limit) break;
          }
          if (
            raw.value[0] !== descriptor.first ||
            raw.value[raw.value.length - 1] !== descriptor.last
          ) {
            return repairableUnavailable("adjacency-chunk-malformed");
          }
          if (!anchorFound) return anchorMismatch();
        }
        if (!anchorFound) return anchorMismatch();
        const hasMore = ids.length > limit;
        const selected = sliceArray(ids, 0, limit);
        const items: ProjectionRelationRead[] = [];
        for (let index = 0; index < selected.length; index += 1) {
          const id = selected[index]!;
          const rawRelation = await readVerifiedJson(manifest.value, "relations", `${id}.json`);
          if (!rawRelation.ok) return rawRelation;
          const relation = markRepairable(parseRelation(rawRelation.value));
          if (!relation.ok) return relation;
          const neighbor = direction === "incoming" ? relation.value.source : relation.value.target;
          const endpoint = direction === "incoming" ? relation.value.target : relation.value.source;
          if (endpoint !== entity.value) {
            return repairableUnavailable("adjacency-endpoint-mismatch");
          }
          const projected = await readLiveEntity(manifest.value, neighbor);
          if (!projected.ok) return projected;
          pushArray(
            items,
            Object.freeze({
              direction,
              entity: projected.value,
              from: entity.value,
              relation: relation.value,
            }),
          );
        }
        const last = selected[selected.length - 1];
        return success(
          Object.freeze({
            hasMore,
            identity: Object.freeze({
              fingerprint: manifest.value.fingerprint,
              generation: manifest.value.generation,
            }),
            items: Object.freeze(items),
            ...(hasMore && last !== undefined ? { nextAfter: last } : {}),
          }),
        );
      };
      const result = await action();
      return retryAfterRepair(capturedExpected.value, result, action);
    } catch {
      return unavailable("relation-read");
    }
  };

  const publish = async (snapshot: ProjectionSnapshot): Promise<Result<void>> => {
    adoptionEpoch += 1;
    validated = undefined;
    validatedIntegrity = undefined;
    validatedResourceCount = undefined;
    try {
      const normalized = normalizePublicationSnapshot(snapshot, bounds);
      if (!normalized.ok) return normalized;
      const publication = normalized.value;
      const identity = identityOf(publication);
      const named = bundleName(identity);
      if (!named.ok) return named;
      const bundle = named.value;
      const encodedResources: EncodedResource[] = [];
      const addResource = (segments: readonly string[], value: unknown): Result<void> => {
        const encoded = encodeResource(segments, value, bounds.maxBytes);
        if (!encoded.ok) return encoded;
        pushArray(encodedResources, encoded.value);
        return success(undefined);
      };

      const catalogChunks = chunked(
        mapArray(publication.entities, catalogEntry),
        localProjectionChunkItems,
      );
      const catalogDescriptors = descriptors(catalogChunks, (entry) => entry.id);
      for (let index = 0; index < catalogChunks.length; index += 1) {
        const added = addResource(
          ["catalog", catalogDescriptors[index]!.name],
          catalogChunks[index],
        );
        if (!added.ok) return added;
      }
      const catalogManifest = addResource(["catalog.json"], {
        chunks: catalogDescriptors,
        schema: catalogSchema,
      });
      if (!catalogManifest.ok) return catalogManifest;

      const aliasChunks = chunked(publication.aliases, localProjectionChunkItems);
      const aliasDescriptors = descriptors(aliasChunks, (alias) => alias.source);
      for (let index = 0; index < aliasChunks.length; index += 1) {
        const added = addResource(["aliases", aliasDescriptors[index]!.name], aliasChunks[index]);
        if (!added.ok) return added;
      }
      const aliasManifest = addResource(["aliases.json"], {
        chunks: aliasDescriptors,
        schema: aliasesSchema,
      });
      if (!aliasManifest.ok) return aliasManifest;

      for (let index = 0; index < publication.entities.length; index += 1) {
        const projected = publication.entities[index]!;
        const added = addResource(["entities", `${projected.entity.id}.json`], projected.entity);
        if (!added.ok) return added;
      }
      for (let index = 0; index < publication.relations.length; index += 1) {
        const relation = publication.relations[index]!;
        const added = addResource(["relations", `${relation.id}.json`], relation);
        if (!added.ok) return added;
      }
      for (let entryIndex = 0; entryIndex < publication.adjacency.length; entryIndex += 1) {
        const entry = publication.adjacency[entryIndex]!;
        const directions = ["incoming", "outgoing"] as const;
        for (let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
          const direction = directions[directionIndex]!;
          const relationChunks = chunked(entry[direction], localProjectionChunkItems);
          const relationDescriptors = descriptors(relationChunks, (id) => id);
          for (let index = 0; index < relationChunks.length; index += 1) {
            const added = addResource(
              ["adjacency", entry.entity, direction, relationDescriptors[index]!.name],
              relationChunks[index],
            );
            if (!added.ok) return added;
          }
          const adjacencyManifest = addResource(["adjacency", entry.entity, `${direction}.json`], {
            chunks: relationDescriptors,
            schema: adjacencySchema,
          });
          if (!adjacencyManifest.ok) return adjacencyManifest;
        }
      }

      sortInPlace(encodedResources, (left, right) => compareText(left.path, right.path));
      let duplicatePath = false;
      for (let index = 1; index < encodedResources.length; index += 1) {
        if (encodedResources[index - 1]!.path >= encodedResources[index]!.path) {
          duplicatePath = true;
          break;
        }
      }
      if (
        encodedResources.length === 0 ||
        encodedResources.length > maximumResourceCount ||
        duplicatePath
      ) {
        return unavailable("publication-resource-bound-or-duplicate");
      }
      const levels = merkleLevels(encodedResources);
      const integrity = parseProjectionReadIntegrity(levels[levels.length - 1]![0]);
      if (!integrity.ok) return unavailable("publication-integrity-failed");

      // Every immutable resource and its bounded inclusion proof are durable before
      // the small current manifest makes this publication visible.
      for (let index = 0; index < encodedResources.length; index += 1) {
        const resource = encodedResources[index]!;
        const target = bundledLocator(bundle, resource.segments);
        if (!target.ok) return unavailable("resource-locator");
        const written = await publishBytes(resources, target.value, resource.bytes);
        if (!written.ok) return written;
        const proof = await publishJson(
          resources,
          integrityLocator(bundle, resource.path),
          proofFor(encodedResources, levels, index),
          proofByteBound,
        );
        if (!proof.ok) return proof;
      }

      // Visibility changes only after every immutable resource is durable.
      const current = await publishJson(
        resources,
        currentLocator(),
        {
          bundle,
          ...identity,
          integrity: integrity.value,
          resourceCount: encodedResources.length,
          schema: bundleSchema,
        },
        bounds.maxBytes,
      );
      if (!current.ok) return current;
      if (checkpoint !== undefined) {
        let recorded;
        try {
          recorded = await checkpoint.recordProjectionCheckpoint(
            identity,
            integrity.value,
            encodedResources.length,
          );
        } catch {
          return unavailable("checkpoint-record");
        }
        if (!recorded.ok) return unavailable("checkpoint-record");
      }
      validated = identity;
      validatedIntegrity = integrity.value;
      validatedResourceCount = encodedResources.length;
      try {
        await cleanupOldBundleFiles(bundle);
      } catch {
        // Query bundles are disposable; cleanup changes only disk use and future rebuild cost.
      }
      return success(undefined);
    } catch {
      return unavailable("bundle-publication");
    }
  };

  const capability: ProjectionReadCapability = Object.freeze({
    exactCatalogEntry,
    exactEntities,
    exactEntity,
    identity,
    pageCatalog,
    pageRelations,
  });
  return Object.freeze({ adopt, capability, publish });
}
