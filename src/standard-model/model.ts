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
export const STANDARD_COMPONENT_LABEL_MAX_CODE_POINTS = 80;
export const STANDARD_COMPONENT_SUMMARY_MAX_CODE_POINTS = 280;
export const STANDARD_COMPONENT_ICON_DOMAIN_MAX_CHARACTERS = 253;

const knownComponentFields = new Set([
  "actions",
  "desired",
  "inputs",
  "intent",
  "iconDomain",
  "label",
  "lifecycle",
  "name",
  "outputs",
  "parent",
  "summary",
  "type",
]);
const knownItemFields = new Set(["description", "id", "name"]);
const knownRelationshipFields = new Set(["description"]);
const serializedComponentFields = new Set([...knownComponentFields, "extensions", "id", "kind"]);
const serializedItemFields = new Set([...knownItemFields, "extensions"]);
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
  readonly label?: string;
  readonly summary?: string;
  readonly iconDomain?: string;
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
  readonly label?: string;
  readonly summary?: string;
  readonly iconDomain?: string;
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
  readonly label?: string | null;
  readonly summary?: string | null;
  readonly iconDomain?: string | null;
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

function isCanonicalBoundedLine(value: string, maximumCodePoints: number): boolean {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)
  ) {
    return false;
  }
  let codePoints = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
    codePoints += 1;
    if (codePoints > maximumCodePoints) return false;
  }
  return true;
}

export function isStandardComponentLabel(value: string): boolean {
  return isCanonicalBoundedLine(value, STANDARD_COMPONENT_LABEL_MAX_CODE_POINTS);
}

export function isStandardComponentSummary(value: string): boolean {
  return isCanonicalBoundedLine(value, STANDARD_COMPONENT_SUMMARY_MAX_CODE_POINTS);
}

export function isStandardComponentIconDomain(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > STANDARD_COMPONENT_ICON_DOMAIN_MAX_CHARACTERS ||
    value !== value.toLowerCase() ||
    !value.includes(".") ||
    !/^[a-z0-9.-]+$/u.test(value)
  ) {
    return false;
  }
  const labels = value.split(".");
  const ipv4NumberShape =
    labels.length >= 2 &&
    labels.length <= 4 &&
    labels.every((label) => /^[0-9]+$/u.test(label) || /^0x[0-9a-f]*$/u.test(label));
  if (ipv4NumberShape) {
    return false;
  }
  return labels.every(
    (label) =>
      label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
  );
}

function recognitionString(
  record: Readonly<Record<string, unknown>>,
  field: "iconDomain" | "label" | "summary",
  path: string,
): Result<string | undefined> {
  const parsed = optionalString(record, field, path);
  if (!parsed.ok || parsed.value === undefined) return parsed;
  const valid =
    field === "label"
      ? isStandardComponentLabel(parsed.value)
      : field === "summary"
        ? isStandardComponentSummary(parsed.value)
        : isStandardComponentIconDomain(parsed.value);
  if (valid) return parsed;
  const expectation =
    field === "label"
      ? `a trimmed, non-empty, control-free single line of at most ${STANDARD_COMPONENT_LABEL_MAX_CODE_POINTS} Unicode code points`
      : field === "summary"
        ? `a trimmed, non-empty, control-free single line of at most ${STANDARD_COMPONENT_SUMMARY_MAX_CODE_POINTS} Unicode code points`
        : "a lowercase ASCII DNS hostname with at least two labels, no trailing dot, and no IP literal";
  return diagnostic(
    `invalid-component-${field === "iconDomain" ? "icon-domain" : field}`,
    `${path}.${field} must be ${expectation}`,
    `${path}.${field}`,
  );
}

export function standardComponentDisplayText(
  component: Readonly<Pick<StandardComponent, "id" | "label" | "name">>,
): string {
  return component.label ?? component.name ?? component.id;
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

function rejectUnknownSerializedFields(
  record: Readonly<Record<string, unknown>>,
  knownFields: ReadonlySet<string>,
  path: string,
): Result<void> {
  const unknown = Object.keys(record).find((key) => !knownFields.has(key));
  return unknown === undefined
    ? success(undefined)
    : diagnostic(
        "unknown-serialized-model-field",
        `${path}.${unknown} is not part of the public standard-model value`,
        `${path}.${unknown}`,
      );
}

function serializedExtensions(
  value: unknown,
  path: string,
): Result<Readonly<Record<string, GraphData>>> {
  if (value === undefined) return success(Object.freeze({}));
  const record = requireRecord(value, path);
  if (!record.ok) return record;
  const extensions: Record<string, GraphData> = {};
  for (const key of Object.keys(record.value).sort()) {
    if (!extensionKeyPattern.test(key)) {
      return diagnostic(
        "invalid-extension-key",
        `${path}.${key} must be namespaced and cannot collide with standard fields`,
        `${path}.${key}`,
      );
    }
    extensions[key] = record.value[key] as GraphData;
  }
  return success(Object.freeze(extensions));
}

function serializeItem(value: unknown, path: string): Result<StandardItemInput> {
  const record = requireRecord(value, path);
  if (!record.ok) return record;
  const known = rejectUnknownSerializedFields(record.value, serializedItemFields, path);
  if (!known.ok) return known;
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
  const extensions = serializedExtensions(record.value.extensions, `${path}.extensions`);
  if (!extensions.ok) return extensions;
  return success(
    Object.freeze({
      id,
      ...(name.value === undefined ? {} : { name: name.value }),
      ...(description.value === undefined ? {} : { description: description.value }),
      ...extensions.value,
    }),
  );
}

function serializeItems(value: unknown, path: string): Result<readonly StandardItemInput[]> {
  if (!Array.isArray(value)) {
    return diagnostic("invalid-standard-item-list", `${path} must be an array`, path);
  }
  const items: StandardItemInput[] = [];
  for (const [index, item] of value.entries()) {
    const serialized = serializeItem(item, `${path}[${index}]`);
    if (!serialized.ok) return serialized;
    items.push(serialized.value);
  }
  return success(Object.freeze(items));
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
    ...(component.label === undefined ? {} : { label: component.label }),
    ...(component.summary === undefined ? {} : { summary: component.summary }),
    ...(component.iconDomain === undefined ? {} : { iconDomain: component.iconDomain }),
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
  const label = recognitionString(record.value, "label", "component");
  if (!label.ok) return label;
  const summary = recognitionString(record.value, "summary", "component");
  if (!summary.ok) return summary;
  const iconDomain = recognitionString(record.value, "iconDomain", "component");
  if (!iconDomain.ok) return iconDomain;
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
      ...(label.value === undefined ? {} : { label: label.value }),
      ...(summary.value === undefined ? {} : { summary: summary.value }),
      ...(iconDomain.value === undefined ? {} : { iconDomain: iconDomain.value }),
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
  const copied = copyGraphPayload(component, "entity");
  if (!copied.ok) return copied;
  const record = requireRecord(copied.value, "component");
  if (!record.ok) return record;
  const known = rejectUnknownSerializedFields(record.value, serializedComponentFields, "component");
  if (!known.ok) return known;
  if (record.value.kind !== STANDARD_COMPONENT_KIND) {
    return diagnostic(
      "wrong-standard-model-kind",
      "Only standard components can be serialized by this capability",
      "component.kind",
      typeof record.value.kind === "string" ? record.value.kind : typeof record.value.kind,
    );
  }
  if (typeof record.value.id !== "string") {
    return diagnostic(
      "invalid-entity-id",
      "component.id must be a stable entity identifier",
      "component.id",
    );
  }

  const input: Record<string, unknown> = { id: record.value.id };
  for (const field of knownComponentFields) {
    if (field === "inputs" || field === "outputs" || field === "actions") continue;
    if (record.value[field] !== undefined) input[field] = record.value[field];
  }
  for (const field of ["inputs", "outputs", "actions"] as const) {
    if (record.value[field] === undefined) continue;
    const items = serializeItems(record.value[field], `component.${field}`);
    if (!items.ok) return items;
    input[field] = items.value;
  }
  const extensions = serializedExtensions(record.value.extensions, "component.extensions");
  if (!extensions.ok) return extensions;
  Object.assign(input, extensions.value);
  return normalize(input as StandardComponentInput);
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
    if (entity.kind !== STANDARD_COMPONENT_KIND) continue;
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
