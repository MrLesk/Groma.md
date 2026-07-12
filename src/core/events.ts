import { nextGraphGeneration, parseGraphGeneration, type GraphGeneration } from "./generation.ts";
import { parseEntityId, parseRelationId, type EntityId, type RelationId } from "./identity.ts";
import { failure, type Result, success } from "./result.ts";

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
  generationValue: number,
  affectedInput: AffectedIdentityInput,
): Result<GraphCommittedEvent> {
  const generation = parseGraphGeneration(generationValue);
  if (!generation.ok) return generation;
  const entities: EntityId[] = [];
  for (const candidate of affectedInput.entities ?? []) {
    const identity = parseEntityId(candidate);
    if (!identity.ok) return identity;
    entities.push(identity.value);
  }
  const relations: RelationId[] = [];
  for (const candidate of affectedInput.relations ?? []) {
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

export function sequenceGraphCommittedEvent(
  currentGenerationValue: number,
  event: GraphCommittedEvent,
): Result<GraphEventSequence> {
  const currentGeneration = parseGraphGeneration(currentGenerationValue);
  if (!currentGeneration.ok) return currentGeneration;
  if (event.type !== "graph.committed") {
    return failure({
      code: "invalid-graph-event",
      message: "Event must be a graph.committed event",
    });
  }
  const receivedGeneration = parseGraphGeneration(event.generation);
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
