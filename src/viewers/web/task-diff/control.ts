import type { ArchitectureGraph, WorkItem } from '../../../types.ts'
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

function itemKey(item: WorkItem): string {
  return [item.id, item.title, item.status, ...item.modifiedFiles].join('\0')
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error && reason.message !== '' ? reason.message : 'Diff unavailable'
}

/** Loads and owns task-file drill-down while architecture selection stays outside this domain. */
export function createTaskDiffControl(options: TaskDiffControlOptions): TaskDiffControl {
  let activeKey: string | undefined
  let item: WorkItem | undefined
  let payload: TaskDiffPayload | undefined
  let error: string | undefined
  let file: string | undefined
  let request = 0

  function back(): void {
    file = undefined
    options.repaint()
  }

  function open(nextFile: string): void {
    if (payload?.files.some(candidate => candidate.file === nextFile) !== true) return
    file = nextFile
    options.repaint()
  }

  async function load(nextItem: WorkItem, activeRequest: number): Promise<void> {
    try {
      const response = await fetch(`/task-diff.json?${new URLSearchParams({ task: nextItem.id })}`)
      if (!response.ok) throw new Error(await response.text())
      const loaded = await response.json() as TaskDiffPayload
      if (activeRequest !== request || item?.id !== loaded.taskId) return
      payload = loaded
    } catch (reason) {
      if (activeRequest !== request) return
      error = errorMessage(reason)
    }
    options.repaint()
  }

  return {
    paint(nextItem) {
      if (nextItem === undefined) {
        request += 1
        activeKey = undefined
        item = undefined
        payload = undefined
        error = undefined
        file = undefined
        leaveTaskDiff(options.host)
        return false
      }
      const nextKey = itemKey(nextItem)
      if (nextKey !== activeKey) {
        activeKey = nextKey
        item = nextItem
        payload = undefined
        error = undefined
        file = undefined
        void load(nextItem, ++request)
      } else item = nextItem
      const selected = payload?.files.find(candidate => candidate.file === file)
      if (payload !== undefined && selected !== undefined) {
        paintTaskFile(options.host, nextItem, payload, selected, back)
      } else {
        paintTaskSummary(
          options.host,
          nextItem,
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
