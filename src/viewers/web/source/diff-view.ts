import type { FileDiff } from '../../source/diff-lines.ts'
import { chromeButton } from '../atoms/button.ts'
import { highlightedLine } from './highlight.ts'

const statusMark = { added: 'A', removed: 'D', modified: 'M', unchanged: '·' } as const
const statusLabel = { added: 'Added', removed: 'Removed', modified: 'Modified', unchanged: 'Unchanged' } as const

export function fileDiffRow(file: FileDiff, onOpen: (file: string) => void, shared = false): HTMLElement {
  const row = document.createElement('li')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'diff-file-row'
  button.onclick = () => onOpen(file.file)
  const mark = document.createElement('span')
  mark.className = `diff-file-status ${file.status}`
  mark.textContent = statusMark[file.status]
  mark.title = statusLabel[file.status]
  const name = document.createElement('span')
  name.className = 'diff-file-name'
  name.textContent = file.file
  const facts = document.createElement('span')
  facts.className = 'diff-file-facts'
  if (shared) {
    const shared = document.createElement('span')
    shared.className = 'diff-file-shared'
    shared.textContent = 'Shared'
    facts.append(shared)
  }
  if (file.additions > 0) facts.append(Object.assign(document.createElement('span'), {
    className: 'diff-file-additions', textContent: `+${file.additions}`,
  }))
  if (file.deletions > 0) facts.append(Object.assign(document.createElement('span'), {
    className: 'diff-file-deletions', textContent: `−${file.deletions}`,
  }))
  button.append(mark, name, facts)
  row.append(button)
  return row
}

function diffRow(line: FileDiff['hunks'][number]['lines'][number]): HTMLElement {
  const row = document.createElement('div')
  row.className = `diff-line ${line.kind}`
  const oldLine = document.createElement('span')
  oldLine.className = 'diff-number'
  oldLine.textContent = line.oldLine === undefined ? '' : String(line.oldLine)
  const newLine = document.createElement('span')
  newLine.className = 'diff-number'
  newLine.textContent = line.newLine === undefined ? '' : String(line.newLine)
  const sign = document.createElement('span')
  sign.className = 'diff-sign'
  sign.textContent = line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '
  const code = document.createElement('code')
  code.append(highlightedLine(line.text))
  row.append(oldLine, newLine, sign, code)
  return row
}

/** Paints a unified file diff inside the shared expanded details pane. */
export function paintFileDiff(
  host: HTMLElement,
  file: FileDiff,
  contextLabel: string,
  onBack: () => void,
  identity?: HTMLElement,
): void {
  host.classList.add('file-open', 'diff-open')
  host.querySelector('h1')!.textContent = file.file
  const toolbar = host.querySelector<HTMLElement>('.tabs')!
  toolbar.hidden = false
  toolbar.classList.remove('controls')
  toolbar.classList.add('file-toolbar', 'diff-toolbar')
  const back = chromeButton('Back', { glyph: '←' })
  back.addEventListener('click', onBack)
  const context = document.createElement('span')
  context.className = 'file-context'
  context.textContent = `${contextLabel} · ${statusLabel[file.status]}`
  const facts = document.createElement('span')
  facts.className = 'file-facts'
  facts.textContent = `+${file.additions} −${file.deletions}`
  toolbar.replaceChildren(back, context, facts)
  const body = host.querySelector<HTMLElement>('.body')!
  const content = document.createElement('div')
  content.className = 'diff-code'
  if (identity !== undefined) content.append(identity)
  for (const hunk of file.hunks) {
    const header = document.createElement('div')
    header.className = 'diff-hunk'
    header.textContent = hunk.header
    content.append(header, ...hunk.lines.map(diffRow))
  }
  if (file.hunks.length === 0) {
    const unchanged = document.createElement('p')
    unchanged.className = 'diff-status'
    unchanged.textContent = 'No changes'
    content.append(unchanged)
  }
  body.replaceChildren(content)
}

export function leaveFileDiff(host: HTMLElement): void {
  host.classList.remove('file-open', 'diff-open')
  host.querySelector('.tabs')!.classList.remove('file-toolbar', 'diff-toolbar')
  host.querySelector('.tabs')!.classList.add('controls')
}

export const fileDiffCss = `
  #details .diff-file-row { align-items: center; background: transparent; border: 0; border-bottom: 1px solid var(--hairline); color: inherit; display: grid; font: inherit; gap: 10px; grid-template-columns: 20px minmax(0, 1fr) auto; padding: 9px 0; text-align: left; width: 100%; }
  #details .diff-file-row:hover { background: var(--hover); }
  #details .diff-file-row:disabled { background: transparent; color: var(--muted); }
  #details .diff-file-status { border: 1px solid var(--hairline); border-radius: 4px; font-size: 9px; font-weight: 800; line-height: 18px; text-align: center; }
  #details .diff-file-status.added { border-color: color-mix(in srgb, var(--diff-added) 45%, transparent); color: var(--diff-added); }
  #details .diff-file-status.removed { border-color: color-mix(in srgb, var(--diff-removed) 45%, transparent); color: var(--diff-removed); }
  #details .diff-file-status.modified { color: var(--diff-modified); }
  #details .diff-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #details .diff-file-facts { align-items: center; display: flex; font-size: 9px; gap: 7px; }
  #details .diff-file-shared { border: 1px solid var(--hairline); border-radius: 9px; color: var(--muted); padding: 1px 6px; text-transform: uppercase; }
  #details .diff-file-additions { color: var(--diff-added); }
  #details .diff-file-deletions { color: var(--diff-removed); }
  #details .diff-status { color: var(--muted); margin: 14px 0; }
  #details .diff-code { min-width: max-content; padding-bottom: 24px; }
  #details .diff-code .diff-status { padding: 0 22px; }
  #details .diff-hunk { background: var(--hover); color: var(--muted); font-size: 10px; padding: 7px 22px; }
  #details .diff-line { display: grid; grid-template-columns: 4.5ch 4.5ch 2ch auto; line-height: 1.72; padding-right: 22px; }
  #details .diff-line:hover { filter: brightness(1.04); }
  #details .diff-line.added { background: color-mix(in srgb, var(--diff-added) 12%, transparent); }
  #details .diff-line.removed { background: color-mix(in srgb, var(--diff-removed) 12%, transparent); }
  #details .diff-number { border-right: 1px solid color-mix(in srgb, var(--hairline) 65%, transparent); color: var(--syntax-comment); padding-right: 1ch; text-align: right; user-select: none; }
  #details .diff-sign { text-align: center; user-select: none; }
  #details .diff-line.added .diff-sign { color: var(--diff-added); }
  #details .diff-line.removed .diff-sign { color: var(--diff-removed); }
  #details .diff-line code { color: var(--ink); font-family: inherit; font-size: 11px; white-space: pre; }
  [data-theme="blueprint"] #details .diff-line { border-bottom: 1px dotted color-mix(in srgb, var(--hairline) 45%, transparent); }
`
