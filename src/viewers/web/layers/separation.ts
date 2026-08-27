import type { Point } from '../../../types.ts'
import { boundsOf } from '../iso/project.ts'
import type {
  ProjectedRoute,
  ProjectedScene,
  SurfaceText,
} from '../iso/project.ts'

export type ArchitectureLayer = 'system' | 'container' | 'component'

export const ARCHITECTURE_LAYERS: readonly ArchitectureLayer[] = [
  'system',
  'container',
  'component',
]

export interface LayerPlane {
  layer: ArchitectureLayer
  polygon: Point[]
  label: { at: Point; text: string }
  opacity: number
}

export interface LayeredRoute extends ProjectedRoute {
  /** Vertical screen-space joins from a lower endpoint to this route's plane. */
  lifts: { from: Point; to: Point }[]
}

export interface LayeredScene extends Omit<ProjectedScene, 'routes'> {
  routes: LayeredRoute[]
  layerPlanes: LayerPlane[]
}

const MIN_GAP = 96

function layerIndex(layer: ArchitectureLayer): number {
  return ARCHITECTURE_LAYERS.indexOf(layer)
}

function layerGap(scene: ProjectedScene): number {
  return Math.max(MIN_GAP, scene.bounds.width * 0.12, scene.bounds.height * 0.18)
}

function shift(point: Point, lift: number): Point {
  return { x: point.x, y: point.y - lift }
}

function shiftText(text: SurfaceText, lift: number): SurfaceText {
  return { ...text, origin: shift(text.origin, lift) }
}

function elementLayers(scene: ProjectedScene): Map<string, ArchitectureLayer> {
  return new Map([
    ...scene.islands.flatMap(({ island }) => island.element === null
      ? []
      : [[island.element.representationId, 'system'] as const]),
    ...scene.slabs.map(({ slab }) => [slab.representationId, 'container'] as const),
    ...scene.buildings.map(({ building }) => [
      building.representationId,
      building.kind === 'component' ? 'component' : 'system',
    ] as const),
  ])
}

/**
 * Derives the browser-only layer stack from one projected scene. The authored
 * sheet stays aligned and untouched; `separation` only moves screen points.
 */
export function sceneAtSeparation(scene: ProjectedScene, separation: number): LayeredScene {
  if (separation <= 0) {
    return {
      ...scene,
      routes: scene.routes.map(route => ({ ...route, lifts: [] })),
      layerPlanes: [],
    }
  }

  const gap = layerGap(scene) * Math.min(separation, 1)
  const liftOf = (layer: ArchitectureLayer): number => layerIndex(layer) * gap
  const layers = elementLayers(scene)
  const layerOf = (id: string): ArchitectureLayer => layers.get(id) ?? 'system'
  const layerPlanes = ARCHITECTURE_LAYERS.map(layer => {
    const polygon = scene.frame.map(point => shift(point, liftOf(layer)))
    const west = polygon.reduce((best, point) => point.x < best.x ? point : best)
    return {
      layer,
      polygon,
      label: { at: { x: west.x + 12, y: west.y - 10 }, text: layer.toUpperCase() },
      opacity: Math.min(separation, 1),
    }
  })
  const zones = scene.zones.map(item => {
    const lift = layers.get(item.zone.parent) === 'container' ? liftOf('container') : 0
    return {
      ...item,
      polygon: item.polygon.map(point => shift(point, lift)),
      text: shiftText(item.text, lift),
    }
  })
  const liftedSlabs = scene.slabs.map(item => ({
    ...item,
    faces: item.faces.map(face => ({
      ...face,
      points: face.points.map(point => shift(point, liftOf('container'))),
    })),
    text: shiftText(item.text, liftOf('container')),
  }))
  const buildings = scene.buildings.map(item => {
    const lift = liftOf(layerOf(item.building.representationId))
    return {
      ...item,
      floors: item.floors.map(floor => floor.map(face => ({
        ...face,
        points: face.points.map(point => shift(point, lift)),
      }))),
      text: shiftText(item.text, lift),
    }
  })
  const routes = scene.routes.map<LayeredRoute>(item => {
    const ownLayers = [layerOf(item.route.source), layerOf(item.route.target)]
    const routeLayer = ownLayers.reduce((deepest, layer) =>
      layerIndex(layer) > layerIndex(deepest) ? layer : deepest)
    const routeLift = liftOf(routeLayer)
    const points = item.points.map(point => shift(point, routeLift))
    const endpoints = [item.points[0]!, item.points.at(-1)!]
    const lifts = endpoints.flatMap((point, index) => {
      const ownLift = liftOf(ownLayers[index]!)
      return ownLift === routeLift
        ? []
        : [{ from: shift(point, ownLift), to: shift(point, routeLift) }]
    })
    return {
      ...item,
      points,
      arrow: { ...item.arrow, at: shift(item.arrow.at, routeLift) },
      lifts,
    }
  })
  const { x, y, width, height } = scene.bounds
  const points = [
    { x, y },
    { x: x + width, y: y + height },
    ...layerPlanes.flatMap(plane => plane.polygon),
    ...layerPlanes.map(plane => plane.label.at),
    ...zones.flatMap(item => item.polygon),
    ...liftedSlabs.flatMap(item => item.faces.flatMap(face => face.points)),
    ...buildings.flatMap(item => item.floors.flatMap(floor => floor.flatMap(face => face.points))),
    ...routes.flatMap(item => [...item.points, ...item.lifts.flatMap(lift => [lift.from, lift.to])]),
  ]

  return {
    ...scene,
    zones,
    slabs: liftedSlabs,
    buildings,
    routes,
    layerPlanes,
    bounds: boundsOf(points),
  }
}
