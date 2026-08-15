import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from '../atoms/theme.ts'
import { visible } from '../atoms/visible.ts'
import { drawBoundary } from '../molecules/boundary.ts'
import { drawCard } from '../molecules/card.ts'
import { drawRoute, drawRouteArrow, drawRouteLabel } from '../molecules/route.ts'
import { drawSelection } from '../molecules/selection.ts'
import type { WorldProjection } from '../../../types.ts'

export function drawWorld(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
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
  for (const relationship of projection.relationships) {
    drawRoute(buffer, relationship, theme)
  }
  for (const element of shown(element => {
    return element.display === 'card' && element.kind === 'component'
  })) {
    drawCard(buffer, element, projection, theme)
  }
  for (const element of shown(element => element.display === 'container-boundary')) {
    drawBoundary(buffer, element, projection, theme)
  }
  for (const element of shown(element => element.display === 'system-boundary')) {
    drawBoundary(buffer, element, projection, theme)
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
    drawCard(buffer, element, projection, theme)
  }
  if (selected?.display === 'card') {
    drawSelection(buffer, selected, theme)
  }
  for (const relationship of projection.relationships) {
    drawRouteLabel(buffer, relationship, projection, theme)
  }
  for (const relationship of projection.relationships) {
    drawRouteArrow(buffer, relationship, projection, theme)
  }
  buffer.popScissorRect()
}
