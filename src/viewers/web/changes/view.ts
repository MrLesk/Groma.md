import { chromeButton } from '../atoms/button.ts'
import { highlightedLine } from '../source/highlight.ts'
import type { FileDiff } from '../../source/diff-lines.ts'

export interface DiffSource { kind: 'commit' | 'working-tree'; base: string; revision: string }

const statusMark = { added: 'A', deleted: 'D', modified: 'M', unchanged: '·' } as const
export const statusLabel = { added: 'Added', deleted: 'Removed', modified: 'Edited', unchanged: 'Unchanged' } as const

export function sourceIdentity(sourceState: DiffSource): HTMLElement {
  const source = document.createElement('div')
  source.className = 'task-diff-source'
  source.dataset.taskKey = 'source'
  const base = document.createElement('code')
  base.textContent = `Base ${sourceState.base}`
  const target = document.createElement('code')
  target.textContent = `Target ${sourceState.kind === 'commit' ? sourceState.revision : 'Working tree'}`
  source.append(base, target)
  return source
}

export function fileRow(file: FileDiff, onOpen: (file: string) => void): HTMLElement {
  const row = document.createElement('li')
  row.dataset.taskKey = file.file
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'task-file-row'
  button.onclick = () => onOpen(file.file)
  const mark = document.createElement('span')
  mark.className = `task-file-status ${file.status}`
  mark.textContent = file.previousFile ? 'R' : statusMark[file.status]
  mark.title = file.previousFile ? 'Renamed' : statusLabel[file.status]
  const name = document.createElement('span')
  name.className = 'task-file-name'
  name.textContent = file.previousFile ? file.previousFile + ' → ' + file.file : file.file
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

function diffRow(line: FileDiff['hunks'][number]['lines'][number]): HTMLElement {
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
export function paintChangeFile(
  host: HTMLElement,
  contextLabel: string,
  sourceState: DiffSource,
  file: FileDiff,
  onBack: () => void,
  view: 'diff' | 'before' | 'after' = 'diff',
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
  context.textContent = `${contextLabel} · ${statusLabel[file.status]}${file.shared ? ' · Shared' : ''}`
  const facts = document.createElement('span')
  facts.className = 'file-facts'
  facts.textContent = file.binary ? 'Binary' : `+${file.additions} −${file.deletions}`
  const views = (['diff', 'before', 'after'] as const).map(side => {
    const button = chromeButton(side === 'diff' ? 'Diff' : side === 'before' ? 'Before' : 'After')
    button.setAttribute('aria-pressed', String(side === view))
    button.disabled = side !== 'diff' && (file.binary === true || file[side] === undefined)
    button.onclick = () => paintChangeFile(host, contextLabel, sourceState, file, onBack, side)
    return button
  })
  const switcher = document.createElement('div')
  switcher.className = 'task-diff-views'
  switcher.setAttribute('role', 'group')
  switcher.setAttribute('aria-label', 'File view')
  switcher.append(...views)
  toolbar.replaceChildren(back, context, switcher, facts)
  const body = host.querySelector<HTMLElement>('.body')!
  const content = document.createElement('div')
  content.className = 'task-diff-code'
  content.append(sourceIdentity(sourceState))
  if (view !== 'diff') {
    const text = file[view] ?? ''
    const lines = text.split('\n')
    content.append(...lines.map((text, index) => diffRow({
      kind: 'context', text,
      ...(view === 'before' ? { oldLine: index + 1 } : { newLine: index + 1 }),
    })))
    body.replaceChildren(content)
    return
  }
  for (const hunk of file.hunks) {
    const header = document.createElement('div')
    header.className = 'task-diff-hunk'
    header.textContent = hunk.header
    content.append(header, ...hunk.lines.map(diffRow))
  }
  if (file.hunks.length === 0) {
    const unchanged = document.createElement('p')
    unchanged.className = 'task-diff-status'
    unchanged.textContent = file.binary ? 'Binary file changed' : 'No text changes'
    content.append(unchanged)
  }
  body.replaceChildren(content)
}

export function leaveChangeFile(host: HTMLElement): void {
  host.classList.remove('file-open', 'task-diff-open')
  host.querySelector('.tabs')!.classList.remove('file-toolbar', 'task-diff-toolbar')
  host.querySelector('.tabs')!.classList.add('controls')
}
