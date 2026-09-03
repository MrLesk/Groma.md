import type { OptimizedBuffer } from '@opentui/core'

import { actionLegs, elementOnPath } from '../action-path.ts'
import type { ViewerTheme } from './atoms/theme.ts'
import type { ProjectedFlowStep } from './flow.ts'
import type { TerminalViewModel } from './model.ts'
import type { LitAction } from './navigation.ts'
import { drawWorld } from './organisms/world.ts'
import type { TerminalProjection } from './projection.ts'
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
  const legs = actionLegs(options.lit.id, world, options.lit.actorId)
  const pathIds = new Set(legs.map(leg => leg.id))
  const selectionId = projection.currentId ?? undefined
  drawWorld(buffer, projection, theme, {
    pathIds,
    onPath: elementId => elementId === selectionId || elementOnPath(elementId, pathIds, world),
    tracedId: options.step?.id,
    step: options.step,
    work: projectWork(world, projection, options.workFocus),
    animationPhase: options.animationPhase,
  })
}
