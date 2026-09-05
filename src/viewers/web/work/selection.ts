/**
 * Selects a clicked task without dropping an existing highlight; clicking the
 * selected task again deactivates it and falls back to the latest remaining one.
 */
export function toggleWorkSelection(
  active: readonly string[],
  selected: string | undefined,
  clicked: string,
): { active: string[]; selected: string | undefined } {
  if (selected !== clicked) {
    return openWorkSelection(active, clicked)
  }
  const remaining = active.filter(id => id !== clicked)
  return { active: remaining, selected: remaining.at(-1) }
}
/** Opening a search result always selects it, even if that task is already open. */
export function openWorkSelection(
  active: readonly string[],
  id: string,
): { active: string[]; selected: string } {
  return { active: active.includes(id) ? [...active] : [...active, id], selected: id }
}
