import { StyledText, TextAttributes } from '@opentui/core'
import type { RGBA, TextChunk } from '@opentui/core'

import { kindGlyph } from '../../atoms/kind.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { C4Kind } from '../../../types.ts'

/** One pane row: chunks the toolkit lays out left to right. */
export type Line = TextChunk[]

export interface PaneLines {
  lines: Line[]
  /** The row the pane keeps in view: the hierarchy cursor, or the command row the details cursor rests on. */
  cursor?: number
}

export function chunk(text: string, fg?: RGBA, attributes = 0, bg?: RGBA): TextChunk {
  return { __isChunk: true, text, ...(fg === undefined ? {} : { fg }), ...(bg === undefined ? {} : { bg }), attributes }
}

export const plain = (theme: ViewerTheme, text: string): TextChunk => chunk(text, theme.foreground)
export const dim = (theme: ViewerTheme, text: string): TextChunk => chunk(text, theme.foreground, TextAttributes.DIM)
export const bold = (theme: ViewerTheme, text: string): TextChunk => chunk(text, theme.foreground, TextAttributes.BOLD)
export const accent = (theme: ViewerTheme, text: string): TextChunk => chunk(text, theme.selected, TextAttributes.BOLD)
/** Quiet text in the palette's bright black. */
export const quietText = (theme: ViewerTheme, text: string): TextChunk => chunk(text, theme.quiet)
/** The cursor row: the accent behind default-background text, so it reads in any theme. */
export const inverse = (theme: ViewerTheme, text: string): TextChunk => chunk(text, theme.background, TextAttributes.BOLD, theme.selected)

/** The kind glyph; external systems stay dim. */
export function kindMark(theme: ViewerTheme, kind: C4Kind, external: boolean): TextChunk {
  return chunk(kindGlyph(kind), theme.foreground, external ? TextAttributes.DIM : 0)
}

export function lineWidth(line: Line): number {
  return line.reduce((width, part) => width + [...part.text].length, 0)
}

/** A row with the cursor is inverted edge to edge; a lit row reads in the accent; the rest keeps its chunks. */
export function styleRow(theme: ViewerTheme, line: Line, width: number, lit: boolean, cursor: boolean): Line {
  if (cursor) {
    const inverted = line.map(part => inverse(theme, part.text))
    const missing = width - lineWidth(inverted)
    return missing > 0 ? [...inverted, inverse(theme, ' '.repeat(missing))] : inverted
  }
  if (lit) return line.map(part => accent(theme, part.text))
  return line
}

export function styledLines(lines: readonly Line[]): StyledText {
  return new StyledText(lines.flatMap((line, index) => index === 0 ? line : [chunk('\n'), ...line]))
}

/** Word-wraps at the width, keeping a word that ends exactly on the last column. */
export function wrap(value: string, width: number): string[] {
  if (width <= 0 || value.length === 0) return []
  const lines: string[] = []
  let rest = value
  while (rest.length > 0) {
    if (rest.length <= width) {
      lines.push(rest)
      break
    }
    const breakAt = rest.slice(0, width + 1).lastIndexOf(' ')
    const take = breakAt <= 0 ? width : breakAt
    lines.push(rest.slice(0, take))
    rest = rest.slice(take).trimStart()
  }
  return lines
}
