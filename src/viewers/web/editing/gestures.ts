import type { AnnotatedElement, Point } from '../../../types.ts'
import { createRelateDialog } from '../chrome/relate.ts'
import type { WebDataSource } from '../data.ts'
import type { IsoMap } from '../iso/map.ts'
import { svg } from '../iso/svg.ts'
import { createDialog } from './create.ts'
import { creationParent, enclosed, gestureBounds, type CreationKind } from './intent.ts'

export const editorCss = `
  /* Hidden while the map editing interaction is unfinished. */
  #map-tools { position: absolute; left: calc(var(--hierarchy-inset) + 24px); top: 74px; z-index: 4;
    display: none; flex-direction: column; gap: 5px; padding: 6px; border: 1px solid var(--hairline); border-radius: 10px;
    background: var(--chrome-surface); backdrop-filter: blur(18px); }
  #map-tools[hidden] { display: none; }
  #map-tools button { padding: 7px 10px; text-align: left; color: var(--ink); background: transparent; border: 0; border-radius: 5px; cursor: pointer; touch-action: none; }
  #map-tools button[aria-pressed=true] { background: var(--hover); outline: 1px solid var(--highlight); }
  #map-tools [data-create] { cursor: grab; }
  #editor-error { max-width: 180px; margin: 4px 10px; color: var(--highlight-text); }
  #editor-error:empty { display: none; }
  .gesture-preview { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 10; pointer-events: none; }
  .gesture-preview rect, .gesture-preview line { fill: color-mix(in srgb, var(--highlight) 8%, transparent); stroke: var(--highlight); stroke-width: 2; stroke-dasharray: 5 4; }
  .gesture-preview text { fill: var(--ink); font: 13px system-ui; }
  #map .map-surface[data-editing], #map .map-surface[data-editing] [data-id] { cursor: crosshair; }
`

type Tool = 'group' | 'connect'
type Gesture = { pointerId: number; start: Point; end: Point } &
  ({ tool: CreationKind } | { tool: 'group' } | { tool: 'connect'; source: string })

/** Transient screen gestures choose semantic inputs. Core owns the resulting geometry. */
export function createMapEditor(host: HTMLElement, map: IsoMap, data: WebDataSource, elements: () => readonly AnnotatedElement[], live: () => boolean) {
  const toolbar = document.createElement('div')
  toolbar.id = 'map-tools'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Architecture editing')
  toolbar.setAttribute('aria-orientation', 'vertical')
  const error = document.createElement('p')
  error.id = 'editor-error'
  error.setAttribute('role', 'status')
  host.append(toolbar)
  const preview = svg('svg', {}, 'gesture-preview')
  const create = createDialog(data)
  const relate = data.draft === undefined ? undefined : createRelateDialog(data.draft)
  let tool: Tool | undefined
  let gesture: Gesture | undefined
  const enabled = (): boolean => live() && data.draft !== undefined && data.add !== undefined
  const element = (id: string | undefined): AnnotatedElement | undefined => elements().find(item => item.id === id)
  const hit = (point: Point): string | undefined => map.hitId(document.elementFromPoint(point.x, point.y))
  const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY })

  function choose(next: Tool | undefined): void {
    tool = next
    map.svg.toggleAttribute('data-editing', next !== undefined)
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]')) button.setAttribute('aria-pressed', String(button.dataset.tool === next))
  }

  function cancel(): void {
    gesture = undefined
    preview.remove()
    choose(undefined)
    error.textContent = ''
  }

  function start(event: PointerEvent, next: Gesture): void {
    event.preventDefault()
    event.stopImmediatePropagation()
    error.textContent = ''
    gesture = next
    document.body.append(preview)
    paintPreview(next)
  }

  for (const kind of ['system', 'container', 'component'] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = `+ ${kind[0]!.toUpperCase()}${kind.slice(1)}`
    button.dataset.create = kind
    button.title = `Drag to create a draft ${kind}`
    button.addEventListener('pointerdown', event => {
      if (!enabled() || event.button !== 0) return
      choose(undefined)
      start(event, { tool: kind, pointerId: event.pointerId, start: pointOf(event), end: pointOf(event) })
    })
    toolbar.append(button)
  }
  for (const mode of ['group', 'connect'] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.tool = mode
    button.textContent = mode === 'group' ? 'Group' : 'Connect'
    button.title = mode === 'group' ? 'Draw around sibling components' : 'Drag from a source component to a target component'
    button.addEventListener('click', () => choose(tool === mode ? undefined : mode))
    toolbar.append(button)
  }
  toolbar.append(error)
  map.svg.addEventListener('pointerdown', event => {
    if (!enabled() || tool === undefined || event.button !== 0) return
    const base = { pointerId: event.pointerId, start: pointOf(event), end: pointOf(event) }
    if (tool === 'group') start(event, { ...base, tool })
    else {
      const source = element(map.hitId(event.target))
      if (source?.kind === 'component') start(event, { ...base, tool, source: source.id })
      else { event.stopImmediatePropagation(); error.textContent = 'Start on a component' }
    }
  }, { capture: true })

  function paintPreview(current: Gesture): void {
    preview.replaceChildren()
    if (current.tool === 'group') preview.append(svg('rect', { ...gestureBounds(current.start, current.end) }))
    else if (current.tool === 'connect') preview.append(svg('line', { x1: current.start.x, y1: current.start.y, x2: current.end.x, y2: current.end.y }))
    else {
      const label = svg('text', { x: current.end.x + 12, y: current.end.y - 12 })
      label.textContent = `+ Draft ${current.tool}`
      preview.append(label)
    }
  }

  function membersOf(current: Gesture): string[] {
    const bounds = gestureBounds(current.start, current.end)
    return [...map.svg.querySelectorAll<SVGGElement>('.building.component[data-id]')]
      .filter(node => enclosed(bounds, node.getBoundingClientRect()))
      .map(node => node.dataset.id!)
  }

  function connect(current: Gesture & { tool: 'connect'; source: string }): void {
      const target = element(hit(current.end))
      if (target?.kind !== 'component' || target.id === current.source) throw new Error('End on another component')
      relate?.open({ source: current.source, target: target.id, sourceTitle: element(current.source)!.title, targetTitle: target.title })
  }

  function finish(current: Gesture): void {
    if (!enabled()) return
    if (current.tool === 'group') {
      const members = membersOf(current)
      if (members.length === 0) throw new Error('Draw around at least one component')
      create.open({ kind: 'group', members })
    } else if (current.tool === 'connect') {
      connect(current)
    } else {
      if (!map.svg.contains(document.elementFromPoint(current.end.x, current.end.y))) return
      const parent = creationParent(elements(), current.tool, hit(current.end))
      create.open({ kind: current.tool, parent, parentTitle: element(parent)?.title })
    }
  }

  document.addEventListener('pointermove', event => {
    if (gesture === undefined || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    gesture.end = pointOf(event)
    paintPreview(gesture)
  }, { passive: false })
  document.addEventListener('pointerup', event => {
    if (gesture === undefined || gesture.pointerId !== event.pointerId) return
    const completed = { ...gesture, end: pointOf(event) }
    cancel()
    try { finish(completed) } catch (cause) { error.textContent = cause instanceof Error ? cause.message : String(cause) }
  })
  document.addEventListener('pointercancel', cancel)
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || (tool === undefined && gesture === undefined)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    cancel()
  }, { capture: true })
  return {
    cancel,
    refresh(): void {
      toolbar.hidden = !enabled()
      if (!enabled()) { cancel(); create.close(); relate?.close() }
    },
  }
}
