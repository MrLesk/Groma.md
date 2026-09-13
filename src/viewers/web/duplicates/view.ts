import type { ArchitectureFindingInstance } from '../../../types.ts'
import { chromeButton } from '../atoms/button.ts'
import { highlightedLine } from '../source/highlight.ts'
import type { ComparedLine } from './model.ts'

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.textContent = text
  element.className = className
  return element
}

export function choice(label: string, entries: [string, string][], value: string, change: (value: string) => void): HTMLSelectElement {
  const select = node('select')
  select.setAttribute('aria-label', label)
  for (const [id, title] of entries) {
    const option = node('option', title)
    option.value = id
    select.append(option)
  }
  select.value = value
  select.addEventListener('change', () => change(select.value))
  return select
}

export function sourceColumn(
  instance: ArchitectureFindingInstance,
  owner: string | undefined,
  lines: ComparedLine[],
  open: (source: boolean) => void,
): HTMLElement {
  const column = node('section', '', 'duplicate-source')
  column.append(node('h3', instance.name), node('p', `${instance.file}:${instance.startLine}`, 'duplicate-location'))
  if (owner !== undefined) column.append(node('p', owner, 'duplicate-owner'))
  const code = node('ol')
  for (const line of lines) {
    const row = node('li', '', line.changed ? 'changed' : '')
    const text = node('code')
    text.append(highlightedLine(line.text))
    row.append(node('span', String(line.number), 'duplicate-line-number'), text)
    code.append(row)
  }
  column.append(code)
  if (owner !== undefined) {
    const actions = node('div', '', 'duplicate-actions')
    for (const [label, source] of [['Open source', true], ['Show on map', false]] as const) {
      const button = chromeButton(label)
      button.addEventListener('click', () => open(source))
      actions.append(button)
    }
    column.append(actions)
  }
  return column
}

export const duplicatesCss = `
  #duplicates-panel { overflow: auto; min-height: 0; }
  #duplicates-panel h3 { font-size: 12px; margin: 0; overflow-wrap: anywhere; }
  #duplicates-panel .duplicate-filters, #duplicates-panel .duplicate-actions { display: flex; gap: 8px; margin: 12px 0; }
  #duplicates-panel select { min-width: 0; max-width: 100%; color: var(--ink); background: var(--paper); border: 1px solid var(--hairline); border-radius: var(--control-radius); padding: 6px; font: inherit; }
  #duplicates-panel .duplicate-list { display: grid; margin: 16px 0; }
  #duplicates-panel .duplicate-row { display: grid; grid-template-columns: minmax(0, 1fr) 120px 70px; gap: 12px; text-align: left; border: 0; border-bottom: 1px solid var(--hairline); padding: 10px 8px; }
  #duplicates-panel .duplicate-row > :first-child { overflow-wrap: anywhere; }
  #duplicates-panel .duplicate-row[aria-pressed="true"] { background: var(--hover); box-shadow: inset 2px 0 var(--highlight); }
  #duplicates-panel .duplicate-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; border-top: 1px solid var(--hairline); padding-top: 16px; }
  #duplicates-panel .duplicate-location { overflow-wrap: anywhere; margin: 6px 0; color: var(--muted); }
  #duplicates-panel .duplicate-owner { color: var(--muted); margin: 6px 0; }
  #duplicates-panel ol { list-style: none; padding: 8px 0; overflow: auto; border: 1px solid var(--hairline); border-radius: var(--control-radius); }
  #duplicates-panel li { display: flex; width: max-content; min-width: 100%; line-height: 1.7; }
  #duplicates-panel li.changed { background: color-mix(in srgb, var(--syntax-number) 14%, transparent); }
  #duplicates-panel code { font: inherit; font-size: 11px; white-space: pre; padding-right: 12px; }
  #duplicates-panel .duplicate-line-number { flex: none; width: 5ch; text-align: right; padding-right: 1ch; color: var(--muted); user-select: none; }
  #duplicates-panel .syntax-keyword { color: var(--syntax-keyword); }
  #duplicates-panel .syntax-string { color: var(--syntax-string); }
  #duplicates-panel .syntax-number { color: var(--syntax-number); }
  #duplicates-panel .syntax-comment { color: var(--syntax-comment); }
  #duplicates-panel .syntax-function { color: var(--syntax-function); }
  #duplicates-panel .syntax-type { color: var(--syntax-type); }
  @media (max-width: 1100px) { #duplicates-panel .duplicate-comparison { grid-template-columns: 1fr; } }
`
