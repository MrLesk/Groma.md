import type { WorkItem, WorkSnapshot } from '../../../types.ts'
import type { WorkPin } from '../../../work/pins.ts'
import type { Tip } from '../organisms/tip.ts'
import { BACKLOG_MARK } from './backlog-mark.ts'
import { WORK_BADGE_FLIP_MS } from './badge.ts'

export const workSummaryCss = `
  #work .mark { position: relative; display: grid; place-items: center; width: 28px; height: 28px; }
  #work .mark .backlog-mark { filter: grayscale(1); }
  #work .mark .badge { position: absolute; top: -3px; right: -5px; width: 20px; height: 16px; }
  #work .mark .card { inset: 0; }
  #work .mark .face { border-radius: 8px; font-size: 10px; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
  #work .mark .front { overflow: hidden; background: var(--accent); color: var(--on-colour); border: 0; }
  #work .mark .back { font-size: 11px; }
  #work .mark.empty .front { background: var(--muted); }
`

export interface WorkSummary {
  items: WorkItem[]
  count: number
  counts: { status: string; count: number }[]
  enabled: readonly string[]
  terminal: string | undefined
}

/** Count tasks, not assignee pins; use exactly the island's enabled statuses. */
export function summarizeWork(pins: readonly WorkPin[], work: WorkSnapshot, enabled: readonly string[]): WorkSummary {
  const mapped = new Set(pins.map(pin => pin.taskId))
  const items = work.items.filter(item => mapped.has(item.id))
  const counts = work.statuses.map(status => ({ status, count: items.filter(item => item.status === status).length }))
  return {
    items, counts, enabled, terminal: work.statuses.at(-1),
    count: items.filter(item => enabled.includes(item.status)).length,
  }
}

export interface WorkChange {
  kind: 'updated' | 'added' | 'removed' | 'completed'
  item: WorkItem
}

function changedTask(item: WorkItem, old: WorkItem | undefined, previous: WorkSummary, next: WorkSummary): WorkChange | undefined {
  const wasShown = old !== undefined && previous.enabled.includes(old.status)
  if (!wasShown && !next.enabled.includes(item.status)) return undefined
  if (JSON.stringify(old) === JSON.stringify(item)) return undefined
  if (wasShown && old?.status !== previous.terminal && item.status === next.terminal) return { kind: 'completed', item }
  return { kind: old === undefined ? 'added' : 'updated', item }
}

/** Only observed changes to work shown before or after the update announce activity. */
export function latestWorkChange(previous: WorkSummary | undefined, next: WorkSummary): WorkChange | undefined {
  if (previous === undefined) return undefined
  const before = new Map(previous.items.map(item => [item.id, item]))
  const after = new Set(next.items.map(item => item.id))
  const changes: WorkChange[] = []
  for (const item of next.items) {
    const change = changedTask(item, before.get(item.id), previous, next)
    if (change !== undefined) changes.push(change)
  }
  for (const item of previous.items) {
    if (!after.has(item.id) && previous.enabled.includes(item.status)) changes.push({ kind: 'removed', item })
  }
  // Completion gets the shared checkmark; otherwise show the most recently updated task.
  return changes.sort((a, b) => Number(b.kind === 'completed') - Number(a.kind === 'completed')
    || b.item.updatedAt.localeCompare(a.item.updatedAt))[0]
}

/** A persistent folded badge: repaints and filter changes cannot replay task events. */
export function createWorkSummary(tip: Tip) {
  const element = document.createElement('span')
  element.className = 'mark'
  element.setAttribute('role', 'img')
  element.innerHTML = `${BACKLOG_MARK}<span class="badge"><span class="card"><span class="face front"><span class="count"></span></span><span class="face back">✓</span></span></span>`
  tip.attach(element)
  const badge = element.querySelector<HTMLElement>('.badge')!
  const card = element.querySelector<HTMLElement>('.card')!
  const count = element.querySelector<HTMLElement>('.count')!
  let previous: WorkSummary | undefined
  let latest: WorkChange | undefined

  const animate = (change: WorkChange | undefined, delta: number): void => {
    for (const animation of element.getAnimations({ subtree: true })) animation.cancel()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (change?.kind === 'completed') {
      card.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(180deg)' }], {
        duration: WORK_BADGE_FLIP_MS, iterations: 2, direction: 'alternate', easing: 'ease',
      })
    } else if (delta !== 0) {
      count.animate([{ transform: `translateY(${delta > 0 ? 100 : -100}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'ease-out' })
      badge.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)', offset: 0.5 }, { transform: 'translateY(0)', offset: 0.75 }, { transform: 'translateY(0)' }], { duration: 700, easing: 'ease-out' })
    } else if (change !== undefined) {
      badge.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' })
    }
  }

  return {
    element,
    update(pins: readonly WorkPin[], work: WorkSnapshot, enabled: readonly string[], folded: boolean) {
      if (work.statuses.length === 0) {
        previous = undefined
        latest = undefined
      }
      const next = summarizeWork(pins, work, enabled)
      const change = latestWorkChange(previous, next)
      const delta = previous === undefined ? 0 : next.count - previous.count
      latest = change ?? latest
      count.textContent = String(next.count)
      element.classList.toggle('empty', next.count === 0)
      const breakdown = next.counts.filter(row => row.count > 0).map(row => `${row.count} ${row.status}`).join(' · ')
      const event = latest === undefined ? '' : ` · ${latest.item.id} ${latest.kind}: ${latest.item.title}`
      element.dataset.tip = `${next.count} shown · ${breakdown || 'No mapped tasks'}${event}`
      element.setAttribute('aria-label', element.dataset.tip)
      if (folded && (change !== undefined || delta !== 0)) animate(change, delta)
      // The empty boot snapshot precedes the first real work snapshot.
      previous = work.statuses.length === 0 ? undefined : next
    },
  }
}
