import type { ArchitectureGraph } from '../../../types.ts'
import { initialTree, semanticTreeRows, toggleExpansion, type TreeRow } from '../../tui/tree.ts'
import { replaceTreeChildren, sidebarBranches, sidebarRow } from './sidebar-row.ts'
import { sectionHeading } from './sidebar-section.ts'

/** The structure starts open and keeps its state across repaints. */
let unfolded = true

function hasLaterSibling(rows: readonly TreeRow[], index: number, depth: number): boolean {
  for (const row of rows.slice(index + 1)) {
    if (row.depth < depth) return false
    if (row.depth === depth) return true
  }
  return false
}

function hierarchyRow(
  row: TreeRow,
  selectedIds: ReadonlySet<string>,
  onSelect: (id: string, additive: boolean) => void,
  onToggle: (row: TreeRow) => void,
  followingSiblings: readonly boolean[],
): HTMLButtonElement {
  const button = sidebarRow(row.title, row.kind, row.hasChildren
    ? { expanded: row.expanded, count: row.count, toggle: () => onToggle(row) }
    : undefined)
  button.dataset.id = row.id
  if (selectedIds.has(row.id)) button.classList.add('selected')
  if (row.origin !== 'observed') button.classList.add('ghost')

  button.prepend(...sidebarBranches(followingSiblings))
  button.addEventListener('click', event => onSelect(row.id, event.shiftKey))
  return button
}

function paintHierarchy(
  host: HTMLElement,
  rows: TreeRow[],
  selectedIds: ReadonlySet<string>,
  onSelect: (id: string, additive: boolean) => void,
  onToggle: (row: TreeRow) => void,
): void {
  const list = document.createElement('div')
  let shownExternals = false
  for (const [index, row] of rows.entries()) {
    if (row.depth === 0 && row.external && !shownExternals) {
      const label = document.createElement('div')
      label.className = 'group external'
      label.textContent = 'External systems'
      list.append(label)
      shownExternals = true
    }
    const siblings = Array.from({ length: row.depth }, (_, depth) => hasLaterSibling(rows, index, depth + 1))
    const button = hierarchyRow(row, selectedIds, onSelect, onToggle, siblings)
    list.append(button)
  }
  const heading = sectionHeading('Structure', unfolded, () => {
    unfolded = !unfolded
    paintHierarchy(host, rows, selectedIds, onSelect, onToggle)
  })
  list.hidden = !unfolded
  replaceTreeChildren(host, heading, list)
}

/** The architecture tree beside the map; it keeps the branches a person opened or closed across repaints. */
export function createHierarchy(host: HTMLElement, onSelect: (id: string, additive: boolean) => void) {
  let tree = initialTree()
  const paint = (world: ArchitectureGraph, selectedIds: readonly string[]): void => {
    const rows = semanticTreeRows(world, selectedIds, tree).filter(row => row.kind !== 'actor')
    paintHierarchy(host, rows, new Set(selectedIds), onSelect, row => {
      tree = toggleExpansion(tree, row)
      paint(world, selectedIds)
    })
  }
  return {
    paint,
    /** Another revision starts with the default branches open. */
    reset(): void { tree = initialTree() },
  }
}
