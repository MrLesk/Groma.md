import type { WebDataSource } from '../data.ts'
import { bindPopover } from '../atoms/popover.ts'
import type { WebBootPayload, WebPayload, WebWorkPayload } from '../payload.ts'
import { NARROW_HEADER, pendingPairFields, revisionFields, revisionOptions, snapshotNotice, type RevisionField } from './view.ts'

interface RevisionControlOptions {
  box: HTMLElement
  body: HTMLElement
  boot: WebBootPayload
  data: WebDataSource
  applyRevision: (payload: WebPayload) => void
  applyWorld: (payload: WebPayload) => void
  applyWork: (payload: WebWorkPayload) => void
}

const placeholders: Record<RevisionField, string> = {
  revision: 'Find a commit or message…',
  from: 'Choose starting revision…',
  to: 'Choose destination…',
}

const searchLabels: Record<RevisionField, string> = {
  revision: 'Find revision by commit ID or message',
  from: 'Find the starting revision by commit ID or message',
  to: 'Find the destination revision by commit ID or message',
}

function localizeDates(root: ParentNode): void {
  const format = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  for (const time of root.querySelectorAll<HTMLTimeElement>('time[datetime]')) {
    time.textContent = format.format(new Date(time.dateTime))
  }
}

function revisionTooltip(list: HTMLElement) {
  const tooltip = document.createElement('div')
  tooltip.className = 'revision-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  document.body.append(tooltip)

  const hide = (): void => {
    tooltip.hidden = true
  }
  list.addEventListener('mouseover', event => {
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
  list.addEventListener('mouseout', event => {
    const option = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-body]')
      : null
    const next = event.relatedTarget
    if (option === null || (next instanceof Node && (option.contains(next) || tooltip.contains(next)))) return
    hide()
  })
  tooltip.addEventListener('mouseleave', hide)
  return { element: tooltip, hide }
}

/**
 * Owns one authoritative revision or pair, and which field is the commit search right now.
 * An open field is only a draft: the displayed view changes when a commit is chosen.
 */
export function createRevisionControl(options: RevisionControlOptions) {
  const { box, body, boot, data, applyRevision, applyWorld, applyWork } = options
  // `box` is the text field that holds the revision fields; `root` also holds the commit list and the x.
  const root = box.parentElement!
  const fields = box.querySelector<HTMLElement>('.revision-fields')!
  const search = box.querySelector<HTMLInputElement>('.revision-search')!
  const compare = root.querySelector<HTMLElement>('.revision-compare')!
  /** Measures text in the search's font without laying anything out. */
  const measuring = document.createElement('canvas').getContext('2d')!
  const narrowHeader = matchMedia(NARROW_HEADER)
  const menu = root.querySelector<HTMLElement>('.revision-menu')!
  const results = menu.querySelector<HTMLElement>('.revision-results')!
  const error = menu.querySelector<HTMLElement>('.revision-error')!
  const end = document.getElementById('end-comparison')!
  const { element: tooltip, hide: hideTooltip } = revisionTooltip(menu)
  let current: WebPayload = boot
  let revisions = boot.revisions
  const singleSnapshot = boot.delivery.kind === 'published' && revisions.length < 2
  const workingTree = boot.delivery.kind === 'live' || boot.revision === null
  let editing: RevisionField | undefined
  let paintedFields = ''
  let historyLoaded = boot.delivery.kind === 'published' || revisions.length > 0
  let request = 0
  let navigating = false
  let pendingWorld: WebPayload | undefined
  let appliedWork = boot.workGeneration

  const selected = () => current.revision?.id
  const from = () => current.comparison === undefined ? undefined : current.comparison.from?.id ?? ''
  const live = () => current.comparison === undefined && current.revision === null && boot.delivery.kind === 'live'
  /** A start is being chosen for a comparison that does not exist yet. */
  const starting = () => editing === 'from' && current.comparison === undefined

  /** The commit list sits under the slot it edits: the box for the first slot, the rule after "vs." for the second. */
  function placeMenu(): void {
    // A narrow header hides "vs." while a field is open; the list then sits under the box.
    const versus = editing === 'to' ? box.querySelector<HTMLElement>('.revision-vs') : null
    const left = versus !== null && versus.offsetParent !== null ? versus.getBoundingClientRect().right - root.getBoundingClientRect().left : 0
    root.style.setProperty('--field-left', `${Math.round(left)}px`)
  }

  function paintResults(): void {
    if (singleSnapshot) { results.innerHTML = snapshotNotice(current.revision); localizeDates(results); return }
    // Ids use '' for the working tree. A start that is still being chosen holds nothing yet.
    const viewed = selected() ?? ''
    const held = editing === 'from' ? from() : viewed
    const otherEndpoint = { revision: undefined, from: viewed, to: from() }[editing ?? 'revision']
    results.innerHTML = revisionOptions(revisions, held, search.value, workingTree)
    // A comparison runs from an older revision to a newer one. The list runs newest first under the working tree, so a
    // start must sit below its destination and a destination above its start.
    const position = new Map(['', ...revisions.map(revision => revision.id)].map((id, index) => [id, index]))
    const other = position.get(otherEndpoint ?? '') ?? 0
    for (const option of results.querySelectorAll<HTMLButtonElement>('[data-revision]')) {
      const here = position.get(option.dataset.revision!) ?? 0
      option.disabled = editing === 'from' ? here <= other : editing === 'to' && here >= other
    }
    localizeDates(results)
  }

  /** "or compare 2 revisions" ends the browsing search while it is empty; a single snapshot has nothing to compare. */
  function paintCompareEntry(): void {
    compare.hidden = editing !== 'revision' || search.value !== '' || singleSnapshot
  }

  /**
   * Projects the state onto three attributes the CSS reads:
   * `data-open` on the root: the list is open and the box shows the focus ring;
   * `data-editing` on the box: the slot the search occupies (absent for a single snapshot, whose field stays);
   * `data-starting` on the box: "vs." and the viewed revision wait beside a start that is being chosen.
   */
  function paint(): void {
    const opened = editing !== undefined
    root.toggleAttribute('data-open', opened)
    box.toggleAttribute('data-starting', starting())
    if (editing === undefined || singleSnapshot) delete box.dataset.editing
    else box.dataset.editing = editing
    // Live refreshes repaint often; untouched fields keep their focus and do not replay their entrance.
    const nextFields = starting() ? pendingPairFields(current.revision) : revisionFields(current)
    if (nextFields !== paintedFields) { fields.innerHTML = nextFields; paintedFields = nextFields }
    search.hidden = !opened || singleSnapshot
    search.placeholder = placeholders[editing ?? 'revision']
    search.setAttribute('aria-label', searchLabels[editing ?? 'revision'])
    paintCompareEntry()
    end.hidden = current.comparison === undefined && !starting()
    end.title = starting() ? 'Cancel comparison' : 'End comparison'
    end.setAttribute('aria-label', end.title)
    menu.hidden = !opened
    placeMenu()
  }

  function close(): void {
    // A chosen commit is already loading; cancelling now would still open it.
    if (editing === undefined || navigating) return
    editing = undefined
    hideTooltip()
    paint()
  }

  /** A start is usually a parent of the destination, so its list opens at the destination row. */
  function revealDestination(): void {
    const destination = starting() ? results.querySelector<HTMLElement>(`[data-revision="${selected() ?? ''}"]`) : null
    // 6px is the list's own padding, so the row sits flush with its top.
    if (destination !== null) menu.scrollTop = Math.max(0, destination.offsetTop - 6)
  }

  async function loadHistory(): Promise<void> {
    if (historyLoaded) return
    box.setAttribute('aria-busy', 'true')
    try {
      revisions = await data.readRevisions()
      historyLoaded = true
      if (editing !== undefined) { paintResults(); revealDestination() }
    } catch (reason) { showError(reason) }
    finally { if (!navigating) box.removeAttribute('aria-busy') }
  }

  /** Whether the search, as laid out now, shows its whole placeholder. */
  function showsPlaceholder(): boolean {
    const style = getComputedStyle(search)
    measuring.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    return search.clientWidth >= measuring.measureText(search.placeholder).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
  }

  /**
   * The search takes the edited field's place and width, and the other field keeps its own. The compare words end the
   * browsing search inside the box while the whole placeholder still shows beside them; a shorter box keeps its width
   * and they wait just outside it. A narrow header's search takes the whole box, so there they always stay inside.
   */
  function edit(field: RevisionField, slotWidth: number, otherWidth?: number): void {
    box.style.setProperty('--box-width', `${Math.round(box.getBoundingClientRect().width)}px`)
    search.after(compare)
    box.style.setProperty('--slot-width', `${Math.round(slotWidth)}px`)
    box.style.setProperty('--other-width', otherWidth === undefined ? 'none' : `${Math.round(otherWidth)}px`)
    editing = field
    search.value = ''
    error.hidden = true
    paint()
    if (!compare.hidden && !narrowHeader.matches && !showsPlaceholder()) box.after(compare)
    paintResults()
    revealDestination()
    search.focus()
    void loadHistory()
  }

  function open(field: RevisionField): void {
    // Widths are read from the closed layout, also when another field is the search right now.
    close()
    const width = (name: RevisionField) => fields.querySelector(`[data-field="${name}"]`)?.getBoundingClientRect().width
    const other = field === 'from' ? width('to') : field === 'to' ? width('from') : undefined
    edit(field, width(field) ?? 0, other)
  }

  /** "compare 2 revisions": the search moves to the start slot and the viewed revision waits as the destination. */
  function startComparison(): void {
    edit('from', 260)
  }

  function setRevision(payload: WebPayload): void {
    current = payload
    body.toggleAttribute('data-revision', !live())
    body.toggleAttribute('data-comparison', payload.comparison !== undefined)
    paint()
  }

  /** Errors live at the top of the commit list, so a failure with nothing open opens the viewed revision's list. */
  function showError(reason: unknown): void {
    error.textContent = reason instanceof Error ? reason.message : String(reason)
    error.hidden = false
    menu.scrollTop = 0
    if (editing !== undefined) return
    editing = current.comparison === undefined ? 'revision' : 'to'
    paint()
    paintResults()
  }

  async function load(revision?: string, starting?: string, reset = true): Promise<void> {
    const loading = ++request
    navigating = true
    error.hidden = true
    hideTooltip()
    box.setAttribute('aria-busy', 'true')
    try {
      const payload = await data.readWorld(revision, starting)
      if (loading !== request) return
      appliedWork = payload.workGeneration
      if (reset) editing = undefined
      setRevision(payload)
      if (reset) applyRevision(payload)
      else applyWorld(payload)
    } catch (reason) {
      if (loading === request) showError(reason)
    } finally {
      if (loading === request) {
        navigating = false
        box.removeAttribute('aria-busy')
        const pending = pendingWorld
        pendingWorld = undefined
        if (pending !== undefined) refreshWorld(pending)
      }
    }
  }

  function chooseRevision(revision: string): void {
    if (editing === 'from') void load(selected(), revision)
    else if (editing === 'to') void load(revision || undefined, from())
    else void load(revision || undefined)
  }

  bindPopover(root, { dismiss: close, companion: tooltip })
  // A filtered list starts over at its first match, the one Enter chooses.
  search.addEventListener('input', () => { paintCompareEntry(); paintResults(); menu.scrollTop = 0 })
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && editing !== undefined) {
      event.preventDefault()
      // The page's own Escape deselects the map; here it only closes the list.
      event.stopPropagation()
      const edited = editing
      close()
      const field = fields.querySelector<HTMLElement>(`[data-field="${edited}"]`) ?? fields.querySelector<HTMLElement>('.revision-field')
      field?.focus()
    } else if (event.target === search && event.key === 'ArrowDown') {
      event.preventDefault()
      results.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    } else if (event.target === search && event.key === 'Enter') {
      event.preventDefault()
      results.querySelector<HTMLButtonElement>('button:not(:disabled)')?.click()
    }
  })
  root.addEventListener('click', event => {
    if (navigating || !(event.target instanceof Element)) return
    const field = event.target.closest<HTMLElement>('.revision-field')?.dataset.field as RevisionField | undefined
    // An edited field is hidden, except in a single snapshot, where a second click closes its notice.
    if (field !== undefined) { if (editing === field) close(); else open(field); return }
    if (event.target.closest('[data-action="compare"]') !== null) { startComparison(); return }
    // Match the list row itself: the page body also carries data-revision.
    const option = event.target.closest<HTMLButtonElement>('.revision-option')
    if (option !== null && !option.disabled) chooseRevision(option.dataset.revision!)
  })
  end.addEventListener('click', () => { if (starting()) close(); else void load(selected()) })
  // The list follows its field whenever the header reflows the box.
  new ResizeObserver(placeMenu).observe(box)

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
