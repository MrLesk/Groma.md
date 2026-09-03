import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from '../atoms/theme.ts'
import { routeTouches, visibleIn } from '../projection-camera.ts'
import {
  drawBoundaryFrame,
  drawPinnedBoundaryTitle,
  fillBoundary,
} from '../molecules/boundary.ts'
import { drawCard } from '../molecules/card.ts'
import { drawFlowMarker } from '../molecules/flow-marker.ts'
import { drawRoute, drawRouteLabel } from '../molecules/route.ts'
import type { ProjectedFlowStep } from '../flow.ts'
import type { ProjectedMapItem, ProjectedMapRoute, TerminalProjection } from '../projection.ts'
import type { WorkMap } from '../work/model.ts'
import { drawWorkMarker } from '../molecules/work-marker.ts'

/** The items and routes the painter visits: only what touches the viewport. */
export function paintedWorld(projection: TerminalProjection): {
  items: ProjectedMapItem[]
  routes: ProjectedMapRoute[]
} {
  return {
    items: projection.items.filter(item => visibleIn(item.cellBounds, projection.viewport)),
    routes: projection.relationships.filter(route => routeTouches(route.cellRoute, projection.viewport)),
  }
}

export function drawWorld(
  buffer: OptimizedBuffer,
  projection: TerminalProjection,
  theme: ViewerTheme,
  trace: {
    pathIds: Set<string>
    onPath: (elementId: string) => boolean
    work: WorkMap
    tracedId?: string
    step?: ProjectedFlowStep
    animationPhase: number
  },
): void {
  buffer.pushScissorRect(
    projection.viewport.x,
    projection.viewport.y,
    projection.viewport.width,
    projection.viewport.height,
  )
  const tracing = trace.pathIds.size > 0
  const { items: visibleItems, routes } = paintedWorld(projection)
  const activeRoutes = routes.filter(route => route.ids.some(id => trace.pathIds.has(id)))

  for (const item of visibleItems.filter(item => item.shape !== 'card')) {
    fillBoundary(buffer, item, theme)
  }
  for (const route of routes) {
    const flowActive = route.ids.some(id => trace.pathIds.has(id))
    const active = flowActive || trace.work.touched.has(route.source)
    drawRoute(
      buffer,
      route,
      projection,
      theme,
      active,
      trace.tracedId !== undefined && route.ids.includes(trace.tracedId),
      flowActive ? trace.animationPhase : undefined,
    )
  }
  for (const item of visibleItems.filter(item => item.shape !== 'card')) {
    drawBoundaryFrame(
      buffer,
      item,
      projection,
      theme,
      item.representationId === projection.currentId || trace.work.touched.has(item.key),
    )
  }
  for (const item of visibleItems.filter(item => item.shape === 'card')) {
    drawCard(
      buffer,
      item,
      projection,
      theme,
      tracing && item.representationId !== undefined && !trace.onPath(item.representationId),
      trace.work.touched.has(item.key),
    )
  }
  for (const route of activeRoutes) {
    drawRouteLabel(buffer, route, projection, theme, true)
  }
  const scope = projection.items.find(item => {
    return item.representationId === projection.currentId
      && (item.kind === 'system' || item.kind === 'container')
  }) ?? projection.items.find(item => {
    return projection.level === 'context' ? item.kind === 'system' : item.kind === 'container'
  })
  if (scope) drawPinnedBoundaryTitle(buffer, scope, projection, theme)
  for (const anchor of trace.work.anchors) {
    const item = visibleItems.find(candidate => candidate.representationId === anchor.elementId)
    if (item !== undefined) drawWorkMarker(buffer, item, projection, anchor, theme)
  }
  if (trace.step) {
    const source = visibleItems.find(item => item.key === trace.step?.source.visibleKey)
    const target = visibleItems.find(item => item.key === trace.step?.target.visibleKey)
    if (source && source.key !== target?.key) {
      drawFlowMarker(buffer, source, projection, theme, '●')
    }
    if (target) {
      const label = trace.step.target.visibleTitle === trace.step.target.title
        ? `▶ ${trace.step.index + 1}/${trace.step.total}`
        : `▶ ${trace.step.target.title}`
      drawFlowMarker(buffer, target, projection, theme, label)
    }
  }
  buffer.popScissorRect()
}
