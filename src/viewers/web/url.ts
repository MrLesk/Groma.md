import type { GitRevision } from '../../history/revisions.ts'
import type { AnnotatedElement, AnnotatedRelationship, ArchitectureGraph, C4Kind, WorkItem } from '../../types.ts'
import type { FlowRef } from '../flows.ts'
import { isThemeMode, type WebThemeMode } from './atoms/theme.ts'
import type { DetailsTab } from './organisms/details.ts'
import { noSelection, selectTask } from './selection.ts'
import type { Selection } from './selection.ts'

/** What the page's query string carries, so a view opens again from its link. */
export interface ViewState {
  revision?: string
  file?: string
  line?: number
  selection: Selection
  flows: FlowRef[]
  tab: DetailsTab
  theme: WebThemeMode
  hudVisible: boolean
}

/** A selected element is named by its kind: `actor=<id>`, `system=<id>`, `container=<id>` or `component=<id>`. */
const KINDS: C4Kind[] = ['actor', 'system', 'container', 'component']

function relationshipFor(
  value: string,
  byId: ReadonlyMap<string, AnnotatedElement>,
  world: ArchitectureGraph,
): AnnotatedRelationship | undefined {
  const [from, to] = value.split('/')
  const source = byId.get(from ?? '')?.representationId
  const target = byId.get(to ?? '')?.representationId
  return world.relationships.find(item => item.source === source && item.target === target)
}

function architectureId(
  name: string,
  value: string,
  byId: ReadonlyMap<string, AnnotatedElement>,
  world: ArchitectureGraph,
): string | undefined {
  const element = byId.get(value)
  if (KINDS.includes(name as C4Kind) && element?.kind === name) return element.representationId
  return name === 'relationship' ? relationshipFor(value, byId, world)?.id : undefined
}

function architectureSelection(
  params: URLSearchParams,
  byId: ReadonlyMap<string, AnnotatedElement>,
  world: ArchitectureGraph,
): string[] {
  const ids: string[] = []
  for (const [name, value] of params) {
    const id = architectureId(name, value, byId, world)
    if (id !== undefined && !ids.includes(id)) ids.push(id)
  }
  return ids
}

function activeFlows(params: URLSearchParams, world: ArchitectureGraph): FlowRef[] {
  const flows: FlowRef[] = [...new Set(params.getAll('flow'))]
    .filter(id => world.flows.some(item => item.id === id)).map(id => ({ id }))
  const active = flows.at(-1)
  const flow = world.flows.find(item => item.id === active?.id)
  if (flow === undefined || active === undefined) return flows
  const requested = Number(params.get('step'))
  const step = Number.isInteger(requested) && requested >= 1 && requested <= flow.steps.length ? requested - 1 : undefined
  if (step !== undefined) active.step = step
  return flows
}

function sourceState(
  params: URLSearchParams,
  selected: AnnotatedElement | undefined,
): Pick<ViewState, 'file' | 'line'> {
  if (selected?.kind !== 'component') return {}
  const requestedFile = params.get('file')
  const file = selected.code.find(reference => reference.file === requestedFile)?.file
  if (file === undefined) return {}
  const requestedLine = Number(params.get('line'))
  return Number.isInteger(requestedLine) && requestedLine > 0
    ? { file, line: requestedLine }
    : { file }
}

function appendSourceState(
  pairs: [string, string][],
  state: ViewState,
  selected: AnnotatedElement | undefined,
): void {
  if (state.file === undefined || selected?.kind !== 'component') return
  const file = selected.code.find(reference => reference.file === state.file)?.file
  if (file === undefined) return
  pairs.push(['file', file])
  if (state.line !== undefined) pairs.push(['line', String(state.line)])
}

/**
 * Reads the ordered architecture selection (repeated `<kind>=<id>` and
 * `relationship=<source id>/<target id>` entries) or `task=<id>`,
 * checked flows (repeated `flow=<id>`) and the last flow's one-based `step=<number>`,
 * `tab=how|tasks`, `theme=light|dark|blueprint` and `hud=off`. Ids are the authored ids; anything the world
 * or the work does not know is ignored, a kind naming an element of another kind included.
 */
export function readView(
  search: string,
  world: ArchitectureGraph,
  work: readonly WorkItem[],
  revisions: readonly GitRevision[] = [],
  defaultTheme: WebThemeMode = 'auto',
): ViewState {
  const params = new URLSearchParams(search)
  const revision = revisions.find(candidate => candidate.id === params.get('revision'))?.id
  const selectedTheme = params.get('theme')
  const byId = new Map(world.elements.map(element => [element.id, element]))
  const architecture = architectureSelection(params, byId, world)
  const task = work.find(item => item.id === params.get('task'))
  const flows = activeFlows(params, world)
  const flow = flows.at(-1)
  const selection: Selection = architecture.length > 0
    ? { kind: 'architecture', ids: architecture }
    : task !== undefined ? selectTask(task.id)
    : flow !== undefined ? { kind: 'flow', id: flow.id } : noSelection
  const selected = selection.kind === 'architecture'
    ? world.elements.find(element => element.representationId === selection.ids.at(-1))
    : undefined
  const source = sourceState(params, selected)
  return {
    ...(revision === undefined ? {} : { revision }),
    ...source,
    selection,
    flows,
    tab: source.file !== undefined || params.get('tab') === 'how'
      ? 'how'
      : params.get('tab') === 'tasks' ? 'tasks' : 'what',
    theme: isThemeMode(selectedTheme) ? selectedTheme : defaultTheme,
    hudVisible: params.get('hud') !== 'off',
  }
}

function relationshipEnds(
  relationshipId: string | undefined,
  elements: ReadonlyMap<string, AnnotatedElement>,
  world: ArchitectureGraph,
): string | undefined {
  const relationship = world.relationships.find(item => item.id === relationshipId)
  const source = elements.get(relationship?.source ?? '')
  const target = elements.get(relationship?.target ?? '')
  return source === undefined || target === undefined ? undefined : `${source.id}/${target.id}`
}

function appendSelection(
  pairs: [string, string][],
  state: ViewState,
  elements: ReadonlyMap<string, AnnotatedElement>,
  world: ArchitectureGraph,
  work: readonly WorkItem[],
): void {
  if (state.selection.kind === 'architecture') {
    for (const id of state.selection.ids) {
      const element = elements.get(id)
      const relationship = relationshipEnds(id, elements, world)
      if (element !== undefined) pairs.push([element.kind, element.id])
      else if (relationship !== undefined) pairs.push(['relationship', relationship])
    }
    return
  }
  if (state.selection.kind !== 'task') return
  const taskId = state.selection.id
  const task = work.find(item => item.id === taskId)
  if (task !== undefined) pairs.push(['task', task.id])
}

function appendFlow(pairs: [string, string][], flow: FlowRef | undefined, world: ArchitectureGraph): void {
  const record = world.flows.find(item => item.id === flow?.id)
  if (record === undefined) return
  pairs.push(['flow', record.id])
  if (flow?.step !== undefined && record.steps[flow.step] !== undefined) pairs.push(['step', String(flow.step + 1)])
}

/** The query string for a view, empty when everything is at its default. */
export function writeView(state: ViewState, world: ArchitectureGraph, work: readonly WorkItem[]): string {
  const elements = new Map(world.elements.map(element => [element.representationId, element]))
  const selected = state.selection.kind === 'architecture'
    ? elements.get(state.selection.ids.at(-1) ?? '')
    : undefined
  const pairs: [string, string][] = []
  if (state.revision !== undefined) pairs.push(['revision', state.revision])
  appendSelection(pairs, state, elements, world, work)
  if (state.selection.kind === 'architecture' && state.tab !== 'what') pairs.push(['tab', state.tab])
  appendSourceState(pairs, state, selected)
  for (const flow of state.flows) {
    appendFlow(pairs, flow === state.flows.at(-1) ? flow : { id: flow.id }, world)
  }
  if (state.theme !== 'auto') pairs.push(['theme', state.theme])
  if (!state.hudVisible) pairs.push(['hud', 'off'])
  return pairs.length === 0 ? '' : `?${pairs.map(([key, value]) => `${key}=${value}`).join('&')}`
}
