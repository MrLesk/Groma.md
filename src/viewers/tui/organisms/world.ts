import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from '../atoms/theme.ts'
import { routeTouches, visibleIn } from '../projection-camera.ts'
import { drawSurfaceFrame, fillSurface } from '../molecules/surface.ts'
import { drawBuilding } from '../molecules/building.ts'
import { drawFlowMarker } from '../molecules/flow-marker.ts'
import { drawRoute, drawRouteLabel } from '../molecules/route.ts'
import { drawRow } from '../molecules/row.ts'
import type { ProjectedFlowStep } from '../flow.ts'
import type { MapShape, ProjectedMapItem, ProjectedMapRoute, TerminalProjection } from '../projection.ts'
import type { WorkMap } from '../work/model.ts'
import { drawWorkMarker } from '../molecules/work-marker.ts'

const SURFACES: ReadonlySet<MapShape> = new Set(['island', 'slab', 'group'])

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
  const surfaces = visibleItems.filter(item => SURFACES.has(item.shape))
  const accented = (item: ProjectedMapItem): boolean => {
    return item.representationId === projection.currentId || trace.work.touched.has(item.key)
  }

  for (const item of surfaces) fillSurface(buffer, item, projection.viewport, theme)
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
  for (const item of surfaces) drawSurfaceFrame(buffer, item, theme, accented(item))
  drawRowsAndCards(buffer, visibleItems, projection, theme, trace, tracing)
  for (const route of activeRoutes) {
    drawRouteLabel(buffer, route, projection, theme, true)
  }
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

/** Rows inside their islands, then buildings: dimmed off a lit walk, accented when touched by work. */
function drawRowsAndCards(
  buffer: OptimizedBuffer,
  items: readonly ProjectedMapItem[],
  projection: TerminalProjection,
  theme: ViewerTheme,
  trace: { onPath: (elementId: string) => boolean; work: WorkMap },
  tracing: boolean,
): void {
  for (const item of items) {
    if (item.shape === 'row') drawRow(buffer, item, theme, item.representationId === projection.currentId)
    if (item.shape !== 'card') continue
    drawBuilding(buffer, item, theme, {
      selected: item.representationId === projection.currentId,
      dimmed: tracing && item.representationId !== undefined && !trace.onPath(item.representationId),
      accented: trace.work.touched.has(item.key),
    })
  }
}
