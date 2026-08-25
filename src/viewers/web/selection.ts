export type Selection =
  | { kind: 'none' }
  | { kind: 'architecture'; ids: readonly string[] }
  | { kind: 'task'; id: string }

export const noSelection: Selection = { kind: 'none' }

export function primarySelection(selection: Selection): string | undefined {
  if (selection.kind === 'task') return selection.id
  return selection.kind === 'architecture' ? selection.ids.at(-1) : undefined
}

export function selectedArchitecture(selection: Selection): readonly string[] {
  return selection.kind === 'architecture' ? selection.ids : []
}

/** Every concrete selection owns the inspector; the empty selection removes it from the shell. */
export function ownsDetails(selection: Selection): boolean {
  return selection.kind !== 'none'
}

/** A plain pick replaces the architecture selection; an additive pick toggles one target in its ordered set. */
export function selectArchitecture(selection: Selection, id: string, additive: boolean): Selection {
  if (!additive || selection.kind !== 'architecture') return { kind: 'architecture', ids: [id] }
  if (!selection.ids.includes(id)) return { kind: 'architecture', ids: [...selection.ids, id] }
  const ids = selection.ids.filter(selected => selected !== id)
  return ids.length === 0 ? noSelection : { kind: 'architecture', ids }
}

export function selectTask(id: string): Selection {
  return { kind: 'task', id }
}

/** Drops targets that disappeared from a live payload without changing the order of those that remain. */
export function retainSelection(selection: Selection, known: (id: string) => boolean): Selection {
  if (selection.kind === 'none') return selection
  if (selection.kind === 'task') return known(selection.id) ? selection : noSelection
  const ids = selection.ids.filter(known)
  return ids.length === 0 ? noSelection : { kind: 'architecture', ids }
}
