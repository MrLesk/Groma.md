import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import { recognizeObservedArea } from "../../application/observed-area-recognition.ts";
import type {
  ApiCognitiveComplexityEvidence,
  ApiComponentScale,
  ApiObservedPathEvidence,
} from "./api.ts";
import { componentPurpose, displayText, type BlueprintModel, type BlueprintNode } from "./model.ts";

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
  readonly projection?: "observed-group" | "observed-index";
  readonly relationshipCount: number;
  readonly shared: boolean;
  readonly type: string;
}

export interface BlueprintGroupNodeData extends Record<string, unknown> {
  readonly collapsible: boolean;
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
  readonly expandedIds?: readonly string[];
  readonly model: BlueprintModel;
}

export function projectionBranchIds(
  nodes: readonly (BlueprintFlowNode | BlueprintGroupNode)[],
  rootId: string,
): ReadonlySet<string> {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId === undefined) continue;
    const ids = children.get(node.parentId) ?? [];
    ids.push(node.id);
    children.set(node.parentId, ids);
  }
  const branch = new Set([rootId]);
  const pending = [rootId];
  for (let index = 0; index < pending.length; index += 1) {
    for (const childId of children.get(pending[index]!) ?? []) {
      if (branch.has(childId)) continue;
      branch.add(childId);
      pending.push(childId);
    }
  }
  return branch;
}

const CARD = Object.freeze({ height: 152, width: 240 });
const GAP = Object.freeze({ x: 32, y: 72 });
const FRAME = Object.freeze({ head: 106, pad: 28 });
const GRID_COLUMNS = 5;

function gridColumns(itemCount: number): number {
  if (itemCount <= GRID_COLUMNS) return Math.max(1, itemCount);
  return itemCount <= 8 ? 4 : GRID_COLUMNS;
}

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

function orderedLevel(
  ids: readonly string[],
  nodes: ReadonlyMap<string, BlueprintNode>,
): readonly string[] {
  return Object.freeze(
    ids
      .filter((id) => nodes.get(id)?.view.component.type !== "external")
      .toSorted((leftId, rightId) => {
        const left = nodes.get(leftId)!;
        const right = nodes.get(rightId)!;
        return (
          compareCodeUnits(displayText(left.view.component), displayText(right.view.component)) ||
          compareCodeUnits(leftId, rightId)
        );
      }),
  );
}

function observedSourceKey(evidence: ApiObservedPathEvidence): string {
  const { scanner } = evidence;
  return `${evidence.projectId}\u0000${scanner.id}\u0000${scanner.instance}\u0000${scanner.version}`;
}

function comparableObservedPaths(
  ids: readonly string[],
  model: BlueprintModel,
): ReadonlyMap<string, string> {
  const sources = new Map<string, Map<string, Set<string>>>();
  for (const id of ids) {
    for (const evidence of model.nodes.get(id)?.view.observedPaths ?? []) {
      const key = observedSourceKey(evidence);
      const paths = sources.get(key) ?? new Map<string, Set<string>>();
      const componentPaths = paths.get(id) ?? new Set<string>();
      componentPaths.add(evidence.resource);
      paths.set(id, componentPaths);
      sources.set(key, paths);
    }
  }
  const chosen = [...sources.entries()]
    .map(([key, paths]) => ({
      key,
      paths: new Map(
        [...paths].flatMap(([id, resources]) =>
          resources.size === 1 ? [[id, [...resources][0]!] as const] : [],
        ),
      ),
    }))
    .sort(
      (left, right) => right.paths.size - left.paths.size || compareCodeUnits(left.key, right.key),
    )[0];
  return chosen?.paths ?? new Map();
}

function pathSegments(resource: string): readonly string[] {
  return Object.freeze(
    resource.split("/").filter((segment) => segment.length > 0 && segment !== "."),
  );
}

function projectionId(scopeId: string, prefix: readonly string[], suffix = ""): string {
  const path = prefix.map((segment) => encodeURIComponent(segment)).join("/");
  return `projection:${scopeId}:${path}${suffix}`;
}

function projectionView(
  id: string,
  label: string,
  summary: string,
  type: string,
): BlueprintNode["view"] {
  return Object.freeze({
    component: Object.freeze({ id, kind: "component" as const, name: label, summary, type }),
    evidenceBound: true,
    revision: "projection",
  });
}

function componentCount(count: number, adjective = ""): string {
  const prefix = adjective.length === 0 ? "" : `${adjective} `;
  return `${count} ${prefix}component${count === 1 ? "" : "s"}`;
}

function clippedIndexLabel(value: string): string {
  const points = [...value];
  return points.length <= 28 ? value : `${points.slice(0, 27).join("")}…`;
}

function indexedChildren(
  scopeId: string,
  memberIds: readonly string[],
  prefix: readonly string[],
  nodes: Map<string, BlueprintNode>,
  lineage: readonly number[] = [],
): readonly string[] {
  const ordered = orderedLevel(memberIds, nodes);
  if (ordered.length <= LEVEL_COMPONENT_BUDGET) return ordered;

  const bucketSize = Math.max(
    LEVEL_COMPONENT_BUDGET,
    Math.ceil(ordered.length / LEVEL_COMPONENT_BUDGET),
  );
  const ids: string[] = [];
  for (let start = 0; start < ordered.length; start += bucketSize) {
    const members = Object.freeze(ordered.slice(start, start + bucketSize));
    const bucket = ids.length;
    const nextLineage = Object.freeze([...lineage, bucket]);
    const id = projectionId(scopeId, prefix, `:index:${nextLineage.join(".")}`);
    const first = clippedIndexLabel(displayText(nodes.get(members[0]!)!.view.component));
    const last = clippedIndexLabel(displayText(nodes.get(members.at(-1)!)!.view.component));
    const label = first === last ? `${first} (${members.length})` : `${first} – ${last}`;
    nodes.set(
      id,
      Object.freeze({
        childIds: indexedChildren(scopeId, members, prefix, nodes, nextLineage),
        hasMoreChildren: false,
        projection: Object.freeze({ kind: "observed-index", memberCount: members.length }),
        view: projectionView(
          id,
          label,
          `${componentCount(members.length, "observed")} indexed from ${first} through ${last}.`,
          "component index",
        ),
      }),
    );
    ids.push(id);
  }
  return Object.freeze(ids);
}

function projectedChildren(
  scopeId: string,
  memberIds: readonly string[],
  prefix: readonly string[],
  paths: ReadonlyMap<string, string>,
  nodes: Map<string, BlueprintNode>,
): readonly string[] {
  const orderedMembers = orderedLevel(memberIds, nodes);
  if (orderedMembers.length <= LEVEL_COMPONENT_BUDGET) return orderedMembers;

  const groups = new Map<string, string[]>();
  const ungrouped: string[] = [];
  for (const id of orderedMembers) {
    const segments = pathSegments(paths.get(id) ?? "");
    const matchesPrefix = prefix.every((segment, index) => segments[index] === segment);
    const next = matchesPrefix ? segments[prefix.length] : undefined;
    if (next === undefined) ungrouped.push(id);
    else {
      const members = groups.get(next) ?? [];
      members.push(id);
      groups.set(next, members);
    }
  }
  if (
    groups.size > 0 &&
    groups.size + ungrouped.length <= LEVEL_COMPONENT_BUDGET &&
    groups.size + ungrouped.length < orderedMembers.length
  ) {
    const ids: string[] = [];
    for (const [segment, members] of [...groups].sort(([left], [right]) =>
      compareCodeUnits(left, right),
    )) {
      const nextPrefix = Object.freeze([...prefix, segment]);
      const id = projectionId(scopeId, nextPrefix);
      const children = projectedChildren(scopeId, members, nextPrefix, paths, nodes);
      const recognition = recognizeObservedArea(nextPrefix, members.length);
      nodes.set(
        id,
        Object.freeze({
          childIds: children,
          hasMoreChildren: false,
          projection: Object.freeze({ kind: "observed-group", memberCount: members.length }),
          view: projectionView(
            id,
            recognition.label,
            recognition.summary,
            recognition.evidencePath,
          ),
        }),
      );
      ids.push(id);
    }
    return Object.freeze([...ids, ...orderedLevel(ungrouped, nodes)]);
  }

  return indexedChildren(scopeId, orderedMembers, prefix, nodes);
}

function visualProjectionModel(model: BlueprintModel): BlueprintModel {
  const nodes = new Map(model.nodes);
  for (const [parentId, node] of model.nodes) {
    if (node.childIds === undefined || node.childIds.length <= LEVEL_COMPONENT_BUDGET) continue;
    const paths = comparableObservedPaths(node.childIds, model);
    const projected = projectedChildren(parentId, node.childIds, [], paths, nodes);
    nodes.set(
      parentId,
      Object.freeze({ ...node, childIds: projected, visualChildCount: node.childIds.length }),
    );
  }
  const ownedRootIds = model.rootIds.filter(
    (id) => model.nodes.get(id)?.view.component.type !== "external",
  );
  if (ownedRootIds.length <= LEVEL_COMPONENT_BUDGET) return Object.freeze({ ...model, nodes });
  const externalRootIds = model.rootIds.filter(
    (id) => model.nodes.get(id)?.view.component.type === "external",
  );
  const paths = comparableObservedPaths(ownedRootIds, model);
  return Object.freeze({
    ...model,
    nodes,
    rootIds: Object.freeze([
      ...projectedChildren("roots", ownedRootIds, [], paths, nodes),
      ...externalRootIds,
    ]),
  });
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
  expandedIds: ReadonlySet<string>,
  model: BlueprintModel,
  childCounts: ReadonlyMap<string, number>,
  incident: ReadonlyMap<string, number>,
  ancestors: ReadonlySet<string>,
): LevelLayout {
  const node = model.nodes.get(id);
  const childIds = node?.childIds ?? [];
  const visibleIds = orderedLevel(childIds, model.nodes);
  const nextAncestors = new Set(ancestors).add(id);
  const prepared = visibleIds.map((childId) => {
    const expanded = expandedIds.has(childId) && !nextAncestors.has(childId);
    const group = expanded
      ? layoutLevel(childId, expandedIds, model, childCounts, incident, nextAncestors)
      : undefined;
    return Object.freeze({
      ...(group === undefined ? {} : { group }),
      height: group?.height ?? CARD.height,
      id: childId,
      width: group?.width ?? CARD.width,
    });
  });

  const columns = gridColumns(visibleIds.length);
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
  const width = contentWidth + FRAME.pad * 2;
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
  const { dependencies } = options;
  const originalOwnedRootCount = options.model.rootIds.filter(
    (id) => options.model.nodes.get(id)?.view.component.type !== "external",
  ).length;
  const model = visualProjectionModel(options.model);
  const expandedIdList = options.expandedIds ?? [];
  const expandedIds = new Set(expandedIdList);
  const activeExpandedId = expandedIdList.at(-1);
  const childCounts = options.childCounts ?? new Map<string, number>();
  const componentOf = (id: string) => model.nodes.get(id)?.view.component;
  const ownedRootIds = model.rootIds.filter(
    (id) => componentOf(id) !== undefined && componentOf(id)?.type !== "external",
  );
  const currentLevelId =
    activeExpandedId ?? (ownedRootIds.length === 1 ? ownedRootIds[0] : undefined);
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
    const childCount =
      blueprintNode.projection?.memberCount ??
      blueprintNode.visualChildCount ??
      childCounts.get(id) ??
      blueprintNode.childIds?.length ??
      0;
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
          ...(blueprintNode.projection === undefined
            ? {}
            : { projection: blueprintNode.projection.kind }),
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
    const total =
      blueprintNode.projection?.memberCount ??
      blueprintNode.visualChildCount ??
      Math.max(layout.visibleIds.length, childCounts.get(layout.id) ?? 0);
    visibleIds.add(layout.id);
    if (layout.id === currentLevelId) {
      currentLevelCount = layout.visibleIds.length;
      currentLevelTotal = total;
    }
    omittedComponents += layout.omitted;
    nodes.push(
      Object.freeze({
        data: Object.freeze({
          collapsible: expandedIds.has(layout.id),
          contains: componentCount(total),
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
        // React Flow disables pointer events on non-selectable nodes by default.
        // Keep the group semantic-only while allowing its collapse control to work.
        style: Object.freeze({
          height: layout.height,
          pointerEvents: "all" as const,
          width: layout.width,
        }),
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
      layoutLevel(rootId, expandedIds, model, childCounts, incident, new Set()),
      undefined,
      0,
      0,
      0,
    );
  } else {
    const roots = orderedLevel(ownedRootIds, model.nodes);
    if (expandedIdList.length === 0) {
      currentLevelCount = roots.length;
      currentLevelTotal = originalOwnedRootCount;
    }
    let column = 0;
    let y = 0;
    let rowHeight = 0;
    for (const id of roots) {
      const expanded = expandedIds.has(id);
      const x = column * (CARD.width + GAP.x);
      if (expanded) {
        const layout = layoutLevel(id, expandedIds, model, childCounts, incident, new Set());
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

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const containsNode = (containerId: string, nodeId: string): boolean => {
    let parentId = nodeById.get(nodeId)?.parentId;
    while (parentId !== undefined) {
      if (parentId === containerId) return true;
      parentId = nodeById.get(parentId)?.parentId;
    }
    return false;
  };
  const relationshipPairs = new Set<string>();
  const visibleRelationships = dependencies.flatMap((dependency) => {
    if (
      dependency.source === dependency.target ||
      !visibleIds.has(dependency.source) ||
      !visibleIds.has(dependency.target) ||
      containsNode(dependency.source, dependency.target) ||
      containsNode(dependency.target, dependency.source) ||
      nodeById.get(dependency.source)?.type !== "component" ||
      nodeById.get(dependency.target)?.type !== "component" ||
      nodeById.get(dependency.source)?.parentId !== nodeById.get(dependency.target)?.parentId
    )
      return [];
    const pair = `${dependency.source}\u0000${dependency.target}`;
    if (relationshipPairs.has(pair)) return [];
    relationshipPairs.add(pair);
    return [dependency];
  });
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
  const centers = new Map<string, { x: number; y: number }>();
  const centerOf = (id: string): { x: number; y: number } => {
    const known = centers.get(id);
    if (known !== undefined) return known;
    const node = nodeById.get(id);
    if (node === undefined) return { x: 0, y: 0 };
    const parent = node.parentId === undefined ? { x: 0, y: 0 } : centerOf(node.parentId);
    const parentNode = node.parentId === undefined ? undefined : nodeById.get(node.parentId);
    const parentOrigin =
      parentNode === undefined
        ? parent
        : {
            x: parent.x - (parentNode.width ?? 0) / 2,
            y: parent.y - (parentNode.height ?? 0) / 2,
          };
    const center = {
      x: parentOrigin.x + node.position.x + (node.width ?? 0) / 2,
      y: parentOrigin.y + node.position.y + (node.height ?? 0) / 2,
    };
    centers.set(id, center);
    return center;
  };
  const handlesFor = (source: string, target: string) => {
    const sourceNode = nodeById.get(source);
    const targetNode = nodeById.get(target);
    if (sourceNode?.type !== "component" || targetNode?.type !== "component") return undefined;
    const from = centerOf(source);
    const to = centerOf(target);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dy) < 1 && Math.abs(dx) <= CARD.width + GAP.x + 1) {
      return dx >= 0
        ? { sourceHandle: "source-right", targetHandle: "target-left" }
        : { sourceHandle: "source-left", targetHandle: "target-right" };
    }
    if (Math.abs(dx) < 1 && Math.abs(dy) <= CARD.height + GAP.y + 1) {
      return dy >= 0
        ? { sourceHandle: "source-bottom", targetHandle: "target-top" }
        : { sourceHandle: "source-top", targetHandle: "target-bottom" };
    }
    return undefined;
  };
  const drawnRelationships = visibleRelationships
    .flatMap((relationship) => {
      const handles = handlesFor(relationship.source, relationship.target);
      return handles === undefined ? [] : [{ handles, relationship }];
    })
    .slice(0, LEVEL_RELATIONSHIP_BUDGET);
  const edges: BlueprintFlowEdge[] = drawnRelationships.map(({ handles, relationship }) =>
    Object.freeze({
      className: "groma-edge",
      id: `relationship:${relationship.source}:${relationship.target}`,
      interactionWidth: 14,
      ...(relationshipLabel(relationship.type) === "needs"
        ? {}
        : { label: relationshipLabel(relationship.type) }),
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
      ...handles,
      target: relationship.target,
      type: "smoothstep" as const,
      zIndex: 1,
    }),
  );

  return Object.freeze({
    edges: Object.freeze(edges),
    ...(activeExpandedId === undefined
      ? ownedRootIds.length === 1
        ? { focusTargetId: ownedRootIds[0] }
        : {}
      : { focusTargetId: activeExpandedId }),
    levelComponents: currentLevelTotal,
    nodes: Object.freeze(nodes),
    omittedComponents,
    omittedRelationships: Math.max(0, visibleRelationships.length - edges.length),
    visibleComponents: currentLevelCount,
  });
}
