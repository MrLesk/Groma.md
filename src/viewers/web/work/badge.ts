import { monogram } from '../../../work/pins.ts'
import type { WorkPin } from '../../../work/pins.ts'
import { MARKS } from '../atoms/marks.ts'
import { BACKLOG_MARK } from './backlog-mark.ts'

/** The ring's radius in the badge's 40 px box. */
const RING_RADIUS = 18
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/** How long a visible work badge takes to turn into its Done face. */
export const WORK_BADGE_FLIP_MS = 500

export const workBadgeCss = `
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
  .badge .face.front { background: var(--paper); color: var(--ink); border: 1px solid var(--pin); }
  .badge .face.back { background: var(--accent); color: var(--on-colour); transform: rotateY(180deg); font-size: 14px; }
  .work-done .badge .card { transform: rotateY(180deg); }
  .work-finishing .badge .card { animation: work-badge-finish ${WORK_BADGE_FLIP_MS}ms ease both; }
  @keyframes work-badge-finish {
    from { transform: rotateY(0); }
    to { transform: rotateY(180deg); }
  }
`

/** A ringed work badge with a mark on the front and a checkmark on the back. */
export const WORK_BADGE = `<div class="badge"><svg class="ring" viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="${RING_RADIUS}"/><circle class="done" cx="20" cy="20" r="${RING_RADIUS}"/></svg>`
  + '<div class="card"><div class="face front"></div><div class="face back">✓</div></div></div>'

/** Keys whose existing work changed from running to Done in this update. */
export function finishingWorkKeys(previous: readonly WorkPin[], next: readonly WorkPin[]): Set<string> {
  const wasDone = new Map(previous.map(pin => [pin.key, pin.terminal]))
  return new Set(next
    .filter(pin => pin.terminal && wasDone.get(pin.key) === false)
    .map(pin => pin.key))
}

/** Fills a work badge with its state, assignee mark and acceptance-criteria progress. */
export function fillWorkBadge(host: HTMLElement, pin: WorkPin, finishing = false): void {
  host.classList.toggle('work-done', pin.terminal)
  host.classList.toggle('work-finishing', finishing)
  host.querySelector<HTMLElement>('.face.front')!.innerHTML = pin.assignee === null
    ? BACKLOG_MARK
    : MARKS[pin.assignee.replace(/^@/, '')] ?? monogram(pin.assignee)
  host.querySelector<SVGCircleElement>('.ring .done')!.style.strokeDasharray =
    `${(pin.total === 0 ? 0 : pin.done / pin.total) * RING_LENGTH} ${RING_LENGTH}`
}
