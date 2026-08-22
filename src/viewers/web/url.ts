import type { ArchitectureWorld, C4Kind, WorldElement, WorldRelationship } from '../../types.ts'
import type { ActiveAction, DetailsTab } from './organisms/details.ts'

/** What the page's query string carries, so a view opens again from its link. */
export interface ViewState {
  /** The selected element's or relationship's id. */
  selectedId: string | undefined
  action: ActiveAction
  tab: DetailsTab
  dark: boolean
}

/** A selected element is named by its kind: `person=<id>`, `system=<id>`, `container=<id>` or `component=<id>`. */
const KINDS: C4Kind[] = ['person', 'system', 'container', 'component']

/**
 * Reads the selection (`<kind>=<id>` or `relationship=<source id>/<target id>`),
 * the lit command (`flow=<source id>/<target id>` with `by=<person id>`),
 * `tab=how` and `theme=dark`. Ids are the authored ids; anything the world
 * does not know is ignored, a kind naming an element of another kind included.
 */
export function readView(search: string, world: ArchitectureWorld): ViewState {
  const params = new URLSearchParams(search)
  const byId = new Map(world.elements.map(element => [element.id, element]))
  const named = (name: string): WorldElement | undefined => byId.get(params.get(name) ?? '')
  const pair = (name: string): WorldRelationship | undefined => {
    const [from, to] = (params.get(name) ?? '').split('/')
    const source = byId.get(from ?? '')?.representationId
    const target = byId.get(to ?? '')?.representationId
    return world.relationships.find(item => item.source === source && item.target === target)
  }
  const element = KINDS.map(named).find((item, index) => item?.kind === KINDS[index])
  const flow = pair('flow')
  return {
    selectedId: element?.representationId ?? pair('relationship')?.id,
    action: flow === undefined ? {} : { id: flow.id, personId: named('by')?.representationId },
    tab: params.get('tab') === 'how' ? 'how' : 'what',
    dark: params.get('theme') === 'dark',
  }
}

/** The query string for a view, empty when everything is at its default. */
export function writeView(state: ViewState, world: ArchitectureWorld): string {
  const elements = new Map(world.elements.map(element => [element.representationId, element]))
  const ends = (relationshipId: string | undefined): string | undefined => {
    const relationship = world.relationships.find(item => item.id === relationshipId)
    const source = elements.get(relationship?.source ?? '')
    const target = elements.get(relationship?.target ?? '')
    return source === undefined || target === undefined ? undefined : `${source.id}/${target.id}`
  }
  const pairs: [string, string][] = []
  const element = elements.get(state.selectedId ?? '')
  const relationship = ends(state.selectedId)
  if (element !== undefined) pairs.push([element.kind, element.id])
  if (relationship !== undefined) pairs.push(['relationship', relationship])
  const flow = ends(state.action.id)
  if (flow !== undefined) {
    pairs.push(['flow', flow])
    const by = elements.get(state.action.personId ?? '')
    if (by !== undefined) pairs.push(['by', by.id])
  }
  if (state.tab === 'how') pairs.push(['tab', 'how'])
  if (state.dark) pairs.push(['theme', 'dark'])
  return pairs.length === 0 ? '' : `?${pairs.map(([key, value]) => `${key}=${value}`).join('&')}`
}
