import { createHash } from "node:crypto";

import { isAlias, parseDocument, Scalar, stringify, visit } from "yaml";

import {
  createEntityAliasResolver,
  failure,
  parseContentRevision,
  parseEntityId,
  parseRelationId,
  parseResourceKey,
  success,
  type ContentRevision,
  type Diagnostic,
  type EntityId,
  type EntityAliasInput,
  type GraphData,
  type GraphEntity,
  type GraphRelation,
  type ResourceKey,
  type Result,
} from "../core/index.ts";
import { copyCanonicalGraphData, copyGraphPayload } from "../core/payload.ts";
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

const schema = "groma/component/v0.2";
const intentRootSegments = ["groma", "components"] as const;
const documentPattern = /\.md$/u;
const incidentalOperatingSystemFiles = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const extensionPattern = /^[A-Za-z][A-Za-z0-9_.-]*(?::|\/)[A-Za-z][A-Za-z0-9_.-]*$/;
const textEncoder = new TextEncoder();
const strictTextDecoder = new TextDecoder("utf-8", { fatal: true });
const intrinsicUint8Array = Uint8Array;
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

export interface MarkdownIntentStoreBounds {
  readonly maxDocumentBytes: number;
  readonly maxDocuments: number;
  readonly maxEntriesPerDirectory: number;
  readonly maxHierarchyDepth: number;
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

export interface MarkdownIntentLocation {
  readonly id: EntityId;
  readonly locator: WorkspaceResourceLocator;
}

export interface MarkdownIntentStore {
  decode(locator: WorkspaceResourceLocator, bytes: Uint8Array): Result<MarkdownIntentDocument>;
  load(aliases?: readonly EntityAliasInput[]): Promise<Result<MarkdownIntentSnapshot>>;
  read(id: EntityId): Promise<Result<MarkdownIntentDocument>>;
  locations(
    entities: readonly GraphEntity[],
    aliases?: readonly EntityAliasInput[],
  ): Result<readonly MarkdownIntentLocation[]>;
  serialize(
    entity: GraphEntity,
    relations: readonly GraphRelation[],
    locator?: WorkspaceResourceLocator,
  ): Result<MarkdownIntentDocument>;
}

const defaultBounds: MarkdownIntentStoreBounds = Object.freeze({
  maxDocumentBytes: 1024 * 1024,
  maxDocuments: 100_000,
  maxEntriesPerDirectory: 10_000,
  maxHierarchyDepth: 64,
  maxTotalDocumentBytes: 128 * 1024 * 1024,
  pageSize: 1_000,
});
const absoluteBounds: MarkdownIntentStoreBounds = Object.freeze({
  maxDocumentBytes: 64 * 1024 * 1024,
  maxDocuments: 1_000_000,
  maxEntriesPerDirectory: 100_000,
  maxHierarchyDepth: 256,
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
            "Intent data contains an unpaired UTF-16 surrogate that cannot be represented losslessly in UTF-8",
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
            "Intent data contains an unpaired UTF-16 surrogate in a key that cannot be represented losslessly in UTF-8",
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
    "maxHierarchyDepth",
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
  if (
    typeof value !== "object" ||
    value === null ||
    typedArrayTag === undefined ||
    typedArrayBuffer === undefined ||
    typedArrayByteOffset === undefined ||
    typedArrayByteLength === undefined
  ) {
    return failure(
      diagnostic("invalid-intent-bytes", "Intent document bytes must be a genuine Uint8Array"),
    );
  }
  try {
    if (Reflect.apply(typedArrayTag, value, []) !== "Uint8Array") {
      return failure(
        diagnostic("invalid-intent-bytes", "Intent document bytes must be a genuine Uint8Array"),
      );
    }
    const buffer = Reflect.apply(typedArrayBuffer, value, []) as ArrayBufferLike;
    const byteOffset = Reflect.apply(typedArrayByteOffset, value, []) as number;
    const byteLength = Reflect.apply(typedArrayByteLength, value, []) as number;
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      throw new TypeError("invalid byte length");
    }
    if (byteLength > maximum) {
      return failure(
        diagnostic("resource-too-large", "Intent document exceeds its configured byte bound", {
          maximum,
        }),
      );
    }
    return success(
      new intrinsicUint8Array(new intrinsicUint8Array(buffer, byteOffset, byteLength)),
    );
  } catch {
    return failure(
      diagnostic("invalid-intent-bytes", "Intent document bytes must be a genuine Uint8Array"),
    );
  }
}

function intentRoot(): WorkspaceResourceLocator {
  const parsed = workspaceResourceLocator(...intentRootSegments);
  if (!parsed.ok) throw new Error("The built-in Markdown intent root is invalid");
  return parsed.value;
}

export function markdownIntentResource(id: EntityId): Result<ResourceKey> {
  const parsed = parseEntityId(id);
  if (!parsed.ok) return parsed;
  return parseResourceKey(`component:${parsed.value}`);
}

function revision(bytes: Uint8Array): Result<ContentRevision> {
  return parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
}

function portableName(value: string, id: EntityId): Result<string> {
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  let name = normalized
    .replace(/[\u0000-\u001f\u007f-\u009f\\/:*?"<>|]/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/[ .]+$/gu, "")
    .trim();
  if (name.length === 0) name = id;
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) name = `_${name}`;
  const filename = `${name}.md`;
  const encoded = textEncoder.encode(filename);
  if (encoded.byteLength > 255) {
    return failure(
      diagnostic(
        "component-filename-too-long",
        "Component name produces a filename longer than the portable 255-byte limit; shorten the name",
        { id, maximumBytes: 255 },
      ),
    );
  }
  return success(name);
}

function defaultDocumentLocator(component: StandardComponent): Result<WorkspaceResourceLocator> {
  const name = portableName(component.name ?? component.id, component.id);
  return name.ok ? workspaceResourceLocator(...intentRootSegments, `${name.value}.md`) : name;
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

function frontmatter(component: StandardComponent): Record<string, unknown> {
  return {
    schema,
    id: component.id,
    ...(component.name === undefined ? {} : { name: component.name }),
    ...(component.label === undefined ? {} : { label: component.label }),
    ...(component.summary === undefined ? {} : { summary: component.summary }),
    ...(component.iconDomain === undefined ? {} : { iconDomain: component.iconDomain }),
    ...(component.type === undefined ? {} : { type: component.type }),
    ...(component.scale === undefined ? {} : { scale: component.scale }),
    ...(component.shared === undefined ? {} : { shared: component.shared }),
    ...(component.parent === undefined ? {} : { parent: component.parent }),
    ...(component.desired === undefined ? {} : { desired: component.desired }),
    ...(component.lifecycle === undefined ? {} : { lifecycle: component.lifecycle }),
    ...canonicalExtensions(component.extensions),
  };
}

function encodeInline(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t")
    .replaceAll("—", "\\—")
    .replaceAll("<", "\\<")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
}

function decodeInline(value: string, path: string): Result<string> {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character !== "\\") {
      decoded += character;
      continue;
    }
    const escaped = value[index + 1];
    if (escaped === undefined) {
      return failure(
        diagnostic("invalid-intent-markdown", `${path} ends with an incomplete escape`),
      );
    }
    if (escaped === "\\" || escaped === "—" || escaped === "<") decoded += escaped;
    else if (escaped === "n") decoded += "\n";
    else if (escaped === "r") decoded += "\r";
    else if (escaped === "t") decoded += "\t";
    else if (escaped === "u") {
      const digits = value.slice(index + 2, index + 6);
      if (!/^[0-9a-f]{4}$/u.test(digits)) {
        return failure(
          diagnostic("invalid-intent-markdown", `${path} has an invalid Unicode escape`),
        );
      }
      decoded += String.fromCharCode(Number.parseInt(digits, 16));
      index += 4;
    } else {
      return failure(diagnostic("invalid-intent-markdown", `${path} has an unsupported escape`));
    }
    index += 1;
  }
  return success(decoded);
}

function encodeCommentId(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*~.-]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function decodeCommentId(value: string, path: string): Result<string> {
  try {
    const decoded = decodeURIComponent(value);
    return encodeCommentId(decoded) === value
      ? success(decoded)
      : failure(diagnostic("invalid-intent-markdown", `${path} uses a noncanonical stable id`));
  } catch {
    return failure(diagnostic("invalid-intent-markdown", `${path} has an invalid stable id`));
  }
}

function encodeExtensions(value: Readonly<Record<string, GraphData>>): Result<string | undefined> {
  if (Object.keys(value).length === 0) return success(undefined);
  const canonical = copyCanonicalGraphData(canonicalExtensions(value), "entity");
  return canonical.ok
    ? success(Buffer.from(canonical.value.canonicalJson, "utf8").toString("base64url"))
    : canonical;
}

function decodeExtensions(
  value: string | undefined,
  path: string,
): Result<Record<string, GraphData>> {
  if (value === undefined) return success({});
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) throw new Error();
    const decoded = JSON.parse(strictTextDecoder.decode(bytes)) as unknown;
    if (!exactRecord(decoded)) throw new Error();
    const parsed = extensions(decoded, new Set(), path);
    if (!parsed.ok) return parsed;
    const canonical = copyCanonicalGraphData(parsed.value, "entity");
    if (
      !canonical.ok ||
      Buffer.from(canonical.value.canonicalJson).toString("base64url") !== value
    ) {
      throw new Error();
    }
    return success(parsed.value);
  } catch {
    return failure(
      diagnostic("invalid-intent-markdown", `${path} contains malformed extension metadata`),
    );
  }
}

function itemLine(item: StandardItem): Result<string> {
  const fields = [
    ...(item.name === undefined ? [] : ["name"]),
    ...(item.description === undefined ? [] : ["description"]),
  ];
  const text =
    item.name === undefined
      ? item.description === undefined
        ? ""
        : encodeInline(item.description)
      : item.description === undefined
        ? encodeInline(item.name)
        : `${encodeInline(item.name)} — ${encodeInline(item.description)}`;
  const extra = encodeExtensions(item.extensions);
  if (!extra.ok) return extra;
  const metadata = `<!-- groma:item id=${encodeCommentId(item.id)} fields=${fields.join(",") || "none"}${extra.value === undefined ? "" : ` extensions=${extra.value}`} -->`;
  return success(`- ${text}${text.length === 0 ? "" : " "}${metadata}`);
}

function relationshipLine(relationship: StandardRelationship): Result<string> {
  const extra = encodeExtensions(relationship.extensions);
  if (!extra.ok) return extra;
  const description =
    relationship.description === undefined ? "" : ` — ${encodeInline(relationship.description)}`;
  const metadata = `<!-- groma:relationship id=${encodeCommentId(relationship.id)} target=${encodeCommentId(relationship.target)} description=${relationship.description === undefined ? "false" : "true"}${extra.value === undefined ? "" : ` extensions=${extra.value}`} -->`;
  return success(`- ${relationship.type} → ${relationship.target}${description} ${metadata}`);
}

function itemSection(title: string, items: readonly StandardItem[]): Result<string> {
  const lines: string[] = [];
  for (const item of items) {
    const line = itemLine(item);
    if (!line.ok) return line;
    lines.push(line.value);
  }
  return success(`# ${title}${lines.length === 0 ? "" : `\n\n${lines.join("\n")}`}`);
}

function encodeDocument(
  front: Record<string, unknown>,
  component: StandardComponent,
  relationships: readonly StandardRelationship[],
): Result<Uint8Array> {
  const frontUnicode = validateUnicode(front, "frontmatter");
  if (!frontUnicode.ok) return frontUnicode;
  const bodyUnicode = validateUnicode({ component, relationships }, "body");
  if (!bodyUnicode.ok) return bodyUnicode;
  try {
    const yaml = stringify(
      front,
      (_key, value: unknown) => {
        if (
          typeof value === "number" &&
          Number.isFinite(value) &&
          Number.isInteger(value) &&
          !Number.isSafeInteger(value)
        ) {
          const scalar = new Scalar(value);
          scalar.format = "EXP";
          return scalar;
        }
        return value;
      },
      {
        aliasDuplicateObjects: false,
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0,
      },
    );
    const sections: string[] = [];
    for (const [title, items] of [
      ["Inputs", component.inputs],
      ["Outputs", component.outputs],
      ["Actions", component.actions],
    ] as const) {
      if (items === undefined) continue;
      const section = itemSection(title, items);
      if (!section.ok) return section;
      sections.push(section.value);
    }
    if (relationships.length > 0) {
      const lines: string[] = [];
      for (const relationship of relationships) {
        const line = relationshipLine(relationship);
        if (!line.ok) return line;
        lines.push(line.value);
      }
      sections.push(`# Relationships\n\n${lines.join("\n")}`);
    }
    if (component.intent !== undefined) sections.push(`# Intent\n\n${component.intent}`);
    const body = sections.length === 0 ? "" : `\n${sections.join("\n\n")}\n`;
    const markdown = `---\n${yaml}---\n${body}`;
    if (containsGitConflictBlock(markdown)) {
      return failure(
        diagnostic(
          "intent-conflict-marker",
          "Intent contains a complete column-zero Git conflict block; indent or quote marker lines when documenting them literally",
        ),
      );
    }
    return success(textEncoder.encode(markdown));
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
  if (!suffix.startsWith("\n# ") || !suffix.endsWith("\n")) {
    return failure(
      diagnostic(
        "intent-malformed-body",
        "Intent Markdown body must contain LF-delimited canonical component sections",
      ),
    );
  }
  return success({ body: suffix.slice(1, -1), yaml: text.slice(4, closing + 1) });
}

function validateYamlNumbers(document: ReturnType<typeof parseDocument>): Result<void> {
  let invalid: Diagnostic | undefined;
  visit(document, {
    Scalar: (_key, node) => {
      if (typeof node.value === "bigint") {
        const converted = Number(node.value);
        let exact = false;
        if (Number.isFinite(converted)) {
          try {
            exact = BigInt(converted) === node.value;
          } catch {
            exact = false;
          }
        }
        if (!exact) {
          invalid = diagnostic(
            "intent-unsafe-integer",
            "Intent YAML integer cannot be represented exactly as a finite JavaScript number",
            { value: node.source ?? String(node.value) },
          );
          return visit.BREAK;
        }
        node.value = converted;
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
      if (isAlias(node) || node.anchor !== undefined || node.tag !== undefined) {
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
  const unicode = validateUnicode(value, "frontmatter");
  if (!unicode.ok) return unicode;
  return exactRecord(value)
    ? success(value)
    : failure(
        diagnostic("intent-malformed-yaml", "Intent frontmatter must contain one YAML mapping"),
      );
}

const knownFrontmatterFields = new Set([
  "desired",
  "id",
  "iconDomain",
  "label",
  "lifecycle",
  "name",
  "parent",
  "scale",
  "schema",
  "shared",
  "summary",
  "type",
]);

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

interface ParsedMarkdownBody {
  readonly actions?: readonly Record<string, unknown>[];
  readonly inputs?: readonly Record<string, unknown>[];
  readonly intent?: string;
  readonly outputs?: readonly Record<string, unknown>[];
  readonly relationships: readonly Record<string, unknown>[];
}

function parseItemLine(line: string, path: string): Result<Record<string, unknown>> {
  if (!line.startsWith("- ")) {
    return failure(diagnostic("invalid-intent-markdown", `${path} must be a Markdown bullet`));
  }
  const marker = "<!-- groma:item ";
  const markerIndex = line.lastIndexOf(marker);
  if (markerIndex < 2 || !line.endsWith(" -->")) {
    return failure(
      diagnostic("invalid-intent-markdown", `${path} must carry its stable id in an HTML comment`),
    );
  }
  let text = line.slice(2, markerIndex);
  if (text.endsWith(" ")) text = text.slice(0, -1);
  const metadata = line.slice(markerIndex);
  const matched =
    /^<!-- groma:item id=([^ ]+) fields=(none|name|description|name,description)(?: extensions=([A-Za-z0-9_-]+))? -->$/u.exec(
      metadata,
    );
  if (matched === null) {
    return failure(diagnostic("invalid-intent-markdown", `${path} has malformed item metadata`));
  }
  const id = decodeCommentId(matched[1]!, `${path}.id`);
  if (!id.ok || id.value.length === 0)
    return id.ok
      ? failure(diagnostic("invalid-intent-markdown", `${path}.id must not be empty`))
      : id;
  const extra = decodeExtensions(matched[3], `${path}.extensions`);
  if (!extra.ok) return extra;
  const fields = matched[2]!;
  let name: string | undefined;
  let description: string | undefined;
  if (fields === "none") {
    if (text.length !== 0) {
      return failure(
        diagnostic(
          "invalid-intent-markdown",
          `${path} declares no readable fields but contains text`,
        ),
      );
    }
  } else if (fields === "name") {
    const parsed = decodeInline(text, `${path}.name`);
    if (!parsed.ok) return parsed;
    name = parsed.value;
  } else if (fields === "description") {
    const parsed = decodeInline(text, `${path}.description`);
    if (!parsed.ok) return parsed;
    description = parsed.value;
  } else {
    const separator = text.indexOf(" — ");
    if (separator < 0 || text.indexOf(" — ", separator + 3) >= 0) {
      return failure(
        diagnostic(
          "invalid-intent-markdown",
          `${path} must separate its name and description with one em dash`,
        ),
      );
    }
    const parsedName = decodeInline(text.slice(0, separator), `${path}.name`);
    const parsedDescription = decodeInline(text.slice(separator + 3), `${path}.description`);
    if (!parsedName.ok) return parsedName;
    if (!parsedDescription.ok) return parsedDescription;
    name = parsedName.value;
    description = parsedDescription.value;
  }
  return success({
    id: id.value,
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
    ...extra.value,
  });
}

function parseRelationshipLine(line: string, path: string): Result<Record<string, unknown>> {
  if (!line.startsWith("- ")) {
    return failure(diagnostic("invalid-intent-markdown", `${path} must be a Markdown bullet`));
  }
  const marker = "<!-- groma:relationship ";
  const markerIndex = line.lastIndexOf(marker);
  if (markerIndex < 2 || !line.endsWith(" -->")) {
    return failure(
      diagnostic("invalid-intent-markdown", `${path} must carry its stable id in an HTML comment`),
    );
  }
  let text = line.slice(2, markerIndex);
  if (text.endsWith(" ")) text = text.slice(0, -1);
  const metadata = line.slice(markerIndex);
  const matched =
    /^<!-- groma:relationship id=([^ ]+) target=([^ ]+) description=(false|true)(?: extensions=([A-Za-z0-9_-]+))? -->$/u.exec(
      metadata,
    );
  if (matched === null) {
    return failure(
      diagnostic("invalid-intent-markdown", `${path} has malformed relationship metadata`),
    );
  }
  const id = decodeCommentId(matched[1]!, `${path}.id`);
  if (!id.ok) return id;
  const target = decodeCommentId(matched[2]!, `${path}.target`);
  if (!target.ok) return target;
  const parsedTarget = parseEntityId(target.value);
  if (!parsedTarget.ok) return parsedTarget;
  const extra = decodeExtensions(matched[4], `${path}.extensions`);
  if (!extra.ok) return extra;
  const relationship =
    /^([a-z][a-z0-9]*(?:[.-][a-z0-9]+)*) → (ent_[0-9a-f]{32})(?: — (.*))?$/u.exec(text);
  if (
    relationship === null ||
    relationship[2] !== parsedTarget.value ||
    (matched[3] === "true") !== (relationship[3] !== undefined)
  ) {
    return failure(
      diagnostic(
        "invalid-intent-markdown",
        `${path} must be 'type → stable-target' with matching hidden identity and optional description`,
      ),
    );
  }
  let description: string | undefined;
  if (relationship[3] !== undefined) {
    const parsed = decodeInline(relationship[3], `${path}.description`);
    if (!parsed.ok) return parsed;
    description = parsed.value;
  }
  return success({
    id: id.value,
    type: relationship[1]!,
    target: parsedTarget.value,
    ...(description === undefined ? {} : { description }),
    ...extra.value,
  });
}

function parseMarkdownBody(body: string | undefined): Result<ParsedMarkdownBody> {
  if (body === undefined) return success({ relationships: Object.freeze([]) });
  const lines = body.split("\n");
  const order = ["Inputs", "Outputs", "Actions", "Relationships", "Intent"] as const;
  const seen = new Set<string>();
  const parsed: {
    actions?: readonly Record<string, unknown>[];
    inputs?: readonly Record<string, unknown>[];
    intent?: string;
    outputs?: readonly Record<string, unknown>[];
    relationships: readonly Record<string, unknown>[];
  } = { relationships: Object.freeze([]) };
  let previous = -1;
  let index = 0;
  while (index < lines.length) {
    const heading = /^# (Inputs|Outputs|Actions|Relationships|Intent)$/u.exec(lines[index]!);
    if (heading === null) {
      return failure(
        diagnostic(
          "invalid-intent-markdown",
          `body line ${index + 1} must be a known section heading`,
        ),
      );
    }
    const title = heading[1] as (typeof order)[number];
    const position = order.indexOf(title);
    if (seen.has(title) || position <= previous) {
      return failure(
        diagnostic("invalid-intent-markdown", `# ${title} is duplicated or out of canonical order`),
      );
    }
    seen.add(title);
    previous = position;
    index += 1;
    if (index < lines.length) {
      if (lines[index] !== "") {
        return failure(
          diagnostic("invalid-intent-markdown", `# ${title} must be followed by one blank line`),
        );
      }
      index += 1;
    }
    if (title === "Intent") {
      parsed.intent = lines.slice(index).join("\n");
      index = lines.length;
      continue;
    }
    const content: string[] = [];
    while (index < lines.length) {
      if (
        lines[index] === "" &&
        /^# (?:Inputs|Outputs|Actions|Relationships|Intent)$/u.test(lines[index + 1] ?? "")
      ) {
        index += 1;
        break;
      }
      content.push(lines[index]!);
      index += 1;
    }
    const records: Record<string, unknown>[] = [];
    for (let itemIndex = 0; itemIndex < content.length; itemIndex += 1) {
      const item =
        title === "Relationships"
          ? parseRelationshipLine(content[itemIndex]!, `body.${title}[${itemIndex}]`)
          : parseItemLine(content[itemIndex]!, `body.${title}[${itemIndex}]`);
      if (!item.ok) return item;
      records.push(item.value);
    }
    if (title === "Inputs") parsed.inputs = Object.freeze(records);
    else if (title === "Outputs") parsed.outputs = Object.freeze(records);
    else if (title === "Actions") parsed.actions = Object.freeze(records);
    else parsed.relationships = Object.freeze(records);
  }
  return success(Object.freeze(parsed));
}

function decodedEntity(
  record: Readonly<Record<string, unknown>>,
  body: ParsedMarkdownBody,
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
  const id = typeof record.id === "string" ? parseEntityId(record.id) : parseEntityId("");
  if (!id.ok) return id;
  const extra = extensions(record, knownFrontmatterFields, "frontmatter");
  if (!extra.ok) return extra;
  const input: Record<string, unknown> = {
    id: id.value,
    ...(record.name === undefined ? {} : { name: record.name }),
    ...(record.label === undefined ? {} : { label: record.label }),
    ...(record.summary === undefined ? {} : { summary: record.summary }),
    ...(record.iconDomain === undefined ? {} : { iconDomain: record.iconDomain }),
    ...(record.type === undefined ? {} : { type: record.type }),
    ...(record.scale === undefined ? {} : { scale: record.scale }),
    ...(record.shared === undefined ? {} : { shared: record.shared }),
    ...(record.parent === undefined ? {} : { parent: record.parent }),
    ...(body.intent === undefined ? {} : { intent: body.intent }),
    ...(body.inputs === undefined ? {} : { inputs: body.inputs }),
    ...(body.outputs === undefined ? {} : { outputs: body.outputs }),
    ...(body.actions === undefined ? {} : { actions: body.actions }),
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
  value: readonly Record<string, unknown>[],
  source: EntityId,
  model: StandardModelCapability,
): Result<readonly GraphRelation[]> {
  const relations: GraphRelation[] = [];
  for (const [index, candidate] of value.entries()) {
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
          `body.relationships[${index}].type must be a relation type token`,
        ),
      );
    }
    const extra = extensions(
      candidate,
      new Set(["description", "id", "target", "type"]),
      `body.relationships[${index}]`,
    );
    if (!extra.ok) return extra;
    if (!relationTypePattern.test(candidate.type)) {
      return failure(
        diagnostic(
          "invalid-intent-relationship-type",
          `body.relationships[${index}].type must be a lowercase dotted or dashed token`,
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

function unexpectedLayout(entry: ResourceEntry): Result<never> {
  const locator = String(entry.locator);
  return failure(
    diagnostic(
      "unexpected-intent-resource",
      `Component folders contain an unexpected ${entry.kind} at ${locator}; remove it or move it outside groma/components`,
      { kind: entry.kind, locator },
    ),
  );
}

function validateEntry(entry: ResourceEntry): Result<"directory" | "document" | "ignored"> {
  const parts = String(entry.locator).split("/");
  if (parts.length < 3 || parts[0] !== "groma" || parts[1] !== "components") {
    return unexpectedLayout(entry);
  }
  if (entry.kind === "directory") return success("directory");
  if (entry.kind === "file" && incidentalOperatingSystemFiles.has(parts.at(-1)!)) {
    return success("ignored");
  }
  if (entry.kind === "file" && documentPattern.test(parts.at(-1)!)) return success("document");
  return unexpectedLayout(entry);
}

function computeLocations(
  entities: readonly GraphEntity[],
  aliases: readonly EntityAliasInput[],
  maximumAliases: number,
  maximumDepth: number,
  model: StandardModelCapability,
): Result<readonly MarkdownIntentLocation[]> {
  const components = new Map<EntityId, StandardComponent>();
  for (const entity of entities) {
    const component = model.parse(entity);
    if (!component.ok) return component;
    if (components.has(component.value.id)) {
      return failure(
        diagnostic(
          "duplicate-intent-entity",
          "The same stable component identity occurs more than once",
          {
            id: component.value.id,
          },
        ),
      );
    }
    components.set(component.value.id, component.value);
  }
  const resolver = createEntityAliasResolver(
    aliases,
    new Set(components.keys()),
    Math.max(1, maximumAliases),
  );
  if (!resolver.ok) return resolver;
  const parents = new Map<EntityId, EntityId | undefined>();
  const names = new Map<EntityId, string>();
  const siblingNames = new Map<string, EntityId>();
  for (const component of components.values()) {
    let parent: EntityId | undefined;
    if (component.parent !== undefined) {
      const resolved = resolver.value.resolve(component.parent);
      if (!resolved.ok) return resolved;
      parent = resolved.value.resolved;
    }
    parents.set(component.id, parent);
    const name = portableName(component.name ?? component.id, component.id);
    if (!name.ok) return name;
    names.set(component.id, name.value);
    const collisionKey = `${parent ?? "root"}\u0000${name.value.normalize("NFC").toLowerCase()}`;
    const sibling = siblingNames.get(collisionKey);
    if (sibling !== undefined) {
      return failure(
        diagnostic(
          "component-filename-collision",
          "Sibling component names resolve to the same portable filename; rename one component before saving",
          {
            firstId: sibling,
            filename: `${name.value}.md`,
            parent: parent ?? "root",
            secondId: component.id,
          },
        ),
      );
    }
    siblingNames.set(collisionKey, component.id);
  }
  const paths = new Map<EntityId, readonly string[]>();
  const visiting = new Set<EntityId>();
  const pathFor = (id: EntityId): Result<readonly string[]> => {
    const cached = paths.get(id);
    if (cached !== undefined) return success(cached);
    if (visiting.has(id)) {
      return failure(
        diagnostic(
          "intent-containment-cycle",
          "Intent component containment contains a structural parent cycle",
          { id },
        ),
      );
    }
    visiting.add(id);
    const parent = parents.get(id);
    const prefix =
      parent === undefined ? success(Object.freeze([]) as readonly string[]) : pathFor(parent);
    if (!prefix.ok) return prefix;
    if (prefix.value.length >= maximumDepth) {
      return failure(
        diagnostic(
          "intent-hierarchy-too-deep",
          "Component hierarchy exceeds the configured folder depth",
          {
            id,
            maximum: maximumDepth,
          },
        ),
      );
    }
    const path = Object.freeze([...prefix.value, names.get(id)!]);
    paths.set(id, path);
    visiting.delete(id);
    return success(path);
  };
  const locations: MarkdownIntentLocation[] = [];
  for (const id of [...components.keys()].sort(compareText)) {
    const path = pathFor(id);
    if (!path.ok) return path;
    const locator = workspaceResourceLocator(
      ...intentRootSegments,
      ...path.value.slice(0, -1),
      `${path.value.at(-1)!}.md`,
    );
    if (!locator.ok) return locator;
    locations.push(Object.freeze({ id, locator: locator.value }));
  }
  return success(Object.freeze(locations));
}

function validateWholeGraph(
  documents: readonly MarkdownIntentDocument[],
  aliases: readonly EntityAliasInput[],
  bounds: MarkdownIntentStoreBounds,
  model: StandardModelCapability,
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
  const aliasResolver = createEntityAliasResolver(
    aliases,
    new Set(entities.keys()),
    // The store permits a zero-document bound; Core still requires a positive resolver bound.
    Math.max(1, bounds.maxDocuments),
  );
  if (!aliasResolver.ok) return aliasResolver;

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

  for (const entity of entities.values()) {
    const parent = exactRecord(entity.payload) ? entity.payload.parent : undefined;
    if (typeof parent === "string" && !aliasResolver.value.resolve(parent).ok) {
      return failure(
        diagnostic("unknown-intent-parent", "Intent component refers to an unknown parent", {
          id: entity.id,
          parent,
        }),
      );
    }
  }
  for (const relation of relations.values()) {
    if (!aliasResolver.value.resolve(relation.target).ok) {
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
      if (typeof parent === "string") {
        const resolved = aliasResolver.value.resolve(parent);
        if (!resolved.ok) return resolved;
        current = resolved.value.resolved;
      } else {
        current = undefined;
      }
    }
    for (const member of path) containmentState.set(member, "visited");
  }

  const locations = computeLocations(
    [...entities.values()],
    aliases,
    bounds.maxDocuments,
    bounds.maxHierarchyDepth,
    model,
  );
  if (!locations.ok) return locations;

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
    const snapshot = snapshotIntentBytes(bytes, Number.MAX_SAFE_INTEGER);
    if (!snapshot.ok) return snapshot;
    const exactBytes = snapshot.value;
    const contentRevision = revision(exactBytes);
    if (!contentRevision.ok) return contentRevision;
    const key = markdownIntentResource(entity.id);
    if (!key.ok) return key;
    const document = {
      get bytes(): Uint8Array {
        return new intrinsicUint8Array(exactBytes);
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
      const payload = copyGraphPayload(inspected.value.payload, "relation");
      if (!payload.ok) return payload;
      validated.push({
        id: id.value,
        payload: payload.value,
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
    requestedLocator?: WorkspaceResourceLocator,
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
    const payload = copyGraphPayload(inspected.value.payload, "entity");
    if (!payload.ok) return payload;
    const sanitizedEntity = Object.freeze({
      id: entityId.value,
      kind: inspected.value.kind,
      payload: payload.value,
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
    const locator =
      requestedLocator === undefined
        ? defaultDocumentLocator(component.value)
        : parseWorkspaceResourceLocator(requestedLocator);
    if (!locator.ok) return locator;
    const encoded = encodeDocument(
      frontmatter(component.value),
      component.value,
      relationships.value,
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
    const body = parseMarkdownBody(framed.value.body);
    if (!body.ok) return body;
    const entity = decodedEntity(parsed.value, body.value, model);
    if (!entity.ok) return entity;
    const relations = decodedRelations(body.value.relationships, entity.value.id, model);
    if (!relations.ok) return relations;
    return makeDocument(exactBytes, entity.value, parsedLocator.value, relations.value);
  };

  const read = async (id: EntityId): Promise<Result<MarkdownIntentDocument>> => {
    const parsed = parseEntityId(id);
    if (!parsed.ok) return parsed;
    const loaded = await load();
    if (!loaded.ok) return loaded;
    const document = loaded.value.documents.find(
      (candidate) => candidate.entity.id === parsed.value,
    );
    return document === undefined
      ? failure(
          diagnostic("resource-missing", "Component document is missing", { id: parsed.value }),
        )
      : success(document);
  };

  const locations = (
    entities: readonly GraphEntity[],
    aliases: readonly EntityAliasInput[] = Object.freeze([]),
  ): Result<readonly MarkdownIntentLocation[]> =>
    computeLocations(entities, aliases, bounds.maxDocuments, bounds.maxHierarchyDepth, model);

  const load = async (
    aliases: readonly EntityAliasInput[] = Object.freeze([]),
  ): Promise<Result<MarkdownIntentSnapshot>> => {
    const root = intentRoot();
    const documentEntries: ResourceEntry[] = [];
    const maximumPages = bounds.maxDocuments + 1;
    let pageCount = 0;
    let receivedPage = false;
    let cursor: Parameters<LocalResourceProvider["enumerate"]>[0]["cursor"];
    do {
      if (pageCount >= maximumPages) {
        return failure(
          diagnostic(
            "intent-page-limit-exceeded",
            "Intent enumeration exceeded the maximum progress pages allowed by document and shard bounds",
            { maximum: maximumPages },
          ),
        );
      }
      pageCount += 1;
      const page = await resources.enumerate({
        ...(cursor === undefined ? {} : { cursor }),
        limit: bounds.pageSize,
        locator: root,
        maxDepth: bounds.maxHierarchyDepth,
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
      if (page.value.nextCursor !== undefined && page.value.entries.length === 0) {
        return failure(
          diagnostic(
            "intent-load-inconsistent",
            "Intent enumeration returned an empty non-final page and made no bounded progress",
          ),
        );
      }
      if (page.value.truncatedByDepth) {
        return failure(
          diagnostic(
            "unexpected-intent-resource",
            "Component folders exceed the configured hierarchy depth",
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
    return validateWholeGraph(documents, aliases, bounds, model);
  };

  return Object.freeze({ decode, load, locations, read, serialize });
}
