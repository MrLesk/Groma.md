import ELK from 'elkjs'
import type {
  ElkNode,
  ElkPoint,
} from 'elkjs/lib/elk-api'

import type {
  AnnotatedArchitectureModel,
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureWorld,
  Bounds,
  C4Kind,
  Point,
  WorldElement,
  WorldGroup,
  WorldRelationship,
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

const groupLayoutOptions = {
  ...nestedLayoutOptions,
  'elk.padding': '[top=12,left=10,bottom=10,right=10]',
}

const minimumSizes: Record<C4Kind, Pick<Bounds, 'width' | 'height'>> = {
  component: { width: 34, height: 16 },
  container: { width: 42, height: 32 },
  person: { width: 28, height: 40 },
  system: { width: 44, height: 40 },
}

// Viewers draw the name on the box at roughly 3 units per monospace
// glyph; the box must give the name that room plus a side margin.
function elementWidth(element: AnnotatedElement): number {
  return Math.max(
    minimumSizes[element.kind].width,
    element.name.length * 3 + 6,
  )
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

type GroupSeeds = Map<string, Pick<WorldGroup, 'name' | 'parent'>>

// Group ids share the ELK node id namespace with representationIds so that
// edgeOffset can treat a group as the common ancestor anchoring a route.
function groupNodeId(parent: string | null, name: string): string {
  return `group:${parent ?? ''}:${name}`
}

function groupSeedsFor(elements: AnnotatedElement[]): GroupSeeds {
  const seeds: GroupSeeds = new Map()
  for (const element of elements) {
    if (element.group !== undefined) {
      seeds.set(groupNodeId(element.parent, element.group), {
        name: element.group,
        parent: element.parent,
      })
    }
  }
  return seeds
}

/** Sibling nodes, with siblings that share a group wrapped in one synthetic node. */
function siblingNodes(
  parent: string | null,
  siblings: AnnotatedElement[],
  elementsById: Map<string, AnnotatedElement>,
): ElkNode[] {
  const nodes: ElkNode[] = []
  const memberNodes = new Map<string, ElkNode[]>()

  for (const sibling of siblings) {
    const node = nodeFor(sibling, elementsById)
    if (sibling.group === undefined) {
      nodes.push(node)
      continue
    }
    const id = groupNodeId(parent, sibling.group)
    const members = memberNodes.get(id) ?? []
    members.push(node)
    memberNodes.set(id, members)
  }

  const groupIds = [...memberNodes.keys()].sort(compareStrings)
  return [
    ...nodes,
    ...groupIds.map(id => ({
      id,
      layoutOptions: groupLayoutOptions,
      children: memberNodes.get(id),
    })),
  ]
}

function nodeFor(
  element: AnnotatedElement,
  elementsById: Map<string, AnnotatedElement>,
): ElkNode {
  const children = siblingNodes(
    element.representationId,
    element.children.map(id => {
      const child = elementsById.get(id)
      if (!child) throw new Error(`Unknown child representation: ${id}`)
      return child
    }),
    elementsById,
  )
  return {
    id: element.representationId,
    width: elementWidth(element),
    height: minimumSizes[element.kind].height,
    ...(children.length > 0 ? {
      children,
      layoutOptions: nestedLayoutOptions,
    } : {}),
  }
}

function labelWidth(text: string): number {
  return Math.max(10, Math.min(32, text.length + 2))
}

function graphFor(model: AnnotatedArchitectureModel): ElkNode {
  const elementsById = new Map(model.elements.map(element => [
    element.representationId,
    element,
  ]))
  const roots = model.elements
    .filter(element => element.parent === null)
    .sort((left, right) => compareStrings(
      left.representationId,
      right.representationId,
    ))

  return {
    id: 'architecture-world',
    layoutOptions: rootLayoutOptions,
    children: siblingNodes(null, roots, elementsById),
    edges: model.relationships.map((relationship, index) => ({
      id: `relationship:${index}`,
      sources: [relationship.source],
      targets: [relationship.target],
      labels: [{
        id: `relationship:${index}:label`,
        text: relationship.description,
        width: labelWidth(relationship.description),
        height: 1,
      }],
    })),
  }
}

function absolutePoint(point: ElkPoint, offsetX: number, offsetY: number): Point {
  return {
    x: offsetX + point.x,
    y: offsetY + point.y,
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

function ancestorIds(
  element: WorldElement,
  elementsById: Map<string, WorldElement>,
): string[] {
  const ids: string[] = []
  let current: WorldElement | undefined = element
  while (current) {
    ids.push(current.representationId)
    if (current.group !== undefined) {
      ids.push(groupNodeId(current.parent, current.group))
    }
    current = current.parent === null
      ? undefined
      : elementsById.get(current.parent)
  }
  return ids
}

function edgeOffset(
  relationship: AnnotatedRelationship,
  elementsById: Map<string, WorldElement>,
  groupsById: Map<string, WorldGroup>,
): Pick<Bounds, 'x' | 'y'> {
  const source = elementsById.get(relationship.source)
  const target = elementsById.get(relationship.target)
  if (!source || !target) throw new Error('Relationship endpoint is missing from layout')
  const targetAncestors = new Set(ancestorIds(target, elementsById))
  const commonAncestor = ancestorIds(source, elementsById)
    .find(id => targetAncestors.has(id))

  return commonAncestor
    ? (elementsById.get(commonAncestor) ?? groupsById.get(commonAncestor))?.bounds
      ?? { x: 0, y: 0 }
    : { x: 0, y: 0 }
}

function collectEdges(
  graph: ElkNode,
  modelRelationships: Map<string, AnnotatedRelationship>,
  elementsById: Map<string, WorldElement>,
  groupsById: Map<string, WorldGroup>,
  result: WorldRelationship[] = [],
): WorldRelationship[] {
  for (const edge of graph.edges ?? []) {
    const relationship = modelRelationships.get(edge.id)
    const section = edge.sections?.[0]

    if (!section || !relationship) continue

    const offset = edgeOffset(relationship, elementsById, groupsById)

    result.push({
      id: edge.id,
      ...relationship,
      route: [
        absolutePoint(section.startPoint, offset.x, offset.y),
        ...(section.bendPoints ?? []).map(point => {
          return absolutePoint(point, offset.x, offset.y)
        }),
        absolutePoint(section.endPoint, offset.x, offset.y),
      ],
      label: edge.labels?.[0] ? {
        x: offset.x + (edge.labels[0].x ?? 0),
        y: offset.y + (edge.labels[0].y ?? 0),
        width: edge.labels[0].width ?? 0,
        height: edge.labels[0].height ?? 0,
      } : null,
    })
  }

  for (const child of graph.children ?? []) {
    collectEdges(child, modelRelationships, elementsById, groupsById, result)
  }

  return result
}

export async function layoutArchitectureWorld(
  model: AnnotatedArchitectureModel,
): Promise<ArchitectureWorld> {
  const graph = graphFor(model)
  const elk = new ELK({ workerUrl })
  let laidOut
  try {
    laidOut = await elk.layout(graph)
  } finally {
    elk.terminateWorker()
  }
  const modelRelationships = new Map(model.relationships.map((relationship, index) => [
    `relationship:${index}`,
    relationship,
  ]))

  const boundsById = collectBounds(laidOut)
  const requiredBounds = (id: string): Bounds => {
    const bounds = boundsById.get(id)
    if (!bounds) throw new Error(`Missing layout bounds for: ${id}`)
    return bounds
  }
  const elements = model.elements
    .map(element => ({ ...element, bounds: requiredBounds(element.representationId) }))
    .sort((left, right) => compareStrings(
      left.representationId,
      right.representationId,
    ))
  const groups = [...groupSeedsFor(model.elements)]
    .map(([id, seed]) => ({ id, ...seed, bounds: requiredBounds(id) }))
    .sort((left, right) => compareStrings(left.id, right.id))
  const laidOutElements = new Map(elements.map(element => [
    element.representationId,
    element,
  ]))
  const laidOutGroups = new Map(groups.map(group => [group.id, group]))

  return {
    bounds: {
      x: 0,
      y: 0,
      width: laidOut.width ?? 0,
      height: laidOut.height ?? 0,
    },
    elements,
    groups,
    relationships: collectEdges(
      laidOut,
      modelRelationships,
      laidOutElements,
      laidOutGroups,
    )
      .sort((left, right) => compareStrings(left.id, right.id)),
  }
}
