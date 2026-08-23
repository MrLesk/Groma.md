import type { Point } from '../../../types.ts'
import type { WorkPin } from '../../../work/pins.ts'
import { fillWorkBadge, finishingWorkKeys, WORK_BADGE, WORK_BADGE_FLIP_MS } from './badge.ts'
import type { Camera } from '../iso/camera.ts'
import type { Tip } from '../organisms/tip.ts'

/** Screen pixels between the badges of pins that share an element. */
const FAN_PITCH = 46
/** Screen pixels from the foot up to the label of a pin standing straight. */
const STEM = 22

export const pinsCss = `
  #pins { position: absolute; inset: 0; pointer-events: none; }
  .pin { position: absolute; width: 0; height: 0; pointer-events: auto; --pin: var(--ink); filter: grayscale(1); }
  .pin.active { filter: none; }
  .pin.arriving { animation: pin-arrive 700ms ease-out; }
  @keyframes pin-arrive {
    0% { transform: translateY(0); filter: grayscale(0); }
    50% { transform: translateY(-16px); filter: grayscale(0); }
    75% { transform: translateY(0); filter: grayscale(0); }
    100% { transform: translateY(0); filter: grayscale(1); }
  }
  .pin .foot { position: absolute; left: -2.5px; top: -2.5px; width: 5px; height: 5px; border-radius: 50%; background: var(--pin); }
  .pin .stem {
    position: absolute; left: -0.5px; bottom: 0; width: 1px; height: var(--stem); background: var(--pin);
    transform-origin: bottom center; transform: rotate(var(--lean)); transition: transform 0.3s, height 0.3s;
  }
  .pin .head {
    position: absolute; left: calc(var(--fan) - 20px); bottom: ${STEM}px; width: 40px; transition: left 0.3s;
    display: flex; flex-direction: column; align-items: center; cursor: pointer;
  }
  .pin.work-done .head:hover .card { transform: rotateY(0); }
  .pin .task {
    margin-top: 2px; padding: 1px 6px; border-radius: 3px; background: var(--pin); color: #fff;
    font-size: 9px; letter-spacing: 0.08em; white-space: nowrap;
  }
  .pin.active .badge { border-radius: 50%; box-shadow: 0 0 0 3px var(--accent); }
  /* a 10 by 6 px triangle whose tip ends 3 px above the 3 px ring */
  .pin.selected .head::before {
    content: ''; position: absolute; top: -12px; left: calc(50% - 5px);
    border: 5px solid transparent; border-top: 6px solid var(--accent);
  }
`

/** A pin's markup: its foot on the element's surface near its left corner, a stem leaning to its head, the head a ringed badge over the task id. */
const PIN = `<div class="foot"></div><div class="stem"></div><div class="head">${WORK_BADGE}<div class="task"></div></div>`

export interface PinLayer {
  /** Reconciles the pins by key, so a pin that just finished plays its flip; call after the map painted the scene. */
  paint(pins: readonly WorkPin[]): void
  /** Moves every pin to the surface point it stands on under the camera. */
  place(camera: Camera): void
  /** Shows pins whose Backlog status is enabled; the pins still shown fan out anew. */
  show(statuses: readonly string[]): void
  /** Colours the pins of the active tasks, greyscale otherwise, and marks those of the selected task, which is always one of the active ones. */
  activate(active: readonly string[], selected: string | undefined): void
}

/** The work pins over the map; clicking a pin's head toggles its task. */
export function createPins(host: HTMLElement, anchorOf: (id: string) => Point | undefined, onToggle: (taskId: string) => void, tip: Tip): PinLayer {
  const layer = document.createElement('div')
  layer.id = 'pins'
  host.append(layer)
  /** Each pin's node and the surface point it stands on, in world pixels. */
  const pinned = new Map<string, { node: HTMLElement; anchor: Point }>()
  let pins: readonly WorkPin[] = []
  let enabledStatuses: readonly string[] = []
  const finishing = new Set<string>()
  let camera: Camera | undefined
  /** The first paint is the page's baseline; only pins first seen after it announce their arrival. */
  let painted = false
  const place = (): void => {
    if (camera === undefined) return
    for (const { node, anchor } of pinned.values()) {
      node.style.left = `${anchor.x * camera.k + camera.x}px`
      node.style.top = `${anchor.y * camera.k + camera.y}px`
    }
  }
  /** The pins the toggles allow fan out leftwards from their element's foot point, stems leaning back to it; the rest hide. */
  const fanOut = (): void => {
    const shown = pins.filter(pin => pinned.has(pin.key) && (enabledStatuses.includes(pin.status) || finishing.has(pin.key)))
    const visible = new Set(shown.map(pin => pin.key))
    for (const [key, { node }] of pinned) node.hidden = !visible.has(key)
    const placed = new Map<string, number>()
    for (const pin of shown) {
      const index = placed.get(pin.elementId) ?? 0
      placed.set(pin.elementId, index + 1)
      const fan = -index * FAN_PITCH
      const { node } = pinned.get(pin.key)!
      node.style.setProperty('--fan', `${fan}px`)
      node.style.setProperty('--lean', `${Math.atan2(fan, STEM)}rad`)
      node.style.setProperty('--stem', `${Math.hypot(fan, STEM)}px`)
    }
  }
  return {
    paint(next) {
      const visible = new Set(pins
        .filter(pin => pinned.has(pin.key) && enabledStatuses.includes(pin.status))
        .map(pin => pin.key))
      const started = finishingWorkKeys(pins, next)
      for (const key of started) {
        if (visible.has(key)) finishing.add(key)
        else started.delete(key)
      }
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
          node.className = painted ? 'pin arriving' : 'pin'
          node.innerHTML = PIN
          node.querySelector('.head')!.addEventListener('click', () => onToggle(pin.taskId))
          tip.attach(node.querySelector('.head')!)
          layer.append(node)
        }
        pinned.set(pin.key, { node, anchor })
        node.style.setProperty('--pin', pin.colour)
        node.querySelector<HTMLElement>('.head')!.dataset.tip = `${pin.assignee ?? 'Unassigned'} · ${pin.title}`
        fillWorkBadge(node, pin, finishing.has(pin.key))
        node.querySelector('.task')!.textContent = pin.taskId
      }
      painted = true
      fanOut()
      place()
      if (started.size > 0) setTimeout(() => {
        for (const key of started) {
          finishing.delete(key)
          pinned.get(key)?.node.classList.remove('work-finishing')
        }
        fanOut()
      }, WORK_BADGE_FLIP_MS)
    },
    place(current) {
      camera = current
      place()
    },
    show(statuses) {
      enabledStatuses = statuses
      fanOut()
    },
    activate(active, selected) {
      for (const pin of pins) {
        const node = pinned.get(pin.key)?.node
        node?.classList.toggle('active', active.includes(pin.taskId))
        node?.classList.toggle('selected', pin.taskId === selected)
      }
    },
  }
}
