import type { AnnotatedElement } from '../../../types.ts'
import type { SourcePayload } from './read.ts'

type TokenKind = 'comment' | 'function' | 'keyword' | 'number' | 'string' | 'type'

const keywords = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default',
  'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'foreach', 'from',
  'function', 'get', 'if', 'implements', 'import', 'in', 'interface', 'internal', 'is', 'let',
  'namespace', 'new', 'null', 'of', 'override', 'private', 'protected', 'public', 'readonly',
  'return', 'set', 'static', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof',
  'undefined', 'using', 'var', 'virtual', 'void', 'while', 'yield',
])

const tokenPattern = /\/\/.*|\/\*.*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g

function tokenKind(token: string, rest: string): TokenKind | undefined {
  if (token.startsWith('//') || token.startsWith('/*')) return 'comment'
  if (/^['"`]/.test(token)) return 'string'
  if (/^\d/.test(token)) return 'number'
  if (keywords.has(token)) return 'keyword'
  if (/^[A-Z]/.test(token)) return 'type'
  return /^\s*\(/.test(rest) ? 'function' : undefined
}

function highlightedLine(source: string): DocumentFragment {
  const line = document.createDocumentFragment()
  let offset = 0
  tokenPattern.lastIndex = 0
  for (let match = tokenPattern.exec(source); match !== null; match = tokenPattern.exec(source)) {
    line.append(source.slice(offset, match.index))
    const token = match[0]
    const kind = tokenKind(token, source.slice(tokenPattern.lastIndex))
    if (kind === undefined) line.append(token)
    else {
      const span = document.createElement('span')
      span.className = `syntax-${kind}`
      span.textContent = token
      line.append(span)
    }
    offset = tokenPattern.lastIndex
  }
  line.append(source.slice(offset))
  return line
}

/** Paints the selected file as one level deeper inside the existing details pane. */
export function paintSource(
  host: HTMLElement,
  component: AnnotatedElement,
  file: string,
  payload: SourcePayload | undefined,
  error: string | undefined,
  onBack: () => void,
): void {
  document.body.classList.add('source-details')
  host.classList.add('source-open')
  host.querySelector('h1')!.textContent = file
  const toolbar = host.querySelector<HTMLElement>('.tabs')!
  toolbar.hidden = false
  toolbar.classList.remove('controls')
  toolbar.classList.add('source-toolbar')
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'chrome-button source-back'
  const arrow = document.createElement('span')
  arrow.setAttribute('aria-hidden', 'true')
  arrow.textContent = '←'
  back.append(arrow, 'Back')
  back.addEventListener('click', onBack)
  const context = document.createElement('span')
  context.className = 'source-context'
  context.textContent = `Component · ${component.name}`
  const sourceLines = payload?.source.replace(/\r\n/g, '\n').split('\n')
  if (sourceLines?.at(-1) === '') sourceLines.pop()
  const facts = document.createElement('span')
  facts.className = 'source-facts'
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
  for (const [index, source] of sourceLines!.entries()) {
    const row = document.createElement('li')
    row.className = 'source-line'
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
}

export function leaveSource(host: HTMLElement): void {
  document.body.classList.remove('source-details')
  host.classList.remove('source-open')
  host.querySelector('.tabs')!.classList.remove('source-toolbar')
  host.querySelector('.tabs')!.classList.add('controls')
}

export const sourceCss = `
  body.source-details { --details-column: 640px; }
  #details .source-file + .ghost { display: block; line-height: 1.55; margin-top: 2px; }
  #details.source-open { display: flex; flex-direction: column; overflow: hidden; padding: 22px 0 0; }
  #details.source-open #details-close { display: none; }
  #details.source-open > .meta,
  #details.source-open > h1,
  #details.source-open > .tabs { margin-left: 22px; margin-right: 22px; }
  #details.source-open > .meta { display: none; }
  #details.source-open > h1 { font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
  #details.source-open > .body { border-top: 1px solid var(--hairline); flex: 1; min-height: 0; overflow: auto; }
  #details .source-toolbar { align-items: center; border: 0; display: grid; gap: 12px; grid-template-columns: auto 1fr auto; margin-bottom: 10px; order: -1; }
  #details .source-toolbar button { min-width: 64px; }
  #details .source-context,
  #details .source-facts { color: var(--muted); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
  #details .source-status { color: var(--muted); margin: 18px 22px; }
  #details .source-lines { list-style: none; margin: 0; min-width: max-content; padding: 14px 0 24px; }
  #details .source-line { display: grid; grid-template-columns: 4.5ch auto; line-height: 1.72; margin: 0; padding: 0 22px 0 10px; }
  #details .source-line:hover { background: var(--hover); }
  #details .source-line-number { color: var(--syntax-comment); padding-right: 1.5ch; text-align: right; user-select: none; }
  #details .source-line code { color: var(--ink); font-family: inherit; font-size: 11px; white-space: pre; }
  #details .syntax-comment { color: var(--syntax-comment); font-style: italic; }
  #details .syntax-function { color: var(--syntax-function); font-weight: 650; text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--syntax-function) 45%, transparent); text-underline-offset: 3px; }
  #details .syntax-keyword { color: var(--syntax-keyword); font-style: italic; font-weight: 750; }
  #details .syntax-number { color: var(--syntax-number); font-variant-numeric: tabular-nums; font-weight: 650; }
  #details .syntax-string { color: var(--syntax-string); }
  #details .syntax-type { color: var(--syntax-type); font-weight: 700; }
  [data-theme="dark"] #details .syntax-function { text-decoration-style: dotted; }
  [data-theme="dark"] #details .syntax-keyword { letter-spacing: 0.025em; }
  [data-theme="blueprint"] #details .syntax-keyword { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  [data-theme="blueprint"] #details .syntax-string { font-weight: 650; letter-spacing: 0.015em; }
`
