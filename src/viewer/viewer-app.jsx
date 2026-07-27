import {
  BaseEdge,
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  getSmoothStepPath,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { projectArchitectureView } from './projection.mjs'

const levelLabels = {
  context: 'System context',
  container: 'Container view',
  component: 'Component view',
}

function ElementHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  )
}

function TypeGlyph({ kind }) {
  if (kind === 'person') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="7.2" r="3.4" />
        <path d="M5.2 20c.4-5 2.6-7.5 6.8-7.5s6.4 2.5 6.8 7.5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M3.5 9h17M8 5v4" />
    </svg>
  )
}

function C4Node({ data }) {
  const content = (
    <>
      <span className="node-kicker">
        <TypeGlyph kind={data.kind} />
        {data.external ? `External ${data.kind}` : data.kind}
      </span>
      <strong>{data.name}</strong>
      <span className="node-description">{data.description}</span>
      {data.expandable ? (
        <span className="node-action">
          Open {data.kind}
          <span aria-hidden="true">↗</span>
        </span>
      ) : null}
    </>
  )

  return (
    <article
      className={`c4-node c4-node--${data.kind}${data.external ? ' is-external' : ''}`}
      data-testid={`c4-node-${data.elementId}`}
      data-element-id={data.elementId}
      data-kind={data.kind}
    >
      <ElementHandles />
      {data.expandable ? (
        <button
          type="button"
          className="node-button nodrag nopan"
          onClick={data.onExpand}
          aria-label={`Open ${data.name} ${data.kind}`}
        >
          {content}
        </button>
      ) : (
        <div className="node-content">{content}</div>
      )}
    </article>
  )
}

function BoundaryNode({ data }) {
  return (
    <section
      className={`c4-boundary c4-boundary--${data.kind}`}
      data-testid={`c4-boundary-${data.elementId}`}
      data-element-id={data.elementId}
      data-kind={data.kind}
      aria-label={`${data.name} ${data.kind} boundary`}
    >
      <ElementHandles />
      <span className="boundary-index">C4 / {data.kind}</span>
      <strong>{data.name}</strong>
      <span>{data.description}</span>
    </section>
  )
}

function RelationshipEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  style,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 3,
    offset: 20,
  })

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="relationship-label"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {String(label).split('\n').map(line => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = {
  boundary: BoundaryNode,
  c4: C4Node,
}
const edgeTypes = {
  relationship: RelationshipEdge,
}

function LoadingState() {
  return (
    <main className="status-page">
      <span className="status-mark" aria-hidden="true">G</span>
      <p>Reading the selected architecture revision…</p>
    </main>
  )
}

function ErrorState({ message }) {
  return (
    <main className="status-page status-page--error">
      <span className="status-mark" aria-hidden="true">!</span>
      <h1>The architecture could not be drawn.</h1>
      <p>{message}</p>
    </main>
  )
}

export function ViewerApp() {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [focusPath, setFocusPath] = useState([])

  useEffect(() => {
    const controller = new AbortController()

    async function loadModel() {
      try {
        const response = await fetch('/api/model', {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`The local viewer returned HTTP ${response.status}.`)
        }
        setPayload(await response.json())
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message)
        }
      }
    }

    loadModel()
    return () => controller.abort()
  }, [])

  const expandElement = useCallback((elementId, kind) => {
    if (kind === 'system') {
      setFocusPath([elementId])
    } else if (kind === 'container') {
      setFocusPath(current => [...current, elementId])
    }
  }, [])

  const goBack = useCallback(() => {
    setFocusPath(current => current.slice(0, -1))
  }, [])

  const goToContext = useCallback(() => setFocusPath([]), [])
  const goToContainers = useCallback(() => {
    setFocusPath(payload ? [payload.focalSystemId] : [])
  }, [payload])

  const view = useMemo(() => {
    if (!payload) {
      return null
    }

    const projected = projectArchitectureView(
      payload.model,
      payload.focalSystemId,
      focusPath,
    )

    return {
      ...projected,
      nodes: projected.nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onExpand: node.data.expandable
            ? () => expandElement(node.data.elementId, node.data.kind)
            : undefined,
        },
      })),
      edges: projected.edges.map(edge => ({
        ...edge,
        style: {
          stroke: '#35536d',
          strokeWidth: 1.6,
        },
        markerEnd: {
          ...edge.markerEnd,
          color: '#c84f31',
          width: 18,
          height: 18,
        },
      })),
    }
  }, [expandElement, focusPath, payload])

  if (error) {
    return <ErrorState message={error} />
  }
  if (!payload || !view) {
    return <LoadingState />
  }

  const focusNames = focusPath.map(id => {
    return payload.model.elements.find(element => element.id === id)?.name ?? id
  })
  const viewKey = focusPath.join('/') || 'context'

  return (
    <main className="viewer-shell">
      <header className="viewer-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">G</span>
          <div>
            <p>Architecture field notes</p>
            <h1>Groma</h1>
          </div>
        </div>

        <nav className="breadcrumbs" aria-label="C4 level">
          <button type="button" onClick={goToContext} aria-current={view.level === 'context'}>
            Context
          </button>
          {focusNames[0] ? (
            <>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={goToContainers}
                aria-current={view.level === 'container'}
              >
                {focusNames[0]}
              </button>
            </>
          ) : null}
          {focusNames[1] ? (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{focusNames[1]}</span>
            </>
          ) : null}
        </nav>

        <div className="revision-stamp">
          <span>Selected revision</span>
          <strong>{payload.revisionLabel}</strong>
        </div>
      </header>

      <section className="viewer-stage" aria-label={levelLabels[view.level]}>
        <aside className="level-card">
          <div>
            <span className="eyebrow">C4 / 0{focusPath.length + 1}</span>
            <h2>{levelLabels[view.level]}</h2>
            <p>
              {view.level === 'context'
                ? 'People and neighboring systems around Groma.'
                : view.level === 'container'
                  ? 'Runtime responsibilities inside the focal system.'
                  : 'The working parts inside the selected container.'}
            </p>
          </div>
          {focusPath.length > 0 ? (
            <button type="button" className="back-button" onClick={goBack}>
              <span aria-hidden="true">←</span>
              Previous level
            </button>
          ) : (
            <p className="level-hint">Select the marked system to decompose it.</p>
          )}
        </aside>

        <div className="flow-frame" data-testid={`view-${view.level}`}>
          <ReactFlow
            key={viewKey}
            nodes={view.nodes}
            edges={view.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.18, minZoom: 0.15, maxZoom: 1.1 }}
            minZoom={0.15}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              id="minor-grid"
              variant={BackgroundVariant.Lines}
              gap={22}
              color="#ddd4bd"
              lineWidth={0.65}
            />
            <Background
              id="major-grid"
              variant={BackgroundVariant.Lines}
              gap={110}
              color="#c7bda6"
              lineWidth={0.9}
            />
            <Controls showInteractive={false} position="bottom-right" />
            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeColor={node => {
                if (node.type === 'boundary') return '#d9cfb8'
                if (node.data.kind === 'person') return '#d8b64c'
                if (node.data.external) return '#7b8791'
                return '#17324d'
              }}
              maskColor="rgba(244, 239, 223, 0.72)"
            />
          </ReactFlow>
        </div>
      </section>

      <footer className="viewer-footer">
        <span>Read-only local view</span>
        <span>{view.nodes.length} elements · {view.edges.length} relationships</span>
        <span>Pan to move · scroll to zoom</span>
      </footer>
    </main>
  )
}
