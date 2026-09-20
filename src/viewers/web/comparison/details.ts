import { diffWordsWithSpace } from 'diff'
import type { ComponentChange, ChangeStatus } from '../../../history/comparison.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import { heading, paragraph } from '../atoms/text.ts'
import { fileDiffRow } from '../source/diff-view.ts'

export function changeBadge(status: ChangeStatus): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'change-badge'
  badge.dataset.change = status
  badge.textContent = status[0]!.toUpperCase() + status.slice(1)
  return badge
}

/** Only changed words are marked; a removed component's complete explanation stays readable. */
function changedText(className: string, before: string | undefined, after: string | undefined): HTMLElement {
  const text = paragraph(className, '')
  if (before === undefined || after === undefined || before === after) {
    text.textContent = after ?? before ?? ''
    return text
  }
  for (const part of diffWordsWithSpace(before, after)) {
    if (!part.added && !part.removed) { text.append(part.value); continue }
    const fragment = document.createElement(part.added ? 'ins' : 'del')
    fragment.textContent = part.value
    text.append(fragment)
  }
  return text
}

function changedField(body: Element, label: string, before: string | undefined, after: string | undefined): void {
  if (before === after) return
  const row = document.createElement('div')
  row.className = 'comparison-field'
  const title = document.createElement('span')
  title.className = 'comparison-field-label'
  title.textContent = label
  const value = changedText('', before ?? '', after ?? '')
  row.append(title, value)
  body.append(row)
}

export function comparisonOverview(body: Element, change: ComponentChange, world: ArchitectureGraph): void {
  const { before, after } = change
  if ((before?.description ?? after?.description) !== undefined) {
    body.append(changedText('description', before === undefined ? undefined : before.description ?? '', after === undefined ? undefined : after.description ?? ''))
  }
  if (before?.overview || after?.overview) body.append(changedText('overview', before?.overview, after?.overview))
  if (before === undefined || after === undefined) return
  const parentName = (id: string | null) => world.elements.find(item => item.id === id)?.title ?? id ?? ''
  changedField(body, 'Name', before.title, after.title)
  changedField(body, 'Parent', parentName(before.parent), parentName(after.parent))
  changedField(body, 'Group', before.group, after.group)
  changedField(body, 'Status', before.origin, after.origin)
  changedField(body, 'Draft', before.draft, after.draft)
}

export function comparisonTechnology(body: Element, change: ComponentChange): void {
  if (!change.before?.technology && !change.after?.technology) return
  body.append(heading('Technology'), changedText('comparison-technology', change.before === undefined ? undefined : change.before.technology ?? '', change.after === undefined ? undefined : change.after.technology ?? ''))
}

function ownership(file: string, change: ComponentChange): HTMLElement | undefined {
  if (change.before === undefined || change.after === undefined) return undefined
  const describe = (element: typeof change.before) => element?.code.filter(code => code.file === file)
    .map(code => `${code.scanner}${code.symbol === undefined ? '' : ` · ${code.symbol}`}`).sort().join(', ') ?? ''
  const before = describe(change.before)
  const after = describe(change.after)
  if (before === after) return undefined
  const row = changedText('comparison-ownership', before, after)
  row.prepend('Ownership: ')
  return row
}

export function comparisonFiles(body: Element, change: ComponentChange, onOpen: (file: string) => void): void {
  if (change.files.length === 0) return
  const list = document.createElement('ul')
  list.className = 'comparison-files'
  for (const file of change.files) {
    const row = fileDiffRow(file, onOpen)
    const changedOwnership = ownership(file.file, change)
    if (changedOwnership !== undefined) row.append(changedOwnership)
    list.append(row)
  }
  body.append(heading('Files'), list)
}

export const comparisonDetailsCss = `
  #details .change-badge { display: inline-block; border: 1px solid currentColor; border-radius: 4px; padding: 2px 6px; font-size: 9px; line-height: 1.35; letter-spacing: .04em; text-transform: uppercase; }
  #details .meta .change-badge { margin-left: 8px; }
  #details [data-change="added"] { color: var(--diff-added); }
  #details [data-change="modified"] { color: var(--diff-modified); }
  #details [data-change="removed"] { color: var(--diff-removed); }
  #details .relationship-action .change-badge { margin: 5px 0; }
  #details ins { color: var(--diff-added); background: color-mix(in srgb, var(--diff-added) 10%, transparent); text-decoration: none; }
  #details del { color: var(--diff-removed); background: color-mix(in srgb, var(--diff-removed) 9%, transparent); text-decoration-thickness: 1px; }
  #details .comparison-field { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px; margin: 12px 0; align-items: baseline; }
  #details .comparison-field-label { color: var(--muted); font-size: 10px; }
  #details .comparison-field p { margin: 0; overflow-wrap: anywhere; }
  #details .comparison-ownership { color: var(--muted); font-size: 10px; margin: 5px 0 10px 30px; }
  #details .comparison-files { list-style: none; padding: 0; }
`
