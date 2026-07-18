import { createHash } from "node:crypto";
import { isAlias, parseDocument, visit } from "yaml";

import {
  failure,
  parseContentRevision,
  parseResourceKey,
  success,
  type ContentRevision,
  type Diagnostic,
  type GraphData,
  type ProposedTransaction,
  type ResourceKey,
  type Result,
} from "../core/index.ts";
import {
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalResourceProvider,
  type ResourceEntry,
  type WorkspaceResourceLocator,
} from "./contracts.ts";
import type {
  CanonicalResourceState,
  CanonicalTransactionAdapter,
  CanonicalTransactionMaterialization,
  CanonicalTransactionSnapshot,
  CanonicalTransactionTarget,
} from "./local-transaction-journal.ts";

export interface CanonicalMigrationResource extends CanonicalResourceState {
  readonly bytes: Uint8Array;
  readonly schema: string;
}

export interface CanonicalMigrationCatalogSnapshot {
  readonly resources: readonly CanonicalMigrationResource[];
}

export interface CanonicalMigrationCatalog {
  inspect(locator: string, bytes: Uint8Array): Result<{ readonly schema: string }>;
  load(): Promise<Result<CanonicalMigrationCatalogSnapshot>>;
}

export interface LocalCanonicalMigrationCatalogBounds {
  readonly maxDocumentBytes: number;
  readonly maxDocuments: number;
  readonly maxEntriesPerDirectory: number;
  readonly maxTotalBytes: number;
  readonly pageSize: number;
}

export interface LocalCanonicalMigrationCatalogOptions {
  readonly bounds?: Partial<LocalCanonicalMigrationCatalogBounds>;
  readonly resources: Pick<LocalResourceProvider, "enumerate" | "read">;
}

const defaultBounds: LocalCanonicalMigrationCatalogBounds = Object.freeze({
  maxDocumentBytes: 8 * 1024 * 1024,
  maxDocuments: 10_000,
  maxEntriesPerDirectory: 10_000,
  maxTotalBytes: 32 * 1024 * 1024,
  pageSize: 1_000,
});

const schemaPattern =
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?:\/[a-z0-9][a-z0-9.-]*)*\/v[0-9]+(?:\.[0-9]+)*$/;
const intentLocatorPattern = /^groma\/intent\/[0-9a-f]{2}\/ent_[0-9a-f]{32}\.md$/;
const intentShardLocatorPattern = /^groma\/intent\/[0-9a-f]{2}$/;
const evidenceSourceLocatorPattern = /^groma\/evidence\/sources\/[0-9a-f]{2}\/[0-9a-f]{64}\.md$/;
const evidenceShardLocatorPattern = /^groma\/evidence\/shards\/[0-9a-f]{2}\.md$/;
const bindingShardLocatorPattern = /^groma\/bindings\/shards\/[0-9a-f]{2}\.md$/;
const evidenceDirectoryLocatorPattern =
  /^groma\/evidence\/(?:sources|shards)$|^groma\/evidence\/sources\/[0-9a-f]{2}$/;
const bindingDirectoryLocatorPattern = /^groma\/bindings\/shards$/;
const pluginRecordLocatorPattern =
  /^groma\/records\/[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\/[a-z0-9][a-z0-9._-]*\.(?:json|md|ya?ml)$/;
const pluginRecordNamespaceLocatorPattern = /^groma\/records\/[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const utf8 = new TextDecoder("utf-8", { fatal: true });

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze(
    details === undefined
      ? { code, message }
      : { code, details: Object.freeze({ ...details }), message },
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseBounds(
  input: Partial<LocalCanonicalMigrationCatalogBounds> | undefined,
): LocalCanonicalMigrationCatalogBounds {
  const value = { ...defaultBounds, ...input };
  for (const key of Object.keys(defaultBounds) as (keyof LocalCanonicalMigrationCatalogBounds)[]) {
    if (!Number.isSafeInteger(value[key]) || value[key] <= 0) {
      throw new RangeError(`${key} must be a positive safe integer`);
    }
  }
  if (value.pageSize > value.maxDocuments || value.maxEntriesPerDirectory < value.pageSize) {
    throw new RangeError("migration catalog paging bounds are inconsistent");
  }
  return Object.freeze(value);
}

function isCanonicalLocator(locator: string): boolean {
  return (
    locator === "groma/groma.yaml" ||
    locator === "groma/aliases.md" ||
    locator === "groma/packages.lock" ||
    intentLocatorPattern.test(locator) ||
    evidenceSourceLocatorPattern.test(locator) ||
    evidenceShardLocatorPattern.test(locator) ||
    bindingShardLocatorPattern.test(locator) ||
    pluginRecordLocatorPattern.test(locator)
  );
}

function canonicalPlaneEntry(entry: ResourceEntry): Result<WorkspaceResourceLocator | undefined> {
  if (entry.kind === "file" && isCanonicalLocator(entry.locator)) return success(entry.locator);
  if (
    entry.kind === "directory" &&
    (intentShardLocatorPattern.test(entry.locator) ||
      evidenceDirectoryLocatorPattern.test(entry.locator) ||
      bindingDirectoryLocatorPattern.test(entry.locator) ||
      pluginRecordNamespaceLocatorPattern.test(entry.locator))
  ) {
    return success(undefined);
  }
  return failure(
    diagnostic(
      "migration-resource-layout-invalid",
      "Canonical migration resource has an unsupported kind or locator",
      { locator: entry.locator },
    ),
  );
}

function schemaFromBytes(locator: string, bytes: Uint8Array): Result<string> {
  let text: string;
  try {
    text = utf8.decode(bytes);
  } catch {
    return failure(
      diagnostic(
        "migration-resource-invalid-utf8",
        "Canonical migration resource is not valid UTF-8",
        {
          locator,
        },
      ),
    );
  }
  let schema: unknown;
  try {
    let source = text;
    if (locator.endsWith(".md")) {
      const lines = text.split("\n");
      if (lines[0] !== "---") throw new Error();
      const closing = lines.indexOf("---", 1);
      if (closing < 0) throw new Error();
      source = lines.slice(1, closing).join("\n");
    }
    const document = parseDocument(source, {
      logLevel: "silent",
      prettyErrors: false,
      schema: locator === "groma/packages.lock" || locator.endsWith(".json") ? "json" : "core",
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });
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
    if (unsupported || document.errors.length > 0 || document.warnings.length > 0) {
      throw new Error();
    }
    const parsed = document.toJS({ maxAliasCount: 0 }) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    schema = (parsed as Readonly<Record<string, unknown>>).schema;
  } catch {
    schema = undefined;
  }
  if (typeof schema !== "string" || !schemaPattern.test(schema) || schema.length > 128) {
    return failure(
      diagnostic(
        "migration-resource-schema-unavailable",
        "Canonical resource does not declare a supported bounded schema token",
        { locator },
      ),
    );
  }
  return success(schema);
}

function contentRevision(bytes: Uint8Array): ContentRevision {
  const parsed = parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  if (!parsed.ok) throw new Error("generated content revision is invalid");
  return parsed.value;
}

export function createLocalCanonicalMigrationCatalog(
  options: LocalCanonicalMigrationCatalogOptions,
): CanonicalMigrationCatalog {
  const limits = parseBounds(options.bounds);
  const exactLocators = [
    workspaceResourceLocator("groma", "groma.yaml"),
    workspaceResourceLocator("groma", "aliases.md"),
    workspaceResourceLocator("groma", "packages.lock"),
  ];
  const planeLocators = [
    { locator: workspaceResourceLocator("groma", "intent"), maxDepth: 1 },
    { locator: workspaceResourceLocator("groma", "records"), maxDepth: 1 },
    { locator: workspaceResourceLocator("groma", "evidence"), maxDepth: 3 },
    { locator: workspaceResourceLocator("groma", "bindings"), maxDepth: 2 },
  ];
  if (
    [...exactLocators, ...planeLocators.map((plane) => plane.locator)].some(
      (locator) => !locator.ok,
    )
  ) {
    throw new Error("built-in canonical locator is invalid");
  }
  const load = async (): Promise<Result<CanonicalMigrationCatalogSnapshot>> => {
    const locators: WorkspaceResourceLocator[] = [];
    const exactBytes = new Map<string, Uint8Array>();
    const addLocator = (locator: WorkspaceResourceLocator): Result<void> => {
      locators.push(locator);
      return locators.length <= limits.maxDocuments
        ? success(undefined)
        : failure(
            diagnostic(
              "migration-resource-limit-exceeded",
              "Canonical migration resource count exceeds its configured bound",
            ),
          );
    };
    for (const parsed of exactLocators) {
      if (!parsed.ok) throw new Error("built-in canonical locator is invalid");
      const read = await options.resources.read({
        locator: parsed.value,
        maxBytes: limits.maxDocumentBytes,
      });
      if (!read.ok) {
        if (read.diagnostics[0]?.code === "resource-missing") continue;
        return read;
      }
      exactBytes.set(parsed.value, read.value.bytes);
      const added = addLocator(parsed.value);
      if (!added.ok) return added;
    }
    for (const plane of planeLocators) {
      const parsed = plane.locator;
      if (!parsed.ok) throw new Error("built-in canonical locator is invalid");
      let cursor: Parameters<LocalResourceProvider["enumerate"]>[0]["cursor"];
      let receivedPage = false;
      let pageCount = 0;
      const maximumPages = limits.maxDocuments + limits.maxEntriesPerDirectory + 1;
      do {
        pageCount += 1;
        if (pageCount > maximumPages) {
          return failure(
            diagnostic(
              "migration-resource-provider-failure",
              "Canonical resource provider did not complete bounded enumeration",
            ),
          );
        }
        const enumerated = await options.resources.enumerate({
          ...(cursor === undefined ? {} : { cursor }),
          limit: limits.pageSize,
          locator: parsed.value,
          maxDepth: plane.maxDepth,
          maxEntriesPerDirectory: limits.maxEntriesPerDirectory,
        });
        if (!enumerated.ok) {
          if (!receivedPage && enumerated.diagnostics[0]?.code === "resource-missing") break;
          if (receivedPage && enumerated.diagnostics[0]?.code === "resource-missing") {
            return failure(
              diagnostic(
                "migration-resource-provider-failure",
                "Canonical resource provider lost a plane during enumeration",
              ),
            );
          }
          return enumerated;
        }
        receivedPage = true;
        if (enumerated.value.nextCursor !== undefined && enumerated.value.entries.length === 0) {
          return failure(
            diagnostic(
              "migration-resource-provider-failure",
              "Canonical resource provider returned a non-progressing enumeration page",
            ),
          );
        }
        if (enumerated.value.truncatedByDepth) {
          return failure(
            diagnostic(
              "migration-resource-enumeration-incomplete",
              "Canonical resource enumeration exceeded its depth bound",
            ),
          );
        }
        for (const entry of enumerated.value.entries) {
          const canonical = canonicalPlaneEntry(entry);
          if (!canonical.ok) return canonical;
          if (canonical.value !== undefined) {
            const added = addLocator(canonical.value);
            if (!added.ok) return added;
          }
        }
        cursor = enumerated.value.nextCursor;
      } while (cursor !== undefined);
    }
    locators.sort(compareText);
    for (let index = 1; index < locators.length; index += 1) {
      if (locators[index - 1] === locators[index]) {
        return failure(
          diagnostic(
            "migration-resource-enumeration-invalid",
            "Canonical resource enumeration returned a duplicate locator",
          ),
        );
      }
    }
    const loaded: CanonicalMigrationResource[] = [];
    let totalBytes = 0;
    for (const locator of locators) {
      const cached = exactBytes.get(locator);
      let source: Uint8Array;
      if (cached === undefined) {
        const read = await options.resources.read({ locator, maxBytes: limits.maxDocumentBytes });
        if (!read.ok) return read;
        source = read.value.bytes;
      } else {
        source = cached;
      }
      totalBytes += source.byteLength;
      if (totalBytes > limits.maxTotalBytes) {
        return failure(
          diagnostic(
            "migration-resource-limit-exceeded",
            "Canonical migration resources exceed their total byte bound",
          ),
        );
      }
      const schema = schemaFromBytes(locator, source);
      if (!schema.ok) return schema;
      const resource = parseResourceKey(locator);
      if (!resource.ok) return resource;
      const bytes = new Uint8Array(source);
      loaded.push(
        Object.freeze({
          bytes,
          locator,
          resource: resource.value,
          revision: contentRevision(bytes),
          schema: schema.value,
        }),
      );
    }
    return success(Object.freeze({ resources: Object.freeze(loaded) }));
  };
  const inspect = (locator: string, bytes: Uint8Array) => {
    const parsed = parseWorkspaceResourceLocator(locator);
    if (!parsed.ok || !isCanonicalLocator(locator)) {
      return failure(
        diagnostic(
          "migration-resource-locator-invalid",
          "Canonical migration resource locator is invalid",
        ),
      );
    }
    const schema = schemaFromBytes(locator, bytes);
    return schema.ok ? success(Object.freeze({ schema: schema.value })) : schema;
  };
  return Object.freeze({ inspect, load });
}

interface MigrationMutationTarget {
  readonly locator: string;
  readonly replacement: Uint8Array;
  readonly resource: string;
}

interface MigrationCatalogEntry {
  readonly resource: string;
  readonly revision: string;
}

export interface CanonicalMigrationTransactionAdapterBounds {
  readonly maxReplacementBytes: number;
  readonly maxTargetBytes: number;
  readonly maxTargets: number;
}

const defaultTransactionAdapterBounds: CanonicalMigrationTransactionAdapterBounds = Object.freeze({
  maxReplacementBytes: 8 * 1024 * 1024,
  maxTargetBytes: 8 * 1024 * 1024,
  maxTargets: 10_000,
});

function transactionAdapterBounds(
  input: Partial<CanonicalMigrationTransactionAdapterBounds> | undefined,
): CanonicalMigrationTransactionAdapterBounds {
  const selected = { ...defaultTransactionAdapterBounds, ...input };
  for (const [name, value] of Object.entries(selected)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive safe integer`);
    }
  }
  if (selected.maxTargetBytes < selected.maxReplacementBytes) {
    throw new RangeError("maxTargetBytes must be greater than or equal to maxReplacementBytes");
  }
  return Object.freeze(selected);
}

function migrationMutation(
  value: unknown,
  limits: CanonicalMigrationTransactionAdapterBounds,
): Result<{
  readonly catalog: readonly MigrationCatalogEntry[];
  readonly targets: readonly MigrationMutationTarget[];
}> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(
      diagnostic("invalid-migration-transaction", "Migration transaction is malformed"),
    );
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record.kind !== "canonical-schema-migration" ||
    !Array.isArray(record.catalog) ||
    !Array.isArray(record.targets)
  ) {
    return failure(
      diagnostic("invalid-migration-transaction", "Migration transaction is malformed"),
    );
  }
  if (
    record.catalog.length === 0 ||
    record.catalog.length > limits.maxTargets ||
    record.targets.length === 0 ||
    record.targets.length > limits.maxTargets
  ) {
    return failure(
      diagnostic("invalid-migration-transaction", "Migration transaction exceeds its bounds"),
    );
  }
  const catalog: MigrationCatalogEntry[] = [];
  for (const candidate of record.catalog) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      return failure(diagnostic("invalid-migration-transaction", "Migration catalog is malformed"));
    }
    const entry = candidate as Readonly<Record<string, unknown>>;
    const resource = parseResourceKey(entry.resource);
    const revision = parseContentRevision(entry.revision);
    if (
      Object.keys(entry).sort().join(",") !== "resource,revision" ||
      !resource.ok ||
      !revision.ok
    ) {
      return failure(diagnostic("invalid-migration-transaction", "Migration catalog is malformed"));
    }
    catalog.push(Object.freeze({ resource: resource.value, revision: revision.value }));
  }
  catalog.sort((left, right) => compareText(left.resource, right.resource));
  for (let index = 1; index < catalog.length; index += 1) {
    if (catalog[index - 1]!.resource === catalog[index]!.resource) {
      return failure(
        diagnostic("invalid-migration-transaction", "Migration catalog must be unique"),
      );
    }
  }
  const targets: MigrationMutationTarget[] = [];
  let replacementBytes = 0;
  const maximumEncodedTargetCharacters = Math.ceil(limits.maxTargetBytes / 3) * 4;
  for (let index = 0; index < record.targets.length; index += 1) {
    const candidate = record.targets[index];
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      return failure(diagnostic("invalid-migration-transaction", "Migration target is malformed"));
    }
    const target = candidate as Readonly<Record<string, unknown>>;
    if (
      Object.keys(target).sort().join(",") !== "locator,replacement,resource" ||
      typeof target.locator !== "string" ||
      typeof target.resource !== "string" ||
      typeof target.replacement !== "string" ||
      target.replacement.length === 0 ||
      target.replacement.length > maximumEncodedTargetCharacters
    ) {
      return failure(diagnostic("invalid-migration-transaction", "Migration target is malformed"));
    }
    const locator = parseWorkspaceResourceLocator(target.locator);
    const resource = parseResourceKey(target.resource);
    if (!locator.ok || !resource.ok || String(locator.value) !== String(resource.value)) {
      return failure(
        diagnostic("invalid-migration-transaction", "Migration target identity is invalid"),
      );
    }
    const bytes = Buffer.from(target.replacement, "base64url");
    replacementBytes += bytes.byteLength;
    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > limits.maxTargetBytes ||
      replacementBytes > limits.maxReplacementBytes ||
      bytes.toString("base64url") !== target.replacement
    ) {
      return failure(
        diagnostic("invalid-migration-transaction", "Migration replacement bytes are invalid"),
      );
    }
    targets.push(
      Object.freeze({
        locator: locator.value,
        replacement: new Uint8Array(bytes),
        resource: resource.value,
      }),
    );
  }
  targets.sort((left, right) => compareText(left.resource, right.resource));
  for (let index = 1; index < targets.length; index += 1) {
    if (targets[index - 1]!.resource === targets[index]!.resource) {
      return failure(
        diagnostic("invalid-migration-transaction", "Migration targets must be unique"),
      );
    }
  }
  return success(
    Object.freeze({ catalog: Object.freeze(catalog), targets: Object.freeze(targets) }),
  );
}

export function createCanonicalMigrationTransactionAdapter(
  catalog: CanonicalMigrationCatalog,
  bounds?: Partial<CanonicalMigrationTransactionAdapterBounds>,
): CanonicalTransactionAdapter {
  const limits = transactionAdapterBounds(bounds);
  const load = async () => {
    const loaded = await catalog.load();
    if (!loaded.ok) return loaded;
    const state: GraphData = Object.freeze({
      resources: Object.freeze(
        loaded.value.resources.map((entry) =>
          Object.freeze({ resource: entry.resource, revision: entry.revision }),
        ),
      ),
    });
    return success(
      Object.freeze({
        resources: Object.freeze(
          loaded.value.resources.map(({ locator, resource, revision }) =>
            Object.freeze({ locator, resource, revision }),
          ),
        ),
        state,
      }),
    );
  };
  const materialize = (
    proposal: ProposedTransaction,
    current: CanonicalTransactionSnapshot,
  ): Result<CanonicalTransactionMaterialization> => {
    const parsed = migrationMutation(proposal.mutation, limits);
    if (!parsed.ok) return parsed;
    const prior = proposal.priorState as Readonly<Record<string, unknown>>;
    const priorResources = Array.isArray(prior.resources) ? prior.resources : [];
    const priorCatalog = priorResources.map((entry) => {
      const record = entry as Readonly<Record<string, unknown>>;
      return `${String(record.resource)}\0${String(record.revision)}`;
    });
    const requestedCatalog = parsed.value.catalog.map(
      (entry) => `${entry.resource}\0${entry.revision}`,
    );
    const currentCatalog = current.resources.map((entry) => `${entry.resource}\0${entry.revision}`);
    if (
      priorCatalog.length !== requestedCatalog.length ||
      priorCatalog.some((entry, index) => entry !== requestedCatalog[index]) ||
      currentCatalog.length !== requestedCatalog.length ||
      currentCatalog.some((entry, index) => entry !== requestedCatalog[index])
    ) {
      return failure(
        diagnostic(
          "migration-resource-set-changed",
          "Canonical resources changed after migration planning",
        ),
      );
    }
    const expected = new Map(
      proposal.expectedRevisions.map((entry) => [entry.resource, entry.expected]),
    );
    if (
      parsed.value.targets.length !== expected.size ||
      expected.size !== parsed.value.catalog.length ||
      parsed.value.targets.length === 0 ||
      parsed.value.catalog.some(
        (entry) => expected.get(entry.resource as ResourceKey) !== entry.revision,
      )
    ) {
      return failure(
        diagnostic(
          "migration-resource-set-mismatch",
          "Migration must replace exactly its complete expected resource set",
        ),
      );
    }
    const targets: CanonicalTransactionTarget[] = [];
    for (const target of parsed.value.targets) {
      const expectedRevision = expected.get(target.resource as ResourceKey);
      if (expectedRevision === undefined) {
        return failure(
          diagnostic(
            "migration-resource-set-mismatch",
            "Migration must replace exactly its complete expected resource set",
          ),
        );
      }
      const replacement = new Uint8Array(target.replacement);
      targets.push(
        Object.freeze({
          expected: expectedRevision,
          locator: target.locator as WorkspaceResourceLocator,
          replacement,
          resource: target.resource as ResourceKey,
          result: contentRevision(replacement),
        }),
      );
    }
    return success(Object.freeze({ state: proposal.priorState, targets: Object.freeze(targets) }));
  };
  return Object.freeze({ load, materialize });
}
