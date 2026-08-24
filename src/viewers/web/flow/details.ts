import type { ArchitectureGraph } from '../../../types.ts'
import { actionLegs } from '../../action-path.ts'
import type { FlowRef } from '../../action-path.ts'

export const flowDetailsCss = `
  .flow-legs { display: grid; }
  .flow-leg {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3px 12px;
    width: 100%;
    padding: 9px 0;
    border: 0;
    border-bottom: 1px solid var(--hairline);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .flow-leg:hover { background: var(--hover); }
  .flow-leg-label, .flow-leg-action {
    color: var(--muted);
    font-size: 8px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .flow-leg-title { grid-column: 1; }
  .flow-leg-endpoints { grid-column: 1; color: var(--muted); font-size: 9px; }
  .flow-leg-action { grid-column: 2; grid-row: 1 / 4; align-self: center; }
`

/** Explains one derived flow as its command, optional actor scope, and authored legs. */
export function paintFlowDetails(
  host: HTMLElement,
  flow: FlowRef,
  world: ArchitectureGraph,
  onFocus: (sourceId: string, targetId: string) => void,
): void {
  const command = world.relationships.find(relationship => relationship.id === flow.commandId)!
  const elements = new Map(world.elements.map(element => [element.representationId, element]))
  const actor = elements.get(flow.actorId ?? '')
  const legs = actionLegs(flow.commandId, world, flow.actorId)
  host.querySelector('h1')!.textContent = command.description
  host.querySelector('.meta')!.textContent = [
    'Flow',
    ...(actor === undefined ? [] : [`Actor: ${actor.name}`]),
    `${legs.length} ${legs.length === 1 ? 'relationship' : 'relationships'}`,
  ].join(' · ')
  host.querySelector('.tabs')!.replaceChildren()
  const heading = document.createElement('h2')
  heading.className = 'section'
  heading.textContent = 'Relationships'
  const list = document.createElement('div')
  list.className = 'flow-legs'
  for (const [index, leg] of legs.entries()) {
    const source = elements.get(leg.source)!
    const target = elements.get(leg.target)!
    const relationship = document.createElement('button')
    relationship.type = 'button'
    relationship.className = 'flow-leg'
    relationship.setAttribute(
      'aria-label',
      `Focus relationship ${index + 1}: ${leg.description}, ${source.name} to ${target.name}`,
    )
    const label = document.createElement('span')
    label.className = 'flow-leg-label'
    label.textContent = `Relationship ${index + 1}`
    const title = document.createElement('span')
    title.className = 'flow-leg-title'
    title.textContent = leg.description
    const endpoints = document.createElement('span')
    endpoints.className = 'flow-leg-endpoints'
    endpoints.textContent = `${source.name} → ${target.name}`
    const action = document.createElement('span')
    action.className = 'flow-leg-action'
    action.setAttribute('aria-hidden', 'true')
    action.textContent = 'Focus'
    relationship.append(label, title, endpoints, action)
    relationship.addEventListener('click', () => onFocus(source.representationId, target.representationId))
    list.append(relationship)
  }
  host.querySelector('.body')!.replaceChildren(heading, list)
}
