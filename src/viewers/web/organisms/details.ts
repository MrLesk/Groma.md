import type {
  ArchitectureWorld,
  C4Kind,
  CodeReference,
  Origin,
  WorldElement,
} from '../../../types.ts'
import { actionCaption, outgoingActions } from '../../action-path.ts'
import { kindGlyph, kindLabel } from '../atoms/kind.ts'
import {
  parentOfElements,
  promotedPeer,
} from '../../relationship-text.ts'

export interface InspectedRelationship {
  id: string
  outgoing: boolean
  pickable: boolean
  peerId: string
  peerName: string
  peerKind: C4Kind | null
  peerExternal: boolean
  title: string
  detail: string
}

export interface InspectedChild {
  id: string
  name: string
  kind: C4Kind
  external: boolean
}

export interface Inspected {
  name: string
  kindLabel: string
  origin: Origin
  description: string
  relationships: InspectedRelationship[]
  children: InspectedChild[]
  code: CodeReference[]
}

export function nextActiveActionId(
  current: string | undefined,
  event: { type: 'pick'; id: string } | { type: 'select' } | { type: 'clear' },
): string | undefined {
  if (event.type === 'pick') return event.id
  if (event.type === 'clear') return undefined
  return current
}

export function inspectDetails(
  element: WorldElement,
  world: ArchitectureWorld,
): Inspected {
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const parentOf = parentOfElements(world.elements)
  const actions = outgoingActions(element.representationId, world)
  const actionIds = new Set(actions.map(item => item.id))
  const incoming = world.relationships.filter(relationship => {
    return promotedPeer(relationship, element.representationId, parentOf)?.outgoing === false
  })
  const relationships: InspectedRelationship[] = []
  for (const relationship of [...actions, ...incoming]) {
    const outgoing = actionIds.has(relationship.id)
    const ends = promotedPeer(relationship, element.representationId, parentOf)
    const peerId = outgoing ? relationship.target : ends?.peerId ?? relationship.source
    const peer = byId.get(peerId)
    const caption = actionCaption(relationship, outgoing, id => byId.get(id)?.name)
    relationships.push({
      id: relationship.id,
      outgoing,
      pickable: element.kind === 'person' && outgoing,
      peerId,
      peerName: peer?.name ?? peerId,
      peerKind: peer?.kind ?? null,
      peerExternal: peer?.external ?? false,
      title: caption.title,
      detail: caption.detail,
    })
  }
  const children: InspectedChild[] = []
  for (const childId of element.children) {
    const child = byId.get(childId)
    children.push({
      id: childId,
      name: child?.name ?? childId,
      kind: child?.kind ?? 'component',
      external: child?.external ?? false,
    })
  }
  return {
    name: element.name,
    kindLabel: kindLabel(element.kind, element.external),
    origin: element.origin,
    description: element.description,
    relationships,
    children,
    code: element.code,
  }
}

function heading(label: string): HTMLElement {
  const row = document.createElement('p')
  row.className = 'section'
  row.textContent = label
  return row
}

function marked(
  kind: C4Kind | null,
  external: boolean,
  text: string,
): HTMLElement {
  const row = document.createElement('span')
  if (kind !== null) {
    const mark = document.createElement('span')
    mark.className = 'mark'
    mark.textContent = kindGlyph(kind)
    if (external) mark.classList.add('ghost')
    row.append(mark, ' ')
  }
  row.append(text)
  return row
}

export function paintDetails(
  host: HTMLElement,
  inspected: Inspected,
  onSelect: (id: string) => void,
  onPickAction: (id: string) => void,
  activeActionId?: string,
): void {
  const title = host.querySelector('h1')!
  const meta = host.querySelector('.meta')!
  const description = host.querySelector('.description') as HTMLElement
  const body = host.querySelector('.body')!
  title.textContent = inspected.name
  meta.textContent = `${inspected.kindLabel} · ${inspected.origin}`
  description.textContent = inspected.description
  description.hidden = inspected.description === ''
  body.replaceChildren()

  if (inspected.relationships.length > 0) {
    body.append(heading('Relationships'))
    const list = document.createElement('ul')
    for (const relationship of inspected.relationships) {
      const item = document.createElement('li')
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'link'
      if (relationship.id === activeActionId) link.classList.add('active')
      const rest = relationship.detail === '' ? '' : ` · ${relationship.detail}`
      if (relationship.outgoing) {
        link.append(`→ ${relationship.title}`)
      } else {
        link.append(
          '← ',
          marked(relationship.peerKind, relationship.peerExternal, relationship.title),
        )
      }
      link.addEventListener('click', () => {
        if (relationship.pickable) onPickAction(relationship.id)
        else onSelect(relationship.peerId)
      })
      item.append(link, rest)
      list.append(item)
    }
    body.append(list)
  }

  if (inspected.children.length > 0) {
    body.append(heading('Children'))
    const list = document.createElement('ul')
    for (const child of inspected.children) {
      const item = document.createElement('li')
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'link'
      link.append(marked(child.kind, child.external, child.name))
      link.addEventListener('click', () => onSelect(child.id))
      item.append(link)
      list.append(item)
    }
    body.append(list)
  }

  if (inspected.code.length > 0) {
    body.append(heading('Code'))
    const list = document.createElement('ul')
    for (const reference of inspected.code) {
      const file = document.createElement('li')
      file.textContent = reference.file
      const extra = document.createElement('li')
      extra.className = 'ghost'
      extra.textContent = reference.symbol === undefined
        ? reference.scanner
        : `${reference.symbol} · ${reference.scanner}`
      list.append(file, extra)
    }
    body.append(list)
  }
}
