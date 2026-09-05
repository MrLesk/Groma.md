import type { ArchitectureGraph } from '../../../types.ts'
import type { FlowRef } from '../../flows.ts'

/** Return context belongs to this browser visit, not the authored flow or its URL. */
export interface WebFlowRef extends FlowRef {
  returnTo?: string
}

/** Opening another scenario replaces the focused flow. Opening it again clears it. */
export function toggleFlowActivation(active: WebFlowRef | undefined, clicked: FlowRef, returnTo?: string): WebFlowRef | undefined {
  return active?.id === clicked.id ? undefined : { ...clicked, returnTo }
}

/** Step focus adds emphasis without narrowing the authored path. */
export function flowHighlight(active: FlowRef | undefined, world: ArchitectureGraph) {
  const flow = world.flows.find(flow => flow.id === active?.id)
  return {
    routes: new Set(flow?.steps.map(step => step.relationshipId) ?? []),
    focusedRoute: active?.step === undefined ? undefined : flow?.steps[active.step]?.relationshipId,
  }
}
