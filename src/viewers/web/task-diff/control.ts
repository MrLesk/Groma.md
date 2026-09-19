import type { ArchitectureGraph, WorkItem, WorkItemDetails } from '../../../types.ts'
import type { TaskDiffPayload } from '../../source/diff.ts'
import { paintTaskSummary } from './view.ts'
import { leaveChangeFile, paintChangeFile } from '../changes/view.ts'

export interface TaskDiffControl {
  invalidate(): void
  paint(item: WorkItem | undefined): boolean
}

interface TaskDiffControlOptions {
  host: HTMLElement
  world(): ArchitectureGraph
  readDetails(id: string): Promise<WorkItemDetails>
  readDiff(id: string): Promise<TaskDiffPayload>
  repaint(): void
  select(id: string, additive: boolean): void
  review?(id: string): void
}

function diffKey(item: WorkItem): string {
  return [item.id, item.title, item.status, ...item.modifiedFiles].join('\0')
}

function detailsKey(item: WorkItem): string {
  return JSON.stringify(item)
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message !== '' ? reason.message : fallback
}

/** Loads selected-task details and file drill-down while architecture selection stays outside this domain. */
export function createTaskDiffControl(options: TaskDiffControlOptions): TaskDiffControl {
  let activeDiffKey: string | undefined
  let activeDetailsKey: string | undefined
  let item: WorkItem | undefined
  let details: WorkItemDetails | undefined
  let detailsError: string | undefined
  let payload: TaskDiffPayload | undefined
  let error: string | undefined
  let file: string | undefined
  let diffRequest = 0
  let detailsRequest = 0
  let summaryScrollTop = 0

  function back(): void {
    file = undefined
    options.repaint()
    const taskId = item?.id
    const restore = (): void => {
      if (item?.id === taskId && file === undefined) options.host.scrollTop = summaryScrollTop
    }
    restore()
    // The wider diff pane can clamp the summary scroll until its width settles.
    void Promise.all(options.host.getAnimations().map(animation => animation.finished)).then(restore, () => {})
  }

  function open(nextFile: string): void {
    if (payload?.files.some(candidate => candidate.file === nextFile) !== true) return
    summaryScrollTop = options.host.scrollTop
    file = nextFile
    options.repaint()
  }

  async function loadDiff(nextItem: WorkItem, activeRequest: number): Promise<void> {
    try {
      const loaded = await options.readDiff(nextItem.id)
      if (activeRequest !== diffRequest || item?.id !== loaded.taskId) return
      payload = loaded
    } catch (reason) {
      if (activeRequest !== diffRequest) return
      payload = undefined
      error = errorMessage(reason, 'Diff unavailable')
    }
    options.repaint()
  }

  async function loadDetails(nextItem: WorkItem, activeRequest: number): Promise<void> {
    try {
      const loaded = await options.readDetails(nextItem.id)
      if (activeRequest !== detailsRequest || item?.id !== loaded.id) return
      details = loaded
      options.repaint()
    } catch (reason) {
      if (activeRequest !== detailsRequest) return
      detailsError = errorMessage(reason, 'Task details unavailable')
      options.repaint()
    }
  }

  function refresh(nextItem: WorkItem): void {
    const changedTask = item?.id !== nextItem.id
    item = nextItem
    if (changedTask) {
      details = undefined
      payload = undefined
      file = undefined
    }
    const nextDetailsKey = detailsKey(nextItem)
    if (nextDetailsKey !== activeDetailsKey) {
      activeDetailsKey = nextDetailsKey
      detailsError = undefined
      void loadDetails(nextItem, ++detailsRequest)
    }
    const nextDiffKey = diffKey(nextItem)
    if (nextDiffKey !== activeDiffKey) {
      activeDiffKey = nextDiffKey
      error = undefined
      void loadDiff(nextItem, ++diffRequest)
    }
  }

  return {
    invalidate() {
      payload = undefined
      error = undefined
      if (item !== undefined) void loadDiff(item, ++diffRequest)
    },
    paint(nextItem) {
      if (nextItem === undefined) {
        diffRequest += 1
        detailsRequest += 1
        activeDiffKey = undefined
        activeDetailsKey = undefined
        item = undefined
        details = undefined
        detailsError = undefined
        payload = undefined
        error = undefined
        file = undefined
        leaveChangeFile(options.host)
        return false
      }
      refresh(nextItem)
      const selected = payload?.files.find(candidate => candidate.file === file)
      if (payload !== undefined && selected !== undefined) {
        paintChangeFile(options.host, nextItem.id, payload.source, selected, back)
      } else {
        paintTaskSummary(
          options.host,
          nextItem,
          details,
          detailsError,
          options.world(),
          payload,
          error,
          options.select,
          open,
          options.review === undefined ? undefined : () => options.review!(nextItem.id),
        )
      }
      return true
    },
  }
}
