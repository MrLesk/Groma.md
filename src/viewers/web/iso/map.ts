import { paintBuildings } from './paint-buildings.ts'
import { paintIslands, paintSheet, paintSlabs } from './paint-ground.ts'
import { paintRoutes, type RouteNode } from './paint-routes.ts'
import type { ProjectedScene } from './project.ts'
import { mapDefs } from './style.ts'
import { svg } from './svg.ts'

export interface IsoMap {
  svg: SVGSVGElement
  camera: SVGGElement
  /** Rebuilds every layer; only a world change needs this. */
  paint(scene: ProjectedScene): void
  /** Marks the selected element and the routes touching it. */
  select(id: string | undefined): void
  /** Lights a picked flow's routes and dims everything off its path. */
  setFlow(litIds: ReadonlySet<string>, onPath: (id: string) => boolean): void
  hitId(target: EventTarget | null): string | undefined
}

/** The map SVG: patterns, one camera group, and the layers back to front. */
export function createMap(host: HTMLElement): IsoMap {
  const root = svg('svg', { role: 'img', 'aria-label': 'Architecture map', tabindex: 0 })
  root.innerHTML = mapDefs
  const camera = svg('g', {}, 'camera')
  const layers = {
    sheet: svg('g', {}, 'sheet'),
    islands: svg('g', {}, 'islands'),
    slabs: svg('g', {}, 'slabs'),
    routes: svg('g', {}, 'routes'),
    items: svg('g', {}, 'items'),
  }
  camera.append(...Object.values(layers))
  root.append(camera)
  host.replaceChildren(root)

  let items = new Map<string, Element>()
  let routes = new Map<string, RouteNode>()

  return {
    svg: root,
    camera,
    paint(scene) {
      for (const layer of Object.values(layers)) layer.replaceChildren()
      paintSheet(layers.sheet, scene)
      items = new Map([
        ...paintIslands(layers.islands, scene),
        ...paintSlabs(layers.slabs, scene),
        ...paintBuildings(layers.items, scene),
      ])
      routes = paintRoutes(layers.routes, scene)
    },
    select(id) {
      for (const [itemId, node] of items) node.classList.toggle('selected', itemId === id)
      for (const route of routes.values()) {
        route.group.classList.toggle('endpoint', id !== undefined && (route.source === id || route.target === id))
      }
    },
    setFlow(litIds, onPath) {
      const tracing = litIds.size > 0
      camera.toggleAttribute('data-tracing', tracing)
      for (const [routeId, route] of routes) route.group.classList.toggle('lit', litIds.has(routeId))
      for (const [itemId, node] of items) node.classList.toggle('onpath', tracing && onPath(itemId))
    },
    hitId(target) {
      if (!(target instanceof Element)) return undefined
      return target.closest<HTMLElement>('[data-id]')?.dataset.id
    },
  }
}
