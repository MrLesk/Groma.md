import type { OptimizedBuffer } from '@opentui/core'

import type { ViewerTheme } from '../atoms/theme.ts'
import { visible } from '../atoms/visible.ts'
import { drawBoundary } from '../molecules/boundary.ts'
import { drawCard } from '../molecules/card.ts'
import { drawCompact } from '../molecules/compact.ts'
import { drawRoute, drawRouteArrow, drawRouteLabel } from '../molecules/route.ts'
import { drawSelection } from '../molecules/selection.ts'
import type { WorldProjection } from '../../../types.ts'

export function drawWorld(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
  options: { showSelection?: boolean } = {},
): void {
  buffer.pushScissorRect(
    projection.viewport.x,
    projection.viewport.y,
    projection.viewport.width,
    projection.viewport.height,
  )
  const elements = [...projection.elements].sort((left, right) => {
    return right.cellBounds.width * right.cellBounds.height
      - left.cellBounds.width * left.cellBounds.height
  })
  for (const relationship of projection.relationships) {
    drawRoute(buffer, relationship, theme)
  }
  for (const element of elements) {
    if (element.display === 'hidden' || !visible(element.cellBounds, projection.viewport)) {
      continue
    }
    if (element.display === 'compact') {
      drawCompact(buffer, element, theme)
      continue
    }
    if (element.display.endsWith('-boundary')) {
      drawBoundary(buffer, element, projection, theme)
      continue
    }
    drawCard(buffer, element, projection, theme)
  }
  for (const relationship of projection.relationships) {
    drawRouteLabel(buffer, relationship, projection, theme)
  }
  if (options.showSelection !== false) {
    drawSelection(
      buffer,
      projection.elements.find(element => {
        return element.representationId === projection.currentId
      }),
      theme,
    )
  }
  for (const relationship of projection.relationships) {
    drawRouteArrow(buffer, relationship, projection, theme)
  }
  buffer.popScissorRect()
}
