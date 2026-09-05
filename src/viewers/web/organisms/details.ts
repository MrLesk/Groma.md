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
import { flowsThrough } from '../../flows.ts'
import type { FlowRef } from '../../flows.ts'
import { kindGlyph, kindLabel } from '../../atoms/kind.ts'
import type { FlowRowData } from '../flow/row.ts'
import { createFlowList } from '../flow/list.ts'
import type { CodeFile } from '../../source/structure.ts'
import { paintElementWork } from '../work/component-tasks.ts'
import { codeList, fileList } from './code-lists.ts'
import { heading, paragraph } from '../atoms/text.ts'
import { editButton, isEditing, type EditField } from './editable.ts'
import type { PaneWrites, RelationWrites } from './writes.ts'
import {
  paintAcceptControl,
  paintSelectionControls,
} from './writes.ts'
import { paintRemoveControl } from './remove.ts'
import { relationshipCard, type RelationshipCardData } from './relationship-card.ts'
import {
  parentOfElements,
  promotedPeer,
} from '../../relationship-text.ts'

export interface InspectedChild {
  id: string
  title: string
  kind: C4Kind
  external: boolean
}

export interface Inspected {
  id: string
  title: string
  description: string
  kindLabel: string
  origin: Origin
  overview: string
  relationships: RelationshipCardData[]
  flows: FlowRowData[]
  children: InspectedChild[]
  technology: string[]
  files: CodeReference[]
  /** True when groma remove would succeed on it right now. */
  removable: boolean
  /** A draft with scan evidence can be accepted. */
  matchedGhost: boolean
  /** An empty, unrelated component can move to another container. */
  movable: boolean
  parent: string | null
}

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
  | 'flows'
  | 'children'
  | 'technology'
  | 'code'
  | 'files'

/** The pane's split: meaning on one tab, build evidence on the other. */
export function tabSections(tab: Exclude<DetailsTab, 'tasks'>): Section[] {
  return tab === 'what'
    ? ['overview', 'relationships', 'flows', 'children']
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

function isMatchedGhost(element: AnnotatedElement): boolean {
  return element.origin === 'draft' && element.code.length > 0
}

export function inspectDetails(
  element: AnnotatedElement,
  world: ArchitectureGraph,
): Inspected {
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const parentOf = parentOfElements(world.elements)
  const relationships: RelationshipCardData[] = []
  for (const relationship of world.relationships) {
    const ends = promotedPeer(relationship, element.representationId, parentOf)
    if (ends == null) continue
    const peer = byId.get(ends.peerId)!
    relationships.push({
      id: relationship.id,
      source: ends.outgoing ? element : peer,
      target: ends.outgoing ? peer : element,
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
    id: element.id,
    title: element.title,
    description: element.description ?? '',
    kindLabel: kindLabel(element.kind, element.external),
    origin: element.origin,
    overview: element.overview,
    relationships,
    flows: flowsThrough(element.representationId, world).map(flow => ({
      flow: { id: flow.id }, title: flow.title,
    })),
    children,
    technology: (element.technology ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(part => part.length > 0),
    files: element.code,
    removable: removalBlocker(world, element.id) === undefined,
    matchedGhost: isMatchedGhost(element),
    movable: element.movable === true,
    parent: element.parent,
  }
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

export interface DetailsOptions extends PaneWrites {
  world: ArchitectureGraph
  onSelect: (id: string, additive: boolean) => void,
  onToggleFlow: (flow: FlowRef) => void,
  activeFlow: FlowRef | undefined
  tab: DetailsTab
  onTab: (tab: DetailsTab) => void,
  code: readonly CodeFile[]
  onSource: (file: string, line?: number) => void,
  workGroups: readonly ElementWorkGroup[]
  onTask: (id: string) => void
}

const paintDetailFlows = createFlowList()

function paintTabs(tabsHost: HTMLElement, availableTabs: DetailsTab[], shownTab: DetailsTab, onTab: (tab: DetailsTab) => void): void {
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
}

export function paintDetails(host: HTMLElement, inspected: Inspected, options: DetailsOptions): void {
  const { onSelect, onToggleFlow, activeFlow, tab, onTab, code, onSource, workGroups, onTask, onRemove, onAccept, onEdit, onRead, selection } = options
  if (onEdit !== undefined && isEditing(host, inspected.id)) return
  const title = host.querySelector('h1')!
  const meta = host.querySelector('.meta')!
  const tabsHost = host.querySelector<HTMLElement>('.tabs')!
  const body = host.querySelector('.body')!
  title.replaceChildren()
  title.textContent = inspected.title
  meta.textContent = `${inspected.kindLabel} · ${inspected.origin}`

  const availableTabs = detailsTabs(inspected, workGroups)
  const shownTab = availableTabs.includes(tab) ? tab : 'what'
  paintTabs(tabsHost, availableTabs, shownTab, onTab)

  body.replaceChildren()
  const sections: Record<Section, () => void> = {
    overview: () => {
      if (inspected.description !== '') body.append(paragraph('description', inspected.description))
      if (inspected.overview !== '') body.append(paragraph('overview', inspected.overview))
    },

    relationships: () => {
      if (inspected.relationships.length === 0) return
      body.append(heading('Relationships'))
      const list = document.createElement('ul')
      list.className = 'relationships'
      for (const relationship of inspected.relationships) {
        const item = document.createElement('li')
        item.append(relationshipCard(relationship, onSelect, inspected.id))
        list.append(item)
      }
      body.append(list)
    },

    flows: () => {
      if (inspected.flows.length === 0) return
      const list = document.createElement('div')
      paintDetailFlows(list, options.world, activeFlow, onToggleFlow, {
        title: `Flows through this ${inspected.kindLabel.toLowerCase()}`, visibleFlows: inspected.flows,
      })
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
  if (shownTab === 'what' && selection !== undefined) paintSelectionControls(body, selection)
  if (shownTab === 'tasks') paintElementWork(body, workGroups, onTask)
  else for (const key of tabSections(shownTab)) sections[key]()
  if (shownTab === 'what' && inspected.matchedGhost && onAccept !== undefined) paintAcceptControl(body, onAccept)
  if (onEdit !== undefined && onRead !== undefined) body.prepend(editButton(host, inspected.id, elementFields(inspected, options), onEdit, onRead))
  if (shownTab === 'what' && inspected.removable && onRemove !== undefined) {
    paintRemoveControl(body, inspected.title, onRemove)
  }
}


/** Direction and meaning of a selected relationship, with removal offered only for drafts. */
export function paintRelationship(
  host: HTMLElement,
  relationship: AnnotatedRelationship,
  world: ArchitectureGraph,
  onSelect: (id: string, additive: boolean) => void,
  writes: RelationWrites,
): void {
  if (writes.onEdit !== undefined && isEditing(host, relationship.id)) return
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const title = host.querySelector('h1')!
  title.replaceChildren()
  const body = host.querySelector('.body')!
  body.replaceChildren()
  title.textContent = 'Relationship'
  if (writes.onEdit !== undefined && writes.onRead !== undefined) body.prepend(editButton(host, relationship.id, [
    { name: 'description', label: 'Description', value: relationship.description, required: true },
    { name: 'technology', label: 'Technology', value: relationship.technology, required: true },
  ], writes.onEdit, writes.onRead))
  host.querySelector('.meta')!.textContent = `Relationship · ${relationship.origin === 'draft' ? 'draft' : 'current'}`
  host.querySelector('.tabs')!.replaceChildren()
  body.append(relationshipCard({
    ...relationship,
    source: byId.get(relationship.source)!,
    target: byId.get(relationship.target)!,
  }, onSelect))
  if (relationship.origin === 'draft' && writes.onAccept !== undefined) paintAcceptControl(body, writes.onAccept)
  if (relationship.origin === 'draft' && writes.onRemove !== undefined) paintRemoveControl(body, relationship.description, writes.onRemove)
}

/** Empties the pane while nothing is selected. */
export function clearDetails(host: HTMLElement): void {
  for (const part of ['h1', '.meta', '.tabs', '.body']) host.querySelector(part)!.replaceChildren()
}

function elementFields(inspected: Inspected, options: PaneWrites): EditField[] {
  const fields: EditField[] = [
    { name: 'title', label: 'Title', value: inspected.title, required: true },
    { name: 'description', label: 'Description', value: inspected.description },
    { name: 'overview', label: 'Overview', value: inspected.overview, multiline: true },
    { name: 'technology', label: 'Technology', value: inspected.technology.join(', ') },
  ]
  if (inspected.movable) fields.push({
    name: 'parent', label: 'Parent', value: inspected.parent ?? '', options: options.parents ?? [],
  })
  return fields
}
