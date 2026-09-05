import type { FlowRef } from '../../flows.ts'

/** Opening another scenario replaces the focused flow. Opening it again clears it. */
export function toggleFlowActivation(active: FlowRef | undefined, clicked: FlowRef): FlowRef | undefined {
  return active?.id === clicked.id ? undefined : clicked
}
