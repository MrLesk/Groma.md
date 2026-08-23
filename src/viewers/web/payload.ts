import type { SheetScene } from '../../sheet/types.ts'
import type { ArchitectureGraph, WorkSnapshot } from '../../types.ts'
import type { WorkPin } from '../../work/pins.ts'

/** Architecture state, changed only by architecture publication. */
export interface WebMapPayload {
  generation: number
  world: ArchitectureGraph
  sheet: SheetScene
}

/** Optional work state, changed only by a work plugin publication. */
export interface WebWorkPayload {
  workGeneration: number
  /** The configured statuses and tasks the pins stand for. */
  work: WorkSnapshot
  pins: WorkPin[]
}

/** What the server ships on boot, on `/world.json` and on every SSE `world` event. */
export type WebPayload = WebMapPayload & WebWorkPayload
