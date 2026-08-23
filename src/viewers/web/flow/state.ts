import type { FlowRef } from '../../action-path.ts'

export function sameFlow(left: FlowRef | undefined, right: FlowRef): boolean {
  return left?.commandId === right.commandId && left.actorId === right.actorId
}

/** Selects without dropping another highlight; clicking the selected flow deactivates it. */
export function toggleFlowSelection(
  active: readonly FlowRef[],
  selected: FlowRef | undefined,
  clicked: FlowRef,
): { active: FlowRef[]; selected: FlowRef | undefined } {
  if (!sameFlow(selected, clicked)) {
    const existing = active.findIndex(flow => flow.commandId === clicked.commandId)
    return {
      active: existing < 0
        ? [...active, clicked]
        : active.map((flow, index) => index === existing ? clicked : flow),
      selected: clicked,
    }
  }
  const remaining = active.filter(flow => flow.commandId !== clicked.commandId)
  return { active: remaining, selected: remaining.at(-1) }
}
