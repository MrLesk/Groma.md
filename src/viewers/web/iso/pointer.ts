import type { IsoMap } from './map.ts'

export interface MapPointerActions {
  orbiting(): boolean
  pan(dx: number, dy: number): void
  orbit(dx: number, dy: number): void
  select(id: string, additive: boolean): void
  deselect(): void
  editProject(): void
}

const DRAG_THRESHOLD = 4

/** One pointer gesture map: click selects, drag orbits in F2, and Shift-drag always pans. */
export function bindMapPointer(map: IsoMap, actions: MapPointerActions): void {
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

  map.svg.addEventListener('pointerup', event => {
    if (pointer === null || pointer.id !== event.pointerId) return
    if (!pointer.dragging) {
      if (pointer.projectEdit) actions.editProject()
      else if (pointer.targetId !== undefined) actions.select(pointer.targetId, pointer.additive)
      else if (pointer.onSheet) actions.deselect()
    }
    pointer = null
  })
  map.svg.addEventListener('pointercancel', () => {
    pointer = null
  })
}
