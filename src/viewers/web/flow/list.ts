import type { ArchitectureGraph } from '../../../types.ts'
import type { FlowRef } from '../../flows.ts'
import { sectionHeading } from '../organisms/sidebar-section.ts'
import { flowRow } from './row.ts'

let unfolded = true
const expandedActors = new Set<string>()

export function paintFlows(
  host: HTMLElement,
  world: ArchitectureGraph,
  active: FlowRef | undefined,
  onToggle: (flow: FlowRef) => void,
): void {
  host.replaceChildren()
  const actors = world.elements.filter(element => element.kind === 'actor')
  if (world.flows.length === 0 && actors.length === 0) return
  const heading = sectionHeading('Flows', unfolded, () => {
    unfolded = !unfolded
    paintFlows(host, world, active, onToggle)
  })
  const list = document.createElement('div')
  list.hidden = !unfolded
  for (const actor of actors) {
    const expanded = expandedActors.has(actor.id)
    const heading = sectionHeading(actor.title, expanded, () => {
      if (expanded) expandedActors.delete(actor.id)
      else expandedActors.add(actor.id)
      paintFlows(host, world, active, onToggle)
    })
    const flows = document.createElement('div')
    flows.hidden = !expanded
    for (const flow of world.flows.filter(flow => flow.steps[0]?.source === actor.id)) {
      flows.append(flowRow({ flow: { id: flow.id }, title: flow.title }, active, onToggle))
    }
    list.append(heading, flows)
  }
  const actorIds = new Set(actors.map(actor => actor.id))
  for (const flow of world.flows.filter(flow => !actorIds.has(flow.steps[0]!.source))) {
    list.append(flowRow({ flow: { id: flow.id }, title: flow.title }, active, onToggle))
  }
  host.append(heading, list)
}
