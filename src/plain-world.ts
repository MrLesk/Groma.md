import { draftRecordOf } from './architecture-model.ts'
import { annotateArchitecture } from './core.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { emptyWorldLines, isEmptyWorld } from './empty-world.ts'
import { loadProjectProfile } from './project-profile.ts'
import type {
  AnnotatedArchitectureModel,
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureRecords,
  C4Kind,
} from './types.ts'

interface DraftOutcome {
  id: string
  outcome: string
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function rootRank(element: AnnotatedElement): number {
  if (element.kind === 'actor') return 0
  return element.external ? 2 : 1
}

function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`
}

function countLine(elements: readonly AnnotatedElement[]): string {
  const counts: Record<C4Kind, number> = {
    actor: 0,
    system: 0,
    container: 0,
    component: 0,
  }
  for (const element of elements) counts[element.kind] += 1
  return [
    plural(counts.actor, 'actor', 'actors'),
    plural(counts.system, 'system', 'systems'),
    plural(counts.container, 'container', 'containers'),
    plural(counts.component, 'component', 'components'),
  ].join(', ')
}

function headerTokens(element: AnnotatedElement): string[] {
  const tokens = [element.id, element.kind, element.title]
  if (element.external) tokens.push('external')
  if (element.origin === 'draft') {
    tokens.push(element.draft === undefined ? 'draft' : `draft:${element.draft}`)
  }
  const file = element.code[0]?.file
  if (file !== undefined) tokens.push(file)
  return tokens
}

function outgoingEdges(
  element: AnnotatedElement,
  relationships: readonly AnnotatedRelationship[],
): Array<{ description: string; targetId: string }> {
  return relationships.flatMap(relationship => {
    if (relationship.source !== element.id) return []
    return [{ description: relationship.description, targetId: relationship.target }]
  })
}

function draftOutcomes(records: ArchitectureRecords): DraftOutcome[] {
  return records.drafts
    .map(document => draftRecordOf(document))
    .map(record => ({ id: record.id, outcome: record.outcome }))
    .sort((left, right) => compareIds(left.id, right.id))
}

function childrenByParent(
  elements: readonly AnnotatedElement[],
): Map<string | null, AnnotatedElement[]> {
  const children = new Map<string | null, AnnotatedElement[]>()
  for (const element of elements) {
    const siblings = children.get(element.parent) ?? []
    siblings.push(element)
    children.set(element.parent, siblings)
  }
  for (const [parentId, siblings] of children) {
    siblings.sort((left, right) => parentId === null
      ? rootRank(left) - rootRank(right) || compareIds(left.id, right.id)
      : compareIds(left.id, right.id))
  }
  return children
}

function emitElement(
  lines: string[],
  element: AnnotatedElement,
  depth: number,
  children: Map<string | null, AnnotatedElement[]>,
  relationships: readonly AnnotatedRelationship[],
): void {
  const indent = '  '.repeat(depth)
  const bodyIndent = '  '.repeat(depth + 1)
  lines.push(`${indent}${headerTokens(element).join('  ')}`)
  if (element.overview !== '') lines.push(`${bodyIndent}${element.overview}`)
  for (const edge of outgoingEdges(element, relationships)) {
    lines.push(`${bodyIndent}->  ${edge.description}  ${edge.targetId}`)
  }
  for (const child of children.get(element.id) ?? []) {
    emitElement(lines, child, depth + 1, children, relationships)
  }
}

/** Elements carrying a draft's tag: ghosts first, then the stable parts the draft touches. */
function draftItems(
  draft: DraftOutcome,
  elements: readonly AnnotatedElement[],
): AnnotatedElement[] {
  return elements
    .filter(element => element.draft === draft.id)
    .sort((left, right) => {
      if (left.origin !== right.origin) return left.origin === 'draft' ? -1 : 1
      return compareIds(left.id, right.id)
    })
}

function itemLine(element: AnnotatedElement): string {
  return element.origin === 'draft' ? element.id : `${element.id}  stable`
}

function appendDrafts(
  lines: string[],
  drafts: readonly DraftOutcome[],
  elements: readonly AnnotatedElement[],
): void {
  if (drafts.length === 0) return
  if (lines.length > 0) lines.push('')
  lines.push('drafts')
  for (const draft of drafts) {
    lines.push(draft.id)
    if (draft.outcome !== '') lines.push(`  ${draft.outcome}`)
    for (const item of draftItems(draft, elements)) lines.push(`  ${itemLine(item)}`)
  }
}

export function formatPlainWorld(
  model: AnnotatedArchitectureModel,
  drafts: readonly DraftOutcome[] = [],
): string {
  const children = childrenByParent(model.elements)
  const lines: string[] = []
  for (const root of children.get(null) ?? []) {
    emitElement(lines, root, 0, children, model.relationships)
  }
  appendDrafts(lines, drafts, model.elements)
  if (lines.length > 0) lines.push('')
  lines.push(countLine(model.elements))
  return lines.join('\n')
}

export async function renderPlainWorld(repositoryRoot: string): Promise<string> {
  const records = await loadArchitecture(repositoryRoot)
  const model = annotateArchitecture(records)
  if (isEmptyWorld(model)) {
    const project = await loadProjectProfile(repositoryRoot)
    return emptyWorldLines(project?.title ?? '').join('\n')
  }
  return formatPlainWorld(model, draftOutcomes(records))
}

export type PlainRecordResult =
  | { ok: true; text: string }
  | { ok: false; message: string }

function formatElementRecord(
  element: AnnotatedElement,
  model: AnnotatedArchitectureModel,
): string {
  const lines = [element.id, `kind: ${element.kind}`]
  if (element.parent !== null) lines.push(`parent: ${element.parent}`)
  lines.push(`origin: ${element.origin}`)
  if (element.draft !== undefined) lines.push(`draft: ${element.draft}`)
  const file = element.code[0]?.file
  if (file !== undefined) lines.push(`code: ${file}`)

  const sections = [lines.join('\n')]
  if (element.overview !== '') sections.push(element.overview)
  const edges = outgoingEdges(element, model.relationships)
  if (edges.length > 0) {
    sections.push(
      edges.map(edge => `->  ${edge.description}  ${edge.targetId}`).join('\n'),
    )
  }
  return sections.join('\n\n')
}

function formatDraftRecord(
  draft: DraftOutcome,
  items: readonly AnnotatedElement[],
): string {
  const sections = [`${draft.id}\nkind: draft`]
  if (draft.outcome !== '') sections.push(draft.outcome)
  if (!items.some(item => item.origin === 'draft')) sections.push('complete')
  if (items.length > 0) sections.push(['items', ...items.map(itemLine)].join('\n'))
  return sections.join('\n\n')
}

export function formatPlainRecord(
  model: AnnotatedArchitectureModel,
  drafts: readonly DraftOutcome[],
  target: string,
): PlainRecordResult {
  const element = model.elements.find(item => item.id === target)
  if (element !== undefined) {
    return { ok: true, text: formatElementRecord(element, model) }
  }
  const draft = drafts.find(item => item.id === target)
  if (draft !== undefined) {
    return { ok: true, text: formatDraftRecord(draft, draftItems(draft, model.elements)) }
  }
  const [match, extra] = model.elements.filter(item => {
    return item.code.some(reference => reference.file === target)
  })
  if (extra !== undefined) {
    return { ok: false, message: `several elements share ${target}` }
  }
  if (match !== undefined) {
    return { ok: true, text: formatElementRecord(match, model) }
  }
  return { ok: false, message: `unknown target: ${target}` }
}

export async function renderPlainRecord(
  repositoryRoot: string,
  target: string,
): Promise<PlainRecordResult> {
  const records = await loadArchitecture(repositoryRoot)
  return formatPlainRecord(
    annotateArchitecture(records),
    draftOutcomes(records),
    target,
  )
}
