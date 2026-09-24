import type { Point } from '../../../types.ts'
import type { WorkPin } from '../../../work/pins.ts'
import { fillWorkBadge, finishingWorkKeys, WORK_BADGE, WORK_BADGE_FINISH_MS } from './badge.ts'
import type { Camera } from '../iso/camera/camera.ts'
import type { Tip } from '../organisms/tip.ts'

/** Screen pixels between the badges of pins that share an element. */
const FAN_PITCH = 46
/** Screen pixels from the foot up to the label of a pin standing straight. */
const STEM = 22
const TRAVEL_MS = 850

interface Pinned {
  node: HTMLElement
  elementId: string
  anchor: Point
  travel?: { offset: Point; started: number; lift: number }
}

/** Travel is relative to the destination, so scene reprojection still owns the anchor. */
function positionOf(pin: Pinned, now: number, reducedMotion: boolean): Point {
  const travel = pin.travel
  if (travel === undefined) return pin.anchor
  const progress = Math.min(1, (now - travel.started) / TRAVEL_MS)
  if (progress === 1 || reducedMotion || pin.node.hidden) {
    pin.travel = undefined
    return pin.anchor
  }
  const eased = progress * progress * (3 - 2 * progress)
  return {
    x: pin.anchor.x + travel.offset.x * (1 - eased),
    y: pin.anchor.y + travel.offset.y * (1 - eased) - Math.sin(Math.PI * eased) * travel.lift,
  }
}

export const pinsCss = `
  #pins { position: absolute; inset: 0; transform-origin: 0 0; will-change: transform; pointer-events: none; }
  .pin {
    position: absolute; width: 0; height: 0; pointer-events: auto; --pin: var(--ink); filter: grayscale(1);
    will-change: translate;
  }
  .pin.active { filter: none; }
  .pin.arriving { animation: pin-arrive 700ms ease-out; }
  @keyframes pin-arrive {
    0% { transform: translateY(0); filter: grayscale(0); }
    50% { transform: translateY(-16px); filter: grayscale(0); }
    75% { transform: translateY(0); filter: grayscale(0); }
    100% { transform: translateY(0); filter: grayscale(1); }
  }
  .pin .foot { position: absolute; left: -2.5px; top: -2.5px; width: 5px; height: 5px; border-radius: 50%; background: color-mix(in srgb, var(--pin) 85%, transparent); }
  .pin .stem {
    position: absolute; left: -0.5px; bottom: 0; width: 1px; height: var(--stem); background: color-mix(in srgb, var(--pin) 85%, transparent);
    transform-origin: bottom center; transform: rotate(var(--lean)); transition: transform 0.3s, height 0.3s;
  }
  .pin .head {
    position: absolute; left: calc(var(--fan) - 20px); bottom: ${STEM}px; width: 40px; transition: left 0.3s;
    display: flex; flex-direction: column; align-items: center; cursor: pointer;
  }
  .pin.work-done .head:hover .card { transform: rotateY(0); }
  .pin .task {
    margin-top: 2px; padding: 1px 6px; border-radius: 3px; background: color-mix(in srgb, var(--pin) 85%, transparent); color: var(--on-colour);
    font-size: 9px; letter-spacing: 0.08em; white-space: nowrap;
  }
  .pin.work-draft .badge .face.front { border-style: dashed; }
  .pin.work-draft .task { border: 1px dashed color-mix(in srgb, var(--pin) 85%, transparent); background: transparent; color: var(--ink); }
  .pin.work-draft .stem { background: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--pin) 85%, transparent) 0 4px, transparent 4px 7px); }
  .pin.active .badge { border-radius: 50%; box-shadow: 0 0 0 3px var(--highlight); }
  /* a 10 by 6 px triangle whose tip ends 3 px above the 3 px ring */
  .pin.selected .head::before {
    content: ''; position: absolute; top: -12px; left: calc(50% - 5px);
    border: 5px solid transparent; border-top: 6px solid var(--highlight);
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
  /** Anchors and travel offsets use world pixels; badges keep their screen size. */
  const pinned = new Map<string, Pinned>()
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let travelFrame: number | undefined
  let pins: readonly WorkPin[] = []
  let enabledStatuses: readonly string[] = []
  const finishing = new Map<string, number>()
  let camera: Camera | undefined
  /** The first paint is the page's baseline; only pins first seen after it announce their arrival. */
  let painted = false
  const place = (scaleChanged = true): void => {
    if (camera === undefined) return
    layer.style.transform = `translate(${camera.x}px, ${camera.y}px)`
    if (!scaleChanged) return
    const now = performance.now()
    for (const pin of pinned.values()) {
      const point = positionOf(pin, now, reducedMotion.matches)
      pin.node.style.translate = `${point.x * camera.k}px ${point.y * camera.k}px`
    }
    if (travelFrame === undefined && [...pinned.values()].some(pin => pin.travel !== undefined)) {
      travelFrame = requestAnimationFrame(() => {
        travelFrame = undefined
        place()
      })
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
      node.classList.toggle('work-disappearing', finishing.has(pin.key) && !enabledStatuses.includes(pin.status))
      node.style.setProperty('--fan', `${fan}px`)
      node.style.setProperty('--lean', `${Math.atan2(fan, STEM)}rad`)
      node.style.setProperty('--stem', `${Math.hypot(fan, STEM)}px`)
    }
  }
  const updatePin = (pin: WorkPin, anchor: Point): void => {
    const previous = pinned.get(pin.key)
    let node = previous?.node
    if (node === undefined) {
      node = document.createElement('div')
      node.className = painted ? 'pin arriving' : 'pin'
      node.innerHTML = PIN
      node.querySelector('.head')!.addEventListener('click', () => onToggle(pin.taskId))
      tip.attach(node.querySelector('.head')!)
      layer.append(node)
    }
    let travel = previous?.travel
    if (previous !== undefined && previous.elementId !== pin.elementId) {
      travel = undefined
      if (camera !== undefined && !node.hidden && !reducedMotion.matches) {
        const now = performance.now()
        const from = positionOf(previous, now, false)
        const offset = { x: from.x - anchor.x, y: from.y - anchor.y }
        travel = { offset, started: now, lift: Math.min(40 / camera.k, Math.hypot(offset.x, offset.y) * 0.15) }
        node.classList.remove('arriving')
      }
    }
    pinned.set(pin.key, { node, anchor, elementId: pin.elementId, travel })
    node.classList.toggle('work-draft', pin.draft)
    node.style.setProperty('--pin', pin.colour)
    node.querySelector<HTMLElement>('.head')!.dataset.tip = `${pin.assignee ?? 'Unassigned'} · ${pin.title}`
    if (finishing.has(pin.key)) node.classList.remove('arriving')
    fillWorkBadge(node, pin, finishing.get(pin.key))
    node.querySelector('.task')!.textContent = pin.taskId
  }
  return {
    paint(next) {
      const visible = new Set(pins
        .filter(pin => pinned.has(pin.key) && enabledStatuses.includes(pin.status))
        .map(pin => pin.key))
      const started = finishingWorkKeys(pins, next)
      for (const key of started) {
        if (visible.has(key)) finishing.set(key, Date.now())
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
        updatePin(pin, anchor)
      }
      painted = true
      fanOut()
      place()
      if (started.size > 0) setTimeout(() => {
        for (const key of started) {
          finishing.delete(key)
          pinned.get(key)?.node.classList.remove('work-finishing', 'work-disappearing')
        }
        fanOut()
      }, WORK_BADGE_FINISH_MS)
    },
    place(current) {
      const scaleChanged = camera?.k !== current.k
      camera = current
      place(scaleChanged)
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
