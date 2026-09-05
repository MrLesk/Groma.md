import type { ArchitectureGraph } from '../../../types.ts'
import type { FlowRef } from '../../flows.ts'
import { replaceTreeChildren, sidebarBranches, sidebarRow } from '../organisms/sidebar-row.ts'
import { sectionHeading } from '../organisms/sidebar-section.ts'
import { flowRow, type FlowRowData } from './row.ts'

function groupedTitle(title: string, actorTitle: string): string {
  const separator = title.indexOf(': ')
  if (separator < 0) return title
  const prefix = title.slice(0, separator).toLowerCase()
  const actor = actorTitle.toLowerCase()
  return actor === prefix || actor.endsWith(` ${prefix}`) ? title.slice(separator + 2) : title
}

/** Each panel owns its fold state while sharing the same tree renderer. */
export function createFlowList() {
  let unfolded = true
  const expandedActors = new Set<string>()
  return function paintFlows(
    host: HTMLElement,
    world: ArchitectureGraph,
    active: FlowRef | undefined,
    onToggle: (flow: FlowRef) => void,
    visibleFlows?: readonly FlowRowData[],
  ): void {
    host.classList.add('flow-tree')
    const visibleIds = visibleFlows && new Set(visibleFlows.map(row => row.flow.id))
    const flows = world.flows.filter(flow => visibleIds === undefined || visibleIds.has(flow.id))
    const actors = world.elements.filter(element => element.kind === 'actor'
      && (visibleIds === undefined || flows.some(flow => flow.steps[0]?.source === element.id)))
    if (flows.length === 0 && actors.length === 0) {
      host.replaceChildren()
      return
    }
    const heading = sectionHeading('Flows', unfolded, () => {
      unfolded = !unfolded
      paintFlows(host, world, active, onToggle, visibleFlows)
    })
    const list = document.createElement('div')
    list.hidden = !unfolded
    const actorIds = new Set(actors.map(actor => actor.id))
    const ungrouped = flows.filter(flow => !actorIds.has(flow.steps[0]!.source))
    for (const [actorIndex, actor] of actors.entries()) {
      const followingActor = actorIndex < actors.length - 1 || ungrouped.length > 0
      const expanded = expandedActors.has(actor.id)
      const actorFlows = flows.filter(flow => flow.steps[0]?.source === actor.id)
      const toggle = () => {
        if (expanded) expandedActors.delete(actor.id)
        else expandedActors.add(actor.id)
        paintFlows(host, world, active, onToggle, visibleFlows)
      }
      const heading = sidebarRow(actor.title, 'actor', { expanded, count: actorFlows.length, toggle })
      heading.dataset.id = actor.id
      heading.prepend(...sidebarBranches([followingActor]))
      heading.addEventListener('click', toggle)
      const children = document.createElement('div')
      children.hidden = !expanded
      for (const [flowIndex, flow] of actorFlows.entries()) {
        const row = flowRow({ flow: { id: flow.id }, title: groupedTitle(flow.title, actor.title) }, active, onToggle)
        row.classList.add('row')
        row.prepend(...sidebarBranches([followingActor, flowIndex < actorFlows.length - 1]))
        children.append(row)
      }
      list.append(heading, children)
    }
    for (const [index, flow] of ungrouped.entries()) {
      const row = flowRow({ flow: { id: flow.id }, title: flow.title }, active, onToggle)
      row.classList.add('row')
      row.prepend(...sidebarBranches([index < ungrouped.length - 1]))
      list.append(row)
    }
    replaceTreeChildren(host, heading, list)
  }
}
