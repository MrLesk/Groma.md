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

const evidenceSchema = "groma/evidence/v0.1";
const documentPrefix = "# Groma Evidence\n\n```json\n";
const documentSuffix = "\n```\n";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface MarkdownEvidenceStoreBounds {
  readonly maxBytes: number;
  readonly maxDepth: number;
  readonly maxValues: number;
}

export interface MarkdownEvidenceStoreOptions {
  readonly bounds?: Partial<MarkdownEvidenceStoreBounds>;
  readonly resources: LocalResourceProvider;
}

export interface MarkdownEvidenceSnapshot {
  readonly bytes?: Uint8Array;
  readonly locator: WorkspaceResourceLocator;
  readonly resource: ResourceKey;
  readonly revision: ContentRevision | null;
  readonly state: GraphData;
}

export interface MarkdownEvidenceStore {
  decode(bytes: Uint8Array): Result<MarkdownEvidenceSnapshot>;
  load(): Promise<Result<MarkdownEvidenceSnapshot>>;
  serialize(state: GraphData): Result<MarkdownEvidenceSnapshot>;
}

const defaultBounds: MarkdownEvidenceStoreBounds = Object.freeze({
  maxBytes: 16 * 1024 * 1024,
  maxDepth: 30,
  maxValues: 100_000,
});

const absoluteBounds: MarkdownEvidenceStoreBounds = Object.freeze({
  maxBytes: 64 * 1024 * 1024,
  maxDepth: 256,
  maxValues: 1_000_000,
});

function diagnostic(code: string, message: string) {
  return Object.freeze({ code, message });
}

export function markdownEvidenceLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator("groma", "evidence.md");
}

function revision(bytes: Uint8Array): ContentRevision {
  const parsed = parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  if (!parsed.ok) throw new Error("Evidence revision could not be represented");
  return parsed.value;
}

function canonical(value: GraphData): GraphData {
  if (Array.isArray(value)) return Object.freeze(value.map(canonical));
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, GraphData>>;
  const result: Record<string, GraphData> = {};
  for (const key of Object.keys(record).sort()) result[key] = canonical(record[key]!);
  return Object.freeze(result);
}

function encode(state: GraphData): Uint8Array {
  const body = JSON.stringify({ evidence: canonical(state), schema: evidenceSchema }, null, 2);
  return textEncoder.encode(`${documentPrefix}${body}${documentSuffix}`);
}

function snapshot(
  state: GraphData,
  locator: WorkspaceResourceLocator,
  resource: ResourceKey,
  contentRevision: ContentRevision | null,
  bytes?: Uint8Array,
): MarkdownEvidenceSnapshot {
  return Object.freeze({
    ...(bytes === undefined ? {} : { bytes: new Uint8Array(bytes) }),
    locator,
    resource,
    revision: contentRevision,
    state,
  });
}

export function createMarkdownEvidenceStore(
  options: MarkdownEvidenceStoreOptions,
): MarkdownEvidenceStore {
  const bounds = Object.freeze({ ...defaultBounds, ...(options.bounds ?? {}) });
  for (const field of ["maxBytes", "maxDepth", "maxValues"] as const) {
    if (
      !Number.isSafeInteger(bounds[field]) ||
      bounds[field] <= 0 ||
      bounds[field] > absoluteBounds[field]
    ) {
      throw new RangeError(
        `${field} must be a positive safe integer no greater than ${absoluteBounds[field]}`,
      );
    }
  }
  const locator = markdownEvidenceLocator();
  if (!locator.ok) throw new Error("Canonical evidence locator could not be created");
  const resource = parseResourceKey(locator.value);
  if (!resource.ok) throw new Error("Canonical evidence resource could not be created");
  const empty = Object.freeze({ sources: Object.freeze([]), version: 1 }) as GraphData;

  const decode = (input: Uint8Array): Result<MarkdownEvidenceSnapshot> => {
    if (!(input instanceof Uint8Array)) {
      return failure(diagnostic("invalid-evidence-store-bytes", "Evidence must be byte data"));
    }
    if (input.byteLength > bounds.maxBytes) {
      return failure(diagnostic("evidence-store-too-large", "Evidence exceeds its byte bound"));
    }
    const bytes = new Uint8Array(input);
    let text: string;
    try {
      text = textDecoder.decode(bytes);
    } catch {
      return failure(diagnostic("invalid-evidence-utf8", "Evidence must be valid UTF-8"));
    }
    if (!text.startsWith(documentPrefix) || !text.endsWith(documentSuffix)) {
      return failure(
        diagnostic("invalid-evidence-markdown", "Evidence must use the canonical Markdown form"),
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.slice(documentPrefix.length, -documentSuffix.length));
    } catch {
      return failure(diagnostic("invalid-evidence-json", "Evidence JSON is malformed"));
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.keys(parsed).sort().join(",") !== "evidence,schema" ||
      (parsed as Record<string, unknown>).schema !== evidenceSchema
    ) {
      return failure(diagnostic("unsupported-evidence-schema", "Evidence schema is unsupported"));
    }
    const copied = copyGraphPayload((parsed as Record<string, unknown>).evidence, "transaction", {
      code: "evidence-store-too-large",
      maximumDepth: bounds.maxDepth,
      maximumValues: bounds.maxValues,
      message: "Evidence exceeds its structural bound",
    });
    if (!copied.ok) return copied;
    const state = canonical(copied.value);
    if (!Buffer.from(encode(state)).equals(Buffer.from(bytes))) {
      return failure(
        diagnostic("noncanonical-evidence", "Evidence must use deterministic canonical encoding"),
      );
    }
    return success(snapshot(state, locator.value, resource.value, revision(bytes), bytes));
  };

  const load = async (): Promise<Result<MarkdownEvidenceSnapshot>> => {
    const read = await options.resources.read({
      locator: locator.value,
      maxBytes: bounds.maxBytes,
    });
    if (!read.ok) {
      return read.diagnostics[0]?.code === "resource-missing"
        ? success(snapshot(empty, locator.value, resource.value, null))
        : read;
    }
    return decode(read.value.bytes);
  };

  const serialize = (state: GraphData): Result<MarkdownEvidenceSnapshot> => {
    const copied = copyGraphPayload(state, "transaction", {
      code: "evidence-store-too-large",
      maximumDepth: bounds.maxDepth,
      maximumValues: bounds.maxValues,
      message: "Evidence exceeds its structural bound",
    });
    if (!copied.ok) return copied;
    const bytes = encode(canonical(copied.value));
    if (bytes.byteLength > bounds.maxBytes) {
      return failure(diagnostic("evidence-store-too-large", "Evidence exceeds its byte bound"));
    }
    return decode(bytes);
  };

  return Object.freeze({ decode, load, serialize });
}
