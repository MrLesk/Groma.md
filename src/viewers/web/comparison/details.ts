import { diffWordsWithSpace } from 'diff'
import type { ComponentChange, ChangeStatus, Comparison } from '../../../history/comparison.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import { heading, paragraph } from '../atoms/text.ts'
import { isChange } from './tree.ts'
import { fileDiffRow } from '../source/diff-view.ts'

export function changeBadge(status: ChangeStatus): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'change-badge'
  badge.dataset.change = status
  badge.textContent = status[0]!.toUpperCase() + status.slice(1)
  return badge
}

/** A large rewrite is read as two texts; a small edit keeps its unchanged words as context. */
export function textChanges(before: string, after: string) {
  const parts = diffWordsWithSpace(before, after)
  const changed = parts.filter(part => part.added || part.removed).reduce((total, part) => total + part.value.length, 0)
  const mode = before === after ? 'same' : before === '' ? 'added' : after === '' ? 'removed'
    : changed / (before.length + after.length) >= .5 ? 'rewrite' : 'words'
  const spaced = parts.flatMap((part, index) => {
    const previous = parts[index - 1]
    return previous?.removed && part.added && !/\s$/.test(previous.value) && !/^\s/.test(part.value)
      ? [{ value: ' ', added: false, removed: false, count: 0 }, part] : [part]
  })
  return { mode, parts: spaced }
}

function textVersion(label: string, value: string): HTMLElement {
  const section = document.createElement('div')
  const title = document.createElement('span')
  title.className = 'comparison-text-label'
  title.textContent = label
  section.append(title, paragraph('', value))
  return section
}

function textVersions(className: string, mode: string, before: string, after: string): HTMLElement {
  const versions = document.createElement('div')
  versions.className = className
  if (after !== '') versions.append(textVersion(mode === 'added' ? 'Added' : 'Now', after))
  if (before !== '') versions.append(textVersion(mode === 'removed' ? 'Removed' : 'Before', before))
  return versions
}

function changedText(className: string, before: string | undefined, after: string | undefined, prose = false): HTMLElement {
  const text = paragraph(className, '')
  if (before === undefined || after === undefined || before === after) {
    text.textContent = after ?? before ?? ''
    return text
  }
  const { mode, parts } = textChanges(before, after)
  if (prose && mode !== 'words') return textVersions(className, mode, before, after)
  for (const part of parts) {
    if (!part.added && !part.removed) { text.append(part.value); continue }
    const fragment = document.createElement(part.added ? 'ins' : 'del')
    fragment.textContent = part.value
    text.append(fragment)
  }
  return text
}

const fields = [
  ['title', 'name', 'what'], ['technology', 'technology', 'how'], ['parent', 'parent', 'what'],
  ['group', 'group', 'what'], ['origin', 'status', 'what'], ['draft', 'draft', 'what'],
] as const

export function componentReasons(change: ComponentChange | undefined) {
  const reasons: { key: string; label: string; tab: 'what' | 'how' }[] = []
  if (change?.status !== 'modified' || change.before === undefined || change.after === undefined) return reasons
  const { before, after } = change
  if (before.description !== after.description || before.overview !== after.overview) {
    reasons.push({ key: 'description', label: 'description', tab: 'what' })
  }
  for (const [key, label, tab] of fields) if (before[key] !== after[key]) reasons.push({ key, label, tab })
  const ownership = (element: typeof before) => JSON.stringify(element.code.map(({ scanner, file, symbol }) => [scanner, file, symbol]).sort())
  if (ownership(before) !== ownership(after)) reasons.push({ key: 'ownership', label: 'ownership', tab: 'how' })
  const files = change.files.filter(file => file.status !== 'unchanged')
  if (files.length > 0) {
    const added = files.reduce((sum, file) => sum + file.additions, 0)
    const removed = files.reduce((sum, file) => sum + file.deletions, 0)
    reasons.push({ key: 'files', label: `${files.length} ${files.length === 1 ? 'file' : 'files'} +${added} −${removed}`, tab: 'how' })
  }
  return reasons
}

/** Only source and ownership changes start in build evidence; an explicit URL tab still wins. */
export function comparisonDefaultTab(change: ComponentChange | undefined): 'what' | 'how' {
  const reasons = componentReasons(change)
  return reasons.length > 0 && reasons.every(reason => reason.key === 'ownership' || reason.key === 'files') ? 'how' : 'what'
}

export function comparisonReasons(change: ComponentChange, comparison: Comparison, world: ArchitectureGraph,
  onTab: (tab: 'what' | 'how') => void): HTMLElement | undefined {
  if (change.status !== 'modified') return undefined
  const reasons = componentReasons(change)
  const id = (change.after ?? change.before)!.representationId
  const count = world.relationships.filter(item => (item.source === id || item.target === id) && isChange(comparison.relationships[item.id])).length
  if (count > 0) reasons.push({ key: 'relationships', label: `${count} ${count === 1 ? 'relationship' : 'relationships'}`, tab: 'what' })
  const line = paragraph('comparison-reasons', 'Changed: ')
  for (const [index, reason] of reasons.entries()) {
    if (index > 0) line.append(', ')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'link'
    button.textContent = reason.label
    button.onclick = () => onTab(reason.tab)
    line.append(button)
  }
  return line
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
  const prose = (element: typeof before, key: 'description' | 'overview') => element === undefined ? undefined : element[key] ?? ''
  for (const key of ['description', 'overview'] as const) {
    if (before?.[key] || after?.[key]) body.append(changedText(key, prose(before, key), prose(after, key), true))
  }
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
  #details .comparison-reasons { color: var(--muted); font-size: 10px; line-height: 1.7; margin: 8px 0 14px; }
  #details .comparison-reasons button { font: inherit; color: inherit; }
  #details .comparison-text-label { color: var(--muted); font-size: 10px; text-transform: uppercase; }
  #details .comparison-text-label + p { margin-top: 5px; }

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
