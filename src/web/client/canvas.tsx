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
import { createContext, useContext, useMemo, type KeyboardEvent, type ReactNode } from "react";

import type { BlueprintModel } from "./model.ts";
import type { ApiComponentScale } from "./api.ts";
import {
  buildBlueprintFlowGraph,
  nextScaleLabel,
  SCALE_ORDER,
  type BlueprintFlowNode,
  type BlueprintGroupNode,
  type BlueprintNotation,
  type BlueprintTerm,
} from "./graph.ts";

interface CanvasActions {
  readonly onExpand: (id: string) => void;
  readonly onLoadMoreChildren: (id: string) => void;
  readonly onLoadMoreRoots: () => void;
  readonly onSelect: (id: string | undefined) => void;
  readonly onToggleFold: (id: string) => void;
}

const CanvasActionsContext = createContext<CanvasActions | undefined>(undefined);

/** Keeps the drawing clear of the fixed title block and view controls. */
const FIT_VIEW = Object.freeze({
  maxZoom: 1,
  padding: Object.freeze({ bottom: "9%", left: "4%", right: "4%", top: "35%" }),
});

const NOTATION_LABELS: Readonly<Record<BlueprintNotation, string>> = Object.freeze({
  domain: "domain plate",
  element: "element tick",
  part: "part corners",
  system: "system double rule",
  unscaled: "unscaled dashed rule",
});

function ComponentNode({ data, id, selected }: NodeProps<BlueprintFlowNode>) {
  const actions = useContext(CanvasActionsContext);
  if (actions === undefined) throw new Error("Blueprint canvas actions are unavailable");
  const hasLoadedChildren = data.childState === "expanded" || data.childState === "collapsed";
  const activateNodeControl = (event: KeyboardEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  };
  const toggleChildren = () =>
    data.childState === "unread" ? actions.onExpand(id) : actions.onToggleFold(id);

  // Borrowed code is listed, not drawn: a name and how widely it is relied on is
  // everything the scan can honestly say about a dependency whose insides it
  // never looked at.
  if (data.external) {
    return (
      <article className="groma-node groma-node--borrowed" data-scale={data.notation}>
        <Handle type="target" position={Position.Left} className="groma-handle" />
        <button
          type="button"
          className="nodrag nopan groma-node__select"
          aria-label={`Inspect ${data.label}`}
          onClick={() => actions.onSelect(id)}
          onKeyDown={(event) => activateNodeControl(event, () => actions.onSelect(id))}
        >
          {data.label}
        </button>
        <ul className="groma-node__evidence" aria-label={`Observed facts about ${data.label}`}>
          {data.dependents > 0 ? <li className="groma-chip">used by {data.dependents}</li> : null}
        </ul>
        <Handle type="source" position={Position.Right} className="groma-handle" />
      </article>
    );
  }

  return (
    <article
      className={`groma-node groma-node--${data.notation}${selected ? " is-selected" : ""}`}
      data-scale={data.notation}
    >
      <Handle type="target" position={Position.Left} className="groma-handle" />
      <div className="groma-node__rule" aria-hidden="true" />
      <div className="groma-node__heading">
        <span className="groma-node__notation" aria-hidden="true" />
        <span>{data.notation}</span>
        {data.external ? <span>borrowed</span> : null}
      </div>
      <button
        type="button"
        className="nodrag nopan groma-node__select"
        aria-label={`Inspect ${data.label}`}
        onClick={() => actions.onSelect(id)}
        onKeyDown={(event) => activateNodeControl(event, () => actions.onSelect(id))}
      >
        {data.label}
      </button>
      {data.summary === undefined ? null : (
        <p className="groma-node__summary" title={data.summary}>
          {data.summary}
        </p>
      )}
      <ul className="groma-node__evidence" aria-label={`Observed facts about ${data.label}`}>
        {data.shared ? <li className="groma-chip groma-chip--shared">shared</li> : null}
        {data.entryPoint ? <li className="groma-chip groma-chip--entry">entry</li> : null}
        {data.dependsOn > 0 ? <li className="groma-chip">uses {data.dependsOn}</li> : null}
        {data.dependents > 0 ? <li className="groma-chip">used by {data.dependents}</li> : null}
        {data.borrows > 0 ? <li className="groma-chip">{data.borrows} external</li> : null}
        {data.childCount > 0 ? <li className="groma-chip">{data.childCount} inside</li> : null}
      </ul>
      <div className="groma-node__disclosure nodrag nopan">
        {data.childState === "empty" ? null : (
          <button
            type="button"
            aria-expanded={hasLoadedChildren ? data.childState === "expanded" : undefined}
            aria-label={
              data.childState === "unread"
                ? `Show ${nextScaleLabel(data.notation === "unscaled" ? undefined : data.notation)} inside ${data.label}`
                : `${data.childState === "collapsed" ? "Unfold" : "Fold"} ${data.label}`
            }
            onClick={toggleChildren}
            onKeyDown={(event) => activateNodeControl(event, toggleChildren)}
          >
            {data.childState === "unread"
              ? `Show ${nextScaleLabel(data.notation === "unscaled" ? undefined : data.notation)} →`
              : data.childState === "collapsed"
                ? `Unfold ${data.childCount} →`
                : `Fold ${data.childCount}`}
          </button>
        )}
        {data.hasMoreChildren && data.childState === "expanded" ? (
          <button
            type="button"
            onClick={() => actions.onLoadMoreChildren(id)}
            onKeyDown={(event) => activateNodeControl(event, () => actions.onLoadMoreChildren(id))}
          >
            More · bounded page
          </button>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="groma-handle" />
    </article>
  );
}

function GroupNode({ data }: NodeProps<BlueprintGroupNode>) {
  return (
    <div
      className={`groma-group groma-group--${data.kind} groma-group--${data.notation}`}
      data-scale={data.notation}
    >
      <span className="groma-group__title">{data.label}</span>
      {data.contains === undefined ? null : (
        <span className="groma-group__contains">{data.contains}</span>
      )}
      {data.axis === undefined ? null : <span className="groma-group__axis">{data.axis}</span>}
      {data.summary === undefined ? null : <p className="groma-group__summary">{data.summary}</p>}
    </div>
  );
}

const NODE_TYPES = Object.freeze({ component: ComponentNode, group: GroupNode });

function LegendItem({ notation }: { notation: BlueprintNotation }) {
  return (
    <li>
      <span className={`groma-legend-mark groma-legend-mark--${notation}`} aria-hidden="true" />
      <span>
        <strong>{notation}</strong> · {NOTATION_LABELS[notation]}
      </span>
    </li>
  );
}

/**
 * Plain-language definitions of the vocabulary a mark carries, each paired with
 * the structural fact the scanner measured to earn it. Rendered only for terms
 * actually drawn, so the key never teaches a word the reader cannot find.
 */
const TERM_GLOSSARY: Readonly<Record<BlueprintTerm, { label: string; gloss: string }>> =
  Object.freeze({
    borrowed: Object.freeze({ label: "N external", gloss: "draws on N packages from outside" }),
    entry: Object.freeze({ label: "entry", gloss: "a way in: a command or served route" }),
    external: Object.freeze({ label: "borrowed", gloss: "third-party code, not built here" }),
    quoted: Object.freeze({
      label: "quoted line",
      gloss: "the component's own words, measured not written",
    }),
    shared: Object.freeze({ label: "shared", gloss: "used across two or more of the parts here" }),
  });

function TermItem({ term }: { term: BlueprintTerm }) {
  const { label, gloss } = TERM_GLOSSARY[term];
  return (
    <li>
      <span>
        <strong>{label}</strong> · {gloss}
      </span>
    </li>
  );
}

export interface CanvasProps extends CanvasActions {
  readonly dependencies: readonly { source: string; target: string; type: string }[];
  readonly folded: ReadonlySet<string>;
  readonly model: BlueprintModel;
  readonly onVisibleScale: (scale: ApiComponentScale | undefined) => void;
  readonly selectedId?: string | undefined;
  readonly visibleScale: ApiComponentScale | undefined;
}

export function Canvas({
  dependencies,
  folded,
  model,
  onExpand,
  onLoadMoreChildren,
  onLoadMoreRoots,
  onSelect,
  onToggleFold,
  onVisibleScale,
  selectedId,
  visibleScale,
}: CanvasProps) {
  const graph = useMemo(
    () => buildBlueprintFlowGraph({ dependencies, folded, model, visibleScale }),
    [dependencies, folded, model, visibleScale],
  );
  const nodes = useMemo(
    () => graph.nodes.map((node) => ({ ...node, selected: node.id === selectedId })),
    [graph.nodes, selectedId],
  );
  const actions = useMemo(
    () => ({ onExpand, onLoadMoreChildren, onLoadMoreRoots, onSelect, onToggleFold }),
    [onExpand, onLoadMoreChildren, onLoadMoreRoots, onSelect, onToggleFold],
  );

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="groma-flow" data-renderer="react-flow-dagre">
        <ReactFlow<BlueprintFlowNode | BlueprintGroupNode>
          key={visibleScale ?? "everything"}
          nodes={[...nodes]}
          edges={[...graph.edges]}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={FIT_VIEW}
          minZoom={0.12}
          maxZoom={2.5}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          nodesDraggable={false}
          nodesFocusable={false}
          elementsSelectable
          panOnDrag
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
          <Panel position="top-left" className="groma-title-block">
            <div className="groma-title-block__heading">
              <p>Architectural blueprint</p>
              <span>Scan {model.generation}</span>
              <span>{model.nodes.size} components drawn</span>
            </div>
            <div className="groma-scale-selector">
              <span id="groma-scale-label">Show down to</span>
              <div role="group" aria-labelledby="groma-scale-label">
                {SCALE_ORDER.map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    aria-pressed={visibleScale === scale}
                    onClick={() => onVisibleScale(visibleScale === scale ? undefined : scale)}
                  >
                    {scale}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={visibleScale === undefined}
                  onClick={() => onVisibleScale(undefined)}
                >
                  everything
                </button>
              </div>
            </div>
            {graph.notations.length > 0 ? (
              <details className="groma-title-block__key" open>
                <summary>Notation</summary>
                <ol aria-label="Component scale notation">
                  {graph.notations.map((notation) => (
                    <LegendItem key={notation} notation={notation} />
                  ))}
                  <li>
                    <span
                      className="groma-legend-mark groma-legend-mark--edge"
                      aria-hidden="true"
                    />
                    <span>
                      <strong>A → B</strong> · A uses B
                    </span>
                  </li>
                </ol>
                {graph.terms.length > 0 ? (
                  <ul className="groma-title-block__glossary" aria-label="What the marks mean">
                    {graph.terms.map((term) => (
                      <TermItem key={term} term={term} />
                    ))}
                  </ul>
                ) : null}
                <p className="groma-title-block__hint">
                  Everything here is <strong>evidence</strong>: measured or quoted verbatim by a
                  blind scan that reports structure and never interprets it. Meaning you add &mdash;
                  the <strong>intent</strong> &mdash; a scan never writes and a rescan never erases.
                  Scale sets what is shown; zoom only changes how large it looks.
                </p>
              </details>
            ) : null}
          </Panel>
          {model.hasMoreRoots ? (
            <Panel position="bottom-center" className="groma-bounded-notice">
              <span>More root components remain outside this bounded sheet.</span>
              <button type="button" onClick={onLoadMoreRoots}>
                Load next root page
              </button>
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
