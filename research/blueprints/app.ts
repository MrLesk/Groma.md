import seedProjects from '../../test/fixtures/blueprint-research/projects.json'
import seedBlueprint from '../../test/fixtures/blueprint-research/saved-card.json'
import { decodeBlueprint, encodeBlueprint, inspectMarkdown, validateBlueprint } from './model.ts'
import type { Blueprint, Draft, Project } from './model.ts'
import { commitPlacement, copyDraftIntent, preparePlacement, suggestions } from './placement.ts'
import type { Placement } from './placement.ts'
import { catalogue, bindingPanel, draftPanel, currentPanel } from './panels.ts'
import { button, escapeHtml as e, hierarchy, lockup, studyMap } from './view.ts'

const seeds = seedProjects as Project[]
const library = validateBlueprint(seedBlueprint)
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!
const storageKey = (id: string): string => `groma:blueprint-research:1:${id}`
const params = new URLSearchParams(location.search)
let projectId = seeds.some(project => project.id === params.get('project')) ? params.get('project')! : 'shop'
function loadProject(id: string, saved = localStorage.getItem(storageKey(id))): Project {
  if (saved === null) return structuredClone(seeds.find(project => project.id === id)!)
  const project = JSON.parse(saved) as Project
  if (project.id !== id || !Array.isArray(project.drafts)) throw new Error('Invalid fixture storage. Use a fresh browser profile for this experiment.')
  return project
}
let project = loadProject(projectId)
type Mode = 'catalogue' | 'bindings' | 'preview' | 'draft' | 'current'
let mode: Mode = 'catalogue'
let blueprint: Blueprint = structuredClone(library)
let bindings: Record<string, string> = {}
let placement: Placement | undefined
let draft: Draft | undefined
let baseline: string | null = null
let selected: string | undefined
let previousMode: Mode = 'catalogue'
let error = ''
let viewGeneration = 0
let theme = ['light', 'dark', 'blueprint'].includes(params.get('theme') ?? '') ? params.get('theme')! : 'light'

$('#app').innerHTML = `<header class="topbar chrome">
  <div class="brand">${lockup}</div><div class="separator"></div>
  <label class="project-label">Fixture<select id="project" aria-label="Project fixture">${seeds.map(p => `<option value="${e(p.id)}" ${p.id === projectId ? 'selected' : ''}>${e(p.title)}</option>`).join('')}</select></label>
  <span class="revision">Current revision</span><div class="header-spacer"></div>
  ${button('Paste blueprint', 'paste', 'secondary')}${button('Blueprints', 'catalogue', 'primary')}
  <label class="theme-label"><select id="theme" aria-label="Theme"><option value="light">Light</option><option value="dark">Dark</option><option value="blueprint">Blueprint</option></select></label>
</header><aside class="sidebar chrome"><div class="sidebar-title">Architecture</div><div id="hierarchy"></div><div class="section-label drafts-label">Drafts</div><div id="draft-list"></div><div class="sidebar-foot"><span class="kind-mark"></span>Current <span class="kind-mark ghost"></span>New part</div></aside>
<div id="map" aria-label="Fixture architecture"></div><div class="context chrome" id="context"></div>
<aside id="inspector" class="inspector chrome"><div id="error" role="alert" hidden></div><div id="panel"></div><div id="toast" role="status" hidden></div></aside>
<div class="mobile-switch">${button('Map / Details', 'mobile-map', 'secondary')}</div>
<div class="study-label"><span class="study-dot"></span>BLUEPRINT RESEARCH · FIXTURE DATA ONLY</div>
<dialog id="dialog"><div id="dialog-body"></div></dialog>`
const map = studyMap($('#map'), id => selectCurrent(id))
function selectCurrent(id: string): void {
  if (!project.elements.some(element => element.id === id)) return
  if (mode !== 'current') previousMode = mode
  selected = id
  mode = 'current'
  render()
}
function currentDraft(): Draft | undefined {
  return mode === 'preview' ? placement?.draft : mode === 'draft' ? draft : undefined
}
function render(): void {
  viewGeneration += 1
  $('#toast').hidden = true
  document.documentElement.dataset.theme = theme
  $('#theme').setAttribute('data-mode', theme)
  $<HTMLSelectElement>('#theme').value = theme
  const visible = currentDraft()
  $('#hierarchy').innerHTML = hierarchy(project, visible)
  $('#draft-list').innerHTML = project.drafts.map(item => `<button class="draft-row" data-draft="${e(item.id)}"><span class="draft-glyph"></span><span>${e(item.title)}<small>${e(item.id)}</small></span></button>`).join('') || '<div class="empty-drafts">No drafts yet</div>'
  $('#context').innerHTML = mode === 'preview' ? '<span class="draft-glyph"></span> Preview · nothing saved' : mode === 'draft' ? `<span class="draft-glyph"></span> Draft: ${e(draft!.title)}` : 'Current architecture'
  const panels = {
    catalogue: () => catalogue(library),
    bindings: () => bindingPanel(project, blueprint, bindings),
    preview: () => draftPanel(project, placement!.draft, true),
    draft: () => draftPanel(project, draft!, false),
    current: () => currentPanel(project, selected!),
  }
  $('#panel').innerHTML = panels[mode]()
  $('#error').hidden = !error
  $('#error').textContent = error
  map.paint(project, visible)
}
function announce(message: string): void {
  $('#toast').textContent = message; $('#toast').hidden = false
}
function pending(): boolean {
  const context = mode === 'current' ? previousMode : mode
  return context === 'bindings' || context === 'preview'
}
function discard(): boolean { return !pending() || confirm('Discard this unsaved blueprint placement?') }
function begin(value: Blueprint): void {
  if (!discard()) return
  blueprint = validateBlueprint(value)
  baseline = localStorage.getItem(storageKey(project.id))
  project = loadProject(project.id, baseline)
  bindings = suggestions(project, blueprint)
  placement = undefined; error = ''
  mode = 'bindings'; render()
}
function openDialog(content: string): void {
  $('#dialog-body').innerHTML = content
  $<HTMLDialogElement>('#dialog').showModal()
}
function pasteDialog(): void {
  openDialog(`<h2>Paste a blueprint</h2><p class="muted">Nothing is saved until you confirm its placement.</p><label for="paste-text">Blueprint text</label><textarea id="paste-text" spellcheck="false" rows="7" placeholder="groma-blueprint:1:…"></textarea><div id="dialog-error" role="alert"></div><div class="actions">${button('Cancel', 'close-dialog', 'secondary')}${button('Load blueprint', 'load-paste', 'primary')}</div>`)
  $('#paste-text').focus()
}
async function copy(value: Blueprint): Promise<void> {
  if (!navigator.clipboard) throw new Error('Clipboard access is unavailable. Open Blueprint text to copy manually.')
  const generation = viewGeneration
  await navigator.clipboard.writeText(encodeBlueprint(value))
  if (generation === viewGeneration) announce('Blueprint copied. Open another fixture or tab and paste to place it.')
}
function textDialog(markdown: boolean): void {
  const value = mode === 'draft' ? copyDraftIntent(draft!) : blueprint
  openDialog(`<h2>${markdown ? 'Portable intent · Markdown' : 'Blueprint text'}</h2><p class="muted">No local IDs, source files or scanner evidence.</p><textarea readonly aria-label="Portable blueprint text" rows="15">${e(markdown ? inspectMarkdown(value) : encodeBlueprint(value))}</textarea><div class="actions">${button('Close', 'close-dialog', 'primary')}</div>`)
}
const actions: Record<string, () => void | Promise<void>> = {
  copy: () => copy(library),
  'copy-draft': () => copy(copyDraftIntent(draft!)),
  use: () => begin(library),
  paste: pasteDialog,
  inspect: () => textDialog(true),
  'show-text': () => textDialog(false),
  'close-dialog': () => $<HTMLDialogElement>('#dialog').close(),
  'load-paste': () => {
    try {
      const decoded = decodeBlueprint($<HTMLTextAreaElement>('#paste-text').value)
      $<HTMLDialogElement>('#dialog').close(); begin(decoded)
    } catch (cause) { $('#dialog-error').textContent = (cause as Error).message }
  },
  preview: () => { placement = { draft: preparePlacement(project, blueprint, bindings), baseline }; mode = 'preview'; render() },
  bindings: () => { mode = 'bindings'; render() },
  create: () => {
    project = commitPlacement(localStorage, storageKey(project.id), project, placement!)
    draft = project.drafts.at(-1)!; placement = undefined; mode = 'draft'; render()
  },
  cancel: () => { placement = undefined; mode = 'catalogue'; render() },
  catalogue: () => { if (discard()) { placement = undefined; mode = 'catalogue'; render() } },
  back: () => { mode = previousMode; render() },
  'mobile-map': () => { document.body.classList.toggle('mobile-map'); map.fit() },
}
document.addEventListener('click', async event => {
  const target = event.target as HTMLElement
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
  if (action && actions[action]) {
    error = ''
    try { await actions[action]() }
    catch (cause) { error = (cause as Error).message; render() }
  }
  const element = target.closest<HTMLElement>('[data-element]')?.dataset.element
  if (element) selectCurrent(element)
  const id = target.closest<HTMLElement>('[data-draft]')?.dataset.draft
  if (id && discard()) { draft = project.drafts.find(item => item.id === id)!; placement = undefined; mode = 'draft'; render() }
})
document.addEventListener('change', event => {
  const input = event.target as HTMLSelectElement
  if (input.dataset.bind) { bindings[input.dataset.bind] = input.value; error = ''; render() }
  if (input.id === 'theme') { theme = input.value; render() }
  if (input.id === 'project') {
    if (!discard()) { input.value = project.id; return }
    projectId = input.value; project = loadProject(projectId); mode = 'catalogue'; placement = undefined; draft = undefined; error = ''; render()
  }
})
document.addEventListener('input', event => {
  const input = event.target as HTMLInputElement
  if (input.id !== 'catalogue-search') return
  const match = `${library.title} ${library.outcome}`.toLowerCase().includes(input.value.toLowerCase())
  $('#catalogue-card').hidden = !match; $('#no-results').hidden = match
})
document.addEventListener('paste', event => {
  const target = event.target as HTMLElement
  if (target.closest('input,textarea,select,[contenteditable=true]')) return
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text.startsWith('groma-blueprint:')) return
  event.preventDefault()
  try { begin(decodeBlueprint(text)) }
  catch (cause) { error = (cause as Error).message; render() }
})
window.addEventListener('beforeunload', event => { if (pending()) { event.preventDefault(); event.returnValue = '' } })

/** Read-only observation for the research browser checks; it cannot apply state. */
Object.assign(window, { GromaBlueprintResearch: { snapshot: () => structuredClone({ project, mode, bindings, placement, error }) } })
render()
