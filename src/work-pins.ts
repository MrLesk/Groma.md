import type { ActiveWorkItem, ArchitectureWorld } from './types.ts'

/** Eight hues that read on paper and on dark paper; the brand green stays out of it for the checkmark and the selection. */
export const PIN_COLOURS = ['#E0685E', '#2F9ED6', '#8B5CF6', '#E8A317', '#1BA39C', '#D6409F', '#6B8E23', '#FF7A1A']

/** One assignee on one task, standing on the element the task touched last. */
export interface WorkPin {
  /** `${assignee} ${taskId}`: one pin per pair. */
  key: string
  assignee: string
  taskId: string
  title: string
  status: string
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

/**
 * Pins for the active work: one per assignee and task, standing on the
 * element whose code holds the task's last modified file, else the first
 * element the task references; a task that touches no element has no pin.
 * Colours follow the pins in task order, so every visible pair differs.
 */
export function pinsOf(items: readonly ActiveWorkItem[], world: Pick<ArchitectureWorld, 'elements'>): WorkPin[] {
  const byId = new Map(world.elements.map(element => [element.id, element.representationId]))
  const byFile = new Map(world.elements.flatMap(element => element.code.map(reference => [reference.file, element.representationId] as const)))
  const pins: WorkPin[] = []
  for (const item of [...items].sort((a, b) => taskNumber(a.id) - taskNumber(b.id))) {
    const references = item.references.map(reference => byId.get(reference)).filter((id): id is string => id !== undefined)
    const touched = [...item.modifiedFiles].reverse().map(file => byFile.get(file)).find(id => id !== undefined)
    const elementId = touched ?? references[0]
    if (elementId === undefined) continue
    for (const assignee of item.assignees) {
      pins.push({
        key: `${assignee} ${item.id}`,
        assignee,
        taskId: item.id,
        title: item.title,
        status: item.status,
        done: item.acceptance.done,
        total: item.acceptance.total,
        elementId,
        colour: PIN_COLOURS[pins.length % PIN_COLOURS.length]!,
      })
    }
  }
  return pins
}
