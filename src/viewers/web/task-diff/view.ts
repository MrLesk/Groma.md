import type { ArchitectureGraph, C4Kind, WorkItem, WorkItemDetails } from '../../../types.ts'
import { chromeButton } from '../atoms/button.ts'
import { updateTaskSummary, updateTaskText } from './updates.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { highlightedLine } from '../source/highlight.ts'
import type { TaskFileDiff } from '../../source/diff-lines.ts'
import type { TaskDiffPayload } from '../../source/diff.ts'

const statusMark = { added: 'A', deleted: 'D', modified: 'M', unchanged: '·' } as const
const statusLabel = { added: 'Added', deleted: 'Removed', modified: 'Modified', unchanged: 'Unchanged' } as const

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

function fileRow(file: TaskFileDiff, onOpen: (file: string) => void): HTMLElement {
  const row = document.createElement('li')
  row.dataset.taskKey = file.file
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'task-file-row'
  button.onclick = () => onOpen(file.file)
  const mark = document.createElement('span')
  mark.className = `task-file-status ${file.status}`
  mark.textContent = statusMark[file.status]
  mark.title = statusLabel[file.status]
  const name = document.createElement('span')
  name.className = 'task-file-name'
  name.textContent = file.file
  const facts = document.createElement('span')
  facts.className = 'task-file-facts'
  if (file.shared) {
    const shared = document.createElement('span')
    shared.className = 'task-file-shared'
    shared.textContent = 'Shared'
    facts.append(shared)
  }
  if (file.additions > 0) facts.append(Object.assign(document.createElement('span'), {
    className: 'task-file-additions', textContent: `+${file.additions}`,
  }))
  if (file.deletions > 0) facts.append(Object.assign(document.createElement('span'), {
    className: 'task-file-deletions', textContent: `−${file.deletions}`,
  }))
  button.append(mark, name, facts)
  row.append(button)
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
): void {
  leaveTaskDiff(host)
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
    return loaded === undefined ? pendingFileRow(file, error !== undefined) : fileRow(loaded, onOpen)
  })
  section(body, 'files', 'Modified files', fileRows)
  if (payload !== undefined) body.append(sourceIdentity(payload))
  else if (error !== undefined) {
    const status = document.createElement('p')
    status.className = 'task-diff-status'
    status.dataset.taskKey = 'diff-error'
    status.textContent = error
    body.append(status)
  }
  textSection(body, 'Implementation plan', details?.implementationPlan ?? '')
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

function diffRow(line: TaskFileDiff['hunks'][number]['lines'][number]): HTMLElement {
  const row = document.createElement('div')
  row.className = `task-diff-line ${line.kind}`
  const oldLine = document.createElement('span')
  oldLine.className = 'task-diff-number'
  oldLine.textContent = line.oldLine === undefined ? '' : String(line.oldLine)
  const newLine = document.createElement('span')
  newLine.className = 'task-diff-number'
  newLine.textContent = line.newLine === undefined ? '' : String(line.newLine)
  const sign = document.createElement('span')
  sign.className = 'task-diff-sign'
  sign.textContent = line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '
  const code = document.createElement('code')
  code.append(highlightedLine(line.text))
  row.append(oldLine, newLine, sign, code)
  return row
}

/** Paints one file without changing the selected task underneath it. */
export function paintTaskFile(
  host: HTMLElement,
  item: WorkItem,
  payload: TaskDiffPayload,
  file: TaskFileDiff,
  onBack: () => void,
): void {
  host.classList.add('file-open', 'task-diff-open')
  host.querySelector('h1')!.textContent = file.file
  const toolbar = host.querySelector<HTMLElement>('.tabs')!
  toolbar.hidden = false
  toolbar.classList.remove('controls')
  toolbar.classList.add('file-toolbar', 'task-diff-toolbar')
  const back = chromeButton('Back', { glyph: '←' })
  back.addEventListener('click', onBack)
  const context = document.createElement('span')
  context.className = 'file-context'
  context.textContent = `${item.id} · ${statusLabel[file.status]}${file.shared ? ' · Shared' : ''}`
  const facts = document.createElement('span')
  facts.className = 'file-facts'
  facts.textContent = `+${file.additions} −${file.deletions}`
  toolbar.replaceChildren(back, context, facts)
  const body = host.querySelector<HTMLElement>('.body')!
  const content = document.createElement('div')
  content.className = 'task-diff-code'
  content.append(sourceIdentity(payload))
  for (const hunk of file.hunks) {
    const header = document.createElement('div')
    header.className = 'task-diff-hunk'
    header.textContent = hunk.header
    content.append(header, ...hunk.lines.map(diffRow))
  }
  if (file.hunks.length === 0) {
    const unchanged = document.createElement('p')
    unchanged.className = 'task-diff-status'
    unchanged.textContent = 'No changes'
    content.append(unchanged)
  }
  body.replaceChildren(content)
}

export function leaveTaskDiff(host: HTMLElement): void {
  host.classList.remove('file-open', 'task-diff-open')
  host.querySelector('.tabs')!.classList.remove('file-toolbar', 'task-diff-toolbar')
  host.querySelector('.tabs')!.classList.add('controls')
}

export const taskDiffCss = `
  #details .criterion-mark { display: inline-block; }
  #details .task-file-row { align-items: center; background: transparent; border: 0; border-bottom: 1px solid var(--hairline); color: inherit; display: grid; font: inherit; gap: 10px; grid-template-columns: 20px minmax(0, 1fr) auto; padding: 9px 0; text-align: left; width: 100%; }
  #details .task-file-row:hover { background: var(--hover); }
  #details .task-file-row:disabled { background: transparent; color: var(--muted); }
  #details .task-file-status { border: 1px solid var(--hairline); border-radius: 4px; font-size: 9px; font-weight: 800; line-height: 18px; text-align: center; }
  #details .task-file-status.added { border-color: color-mix(in srgb, var(--diff-added) 45%, transparent); color: var(--diff-added); }
  #details .task-file-status.deleted { border-color: color-mix(in srgb, var(--diff-removed) 45%, transparent); color: var(--diff-removed); }
  #details .task-file-status.modified { color: var(--syntax-type); }
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
