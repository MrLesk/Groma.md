import type { ArchitectureGraph, WorkItem, WorkItemDetails } from '../../../types.ts'
import type { TaskDiffPayload } from './read.ts'
import { leaveTaskDiff, paintTaskFile, paintTaskSummary } from './view.ts'

export interface TaskDiffControl {
  paint(item: WorkItem | undefined): boolean
}

interface TaskDiffControlOptions {
  host: HTMLElement
  world(): ArchitectureGraph
  repaint(): void
  select(id: string, additive: boolean): void
}

function diffKey(item: WorkItem): string {
  return [item.id, item.title, item.status, ...item.modifiedFiles].join('\0')
}

function detailsKey(item: WorkItem): string {
  return [item.id, item.updatedAt].join('\0')
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

  function back(): void {
    file = undefined
    options.repaint()
  }

  function open(nextFile: string): void {
    if (payload?.files.some(candidate => candidate.file === nextFile) !== true) return
    file = nextFile
    options.repaint()
  }

  async function loadDiff(nextItem: WorkItem, activeRequest: number): Promise<void> {
    try {
      const response = await fetch(`/task-diff.json?${new URLSearchParams({ task: nextItem.id })}`)
      if (!response.ok) throw new Error(await response.text())
      const loaded = await response.json() as TaskDiffPayload
      if (activeRequest !== diffRequest || item?.id !== loaded.taskId) return
      payload = loaded
    } catch (reason) {
      if (activeRequest !== diffRequest) return
      error = errorMessage(reason, 'Diff unavailable')
    }
    options.repaint()
  }

  async function loadDetails(nextItem: WorkItem, activeRequest: number): Promise<void> {
    try {
      const response = await fetch(`/task.json?${new URLSearchParams({ task: nextItem.id })}`)
      if (!response.ok) throw new Error(await response.text())
      const loaded = await response.json() as WorkItemDetails
      if (activeRequest !== detailsRequest || item?.id !== loaded.id) return
      details = loaded
      options.repaint()
    } catch (reason) {
      if (activeRequest !== detailsRequest) return
      detailsError = errorMessage(reason, 'Task details unavailable')
      options.repaint()
    }
  }

  return {
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
        leaveTaskDiff(options.host)
        return false
      }
      item = nextItem
      const nextDetailsKey = detailsKey(nextItem)
      if (nextDetailsKey !== activeDetailsKey) {
        activeDetailsKey = nextDetailsKey
        details = undefined
        detailsError = undefined
        void loadDetails(nextItem, ++detailsRequest)
      }
      const nextDiffKey = diffKey(nextItem)
      if (nextDiffKey !== activeDiffKey) {
        activeDiffKey = nextDiffKey
        payload = undefined
        error = undefined
        file = undefined
        void loadDiff(nextItem, ++diffRequest)
      }
      const selected = payload?.files.find(candidate => candidate.file === file)
      if (payload !== undefined && selected !== undefined) {
        paintTaskFile(options.host, nextItem, payload, selected, back)
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
        )
      }
      return true
    },
  }
}
