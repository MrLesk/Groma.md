import type { WorldRelationship } from '../../../types.ts'

/** The sidebar's flow list: every person command, the active one lit. */
export function paintFlows(
  host: HTMLElement,
  commands: WorldRelationship[],
  activeActionId: string | undefined,
  onPick: (id: string) => void,
): void {
  host.replaceChildren()
  if (commands.length === 0) return
  const label = document.createElement('p')
  label.className = 'section'
  label.textContent = 'Flows'
  host.append(label)
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
    host.append(button)
  }
}
