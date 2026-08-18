import type {
  ArchitectureWorld,
  Bounds,
  C4Kind,
  SemanticEdge,
  SemanticItem,
  SemanticLevel,
  SemanticView,
  SemanticViewOptions,
  WorldElement,
  WorldRelationship,
} from './types.ts'

/** Same name room the world layout uses: three units per glyph plus a side margin. */
const NAME_UNIT = 3
const NAME_MARGIN = 6

const minimumSize: Record<C4Kind, Pick<Bounds, 'width' | 'height'>> = {
  component: { width: 34, height: 16 },
  container: { width: 42, height: 32 },
  person: { width: 28, height: 40 },
  system: { width: 44, height: 40 },
}

export function displaySize(
  name: string,
  kind: C4Kind,
): Pick<Bounds, 'width' | 'height'> {
  const minimum = minimumSize[kind]
  return {
    width: Math.max(minimum.width, name.length * NAME_UNIT + NAME_MARGIN),
    height: minimum.height,
  }
}

function byId(world: ArchitectureWorld): Map<string, WorldElement> {
  return new Map(world.elements.map(element => [element.representationId, element]))
}

function within(
  element: WorldElement | undefined,
  ancestorId: string,
  elements: Map<string, WorldElement>,
): boolean {
  let current = element
  while (current) {
    if (current.representationId === ancestorId) return true
    current = current.parent === null ? undefined : elements.get(current.parent)
  }
  return false
}

function topAncestor(
  element: WorldElement,
  elements: Map<string, WorldElement>,
): WorldElement {
  let current = element
  while (current.parent !== null) {
    const parent = elements.get(current.parent)
    if (!parent) return current
    current = parent
  }
  return current
}

function ancestorOfKind(
  element: WorldElement,
  kind: C4Kind,
  elements: Map<string, WorldElement>,
): WorldElement | undefined {
  let current: WorldElement | undefined = element
  while (current) {
    if (current.kind === kind) return current
    current = current.parent === null ? undefined : elements.get(current.parent)
  }
}

function displayOf(
  element: WorldElement,
  level: SemanticLevel,
  focusId: string | undefined,
  elements: Map<string, WorldElement>,
): WorldElement {
  if (level === 'context') {
    return element.kind === 'person' ? element : topAncestor(element, elements)
  }
  if (level === 'containers') {
    if (element.kind === 'person' || element.external) return element
    const container = ancestorOfKind(element, 'container', elements)
    if (container && container.parent === focusId) return container
    if (focusId && within(element, focusId, elements)) {
      return elements.get(focusId) ?? topAncestor(element, elements)
    }
    return topAncestor(element, elements)
  }
  if (focusId && within(element, focusId, elements)) {
    return element.kind === 'component' ? element : elements.get(focusId) ?? element
  }
  return ancestorOfKind(element, 'container', elements)
    ?? topAncestor(element, elements)
}

function touchesFocus(
  relationship: WorldRelationship,
  focusId: string,
  elements: Map<string, WorldElement>,
): boolean {
  const source = elements.get(relationship.source)
  const target = elements.get(relationship.target)
  return within(source, focusId, elements) || within(target, focusId, elements)
}

function coreVisible(
  element: WorldElement,
  level: SemanticLevel,
  focusId: string | undefined,
  elements: Map<string, WorldElement>,
  relationships: WorldRelationship[],
): boolean {
  if (level === 'context') {
    return element.kind === 'person' || element.kind === 'system'
  }
  if (!focusId) return false
  if (level === 'containers') {
    if (element.representationId === focusId) return true
    if (element.kind === 'container' && element.parent === focusId) return true
    if (element.kind !== 'person' && !(element.kind === 'system' && element.external)) {
      return false
    }
    return relationships.some(relationship => {
      if (!touchesFocus(relationship, focusId, elements)) return false
      return relationship.source === element.representationId
        || relationship.target === element.representationId
    })
  }
  if (element.representationId === focusId) return true
  return element.kind === 'component' && element.parent === focusId
}

function collapsedInsides(
  element: WorldElement,
  level: SemanticLevel,
  focusId: string | undefined,
): boolean {
  if (element.children.length === 0) return false
  if (level === 'context') return element.kind === 'system'
  if (level === 'containers') {
    return element.kind === 'container' && element.parent === focusId
  }
  return false
}

function toItem(element: WorldElement, collapsed: boolean): SemanticItem {
  const size = displaySize(element.name, element.kind)
  return {
    representationId: element.representationId,
    id: element.id,
    kind: element.kind,
    name: element.name,
    collapsed,
    bounds: {
      x: element.bounds.x,
      y: element.bounds.y,
      width: size.width,
      height: size.height,
    },
  }
}

export function semanticView(
  world: ArchitectureWorld,
  options: SemanticViewOptions,
): SemanticView {
  const { level, focusId } = options
  const elements = byId(world)
  const visible = new Set<string>()
  for (const element of world.elements) {
    if (coreVisible(element, level, focusId, elements, world.relationships)) {
      visible.add(element.representationId)
    }
  }

  const edges: SemanticEdge[] = []
  const seen = new Set<string>()
  for (const relationship of world.relationships) {
    const sourceElement = elements.get(relationship.source)
    const targetElement = elements.get(relationship.target)
    if (!sourceElement || !targetElement) continue
    const source = displayOf(sourceElement, level, focusId, elements)
    const target = displayOf(targetElement, level, focusId, elements)
    if (source.representationId === target.representationId) continue
    if (level === 'context') {
      if (!visible.has(source.representationId) || !visible.has(target.representationId)) continue
    } else if (!focusId || !touchesFocus(relationship, focusId, elements)) {
      continue
    } else {
      visible.add(source.representationId)
      visible.add(target.representationId)
    }
    const pair = `${source.representationId}\0${target.representationId}`
    if (seen.has(pair)) continue
    seen.add(pair)
    edges.push({
      id: relationship.id,
      source: source.representationId,
      target: target.representationId,
      description: relationship.description,
    })
  }

  const items = world.elements
    .filter(element => visible.has(element.representationId))
    .map(element => toItem(element, collapsedInsides(element, level, focusId)))

  return {
    level,
    focusId: focusId ?? null,
    items,
    edges,
  }
}
