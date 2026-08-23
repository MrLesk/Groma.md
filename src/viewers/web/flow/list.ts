import type { AnnotatedRelationship } from '../../../types.ts'
import type { FlowRef } from '../../action-path.ts'
import { sectionHeading } from '../organisms/sidebar-section.ts'

/** The list starts folded and keeps its state across repaints. */
let unfolded = false

/** Every command row shows whether its flow is active and whether it owns details. */
export function paintFlows(
  host: HTMLElement,
  commands: readonly AnnotatedRelationship[],
  active: readonly FlowRef[],
  selected: FlowRef | undefined,
  onPick: (commandId: string) => void,
): void {
  host.replaceChildren()
  if (commands.length === 0) return
  const heading = sectionHeading('Flows', unfolded, () => {
    unfolded = !unfolded
    paintFlows(host, commands, active, selected, onPick)
  })
  const list = document.createElement('div')
  list.hidden = !unfolded
  const activeCommands = new Set(active.map(flow => flow.commandId))
  for (const command of commands) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'row'
    if (activeCommands.has(command.id)) button.classList.add('active')
    if (selected?.commandId === command.id) button.classList.add('selected')
    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = `→ ${command.description}`
    button.append(name)
    button.addEventListener('click', () => onPick(command.id))
    list.append(button)
  }
  host.append(heading, list)
}
