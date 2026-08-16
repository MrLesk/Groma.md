import type { ArchitectureWorld, C4Kind, Origin, WorldElement } from '../../types.ts'

/** Manual overrides on top of the always-visible path to the selection. */
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

function meaningRank(element: WorldElement): number {
  if (element.kind === 'person') return 0
  if (element.external) return 2
  return 1
}

/** Sibling order: people, then internal software, then externals; left to right. */
export function compareElements(left: WorldElement, right: WorldElement): number {
  return meaningRank(left) - meaningRank(right)
    || left.bounds.x - right.bounds.x
    || left.bounds.y - right.bounds.y
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
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
  selectionId: string | undefined,
  tree: TreeState,
): TreeRow[] {
  const byId = new Map(world.elements.map(element => [element.representationId, element]))
  const selectionPath = ancestorsOf(selectionId, byId)
  const rows: TreeRow[] = []

  function expandedFor(element: WorldElement): boolean {
    if (element.children.length === 0) return false
    if (tree.collapsed.has(element.representationId)) return false
    return tree.expanded.has(element.representationId)
      || selectionPath.has(element.representationId)
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
