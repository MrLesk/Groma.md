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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { nextFocusPath } from './focus.mjs'
import { projectArchitectureView } from './projection.mjs'

const levelLabels = {
  context: 'System context',
  container: 'Container view',
  component: 'Component view',
}
const compactViewportQuery = '(max-width: 760px)'
const regularFitViewOptions = {
  padding: 0.18,
  minZoom: 0.15,
  maxZoom: 1.1,
}
const compactFitViewOptions = {
  padding: 0.12,
  minZoom: 0.55,
  maxZoom: 1.1,
}
const comparisonLabels = {
  addition: 'Planned addition',
  modification: 'Planned modification',
  removal: 'Planned removal',
}

function useCompactViewport() {
  const [isCompact, setIsCompact] = useState(() => {
    return window.matchMedia(compactViewportQuery).matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(compactViewportQuery)
    const updateViewport = () => setIsCompact(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  return isCompact
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

function ComparisonBadge({ status, move }) {
  const label = comparisonLabels[status]
  if (!label) return null

  return (
    <>
      <span className="comparison-badge">{label}</span>
      {move ? (
        <span className="comparison-detail">
          Moved from {move.observedParentName} to {move.plannedParentName}
        </span>
      ) : null}
    </>
  )
}

function C4Node({ data }) {
  const content = (
    <>
      <span className="node-kicker">
        <TypeGlyph kind={data.kind} />
        {data.external ? `External ${data.kind}` : data.kind}
      </span>
      <ComparisonBadge
        status={data.comparisonStatus}
        move={data.comparisonMove}
      />
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
      className={
        `c4-node c4-node--${data.kind}`
        + `${data.external ? ' is-external' : ''}`
        + `${data.comparisonStatus ? ` is-comparison-${data.comparisonStatus}` : ''}`
      }
      data-testid={`c4-node-${data.elementId}`}
      data-element-id={data.elementId}
      data-kind={data.kind}
      data-comparison-status={data.comparisonStatus}
    >
      <ElementHandles />
      {data.expandable ? (
        <button
          type="button"
          className="node-button nodrag nopan"
          onClick={data.onExpand}
          aria-label={
            `Open ${data.name} ${data.kind}`
            + `${data.comparisonDescription
              ? `. ${data.comparisonDescription}`
              : ''}`
          }
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
      className={
        `c4-boundary c4-boundary--${data.kind}`
        + `${data.comparisonStatus ? ` is-comparison-${data.comparisonStatus}` : ''}`
      }
      data-testid={`c4-boundary-${data.elementId}`}
      data-element-id={data.elementId}
      data-kind={data.kind}
      data-comparison-status={data.comparisonStatus}
      aria-label={
        `${data.name} ${data.kind} boundary`
        + `${data.comparisonDescription
          ? `. ${data.comparisonDescription}`
          : ''}`
      }
    >
      <ElementHandles />
      <span className="boundary-index">C4 / {data.kind}</span>
      <ComparisonBadge
        status={data.comparisonStatus}
        move={data.comparisonMove}
      />
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
          aria-hidden="true"
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

function recoverFocusPath(payload, focusPath) {
  if (focusPath.length === 0) return focusPath
  if (focusPath[0] !== payload.focalSystemId) return []
  if (focusPath.length === 1) return focusPath

  const focusedContainer = [
    ...payload.model.elements,
    ...payload.observedModel.elements,
  ].find(element => {
    return element.id === focusPath[1]
      && element.kind === 'container'
      && element.parentId === payload.focalSystemId
  })

  return focusedContainer ? focusPath : [payload.focalSystemId]
}

export function ViewerApp() {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [reloadError, setReloadError] = useState(null)
  const [focusPath, setFocusPath] = useState([])
  const hasPayloadRef = useRef(false)
  const appliedGenerationRef = useRef(0)
  const announcedGenerationRef = useRef(0)
  const latestRequestRef = useRef(0)
  const levelHeadingRef = useRef(null)
  const shouldFocusLevelRef = useRef(false)
  const isCompactViewport = useCompactViewport()

  useEffect(() => {
    const controller = new AbortController()

    async function loadModel(minimumGeneration = 0) {
      const requestNumber = latestRequestRef.current + 1
      latestRequestRef.current = requestNumber

      try {
        const response = await fetch('/api/model', {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`The local viewer returned HTTP ${response.status}.`)
        }
        const nextPayload = await response.json()
        const requiredGeneration = Math.max(
          minimumGeneration,
          announcedGenerationRef.current,
          appliedGenerationRef.current,
        )
        if (
          requestNumber !== latestRequestRef.current
          || nextPayload.generation < requiredGeneration
        ) {
          return
        }

        appliedGenerationRef.current = nextPayload.generation
        setPayload(nextPayload)
        hasPayloadRef.current = true
        setError(null)
        setReloadError(nextPayload.reloadError)
      } catch (loadError) {
        if (
          loadError.name !== 'AbortError'
          && requestNumber === latestRequestRef.current
        ) {
          if (hasPayloadRef.current) {
            setReloadError(loadError.message)
          } else {
            setError(loadError.message)
          }
        }
      }
    }

    const events = new EventSource('/api/events')
    events.addEventListener('architecture-changed', event => {
      try {
        const { generation } = JSON.parse(event.data)
        announcedGenerationRef.current = Math.max(
          announcedGenerationRef.current,
          generation,
        )
        loadModel(generation)
      } catch {
        loadModel()
      }
    })
    events.addEventListener('architecture-error', event => {
      try {
        const { generation, message } = JSON.parse(event.data)
        announcedGenerationRef.current = Math.max(
          announcedGenerationRef.current,
          generation,
        )
        setReloadError(message)
        loadModel(generation)
      } catch {
        setReloadError('The changed Markdown is not a valid architecture revision.')
        loadModel()
      }
    })
    loadModel()
    return () => {
      controller.abort()
      events.close()
    }
  }, [])

  const displayFocusPath = useMemo(() => {
    return payload ? recoverFocusPath(payload, focusPath) : focusPath
  }, [focusPath, payload])

  useEffect(() => {
    if (displayFocusPath !== focusPath) {
      shouldFocusLevelRef.current = true
      setFocusPath(displayFocusPath)
    }
  }, [displayFocusPath, focusPath])

  const navigateToFocus = useCallback(nextPath => {
    if (
      nextPath.length === displayFocusPath.length
      && nextPath.every((id, index) => id === displayFocusPath[index])
    ) {
      return
    }

    shouldFocusLevelRef.current = true
    setFocusPath(nextPath)
  }, [displayFocusPath])

  const expandElement = useCallback((elementId, kind) => {
    navigateToFocus(nextFocusPath(displayFocusPath, elementId, kind))
  }, [displayFocusPath, navigateToFocus])

  const goBack = useCallback(() => {
    navigateToFocus(displayFocusPath.slice(0, -1))
  }, [displayFocusPath, navigateToFocus])

  const goToContext = useCallback(() => navigateToFocus([]), [navigateToFocus])
  const goToContainers = useCallback(() => {
    navigateToFocus(payload ? [payload.focalSystemId] : [])
  }, [navigateToFocus, payload])

  useEffect(() => {
    if (shouldFocusLevelRef.current) {
      levelHeadingRef.current?.focus()
      shouldFocusLevelRef.current = false
    }
  }, [displayFocusPath])

  const view = useMemo(() => {
    if (!payload) {
      return null
    }

    const projected = projectArchitectureView(
      payload.model,
      payload.focalSystemId,
      displayFocusPath,
      { observedModel: payload.observedModel },
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
  }, [displayFocusPath, expandElement, payload])

  if (error) {
    return <ErrorState message={error} />
  }
  if (!payload || !view) {
    return <LoadingState />
  }

  const focusNames = displayFocusPath.map(id => {
    return payload.model.elements.find(element => element.id === id)?.name
      ?? payload.observedModel.elements.find(element => element.id === id)?.name
      ?? id
  })
  const viewKey = displayFocusPath.join('/') || 'context'

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
          <span data-testid="revision-context-title">
            {payload.revisionContext.title}
          </span>
          <strong data-testid="revision-context-description">
            {payload.revisionContext.description || payload.revisionLabel}
          </strong>
        </div>
      </header>

      {reloadError ? (
        <p className="reload-status" role="status">
          Keeping the last valid architecture: {reloadError}
        </p>
      ) : null}

      <section className="viewer-stage" aria-label={levelLabels[view.level]}>
        <aside className="level-card">
          <div>
            <span className="eyebrow">C4 / 0{displayFocusPath.length + 1}</span>
            <h2 ref={levelHeadingRef} tabIndex={-1}>
              {levelLabels[view.level]}
            </h2>
            <p>
              {view.level === 'context'
                ? 'People and neighboring systems around Groma.'
                : view.level === 'container'
                  ? 'Runtime responsibilities inside the focal system.'
                  : 'The working parts inside the selected container.'}
            </p>
            <ul className="comparison-key" aria-label="Comparison key">
              {Object.entries(comparisonLabels).map(([status, label]) => (
                <li key={status} data-comparison-status={status}>
                  <span aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          {displayFocusPath.length > 0 ? (
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
            key={`${viewKey}:${isCompactViewport ? 'compact' : 'regular'}`}
            nodes={view.nodes}
            edges={view.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={
              isCompactViewport ? compactFitViewOptions : regularFitViewOptions
            }
            minZoom={isCompactViewport ? 0.55 : 0.15}
            maxZoom={1.5}
            panOnScroll={isCompactViewport}
            zoomOnScroll={!isCompactViewport}
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
        <span>Read-only comparison</span>
        <span>{view.nodes.length} elements · {view.edges.length} relationships</span>
        <span>
          {isCompactViewport
            ? 'Drag to pan · pinch to zoom'
            : 'Pan to move · scroll to zoom'}
        </span>
      </footer>
    </main>
  )
}
