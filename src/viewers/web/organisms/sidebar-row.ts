import type { C4Kind } from '../../../types.ts'

/** Each column records whether another sibling follows at that depth. */
export function sidebarBranches(followingSiblings: readonly boolean[]): HTMLSpanElement[] {
  return followingSiblings.map((follows, index) => {
    const branch = document.createElement('span')
    const current = index === followingSiblings.length - 1
    branch.className = `branch${current ? ' current' : ''}${follows ? '' : current ? ' end' : ' blank'}`
    branch.setAttribute('aria-hidden', 'true')
    return branch
  })
}

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
  if (fold) {
    twist.classList.add('toggle')
    twist.addEventListener('click', event => {
      event.stopPropagation()
      fold.toggle()
    })
  }

  const mark = document.createElement('span')
  mark.className = `mark kind-${kind}`
  mark.setAttribute('aria-hidden', 'true')

  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = fold ? `${title} (${fold.count})` : title
  button.append(twist, mark, name)
  return button
}
