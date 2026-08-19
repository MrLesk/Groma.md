import type {
  Bounds,
  Point,
  SemanticEdge,
  SemanticItem,
  SemanticRoute,
  SemanticRole,
  WorldElement,
  WorldRelationship,
} from './types.ts'

function attachable(role: SemanticRole): boolean {
  return role === 'named' || role === 'mark' || role === 'campus'
}

function byRepresentationId(
  elements: readonly WorldElement[],
): Map<string, WorldElement> {
  return new Map(elements.map(element => [element.representationId, element]))
}

/**
 * Finds the nearest named, mark, or campus representation for an authored
 * endpoint. Underlay is deliberately skipped so every renderer shares the
 * same promoted endpoint.
 */
export function promotedEndpoint(
  startId: string,
  items: readonly SemanticItem[],
  elements: readonly WorldElement[],
): SemanticItem | undefined {
  const elementsById = byRepresentationId(elements)
  const itemsById = new Map(items.map(item => [item.representationId, item]))
  let current = elementsById.get(startId)
  while (current) {
    const item = itemsById.get(current.representationId)
    if (item && attachable(item.role)) return item
    current = current.parent === null
      ? undefined
      : elementsById.get(current.parent)
  }
  return undefined
}

/** Visible semantic endpoints for one authored relationship. */
export function promotedEndpoints(
  relationship: Pick<WorldRelationship, 'source' | 'target'>,
  items: readonly SemanticItem[],
  elements: readonly WorldElement[],
): { source: SemanticItem; target: SemanticItem } | undefined {
  const source = promotedEndpoint(relationship.source, items, elements)
  const target = promotedEndpoint(relationship.target, items, elements)
  if (!source || !target || source.representationId === target.representationId) {
    return undefined
  }
  return { source, target }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function insideSpan(value: number, start: number, size: number): number {
  if (size <= 2) return start + (size - 1) / 2
  return clamp(value, start + 1, start + size - 2)
}

/** Removes duplicate points while making every segment orthogonal. */
export function orthogonalRoute(route: readonly Point[]): Point[] {
  const points: Point[] = []
  function add(point: Point): void {
    const previous = points.at(-1)
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      points.push({ ...point })
    }
  }

  for (const [index, point] of route.entries()) {
    if (index > 0) {
      const previous = route[index - 1]!
      if (previous.x !== point.x && previous.y !== point.y) {
        add({ x: point.x, y: previous.y })
      }
    }
    add(point)
  }
  return points
}

/**
 * Synthesizes a projection-independent route between two semantic boxes.
 * Endpoints sit just outside the boxes and the path has no renderer units.
 */
export function routeBetweenBounds(source: Bounds, target: Bounds): Point[] {
  const sourceMid = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  }
  const targetMid = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  }
  if (
    Math.abs(targetMid.x - sourceMid.x) >= Math.abs(targetMid.y - sourceMid.y)
  ) {
    const rightward = sourceMid.x <= targetMid.x
    const start = {
      x: rightward ? source.x + source.width : source.x - 1,
      y: insideSpan(sourceMid.y, source.y, source.height),
    }
    return orthogonalRoute([
      start,
      {
        x: rightward ? target.x - 1 : target.x + target.width,
        y: insideSpan(start.y, target.y, target.height),
      },
    ])
  }

  const downward = sourceMid.y <= targetMid.y
  const start = {
    x: insideSpan(sourceMid.x, source.x, source.width),
    y: downward ? source.y + source.height : source.y - 1,
  }
  return orthogonalRoute([
    start,
    {
      x: insideSpan(start.x, target.x, target.width),
      y: downward ? target.y - 1 : target.y + target.height,
    },
  ])
}

/** Keeps authored bends while attaching both ends to the semantic boxes. */
export function attachRouteToBounds(
  route: readonly Point[],
  source: Bounds,
  target: Bounds,
): Point[] {
  if (route.length < 2) return route.map(point => ({ ...point }))
  const attached = route.map(point => ({ ...point }))
  const first = attached[0]!
  const second = attached[1]!
  if (second.x > first.x) {
    first.x = source.x + source.width
    first.y = insideSpan(first.y, source.y, source.height)
  } else if (second.x < first.x) {
    first.x = source.x - 1
    first.y = insideSpan(first.y, source.y, source.height)
  } else if (second.y > first.y) {
    first.y = source.y + source.height
    first.x = insideSpan(first.x, source.x, source.width)
  } else {
    first.y = source.y - 1
    first.x = insideSpan(first.x, source.x, source.width)
  }

  const last = attached.at(-1)!
  const previous = attached.at(-2)!
  if (last.x > previous.x) {
    last.x = target.x - 1
    last.y = insideSpan(last.y, target.y, target.height)
  } else if (last.x < previous.x) {
    last.x = target.x + target.width
    last.y = insideSpan(last.y, target.y, target.height)
  } else if (last.y > previous.y) {
    last.y = target.y - 1
    last.x = insideSpan(last.x, target.x, target.width)
  } else {
    last.y = target.y + target.height
    last.x = insideSpan(last.x, target.x, target.width)
  }
  return attached
}

function labelOnRoute(
  route: readonly Point[],
  label: Bounds,
): Bounds {
  const horizontal = route
    .slice(1)
    .map((point, index) => ({ from: route[index]!, to: point }))
    .filter(segment => segment.from.y === segment.to.y)
    .sort((left, right) => {
      const leftLength = Math.abs(left.to.x - left.from.x)
      const rightLength = Math.abs(right.to.x - right.from.x)
      return rightLength - leftLength
    })[0]

  if (horizontal) {
    const left = Math.min(horizontal.from.x, horizontal.to.x)
    const right = Math.max(horizontal.from.x, horizontal.to.x)
    return {
      ...label,
      x: (left + right - label.width) / 2,
      y: horizontal.from.y,
    }
  }

  const first = route[0]!
  const last = route.at(-1) ?? first
  return {
    ...label,
    x: (first.x + last.x - label.width) / 2,
    y: (first.y + last.y - label.height) / 2,
  }
}

/**
 * Carries authored world geometry through for direct endpoints and creates
 * new box-to-box geometry only when semantic endpoint promotion is required.
 */
export function semanticRoutes(
  relationships: readonly WorldRelationship[],
  edges: readonly SemanticEdge[],
  items: readonly SemanticItem[],
): SemanticRoute[] {
  const relationshipsById = new Map(
    relationships.map(relationship => [relationship.id, relationship]),
  )
  const itemsById = new Map(items.map(item => [item.representationId, item]))

  return edges.flatMap(edge => {
    const relationship = relationshipsById.get(edge.id)
    const source = itemsById.get(edge.source)
    const target = itemsById.get(edge.target)
    if (!relationship || !source || !target) return []

    const promoted = relationship.source !== source.representationId
      || relationship.target !== target.representationId
    const authoredRoute = orthogonalRoute(relationship.route)
    const route = promoted || authoredRoute.length < 2
      ? routeBetweenBounds(source.bounds, target.bounds)
      : attachRouteToBounds(authoredRoute, source.bounds, target.bounds)
    const label = relationship.label === null
      ? null
      : promoted
        ? labelOnRoute(route, { ...relationship.label })
        : { ...relationship.label }

    return [{
      ...edge,
      route,
      label,
    }]
  })
}
