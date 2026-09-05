import type { OptimizedBuffer } from '@opentui/core'

import { elementOnPath } from '../flows.ts'
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
import type { WorkFocus, WorkListSettings } from './work/model.ts'

/** Paints the projected world into the map's own buffer; the chrome around it is toolkit renderables. */
export function paintMap(
  buffer: OptimizedBuffer,
  projection: TerminalProjection,
  world: TerminalViewModel,
  theme: ViewerTheme,
  options: {
    /** The explicitly selected flow or relationship the map lights. */
    lit: LitAction
    step: ProjectedFlowStep | undefined
    workFocus?: WorkFocus
    workList?: WorkListSettings
    animationPhase: number
  },
): void {
  buffer.clear(theme.background)
  if (isEmptyWorld(world)) {
    drawEmptyWorld(buffer, world.project?.title ?? '', theme)
    return
  }
  const legs = litLegs(world, options.lit)
  const pathIds = new Set(options.step === undefined ? legs.map(leg => leg.id) : [options.step.id])
  const selectionId = projection.currentId ?? undefined
  drawWorld(buffer, projection, theme, {
    pathIds,
    onPath: elementId => elementId === selectionId || elementOnPath(elementId, pathIds, world),
    step: options.step,
    work: world.flows.some(flow => flow.id === options.lit.id)
      ? { corners: [], touched: new Set() }
      : projectWork(world, projection, options.workFocus, options.workList),
    animationPhase: options.animationPhase,
  })
}
