import {
  type EntityDraft,
  type EntityId,
  type GraphData,
  type GraphDataRecord,
  type GraphEntity,
  type GraphRelation,
  parseEntityId,
  type RelationId,
  type Result,
  failure,
  success,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";

export const STANDARD_COMPONENT_KIND = "component";
export const STANDARD_MODEL_CAPABILITY_ID = "groma.standard-model/v0.1";

const knownComponentFields = new Set([
  "actions",
  "desired",
  "inputs",
  "intent",
  "lifecycle",
  "name",
  "outputs",
  "parent",
  "type",
]);
const knownItemFields = new Set(["description", "id", "name"]);
const knownRelationshipFields = new Set(["description"]);
const extensionKeyPattern = /^[A-Za-z][A-Za-z0-9_.-]*(?::|\/)[A-Za-z][A-Za-z0-9_.-]*$/;
const openTokenPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface StandardItem {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly extensions: Readonly<Record<string, GraphData>>;
}

export interface StandardComponent {
  readonly id: EntityId;
  readonly kind: typeof STANDARD_COMPONENT_KIND;
  readonly name?: string;
  readonly type?: string;
  readonly parent?: EntityId;
  readonly intent?: string;
  readonly inputs?: readonly StandardItem[];
  readonly outputs?: readonly StandardItem[];
  readonly actions?: readonly StandardItem[];
  readonly lifecycle?: string;
  readonly desired?: string;
  readonly extensions: Readonly<Record<string, GraphData>>;
}

export interface StandardRelationship {
  readonly id: RelationId;
  readonly type: string;
  readonly source: EntityId;
  readonly target: EntityId;
  readonly description?: string;
  readonly extensions: Readonly<Record<string, GraphData>>;
}

export interface StandardItemInput {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly [field: string]: unknown;
}

export interface StandardComponentInput {
  readonly id?: string;
  readonly name?: string;
  readonly type?: string;
  readonly parent?: string;
  readonly intent?: string;
  readonly inputs?: readonly StandardItemInput[];
  readonly outputs?: readonly StandardItemInput[];
  readonly actions?: readonly StandardItemInput[];
  readonly lifecycle?: string;
  readonly desired?: string;
  readonly [field: string]: unknown;
}

export interface StandardComponentPatch {
  readonly name?: string | null;
  readonly type?: string | null;
  readonly parent?: string | null;
  readonly intent?: string | null;
  readonly inputs?: readonly StandardItemInput[] | null;
  readonly outputs?: readonly StandardItemInput[] | null;
  readonly actions?: readonly StandardItemInput[] | null;
  readonly lifecycle?: string | null;
  readonly desired?: string | null;
  readonly [field: string]: unknown;
}

export interface StandardModelCapability {
  readonly id: typeof STANDARD_MODEL_CAPABILITY_ID;
  normalize(input: StandardComponentInput): Result<EntityDraft>;
  parse(entity: GraphEntity): Result<StandardComponent>;
  patch(entity: GraphEntity, patch: StandardComponentPatch): Result<EntityDraft>;
  serialize(component: StandardComponent): Result<EntityDraft>;
  children(entities: readonly GraphEntity[], parent?: string): Result<readonly StandardComponent[]>;
  relationships(relations: readonly GraphRelation[]): Result<readonly StandardRelationship[]>;
}

function diagnostic(code: string, message: string, path: string, value?: string): Result<never> {
  return failure({
    code,
    message,
    details: value === undefined ? { path } : { path, value },
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRecord(value: unknown, path: string): Result<Readonly<Record<string, unknown>>> {
  return isRecord(value)
    ? success(value)
    : diagnostic("invalid-standard-model-record", `${path} must be a plain record`, path);
}

function optionalString(
  record: Readonly<Record<string, unknown>>,
  field: string,
  path: string,
): Result<string | undefined> {
  const value = record[field];
  return value === undefined || typeof value === "string"
    ? success(value)
    : diagnostic(
        "invalid-standard-model-field",
        `${path}.${field} must be a string when present`,
        `${path}.${field}`,
      );
}

function openToken(
  record: Readonly<Record<string, unknown>>,
  field: string,
  path: string,
): Result<string | undefined> {
  const parsed = optionalString(record, field, path);
  if (!parsed.ok || parsed.value === undefined) return parsed;
  return openTokenPattern.test(parsed.value)
    ? parsed
    : diagnostic(
        "invalid-standard-model-token",
        `${path}.${field} must be an open lowercase dotted, dashed, or underscored token`,
        `${path}.${field}`,
        parsed.value,
      );
}

function extensionEntries(
  record: Readonly<Record<string, unknown>>,
  knownFields: ReadonlySet<string>,
  path: string,
): Result<Readonly<Record<string, GraphData>>> {
  const extensions: Record<string, GraphData> = {};
  for (const key of Object.keys(record).sort()) {
    if (knownFields.has(key)) continue;
    if (!extensionKeyPattern.test(key)) {
      return diagnostic(
        "unknown-standard-model-field",
        `${path}.${key} is not a standard field or a namespaced extension`,
        `${path}.${key}`,
      );
    }
    const copied = copyGraphPayload(record[key], "entity");
    if (!copied.ok) return copied;
    extensions[key] = copied.value;
  }
  return success(Object.freeze(extensions));
}

function normalizeItem(value: unknown, path: string): Result<StandardItem> {
  const record = requireRecord(value, path);
  if (!record.ok) return record;
  const id = record.value.id;
  if (typeof id !== "string" || id.length === 0) {
    return diagnostic(
      "invalid-standard-item-id",
      `${path}.id must be a non-empty stable identifier`,
      `${path}.id`,
    );
  }
  const name = optionalString(record.value, "name", path);
  if (!name.ok) return name;
  const description = optionalString(record.value, "description", path);
  if (!description.ok) return description;
  const extensions = extensionEntries(record.value, knownItemFields, path);
  if (!extensions.ok) return extensions;
  return success(
    Object.freeze({
      id,
      ...(name.value === undefined ? {} : { name: name.value }),
      ...(description.value === undefined ? {} : { description: description.value }),
      extensions: extensions.value,
    }),
  );
}

function normalizeItems(value: unknown, path: string): Result<readonly StandardItem[] | undefined> {
  if (value === undefined) return success(undefined);
  if (!Array.isArray(value)) {
    return diagnostic("invalid-standard-item-list", `${path} must be an array`, path);
  }
  const items: StandardItem[] = [];
  const identities = new Set<string>();
  for (const [index, input] of value.entries()) {
    const item = normalizeItem(input, `${path}[${index}]`);
    if (!item.ok) return item;
    if (identities.has(item.value.id)) {
      return diagnostic(
        "duplicate-standard-item-id",
        `${path} contains the same stable item identifier more than once`,
        `${path}[${index}].id`,
        item.value.id,
      );
    }
    identities.add(item.value.id);
    items.push(item.value);
  }
  items.sort((left, right) => compareText(left.id, right.id));
  return success(Object.freeze(items));
}

function itemRecord(item: StandardItem): GraphDataRecord {
  return {
    id: item.id,
    ...(item.name === undefined ? {} : { name: item.name }),
    ...(item.description === undefined ? {} : { description: item.description }),
    ...item.extensions,
  };
}

function componentPayload(component: Omit<StandardComponent, "id" | "kind">): GraphDataRecord {
  return {
    ...(component.name === undefined ? {} : { name: component.name }),
    ...(component.type === undefined ? {} : { type: component.type }),
    ...(component.parent === undefined ? {} : { parent: component.parent }),
    ...(component.intent === undefined ? {} : { intent: component.intent }),
    ...(component.inputs === undefined ? {} : { inputs: component.inputs.map(itemRecord) }),
    ...(component.outputs === undefined ? {} : { outputs: component.outputs.map(itemRecord) }),
    ...(component.actions === undefined ? {} : { actions: component.actions.map(itemRecord) }),
    ...(component.lifecycle === undefined ? {} : { lifecycle: component.lifecycle }),
    ...(component.desired === undefined ? {} : { desired: component.desired }),
    ...component.extensions,
  };
}

function parsePayload(value: unknown): Result<Omit<StandardComponent, "id" | "kind">> {
  const record = requireRecord(value, "component");
  if (!record.ok) return record;
  const name = optionalString(record.value, "name", "component");
  if (!name.ok) return name;
  const type = openToken(record.value, "type", "component");
  if (!type.ok) return type;
  const intent = optionalString(record.value, "intent", "component");
  if (!intent.ok) return intent;
  const lifecycle = openToken(record.value, "lifecycle", "component");
  if (!lifecycle.ok) return lifecycle;
  const desired = openToken(record.value, "desired", "component");
  if (!desired.ok) return desired;

  let parent: EntityId | undefined;
  if (record.value.parent !== undefined) {
    if (typeof record.value.parent !== "string") {
      return diagnostic(
        "invalid-component-parent",
        "component.parent must be a stable entity identifier",
        "component.parent",
      );
    }
    const parsed = parseEntityId(record.value.parent);
    if (!parsed.ok) return parsed;
    parent = parsed.value;
  }

  const inputs = normalizeItems(record.value.inputs, "component.inputs");
  if (!inputs.ok) return inputs;
  const outputs = normalizeItems(record.value.outputs, "component.outputs");
  if (!outputs.ok) return outputs;
  const actions = normalizeItems(record.value.actions, "component.actions");
  if (!actions.ok) return actions;
  const extensions = extensionEntries(record.value, knownComponentFields, "component");
  if (!extensions.ok) return extensions;

  return success(
    Object.freeze({
      ...(name.value === undefined ? {} : { name: name.value }),
      ...(type.value === undefined ? {} : { type: type.value }),
      ...(parent === undefined ? {} : { parent }),
      ...(intent.value === undefined ? {} : { intent: intent.value }),
      ...(inputs.value === undefined ? {} : { inputs: inputs.value }),
      ...(outputs.value === undefined ? {} : { outputs: outputs.value }),
      ...(actions.value === undefined ? {} : { actions: actions.value }),
      ...(lifecycle.value === undefined ? {} : { lifecycle: lifecycle.value }),
      ...(desired.value === undefined ? {} : { desired: desired.value }),
      extensions: extensions.value,
    }),
  );
}

function toDraft(
  component: Omit<StandardComponent, "id" | "kind">,
  id?: string,
): Result<EntityDraft> {
  const copied = copyGraphPayload(componentPayload(component), "entity");
  if (!copied.ok) return copied;
  return success(
    Object.freeze({
      ...(id === undefined ? {} : { id }),
      kind: STANDARD_COMPONENT_KIND,
      payload: copied.value,
    }),
  );
}

function normalize(input: StandardComponentInput): Result<EntityDraft> {
  const copied = copyGraphPayload(input, "entity");
  if (!copied.ok) return copied;
  const record = requireRecord(copied.value, "component");
  if (!record.ok) return record;
  const id = record.value.id;
  if (id !== undefined) {
    if (typeof id !== "string") {
      return diagnostic(
        "invalid-entity-id",
        "component.id must be a stable entity identifier",
        "component.id",
      );
    }
    const identity = parseEntityId(id);
    if (!identity.ok) return identity;
  }
  const { id: _id, ...payload } = record.value;
  const component = parsePayload(payload);
  if (!component.ok) return component;
  return toDraft(component.value, id as string | undefined);
}

function parse(entity: GraphEntity): Result<StandardComponent> {
  if (entity.kind !== STANDARD_COMPONENT_KIND) {
    return failure({
      code: "wrong-standard-model-kind",
      message: "The standard component model only parses component graph entities",
      details: { actual: entity.kind, expected: STANDARD_COMPONENT_KIND, id: entity.id },
    });
  }
  const payload = parsePayload(entity.payload);
  if (!payload.ok) return payload;
  return success(Object.freeze({ id: entity.id, kind: STANDARD_COMPONENT_KIND, ...payload.value }));
}

function patch(entity: GraphEntity, changes: StandardComponentPatch): Result<EntityDraft> {
  const existing = parse(entity);
  if (!existing.ok) return existing;
  const copied = copyGraphPayload(changes, "entity");
  if (!copied.ok) return copied;
  const record = requireRecord(copied.value, "patch");
  if (!record.ok) return record;
  const payload: Record<string, unknown> = { ...componentPayload(existing.value) };

  for (const [key, value] of Object.entries(record.value)) {
    if (!knownComponentFields.has(key) && !extensionKeyPattern.test(key)) {
      return diagnostic(
        "unknown-standard-model-field",
        `patch.${key} is not a standard field or a namespaced extension`,
        `patch.${key}`,
      );
    }
    if (knownComponentFields.has(key) && value === null) {
      delete payload[key];
    } else {
      payload[key] = value;
    }
  }

  const normalized = parsePayload(payload);
  if (!normalized.ok) return normalized;
  return toDraft(normalized.value, existing.value.id);
}

function serialize(component: StandardComponent): Result<EntityDraft> {
  if (component.kind !== STANDARD_COMPONENT_KIND) {
    return diagnostic(
      "wrong-standard-model-kind",
      "Only standard components can be serialized by this capability",
      "component.kind",
      component.kind,
    );
  }
  return normalize({ id: component.id, ...componentPayload(component) });
}

function children(
  entities: readonly GraphEntity[],
  parent?: string,
): Result<readonly StandardComponent[]> {
  let parentId: EntityId | undefined;
  if (parent !== undefined) {
    const parsed = parseEntityId(parent);
    if (!parsed.ok) return parsed;
    parentId = parsed.value;
  }

  const parsedComponents: StandardComponent[] = [];
  for (const entity of entities) {
    const component = parse(entity);
    if (!component.ok) return component;
    if (component.value.parent === parentId) parsedComponents.push(component.value);
  }
  parsedComponents.sort((left, right) => compareText(left.id, right.id));
  return success(Object.freeze(parsedComponents));
}

function relationshipView(relation: GraphRelation): Result<StandardRelationship> {
  const record = requireRecord(relation.payload, "relationship");
  if (!record.ok) return record;
  const description = optionalString(record.value, "description", "relationship");
  if (!description.ok) return description;
  const extensions = extensionEntries(record.value, knownRelationshipFields, "relationship");
  if (!extensions.ok) return extensions;
  return success(
    Object.freeze({
      id: relation.id,
      type: relation.type,
      source: relation.source,
      target: relation.target,
      ...(description.value === undefined ? {} : { description: description.value }),
      extensions: extensions.value,
    }),
  );
}

function relationships(
  relations: readonly GraphRelation[],
): Result<readonly StandardRelationship[]> {
  const views: StandardRelationship[] = [];
  for (const relation of relations) {
    const view = relationshipView(relation);
    if (!view.ok) return view;
    views.push(view.value);
  }
  views.sort((left, right) => compareText(left.id, right.id));
  return success(Object.freeze(views));
}

export function createStandardModelCapability(): StandardModelCapability {
  return Object.freeze({
    id: STANDARD_MODEL_CAPABILITY_ID,
    children,
    normalize,
    parse,
    patch,
    relationships,
    serialize,
  });
}
