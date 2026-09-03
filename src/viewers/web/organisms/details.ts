import type {
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureGraph,
  C4Kind,
  CodeReference,
  Origin,
} from '../../../types.ts'
import type { ElementWorkGroup } from '../../../work/pins.ts'
import { removalBlocker } from '../../../removable.ts'
import { pickableActions, travelledBy } from '../../action-path.ts'
import type { FlowRef } from '../../action-path.ts'
import { kindGlyph, kindLabel } from '../../atoms/kind.ts'
import { flowRow, type FlowRowData } from '../flow/row.ts'
import type { CodeFile } from '../source/structure.ts'
import { paintElementWork } from '../work/component-tasks.ts'
import type { EditArchitectureInput } from '../../../authoring.ts'
import { codeList, fileList } from './code-lists.ts'
import { message, paintEditable } from './editable.ts'
import { paintRemoveControl } from './remove.ts'
import {
  parentOfElements,
  promotedPeer,
} from '../../relationship-text.ts'

export interface InspectedRelationship {
  outgoing: boolean
  peerId: string
  peerTitle: string
  peerKind: C4Kind | null
  peerExternal: boolean
  description: string
}

export interface InspectedChild {
  id: string
  title: string
  kind: C4Kind
  external: boolean
}

export interface Inspected {
  title: string
  description: string
  kindLabel: string
  origin: Origin
  overview: string
  relationships: InspectedRelationship[]
  commands: FlowRowData[]
  flowsThrough: FlowRowData[]
  children: InspectedChild[]
  technology: string[]
  files: CodeReference[]
  /** True when groma remove would succeed on it right now. */
  removable: boolean
  /** The draft record this element belongs to or that touches it. */
  draft?: string
}

/** What the edit verb changes from the pane; the id is the selected element's. */
export type MeaningEdit = Pick<EditArchitectureInput, 'title' | 'description' | 'overview' | 'technology' | 'draft'>

export type DetailsTab = 'what' | 'how' | 'tasks'

/** A new architecture item starts with its meaning instead of inheriting build evidence. */
export function detailsTabAfterSelection(
  tab: DetailsTab,
  previousId: string | undefined,
  nextId: string | undefined,
): DetailsTab {
  return previousId === nextId ? tab : 'what'
}

/** Definitive live work without a linked task leaves the component on its meaning tab. */
export function detailsTabAfterWork(
  tab: DetailsTab,
  hasTasks: boolean,
): DetailsTab {
  return tab === 'tasks' && !hasTasks ? 'what' : tab
}

type Section =
  | 'overview'
  | 'relationships'
  | 'commands'
  | 'flowsThrough'
  | 'children'
  | 'technology'
  | 'code'
  | 'files'

/** The pane's split: meaning on one tab, build evidence on the other. */
export function tabSections(tab: Exclude<DetailsTab, 'tasks'>): Section[] {
  return tab === 'what'
    ? ['overview', 'relationships', 'commands', 'flowsThrough', 'children']
    : ['technology', 'code', 'files']
}

export function detailsTabs(
  inspected: Pick<Inspected, 'technology' | 'files'>,
  workGroups: readonly { items: readonly unknown[] }[],
): DetailsTab[] {
  return [
    'what',
    ...(inspected.technology.length > 0 || inspected.files.length > 0 ? ['how' as const] : []),
    ...(workGroups.some(group => group.items.length > 0) ? ['tasks' as const] : []),
  ]
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
      peerTitle: peer?.title ?? peerId,
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
      title: child?.title ?? childId,
      kind: child?.kind ?? 'component',
      external: child?.external ?? false,
    })
  }
  return {
    title: element.title,
    description: element.description ?? '',
    kindLabel: kindLabel(element.kind, element.external),
    origin: element.origin,
    overview: element.overview,
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
    removable: removalBlocker(world, element.id) === undefined,
    ...(element.draft === undefined ? {} : { draft: element.draft }),
  }
}

function heading(label: string): HTMLElement {
  const row = document.createElement('h2')
  row.className = 'section'
  row.textContent = label
  return row
}

function paragraph(className: string, text: string): HTMLElement {
  const row = document.createElement('p')
  row.className = className
  row.textContent = text
  return row
}

/** Description and overview: read-only prose, or fields that save in place. */
function paintMeaning(body: Element, inspected: Inspected, onEdit: DetailsOptions['onEdit']): void {
  if (onEdit === undefined) {
    if (inspected.description !== '') body.append(paragraph('description', inspected.description))
    if (inspected.overview !== '') body.append(paragraph('overview', inspected.overview))
    return
  }
  paintEditable(body, {
    className: 'description', label: 'Description', value: inspected.description,
    save: description => onEdit({ description }),
  })
  paintEditable(body, {
    className: 'overview', label: 'Overview', value: inspected.overview, multiline: true,
    save: overview => onEdit({ overview }),
  })
  // Technology is edited here because the How tab, where its chips are read, exists only once an element has technology or files.
  body.append(heading('Technology'))
  paintEditable(body, {
    className: 'technology', label: 'Technology', value: inspected.technology.join(', '),
    save: technology => onEdit({ technology }),
  })
}

/** The draft records to tag the element with; a tag never comes off from here, as the CLI has no flag for it. */
function paintDraftSelect(body: Element, inspected: Inspected, drafts: readonly string[], onEdit: (input: MeaningEdit) => Promise<void>): void {
  if (drafts.length === 0) return
  body.append(heading('Draft'))
  const select = document.createElement('select')
  select.className = 'draft'
  select.setAttribute('aria-label', 'Draft')
  const none = document.createElement('option')
  none.value = ''
  none.textContent = 'None'
  none.disabled = inspected.draft !== undefined
  select.append(none)
  for (const draft of drafts) {
    const option = document.createElement('option')
    option.value = draft
    option.textContent = draft
    select.append(option)
  }
  select.value = inspected.draft ?? ''
  const error = paragraph('error', '')
  error.setAttribute('role', 'status')
  select.addEventListener('change', async () => {
    error.textContent = ''
    select.disabled = true
    try {
      await onEdit({ draft: select.value })
    } catch (cause) {
      error.textContent = message(cause)
      select.disabled = false
    }
  })
  const box = document.createElement('div')
  box.className = 'editable draft'
  box.append(select, error)
  body.append(box)
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

interface DetailsOptions {
  onSelect: (id: string, additive: boolean) => void,
  onToggleFlow: (flow: FlowRef) => void,
  activeFlows: readonly FlowRef[]
  actorTitle: (actorId: string) => string | undefined,
  tab: DetailsTab
  onTab: (tab: DetailsTab) => void,
  code: readonly CodeFile[]
  onSource: (file: string, line?: number) => void,
  workGroups: readonly ElementWorkGroup[]
  onTask: (id: string) => void
  onRemove?: () => Promise<void>
  /** The draft records the pane can tag with, present with onEdit. */
  drafts?: readonly string[]
  onEdit?: (input: MeaningEdit) => Promise<void>
}

export function paintDetails(host: HTMLElement, inspected: Inspected, options: DetailsOptions): void {
  const { onSelect, onToggleFlow, activeFlows, actorTitle, tab, onTab, code, onSource, workGroups, onTask, onRemove, drafts, onEdit } = options
  const title = host.querySelector('h1')!
  const meta = host.querySelector('.meta')!
  const tabsHost = host.querySelector<HTMLElement>('.tabs')!
  const body = host.querySelector('.body')!
  title.replaceChildren()
  if (onEdit === undefined) title.textContent = inspected.title
  else paintEditable(title, { className: 'title', label: 'Title', value: inspected.title, save: value => onEdit({ title: value }) })
  meta.textContent = `${inspected.kindLabel} · ${inspected.origin}`

  const availableTabs = detailsTabs(inspected, workGroups)
  const shownTab = availableTabs.includes(tab) ? tab : 'what'
  tabsHost.replaceChildren()
  tabsHost.hidden = availableTabs.length === 1
  tabsHost.setAttribute('aria-label', 'Details view')
  const labels: Record<DetailsTab, string> = { what: 'What it does', how: 'How it\'s built', tasks: 'Tasks' }
  for (const key of availableTabs) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('role', 'tab')
    button.textContent = labels[key]
    button.setAttribute('aria-selected', String(key === shownTab))
    if (key === shownTab) button.classList.add('active')
    button.addEventListener('click', () => onTab(key))
    tabsHost.append(button)
  }

  body.replaceChildren()
  const sections: Record<Section, () => void> = {
    overview: () => {
      paintMeaning(body, inspected, onEdit)
      if (onEdit !== undefined) paintDraftSelect(body, inspected, drafts ?? [], onEdit)
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
          `Select ${peerKind} ${relationship.peerTitle}: ${relationship.description}`,
        )
        link.title = `Select ${relationship.peerTitle}: ${relationship.description}`
        const peer = marked(
          relationship.peerKind,
          relationship.peerExternal,
          relationship.peerTitle,
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
        list.append(flowRow(command, activeFlows, actorTitle, onToggleFlow))
      }
      body.append(list)
    },

    flowsThrough: () => {
      if (inspected.flowsThrough.length === 0) return
      body.append(heading('Flows through'))
      const list = document.createElement('div')
      list.className = 'flow-list'
      for (const flow of inspected.flowsThrough) {
        list.append(flowRow(flow, activeFlows, actorTitle, onToggleFlow))
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
        link.append(marked(child.kind, child.external, child.title))
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
      if (code.length === 0) return
      body.append(heading('Code'), codeList(code, onSource))
    },

    files: () => {
      if (inspected.files.length === 0) return
      body.append(heading('Files'), fileList(inspected.files, onSource))
    },

  }
  if (shownTab === 'tasks') paintElementWork(body, workGroups, onTask)
  else for (const key of tabSections(shownTab)) sections[key]()
  if (shownTab === 'what' && inspected.removable && onRemove !== undefined) {
    paintRemoveControl(body, inspected.title, onRemove)
  }
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
    link.append(prefix, marked(end.kind, end.external, end.title))
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
