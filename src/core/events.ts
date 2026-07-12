import { nextGraphGeneration, parseGraphGeneration, type GraphGeneration } from "./generation.ts";
import { parseEntityId, parseRelationId, type EntityId, type RelationId } from "./identity.ts";
import { failure, type Result, success } from "./result.ts";
import { inspectExactRecord } from "./runtime.ts";

export interface AffectedGraphIdentities {
  readonly entities: readonly EntityId[];
  readonly relations: readonly RelationId[];
}

export interface GraphCommittedEvent {
  readonly affected: AffectedGraphIdentities;
  readonly generation: GraphGeneration;
  readonly type: "graph.committed";
}

export type GenerationGapReason = "duplicate" | "missed" | "reversed";

export interface GraphEventAccepted {
  readonly generation: GraphGeneration;
  readonly status: "accepted";
}

export interface GraphRefetchRequired {
  readonly action: "refetch";
  readonly currentGeneration: GraphGeneration;
  readonly expectedGeneration?: GraphGeneration;
  readonly reason: GenerationGapReason;
  readonly receivedGeneration: GraphGeneration;
  readonly status: "refetch-required";
}

export type GraphEventSequence = GraphEventAccepted | GraphRefetchRequired;

export interface AffectedIdentityInput {
  readonly entities?: readonly string[];
  readonly relations?: readonly string[];
}

function uniqueSorted<TIdentity extends string>(
  values: readonly TIdentity[],
): readonly TIdentity[] {
  return Object.freeze([...new Set(values)].sort());
}

export function createGraphCommittedEvent(
  generationValue: unknown,
  affectedInput: unknown,
): Result<GraphCommittedEvent> {
  const generation = parseGraphGeneration(generationValue);
  if (!generation.ok) return generation;
  const affected = inspectExactRecord(
    affectedInput,
    [[], ["entities"], ["relations"], ["entities", "relations"]],
    "invalid-affected-identities",
    "Affected graph identities",
  );
  if (!affected.ok) return affected;
  const entityCandidates = inspectIdentityArray(
    affected.value.entities,
    "entities" in affected.value,
    "entity",
  );
  if (!entityCandidates.ok) return entityCandidates;
  const relationCandidates = inspectIdentityArray(
    affected.value.relations,
    "relations" in affected.value,
    "relation",
  );
  if (!relationCandidates.ok) return relationCandidates;
  const entities: EntityId[] = [];
  for (const candidate of entityCandidates.value) {
    const identity = parseEntityId(candidate);
    if (!identity.ok) return identity;
    entities.push(identity.value);
  }
  const relations: RelationId[] = [];
  for (const candidate of relationCandidates.value) {
    const identity = parseRelationId(candidate);
    if (!identity.ok) return identity;
    relations.push(identity.value);
  }

  return success(
    Object.freeze({
      affected: Object.freeze({
        entities: uniqueSorted(entities),
        relations: uniqueSorted(relations),
      }),
      generation: generation.value,
      type: "graph.committed" as const,
    }),
  );
}

function inspectIdentityArray(
  value: unknown,
  present: boolean,
  identityKind: "entity" | "relation",
): Result<readonly string[]> {
  if (!present) return success(Object.freeze([]));
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return failure({
        code: "invalid-affected-identities",
        message: `Affected ${identityKind} identities must be an intrinsic array`,
      });
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      return failure({
        code: "invalid-affected-identities",
        message: `Affected ${identityKind} identities must not contain symbol properties`,
      });
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return failure({
        code: "invalid-affected-identities",
        message: `Affected ${identityKind} identities have an invalid array length`,
      });
    }
    const arrayLength = lengthDescriptor.value as number;
    const keys = (ownKeys as string[]).sort();
    if (keys.length !== arrayLength + 1 || !keys.includes("length")) {
      return failure({
        code: "invalid-affected-identities",
        message: `Affected ${identityKind} identities must be dense without extra properties`,
      });
    }
    for (const key of keys) {
      if (key === "length") continue;
      const index = Number(key);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= arrayLength ||
        String(index) !== key
      ) {
        return failure({
          code: "invalid-affected-identities",
          message: `Affected ${identityKind} identities must use canonical array indexes`,
        });
      }
    }
    const identities: string[] = [];
    for (let index = 0; index < arrayLength; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable ||
        typeof descriptor.value !== "string"
      ) {
        return failure({
          code: "invalid-affected-identities",
          message: `Affected ${identityKind} identities must be primitive string data values`,
        });
      }
      identities.push(descriptor.value);
    }
    return success(Object.freeze(identities));
  } catch {
    return failure({
      code: "invalid-affected-identities",
      message: `Affected ${identityKind} identities could not be inspected safely`,
    });
  }
}

export function sequenceGraphCommittedEvent(
  currentGenerationValue: unknown,
  event: unknown,
): Result<GraphEventSequence> {
  const currentGeneration = parseGraphGeneration(currentGenerationValue);
  if (!currentGeneration.ok) return currentGeneration;
  const inspectedEvent = inspectExactRecord(
    event,
    [["affected", "generation", "type"]],
    "invalid-graph-event",
    "Committed graph event",
  );
  if (!inspectedEvent.ok) return inspectedEvent;
  if (inspectedEvent.value.type !== "graph.committed") {
    return failure({
      code: "invalid-graph-event",
      message: "Event must be a graph.committed event",
    });
  }
  const affected = inspectExactRecord(
    inspectedEvent.value.affected,
    [["entities", "relations"]],
    "invalid-graph-event",
    "Committed event affected identities",
  );
  if (!affected.ok) return affected;
  const validatedEvent = createGraphCommittedEvent(inspectedEvent.value.generation, affected.value);
  if (!validatedEvent.ok) {
    return failure({
      code: "invalid-graph-event",
      message: "Committed graph event contains invalid affected identities or generation",
    });
  }
  const receivedGeneration = parseGraphGeneration(validatedEvent.value.generation);
  if (!receivedGeneration.ok) return receivedGeneration;
  if (receivedGeneration.value <= currentGeneration.value) {
    return success(
      Object.freeze({
        action: "refetch" as const,
        currentGeneration: currentGeneration.value,
        reason:
          receivedGeneration.value === currentGeneration.value
            ? ("duplicate" as const)
            : ("reversed" as const),
        receivedGeneration: receivedGeneration.value,
        status: "refetch-required" as const,
      }),
    );
  }
  const expectedGeneration = nextGraphGeneration(currentGeneration.value);
  if (!expectedGeneration.ok) return expectedGeneration;
  if (receivedGeneration.value === expectedGeneration.value) {
    return success(
      Object.freeze({
        generation: receivedGeneration.value,
        status: "accepted" as const,
      }),
    );
  }

  return success(
    Object.freeze({
      action: "refetch" as const,
      currentGeneration: currentGeneration.value,
      expectedGeneration: expectedGeneration.value,
      reason: "missed" as const,
      receivedGeneration: receivedGeneration.value,
      status: "refetch-required" as const,
    }),
  );
}
