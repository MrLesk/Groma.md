import {
  failure,
  parseEntityId,
  parseGraphGeneration,
  parseRelationId,
  success,
  type EntityDraft,
  type GraphData,
  type GraphEntity,
  type GraphRelation,
  type GraphSnapshot,
  type GraphGeneration,
  type ProposedTransaction,
  type Result,
  type TransactionInvariant,
} from "../core/index.ts";
import { copyCanonicalGraphData, copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  createStandardModelInvariant,
  STANDARD_COMPONENT_KIND,
  type StandardComponent,
  type StandardComponentInput,
  type StandardComponentPatch,
  type StandardModelCapability,
  type StandardRelationship,
} from "../standard-model/index.ts";
import type { ApplicationOperationBounds } from "./contracts.ts";
import type { GraphKernel } from "../core/index.ts";
import { containCapabilityValue } from "./capability-value.ts";
import { containNativePromise } from "./promise-observation.ts";

export interface ApplicationSnapshotStateDecoderOptions {
  readonly bounds: Pick<
    ApplicationOperationBounds,
    | "maxComponents"
    | "maxDiagnosticCount"
    | "maxEmbeddedItems"
    | "maxRelationships"
    | "maxSnapshotStateDepth"
    | "maxSnapshotStateValues"
  >;
  readonly graph: GraphKernel;
  readonly isProxy: (value: unknown) => boolean;
  readonly model: StandardModelCapability;
}

export interface DecodedApplicationSnapshotState {
  readonly components: readonly StandardComponent[];
  readonly graph: GraphSnapshot;
  readonly relationships: readonly StandardRelationship[];
}

export interface CanonicalApplicationSnapshotEntity {
  readonly component: StandardComponent;
  readonly entity: GraphEntity;
}

export type ExpectedApplicationComponentIdentity =
  { readonly present: false } | { readonly present: true; readonly value: unknown };

export interface ApplicationSnapshotStateDecoder {
  canonicalizeEntity(
    value: unknown,
    expected: Readonly<Pick<GraphEntity, "id" | "kind">>,
  ): Result<CanonicalApplicationSnapshotEntity>;
  canonicalizeRelationships(
    value: readonly GraphRelation[],
  ): Result<readonly StandardRelationship[]>;
  decode(value: unknown): Result<DecodedApplicationSnapshotState>;
  normalizeComponent(
    value: StandardComponentInput,
    expected: ExpectedApplicationComponentIdentity,
  ): Result<EntityDraft>;
  patchComponent(
    entity: GraphEntity,
    patch: StandardComponentPatch,
    expectedId: string,
  ): Result<CanonicalApplicationSnapshotEntity>;
}

type ApplicationSnapshotStateDecoderBounds = Readonly<
  Pick<
    ApplicationOperationBounds,
    | "maxComponents"
    | "maxDiagnosticCount"
    | "maxEmbeddedItems"
    | "maxRelationships"
    | "maxSnapshotStateDepth"
    | "maxSnapshotStateValues"
  >
>;

export interface ApplicationSnapshotStateDecoderMetadata {
  readonly bounds: ApplicationSnapshotStateDecoderBounds;
  readonly graph: GraphKernel;
  readonly isProxy: (value: unknown) => boolean;
  readonly model: StandardModelCapability;
}

const decoderMetadata = new WeakMap<object, ApplicationSnapshotStateDecoderMetadata>();
const canonicalComponents = new WeakSet<object>();
const canonicalRelationships = new WeakSet<object>();

function recordApplicationSnapshotStateDecoder(
  decoder: ApplicationSnapshotStateDecoder,
  metadata: ApplicationSnapshotStateDecoderMetadata,
): ApplicationSnapshotStateDecoder {
  decoderMetadata.set(decoder as object, Object.freeze({ ...metadata }));
  return decoder;
}

export function applicationSnapshotStateDecoderMetadata(
  value: unknown,
): ApplicationSnapshotStateDecoderMetadata | undefined {
  return typeof value === "object" && value !== null ? decoderMetadata.get(value) : undefined;
}

export function isCanonicalApplicationSnapshotComponent(value: unknown): boolean {
  return typeof value === "object" && value !== null && canonicalComponents.has(value);
}

export function isCanonicalApplicationSnapshotRelationship(value: unknown): boolean {
  return typeof value === "object" && value !== null && canonicalRelationships.has(value);
}

interface ApplicationSnapshotStateDecoderContext extends ApplicationSnapshotStateDecoderOptions {
  readonly invariant: TransactionInvariant;
  readonly zero: GraphGeneration;
}

function diagnostic(code: string, message: string) {
  return Object.freeze({ code, message });
}

const decoderFailureResult = Object.freeze({
  diagnostics: Object.freeze([
    diagnostic(
      "application-snapshot-decode-failed",
      "The application snapshot decoder could not safely decode provider state",
    ),
  ]),
  ok: false as const,
});

function decoderFailure<T = never>(): Result<T> {
  return decoderFailureResult;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const componentFields = new Set([
  "actions",
  "desired",
  "extensions",
  "id",
  "inputs",
  "intent",
  "kind",
  "lifecycle",
  "name",
  "outputs",
  "parent",
  "type",
]);
const componentRequiredFields = new Set(["extensions", "id", "kind"]);
const itemFields = new Set(["description", "extensions", "id", "name"]);
const itemRequiredFields = new Set(["extensions", "id"]);
const relationshipFields = new Set(["description", "extensions", "id", "source", "target", "type"]);
const relationshipRequiredFields = new Set(["extensions", "id", "source", "target", "type"]);
const extensionKeyPattern = /^[A-Za-z][A-Za-z0-9_.-]*(?::|\/)[A-Za-z][A-Za-z0-9_.-]*$/;
const openTokenPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const relationTokenPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const diagnosticCodePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const safeDiagnosticIdentityKeys = new Set(["componentId", "id", "parent", "source", "target"]);
const safeDiagnosticNumericKeys = new Set([
  "actual",
  "attempts",
  "limit",
  "maximum",
  "receivedLength",
  "sourceMessageLength",
]);
const safeDiagnosticBooleanKeys = new Set([
  "actualAbsent",
  "expectedAbsent",
  "overwritePrevented",
  "retryable",
]);
const safeDiagnosticDetailKeys = Object.freeze([
  ...safeDiagnosticIdentityKeys,
  ...safeDiagnosticNumericKeys,
  ...safeDiagnosticBooleanKeys,
  "path",
  "receivedType",
  "state",
]);
const safeReceivedTypes = new Set([
  "bigint",
  "boolean",
  "function",
  "number",
  "object",
  "string",
  "symbol",
  "undefined",
]);
const semanticPathPattern =
  /^(?:component|context|finalState|mutation|patch|priorState|request)(?:\.|\[|$)[A-Za-z0-9_.\[\]-]*$/;

interface ModelSuccessContext {
  embeddedItems: number;
  readonly isProxy: (value: unknown) => boolean;
  readonly options: ApplicationSnapshotStateDecoderContext;
  readonly structuralRemaining: { value: number };
}

function decoderBoundFailure(maximum: number): Result<never> {
  return Object.freeze({
    diagnostics: Object.freeze([
      Object.freeze({
        code: "application-bound-exceeded",
        details: Object.freeze({ maximum }),
        message: "Decoded model values exceed the configured item count",
      }),
    ]),
    ok: false as const,
  });
}

function modelDiagnosticDetails(
  value: unknown,
  context: ModelSuccessContext,
): Result<Readonly<Record<string, string | number | boolean>> | undefined> {
  if (value === undefined) return success(undefined);
  try {
    if (typeof value !== "object" || value === null || context.isProxy(value)) {
      return decoderFailure();
    }
    if (Array.isArray(value)) return decoderFailure();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return decoderFailure();
    const details = Object.create(null) as Record<string, string | number | boolean>;
    let count = 0;
    for (const key of safeDiagnosticDetailKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) continue;
      if (!("value" in descriptor) || !descriptor.enumerable) return decoderFailure();
      const detail = descriptor.value;
      let safe = false;
      if (safeDiagnosticIdentityKeys.has(key) && typeof detail === "string") {
        safe = parseEntityId(detail).ok || parseRelationId(detail).ok;
      } else if (safeDiagnosticNumericKeys.has(key) && typeof detail === "number") {
        safe = Number.isFinite(detail);
      } else if (safeDiagnosticBooleanKeys.has(key) && typeof detail === "boolean") {
        safe = true;
      } else if (key === "path" && typeof detail === "string") {
        safe = semanticPathPattern.test(detail);
      } else if (key === "receivedType" && typeof detail === "string") {
        safe = safeReceivedTypes.has(detail);
      } else if (key === "state" && typeof detail === "string") {
        safe = detail === "absent" || detail === "incompatible" || detail === "initialized";
      }
      if (safe) {
        Object.defineProperty(details, key, { enumerable: true, value: detail });
        count += 1;
      }
    }
    return success(count === 0 ? undefined : Object.freeze(details));
  } catch {
    return decoderFailure();
  }
}

function copiedModelFailure(value: unknown, context: ModelSuccessContext): Result<never> {
  try {
    if (typeof value !== "object" || value === null || context.isProxy(value)) {
      return decoderFailure();
    }
    const length = inspectIntrinsicArrayLength(
      value,
      "application-snapshot-decode-failed",
      "Standard Model diagnostics",
    );
    if (
      !length.ok ||
      length.value === 0 ||
      length.value > context.options.bounds.maxDiagnosticCount
    ) {
      return decoderFailure();
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length.value + 1) return decoderFailure();
    const diagnostics = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return decoderFailure();
      }
      const record = modelRecord(
        descriptor.value,
        new Set(["code", "details", "message"]),
        new Set(["code", "message"]),
        context,
      );
      if (
        !record.ok ||
        typeof record.value.code !== "string" ||
        record.value.code.length > 128 ||
        !diagnosticCodePattern.test(record.value.code) ||
        typeof record.value.message !== "string"
      ) {
        return decoderFailure();
      }
      const details = modelDiagnosticDetails(record.value.details, context);
      if (!details.ok) return decoderFailure();
      diagnostics[index] = Object.freeze({
        code: record.value.code,
        ...(details.value === undefined ? {} : { details: details.value }),
        message: "The Standard Model rejected decoded provider state",
      });
    }
    return Object.freeze({ diagnostics: Object.freeze(diagnostics), ok: false as const });
  } catch {
    return decoderFailure();
  }
}

function boundedDecoderResult<T>(
  value: Result<T>,
  options: ApplicationSnapshotStateDecoderContext,
): Result<T> {
  try {
    const inspected = inspectExactRecord(
      value,
      [
        ["ok", "value"],
        ["diagnostics", "ok"],
      ],
      "application-snapshot-decode-failed",
      "Application snapshot decoder result",
    );
    if (!inspected.ok) return decoderFailure();
    if (inspected.value.ok === true) return value;
    if (inspected.value.ok !== false) return decoderFailure();
    const diagnostics = inspectIntrinsicArrayLength(
      inspected.value.diagnostics,
      "application-snapshot-decode-failed",
      "Application snapshot decoder diagnostics",
    );
    if (
      !diagnostics.ok ||
      diagnostics.value === 0 ||
      diagnostics.value > options.bounds.maxDiagnosticCount
    ) {
      return decoderFailure();
    }
    return value;
  } catch {
    return decoderFailure();
  }
}

function modelRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
  required: ReadonlySet<string>,
  context: ModelSuccessContext,
): Result<Readonly<Record<string, unknown>>> {
  try {
    if (typeof value !== "object" || value === null || context.isProxy(value)) {
      return decoderFailure();
    }
    if (Array.isArray(value)) return decoderFailure();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return decoderFailure();
    const keys = Reflect.ownKeys(value);
    if (keys.length > allowed.size) return decoderFailure();
    const inspected = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return decoderFailure();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return decoderFailure();
      }
      Object.defineProperty(inspected, key, { enumerable: true, value: descriptor.value });
    }
    for (const key of required) {
      if (!Object.hasOwn(inspected, key)) return decoderFailure();
    }
    return success(Object.freeze(inspected));
  } catch {
    return decoderFailure();
  }
}

function preflightModelGraphData(
  value: unknown,
  depth: number,
  remaining: { value: number },
  active: WeakSet<object>,
  context: ModelSuccessContext,
): Result<void> {
  if (depth > context.options.bounds.maxSnapshotStateDepth || remaining.value < 1) {
    return decoderFailure();
  }
  remaining.value -= 1;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return success(undefined);
  }
  if (typeof value !== "object" || context.isProxy(value)) return decoderFailure();
  if (active.has(value)) return decoderFailure();
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return decoderFailure();
      const length = inspectIntrinsicArrayLength(
        value,
        "application-snapshot-decode-failed",
        "Decoded model extension array",
      );
      if (!length.ok || length.value > remaining.value) return decoderFailure();
      const keys = Reflect.ownKeys(value);
      if (keys.length !== length.value + 1) return decoderFailure();
      for (let index = 0; index < length.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          return decoderFailure();
        }
        const item = preflightModelGraphData(
          descriptor.value,
          depth + 1,
          remaining,
          active,
          context,
        );
        if (!item.ok) return item;
      }
      return success(undefined);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return decoderFailure();
    const keys = Reflect.ownKeys(value);
    if (keys.length > remaining.value) return decoderFailure();
    for (const key of keys) {
      if (typeof key !== "string") return decoderFailure();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return decoderFailure();
      }
      const child = preflightModelGraphData(
        descriptor.value,
        depth + 1,
        remaining,
        active,
        context,
      );
      if (!child.ok) return child;
    }
    return success(undefined);
  } finally {
    active.delete(value);
  }
}

function modelExtensions(
  value: unknown,
  context: ModelSuccessContext,
): Result<Readonly<Record<string, unknown>>> {
  try {
    if (typeof value !== "object" || value === null || context.isProxy(value)) {
      return decoderFailure();
    }
    if (Array.isArray(value)) return decoderFailure();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return decoderFailure();
    const keys = Reflect.ownKeys(value);
    if (keys.length > context.structuralRemaining.value) return decoderFailure();
    const extensions = Object.create(null) as Record<string, unknown>;
    const active = new WeakSet<object>();
    for (const key of keys) {
      if (typeof key !== "string" || !extensionKeyPattern.test(key)) return decoderFailure();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return decoderFailure();
      }
      const valid = preflightModelGraphData(
        descriptor.value,
        1,
        context.structuralRemaining,
        active,
        context,
      );
      if (!valid.ok) return valid;
      const copied = copyPreflightedModelGraphData(descriptor.value, context);
      if (!copied.ok) return copied;
      Object.defineProperty(extensions, key, { enumerable: true, value: copied.value });
    }
    return success(Object.freeze(extensions));
  } catch {
    return decoderFailure();
  }
}

function optionalModelString(
  record: Readonly<Record<string, unknown>>,
  field: string,
  tokenPattern?: RegExp,
): Result<string | undefined> {
  if (!Object.hasOwn(record, field)) return success(undefined);
  const value = record[field];
  return typeof value === "string" && (tokenPattern === undefined || tokenPattern.test(value))
    ? success(value)
    : decoderFailure();
}

function modelItems(
  value: unknown,
  context: ModelSuccessContext,
): Result<readonly Readonly<Record<string, unknown>>[] | undefined> {
  if (value === undefined) return success(undefined);
  try {
    if (typeof value !== "object" || value === null || context.isProxy(value)) {
      return decoderFailure();
    }
    const length = inspectIntrinsicArrayLength(
      value,
      "application-snapshot-decode-failed",
      "Decoded model items",
    );
    if (!length.ok) return decoderFailure();
    if (context.embeddedItems + length.value > context.options.bounds.maxEmbeddedItems) {
      return decoderBoundFailure(context.options.bounds.maxEmbeddedItems);
    }
    context.embeddedItems += length.value;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length.value + 1) return decoderFailure();
    const identities = new Set<string>();
    const items: Readonly<Record<string, unknown>>[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return decoderFailure();
      }
      const record = modelRecord(descriptor.value, itemFields, itemRequiredFields, context);
      if (!record.ok || typeof record.value.id !== "string" || record.value.id.length === 0) {
        return decoderFailure();
      }
      if (identities.has(record.value.id)) return decoderFailure();
      identities.add(record.value.id);
      const name = optionalModelString(record.value, "name");
      const description = optionalModelString(record.value, "description");
      const extensions = modelExtensions(record.value.extensions, context);
      if (!name.ok || !description.ok || !extensions.ok) return decoderFailure();
      items[index] = Object.freeze({
        id: record.value.id,
        ...(name.value === undefined ? {} : { name: name.value }),
        ...(description.value === undefined ? {} : { description: description.value }),
        extensions: extensions.value,
      });
    }
    items.sort((left, right) => compareText(left.id as string, right.id as string));
    return success(Object.freeze(items));
  } catch {
    return decoderFailure();
  }
}

function canonicalModelDataEqual(
  left: unknown,
  right: unknown,
  owner: "entity" | "relation",
  context: ModelSuccessContext,
): boolean {
  const budget = {
    code: "application-snapshot-decode-failed",
    maximumDepth: context.options.bounds.maxSnapshotStateDepth,
    maximumValues: context.options.bounds.maxSnapshotStateValues,
    message: "Decoded model values exceed the configured structural budget",
  };
  const leftCopy = copyCanonicalGraphData(left, owner, undefined, budget);
  const rightCopy = copyCanonicalGraphData(right, owner, undefined, budget);
  return (
    leftCopy.ok && rightCopy.ok && leftCopy.value.canonicalJson === rightCopy.value.canonicalJson
  );
}

function modelItemPayload(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id: value.id,
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(value.description === undefined ? {} : { description: value.description }),
    ...(value.extensions as Readonly<Record<string, unknown>>),
  });
}

function modelComponentPayload(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const items = (field: "actions" | "inputs" | "outputs") =>
    value[field] === undefined
      ? undefined
      : Object.freeze(
          (value[field] as readonly Readonly<Record<string, unknown>>[]).map(modelItemPayload),
        );
  const actions = items("actions");
  const inputs = items("inputs");
  const outputs = items("outputs");
  return Object.freeze({
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(value.type === undefined ? {} : { type: value.type }),
    ...(value.parent === undefined ? {} : { parent: value.parent }),
    ...(value.intent === undefined ? {} : { intent: value.intent }),
    ...(inputs === undefined ? {} : { inputs }),
    ...(outputs === undefined ? {} : { outputs }),
    ...(actions === undefined ? {} : { actions }),
    ...(value.lifecycle === undefined ? {} : { lifecycle: value.lifecycle }),
    ...(value.desired === undefined ? {} : { desired: value.desired }),
    ...(value.extensions as Readonly<Record<string, unknown>>),
  });
}

function modelRelationshipPayload(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...(value.description === undefined ? {} : { description: value.description }),
    ...(value.extensions as Readonly<Record<string, unknown>>),
  });
}

function modelSuccess(value: unknown, context: ModelSuccessContext): Result<unknown> {
  try {
    if (typeof value !== "object" || value === null || context.isProxy(value)) {
      return decoderFailure();
    }
    if (containNativePromise(value) !== "not-native") return decoderFailure();
    const inspected = inspectExactRecord(
      value,
      [
        ["ok", "value"],
        ["diagnostics", "ok"],
      ],
      "application-snapshot-decode-failed",
      "Standard Model result",
    );
    if (!inspected.ok) return decoderFailure();
    if (inspected.value.ok === true) {
      const modelValue = inspected.value.value;
      if (typeof modelValue === "object" && modelValue !== null) {
        if (context.isProxy(modelValue)) return decoderFailure();
        if (containNativePromise(modelValue) !== "not-native") return decoderFailure();
      }
      return success(modelValue);
    }
    return inspected.value.ok === false
      ? copiedModelFailure(inspected.value.diagnostics, context)
      : decoderFailure();
  } catch {
    return decoderFailure();
  }
}

function modelComponent(
  value: unknown,
  entity: GraphEntity,
  context: ModelSuccessContext,
): Result<Readonly<Record<string, unknown>>> {
  const record = modelRecord(value, componentFields, componentRequiredFields, context);
  if (!record.ok) return record;
  if (typeof record.value.id !== "string") return decoderFailure();
  const id = parseEntityId(record.value.id);
  if (!id.ok || id.value !== entity.id) return decoderFailure();
  if (record.value.kind !== STANDARD_COMPONENT_KIND || record.value.kind !== entity.kind) {
    return decoderFailure();
  }
  const name = optionalModelString(record.value, "name");
  const type = optionalModelString(record.value, "type", openTokenPattern);
  const intent = optionalModelString(record.value, "intent");
  const lifecycle = optionalModelString(record.value, "lifecycle", openTokenPattern);
  const desired = optionalModelString(record.value, "desired", openTokenPattern);
  if (!name.ok || !type.ok || !intent.ok || !lifecycle.ok || !desired.ok) {
    return decoderFailure();
  }
  let parent: string | undefined;
  if (Object.hasOwn(record.value, "parent")) {
    if (typeof record.value.parent !== "string") return decoderFailure();
    const parsed = parseEntityId(record.value.parent);
    if (!parsed.ok) return decoderFailure();
    parent = parsed.value;
  }
  const inputs = modelItems(record.value.inputs, context);
  if (!inputs.ok) return inputs;
  const outputs = modelItems(record.value.outputs, context);
  if (!outputs.ok) return outputs;
  const actions = modelItems(record.value.actions, context);
  if (!actions.ok) return actions;
  const extensions = modelExtensions(record.value.extensions, context);
  if (!extensions.ok) return extensions;
  const component = Object.freeze({
    id: id.value,
    kind: STANDARD_COMPONENT_KIND,
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
  });
  return canonicalModelDataEqual(
    modelComponentPayload(component),
    entity.payload,
    "entity",
    context,
  )
    ? success(component)
    : decoderFailure();
}

function modelRelationship(
  value: unknown,
  expected: ReadonlyMap<string, GraphRelation>,
  context: ModelSuccessContext,
): Result<Readonly<Record<string, unknown>>> {
  const record = modelRecord(value, relationshipFields, relationshipRequiredFields, context);
  if (!record.ok || typeof record.value.id !== "string") return decoderFailure();
  const id = parseRelationId(record.value.id);
  if (!id.ok) return decoderFailure();
  const relation = expected.get(id.value);
  if (relation === undefined) return decoderFailure();
  if (
    typeof record.value.type !== "string" ||
    !relationTokenPattern.test(record.value.type) ||
    record.value.type !== relation.type ||
    typeof record.value.source !== "string" ||
    typeof record.value.target !== "string"
  ) {
    return decoderFailure();
  }
  const source = parseEntityId(record.value.source);
  const target = parseEntityId(record.value.target);
  if (
    !source.ok ||
    !target.ok ||
    source.value !== relation.source ||
    target.value !== relation.target
  ) {
    return decoderFailure();
  }
  const description = optionalModelString(record.value, "description");
  const extensions = modelExtensions(record.value.extensions, context);
  if (!description.ok || !extensions.ok) return decoderFailure();
  const relationship = Object.freeze({
    id: id.value,
    type: relation.type,
    source: relation.source,
    target: relation.target,
    ...(description.value === undefined ? {} : { description: description.value }),
    extensions: extensions.value,
  });
  return canonicalModelDataEqual(
    modelRelationshipPayload(relationship),
    relation.payload,
    "relation",
    context,
  )
    ? success(relationship)
    : decoderFailure();
}

function modelRelationships(
  value: unknown,
  relations: readonly GraphRelation[],
  context: ModelSuccessContext,
): Result<readonly Readonly<Record<string, unknown>>[]> {
  try {
    if (typeof value !== "object" || value === null || context.isProxy(value)) {
      return decoderFailure();
    }
    const length = inspectIntrinsicArrayLength(
      value,
      "application-snapshot-decode-failed",
      "Decoded model relationships",
    );
    if (!length.ok || length.value !== relations.length) return decoderFailure();
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length.value + 1) return decoderFailure();
    const expected = new Map<string, GraphRelation>();
    for (const relation of relations) expected.set(relation.id, relation);
    const seen = new Set<string>();
    const copied: Readonly<Record<string, unknown>>[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return decoderFailure();
      }
      const relationship = modelRelationship(descriptor.value, expected, context);
      if (!relationship.ok) return relationship;
      const id = relationship.value.id as string;
      if (seen.has(id)) return decoderFailure();
      seen.add(id);
      copied[index] = relationship.value;
    }
    copied.sort((left, right) => compareText(left.id as string, right.id as string));
    return success(Object.freeze(copied));
  } catch {
    return decoderFailure();
  }
}

function copyModelSuccessValues(
  components: readonly Readonly<Record<string, unknown>>[],
  relationships: readonly Readonly<Record<string, unknown>>[],
  context: ModelSuccessContext,
): Result<{
  readonly components: readonly StandardComponent[];
  readonly relationships: readonly StandardRelationship[];
}> {
  const copied = copyGraphPayload(Object.freeze({ components, relationships }), "transaction", {
    code: "application-snapshot-decode-failed",
    maximumDepth: context.options.bounds.maxSnapshotStateDepth,
    maximumValues: context.options.bounds.maxSnapshotStateValues,
    message: "Decoded model values exceed the configured structural budget",
  });
  if (!copied.ok) return decoderFailure();
  const envelope = inspectExactRecord(
    copied.value,
    [["components", "relationships"]],
    "application-snapshot-decode-failed",
    "Decoded model values",
  );
  if (
    !envelope.ok ||
    !Array.isArray(envelope.value.components) ||
    !Array.isArray(envelope.value.relationships)
  ) {
    return decoderFailure();
  }
  const canonicalComponentValues = envelope.value.components as readonly StandardComponent[];
  const canonicalRelationshipValues = envelope.value
    .relationships as readonly StandardRelationship[];
  for (const component of canonicalComponentValues) canonicalComponents.add(component as object);
  for (const relationship of canonicalRelationshipValues) {
    canonicalRelationships.add(relationship as object);
  }
  return success(
    Object.freeze({
      components: canonicalComponentValues,
      relationships: canonicalRelationshipValues,
    }),
  );
}

function boundaryContext(options: ApplicationSnapshotStateDecoderContext): ModelSuccessContext {
  return {
    embeddedItems: 0,
    isProxy: options.isProxy,
    options,
    structuralRemaining: { value: options.bounds.maxSnapshotStateValues },
  };
}

function copyPreflightedModelGraphData(
  value: unknown,
  context: ModelSuccessContext,
): Result<GraphData> {
  const copied = copyGraphPayload(value, "entity", {
    code: "application-snapshot-decode-failed",
    maximumDepth: context.options.bounds.maxSnapshotStateDepth,
    maximumValues: context.options.bounds.maxSnapshotStateValues,
    message: "Standard Model value exceeds the configured structural budget",
  });
  return copied.ok ? copied : decoderFailure();
}

function copyBoundaryGraphData(value: unknown, context: ModelSuccessContext): Result<GraphData> {
  if (typeof value === "object" && value !== null && context.isProxy(value)) {
    return decoderFailure();
  }
  const safe = preflightModelGraphData(
    value,
    1,
    { value: context.options.bounds.maxSnapshotStateValues },
    new WeakSet<object>(),
    context,
  );
  return safe.ok ? copyPreflightedModelGraphData(value, context) : safe;
}

function copyModelEntityDraft(
  value: unknown,
  expected: ExpectedApplicationComponentIdentity,
  context: ModelSuccessContext,
): Result<EntityDraft> {
  if (typeof value === "object" && value !== null && context.isProxy(value)) {
    return decoderFailure();
  }
  const inspected = inspectExactRecord(
    value,
    [
      ["kind", "payload"],
      ["id", "kind", "payload"],
    ],
    "application-snapshot-decode-failed",
    "Standard Model entity draft",
  );
  if (!inspected.ok || inspected.value.kind !== STANDARD_COMPONENT_KIND) {
    return decoderFailure();
  }
  const hasId = Object.hasOwn(inspected.value, "id");
  let id: GraphEntity["id"] | undefined;
  if (expected.present) {
    if (typeof expected.value !== "string" || !hasId || inspected.value.id !== expected.value) {
      return decoderFailure();
    }
    const parsed = parseEntityId(expected.value);
    if (!parsed.ok) return decoderFailure();
    id = parsed.value;
  } else if (hasId) {
    return decoderFailure();
  }
  const payload = copyBoundaryGraphData(inspected.value.payload, context);
  if (!payload.ok) return payload;
  return success(
    Object.freeze({
      ...(id === undefined ? {} : { id }),
      kind: STANDARD_COMPONENT_KIND,
      payload: payload.value,
    }),
  );
}

function canonicalizeEntity(
  value: unknown,
  expected: Readonly<Pick<GraphEntity, "id" | "kind">>,
  options: ApplicationSnapshotStateDecoderContext,
): Result<CanonicalApplicationSnapshotEntity> {
  if (expected.kind !== STANDARD_COMPONENT_KIND) return decoderFailure();
  const context = boundaryContext(options);
  const draft = copyModelEntityDraft(value, { present: true, value: expected.id }, context);
  if (!draft.ok || draft.value.id === undefined) return decoderFailure();
  const entity: GraphEntity = Object.freeze({
    id: expected.id,
    kind: STANDARD_COMPONENT_KIND,
    payload: draft.value.payload as GraphData,
  });
  let rawParsed: unknown;
  try {
    rawParsed = options.model.parse(entity);
  } catch {
    return decoderFailure();
  }
  const parsed = modelSuccess(rawParsed, context);
  if (!parsed.ok) return parsed;
  const component = modelComponent(parsed.value, entity, context);
  if (!component.ok) return component;
  const canonical = copyModelSuccessValues([component.value], [], context);
  if (!canonical.ok || canonical.value.components.length !== 1) return decoderFailure();
  return success(
    Object.freeze({
      component: canonical.value.components[0]!,
      entity,
    }),
  );
}

function normalizeComponent(
  value: StandardComponentInput,
  expected: ExpectedApplicationComponentIdentity,
  options: ApplicationSnapshotStateDecoderContext,
): Result<EntityDraft> {
  const context = boundaryContext(options);
  const copiedInput = copyBoundaryGraphData(value, context);
  if (
    !copiedInput.ok ||
    typeof copiedInput.value !== "object" ||
    copiedInput.value === null ||
    Array.isArray(copiedInput.value)
  ) {
    return decoderFailure();
  }
  let rawNormalized: unknown;
  try {
    rawNormalized = options.model.normalize(copiedInput.value as StandardComponentInput);
  } catch {
    return decoderFailure();
  }
  const normalized = modelSuccess(rawNormalized, context);
  return normalized.ok ? copyModelEntityDraft(normalized.value, expected, context) : normalized;
}

function patchComponent(
  entityValue: GraphEntity,
  patchValue: StandardComponentPatch,
  expectedId: string,
  options: ApplicationSnapshotStateDecoderContext,
): Result<CanonicalApplicationSnapshotEntity> {
  const context = boundaryContext(options);
  const expected = parseEntityId(expectedId);
  if (!expected.ok) return decoderFailure();
  const current = copyModelEntityDraft(
    entityValue,
    { present: true, value: expected.value },
    context,
  );
  if (!current.ok || current.value.id === undefined) return decoderFailure();
  const patch = copyBoundaryGraphData(patchValue, context);
  if (
    !patch.ok ||
    typeof patch.value !== "object" ||
    patch.value === null ||
    Array.isArray(patch.value)
  ) {
    return decoderFailure();
  }
  const entity: GraphEntity = Object.freeze({
    id: expected.value,
    kind: STANDARD_COMPONENT_KIND,
    payload: current.value.payload as GraphData,
  });
  let rawPatched: unknown;
  try {
    rawPatched = options.model.patch(entity, patch.value as StandardComponentPatch);
  } catch {
    return decoderFailure();
  }
  const patched = modelSuccess(rawPatched, context);
  if (!patched.ok) return patched;
  const draft = copyModelEntityDraft(
    patched.value,
    { present: true, value: expected.value },
    context,
  );
  if (!draft.ok || draft.value.id === undefined) return decoderFailure();
  return canonicalizeEntity(
    Object.freeze({
      id: expected.value,
      kind: STANDARD_COMPONENT_KIND,
      payload: draft.value.payload,
    }),
    { id: expected.value, kind: STANDARD_COMPONENT_KIND },
    options,
  );
}

function copyRelationshipInputs(
  relations: readonly GraphRelation[],
  context: ModelSuccessContext,
): Result<readonly GraphRelation[]> {
  const copied = copyBoundaryGraphData(relations, context);
  if (!copied.ok || !Array.isArray(copied.value)) return decoderFailure();
  if (copied.value.length > context.options.bounds.maxRelationships) {
    return decoderBoundFailure(context.options.bounds.maxRelationships);
  }
  const inputs: GraphRelation[] = [];
  for (let index = 0; index < copied.value.length; index += 1) {
    const record = inspectExactRecord(
      copied.value[index],
      [["id", "payload", "source", "target", "type"]],
      "application-snapshot-decode-failed",
      `Standard Model relationship input ${index}`,
    );
    if (!record.ok) return decoderFailure();
    if (
      typeof record.value.id !== "string" ||
      typeof record.value.source !== "string" ||
      typeof record.value.target !== "string" ||
      typeof record.value.type !== "string" ||
      !relationTokenPattern.test(record.value.type)
    ) {
      return decoderFailure();
    }
    const id = parseRelationId(record.value.id);
    const source = parseEntityId(record.value.source);
    const target = parseEntityId(record.value.target);
    if (!id.ok || !source.ok || !target.ok) {
      return decoderFailure();
    }
    inputs[index] = Object.freeze({
      id: id.value,
      payload: record.value.payload as GraphData,
      source: source.value,
      target: target.value,
      type: record.value.type,
    });
  }
  return success(Object.freeze(inputs));
}

function modelRelationshipValues(
  relations: readonly GraphRelation[],
  context: ModelSuccessContext,
): Result<readonly Readonly<Record<string, unknown>>[]> {
  const copied = copyRelationshipInputs(relations, context);
  if (!copied.ok) return copied;
  let rawRelationships: unknown;
  try {
    rawRelationships = context.options.model.relationships(copied.value);
  } catch {
    return decoderFailure();
  }
  const result = modelSuccess(rawRelationships, context);
  if (!result.ok) return result;
  return modelRelationships(result.value, copied.value, context);
}

function canonicalizeRelationships(
  relations: readonly GraphRelation[],
  options: ApplicationSnapshotStateDecoderContext,
): Result<readonly StandardRelationship[]> {
  const context = boundaryContext(options);
  const relationships = modelRelationshipValues(relations, context);
  if (!relationships.ok) return relationships;
  const canonical = copyModelSuccessValues([], relationships.value, context);
  return canonical.ok ? success(canonical.value.relationships) : canonical;
}

function denseArray(
  value: unknown,
  subject: string,
  maximum: number,
  isProxy: (value: unknown) => boolean,
): Result<readonly unknown[]> {
  if (typeof value === "object" && value !== null && isProxy(value)) {
    return failure(diagnostic("invalid-standard-model-state", `${subject} must not be a proxy`));
  }
  const length = inspectIntrinsicArrayLength(value, "invalid-standard-model-state", subject);
  if (!length.ok) return length;
  if (length.value > maximum) {
    return failure(
      Object.freeze({
        code: "application-bound-exceeded",
        details: Object.freeze({ maximum }),
        message: `${subject} exceeds the configured item count`,
      }),
    );
  }
  try {
    const keys = Reflect.ownKeys(value as object);
    if (keys.length !== length.value + 1) {
      return failure(diagnostic("invalid-standard-model-state", `${subject} must be dense`));
    }
    const items = new Array<unknown>(length.value);
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          diagnostic("invalid-standard-model-state", `${subject} entries must be data properties`),
        );
      }
      items[index] = descriptor.value;
    }
    return success(Object.freeze(items));
  } catch {
    return failure(
      diagnostic("invalid-standard-model-state", `${subject} could not be inspected safely`),
    );
  }
}

function decode(
  rawValue: unknown,
  options: ApplicationSnapshotStateDecoderContext,
): Result<DecodedApplicationSnapshotState> {
  const contained = containCapabilityValue(rawValue, {
    isProxy: options.isProxy,
    maximumContainerEntries: options.bounds.maxSnapshotStateValues,
    maximumDepth: options.bounds.maxSnapshotStateDepth,
    maximumValues: options.bounds.maxSnapshotStateValues,
  });
  if (!contained.ok) {
    return failure(
      diagnostic("invalid-standard-model-state", "Snapshot state could not be inspected safely"),
    );
  }
  const value = contained.value;
  if (typeof value === "object" && value !== null && options.isProxy(value)) {
    return failure(
      diagnostic("invalid-standard-model-state", "Snapshot state must not be a proxy"),
    );
  }
  const rawEnvelope = inspectExactRecord(
    value,
    [["components", "relationships"]],
    "invalid-standard-model-state",
    "Standard Model transaction state",
  );
  if (!rawEnvelope.ok) return rawEnvelope;
  const rawComponents = denseArray(
    rawEnvelope.value.components,
    "Standard Model transaction state components",
    options.bounds.maxComponents,
    options.isProxy,
  );
  if (!rawComponents.ok) return rawComponents;
  const rawRelationships = denseArray(
    rawEnvelope.value.relationships,
    "Standard Model transaction state relationships",
    options.bounds.maxRelationships,
    options.isProxy,
  );
  if (!rawRelationships.ok) return rawRelationships;
  for (const entry of rawComponents.value) {
    if (typeof entry === "object" && entry !== null && options.isProxy(entry)) {
      return failure(
        diagnostic("invalid-standard-model-state", "Component state must not be a proxy"),
      );
    }
    const record = inspectExactRecord(
      entry,
      [["id", "kind", "payload"]],
      "invalid-standard-model-state",
      "Standard Model component",
    );
    if (!record.ok) return record;
    if (
      typeof record.value.payload === "object" &&
      record.value.payload !== null &&
      options.isProxy(record.value.payload)
    ) {
      return failure(
        diagnostic("invalid-standard-model-state", "Component payload must not be a proxy"),
      );
    }
  }
  for (const entry of rawRelationships.value) {
    if (typeof entry === "object" && entry !== null && options.isProxy(entry)) {
      return failure(
        diagnostic("invalid-standard-model-state", "Relationship state must not be a proxy"),
      );
    }
    const record = inspectExactRecord(
      entry,
      [["id", "payload", "source", "target", "type"]],
      "invalid-standard-model-state",
      "Standard Model relationship",
    );
    if (!record.ok) return record;
    if (
      typeof record.value.payload === "object" &&
      record.value.payload !== null &&
      options.isProxy(record.value.payload)
    ) {
      return failure(
        diagnostic("invalid-standard-model-state", "Relationship payload must not be a proxy"),
      );
    }
  }
  const copied = copyGraphPayload(value, "transaction", {
    code: "application-snapshot-state-too-large",
    maximumDepth: options.bounds.maxSnapshotStateDepth,
    maximumValues: options.bounds.maxSnapshotStateValues,
    message: "Transaction snapshot state exceeds the configured structural budget",
  });
  if (!copied.ok) return copied;
  const envelope = inspectExactRecord(
    copied.value,
    [["components", "relationships"]],
    "invalid-standard-model-state",
    "Standard Model transaction state",
  );
  if (!envelope.ok) return envelope;
  const componentValues = denseArray(
    envelope.value.components,
    "Standard Model transaction state components",
    options.bounds.maxComponents,
    options.isProxy,
  );
  if (!componentValues.ok) return componentValues;
  const relationshipValues = denseArray(
    envelope.value.relationships,
    "Standard Model transaction state relationships",
    options.bounds.maxRelationships,
    options.isProxy,
  );
  if (!relationshipValues.ok) return relationshipValues;

  const entityDrafts: EntityDraft[] = [];
  for (let index = 0; index < componentValues.value.length; index += 1) {
    const record = inspectExactRecord(
      componentValues.value[index],
      [["id", "kind", "payload"]],
      "invalid-standard-model-state",
      `Standard Model component ${index}`,
    );
    if (!record.ok) return record;
    entityDrafts[index] = Object.freeze({
      id: record.value.id as string,
      kind: record.value.kind as string,
      payload: record.value.payload,
    });
  }
  const relationDrafts = [];
  for (let index = 0; index < relationshipValues.value.length; index += 1) {
    const record = inspectExactRecord(
      relationshipValues.value[index],
      [["id", "payload", "source", "target", "type"]],
      "invalid-standard-model-state",
      `Standard Model relationship ${index}`,
    );
    if (!record.ok) return record;
    relationDrafts[index] = Object.freeze({
      id: record.value.id as string,
      payload: record.value.payload,
      source: Object.freeze({ id: record.value.source as string }),
      target: Object.freeze({ id: record.value.target as string }),
      type: record.value.type as string,
    });
  }

  const invariantDiagnostics = options.invariant.validate(
    Object.freeze({
      affected: Object.freeze({ entities: Object.freeze([]), relations: Object.freeze([]) }),
      baseGeneration: options.zero,
      context: Object.freeze({
        ownership: Object.freeze({ owner: "groma.application.snapshot", plane: "intent" }),
        pinnedComponentIds: Object.freeze([]),
      }),
      expectedRevisions: Object.freeze([]),
      generation: options.zero,
      mutation: Object.freeze({ components: Object.freeze([]), relationships: Object.freeze([]) }),
      priorState: copied.value,
    }) as ProposedTransaction,
  );
  if (invariantDiagnostics.length > 0) return failure(...invariantDiagnostics);

  const loaded = options.graph.load(entityDrafts, relationDrafts);
  if (!loaded.ok) return loaded;
  const structuralRemaining = { value: options.bounds.maxSnapshotStateValues };
  const modelContext: ModelSuccessContext = {
    embeddedItems: 0,
    isProxy: options.isProxy,
    options,
    structuralRemaining,
  };
  const components: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < entityDrafts.length; index += 1) {
    const componentContext: ModelSuccessContext = {
      embeddedItems: 0,
      isProxy: options.isProxy,
      options,
      structuralRemaining,
    };
    const draft = entityDrafts[index]!;
    const resolved = options.graph.resolveEntity(loaded.value, {
      expectedKind: STANDARD_COMPONENT_KIND,
      id: draft.id!,
    });
    if (!resolved.ok) return resolved;
    const parsed = modelSuccess(options.model.parse(resolved.value), componentContext);
    if (!parsed.ok) return parsed;
    const component = modelComponent(parsed.value, resolved.value, componentContext);
    if (!component.ok) return component;
    components[index] = component.value;
  }
  components.sort((left, right) => compareText(left.id as string, right.id as string));
  const graphRelations: GraphRelation[] = [];
  for (let index = 0; index < relationDrafts.length; index += 1) {
    const relation = options.graph.resolveRelation(loaded.value, relationDrafts[index]!.id!);
    if (!relation.ok) return relation;
    graphRelations[index] = relation.value;
  }
  const relationships = modelRelationshipValues(graphRelations, modelContext);
  if (!relationships.ok) return relationships;
  const canonical = copyModelSuccessValues(components, relationships.value, modelContext);
  if (!canonical.ok) return canonical;
  return success(
    Object.freeze({
      components: canonical.value.components,
      graph: loaded.value,
      relationships: canonical.value.relationships,
    }),
  );
}

export function createApplicationSnapshotStateDecoder(
  options: ApplicationSnapshotStateDecoderOptions,
): ApplicationSnapshotStateDecoder {
  const isProxy = options?.isProxy;
  if (typeof isProxy !== "function") {
    throw new TypeError("isProxy must be a function");
  }
  const zero = parseGraphGeneration(0);
  if (!zero.ok) throw new Error("zero graph generation must be valid");
  const bounds: ApplicationSnapshotStateDecoderBounds = Object.freeze({ ...options.bounds });
  const copied: ApplicationSnapshotStateDecoderContext = Object.freeze({
    bounds,
    graph: options.graph,
    invariant: createStandardModelInvariant({
      maxComponentMutations: Math.max(1, bounds.maxComponents),
      maxComponents: bounds.maxComponents,
      maxOwnerCharacters: 128,
      maxPinnedComponentIds: 1,
      maxRelationshipMutations: Math.max(1, bounds.maxRelationships),
      maxRelationships: bounds.maxRelationships,
    }),
    isProxy,
    model: options.model,
    zero: zero.value,
  });
  const decoder = Object.freeze({
    canonicalizeEntity: (value: unknown, expected: Readonly<Pick<GraphEntity, "id" | "kind">>) => {
      try {
        return boundedDecoderResult(canonicalizeEntity(value, expected, copied), copied);
      } catch {
        return decoderFailure();
      }
    },
    canonicalizeRelationships: (value: readonly GraphRelation[]) => {
      try {
        return boundedDecoderResult(canonicalizeRelationships(value, copied), copied);
      } catch {
        return decoderFailure();
      }
    },
    decode: (value: unknown) => {
      try {
        return boundedDecoderResult(decode(value, copied), copied);
      } catch {
        return decoderFailure();
      }
    },
    normalizeComponent: (
      value: StandardComponentInput,
      expected: ExpectedApplicationComponentIdentity,
    ) => {
      try {
        return boundedDecoderResult(normalizeComponent(value, expected, copied), copied);
      } catch {
        return decoderFailure();
      }
    },
    patchComponent: (entity: GraphEntity, patch: StandardComponentPatch, expectedId: string) => {
      try {
        return boundedDecoderResult(patchComponent(entity, patch, expectedId, copied), copied);
      } catch {
        return decoderFailure();
      }
    },
  });
  return recordApplicationSnapshotStateDecoder(decoder, {
    bounds,
    graph: options.graph,
    isProxy,
    model: options.model,
  });
}
