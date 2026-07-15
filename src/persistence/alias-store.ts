import { createHash } from "node:crypto";

import { isAlias, parseDocument, stringify, visit } from "yaml";

import {
  failure,
  parseContentRevision,
  parseEntityId,
  parseResourceKey,
  success,
  type ContentRevision,
  type EntityAlias,
  type ResourceKey,
  type Result,
} from "../core/index.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  workspaceResourceLocator,
  type LocalResourceProvider,
  type WorkspaceResourceLocator,
} from "./contracts.ts";

const aliasSchema = "groma/aliases/v0.1";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
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

export interface AliasStoreBounds {
  readonly maxAliases: number;
  readonly maxBytes: number;
}

export interface AliasStoreOptions {
  readonly bounds?: Partial<AliasStoreBounds>;
  readonly resources: LocalResourceProvider;
}

export interface AliasStoreSnapshot {
  readonly aliases: readonly EntityAlias[];
  readonly bytes?: Uint8Array;
  readonly locator: WorkspaceResourceLocator;
  readonly resource: ResourceKey;
  readonly revision: ContentRevision | null;
}

export interface AliasStore {
  decode(bytes: Uint8Array): Result<AliasStoreSnapshot>;
  load(): Promise<Result<AliasStoreSnapshot>>;
  serialize(aliases: readonly EntityAlias[]): Result<AliasStoreSnapshot>;
}

const defaultBounds: AliasStoreBounds = Object.freeze({ maxAliases: 100_000, maxBytes: 4_194_304 });
const absoluteBounds: AliasStoreBounds = Object.freeze({
  maxAliases: 1_000_000,
  maxBytes: 64 * 1024 * 1024,
});

function diagnostic(code: string, message: string, details?: Record<string, string | number>) {
  return Object.freeze({
    code,
    ...(details === undefined ? {} : { details: Object.freeze(details) }),
    message,
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function aliasStoreLocator(): Result<WorkspaceResourceLocator> {
  return workspaceResourceLocator("groma", "aliases.md");
}

function aliasResource(locator: WorkspaceResourceLocator): Result<ResourceKey> {
  return parseResourceKey(locator);
}

function revision(bytes: Uint8Array): ContentRevision {
  const parsed = parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  if (!parsed.ok) throw new Error("Alias revision could not be represented");
  return parsed.value;
}

function exactBytes(value: unknown, maximum: number): Result<Uint8Array> {
  const invalid = () =>
    failure(
      diagnostic("invalid-alias-store-bytes", "Alias records must be genuine Uint8Array bytes"),
    );
  if (
    typeof value !== "object" ||
    value === null ||
    typedArrayTag === undefined ||
    typedArrayBuffer === undefined ||
    typedArrayByteOffset === undefined ||
    typedArrayByteLength === undefined
  ) {
    return invalid();
  }
  try {
    if (Reflect.apply(typedArrayTag, value, []) !== "Uint8Array") return invalid();
    const buffer = Reflect.apply(typedArrayBuffer, value, []) as ArrayBufferLike;
    const byteOffset = Reflect.apply(typedArrayByteOffset, value, []) as number;
    const byteLength = Reflect.apply(typedArrayByteLength, value, []) as number;
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) return invalid();
    if (byteLength > maximum) {
      return failure(
        diagnostic(
          "alias-store-byte-limit-exceeded",
          "Alias records exceed the configured byte limit",
          {
            maximum,
          },
        ),
      );
    }
    return success(
      new intrinsicUint8Array(new intrinsicUint8Array(buffer, byteOffset, byteLength)),
    );
  } catch {
    return invalid();
  }
}

function parseYaml(source: string): Result<Readonly<Record<string, unknown>>> {
  let document: ReturnType<typeof parseDocument>;
  try {
    document = parseDocument(source, {
      logLevel: "silent",
      prettyErrors: false,
      schema: "core",
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });
  } catch {
    return failure(diagnostic("alias-store-malformed-yaml", "Alias records are malformed YAML"));
  }
  if (document.errors.some((error) => error.code === "DUPLICATE_KEY")) {
    return failure(
      diagnostic("alias-store-duplicate-key", "Alias records contain a duplicate YAML key"),
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
        "alias-store-unsupported-yaml",
        "Alias records must not contain YAML aliases, anchors, or explicit tags",
      ),
    );
  }
  if (document.errors.length > 0 || document.warnings.length > 0) {
    return failure(
      diagnostic("alias-store-malformed-yaml", "Alias records contain unsupported YAML"),
    );
  }
  const value = document.toJS({ maxAliasCount: 0 }) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(diagnostic("invalid-alias-store", "Alias records must be one YAML mapping"));
  }
  const keys = Object.keys(value);
  keys.sort(compareText);
  if (keys.length !== 2 || keys[0] !== "aliases" || keys[1] !== "schema") {
    return failure(
      diagnostic("invalid-alias-store", "Alias records must contain exactly schema and aliases"),
    );
  }
  return success(value as Readonly<Record<string, unknown>>);
}

function markdownFrontmatter(source: string): Result<string> {
  if (!source.startsWith("---\n") || !source.endsWith("---\n") || source.length < 8) {
    return failure(
      diagnostic(
        "alias-store-malformed-markdown",
        "Alias records must be one Markdown document with YAML frontmatter",
      ),
    );
  }
  return success(source.slice(4, -4));
}

function validatedAliases(value: unknown, maximum: number): Result<readonly EntityAlias[]> {
  const length = inspectIntrinsicArrayLength(
    value,
    "invalid-alias-store",
    "Component alias records",
  );
  if (!length.ok) return length;
  if (length.value > maximum) {
    return failure(
      diagnostic("alias-count-exceeded", "Alias records exceed the configured item count", {
        maximum,
      }),
    );
  }
  const aliases: EntityAlias[] = [];
  const sources = new Map<string, string>();
  for (let index = 0; index < length.value; index += 1) {
    let item: unknown;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          diagnostic(
            "invalid-component-alias",
            `Component alias ${index} must be an enumerable data property`,
          ),
        );
      }
      item = descriptor.value;
    } catch {
      return failure(
        diagnostic("invalid-component-alias", `Component alias ${index} could not be inspected`),
      );
    }
    const record = inspectExactRecord(
      item,
      [["source", "target"]],
      "invalid-component-alias",
      `Component alias ${index}`,
    );
    if (!record.ok) return record;
    const source = parseEntityId(
      typeof record.value.source === "string" ? record.value.source : "",
    );
    const target = parseEntityId(
      typeof record.value.target === "string" ? record.value.target : "",
    );
    if (!source.ok) return source;
    if (!target.ok) return target;
    if (source.value === target.value) {
      return failure(
        diagnostic("self-component-alias", "A component identity cannot supersede itself", {
          id: source.value,
        }),
      );
    }
    if (sources.has(source.value)) {
      return failure(
        diagnostic(
          "ambiguous-component-supersession",
          "An obsolete component identity can have only one superseding target",
          { id: source.value },
        ),
      );
    }
    sources.set(source.value, target.value);
    aliases.push(Object.freeze({ source: source.value, target: target.value }));
  }
  aliases.sort((left, right) => compareText(left.source, right.source));
  const traversalState = new Map<string, "visiting" | "visited">();
  for (const alias of aliases) {
    if (traversalState.get(alias.source) === "visited") continue;
    const trail: string[] = [];
    const positions = new Map<string, number>();
    let current: string | undefined = alias.source;
    while (current !== undefined && sources.has(current)) {
      if (traversalState.get(current) === "visited") break;
      const priorPosition = positions.get(current);
      if (priorPosition !== undefined) {
        let representative = current;
        for (let index = priorPosition; index < trail.length; index += 1) {
          if (trail[index]! < representative) representative = trail[index]!;
        }
        return failure(
          diagnostic("component-alias-cycle", "Component alias chains must be acyclic", {
            id: representative,
          }),
        );
      }
      traversalState.set(current, "visiting");
      positions.set(current, trail.length);
      trail.push(current);
      current = sources.get(current);
    }
    for (const member of trail) traversalState.set(member, "visited");
  }
  return success(Object.freeze(aliases));
}

function snapshot(
  aliases: readonly EntityAlias[],
  locator: WorkspaceResourceLocator,
  resource: ResourceKey,
  contentRevision: ContentRevision | null,
  bytes?: Uint8Array,
): AliasStoreSnapshot {
  if (bytes === undefined) {
    return Object.freeze({ aliases, locator, resource, revision: contentRevision });
  }
  const exact = new intrinsicUint8Array(bytes);
  return Object.freeze({
    aliases,
    get bytes(): Uint8Array {
      return new intrinsicUint8Array(exact);
    },
    locator,
    resource,
    revision: contentRevision,
  });
}

export function createAliasStore(options: AliasStoreOptions): AliasStore {
  const bounds = Object.freeze({ ...defaultBounds, ...(options.bounds ?? {}) });
  for (const field of ["maxAliases", "maxBytes"] as const) {
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
  const locator = aliasStoreLocator();
  if (!locator.ok) throw new Error("Canonical alias locator could not be created");
  const resource = aliasResource(locator.value);
  if (!resource.ok) throw new Error("Canonical alias resource could not be created");

  const decode = (value: Uint8Array): Result<AliasStoreSnapshot> => {
    const copied = exactBytes(value, bounds.maxBytes);
    if (!copied.ok) return copied;
    let text: string;
    try {
      text = textDecoder.decode(copied.value);
    } catch {
      return failure(diagnostic("alias-store-invalid-utf8", "Alias records must be valid UTF-8"));
    }
    const frontmatter = markdownFrontmatter(text);
    if (!frontmatter.ok) return frontmatter;
    const parsed = parseYaml(frontmatter.value);
    if (!parsed.ok) return parsed;
    if (parsed.value.schema !== aliasSchema) {
      return failure(diagnostic("unsupported-alias-schema", "Alias record schema is unsupported"));
    }
    const aliases = validatedAliases(parsed.value.aliases, bounds.maxAliases);
    if (!aliases.ok) return aliases;
    return success(
      snapshot(aliases.value, locator.value, resource.value, revision(copied.value), copied.value),
    );
  };

  const load = async (): Promise<Result<AliasStoreSnapshot>> => {
    const read = await options.resources.read({
      locator: locator.value,
      maxBytes: bounds.maxBytes,
    });
    if (!read.ok) {
      return read.diagnostics[0]?.code === "resource-missing"
        ? success(snapshot(Object.freeze([]), locator.value, resource.value, null))
        : read;
    }
    return decode(read.value.bytes);
  };

  const serialize = (value: readonly EntityAlias[]): Result<AliasStoreSnapshot> => {
    const aliases = validatedAliases(value, bounds.maxAliases);
    if (!aliases.ok) return aliases;
    let bytes: Uint8Array;
    try {
      const frontmatter = stringify(
        {
          schema: aliasSchema,
          aliases: aliases.value.map((alias) => ({ source: alias.source, target: alias.target })),
        },
        { aliasDuplicateObjects: false, indent: 2, lineWidth: 0 },
      );
      bytes = textEncoder.encode(`---\n${frontmatter}---\n`);
    } catch {
      return failure(
        diagnostic("alias-store-serialization-failed", "Alias records could not be encoded"),
      );
    }
    if (bytes.byteLength > bounds.maxBytes) {
      return failure(
        diagnostic(
          "alias-store-byte-limit-exceeded",
          "Alias records exceed the configured byte limit",
          {
            maximum: bounds.maxBytes,
          },
        ),
      );
    }
    return decode(bytes);
  };

  return Object.freeze({ decode, load, serialize });
}
