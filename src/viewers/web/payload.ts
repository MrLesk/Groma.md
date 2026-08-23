import type { SheetScene } from '../../sheet/types.ts'
import type { ArchitectureWorld, WorkSnapshot } from '../../types.ts'
import type { WorkPin } from '../../work/pins.ts'

/** What the server ships on boot, on `/world.json` and on every SSE `world` event: the world, its sheet, the Backlog workflow and its pins. */
export interface WebPayload {
  generation: number
  world: ArchitectureWorld
  sheet: SheetScene
  /** The configured statuses and tasks the pins stand for. */
  work: WorkSnapshot
  pins: WorkPin[]
}
