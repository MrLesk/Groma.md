import type { ArchitectureGraph, C4Kind, WorkItem, WorkItemDetails } from '../../../types.ts'
import { updateTaskSummary, updateTaskText } from './updates.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { fileDiffRow, leaveFileDiff, paintFileDiff } from '../source/diff-view.ts'
import type { TaskFileDiff } from '../../source/diff.ts'
import type { TaskDiffPayload } from '../../source/diff.ts'

function heading(label: string): HTMLElement {
  const row = document.createElement('h2')
  row.className = 'section'
  row.textContent = label
  return row
}

function marked(kind: C4Kind, external: boolean, text: string): HTMLElement {
  const row = document.createElement('span')
  const mark = document.createElement('span')
  mark.className = 'mark'
  mark.textContent = kindGlyph(kind)
  if (external) mark.classList.add('ghost')
  row.append(mark, ' ', text)
  return row
}

function sourceIdentity(payload: TaskDiffPayload): HTMLElement {
  const source = document.createElement('div')
  source.className = 'task-diff-source'
  source.dataset.taskKey = 'source'
  const kind = document.createElement('span')
  kind.textContent = payload.source.kind === 'commit' ? 'Commit' : 'Working tree from HEAD'
  const revision = document.createElement('code')
  revision.textContent = payload.source.revision
  const base = document.createElement('code')
  base.textContent = `base ${payload.source.base}`
  source.append(kind, revision, base)
  return source
}

function pendingFileRow(file: string, failed: boolean): HTMLElement {
  const row = document.createElement('li')
  row.dataset.taskKey = file
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'diff-file-row'
  button.disabled = true
  const mark = document.createElement('span')
  mark.className = 'diff-file-status pending'
  mark.textContent = failed ? '!' : '…'
  mark.title = failed ? 'Unavailable' : 'Loading'
  const name = document.createElement('span')
  name.className = 'diff-file-name'
  name.textContent = file
  button.append(mark, name)
  row.append(button)
  return row
}

function section(body: Element, key: string, label: string, rows: HTMLElement[]): void {
  if (rows.length === 0) return
  const title = heading(label)
  title.dataset.taskKey = `${key}-heading`
  const list = document.createElement('ul')
  list.dataset.taskKey = key
  const occurrences = new Map<string, number>()
  for (const row of rows) {
    const identity = row.dataset.taskKey!
    const occurrence = occurrences.get(identity) ?? 0
    occurrences.set(identity, occurrence + 1)
    row.dataset.taskKey = `${identity}:${occurrence}`
  }
  list.append(...rows)
  body.append(title, list)
}

function checklistRows(items: readonly { text: string; checked: boolean }[]): HTMLElement[] {
  return items.map(item => {
    const row = document.createElement('li')
    row.dataset.taskKey = item.text
    row.dataset.checked = String(item.checked)
    const check = document.createElement('span')
    check.className = `criterion-mark${item.checked ? ' criterion-check' : ''}`
    check.textContent = item.checked ? '✓' : '○'
    const text = document.createElement('span')
    text.className = item.checked ? 'ghost' : ''
    text.textContent = ` ${item.text}`
    row.append(check, text)
    return row
  })
}

function textSection(body: Element, label: string, text: string): void {
  if (text === '') return
  const content = document.createElement('p')
  content.className = 'task-text'
  content.textContent = text
  const title = heading(label)
  title.dataset.taskKey = `${label}-heading`
  content.dataset.taskKey = label
  body.append(title, content)
}

/** Paints a task summary and its on-demand file status rows. */
export function paintTaskSummary(
  host: HTMLElement,
  item: WorkItem,
  details: WorkItemDetails | undefined,
  detailsError: string | undefined,
  world: ArchitectureGraph,
  payload: TaskDiffPayload | undefined,
  error: string | undefined,
  onSelect: (id: string, additive: boolean) => void,
  onOpen: (file: string) => void,
): void {
  leaveFileDiff(host)
  const byId = new Map(world.elements.map(element => [element.id, element]))
  const continuing = host.querySelector<HTMLElement>('.task-summary')?.dataset.taskId === item.id
  updateTaskText(host.querySelector('h1')!, item.title, continuing)
  updateTaskText(host.querySelector('.meta')!, [item.id, item.status, ...item.assignees].join(' · '), continuing)
  host.querySelector('.tabs')!.replaceChildren()
  const body = document.createElement('div')
  body.className = 'task-summary'
  body.dataset.taskId = item.id
  if (detailsError !== undefined) {
    const status = document.createElement('p')
    status.className = 'diff-status'
    status.dataset.taskKey = 'details-error'
    status.textContent = detailsError
    body.append(status)
  }
  if (details !== undefined && details.description !== '') {
    const paragraph = document.createElement('p')
    paragraph.className = 'description'
    paragraph.dataset.taskKey = 'description'
    paragraph.textContent = details.description
    body.append(paragraph)
  }
  if (details !== undefined) {
    section(
      body,
      'acceptance',
      `Acceptance criteria · ${details.acceptanceCriteria.filter(criterion => criterion.checked).length} of ${details.acceptanceCriteria.length}`,
      checklistRows(details.acceptanceCriteria),
    )
    const done = details.definitionOfDone.filter(criterion => criterion.checked).length
    section(body, 'done', `Definition of Done · ${done} of ${details.definitionOfDone.length}`, checklistRows(details.definitionOfDone))
  }
  textSection(body, 'Implementation plan', details?.implementationPlan ?? '')
  section(body, 'references', 'References', item.references.map(reference => {
    const row = document.createElement('li')
    row.dataset.taskKey = reference
    const element = byId.get(reference)
    if (element === undefined) row.textContent = reference
    else {
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'link'
      link.append(marked(element.kind, element.external, element.title))
      link.onclick = event => onSelect(element.representationId, event.shiftKey)
      row.append(link)
    }
    return row
  }))
  const fileRows = item.modifiedFiles.map(file => {
    const loaded = payload?.files.find(candidate => candidate.file === file)
    if (loaded === undefined) return pendingFileRow(file, error !== undefined)
    const row = fileDiffRow(loaded, onOpen, loaded.shared)
    row.dataset.taskKey = file
    return row
  })
  section(body, 'files', 'Modified files', fileRows)
  if (payload !== undefined) body.append(sourceIdentity(payload))
  else if (error !== undefined) {
    const status = document.createElement('p')
    status.className = 'diff-status'
    status.dataset.taskKey = 'diff-error'
    status.textContent = error
    body.append(status)
  }
  textSection(body, 'Implementation notes', details?.implementationNotes ?? '')
  section(body, 'comments', 'Comments', (details?.comments ?? []).map(comment => {
    const row = document.createElement('li')
    row.className = 'task-comment'
    row.dataset.taskKey = `${comment.author}:${comment.createdAt}`
    const meta = document.createElement('div')
    meta.className = 'ghost'
    meta.textContent = `${comment.author} · ${comment.createdAt}`
    const text = document.createElement('div')
    text.textContent = comment.body
    row.append(meta, text)
    return row
  }))
  updateTaskSummary(host, body)
}

/** Task review owns its identity; source owns the shared file presentation. */
export function paintTaskFile(host: HTMLElement, item: WorkItem, payload: TaskDiffPayload, file: TaskFileDiff, onBack: () => void): void {
  paintFileDiff(host, file, `${item.id}${file.shared ? ' · Shared' : ''}`, onBack, sourceIdentity(payload))
}

export const taskDiffCss = `
  #details .criterion-mark { display: inline-block; }
  #details .task-diff-source { color: var(--muted); display: grid; font-size: 9px; gap: 4px; margin: 12px 0; }
  #details .task-diff-source code { color: inherit; font-family: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #details .task-text { line-height: 1.65; margin: 0; white-space: pre-wrap; }
  #details .task-comment { line-height: 1.65; margin-bottom: 12px; white-space: pre-wrap; }
  #details.diff-open .task-diff-source { border-bottom: 1px solid var(--hairline); margin: 0; padding: 12px 22px; }
`
