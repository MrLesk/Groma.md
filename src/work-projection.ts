import type {
  ActiveWorkItem,
  ArchitectureViewModel,
  WorkMarker,
} from './types.ts'

export function assigneesOnElement(
  work: readonly WorkMarker[],
  elementId: string,
): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const marker of work) {
    if (marker.elementId !== elementId) continue
    for (const name of marker.assignees) {
      if (seen.has(name)) continue
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

export function projectActiveWork(
  model: ArchitectureViewModel,
  items: readonly ActiveWorkItem[],
): ArchitectureViewModel {
  const elementIds = new Set(model.elements.map(element => element.id))
  const work: WorkMarker[] = []

  for (const item of items) {
    if (item.status !== 'In Progress') continue
    for (const reference of item.references) {
      if (!elementIds.has(reference)) continue
      work.push({
        elementId: reference,
        taskId: item.id,
        taskTitle: item.title,
        assignees: item.assignees,
      })
    }
  }

  return { ...model, work }
}
