import { compareElements } from '../../element-order.ts'
import type { ArchitectureWorld, C4Kind, Origin, WorldElement } from '../../types.ts'

/** Manual overrides on top of the always-visible paths to the selections. */
export interface TreeState {
  cursor?: string
  expanded: ReadonlySet<string>
  collapsed: ReadonlySet<string>
}

export interface TreeRow {
  id: string
  name: string
  kind: C4Kind
  external: boolean
  depth: number
  origin: Origin
  hasChildren: boolean
  expanded: boolean
  /** Direct children hidden behind a collapsed row. */
  count: number
}

export function initialTree(): TreeState {
  return { expanded: new Set(), collapsed: new Set() }
}

/** Manual expand or collapse of one row, on top of the selection path. */
export function toggleExpansion(tree: TreeState, row: TreeRow): TreeState {
  const expanded = new Set(tree.expanded)
  const collapsed = new Set(tree.collapsed)
  if (tree.collapsed.has(row.id)) {
    collapsed.delete(row.id)
    expanded.add(row.id)
  } else if (row.expanded) {
    expanded.delete(row.id)
    collapsed.add(row.id)
  } else {
    collapsed.delete(row.id)
    expanded.add(row.id)
  }
  return { ...tree, expanded, collapsed }
}

function sorted(elements: WorldElement[]): WorldElement[] {
  return [...elements].sort(compareElements)
}

export function ancestorsOf(
  id: string | undefined,
  byId: Map<string, WorldElement>,
): Set<string> {
  const ancestors = new Set<string>()
  let current = id === undefined ? undefined : byId.get(id)
  while (current && current.parent !== null) {
    const parent = byId.get(current.parent)
    if (!parent) break
    ancestors.add(parent.representationId)
    current = parent
  }
  return ancestors
}

/** The visible rows of the containment tree, in drawing order. */
export function treeRows(
  world: ArchitectureWorld,
  selectionIds: readonly string[],
  tree: TreeState,
): TreeRow[] {
  const byId = new Map(world.elements.map(element => [element.representationId, element]))
  const selectionPath = new Set(selectionIds.flatMap(id => [...ancestorsOf(id, byId)]))
  const rows: TreeRow[] = []

  function expandedFor(element: WorldElement): boolean {
    if (element.children.length === 0) return false
    if (selectionPath.has(element.representationId)) return true
    if (tree.collapsed.has(element.representationId)) return false
    return tree.expanded.has(element.representationId)
  }

  function push(element: WorldElement, depth: number): void {
    const children = sorted(element.children
      .map(id => byId.get(id))
      .filter((child): child is WorldElement => child !== undefined))
    const expanded = expandedFor(element)
    rows.push({
      id: element.representationId,
      name: element.name,
      kind: element.kind,
      external: element.external,
      depth,
      origin: element.origin,
      hasChildren: children.length > 0,
      expanded,
      count: children.length,
    })
    if (!expanded) return
    for (const child of children) push(child, depth + 1)
  }

  for (const root of sorted(world.elements.filter(element => element.parent === null))) {
    push(root, 0)
  }
  return rows
}
