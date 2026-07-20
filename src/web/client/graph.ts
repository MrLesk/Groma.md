import dagre from "@dagrejs/dagre";
import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import type { ApiComponentScale } from "./api.ts";
import { displayText, type BlueprintModel } from "./model.ts";

export type BlueprintNotation = ApiComponentScale | "unscaled";

export interface BlueprintFlowNodeData extends Record<string, unknown> {
  readonly childCount: number;
  readonly childState: "collapsed" | "empty" | "expanded" | "unread";
  /** Components this one draws on. */
  readonly dependsOn: number;
  /** Components that draw on this one. */
  readonly dependents: number;
  readonly entryPoint: boolean;
  readonly external: boolean;
  readonly hasMoreChildren: boolean;
  readonly label: string;
  readonly notation: BlueprintNotation;
  readonly provisional: boolean;
  readonly shared: boolean;
  /** A sentence the source itself states about this component, when it states one. */
  readonly summary?: string;
  readonly type: string;
}

export interface BlueprintGroupNodeData extends Record<string, unknown> {
  /** What the container holds, counted, so the heading states a fact. */
  readonly contains?: string;
  readonly kind: "band" | "container";
  readonly label: string;
  readonly notation: BlueprintNotation;
  /** A container is still a component, and still says what the source says. */
  readonly summary?: string;
}

export type BlueprintFlowNode = Node<BlueprintFlowNodeData, "component">;
export type BlueprintGroupNode = Node<BlueprintGroupNodeData, "group">;
export type BlueprintFlowEdge = Edge;

export interface BlueprintFlowGraph {
  readonly edges: readonly BlueprintFlowEdge[];
  readonly nodes: readonly (BlueprintFlowNode | BlueprintGroupNode)[];
  /** Notations actually drawn, so the legend can describe only what is present. */
  readonly notations: readonly BlueprintNotation[];
}

export interface BlueprintDependency {
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

const NODE_DIMENSIONS: Readonly<Record<BlueprintNotation, { height: number; width: number }>> =
  Object.freeze({
    domain: Object.freeze({ height: 108, width: 292 }),
    element: Object.freeze({ height: 84, width: 236 }),
    part: Object.freeze({ height: 96, width: 264 }),
    system: Object.freeze({ height: 120, width: 320 }),
    unscaled: Object.freeze({ height: 92, width: 252 }),
  });

/**
 * Room for the description a component's own source states about it, clamped to
 * three lines on the card. Reserved only when there is a sentence to show, so a
 * project that documents nothing gets compact cards rather than empty gaps.
 */
const SUMMARY_HEIGHT = 52;

/** Reserved for a group's title rule, so a heading never sits on a child. */
const GROUP_TITLE = 44;

/**
 * Extra head room a container needs when it carries its own description. A
 * container is the largest thing on the sheet, so the sentence describing it is
 * the one a reader meets first and is given room to be read.
 */
const GROUP_SUMMARY_HEIGHT = 46;
const GROUP_PAD = 26;
const GROUP_GAP = 88;
const SHEET_ROW_WIDTH = 1_640;

/**
 * Borrowed code is inventory, not architecture: it is listed densely, in more
 * columns and smaller cells than anything built here, so it can be consulted
 * without competing with the system for the reader's first look.
 */
const EXTERNAL_COLUMNS = 5;
const EXTERNAL_CELL = Object.freeze({ height: 44, width: 236 });

export const SCALE_ORDER: readonly ApiComponentScale[] = Object.freeze([
  "system",
  "domain",
  "part",
  "element",
]);

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

/** Depth of a component's scale on the ladder; unscaled sorts last. */
function scaleRank(scale: ApiComponentScale | undefined): number {
  const index = scale === undefined ? -1 : SCALE_ORDER.indexOf(scale);
  return index === -1 ? SCALE_ORDER.length : index;
}

interface LaidOutSubgraph {
  readonly height: number;
  readonly positions: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
  readonly width: number;
}

function layoutSubgraph(
  ids: readonly string[],
  edges: readonly { readonly source: string; readonly target: string }[],
  sizeOf: (id: string) => { height: number; width: number },
): LaidOutSubgraph {
  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ marginx: 0, marginy: 0, nodesep: 40, rankdir: "LR", ranksep: 96 });
  layout.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) layout.setNode(id, { ...sizeOf(id) });
  for (const edge of edges) {
    if (ids.includes(edge.source) && ids.includes(edge.target)) {
      layout.setEdge(edge.source, edge.target);
    }
  }
  dagre.layout(layout);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const id of ids) {
    const size = sizeOf(id);
    const point = layout.node(id) as { readonly x: number; readonly y: number };
    minX = Math.min(minX, point.x - size.width / 2);
    minY = Math.min(minY, point.y - size.height / 2);
    maxX = Math.max(maxX, point.x + size.width / 2);
    maxY = Math.max(maxY, point.y + size.height / 2);
  }
  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  for (const id of ids) {
    const size = sizeOf(id);
    const point = layout.node(id) as { readonly x: number; readonly y: number };
    positions.set(id, {
      x: Math.round(point.x - size.width / 2 - minX),
      y: Math.round(point.y - size.height / 2 - minY),
    });
  }
  return {
    height: ids.length === 0 ? 0 : maxY - minY,
    positions,
    width: ids.length === 0 ? 0 : maxX - minX,
  };
}

export interface BlueprintGraphOptions {
  readonly dependencies: readonly BlueprintDependency[];
  readonly folded: ReadonlySet<string>;
  readonly model: BlueprintModel;
  /** Deepest rung the sheet draws; finer components stay folded away. */
  readonly visibleScale: ApiComponentScale | undefined;
}

export function buildBlueprintFlowGraph(options: BlueprintGraphOptions): BlueprintFlowGraph {
  const { dependencies, folded, model, visibleScale } = options;
  const depthLimit =
    visibleScale === undefined ? Number.POSITIVE_INFINITY : scaleRank(visibleScale);

  const isExternal = (id: string) => model.nodes.get(id)?.view.component.type === "external";
  const componentOf = (id: string) => model.nodes.get(id)?.view.component;

  // Everything the sheet draws, honouring both explicit folding and the chosen rung.
  const visible = new Set<string>();
  const visit = (id: string) => {
    const component = componentOf(id);
    if (component === undefined || visible.has(id)) return;
    if (scaleRank(component.scale) > depthLimit && component.scale !== undefined) return;
    visible.add(id);
    if (folded.has(id)) return;
    for (const childId of model.nodes.get(id)?.childIds ?? []) visit(childId);
  };
  for (const rootId of model.rootIds) visit(rootId);

  const owned = [...visible].filter((id) => !isExternal(id));
  const externals = [...visible].filter((id) => isExternal(id));
  const childrenOf = (id: string): readonly string[] =>
    (model.nodes.get(id)?.childIds ?? []).filter((childId) => visible.has(childId));

  // Nesting comes from the loaded hierarchy itself, so a component is a sheet
  // root exactly when nothing drawn contains it.
  const nested = new Set<string>();
  for (const id of visible) {
    if (folded.has(id)) continue;
    for (const childId of childrenOf(id)) nested.add(childId);
  }
  const ownedRoots = owned.filter((id) => !nested.has(id));

  const nodes: (BlueprintFlowNode | BlueprintGroupNode)[] = [];
  const notations = new Set<BlueprintNotation>();
  // Counted in both directions, because "used by many" and "uses many" describe
  // opposite kinds of component and a single total tells the two apart from
  // neither. Distinct partners, so one busy file cannot inflate a count.
  const dependsOn = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  for (const dependency of dependencies) {
    if (dependency.source === dependency.target) continue;
    const out = dependsOn.get(dependency.source) ?? new Set<string>();
    out.add(dependency.target);
    dependsOn.set(dependency.source, out);
    const into = dependents.get(dependency.target) ?? new Set<string>();
    into.add(dependency.source);
    dependents.set(dependency.target, into);
  }

  // Contents are arranged by how they depend on each other, so a group reads
  // left to right along its own dependency order instead of as a bare stack.
  const edgesAmong = (
    ids: readonly string[],
  ): readonly { readonly source: string; readonly target: string }[] => {
    const within = new Set(ids);
    const seen = new Set<string>();
    const among: { readonly source: string; readonly target: string }[] = [];
    for (const dependency of dependencies) {
      if (!within.has(dependency.source) || !within.has(dependency.target)) continue;
      if (dependency.source === dependency.target) continue;
      const key = `${dependency.source}\u0000${dependency.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      among.push(Object.freeze({ source: dependency.source, target: dependency.target }));
    }
    return among;
  };

  /** A leaf card's footprint, grown only when the source describes it. */
  const cardSize = (id: string): { height: number; width: number } => {
    const component = componentOf(id);
    if (isExternal(id)) return { ...EXTERNAL_CELL };
    const base = NODE_DIMENSIONS[notationOf(component?.scale)];
    const described = (component?.summary ?? "").length > 0;
    return { height: base.height + (described ? SUMMARY_HEIGHT : 0), width: base.width };
  };

  const sizeOf = (id: string): { height: number; width: number } => {
    const nested = childrenOf(id);
    if (nested.length === 0) return cardSize(id);
    const inner = groupSize(id);
    return { height: inner.height, width: inner.width };
  };

  // A container's footprint is its own laid-out contents plus title and padding.
  const groupHead = (id: string): number =>
    GROUP_TITLE + ((componentOf(id)?.summary ?? "").length > 0 ? GROUP_SUMMARY_HEIGHT : 0);

  const groupSizes = new Map<string, { height: number; width: number }>();
  function groupSize(id: string): { height: number; width: number } {
    const known = groupSizes.get(id);
    if (known !== undefined) return known;
    const nested = childrenOf(id);
    const laid = layoutSubgraph(nested, edgesAmong(nested), sizeOf);
    const size = {
      height: Math.round(laid.height + GROUP_PAD * 2 + groupHead(id)),
      width: Math.round(Math.max(laid.width + GROUP_PAD * 2, 280)),
    };
    groupSizes.set(id, size);
    return size;
  }

  const emitComponent = (id: string, position: { x: number; y: number }, parentId?: string) => {
    const component = componentOf(id)!;
    const node = model.nodes.get(id)!;
    const nested = childrenOf(id);
    const notation = notationOf(component.scale);
    notations.add(notation);
    const childIds = node.childIds;
    const childState =
      childIds === undefined
        ? "unread"
        : childIds.length === 0
          ? "empty"
          : folded.has(id) || nested.length === 0
            ? "collapsed"
            : "expanded";
    const size = nested.length === 0 ? cardSize(id) : groupSize(id);

    if (nested.length > 0) {
      // Containers render as a plate their contents sit inside, the way a
      // grouped drawing reads: the title names the group, children are nested.
      nodes.push(
        Object.freeze({
          data: Object.freeze({
            contains: `${nested.length} ${nextScaleLabel(notation === "unscaled" ? undefined : notation)}`,
            kind: "container" as const,
            label: displayText(component),
            notation,
            ...(component.summary === undefined || component.summary.length === 0
              ? {}
              : { summary: component.summary }),
          }),
          draggable: false,
          height: size.height,
          id: `group:${id}`,
          ...(parentId === undefined ? {} : { extent: "parent" as const, parentId }),
          position: Object.freeze(position),
          selectable: false,
          style: Object.freeze({ height: size.height, width: size.width }),
          type: "group" as const,
          width: size.width,
          zIndex: 0,
        }),
      );
      const laid = layoutSubgraph(nested, edgesAmong(nested), sizeOf);
      const head = groupHead(id);
      for (const childId of nested) {
        const childPosition = laid.positions.get(childId)!;
        emitComponent(
          childId,
          { x: childPosition.x + GROUP_PAD, y: childPosition.y + GROUP_PAD + head },
          `group:${id}`,
        );
      }
      return;
    }

    nodes.push(
      Object.freeze({
        data: Object.freeze({
          childCount: childIds?.length ?? 0,
          childState,
          dependsOn: dependsOn.get(id)?.size ?? 0,
          dependents: dependents.get(id)?.size ?? 0,
          entryPoint: (component.actions?.length ?? 0) > 0,
          external: component.type === "external",
          hasMoreChildren: node.hasMoreChildren,
          label: displayText(component),
          notation,
          provisional: component.scale === undefined,
          shared: component.shared === true,
          ...(component.summary === undefined || component.summary.length === 0
            ? {}
            : { summary: component.summary }),
          type: component.type ?? "component",
        }),
        height: size.height,
        id,
        ...(parentId === undefined ? {} : { extent: "parent" as const, parentId }),
        position: Object.freeze(position),
        sourcePosition: Position.Right,
        style: Object.freeze({ height: size.height, width: size.width }),
        targetPosition: Position.Left,
        type: "component" as const,
        width: size.width,
        zIndex: 1,
      }),
    );
  };

  // Owned architecture first, packed across the sheet.
  const ownedLayout = layoutSubgraph(ownedRoots, [], sizeOf);
  let sheetBottom = 0;
  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;
  for (const rootId of ownedRoots) {
    const size = sizeOf(rootId);
    if (shelfX > 0 && shelfX + size.width > SHEET_ROW_WIDTH) {
      shelfX = 0;
      shelfY += shelfHeight + GROUP_GAP;
      shelfHeight = 0;
    }
    emitComponent(rootId, { x: shelfX, y: shelfY });
    shelfX += size.width + GROUP_GAP;
    shelfHeight = Math.max(shelfHeight, size.height);
    sheetBottom = Math.max(sheetBottom, shelfY + size.height);
  }
  void ownedLayout;

  // Dependencies live in their own band: they are what the system rests on,
  // never peers of the parts that were actually built here.
  if (externals.length > 0) {
    const bandTop = sheetBottom + GROUP_GAP * 1.5;
    const cell = EXTERNAL_CELL;
    const columns = Math.min(EXTERNAL_COLUMNS, externals.length);
    const rows = Math.ceil(externals.length / columns);
    const bandWidth = columns * (cell.width + 14) + GROUP_PAD * 2 - 14;
    const bandHeight = rows * (cell.height + 12) + GROUP_PAD * 2 + GROUP_TITLE - 12;
    nodes.push(
      Object.freeze({
        data: Object.freeze({
          kind: "band" as const,
          label: `Depends on ${externals.length} external${externals.length === 1 ? "" : "s"}`,
          notation: "unscaled" as const,
        }),
        draggable: false,
        height: bandHeight,
        id: "band:external",
        position: Object.freeze({ x: 0, y: Math.round(bandTop) }),
        selectable: false,
        style: Object.freeze({ height: bandHeight, width: bandWidth }),
        type: "group" as const,
        width: bandWidth,
        zIndex: 0,
      }),
    );
    externals.forEach((id, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      emitComponent(
        id,
        {
          x: GROUP_PAD + column * (cell.width + 14),
          y: GROUP_PAD + GROUP_TITLE + row * (cell.height + 12),
        },
        "band:external",
      );
    });
  }

  const drawn = new Set(nodes.map((node) => node.id));
  const edges: BlueprintFlowEdge[] = [];
  const seen = new Set<string>();
  for (const dependency of dependencies) {
    if (dependency.source === dependency.target) continue;
    if (!drawn.has(dependency.source) || !drawn.has(dependency.target)) continue;
    const id = `depends:${dependency.source}:${dependency.target}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const toExternal = isExternal(dependency.target);
    edges.push(
      Object.freeze({
        className: toExternal ? "groma-edge groma-edge--external" : "groma-edge",
        id,
        interactionWidth: 12,
        // The scanner observed a direction; drawing the line without it discards
        // the only thing that distinguishes "uses" from "is used by".
        markerEnd: Object.freeze({
          color: toExternal ? "#9aa39b" : "#5c665e",
          height: 14,
          type: MarkerType.ArrowClosed,
          width: 14,
        }),
        source: dependency.source,
        target: dependency.target,
        type: "smoothstep" as const,
        zIndex: 2,
      }),
    );
  }

  return Object.freeze({
    edges: Object.freeze(edges),
    nodes: Object.freeze(nodes),
    notations: Object.freeze(SCALE_ORDER.filter((scale) => notations.has(scale))),
  });
}
