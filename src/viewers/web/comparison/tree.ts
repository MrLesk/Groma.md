import type { Comparison, ChangeStatus } from '../../../history/comparison.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import { ancestorsOf, semanticTreeRows } from '../../tui/tree.ts'

export const changeStatuses = ['added', 'modified', 'removed'] as const
export type VisibleStatus = typeof changeStatuses[number]
export type ChangeCounts = Record<VisibleStatus, number>
export const changeMarks = { added: '+', modified: '~', removed: '−' } as const
export const changeLabels = { added: 'Added', modified: 'Modified', removed: 'Removed' } as const
export function isChange(status: ChangeStatus | undefined): status is VisibleStatus {
  return status !== undefined && status !== 'unchanged'
}

/** The comparison list and its navigation share one semantic order, independent of collapsed branches. */
export function comparisonTree(world: ArchitectureGraph, comparison: Comparison,
  enabled: ReadonlySet<VisibleStatus> = new Set(changeStatuses)) {
  const byId = new Map(world.elements.map(element => [element.representationId, element]))
  const counts = new Map<string, ChangeCounts>()
  const changed = new Set<string>()
  const current = new Set<string>()
  const former = new Set<string>()
  for (const element of world.elements) {
    const change = comparison.components[element.id]
    if (change === undefined) continue
    const parents = ancestorsOf(element.representationId, byId)
    for (const id of parents) (change.after === undefined ? former : current).add(id)
    if (!isChange(change.status) || !enabled.has(change.status)) continue
    changed.add(element.representationId)
    for (const id of parents) {
      const total = counts.get(id) ?? { added: 0, modified: 0, removed: 0 }
      total[change.status] += 1
      counts.set(id, total)
    }
  }
  const included = new Set([...changed, ...counts.keys()])
  const elements = world.elements.filter(element => included.has(element.representationId))
    .map(element => ({ ...element, children: element.children.filter(id => included.has(id)) }))
  const filtered = { ...world, elements }
  const rows = semanticTreeRows(filtered, [], { expanded: included, collapsed: new Set() })
  const relationships = world.relationships.filter(item => {
    const status = comparison.relationships[item.id]
    return isChange(status) && enabled.has(status)
  })
  const order = [...rows.filter(row => changed.has(row.id)).map(row => row.id), ...relationships.map(item => item.id)]
  return { world: filtered, elements: world.elements, rows, counts, relationships, order,
    former: new Set([...former].filter(id => !current.has(id))) }
}

/** Keyboard and button navigation wrap in the same visible list. */
export function nextChange(order: readonly string[], selected: string | undefined, direction: number): string | undefined {
  if (order.length === 0) return undefined
  const index = selected === undefined ? -1 : order.indexOf(selected)
  return order[index < 0 ? direction > 0 ? 0 : order.length - 1 : (index + direction + order.length) % order.length]
}
