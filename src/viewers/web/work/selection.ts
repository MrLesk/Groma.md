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
    return { active: active.includes(clicked) ? [...active] : [...active, clicked], selected: clicked }
  }
  const remaining = active.filter(id => id !== clicked)
  return { active: remaining, selected: remaining.at(-1) }
}
