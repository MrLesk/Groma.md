import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { visibleIn } from '../projection-camera.ts'
import type { ProjectedMapItem, ProjectedMapRoute } from '../projection.ts'
import type { Bounds, Origin, Point, TerminalLevel } from '../../../types.ts'

/** The cells unlit routes have taken and which way they run, so a crossing draws a junction instead of an overwrite. */
export type Occupied = Map<string, 'horizontal' | 'vertical'>

/** The shapes a route joins, for its port dots. */
export interface RouteEnds {
  source: Bounds | undefined
  target: Bounds | undefined
}

export interface RouteLook {
  lit: boolean
  ends: RouteEnds
  /** Shared by the unlit routes of one frame; a lit route paints over everything. */
  occupied?: Occupied
  animationPhase?: number
}

interface Glyphs {
  horizontal: string
  vertical: string
  /** Corners in the order left-up, left-down, right-up, right-down. */
  corners: [string, string, string, string]
}

/** Thin lines unlit, heavy ones lit; drafts dash either. */
function glyphsFor(lit: boolean, origin: Origin): Glyphs {
  const dashed = origin !== 'observed'
  if (lit) return { horizontal: dashed ? '┅' : '━', vertical: dashed ? '┇' : '┃', corners: ['┛', '┓', '┗', '┏'] }
  return { horizontal: dashed ? '╌' : '─', vertical: dashed ? '┆' : '│', corners: ['╯', '╮', '╰', '╭'] }
}

function drawLine(
  buffer: OptimizedBuffer,
  from: Point,
  to: Point,
  color: RGBA,
  background: RGBA,
  attributes: number,
  glyphs: Glyphs,
  occupied: Occupied | undefined,
  routeDistance: number,
  animationPhase?: number,
): void {
  const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  const stepX = Math.sign(to.x - from.x)
  const stepY = Math.sign(to.y - from.y)
  const direction = from.x === to.x ? 'vertical' : 'horizontal'
  for (let distance = 0; distance <= length; distance += 1) {
    const pattern = (routeDistance + distance - (animationPhase ?? 0) + 3) % 3
    if (animationPhase !== undefined && pattern >= 2) continue
    const x = from.x + stepX * distance
    const y = from.y + stepY * distance
    let glyph = direction === 'vertical' ? glyphs.vertical : glyphs.horizontal
    if (occupied !== undefined) {
      const key = `${x},${y}`
      const before = occupied.get(key)
      if (before !== undefined && before !== direction) glyph = '┼'
      occupied.set(key, direction)
    }
    cell(buffer, x, y, glyph, color, background, attributes)
  }
}

function corner(previous: Point, point: Point, next: Point, corners: Glyphs['corners']): string {
  const horizontal = previous.x === point.x ? next : previous
  const vertical = previous.x === point.x ? previous : next
  const left = horizontal.x < point.x
  const up = vertical.y < point.y
  if (left && up) return corners[0]
  if (left) return corners[1]
  if (up) return corners[2]
  return corners[3]
}

function arrow(from: Point, to: Point): string {
  if (to.x > from.x) return '▶'
  if (to.x < from.x) return '◀'
  if (to.y > from.y) return '▼'
  return '▲'
}

/** The border cell a route end touches, or nothing when that end sits on a top border where the name lives. */
function portCell(end: Point, bounds: Bounds | undefined): Point | undefined {
  if (bounds === undefined) return undefined
  if (end.x < bounds.x) return { x: bounds.x, y: end.y }
  if (end.x >= bounds.x + bounds.width) return { x: bounds.x + bounds.width - 1, y: end.y }
  if (end.y < bounds.y) return undefined
  return { x: end.x, y: bounds.y + bounds.height - 1 }
}

/**
 * An unlit route is a dim thin line with a junction where it crosses another; a lit route is heavy in
 * the accent with an arrowhead at its target. Its port dots follow in drawPorts, once the shapes are painted.
 */
export function drawRoute(buffer: OptimizedBuffer, route: ProjectedMapRoute, viewport: Bounds, theme: ViewerTheme, look: RouteLook): void {
  if (route.cellRoute.length < 2) return
  const color = look.lit ? theme.selected : theme[route.origin]
  const attributes = look.lit ? TextAttributes.BOLD : TextAttributes.DIM
  const glyphs = glyphsFor(look.lit, route.origin)
  let routeDistance = 0
  for (let index = 1; index < route.cellRoute.length; index += 1) {
    const from = route.cellRoute[index - 1]!
    const to = route.cellRoute[index]!
    drawLine(buffer, from, to, color, theme.background, attributes, glyphs, look.lit ? undefined : look.occupied, routeDistance, look.animationPhase)
    routeDistance += Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  }
  for (let index = 1; index < route.cellRoute.length - 1; index += 1) {
    const previous = route.cellRoute[index - 1]!
    const point = route.cellRoute[index]!
    const next = route.cellRoute[index + 1]!
    if ((previous.x === point.x) !== (next.x === point.x)) {
      cell(buffer, point.x, point.y, corner(previous, point, next, glyphs.corners), color, theme.background, attributes)
    }
  }
  if (!look.lit) return
  const last = route.cellRoute.at(-1)!
  if (visibleIn({ ...last, width: 1, height: 1 }, viewport)) {
    cell(buffer, last.x, last.y, arrow(route.cellRoute.at(-2)!, last), color, theme.background, TextAttributes.BOLD)
  }
}

/** A lit route's port dots on the border cell of each end, none on a top border where the name lives. */
export function drawPorts(buffer: OptimizedBuffer, route: ProjectedMapRoute, viewport: Bounds, theme: ViewerTheme, ends: RouteEnds): void {
  if (route.cellRoute.length < 2) return
  for (const port of [portCell(route.cellRoute[0]!, ends.source), portCell(route.cellRoute.at(-1)!, ends.target)]) {
    if (port !== undefined && visibleIn({ ...port, width: 1, height: 1 }, viewport)) {
      cell(buffer, port.x, port.y, '●', theme.selected, theme.background, TextAttributes.BOLD)
    }
  }
}

/** The first word (two in a container map) on the longest horizontal run of a lit route, never over a shape. */
export function drawRouteLabel(
  buffer: OptimizedBuffer,
  route: ProjectedMapRoute,
  level: TerminalLevel,
  theme: ViewerTheme,
  items: readonly ProjectedMapItem[],
): void {
  if (route.cellRoute.length < 2) return
  const longest = route.cellRoute.slice(1).map((to, index) => ({
    from: route.cellRoute[index]!,
    to,
    width: route.cellRoute[index]!.y === to.y ? Math.abs(to.x - route.cellRoute[index]!.x) : 0,
  })).sort((left, right) => right.width - left.width)[0]
  if (!longest || longest.width < 5) return
  const label = route.description.split(' ', level === 'components' ? 2 : 1).join(' ')
  const width = Math.min(label.length + 2, longest.width - 1)
  if (width < 3) return
  const span = { x: Math.round((longest.from.x + longest.to.x - width) / 2), y: longest.from.y, width, height: 1 }
  if (items.some(item => visibleIn(span, item.cellBounds))) return
  text(buffer, ` ${label.slice(0, width - 2)} `, span.x, span.y, width, theme.selected, theme.background, TextAttributes.BOLD)
}
