import type { AnnotatedElement, Point } from '../../../types.ts'
import type { MapFrame } from '../chrome/shell.ts'
import { pan, type Camera } from '../iso/camera.ts'
import { detailsTabAfterSelection, type DetailsTab } from '../organisms/details.ts'
import { noSelection, primarySelection, selectArchitecture, type Selection } from '../selection.ts'
import { createSearchControl } from './control.ts'

interface SearchViewState {
  selection: Selection
  camera: Camera
  touched: boolean
  detailsTab: DetailsTab
}

interface SearchSessionOptions {
  root: HTMLElement
  elements: readonly AnnotatedElement[]
  snapshot(): SearchViewState
  apply(state: SearchViewState, commitUrl: boolean): void
  previewMap(elementId: string | undefined, camera?: Camera): void
  clearSource(): void
  anchorOf(id: string): Point | undefined
  viewport(): MapFrame
}

function reveal(camera: Camera, point: Point | undefined, frame: MapFrame): Camera | undefined {
  if (point === undefined) return undefined
  const margin = Math.min(80, frame.width / 4, frame.height / 4)
  const screen = { x: point.x * camera.k + camera.x, y: point.y * camera.k + camera.y }
  const dx = screen.x < frame.x + margin
    ? frame.x + margin - screen.x
    : screen.x > frame.x + frame.width - margin
      ? frame.x + frame.width - margin - screen.x
      : 0
  const dy = screen.y < frame.y + margin
    ? frame.y + margin - screen.y
    : screen.y > frame.y + frame.height - margin
      ? frame.y + frame.height - margin - screen.y
      : 0
  return dx === 0 && dy === 0 ? undefined : pan(camera, dx, dy)
}

/** Owns transient map preview and the opening snapshot restored on cancel. */
export function createSearchSession(options: SearchSessionOptions) {
  let returnState: SearchViewState | undefined
  return createSearchControl({
    root: options.root,
    elements: options.elements,
    onOpen() {
      returnState = options.snapshot()
    },
    onPreview(id) {
      if (id === undefined) {
        options.previewMap(undefined)
        return
      }
      const current = options.snapshot()
      const camera = reveal(current.camera, options.anchorOf(id), options.viewport())
      options.previewMap(id, camera)
    },
    onAccept(id) {
      const current = options.snapshot()
      returnState = undefined
      options.clearSource()
      options.apply({
        ...current,
        selection: selectArchitecture(noSelection, id, false),
        detailsTab: detailsTabAfterSelection(current.detailsTab, primarySelection(current.selection), id),
      }, true)
    },
    onCancel() {
      const previous = returnState
      returnState = undefined
      if (previous === undefined) return
      options.apply(previous, false)
    },
  })
}
