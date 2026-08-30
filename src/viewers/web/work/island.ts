import type { WorkPin } from '../../../work/pins.ts'
import type { Tip } from '../organisms/tip.ts'
import { BACKLOG_MARK } from './backlog-mark.ts'
import { fillWorkBadge, finishingWorkKeys, WORK_BADGE, WORK_BADGE_FLIP_MS } from './badge.ts'
import { preservedWorkStatuses, toggleWorkStatus, workStatusFilters } from './status-filter.ts'
import type { WorkStatusFilterState } from './status-filter.ts'

const icon = (paths: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
const EYE_MARK = icon('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>')
/** Points up while folded, the way the island opens; the open island turns it down. */
const CHEVRON = icon('<path d="M6 15l6-6 6 6"/>')

export const workCss = `
  /* Centred by margins, not by a translate: a fractional transform would resample the blurred layer and soften the text. */
  #work {
    position: absolute; left: 0; right: 0; bottom: 12px; margin: 0 auto; width: fit-content; box-sizing: border-box; max-width: calc(100% - 24px);
    display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 28px;
    background: var(--chrome-surface); border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
    backdrop-filter: blur(14px); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    overflow: hidden; white-space: nowrap;
  }
  #work[hidden] { display: none; }
  #work .content { display: contents; }
  #work svg { width: 18px; height: 18px; flex: none; }
  #work .mark { position: relative; display: grid; place-items: center; width: 28px; height: 28px; }
  #work .mark .backlog-mark, #work .label .backlog-mark { filter: grayscale(1); }
  #work .mark .dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  #work .divider { width: 1px; height: 24px; background: var(--hairline); flex: none; }
  #work button { display: flex; align-items: center; gap: 6px; border: 0; background: transparent; padding: 4px; border-radius: 14px; }
  #work .label { display: flex; align-items: center; gap: 8px; margin-right: 4px; padding-left: 8px; font-weight: 600; }
  #work .label .backlog-mark { width: 29px; height: 36px; }
  #work .toggle, #work .chip { height: 38px; border-radius: 20px; }
  #work .toggle { padding: 4px 10px; border: 1px solid var(--hairline); color: var(--muted); }
  #work .toggle[aria-pressed="true"] { color: var(--highlight-text); border-color: var(--highlight); }
  #work .strip { display: flex; align-items: flex-start; gap: 8px; overflow-x: auto; overflow-y: hidden; box-sizing: border-box; height: 54px; padding: 5px 0 0; min-width: 0; }
  #work .chip {
    flex: none; gap: 8px; padding: 4px 10px 4px 4px; border: 1px solid var(--hairline);
    font-size: 10px; letter-spacing: 0.08em; filter: grayscale(1);
  }
  #work .chip:hover { border-color: var(--ink); }
  #work .chip.active { filter: none; border-color: var(--highlight); color: var(--highlight-text); }
  #work .chip .badge { width: 28px; height: 28px; }
  #work .chip .badge .card { inset: 3px; }
  #work .chip .badge .face { font-size: 8px; }
  #work .chip .badge .ring { width: 100%; height: 100%; }
  #work .chip .badge .face svg { width: 12px; height: 12px; }
  #work .chip .badge .ring circle { stroke-width: 4; }
  #work .chip.work-done { --pin: var(--muted); }
  #work .chip.selected { font-weight: 700; }
  #work .fold svg { transition: transform 0.3s ease; }
  #work.open .fold svg { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) {
    #work .fold svg { transition: none; }
  }
`

export interface WorkIsland {
  /** Rebuilds the island for these pins and configured statuses; nothing shows while there are no pins. */
  paint(pins: readonly WorkPin[], statuses: readonly string[], defaultStatus: string): void
  /** Colours the chips of the active tasks, greyscale otherwise, marks those of the selected task (always one of the active ones) and scrolls the first into view. */
  activate(active: readonly string[], selected: string | undefined): void
}

function button(className: string, html: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button')
  node.type = 'button'
  node.className = className
  node.innerHTML = html
  node.addEventListener('click', onClick)
  return node
}

function chip(pin: WorkPin, finishing: boolean, onToggle: (id: string) => void, tip: Tip): HTMLButtonElement {
  const node = button('chip', `${WORK_BADGE}<span>${pin.taskId}</span>`, () => onToggle(pin.taskId))
  node.dataset.task = pin.taskId
  node.style.setProperty('--pin', pin.colour)
  node.dataset.tip = `${pin.assignee ?? 'Unassigned'} · ${pin.title}`
  tip.attach(node)
  fillWorkBadge(node, pin, finishing)
  return node
}

/**
 * The Backlog task island at the map's bottom centre: a pill that unfolds into
 * the label, the configured statuses that have pins and the chip strip. It starts
 * folded with the workflow statuses other than the default and terminal ones
 * shown, and keeps its fold and filters across repaints;
 * clicking a chip toggles its task. The persistent fold control turns while
 * final-size content is clipped out and back in, so text is never scaled.
 */
export function createWorkIsland(
  host: HTMLElement,
  onToggle: (taskId: string) => void,
  onShow: (statuses: readonly string[]) => void,
  tip: Tip,
): WorkIsland {
  const island = document.createElement('div')
  island.id = 'work'
  island.hidden = true
  const content = document.createElement('div')
  content.className = 'content'
  let pins: readonly WorkPin[] = []
  let configuredStatuses: readonly string[] = []
  let statusFilters: WorkStatusFilterState | undefined
  /** Done pins kept visible until their flip ends. */
  const finishing = new Set<string>()
  /** Finishing pins that have not yet been inserted with their animation class. */
  const animating = new Set<string>()
  let open = false
  let active: readonly string[] = []
  let selected: string | undefined
  let foldRevision = 0
  let foldAnimation: Animation | undefined

  const toggle = (status: string): HTMLButtonElement => {
    const pressed = statusFilters?.enabled.includes(status) ?? false
    const node = button('toggle', `${EYE_MARK}${status}`, () => {
      statusFilters = toggleWorkStatus(statusFilters!, status)
      onShow(statusFilters.enabled)
      rebuild()
    })
    node.setAttribute('aria-pressed', String(pressed))
    return node
  }
  /** The island's changing content for the folded pill or open row. */
  const parts = (): Node[] => {
    const mark = document.createElement('span')
    mark.className = 'mark'
    mark.innerHTML = `${BACKLOG_MARK}${pins.some(pin => !pin.terminal) ? '<span class="dot"></span>' : ''}`
    const divider = document.createElement('span')
    divider.className = 'divider'
    if (!open) return [mark, divider]
    const label = document.createElement('span')
    label.className = 'label'
    label.innerHTML = `${BACKLOG_MARK}<span>Backlog.md<br>Tasks</span>`
    const strip = document.createElement('div')
    strip.className = 'strip'
    const order = new Map(configuredStatuses.map((status, index) => [status, index]))
    const shown = pins.filter(pin => statusFilters!.enabled.includes(pin.status) || finishing.has(pin.key))
    shown.sort((left, right) => order.get(left.status)! - order.get(right.status)!)
    strip.append(...shown.map(pin => chip(pin, animating.has(pin.key), onToggle, tip)))
    return [
      label,
      ...statusFilters!.available.map(toggle),
      divider,
      strip,
    ]
  }
  /** Colours the active tasks' chips, marks the selected task's and scrolls the strip to centre the first of those when it lies outside the visible part. */
  const mark = (): void => {
    for (const chip of island.querySelectorAll<HTMLElement>('.chip')) {
      chip.classList.toggle('active', active.includes(chip.dataset.task!))
      chip.classList.toggle('selected', chip.dataset.task === selected)
    }
    const chip = island.querySelector<HTMLElement>('.chip.selected')
    if (chip === null) return
    const strip = chip.parentElement!
    const box = strip.getBoundingClientRect()
    const { left, right } = chip.getBoundingClientRect()
    if (left >= box.left && right <= box.right) return
    strip.scrollBy({ left: (left + right - box.left - box.right) / 2, behavior: 'smooth' })
  }
  /** Rebuilds only changing content; the disclosure control remains the same DOM node. */
  const rebuild = (): void => {
    const scrolled = island.querySelector('.strip')?.scrollLeft ?? 0
    foldAnimation?.cancel()
    foldAnimation = undefined
    foldRevision += 1
    content.replaceChildren(...parts())
    animating.clear()
    island.hidden = pins.length === 0
    island.classList.toggle('open', open)
    // the strip stays where it was, so a repaint moves it only to reveal a selected chip
    island.querySelector('.strip')?.scrollTo(scrolled, 0)
    mark()
  }
  const fold = button('fold', CHEVRON, () => {
    open = !open
    island.classList.toggle('open', open)
    fold.setAttribute('aria-expanded', String(open))
    const revision = ++foldRevision
    foldAnimation?.cancel()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rebuild()
      return
    }
    const cover = island.animate(
      [
        { clipPath: 'inset(0 round 28px)', opacity: 1 },
        { clipPath: 'inset(0 46% round 28px)', opacity: 0.25 },
      ],
      { duration: 120, easing: 'ease-in', fill: 'forwards' },
    )
    foldAnimation = cover
    cover.finished.then(() => {
      if (revision !== foldRevision) return
      content.replaceChildren(...parts())
      mark()
      cover.cancel()
      foldAnimation = island.animate(
        [
          { clipPath: 'inset(0 46% round 28px)', opacity: 0.25 },
          { clipPath: 'inset(0 round 28px)', opacity: 1 },
        ],
        { duration: 160, easing: 'ease-out' },
      )
    }).catch(() => undefined)
  })
  fold.setAttribute('aria-expanded', 'false')
  island.append(content, fold)
  host.append(island)
  return {
    paint(nextPins, nextStatuses, defaultStatus) {
      const visible = new Set(open
        ? pins
          .filter(pin => statusFilters?.enabled.includes(pin.status) || finishing.has(pin.key))
          .map(pin => pin.key)
        : [])
      const started = finishingWorkKeys(pins, nextPins)
      for (const key of started) {
        if (visible.has(key)) {
          finishing.add(key)
          animating.add(key)
        } else started.delete(key)
      }
      const enabled = preservedWorkStatuses(configuredStatuses, statusFilters?.enabled)
      pins = nextPins
      configuredStatuses = nextStatuses
      statusFilters = workStatusFilters(
        configuredStatuses,
        defaultStatus,
        pins.map(pin => pin.status),
        enabled,
      )
      onShow(statusFilters.enabled)
      rebuild()
      if (started.size > 0) setTimeout(() => {
        for (const key of started) finishing.delete(key)
        rebuild()
      }, WORK_BADGE_FLIP_MS)
    },
    activate(nextActive, nextSelected) {
      active = nextActive
      selected = nextSelected
      mark()
    },
  }
}
