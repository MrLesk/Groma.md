import type { FlowRef } from '../../action-path.ts'

export function sameFlow(left: FlowRef | undefined, right: FlowRef): boolean {
  return left?.commandId === right.commandId && left.actorId === right.actorId
}

function activateFlow(active: readonly FlowRef[], clicked: FlowRef): FlowRef[] {
  const existing = active.findIndex(flow => flow.commandId === clicked.commandId)
  if (existing < 0) return [...active, clicked]
  return active.map((flow, index) => index === existing ? clicked : flow)
}

/** Toggles a map path without assigning ownership of the details pane. */
export function toggleFlowActivation(
  active: readonly FlowRef[],
  clicked: FlowRef,
): FlowRef[] {
  const current = active.find(flow => flow.commandId === clicked.commandId)
  return sameFlow(current, clicked)
    ? active.filter(flow => flow.commandId !== clicked.commandId)
    : activateFlow(active, clicked)
}

/** Selects without dropping another highlight; clicking the selected flow deactivates it. */
export function toggleFlowSelection(
  active: readonly FlowRef[],
  selected: FlowRef | undefined,
  clicked: FlowRef,
): { active: FlowRef[]; selected: FlowRef | undefined } {
  if (!sameFlow(selected, clicked)) {
    return {
      active: activateFlow(active, clicked),
      selected: clicked,
    }
  }
  const remaining = active.filter(flow => flow.commandId !== clicked.commandId)
  return { active: remaining, selected: remaining.at(-1) }
}
