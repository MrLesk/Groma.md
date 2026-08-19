import { TextAttributes } from '@opentui/core'
import type { OptimizedBuffer, RGBA } from '@opentui/core'

import { drawBorder } from '../atoms/border.ts'
import { kindGlyph, kindLabel } from '../atoms/kind.ts'
import { text } from '../atoms/text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { actionCaption, outgoingActions, travelledBy } from '../../action-path.ts'
import type { DetailsTab } from '../navigation.ts'
import {
  parentOfElements,
  promotedPeer,
} from '../../relationship-text.ts'
import type {
  ArchitectureWorld,
  Bounds,
  WorkMarker,
  WorldElement,
} from '../../../types.ts'

interface Span {
  value: string
  foreground: RGBA
  attributes: number
}

function wrap(value: string, width: number): string[] {
  if (width <= 0 || value.length === 0) return []
  const lines: string[] = []
  let rest = value
  while (rest.length > 0) {
    if (rest.length <= width) {
      lines.push(rest)
      break
    }
    const slice = rest.slice(0, width)
    const breakAt = slice.lastIndexOf(' ')
    if (breakAt <= 0) {
      lines.push(slice)
      rest = rest.slice(width)
    } else {
      lines.push(slice.slice(0, breakAt))
      rest = rest.slice(breakAt + 1)
    }
  }
  return lines
}

function detailsRows(
  element: WorldElement,
  world: ArchitectureWorld,
  theme: ViewerTheme,
  width: number,
  tab: DetailsTab,
  activeActionId: string | undefined,
  actionCursor: string | undefined,
  work: readonly WorkMarker[],
): { rows: Span[][]; cursorLine?: number } {
  const plain = (value: string): Span => {
    return { value, foreground: theme.foreground, attributes: 0 }
  }
  const dim = (value: string): Span => {
    return { value, foreground: theme.foreground, attributes: TextAttributes.DIM }
  }
  const header = (value: string): Span => {
    return dim(`${value} ${'─'.repeat(Math.max(0, width - value.length - 1))}`)
  }
  // The picked command renders in the accent, like its path on the map.
  const accented = (id: string) => id === activeActionId
    ? (span: Span): Span => ({
        ...span,
        foreground: theme.selected,
        attributes: TextAttributes.BOLD,
      })
    : (span: Span): Span => span

  const mark = (kind: WorldElement['kind'], external = false): Span => {
    return {
      value: kindGlyph(kind),
      foreground: theme[kind],
      attributes: external ? TextAttributes.DIM : 0,
    }
  }
  const tabSpan = (label: string, active: boolean): Span => active
    ? { value: label, foreground: theme.selected, attributes: TextAttributes.BOLD }
    : dim(label)
  const rows: Span[][] = [[
    mark(element.kind, element.external),
    {
      value: ` ${kindLabel(element.kind, element.external)}`,
      foreground: theme[element.kind],
      attributes: element.external ? TextAttributes.DIM : 0,
    },
    dim(' · '),
    { value: element.origin, foreground: theme[element.origin], attributes: TextAttributes.BOLD },
  ]]
  rows.push([], [
    tabSpan('What it does', tab === 'what'),
    plain('   '),
    tabSpan('How it\'s built', tab === 'how'),
  ])

  let cursorLine: number | undefined

  if (work.length > 0) {
    rows.push([], [header('Work')])
    for (const marker of work) {
      rows.push([plain(marker.assignees.join(', ')), dim(` · ${marker.taskId}`)])
      for (const row of wrap(marker.taskTitle, width)) rows.push([dim(row)])
    }
  }

  if (tab === 'how') {
    const technology = (element.technology ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(part => part.length > 0)
    if (technology.length > 0) {
      rows.push([], [header('Technology')])
      rows.push([plain(technology.join(' · '))])
    }

    if (element.code.length > 0) {
      rows.push([], [header('Code')])
      const files = new Set(element.code.map(reference => reference.file)).size
      if ((element.codeLines ?? 0) > 0) {
        rows.push([dim(
          `${files} ${files === 1 ? 'file' : 'files'} · ~${element.codeLines} lines`,
        )])
      }
      for (const reference of element.code) {
        rows.push([plain(reference.file)])
        rows.push([dim(
          reference.symbol === undefined
            ? reference.scanner
            : `${reference.symbol} · ${reference.scanner}`,
        )])
      }
    }

    const travelled = travelledBy(element.representationId, world)
    if (travelled.length > 0) {
      rows.push([], [header('Travelled by')])
      for (const walk of travelled) {
        if (walk.id === actionCursor) cursorLine = rows.length
        rows.push([dim('→ '), plain(walk.description)].map(accented(walk.id)))
      }
    }
    return { rows, cursorLine }
  }

  if (element.description) {
    rows.push([])
    for (const row of wrap(element.description, width)) rows.push([plain(row)])
  }

  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const parentOf = parentOfElements(world.elements)
  const actions = outgoingActions(element.representationId, world)
  const actionIds = new Set(actions.map(item => item.id))
  const incoming = world.relationships.filter(relationship => {
    return promotedPeer(relationship, element.representationId, parentOf)?.outgoing === false
  })
  const relationships = [...actions, ...incoming]
  if (relationships.length > 0) {
    rows.push([], [header('Relationships')])
    for (const relationship of relationships) {
      const outgoing = actionIds.has(relationship.id)
      const arrow = outgoing ? '→ ' : '← '
      const ends = promotedPeer(relationship, element.representationId, parentOf)
      const otherId = outgoing ? relationship.target : ends?.peerId ?? relationship.source
      const peer = byId.get(otherId)
      const caption = actionCaption(
        relationship,
        outgoing,
        id => byId.get(id)?.name,
      )
      const rest = caption.detail === '' ? '' : ` · ${caption.detail}`
      const peerMark = outgoing || peer === undefined
        ? []
        : [mark(peer.kind, peer.external), plain(' ')]
      const markWidth = peerMark.length === 0 ? 0 : 2
      if (relationship.id === actionCursor) cursorLine = rows.length
      const style = accented(relationship.id)
      if (arrow.length + markWidth + caption.title.length + rest.length <= width) {
        rows.push([dim(arrow), ...peerMark, plain(caption.title), dim(rest)].map(style))
      } else {
        rows.push([dim(arrow), ...peerMark, plain(caption.title)].map(style))
        if (caption.detail !== '') {
          for (const row of wrap(caption.detail, width - arrow.length)) {
            rows.push([style(dim(`${' '.repeat(arrow.length)}${row}`))])
          }
        }
      }
    }
  }

  if (element.children.length > 0) {
    rows.push([], [header('Children')])
    for (const childId of element.children) {
      const child = byId.get(childId)
      if (child === undefined) {
        rows.push([plain(childId)])
        continue
      }
      rows.push([mark(child.kind, child.external), plain(` ${child.name}`)])
    }
  }

  return { rows, cursorLine }
}

export function drawDetails(
  buffer: OptimizedBuffer,
  bounds: Bounds,
  element: WorldElement,
  world: ArchitectureWorld,
  theme: ViewerTheme,
  view: {
    focused: boolean
    scroll: number
    tab: DetailsTab
    activeActionId?: string
    actionCursor?: string
    work: WorkMarker[]
  },
): void {
  const background = theme.background
  const color = view.focused
    ? theme.selected
    : element.origin === 'observed' ? theme.foreground : theme[element.origin]
  const width = Math.max(0, bounds.width - 4)
  const { rows, cursorLine } = detailsRows(
    element,
    world,
    theme,
    width,
    view.tab,
    view.activeActionId,
    view.actionCursor,
    view.work,
  )
  if (bounds.width > 0 && bounds.height > 0) {
    buffer.fillRect(bounds.x, bounds.y, bounds.width, bounds.height, background)
  }
  drawBorder(buffer, bounds, element.origin, color, background)
  text(
    buffer,
    ` ${element.name} `,
    bounds.x + 2,
    bounds.y,
    width,
    theme[element.origin],
    background,
    TextAttributes.BOLD,
  )

  const visibleRows = Math.max(0, bounds.height - 2)
  let scroll = Math.max(0, Math.min(view.scroll, Math.max(0, rows.length - visibleRows)))
  if (cursorLine !== undefined && visibleRows > 0) {
    if (cursorLine < scroll) scroll = cursorLine
    if (cursorLine >= scroll + visibleRows) scroll = cursorLine - visibleRows + 1
  }
  const maxY = bounds.y + bounds.height - 2
  let y = bounds.y + 1
  for (const [index, row] of rows.entries()) {
    if (index < scroll) continue
    if (y > maxY) return
    const cursor = index === cursorLine
    if (cursor) {
      buffer.fillRect(bounds.x + 1, y, Math.max(0, bounds.width - 2), 1, theme.selectedTint)
    }
    let x = bounds.x + 2
    for (const span of row) {
      const available = width - (x - bounds.x - 2)
      if (available <= 0) break
      text(
        buffer,
        span.value,
        x,
        y,
        available,
        cursor ? theme.selected : span.foreground,
        cursor ? theme.selectedTint : background,
        span.attributes,
      )
      x += [...span.value].length
    }
    y += 1
  }
}
