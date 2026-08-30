import type { ArchitectureGraph, WorkItem, WorkSnapshot } from '../types.ts'

/** Eight hues that read on paper and on dark paper; the brand green stays out of it for the checkmark and the selection. */
export const PIN_COLOURS = ['#E0685E', '#2F9ED6', '#8B5CF6', '#E8A317', '#1BA39C', '#D6409F', '#6B8E23', '#FF7A1A']

/** One assignee on one task, or one generic marker for an unassigned task, standing on the element the task touched last. */
export interface WorkPin {
  /** `${assignee ?? 'task'} ${taskId}`: one pin per assignee-task pair, or one per unassigned task. */
  key: string
  assignee: string | null
  taskId: string
  title: string
  status: string
  terminal: boolean
  done: number
  total: number
  /** Representation id of the element the pin stands on. */
  elementId: string
  colour: string
}

/** Two letters of the handle, for the badge. */
export function monogram(assignee: string): string {
  return assignee.replace(/^@/, '').slice(0, 2).toUpperCase()
}

const taskNumber = (id: string): number => Number.parseFloat(id.replace(/^\D+/, ''))

/** The elements a task touches, each once: those whose code holds one of its modified files, newest file first, then those it references. */
export function touchedElements(item: WorkItem, world: Pick<ArchitectureGraph, 'elements'>): string[] {
  const byId = new Map(world.elements.map(element => [element.id, element.representationId]))
  const byFile = new Map<string, string[]>()
  for (const element of world.elements) {
    for (const reference of element.code) {
      const ids = byFile.get(reference.file) ?? []
      ids.push(element.representationId)
      byFile.set(reference.file, ids)
    }
  }
  const ids = [
    ...[...item.modifiedFiles].reverse().flatMap(file => byFile.get(file) ?? []),
    ...item.references.map(reference => byId.get(reference)),
  ]
  return [...new Set(ids.filter((id): id is string => id !== undefined))]
}

export type WorkStage = 'todo' | 'progress' | 'done'

export interface ElementWorkGroup {
  stage: WorkStage
  items: WorkItem[]
}

/** Tasks touching one exact architecture element, grouped by configured workflow meaning. */
export function elementWorkGroups(
  work: WorkSnapshot,
  elementId: string,
  world: Pick<ArchitectureGraph, 'elements'>,
): ElementWorkGroup[] {
  const grouped: Record<WorkStage, WorkItem[]> = { todo: [], progress: [], done: [] }
  const terminal = work.statuses.at(-1)
  for (const item of work.items) {
    if (!touchedElements(item, world).includes(elementId)) continue
    const stage = item.status === work.defaultStatus
      ? 'todo'
      : item.status === terminal ? 'done' : 'progress'
    grouped[stage].push(item)
  }
  return (['todo', 'progress', 'done'] as const)
    .filter(stage => grouped[stage].length > 0)
    .map(stage => ({ stage, items: grouped[stage] }))
}

/**
 * Pins for the available work: one per assignee and task, or one generic pin
 * for an unassigned task, standing on the first element the task touches; a
 * task that touches no element has no pin. Colours follow the pins in task
 * order, so every visible marker differs.
 */
export function pinsOf(
  items: readonly WorkItem[],
  world: Pick<ArchitectureGraph, 'elements'>,
  terminalStatus: string | undefined,
): WorkPin[] {
  const pins: WorkPin[] = []
  for (const item of [...items].sort((a, b) => taskNumber(a.id) - taskNumber(b.id))) {
    const elementId = touchedElements(item, world)[0]
    if (elementId === undefined) continue
    const assignees = item.assignees.length === 0 ? [null] : item.assignees
    for (const assignee of assignees) {
      pins.push({
        key: `${assignee ?? 'task'} ${item.id}`,
        assignee,
        taskId: item.id,
        title: item.title,
        status: item.status,
        terminal: item.status === terminalStatus,
        done: item.acceptanceCriteriaCompleted,
        total: item.acceptanceCriteriaCount,
        elementId,
        colour: PIN_COLOURS[pins.length % PIN_COLOURS.length]!,
      })
    }
  }
  return pins
}
