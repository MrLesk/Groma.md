import type { ArchitectureFlow } from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import type { ViewerAction, ViewerState } from './navigation.ts'
import { levelFor } from './navigation-spatial.ts'

/** Flow reading is separate from endpoint inspection; returning keeps the same step. */
export function reduceFlowReading(world: TerminalViewModel, state: ViewerState, action: ViewerAction): ViewerState | undefined {
  const flow = world.flows.find(flow => flow.id === state.activeActionId)
  if (flow === undefined || state.work !== undefined) return undefined
  if (action === 'dismiss' && !state.flowReading) {
    return { ...state, flowReading: true, focus: 'details', detailsScroll: 0 }
  }
  if (!state.flowReading || state.focus !== 'details') return undefined
  if (action === 'up' || action === 'down') {
    return moveStep(state, flow.steps.length, action === 'down' ? 1 : -1)
  }
  if (action === 'dismiss') return { ...state, flowReading: false, focus: 'architecture' }
  if (action !== 'enter' && action !== 'left') return undefined
  return inspectEndpoint(world, state, flow, action === 'left')
}

function moveStep(state: ViewerState, count: number, direction: number): ViewerState {
  const next = (state.actionStep ?? -1) + direction
  return { ...state, actionStep: next < 0 ? undefined : Math.min(next, count - 1), detailsScroll: 0 }
}

function inspectEndpoint(world: TerminalViewModel, state: ViewerState, flow: ArchitectureFlow, from: boolean): ViewerState {
  const step = flow.steps[state.actionStep ?? 0]!
  const id = from ? step.source : step.target
  const endpoint = world.elements.find(element => element.representationId === id)!
  return {
    ...state, currentId: id, level: levelFor(endpoint), flowReading: false,
    actionStep: state.actionStep ?? 0, detailsTab: 'what', detailsScroll: 0,
    actionCursor: undefined, tree: { ...state.tree, cursor: id },
  }
}
