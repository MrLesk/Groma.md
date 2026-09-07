import type { AnnotatedElement } from '../../../types.ts'
import { chromeButton } from '../atoms/button.ts'
import { highlightedLine } from './highlight.ts'
import type { SourcePayload } from '../../source/read.ts'

/** Paints the selected file as one level deeper inside the existing details pane. */
export function paintSource(
  host: HTMLElement,
  component: AnnotatedElement,
  file: string,
  line: number | undefined,
  payload: SourcePayload | undefined,
  error: string | undefined,
  onBack: () => void,
): void {
  host.classList.add('file-open')
  host.classList.add('source-open')
  host.querySelector('h1')!.textContent = file
  const toolbar = host.querySelector<HTMLElement>('.tabs')!
  toolbar.hidden = false
  toolbar.classList.remove('controls')
  toolbar.classList.add('file-toolbar', 'source-toolbar')
  const back = chromeButton('Back', { glyph: '←' })
  back.classList.add('source-back')
  back.addEventListener('click', onBack)
  const context = document.createElement('span')
  context.className = 'file-context'
  context.textContent = `Component · ${component.title}`
  const sourceLines = payload?.source.replace(/\r\n/g, '\n').split('\n')
  if (sourceLines?.at(-1) === '') sourceLines.pop()
  const facts = document.createElement('span')
  facts.className = 'file-facts'
  facts.textContent = sourceLines === undefined ? '' : `${sourceLines.length} lines`
  toolbar.replaceChildren(back, context, facts)

  const body = host.querySelector<HTMLElement>('.body')!
  if (payload === undefined) {
    const status = document.createElement('p')
    status.className = 'source-status'
    status.textContent = error ?? 'Loading source'
    body.replaceChildren(status)
    return
  }
  const lines = document.createElement('ol')
  lines.className = 'source-lines'
  lines.setAttribute('aria-label', file)
  let selected: HTMLElement | undefined
  for (const [index, source] of sourceLines!.entries()) {
    const row = document.createElement('li')
    row.className = 'source-line'
    if (index + 1 === line) {
      row.classList.add('selected')
      row.setAttribute('aria-current', 'location')
      selected = row
    }
    const number = document.createElement('span')
    number.className = 'source-line-number'
    number.setAttribute('aria-hidden', 'true')
    number.textContent = String(index + 1)
    const code = document.createElement('code')
    code.append(highlightedLine(source))
    row.append(number, code)
    lines.append(row)
  }
  body.replaceChildren(lines)
  selected?.scrollIntoView({ block: 'center' })
}

export function leaveSource(host: HTMLElement): void {
  host.classList.remove('file-open')
  host.classList.remove('source-open')
  host.querySelector('.tabs')!.classList.remove('file-toolbar', 'source-toolbar')
  host.querySelector('.tabs')!.classList.add('controls')
}

export const sourceCss = `
  #details .source-file { color: var(--ink); font-weight: 600; overflow-wrap: anywhere; }
  #details .code-entry { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 4px; }
  #details .code-tree { grid-column: 1; grid-row: 1; display: flex; align-items: stretch; }
  #details .code-entry-main { display: contents; }
  #details .code-entry-name { grid-column: 2; grid-row: 1; display: flex; align-items: center; gap: 6px; min-width: 0; }
  #details .code-entry > .code-entry-main > .ghost { grid-column: 2; grid-row: 2; display: block; line-height: 1.55; margin-top: 2px; }
  #details .file-groups > li + li { border-top: 1px solid color-mix(in srgb, var(--hairline) 60%, transparent); margin-top: 12px; padding-top: 12px; }
  #details .code-entry .branch { width: calc(var(--tree-step) - 4px); flex: none; position: relative; }
  #details .code-entry .branch::before { content: ''; position: absolute; top: -5px; bottom: -5px; left: 6px; border-left: 1px solid var(--hairline); }
  #details .code-entry .branch.blank::before { display: none; }
  #details .code-entry .branch.end::before { bottom: 50%; }
  #details .code-entry .branch:not(.end)::before { bottom: auto; top: -5px; height: calc(100% + 2px + 1.55em + 5px); }
  #details .code-entry .branch.current::after { content: ''; position: absolute; top: 50%; left: 6px; width: calc(var(--tree-step) - 1px); border-top: 1px solid var(--hairline); }
  #details .code-entry .branch.current { width: calc(var(--tree-step) + 4px); }
  #details .code-copies-mark { border: 0; background: transparent; color: var(--syntax-number); cursor: pointer; padding: 0; display: inline-flex; align-items: center; gap: 6px; flex: none; font-size: 11px; white-space: nowrap; }
  #details .code-copies-mark svg { width: 12px; height: 12px; display: block; flex: none; }
  #details .code-copies-mark:hover, #details .code-copies-mark[aria-expanded="true"] { color: var(--ink); }
  #details .code-copies { margin-top: 8px; }
  #details .code-copies > .ghost { padding-left: calc(var(--tree-step) + 4px); }
  #details .code-methods { margin-top: 8px; }
  #details .code-methods > li, #details .code-members > li, #details .code-copies li { margin: 0; }
  #details .source-status { color: var(--muted); margin: 18px 22px; }
  #details .source-lines { list-style: none; margin: 0; min-width: max-content; padding: 14px 0 24px; }
  #details .source-line { display: grid; grid-template-columns: 4.5ch auto; line-height: 1.72; margin: 0; padding: 0 22px 0 10px; }
  #details .source-line:hover { background: var(--hover); }
  #details .source-line.selected { background: color-mix(in srgb, var(--highlight) 12%, transparent); box-shadow: inset 2px 0 var(--highlight); }
  #details .source-line-number { color: var(--syntax-comment); padding-right: 1.5ch; text-align: right; user-select: none; }
  #details .source-line code { color: var(--ink); font-family: inherit; font-size: 11px; white-space: pre; }
`
