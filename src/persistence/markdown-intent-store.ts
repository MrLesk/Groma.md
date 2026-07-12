import { createHash } from "node:crypto";

import { isAlias, parseDocument, stringify, visit } from "yaml";

import {
  failure,
  parseContentRevision,
  parseEntityId,
  parseRelationId,
  parseResourceKey,
  success,
  type ContentRevision,
  type Diagnostic,
  type EntityId,
  type GraphData,
  type GraphEntity,
  type GraphRelation,
  type ResourceKey,
  type Result,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  STANDARD_COMPONENT_KIND,
  type StandardComponent,
  type StandardComponentInput,
  type StandardItem,
  type StandardModelCapability,
  type StandardRelationship,
} from "../standard-model/index.ts";
import {
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type ResourceEntry,
  type WorkspaceResourceLocator,
} from "./contracts.ts";

const schema = "groma/v0.1";
const intentRootSegments = ["groma", "intent"] as const;
const shardPattern = /^[0-9a-f]{2}$/;
const documentPattern = /^ent_[0-9a-f]{32}\.md$/;
const extensionPattern = /^[A-Za-z][A-Za-z0-9_.-]*(?::|\/)[A-Za-z][A-Za-z0-9_.-]*$/;
const textEncoder = new TextEncoder();
const strictTextDecoder = new TextDecoder("utf-8", { fatal: true });
const uint8ArrayByteLengthGetter = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  "byteLength",
)?.get;
const intrinsicUint8ArraySlice = Uint8Array.prototype.slice;

export interface MarkdownIntentStoreBounds {
  readonly maxDocumentBytes: number;
  readonly maxDocuments: number;
  readonly maxEntriesPerDirectory: number;
  readonly maxTotalDocumentBytes: number;
  readonly pageSize: number;
}

export interface MarkdownIntentStoreOptions {
  readonly bounds?: Partial<MarkdownIntentStoreBounds>;
  readonly model: StandardModelCapability;
  readonly resources: LocalResourceProvider;
}

export interface MarkdownIntentDocument {
  readonly bytes: Uint8Array;
  readonly entity: GraphEntity;
  readonly locator: WorkspaceResourceLocator;
  readonly relations: readonly GraphRelation[];
  readonly resource: ResourceKey;
  readonly revision: ContentRevision;
}

export interface MarkdownIntentSnapshot {
  readonly documents: readonly MarkdownIntentDocument[];
  readonly entities: readonly GraphEntity[];
  readonly relations: readonly GraphRelation[];
}

export interface MarkdownIntentStore {
  decode(locator: WorkspaceResourceLocator, bytes: Uint8Array): Result<MarkdownIntentDocument>;
  load(): Promise<Result<MarkdownIntentSnapshot>>;
  read(id: EntityId): Promise<Result<MarkdownIntentDocument>>;
  serialize(
    entity: GraphEntity,
    relations: readonly GraphRelation[],
  ): Result<MarkdownIntentDocument>;
}

const defaultBounds: MarkdownIntentStoreBounds = Object.freeze({
  maxDocumentBytes: 1024 * 1024,
  maxDocuments: 100_000,
  maxEntriesPerDirectory: 10_000,
  maxTotalDocumentBytes: 128 * 1024 * 1024,
  pageSize: 1_000,
});
const absoluteBounds: MarkdownIntentStoreBounds = Object.freeze({
  maxDocumentBytes: 64 * 1024 * 1024,
  maxDocuments: 1_000_000,
  maxEntriesPerDirectory: 100_000,
  maxTotalDocumentBytes: 1024 * 1024 * 1024,
  pageSize: 10_000,
});
const relationTypePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze({ code, message, ...(details === undefined ? {} : { details }) });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unpairedSurrogateIndex(value: string): number | undefined {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return index;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return index;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return index;
    }
  }
  return undefined;
}

function validateUnicode(value: unknown, rootPath: string): Result<void> {
  const pending: { readonly path: string; readonly value: unknown }[] = [{ path: rootPath, value }];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (typeof current.value === "string") {
      const index = unpairedSurrogateIndex(current.value);
      if (index !== undefined) {
        return failure(
          diagnostic(
            "invalid-intent-unicode",
            "Intent serialization cannot represent an unpaired UTF-16 surrogate losslessly in UTF-8",
            { index, path: current.path },
          ),
        );
      }
      continue;
    }
    if (typeof current.value !== "object" || current.value === null) continue;
    if (visited.has(current.value)) continue;
    visited.add(current.value);
    for (const key of Reflect.ownKeys(current.value)) {
      if (typeof key !== "string") continue;
      const keyIndex = unpairedSurrogateIndex(key);
      if (keyIndex !== undefined) {
        return failure(
          diagnostic(
            "invalid-intent-unicode",
            "Intent serialization cannot represent an unpaired UTF-16 surrogate in a key losslessly in UTF-8",
            { index: keyIndex, path: `${current.path} key` },
          ),
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(current.value, key);
      if (descriptor !== undefined && "value" in descriptor) {
        pending.push({ path: `${current.path}.${key}`, value: descriptor.value });
      }
    }
  }
  return success(undefined);
}

function containsGitConflictBlock(text: string): boolean {
  let state: "outside" | "ours" | "theirs" = "outside";
  for (const line of text.split("\n")) {
    if (state === "outside") {
      if (/^<<<<<<< .+$/.test(line)) state = "ours";
    } else if (state === "ours") {
      if (line === "=======") state = "theirs";
    } else if (/^>>>>>>> .+$/.test(line)) {
      return true;
    }
  }
  return false;
}

function exactRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseBounds(
  input: Partial<MarkdownIntentStoreBounds> | undefined,
): MarkdownIntentStoreBounds {
  const value = { ...defaultBounds, ...input };
  for (const field of [
    "maxDocumentBytes",
    "maxDocuments",
    "maxEntriesPerDirectory",
    "maxTotalDocumentBytes",
    "pageSize",
  ] as const) {
    const minimum = field === "maxDocuments" ? 0 : 1;
    if (
      !Number.isSafeInteger(value[field]) ||
      value[field] < minimum ||
      value[field] > absoluteBounds[field]
    ) {
      throw new RangeError(
        `${field} must be a safe integer between ${minimum} and ${absoluteBounds[field]}`,
      );
    }
  }
  return Object.freeze(value);
}

function snapshotIntentBytes(value: unknown, maximum: number): Result<Uint8Array> {
  try {
    if (uint8ArrayByteLengthGetter === undefined) throw new TypeError("missing intrinsic getter");
    const length = Reflect.apply(uint8ArrayByteLengthGetter, value, []) as number;
    if (length > maximum) {
      return failure(
        diagnostic("resource-too-large", "Intent document exceeds its configured byte bound", {
          maximum,
        }),
      );
    }
    return success(Reflect.apply(intrinsicUint8ArraySlice, value, []) as Uint8Array);
  } catch {
    return failure(
      diagnostic("invalid-intent-bytes", "Intent document bytes must be a Uint8Array"),
    );
  }
}

function intentRoot(): WorkspaceResourceLocator {
  const parsed = workspaceResourceLocator(...intentRootSegments);
  if (!parsed.ok) throw new Error("The built-in Markdown intent root is invalid");
  return parsed.value;
}

export function markdownIntentLocator(id: EntityId): Result<WorkspaceResourceLocator> {
  const parsed = parseEntityId(id);
  if (!parsed.ok) return parsed;
  const shard = parsed.value.slice(4, 6);
  return workspaceResourceLocator(...intentRootSegments, shard, `${parsed.value}.md`);
}

function revision(bytes: Uint8Array): Result<ContentRevision> {
  return parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
}

function resource(locator: WorkspaceResourceLocator): Result<ResourceKey> {
  return parseResourceKey(String(locator));
}

function canonicalExtensions(
  extensions: Readonly<Record<string, GraphData>>,
): Record<string, GraphData> {
  const output: Record<string, GraphData> = Object.create(null) as Record<string, GraphData>;
  for (const key of Object.keys(extensions).sort(compareText)) {
    Object.defineProperty(output, key, {
      enumerable: true,
      value: extensions[key]!,
    });
  }
  return output;
}

function itemRecord(item: StandardItem): Record<string, unknown> {
  return {
    id: item.id,
    ...(item.name === undefined ? {} : { name: item.name }),
    ...(item.description === undefined ? {} : { description: item.description }),
    ...canonicalExtensions(item.extensions),
  };
}

function relationshipRecord(relationship: StandardRelationship): Record<string, unknown> {
  return {
    id: relationship.id,
    type: relationship.type,
    target: relationship.target,
    ...(relationship.description === undefined ? {} : { description: relationship.description }),
    ...canonicalExtensions(relationship.extensions),
  };
}

function graphRelations(
  relationships: readonly StandardRelationship[],
): Result<readonly GraphRelation[]> {
  const relations: GraphRelation[] = [];
  const identities = new Set<string>();
  for (const relationship of relationships) {
    if (identities.has(relationship.id)) {
      return failure(
        diagnostic(
          "duplicate-intent-relation",
          "The same stable relationship identity occurs more than once",
          { id: relationship.id },
        ),
      );
    }
    identities.add(relationship.id);
    const payload = copyGraphPayload(
      {
        ...(relationship.description === undefined
          ? {}
          : { description: relationship.description }),
        ...canonicalExtensions(relationship.extensions),
      },
      "relation",
    );
    if (!payload.ok) return payload;
    relations.push(
      Object.freeze({
        id: relationship.id,
        payload: payload.value,
        source: relationship.source,
        target: relationship.target,
        type: relationship.type,
      }),
    );
  }
  return success(Object.freeze(relations));
}

function frontmatter(
  component: StandardComponent,
  relationships: readonly StandardRelationship[],
): Record<string, unknown> {
  return {
    schema,
    id: component.id,
    kind: STANDARD_COMPONENT_KIND,
    ...(component.name === undefined ? {} : { name: component.name }),
    ...(component.type === undefined ? {} : { type: component.type }),
    ...(component.parent === undefined ? {} : { parent: component.parent }),
    ...(component.desired === undefined ? {} : { desired: component.desired }),
    ...(component.lifecycle === undefined ? {} : { lifecycle: component.lifecycle }),
    ...(component.inputs === undefined ? {} : { inputs: component.inputs.map(itemRecord) }),
    ...(component.outputs === undefined ? {} : { outputs: component.outputs.map(itemRecord) }),
    ...(component.actions === undefined ? {} : { actions: component.actions.map(itemRecord) }),
    ...(relationships.length === 0 ? {} : { relationships: relationships.map(relationshipRecord) }),
    ...canonicalExtensions(component.extensions),
  };
}

function encodeDocument(
  front: Record<string, unknown>,
  intent: string | undefined,
): Result<Uint8Array> {
  const frontUnicode = validateUnicode(front, "frontmatter");
  if (!frontUnicode.ok) return frontUnicode;
  const intentUnicode = validateUnicode(intent, "intent");
  if (!intentUnicode.ok) return intentUnicode;
  try {
    const yaml = stringify(front, {
      aliasDuplicateObjects: false,
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
    });
    const body = intent === undefined ? "" : `\n# Intent\n\n${intent}\n`;
    return success(textEncoder.encode(`---\n${yaml}---\n${body}`));
  } catch (error) {
    return failure(
      diagnostic(
        "intent-serialization-failed",
        `Intent document could not be encoded as canonical YAML: ${error instanceof Error ? error.message : "unknown error"}`,
      ),
    );
  }
}

function parseFraming(text: string): Result<{ readonly body?: string; readonly yaml: string }> {
  if (!text.startsWith("---\n")) {
    return failure(
      diagnostic(
        "invalid-intent-frontmatter",
        "Intent document must start with an LF-delimited YAML frontmatter marker",
      ),
    );
  }
  const closing = text.indexOf("\n---\n", 4);
  if (closing < 0) {
    return failure(
      diagnostic(
        "invalid-intent-frontmatter",
        "Intent document must close YAML frontmatter with an LF-delimited marker",
      ),
    );
  }
  const suffix = text.slice(closing + 5);
  if (suffix.length === 0) return success({ yaml: text.slice(4, closing + 1) });
  const heading = "\n# Intent\n\n";
  if (!suffix.startsWith(heading) || !suffix.endsWith("\n")) {
    return failure(
      diagnostic(
        "intent-malformed-body",
        "Intent Markdown body must be exactly a blank line, '# Intent', a blank line, prose, and one framing newline",
      ),
    );
  }
  return success({ body: suffix.slice(heading.length, -1), yaml: text.slice(4, closing + 1) });
}

function validateYamlNumbers(document: ReturnType<typeof parseDocument>): Result<void> {
  let invalid: Diagnostic | undefined;
  visit(document, {
    Scalar: (_key, node) => {
      if (typeof node.value === "bigint") {
        if (
          node.value < BigInt(Number.MIN_SAFE_INTEGER) ||
          node.value > BigInt(Number.MAX_SAFE_INTEGER)
        ) {
          invalid = diagnostic(
            "intent-unsafe-integer",
            "Intent YAML integer exceeds JavaScript's exact safe-integer range",
            { value: node.source ?? String(node.value) },
          );
          return visit.BREAK;
        }
        node.value = Number(node.value);
        return;
      }
      if (typeof node.value !== "number") return;
      if (!Number.isFinite(node.value)) {
        invalid = diagnostic(
          "intent-non-finite-number",
          "Intent YAML numbers must be finite and must not overflow",
          { value: node.source ?? String(node.value) },
        );
        return visit.BREAK;
      }
      if (Number.isInteger(node.value) && !Number.isSafeInteger(node.value)) {
        invalid = diagnostic(
          "intent-unsafe-number",
          "Intent YAML floating-point value resolves outside JavaScript's exact safe-integer range",
          { value: node.source ?? String(node.value) },
        );
        return visit.BREAK;
      }
      if (node.value === 0 && node.source !== undefined) {
        const mantissa = node.source.split(/[eE]/u, 1)[0] ?? "";
        if (/[1-9]/u.test(mantissa)) {
          invalid = diagnostic(
            "intent-number-underflow",
            "Intent YAML floating-point value underflows to zero and cannot round-trip losslessly",
            { value: node.source },
          );
          return visit.BREAK;
        }
      }
      if (Object.is(node.value, -0)) node.value = 0;
    },
  });
  return invalid === undefined ? success(undefined) : failure(invalid);
}

function yamlRecord(source: string): Result<Readonly<Record<string, unknown>>> {
  let document: ReturnType<typeof parseDocument>;
  try {
    document = parseDocument(source, {
      intAsBigInt: true,
      logLevel: "silent",
      prettyErrors: false,
      schema: "core",
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });
  } catch (error) {
    return failure(
      diagnostic(
        "intent-malformed-yaml",
        `Intent frontmatter could not be parsed as YAML: ${error instanceof Error ? error.message : "unknown error"}`,
      ),
    );
  }
  const duplicate = document.errors.some((error) => error.code === "DUPLICATE_KEY");
  if (duplicate) {
    return failure(
      diagnostic("intent-duplicate-yaml-key", "Intent frontmatter contains a duplicate YAML key"),
    );
  }

  let unsupported = false;
  visit(document, {
    Alias: () => {
      unsupported = true;
      return visit.BREAK;
    },
    Node: (_key, node) => {
      if (isAlias(node) || node.tag !== undefined) {
        unsupported = true;
        return visit.BREAK;
      }
    },
  });
  if (unsupported) {
    return failure(
      diagnostic(
        "intent-unsupported-yaml",
        "Intent frontmatter must not contain YAML aliases, anchors, or explicit tags",
      ),
    );
  }
  if (document.errors.length > 0) {
    return failure(
      diagnostic(
        "intent-malformed-yaml",
        `Intent frontmatter is malformed YAML: ${document.errors[0]?.message ?? "unknown parse error"}`,
      ),
    );
  }
  if (document.warnings.length > 0) {
    return failure(
      diagnostic(
        "intent-malformed-yaml",
        `Intent frontmatter contains unsupported YAML: ${document.warnings[0]?.message ?? "warning"}`,
      ),
    );
  }

  const numbers = validateYamlNumbers(document);
  if (!numbers.ok) return numbers;

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    return failure(
      diagnostic(
        "intent-malformed-yaml",
        `Intent frontmatter could not be converted from YAML: ${error instanceof Error ? error.message : "unknown error"}`,
      ),
    );
  }
  return exactRecord(value)
    ? success(value)
    : failure(
        diagnostic("intent-malformed-yaml", "Intent frontmatter must contain one YAML mapping"),
      );
}

const knownFrontmatterFields = new Set([
  "actions",
  "desired",
  "id",
  "inputs",
  "kind",
  "lifecycle",
  "name",
  "outputs",
  "parent",
  "relationships",
  "schema",
  "type",
]);
const knownItemFields = new Set(["description", "id", "name"]);
const knownRelationshipFields = new Set(["description", "id", "target", "type"]);

function extensions(
  record: Readonly<Record<string, unknown>>,
  known: ReadonlySet<string>,
  path: string,
): Result<Record<string, GraphData>> {
  const output: Record<string, GraphData> = {};
  for (const key of Object.keys(record).sort(compareText)) {
    if (known.has(key)) continue;
    if (!extensionPattern.test(key)) {
      return failure(
        diagnostic(
          "unexpected-intent-field",
          `${path}.${key} is neither a standard intent field nor a namespaced extension`,
          { path: `${path}.${key}` },
        ),
      );
    }
    output[key] = record[key] as GraphData;
  }
  return success(output);
}

function embeddedItems(
  value: unknown,
  path: string,
): Result<readonly Record<string, unknown>[] | undefined> {
  if (value === undefined) return success(undefined);
  if (!Array.isArray(value)) {
    return failure(
      diagnostic("invalid-intent-item-list", `${path} must be a YAML sequence`, { path }),
    );
  }
  const output: Record<string, unknown>[] = [];
  for (const [index, item] of value.entries()) {
    if (!exactRecord(item)) {
      return failure(
        diagnostic("invalid-intent-item", `${path}[${index}] must be a YAML mapping`, {
          path: `${path}[${index}]`,
        }),
      );
    }
    const extra = extensions(item, knownItemFields, `${path}[${index}]`);
    if (!extra.ok) return extra;
    output.push({
      ...(item.id === undefined ? {} : { id: item.id }),
      ...(item.name === undefined ? {} : { name: item.name }),
      ...(item.description === undefined ? {} : { description: item.description }),
      ...extra.value,
    });
  }
  return success(output);
}

function decodedEntity(
  record: Readonly<Record<string, unknown>>,
  body: string | undefined,
  model: StandardModelCapability,
): Result<GraphEntity> {
  if (record.schema !== schema) {
    return failure(
      diagnostic("intent-schema-mismatch", "Intent document uses an unsupported schema", {
        actual: typeof record.schema === "string" ? record.schema : typeof record.schema,
        expected: schema,
      }),
    );
  }
  if (record.kind !== STANDARD_COMPONENT_KIND) {
    return failure(
      diagnostic("intent-wrong-kind", "Intent store only accepts component documents", {
        actual: typeof record.kind === "string" ? record.kind : typeof record.kind,
        expected: STANDARD_COMPONENT_KIND,
      }),
    );
  }
  const id = typeof record.id === "string" ? parseEntityId(record.id) : parseEntityId("");
  if (!id.ok) return id;
  const extra = extensions(record, knownFrontmatterFields, "frontmatter");
  if (!extra.ok) return extra;
  const inputs = embeddedItems(record.inputs, "frontmatter.inputs");
  if (!inputs.ok) return inputs;
  const outputs = embeddedItems(record.outputs, "frontmatter.outputs");
  if (!outputs.ok) return outputs;
  const actions = embeddedItems(record.actions, "frontmatter.actions");
  if (!actions.ok) return actions;
  const input: Record<string, unknown> = {
    id: id.value,
    ...(record.name === undefined ? {} : { name: record.name }),
    ...(record.type === undefined ? {} : { type: record.type }),
    ...(record.parent === undefined ? {} : { parent: record.parent }),
    ...(body === undefined ? {} : { intent: body }),
    ...(inputs.value === undefined ? {} : { inputs: inputs.value }),
    ...(outputs.value === undefined ? {} : { outputs: outputs.value }),
    ...(actions.value === undefined ? {} : { actions: actions.value }),
    ...(record.lifecycle === undefined ? {} : { lifecycle: record.lifecycle }),
    ...(record.desired === undefined ? {} : { desired: record.desired }),
    ...extra.value,
  };
  const normalized = model.normalize(input as StandardComponentInput);
  if (!normalized.ok) return normalized;
  const entity = Object.freeze({
    id: id.value,
    kind: normalized.value.kind,
    payload: normalized.value.payload as GraphData,
  });
  const parsed = model.parse(entity);
  if (!parsed.ok) return parsed;
  const serialized = model.serialize(parsed.value);
  if (!serialized.ok) return serialized;
  return success(entity);
}

function decodedRelations(
  value: unknown,
  source: EntityId,
  model: StandardModelCapability,
): Result<readonly GraphRelation[]> {
  if (value === undefined) return success(Object.freeze([]));
  if (!Array.isArray(value)) {
    return failure(
      diagnostic(
        "invalid-intent-relationships",
        "frontmatter.relationships must be a YAML sequence",
      ),
    );
  }
  const relations: GraphRelation[] = [];
  for (const [index, candidate] of value.entries()) {
    if (!exactRecord(candidate)) {
      return failure(
        diagnostic(
          "invalid-intent-relationship",
          `frontmatter.relationships[${index}] must be a YAML mapping`,
        ),
      );
    }
    const id =
      typeof candidate.id === "string" ? parseRelationId(candidate.id) : parseRelationId("");
    if (!id.ok) return id;
    const target =
      typeof candidate.target === "string" ? parseEntityId(candidate.target) : parseEntityId("");
    if (!target.ok) return target;
    if (typeof candidate.type !== "string") {
      return failure(
        diagnostic(
          "invalid-intent-relationship-type",
          `frontmatter.relationships[${index}].type must be a relation type token`,
        ),
      );
    }
    const extra = extensions(
      candidate,
      knownRelationshipFields,
      `frontmatter.relationships[${index}]`,
    );
    if (!extra.ok) return extra;
    if (!relationTypePattern.test(candidate.type)) {
      return failure(
        diagnostic(
          "invalid-intent-relationship-type",
          `frontmatter.relationships[${index}].type must be a lowercase dotted or dashed token`,
        ),
      );
    }
    relations.push({
      id: id.value,
      payload: {
        ...(candidate.description === undefined
          ? {}
          : { description: candidate.description as GraphData }),
        ...extra.value,
      },
      source,
      target: target.value,
      type: candidate.type,
    });
  }
  const viewed = model.relationships(relations);
  if (!viewed.ok) return viewed;
  return graphRelations(viewed.value);
}

function expectedLayout(locator: WorkspaceResourceLocator, id: EntityId): boolean {
  const expected = markdownIntentLocator(id);
  return expected.ok && expected.value === locator;
}

function unexpectedLayout(entry: ResourceEntry): Result<never> {
  return failure(
    diagnostic(
      "unexpected-intent-resource",
      "Intent root must contain only two-hex shard directories and stable-ID Markdown files",
      { kind: entry.kind, locator: String(entry.locator) },
    ),
  );
}

function validateEntry(entry: ResourceEntry): Result<"document" | "shard"> {
  const parts = String(entry.locator).split("/");
  if (
    parts.length === 3 &&
    parts[0] === "groma" &&
    parts[1] === "intent" &&
    shardPattern.test(parts[2]!) &&
    entry.kind === "directory"
  ) {
    return success("shard");
  }
  if (
    parts.length === 4 &&
    parts[0] === "groma" &&
    parts[1] === "intent" &&
    shardPattern.test(parts[2]!) &&
    documentPattern.test(parts[3]!) &&
    entry.kind === "file"
  ) {
    return success("document");
  }
  return unexpectedLayout(entry);
}

function validateWholeGraph(
  documents: readonly MarkdownIntentDocument[],
): Result<MarkdownIntentSnapshot> {
  const entities = new Map<EntityId, GraphEntity>();
  for (const document of documents) {
    if (entities.has(document.entity.id)) {
      return failure(
        diagnostic(
          "duplicate-intent-entity",
          "The same stable component identity occurs in more than one intent document",
          { id: document.entity.id },
        ),
      );
    }
    entities.set(document.entity.id, document.entity);
  }

  const relations = new Map<string, GraphRelation>();
  for (const document of documents) {
    for (const relation of document.relations) {
      if (relations.has(relation.id)) {
        return failure(
          diagnostic(
            "duplicate-intent-relation",
            "The same stable relationship identity occurs more than once",
            { id: relation.id },
          ),
        );
      }
      relations.set(relation.id, relation);
    }
  }

  for (const document of documents) {
    if (!expectedLayout(document.locator, document.entity.id)) {
      const expected = markdownIntentLocator(document.entity.id);
      return failure(
        diagnostic(
          "intent-wrong-location",
          "Intent component is not stored at the shard derived from its stable identity",
          {
            actual: String(document.locator),
            expected: expected.ok ? String(expected.value) : "invalid identity",
            id: document.entity.id,
          },
        ),
      );
    }
  }

  for (const entity of entities.values()) {
    const parent = exactRecord(entity.payload) ? entity.payload.parent : undefined;
    if (typeof parent === "string" && !entities.has(parent as EntityId)) {
      return failure(
        diagnostic("unknown-intent-parent", "Intent component refers to an unknown parent", {
          id: entity.id,
          parent,
        }),
      );
    }
  }
  for (const relation of relations.values()) {
    if (!entities.has(relation.target)) {
      return failure(
        diagnostic(
          "unknown-intent-relation-target",
          "Intent relationship refers to an unknown target component",
          { id: relation.id, target: relation.target },
        ),
      );
    }
  }

  const containmentState = new Map<EntityId, "visiting" | "visited">();
  for (const id of [...entities.keys()].sort(compareText)) {
    if (containmentState.get(id) === "visited") continue;
    const path: EntityId[] = [];
    let current: EntityId | undefined = id;
    while (current !== undefined && containmentState.get(current) !== "visited") {
      if (containmentState.get(current) === "visiting") {
        return failure(
          diagnostic(
            "intent-containment-cycle",
            "Intent component containment contains a structural parent cycle",
            { id: current },
          ),
        );
      }
      containmentState.set(current, "visiting");
      path.push(current);
      const currentEntity: GraphEntity = entities.get(current)!;
      const parent: unknown = exactRecord(currentEntity.payload)
        ? currentEntity.payload.parent
        : undefined;
      current = typeof parent === "string" ? (parent as EntityId) : undefined;
    }
    for (const member of path) containmentState.set(member, "visited");
  }

  return success(
    Object.freeze({
      documents: Object.freeze(
        [...documents].sort((left, right) => compareText(left.resource, right.resource)),
      ),
      entities: Object.freeze(
        [...entities.values()].sort((left, right) => compareText(left.id, right.id)),
      ),
      relations: Object.freeze(
        [...relations.values()].sort((left, right) => compareText(left.id, right.id)),
      ),
    }),
  );
}

export function createMarkdownIntentStore(
  options: MarkdownIntentStoreOptions,
): MarkdownIntentStore {
  const bounds = parseBounds(options.bounds);
  const { model, resources } = options;

  const makeDocument = (
    bytes: Uint8Array,
    entity: GraphEntity,
    locator: WorkspaceResourceLocator,
    relations: readonly GraphRelation[],
  ): Result<MarkdownIntentDocument> => {
    const exactBytes = bytes.slice();
    const contentRevision = revision(exactBytes);
    if (!contentRevision.ok) return contentRevision;
    const key = resource(locator);
    if (!key.ok) return key;
    const document = {
      get bytes(): Uint8Array {
        return exactBytes.slice();
      },
      entity,
      locator,
      relations,
      resource: key.value,
      revision: contentRevision.value,
    };
    return success(Object.freeze(document));
  };

  const validateRelations = (input: readonly GraphRelation[]): Result<readonly GraphRelation[]> => {
    const length = inspectIntrinsicArrayLength(
      input,
      "invalid-intent-relations",
      "Intent serialization relationships",
    );
    if (!length.ok) return length;
    const validated: GraphRelation[] = [];
    for (let index = 0; index < length.value; index += 1) {
      let value: unknown;
      try {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return failure(
            diagnostic(
              "invalid-intent-relations",
              `relations[${index}] must be an enumerable data property`,
            ),
          );
        }
        value = descriptor.value;
      } catch {
        return failure(
          diagnostic(
            "invalid-intent-relations",
            `relations[${index}] could not be inspected safely`,
          ),
        );
      }
      const inspected = inspectExactRecord(
        value,
        [["id", "payload", "source", "target", "type"]],
        "invalid-intent-relation",
        `Intent relationship at index ${index}`,
      );
      if (!inspected.ok) return inspected;
      const id =
        typeof inspected.value.id === "string"
          ? parseRelationId(inspected.value.id)
          : parseRelationId("");
      if (!id.ok) return id;
      const source =
        typeof inspected.value.source === "string"
          ? parseEntityId(inspected.value.source)
          : parseEntityId("");
      if (!source.ok) return source;
      const target =
        typeof inspected.value.target === "string"
          ? parseEntityId(inspected.value.target)
          : parseEntityId("");
      if (!target.ok) return target;
      if (
        typeof inspected.value.type !== "string" ||
        !relationTypePattern.test(inspected.value.type)
      ) {
        return failure(
          diagnostic(
            "invalid-relation-type",
            `relations[${index}].type must be a lowercase dotted or dashed token`,
          ),
        );
      }
      validated.push({
        id: id.value,
        payload: inspected.value.payload as GraphData,
        source: source.value,
        target: target.value,
        type: inspected.value.type,
      });
    }
    const views = model.relationships(validated);
    if (!views.ok) return views;
    return graphRelations(views.value);
  };

  const serialize = (
    entity: GraphEntity,
    relations: readonly GraphRelation[],
  ): Result<MarkdownIntentDocument> => {
    const inspected = inspectExactRecord(
      entity,
      [["id", "kind", "payload"]],
      "invalid-intent-entity",
      "Intent serialization entity",
    );
    if (!inspected.ok) return inspected;
    const entityId =
      typeof inspected.value.id === "string"
        ? parseEntityId(inspected.value.id)
        : parseEntityId("");
    if (!entityId.ok) return entityId;
    if (typeof inspected.value.kind !== "string") {
      return failure(
        diagnostic("invalid-intent-entity", "Intent GraphEntity kind must be a string"),
      );
    }
    const sanitizedEntity = Object.freeze({
      id: entityId.value,
      kind: inspected.value.kind,
      payload: inspected.value.payload as GraphData,
    });
    const component = model.parse(sanitizedEntity);
    if (!component.ok) return component;
    const componentDraft = model.serialize(component.value);
    if (!componentDraft.ok) return componentDraft;
    const canonicalRelations = validateRelations(relations);
    if (!canonicalRelations.ok) return canonicalRelations;
    const relationships = model.relationships(canonicalRelations.value);
    if (!relationships.ok) return relationships;
    for (const relationship of relationships.value) {
      if (relationship.source !== component.value.id) {
        return failure(
          diagnostic(
            "non-outgoing-intent-relation",
            "An intent document may serialize only relationships outgoing from its component",
            { id: relationship.id, owner: component.value.id, source: relationship.source },
          ),
        );
      }
    }
    const locator = markdownIntentLocator(component.value.id);
    if (!locator.ok) return locator;
    const encoded = encodeDocument(
      frontmatter(component.value, relationships.value),
      component.value.intent,
    );
    if (!encoded.ok) return encoded;
    const bytes = encoded.value;
    if (bytes.byteLength > bounds.maxDocumentBytes) {
      return failure(
        diagnostic(
          "resource-too-large",
          "Serialized intent document exceeds its configured byte bound",
          {
            maximum: bounds.maxDocumentBytes,
          },
        ),
      );
    }
    const canonicalEntity = Object.freeze({
      id: entityId.value,
      kind: componentDraft.value.kind,
      payload: componentDraft.value.payload as GraphData,
    });
    return makeDocument(bytes, canonicalEntity, locator.value, canonicalRelations.value);
  };

  const decode = (
    locator: WorkspaceResourceLocator,
    bytes: Uint8Array,
  ): Result<MarkdownIntentDocument> => {
    const parsedLocator = parseWorkspaceResourceLocator(locator);
    if (!parsedLocator.ok) return parsedLocator;
    const snapshot = snapshotIntentBytes(bytes, bounds.maxDocumentBytes);
    if (!snapshot.ok) return snapshot;
    const exactBytes = snapshot.value;
    let text: string;
    try {
      text = strictTextDecoder.decode(exactBytes);
    } catch {
      return failure(
        diagnostic("invalid-intent-utf8", "Intent document is not well-formed UTF-8", {
          locator: String(parsedLocator.value),
        }),
      );
    }
    if (containsGitConflictBlock(text)) {
      return failure(
        diagnostic(
          "intent-conflict-marker",
          "Intent document contains unresolved conflict markers",
          {
            locator: String(parsedLocator.value),
          },
        ),
      );
    }
    const framed = parseFraming(text);
    if (!framed.ok) return framed;
    const parsed = yamlRecord(framed.value.yaml);
    if (!parsed.ok) return parsed;
    if (parsed.value.intent !== undefined) {
      return failure(
        diagnostic(
          "intent-malformed-body",
          "Intent prose belongs under the Markdown '# Intent' heading, not in frontmatter",
        ),
      );
    }
    const entity = decodedEntity(parsed.value, framed.value.body, model);
    if (!entity.ok) return entity;
    const relations = decodedRelations(parsed.value.relationships, entity.value.id, model);
    if (!relations.ok) return relations;
    return makeDocument(exactBytes, entity.value, parsedLocator.value, relations.value);
  };

  const read = async (id: EntityId): Promise<Result<MarkdownIntentDocument>> => {
    const locator = markdownIntentLocator(id);
    if (!locator.ok) return locator;
    const loaded = await resources.read({
      locator: locator.value,
      maxBytes: bounds.maxDocumentBytes,
    });
    if (!loaded.ok) return loaded;
    const document = decode(locator.value, loaded.value.bytes);
    if (!document.ok) return document;
    if (!expectedLayout(document.value.locator, document.value.entity.id)) {
      return failure(
        diagnostic(
          "intent-wrong-location",
          "Intent component is not stored at the shard derived from its stable identity",
          { actual: String(locator.value), id: document.value.entity.id },
        ),
      );
    }
    return document;
  };

  const load = async (): Promise<Result<MarkdownIntentSnapshot>> => {
    const root = intentRoot();
    const documentEntries: ResourceEntry[] = [];
    let receivedPage = false;
    let cursor: Parameters<LocalResourceProvider["enumerate"]>[0]["cursor"];
    do {
      const page = await resources.enumerate({
        ...(cursor === undefined ? {} : { cursor }),
        limit: bounds.pageSize,
        locator: root,
        maxDepth: 2,
        maxEntriesPerDirectory: bounds.maxEntriesPerDirectory,
      });
      if (!page.ok) {
        if (!receivedPage && page.diagnostics[0]?.code === "resource-missing") {
          return success(
            Object.freeze({
              documents: Object.freeze([]),
              entities: Object.freeze([]),
              relations: Object.freeze([]),
            }),
          );
        }
        if (receivedPage && page.diagnostics[0]?.code === "resource-missing") {
          return failure(
            diagnostic(
              "intent-load-inconsistent",
              "Intent root disappeared during paginated enumeration; retry the bounded load",
            ),
          );
        }
        return page;
      }
      receivedPage = true;
      if (page.value.truncatedByDepth) {
        return failure(
          diagnostic(
            "unexpected-intent-resource",
            "Intent root contains resources deeper than the canonical shard/file layout",
          ),
        );
      }
      for (const entry of page.value.entries) {
        const validated = validateEntry(entry);
        if (!validated.ok) return validated;
        if (validated.value === "document") {
          documentEntries.push(entry);
          if (documentEntries.length > bounds.maxDocuments) {
            return failure(
              diagnostic(
                "intent-document-limit-exceeded",
                "Intent store contains more documents than its configured bound",
                { maximum: bounds.maxDocuments },
              ),
            );
          }
        }
      }
      cursor = page.value.nextCursor;
    } while (cursor !== undefined);

    const documents: MarkdownIntentDocument[] = [];
    let totalDocumentBytes = 0;
    for (const entry of documentEntries.sort((left, right) =>
      compareText(left.locator, right.locator),
    )) {
      const loaded = await resources.read({
        locator: entry.locator,
        maxBytes: bounds.maxDocumentBytes,
      });
      if (!loaded.ok) return loaded;
      const exactBytes = snapshotIntentBytes(loaded.value.bytes, bounds.maxDocumentBytes);
      if (!exactBytes.ok) return exactBytes;
      if (exactBytes.value.byteLength > bounds.maxTotalDocumentBytes - totalDocumentBytes) {
        return failure(
          diagnostic(
            "intent-total-byte-limit-exceeded",
            "Intent store documents exceed the configured aggregate retained-byte bound",
            { maximum: bounds.maxTotalDocumentBytes },
          ),
        );
      }
      totalDocumentBytes += exactBytes.value.byteLength;
      const document = decode(entry.locator, exactBytes.value);
      if (!document.ok) return document;
      documents.push(document.value);
    }
    return validateWholeGraph(documents);
  };

  return Object.freeze({ decode, load, read, serialize });
}
