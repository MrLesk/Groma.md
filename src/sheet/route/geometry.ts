import type { AnnotatedRelationship } from '../../types.ts'
import { ROOF_SHADOW } from '../grid.ts'
import type { CellRect, Route } from '../types.ts'
import { ROUTE_UNIT } from './space.ts'

export interface Point {
  x: number
  y: number
}

export type PortSide = 'north' | 'east' | 'south' | 'west'

export interface RoutePort {
  side: PortSide
  wall: Point
  guard: Point
}

export interface PortPair {
  source: RoutePort
  target: RoutePort
}

/** Anything a route may start or end on, with its direct enclosing surface. */
export interface Endpoint {
  key: string
  kind: 'building' | 'slab' | 'island'
  rect: CellRect
  owner?: string
  roof?: number
  /** A round building: its ports stay toward the middle of each wall, and it takes one arriving route per wall. */
  round?: boolean
}

export type RouteRequest = Pick<AnnotatedRelationship, 'id' | 'source' | 'target' | 'description' | 'origin'> & { relationshipIds?: string[] }
export type FlatRoute = Omit<Route, 'points'> & { points: Point[] }

/** Plane units within which two coordinates count as the same. */
export const EPSILON = 0.001

export function rectOf(rect: CellRect): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.gx * ROUTE_UNIT,
    y: rect.gy * ROUTE_UNIT,
    width: rect.w * ROUTE_UNIT,
    height: rect.d * ROUTE_UNIT,
  }
}

export function visibleObstacle(endpoint: Endpoint, clearance = 0): Point[] {
  const { x, y, width, height } = rectOf(endpoint.rect)
  const shadow = (endpoint.roof ?? 0) * ROOF_SHADOW * ROUTE_UNIT
  return [
    { x: x - shadow - clearance, y: y - shadow - clearance },
    { x: x + width - shadow + clearance, y: y - shadow - clearance },
    { x: x + width + clearance, y: y - clearance },
    { x: x + width + clearance, y: y + height + clearance },
    { x: x - clearance, y: y + height + clearance },
    { x: x - shadow - clearance, y: y + height - shadow + clearance },
  ]
}

export function inside(point: Point, polygon: readonly Point[]): boolean {
  let contained = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]!
    const b = polygon[previous]!
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) contained = !contained
  }
  return contained
}
