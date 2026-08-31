import type { GitRevision } from '../../history/git.ts'
import type { SheetScene } from '../../sheet/types.ts'
import type { ProjectProfile } from '../../project-profile.ts'
import type { ArchitectureGraph, WorkItemDetails, WorkSnapshot } from '../../types.ts'
import type { WorkPin } from '../../work/pins.ts'
import type { SourcePayload } from './source/read.ts'
import type { CodeFile } from './source/structure.ts'
import type { TaskDiffPayload } from './task-diff/read.ts'

export const PUBLISHED_EVENT = 'groma:published'
export const PUBLISHED_VERSION_EVENT = 'groma:published-version'

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

/** Repository-backed reads materialized before a static Web view is published. */
export interface PublishedReads {
  code: { element: string; files: readonly CodeFile[] }[]
  sources: { element: string; file: string; source: SourcePayload }[]
  tasks: { id: string; details: WorkItemDetails }[]
  taskDiffs: ({ id: string; diff: TaskDiffPayload } | { id: string; error: string })[]
}

export type WebDelivery =
  | { kind: 'live' }
  | { kind: 'published'; reads: PublishedReads }

/** Initial page data plus the one delivery boundary the browser must use. */
export type WebBootPayload = WebPayload & { delivery: WebDelivery }
