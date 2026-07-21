import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type NodeProps,
} from "@xyflow/react";
import { createContext, useContext, useMemo, type KeyboardEvent } from "react";

import type { BlueprintModel } from "./model.ts";
import {
  buildBlueprintFlowGraph,
  nextScaleLabel,
  type BlueprintFlowNode,
  type BlueprintGroupNode,
} from "./graph.ts";

interface CanvasActions {
  readonly onFocus: (id: string) => void;
  readonly onLoadMoreRoots: () => void;
  readonly onSelect: (id: string | undefined) => void;
}

const CanvasActionsContext = createContext<CanvasActions | undefined>(undefined);
const FIT_VIEW = Object.freeze({
  maxZoom: 1,
  minZoom: 0.82,
  padding: Object.freeze({ bottom: "10%", left: "5%", right: "5%", top: "12%" }),
});

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
        <span>{data.notation}</span>
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
  readonly focusId?: string | undefined;
  readonly focusPath: readonly { id: string; label: string }[];
  readonly model: BlueprintModel;
  readonly onFocusTo: (depth: number) => void;
  readonly selectedId?: string | undefined;
}

export function Canvas({
  childCounts,
  dependencies,
  focusId,
  focusPath,
  model,
  onFocus,
  onFocusTo,
  onLoadMoreRoots,
  onSelect,
  selectedId,
}: CanvasProps) {
  const graph = useMemo(
    () => buildBlueprintFlowGraph({ childCounts, dependencies, focusId, model }),
    [childCounts, dependencies, focusId, model],
  );
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
  const actions = useMemo(
    () => ({ onFocus, onLoadMoreRoots, onSelect }),
    [onFocus, onLoadMoreRoots, onSelect],
  );
  const additional = graph.omittedComponents + (model.hasMoreRoots ? 1 : 0);

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="groma-flow" data-renderer="react-flow-bounded-level">
        <ReactFlow<BlueprintFlowNode | BlueprintGroupNode>
          key={`${focusId ?? "top"}:${graph.nodes.length}`}
          nodes={[...nodes]}
          edges={[...edges]}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={FIT_VIEW}
          minZoom={0.82}
          maxZoom={1.6}
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
              <span>{graph.visibleComponents} shown</span>
            </div>
            <details className="groma-title-block__key">
              <summary>How to read this sheet</summary>
              <p>
                Solid boundaries are architecture. Dashed entries are implementation evidence.
                Arrows read from the component that needs something to the component it needs.
              </p>
            </details>
          </Panel>
          {graph.evidence.length > 0 ? (
            <Panel position="bottom-right" className="groma-evidence-register">
              <div className="groma-evidence-register__heading">
                <strong>Implementation evidence</strong>
                <span>observed, not curated</span>
              </div>
              <ol>
                {graph.evidence.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => onSelect(item.id)}>
                      <span>{item.label}</span>
                      <small>{item.type}</small>
                    </button>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
          {additional > 0 || graph.omittedRelationships > 0 ? (
            <Panel position="bottom-center" className="groma-bounded-notice">
              <span>
                {additional > 0 ? `+${additional} more components · ` : ""}
                {graph.omittedRelationships > 0
                  ? `+${graph.omittedRelationships} relationships · `
                  : ""}
                use focus or search
              </span>
              {model.hasMoreRoots ? (
                <button type="button" onClick={onLoadMoreRoots}>
                  Read more roots
                </button>
              ) : null}
            </Panel>
          ) : null}
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
