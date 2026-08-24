import type { AnnotatedRelationship } from '../../../types.ts'
import type { FlowRef } from '../../action-path.ts'
import { sectionHeading } from '../organisms/sidebar-section.ts'
import { flowRow } from './row.ts'

/** The list starts open and keeps its state across repaints. */
let unfolded = true

/** Every command row shows whether its flow is active and whether it owns details. */
export function paintFlows(
  host: HTMLElement,
  commands: readonly AnnotatedRelationship[],
  active: readonly FlowRef[],
  selected: FlowRef | undefined,
  actorName: (actorId: string) => string | undefined,
  onToggle: (flow: FlowRef) => void,
): void {
  host.replaceChildren()
  if (commands.length === 0) return
  const heading = sectionHeading('Flows', unfolded, () => {
    unfolded = !unfolded
    paintFlows(host, commands, active, selected, actorName, onToggle)
  })
  const list = document.createElement('div')
  list.hidden = !unfolded
  for (const command of commands) {
    list.append(flowRow(
      { flow: { commandId: command.id }, title: command.description },
      active,
      selected,
      actorName,
      onToggle,
    ))
  }
  host.append(heading, list)
}
