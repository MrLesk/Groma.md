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

/** Builds the shared lightweight syntax treatment used by source and diff rows. */
export function highlightedLine(source: string): DocumentFragment {
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

export const highlightCss = `
  #details.file-open { display: flex; flex-direction: column; overflow: hidden; padding: 22px 0 0; }
  #details.file-open #details-close { display: none; }
  #details.file-open > .meta,
  #details.file-open > h1,
  #details.file-open > .tabs { margin-left: 22px; margin-right: 22px; }
  #details.file-open > .meta { display: none; }
  #details.file-open > h1 { font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
  #details.file-open > .body { border-top: 1px solid var(--hairline); flex: 1; min-height: 0; overflow: auto; }
  #details .file-toolbar { align-items: center; border: 0; display: grid; gap: 12px; grid-template-columns: auto 1fr auto; margin-bottom: 10px; order: -1; }
  #details .file-toolbar button { min-width: 64px; }
  #details .file-context,
  #details .file-facts { color: var(--muted); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
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
