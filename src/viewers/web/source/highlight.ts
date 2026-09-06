import { codeTokens } from '../../source/highlight.ts'

/** Browser markup for the shared source and diff syntax tokens. */
export function highlightedLine(source: string): DocumentFragment {
  const line = document.createDocumentFragment()
  for (const token of codeTokens(source)) {
    if (token.kind === undefined) line.append(token.text)
    else {
      const span = document.createElement('span')
      span.className = `syntax-${token.kind}`
      span.textContent = token.text
      line.append(span)
    }
  }
  return line
}

export const highlightCss = `
  #details.file-open { display: flex; flex-direction: column; overflow: hidden; padding: 22px 0 0; }
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
