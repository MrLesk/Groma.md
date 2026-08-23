import type { WorkPin } from '../../../work-pins.ts'
import { BADGE, fillBadge } from './pins.ts'

const icon = (paths: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
/** A pulse, the mark of live work: on the folded pill and in the open island's label. */
const PULSE_MARK = icon('<path d="M2 12h4l3-8 4 16 3-8h6"/>')
const EYE_MARK = icon('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>')
/** Points up while folded, the way the island opens; the open island turns it down. */
const CHEVRON = icon('<path d="M6 15l6-6 6 6"/>')

export const workCss = `
  /* Centred by margins, not by a translate: a fractional transform would resample the blurred layer and soften the text. */
  #work {
    position: absolute; left: 0; right: 0; bottom: 12px; margin: 0 auto; width: fit-content; box-sizing: border-box; max-width: calc(100% - 24px);
    display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 28px;
    background: color-mix(in srgb, var(--paper) 55%, transparent); border: 1px solid var(--hairline);
    backdrop-filter: blur(14px); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
    overflow: hidden; white-space: nowrap;
  }
  #work:empty { display: none; }
  #work svg { width: 18px; height: 18px; flex: none; }
  #work .mark { position: relative; display: grid; place-items: center; width: 28px; height: 28px; }
  #work .mark .dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  #work .divider { width: 1px; height: 24px; background: var(--hairline); flex: none; }
  #work button { display: flex; align-items: center; gap: 6px; border: 0; background: transparent; padding: 4px; border-radius: 14px; }
  #work .label { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  #work .toggle { padding: 4px 10px; border: 1px solid var(--hairline); color: var(--muted); }
  #work .toggle[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); }
  /* The strip keeps its height with the chips at its top, so the 4 px scrollbar that appears under them on overflow moves nothing. */
  #work .strip { display: flex; align-items: flex-start; gap: 8px; overflow-x: auto; box-sizing: border-box; height: 48px; padding: 5px 0 0; min-width: 0; }
  #work .strip::-webkit-scrollbar { height: 4px; }
  #work .strip::-webkit-scrollbar-track { background: transparent; }
  #work .strip::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--ink) 25%, transparent); border-radius: 2px; }
  #work .chip {
    flex: none; gap: 8px; padding: 4px 10px 4px 4px; border: 1px solid var(--hairline); border-radius: 20px;
    font-size: 10px; letter-spacing: 0.08em;
  }
  #work .chip .badge { width: 28px; height: 28px; }
  #work .chip .badge .card { inset: 3px; }
  #work .chip .badge .face { font-size: 8px; }
  #work .chip .badge .ring { width: 100%; height: 100%; }
  #work .chip .badge .face svg { width: 12px; height: 12px; }
  #work .chip .badge .ring circle { stroke-width: 4; }
  #work .chip.done { --pin: var(--muted); }
  #work .chip.selected { border-color: var(--accent); color: var(--accent); }
  #work .fold svg { transition: transform 0.35s ease; }
  #work.open .fold svg { transform: rotate(180deg); }
`

export interface WorkIsland {
  /** Rebuilds the island for these pins; nothing shows while there are none. */
  paint(pins: readonly WorkPin[]): void
  /** Marks the chip of the selected task and scrolls it into view; none while no task is selected. */
  select(taskId: string | undefined): void
}

function button(className: string, html: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button')
  node.type = 'button'
  node.className = className
  node.innerHTML = html
  node.addEventListener('click', onClick)
  return node
}

function chip(pin: WorkPin, onSelect: (id: string) => void): HTMLButtonElement {
  const node = button(`chip${pin.status === 'Done' ? ' done' : ''}`, `${BADGE}<span>${pin.taskId}</span>`, () => onSelect(pin.taskId))
  node.dataset.task = pin.taskId
  node.style.setProperty('--pin', pin.colour)
  node.title = `${pin.assignee} · ${pin.title}`
  fillBadge(node, pin)
  return node
}

/**
 * The Live work island at the map's bottom centre: a pill that unfolds into
 * the label, the two toggles and the chip strip. It starts folded with both
 * kinds of work shown and keeps its fold and toggles across repaints;
 * clicking a chip selects its task. Every rebuild eases the island's
 * width and height from the size it had to the size it needs.
 */
export function createWorkIsland(
  host: HTMLElement,
  onSelect: (taskId: string) => void,
  onShow: (agents: boolean, completed: boolean) => void,
): WorkIsland {
  const island = document.createElement('div')
  island.id = 'work'
  host.append(island)
  let pins: readonly WorkPin[] = []
  let open = false
  let agents = true
  let completed = true
  let selected: string | undefined

  const toggle = (name: string, pressed: boolean, flip: () => void): HTMLButtonElement => {
    const node = button('toggle', `${EYE_MARK}${name}`, () => {
      flip()
      onShow(agents, completed)
      rebuild()
    })
    node.setAttribute('aria-pressed', String(pressed))
    return node
  }
  /** The island's parts for the current state: nothing, the folded pill, or the open row. */
  const parts = (): Node[] => {
    if (pins.length === 0) return []
    const mark = document.createElement('span')
    mark.className = 'mark'
    mark.innerHTML = `${PULSE_MARK}${pins.some(pin => pin.status !== 'Done') ? '<span class="dot"></span>' : ''}`
    const fold = button('fold', CHEVRON, () => {
      open = !open
      rebuild()
    })
    fold.setAttribute('aria-expanded', String(open))
    if (!open) {
      const divider = document.createElement('span')
      divider.className = 'divider'
      return [mark, divider, fold]
    }
    const label = document.createElement('span')
    label.className = 'label'
    label.innerHTML = `${PULSE_MARK}Live work`
    const strip = document.createElement('div')
    strip.className = 'strip'
    /** The toggles hide chips as they hide pins: Agents all of them, Completed the finished ones, which come last, in grey. */
    const live = pins.filter(pin => pin.status !== 'Done')
    const finished = pins.filter(pin => pin.status === 'Done')
    strip.append(...(agents ? [...live, ...(completed ? finished : [])] : []).map(pin => chip(pin, onSelect)))
    return [
      label,
      toggle('Agents', agents, () => { agents = !agents }),
      toggle('Completed', completed, () => { completed = !completed }),
      strip,
      fold,
    ]
  }
  /** Marks the selected task's chips and scrolls the strip to centre the first of them when it lies outside the visible part. */
  const mark = (): void => {
    for (const chip of island.querySelectorAll<HTMLElement>('.chip')) chip.classList.toggle('selected', chip.dataset.task === selected)
    const chip = island.querySelector<HTMLElement>('.chip.selected')
    if (chip === null) return
    const strip = chip.parentElement!
    const box = strip.getBoundingClientRect()
    const { left, right } = chip.getBoundingClientRect()
    if (left >= box.left && right <= box.right) return
    strip.scrollBy({ left: (left + right - box.left - box.right) / 2, behavior: 'smooth' })
  }
  /** Rebuilds the island and eases its size from what it was to what it is now; an unchanged size does not animate. */
  const rebuild = (): void => {
    const was = island.getBoundingClientRect()
    const scrolled = island.querySelector('.strip')?.scrollLeft ?? 0
    for (const running of island.getAnimations()) running.cancel()
    island.replaceChildren(...parts())
    island.classList.toggle('open', open)
    // the strip stays where it was, so a repaint moves it only to reveal a selected chip
    island.querySelector('.strip')?.scrollTo(scrolled, 0)
    mark()
    const now = island.getBoundingClientRect()
    if (now.width === was.width && now.height === was.height) return
    island.animate(
      [{ width: `${was.width}px`, height: `${was.height}px` }, { width: `${now.width}px`, height: `${now.height}px` }],
      { duration: 350, easing: 'ease' },
    )
  }
  return {
    paint(next) {
      pins = next
      rebuild()
    },
    select(taskId) {
      selected = taskId
      mark()
    },
  }
}
