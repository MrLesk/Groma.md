import { compareElements, compareSemanticElements } from '../../element-order.ts'
import type { AnnotatedElement, ArchitectureGraph, ArchitectureWorld, C4Kind, Origin } from '../../types.ts'

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

export function ancestorsOf(
  id: string | undefined,
  byId: ReadonlyMap<string, AnnotatedElement>,
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
function rows<Element extends AnnotatedElement>(
  elements: Element[],
  selectionIds: readonly string[],
  tree: TreeState,
  order: (left: Element, right: Element) => number,
): TreeRow[] {
  const sorted = (items: Element[]): Element[] => [...items].sort(order)
  const byId = new Map(elements.map(element => [element.representationId, element]))
  const selectionPath = new Set(selectionIds.flatMap(id => [...ancestorsOf(id, byId)]))
  const rows: TreeRow[] = []

  function expandedFor(element: Element): boolean {
    if (element.children.length === 0) return false
    if (selectionPath.has(element.representationId)) return true
    if (tree.collapsed.has(element.representationId)) return false
    return tree.expanded.has(element.representationId)
  }

  function push(element: Element, depth: number): void {
    const children = sorted(element.children.flatMap(id => {
      const child = byId.get(id)
      return child === undefined ? [] : [child]
    }))
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

  for (const root of sorted(elements.filter(element => element.parent === null))) {
    push(root, 0)
  }
  return rows
}

/** TUI hierarchy order follows the fixed ELK world. */
export function treeRows(
  world: ArchitectureWorld,
  selectionIds: readonly string[],
  tree: TreeState,
): TreeRow[] {
  return rows(world.elements, selectionIds, tree, compareElements)
}

/** Web hierarchy order follows semantic identity because the web places its own map. */
export function semanticTreeRows(
  world: ArchitectureGraph,
  selectionIds: readonly string[],
  tree: TreeState,
): TreeRow[] {
  return rows(world.elements, selectionIds, tree, compareSemanticElements)
}
