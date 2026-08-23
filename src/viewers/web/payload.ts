import type { SheetScene } from '../../sheet/types.ts'
import type { ActiveWorkItem, ArchitectureWorld } from '../../types.ts'
import type { WorkPin } from '../../work-pins.ts'

/** What the server ships on boot, on `/world.json` and on every SSE `world` event: the world, its sheet, the active tasks and the agents' pins. */
export interface WebPayload {
  generation: number
  world: ArchitectureWorld
  sheet: SheetScene
  /** The tasks the pins stand for, shown in the details pane when a pin or chip is clicked. */
  work: ActiveWorkItem[]
  pins: WorkPin[]
}
