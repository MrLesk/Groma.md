import type { TerminalViewModel } from './model.ts'
import { syncTree, toggleFlow, type ViewerAction, type ViewerState } from './navigation.ts'
import { levelFor } from './navigation-spatial.ts'
import { semanticTreeRows, type TreeRow, type TreeState } from './tree.ts'

function expandRow(tree: TreeState, id: string): TreeState {
  const expanded = new Set(tree.expanded).add(id)
  const collapsed = new Set(tree.collapsed)
  collapsed.delete(id)
  return { ...tree, expanded, collapsed }
}

function foldRow(world: TerminalViewModel, current: ViewerState, row: TreeRow): ViewerState {
  if (row.expanded) {
    const collapsed = new Set(current.tree.collapsed).add(row.id)
    const expanded = new Set(current.tree.expanded)
    expanded.delete(row.id)
    return { ...current, tree: { ...current.tree, expanded, collapsed } }
  }
  const parent = world.elements.find(element => element.representationId === row.id)?.parent
  return parent == null ? current : { ...current, tree: { ...current.tree, cursor: parent } }
}

function openRow(world: TerminalViewModel, current: ViewerState, row: TreeRow): ViewerState {
  const element = world.elements.find(item => item.representationId === row.id)
  if (element === undefined) return current
  return syncTree(world, {
    ...current, tree: row.hasChildren && !row.expanded ? expandRow(current.tree, row.id) : current.tree,
    level: levelFor(element), currentId: element.representationId,
  })
}

/** Browsing a flow changes only the cursor; an explicit toggle opens its flow reader. */
export function reduceTree(world: TerminalViewModel, current: ViewerState, action: ViewerAction): ViewerState {
  const flows = world.flows
  const rows = semanticTreeRows(world, current.currentId === undefined ? [] : [current.currentId], current.tree)
  const ids = [...flows.map(flow => flow.id), ...rows.map(row => row.id)]
  if (ids.length === 0) return current
  const index = Math.max(0, ids.indexOf(current.tree.cursor ?? ''))
  if (action === 'up' || action === 'down') {
    const next = ids[Math.max(0, Math.min(ids.length - 1, index + (action === 'down' ? 1 : -1)))]!
    return { ...current, tree: { ...current.tree, cursor: next } }
  }
  if (index < flows.length) return action === 'enter' || action === 'toggle-selection'
    ? toggleFlow(current, ids[index]!) : current
  const cursor = rows[index - flows.length]!
  if (action === 'left') return foldRow(world, current, cursor)
  if (action === 'right') return { ...current, tree: expandRow(current.tree, cursor.id) }
  if (action === 'enter') return openRow(world, current, cursor)
  return current
}
