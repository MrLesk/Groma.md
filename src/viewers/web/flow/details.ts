import type { ArchitectureGraph } from '../../../types.ts'
import { actionLegs } from '../../action-path.ts'
import type { FlowRef } from '../../action-path.ts'

/** Explains one derived flow as its command, optional actor scope, and authored legs. */
export function paintFlowDetails(
  host: HTMLElement,
  flow: FlowRef,
  world: ArchitectureGraph,
  onSelect: (id: string, additive: boolean) => void,
): void {
  const command = world.relationships.find(relationship => relationship.id === flow.commandId)!
  const elements = new Map(world.elements.map(element => [element.representationId, element]))
  const actor = elements.get(flow.actorId ?? '')
  const legs = actionLegs(flow.commandId, world, flow.actorId)
  host.querySelector('h1')!.textContent = command.description
  host.querySelector('.meta')!.textContent = [
    'Flow',
    ...(actor === undefined ? [] : [`Actor: ${actor.name}`]),
    `${legs.length} ${legs.length === 1 ? 'leg' : 'legs'}`,
  ].join(' · ')
  host.querySelector('.tabs')!.replaceChildren()
  const list = document.createElement('ul')
  for (const [index, leg] of legs.entries()) {
    const source = elements.get(leg.source)!
    const target = elements.get(leg.target)!
    const item = document.createElement('li')
    const relationship = document.createElement('button')
    relationship.type = 'button'
    relationship.className = 'link'
    if (leg.id === flow.commandId) relationship.classList.add('active')
    relationship.textContent = `${index + 1}. ${leg.description}`
    relationship.addEventListener('click', event => onSelect(leg.id, event.shiftKey))
    const sourceLink = document.createElement('button')
    sourceLink.type = 'button'
    sourceLink.className = 'link ghost'
    sourceLink.textContent = source.name
    sourceLink.addEventListener('click', event => onSelect(source.representationId, event.shiftKey))
    const targetLink = document.createElement('button')
    targetLink.type = 'button'
    targetLink.className = 'link ghost'
    targetLink.textContent = target.name
    targetLink.addEventListener('click', event => onSelect(target.representationId, event.shiftKey))
    item.append(relationship, ' · ', sourceLink, ' → ', targetLink)
    list.append(item)
  }
  host.querySelector('.body')!.replaceChildren(list)
}
