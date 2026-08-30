import type { AnnotatedElement } from '../../../types.ts'
import { chromeButton } from '../atoms/button.ts'
import { highlightedLine } from './highlight.ts'
import type { SourcePayload } from './read.ts'

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
  document.body.classList.add('source-details')
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
  context.textContent = `Component · ${component.name}`
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
  document.body.classList.remove('source-details')
  host.classList.remove('file-open')
  host.classList.remove('source-open')
  host.querySelector('.tabs')!.classList.remove('file-toolbar', 'source-toolbar')
  host.querySelector('.tabs')!.classList.add('controls')
}

export const sourceCss = `
  body.source-details { --details-column: 640px; }
  #details .source-file + .ghost, #details .code-entry > .ghost { display: block; line-height: 1.55; margin-top: 2px; }
  #details .code-file + .code-file { margin-top: 16px; }
  #details .code-file-name { color: var(--muted); font-size: 10px; margin-bottom: 7px; overflow-wrap: anywhere; }
  #details .code-members { border-left: 1px solid var(--hairline); margin: 5px 0 10px 5px; padding-left: 12px; }
  #details .source-status { color: var(--muted); margin: 18px 22px; }
  #details .source-lines { list-style: none; margin: 0; min-width: max-content; padding: 14px 0 24px; }
  #details .source-line { display: grid; grid-template-columns: 4.5ch auto; line-height: 1.72; margin: 0; padding: 0 22px 0 10px; }
  #details .source-line:hover { background: var(--hover); }
  #details .source-line.selected { background: color-mix(in srgb, var(--highlight) 12%, transparent); box-shadow: inset 2px 0 var(--highlight); }
  #details .source-line-number { color: var(--syntax-comment); padding-right: 1.5ch; text-align: right; user-select: none; }
  #details .source-line code { color: var(--ink); font-family: inherit; font-size: 11px; white-space: pre; }
`
