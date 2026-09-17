import type { AnnotatedElement, AnnotatedRelationship } from '../../../types.ts'
import { kindLabel } from '../../atoms/kind.ts'
import { pairDescriptions } from '../../relationship-text.ts'

type Endpoint = Pick<AnnotatedElement, 'representationId' | 'title' | 'kind' | 'external'>

export interface RelationshipCardData extends Pick<AnnotatedRelationship, 'id' | 'description'> {
  source: Endpoint
  target: Endpoint
}

/** One ordered endpoint pair in an element's list, with the exact relationships it summarizes. */
export interface RelationshipPairData {
  source: Endpoint
  target: Endpoint
  relationships: RelationshipCardData[]
}

type Select = (id: string, additive: boolean) => void

interface CardAction {
  label: string
  run: () => void
  expanded?: boolean
}

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

function card(source: Endpoint, target: Endpoint, descriptions: readonly string[], onSelect: Select, currentId: string | undefined, action: CardAction | undefined): HTMLElement {
  const host = document.createElement('div')
  host.className = 'relationship-card'
  const center = document.createElement(action === undefined ? 'div' : 'button')
  center.className = 'relationship-action'
  for (const description of descriptions) {
    const label = document.createElement('span')
    label.className = 'relationship-label'
    label.textContent = description
    center.append(label)
  }
  if (action !== undefined && center instanceof HTMLButtonElement) {
    center.type = 'button'
    center.setAttribute('aria-label', action.label)
    if (action.expanded !== undefined) center.setAttribute('aria-expanded', String(action.expanded))
    center.addEventListener('click', action.run)
  }
  const arrow = document.createElement('span')
  arrow.className = 'relationship-arrow'
  arrow.textContent = '⟶'
  arrow.setAttribute('aria-hidden', 'true')
  center.append(arrow)
  host.append(endpoint(source, 'Source', onSelect, currentId), center, endpoint(target, 'Destination', onSelect, currentId))
  return host
}

/** One directed card for an element's connections and a selected relationship. */
export function relationshipCard(data: RelationshipCardData, onSelect: Select, currentId?: string): HTMLElement {
  return card(data.source, data.target, [data.description], onSelect, currentId, currentId === undefined ? undefined : {
    label: `Open relationship: ${data.description}`,
    run: () => onSelect(data.id, false),
  })
}

/** A pair with one relationship opens it; a combined pair unfolds into each exact relationship beneath it. */
export function relationshipPairCard(pair: RelationshipPairData, onSelect: Select, currentId: string, expanded: boolean, onToggle: () => void): HTMLElement {
  if (pair.relationships.length === 1) {
    return relationshipCard({ ...pair.relationships[0]!, source: pair.source, target: pair.target }, onSelect, currentId)
  }
  const descriptions = pairDescriptions(pair)
  const head = card(pair.source, pair.target, descriptions, onSelect, currentId, {
    label: `Relationships: ${descriptions.join('; ')}`,
    run: onToggle,
    expanded,
  })
  if (!expanded) return head
  const list = document.createElement('ul')
  list.className = 'relationships'
  for (const relationship of pair.relationships) {
    const item = document.createElement('li')
    item.append(relationshipCard(relationship, onSelect, currentId))
    list.append(item)
  }
  const host = document.createElement('div')
  host.append(head, list)
  return host
}

export const relationshipCardCss = `
  #details ul.relationships { display: grid; gap: 14px; padding: 0; list-style: none; }
  #details ul.relationships > li + li { border-top: 1px solid var(--hairline); padding-top: 14px; }
  .relationship-card { display: flex; align-items: center; gap: 10px; }
  .relationship-end { flex: 0 1 auto; min-width: 0; max-width: 30%; }
  .relationship-caption { color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
  .relationship-name { border: 0; padding: 0; background: transparent; color: var(--ink); font: inherit; font-size: 12px; font-weight: 600; line-height: 1.4; text-align: left; overflow-wrap: anywhere; }
  .relationship-name:hover { text-decoration: underline; text-underline-offset: 3px; }
  .relationship-this { display: inline-block; vertical-align: middle; border: 1px solid var(--muted); border-radius: 2px; padding: 1px 4px; font-size: 9px; line-height: 1.3; font-weight: 400; }
  .relationship-kind { color: var(--muted); font-size: 10px; margin-top: 5px; }
  .relationship-arrow { display: block; font-size: 28px; line-height: 14px; margin-top: 2px; }
  .relationship-action { flex: 1; min-width: 0; border: 0; padding: 0 12px; background: transparent; color: var(--ink); font: inherit; font-size: 10px; line-height: 1.5; text-align: center; overflow-wrap: anywhere; }
  .relationship-label { display: block; max-width: 24ch; margin: 0 auto; }
  button.relationship-action:hover { color: var(--highlight-text); }
  #details ul.relationships ul.relationships { margin: 14px 0 0 12px; padding-left: 12px; border-left: 1px solid var(--hairline); }
`
