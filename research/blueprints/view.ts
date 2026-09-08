import { sheetScene } from '../../src/sheet/scene.ts'
import type { ArchitectureGraph } from '../../src/types.ts'
import { createMap } from '../../src/viewers/web/iso/map.ts'
import { fitCamera, pan, resized, wheelAction, zoomAbout } from '../../src/viewers/web/iso/camera.ts'
import type { Camera, Viewport } from '../../src/viewers/web/iso/camera.ts'
import { bindMapPointer } from '../../src/viewers/web/iso/pointer.ts'
import { EXPLODED_POSE, orbitPose } from '../../src/viewers/web/layers/orbit.ts'
import type { SheetScene } from '../../src/sheet/types.ts'
import { INITIAL_VIEW, chooseMapView, presentSheet, toggleLayers } from './map-projection.ts'
import type { MapView } from './map-projection.ts'
import lockup from '../../src/viewers/web/atoms/lockup.svg' with { type: 'text' }
import type { Draft, Project } from './model.ts'

export { lockup }
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))
export function button(label: string, action: string, kind = '', attributes = ''): string {
  return `<button type="button" class="${kind}" data-action="${action}" ${attributes}>${label}</button>`
}
export function graphFor(project: Project, draft?: Draft): ArchitectureGraph {
  const all = [...project.elements, ...(draft?.parts ?? [])]
  return {
    flows: [],
    elements: all.map(element => ({
      representationId: element.id, id: element.id, kind: element.kind, title: element.title,
      parent: element.parent, children: all.filter(child => child.parent === element.id).map(child => child.id),
      overview: element.overview, code: structuredClone(element.code), codeLines: element.codeLines, external: element.external,
      origin: element.status === 'draft' ? 'draft' : 'observed',
    })),
    relationships: structuredClone([...project.relationships, ...(draft?.relationships ?? [])]),
  }
}
/** One sheet, one painter and independent cameras; changing presentation never repaints the inspector. */
export function studyMap(host: HTMLElement, onSelect: (id: string) => void) {
  const map = createMap(host)
  let state = { ...INITIAL_VIEW }
  let orbit = { ...EXPLODED_POSE }
  let sheet: SheetScene | undefined
  let graphKey = ''
  let selected: string[] = []
  let scene: ReturnType<typeof presentSheet> | undefined
  let viewport: Viewport = { width: host.clientWidth, height: host.clientHeight }
  const cameras = new Map<MapView, Camera>()
  const size = (): Viewport => ({ width: host.clientWidth, height: host.clientHeight })
  const fitted = (): Camera => fitCamera(scene!.bounds, size())
  const current = (): Camera => cameras.get(state.view) ?? fitted()

  function move(camera: Camera): void {
    cameras.set(state.view, camera)
    map.move(camera, camera.k / fitted().k)
  }
  function fit(): void {
    if (scene && host.clientWidth > 48 && host.clientHeight > 48) move(fitted())
  }
  function draw(): void {
    if (!sheet) return
    scene = presentSheet(sheet, state.view, orbit)
    host.dataset.mapView = state.view
    map.paint(scene)
    map.select(selected)
    if (host.clientWidth > 48 && host.clientHeight > 48) move(current())
  }
  function choose(view: MapView): void {
    if (state.view === view) return
    state = chooseMapView(state, view)
    draw()
  }
  function zoom(factor: number): void {
    if (scene) move(zoomAbout(current(), factor, { x: host.clientWidth / 2, y: host.clientHeight / 2 }, fitted()))
  }
  bindMapPointer(map, {
    orbiting: () => state.view === 'layers',
    pan: (dx, dy) => { if (scene) move(pan(current(), dx, dy)) },
    orbit: (dx, dy) => { orbit = orbitPose(orbit, dx, dy); draw() },
    select: id => onSelect(id),
    deselect: () => {},
    editProject: () => {},
  })
  map.svg.addEventListener('wheel', event => {
    if (!scene) return
    event.preventDefault()
    const action = wheelAction(event)
    const rect = host.getBoundingClientRect()
    move(action.kind === 'pan' ? pan(current(), action.dx, action.dy)
      : zoomAbout(current(), action.factor, { x: event.clientX - rect.x, y: event.clientY - rect.y }, fitted()))
  }, { passive: false })
  map.svg.addEventListener('keydown', event => {
    const delta: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }
    if (!scene || !delta[event.key]) return
    event.preventDefault()
    move(pan(current(), ...delta[event.key]!))
  })
  const observer = new ResizeObserver(() => {
    const next = size()
    if (next.width <= 48 || next.height <= 48) return
    for (const [view, camera] of cameras) cameras.set(view, resized(camera, viewport, next))
    viewport = next
    if (scene) move(current())
  })
  observer.observe(host)
  return {
    fit, choose, zoom,
    toggleLayers(): void { choose(toggleLayers(state).view) },
    rotate(dx: number, dy: number): void {
      if (state.view !== 'layers') return
      orbit = orbitPose(orbit, dx, dy); draw()
    },
    snapshot: () => structuredClone({ ...state, camera: scene ? current() : undefined, orbit }),
    paint(project: Project, draft?: Draft, focus?: string): void {
      const graph = graphFor(project, draft)
      const key = JSON.stringify(graph)
      selected = [...new Set([...(draft ? [...Object.values(draft.bindings), ...draft.parts.map(part => part.id)] : []), ...(focus ? [focus] : [])])]
      if (key !== graphKey) {
        graphKey = key
        sheet = sheetScene(graph)
        cameras.clear()
      }
      draw()
    },
  }
}
export function hierarchy(project: Project, draft?: Draft): string {
  const nodes = [...project.elements, ...(draft?.parts ?? [])]
  function children(parent: string | null, level: number): string {
    return nodes.filter(node => node.parent === parent).map(node => {
      const affected = draft && Object.values(draft.bindings).includes(node.id)
      return `<button class="tree-row ${node.status === 'draft' ? 'ghost-row' : ''}" style="--level:${level}" data-element="${escapeHtml(node.id)}">
        <span class="kind-mark ${node.status === 'draft' ? 'ghost' : ''}"></span><span>${escapeHtml(node.title)}</span>${affected ? '<span class="participates">↗</span>' : ''}</button>${children(node.id, level + 1)}`
    }).join('')
  }
  return `<div class="section-label">Structure</div>${children(null, 0)}`
}
