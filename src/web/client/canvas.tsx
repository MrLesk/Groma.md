import {
  Background,
  BackgroundVariant,
  Controls,
  getViewportForBounds,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  type NodeProps,
} from "@xyflow/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import type { BlueprintModel } from "./model.ts";
import {
  buildBlueprintFlowGraph,
  nextScaleLabel,
  type BlueprintFlowNode,
  type BlueprintGroupNode,
} from "./graph.ts";

interface CanvasActions {
  readonly onFocus: (id: string) => void;
  readonly onSelect: (id: string | undefined) => void;
}

const CanvasActionsContext = createContext<CanvasActions | undefined>(undefined);
const FIT_VIEW = Object.freeze({
  maxZoom: 1,
  minZoom: 0.55,
  padding: Object.freeze({ bottom: "10%", left: "5%", right: "5%", top: "12%" }),
});
const NEARBY_CONTEXT_COUNT = 3;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const query = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (query === undefined) return;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function ComponentNode({ data, id, selected }: NodeProps<BlueprintFlowNode>) {
  const actions = useContext(CanvasActionsContext);
  if (actions === undefined) throw new Error("Blueprint canvas actions are unavailable");
  const activate = (event: KeyboardEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  };
  return (
    <article
      className={`groma-node groma-node--${data.notation}${selected ? " is-selected" : ""}`}
      data-evidence-bound={data.evidenceBound || undefined}
      onClick={() => actions.onSelect(id)}
    >
      <Handle type="target" position={Position.Top} className="groma-handle" />
      <div className="groma-node__rule" aria-hidden="true" />
      <div className="groma-node__heading">
        <span className="groma-node__notation" aria-hidden="true" />
        <span>
          {data.evidenceBound && data.notation === "unscaled" ? "candidate" : data.notation}
        </span>
        <span>{data.type}</span>
        {data.evidenceBound ? <span className="groma-node__observed">observed</span> : null}
      </div>
      <button
        type="button"
        className="nodrag nopan groma-node__select"
        aria-label={`Inspect ${data.label}`}
        onClick={() => actions.onSelect(id)}
        onKeyDown={(event) => activate(event, () => actions.onSelect(id))}
      >
        {data.label}
      </button>
      <p className={`groma-node__purpose${data.purpose === undefined ? " is-missing" : ""}`}>
        {data.purpose ?? "Purpose not yet recorded."}
      </p>
      <ul className="groma-node__evidence" aria-label={`Context for ${data.label}`}>
        {data.shared ? <li className="groma-chip groma-chip--shared">shared</li> : null}
        {data.relationshipCount > 0 ? (
          <li className="groma-chip">
            {data.relationshipCount} relationship{data.relationshipCount === 1 ? "" : "s"}
          </li>
        ) : null}
        {data.cognitiveComplexity === undefined ? null : (
          <li className="groma-chip">cognitive {data.cognitiveComplexity}</li>
        )}
      </ul>
      <div className="groma-node__disclosure nodrag nopan">
        {data.canOpen ? (
          <button
            type="button"
            className="groma-node__open"
            onClick={(event) => {
              event.stopPropagation();
              actions.onFocus(id);
            }}
            onKeyDown={(event) => activate(event, () => actions.onFocus(id))}
          >
            Focus on {data.childCount}{" "}
            {nextScaleLabel(data.notation === "unscaled" ? undefined : data.notation)} →
          </button>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              actions.onSelect(id);
            }}
            onKeyDown={(event) => activate(event, () => actions.onSelect(id))}
          >
            Inspect →
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="groma-handle" />
    </article>
  );
}

function GroupNode({ data }: NodeProps<BlueprintGroupNode>) {
  return (
    <section className={`groma-group groma-group--${data.notation}`}>
      <div className="groma-group__heading">
        <span className="groma-group__title">{data.label}</span>
        <span className="groma-group__contains">{data.contains}</span>
      </div>
      <p className={`groma-group__summary${data.purpose === undefined ? " is-missing" : ""}`}>
        {data.purpose ?? "Purpose not yet recorded."}
      </p>
    </section>
  );
}

const NODE_TYPES = Object.freeze({ component: ComponentNode, group: GroupNode });

export interface CanvasProps extends CanvasActions {
  readonly childCounts: ReadonlyMap<string, number>;
  readonly dependencies: readonly { source: string; target: string; type: string }[];
  readonly focusPath: readonly { id: string; label: string }[];
  readonly model: BlueprintModel;
  readonly onFocusTo: (depth: number) => void;
  readonly selectedId?: string | undefined;
}

export function Canvas({
  childCounts,
  dependencies,
  focusPath,
  model,
  onFocus,
  onFocusTo,
  onSelect,
  selectedId,
}: CanvasProps) {
  const focusId = focusPath.at(-1)?.id;
  const flow = useRef<ReactFlowInstance<BlueprintFlowNode | BlueprintGroupNode> | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const [flowReady, setFlowReady] = useState(0);
  const reducedMotion = useReducedMotion();
  const graph = useMemo(
    () =>
      buildBlueprintFlowGraph({
        childCounts,
        dependencies,
        focusPath: focusPath.map((entry) => entry.id),
        model,
      }),
    [childCounts, dependencies, focusPath, model],
  );
  const focusTarget = graph.nodes.find((node) => node.id === graph.focusTargetId);
  const focusContentsLoaded =
    graph.focusTargetId !== undefined &&
    model.nodes.get(graph.focusTargetId)?.childIds !== undefined;
  const cameraNodeIds = useMemo(() => {
    if (graph.focusTargetId === undefined) return [];
    if (focusId === undefined || focusTarget === undefined) return [graph.focusTargetId];
    const siblings = graph.nodes
      .filter(
        (node) =>
          node.id !== focusTarget.id &&
          node.parentId === focusTarget.parentId &&
          node.type === "component",
      )
      .toSorted((left, right) => {
        const leftDistance =
          Math.abs(left.position.x - focusTarget.position.x) +
          Math.abs(left.position.y - focusTarget.position.y);
        const rightDistance =
          Math.abs(right.position.x - focusTarget.position.x) +
          Math.abs(right.position.y - focusTarget.position.y);
        return leftDistance - rightDistance || left.id.localeCompare(right.id);
      })
      // A small local ring proves where the reader came from without zooming
      // all the way back out to the complete parent level.
      .slice(0, NEARBY_CONTEXT_COUNT)
      .map((node) => node.id);
    return [graph.focusTargetId, ...siblings];
  }, [focusId, focusTarget, graph.focusTargetId, graph.nodes]);
  const cameraBounds = useMemo(() => {
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const positions = new Map<string, { x: number; y: number }>();
    const absolutePosition = (id: string): { x: number; y: number } => {
      const known = positions.get(id);
      if (known !== undefined) return known;
      const node = byId.get(id);
      if (node === undefined) return { x: 0, y: 0 };
      const parent = node.parentId === undefined ? { x: 0, y: 0 } : absolutePosition(node.parentId);
      const position = { x: parent.x + node.position.x, y: parent.y + node.position.y };
      positions.set(id, position);
      return position;
    };
    const framed = cameraNodeIds.flatMap((id) => {
      const node = byId.get(id);
      if (node === undefined) return [];
      const position = absolutePosition(id);
      return [
        {
          bottom: position.y + (node.height ?? 0),
          left: position.x,
          right: position.x + (node.width ?? 0),
          top: position.y,
        },
      ];
    });
    if (framed.length === 0) return undefined;
    const x = Math.min(...framed.map((bounds) => bounds.left));
    const y = Math.min(...framed.map((bounds) => bounds.top));
    const right = Math.max(...framed.map((bounds) => bounds.right));
    const bottom = Math.max(...framed.map((bounds) => bounds.bottom));
    return { height: bottom - y, width: right - x, x, y };
  }, [cameraNodeIds, graph.nodes]);
  useEffect(() => {
    if (
      graph.focusTargetId === undefined ||
      !focusContentsLoaded ||
      flow.current === null ||
      cameraBounds === undefined
    )
      return;
    let fittedFrame = 0;
    // React Flow commits controlled nodes, then measures them. Two frames keep
    // the camera move on the final expanded boundary instead of its old card.
    const layoutFrame = requestAnimationFrame(() => {
      fittedFrame = requestAnimationFrame(() => {
        const instance = flow.current;
        const boundsElement = canvas.current;
        if (instance === null || boundsElement === null) return;
        const rect = boundsElement.getBoundingClientRect();
        const viewport = getViewportForBounds(
          cameraBounds,
          rect.width,
          rect.height,
          0.55,
          focusId === undefined ? 1 : 1.3,
          focusId === undefined ? 0.08 : 0.14,
        );
        void instance.setViewport(viewport, { duration: reducedMotion ? 0 : 520 });
      });
    });
    return () => {
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(fittedFrame);
    };
  }, [
    flowReady,
    focusId,
    focusContentsLoaded,
    focusTarget?.height,
    focusTarget?.width,
    cameraNodeIds,
    cameraBounds,
    graph.focusTargetId,
    reducedMotion,
  ]);
  const relatedIds = useMemo(() => {
    if (selectedId === undefined) return new Set<string>();
    const ids = new Set([selectedId]);
    for (const edge of graph.edges) {
      if (edge.source === selectedId || edge.target === selectedId) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [graph.edges, selectedId]);
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        ...(node.type === "group" || selectedId === undefined
          ? {}
          : {
              className:
                node.id === selectedId
                  ? "is-selected-node"
                  : relatedIds.has(node.id)
                    ? "is-path-endpoint"
                    : "is-dimmed",
            }),
        selected: node.id === selectedId,
      })),
    [graph.nodes, relatedIds, selectedId],
  );
  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        className: `${edge.className ?? ""}${
          selectedId === undefined
            ? ""
            : edge.source === selectedId || edge.target === selectedId
              ? " is-related"
              : " is-dimmed"
        }`,
      })),
    [graph.edges, selectedId],
  );
  const actions = useMemo(() => ({ onFocus, onSelect }), [onFocus, onSelect]);

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div ref={canvas} className="groma-flow" data-renderer="react-flow-continuous-zoom">
        <ReactFlow<BlueprintFlowNode | BlueprintGroupNode>
          nodes={[...nodes]}
          edges={[...edges]}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={FIT_VIEW}
          minZoom={0.55}
          maxZoom={2}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          nodesDraggable={false}
          nodesFocusable={false}
          elementsSelectable
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          colorMode="light"
          onInit={(instance) => {
            flow.current = instance;
            setFlowReady((ready) => ready + 1);
          }}
          onPaneClick={() => onSelect(undefined)}
        >
          <Background variant={BackgroundVariant.Lines} gap={24} size={0.7} color="#dfe2de" />
          <Controls
            aria-label="Blueprint view controls"
            position="bottom-left"
            orientation="horizontal"
            showInteractive={false}
            fitViewOptions={FIT_VIEW}
          />
          {focusPath.length > 0 ? (
            <Panel position="top-center" className="groma-breadcrumb" data-canvas-keys="skip">
              <nav aria-label="Where you are" className="groma-breadcrumb__trail">
                <button type="button" onClick={() => onFocusTo(0)}>
                  overview
                </button>
                {focusPath.map((crumb, index) => (
                  <span key={crumb.id} className="groma-breadcrumb__step">
                    <span aria-hidden="true">/</span>
                    {index === focusPath.length - 1 ? (
                      <strong>{crumb.label}</strong>
                    ) : (
                      <button type="button" onClick={() => onFocusTo(index + 1)}>
                        {crumb.label}
                      </button>
                    )}
                  </span>
                ))}
              </nav>
            </Panel>
          ) : null}
          <Panel position="top-left" className="groma-title-block">
            <div className="groma-title-block__heading">
              <p>{focusId === undefined ? "System overview" : "Focused level"}</p>
              <span>scan {model.generation}</span>
              <span>
                {graph.visibleComponents} / {graph.levelComponents} at this level
              </span>
            </div>
            <details className="groma-title-block__key">
              <summary>How to read this sheet</summary>
              <p>
                Solid boundaries are architecture. Dashed entries are implementation evidence.
                Arrows read from the component that needs something to the component it needs.
              </p>
            </details>
          </Panel>
          {model.rootIds.length === 0 ? (
            <Panel position="top-center" className="groma-empty-sheet">
              Reading the current bounded blueprint…
            </Panel>
          ) : null}
        </ReactFlow>
      </div>
    </CanvasActionsContext.Provider>
  );
}
