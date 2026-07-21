import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import type { ApiCognitiveComplexityEvidence, ApiComponentScale } from "./api.ts";
import {
  componentPurpose,
  displayText,
  hasReadableMeaning,
  type BlueprintModel,
  type BlueprintNode,
} from "./model.ts";

export type BlueprintNotation = ApiComponentScale | "unscaled";

export const LEVEL_COMPONENT_BUDGET = 20;
export const LEVEL_RELATIONSHIP_BUDGET = 20;

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

export type BlueprintFlowNode = Node<BlueprintFlowNodeData, "component">;
export type BlueprintGroupNode = Node<BlueprintGroupNodeData, "group">;
export type BlueprintFlowEdge = Edge;

export interface BlueprintFlowGraph {
  readonly edges: readonly BlueprintFlowEdge[];
  readonly focusTargetId?: string;
  readonly levelComponents: number;
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
  readonly focusPath?: readonly string[];
  readonly model: BlueprintModel;
}

const CARD = Object.freeze({ height: 132, width: 216 });
const GAP = Object.freeze({ x: 24, y: 30 });
const FRAME = Object.freeze({ head: 76, pad: 24 });
const GRID_COLUMNS = 5;

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

function notationOf(node: BlueprintNode): BlueprintNotation {
  return node.view.component.scale ?? "unscaled";
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
      (left, right) =>
        right.values.size - left.values.size || compareCodeUnits(left.key, right.key),
    )[0];
  return chosen === undefined ? undefined : Object.freeze({ values: chosen.values });
}

function scaleRank(scale: ApiComponentScale | undefined): number {
  switch (scale) {
    case "system":
      return 0;
    case "domain":
      return 1;
    case "part":
      return 2;
    case "element":
      return 3;
    default:
      return 4;
  }
}

function rankedLevel(
  ids: readonly string[],
  required: string | undefined,
  model: BlueprintModel,
  childCounts: ReadonlyMap<string, number>,
  incident: ReadonlyMap<string, number>,
): readonly string[] {
  const ranked = ids
    .filter((id) => model.nodes.get(id)?.view.component.type !== "external")
    .toSorted((leftId, rightId) => {
      const left = model.nodes.get(leftId)!;
      const right = model.nodes.get(rightId)!;
      const leftMeaning = hasReadableMeaning(left.view.component) ? 1 : 0;
      const rightMeaning = hasReadableMeaning(right.view.component) ? 1 : 0;
      if (leftMeaning !== rightMeaning) return rightMeaning - leftMeaning;
      const scale = scaleRank(left.view.component.scale) - scaleRank(right.view.component.scale);
      if (scale !== 0) return scale;
      const leftChildren = childCounts.get(leftId) ?? left.childIds?.length ?? 0;
      const rightChildren = childCounts.get(rightId) ?? right.childIds?.length ?? 0;
      if (leftChildren > 0 !== rightChildren > 0) return rightChildren > 0 ? 1 : -1;
      if (leftChildren !== rightChildren) return rightChildren - leftChildren;
      const degree = (incident.get(rightId) ?? 0) - (incident.get(leftId) ?? 0);
      if (degree !== 0) return degree;
      const leftPurpose = componentPurpose(left.view.component) === undefined ? 0 : 1;
      const rightPurpose = componentPurpose(right.view.component) === undefined ? 0 : 1;
      if (leftPurpose !== rightPurpose) return rightPurpose - leftPurpose;
      return (
        compareCodeUnits(displayText(left.view.component), displayText(right.view.component)) ||
        compareCodeUnits(leftId, rightId)
      );
    });
  const visible = ranked.slice(0, LEVEL_COMPONENT_BUDGET);
  if (
    required !== undefined &&
    ranked.includes(required) &&
    !visible.includes(required) &&
    visible.length > 0
  ) {
    visible[visible.length - 1] = required;
  }
  return Object.freeze(visible);
}

interface LevelItemLayout {
  readonly group?: LevelLayout;
  readonly height: number;
  readonly id: string;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface LevelLayout {
  readonly height: number;
  readonly id: string;
  readonly items: readonly LevelItemLayout[];
  readonly omitted: number;
  readonly visibleIds: readonly string[];
  readonly width: number;
}

function layoutLevel(
  id: string,
  pathIndex: number,
  focusPath: readonly string[],
  model: BlueprintModel,
  childCounts: ReadonlyMap<string, number>,
  incident: ReadonlyMap<string, number>,
  ancestors: ReadonlySet<string>,
): LevelLayout {
  const node = model.nodes.get(id);
  const childIds = node?.childIds ?? [];
  const required = focusPath[pathIndex];
  const visibleIds = rankedLevel(childIds, required, model, childCounts, incident);
  const nextAncestors = new Set(ancestors).add(id);
  const prepared = visibleIds.map((childId) => {
    const expanded = childId === required && !nextAncestors.has(childId);
    const group = expanded
      ? layoutLevel(childId, pathIndex + 1, focusPath, model, childCounts, incident, nextAncestors)
      : undefined;
    return Object.freeze({
      ...(group === undefined ? {} : { group }),
      height: group?.height ?? CARD.height,
      id: childId,
      width: group?.width ?? CARD.width,
    });
  });

  const columns = Math.min(GRID_COLUMNS, Math.max(1, visibleIds.length));
  const gridWidth = columns * CARD.width + (columns - 1) * GAP.x;
  let column = 0;
  let y = FRAME.head + FRAME.pad;
  let rowHeight = 0;
  let contentWidth = gridWidth;
  const items: LevelItemLayout[] = [];
  for (const item of prepared) {
    if (item.group !== undefined) {
      // Keep the expanded container anchored where its collapsed card was.
      // Earlier siblings remain beside it; later siblings move below the larger
      // boundary, which gives React Flow one stable spatial transition to draw.
      const x = FRAME.pad + column * (CARD.width + GAP.x);
      items.push(Object.freeze({ ...item, x, y }));
      rowHeight = Math.max(rowHeight, item.height);
      contentWidth = Math.max(contentWidth, x - FRAME.pad + item.width);
      y += rowHeight + GAP.y;
      column = 0;
      rowHeight = 0;
      continue;
    }
    const x = FRAME.pad + column * (CARD.width + GAP.x);
    items.push(Object.freeze({ ...item, x, y }));
    rowHeight = Math.max(rowHeight, item.height);
    column += 1;
    if (column === columns) {
      y += rowHeight + GAP.y;
      column = 0;
      rowHeight = 0;
    }
  }
  if (column > 0) y += rowHeight + GAP.y;
  const width = Math.max(720, contentWidth + FRAME.pad * 2);
  const height = Math.max(320, y + FRAME.pad - GAP.y);
  return Object.freeze({
    height,
    id,
    items: Object.freeze(items),
    omitted: Math.max(0, childIds.length - visibleIds.length),
    visibleIds,
    width,
  });
}

export function buildBlueprintFlowGraph(options: BlueprintGraphOptions): BlueprintFlowGraph {
  const { dependencies, model } = options;
  const focusPath = options.focusPath ?? [];
  const childCounts = options.childCounts ?? new Map<string, number>();
  const componentOf = (id: string) => model.nodes.get(id)?.view.component;
  const ownedRootIds = model.rootIds.filter(
    (id) => componentOf(id) !== undefined && componentOf(id)?.type !== "external",
  );
  const incident = new Map<string, number>();
  for (const relationship of dependencies) {
    incident.set(relationship.source, (incident.get(relationship.source) ?? 0) + 1);
    incident.set(relationship.target, (incident.get(relationship.target) ?? 0) + 1);
  }
  const nodes: (BlueprintFlowNode | BlueprintGroupNode)[] = [];
  const visibleIds = new Set<string>();
  let omittedComponents = 0;
  let currentLevelCount = 0;
  let currentLevelTotal = 0;

  const emitCard = (id: string, parentId: string | undefined, x: number, y: number) => {
    const blueprintNode = model.nodes.get(id)!;
    const component = blueprintNode.view.component;
    const purpose = componentPurpose(component);
    const childCount = childCounts.get(id) ?? blueprintNode.childIds?.length ?? 0;
    visibleIds.add(id);
    nodes.push(
      Object.freeze({
        data: Object.freeze({
          canOpen: childCount > 0,
          childCount,
          evidenceBound: blueprintNode.view.evidenceBound,
          label: displayText(component),
          notation: notationOf(blueprintNode),
          ...(purpose === undefined ? {} : { purpose }),
          relationshipCount: incident.get(id) ?? 0,
          shared: component.shared === true,
          type: component.type ?? "component",
        }),
        height: CARD.height,
        id,
        ...(parentId === undefined ? {} : { extent: "parent" as const, parentId }),
        position: Object.freeze({ x, y }),
        sourcePosition: Position.Bottom,
        style: Object.freeze({ height: CARD.height, width: CARD.width }),
        targetPosition: Position.Top,
        type: "component" as const,
        width: CARD.width,
        zIndex: 10,
      }),
    );
  };

  const emitGroup = (
    layout: LevelLayout,
    parentId: string | undefined,
    x: number,
    y: number,
    depth: number,
  ) => {
    const blueprintNode = model.nodes.get(layout.id)!;
    const component = blueprintNode.view.component;
    const purpose = componentPurpose(component);
    const total = Math.max(layout.visibleIds.length, childCounts.get(layout.id) ?? 0);
    visibleIds.add(layout.id);
    if (depth === focusPath.length) {
      currentLevelCount = layout.visibleIds.length;
      currentLevelTotal = total;
    }
    omittedComponents += layout.omitted;
    nodes.push(
      Object.freeze({
        data: Object.freeze({
          contains: `${total} inside`,
          kind: "container" as const,
          label: displayText(component),
          notation: notationOf(blueprintNode),
          ...(purpose === undefined ? {} : { purpose }),
        }),
        draggable: false,
        height: layout.height,
        id: layout.id,
        ...(parentId === undefined ? {} : { extent: "parent" as const, parentId }),
        position: Object.freeze({ x, y }),
        selectable: false,
        style: Object.freeze({ height: layout.height, width: layout.width }),
        type: "group" as const,
        width: layout.width,
        zIndex: depth,
      }),
    );
    for (const item of layout.items) {
      if (item.group === undefined) emitCard(item.id, layout.id, item.x, item.y);
      else emitGroup(item.group, layout.id, item.x, item.y, depth + 1);
    }
  };

  if (ownedRootIds.length === 1) {
    const rootId = ownedRootIds[0]!;
    emitGroup(
      layoutLevel(rootId, 0, focusPath, model, childCounts, incident, new Set()),
      undefined,
      0,
      0,
      0,
    );
  } else {
    const roots = rankedLevel(ownedRootIds, focusPath[0], model, childCounts, incident);
    omittedComponents = Math.max(0, ownedRootIds.length - roots.length);
    if (focusPath.length === 0) {
      currentLevelCount = roots.length;
      currentLevelTotal = ownedRootIds.length;
    }
    let column = 0;
    let y = 0;
    let rowHeight = 0;
    for (const id of roots) {
      const expanded = id === focusPath[0];
      const x = column * (CARD.width + GAP.x);
      if (expanded) {
        const layout = layoutLevel(id, 1, focusPath, model, childCounts, incident, new Set());
        emitGroup(layout, undefined, x, y, 1);
        rowHeight = Math.max(rowHeight, layout.height);
        y += rowHeight + GAP.y;
        column = 0;
        rowHeight = 0;
        continue;
      }
      emitCard(id, undefined, x, y);
      rowHeight = Math.max(rowHeight, CARD.height);
      column += 1;
      if (column === GRID_COLUMNS) {
        y += rowHeight + GAP.y;
        column = 0;
        rowHeight = 0;
      }
    }
  }

  const relationshipPairs = new Set<string>();
  const visibleRelationships = dependencies.flatMap((dependency) => {
    if (
      dependency.source === dependency.target ||
      !visibleIds.has(dependency.source) ||
      !visibleIds.has(dependency.target)
    )
      return [];
    const pair = `${dependency.source}\u0000${dependency.target}`;
    if (relationshipPairs.has(pair)) return [];
    relationshipPairs.add(pair);
    return [dependency];
  });
  const drawnRelationships = visibleRelationships.slice(0, LEVEL_RELATIONSHIP_BUDGET);
  const cognitive = comparableCognitiveComplexity([...visibleIds], model);
  if (cognitive !== undefined) {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]!;
      if (node.type !== "component") continue;
      const measured = cognitive.values.get(node.id);
      if (measured === undefined) continue;
      nodes[index] = Object.freeze({
        ...node,
        data: Object.freeze({ ...node.data, cognitiveComplexity: measured }),
      });
    }
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

  return Object.freeze({
    edges: Object.freeze(edges),
    ...(ownedRootIds.length === 1
      ? { focusTargetId: focusPath.at(-1) ?? ownedRootIds[0] }
      : focusPath.length === 0
        ? {}
        : { focusTargetId: focusPath.at(-1) }),
    levelComponents: currentLevelTotal,
    nodes: Object.freeze(nodes),
    omittedComponents,
    omittedRelationships: Math.max(0, visibleRelationships.length - edges.length),
    visibleComponents: currentLevelCount,
  });
}
