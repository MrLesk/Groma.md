import { animateRow } from '../chrome/motion.ts'
import type { Comparison } from '../../../history/comparison.ts'
import { chromeButton } from '../atoms/button.ts'
import { comparisonTree, changeStatuses, changeMarks, changeLabels, isChange, type ChangeCounts, type VisibleStatus } from '../comparison/tree.ts'
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
  comparison?: Comparison,
  counts?: ChangeCounts,
  former = false,
): HTMLButtonElement {
  const button = sidebarRow(row.title, row.kind, row.hasChildren
    ? { expanded: row.expanded, count: row.count, toggle: () => onToggle(row) }
    : undefined)
  button.dataset.id = row.id
  if (selectedIds.has(row.id)) button.classList.add('selected')
  if (row.origin !== 'observed') button.classList.add('ghost')

  const change = Object.values(comparison?.components ?? {}).find(item => (item.after ?? item.before)?.representationId === row.id)
  if (change?.status === 'removed' || former) button.classList.add('former')
  if (counts !== undefined) {
    button.querySelector('.name')!.textContent = row.title
    for (const status of changeStatuses) if (counts[status] > 0) button.append(statusMark(status, counts[status]))
  } else if (isChange(change?.status)) {
    const files = change.files.filter(file => file.status !== 'unchanged')
    if (files.length > 0) {
      const totals = files.reduce((sum, file) => ({ added: sum.added + file.additions, removed: sum.removed + file.deletions }), { added: 0, removed: 0 })
      const lines = document.createElement('span')
      lines.className = 'change-lines'
      lines.textContent = `+${totals.added} −${totals.removed}`
      button.append(lines)
    }
    button.append(statusMark(change.status))
  }
  button.prepend(...sidebarBranches(followingSiblings))
  button.addEventListener('click', event => onSelect(row.id, event.shiftKey))
  return button
}

function statusMark(status: typeof changeStatuses[number], count?: number): HTMLElement {
  const mark = document.createElement('span')
  mark.className = 'change-mark'
  mark.dataset.change = status
  mark.textContent = `${changeMarks[status]}${count ?? ''}`
  mark.title = `${changeLabels[status]}${count === undefined ? '' : `: ${count}`}`
  mark.setAttribute('aria-label', mark.title)
  return mark
}

function replaceComparisonTree(host: HTMLElement, heading: HTMLElement, list: HTMLElement, comparing: boolean): void {
  host.querySelectorAll('.comparison-exiting').forEach(row => { row.remove() })
  const oldRows = [...host.querySelectorAll<HTMLElement>('.row[data-id]')]
    .map(row => ({ row, id: row.dataset.id!, height: row.getBoundingClientRect().height }))
  const nextRows = new Map([...list.querySelectorAll<HTMLElement>('.row[data-id]')].map(row => [row.dataset.id!, row]))
  replaceTreeChildren(host, heading, list)
  if (!comparing || oldRows.length === 0) return
  const oldIds = new Set(oldRows.map(item => item.id))
  for (const [index, item] of oldRows.entries()) {
    if (nextRows.has(item.id)) continue
    item.row.classList.add('comparison-exiting')
    item.row.inert = true
    item.row.setAttribute('aria-hidden', 'true')
    delete item.row.dataset.id
    const following = oldRows.slice(index + 1).find(row => nextRows.has(row.id))
    list.insertBefore(item.row, following === undefined ? null : nextRows.get(following.id)!)
    animateRow(item.row, false, item.height)
  }
  for (const [id, row] of nextRows) if (!oldIds.has(id)) animateRow(row, true, row.getBoundingClientRect().height)
}

function paintHierarchy(
  host: HTMLElement,
  rows: TreeRow[],
  selectedIds: ReadonlySet<string>,
  onSelect: (id: string, additive: boolean) => void,
  onToggle: (row: TreeRow) => void,
  comparison?: Comparison,
  changes?: ReturnType<typeof comparisonTree>,
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
    const button = hierarchyRow(row, selectedIds, onSelect, onToggle, siblings, comparison, changes?.counts.get(row.id), changes?.former.has(row.id))
    list.append(button)
  }
  for (const relationship of changes?.relationships ?? []) {
    const source = changes?.elements.find(element => element.representationId === relationship.source)
    const target = changes?.elements.find(element => element.representationId === relationship.target)
    const button = chromeButton(`${source?.title ?? relationship.source} → ${target?.title ?? relationship.target}`)
    button.className = 'row comparison-relationship'
    button.dataset.id = relationship.id
    button.classList.toggle('selected', selectedIds.has(relationship.id))
    const status = comparison?.relationships[relationship.id]
    if (isChange(status)) button.append(statusMark(status))
    button.onclick = event => onSelect(relationship.id, event.shiftKey)
    list.append(button)
  }
  if (rows.length === 0 && changes?.relationships.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'comparison-empty'
    empty.textContent = 'No changes'
    list.append(empty)
  }
  const heading = sectionHeading('Structure', unfolded, () => {
    unfolded = !unfolded
    paintHierarchy(host, rows, selectedIds, onSelect, onToggle, comparison, changes)
  })
  list.hidden = !unfolded
  replaceComparisonTree(host, heading, list, comparison !== undefined)
}

/** The architecture tree beside the map; it keeps the branches a person opened or closed across repaints. */
export function createHierarchy(host: HTMLElement, onSelect: (id: string, additive: boolean) => void) {
  let tree = initialTree()
  let changesOnly = true
  let lastSelection = ''
  const modes = document.createElement('div')
  modes.className = 'comparison-modes controls'
  modes.setAttribute('aria-label', 'Hierarchy view')
  const buttons = [chromeButton('Changes'), chromeButton('All')]
  modes.append(...buttons)
  document.getElementById('hierarchy-title')!.insertBefore(modes, document.getElementById('hierarchy-toggle'))
  const paint = (world: ArchitectureGraph, selectedIds: readonly string[], comparison?: Comparison, enabled?: ReadonlySet<VisibleStatus>): void => {
    modes.hidden = comparison === undefined
    document.getElementById('flows')!.hidden = comparison !== undefined && changesOnly
    const changes = comparison === undefined ? undefined : comparisonTree(world, comparison, enabled)
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(changesOnly === (index === 0)))
      button.onclick = () => { changesOnly = index === 0; paint(world, selectedIds, comparison, enabled) }
    })
    const rows = changes !== undefined && changesOnly ? semanticTreeRows(changes.world, selectedIds, { expanded: new Set(changes.world.elements.map(element => element.representationId)), collapsed: tree.collapsed })
      : semanticTreeRows(world, selectedIds, tree).filter(row => row.kind !== 'actor')
    paintHierarchy(host, rows, new Set(selectedIds), onSelect, row => {
      tree = toggleExpansion(tree, row)
      paint(world, selectedIds, comparison, enabled)
    }, comparison, changesOnly ? changes : changes === undefined ? undefined : { ...changes, relationships: [] })
    const selected = selectedIds.at(-1) ?? ''
    if (selected !== lastSelection) {
      host.querySelector<HTMLElement>('.row.selected[data-id]')?.scrollIntoView({ block: 'nearest' })
      lastSelection = selected
    }
  }
  return {
    paint,
    /** Another revision starts on its complete changes list. */
    reset(): void { tree = initialTree(); changesOnly = true; lastSelection = '' },
  }
}

export const hierarchyComparisonCss = `
  .comparison-modes { display: flex; gap: 2px; margin-right: 6px; }
  .comparison-modes[hidden] { display: none; }
  .comparison-modes .chrome-button { padding: 4px 6px; font-size: 10px; }
  .comparison-modes [aria-pressed="true"] { background: var(--hover); color: var(--ink); }
  #tree .row .name { flex: 1; }
  #tree .row.former .name { color: var(--muted); }
  #tree .change-mark { flex: none; font-size: 10px; }
  #tree [data-change="added"] { color: var(--diff-added); }
  #tree [data-change="modified"] { color: var(--diff-modified); }
  #tree [data-change="removed"] { color: var(--diff-removed); }
  #tree .change-lines { color: var(--muted); font-size: 9px; white-space: nowrap; }
  #tree .comparison-empty { padding: 0 14px; color: var(--muted); }
  #tree .comparison-relationship { justify-content: space-between; }
  body.hierarchy-collapsed .comparison-modes { visibility: hidden; }
`
