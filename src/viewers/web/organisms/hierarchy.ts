import { kindGlyph } from '../atoms/kind.ts'
import type { TreeRow } from '../../tui/tree.ts'
import { sectionHeading } from './sidebar-section.ts'

/** The structure starts open and keeps its state across repaints. */
let unfolded = true

function rootGroupName(row: TreeRow): string {
  if (row.kind === 'actor') return 'Actors'
  return row.external ? 'External systems' : 'Systems'
}

export function paintHierarchy(
  host: HTMLElement,
  rows: TreeRow[],
  selectedIds: ReadonlySet<string>,
  onSelect: (id: string, additive: boolean) => void,
  onToggle: (row: TreeRow) => void,
): void {
  const list = document.createElement('div')
  let group: string | undefined
  for (const row of rows) {
    if (row.depth === 0) {
      const nextGroup = rootGroupName(row)
      if (nextGroup !== group) {
        const label = document.createElement('div')
        label.className = 'group'
        label.textContent = nextGroup
        list.append(label)
        group = nextGroup
      }
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'row'
    button.dataset.id = row.id
    if (selectedIds.has(row.id)) button.classList.add('selected')
    if (row.origin !== 'observed' || row.external) button.classList.add('ghost')
    button.style.paddingLeft = `${14 + row.depth * 16}px`

    const twist = document.createElement('span')
    twist.className = 'twist'
    twist.textContent = row.hasChildren ? row.expanded ? '▾' : '▸' : ''
    if (row.hasChildren) {
      twist.classList.add('toggle')
      twist.addEventListener('click', event => {
        event.stopPropagation()
        onToggle(row)
      })
    }

    const mark = document.createElement('span')
    mark.className = 'mark'
    mark.textContent = kindGlyph(row.kind)

    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = row.hasChildren && !row.expanded
      ? `${row.name} (${row.count})`
      : row.name

    button.append(twist, mark, name)
    button.addEventListener('click', event => onSelect(row.id, event.shiftKey))
    list.append(button)
  }
  const heading = sectionHeading('Structure', unfolded, () => {
    unfolded = !unfolded
    paintHierarchy(host, rows, selectedIds, onSelect, onToggle)
  })
  list.hidden = !unfolded
  host.replaceChildren(heading, list)
}
