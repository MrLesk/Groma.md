import type { ArchitectureGraph } from '../../../types.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import type { FlowRef } from '../../flows.ts'
import { sectionHeading } from '../organisms/sidebar-section.ts'
import { flowRow } from './row.ts'

let unfolded = true
const expandedActors = new Set<string>()

function actorHeading(title: string, expanded: boolean, onToggle: () => void): HTMLButtonElement {
  const heading = sectionHeading(title, expanded, onToggle)
  heading.className = 'row actor-row'
  heading.replaceChildren()
  for (const [className, text] of [['twist', expanded ? '▾' : '▸'], ['mark', kindGlyph('actor')], ['name', title]]) {
    const part = document.createElement('span')
    part.className = className!
    part.textContent = text!
    if (className !== 'name') part.setAttribute('aria-hidden', 'true')
    heading.append(part)
  }
  return heading
}

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
    const heading = actorHeading(actor.title, expanded, () => {
      if (expanded) expandedActors.delete(actor.id)
      else expandedActors.add(actor.id)
      paintFlows(host, world, active, onToggle)
    })
    const flows = document.createElement('div')
    flows.className = 'actor-flows'
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
