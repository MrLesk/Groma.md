import {
  BoxRenderable,
  FrameBufferRenderable,
  ScrollBoxRenderable,
  TextRenderable,
} from '@opentui/core'
import type { CliRenderer, RGBA } from '@opentui/core'

import type { Bounds } from '../../../types.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { DETAILS_PANE_WIDTH, HIERARCHY_PANE_WIDTH } from '../layout.ts'
import type { ViewerFocus } from '../navigation.ts'
import { DETAILS_TABS, DETAILS_TAB_NAMES } from './details.ts'
import { headerLine } from './chrome.ts'
import { scrollOffset } from './hierarchy.ts'
import { accent, plain, quietText, styledLines, type Line, type PaneLines } from './text.ts'

/** Columns a hierarchy row may use: the pane minus its frame. */
export const HIERARCHY_CONTENT_WIDTH = HIERARCHY_PANE_WIDTH - 2
/** Columns a details row may use: the pane minus its frame and one column of inset each side. */
export const DETAILS_CONTENT_WIDTH = DETAILS_PANE_WIDTH - 4

export interface DetailsView {
  title: string
  titleColor: RGBA
  /** The open tab; absent for flows and tasks, which have no tabs. */
  tab?: number
  lines: PaneLines
  /** The first hidden row the reducer asked for; the cursor row still stays in view. */
  scroll: number
}

export interface ScreenView {
  stats: string | undefined
  focus: ViewerFocus
  footer: string
  /** Absent while the hierarchy pane is folded. */
  hierarchy: PaneLines | undefined
  /** The kind legend under the tree; absent in Work focus. */
  legend: Line[] | undefined
  /** Absent while the details pane is folded. */
  details: DetailsView | undefined
  recap: Line | undefined
}

export interface Screen {
  /** The map's own buffer; the painter draws in its local cells. */
  map: FrameBufferRenderable
  mapViewport(): Bounds
  apply(view: ScreenView): void
  destroy(): void
}

export interface ScreenHandlers {
  onMapResize(): void
  /** A click on a hierarchy row, by the id the row stands for. */
  onHierarchyRow(id: string): void
  /** A click on the map, in the map's own cells. */
  onMapCell(x: number, y: number): void
}

const noFill = { shouldFill: false } as const

interface ScrollPane {
  box: ScrollBoxRenderable
  text: TextRenderable
  /** Scrolls to the row; repeated once the toolkit has laid out new content, since it clamps to the old size. */
  show(row: number): void
}

function scrollPane(renderer: CliRenderer, paddingX: number, onRow?: (row: number) => void): ScrollPane {
  const box = new ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    scrollX: false,
    scrollY: true,
    focusable: false,
    rootOptions: noFill,
    wrapperOptions: noFill,
    viewportOptions: noFill,
    contentOptions: { ...noFill, paddingX },
  })
  // The panes scroll from state; the toolkit's scrollbar would take a column and follow the mouse.
  box.verticalScrollBar.visible = false
  box.horizontalScrollBar.visible = false
  let wanted = 0
  const text = new TextRenderable(renderer, {
    wrapMode: 'none',
    content: '',
    onSizeChange() {
      box.scrollTo(wanted)
      box.requestRender()
    },
    onMouseDown(event) {
      onRow?.(event.y - text.y)
    },
  })
  box.add(text)
  return {
    box,
    text,
    show(row) {
      wanted = row
      box.scrollTo(row)
    },
  }
}

/** The two details tabs, the open one in the accent. */
function tabLine(theme: ViewerTheme, open: number): Line {
  return DETAILS_TABS.flatMap((tab, index) => [
    plain(theme, index === 0 ? ' ' : '  '),
    index === open ? accent(theme, DETAILS_TAB_NAMES[tab]) : quietText(theme, DETAILS_TAB_NAMES[tab]),
  ])
}

/** The hierarchy keeps its cursor row centred. */
function centred(pane: PaneLines, height: number): number {
  return pane.cursor === undefined ? 0 : scrollOffset(pane.cursor, pane.lines.length, height)
}

/** The details keep the requested first row unless the cursor row would leave the window. */
function keptInView(pane: PaneLines, requested: number, height: number): number {
  let scroll = Math.max(0, Math.min(requested, Math.max(0, pane.lines.length - height)))
  if (pane.cursor !== undefined && height > 0) {
    if (pane.cursor < scroll) scroll = pane.cursor
    if (pane.cursor >= scroll + height) scroll = pane.cursor - height + 1
  }
  return scroll
}

/**
 * The fixed chrome as toolkit renderables: one blank row, the header, the hierarchy pane,
 * the map with its recap row, the details pane, the footer, one blank row. Panes reserve
 * their columns and never overlay the map.
 */
export function mountScreen(renderer: CliRenderer, theme: ViewerTheme, handlers: ScreenHandlers): Screen {
  const root = new BoxRenderable(renderer, {
    id: 'groma-screen', width: '100%', height: '100%', flexDirection: 'column', paddingTop: 1, paddingBottom: 1, ...noFill,
  })
  const header = new TextRenderable(renderer, { height: 1, content: '' })
  const body = new BoxRenderable(renderer, { flexGrow: 1, flexDirection: 'row', ...noFill })
  const footer = new TextRenderable(renderer, { height: 1, content: '' })

  const hierarchyBox = new BoxRenderable(renderer, {
    width: HIERARCHY_PANE_WIDTH, height: '100%', flexDirection: 'column', border: true, borderStyle: 'rounded', borderColor: theme.quiet, ...noFill,
  })
  let hierarchyIds: readonly (string | undefined)[] | undefined
  const hierarchy = scrollPane(renderer, 0, row => {
    const id = hierarchyIds?.[row]
    if (id !== undefined) handlers.onHierarchyRow(id)
  })
  const legend = new TextRenderable(renderer, { height: 3, content: '', wrapMode: 'none' })
  hierarchyBox.add(hierarchy.box)
  hierarchyBox.add(legend)

  const mapBox = new BoxRenderable(renderer, {
    flexGrow: 1, height: '100%', flexDirection: 'column', border: true, borderStyle: 'rounded', borderColor: theme.selected, ...noFill,
  })
  const map = new FrameBufferRenderable(renderer, {
    width: 1,
    height: 1,
    flexGrow: 1,
    onSizeChange: handlers.onMapResize,
    onMouseDown(event) {
      handlers.onMapCell(event.x - map.x, event.y - map.y)
    },
  })
  map.width = '100%'
  const recap = new TextRenderable(renderer, { height: 1, content: '', wrapMode: 'none' })
  mapBox.add(map)
  mapBox.add(recap)

  const detailsBox = new BoxRenderable(renderer, {
    width: DETAILS_PANE_WIDTH, height: '100%', flexDirection: 'column', border: true, borderStyle: 'rounded', borderColor: theme.quiet, ...noFill,
  })
  const tabs = new TextRenderable(renderer, { height: 1, content: '', wrapMode: 'none' })
  const details = scrollPane(renderer, 1)
  detailsBox.add(tabs)
  detailsBox.add(details.box)

  body.add(hierarchyBox)
  body.add(mapBox)
  body.add(detailsBox)
  root.add(header)
  root.add(body)
  root.add(footer)
  renderer.root.add(root)

  const applyDetails = (view: DetailsView | undefined): void => {
    detailsBox.visible = view !== undefined
    if (view === undefined) return
    detailsBox.title = ` ${view.title} `
    detailsBox.titleColor = view.titleColor
    tabs.visible = view.tab !== undefined
    if (view.tab !== undefined) tabs.content = styledLines([tabLine(theme, view.tab)])
    details.text.content = styledLines(view.lines.lines)
    details.show(keptInView(view.lines, view.scroll, details.box.viewport.height))
  }

  return {
    map,
    mapViewport() {
      return { x: 0, y: 0, width: Math.max(1, map.frameBuffer.width), height: Math.max(1, map.frameBuffer.height) }
    },
    apply(view) {
      header.content = styledLines([headerLine(theme, renderer.width, view.stats)])
      footer.content = styledLines([[plain(theme, ` ${view.footer}`)]])
      hierarchyBox.visible = view.hierarchy !== undefined
      hierarchyBox.borderColor = view.focus === 'hierarchy' ? theme.selected : theme.quiet
      mapBox.borderColor = view.focus === 'architecture' ? theme.selected : theme.quiet
      detailsBox.borderColor = view.focus === 'details' ? theme.selected : theme.quiet
      hierarchyIds = view.hierarchy?.ids
      if (view.hierarchy !== undefined) {
        hierarchy.text.content = styledLines(view.hierarchy.lines)
        hierarchy.show(centred(view.hierarchy, hierarchy.box.viewport.height))
      }
      legend.visible = view.legend !== undefined
      if (view.legend !== undefined) legend.content = styledLines(view.legend)
      recap.content = view.recap === undefined ? '' : styledLines([view.recap])
      applyDetails(view.details)
    },
    destroy() {
      renderer.root.remove(root)
      root.destroyRecursively()
    },
  }
}
