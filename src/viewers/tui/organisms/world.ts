import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from '../atoms/theme.ts'
import { visible } from '../atoms/visible.ts'
import { drawBoundary, drawGroupBoundary } from '../molecules/boundary.ts'
import { drawCard } from '../molecules/card.ts'
import { drawRoute, drawRouteArrow, drawRouteLabel } from '../molecules/route.ts'
import { drawSelection } from '../molecules/selection.ts'
import type { WorldProjection } from '../../../types.ts'

export function drawWorld(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
  trace: {
    pathIds: Set<string>
    onPath: (elementId: string) => boolean
  } = {
    pathIds: new Set(),
    onPath: () => true,
  },
): void {
  buffer.pushScissorRect(
    projection.viewport.x,
    projection.viewport.y,
    projection.viewport.width,
    projection.viewport.height,
  )
  function shown(
    match: (element: (typeof projection.elements)[number]) => boolean,
  ): typeof projection.elements {
    return projection.elements.filter(element => {
      return match(element) && visible(element.cellBounds, projection.viewport)
    })
  }
  const tracing = trace.pathIds.size > 0
  // The displayed endpoints the lit routes attach to carry the accent too.
  const touched = new Set<string>()
  if (tracing) {
    for (const relationship of projection.relationships) {
      if (!trace.pathIds.has(relationship.id)) continue
      touched.add(relationship.displaySource)
      touched.add(relationship.displayTarget)
    }
  }
  for (const relationship of projection.relationships) {
    const lit = tracing && trace.pathIds.has(relationship.id)
    drawRoute(buffer, relationship, theme, tracing && !lit, lit)
  }
  for (const element of shown(element => {
    return element.display === 'card' && element.kind === 'component'
  })) {
    drawCard(
      buffer,
      element,
      projection,
      theme,
      tracing && !trace.onPath(element.representationId),
      touched.has(element.representationId),
    )
  }
  for (const group of projection.groups) {
    if (visible(group.cellBounds, projection.viewport)) {
      drawGroupBoundary(buffer, group, projection, theme)
    }
  }
  for (const element of shown(element => element.display === 'container-boundary')) {
    drawBoundary(buffer, element, projection, theme, touched.has(element.representationId))
  }
  for (const element of shown(element => element.display === 'system-boundary')) {
    drawBoundary(buffer, element, projection, theme, touched.has(element.representationId))
  }
  const selected = projection.elements.find(element => {
    return element.representationId === projection.currentId
  })
  if (selected?.display.endsWith('-boundary')) {
    drawSelection(buffer, selected, theme)
  }
  for (const element of shown(element => {
    return element.display === 'card' && element.kind !== 'component'
  })) {
    drawCard(
      buffer,
      element,
      projection,
      theme,
      tracing && !trace.onPath(element.representationId),
      touched.has(element.representationId),
    )
  }
  if (selected?.display === 'card') {
    drawSelection(buffer, selected, theme)
  }
  for (const relationship of projection.relationships) {
    drawRouteLabel(
      buffer,
      relationship,
      projection,
      theme,
      tracing && trace.pathIds.has(relationship.id),
    )
  }
  for (const relationship of projection.relationships) {
    const lit = tracing && trace.pathIds.has(relationship.id)
    if (tracing && !lit) continue
    drawRouteArrow(buffer, relationship, projection, theme, lit)
  }
  buffer.popScissorRect()
}
