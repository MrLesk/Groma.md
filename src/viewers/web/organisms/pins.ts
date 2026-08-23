import type { Point } from '../../../types.ts'
import { monogram } from '../../../work-pins.ts'
import type { WorkPin } from '../../../work-pins.ts'
import { MARKS } from '../atoms/marks.ts'
import type { Camera } from '../iso/camera.ts'

/** The ring's radius in the badge's 40 px box. */
const RING_RADIUS = 18
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
/** Screen pixels between the badges of pins that share an element. */
const FAN_PITCH = 46
/** Screen pixels from the roof point up to the label of a pin standing straight. */
const STEM = 22

export const pinsCss = `
  #pins { position: absolute; inset: 0; pointer-events: none; }
  .pin { position: absolute; width: 0; height: 0; pointer-events: auto; --pin: var(--ink); }
  .pin .foot { position: absolute; left: -2.5px; top: -2.5px; width: 5px; height: 5px; border-radius: 50%; background: var(--pin); }
  .pin .stem {
    position: absolute; left: -0.5px; bottom: 0; width: 1px; height: var(--stem); background: var(--pin);
    transform-origin: bottom center; transform: rotate(var(--lean)); transition: transform 0.3s, height 0.3s;
  }
  .pin .head {
    position: absolute; left: calc(var(--fan) - 20px); bottom: ${STEM}px; width: 40px; transition: left 0.3s;
    display: flex; flex-direction: column; align-items: center; cursor: pointer;
  }
  .badge { position: relative; width: 40px; height: 40px; perspective: 200px; }
  .badge .ring { position: absolute; inset: 0; transform: rotate(-90deg); }
  .badge .ring circle { fill: none; stroke-width: 3; }
  .badge .ring .track { stroke: var(--hairline); }
  .badge .ring .done { stroke: var(--pin); transition: stroke-dasharray 0.4s; }
  .badge .card { position: absolute; inset: 5px; transform-style: preserve-3d; transition: transform 0.5s; }
  .badge .face {
    position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center;
    backface-visibility: hidden; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  }
  .badge .face svg { width: 18px; height: 18px; }
  .badge .face.front { background: var(--paper); color: var(--pin); border: 1px solid var(--pin); }
  .badge .face.back { background: var(--accent); color: #fff; transform: rotateY(180deg); font-size: 14px; }
  .pin.done .card { transform: rotateY(180deg); }
  .pin.done .head:hover .card { transform: rotateY(0); }
  .pin .task {
    margin-top: 2px; padding: 1px 6px; border-radius: 3px; background: var(--pin); color: #fff;
    font-size: 9px; letter-spacing: 0.08em; white-space: nowrap;
  }
`

/** A ringed badge: the ring filled by the share done, a flipping disc with the assignee's mark in front and a checkmark behind. */
export const BADGE = `<div class="badge"><svg class="ring" viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="${RING_RADIUS}"/><circle class="done" cx="20" cy="20" r="${RING_RADIUS}"/></svg>`
  + '<div class="card"><div class="face front"></div><div class="face back">✓</div></div></div>'

/** Fills a badge for a pin: the mark and the ring's share. */
export function fillBadge(host: HTMLElement, pin: WorkPin): void {
  host.querySelector<HTMLElement>('.face.front')!.innerHTML = MARKS[pin.assignee.replace(/^@/, '')] ?? monogram(pin.assignee)
  host.querySelector<SVGCircleElement>('.ring .done')!.style.strokeDasharray =
    `${(pin.total === 0 ? 0 : pin.done / pin.total) * RING_LENGTH} ${RING_LENGTH}`
}

/** A pin's markup: its foot on the roof point, a stem leaning to its head, the head a ringed badge over the task id. */
const PIN = `<div class="foot"></div><div class="stem"></div><div class="head">${BADGE}<div class="task"></div></div>`

export interface PinLayer {
  /** Reconciles the pins by key, so a pin that just finished plays its flip; call after the map painted the scene. */
  paint(pins: readonly WorkPin[]): void
  /** Moves every pin to its element's roof under the camera. */
  place(camera: Camera): void
  /** Shows or hides the in-progress pins and the finished ones; the pins still shown fan out anew. */
  show(agents: boolean, completed: boolean): void
}

/** The agents' pins over the map; clicking a pin's head selects its task. */
export function createPins(host: HTMLElement, anchorOf: (id: string) => Point | undefined, onSelect: (taskId: string) => void): PinLayer {
  const layer = document.createElement('div')
  layer.id = 'pins'
  host.append(layer)
  /** Each pin's node and the roof point it stands on, in world pixels. */
  const pinned = new Map<string, { node: HTMLElement; anchor: Point }>()
  let pins: readonly WorkPin[] = []
  let agents = true
  let completed = true
  let camera: Camera | undefined
  const place = (): void => {
    if (camera === undefined) return
    for (const { node, anchor } of pinned.values()) {
      node.style.left = `${anchor.x * camera.k + camera.x}px`
      node.style.top = `${anchor.y * camera.k + camera.y}px`
    }
  }
  /** The pins the toggles allow fan out side by side around their element's roof point, stems leaning back to it; the rest hide. */
  const fanOut = (): void => {
    const shown = pins.filter(pin => pinned.has(pin.key) && (pin.status === 'Done' ? completed : agents))
    const visible = new Set(shown.map(pin => pin.key))
    for (const [key, { node }] of pinned) node.hidden = !visible.has(key)
    const sharing = new Map<string, number>()
    for (const pin of shown) sharing.set(pin.elementId, (sharing.get(pin.elementId) ?? 0) + 1)
    const placed = new Map<string, number>()
    for (const pin of shown) {
      const index = placed.get(pin.elementId) ?? 0
      placed.set(pin.elementId, index + 1)
      const fan = (index - (sharing.get(pin.elementId)! - 1) / 2) * FAN_PITCH
      const { node } = pinned.get(pin.key)!
      node.style.setProperty('--fan', `${fan}px`)
      node.style.setProperty('--lean', `${Math.atan2(fan, STEM)}rad`)
      node.style.setProperty('--stem', `${Math.hypot(fan, STEM)}px`)
    }
  }
  return {
    paint(next) {
      pins = next
      const keep = new Set(pins.map(pin => pin.key))
      for (const [key, { node }] of pinned) {
        if (keep.has(key)) continue
        node.remove()
        pinned.delete(key)
      }
      for (const pin of pins) {
        const anchor = anchorOf(pin.elementId)
        if (anchor === undefined) continue
        let node = pinned.get(pin.key)?.node
        if (node === undefined) {
          node = document.createElement('div')
          node.className = 'pin'
          node.innerHTML = PIN
          node.querySelector('.head')!.addEventListener('click', () => onSelect(pin.taskId))
          layer.append(node)
        }
        pinned.set(pin.key, { node, anchor })
        node.style.setProperty('--pin', pin.colour)
        node.classList.toggle('done', pin.status === 'Done')
        node.querySelector<HTMLElement>('.head')!.title = `${pin.taskId} · ${pin.title}`
        fillBadge(node, pin)
        node.querySelector('.task')!.textContent = pin.taskId
      }
      fanOut()
      place()
    },
    place(current) {
      camera = current
      place()
    },
    show(nextAgents, nextCompleted) {
      agents = nextAgents
      completed = nextCompleted
      fanOut()
    },
  }
}
