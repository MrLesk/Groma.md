import type { ArchitectureWorld, Point, SemanticView } from '../../types.ts'
import { elementOnPath } from '../action-path.ts'
import { type SvgScene } from './svg-scene.ts'

const svgNamespace = 'http://www.w3.org/2000/svg'
const roleOrder = { campus: 0, named: 1, underlay: 2, mark: 3 } as const

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(svgNamespace, tag)
}

function pointText(point: Point): string {
  return `${point.x} ${point.y}`
}

function pathText(points: readonly Point[]): string {
  const [first, ...rest] = points
  if (!first) return ''
  return [`M ${pointText(first)}`, ...rest.map(point => `L ${pointText(point)}`)].join(' ')
}

function routeIsSelected(
  route: SvgScene['routes'][number],
  selectedId: string | undefined,
  pathIds: Set<string>,
): boolean {
  return pathIds.has(route.route.id)
    || route.route.source === selectedId
    || route.route.target === selectedId
}

export interface SvgMapOptions {
  mapSvg: SVGSVGElement
  semantic: SemanticView
  scene: SvgScene
  world: ArchitectureWorld
  selectedId: string | undefined
  hoverId: string | undefined
  pathIds: Set<string>
  applyCamera: () => void
  appendFlow: () => void
}

/** Paints the semantic scene into SVG; it does not discover or synthesize map data. */
export function paintSvgMap(options: SvgMapOptions): void {
  const {
    mapSvg,
    semantic,
    scene,
    world,
    selectedId,
    hoverId,
    pathIds,
    applyCamera,
    appendFlow,
  } = options
  const tracing = pathIds.size > 0
  const selectable = new Set(semantic.selectionTargets.map(target => target.representationId))
  const routes = svgElement('g')
  routes.dataset.routes = ''
  const shapes = svgElement('g')
  shapes.dataset.shapes = ''
  const titles = svgElement('g')
  titles.dataset.titles = ''
  const labels = svgElement('g')
  labels.dataset.labels = ''

  for (const route of scene.routes) {
    const selected = routeIsSelected(route, selectedId, pathIds)
    const path = svgElement('path')
    path.dataset.routeId = route.route.id
    path.dataset.source = route.route.source
    path.dataset.target = route.route.target
    path.setAttribute('d', pathText(route.points))
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'var(--ink)')
    path.setAttribute('stroke-width', '1')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    path.style.opacity = selected ? '1' : tracing ? '0.18' : '0.38'
    routes.append(path)

    if (route.route.label && route.route.description !== '') {
      const label = svgElement('text')
      label.dataset.routeLabel = route.route.id
      const labelBounds = route.label
      label.setAttribute('x', String(
        labelBounds ? labelBounds.x + labelBounds.width / 2 : 0,
      ))
      label.setAttribute('y', String(
        labelBounds ? labelBounds.y + labelBounds.height / 2 : 0,
      ))
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('dominant-baseline', 'middle')
      label.setAttribute('font-size', '8')
      label.setAttribute('fill', 'var(--ink)')
      label.style.opacity = selected ? '1' : '0.5'
      label.textContent = route.route.description
      labels.append(label)
    }
  }

  const items = [...scene.items].sort((left, right) => {
    return roleOrder[left.item.role] - roleOrder[right.item.role]
  })
  for (const projected of items) {
    const { item } = projected
    const onPath = !tracing
      || item.representationId === selectedId
      || item.role === 'campus'
      || elementOnPath(item.representationId, pathIds, world)
    const shape = svgElement('polygon')
    shape.dataset.representationId = item.representationId
    shape.dataset.role = item.role
    shape.setAttribute('points', projected.points.map(pointText).join(' '))
    shape.setAttribute('fill', item.role === 'underlay' ? 'var(--hairline)' : 'var(--paper)')
    shape.setAttribute('stroke', item.representationId === selectedId || item.representationId === hoverId
      ? 'var(--accent)'
      : 'var(--ink)')
    shape.setAttribute('stroke-width', item.representationId === selectedId ? '2' : '1')
    shape.setAttribute('vector-effect', 'non-scaling-stroke')
    shape.style.opacity = onPath ? '1' : '0.24'
    if (selectable.has(item.representationId)) {
      shape.dataset.id = item.representationId
      shape.dataset.selectable = 'true'
      shape.setAttribute('aria-label', item.name)
    }
    shapes.append(shape)

    if (item.role === 'underlay') continue
    const title = svgElement('text')
    title.dataset.representationId = item.representationId
    title.setAttribute('x', String(projected.label.x))
    title.setAttribute('y', String(projected.label.y))
    title.setAttribute('text-anchor', item.role === 'mark' ? 'middle' : 'start')
    title.setAttribute('dominant-baseline', item.role === 'mark' ? 'middle' : 'hanging')
    title.setAttribute('font-size', item.role === 'campus' ? '12' : '8')
    title.setAttribute('fill', 'var(--ink)')
    title.style.opacity = onPath ? '1' : '0.24'
    title.textContent = item.name
    if (selectable.has(item.representationId)) {
      title.dataset.id = item.representationId
      title.dataset.selectable = 'true'
      title.setAttribute('aria-label', item.name)
    }
    titles.append(title)
  }

  mapSvg.replaceChildren(routes, shapes, titles, labels)
  mapSvg.dataset.level = semantic.focusScope.level
  if (semantic.focusScope.focusId === null) delete mapSvg.dataset.focusId
  else mapSvg.dataset.focusId = semantic.focusScope.focusId
  applyCamera()
  appendFlow()
}
