import type {
  ArchitectureWorld,
  C4Kind,
  CodeReference,
  Origin,
  WorldElement,
} from '../../../types.ts'
import { kindGlyph, kindLabel } from '../atoms/kind.ts'
import {
  parentOfElements,
  promotedPeer,
} from '../../relationship-text.ts'

export interface InspectedRelationship {
  outgoing: boolean
  peerId: string
  peerName: string
  peerKind: C4Kind | null
  peerExternal: boolean
  description: string
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

export function inspectDetails(
  element: WorldElement,
  world: ArchitectureWorld,
): Inspected {
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const parentOf = parentOfElements(world.elements)
  const relationships: InspectedRelationship[] = []
  for (const relationship of world.relationships) {
    const ends = promotedPeer(relationship, element.representationId, parentOf)
    if (ends === null) continue
    const peer = byId.get(ends.peerId)
    relationships.push({
      outgoing: ends.outgoing,
      peerId: ends.peerId,
      peerName: peer?.name ?? ends.peerId,
      peerKind: peer?.kind ?? null,
      peerExternal: peer?.external ?? false,
      description: relationship.description,
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
    mark.className = `mark ${kind}`
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
      link.append(
        relationship.outgoing ? '→ ' : '← ',
        marked(relationship.peerKind, relationship.peerExternal, relationship.peerName),
      )
      link.addEventListener('click', () => onSelect(relationship.peerId))
      item.append(link, ` · ${relationship.description}`)
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
