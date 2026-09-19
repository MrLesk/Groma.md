import type { RevisionChoice, RevisionSelection, RevisionSourceState, RevisionEntry, RevisionPage } from '@groma/revision-source'
import type { WebDataSource } from '../data.ts'
import { escaped } from '../atoms/escape.ts'

type Target = RevisionChoice | { sha?: undefined; label: string }
export interface PickerView { target: Target; base?: RevisionChoice }
interface Options {
  menu: HTMLElement
  data: WebDataSource
  current(): PickerView
  apply(view: PickerView): void
  refresh(): void
  begin(): void
  cancel(): void
}

/** One popover switches between ordinary navigation and explicit endpoint selection. */
export function createRevisionPicker(options: Options) {
  const { menu, data } = options
  let sources: RevisionSourceState[] = []
  let draft: PickerView | undefined
  let endpoint: 'base' | 'target' = 'base'
  let activeSource = 'git'
  let collection = 'history'
  let request = 0
  let cursor: string | undefined
  let search = ''
  let state = 'open'
  let failure: string | undefined
  let resolving = false
  function cancelResolve() {
    if (resolving) options.cancel()
    resolving = false
  }

  function error(reason: unknown) {
    failure = reason instanceof Error ? reason.message : String(reason)
    const host = menu.querySelector<HTMLElement>('.revision-error')
    if (host) { host.textContent = failure; host.hidden = false }
  }
  function identity(choice: Target | undefined): string {
    return choice === undefined ? 'Choose a commit' : escaped(choice.label) + (choice.sha ? '<code>' + choice.sha + '</code>' : '')
  }
  function collectionOptions() {
    return sources.filter(source => source.enabled).flatMap(source => source.collections.map(item =>
      '<option value="' + escaped(source.id + ':' + item.id) + '"' + (activeSource === source.id && collection === item.id ? ' selected' : '') + '>' + escaped(source.label + ' · ' + item.label) + '</option>')).join('')
  }
  function actionButtons(current: PickerView): string {
    if (draft) return '<strong>Choose ' + endpoint + '</strong><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="apply"' + (draft.base ? '' : ' disabled') + '>Compare</button>'
    return '<button type="button" data-action="compare">Compare with…</button><button type="button" data-action="local">Local changes</button>' + (current.base ? '<button type="button" data-action="stop">Stop comparing</button>' : '')
  }
  function apply(view: PickerView) { request++; failure = undefined; options.apply(view) }
  function render() {
    const current = options.current()
    const selectedSource = sources.find(source => source.id === activeSource)
    const collections = collectionOptions()
    const states = selectedSource?.collections.find(item => item.id === collection)?.states
    const range = draft ?? current
    menu.innerHTML = '<div class="revision-context">' + sources.filter(source => source.enabled && source.context).map(source => escaped(source.context!)).join('<br>') + '</div>'
      + (draft || current.base ? '<div class="revision-range"><button type="button" data-endpoint="base"><span>Base</span>' + identity(range.base) + '</button><span>→</span><button type="button" data-endpoint="target"><span>Target</span>' + identity(range.target) + '</button></div>' : '')
      + '<div class="revision-actions">'
      + actionButtons(current)
      + '<button type="button" data-action="refresh">Refresh</button></div>'
      + '<div class="revision-error" role="alert" hidden></div>'
      + '<button class="anchored-option revision-option" type="button" data-action="working">Working tree</button>'
      + '<button class="anchored-option revision-option" type="button" data-action="head">Latest commit · HEAD</button>'
      + '<div class="revision-search"><select aria-label="Revision source">' + collections + '</select><input type="search" aria-label="Search revisions" placeholder="Search branches and commits" value="' + escaped(search) + '">'
      + (states ? '<select aria-label="Review state">' + states.map(value => '<option' + (value === state ? ' selected' : '') + '>' + escaped(value) + '</option>').join('') + '</select>' : '')
      + '</div><div class="revision-results"></div><button type="button" class="anchored-option" data-action="more" hidden>Load more</button>'
    if (failure) error(failure)
    if (selectedSource && !selectedSource.ready) error(selectedSource.message ?? 'Source unavailable')
  }
  function entryRows(entries: RevisionEntry[]): string {
    return entries.map(entry => '<div class="revision-result"><button class="anchored-option revision-option" aria-current="' + (entry.sha === options.current().target.sha) + '" type="button" data-entry="' + escaped(entry.id) + '"><span class="revision-subject">' + escaped(entry.title) + '</span><span class="revision-meta">' + escaped([entry.state, entry.sha?.slice(0, 8), entry.detail].filter(Boolean).join(' · ')) + '</span></button>'
        + (entry.url ? '<a class="revision-external" href="' + escaped(entry.url) + '" target="_blank" rel="noreferrer" aria-label="Open review on source">↗</a>' : '') + '</div>').join('')
  }
  function paintPage(page: RevisionPage, append: boolean) {
    const results = menu.querySelector<HTMLElement>('.revision-results')!
    const rows = entryRows(page.entries)
    if (append) results.insertAdjacentHTML('beforeend', rows)
    else results.innerHTML = rows || '<div class="revision-context">No matching revisions</div>'
    if (/^[a-f0-9]{7,40}$/i.test(search)) results.insertAdjacentHTML('afterbegin', '<button type="button" class="anchored-option" data-action="commit">Choose commit ' + escaped(search) + '</button>')
    cursor = page.cursor
    menu.querySelector<HTMLElement>('[data-action="more"]')!.hidden = cursor === undefined
  }
  async function list(append = false) {
    cancelResolve()
    const ticket = ++request
    try {
      const source = sources.find(source => source.id === activeSource)
      if (!source?.ready || !data.readRevisionEntries) return
      const results = menu.querySelector<HTMLElement>('.revision-results')!
      if (!append) results.textContent = 'Loading revisions…'
      const page = await data.readRevisionEntries(activeSource, { collection, search, state, cursor: append ? cursor : undefined })
      if (ticket !== request) return
      paintPage(page, append)
    } catch (reason) { if (ticket === request) error(reason) }
  }
  function choose(selection: RevisionSelection) {
    if (selection.base) {
      draft = { base: selection.base, target: selection.target }
      endpoint = 'base'
      render()
      void list()
    } else if (draft) {
      draft = { ...draft, [endpoint]: selection.target }
      render()
      void list()
    } else apply({ target: selection.target })
  }
  async function resolve(source: string, id: string) {
    resolving = true
    options.begin()
    failure = undefined
    const ticket = ++request
    try {
      const selection = await data.resolveRevision!(source, id)
      if (ticket === request) { cancelResolve(); choose(selection) }
    } catch (reason) { if (ticket === request) { cancelResolve(); error(reason) } }
  }
  function redraw() { render(); void list() }
  function working() {
    if (!draft) { apply({ target: { label: 'Working tree' } }); return }
    if (endpoint === 'base' && draft.target.sha) draft = { base: { sha: draft.target.sha, label: draft.target.label }, target: { label: 'Working tree' } }
    else if (endpoint === 'target') draft = { ...draft, target: { label: 'Working tree' } }
    redraw()
  }
  async function local() {
    const ticket = ++request
    try {
      const head = await data.resolveRevision!('git', 'HEAD')
      if (ticket !== request) return
      draft = { base: head.target, target: { label: 'Working tree' } }
      redraw()
    } catch (reason) { if (ticket === request) error(reason) }
  }
  const actions: Record<string, () => void | Promise<void>> = {
    apply() { if (draft?.base) apply(draft) },
    stop() { apply({ target: options.current().target }) },
    head: () => resolve('git', 'HEAD'),
    commit: () => resolve('git', search),
    more: () => list(true),
    refresh() { options.refresh(); return open() },
    working, local,
    compare() { draft = { ...options.current() }; redraw() },
    cancel() { cancelResolve(); draft = undefined; request++; redraw() },
  }
  async function open() {
    const ticket = ++request
    draft = undefined
    menu.innerHTML = '<div class="revision-context">Loading revisions…</div>'
    try {
      const loaded = await data.readRevisionSources!()
      if (ticket !== request) return
      sources = loaded
      render()
      await list()
    } catch (reason) { if (ticket === request) { render(); error(reason) } }
  }
  menu.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (!button) return
    if (button.dataset.entry) { void resolve(activeSource, button.dataset.entry); return }
    if (button.dataset.endpoint) {
      draft ??= { ...options.current() }
      endpoint = button.dataset.endpoint as 'base' | 'target'
      render(); void list(); return
    }
    if (button.dataset.action) void actions[button.dataset.action]?.()
  })
  menu.addEventListener('input', event => {
    if (!(event.target instanceof HTMLInputElement)) return
    search = event.target.value
    void list()
  })
  menu.addEventListener('change', event => {
    if (!(event.target instanceof HTMLSelectElement)) return
    if (event.target.getAttribute('aria-label') === 'Review state') state = event.target.value
    else { [activeSource, collection] = event.target.value.split(':') as [string, string]; search = ''; state = 'open'; failure = undefined; render() }
    void list()
  })
  return { open, error, cancel() { request++; draft = undefined; resolving = false; options.cancel() } }
}
