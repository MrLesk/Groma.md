import type { ArchitectureWorld, C4Kind, WorkItem, WorldRelationship } from '../../types.ts'
import type { FlowRef } from '../action-path.ts'
import type { DetailsTab } from './organisms/details.ts'
import { noSelection, selectFlow, selectTask } from './selection.ts'
import type { Selection } from './selection.ts'

/** What the page's query string carries, so a view opens again from its link. */
export interface ViewState {
  selection: Selection
  flows: readonly FlowRef[]
  tab: DetailsTab
  dark: boolean
}

/** A selected element is named by its kind: `actor=<id>`, `system=<id>`, `container=<id>` or `component=<id>`. */
const KINDS: C4Kind[] = ['actor', 'system', 'container', 'component']

/**
 * Reads the ordered architecture selection (repeated `<kind>=<id>` and
 * `relationship=<source id>/<target id>` entries) or `task=<id>`,
 * repeated active flows (`flow=<source>/<target>` or `flow=<actor>/<source>/<target>`),
 * `tab=how` and `theme=dark`. Ids are the authored ids; anything the world
 * or the work does not know is ignored, a kind naming an element of another kind included.
 */
export function readView(search: string, world: ArchitectureWorld, work: readonly WorkItem[]): ViewState {
  const params = new URLSearchParams(search)
  const byId = new Map(world.elements.map(element => [element.id, element]))
  const relationship = (value: string): WorldRelationship | undefined => {
    const [from, to] = value.split('/')
    const source = byId.get(from ?? '')?.representationId
    const target = byId.get(to ?? '')?.representationId
    return world.relationships.find(item => item.source === source && item.target === target)
  }
  const flowFrom = (value: string): FlowRef | undefined => {
    const parts = value.split('/')
    if (parts.length !== 2 && parts.length !== 3) return undefined
    const command = relationship(parts.slice(-2).join('/'))
    const actor = parts.length === 3 ? byId.get(parts[0]!) : undefined
    if (command === undefined || (parts.length === 3 && actor?.kind !== 'actor')) return undefined
    return {
      commandId: command.id,
      ...(actor === undefined ? {} : { actorId: actor.representationId }),
    }
  }
  const architecture: string[] = []
  for (const [name, value] of params) {
    const element = byId.get(value)
    const id = KINDS.includes(name as C4Kind) && element?.kind === name
      ? element.representationId
      : name === 'relationship' ? relationship(value)?.id : undefined
    if (id !== undefined && !architecture.includes(id)) architecture.push(id)
  }
  const task = work.find(item => item.id === params.get('task'))
  const flows: FlowRef[] = []
  for (const value of params.getAll('flow')) {
    const flow = flowFrom(value)
    if (flow === undefined) continue
    if (!flows.some(item => item.commandId === flow.commandId)) flows.push(flow)
  }
  const requested = flowFrom(params.get('selected-flow') ?? '')
  const selected = requested === undefined
    ? flows.at(-1)
    : flows.find(flow => flow.commandId === requested.commandId && flow.actorId === requested.actorId)
  return {
    selection: architecture.length > 0
      ? { kind: 'architecture', ids: architecture }
      : task !== undefined ? selectTask(task.id)
      : selected === undefined ? noSelection : selectFlow(selected),
    flows,
    tab: params.get('tab') === 'how' ? 'how' : 'what',
    dark: params.get('theme') === 'dark',
  }
}

/** The query string for a view, empty when everything is at its default. */
export function writeView(state: ViewState, world: ArchitectureWorld, work: readonly WorkItem[]): string {
  const elements = new Map(world.elements.map(element => [element.representationId, element]))
  const ends = (relationshipId: string | undefined): string | undefined => {
    const relationship = world.relationships.find(item => item.id === relationshipId)
    const source = elements.get(relationship?.source ?? '')
    const target = elements.get(relationship?.target ?? '')
    return source === undefined || target === undefined ? undefined : `${source.id}/${target.id}`
  }
  const pairs: [string, string][] = []
  const flowValue = (flow: FlowRef): string | undefined => {
    const route = ends(flow.commandId)
    if (route === undefined) return undefined
    const actor = elements.get(flow.actorId ?? '')
    return actor?.kind === 'actor' ? `${actor.id}/${route}` : route
  }
  if (state.selection.kind === 'architecture') {
    for (const id of state.selection.ids) {
      const element = elements.get(id)
      const relationship = ends(id)
      if (element !== undefined) pairs.push([element.kind, element.id])
      else if (relationship !== undefined) pairs.push(['relationship', relationship])
    }
  } else if (state.selection.kind === 'task') {
    const taskId = state.selection.id
    const task = work.find(item => item.id === taskId)
    if (task !== undefined) pairs.push(['task', task.id])
  }
  for (const active of state.flows) {
    const value = flowValue(active)
    if (value !== undefined) pairs.push(['flow', value])
  }
  const latest = state.flows.at(-1)
  if (state.selection.kind === 'flow' && (
    latest?.commandId !== state.selection.flow.commandId
    || latest.actorId !== state.selection.flow.actorId
  )) {
    const value = flowValue(state.selection.flow)
    if (value !== undefined) pairs.push(['selected-flow', value])
  }
  if (state.tab === 'how') pairs.push(['tab', 'how'])
  if (state.dark) pairs.push(['theme', 'dark'])
  return pairs.length === 0 ? '' : `?${pairs.map(([key, value]) => `${key}=${value}`).join('&')}`
}
