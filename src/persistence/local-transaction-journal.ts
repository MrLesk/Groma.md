import { createHash } from "node:crypto";

import {
  failure,
  parseContentRevision,
  parseEntityId,
  parseRelationId,
  parseResourceKey,
  success,
  type AffectedGraphIdentities,
  type ContentRevision,
  type GraphData,
  type GraphEntity,
  type GraphRelation,
  type ProposedTransaction,
  type ResourceKey,
  type ResourceRevisionInput,
  type Result,
  type TransactionCommitResultInput,
  type TransactionPrepareResultInput,
  type TransactionProvider,
  type TransactionProviderSnapshotInput,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import {
  STANDARD_COMPONENT_KIND,
  type StandardModelCapability,
  type StandardModelTransactionMutation,
  type StandardModelTransactionState,
} from "../standard-model/index.ts";
import {
  markdownIntentLocator,
  type MarkdownIntentStore,
  type MarkdownIntentSnapshot,
} from "./markdown-intent-store.ts";
import {
  parseWorkspaceResourceLocator,
  workspaceResourceLocator,
  type LocalCoordinationLease,
  type LocalResourceProvider,
  type StagedReplacementHandle,
  type WorkspaceResourceLocator,
} from "./contracts.ts";

export type LocalTransactionFaultPhase =
  | "after-committing-state"
  | "after-prepared-state"
  | "after-settled-state"
  | "after-target"
  | "stage-target"
  | "before-settled-state";

export type LocalTransactionFaultInjector = (
  phase: LocalTransactionFaultPhase,
  targetIndex?: number,
) => void | Promise<void>;

export interface CanonicalResourceState {
  readonly locator: WorkspaceResourceLocator;
  readonly resource: ResourceKey;
  readonly revision: ContentRevision;
}

export interface CanonicalTransactionSnapshot {
  readonly resources: readonly CanonicalResourceState[];
  readonly state: GraphData;
}

export interface CanonicalTransactionTarget {
  readonly expected: ContentRevision | null;
  readonly locator: WorkspaceResourceLocator;
  readonly replacement?: Uint8Array;
  readonly resource: ResourceKey;
  readonly result: ContentRevision | null;
}

export interface CanonicalTransactionMaterialization {
  readonly state: GraphData;
  readonly targets: readonly CanonicalTransactionTarget[];
}

/** Persistence-local bridge from a semantic model to exact canonical resources. */
export interface CanonicalTransactionAdapter {
  load(): Promise<Result<CanonicalTransactionSnapshot>>;
  materialize(proposal: ProposedTransaction): Result<CanonicalTransactionMaterialization>;
}

export interface MarkdownIntentTransactionAdapterOptions {
  readonly model: StandardModelCapability;
  readonly store: MarkdownIntentStore;
}

export interface LocalTransactionJournalBounds {
  readonly maxJournalBytes: number;
  readonly maxReplacementBytes: number;
  readonly maxTargets: number;
}

export interface LocalTransactionJournalOptions {
  readonly adapter: CanonicalTransactionAdapter;
  readonly bounds?: Partial<LocalTransactionJournalBounds>;
  readonly faultInjector?: LocalTransactionFaultInjector;
  readonly resources: LocalResourceProvider;
}

interface StoredTarget {
  readonly expected: string | null;
  readonly locator: string;
  readonly replacement?: string;
  readonly resource: string;
  readonly result: string | null;
}

interface StoredCommittedSettlement {
  readonly affected: AffectedGraphIdentities;
  readonly generation: number;
  readonly outcome: "committed";
  readonly revisions: readonly { readonly resource: string; readonly revision: string | null }[];
  readonly token: string;
}

interface StoredNotCommittedSettlement {
  readonly outcome: "not-committed";
  readonly token: string;
}

type StoredSettlement = StoredCommittedSettlement | StoredNotCommittedSettlement;

interface IdleState {
  readonly generation: number;
  readonly phase: "idle";
  readonly projectionWatermark: number | null;
  readonly settlement: StoredSettlement | null;
  readonly version: 1;
}

interface PendingState {
  readonly affected: AffectedGraphIdentities;
  readonly baseGeneration: number;
  readonly generation: number;
  readonly phase: "committing" | "prepared";
  readonly projectionWatermark: number | null;
  readonly targets: readonly StoredTarget[];
  readonly token: string;
  readonly version: 1;
}

type JournalState = IdleState | PendingState;

interface LivePreparation {
  readonly handles: readonly (StagedReplacementHandle | undefined)[];
  readonly lease: LocalCoordinationLease;
}

const journalLocatorResult = workspaceResourceLocator("groma", "transaction-state.json");
if (!journalLocatorResult.ok) throw new Error("invalid built-in transaction-state locator");
export const localTransactionStateLocator = journalLocatorResult.value;

const coordinationLocatorResult = workspaceResourceLocator("groma");
if (!coordinationLocatorResult.ok)
  throw new Error("invalid built-in transaction coordination locator");
const transactionCoordinationLocator = coordinationLocatorResult.value;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const tokenPrefix = "groma-local-tx-v1:";
const tokenPattern = /^groma-local-tx-v1:[0-9a-f]{64}$/;
const defaultBounds: LocalTransactionJournalBounds = Object.freeze({
  maxJournalBytes: 16 * 1024 * 1024,
  maxReplacementBytes: 8 * 1024 * 1024,
  maxTargets: 10_000,
});
const absoluteBounds: LocalTransactionJournalBounds = Object.freeze({
  maxJournalBytes: 64 * 1024 * 1024,
  maxReplacementBytes: 48 * 1024 * 1024,
  maxTargets: 100_000,
});

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
) {
  return Object.freeze({ code, message, ...(details === undefined ? {} : { details }) });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function revision(bytes: Uint8Array): ContentRevision {
  const parsed = parseContentRevision(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  if (!parsed.ok) throw new Error("invalid internal SHA-256 revision");
  return parsed.value;
}

function resourceFromLocator(locator: WorkspaceResourceLocator): ResourceKey {
  const parsed = parseResourceKey(String(locator));
  if (!parsed.ok) throw new Error("portable locator was not accepted as a resource key");
  return parsed.value;
}

function bounds(input: Partial<LocalTransactionJournalBounds> | undefined) {
  const selected = { ...defaultBounds, ...input };
  for (const field of ["maxJournalBytes", "maxReplacementBytes", "maxTargets"] as const) {
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
  return Object.freeze(selected);
}

function stateFromSnapshot(snapshot: MarkdownIntentSnapshot): StandardModelTransactionState {
  const components = snapshot.entities
    .map((entity) => Object.freeze({ id: entity.id, kind: entity.kind, payload: entity.payload }))
    .sort((left, right) => compareText(left.id, right.id));
  const relationships = snapshot.relations
    .map((relation) =>
      Object.freeze({
        id: relation.id,
        payload: relation.payload,
        source: relation.source,
        target: relation.target,
        type: relation.type,
      }),
    )
    .sort((left, right) => compareText(left.id, right.id));
  return Object.freeze({
    components: Object.freeze(components),
    relationships: Object.freeze(relationships),
  });
}

function graphFromPriorState(
  priorState: GraphData,
  model: StandardModelCapability,
): Result<{ components: Map<string, GraphEntity>; relationships: Map<string, GraphRelation> }> {
  if (typeof priorState !== "object" || priorState === null || Array.isArray(priorState)) {
    return failure(
      diagnostic("invalid-canonical-transaction-state", "Prior state must be a record"),
    );
  }
  const priorRecord = priorState as Readonly<Record<string, GraphData>>;
  const componentsInput = priorRecord.components;
  const relationshipsInput = priorRecord.relationships;
  if (!Array.isArray(componentsInput) || !Array.isArray(relationshipsInput)) {
    return failure(
      diagnostic(
        "invalid-canonical-transaction-state",
        "Prior state must contain component and relationship arrays",
      ),
    );
  }
  const components = new Map<string, GraphEntity>();
  for (const value of componentsInput) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return failure(
        diagnostic("invalid-canonical-transaction-state", "Component state is malformed"),
      );
    }
    const id = parseEntityId(value.id);
    if (!id.ok || value.kind !== STANDARD_COMPONENT_KIND) {
      return failure(
        diagnostic(
          "invalid-canonical-transaction-state",
          "Component state has invalid identity or kind",
        ),
      );
    }
    const payload = copyGraphPayload(value.payload, "entity");
    if (!payload.ok) return payload;
    const entity: GraphEntity = {
      id: id.value,
      kind: STANDARD_COMPONENT_KIND,
      payload: payload.value,
    };
    const parsed = model.parse(entity);
    if (!parsed.ok) return parsed;
    components.set(id.value, Object.freeze(entity));
  }
  const relationships = new Map<string, GraphRelation>();
  for (const value of relationshipsInput) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return failure(
        diagnostic("invalid-canonical-transaction-state", "Relationship state is malformed"),
      );
    }
    const id = parseRelationId(value.id);
    const source = parseEntityId(value.source);
    const target = parseEntityId(value.target);
    if (!id.ok || !source.ok || !target.ok || typeof value.type !== "string") {
      return failure(
        diagnostic("invalid-canonical-transaction-state", "Relationship state is malformed"),
      );
    }
    const payload = copyGraphPayload(value.payload, "relation");
    if (!payload.ok) return payload;
    const relation: GraphRelation = Object.freeze({
      id: id.value,
      payload: payload.value,
      source: source.value,
      target: target.value,
      type: value.type,
    });
    const parsed = model.relationships([relation]);
    if (!parsed.ok) return parsed;
    relationships.set(id.value, relation);
  }
  return success({ components, relationships });
}

function applyStandardMutation(
  proposal: ProposedTransaction,
  model: StandardModelCapability,
): Result<{
  components: Map<string, GraphEntity>;
  relationships: Map<string, GraphRelation>;
  touchedComponents: ReadonlySet<string>;
}> {
  const graph = graphFromPriorState(proposal.priorState, model);
  if (!graph.ok) return graph;
  const mutation = proposal.mutation as StandardModelTransactionMutation;
  if (!Array.isArray(mutation.components) || !Array.isArray(mutation.relationships)) {
    return failure(
      diagnostic("invalid-canonical-transaction-mutation", "Standard Model mutation is malformed"),
    );
  }
  const touched = new Set<string>();
  for (const entry of mutation.components) {
    if (entry.type === "create") {
      const normalized = model.normalize(entry.component);
      if (!normalized.ok) return normalized;
      if (normalized.value.id === undefined) {
        return failure(
          diagnostic(
            "invalid-canonical-transaction-mutation",
            "Created Standard Model components require a stable identity",
          ),
        );
      }
      const id = parseEntityId(normalized.value.id);
      if (!id.ok) return id;
      const payload = copyGraphPayload(normalized.value.payload, "entity");
      if (!payload.ok) return payload;
      graph.value.components.set(
        id.value,
        Object.freeze({ id: id.value, kind: normalized.value.kind, payload: payload.value }),
      );
      touched.add(id.value);
    } else if (entry.type === "patch") {
      const id = parseEntityId(entry.id);
      if (!id.ok) return id;
      const existing = graph.value.components.get(id.value);
      if (existing === undefined) {
        return failure(
          diagnostic("unknown-component-mutation-target", "Component patch target is missing"),
        );
      }
      const patched = model.patch(existing, entry.patch);
      if (!patched.ok) return patched;
      const payload = copyGraphPayload(patched.value.payload, "entity");
      if (!payload.ok) return payload;
      graph.value.components.set(
        id.value,
        Object.freeze({ id: id.value, kind: patched.value.kind, payload: payload.value }),
      );
      touched.add(id.value);
    } else if (entry.type === "remove") {
      const id = parseEntityId(entry.id);
      if (!id.ok) return id;
      graph.value.components.delete(id.value);
      touched.add(id.value);
    } else {
      return failure(
        diagnostic(
          "invalid-canonical-transaction-mutation",
          "Component mutation type is unsupported",
        ),
      );
    }
  }
  for (const entry of mutation.relationships) {
    if (entry.type === "upsert") {
      const input = entry.relationship;
      const id = parseRelationId(input.id);
      const source = parseEntityId(input.source);
      const target = parseEntityId(input.target);
      if (!id.ok || !source.ok || !target.ok) {
        return failure(
          diagnostic(
            "invalid-canonical-transaction-mutation",
            "Relationship mutation identity is invalid",
          ),
        );
      }
      const prior = graph.value.relationships.get(id.value);
      if (prior !== undefined) touched.add(prior.source);
      const relation = Object.freeze({
        id: id.value,
        payload: input.payload,
        source: source.value,
        target: target.value,
        type: input.type,
      });
      const parsed = model.relationships([relation]);
      if (!parsed.ok) return parsed;
      graph.value.relationships.set(id.value, relation);
      touched.add(source.value);
    } else if (entry.type === "remove") {
      const id = parseRelationId(entry.id);
      if (!id.ok) return id;
      const prior = graph.value.relationships.get(id.value);
      if (prior === undefined) {
        return failure(
          diagnostic(
            "unknown-relationship-mutation-target",
            "Relationship removal target is missing",
          ),
        );
      }
      touched.add(prior.source);
      graph.value.relationships.delete(id.value);
    } else {
      return failure(
        diagnostic(
          "invalid-canonical-transaction-mutation",
          "Relationship mutation type is unsupported",
        ),
      );
    }
  }
  return success({ ...graph.value, touchedComponents: touched });
}

export function createMarkdownIntentTransactionAdapter(
  options: MarkdownIntentTransactionAdapterOptions,
): CanonicalTransactionAdapter {
  const load = async (): Promise<Result<CanonicalTransactionSnapshot>> => {
    const loaded = await options.store.load();
    if (!loaded.ok) return loaded;
    const resources = loaded.value.documents
      .map((document) =>
        Object.freeze({
          locator: document.locator,
          resource: document.resource,
          revision: document.revision,
        }),
      )
      .sort((left, right) => compareText(left.resource, right.resource));
    return success(
      Object.freeze({
        resources: Object.freeze(resources),
        state: stateFromSnapshot(loaded.value),
      }),
    );
  };

  const materialize = (
    proposal: ProposedTransaction,
  ): Result<CanonicalTransactionMaterialization> => {
    const applied = applyStandardMutation(proposal, options.model);
    if (!applied.ok) return applied;
    const expected = new Map<string, ContentRevision | null>();
    for (const entry of proposal.expectedRevisions) expected.set(entry.resource, entry.expected);
    const targets: CanonicalTransactionTarget[] = [];
    const touched = Array.from(applied.value.touchedComponents).sort(compareText);
    for (const idText of touched) {
      const id = parseEntityId(idText);
      if (!id.ok) return id;
      const locator = markdownIntentLocator(id.value);
      if (!locator.ok) return locator;
      const resource = resourceFromLocator(locator.value);
      if (!expected.has(resource)) {
        return failure(
          diagnostic(
            "transaction-resource-set-mismatch",
            "Every changed canonical document must have an expected revision",
            { resource },
          ),
        );
      }
      const entity = applied.value.components.get(id.value);
      if (entity === undefined) {
        targets.push(
          Object.freeze({
            expected: expected.get(resource)!,
            locator: locator.value,
            resource,
            result: null,
          }),
        );
        continue;
      }
      const ownedRelations = Array.from(applied.value.relationships.values())
        .filter((relation) => relation.source === id.value)
        .sort((left, right) => compareText(left.id, right.id));
      const document = options.store.serialize(entity, ownedRelations);
      if (!document.ok) return document;
      targets.push(
        Object.freeze({
          expected: expected.get(resource)!,
          locator: locator.value,
          replacement: document.value.bytes,
          resource,
          result: document.value.revision,
        }),
      );
    }
    if (targets.length !== expected.size) {
      return failure(
        diagnostic(
          "transaction-resource-set-mismatch",
          "Expected revisions must identify exactly the canonical documents changed by the mutation",
        ),
      );
    }
    const components = Array.from(applied.value.components.values())
      .sort((left, right) => compareText(left.id, right.id))
      .map((entity) =>
        Object.freeze({ id: entity.id, kind: entity.kind, payload: entity.payload }),
      );
    const relationships = Array.from(applied.value.relationships.values())
      .sort((left, right) => compareText(left.id, right.id))
      .map((relation) =>
        Object.freeze({
          id: relation.id,
          payload: relation.payload,
          source: relation.source,
          target: relation.target,
          type: relation.type,
        }),
      );
    return success(
      Object.freeze({
        state: Object.freeze({
          components: Object.freeze(components),
          relationships: Object.freeze(relationships),
        }),
        targets: Object.freeze(targets),
      }),
    );
  };
  return Object.freeze({ load, materialize });
}

function initialState(): IdleState {
  return Object.freeze({
    generation: 0,
    phase: "idle",
    projectionWatermark: null,
    settlement: null,
    version: 1,
  });
}

function encodeState(state: JournalState): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(state)}\n`);
}

function isSafeGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseAffected(value: unknown): AffectedGraphIdentities | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, unknown>>;
  if (!Array.isArray(record.entities) || !Array.isArray(record.relations)) return undefined;
  const entities = record.entities.filter(
    (entry: unknown): entry is string => typeof entry === "string",
  );
  const relations = record.relations.filter(
    (entry: unknown): entry is string => typeof entry === "string",
  );
  if (entities.length !== record.entities.length || relations.length !== record.relations.length)
    return undefined;
  if (
    entities.some(
      (entry, index) => !parseEntityId(entry).ok || (index > 0 && entities[index - 1]! >= entry),
    ) ||
    relations.some(
      (entry, index) => !parseRelationId(entry).ok || (index > 0 && relations[index - 1]! >= entry),
    )
  )
    return undefined;
  return Object.freeze({
    entities: Object.freeze(entities) as AffectedGraphIdentities["entities"],
    relations: Object.freeze(relations) as AffectedGraphIdentities["relations"],
  });
}

function parseStoredTargets(
  value: unknown,
  limits: LocalTransactionJournalBounds,
): readonly StoredTarget[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > limits.maxTargets)
    return undefined;
  const targets: StoredTarget[] = [];
  let replacementBytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const candidate = value[index];
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
      return undefined;
    const target = candidate as Readonly<Record<string, unknown>>;
    const keys = Object.keys(target).sort();
    const replacementPresent = Object.hasOwn(target, "replacement");
    const expectedKeys = replacementPresent
      ? ["expected", "locator", "replacement", "resource", "result"]
      : ["expected", "locator", "resource", "result"];
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) return undefined;
    const locator = parseWorkspaceResourceLocator(target.locator);
    const resource = parseResourceKey(target.resource);
    if (!locator.ok || !resource.ok || String(resource.value) !== String(locator.value))
      return undefined;
    const expected = target.expected === null ? null : parseContentRevision(target.expected);
    const result = target.result === null ? null : parseContentRevision(target.result);
    if ((expected !== null && !expected.ok) || (result !== null && !result.ok)) return undefined;
    if (
      replacementPresent !== (result !== null) ||
      (replacementPresent && typeof target.replacement !== "string")
    )
      return undefined;
    if (replacementPresent) {
      const decoded = Buffer.from(target.replacement as string, "base64url");
      if (decoded.toString("base64url") !== target.replacement) return undefined;
      replacementBytes += decoded.byteLength;
      if (replacementBytes > limits.maxReplacementBytes) return undefined;
      if (revision(decoded) !== result!.value) return undefined;
    }
    if (index > 0 && String(targets[index - 1]!.resource) >= String(resource.value))
      return undefined;
    targets.push(
      Object.freeze({
        expected: expected === null ? null : expected.value,
        locator: locator.value,
        ...(replacementPresent ? { replacement: target.replacement as string } : {}),
        resource: resource.value,
        result: result === null ? null : result.value,
      }),
    );
  }
  return Object.freeze(targets);
}

function parseSettlement(
  value: unknown,
  limits: LocalTransactionJournalBounds,
): StoredSettlement | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record.outcome === "not-committed" &&
    typeof record.token === "string" &&
    tokenPattern.test(record.token)
  ) {
    if (Object.keys(record).sort().join(",") !== "outcome,token") return undefined;
    return Object.freeze({ outcome: "not-committed", token: record.token });
  }
  if (
    record.outcome !== "committed" ||
    typeof record.token !== "string" ||
    !tokenPattern.test(record.token) ||
    !isSafeGeneration(record.generation) ||
    !Array.isArray(record.revisions) ||
    record.revisions.length === 0 ||
    record.revisions.length > limits.maxTargets
  )
    return undefined;
  const affected = parseAffected(record.affected);
  if (affected === undefined) return undefined;
  const revisions: { resource: string; revision: string | null }[] = [];
  for (const candidate of record.revisions) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
      return undefined;
    const item = candidate as Readonly<Record<string, unknown>>;
    const resource = parseResourceKey(item.resource);
    const parsedRevision = item.revision === null ? null : parseContentRevision(item.revision);
    if (!resource.ok || (parsedRevision !== null && !parsedRevision.ok)) return undefined;
    if (Object.keys(item).sort().join(",") !== "resource,revision") return undefined;
    if (revisions.length > 0 && revisions[revisions.length - 1]!.resource >= resource.value) {
      return undefined;
    }
    revisions.push(
      Object.freeze({
        resource: resource.value,
        revision: parsedRevision === null ? null : parsedRevision.value,
      }),
    );
  }
  return Object.freeze({
    affected,
    generation: record.generation,
    outcome: "committed",
    revisions: Object.freeze(revisions),
    token: record.token,
  });
}

function parseState(
  bytes: Uint8Array,
  limits: LocalTransactionJournalBounds,
): Result<JournalState> {
  if (bytes.byteLength > limits.maxJournalBytes) {
    return failure(
      diagnostic("transaction-journal-too-large", "Transaction state exceeds its byte bound"),
    );
  }
  try {
    const decoded = JSON.parse(textDecoder.decode(bytes)) as unknown;
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded))
      throw new Error();
    const value = decoded as Readonly<Record<string, unknown>>;
    if (value.version !== 1) throw new Error();
    if (value.phase === "idle") {
      if (!isSafeGeneration(value.generation)) throw new Error();
      if (
        value.projectionWatermark !== null &&
        (!isSafeGeneration(value.projectionWatermark) ||
          value.projectionWatermark > value.generation)
      )
        throw new Error();
      const settlement = parseSettlement(value.settlement, limits);
      if (settlement === undefined) throw new Error();
      if (settlement?.outcome === "committed" && settlement.generation !== value.generation) {
        throw new Error();
      }
      const state: IdleState = Object.freeze({
        generation: value.generation,
        phase: "idle",
        projectionWatermark: value.projectionWatermark,
        settlement,
        version: 1,
      });
      if (!Buffer.from(encodeState(state)).equals(Buffer.from(bytes))) throw new Error();
      return success(state);
    }
    if (value.phase !== "prepared" && value.phase !== "committing") throw new Error();
    if (
      !isSafeGeneration(value.baseGeneration) ||
      !isSafeGeneration(value.generation) ||
      value.generation !== value.baseGeneration + 1 ||
      typeof value.token !== "string" ||
      !tokenPattern.test(value.token)
    )
      throw new Error();
    if (
      value.projectionWatermark !== null &&
      (!isSafeGeneration(value.projectionWatermark) ||
        value.projectionWatermark > value.baseGeneration)
    )
      throw new Error();
    const affected = parseAffected(value.affected);
    const targets = parseStoredTargets(value.targets, limits);
    if (affected === undefined || targets === undefined) throw new Error();
    if (tokenFor(value.baseGeneration, value.generation, affected, targets) !== value.token) {
      throw new Error();
    }
    const state: PendingState = Object.freeze({
      affected,
      baseGeneration: value.baseGeneration,
      generation: value.generation,
      phase: value.phase,
      projectionWatermark: value.projectionWatermark,
      targets,
      token: value.token,
      version: 1,
    });
    if (!Buffer.from(encodeState(state)).equals(Buffer.from(bytes))) throw new Error();
    return success(state);
  } catch {
    return failure(
      diagnostic("malformed-transaction-journal", "Transaction state is malformed or noncanonical"),
    );
  }
}

function storedTargets(materialized: CanonicalTransactionMaterialization): readonly StoredTarget[] {
  const sorted = materialized.targets
    .map((target) => {
      const copied =
        target.replacement === undefined ? undefined : new Uint8Array(target.replacement);
      if ((copied === undefined) !== (target.result === null)) {
        throw new Error("canonical transaction target result does not match its operation");
      }
      if (String(target.resource) !== String(target.locator)) {
        throw new Error("canonical transaction resource and locator must match");
      }
      if (copied !== undefined && revision(copied) !== target.result) {
        throw new Error("canonical transaction replacement revision does not match its bytes");
      }
      return Object.freeze({
        expected: target.expected,
        locator: target.locator,
        ...(copied === undefined ? {} : { replacement: Buffer.from(copied).toString("base64url") }),
        resource: target.resource,
        result: target.result,
      });
    })
    .sort((left, right) => compareText(left.resource, right.resource));
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]!.resource === sorted[index]!.resource) {
      throw new Error("canonical transaction resources must be unique");
    }
  }
  return Object.freeze(sorted);
}

function verifyExpectedTargets(
  proposal: ProposedTransaction,
  targets: readonly StoredTarget[],
): void {
  const expected = Array.from(proposal.expectedRevisions).sort((left, right) =>
    compareText(left.resource, right.resource),
  );
  if (expected.length !== targets.length) {
    throw new Error(
      "Canonical transaction targets must exactly match the proposed expected revisions",
    );
  }
  for (let index = 0; index < expected.length; index += 1) {
    const proposalEntry = expected[index]!;
    const target = targets[index]!;
    if (
      (index > 0 && expected[index - 1]!.resource === proposalEntry.resource) ||
      proposalEntry.resource !== target.resource ||
      proposalEntry.expected !== target.expected
    ) {
      throw new Error(
        "Canonical transaction targets must exactly match the proposed expected revisions",
      );
    }
  }
}

function tokenFor(
  baseGeneration: number,
  generation: number,
  affected: AffectedGraphIdentities,
  targets: readonly StoredTarget[],
): string {
  const evidence = JSON.stringify({ affected, baseGeneration, generation, targets, version: 1 });
  return `${tokenPrefix}${createHash("sha256").update(evidence).digest("hex")}`;
}

export function createLocalTransactionJournal(
  options: LocalTransactionJournalOptions,
): TransactionProvider {
  const limits = bounds(options.bounds);
  const live = new Map<string, LivePreparation>();
  const readExact = async (locator: WorkspaceResourceLocator, maximum = limits.maxJournalBytes) => {
    const read = await options.resources.read({ locator, maxBytes: maximum });
    if (!read.ok) {
      if (read.diagnostics[0]?.code === "resource-missing")
        return { bytes: undefined, revision: null } as const;
      if (
        locator === localTransactionStateLocator &&
        read.diagnostics[0]?.code === "resource-too-large"
      ) {
        throw new Error("Transaction state exceeds its byte bound");
      }
      throw new Error(read.diagnostics[0]?.message ?? "resource read failed");
    }
    return { bytes: read.value.bytes, revision: revision(read.value.bytes) } as const;
  };
  const readState = async (): Promise<JournalState> => {
    const read = await readExact(localTransactionStateLocator);
    if (read.bytes === undefined) return initialState();
    const parsed = parseState(read.bytes, limits);
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
    return parsed.value;
  };
  const writeState = async (state: JournalState): Promise<void> => {
    const bytes = encodeState(state);
    if (bytes.byteLength > limits.maxJournalBytes)
      throw new Error("transaction journal exceeds bound");
    const cleaned = await options.resources.cleanupReplacementStages(localTransactionStateLocator);
    if (!cleaned.ok && cleaned.diagnostics[0]?.code !== "resource-missing") {
      throw new Error(cleaned.diagnostics[0]?.message);
    }
    const staged = await options.resources.stageReplacement(localTransactionStateLocator, bytes);
    if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
    const committed = await options.resources.commitReplacement(staged.value);
    if (committed.state === "not-committed")
      throw new Error("transaction journal was not committed");
    if (committed.state === "committed-indeterminate") {
      const readback = await readExact(localTransactionStateLocator);
      if (readback.bytes === undefined || !Buffer.from(readback.bytes).equals(Buffer.from(bytes))) {
        throw new Error("transaction journal commit is indeterminate");
      }
    }
  };
  const release = async (token: string, lease: LocalCoordinationLease): Promise<boolean> => {
    const released = await options.resources.releaseCoordination(lease);
    live.delete(token);
    return released.ok;
  };
  const discardLiveStages = async (token: string, state: PendingState): Promise<void> => {
    const preparation = live.get(token);
    if (preparation !== undefined) {
      for (const handle of preparation.handles) {
        if (handle !== undefined) {
          const discarded = await options.resources.discardReplacement(handle);
          if (!discarded.ok) throw new Error(discarded.diagnostics[0]?.message);
        }
      }
    }
    for (const target of state.targets) {
      const locator = parseWorkspaceResourceLocator(target.locator);
      if (!locator.ok) throw new Error(locator.diagnostics[0]?.message);
      const cleaned = await options.resources.cleanupReplacementStages(locator.value);
      if (!cleaned.ok && cleaned.diagnostics[0]?.code !== "resource-missing") {
        throw new Error(cleaned.diagnostics[0]?.message);
      }
    }
  };
  const settlementResult = (settlement: StoredSettlement): TransactionCommitResultInput => {
    if (settlement.outcome === "not-committed") return Object.freeze({ status: "not-committed" });
    return Object.freeze({
      affected: settlement.affected,
      generation: settlement.generation,
      revisions: settlement.revisions,
      status: "committed",
    });
  };
  const rollback = async (state: PendingState): Promise<TransactionCommitResultInput> => {
    await discardLiveStages(state.token, state);
    const idle: IdleState = Object.freeze({
      generation: state.baseGeneration,
      phase: "idle",
      projectionWatermark: state.projectionWatermark,
      settlement: Object.freeze({ outcome: "not-committed", token: state.token }),
      version: 1,
    });
    await writeState(idle);
    return Object.freeze({ status: "not-committed" });
  };
  const applyTarget = async (
    target: StoredTarget,
    handle?: StagedReplacementHandle,
  ): Promise<boolean> => {
    const locator = parseWorkspaceResourceLocator(target.locator);
    if (!locator.ok) return false;
    const current = await readExact(locator.value, limits.maxReplacementBytes);
    if (current.revision !== target.result && current.revision !== target.expected) return false;
    if (target.replacement === undefined) {
      let removed = await options.resources.removeResource(locator.value);
      if (removed.state === "committed-indeterminate") {
        removed = await options.resources.removeResource(locator.value);
      }
      if (removed.state !== "committed") return false;
    } else {
      if (current.revision === target.result && handle === undefined) return true;
      let staged = handle;
      if (staged === undefined) {
        const bytes = Buffer.from(target.replacement, "base64url");
        const created = await options.resources.stageReplacement(locator.value, bytes);
        if (!created.ok) return false;
        staged = created.value;
      }
      let committed = await options.resources.commitReplacement(staged);
      if (committed.state === "committed-indeterminate") {
        committed = await options.resources.commitReplacement(staged);
      }
      if (committed.state !== "committed") return false;
    }
    return (await readExact(locator.value, limits.maxReplacementBytes)).revision === target.result;
  };
  const rollForward = async (state: PendingState): Promise<TransactionCommitResultInput> => {
    const preparation = live.get(state.token);
    for (let index = 0; index < state.targets.length; index += 1) {
      if (!(await applyTarget(state.targets[index]!, preparation?.handles[index]))) {
        return Object.freeze({ status: "indeterminate" });
      }
      await options.faultInjector?.("after-target", index);
    }
    await options.faultInjector?.("before-settled-state");
    await discardLiveStages(state.token, state);
    const revisions = Object.freeze(
      state.targets.map((target) =>
        Object.freeze({ resource: target.resource, revision: target.result }),
      ),
    );
    const settlement: StoredCommittedSettlement = Object.freeze({
      affected: state.affected,
      generation: state.generation,
      outcome: "committed",
      revisions,
      token: state.token,
    });
    const idle: IdleState = Object.freeze({
      generation: state.generation,
      phase: "idle",
      projectionWatermark: state.projectionWatermark,
      settlement,
      version: 1,
    });
    await writeState(idle);
    await options.faultInjector?.("after-settled-state");
    return settlementResult(settlement);
  };
  const settle = async (
    token: string | undefined,
  ): Promise<TransactionCommitResultInput | undefined> => {
    const state = await readState();
    if (state.phase === "idle") {
      return token !== undefined && state.settlement?.token === token
        ? settlementResult(state.settlement)
        : undefined;
    }
    if (token !== undefined && state.token !== token)
      return Object.freeze({ status: "indeterminate" });
    if (state.phase === "prepared") return rollback(state);
    return rollForward(state);
  };

  const snapshot = async (
    requested: readonly ResourceKey[],
  ): Promise<TransactionProviderSnapshotInput> => {
    const acquired = await options.resources.acquireCoordination({
      context: "local-machine",
      locator: transactionCoordinationLocator,
    });
    if (!acquired.ok) throw new Error(acquired.diagnostics[0]?.message);
    try {
      const settled = await settle(undefined);
      if (settled?.status === "indeterminate")
        throw new Error("interrupted transaction cannot be settled");
      const state = await readState();
      if (state.phase !== "idle") throw new Error("transaction state did not settle");
      const loaded = await options.adapter.load();
      if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.message);
      const current = new Map(
        loaded.value.resources.map((entry) => [entry.resource, entry.revision]),
      );
      const revisions: ResourceRevisionInput[] = requested.map((resource) =>
        Object.freeze({ resource, revision: current.get(resource) ?? null }),
      );
      return Object.freeze({
        generation: state.generation,
        revisions: Object.freeze(revisions),
        state: loaded.value.state,
      });
    } finally {
      const released = await options.resources.releaseCoordination(acquired.value);
      if (!released.ok) throw new Error(released.diagnostics[0]?.message);
    }
  };

  const prepare = async (proposal: ProposedTransaction): Promise<TransactionPrepareResultInput> => {
    const acquired = await options.resources.acquireCoordination({
      context: "local-machine",
      locator: transactionCoordinationLocator,
    });
    if (!acquired.ok) return Object.freeze({ reason: "generation", status: "conflict" });
    let token: string | undefined;
    try {
      const prior = await settle(undefined);
      if (prior?.status === "indeterminate") throw new Error("prior transaction is indeterminate");
      const state = await readState();
      if (state.phase !== "idle" || state.generation !== proposal.baseGeneration) {
        const released = await options.resources.releaseCoordination(acquired.value);
        if (!released.ok) throw new Error(released.diagnostics[0]?.message);
        return Object.freeze({ reason: "generation", status: "conflict" });
      }
      const loaded = await options.adapter.load();
      if (!loaded.ok) throw new Error(loaded.diagnostics[0]?.message);
      const current = new Map(
        loaded.value.resources.map((entry) => [entry.resource, entry.revision]),
      );
      for (const expected of proposal.expectedRevisions) {
        if ((current.get(expected.resource) ?? null) !== expected.expected) {
          const released = await options.resources.releaseCoordination(acquired.value);
          if (!released.ok) throw new Error(released.diagnostics[0]?.message);
          return Object.freeze({ reason: "revision", status: "conflict" });
        }
      }
      const materialized = options.adapter.materialize(proposal);
      if (!materialized.ok) throw new Error(materialized.diagnostics[0]?.message);
      if (
        materialized.value.targets.length === 0 ||
        materialized.value.targets.length > limits.maxTargets
      )
        throw new Error("transaction target count exceeds bound");
      let total = 0;
      for (const target of materialized.value.targets) {
        total += target.replacement?.byteLength ?? 0;
        if (total > limits.maxReplacementBytes)
          throw new Error("transaction replacement bytes exceed bound");
      }
      const targets = storedTargets(materialized.value);
      verifyExpectedTargets(proposal, targets);
      token = tokenFor(proposal.baseGeneration, proposal.generation, proposal.affected, targets);
      const pending: PendingState = Object.freeze({
        affected: proposal.affected,
        baseGeneration: proposal.baseGeneration,
        generation: proposal.generation,
        phase: "prepared",
        projectionWatermark: state.projectionWatermark,
        targets,
        token,
        version: 1,
      });
      await writeState(pending);
      await options.faultInjector?.("after-prepared-state");
      const handles: (StagedReplacementHandle | undefined)[] = [];
      live.set(token, { handles, lease: acquired.value });
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index]!;
        if (target.replacement === undefined) {
          handles.push(undefined);
          continue;
        }
        const locator = parseWorkspaceResourceLocator(target.locator);
        if (!locator.ok) throw new Error("stored locator became invalid");
        const staged = await options.resources.stageReplacement(
          locator.value,
          Buffer.from(target.replacement, "base64url"),
        );
        if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
        handles.push(staged.value);
        await options.faultInjector?.("stage-target", index);
      }
      return Object.freeze({ status: "prepared", token });
    } catch {
      if (token !== undefined) {
        try {
          const state = await readState();
          if (state.phase === "prepared" && state.token === token) await rollback(state);
        } catch {
          // A later snapshot/recovery will deterministically roll back the prepared record.
        }
      }
      const released = await options.resources.releaseCoordination(acquired.value);
      if (!released.ok)
        throw new Error("local transaction preparation could not release coordination");
      throw new Error("local transaction preparation failed");
    }
  };

  const finish = async (
    token: string,
    recovery: boolean,
  ): Promise<TransactionCommitResultInput> => {
    let preparation = live.get(token);
    let lease = preparation?.lease;
    if (lease === undefined) {
      const acquired = await options.resources.acquireCoordination({
        context: "local-machine",
        locator: transactionCoordinationLocator,
      });
      if (!acquired.ok) return Object.freeze({ status: "indeterminate" });
      lease = acquired.value;
    }
    let result: TransactionCommitResultInput;
    try {
      let state = await readState();
      if (state.phase === "idle") {
        result =
          state.settlement?.token === token
            ? settlementResult(state.settlement)
            : Object.freeze({ status: "indeterminate" });
      } else if (state.token !== token) {
        result = Object.freeze({ status: "indeterminate" });
      } else if (recovery && state.phase === "prepared") {
        result = await rollback(state);
      } else {
        if (state.phase === "prepared") {
          state = Object.freeze({ ...state, phase: "committing" });
          await writeState(state);
          await options.faultInjector?.("after-committing-state");
        }
        result = await rollForward(state);
      }
    } catch {
      try {
        const observed = await readState();
        if (observed.phase === "prepared" && observed.token === token) {
          result = await rollback(observed);
        } else if (observed.phase === "committing" && observed.token === token) {
          result = Object.freeze({ status: "indeterminate" });
        } else if (observed.phase === "idle" && observed.settlement?.token === token) {
          result = settlementResult(observed.settlement);
        } else {
          result = Object.freeze({ status: "indeterminate" });
        }
      } catch {
        // Unknown or divergent durable state stays indeterminate.
        result = Object.freeze({ status: "indeterminate" });
      }
    }
    if (result.status === "indeterminate") {
      try {
        const observed = await readState();
        if (observed.phase !== "idle" && observed.token === token) {
          await discardLiveStages(token, observed);
        }
      } catch {
        // The pending journal retains target locators for a later cleanup retry.
      }
    }
    if (!(await release(token, lease))) return Object.freeze({ status: "indeterminate" });
    return result;
  };

  return Object.freeze({
    commit: (token: string) => finish(token, false),
    prepare,
    recover: (token: string) => finish(token, true),
    snapshot,
  });
}
