import {
  failure,
  parseGraphGeneration,
  success,
  type EntityDraft,
  type GraphRelation,
  type GraphSnapshot,
  type GraphGeneration,
  type ProposedTransaction,
  type Result,
  type TransactionInvariant,
} from "../core/index.ts";
import { copyGraphPayload } from "../core/payload.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "../core/runtime.ts";
import {
  createStandardModelInvariant,
  STANDARD_COMPONENT_KIND,
  type StandardComponent,
  type StandardModelCapability,
  type StandardRelationship,
} from "../standard-model/index.ts";
import type { ApplicationOperationBounds } from "./contracts.ts";
import type { GraphKernel } from "../core/index.ts";

export interface ApplicationSnapshotStateDecoderOptions {
  readonly bounds: Pick<
    ApplicationOperationBounds,
    | "maxComponents"
    | "maxEmbeddedItems"
    | "maxRelationships"
    | "maxSnapshotStateDepth"
    | "maxSnapshotStateValues"
  >;
  readonly graph: GraphKernel;
  readonly isProxy?: (value: unknown) => boolean;
  readonly model: StandardModelCapability;
}

export interface DecodedApplicationSnapshotState {
  readonly components: readonly StandardComponent[];
  readonly graph: GraphSnapshot;
  readonly relationships: readonly StandardRelationship[];
}

export interface ApplicationSnapshotStateDecoder {
  decode(value: unknown): Result<DecodedApplicationSnapshotState>;
}

type ApplicationSnapshotStateDecoderBounds = Readonly<
  Pick<
    ApplicationOperationBounds,
    | "maxComponents"
    | "maxEmbeddedItems"
    | "maxRelationships"
    | "maxSnapshotStateDepth"
    | "maxSnapshotStateValues"
  >
>;

export interface ApplicationSnapshotStateDecoderMetadata {
  readonly bounds: ApplicationSnapshotStateDecoderBounds;
  readonly graph: GraphKernel;
  readonly isProxy: ((value: unknown) => boolean) | undefined;
  readonly model: StandardModelCapability;
}

const decoderMetadata = new WeakMap<object, ApplicationSnapshotStateDecoderMetadata>();

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

interface ApplicationSnapshotStateDecoderContext extends ApplicationSnapshotStateDecoderOptions {
  readonly invariant: TransactionInvariant;
  readonly zero: GraphGeneration;
}

function diagnostic(code: string, message: string) {
  return Object.freeze({ code, message });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function embeddedItemCount(component: StandardComponent): number {
  return (
    (component.actions?.length ?? 0) +
    (component.inputs?.length ?? 0) +
    (component.outputs?.length ?? 0)
  );
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
  value: unknown,
  options: ApplicationSnapshotStateDecoderContext,
): Result<DecodedApplicationSnapshotState> {
  const isProxy = options.isProxy ?? (() => false);
  if (typeof value === "object" && value !== null && isProxy(value)) {
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
    isProxy,
  );
  if (!rawComponents.ok) return rawComponents;
  const rawRelationships = denseArray(
    rawEnvelope.value.relationships,
    "Standard Model transaction state relationships",
    options.bounds.maxRelationships,
    isProxy,
  );
  if (!rawRelationships.ok) return rawRelationships;
  for (const entry of rawComponents.value) {
    if (typeof entry === "object" && entry !== null && isProxy(entry)) {
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
      isProxy(record.value.payload)
    ) {
      return failure(
        diagnostic("invalid-standard-model-state", "Component payload must not be a proxy"),
      );
    }
  }
  for (const entry of rawRelationships.value) {
    if (typeof entry === "object" && entry !== null && isProxy(entry)) {
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
      isProxy(record.value.payload)
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
    isProxy,
  );
  if (!componentValues.ok) return componentValues;
  const relationshipValues = denseArray(
    envelope.value.relationships,
    "Standard Model transaction state relationships",
    options.bounds.maxRelationships,
    isProxy,
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
  const components: StandardComponent[] = [];
  for (let index = 0; index < entityDrafts.length; index += 1) {
    const draft = entityDrafts[index]!;
    const resolved = options.graph.resolveEntity(loaded.value, {
      expectedKind: STANDARD_COMPONENT_KIND,
      id: draft.id!,
    });
    if (!resolved.ok) return resolved;
    const component = options.model.parse(resolved.value);
    if (!component.ok) return component;
    if (embeddedItemCount(component.value) > options.bounds.maxEmbeddedItems) {
      return failure(
        Object.freeze({
          code: "application-bound-exceeded",
          details: Object.freeze({ maximum: options.bounds.maxEmbeddedItems }),
          message: "Embedded component items exceed the configured item count",
        }),
      );
    }
    components[index] = component.value;
  }
  components.sort((left, right) => compareText(left.id, right.id));
  const graphRelations: GraphRelation[] = [];
  for (let index = 0; index < relationDrafts.length; index += 1) {
    const relation = options.graph.resolveRelation(loaded.value, relationDrafts[index]!.id!);
    if (!relation.ok) return relation;
    graphRelations[index] = relation.value;
  }
  const relationships = options.model.relationships(graphRelations);
  if (!relationships.ok) return relationships;
  return success(
    Object.freeze({
      components: Object.freeze(components),
      graph: loaded.value,
      relationships: relationships.value,
    }),
  );
}

export function createApplicationSnapshotStateDecoder(
  options: ApplicationSnapshotStateDecoderOptions,
): ApplicationSnapshotStateDecoder {
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
    ...(options.isProxy === undefined ? {} : { isProxy: options.isProxy }),
    model: options.model,
    zero: zero.value,
  });
  const decoder = Object.freeze({ decode: (value: unknown) => decode(value, copied) });
  return recordApplicationSnapshotStateDecoder(decoder, {
    bounds,
    graph: options.graph,
    isProxy: options.isProxy,
    model: options.model,
  });
}
