import type { GitRevision } from '../../history/git.ts'
import type { SheetScene } from '../../sheet/types.ts'
import type { ProjectProfile } from '../../project-profile.ts'
import type { ArchitectureGraph, WorkSnapshot } from '../../types.ts'
import type { WorkPin } from '../../work/pins.ts'

export interface WebRevision extends GitRevision {
  compatible: boolean
}

export interface WebMapTimings {
  architectureLoadMilliseconds: number
  placementMilliseconds: number
  routingMilliseconds: number
  totalMilliseconds: number
}

/** Map state, changed by architecture folds or project-profile saves. */
export interface WebMapPayload {
  generation: number
  project: ProjectProfile | null
  revision: WebRevision | null
  revisions: WebRevision[]
  world: ArchitectureGraph
  sheet: SheetScene
  timings: WebMapTimings
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
