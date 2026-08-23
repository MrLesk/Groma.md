import { kindGlyph } from '../atoms/kind.ts'
import type { TreeRow } from '../../tui/tree.ts'
import { sectionHeading } from './sidebar-section.ts'

/** The structure starts open and keeps its state across repaints. */
let unfolded = true

export function paintHierarchy(
  host: HTMLElement,
  rows: TreeRow[],
  selectedId: string | undefined,
  onSelect: (id: string) => void,
  onToggle: (row: TreeRow) => void,
): void {
  const list = document.createElement('div')
  for (const row of rows) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'row'
    button.dataset.id = row.id
    if (row.id === selectedId) button.classList.add('selected')
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
    button.addEventListener('click', () => onSelect(row.id))
    list.append(button)
  }
  const heading = sectionHeading('Structure', unfolded, () => {
    unfolded = !unfolded
    paintHierarchy(host, rows, selectedId, onSelect, onToggle)
  })
  list.hidden = !unfolded
  host.replaceChildren(heading, list)
}
