import type { C4Kind } from '../../../types.ts'
import { kindGlyph } from '../../atoms/kind.ts'

/** Shared entity columns for actor groups and the software tree. */
export function sidebarRow(
  title: string,
  kind: C4Kind,
  fold?: { expanded: boolean; count: number; toggle(): void },
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'row'
  if (fold) button.setAttribute('aria-expanded', String(fold.expanded))

  const twist = document.createElement('span')
  twist.className = 'twist'
  twist.setAttribute('aria-hidden', 'true')
  twist.textContent = fold ? fold.expanded ? '▾' : '▸' : ''
  if (fold) {
    twist.classList.add('toggle')
    twist.addEventListener('click', event => {
      event.stopPropagation()
      fold.toggle()
    })
  }

  const mark = document.createElement('span')
  mark.className = 'mark'
  mark.setAttribute('aria-hidden', 'true')
  mark.textContent = kindGlyph(kind)

  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = fold ? `${title} (${fold.count})` : title
  button.append(twist, mark, name)
  return button
}
