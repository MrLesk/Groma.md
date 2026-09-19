import type { AnnotatedArchitectureModel, WorkItem, WorkSnapshot } from '../../../types.ts'
import { sharedFiles } from '../../../work/pins.ts'
import { scopeChanges } from '../../../comparison/model.ts'
import type { ComparisonPresentation, ChangedFile } from '../../../comparison/model.ts'
import type { WebComparison } from '../payload.ts'
import type { WebDataSource } from '../data.ts'
import type { FileDiff } from '../../source/diff-lines.ts'
import { leaveChangeFile, paintChangeFile } from '../changes/view.ts'
import { comparisonTree, changeLabels, reasonSummary, changedFileRows, fileSummary } from './view.ts'

const ownedFiles = (files: ChangedFile[], id?: string) => id === undefined ? [] : files.filter(file => file.beforeOwner === id || file.afterOwner === id)
const message = (error: unknown) => error instanceof Error ? error.message : String(error)

interface Options {
  details: HTMLElement
  tree: HTMLElement
  data: WebDataSource
  boot?: WebComparison
  world(): AnnotatedArchitectureModel
  work(): WorkSnapshot
  select(id: string): void
  repaint(): void
  project(): void
  scope(id?: string): void
  expose(): void
}

/** Comparison owns only its paint, scope and file drill-down, inside the existing panes. */
export function createComparisonControl(options: Options) {
  let review = options.boot
  let task = review?.task
  const initial = new URLSearchParams(location.search).get('presentation')
  let presentation: ComparisonPresentation = initial === 'before' || initial === 'after' ? initial : 'changes'
  let opened: string | undefined
  let diff: FileDiff | undefined
  let error: string | undefined
  let serial = 0
  let scroll = 0
  function changes() {
    if (!review) return undefined
    const scoped = scopeChanges(review, task?.modifiedFiles)
    const shared = task ? sharedFiles(task, options.work()) : new Set<string>()
    return { ...scoped, files: scoped.files.map(file => ({ ...file, shared: shared.has(file.file) || shared.has(file.previousFile ?? '') })) }
  }
  function clearFile() {
    serial++; opened = undefined; diff = undefined; error = undefined
    leaveChangeFile(options.details)
  }
  async function loadFile(file: string) {
    if (!review || !options.data.readChangeFile) return
    const ticket = ++serial
    opened = file; diff = undefined; error = undefined
    try {
      const result = await options.data.readChangeFile(review.id, file)
      if (ticket !== serial) return
      diff = result
    } catch (reason) { if (ticket === serial) error = message(reason) }
    if (ticket === serial) options.repaint()
  }
  function open(file: string) {
    scroll = options.details.scrollTop
    void loadFile(file)
    options.expose(); options.repaint()
  }
  const contains = (world: AnnotatedArchitectureModel, id?: string) => world.elements.some(element => element.representationId === id) || world.relationships.some(item => item.id === id)
  function detailWorld(id?: string): AnnotatedArchitectureModel {
    if (!review) return options.world()
    if (presentation === 'before' && contains(review.before, id)) return review.before
    return contains(review.after, id) ? review.after : review.before
  }
  options.tree.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (!button || !review) return
    if (button.dataset.presentation) {
      presentation = button.dataset.presentation as ComparisonPresentation
      clearFile(); options.project(); options.repaint()
    } else if (button.hasAttribute('data-clear-scope')) {
      task = undefined; clearFile(); options.scope(); options.repaint()
    } else if (button.dataset.changeElement) options.select(button.dataset.changeElement)
    else if (button.dataset.changeFile) void open(button.dataset.changeFile)
  })
  return {
    get active() { return review !== undefined },
    get id() { return review?.id },
    get presentation() { return presentation },
    get task() { return task },
    get file() { return opened },
    changes,
    detailWorld,
    revision(id?: string) {
      if (!review) return undefined
      return detailWorld(id) === review.before ? review.range.base
        : review.range.target.kind === 'commit' ? review.range.target.sha : undefined
    },
    sheet() { return presentation === 'changes' ? undefined : review?.scenes[presentation] },
    profile() { return review?.projects[presentation === 'before' ? 'before' : 'after'] },
    set(next?: WebComparison) {
      const changedRange = JSON.stringify(next?.range) !== JSON.stringify(review?.range)
      review = next
      if (changedRange) { task = next?.task; presentation = 'changes' }
      else if (next?.task) task = next.task
      if (!changedRange && opened && changes()?.files.some(file => file.file === opened)) void loadFile(opened)
      else clearFile()
    },
    focus(next?: WorkItem) {
      if (!review) return
      task = next; clearFile(); options.scope(next?.id)
    },
    clearFile,
    open,
    paintTree() {
      const scoped = changes()
      if (!review || !scoped) return false
      options.tree.innerHTML = comparisonTree(options.world(), scoped, presentation, task?.id)
      return true
    },
    paintFile() {
      if (!review || !opened) return false
      const selected = changes()!.files.find(file => file.file === opened)!
      const source = { kind: review.range.target.kind, base: review.range.base, revision: review.range.target.kind === 'commit' ? review.range.target.sha : 'Working tree' }
      const back = () => { clearFile(); options.repaint(); options.details.scrollTop = scroll }
      paintChangeFile(options.details, task?.id ?? 'Comparison', source,
        diff ? { ...diff, shared: selected.shared ?? false } : fileSummary(selected), back)
      if (!diff) options.details.querySelector('.task-diff-status')!.textContent = error ?? 'Loading changes…'
      return true
    },
    decorate(id: string | undefined, tab: string) {
      if (!review || !id) return
      const scoped = changes()!
      const world = detailWorld(id)
      const element = world.elements.find(element => element.representationId === id)
      const elementChange = scoped.elements.find(change => change.id === element?.id)
      const change = elementChange ?? scoped.relationships.find(change => change.id === id)
      const files = ownedFiles(scoped.files, element?.id)
      if (!change && !files.length) return
      const summary = document.createElement('section')
      summary.className = 'comparison-summary'
      const status = document.createElement('div')
      const statusName = change?.status ?? 'edited'
      status.className = 'comparison-status ' + statusName
      status.textContent = changeLabels[statusName] + ' · ' + (world === review.before ? 'Before' : 'After')
      summary.append(status)
      if (elementChange) summary.append(reasonSummary(elementChange, review.before))
      if (tab === 'how') summary.append(changedFileRows(files, file => { void open(file) }))
      options.details.querySelector('.body')!.prepend(summary)
    },
  }
}
