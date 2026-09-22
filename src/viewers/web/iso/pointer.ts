import { wheelAction } from './camera.ts'
import type { IsoMap } from './map.ts'

export interface MapPointerActions {
  orbiting(): boolean
  pan(dx: number, dy: number): void
  orbit(dx: number, dy: number): void
  /** A wheel or pinch step; `point` is the cursor inside the map pane, where a zoom stays anchored. */
  wheel(action: ReturnType<typeof wheelAction>, point: { x: number; y: number }): void
  select(id: string, additive: boolean): void
  deselect(): void
  editProject(): void
}

const DRAG_THRESHOLD = 4

/** One pointer gesture map: click selects, drag orbits in F2, Shift-drag always pans, and the wheel pans or zooms. */
export function bindMapPointer(host: HTMLElement, map: IsoMap, actions: MapPointerActions): void {
  /** The pane takes the wheel wherever the cursor is, pins included; the Live work island keeps it for its chip strip. */
  host.addEventListener('wheel', event => {
    if (event.target instanceof Element && event.target.closest('#work')) return
    event.preventDefault()
    const rect = host.getBoundingClientRect()
    actions.wheel(wheelAction(event), { x: event.clientX - rect.left, y: event.clientY - rect.top })
  }, { passive: false })

  let pointer: {
    id: number
    x: number
    y: number
    dragging: boolean
    gesture: 'pan' | 'orbit'
    targetId: string | undefined
    onSheet: boolean
    projectEdit: boolean
    additive: boolean
  } | null = null

  map.svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      gesture: actions.orbiting() && !event.shiftKey ? 'orbit' : 'pan',
      targetId: map.hitId(event.target),
      onSheet: map.isSheet(event.target),
      projectEdit: map.isProjectEdit(event.target),
      additive: event.shiftKey,
    }
    map.svg.setPointerCapture(event.pointerId)
  })

  map.svg.addEventListener('pointermove', event => {
    if (pointer === null || pointer.id !== event.pointerId) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    if (!pointer.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) pointer.dragging = true
    if (!pointer.dragging) return
    actions[pointer.gesture](dx, dy)
    pointer.x = event.clientX
    pointer.y = event.clientY
  })

  /** A press without a drag: the project pencil, an element or route, or the empty sheet. */
  function tap(pressed: NonNullable<typeof pointer>): void {
    if (pressed.projectEdit) actions.editProject()
    else if (pressed.targetId !== undefined) actions.select(pressed.targetId, pressed.additive)
    else if (pressed.onSheet) actions.deselect()
  }

  map.svg.addEventListener('pointerup', event => {
    if (pointer === null || pointer.id !== event.pointerId) return
    if (!pointer.dragging) tap(pointer)
    pointer = null
  })
  map.svg.addEventListener('pointercancel', () => {
    pointer = null
  })
}
