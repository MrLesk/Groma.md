import type { SheetScene } from '../../sheet/types.ts'
import type { ArchitectureWorld } from '../../types.ts'
import type { WorkPin } from '../../work-pins.ts'

/** What the server ships on boot, on `/world.json` and on every SSE `world` event: the world, its sheet and the agents' pins. */
export interface WebPayload {
  generation: number
  world: ArchitectureWorld
  sheet: SheetScene
  pins: WorkPin[]
}
