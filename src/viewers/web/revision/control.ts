import type { WebDataSource } from '../data.ts'
import { bindPopover } from '../atoms/popover.ts'
import type { WebBootPayload, WebPayload, WebWorkPayload } from '../payload.ts'

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

/** Owns the compact revision selector and applies live or published snapshots. */
export function createRevisionControl(options: RevisionControlOptions) {
  const { control, body, boot, data, applyRevision, applyWorld, applyWork } = options
  const label = control.querySelector<HTMLElement>('.revision-current')!
  const liveLabel = control.querySelector<HTMLElement>('[data-revision=""]')!.textContent!
  const { element: tooltip, hide: hideTooltip } = revisionTooltip(control)
  let selected: string | undefined
  let loading = false
  let appliedWorld = boot.generation
  let appliedWork = boot.workGeneration

  bindPopover(control, { companion: tooltip })

  const show = (payload: WebPayload): void => {
    selected = payload.revision?.id
    label.textContent = payload.revision?.shortId ?? liveLabel
    for (const option of control.querySelectorAll<HTMLElement>('.revision-option[data-revision]')) {
      option.setAttribute('aria-current', String(option.dataset.revision === (selected ?? '')))
    }
    body.toggleAttribute('data-revision', selected !== undefined)
  }

  control.addEventListener('click', async event => {
    const option = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('.revision-option[data-revision]')
      : null
    if (option === null || !control.contains(option) || loading) return
    loading = true
    hideTooltip()
    control.removeAttribute('open')
    control.setAttribute('aria-busy', 'true')
    option.blur()
    const revisionId = option.dataset.revision
    try {
      const payload = await data.readWorld(revisionId === '' ? undefined : revisionId)
      appliedWorld = payload.generation
      appliedWork = payload.workGeneration
      show(payload)
      applyRevision(payload)
    } finally {
      loading = false
      control.removeAttribute('aria-busy')
    }
  })

  data.subscribe({
    world(payload) {
      if (selected !== undefined || payload.generation <= appliedWorld) return
      appliedWorld = payload.generation
      appliedWork = Math.max(appliedWork, payload.workGeneration)
      applyWorld(payload)
    },
    work(payload) {
      if (selected !== undefined || payload.workGeneration <= appliedWork) return
      appliedWork = payload.workGeneration
      applyWork(payload)
    },
  })

  localizeDates(control)
  show(boot)
  return {
    get selected() {
      return selected
    },
    paintProjectEdit(root: ParentNode) {
      root.querySelector('[data-project-edit]')?.toggleAttribute(
        'hidden',
        selected !== undefined || data.edit === undefined,
      )
    },
  }
}
