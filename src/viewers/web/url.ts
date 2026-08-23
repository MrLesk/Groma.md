import type { ArchitectureWorld, C4Kind, WorkItem, WorldElement, WorldRelationship } from '../../types.ts'
import type { ActiveAction, DetailsTab } from './organisms/details.ts'
import { noSelection, selectTask } from './selection.ts'
import type { Selection } from './selection.ts'

/** What the page's query string carries, so a view opens again from its link. */
export interface ViewState {
  selection: Selection
  action: ActiveAction
  tab: DetailsTab
  dark: boolean
}

/** A selected element is named by its kind: `actor=<id>`, `system=<id>`, `container=<id>` or `component=<id>`. */
const KINDS: C4Kind[] = ['actor', 'system', 'container', 'component']

/**
 * Reads the ordered architecture selection (repeated `<kind>=<id>` and
 * `relationship=<source id>/<target id>` entries) or `task=<id>`,
 * the lit command (`flow=<source id>/<target id>` with `by=<actor id>`),
 * `tab=how` and `theme=dark`. Ids are the authored ids; anything the world
 * or the work does not know is ignored, a kind naming an element of another kind included.
 */
export function readView(search: string, world: ArchitectureWorld, work: readonly WorkItem[]): ViewState {
  const params = new URLSearchParams(search)
  const byId = new Map(world.elements.map(element => [element.id, element]))
  const named = (name: string): WorldElement | undefined => byId.get(params.get(name) ?? '')
  const relationship = (value: string): WorldRelationship | undefined => {
    const [from, to] = value.split('/')
    const source = byId.get(from ?? '')?.representationId
    const target = byId.get(to ?? '')?.representationId
    return world.relationships.find(item => item.source === source && item.target === target)
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
  const flow = relationship(params.get('flow') ?? '')
  const actor = named('by')
  return {
    selection: architecture.length > 0
      ? { kind: 'architecture', ids: architecture }
      : task === undefined ? noSelection : selectTask(task.id),
    action: flow === undefined ? {} : { id: flow.id, actorId: actor?.kind === 'actor' ? actor.representationId : undefined },
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
  const flow = ends(state.action.id)
  if (flow !== undefined) {
    pairs.push(['flow', flow])
    const by = elements.get(state.action.actorId ?? '')
    if (by?.kind === 'actor') pairs.push(['by', by.id])
  }
  if (state.tab === 'how') pairs.push(['tab', 'how'])
  if (state.dark) pairs.push(['theme', 'dark'])
  return pairs.length === 0 ? '' : `?${pairs.map(([key, value]) => `${key}=${value}`).join('&')}`
}
