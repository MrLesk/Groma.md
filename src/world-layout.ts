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
  'elk.spacing.edgeNode': '5',
  'elk.spacing.nodeNode': '28',
  'elk.layered.spacing.nodeNodeBetweenLayers': '18',
}

const nestedLayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.nodeSize.constraints': 'MINIMUM_SIZE',
  'elk.padding': '[top=14,left=4,bottom=8,right=4]',
  'elk.spacing.edgeEdge': '3',
  'elk.spacing.edgeNode': '8',
  'elk.spacing.nodeNode': '16',
  'elk.layered.spacing.nodeNodeBetweenLayers': '12',
}

const minimumSizes: Record<C4Kind, Pick<Bounds, 'width' | 'height'>> = {
  component: { width: 34, height: 16 },
  container: { width: 42, height: 32 },
  person: { width: 28, height: 40 },
  system: { width: 44, height: 40 },
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function nodeFor(
  element: AnnotatedElement,
  elementsById: Map<string, AnnotatedElement>,
): ElkNode {
  const children = element.children
    .map(id => {
      const child = elementsById.get(id)
      if (!child) throw new Error(`Unknown child representation: ${id}`)
      return nodeFor(child, elementsById)
    })
  const size = minimumSizes[element.kind]

  return {
    id: element.representationId,
    width: size.width,
    height: size.height,
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
    children: roots.map(element => nodeFor(element, elementsById)),
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

function collectElements(
  graph: ElkNode,
  modelElements: Map<string, AnnotatedElement>,
  offsetX = 0,
  offsetY = 0,
  result: WorldElement[] = [],
): WorldElement[] {
  for (const node of graph.children ?? []) {
    const x = offsetX + (node.x ?? 0)
    const y = offsetY + (node.y ?? 0)
    const element = modelElements.get(node.id)
    if (!element) throw new Error(`Unknown laid-out representation: ${node.id}`)

    result.push({
      ...element,
      bounds: {
        x,
        y,
        width: node.width ?? 0,
        height: node.height ?? 0,
      },
    })
    collectElements(node, modelElements, x, y, result)
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
    current = current.parent === null
      ? undefined
      : elementsById.get(current.parent)
  }
  return ids
}

function edgeOffset(
  relationship: AnnotatedRelationship,
  elementsById: Map<string, WorldElement>,
): Pick<Bounds, 'x' | 'y'> {
  const source = elementsById.get(relationship.source)
  const target = elementsById.get(relationship.target)
  if (!source || !target) throw new Error('Relationship endpoint is missing from layout')
  const targetAncestors = new Set(ancestorIds(target, elementsById))
  const commonAncestor = ancestorIds(source, elementsById)
    .find(id => targetAncestors.has(id))

  return commonAncestor
    ? elementsById.get(commonAncestor)?.bounds ?? { x: 0, y: 0 }
    : { x: 0, y: 0 }
}

function collectEdges(
  graph: ElkNode,
  modelRelationships: Map<string, AnnotatedRelationship>,
  elementsById: Map<string, WorldElement>,
  result: WorldRelationship[] = [],
): WorldRelationship[] {
  for (const edge of graph.edges ?? []) {
    const relationship = modelRelationships.get(edge.id)
    const section = edge.sections?.[0]

    if (!section || !relationship) continue

    const offset = edgeOffset(relationship, elementsById)

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
    collectEdges(child, modelRelationships, elementsById, result)
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
  const modelElements = new Map(model.elements.map(element => [
    element.representationId,
    element,
  ]))
  const modelRelationships = new Map(model.relationships.map((relationship, index) => [
    `relationship:${index}`,
    relationship,
  ]))

  const elements = collectElements(laidOut, modelElements)
    .sort((left, right) => compareStrings(
      left.representationId,
      right.representationId,
    ))
  const laidOutElements = new Map(elements.map(element => [
    element.representationId,
    element,
  ]))

  return {
    bounds: {
      x: 0,
      y: 0,
      width: laidOut.width ?? 0,
      height: laidOut.height ?? 0,
    },
    elements,
    relationships: collectEdges(
      laidOut,
      modelRelationships,
      laidOutElements,
    )
      .sort((left, right) => compareStrings(left.id, right.id)),
  }
}
