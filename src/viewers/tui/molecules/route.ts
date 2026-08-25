import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { visibleIn } from '../projection-camera.ts'
import type { ProjectedMapRoute, TerminalProjection } from '../projection.ts'
import type { Point } from '../../../types.ts'

function drawLine(
  buffer: OptimizedBuffer,
  from: Point,
  to: Point,
  color: RGBA,
  background: RGBA,
  attributes: number,
  horizontal: string,
  vertical: string,
  routeDistance: number,
  animationPhase?: number,
): void {
  const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  const stepX = Math.sign(to.x - from.x)
  const stepY = Math.sign(to.y - from.y)
  for (let distance = 0; distance <= length; distance += 1) {
    const pattern = (routeDistance + distance - (animationPhase ?? 0) + 3) % 3
    if (animationPhase !== undefined && pattern >= 2) continue
    cell(
      buffer,
      from.x + stepX * distance,
      from.y + stepY * distance,
      from.x === to.x ? vertical : horizontal,
      color,
      background,
      attributes,
    )
  }
}

function corner(previous: Point, point: Point, next: Point): string {
  const horizontal = previous.x === point.x ? next : previous
  const vertical = previous.x === point.x ? previous : next
  const left = horizontal.x < point.x
  const up = vertical.y < point.y
  if (left && up) return '╯'
  if (left) return '╮'
  if (up) return '╰'
  return '╭'
}

function arrow(from: Point, to: Point): string {
  if (to.x > from.x) return '▶'
  if (to.x < from.x) return '◀'
  if (to.y > from.y) return '▼'
  return '▲'
}

function routeColor(route: ProjectedMapRoute, theme: ViewerTheme, active: boolean): RGBA {
  if (active) return theme.selected
  return route.origin === 'planned' ? theme.planned : theme.missing
}

export function drawRoute(
  buffer: OptimizedBuffer,
  route: ProjectedMapRoute,
  projection: TerminalProjection,
  theme: ViewerTheme,
  active = false,
  traced = false,
  animationPhase?: number,
): void {
  if (route.cellRoute.length < 2) return
  const color = routeColor(route, theme, active)
  const attributes = active ? TextAttributes.BOLD : TextAttributes.DIM
  const horizontal = traced ? '━' : route.origin === 'observed' ? '─' : '╌'
  const vertical = traced ? '┃' : route.origin === 'observed' ? '│' : '┆'
  let routeDistance = 0
  for (let index = 1; index < route.cellRoute.length; index += 1) {
    const from = route.cellRoute[index - 1]!
    const to = route.cellRoute[index]!
    drawLine(
      buffer,
      from,
      to,
      color,
      theme.background,
      attributes,
      horizontal,
      vertical,
      routeDistance,
      active ? animationPhase : undefined,
    )
    routeDistance += Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  }
  for (let index = 1; index < route.cellRoute.length - 1; index += 1) {
    const previous = route.cellRoute[index - 1]!
    const point = route.cellRoute[index]!
    const next = route.cellRoute[index + 1]!
    if ((previous.x === point.x) !== (next.x === point.x)) {
      cell(buffer, point.x, point.y, corner(previous, point, next), color, theme.background, attributes)
    }
  }
  const first = route.cellRoute[0]!
  const last = route.cellRoute.at(-1)!
  const before = route.cellRoute.at(-2)!
  if (visibleIn({ ...first, width: 1, height: 1 }, projection.viewport)) {
    cell(buffer, first.x, first.y, '●', color, theme.background, TextAttributes.BOLD)
  }
  if (visibleIn({ ...last, width: 1, height: 1 }, projection.viewport)) {
    cell(buffer, last.x, last.y, arrow(before, last), color, theme.background, TextAttributes.BOLD)
  }
}

export function drawRouteLabel(
  buffer: OptimizedBuffer,
  route: ProjectedMapRoute,
  projection: TerminalProjection,
  theme: ViewerTheme,
  active: boolean,
): void {
  if (!active || route.cellRoute.length < 2) return
  const longest = route.cellRoute.slice(1).map((to, index) => ({
    from: route.cellRoute[index]!,
    to,
    width: route.cellRoute[index]!.y === to.y ? Math.abs(to.x - route.cellRoute[index]!.x) : 0,
  })).sort((left, right) => right.width - left.width)[0]
  if (!longest || longest.width < 5) return
  const label = route.description.split(' ', projection.level === 'components' ? 2 : 1).join(' ')
  const width = Math.min(label.length + 2, longest.width - 1)
  if (width < 3) return
  const x = Math.round((longest.from.x + longest.to.x - width) / 2)
  text(
    buffer,
    ` ${label.slice(0, width - 2)} `,
    x,
    longest.from.y,
    width,
    theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
}
