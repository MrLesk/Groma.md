import type { AnnotatedElement, AnnotatedRelationship } from '../../../types.ts'
import { kindLabel } from '../../atoms/kind.ts'

type Endpoint = Pick<AnnotatedElement, 'representationId' | 'title' | 'kind' | 'external'>

export interface RelationshipCardData extends Pick<AnnotatedRelationship, 'id' | 'description'> {
  source: Endpoint
  target: Endpoint
}

type Select = (id: string, additive: boolean) => void

function endpoint(end: Endpoint, label: string, onSelect: Select, currentId?: string): HTMLElement {
  const host = document.createElement('div')
  host.className = 'relationship-end'
  const caption = document.createElement('div')
  caption.className = 'relationship-caption'
  caption.textContent = label
  const name = document.createElement('button')
  name.type = 'button'
  name.className = 'relationship-name'
  name.textContent = end.title
  name.setAttribute('aria-label', `${label}: ${end.title}`)
  name.addEventListener('click', event => onSelect(end.representationId, event.shiftKey))
  if (end.representationId === currentId) {
    const badge = document.createElement('span')
    badge.className = 'relationship-this'
    badge.textContent = 'THIS'
    name.append(' ', badge)
  }
  const kind = document.createElement('div')
  kind.className = 'relationship-kind'
  kind.textContent = kindLabel(end.kind, end.external)
  host.append(caption, name, kind)
  return host
}

/** One directed card for an element's connections and a selected relationship. */
export function relationshipCard(data: RelationshipCardData, onSelect: Select, currentId?: string): HTMLElement {
  const card = document.createElement('div')
  card.className = 'relationship-card'
  const action = document.createElement(currentId === undefined ? 'div' : 'button')
  action.className = 'relationship-action'
  action.textContent = data.description
  if (action instanceof HTMLButtonElement) {
    action.type = 'button'
    action.setAttribute('aria-label', `Open relationship: ${data.description}`)
    action.addEventListener('click', () => onSelect(data.id, false))
  }
  const arrow = document.createElement('span')
  arrow.className = 'relationship-arrow'
  arrow.textContent = '⟶'
  arrow.setAttribute('aria-hidden', 'true')
  action.append(arrow)
  card.append(endpoint(data.source, 'Source', onSelect, currentId), action, endpoint(data.target, 'Destination', onSelect, currentId))
  return card
}

export const relationshipCardCss = `
  #details ul.relationships { display: grid; gap: 14px; padding: 0; list-style: none; }
  #details ul.relationships > li + li { border-top: 1px solid var(--hairline); padding-top: 14px; }
  .relationship-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr); align-items: center; gap: 10px; }
  .relationship-caption { color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
  .relationship-name { border: 0; padding: 0; background: transparent; color: var(--ink); font: inherit; font-size: 12px; font-weight: 600; line-height: 1.4; text-align: left; overflow-wrap: anywhere; }
  .relationship-name:hover { text-decoration: underline; text-underline-offset: 3px; }
  .relationship-this { display: inline-block; vertical-align: middle; border: 1px solid var(--muted); border-radius: 2px; padding: 1px 4px; font-size: 9px; line-height: 1.3; font-weight: 400; }
  .relationship-kind { color: var(--muted); font-size: 10px; margin-top: 5px; }
  .relationship-arrow { display: block; font-size: 28px; line-height: 1; margin-top: 4px; }
  .relationship-action { min-width: 0; border: 0; padding: 0; background: transparent; color: var(--ink); font: inherit; font-size: 10px; line-height: 1.5; text-align: center; overflow-wrap: anywhere; }
  button.relationship-action:hover { color: var(--highlight-text); }
`
