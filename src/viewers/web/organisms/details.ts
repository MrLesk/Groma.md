import type {
  AnnotatedElement,
  ArchitectureFinding,
  ArchitectureGraph,
  C4Kind,
  CodeReference,
  Origin,
} from '../../../types.ts'
import type { Comparison, ComponentChange } from '../../../history/comparison.ts'
import { changeBadge, comparisonOverview, comparisonTechnology, comparisonFiles } from '../comparison/details.ts'
import type { ElementWorkGroup } from '../../../work/pins.ts'
import type { Zone } from '../../../sheet/types.ts'
import { findingsForOwner } from '../../../architecture-findings.ts'
import { removalBlocker } from '../../../removable.ts'
import { flowsThrough } from '../../flows.ts'
import type { FlowRef } from '../../flows.ts'
import { kindGlyph, kindLabel } from '../../atoms/kind.ts'
import type { FlowRowData } from '../flow/row.ts'
import { createFlowList } from '../flow/list.ts'
import type { CodeFile } from '../../source/structure.ts'
import { paintElementWork } from '../work/component-tasks.ts'
import { codeList } from './code-lists.ts'
import { heading, paragraph } from '../atoms/text.ts'
import { editButton, isEditing, type EditField } from './editable.ts'
import type { PaneWrites } from './writes.ts'
import {
  paintAcceptControl,
  paintSelectionControls,
} from './writes.ts'
import { paintRemoveControl } from './remove.ts'
import { relationshipCard, relationshipPairCard, type RelationshipPairData } from './relationship-card.ts'
import {
  parentOfElements,
  relationshipPairs,
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
  relationships: RelationshipPairData[]
  flows: FlowRowData[]
  children: InspectedChild[]
  technology: string[]
  files: CodeReference[]
  findings: ArchitectureFinding[]
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

/** The pane's split: meaning on one tab, build evidence on the other. */
export function tabSections(tab: Exclude<DetailsTab, 'tasks'>): Section[] {
  return tab === 'what'
    ? ['overview', 'relationships', 'flows', 'children']
    : ['technology', 'code']
}

export function detailsTabs(
  inspected: Pick<Inspected, 'technology' | 'files'>,
  workGroups: readonly { items: readonly unknown[] }[],
  comparison?: ComponentChange,
): DetailsTab[] {
  const hasBuild = inspected.technology.length > 0 || inspected.files.length > 0
    || (comparison?.files.length ?? 0) > 0 || Boolean(comparison?.before?.technology)
  return [
    'what',
    ...(hasBuild ? ['how' as const] : []),
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
  const pairs = relationshipPairs(world.relationships, element.representationId, parentOfElements(world.elements))
  const relationships = pairs.map((pair): RelationshipPairData => {
    const peer = byId.get(pair.peerId)!
    return {
      source: pair.outgoing ? element : peer,
      target: pair.outgoing ? peer : element,
      relationships: pair.relationships.map(relationship => ({
        id: relationship.id,
        description: relationship.description,
        source: byId.get(relationship.source)!,
        target: byId.get(relationship.target)!,
      })),
    }
  })
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
    findings: findingsForOwner(world.findings ?? [], element.id),
    removable: removalBlocker(world, element.id) === undefined,
    matchedGhost: isMatchedGhost(element),
    movable: element.movable === true,
    parent: element.parent,
  }
}

/** Inspect either a stored architecture element or the derived placement group. */
export function inspectSelection(id: string | undefined, world: ArchitectureGraph, zones: readonly Zone[]): Inspected | undefined {
  const element = world.elements.find(item => item.representationId === id)
  if (element !== undefined) return inspectDetails(element, world)
  const group = zones.find(zone => zone.unidentifiedContainer && zone.key === id)
  return group === undefined ? undefined : inspectUnidentifiedContainer(group, world)
}

/** A display group explains missing placement without exposing architecture writes. */
export function inspectUnidentifiedContainer(zone: Zone, world: ArchitectureGraph): Inspected {
  const members = new Set(zone.members)
  return {
    id: zone.key, title: zone.name, description: '', kindLabel: 'Placement group', origin: 'observed',
    overview: 'Groma.md could not determine which container these components belong to. This group keeps them visible within their system; it does not represent an application or data store.',
    children: world.elements.filter(element => members.has(element.representationId)).map(element => ({
      id: element.representationId, title: element.title, kind: element.kind, external: element.external,
    })),
    relationships: [], flows: [], technology: [], files: [], findings: [],
    removable: false, matchedGhost: false, movable: false, parent: zone.parent,
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
  comparison?: Comparison
  onSelect: (id: string, additive: boolean) => void,
  onToggleFlow: (flow: FlowRef) => void,
  activeFlows: readonly FlowRef[]
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

/** Key of the only unfolded combined pair; module state so it survives details repaints (same pattern as `expandedCopiesKey`). */
let openPair: string | undefined

function paintRelationshipPairs(list: HTMLElement, inspected: Inspected, onSelect: DetailsOptions['onSelect'], comparison?: Comparison): void {
  list.replaceChildren()
  for (const pair of inspected.relationships) {
    if (comparison !== undefined) {
      paintComparedRelationships(list, pair, inspected.id, onSelect, comparison)
      continue
    }
    const key = [inspected.id, pair.source.representationId, pair.target.representationId].join('\0')
    const item = document.createElement('li')
    item.append(relationshipPairCard(pair, onSelect, inspected.id, key === openPair, () => {
      openPair = key === openPair ? undefined : key
      paintRelationshipPairs(list, inspected, onSelect)
    }))
    list.append(item)
  }
}

function paintComparedRelationships(list: HTMLElement, pair: RelationshipPairData, id: string, onSelect: DetailsOptions['onSelect'], comparison: Comparison): void {
  for (const relationship of pair.relationships) {
    const row = document.createElement('li')
    const card = relationshipCard(relationship, onSelect, id)
    const status = comparison.relationships[relationship.id]
    if (status !== undefined && status !== 'unchanged') card.querySelector('.relationship-action')!.append(changeBadge(status))
    row.append(card)
    list.append(row)
  }
}

export function paintDetails(host: HTMLElement, inspected: Inspected, options: DetailsOptions): void {
  const { onSelect, onToggleFlow, activeFlows, tab, onTab, code, onSource, workGroups, onTask, onEdit, selection } = options
  if (onEdit !== undefined && isEditing(host, inspected.id)) return
  const title = host.querySelector('h1')!
  const meta = host.querySelector('.meta')!
  const tabsHost = host.querySelector<HTMLElement>('.tabs')!
  const body = host.querySelector('.body')!
  title.replaceChildren()
  title.textContent = inspected.title
  meta.textContent = `${inspected.kindLabel} · ${inspected.origin}`

  const change = options.comparison?.components[inspected.id]
  if (change !== undefined) meta.append(changeBadge(change.status))
  const availableTabs = detailsTabs(inspected, workGroups, change)
  const shownTab = availableTabs.includes(tab) ? tab : 'what'
  paintTabs(tabsHost, availableTabs, shownTab, onTab)

  body.replaceChildren()
  const sections: Record<Section, () => void> = {
    overview: () => {
      if (change !== undefined) { comparisonOverview(body, change, options.world); return }
      if (inspected.description !== '') body.append(paragraph('description', inspected.description))
      if (inspected.overview !== '') body.append(paragraph('overview', inspected.overview))
    },

    relationships: () => {
      if (inspected.relationships.length === 0) return
      const list = document.createElement('ul')
      list.className = 'relationships'
      body.append(heading('Relationships'), list)
      paintRelationshipPairs(list, inspected, onSelect, options.comparison)
    },

    flows: () => {
      if (inspected.flows.length === 0) return
      const list = document.createElement('div')
      paintDetailFlows(list, options.world, activeFlows, onToggleFlow, {
        title: inspected.kindLabel === 'Actor' ? 'Flows from this actor' : `Flows through this ${inspected.kindLabel.toLowerCase()}`,
        visibleFlows: inspected.flows,
        contextId: inspected.id,
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
      if (change !== undefined) { comparisonTechnology(body, change); return }
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
      if (change !== undefined) { comparisonFiles(body, change, onSource); return }
      if (inspected.files.length === 0 && code.length === 0) return
      body.append(heading('Code'), codeList(inspected.files, code, inspected.findings, inspected.id, onSource))
    },

  }
  if (shownTab === 'what' && selection !== undefined) paintSelectionControls(body, selection)
  if (shownTab === 'tasks') paintElementWork(body, workGroups, onTask)
  else for (const key of tabSections(shownTab)) sections[key]()
  paintEditingControls(host, body, inspected, options, shownTab)
}

function paintEditingControls(host: HTMLElement, body: Element, inspected: Inspected, options: DetailsOptions, tab: DetailsTab): void {
  const { onAccept, onEdit, onRead, onRemove } = options
  if (tab === 'what' && inspected.matchedGhost && onAccept !== undefined) paintAcceptControl(body, onAccept)
  if (onEdit !== undefined && onRead !== undefined) body.prepend(editButton(host, inspected.id, elementFields(inspected, options), onEdit, onRead))
  if (tab === 'what' && inspected.removable && onRemove !== undefined) paintRemoveControl(body, inspected.title, onRemove)
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
