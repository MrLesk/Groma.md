import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from '../atoms/theme.ts'
import { visibleIn } from '../projection-camera.ts'
import {
  drawBoundaryFrame,
  drawPinnedBoundaryTitle,
  fillBoundary,
} from '../molecules/boundary.ts'
import { drawCard } from '../molecules/card.ts'
import { drawFlowMarker } from '../molecules/flow-marker.ts'
import { drawRoute, drawRouteLabel } from '../molecules/route.ts'
import { drawWorkMarker } from '../molecules/work-marker.ts'
import type { ProjectedFlowStep } from '../flow.ts'
import type { TerminalProjection } from '../projection.ts'
import type { WorkMarker } from '../../../types.ts'
import { assigneesOnElement } from '../../../work/projection.ts'

export function drawWorld(
  buffer: OptimizedBuffer,
  projection: TerminalProjection,
  theme: ViewerTheme,
  trace: {
    pathIds: Set<string>
    onPath: (elementId: string) => boolean
    work: WorkMarker[]
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
  const activeRoutes = projection.relationships.filter(route => {
    return route.ids.some(id => trace.pathIds.has(id))
  })
  const visibleItems = projection.items.filter(item => {
    return visibleIn(item.cellBounds, projection.viewport)
  })

  for (const item of visibleItems.filter(item => item.shape !== 'card')) {
    fillBoundary(buffer, item, theme)
  }
  for (const route of projection.relationships) {
    const active = route.ids.some(id => trace.pathIds.has(id))
    drawRoute(
      buffer,
      route,
      projection,
      theme,
      active,
      trace.tracedId !== undefined && route.ids.includes(trace.tracedId),
      active ? trace.animationPhase : undefined,
    )
  }
  for (const item of visibleItems.filter(item => item.shape !== 'card')) {
    drawBoundaryFrame(
      buffer,
      item,
      projection,
      theme,
      item.representationId === projection.currentId,
    )
  }
  for (const item of visibleItems.filter(item => item.shape === 'card')) {
    drawCard(
      buffer,
      item,
      projection,
      theme,
      tracing && item.representationId !== undefined && !trace.onPath(item.representationId),
    )
  }
  for (const item of visibleItems) {
    if (item.id === undefined) continue
    const assignees = assigneesOnElement(trace.work, item.id)
    if (assignees.length > 0) drawWorkMarker(buffer, item, assignees, theme)
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
  if (trace.step) {
    const source = visibleItems.find(item => item.key === trace.step?.source.visibleKey)
    const target = visibleItems.find(item => item.key === trace.step?.target.visibleKey)
    if (source && source.key !== target?.key) {
      drawFlowMarker(buffer, source, projection, theme, '●')
    }
    if (target) {
      const label = trace.step.target.visibleName === trace.step.target.name
        ? `▶ ${trace.step.index + 1}/${trace.step.total}`
        : `▶ ${trace.step.target.name}`
      drawFlowMarker(buffer, target, projection, theme, label)
    }
  }
  buffer.popScissorRect()
}
