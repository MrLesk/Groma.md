import type {
  ActiveWorkItem,
  ArchitectureWorld,
  C4Kind,
  CodeReference,
  Origin,
  WorldElement,
  WorldRelationship,
} from '../../../types.ts'
import { actionCaption, outgoingActions, travelledBy } from '../../action-path.ts'
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
  technology: string[]
  code: CodeReference[]
  travelledBy: { id: string; title: string }[]
}

export type DetailsTab = 'what' | 'how'

type Section =
  | 'description'
  | 'relationships'
  | 'children'
  | 'technology'
  | 'code'
  | 'travelledBy'

/** The pane's split: meaning on one tab, build evidence on the other. */
export function tabSections(tab: DetailsTab): Section[] {
  return tab === 'what'
    ? ['description', 'relationships', 'children']
    : ['technology', 'code', 'travelledBy']
}

/** The lit walk: its command and, for a person-details pick, the picker. */
export interface ActiveAction {
  id?: string
  personId?: string
}

export function nextActiveAction(
  current: ActiveAction,
  event:
    | { type: 'pick'; id: string; personId?: string }
    | { type: 'select' }
    | { type: 'clear' },
): ActiveAction {
  if (event.type === 'pick') return { id: event.id, personId: event.personId }
  if (event.type === 'clear') return {}
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
    technology: (element.technology ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(part => part.length > 0),
    code: element.code,
    travelledBy: travelledBy(element.representationId, world)
      .map(action => ({ id: action.id, title: action.description })),
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
  /** ownCommand is true for the person's own command rows, false for walk references. */
  onPickAction: (id: string, ownCommand: boolean) => void,
  activeActionId: string | undefined,
  tab: DetailsTab,
  onTab: (tab: DetailsTab) => void,
): void {
  const title = host.querySelector('h1')!
  const meta = host.querySelector('.meta')!
  const tabsHost = host.querySelector('.tabs')!
  const body = host.querySelector('.body')!
  title.textContent = inspected.name
  meta.textContent = `${inspected.kindLabel} · ${inspected.origin}`

  tabsHost.replaceChildren()
  for (const [key, label] of [['what', 'What it does'], ['how', 'How it\'s built']] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    if (key === tab) button.classList.add('active')
    button.addEventListener('click', () => onTab(key))
    tabsHost.append(button)
  }

  body.replaceChildren()
  const sections: Record<Section, () => void> = {
    description: () => {
      if (inspected.description === '') return
      const paragraph = document.createElement('p')
      paragraph.className = 'description'
      paragraph.textContent = inspected.description
      body.append(paragraph)
    },

    relationships: () => {
      if (inspected.relationships.length === 0) return
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
          if (relationship.pickable) onPickAction(relationship.id, true)
          else onSelect(relationship.peerId)
        })
        item.append(link, rest)
        list.append(item)
      }
      body.append(list)
    },

    children: () => {
      if (inspected.children.length === 0) return
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
    },

    technology: () => {
      if (inspected.technology.length === 0) return
      body.append(heading('Technology'))
      const list = document.createElement('ul')
      list.className = 'chips'
      for (const part of inspected.technology) {
        const chip = document.createElement('li')
        chip.className = 'chip'
        chip.textContent = part
        list.append(chip)
      }
      body.append(list)
    },

    code: () => {
      if (inspected.code.length === 0) return
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
    },

    travelledBy: () => {
      if (inspected.travelledBy.length === 0) return
      body.append(heading('Travelled by'))
      const list = document.createElement('ul')
      for (const walk of inspected.travelledBy) {
        const item = document.createElement('li')
        const link = document.createElement('button')
        link.type = 'button'
        link.className = 'link'
        if (walk.id === activeActionId) link.classList.add('active')
        link.append(walk.title)
        link.addEventListener('click', () => onPickAction(walk.id, false))
        item.append(link)
        list.append(item)
      }
      body.append(list)
    },
  }
  for (const key of tabSections(tab)) sections[key]()
}

/** The pane for a selected relationship: its description as the title, then both ends as links. */
export function paintRelationship(
  host: HTMLElement,
  relationship: WorldRelationship,
  world: ArchitectureWorld,
  onSelect: (id: string) => void,
): void {
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  host.querySelector('h1')!.textContent = relationship.description
  host.querySelector('.meta')!.textContent = `Relationship · ${relationship.origin}`
  host.querySelector('.tabs')!.replaceChildren()
  const list = document.createElement('ul')
  for (const [prefix, id] of [['', relationship.source], ['→ ', relationship.target]] as const) {
    const end = byId.get(id)!
    const item = document.createElement('li')
    const link = document.createElement('button')
    link.type = 'button'
    link.className = 'link'
    link.append(prefix, marked(end.kind, end.external, end.name))
    link.addEventListener('click', () => onSelect(id))
    item.append(link)
    list.append(item)
  }
  host.querySelector('.body')!.replaceChildren(list)
}

/**
 * The pane for a selected task: its id, status and assignees over its title,
 * then the description, the acceptance criteria as a checklist, the modified
 * files and the references, an element reference as a link that selects it.
 */
export function paintTask(
  host: HTMLElement,
  item: ActiveWorkItem,
  world: ArchitectureWorld,
  onSelect: (id: string) => void,
): void {
  const byId = new Map(world.elements.map(element => [element.id, element]))
  host.querySelector('h1')!.textContent = item.title
  host.querySelector('.meta')!.textContent = [item.id, item.status, ...item.assignees].join(' · ')
  host.querySelector('.tabs')!.replaceChildren()
  const body = host.querySelector('.body')!
  body.replaceChildren()
  if (item.description !== '') {
    const paragraph = document.createElement('p')
    paragraph.className = 'description'
    paragraph.textContent = item.description
    body.append(paragraph)
  }
  const section = (label: string, rows: HTMLElement[]): void => {
    if (rows.length === 0) return
    const list = document.createElement('ul')
    list.append(...rows)
    body.append(heading(label), list)
  }
  const done = item.criteria.filter(criterion => criterion.checked).length
  section(`Acceptance criteria · ${done} of ${item.criteria.length}`, item.criteria.map(criterion => {
    const row = document.createElement('li')
    if (!criterion.checked) row.textContent = `○ ${criterion.text}`
    else {
      const check = document.createElement('span')
      check.className = 'criterion-check'
      check.textContent = '✓'
      const text = document.createElement('span')
      text.className = 'ghost'
      text.textContent = ` ${criterion.text}`
      row.append(check, text)
    }
    return row
  }))
  section('Modified files', item.modifiedFiles.map(file => {
    const row = document.createElement('li')
    row.textContent = file
    return row
  }))
  section('References', item.references.map(reference => {
    const row = document.createElement('li')
    const element = byId.get(reference)
    if (element === undefined) row.textContent = reference
    else {
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'link'
      link.append(marked(element.kind, element.external, element.name))
      link.addEventListener('click', () => onSelect(element.representationId))
      row.append(link)
    }
    return row
  }))
}

/** Empties the pane while nothing is selected. */
export function clearDetails(host: HTMLElement): void {
  for (const part of ['h1', '.meta', '.tabs', '.body']) host.querySelector(part)!.replaceChildren()
}
