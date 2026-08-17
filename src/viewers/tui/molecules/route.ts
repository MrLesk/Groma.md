import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { cell } from '../atoms/cell.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { visible } from '../atoms/visible.ts'
import { parentOfElements, showsRelationshipText } from '../../relationship-text.ts'
import type { Point, ProjectedRelationship, WorldProjection } from '../../../types.ts'

function drawLine(
  buffer: OptimizedBuffer,
  from: Point,
  to: Point,
  color: RGBA,
  background: RGBA,
  attributes: number,
  characters: { horizontal: string; vertical: string },
): void {
  if (from.x === to.x) {
    const start = Math.min(from.y, to.y)
    const end = Math.max(from.y, to.y)
    for (let y = start; y <= end; y += 1) {
      cell(buffer, from.x, y, characters.vertical, color, background, attributes)
    }
    return
  }

  const start = Math.min(from.x, to.x)
  const end = Math.max(from.x, to.x)
  for (let x = start; x <= end; x += 1) {
    cell(buffer, x, from.y, characters.horizontal, color, background, attributes)
  }
}

function cornerFor(previous: Point, point: Point, next: Point): string {
  const horizontal = previous.x === point.x ? next : previous
  const vertical = previous.x === point.x ? previous : next
  const left = horizontal.x < point.x
  const up = vertical.y < point.y
  if (left && up) return '┘'
  if (left) return '┐'
  if (up) return '└'
  return '┌'
}

function arrowFor(from: Point, to: Point): string {
  if (to.x > from.x) return '▶'
  if (to.x < from.x) return '◀'
  if (to.y > from.y) return '▼'
  return '▲'
}

export function drawRoute(
  buffer: OptimizedBuffer,
  relationship: ProjectedRelationship,
  theme: ViewerTheme,
  dimmed = false,
  lit = false,
): void {
  const color = lit
    ? theme.selected
    : relationship.origin === 'observed'
      ? theme.foreground
      : theme[relationship.origin]
  const attributes = lit ? TextAttributes.BOLD : dimmed ? TextAttributes.DIM : 0
  const characters = relationship.origin === 'observed'
    ? { horizontal: '─', vertical: '│' }
    : { horizontal: '╌', vertical: '┆' }

  for (let index = 1; index < relationship.cellRoute.length; index += 1) {
    drawLine(
      buffer,
      relationship.cellRoute[index - 1],
      relationship.cellRoute[index],
      color,
      theme.background,
      attributes,
      characters,
    )
  }
  for (let index = 1; index < relationship.cellRoute.length - 1; index += 1) {
    const previous = relationship.cellRoute[index - 1]
    const point = relationship.cellRoute[index]
    const next = relationship.cellRoute[index + 1]
    if ((previous.x === point.x) !== (next.x === point.x)) {
      cell(
        buffer,
        point.x,
        point.y,
        cornerFor(previous, point, next),
        color,
        theme.background,
        attributes,
      )
    }
  }
}

export function drawRouteArrow(
  buffer: OptimizedBuffer,
  relationship: ProjectedRelationship,
  projection: WorldProjection,
  theme: ViewerTheme,
  lit = false,
): void {
  const route = relationship.cellRoute
  const target = route.at(-1)
  if (!target) return
  let previousIndex = route.length - 2
  while (previousIndex >= 0
    && route[previousIndex]!.x === target.x
    && route[previousIndex]!.y === target.y) {
    previousIndex -= 1
  }
  if (previousIndex >= 0 && visible({ ...target, width: 1, height: 1 }, projection.viewport)) {
    cell(
      buffer,
      target.x,
      target.y,
      arrowFor(route[previousIndex]!, target),
      lit
        ? theme.selected
        : relationship.origin === 'observed'
          ? theme.foreground
          : theme[relationship.origin],
      theme.background,
      TextAttributes.BOLD,
    )
  }
}

export function drawRouteLabel(
  buffer: OptimizedBuffer,
  relationship: ProjectedRelationship,
  projection: WorldProjection,
  theme: ViewerTheme,
  lit = false,
): void {
  if (!relationship.cellLabel) return
  if (!lit && !showsRelationshipText(
    relationship,
    projection.currentId,
    parentOfElements(projection.elements),
  )) return
  const fullLabel = projection.level === 'components'
    ? relationship.description.split(' ').slice(0, 2).join(' ')
    : relationship.description.split(' ', 1)[0]
  const maxWidth = Math.min(34, relationship.cellLabel.width + 2)
  const labelWidth = Math.max(1, maxWidth - 2)
  const label = fullLabel.length > labelWidth
    ? `${fullLabel.slice(0, Math.max(0, labelWidth - 1))}…`
    : fullLabel
  text(
    buffer,
    ` ${label} `,
    relationship.cellLabel.x - 1,
    relationship.cellLabel.y,
    maxWidth,
    lit ? theme.selected : theme.foreground,
    theme.background,
    lit ? TextAttributes.BOLD : TextAttributes.DIM,
  )
}
