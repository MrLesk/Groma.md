import type { Comparison } from '../../history/comparison.ts'
import type { GitRevision } from '../../history/revisions.ts'
import type { SheetScene } from '../../sheet/types.ts'
import type { ProjectProfile } from '../../project-profile.ts'
import type { AnnotatedArchitectureModel, WorkSnapshot } from '../../types.ts'
import type { WorkPin } from '../../work/pins.ts'
import type { SourcePayload } from '../source/read.ts'
import type { CodeFile } from '../source/structure.ts'

export const PUBLISHED_EVENT = 'groma:published'
export const PUBLISHED_VERSION_EVENT = 'groma:published-version'

export type WebRevision = GitRevision

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
  comparison?: Comparison
  revisions: WebRevision[]
  world: AnnotatedArchitectureModel
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
  sources: { file: string; source: SourcePayload }[]
}

/** One ordinary or comparison view, already prepared by the same owners as live delivery. */
export interface PublishedView {
  payload: WebPayload
  reads: PublishedReads
}

export type WebDelivery =
  | { kind: 'live' }
  | { kind: 'published'; views: PublishedView[] }

/** Initial page data plus the one delivery boundary the browser must use. */
export type WebBootPayload = WebPayload & { delivery: WebDelivery }
