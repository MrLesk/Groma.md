import { RGBA, TextAttributes } from '@opentui/core'
import type {
  NormalizedTerminalPalette,
  OptimizedBuffer,
} from '@opentui/core'

import type {
  Bounds,
  Origin,
  Point,
  ProjectedElement,
  ProjectedRelationship,
  WorldProjection,
} from '../types.ts'

export interface ViewerTheme extends Record<Origin, RGBA> {
  background: RGBA
  foreground: RGBA
  selected: RGBA
  observedTint: RGBA
}

function mix(left: RGBA, right: RGBA, rightWeight: number): RGBA {
  const leftValues = left.toInts()
  const rightValues = right.toInts()
  const mixed = leftValues.slice(0, 3).map((value, index) => {
    return Math.round(value * (1 - rightWeight) + rightValues[index]! * rightWeight)
  })
  return RGBA.fromInts(mixed[0]!, mixed[1]!, mixed[2]!)
}

export function themeFromPalette(palette: NormalizedTerminalPalette): ViewerTheme {
  const observed = palette.palette[2]
  const planned = palette.palette[4]
  const missing = palette.palette[1]

  return {
    background: palette.defaultBackground,
    foreground: palette.defaultForeground,
    observed,
    planned,
    missing,
    selected: observed,
    observedTint: mix(palette.defaultBackground, observed, 0.08),
  }
}

function inside(buffer: OptimizedBuffer, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < buffer.width && y < buffer.height
}

function cell(
  buffer: OptimizedBuffer,
  x: number,
  y: number,
  character: string,
  foreground: RGBA,
  background: RGBA,
  attributes = 0,
): void {
  if (inside(buffer, x, y)) {
    buffer.setCell(x, y, character, foreground, background, attributes)
  }
}

function text(
  buffer: OptimizedBuffer,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  foreground: RGBA,
  background: RGBA,
  attributes = 0,
): void {
  if (maxWidth <= 0 || y < 0 || y >= buffer.height) return
  const start = Math.max(0, x)
  const skipped = start - x
  const available = Math.min(maxWidth - skipped, buffer.width - start)
  if (available <= 0) return
  buffer.drawText(
    [...value].slice(skipped, skipped + available).join(''),
    start,
    y,
    foreground,
    background,
    attributes,
  )
}

type BorderStyle = 'card' | 'system' | 'container'

function borderCharacters(origin: Origin, style: BorderStyle) {
  if (origin === 'observed' && style === 'system') {
    return {
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      topLeft: '╔',
      topRight: '╗',
      vertical: '║',
    }
  }
  if (origin === 'observed') {
    return {
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      topLeft: '┌',
      topRight: '┐',
      vertical: '│',
    }
  }
  if (origin === 'planned') {
    return {
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '┄',
      topLeft: '┌',
      topRight: '┐',
      vertical: '┊',
    }
  }
  return {
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '┈',
    topLeft: '┌',
    topRight: '┐',
    vertical: '┊',
  }
}

function drawBorder(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  origin: Origin,
  color: RGBA,
  background: RGBA,
  style: BorderStyle = 'card',
  attributes = 0,
): void {
  const { x, y, width, height } = bounds
  if (width < 2 || height < 2) return
  const characters = borderCharacters(origin, style)

  for (let column = x + 1; column < x + width - 1; column += 1) {
    cell(buffer, column, y, characters.horizontal, color, background, attributes)
    cell(buffer, column, y + height - 1, characters.horizontal, color, background, attributes)
  }
  for (let row = y + 1; row < y + height - 1; row += 1) {
    cell(buffer, x, row, characters.vertical, color, background, attributes)
    cell(buffer, x + width - 1, row, characters.vertical, color, background, attributes)
  }
  cell(buffer, x, y, characters.topLeft, color, background, attributes)
  cell(buffer, x + width - 1, y, characters.topRight, color, background, attributes)
  cell(buffer, x, y + height - 1, characters.bottomLeft, color, background, attributes)
  cell(buffer, x + width - 1, y + height - 1, characters.bottomRight, color, background, attributes)
}

function visible(bounds: Bounds, viewport: Bounds): boolean {
  return bounds.x < viewport.x + viewport.width
    && bounds.x + bounds.width > viewport.x
    && bounds.y < viewport.y + viewport.height
    && bounds.y + bounds.height > viewport.y
}

function drawElement(
  buffer: OptimizedBuffer,
  element: ProjectedElement,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  const bounds = element.cellBounds
  if (element.display === 'hidden' || !visible(bounds, projection.viewport)) return

  const color = element.origin === 'observed'
    ? theme.foreground
    : theme[element.origin]
  const background = element.origin === 'observed'
    ? theme.observedTint
    : theme.background

  if (element.display === 'compact') {
    cell(
      buffer,
      bounds.x,
      bounds.y,
      '▌',
      theme[element.origin],
      theme.background,
      TextAttributes.DIM,
    )
    text(
      buffer,
      element.name,
      bounds.x + 2,
      bounds.y,
      Math.max(0, bounds.width - 2),
      theme.foreground,
      theme.background,
      TextAttributes.DIM,
    )
    return
  }

  const boundary = element.display.endsWith('-boundary')
  if (boundary) {
    const boundaryStyle: BorderStyle = element.display === 'system-boundary'
      ? 'system'
      : 'container'
    drawBorder(
      buffer,
      bounds,
      element.origin,
      color,
      theme.background,
      boundaryStyle,
      TextAttributes.DIM,
    )
    if (bounds.y < projection.viewport.y) {
      const characters = borderCharacters(element.origin, boundaryStyle)
      const left = Math.max(bounds.x, projection.viewport.x)
      const right = Math.min(
        bounds.x + bounds.width,
        projection.viewport.x + projection.viewport.width,
      )
      for (let column = left; column < right; column += 1) {
        cell(
          buffer,
          column,
          projection.viewport.y,
          characters.horizontal,
          color,
          theme.background,
          TextAttributes.DIM,
        )
      }
    }
    const chip = ` ${element.origin} `
    const titleX = Math.max(bounds.x + 2, projection.viewport.x + 1)
    const titleY = Math.max(bounds.y, projection.viewport.y)
    const titleRight = Math.min(
      bounds.x + bounds.width - 2,
      projection.viewport.x + projection.viewport.width - 1,
    )
    text(
      buffer,
      chip,
      titleX,
      titleY,
      Math.max(0, titleRight - titleX),
      theme[element.origin],
      background,
      TextAttributes.BOLD,
    )
    const title = ` ${element.kind.toUpperCase()} · ${element.name} `
    text(
      buffer,
      title,
      titleX + chip.length,
      titleY,
      Math.max(0, titleRight - titleX - chip.length),
      theme.foreground,
      background,
      TextAttributes.BOLD,
    )
    return
  }

  drawBorder(buffer, bounds, element.origin, color, background)

  const chip = ` ${element.origin} `
  if (bounds.width >= chip.length + 2) {
    text(
      buffer,
      chip,
      bounds.x + 1,
      bounds.y,
      Math.max(0, bounds.width - 2),
      theme[element.origin],
      background,
      TextAttributes.BOLD,
    )
  }
  if (bounds.height >= 3 && bounds.width >= 8) {
    text(
      buffer,
      element.name,
      bounds.x + 2,
      bounds.y + 1,
      Math.max(0, bounds.width - 4),
      theme.foreground,
      background,
      TextAttributes.BOLD,
    )
    const kind = element.external
      ? `EXTERNAL ${element.kind.toUpperCase()}`
      : element.kind.toUpperCase()
    text(
      buffer,
      kind,
      bounds.x + 2,
      bounds.y + 2,
      Math.max(0, bounds.width - 4),
      theme.foreground,
      background,
      TextAttributes.DIM,
    )
  }
}

function fillElement(
  buffer: OptimizedBuffer,
  element: ProjectedElement,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  const bounds = element.cellBounds
  if (element.display !== 'card'
    || element.origin !== 'observed'
    || bounds.width <= 2
    || bounds.height <= 2
    || !visible(bounds, projection.viewport)) return

  const x = Math.max(bounds.x + 1, projection.viewport.x)
  const y = Math.max(bounds.y + 1, projection.viewport.y)
  const right = Math.min(
    bounds.x + bounds.width - 1,
    projection.viewport.x + projection.viewport.width,
  )
  const bottom = Math.min(
    bounds.y + bounds.height - 1,
    projection.viewport.y + projection.viewport.height,
  )
  if (right > x && bottom > y) {
    buffer.fillRect(x, y, right - x, bottom - y, theme.observedTint)
  }
}

function drawLine(
  buffer: OptimizedBuffer,
  from: Point,
  to: Point,
  color: RGBA,
  background: RGBA,
  attributes: number,
): void {
  if (from.x === to.x) {
    const start = Math.min(from.y, to.y)
    const end = Math.max(from.y, to.y)
    for (let y = start; y <= end; y += 1) {
      cell(buffer, from.x, y, '│', color, background, attributes)
    }
    return
  }

  const start = Math.min(from.x, to.x)
  const end = Math.max(from.x, to.x)
  for (let x = start; x <= end; x += 1) {
    cell(buffer, x, from.y, '─', color, background, attributes)
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

function drawRoute(
  buffer: OptimizedBuffer,
  relationship: ProjectedRelationship,
  theme: ViewerTheme,
): void {
  const color = relationship.origin === 'observed'
    ? theme.foreground
    : theme[relationship.origin]
  for (let index = 1; index < relationship.cellRoute.length; index += 1) {
    drawLine(
      buffer,
      relationship.cellRoute[index - 1],
      relationship.cellRoute[index],
      color,
      theme.background,
      TextAttributes.DIM,
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
        TextAttributes.DIM,
      )
    }
  }
}

function arrowFor(from: Point, to: Point): string {
  if (to.x > from.x) return '▶'
  if (to.x < from.x) return '◀'
  if (to.y > from.y) return '▼'
  return '▲'
}

function drawRouteArrow(
  buffer: OptimizedBuffer,
  relationship: ProjectedRelationship,
  projection: WorldProjection,
  theme: ViewerTheme,
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
      relationship.origin === 'observed'
        ? theme.foreground
        : theme[relationship.origin],
      theme.background,
      TextAttributes.BOLD,
    )
  }

}

function drawRouteLabel(
  buffer: OptimizedBuffer,
  relationship: ProjectedRelationship,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  if (!relationship.cellLabel) return
  const fullLabel = projection.level === 'components'
    ? relationship.description.split(' ').slice(0, 2).join(' ')
    : relationship.description.split(' ', 1)[0]
  const maxWidth = Math.min(34, relationship.cellLabel.width + 2)
  const labelWidth = Math.max(1, maxWidth - 2)
  const label = fullLabel.length > labelWidth
    ? `${fullLabel.slice(0, Math.max(0, labelWidth - 1))}…`
    : fullLabel
  const padded = ` ${label} `
  text(
    buffer,
    padded,
    relationship.cellLabel.x - 1,
    relationship.cellLabel.y,
    maxWidth,
    theme.foreground,
    theme.background,
    TextAttributes.DIM,
  )
}

function drawSelection(
  buffer: OptimizedBuffer,
  selected: ProjectedElement | undefined,
  theme: ViewerTheme,
): void {
  if (!selected) return
  const bounds = {
    x: selected.cellBounds.x - 1,
    y: selected.cellBounds.y - 1,
    width: selected.cellBounds.width + 2,
    height: selected.cellBounds.height + 2,
  }
  drawBorder(buffer, bounds, 'observed', theme.selected, theme.background)
}

function drawChrome(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  const header = { x: 0, y: 0, width: buffer.width, height: 3 }
  const footer = { x: 0, y: buffer.height - 3, width: buffer.width, height: 3 }
  drawBorder(
    buffer,
    header,
    'observed',
    theme.foreground,
    theme.background,
    'card',
    TextAttributes.DIM,
  )
  drawBorder(
    buffer,
    footer,
    'observed',
    theme.foreground,
    theme.background,
    'card',
    TextAttributes.DIM,
  )

  text(
    buffer,
    `${projection.levelName} · ${projection.currentName}`,
    2,
    1,
    Math.max(0, buffer.width - 4),
    theme.foreground,
    theme.background,
    TextAttributes.BOLD,
  )

  const control = '- context | containers | components +'
  const hints = 'Esc exit'
  text(
    buffer,
    `${control}   ${hints}`,
    2,
    buffer.height - 2,
    Math.max(0, buffer.width - 4),
    theme.foreground,
    theme.background,
  )
  const current = projection.level
  const currentOffset = control.indexOf(current)
  text(
    buffer,
    current,
    2 + currentOffset,
    buffer.height - 2,
    current.length,
    theme.selected,
    theme.background,
    TextAttributes.BOLD,
  )
}

export function paintWorld(
  buffer: OptimizedBuffer,
  projection: WorldProjection,
  theme: ViewerTheme,
): void {
  buffer.clear(theme.background)
  buffer.pushScissorRect(
    projection.viewport.x,
    projection.viewport.y,
    projection.viewport.width,
    projection.viewport.height,
  )
  const elements = [...projection.elements].sort((left, right) => {
    return right.cellBounds.width * right.cellBounds.height
      - left.cellBounds.width * left.cellBounds.height
  })
  for (const element of elements) {
    fillElement(buffer, element, projection, theme)
  }
  for (const relationship of projection.relationships) {
    drawRoute(buffer, relationship, theme)
  }
  for (const element of elements) {
    drawElement(buffer, element, projection, theme)
  }
  for (const relationship of projection.relationships) {
    drawRouteLabel(buffer, relationship, projection, theme)
  }
  drawSelection(
    buffer,
    projection.elements.find(element => {
      return element.representationId === projection.currentId
    }),
    theme,
  )
  for (const relationship of projection.relationships) {
    drawRouteArrow(buffer, relationship, projection, theme)
  }
  buffer.popScissorRect()
  drawChrome(buffer, projection, theme)
}
