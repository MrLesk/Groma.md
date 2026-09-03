import type { OptimizedBuffer } from '@opentui/core'

import { elementOnPath } from '../action-path.ts'
import { isEmptyWorld } from '../../empty-world.ts'
import type { ViewerTheme } from './atoms/theme.ts'
import type { ProjectedFlowStep } from './flow.ts'
import type { TerminalViewModel } from './model.ts'
import type { LitAction } from './navigation.ts'
import { drawWorld } from './organisms/world.ts'
import { drawEmptyWorld } from './organisms/empty.ts'
import type { TerminalProjection } from './projection.ts'
import { litLegs } from './flow.ts'
import { projectWork } from './work/model.ts'
import type { WorkFocus } from './work/model.ts'

/** Paints the projected world into the map's own buffer; the chrome around it is toolkit renderables. */
export function paintMap(
  buffer: OptimizedBuffer,
  projection: TerminalProjection,
  world: TerminalViewModel,
  theme: ViewerTheme,
  options: {
    /** The walk the map lights: the details preview, or the committed pick. */
    lit: LitAction
    step: ProjectedFlowStep | undefined
    workFocus?: WorkFocus
    animationPhase: number
  },
): void {
  buffer.clear(theme.background)
  if (isEmptyWorld(world)) {
    drawEmptyWorld(buffer, world.project?.title ?? '', theme)
    return
  }
  const legs = litLegs(world, options.lit)
  const pathIds = new Set(legs.map(leg => leg.id))
  const selectionId = projection.currentId ?? undefined
  drawWorld(buffer, projection, theme, {
    pathIds,
    onPath: elementId => elementId === selectionId || elementOnPath(elementId, pathIds, world),
    step: options.step,
    work: projectWork(world, projection, options.workFocus),
    animationPhase: options.animationPhase,
  })
}
