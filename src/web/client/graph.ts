import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import type { ApiCognitiveComplexityEvidence, ApiComponentScale } from "./api.ts";
import {
  componentPurpose,
  displayText,
  isImplementationEvidence,
  type BlueprintModel,
  type BlueprintNode,
} from "./model.ts";

export type BlueprintNotation = ApiComponentScale | "unscaled";

export const LEVEL_COMPONENT_BUDGET = 8;
export const LEVEL_EVIDENCE_BUDGET = 5;
export const LEVEL_RELATIONSHIP_BUDGET = 8;

export interface BlueprintFlowNodeData extends Record<string, unknown> {
  readonly canOpen: boolean;
  readonly childCount: number;
  readonly cognitiveComplexity?: number;
  readonly evidenceBound: boolean;
  readonly label: string;
  readonly notation: BlueprintNotation;
  readonly purpose?: string;
  readonly relationshipCount: number;
  readonly shared: boolean;
  readonly type: string;
}

export interface BlueprintGroupNodeData extends Record<string, unknown> {
  readonly contains: string;
  readonly kind: "container";
  readonly label: string;
  readonly notation: BlueprintNotation;
  readonly purpose?: string;
}

export interface BlueprintEvidenceItem {
  readonly childCount: number;
  readonly id: string;
  readonly label: string;
  readonly type: string;
}

export type BlueprintFlowNode = Node<BlueprintFlowNodeData, "component">;
export type BlueprintGroupNode = Node<BlueprintGroupNodeData, "group">;
export type BlueprintFlowEdge = Edge;

export interface BlueprintFlowGraph {
  readonly edges: readonly BlueprintFlowEdge[];
  readonly evidence: readonly BlueprintEvidenceItem[];
  readonly nodes: readonly (BlueprintFlowNode | BlueprintGroupNode)[];
  readonly omittedComponents: number;
  readonly omittedRelationships: number;
  readonly visibleComponents: number;
}

export interface BlueprintDependency {
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

export interface BlueprintGraphOptions {
  readonly childCounts?: ReadonlyMap<string, number>;
  readonly dependencies: readonly BlueprintDependency[];
  readonly focusId?: string | undefined;
  readonly model: BlueprintModel;
}

const CARD = Object.freeze({ height: 164, width: 260 });
const GAP = Object.freeze({ x: 38, y: 54 });
const FRAME = Object.freeze({ head: 96, pad: 32 });

export function nextScaleLabel(scale: ApiComponentScale | undefined): string {
  switch (scale) {
    case "system":
      return "domains";
    case "domain":
      return "parts";
    case "part":
      return "elements";
    case "element":
      return "nested elements";
    default:
      return "children";
  }
}

function notationOf(scale: ApiComponentScale | undefined): BlueprintNotation {
  return scale ?? "unscaled";
}

/**
 * Evidence-bound, meaning-empty fine-grained components are implementation
 * evidence. They remain inspectable, but do not become architecture by being
 * placed on the same graph as purposeful components.
 */
export function isImplementationOnly(node: BlueprintNode): boolean {
  return isImplementationEvidence(node.view.component, node.view.evidenceBound);
}

function gridPosition(index: number, columns: number): { readonly x: number; readonly y: number } {
  return Object.freeze({
    x: (index % columns) * (CARD.width + GAP.x),
    y: Math.floor(index / columns) * (CARD.height + GAP.y),
  });
}

function relationshipLabel(type: string): string {
  if (type === "imports" || type === "requires" || type === "depends-on") return "needs";
  if (type === "informs") return "tells";
  const readable = type.replaceAll(/[._-]+/g, " ");
  return readable.length <= 18 ? readable : "relates";
}

interface ComparableCognitiveComplexity {
  readonly values: ReadonlyMap<string, number>;
}

function cognitiveProvenanceKey(evidence: ApiCognitiveComplexityEvidence): string {
  const { scanner } = evidence;
  return `${evidence.projectId}\u0000${scanner.id}\u0000${scanner.instance}\u0000${scanner.version}`;
}

function comparableCognitiveComplexity(
  ids: readonly string[],
  model: BlueprintModel,
): ComparableCognitiveComplexity | undefined {
  const sources = new Map<string, Map<string, Set<number>>>();
  for (const id of ids) {
    for (const evidence of model.nodes.get(id)?.view.cognitiveComplexity ?? []) {
      if (!Number.isSafeInteger(evidence.value) || evidence.value < 0) continue;
      const key = cognitiveProvenanceKey(evidence);
      const values = sources.get(key) ?? new Map<string, Set<number>>();
      const componentValues = values.get(id) ?? new Set<number>();
      componentValues.add(evidence.value);
      values.set(id, componentValues);
      sources.set(key, values);
    }
  }
  const chosen = [...sources.entries()]
    .map(([key, values]) => ({
      key,
      values: new Map(
        [...values].flatMap(([id, measured]) =>
          measured.size === 1 ? [[id, [...measured][0]!] as const] : [],
        ),
      ),
    }))
    .filter((source) => source.values.size >= 2)
    .sort(
      (left, right) => right.values.size - left.values.size || left.key.localeCompare(right.key),
    )[0];
  return chosen === undefined ? undefined : Object.freeze({ values: chosen.values });
}

export function buildBlueprintFlowGraph(options: BlueprintGraphOptions): BlueprintFlowGraph {
  const { dependencies, focusId, model } = options;
  const childCounts = options.childCounts ?? new Map<string, number>();
  const componentOf = (id: string) => model.nodes.get(id)?.view.component;
  const ownedRootIds = model.rootIds.filter(
    (id) => componentOf(id) !== undefined && componentOf(id)?.type !== "external",
  );
  const frameId =
    focusId !== undefined && model.nodes.has(focusId)
      ? focusId
      : ownedRootIds.length === 1
        ? ownedRootIds[0]
        : undefined;
  const candidates =
    frameId === undefined
      ? ownedRootIds
      : [...(model.nodes.get(frameId)?.childIds ?? [])].filter((id) => model.nodes.has(id));

  const architectural = candidates.filter((id) => {
    const node = model.nodes.get(id);
    return (
      node !== undefined && node.view.component.type !== "external" && !isImplementationOnly(node)
    );
  });
  const implementation = candidates.filter((id) => {
    const node = model.nodes.get(id);
    return node !== undefined && isImplementationOnly(node);
  });
  const visibleIds = architectural.slice(0, LEVEL_COMPONENT_BUDGET);
  const visibleSet = new Set(visibleIds);
  const evidenceIds = implementation.slice(0, LEVEL_EVIDENCE_BUDGET);

  const relationshipPairs = new Set<string>();
  const visibleRelationships = dependencies.flatMap((dependency) => {
    if (
      dependency.source === dependency.target ||
      !visibleSet.has(dependency.source) ||
      !visibleSet.has(dependency.target)
    )
      return [];
    const pair = `${dependency.source}\u0000${dependency.target}`;
    if (relationshipPairs.has(pair)) return [];
    relationshipPairs.add(pair);
    return [dependency];
  });
  const drawnRelationships = visibleRelationships.slice(0, LEVEL_RELATIONSHIP_BUDGET);
  const incident = new Map<string, number>();
  for (const relationship of drawnRelationships) {
    incident.set(relationship.source, (incident.get(relationship.source) ?? 0) + 1);
    incident.set(relationship.target, (incident.get(relationship.target) ?? 0) + 1);
  }

  const columns = Math.min(4, Math.max(1, visibleIds.length));
  const rows = Math.max(1, Math.ceil(visibleIds.length / columns));
  const contentWidth = columns * CARD.width + (columns - 1) * GAP.x;
  const contentHeight = rows * CARD.height + (rows - 1) * GAP.y;
  const frameWidth = Math.max(760, contentWidth + FRAME.pad * 2);
  const frameHeight = Math.max(360, FRAME.head + contentHeight + FRAME.pad * 2);
  const nodes: (BlueprintFlowNode | BlueprintGroupNode)[] = [];

  if (frameId !== undefined) {
    const frame = model.nodes.get(frameId)!;
    const component = frame.view.component;
    const purpose = componentPurpose(component);
    const total = childCounts.get(frameId) ?? candidates.length;
    nodes.push(
      Object.freeze({
        data: Object.freeze({
          contains: `${total} ${nextScaleLabel(component.scale)}`,
          kind: "container" as const,
          label: displayText(component),
          notation: notationOf(component.scale),
          ...(purpose === undefined ? {} : { purpose }),
        }),
        draggable: false,
        height: frameHeight,
        id: `group:${frameId}`,
        position: Object.freeze({ x: 0, y: 0 }),
        selectable: false,
        style: Object.freeze({ height: frameHeight, width: frameWidth }),
        type: "group" as const,
        width: frameWidth,
        zIndex: 0,
      }),
    );
  }

  const cognitive = comparableCognitiveComplexity(visibleIds, model);
  for (const [index, id] of visibleIds.entries()) {
    const blueprintNode = model.nodes.get(id)!;
    const component = blueprintNode.view.component;
    const purpose = componentPurpose(component);
    const childCount = childCounts.get(id) ?? blueprintNode.childIds?.length ?? 0;
    const base = gridPosition(index, columns);
    const position =
      frameId === undefined
        ? base
        : Object.freeze({ x: base.x + FRAME.pad, y: base.y + FRAME.head + FRAME.pad });
    const measured = cognitive?.values.get(id);
    nodes.push(
      Object.freeze({
        data: Object.freeze({
          canOpen: childCount > 0,
          childCount,
          ...(measured === undefined ? {} : { cognitiveComplexity: measured }),
          evidenceBound: blueprintNode.view.evidenceBound,
          label: displayText(component),
          notation: notationOf(component.scale),
          ...(purpose === undefined ? {} : { purpose }),
          relationshipCount: incident.get(id) ?? 0,
          shared: component.shared === true,
          type: component.type ?? "component",
        }),
        height: CARD.height,
        id,
        ...(frameId === undefined
          ? {}
          : { extent: "parent" as const, parentId: `group:${frameId}` }),
        position,
        sourcePosition: Position.Bottom,
        style: Object.freeze({ height: CARD.height, width: CARD.width }),
        targetPosition: Position.Top,
        type: "component" as const,
        width: CARD.width,
        zIndex: 10,
      }),
    );
  }

  const edges: BlueprintFlowEdge[] = drawnRelationships.map((relationship) =>
    Object.freeze({
      className: "groma-edge",
      id: `relationship:${relationship.source}:${relationship.target}`,
      interactionWidth: 14,
      label: relationshipLabel(relationship.type),
      labelBgBorderRadius: 0,
      labelBgPadding: [5, 2] as [number, number],
      labelBgStyle: Object.freeze({ fill: "#fbfaf6", fillOpacity: 0.94 }),
      labelStyle: Object.freeze({ fill: "#4d5551", fontFamily: "ui-monospace", fontSize: 9 }),
      markerEnd: Object.freeze({
        color: "#4d5551",
        height: 14,
        type: MarkerType.ArrowClosed,
        width: 14,
      }),
      source: relationship.source,
      target: relationship.target,
      type: "smoothstep" as const,
      zIndex: 1,
    }),
  );

  const evidence = evidenceIds.map((id) => {
    const node = model.nodes.get(id)!;
    return Object.freeze({
      childCount: childCounts.get(id) ?? node.childIds?.length ?? 0,
      id,
      label: displayText(node.view.component),
      type: node.view.component.type ?? "observed component",
    });
  });
  const totalCandidates =
    frameId === undefined
      ? candidates.length
      : Math.max(candidates.length, childCounts.get(frameId) ?? 0);
  const omittedComponents = Math.max(0, totalCandidates - visibleIds.length - evidenceIds.length);

  return Object.freeze({
    edges: Object.freeze(edges),
    evidence: Object.freeze(evidence),
    nodes: Object.freeze(nodes),
    omittedComponents,
    omittedRelationships: Math.max(0, visibleRelationships.length - edges.length),
    visibleComponents: visibleIds.length,
  });
}
