import type {
  DisplayRole,
  ProjectedElement,
  SemanticItem,
  SemanticLevel,
  SemanticRole,
  WorldElement,
} from '../../types.ts'

/** Paint role for one semantic item. DisplayRole stays the TUI enum. */
export function displayFor(
  item: SemanticItem | undefined,
  element: WorldElement,
): DisplayRole {
  if (!item) return 'hidden'
  if (item.role === 'mark' || element.kind === 'component') return 'card'
  if (element.kind === 'system') return 'system-boundary'
  return 'container-boundary'
}

export function attachableRole(role: SemanticRole | undefined): boolean {
  return role === 'named' || role === 'mark' || role === 'campus'
}

/** Named software, marks, and campus wrappers letter a name. Underlay does not. */
export function letterName(
  element: Pick<ProjectedElement, 'display' | 'kind' | 'external'>,
  level: SemanticLevel,
): boolean {
  if (element.display === 'hidden') return false
  if (element.kind === 'person' || element.external) return true
  if (element.kind === 'system') return true
  if (element.kind === 'container') return level !== 'context'
  return level === 'components'
}
