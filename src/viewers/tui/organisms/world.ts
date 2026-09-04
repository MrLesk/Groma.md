import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from '../atoms/theme.ts'
import { routeTouches, visibleIn } from '../projection-camera.ts'
import { drawSurfaceFrame, fillSurface } from '../molecules/surface.ts'
import { drawBuilding } from '../molecules/building.ts'
import { drawFlowMarker } from '../molecules/flow-marker.ts'
import { drawPorts, drawRoute, drawRouteLabel, type Occupied } from '../molecules/route.ts'
import { drawRow } from '../molecules/row.ts'
import type { ProjectedFlowStep } from '../flow.ts'
import type { MapShape, ProjectedMapItem, ProjectedMapRoute, TerminalProjection } from '../projection.ts'
import type { WorkMap } from '../work/model.ts'
import { drawWorkCorner } from '../molecules/work-marker.ts'

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
  const surfaces = visibleItems.filter(item => SURFACES.has(item.shape))
  const accented = (item: ProjectedMapItem): boolean => {
    return item.representationId === projection.currentId || trace.work.touched.has(item.key)
  }
  // A route lights when it carries a lit flow or touches the selection or a work-touched element.
  const onFlow = (route: ProjectedMapRoute): boolean => route.ids.some(id => trace.pathIds.has(id))
  const lit = (route: ProjectedMapRoute): boolean => onFlow(route)
    || route.source === projection.currentId || route.target === projection.currentId
    || trace.work.touched.has(route.source) || trace.work.touched.has(route.target)
  const boundsByKey = new Map(projection.items.map(item => [item.key, item.cellBounds]))
  const ends = (route: ProjectedMapRoute) => ({ source: boundsByKey.get(route.source), target: boundsByKey.get(route.target) })
  const litRoutes = routes.filter(lit)

  for (const item of surfaces) fillSurface(buffer, item, projection.viewport, theme)
  const occupied: Occupied = new Map()
  for (const route of routes.filter(route => !lit(route))) {
    drawRoute(buffer, route, projection.viewport, theme, { lit: false, ends: ends(route), occupied })
  }
  for (const route of litRoutes) {
    drawRoute(buffer, route, projection.viewport, theme, {
      lit: true,
      ends: ends(route),
      ...(onFlow(route) ? { animationPhase: trace.animationPhase } : {}),
    })
  }
  for (const item of surfaces) drawSurfaceFrame(buffer, item, theme, accented(item))
  drawRowsAndCards(buffer, visibleItems, projection, theme, trace, tracing)
  // Port dots sit on the shapes' frames, so they follow the shapes; labels last, over plain ground.
  for (const route of litRoutes) drawPorts(buffer, route, projection.viewport, theme, ends(route))
  for (const route of litRoutes) drawRouteLabel(buffer, route, projection.level, theme, visibleItems)
  for (const corner of trace.work.corners) {
    const item = visibleItems.find(candidate => candidate.representationId === corner.elementId)
    if (item !== undefined) drawWorkCorner(buffer, item, corner, theme)
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

/** Rows inside their islands, then buildings dimmed off a lit walk and accented by work. */
function drawRowsAndCards(
  buffer: OptimizedBuffer,
  items: readonly ProjectedMapItem[],
  projection: TerminalProjection,
  theme: ViewerTheme,
  trace: { onPath: (elementId: string) => boolean; work: WorkMap },
  tracing: boolean,
): void {
  for (const item of items) {
    if (item.shape === 'row') {
      drawRow(buffer, item, theme, item.representationId === projection.currentId)
    }
    if (item.shape !== 'card') continue
    drawBuilding(buffer, item, theme, {
      selected: item.representationId === projection.currentId,
      dimmed: tracing && item.representationId !== undefined && !trace.onPath(item.representationId),
      accented: trace.work.touched.has(item.key),
    })
  }
}
