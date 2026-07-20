import { createHash } from "node:crypto";

import {
  failure,
  parseContentRevision,
  parseResourceKey,
  success,
  type ContentRevision,
  type GraphData,
  type ResourceKey,
  type Result,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import {
  workspaceResourceLocator,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "./contracts.ts";

const indexSchema = "groma/evidence-index/v0.2";
const sourceSchema = "groma/evidence-source/v0.2";
const legacySchema = "groma/evidence/v0.1";
const evidenceRoot = ["groma", "evidence"] as const;
const legacyDocumentPrefix = "# Groma Evidence\n\n```json\n";
const legacyDocumentSuffix = "\n```\n";
const sourceFilePattern = /^[0-9a-f]{64}\.json$/;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface JsonEvidenceStoreBounds {
  readonly maxDepth: number;
  readonly maxIndexBytes: number;
  readonly maxShardBytes: number;
  readonly maxSources: number;
  readonly maxTotalBytes: number;
  readonly maxValues: number;
}

export interface JsonEvidenceStoreOptions {
  readonly bounds?: Partial<JsonEvidenceStoreBounds>;
  readonly resources: LocalResourceProvider;
}

export interface JsonEvidenceDocument {
  readonly bytes: Uint8Array;
  readonly locator: WorkspaceResourceLocator;
  readonly resource: ResourceKey;
  readonly revision: ContentRevision;
}

export interface JsonEvidenceSnapshot {
  readonly documents: readonly JsonEvidenceDocument[];
  readonly state: GraphData;
}

export interface JsonEvidenceStore {
  load(): Promise<Result<JsonEvidenceSnapshot>>;
  serialize(state: GraphData): Result<JsonEvidenceSnapshot>;
}

const defaultBounds: JsonEvidenceStoreBounds = Object.freeze({
  maxDepth: 30,
  maxIndexBytes: 1024 * 1024,
  maxShardBytes: 16 * 1024 * 1024,
  maxSources: 10_000,
  maxTotalBytes: 16 * 1024 * 1024,
  maxValues: 100_000,
});

const absoluteBounds: JsonEvidenceStoreBounds = Object.freeze({
  maxDepth: 256,
  maxIndexBytes: 16 * 1024 * 1024,
  maxShardBytes: 64 * 1024 * 1024,
  maxSources: 100_000,
  maxTotalBytes: 64 * 1024 * 1024,
  maxValues: 1_000_000,
});

function diagnostic(code: string, message: string) {
  return Object.freeze({ code, message });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: GraphData): GraphData {
  if (Array.isArray(value)) return Object.freeze(value.map(canonical));
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, GraphData>>;
  const result: Record<string, GraphData> = {};
  for (const key of Object.keys(record).sort(compareText)) result[key] = canonical(record[key]!);
  return Object.freeze(result);
}

function encode(value: GraphData): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(canonical(value), null, 2)}\n`);
}

function revision(bytes: Uint8Array): ContentRevision {
  const parsed = parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  if (!parsed.ok) throw new Error("Evidence revision could not be represented");
  return parsed.value;
}

function resource(locator: WorkspaceResourceLocator): ResourceKey {
  const parsed = parseResourceKey(locator);
  if (!parsed.ok) throw new Error("Evidence locator could not be represented as a resource key");
  return parsed.value;
}

function sourceFile(sourceKey: string): string {
  return `${createHash("sha256").update(sourceKey).digest("hex")}.json`;
}

export function jsonEvidenceIndexLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator(...evidenceRoot, "index.json");
}

export function jsonEvidenceSourceLocator(sourceKey: string): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator(...evidenceRoot, sourceFile(sourceKey));
}

function transitionalEvidenceLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator("groma", "evidence.json");
}

function legacyEvidenceLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator("groma", "evidence.md");
}

function document(locator: WorkspaceResourceLocator, input: Uint8Array): JsonEvidenceDocument {
  const bytes = new Uint8Array(input);
  return Object.freeze({
    get bytes(): Uint8Array {
      return new Uint8Array(bytes);
    },
    locator,
    resource: resource(locator),
    revision: revision(bytes),
  });
}

function decodedText(
  input: Uint8Array,
  maximum: number,
): Result<{ bytes: Uint8Array; text: string }> {
  if (!(input instanceof Uint8Array)) {
    return failure(diagnostic("invalid-evidence-store-bytes", "Evidence must be byte data"));
  }
  if (input.byteLength > maximum) {
    return failure(diagnostic("evidence-store-too-large", "Evidence exceeds its byte bound"));
  }
  const bytes = new Uint8Array(input);
  try {
    return success({ bytes, text: textDecoder.decode(bytes) });
  } catch {
    return failure(diagnostic("invalid-evidence-utf8", "Evidence must be valid UTF-8"));
  }
}

function parsedJson(text: string): Result<unknown> {
  try {
    return success(JSON.parse(text) as unknown);
  } catch {
    return failure(diagnostic("invalid-evidence-json", "Evidence JSON is malformed"));
  }
}

function exactRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copiedState(
  value: unknown,
  bounds: JsonEvidenceStoreBounds,
): Result<{ readonly sources: readonly GraphData[]; readonly state: GraphData }> {
  const copied = copyGraphPayload(value, "transaction", {
    code: "evidence-store-too-large",
    maximumDepth: bounds.maxDepth,
    maximumValues: bounds.maxValues,
    message: "Evidence exceeds its structural bound",
  });
  if (!copied.ok) return copied;
  if (
    !exactRecord(copied.value) ||
    Object.keys(copied.value).sort().join(",") !== "sources,version"
  ) {
    return failure(diagnostic("invalid-evidence-state", "Evidence state is malformed"));
  }
  if (copied.value.version !== 1 || !Array.isArray(copied.value.sources)) {
    return failure(diagnostic("invalid-evidence-state", "Evidence state is malformed"));
  }
  if (copied.value.sources.length > bounds.maxSources) {
    return failure(diagnostic("evidence-source-limit", "Evidence source count exceeds its bound"));
  }
  const sources = copied.value.sources.map((source) => canonical(source));
  const keys = new Set<string>();
  for (const source of sources) {
    if (!exactRecord(source) || typeof source.sourceKey !== "string") {
      return failure(diagnostic("invalid-evidence-state", "Evidence source is malformed"));
    }
    if (keys.has(source.sourceKey)) {
      return failure(
        diagnostic("duplicate-evidence-source", "Evidence source keys must be unique"),
      );
    }
    keys.add(source.sourceKey);
  }
  sources.sort((left, right) =>
    compareText(
      (left as Readonly<Record<string, GraphData>>).sourceKey as string,
      (right as Readonly<Record<string, GraphData>>).sourceKey as string,
    ),
  );
  return success({
    sources: Object.freeze(sources),
    state: Object.freeze({ sources: Object.freeze(sources), version: 1 }) as GraphData,
  });
}

function parseLegacyEnvelope(text: string, bounds: JsonEvidenceStoreBounds): Result<GraphData> {
  const parsed = parsedJson(text);
  if (!parsed.ok) return parsed;
  if (
    !exactRecord(parsed.value) ||
    Object.keys(parsed.value).sort().join(",") !== "evidence,schema" ||
    parsed.value.schema !== legacySchema
  ) {
    return failure(diagnostic("unsupported-evidence-schema", "Evidence schema is unsupported"));
  }
  const state = copiedState(parsed.value.evidence, bounds);
  return state.ok ? success(state.value.state) : state;
}

function parseBounds(input: Partial<JsonEvidenceStoreBounds> | undefined): JsonEvidenceStoreBounds {
  const selected = { ...defaultBounds, ...(input ?? {}) };
  for (const field of [
    "maxDepth",
    "maxIndexBytes",
    "maxShardBytes",
    "maxSources",
    "maxTotalBytes",
    "maxValues",
  ] as const) {
    if (
      !Number.isSafeInteger(selected[field]) ||
      selected[field] <= 0 ||
      selected[field] > absoluteBounds[field]
    ) {
      throw new RangeError(
        `${field} must be a positive safe integer no greater than ${absoluteBounds[field]}`,
      );
    }
  }
  if (
    selected.maxIndexBytes > selected.maxTotalBytes ||
    selected.maxShardBytes > selected.maxTotalBytes
  ) {
    throw new RangeError("Evidence document byte bounds cannot exceed the aggregate byte bound");
  }
  return Object.freeze(selected);
}

export function createJsonEvidenceStore(options: JsonEvidenceStoreOptions): JsonEvidenceStore {
  const bounds = parseBounds(options.bounds);
  const indexLocator = jsonEvidenceIndexLocator();
  if (!indexLocator.ok) throw new Error("Canonical evidence index locator could not be created");
  const empty = Object.freeze({ sources: Object.freeze([]), version: 1 }) as GraphData;

  const serialize = (state: GraphData): Result<JsonEvidenceSnapshot> => {
    const copied = copiedState(state, bounds);
    if (!copied.ok) return copied;
    const entries: GraphData[] = [];
    const documents: JsonEvidenceDocument[] = [];
    let totalBytes = 0;
    for (const source of copied.value.sources) {
      const sourceKey = (source as Readonly<Record<string, GraphData>>).sourceKey as string;
      const locator = jsonEvidenceSourceLocator(sourceKey);
      if (!locator.ok) return locator;
      const bytes = encode(Object.freeze({ schema: sourceSchema, source }) as GraphData);
      if (bytes.byteLength > bounds.maxShardBytes) {
        return failure(
          diagnostic("evidence-shard-too-large", "Evidence source shard exceeds its byte bound"),
        );
      }
      totalBytes += bytes.byteLength;
      if (totalBytes > bounds.maxTotalBytes) {
        return failure(
          diagnostic("evidence-store-too-large", "Evidence exceeds its aggregate byte bound"),
        );
      }
      entries.push(Object.freeze({ file: sourceFile(sourceKey), key: sourceKey }) as GraphData);
      documents.push(document(locator.value, bytes));
    }
    const indexBytes = encode(
      Object.freeze({
        schema: indexSchema,
        sources: Object.freeze(entries),
        version: 1,
      }) as GraphData,
    );
    if (indexBytes.byteLength > bounds.maxIndexBytes) {
      return failure(
        diagnostic("evidence-index-too-large", "Evidence index exceeds its byte bound"),
      );
    }
    totalBytes += indexBytes.byteLength;
    if (totalBytes > bounds.maxTotalBytes) {
      return failure(
        diagnostic("evidence-store-too-large", "Evidence exceeds its aggregate byte bound"),
      );
    }
    documents.push(document(indexLocator.value, indexBytes));
    documents.sort((left, right) => compareText(left.resource, right.resource));
    return success(
      Object.freeze({ documents: Object.freeze(documents), state: copied.value.state }),
    );
  };

  const loadLegacy = async (): Promise<Result<JsonEvidenceSnapshot>> => {
    const transitional = transitionalEvidenceLocator();
    if (!transitional.ok) return transitional;
    const plain = await options.resources.read({
      locator: transitional.value,
      maxBytes: bounds.maxTotalBytes,
    });
    if (plain.ok) {
      const source = decodedText(plain.value.bytes, bounds.maxTotalBytes);
      if (!source.ok) return source;
      const state = parseLegacyEnvelope(source.value.text, bounds);
      if (!state.ok) return state;
      if (
        !Buffer.from(
          encode(Object.freeze({ evidence: state.value, schema: legacySchema }) as GraphData),
        ).equals(Buffer.from(source.value.bytes))
      ) {
        return failure(
          diagnostic("noncanonical-evidence", "Evidence must use deterministic canonical encoding"),
        );
      }
      return success(Object.freeze({ documents: Object.freeze([]), state: state.value }));
    }
    if (plain.diagnostics[0]?.code !== "resource-missing") return plain;
    const legacy = legacyEvidenceLocator();
    if (!legacy.ok) return legacy;
    const markdown = await options.resources.read({
      locator: legacy.value,
      maxBytes: bounds.maxTotalBytes,
    });
    if (!markdown.ok) {
      return markdown.diagnostics[0]?.code === "resource-missing"
        ? success(Object.freeze({ documents: Object.freeze([]), state: empty }))
        : markdown;
    }
    const source = decodedText(markdown.value.bytes, bounds.maxTotalBytes);
    if (!source.ok) return source;
    if (
      !source.value.text.startsWith(legacyDocumentPrefix) ||
      !source.value.text.endsWith(legacyDocumentSuffix)
    ) {
      return failure(
        diagnostic(
          "invalid-evidence-markdown",
          "Legacy evidence must use its canonical fenced form",
        ),
      );
    }
    const body = source.value.text.slice(legacyDocumentPrefix.length, -legacyDocumentSuffix.length);
    const state = parseLegacyEnvelope(body, bounds);
    return state.ok
      ? success(Object.freeze({ documents: Object.freeze([]), state: state.value }))
      : state;
  };

  const load = async (): Promise<Result<JsonEvidenceSnapshot>> => {
    const loadedIndex = await options.resources.read({
      locator: indexLocator.value,
      maxBytes: bounds.maxIndexBytes,
    });
    if (!loadedIndex.ok) {
      return loadedIndex.diagnostics[0]?.code === "resource-missing" ? loadLegacy() : loadedIndex;
    }
    const source = decodedText(loadedIndex.value.bytes, bounds.maxIndexBytes);
    if (!source.ok) return source;
    const parsed = parsedJson(source.value.text);
    if (!parsed.ok) return parsed;
    if (
      !exactRecord(parsed.value) ||
      Object.keys(parsed.value).sort().join(",") !== "schema,sources,version" ||
      parsed.value.schema !== indexSchema ||
      parsed.value.version !== 1 ||
      !Array.isArray(parsed.value.sources) ||
      parsed.value.sources.length > bounds.maxSources
    ) {
      return failure(
        diagnostic("invalid-evidence-index", "Evidence index is malformed or unsupported"),
      );
    }
    if (!Buffer.from(encode(parsed.value as GraphData)).equals(Buffer.from(source.value.bytes))) {
      return failure(
        diagnostic(
          "noncanonical-evidence-index",
          "Evidence index must use deterministic canonical encoding",
        ),
      );
    }
    const documents: JsonEvidenceDocument[] = [document(indexLocator.value, source.value.bytes)];
    const sources: GraphData[] = [];
    let totalBytes = source.value.bytes.byteLength;
    let previousKey: string | undefined;
    for (const entry of parsed.value.sources) {
      if (
        !exactRecord(entry) ||
        Object.keys(entry).sort().join(",") !== "file,key" ||
        typeof entry.file !== "string" ||
        !sourceFilePattern.test(entry.file) ||
        typeof entry.key !== "string" ||
        entry.file !== sourceFile(entry.key) ||
        (previousKey !== undefined && previousKey >= entry.key)
      ) {
        return failure(
          diagnostic(
            "invalid-evidence-index",
            "Evidence index source entries are malformed or unordered",
          ),
        );
      }
      previousKey = entry.key;
      const locator = jsonEvidenceSourceLocator(entry.key);
      if (!locator.ok) return locator;
      const loaded = await options.resources.read({
        locator: locator.value,
        maxBytes: bounds.maxShardBytes,
      });
      if (!loaded.ok) return loaded;
      const shard = decodedText(loaded.value.bytes, bounds.maxShardBytes);
      if (!shard.ok) return shard;
      totalBytes += shard.value.bytes.byteLength;
      if (totalBytes > bounds.maxTotalBytes) {
        return failure(
          diagnostic("evidence-store-too-large", "Evidence exceeds its aggregate byte bound"),
        );
      }
      const parsedShard = parsedJson(shard.value.text);
      if (!parsedShard.ok) return parsedShard;
      if (
        !exactRecord(parsedShard.value) ||
        Object.keys(parsedShard.value).sort().join(",") !== "schema,source" ||
        parsedShard.value.schema !== sourceSchema
      ) {
        return failure(
          diagnostic("invalid-evidence-shard", "Evidence source shard is malformed or unsupported"),
        );
      }
      const copied = copyGraphPayload(parsedShard.value.source, "transaction", {
        code: "evidence-store-too-large",
        maximumDepth: bounds.maxDepth,
        maximumValues: bounds.maxValues,
        message: "Evidence exceeds its structural bound",
      });
      if (!copied.ok) return copied;
      if (!exactRecord(copied.value) || copied.value.sourceKey !== entry.key) {
        return failure(
          diagnostic(
            "invalid-evidence-shard",
            "Evidence source shard does not match its index entry",
          ),
        );
      }
      if (
        !Buffer.from(
          encode(
            Object.freeze({ schema: sourceSchema, source: canonical(copied.value) }) as GraphData,
          ),
        ).equals(Buffer.from(shard.value.bytes))
      ) {
        return failure(
          diagnostic(
            "noncanonical-evidence-shard",
            "Evidence source shard must use deterministic canonical encoding",
          ),
        );
      }
      sources.push(canonical(copied.value));
      documents.push(document(locator.value, shard.value.bytes));
    }
    const state = copiedState(
      Object.freeze({ sources: Object.freeze(sources), version: 1 }),
      bounds,
    );
    if (!state.ok) return state;
    documents.sort((left, right) => compareText(left.resource, right.resource));
    return success(
      Object.freeze({ documents: Object.freeze(documents), state: state.value.state }),
    );
  };

  return Object.freeze({ load, serialize });
}
