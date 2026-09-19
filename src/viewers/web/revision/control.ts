import type { WebDataSource } from '../data.ts'
import { bindPopover } from '../atoms/popover.ts'
import type { WebBootPayload, WebPayload, WebWorkPayload } from '../payload.ts'
import { createRevisionSession } from './session.ts'
import { createRevisionPicker, type PickerView } from './picker.ts'

interface RevisionControlOptions {
  control: HTMLDetailsElement
  body: HTMLElement
  boot: WebBootPayload
  data: WebDataSource
  applyRevision: (payload: WebPayload) => void
  applyWorld: (payload: WebPayload) => void
  applyWork: (payload: WebWorkPayload) => void
}

export function createRevisionControl(options: RevisionControlOptions) {
  const { control, body, boot, data, applyRevision, applyWorld, applyWork } = options
  const label = control.querySelector<HTMLElement>('.revision-current')!
  let payload: WebPayload = boot
  const session = createRevisionSession()
  let scope = boot.comparison?.task?.id
  let appliedWorld = boot.generation
  let appliedWork = boot.workGeneration
  let labels: PickerView | undefined
  let refreshing = false
  let refreshAgain = false
  function current(): PickerView {
    const target = payload.revision ? { sha: payload.revision.id, label: payload.revision.shortId } : { label: 'Working tree' }
    const base = payload.comparison?.range.base
    return labels ?? { target, ...(base ? { base: { sha: base, label: base.slice(0, 8) } } : {}) }
  }
  function show(next: WebPayload) {
    payload = next
    appliedWorld = next.generation
    appliedWork = next.workGeneration
    const view = current()
    label.textContent = (view.base ? view.base.label + ' → ' : '') + view.target.label
    label.title = (view.base ? view.base.sha + ' → ' : '') + (view.target.sha ?? 'Working tree')
    control.querySelector('summary')!.setAttribute('aria-label', 'Revision: ' + label.textContent)
    body.toggleAttribute('data-revision', next.revision !== null || next.comparison !== undefined)
    body.toggleAttribute('data-comparison', next.comparison !== undefined)
  }
  async function load(read: () => Promise<WebPayload>, reset: boolean, nextLabels?: PickerView) {
    control.setAttribute('aria-busy', 'true')
    try {
      const next = await session.load(read, reset)
      if (!next) return
      labels = nextLabels
      scope = next.comparison?.task?.id
      show(next)
      if (reset) { control.open = false; applyRevision(next) }
      else applyWorld(next)
    } catch (error) {
      control.open = true; picker.error(error)
    } finally { if (!session.pending) control.removeAttribute('aria-busy') }
  }
  const picker = createRevisionPicker({
    menu: control.querySelector<HTMLElement>('.revision-menu')!, data, current,
    begin: () => { session.begin(); control.setAttribute('aria-busy', 'true') }, cancel: () => { session.cancel(); control.removeAttribute('aria-busy') },
    refresh: () => { void load(() => data.readWorld(payload.revision?.id, payload.comparison?.range.base, scope), false, labels) },
    apply(view) { scope = undefined; void load(() => data.readWorld(view.target.sha, view.base?.sha), true, view) },
  })
  bindPopover(control, { dismiss() { control.open = false; picker.cancel() } })
  control.addEventListener('toggle', () => {
    if (control.open && data.readRevisionSources) void picker.open()
    if (!control.open) picker.cancel()
  })
  control.addEventListener('keydown', event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); picker.cancel(); control.open = false; control.querySelector('summary')!.focus() }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = [...control.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a')].filter(element => !element.hidden)
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    event.preventDefault()
    buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
  })
  async function refresh() {
    if (!payload.comparison || payload.revision !== null) return
    if (refreshing) { refreshAgain = true; return }
    refreshing = true
    const range = payload.comparison.range
    try { await load(() => data.readWorld(undefined, range.base, scope), false, labels) }
    finally { refreshing = false; if (refreshAgain) { refreshAgain = false; void refresh() } }
  }
  const subscription = data.subscribe({
    git() { void refresh() },
    world(next) {
      if (payload.comparison) { void refresh(); return }
      if (payload.revision !== null || next.generation <= appliedWorld) return
      show(next); applyWorld(next)
    },
    work(next) {
      if (payload.revision !== null && !payload.comparison || next.workGeneration <= appliedWork) return
      appliedWork = next.workGeneration
      applyWork(payload.comparison && payload.revision !== null ? { ...next, pins: [] } : next)
    },
  })
  window.addEventListener('pagehide', () => { session.cancel(); picker.cancel(); subscription.close() }, { once: true })
  show(boot)
  return {
    get selected() { return payload.revision?.id },
    get base() { return payload.comparison?.range.base },
    get scope() { return scope },
    setScope(id?: string) { scope = id },
    async reviewTask(id: string) {
      if (data.readTaskReview) await load(() => data.readTaskReview!(id), true)
    },
    paintProjectEdit(root: ParentNode) {
      root.querySelector('[data-project-edit]')?.toggleAttribute('hidden', payload.revision !== null || payload.comparison !== undefined || data.edit === undefined)
    },
  }
}
