import type { SheetScene } from '../../sheet/types.ts'
import type { ArchitectureWorld } from '../../types.ts'

/** What the server ships on boot, on `/world.json` and on every SSE `world` event: the world and its sheet. */
export interface WebPayload {
  generation: number
  world: ArchitectureWorld
  sheet: SheetScene
}
