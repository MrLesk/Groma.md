import type { ArchitectureGraph } from '../../../types.ts'
import type { FlowRef } from '../../flows.ts'
import type { Selection } from '../selection.ts'

/** Return context belongs to this browser visit, not the authored flow or its URL. */
export interface WebFlowRef extends FlowRef {
  returnTo?: string
}

export function flowSelection(active: readonly FlowRef[]): Selection {
  const flow = active.at(-1)
  return flow === undefined ? { kind: 'none' } : { kind: 'flow', id: flow.id }
}

export type FlowReturn = 'origin' | 'flow'

/** A file reader owns the pane's Back; flow return waits until that file is closed. */
export function flowReturn(
  active: WebFlowRef | undefined,
  readingFlow: boolean,
  fileOpen: boolean,
): FlowReturn | undefined {
  if (fileOpen || active === undefined) return undefined
  if (readingFlow) return active.returnTo === undefined ? undefined : 'origin'
  return 'flow'
}

/** Checked scenarios stay active in order; the last one owns the reader. */
export function toggleFlowActivation(active: readonly WebFlowRef[], clicked: FlowRef, returnTo?: string): WebFlowRef[] {
  return active.some(flow => flow.id === clicked.id)
    ? active.filter(flow => flow.id !== clicked.id)
    : [...active, { ...clicked, returnTo }]
}

export function retainFlows(active: readonly WebFlowRef[], world: ArchitectureGraph): WebFlowRef[] {
  return active.flatMap(flow => {
    const record = world.flows.find(item => item.id === flow.id)
    if (record === undefined) return []
    return [{ ...flow, step: flow.step !== undefined && record.steps[flow.step] !== undefined ? flow.step : undefined }]
  })
}

/** Step focus adds emphasis without narrowing the authored path. */
export function flowHighlight(active: readonly FlowRef[], world: ArchitectureGraph) {
  const ids = new Set(active.map(flow => flow.id))
  const focused = active.at(-1)
  const flow = world.flows.find(flow => flow.id === focused?.id)
  return {
    routes: new Set(world.flows.filter(flow => ids.has(flow.id)).flatMap(flow => flow.steps.map(step => step.relationshipId))),
    focusedRoute: focused?.step === undefined ? undefined : flow?.steps[focused.step]?.relationshipId,
  }
}

/** A step frames its exact collaboration; clearing focus restores every checked flow. */
export function flowFocus(active: readonly FlowRef[], world: ArchitectureGraph): string[] {
  const { routes, focusedRoute } = flowHighlight(active, world)
  return focusedRoute === undefined ? [...routes] : [focusedRoute]
}
