import dagre from "@dagrejs/dagre";
import { Position, type Edge, type Node } from "@xyflow/react";

import type { ApiComponentScale } from "./api.ts";
import { displayText, type BlueprintModel } from "./model.ts";

export type BlueprintNotation = ApiComponentScale | "unscaled";

export interface BlueprintFlowNodeData extends Record<string, unknown> {
  readonly childCount: number;
  readonly childState: "collapsed" | "empty" | "expanded" | "unread";
  readonly hasMoreChildren: boolean;
  readonly label: string;
  readonly notation: BlueprintNotation;
  readonly type: string;
}

export type BlueprintFlowNode = Node<BlueprintFlowNodeData, "component">;
export type BlueprintFlowEdge = Edge<Record<string, never>, "smoothstep">;

export interface BlueprintFlowGraph {
  readonly edges: readonly BlueprintFlowEdge[];
  readonly nodes: readonly BlueprintFlowNode[];
}

const NODE_DIMENSIONS: Readonly<Record<BlueprintNotation, { height: number; width: number }>> =
  Object.freeze({
    domain: Object.freeze({ height: 112, width: 300 }),
    element: Object.freeze({ height: 76, width: 220 }),
    part: Object.freeze({ height: 92, width: 260 }),
    system: Object.freeze({ height: 132, width: 340 }),
    unscaled: Object.freeze({ height: 88, width: 244 }),
  });

const SHEET_ROW_WIDTH = 1_520;
const SUBGRAPH_GAP = 72;

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

function visibleIds(model: BlueprintModel, folded: ReadonlySet<string>): readonly string[] {
  const visible: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id) || !model.nodes.has(id)) return;
    visited.add(id);
    visible.push(id);
    if (folded.has(id)) return;
    for (const childId of model.nodes.get(id)?.childIds ?? []) visit(childId);
  };
  for (const rootId of model.rootIds) visit(rootId);
  return Object.freeze(visible);
}

export function buildBlueprintFlowGraph(
  model: BlueprintModel,
  folded: ReadonlySet<string>,
): BlueprintFlowGraph {
  const ids = visibleIds(model, folded);
  const included = new Set(ids);
  const containment: { readonly source: string; readonly target: string }[] = [];
  for (const parentId of ids) {
    for (const childId of model.nodes.get(parentId)?.childIds ?? []) {
      if (!included.has(childId)) continue;
      containment.push(Object.freeze({ source: parentId, target: childId }));
    }
  }

  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;
  for (const rootId of model.rootIds) {
    if (!included.has(rootId)) continue;
    const subtree: string[] = [];
    const subtreeSet = new Set<string>();
    const collect = (id: string) => {
      if (!included.has(id) || subtreeSet.has(id)) return;
      subtreeSet.add(id);
      subtree.push(id);
      for (const childId of model.nodes.get(id)?.childIds ?? []) collect(childId);
    };
    collect(rootId);

    const layout = new dagre.graphlib.Graph();
    layout.setGraph({ marginx: 0, marginy: 0, nodesep: 52, rankdir: "LR", ranksep: 112 });
    layout.setDefaultEdgeLabel(() => ({}));
    for (const id of subtree) {
      const notation = model.nodes.get(id)!.view.component.scale ?? "unscaled";
      layout.setNode(id, { ...NODE_DIMENSIONS[notation] });
    }
    for (const edge of containment) {
      if (subtreeSet.has(edge.source) && subtreeSet.has(edge.target)) {
        layout.setEdge(edge.source, edge.target);
      }
    }
    dagre.layout(layout);

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const id of subtree) {
      const notation = model.nodes.get(id)!.view.component.scale ?? "unscaled";
      const dimensions = NODE_DIMENSIONS[notation];
      const point = layout.node(id) as { readonly x: number; readonly y: number };
      minX = Math.min(minX, point.x - dimensions.width / 2);
      minY = Math.min(minY, point.y - dimensions.height / 2);
      maxX = Math.max(maxX, point.x + dimensions.width / 2);
      maxY = Math.max(maxY, point.y + dimensions.height / 2);
    }
    const width = maxX - minX;
    const height = maxY - minY;
    if (shelfX > 0 && shelfX + width > SHEET_ROW_WIDTH) {
      shelfX = 0;
      shelfY += shelfHeight + SUBGRAPH_GAP;
      shelfHeight = 0;
    }
    for (const id of subtree) {
      const notation = model.nodes.get(id)!.view.component.scale ?? "unscaled";
      const dimensions = NODE_DIMENSIONS[notation];
      const point = layout.node(id) as { readonly x: number; readonly y: number };
      positions.set(id, {
        x: Math.round(shelfX + point.x - dimensions.width / 2 - minX),
        y: Math.round(shelfY + point.y - dimensions.height / 2 - minY),
      });
    }
    shelfX += width + SUBGRAPH_GAP;
    shelfHeight = Math.max(shelfHeight, height);
  }

  const nodes = ids.map((id): BlueprintFlowNode => {
    const blueprintNode = model.nodes.get(id)!;
    const component = blueprintNode.view.component;
    const notation = component.scale ?? "unscaled";
    const dimensions = NODE_DIMENSIONS[notation];
    const position = positions.get(id)!;
    const children = blueprintNode.childIds;
    const childState =
      children === undefined
        ? "unread"
        : children.length === 0
          ? "empty"
          : folded.has(id)
            ? "collapsed"
            : "expanded";
    return Object.freeze({
      data: Object.freeze({
        childCount: children?.length ?? 0,
        childState,
        hasMoreChildren: blueprintNode.hasMoreChildren,
        label: displayText(component),
        notation,
        type: component.type ?? "component",
      }),
      height: dimensions.height,
      id,
      position: Object.freeze(position),
      sourcePosition: Position.Right,
      style: Object.freeze({ height: dimensions.height, width: dimensions.width }),
      targetPosition: Position.Left,
      type: "component" as const,
      width: dimensions.width,
    });
  });

  const edges = containment.map(({ source, target }): BlueprintFlowEdge =>
    Object.freeze({
      className: "groma-containment-edge",
      data: Object.freeze({}),
      id: `contains:${source}:${target}`,
      interactionWidth: 16,
      source,
      target,
      type: "smoothstep" as const,
    }),
  );
  return Object.freeze({ edges: Object.freeze(edges), nodes: Object.freeze(nodes) });
}
