import type { ArchitectureGraph, C4Kind, WorkItem, WorkItemDetails } from '../../../types.ts'
import { chromeButton } from '../atoms/button.ts'
import { kindGlyph } from '../../atoms/kind.ts'
import { highlightedLine } from '../source/highlight.ts'
import type { TaskFileDiff } from './project.ts'
import type { TaskDiffPayload } from './read.ts'

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
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'task-file-row'
  button.addEventListener('click', () => onOpen(file.file))
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

function section(body: Element, label: string, rows: HTMLElement[]): void {
  if (rows.length === 0) return
  const list = document.createElement('ul')
  list.append(...rows)
  body.append(heading(label), list)
}

function checklistRows(items: readonly { text: string; checked: boolean }[]): HTMLElement[] {
  return items.map(item => {
    const row = document.createElement('li')
    if (!item.checked) row.textContent = `○ ${item.text}`
    else {
      const check = document.createElement('span')
      check.className = 'criterion-check'
      check.textContent = '✓'
      const text = document.createElement('span')
      text.className = 'ghost'
      text.textContent = ` ${item.text}`
      row.append(check, text)
    }
    return row
  })
}

function textSection(body: Element, label: string, text: string): void {
  if (text === '') return
  const content = document.createElement('p')
  content.className = 'task-text'
  content.textContent = text
  body.append(heading(label), content)
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
  host.querySelector('h1')!.textContent = item.title
  host.querySelector('.meta')!.textContent = [item.id, item.status, ...item.assignees].join(' · ')
  host.querySelector('.tabs')!.replaceChildren()
  const body = host.querySelector('.body')!
  body.replaceChildren()
  if (details === undefined && detailsError !== undefined) {
    const status = document.createElement('p')
    status.className = 'task-diff-status'
    status.textContent = detailsError
    body.append(status)
    return
  }
  if (details !== undefined && details.description !== '') {
    const paragraph = document.createElement('p')
    paragraph.className = 'description'
    paragraph.textContent = details.description
    body.append(paragraph)
  }
  if (details !== undefined) {
    section(
      body,
      `Acceptance criteria · ${item.acceptanceCriteriaCompleted} of ${item.acceptanceCriteriaCount}`,
      checklistRows(details.acceptanceCriteria),
    )
    const done = details.definitionOfDone.filter(criterion => criterion.checked).length
    section(body, `Definition of Done · ${done} of ${details.definitionOfDone.length}`, checklistRows(details.definitionOfDone))
  }
  section(body, 'References', item.references.map(reference => {
    const row = document.createElement('li')
    const element = byId.get(reference)
    if (element === undefined) row.textContent = reference
    else {
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'link'
      link.append(marked(element.kind, element.external, element.title))
      link.addEventListener('click', event => onSelect(element.representationId, event.shiftKey))
      row.append(link)
    }
    return row
  }))
  const fileRows = payload === undefined
    ? item.modifiedFiles.map(file => pendingFileRow(file, error !== undefined))
    : payload.files.map(file => fileRow(file, onOpen))
  section(body, 'Modified files', fileRows)
  if (payload !== undefined) body.append(sourceIdentity(payload))
  else if (error !== undefined) {
    const status = document.createElement('p')
    status.className = 'task-diff-status'
    status.textContent = error
    body.append(status)
  }
  textSection(body, 'Implementation plan', details?.implementationPlan ?? '')
  textSection(body, 'Implementation notes', details?.implementationNotes ?? '')
  section(body, 'Comments', (details?.comments ?? []).map(comment => {
    const row = document.createElement('li')
    row.className = 'task-comment'
    const meta = document.createElement('div')
    meta.className = 'ghost'
    meta.textContent = `${comment.author} · ${comment.createdAt}`
    const text = document.createElement('div')
    text.textContent = comment.body
    row.append(meta, text)
    return row
  }))
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
  document.body.classList.add('task-diff-details')
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
  document.body.classList.remove('task-diff-details')
  host.classList.remove('file-open', 'task-diff-open')
  host.querySelector('.tabs')!.classList.remove('file-toolbar', 'task-diff-toolbar')
  host.querySelector('.tabs')!.classList.add('controls')
}

export const taskDiffCss = `
  body.task-diff-details { --details-column: 640px; }
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
