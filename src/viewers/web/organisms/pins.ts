import type { Point } from '../../../types.ts'
import { monogram } from '../../../work-pins.ts'
import type { WorkPin } from '../../../work-pins.ts'
import type { Camera } from '../iso/camera.ts'

/** Inline SVG marks for assignees that have one, by handle without the @; everyone else gets a monogram. */
export const MARKS: Record<string, string> = {}

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
    transform-origin: bottom center; transform: rotate(var(--lean));
  }
  .pin .head {
    position: absolute; left: calc(var(--fan) - 20px); bottom: ${STEM}px; width: 40px;
    display: flex; flex-direction: column; align-items: center; cursor: pointer;
  }
  .pin .badge { position: relative; width: 40px; height: 40px; perspective: 200px; }
  .pin .ring { position: absolute; inset: 0; transform: rotate(-90deg); }
  .pin .ring circle { fill: none; stroke-width: 3; }
  .pin .ring .track { stroke: var(--hairline); }
  .pin .ring .done { stroke: var(--pin); transition: stroke-dasharray 0.4s; }
  .pin .card { position: absolute; inset: 5px; transform-style: preserve-3d; transition: transform 0.5s; }
  .pin .face {
    position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center;
    backface-visibility: hidden; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  }
  .pin .face svg { width: 18px; height: 18px; }
  .pin .face.front { background: var(--paper); color: var(--pin); border: 1px solid var(--pin); }
  .pin .face.back { background: var(--accent); color: #fff; transform: rotateY(180deg); font-size: 14px; }
  .pin.done .card { transform: rotateY(180deg); }
  .pin.done .head:hover .card { transform: rotateY(0); }
  .pin .task {
    margin-top: 2px; padding: 1px 6px; border-radius: 3px; background: var(--pin); color: #fff;
    font-size: 9px; letter-spacing: 0.08em; white-space: nowrap;
  }
  #agents {
    position: absolute; top: 12px; right: 12px; max-height: calc(100% - 24px); min-width: 220px; overflow: auto;
    padding: 10px 0; background: var(--paper); border: 1px solid var(--ink);
  }
  #agents:empty { display: none; }
  #agents .section { padding: 0 14px 6px; }
  #agents .row { gap: 10px; }
  #agents .dot {
    width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; flex: none;
    font-size: 8px; font-weight: 600; color: #fff; background: var(--pin);
  }
  #agents .dot svg { width: 12px; height: 12px; }
  #agents .task { color: var(--muted); font-size: 10px; letter-spacing: 0.08em; }
`

/** A pin's markup: its foot on the roof point, a stem leaning to its head, the head a ringed badge over the task id. */
const PIN = '<div class="foot"></div><div class="stem"></div><div class="head"><div class="badge">'
  + `<svg class="ring" viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="${RING_RADIUS}"/><circle class="done" cx="20" cy="20" r="${RING_RADIUS}"/></svg>`
  + '<div class="card"><div class="face front"></div><div class="face back">✓</div></div></div><div class="task"></div></div>'

export interface PinLayer {
  /** Reconciles the pins by key, so a pin that just finished plays its flip; call after the map painted the scene. */
  paint(pins: readonly WorkPin[]): void
  /** Moves every pin to its element's roof under the camera. */
  place(camera: Camera): void
}

const mark = (assignee: string): string => MARKS[assignee.replace(/^@/, '')] ?? monogram(assignee)

function paintAgents(host: HTMLElement, pins: readonly WorkPin[], nameOf: (id: string) => string, onSelect: (id: string) => void): void {
  host.replaceChildren()
  if (pins.length === 0) return
  const heading = document.createElement('p')
  heading.className = 'section'
  heading.textContent = 'Live agents'
  host.append(heading)
  for (const pin of pins) {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'row'
    row.style.setProperty('--pin', pin.colour)
    row.title = pin.title
    row.innerHTML = `<span class="dot">${mark(pin.assignee)}</span><span class="name"></span><span class="task"></span>`
    row.querySelector('.name')!.textContent = pin.assignee
    row.querySelector('.task')!.textContent = `${pin.taskId} · ${pin.done}/${pin.total} · ${nameOf(pin.elementId)}`
    row.addEventListener('click', () => onSelect(pin.elementId))
    host.append(row)
  }
}

/** The agents' pins over the map and the Live agents card in its top-right corner. */
export function createPins(
  host: HTMLElement,
  anchorOf: (id: string) => Point | undefined,
  nameOf: (id: string) => string,
  onSelect: (id: string) => void,
): PinLayer {
  const layer = document.createElement('div')
  layer.id = 'pins'
  const agents = document.createElement('div')
  agents.id = 'agents'
  host.append(layer, agents)
  /** Each pin's node and the roof point it stands on, in world pixels. */
  const pinned = new Map<string, { node: HTMLElement; anchor: Point }>()
  let camera: Camera | undefined
  const place = (): void => {
    if (camera === undefined) return
    for (const { node, anchor } of pinned.values()) {
      node.style.left = `${anchor.x * camera.k + camera.x}px`
      node.style.top = `${anchor.y * camera.k + camera.y}px`
    }
  }
  return {
    paint(pins) {
      const keep = new Set(pins.map(pin => pin.key))
      for (const [key, { node }] of pinned) {
        if (keep.has(key)) continue
        node.remove()
        pinned.delete(key)
      }
      const sharing = new Map<string, number>()
      for (const pin of pins) sharing.set(pin.elementId, (sharing.get(pin.elementId) ?? 0) + 1)
      const placed = new Map<string, number>()
      for (const pin of pins) {
        const anchor = anchorOf(pin.elementId)
        if (anchor === undefined) continue
        let node = pinned.get(pin.key)?.node
        if (node === undefined) {
          node = document.createElement('div')
          node.className = 'pin'
          node.innerHTML = PIN
          node.querySelector('.head')!.addEventListener('click', () => onSelect(node!.dataset.element!))
          layer.append(node)
        }
        pinned.set(pin.key, { node, anchor })
        node.dataset.element = pin.elementId
        node.style.setProperty('--pin', pin.colour)
        node.classList.toggle('done', pin.status === 'Done')
        node.querySelector<HTMLElement>('.head')!.title = `${pin.taskId} · ${pin.title}`
        node.querySelector<HTMLElement>('.face.front')!.innerHTML = mark(pin.assignee)
        node.querySelector<SVGCircleElement>('.ring .done')!.style.strokeDasharray =
          `${(pin.total === 0 ? 0 : pin.done / pin.total) * RING_LENGTH} ${RING_LENGTH}`
        node.querySelector('.task')!.textContent = pin.taskId
        /** Pins sharing an element fan out side by side around its roof point, their stems leaning back to it. */
        const index = placed.get(pin.elementId) ?? 0
        placed.set(pin.elementId, index + 1)
        const fan = (index - (sharing.get(pin.elementId)! - 1) / 2) * FAN_PITCH
        node.style.setProperty('--fan', `${fan}px`)
        node.style.setProperty('--lean', `${Math.atan2(fan, STEM)}rad`)
        node.style.setProperty('--stem', `${Math.hypot(fan, STEM)}px`)
      }
      paintAgents(agents, pins, nameOf, onSelect)
      place()
    },
    place(current) {
      camera = current
      place()
    },
  }
}
