import { kindGlyph } from '../atoms/kind.ts'
import type { TreeRow } from '../../tui/tree.ts'

export function paintHierarchy(
  host: HTMLElement,
  rows: TreeRow[],
  selectedId: string | undefined,
  onSelect: (id: string) => void,
): void {
  host.replaceChildren()
  for (const row of rows) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'row'
    button.dataset.id = row.id
    if (row.id === selectedId) button.classList.add('selected')
    if (row.origin !== 'observed' || row.external) button.classList.add('ghost')
    button.style.paddingLeft = `${8 + row.depth * 14}px`

    const twist = document.createElement('span')
    twist.className = 'twist'
    twist.textContent = row.hasChildren ? row.expanded ? '▾' : '▸' : ''

    const mark = document.createElement('span')
    mark.className = `mark ${row.kind}`
    mark.textContent = kindGlyph(row.kind)

    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = row.hasChildren && !row.expanded
      ? `${row.name} (${row.count})`
      : row.name

    button.append(twist, mark, name)
    button.addEventListener('click', () => onSelect(row.id))
    host.append(button)
  }
}
