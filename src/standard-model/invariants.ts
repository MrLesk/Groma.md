import {
  type Diagnostic,
  type EntityId,
  type GraphData,
  type GraphDataRecord,
  type GraphEntity,
  type GraphRelation,
  parseEntityId,
  parseRelationId,
  type ProposedTransaction,
  type RelationId,
  type Result,
  failure,
  success,
  type TransactionInvariant,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  createStandardModelCapability,
  STANDARD_COMPONENT_KIND,
  type StandardComponentInput,
  type StandardComponentPatch,
  type StandardModelCapability,
} from "./model.ts";

export const STANDARD_MODEL_INVARIANT_ID = "groma.standard-model.invariants/v0.1";

export interface StandardModelInvariantOptions {
  readonly maxComponentMutations: number;
  readonly maxComponents: number;
  readonly maxOwnerCharacters: number;
  readonly maxPinnedComponentIds: number;
  readonly maxRelationshipMutations: number;
  readonly maxRelationships: number;
}

export interface StandardModelOwnershipContext extends GraphDataRecord {
  readonly owner: string;
  readonly plane: "evidence" | "intent";
}

export interface StandardModelTransactionContext extends GraphDataRecord {
  readonly ownership: StandardModelOwnershipContext;
  readonly pinnedComponentIds: readonly string[];
}

export interface StandardModelComponentRecord extends GraphDataRecord {
  readonly id: string;
  readonly kind: string;
  readonly payload: GraphData;
}

export interface StandardModelRelationshipRecord extends GraphDataRecord {
  readonly id: string;
  readonly payload: GraphData;
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

export interface StandardModelTransactionState extends GraphDataRecord {
  readonly components: readonly StandardModelComponentRecord[];
  readonly relationships: readonly StandardModelRelationshipRecord[];
}

export interface StandardComponentCreateInput extends GraphDataRecord {
  readonly id: string;
}

export interface StandardComponentCreateMutation extends GraphDataRecord {
  readonly component: StandardComponentCreateInput;
  readonly type: "create";
}

export interface StandardComponentPatchMutation extends GraphDataRecord {
  readonly id: string;
  readonly patch: GraphDataRecord;
  readonly type: "patch";
}

export interface StandardComponentRemoveMutation extends GraphDataRecord {
  readonly id: string;
  readonly type: "remove";
}

export type StandardComponentMutation =
  | StandardComponentCreateMutation
  | StandardComponentPatchMutation
  | StandardComponentRemoveMutation;

export interface StandardRelationshipInput extends GraphDataRecord {
  readonly id: string;
  readonly payload: GraphData;
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

export interface StandardRelationshipUpsertMutation extends GraphDataRecord {
  readonly relationship: StandardRelationshipInput;
  readonly type: "upsert";
}

export interface StandardRelationshipRemoveMutation extends GraphDataRecord {
  readonly id: string;
  readonly type: "remove";
}

export type StandardRelationshipMutation =
  StandardRelationshipUpsertMutation | StandardRelationshipRemoveMutation;

export interface StandardModelTransactionMutation extends GraphDataRecord {
  readonly components: readonly StandardComponentMutation[];
  readonly relationships: readonly StandardRelationshipMutation[];
}

interface ParsedContext {
  readonly pinnedComponentIds: readonly EntityId[];
}

interface ParsedState {
  readonly components: Map<EntityId, GraphEntity>;
  readonly relationships: Map<RelationId, GraphRelation>;
}

const relationTypePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return details === undefined
    ? Object.freeze({ code, message })
    : Object.freeze({ code, details: Object.freeze({ ...details }), message });
}

function validatePositiveBound(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function inspectDenseArray(
  value: unknown,
  maximum: number,
  path: string,
): Result<readonly unknown[]> {
  const length = inspectIntrinsicArrayLength(value, "invalid-standard-model-envelope", path);
  if (!length.ok) return length;
  if (length.value > maximum) {
    return failure(
      diagnostic("standard-model-envelope-too-large", `${path} exceeds the configured item count`, {
        maximum,
        path,
      }),
    );
  }

  try {
    const keys = Reflect.ownKeys(value as object);
    if (keys.length !== length.value + 1) {
      return failure(
        diagnostic(
          "invalid-standard-model-envelope",
          `${path} must be dense and have no extra properties`,
          { path },
        ),
      );
    }
    const result = new Array<unknown>(length.value);
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          diagnostic(
            "invalid-standard-model-envelope",
            `${path}[${index}] must be an enumerable data property`,
            { path: `${path}[${index}]` },
          ),
        );
      }
      result[index] = descriptor.value;
    }
    return success(Object.freeze(result));
  } catch {
    return failure(
      diagnostic("invalid-standard-model-envelope", `${path} could not be inspected safely`, {
        path,
      }),
    );
  }
}

function annotate(
  diagnostics: readonly Diagnostic[],
  path: string,
  id?: string,
): readonly Diagnostic[] {
  const annotated = new Array<Diagnostic>(diagnostics.length);
  for (let index = 0; index < diagnostics.length; index += 1) {
    const source = diagnostics[index]!;
    const details: Record<string, string | number | boolean> = {};
    if (source.details !== undefined) {
      for (const [key, value] of Object.entries(source.details)) {
        details[key === "path" ? "sourcePath" : key] = value;
      }
    }
    details.path = path;
    if (id !== undefined) details.id = id;
    annotated[index] = diagnostic(
      source.code,
      `${path}${id === undefined ? "" : ` (${id})`}: ${source.message}`,
      details,
    );
  }
  return Object.freeze(annotated);
}

function parseEntityIdentity(value: unknown, path: string): Result<EntityId> {
  if (typeof value !== "string") {
    return failure(
      diagnostic("invalid-entity-id", `${path} must be a stable entity identifier`, { path }),
    );
  }
  const parsed = parseEntityId(value);
  return parsed.ok ? parsed : failure(...annotate(parsed.diagnostics, path, value));
}

function parseRelationIdentity(value: unknown, path: string): Result<RelationId> {
  if (typeof value !== "string") {
    return failure(
      diagnostic("invalid-relation-id", `${path} must be a stable relation identifier`, { path }),
    );
  }
  const parsed = parseRelationId(value);
  return parsed.ok ? parsed : failure(...annotate(parsed.diagnostics, path, value));
}

function parseComponentRecord(
  value: unknown,
  path: string,
  model: StandardModelCapability,
): Result<GraphEntity> {
  const record = inspectExactRecord(
    value,
    [["id", "kind", "payload"]],
    "invalid-standard-model-envelope",
    path,
  );
  if (!record.ok) return record;
  const id = parseEntityIdentity(record.value.id, `${path}.id`);
  if (!id.ok) return id;
  if (record.value.kind !== STANDARD_COMPONENT_KIND) {
    return failure(
      diagnostic("wrong-standard-model-kind", `${path}.kind must be ${STANDARD_COMPONENT_KIND}`, {
        actual:
          typeof record.value.kind === "string" ? record.value.kind : typeof record.value.kind,
        expected: STANDARD_COMPONENT_KIND,
        id: id.value,
        path: `${path}.kind`,
      }),
    );
  }
  const payload = copyGraphPayload(record.value.payload, "entity");
  if (!payload.ok) return failure(...annotate(payload.diagnostics, `${path}.payload`, id.value));
  const entity = Object.freeze({
    id: id.value,
    kind: STANDARD_COMPONENT_KIND,
    payload: payload.value,
  });
  const parsed = model.parse(entity);
  return parsed.ok ? success(entity) : failure(...annotate(parsed.diagnostics, path, id.value));
}

function parseRelationshipRecord(
  value: unknown,
  path: string,
  model: StandardModelCapability,
): Result<GraphRelation> {
  const record = inspectExactRecord(
    value,
    [["id", "payload", "source", "target", "type"]],
    "invalid-standard-model-envelope",
    path,
  );
  if (!record.ok) return record;
  const id = parseRelationIdentity(record.value.id, `${path}.id`);
  if (!id.ok) return id;
  const source = parseEntityIdentity(record.value.source, `${path}.source`);
  if (!source.ok) return source;
  const target = parseEntityIdentity(record.value.target, `${path}.target`);
  if (!target.ok) return target;
  if (typeof record.value.type !== "string" || !relationTypePattern.test(record.value.type)) {
    return failure(
      diagnostic(
        "invalid-relation-type",
        `${path}.type must be a lowercase dotted or dashed graph relation token`,
        { id: id.value, path: `${path}.type` },
      ),
    );
  }
  const payload = copyGraphPayload(record.value.payload, "relation");
  if (!payload.ok) return failure(...annotate(payload.diagnostics, `${path}.payload`, id.value));
  const relationship = Object.freeze({
    id: id.value,
    payload: payload.value,
    source: source.value,
    target: target.value,
    type: record.value.type,
  });
  const parsed = model.relationships([relationship]);
  return parsed.ok
    ? success(relationship)
    : failure(...annotate(parsed.diagnostics, path, id.value));
}

function parseContext(
  value: unknown,
  options: StandardModelInvariantOptions,
): Result<ParsedContext> {
  const context = inspectExactRecord(
    value,
    [["ownership", "pinnedComponentIds"]],
    "invalid-standard-model-context",
    "context",
  );
  if (!context.ok) return context;
  const ownership = inspectExactRecord(
    context.value.ownership,
    [["owner", "plane"]],
    "invalid-standard-model-context",
    "context.ownership",
  );
  if (!ownership.ok) return ownership;
  if (ownership.value.plane !== "intent" && ownership.value.plane !== "evidence") {
    return failure(
      diagnostic(
        "invalid-standard-model-context",
        "context.ownership.plane must be intent or evidence",
        { path: "context.ownership.plane" },
      ),
    );
  }
  if (
    typeof ownership.value.owner !== "string" ||
    ownership.value.owner.length === 0 ||
    ownership.value.owner.length > options.maxOwnerCharacters
  ) {
    return failure(
      diagnostic(
        "invalid-standard-model-context",
        "context.ownership.owner must be a bounded nonempty primitive string",
        { maximum: options.maxOwnerCharacters, path: "context.ownership.owner" },
      ),
    );
  }
  const pinned = inspectDenseArray(
    context.value.pinnedComponentIds,
    options.maxPinnedComponentIds,
    "context.pinnedComponentIds",
  );
  if (!pinned.ok) return pinned;
  const ids = new Array<EntityId>(pinned.value.length);
  for (let index = 0; index < pinned.value.length; index += 1) {
    const id = parseEntityIdentity(pinned.value[index], `context.pinnedComponentIds[${index}]`);
    if (!id.ok) return id;
    if (index > 0 && ids[index - 1]! >= id.value) {
      return failure(
        diagnostic(
          "invalid-pinned-component-identities",
          "context.pinnedComponentIds must be sorted and unique",
          { id: id.value, path: `context.pinnedComponentIds[${index}]` },
        ),
      );
    }
    ids[index] = id.value;
  }
  return success({ pinnedComponentIds: Object.freeze(ids) });
}

function parseState(
  value: unknown,
  options: StandardModelInvariantOptions,
  model: StandardModelCapability,
): Result<ParsedState> {
  const envelope = inspectExactRecord(
    value,
    [["components", "relationships"]],
    "invalid-standard-model-envelope",
    "priorState",
  );
  if (!envelope.ok) return envelope;
  const componentValues = inspectDenseArray(
    envelope.value.components,
    options.maxComponents,
    "priorState.components",
  );
  if (!componentValues.ok) return componentValues;
  const relationshipValues = inspectDenseArray(
    envelope.value.relationships,
    options.maxRelationships,
    "priorState.relationships",
  );
  if (!relationshipValues.ok) return relationshipValues;

  const components = new Map<EntityId, GraphEntity>();
  for (let index = 0; index < componentValues.value.length; index += 1) {
    const parsed = parseComponentRecord(
      componentValues.value[index],
      `priorState.components[${index}]`,
      model,
    );
    if (!parsed.ok) return parsed;
    if (components.has(parsed.value.id)) {
      return failure(
        diagnostic(
          "ambiguous-component-identity",
          "Prior state contains the same component identity more than once",
          { id: parsed.value.id, path: `priorState.components[${index}].id` },
        ),
      );
    }
    components.set(parsed.value.id, parsed.value);
  }

  const relationships = new Map<RelationId, GraphRelation>();
  for (let index = 0; index < relationshipValues.value.length; index += 1) {
    const parsed = parseRelationshipRecord(
      relationshipValues.value[index],
      `priorState.relationships[${index}]`,
      model,
    );
    if (!parsed.ok) return parsed;
    if (relationships.has(parsed.value.id)) {
      return failure(
        diagnostic(
          "ambiguous-relationship-identity",
          "Prior state contains the same relationship identity more than once",
          { id: parsed.value.id, path: `priorState.relationships[${index}].id` },
        ),
      );
    }
    relationships.set(parsed.value.id, parsed.value);
  }
  return success({ components, relationships });
}

function applyComponentMutations(
  value: unknown,
  components: Map<EntityId, GraphEntity>,
  maximum: number,
  model: StandardModelCapability,
): Result<void> {
  const mutations = inspectDenseArray(value, maximum, "mutation.components");
  if (!mutations.ok) return mutations;
  const targets = new Set<EntityId>();
  for (let index = 0; index < mutations.value.length; index += 1) {
    const path = `mutation.components[${index}]`;
    const record = inspectExactRecord(
      mutations.value[index],
      [
        ["component", "type"],
        ["id", "patch", "type"],
        ["id", "type"],
      ],
      "invalid-standard-model-mutation",
      path,
    );
    if (!record.ok) return record;

    let target: Result<EntityId>;
    let createInput: GraphDataRecord | undefined;
    if (record.value.type === "create" && "component" in record.value) {
      const copied = copyGraphPayload(record.value.component, "entity");
      if (!copied.ok) return failure(...annotate(copied.diagnostics, `${path}.component`));
      if (
        typeof copied.value !== "object" ||
        copied.value === null ||
        Array.isArray(copied.value)
      ) {
        return failure(
          diagnostic(
            "invalid-standard-model-mutation",
            `${path}.component must be a graph-data record`,
            { path: `${path}.component` },
          ),
        );
      }
      createInput = copied.value as GraphDataRecord;
      target = parseEntityIdentity(createInput.id, `${path}.component.id`);
    } else if (
      (record.value.type === "patch" && "patch" in record.value) ||
      (record.value.type === "remove" && !("patch" in record.value))
    ) {
      target = parseEntityIdentity(record.value.id, `${path}.id`);
    } else {
      return failure(
        diagnostic(
          "invalid-standard-model-mutation",
          `${path} fields do not match its component mutation type`,
          { path },
        ),
      );
    }
    if (!target.ok) return target;
    if (targets.has(target.value)) {
      return failure(
        diagnostic(
          "ambiguous-component-mutation",
          "A component identity may be targeted only once in a transaction",
          { id: target.value, path },
        ),
      );
    }
    targets.add(target.value);

    if (record.value.type === "create") {
      if (components.has(target.value)) {
        return failure(
          diagnostic(
            "ambiguous-component-identity",
            "A created component identity already exists in prior state",
            { id: target.value, path: `${path}.component.id` },
          ),
        );
      }
      const normalized = model.normalize(createInput as StandardComponentInput);
      if (!normalized.ok) return failure(...annotate(normalized.diagnostics, path, target.value));
      const payload = copyGraphPayload(normalized.value.payload, "entity");
      if (!payload.ok) return failure(...annotate(payload.diagnostics, path, target.value));
      components.set(
        target.value,
        Object.freeze({
          id: target.value,
          kind: STANDARD_COMPONENT_KIND,
          payload: payload.value,
        }),
      );
      continue;
    }

    const existing = components.get(target.value);
    if (existing === undefined) {
      return failure(
        diagnostic(
          "unknown-component-mutation-target",
          "A component mutation must target one exact existing component",
          { id: target.value, path },
        ),
      );
    }
    if (record.value.type === "remove") {
      components.delete(target.value);
      continue;
    }
    const patched = model.patch(existing, record.value.patch as StandardComponentPatch);
    if (!patched.ok) return failure(...annotate(patched.diagnostics, path, target.value));
    const payload = copyGraphPayload(patched.value.payload, "entity");
    if (!payload.ok) return failure(...annotate(payload.diagnostics, path, target.value));
    components.set(
      target.value,
      Object.freeze({
        id: target.value,
        kind: STANDARD_COMPONENT_KIND,
        payload: payload.value,
      }),
    );
  }
  return success(undefined);
}

function applyRelationshipMutations(
  value: unknown,
  relationships: Map<RelationId, GraphRelation>,
  maximum: number,
  model: StandardModelCapability,
): Result<void> {
  const mutations = inspectDenseArray(value, maximum, "mutation.relationships");
  if (!mutations.ok) return mutations;
  const targets = new Set<RelationId>();
  for (let index = 0; index < mutations.value.length; index += 1) {
    const path = `mutation.relationships[${index}]`;
    const record = inspectExactRecord(
      mutations.value[index],
      [
        ["relationship", "type"],
        ["id", "type"],
      ],
      "invalid-standard-model-mutation",
      path,
    );
    if (!record.ok) return record;

    let target: Result<RelationId>;
    let upsert: GraphRelation | undefined;
    if (record.value.type === "upsert" && "relationship" in record.value) {
      const parsed = parseRelationshipRecord(
        record.value.relationship,
        `${path}.relationship`,
        model,
      );
      if (!parsed.ok) return parsed;
      target = success(parsed.value.id);
      upsert = parsed.value;
    } else if (record.value.type === "remove" && !("relationship" in record.value)) {
      target = parseRelationIdentity(record.value.id, `${path}.id`);
    } else {
      return failure(
        diagnostic(
          "invalid-standard-model-mutation",
          `${path} fields do not match its relationship mutation type`,
          { path },
        ),
      );
    }
    if (!target.ok) return target;
    if (targets.has(target.value)) {
      return failure(
        diagnostic(
          "ambiguous-relationship-mutation",
          "A relationship identity may be targeted only once in a transaction",
          { id: target.value, path },
        ),
      );
    }
    targets.add(target.value);

    if (upsert !== undefined) {
      relationships.set(target.value, upsert);
    } else if (!relationships.delete(target.value)) {
      return failure(
        diagnostic(
          "unknown-relationship-mutation-target",
          "A relationship removal must target one exact existing relationship",
          { id: target.value, path },
        ),
      );
    }
  }
  return success(undefined);
}

function parseMutation(
  value: unknown,
  state: ParsedState,
  options: StandardModelInvariantOptions,
  model: StandardModelCapability,
): Result<void> {
  const envelope = inspectExactRecord(
    value,
    [["components", "relationships"]],
    "invalid-standard-model-envelope",
    "mutation",
  );
  if (!envelope.ok) return envelope;
  const components = applyComponentMutations(
    envelope.value.components,
    state.components,
    options.maxComponentMutations,
    model,
  );
  if (!components.ok) return components;
  return applyRelationshipMutations(
    envelope.value.relationships,
    state.relationships,
    options.maxRelationshipMutations,
    model,
  );
}

function validateFinalGraph(
  state: ParsedState,
  model: StandardModelCapability,
): readonly Diagnostic[] {
  const parents = new Map<EntityId, EntityId | undefined>();
  for (const [id, entity] of state.components) {
    const parsed = model.parse(entity);
    if (!parsed.ok) return annotate(parsed.diagnostics, "finalState.components", id);
    const parent = parsed.value.parent;
    if (parent === id) {
      return Object.freeze([
        diagnostic("self-component-parent", "A component cannot be its own structural parent", {
          id,
          parent,
          path: "finalState.components.parent",
        }),
      ]);
    }
    if (parent !== undefined && !state.components.has(parent)) {
      return Object.freeze([
        diagnostic(
          "unknown-component-parent",
          "A non-root component parent must resolve to one exact component in the final graph",
          { id, parent, path: "finalState.components.parent" },
        ),
      ]);
    }
    parents.set(id, parent);
  }

  const visit = new Map<EntityId, 1 | 2>();
  for (const id of state.components.keys()) {
    if (visit.get(id) === 2) continue;
    const trail: EntityId[] = [];
    let current: EntityId | undefined = id;
    while (current !== undefined && visit.get(current) !== 2) {
      if (visit.get(current) === 1) {
        return Object.freeze([
          diagnostic("component-containment-cycle", "Component containment must be acyclic", {
            id: current,
            path: "finalState.components.parent",
          }),
        ]);
      }
      visit.set(current, 1);
      trail[trail.length] = current;
      current = parents.get(current);
    }
    for (let index = trail.length - 1; index >= 0; index -= 1) visit.set(trail[index]!, 2);
  }

  for (const relationship of state.relationships.values()) {
    if (!state.components.has(relationship.source)) {
      return Object.freeze([
        diagnostic(
          "invalid-relationship-source",
          "A relationship source must resolve to one exact component in the final graph",
          {
            id: relationship.id,
            path: "finalState.relationships.source",
            source: relationship.source,
          },
        ),
      ]);
    }
    if (!state.components.has(relationship.target)) {
      return Object.freeze([
        diagnostic(
          "invalid-relationship-target",
          "A relationship target must resolve to one exact component in the final graph",
          {
            id: relationship.id,
            path: "finalState.relationships.target",
            target: relationship.target,
          },
        ),
      ]);
    }
  }

  return Object.freeze([]);
}

function validatePinnedReferences(
  context: ParsedContext,
  knownComponentIds: ReadonlySet<EntityId>,
): readonly Diagnostic[] {
  for (let index = 0; index < context.pinnedComponentIds.length; index += 1) {
    const id = context.pinnedComponentIds[index]!;
    if (!knownComponentIds.has(id)) {
      return Object.freeze([
        diagnostic(
          "unknown-pinned-component",
          "A pinned conceptual boundary must identify a component in the prior or proposed graph",
          { id, path: `context.pinnedComponentIds[${index}]` },
        ),
      ]);
    }
  }
  return Object.freeze([]);
}

function validateProposal(
  proposal: ProposedTransaction,
  options: StandardModelInvariantOptions,
  model: StandardModelCapability,
): readonly Diagnostic[] {
  const context = parseContext(proposal.context, options);
  if (!context.ok) return context.diagnostics;
  const state = parseState(proposal.priorState, options, model);
  if (!state.ok) return state.diagnostics;
  const knownComponentIds = new Set<EntityId>(state.value.components.keys());
  const mutation = parseMutation(proposal.mutation, state.value, options, model);
  if (!mutation.ok) return mutation.diagnostics;
  if (state.value.components.size > options.maxComponents) {
    return Object.freeze([
      diagnostic(
        "standard-model-envelope-too-large",
        "The final component state exceeds the configured item count",
        { maximum: options.maxComponents, path: "finalState.components" },
      ),
    ]);
  }
  if (state.value.relationships.size > options.maxRelationships) {
    return Object.freeze([
      diagnostic(
        "standard-model-envelope-too-large",
        "The final relationship state exceeds the configured item count",
        { maximum: options.maxRelationships, path: "finalState.relationships" },
      ),
    ]);
  }
  for (const id of state.value.components.keys()) knownComponentIds.add(id);
  const pinned = validatePinnedReferences(context.value, knownComponentIds);
  if (pinned.length > 0) return pinned;
  return validateFinalGraph(state.value, model);
}

export function createStandardModelInvariant(
  options: StandardModelInvariantOptions,
): TransactionInvariant {
  validatePositiveBound(options.maxComponentMutations, "maxComponentMutations");
  validatePositiveBound(options.maxComponents, "maxComponents");
  validatePositiveBound(options.maxOwnerCharacters, "maxOwnerCharacters");
  validatePositiveBound(options.maxPinnedComponentIds, "maxPinnedComponentIds");
  validatePositiveBound(options.maxRelationshipMutations, "maxRelationshipMutations");
  validatePositiveBound(options.maxRelationships, "maxRelationships");
  const copiedOptions = Object.freeze({ ...options });
  const model = createStandardModelCapability();
  return Object.freeze({
    id: STANDARD_MODEL_INVARIANT_ID,
    validate: (proposal: ProposedTransaction) => validateProposal(proposal, copiedOptions, model),
  });
}
