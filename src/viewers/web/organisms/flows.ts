import type { WorldRelationship } from '../../../types.ts'
import { sectionHeading } from './sidebar-section.ts'

/** The list starts folded and keeps its state across repaints. */
let unfolded = false

/** The sidebar's flow list, folded under its heading: every actor command, the active one lit. */
export function paintFlows(
  host: HTMLElement,
  commands: WorldRelationship[],
  activeActionId: string | undefined,
  onPick: (id: string) => void,
): void {
  host.replaceChildren()
  if (commands.length === 0) return
  const heading = sectionHeading('Flows', unfolded, () => {
    unfolded = !unfolded
    paintFlows(host, commands, activeActionId, onPick)
  })
  const list = document.createElement('div')
  list.hidden = !unfolded
  for (const command of commands) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'row'
    if (command.id === activeActionId) button.classList.add('selected')
    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = `→ ${command.description}`
    button.append(name)
    button.addEventListener('click', () => onPick(command.id))
    list.append(button)
  }
  host.append(heading, list)
}
