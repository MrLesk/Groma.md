/** The status filters the Live work island renders and currently enables. */
export interface WorkStatusFilterState {
  available: string[]
  enabled: string[]
}

/**
 * Reconciles the island's filters with a work snapshot. Only statuses with a
 * mapped pin are rendered. The first snapshot enables every configured status
 * except the default and final ones; later snapshots preserve that choice.
 */
export function workStatusFilters(
  configured: readonly string[],
  defaultStatus: string,
  pinStatuses: readonly string[],
  enabled?: readonly string[],
): WorkStatusFilterState {
  const present = new Set(pinStatuses)
  return {
    available: configured.filter(status => present.has(status)),
    enabled: [...(enabled ?? configured.filter(status => status !== defaultStatus && status !== configured.at(-1)))],
  }
}

/** Returns the same filter state with one status enabled or disabled. */
export function toggleWorkStatus(state: WorkStatusFilterState, status: string): WorkStatusFilterState {
  return {
    ...state,
    enabled: state.enabled.includes(status)
      ? state.enabled.filter(item => item !== status)
      : [...state.enabled, status],
  }
}
