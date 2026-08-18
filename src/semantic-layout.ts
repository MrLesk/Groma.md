import ELK from 'elkjs'
import type { ElkNode } from 'elkjs/lib/elk-api'

import { semanticView } from './semantic-view.ts'
import type {
  ArchitectureWorld,
  Bounds,
  SemanticItem,
  SemanticView,
} from './types.ts'

const workerUrl = import.meta.resolve('elkjs/lib/elk-worker.min.js')

const rootLayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.randomSeed': '1',
  'elk.separateConnectedComponents': 'false',
  'elk.spacing.componentComponent': '24',
  'elk.spacing.edgeEdge': '3',
  'elk.spacing.edgeNode': '10',
  'elk.spacing.nodeNode': '52',
  'elk.layered.spacing.nodeNodeBetweenLayers': '28',
}

const nestedLayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.nodeSize.constraints': 'MINIMUM_SIZE',
  'elk.padding': '[top=32,left=20,bottom=20,right=20]',
  'elk.spacing.edgeEdge': '3',
  'elk.spacing.edgeNode': '8',
  'elk.spacing.nodeNode': '16',
  'elk.layered.spacing.nodeNodeBetweenLayers': '12',
}

function worldById(world: ArchitectureWorld): Map<string, { parent: string | null }> {
  return new Map(world.elements.map(element => [
    element.representationId,
    { parent: element.parent },
  ]))
}

function nestParent(
  item: SemanticItem,
  view: SemanticView,
  parents: Map<string, { parent: string | null }>,
): string | null {
  if (item.representationId === view.focusId) return null
  const parent = parents.get(item.representationId)?.parent
  if (parent !== undefined && parent === view.focusId) return parent
  return null
}

function graphFor(view: SemanticView, world: ArchitectureWorld): ElkNode {
  const parents = worldById(world)
  const children = new Map<string | null, SemanticItem[]>()
  for (const item of view.items) {
    const parent = nestParent(item, view, parents)
    const list = children.get(parent) ?? []
    list.push(item)
    children.set(parent, list)
  }

  const nodeFor = (item: SemanticItem): ElkNode => {
    const nested = children.get(item.representationId) ?? []
    if (nested.length === 0) {
      return {
        id: item.representationId,
        width: item.bounds.width,
        height: item.bounds.height,
      }
    }
    return {
      id: item.representationId,
      layoutOptions: nestedLayoutOptions,
      children: nested.map(nodeFor),
    }
  }

  return {
    id: 'semantic-city',
    layoutOptions: rootLayoutOptions,
    children: (children.get(null) ?? []).map(nodeFor),
    edges: view.edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  }
}

function collectBounds(
  graph: ElkNode,
  offsetX = 0,
  offsetY = 0,
  result = new Map<string, Bounds>(),
): Map<string, Bounds> {
  for (const node of graph.children ?? []) {
    const x = offsetX + (node.x ?? 0)
    const y = offsetY + (node.y ?? 0)
    result.set(node.id, {
      x,
      y,
      width: node.width ?? 0,
      height: node.height ?? 0,
    })
    collectBounds(node, x, y, result)
  }
  return result
}

function applyBounds(view: SemanticView, bounds: Map<string, Bounds>): SemanticView {
  return {
    ...view,
    items: view.items.map(item => {
      const placed = bounds.get(item.representationId)
      return placed ? { ...item, bounds: placed } : item
    }),
  }
}

export async function layoutSemanticView(
  view: SemanticView,
  world: ArchitectureWorld,
): Promise<SemanticView> {
  const elk = new ELK({ workerUrl })
  try {
    const laidOut = await elk.layout(graphFor(view, world))
    return applyBounds(view, collectBounds(laidOut))
  } finally {
    elk.terminateWorker()
  }
}

/** Keep origins from a previous level; only new children are laid out inside the focus. */
export async function preserveSemanticAnchors(
  previous: SemanticView,
  next: SemanticView,
  world: ArchitectureWorld,
): Promise<SemanticView> {
  const kept = new Map(previous.items.map(item => [item.representationId, item.bounds]))
  const parents = worldById(world)
  const newcomers = next.items.filter(item => {
    return nestParent(item, next, parents) === next.focusId && !kept.has(item.representationId)
  })
  let childBounds = new Map<string, Bounds>()
  if (newcomers.length > 0 && next.focusId) {
    const interior: SemanticView = {
      level: next.level,
      focusId: null,
      items: newcomers,
      edges: next.edges.filter(edge => {
        return newcomers.some(item => item.representationId === edge.source)
          && newcomers.some(item => item.representationId === edge.target)
      }),
    }
    const laid = await layoutSemanticView(interior, world)
    childBounds = new Map(laid.items.map(item => [item.representationId, item.bounds]))
  }

  const focus = next.focusId ? kept.get(next.focusId) : undefined
  const padding = { top: 32, left: 20, bottom: 20, right: 20 }
  const placedChildren: Bounds[] = []
  const items = next.items.map(item => {
    const prior = kept.get(item.representationId)
    if (prior && item.representationId !== next.focusId) {
      return { ...item, bounds: { ...prior, width: item.bounds.width, height: item.bounds.height } }
    }
    const local = childBounds.get(item.representationId)
    if (local && focus) {
      const bounds = {
        x: focus.x + padding.left + local.x,
        y: focus.y + padding.top + local.y,
        width: item.bounds.width,
        height: item.bounds.height,
      }
      placedChildren.push(bounds)
      return { ...item, bounds }
    }
    if (item.representationId === next.focusId && focus) {
      let width = item.bounds.width
      let height = item.bounds.height
      if (placedChildren.length > 0) {
        const right = Math.max(...placedChildren.map(box => box.x + box.width))
        const bottom = Math.max(...placedChildren.map(box => box.y + box.height))
        width = Math.max(width, right - focus.x + padding.right)
        height = Math.max(height, bottom - focus.y + padding.bottom)
      }
      return { ...item, bounds: { x: focus.x, y: focus.y, width, height } }
    }
    return item
  })

  if (next.focusId && focus) {
    const focusItem = items.find(item => item.representationId === next.focusId)
    const children = items.filter(item => nestParent(item, next, parents) === next.focusId)
    if (focusItem && children.length > 0) {
      const right = Math.max(...children.map(item => item.bounds.x + item.bounds.width))
      const bottom = Math.max(...children.map(item => item.bounds.y + item.bounds.height))
      focusItem.bounds = {
        x: focus.x,
        y: focus.y,
        width: Math.max(focusItem.bounds.width, right - focus.x + padding.right),
        height: Math.max(focusItem.bounds.height, bottom - focus.y + padding.bottom),
      }
    }
  }

  return { ...next, items }
}

export function originOf(view: SemanticView, id: string): { x: number; y: number } | undefined {
  const item = view.items.find(entry => entry.id === id || entry.representationId === id)
  return item ? { x: item.bounds.x, y: item.bounds.y } : undefined
}

export function itemBounds(view: SemanticView, id: string): Bounds | undefined {
  return view.items.find(entry => entry.id === id || entry.representationId === id)?.bounds
}

export function semanticCity(
  world: ArchitectureWorld,
  options: Parameters<typeof semanticView>[1],
): Promise<SemanticView> {
  return layoutSemanticView(semanticView(world, options), world)
}
