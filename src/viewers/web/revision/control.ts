import type { WebDataSource } from '../data.ts'
import { bindPopover } from '../atoms/popover.ts'
import type { WebBootPayload, WebPayload, WebWorkPayload } from '../payload.ts'
import { comparisonMenu, revisionLabel, revisionOptions, revisionTitle } from './view.ts'

interface RevisionControlOptions {
  control: HTMLDetailsElement
  body: HTMLElement
  boot: WebBootPayload
  data: WebDataSource
  applyRevision: (payload: WebPayload) => void
  applyWorld: (payload: WebPayload) => void
  applyWork: (payload: WebWorkPayload) => void
}

function localizeDates(control: ParentNode): void {
  const format = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  for (const time of control.querySelectorAll<HTMLTimeElement>('time[datetime]')) {
    time.textContent = format.format(new Date(time.dateTime))
  }
}

function revisionTooltip(control: HTMLElement) {
  const tooltip = document.createElement('div')
  tooltip.className = 'revision-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  document.body.append(tooltip)

  const hide = (): void => {
    tooltip.hidden = true
  }
  control.addEventListener('mouseover', event => {
    const option = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-body]')
      : null
    if (option === null) return
    tooltip.textContent = option.dataset.body ?? ''
    tooltip.hidden = false
    const optionBox = option.getBoundingClientRect()
    const tooltipBox = tooltip.getBoundingClientRect()
    const top = Math.max(12, Math.min(
      window.innerHeight - tooltipBox.height - 12,
      optionBox.top + optionBox.height / 2 - tooltipBox.height / 2,
    ))
    tooltip.style.left = `${Math.max(12, optionBox.left - tooltipBox.width + 2)}px`
    tooltip.style.top = `${top}px`
  })
  control.addEventListener('mouseout', event => {
    const option = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-body]')
      : null
    const next = event.relatedTarget
    if (option === null || (next instanceof Node && (option.contains(next) || tooltip.contains(next)))) return
    hide()
  })
  tooltip.addEventListener('mouseleave', hide)
  control.addEventListener('toggle', () => {
    if (!control.hasAttribute('open')) hide()
  })
  return { element: tooltip, hide }
}

/** Owns one authoritative revision or pair; menu drafts never change the displayed view. */
export function createRevisionControl(options: RevisionControlOptions) {
  const { control, body, boot, data, applyRevision, applyWorld, applyWork } = options
  const label = control.querySelector<HTMLElement>('.revision-current')!
  const search = control.querySelector<HTMLInputElement>('.revision-search')!
  const results = control.querySelector<HTMLElement>('.revision-results')!
  const context = control.querySelector<HTMLElement>('.revision-context')!
  const actions = control.querySelector<HTMLElement>('.revision-actions')!
  const error = control.querySelector<HTMLElement>('.revision-error')!
  const end = document.getElementById('end-comparison')!
  const { element: tooltip, hide: hideTooltip } = revisionTooltip(control)
  let current: WebPayload = boot
  let revisions = boot.revisions
  let mode: 'browse' | 'pair' | 'from' | 'to' = current.comparison === undefined ? 'browse' : 'pair'
  let historyLoaded = boot.delivery.kind === 'published' || revisions.length > 0
  let request = 0
  let navigating = false
  let pendingWorld: WebPayload | undefined
  let appliedWork = boot.workGeneration

  const selected = () => current.revision?.id
  const from = () => current.comparison === undefined ? undefined : current.comparison.from?.id ?? ''
  const live = () => current.comparison === undefined && current.revision === null && boot.delivery.kind === 'live'
  bindPopover(control, { companion: tooltip })

  function paintEndpointContext(): void {
    const fixed = mode === 'from' ? current.revision : current.comparison!.from
    const text = document.createElement('span')
    const direction = mode === 'from' ? 'To' : 'From'
    text.textContent = `${direction}: ${fixed?.subject ?? 'Current working tree'}`
    text.title = revisionTitle(fixed)
    context.append(text)
    context.insertAdjacentHTML('beforeend', '<button class="chrome-button" data-action="cancel">Cancel</button>')
    for (const option of results.querySelectorAll<HTMLButtonElement>('[data-revision]')) {
      option.disabled = option.dataset.revision === (fixed?.id ?? '')
    }
  }

  function paintMenu(): void {
    control.toggleAttribute('data-searching', control.open && mode !== 'pair')
    search.placeholder = { from: 'Choose starting revision…', to: 'Choose destination…', browse: 'Find commit or message…', pair: '' }[mode]
    context.replaceChildren()
    actions.replaceChildren()
    if (mode === 'pair') results.innerHTML = comparisonMenu(current)
    else paintChoices()
    localizeDates(control)
  }

  function paintChoices(): void {
    const active = mode === 'from' ? from() : selected()
    results.innerHTML = revisionOptions(revisions, active, search.value)
    if (mode === 'browse') actions.innerHTML = '<button class="chrome-button" data-action="from">Compare from…</button>'
    else paintEndpointContext()
    localizeDates(control)
  }

  function setRevision(payload: WebPayload): void {
    current = payload
    label.innerHTML = revisionLabel(payload)
    control.toggleAttribute('data-comparison', payload.comparison !== undefined)
    end.hidden = payload.comparison === undefined
    body.toggleAttribute('data-revision', !live())
    body.toggleAttribute('data-comparison', payload.comparison !== undefined)
  }

  function showError(reason: unknown): void {
    error.textContent = reason instanceof Error ? reason.message : String(reason)
    error.hidden = false
    control.open = true
  }

  async function load(revision?: string, starting?: string, reset = true): Promise<void> {
    const loading = ++request
    navigating = true
    error.hidden = true
    hideTooltip()
    if (reset) control.open = false
    control.setAttribute('aria-busy', 'true')
    try {
      const payload = await data.readWorld(revision, starting)
      if (loading !== request) return
      appliedWork = payload.workGeneration
      setRevision(payload)
      if (reset) applyRevision(payload)
      else applyWorld(payload)
    } catch (reason) {
      if (loading === request) showError(reason)
    } finally {
      if (loading === request) {
        navigating = false
        control.removeAttribute('aria-busy')
        const pending = pendingWorld
        pendingWorld = undefined
        if (pending !== undefined) refreshWorld(pending)
      }
    }
  }

  function chooseMode(next: typeof mode): void {
    mode = next
    search.value = ''
    paintMenu()
    if (mode !== 'pair') search.focus()
  }

  search.addEventListener('click', event => event.preventDefault())
  search.addEventListener('input', paintMenu)
  control.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      control.open = false
      control.querySelector('summary')!.focus()
    } else if (event.target === search && event.key === 'ArrowDown') {
      event.preventDefault()
      results.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    } else if (event.target === search && event.key === 'Enter') {
      event.preventDefault()
      results.querySelector<HTMLButtonElement>('button:not(:disabled)')?.click()
    }
  })
  control.addEventListener('toggle', async () => {
    if (!control.open) { control.removeAttribute('data-searching'); return }
    chooseMode(current.comparison === undefined ? 'browse' : 'pair')
    if (historyLoaded) return
    control.setAttribute('aria-busy', 'true')
    try {
      revisions = await data.readRevisions()
      historyLoaded = true
      paintMenu()
    } catch (reason) { showError(reason) }
    finally { if (!navigating) control.removeAttribute('aria-busy') }
  })
  function chooseRevision(revision: string): void {
    if (mode === 'from') void load(selected(), revision)
    else if (mode === 'to') void load(revision || undefined, from())
    else void load(revision || undefined)
  }
  function activate(button: HTMLButtonElement): void {
    const action = button.dataset.action
    if (action === 'cancel') { chooseMode(current.comparison === undefined ? 'browse' : 'pair'); return }
    if (action === 'from' || action === 'to') { chooseMode(action); return }
    const revision = button.dataset.revision
    if (revision === undefined) return
    chooseRevision(revision)
  }
  control.addEventListener('click', event => {
    if (navigating || !(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('button')
    if (button !== null && control.contains(button)) activate(button)
  })
  end.addEventListener('click', () => { void load(selected()) })

  function refreshWorld(payload: WebPayload): void {
    if (navigating) { pendingWorld = payload; return }
    if (payload.generation <= current.generation) return
    if (current.comparison !== undefined) {
      if (current.revision === null || current.comparison.from === null) void load(selected(), from(), false)
    } else if (current.revision === null) {
      setRevision(payload)
      appliedWork = Math.max(appliedWork, payload.workGeneration)
      applyWorld(payload)
    }
  }

  data.subscribe({
    world: refreshWorld,
    work(payload) {
      if (!live() || payload.workGeneration <= appliedWork) return
      appliedWork = payload.workGeneration
      applyWork(payload)
    },
  })
  setRevision(boot)
  return {
    get selected() { return selected() },
    get from() { return from() },
    get comparison() { return current.comparison },
    get live() { return live() },
    paintProjectEdit(root: ParentNode) {
      root.querySelector('[data-project-edit]')?.toggleAttribute('hidden', !live() || data.edit === undefined)
    },
  }
}
