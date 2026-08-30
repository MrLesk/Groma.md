import type {
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureGraph,
  C4Kind,
  CodeReference,
  Origin,
} from '../../../types.ts'
import { fileTypeOf } from '../../../sheet/measure.ts'
import { pickableActions, travelledBy } from '../../action-path.ts'
import type { FlowRef } from '../../action-path.ts'
import { kindGlyph, kindLabel } from '../../atoms/kind.ts'
import { flowRow, type FlowRowData } from '../flow/row.ts'
import type { CodeMethod } from '../source/methods.ts'
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
  commands: FlowRowData[]
  flowsThrough: FlowRowData[]
  children: InspectedChild[]
  technology: string[]
  files: CodeReference[]
}

export type DetailsTab = 'what' | 'how'

/** A new architecture item starts with its meaning instead of inheriting build evidence. */
export function detailsTabAfterSelection(
  tab: DetailsTab,
  previousId: string | undefined,
  nextId: string | undefined,
): DetailsTab {
  return previousId === nextId ? tab : 'what'
}

type Section =
  | 'description'
  | 'relationships'
  | 'commands'
  | 'flowsThrough'
  | 'children'
  | 'technology'
  | 'code'
  | 'files'

/** The pane's split: meaning on one tab, build evidence on the other. */
export function tabSections(tab: DetailsTab): Section[] {
  return tab === 'what'
    ? ['description', 'relationships', 'commands', 'flowsThrough', 'children']
    : ['technology', 'code', 'files']
}

export function inspectDetails(
  element: AnnotatedElement,
  world: ArchitectureGraph,
): Inspected {
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const parentOf = parentOfElements(world.elements)
  const commandRelationships = pickableActions(element.representationId, world)
  const commandIds = new Set(commandRelationships.map(relationship => relationship.id))
  const relationships: InspectedRelationship[] = []
  for (const relationship of world.relationships) {
    const ends = promotedPeer(relationship, element.representationId, parentOf)
    if (ends == null || commandIds.has(relationship.id)) continue
    const peerId = ends.peerId
    const peer = byId.get(peerId)
    relationships.push({
      outgoing: ends.outgoing,
      peerId,
      peerName: peer?.name ?? peerId,
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
    commands: commandRelationships.map(command => ({
      flow: { commandId: command.id, actorId: element.representationId },
      title: command.description,
    })),
    flowsThrough: element.kind === 'actor'
      ? []
      : travelledBy(element.representationId, world).map(action => ({
        flow: { commandId: action.id },
        title: action.description,
      })),
    children,
    technology: (element.technology ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(part => part.length > 0),
    files: element.code,
  }
}

function heading(label: string): HTMLElement {
  const row = document.createElement('h2')
  row.className = 'section'
  row.textContent = label
  return row
}

function countFact(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function fileFacts(reference: CodeReference): string {
  const facts = [fileTypeOf(reference.file)]
  if (reference.lines !== undefined) facts.push(`${reference.lines} lines`)
  if (reference.dependencies !== undefined) facts.push(countFact(reference.dependencies, 'dependency', 'dependencies'))
  if (reference.dependents !== undefined) facts.push(countFact(reference.dependents, 'dependent', 'dependents'))
  if (reference.symbol !== undefined) facts.push(reference.symbol)
  facts.push(reference.scanner)
  return facts.join(' · ')
}

function fileList(references: CodeReference[], onSource: (file: string) => void): HTMLElement {
  const list = document.createElement('ul')
  for (const reference of references) {
    const item = document.createElement('li')
    const file = document.createElement('button')
    file.type = 'button'
    file.className = 'link source-file'
    file.textContent = reference.file
    file.setAttribute('aria-label', `Open source ${reference.file}`)
    file.addEventListener('click', () => onSource(reference.file))
    const extra = document.createElement('span')
    extra.className = 'ghost'
    extra.textContent = fileFacts(reference)
    item.append(file, extra)
    list.append(item)
  }
  return list
}

function methodList(methods: readonly CodeMethod[], onSource: (file: string, line?: number) => void): HTMLElement {
  const list = document.createElement('ul')
  for (const method of methods) {
    const item = document.createElement('li')
    const link = document.createElement('button')
    link.type = 'button'
    link.className = 'link code-method'
    link.textContent = `${method.name}()`
    link.setAttribute('aria-label', `Open ${method.name} in ${method.file} at line ${method.line}`)
    link.addEventListener('click', () => onSource(method.file, method.line))
    const location = document.createElement('span')
    location.className = 'ghost'
    location.textContent = `${method.file}:${method.line}`
    item.append(link, location)
    list.append(item)
  }
  return list
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
  onSelect: (id: string, additive: boolean) => void,
  onToggleFlow: (flow: FlowRef) => void,
  activeFlows: readonly FlowRef[],
  actorName: (actorId: string) => string | undefined,
  tab: DetailsTab,
  onTab: (tab: DetailsTab) => void,
  methods: readonly CodeMethod[],
  onSource: (file: string, line?: number) => void,
): void {
  const title = host.querySelector('h1')!
  const meta = host.querySelector('.meta')!
  const tabsHost = host.querySelector<HTMLElement>('.tabs')!
  const body = host.querySelector('.body')!
  title.textContent = inspected.name
  meta.textContent = `${inspected.kindLabel} · ${inspected.origin}`

  const hasBuild = inspected.technology.length > 0 || inspected.files.length > 0
  const shownTab = tab === 'how' && !hasBuild ? 'what' : tab
  tabsHost.replaceChildren()
  tabsHost.hidden = !hasBuild
  tabsHost.setAttribute('aria-label', 'Details view')
  for (const [key, label] of [
    ['what', 'What it does'],
    ...(hasBuild ? [['how', 'How it\'s built'] as const] : []),
  ] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('role', 'tab')
    button.textContent = label
    button.setAttribute('aria-selected', String(key === shownTab))
    if (key === shownTab) button.classList.add('active')
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
      list.className = 'relationships'
      for (const relationship of inspected.relationships) {
        const item = document.createElement('li')
        const link = document.createElement('button')
        link.type = 'button'
        link.className = 'relationship-row'
        const peerKind = relationship.peerKind === null
          ? 'element'
          : kindLabel(relationship.peerKind, relationship.peerExternal).toLowerCase()
        link.setAttribute(
          'aria-label',
          `Select ${peerKind} ${relationship.peerName}: ${relationship.description}`,
        )
        link.title = `Select ${relationship.peerName}: ${relationship.description}`
        const peer = marked(
          relationship.peerKind,
          relationship.peerExternal,
          relationship.peerName,
        )
        peer.classList.add('relationship-peer')
        const detail = document.createElement('span')
        detail.className = 'relationship-detail'
        detail.textContent = `${relationship.outgoing ? '→' : '←'} ${relationship.description}`
        const destination = document.createElement('span')
        destination.className = 'relationship-destination'
        destination.setAttribute('aria-hidden', 'true')
        destination.textContent = '›'
        link.append(peer, detail, destination)
        link.addEventListener('click', event => onSelect(relationship.peerId, event.shiftKey))
        item.append(link)
        list.append(item)
      }
      body.append(list)
    },

    commands: () => {
      if (inspected.commands.length === 0) return
      body.append(heading('Commands'))
      const list = document.createElement('div')
      list.className = 'flow-list'
      for (const command of inspected.commands) {
        list.append(flowRow(command, activeFlows, actorName, onToggleFlow))
      }
      body.append(list)
    },

    flowsThrough: () => {
      if (inspected.flowsThrough.length === 0) return
      body.append(heading('Flows through'))
      const list = document.createElement('div')
      list.className = 'flow-list'
      for (const flow of inspected.flowsThrough) {
        list.append(flowRow(flow, activeFlows, actorName, onToggleFlow))
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
        link.addEventListener('click', event => onSelect(child.id, event.shiftKey))
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
      if (methods.length === 0) return
      body.append(heading('Code'), methodList(methods, onSource))
    },

    files: () => {
      if (inspected.files.length === 0) return
      body.append(heading('Files'), fileList(inspected.files, onSource))
    },

  }
  for (const key of tabSections(shownTab)) sections[key]()
}

/** The pane for a selected relationship: its description as the title, then both ends as links. */
export function paintRelationship(
  host: HTMLElement,
  relationship: AnnotatedRelationship,
  world: ArchitectureGraph,
  onSelect: (id: string, additive: boolean) => void,
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
    link.addEventListener('click', event => onSelect(id, event.shiftKey))
    item.append(link)
    list.append(item)
  }
  host.querySelector('.body')!.replaceChildren(list)
}

/** Empties the pane while nothing is selected. */
export function clearDetails(host: HTMLElement): void {
  for (const part of ['h1', '.meta', '.tabs', '.body']) host.querySelector(part)!.replaceChildren()
}
