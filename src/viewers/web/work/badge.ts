import { monogram } from '../../../work/pins.ts'
import type { WorkPin } from '../../../work/pins.ts'
import { MARKS } from '../atoms/marks.ts'
import { BACKLOG_MARK } from './backlog-mark.ts'

/** The ring's radius in the badge's 40 px box. */
const RING_RADIUS = 18
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

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
  .badge .face.front { background: var(--paper); color: var(--pin); border: 1px solid var(--pin); }
  .badge .face.back { background: var(--accent); color: #fff; transform: rotateY(180deg); font-size: 14px; }
  .work-done .badge .card { transform: rotateY(180deg); }
`

/** A ringed work badge with a mark on the front and a checkmark on the back. */
export const WORK_BADGE = `<div class="badge"><svg class="ring" viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="${RING_RADIUS}"/><circle class="done" cx="20" cy="20" r="${RING_RADIUS}"/></svg>`
  + '<div class="card"><div class="face front"></div><div class="face back">✓</div></div></div>'

/** Fills a work badge with its state, assignee mark and acceptance-criteria progress. */
export function fillWorkBadge(host: HTMLElement, pin: WorkPin): void {
  host.classList.toggle('work-done', pin.terminal)
  host.querySelector<HTMLElement>('.face.front')!.innerHTML = pin.assignee === null
    ? BACKLOG_MARK
    : MARKS[pin.assignee.replace(/^@/, '')] ?? monogram(pin.assignee)
  host.querySelector<SVGCircleElement>('.ring .done')!.style.strokeDasharray =
    `${(pin.total === 0 ? 0 : pin.done / pin.total) * RING_LENGTH} ${RING_LENGTH}`
}
