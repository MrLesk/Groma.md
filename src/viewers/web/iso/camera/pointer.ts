import type { Point } from '../../../../types.ts'
import { wheelAction } from './camera.ts'
import type { IsoMap } from '../painting/map.ts'

export interface MapPointerActions {
  orbiting(): boolean
  /** A press stops the camera where it is, catching a glide or an animated move. */
  hold(): void
  pan(dx: number, dy: number): void
  /** Carries a released drag on at its velocity, in screen pixels per millisecond. */
  glide(velocity: Point): void
  orbit(dx: number, dy: number): void
  /** Zooms by `factor` about `point` in the map pane: the cursor for the wheel, the point between the fingers for a pinch. */
  zoom(factor: number, point: Point): void
  select(id: string, additive: boolean): void
  deselect(): void
  editProject(): void
}

const DRAG_THRESHOLD = 4
/** A released drag glides at its speed over this last stretch; a longer pause before release leaves nothing to glide. */
const RELEASE_WINDOW_MS = 100

/** A pan drag position with its event time. */
interface Sample extends Point {
  time: number
}

/** One gesture map for the map pane: a click selects, a drag pans (orbits in Layers unless Shift is held), two fingers pinch to zoom, and the wheel pans or zooms. */
export function bindMapPointer(host: HTMLElement, map: IsoMap, actions: MapPointerActions): void {
  /** A window point in map-pane coordinates, where zooms are anchored. */
  function inPane(x: number, y: number): Point {
    const rect = host.getBoundingClientRect()
    return { x: x - rect.left, y: y - rect.top }
  }

  /** The pane takes the wheel wherever the cursor is, pins included; the Live work island keeps it for its chip strip. */
  host.addEventListener('wheel', event => {
    if (event.target instanceof Element && event.target.closest('#work')) return
    event.preventDefault()
    const step = wheelAction(event)
    if (step.kind === 'pan') actions.pan(step.dx, step.dy)
    else actions.zoom(step.factor, inPane(event.clientX, event.clientY))
  }, { passive: false })

  /** Where each pressed pointer was last seen; while two are pressed, they pinch. */
  const pointers = new Map<number, Point>()
  /** A lone press that has not dragged yet; a second finger cancels it. */
  let press: {
    id: number
    start: Point
    targetId: string | undefined
    onSheet: boolean
    projectEdit: boolean
    additive: boolean
  } | null = null
  /** Where the current one-pointer drag panned; a gesture that ever had two pointers never glides. */
  let trail: Sample[] = []
  let pinched = false

  map.svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    if (pointers.size === 0) {
      actions.hold()
      trail = []
      pinched = false
    }
    const start = { x: event.clientX, y: event.clientY }
    pointers.set(event.pointerId, start)
    if (pointers.size > 1) pinched = true
    press = pointers.size > 1 ? null : {
      id: event.pointerId,
      start,
      targetId: map.hitId(event.target),
      onSheet: map.isSheet(event.target),
      projectEdit: map.isProjectEdit(event.target),
      additive: event.shiftKey,
    }
    map.svg.setPointerCapture(event.pointerId)
  })

  map.svg.addEventListener('pointermove', event => {
    const last = pointers.get(event.pointerId)
    if (last === undefined) return
    const next = { x: event.clientX, y: event.clientY }
    if (press !== null && Math.hypot(next.x - press.start.x, next.y - press.start.y) <= DRAG_THRESHOLD) return
    press = null
    map.dragging(true)
    pointers.set(event.pointerId, next)
    const still = [...pointers].find(([id]) => id !== event.pointerId)?.[1]
    if (still !== undefined) pinch(last, next, still)
    else if (actions.orbiting() && !event.shiftKey) actions.orbit(next.x - last.x, next.y - last.y)
    else {
      actions.pan(next.x - last.x, next.y - last.y)
      trail.push({ ...next, time: event.timeStamp })
    }
  })

  /** One finger moved from `from` to `to` while the other stayed at `still`: follow their midpoint and zoom by their change in spread about it. */
  function pinch(from: Point, to: Point, still: Point): void {
    const before = { x: (from.x + still.x) / 2, y: (from.y + still.y) / 2 }
    const after = { x: (to.x + still.x) / 2, y: (to.y + still.y) / 2 }
    const factor = Math.hypot(to.x - still.x, to.y - still.y) / Math.hypot(from.x - still.x, from.y - still.y)
    actions.pan(after.x - before.x, after.y - before.y)
    actions.zoom(factor, inPane(after.x, after.y))
  }

  /** A press without a drag: the project pencil, an element or route, or the empty sheet. */
  function tap(pressed: NonNullable<typeof press>): void {
    if (pressed.projectEdit) actions.editProject()
    else if (pressed.targetId !== undefined) actions.select(pressed.targetId, pressed.additive)
    else if (pressed.onSheet) actions.deselect()
  }

  /** Glides at the drag's speed since the oldest position in the release window. */
  function release(end: Sample): void {
    const first = trail.find(sample => end.time - sample.time <= RELEASE_WINDOW_MS)
    if (first === undefined || end.time <= first.time) return
    actions.glide({ x: (end.x - first.x) / (end.time - first.time), y: (end.y - first.y) / (end.time - first.time) })
  }

  map.svg.addEventListener('pointerup', event => {
    if (!pointers.delete(event.pointerId)) return
    if (press?.id === event.pointerId) tap(press)
    else if (pointers.size === 0 && !pinched) release({ x: event.clientX, y: event.clientY, time: event.timeStamp })
    press = null
    if (pointers.size === 0) map.dragging(false)
  })
  map.svg.addEventListener('pointercancel', event => {
    pointers.delete(event.pointerId)
    press = null
    if (pointers.size === 0) map.dragging(false)
  })
}
