import type { ArchitectureFlow } from '../../../types.ts'
import type { FlowRef } from '../../flows.ts'
import { sectionHeading } from '../organisms/sidebar-section.ts'
import { flowRow } from './row.ts'

let unfolded = true

export function paintFlows(
  host: HTMLElement,
  flows: readonly ArchitectureFlow[],
  active: FlowRef | undefined,
  onToggle: (flow: FlowRef) => void,
): void {
  host.replaceChildren()
  if (flows.length === 0) return
  const heading = sectionHeading('Flows', unfolded, () => {
    unfolded = !unfolded
    paintFlows(host, flows, active, onToggle)
  })
  const list = document.createElement('div')
  list.hidden = !unfolded
  for (const flow of flows) list.append(flowRow({ flow: { id: flow.id }, title: flow.title }, active, onToggle))
  host.append(heading, list)
}
