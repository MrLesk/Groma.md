import type { ArchitectureGraph, C4Kind, WorkItem, WorkItemDetails } from '../../../types.ts'
import { updateTaskSummary, updateTaskText } from './updates.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { fileRow, sourceIdentity, leaveChangeFile } from '../changes/view.ts'
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

function pendingFileRow(file: string, failed: boolean): HTMLElement {
  const row = document.createElement('li')
  row.dataset.taskKey = file
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'task-file-row'
  button.disabled = true
  const mark = document.createElement('span')
  mark.className = 'task-file-status pending'
  mark.textContent = failed ? '!' : '…'
  mark.title = failed ? 'Unavailable' : 'Loading'
  const name = document.createElement('span')
  name.className = 'task-file-name'
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
  onReview?: () => void,
): void {
  leaveChangeFile(host)
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
    status.className = 'task-diff-status'
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
    const loaded = payload?.files.find(candidate => candidate.file === file || candidate.previousFile === file)
    return loaded === undefined ? pendingFileRow(file, error !== undefined) : fileRow(loaded, onOpen)
  })
  section(body, 'files', 'Modified files', fileRows)
  if (onReview !== undefined && item.modifiedFiles.length > 0) {
    const review = document.createElement('button')
    review.type = 'button'
    review.className = 'chrome-button'
    review.dataset.taskKey = 'review-changes'
    review.textContent = 'Review changes'
    review.onclick = onReview
    body.append(review)
  }
  if (payload !== undefined) body.append(sourceIdentity(payload.source))
  else if (error !== undefined) {
    const status = document.createElement('p')
    status.className = 'task-diff-status'
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

export const taskDiffCss = `
  #details .task-diff-toolbar { display: flex; flex-wrap: wrap; gap: 8px; }
  #details .task-diff-toolbar .file-context { flex: 1; min-width: 10ch; }
  #details .task-diff-views { display: flex; gap: 4px; }
  #details .task-diff-views button { min-width: 0; padding: 5px 9px; }
  #details .task-diff-views [aria-pressed="true"] { background: var(--hover); border-color: var(--ink); }
  #details .criterion-mark { display: inline-block; }
  #details .task-file-row { align-items: center; background: transparent; border: 0; border-bottom: 1px solid var(--hairline); color: inherit; display: grid; font: inherit; gap: 10px; grid-template-columns: 20px minmax(0, 1fr) auto; padding: 9px 0; text-align: left; width: 100%; }
  #details .task-file-row:hover { background: var(--hover); }
  #details .task-file-row:disabled { background: transparent; color: var(--muted); }
  #details .task-file-status { border: 1px solid var(--hairline); border-radius: 4px; font-size: 9px; font-weight: 800; line-height: 18px; text-align: center; }
  #details .task-file-status.added { border-color: color-mix(in srgb, var(--change-added) 45%, transparent); color: var(--change-added); }
  #details .task-file-status.deleted { border-color: color-mix(in srgb, var(--change-removed) 45%, transparent); color: var(--change-removed); }
  #details .task-file-status.modified { border-color: var(--change-edited); color: var(--change-edited); }
  #details .task-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #details .task-file-facts { align-items: center; display: flex; font-size: 9px; gap: 7px; }
  #details .task-file-shared { border: 1px solid var(--hairline); border-radius: 9px; color: var(--muted); padding: 1px 6px; text-transform: uppercase; }
  #details .task-file-additions { color: var(--diff-added); }
  #details .task-file-deletions { color: var(--diff-removed); }
  #details .task-diff-source { color: var(--muted); display: grid; font-size: 9px; gap: 4px; margin: 12px 0; }
  #details .task-diff-source code { color: inherit; font-family: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #details .task-diff-status { color: var(--muted); margin: 14px 0; }
  #details .task-text { line-height: 1.65; margin: 0; white-space: pre-wrap; }
  #details .task-comment { line-height: 1.65; margin-bottom: 12px; white-space: pre-wrap; }
  #details.task-diff-open .task-diff-source { border-bottom: 1px solid var(--hairline); margin: 0; padding: 12px 22px; }
  #details .task-diff-code { min-width: max-content; padding-bottom: 24px; }
  #details .task-diff-code .task-diff-status { padding: 0 22px; }
  #details .task-diff-hunk { background: color-mix(in srgb, var(--syntax-type) 9%, transparent); color: var(--syntax-type); font-size: 10px; padding: 7px 22px; }
  #details .task-diff-line { display: grid; grid-template-columns: 4.5ch 4.5ch 2ch auto; line-height: 1.72; padding-right: 22px; }
  #details .task-diff-line:hover { filter: brightness(1.04); }
  #details .task-diff-line.added { background: color-mix(in srgb, var(--diff-added) 12%, transparent); }
  #details .task-diff-line.removed { background: color-mix(in srgb, var(--diff-removed) 12%, transparent); }
  #details .task-diff-number { border-right: 1px solid color-mix(in srgb, var(--hairline) 65%, transparent); color: var(--syntax-comment); padding-right: 1ch; text-align: right; user-select: none; }
  #details .task-diff-sign { text-align: center; user-select: none; }
  #details .task-diff-line.added .task-diff-sign { color: var(--diff-added); }
  #details .task-diff-line.removed .task-diff-sign { color: var(--diff-removed); }
  #details .task-diff-line code { color: var(--ink); font-family: inherit; font-size: 11px; white-space: pre; }
  [data-theme="blueprint"] #details .task-diff-line { border-bottom: 1px dotted color-mix(in srgb, var(--hairline) 45%, transparent); }
`
