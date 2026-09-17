import { draftRecordOf } from './architecture-model.ts'
import { annotateArchitecture } from './core.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { emptyWorldLines, isEmptyWorld } from './empty-world.ts'
import { loadProjectProfile } from './project-profile.ts'
import { readDocument } from './markdown-emitter.ts'
import { RELATIONSHIPS_TYPE, requireGromaMapping } from './okf-profile.ts'
import { ancestorIds, parentOfElements, showsRelationshipText } from './viewers/relationship-text.ts'
import type {
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureGraph,
  ArchitectureRecords,
} from './types.ts'

interface DraftOutcome {
  id: string
  outcome: string
}

/** What one relationship line names. */
export type PlainRelationship = Pick<AnnotatedRelationship, 'source' | 'target' | 'description' | 'technology' | 'origin'>

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function byId(left: { id: string }, right: { id: string }): number {
  return compareIds(left.id, right.id)
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ')
}

/** A title line, a separator as long as the title, then the lines, or `none` when there are none. */
export function plainSection(title: string, lines: readonly string[]): string {
  return [title, '-'.repeat(title.length), ...(lines.length > 0 ? lines : ['none'])].join('\n')
}

function relationshipLine(relationship: PlainRelationship): string {
  const fields = [`${relationship.source} -> ${relationship.target}`, relationship.description, relationship.technology]
  if (relationship.origin === 'draft') fields.push('draft')
  return fields.join(' | ')
}

/** One line per distinct printed relationship. Sorting the text orders by source and then target, because each line starts with `source -> ` and ids contain no spaces. */
export function plainRelationshipSection(title: string, relationships: readonly PlainRelationship[]): string {
  return plainSection(title, [...new Set(relationships.map(relationshipLine))].sort())
}

/** Every relationship with both ends lifted to their root elements; a relationship inside one root disappears. */
export function rootRelationships(world: ArchitectureGraph): PlainRelationship[] {
  const parentOf = parentOfElements(world.elements)
  const rootOf = (id: string) => ancestorIds(id, parentOf).at(-1)!
  return world.relationships
    .map(relationship => ({ ...relationship, source: rootOf(relationship.source), target: rootOf(relationship.target) }))
    .filter(relationship => relationship.source !== relationship.target)
}

/** The relationships that cross the element's boundary, named by the elements at their ends. */
export function boundaryRelationships(
  world: ArchitectureGraph,
  elementId: string,
): { incoming: AnnotatedRelationship[]; outgoing: AnnotatedRelationship[] } {
  const parentOf = parentOfElements(world.elements)
  const crossing = world.relationships.filter(relationship => showsRelationshipText(relationship, elementId, parentOf))
  const leaves = (relationship: AnnotatedRelationship) => ancestorIds(relationship.source, parentOf).includes(elementId)
  return {
    incoming: crossing.filter(relationship => !leaves(relationship)),
    outgoing: crossing.filter(leaves),
  }
}

function headerTokens(element: AnnotatedElement): string[] {
  const tokens = [element.id, element.kind, element.title]
  if (element.external) tokens.push('external')
  if (element.group !== undefined) tokens.push(`group:${element.group}`)
  if (element.origin === 'draft') {
    tokens.push(element.draft === undefined ? 'draft' : `draft:${element.draft}`)
  }
  const file = element.code[0]?.file
  if (file !== undefined) tokens.push(file)
  return tokens
}

function listedElement(element: AnnotatedElement): string[] {
  const lines = [headerTokens(element).join('  ')]
  if (element.overview !== '') lines.push(`  ${oneLine(element.overview)}`)
  return lines
}

function elementDetails(element: AnnotatedElement): string[] {
  const lines = [headerTokens(element).join('  ')]
  if (element.parent !== null) lines.push(`parent: ${element.parent}`)
  if (element.technology !== undefined) lines.push(`technology: ${element.technology}`)
  if (element.description !== undefined) lines.push(`description: ${element.description}`)
  if (element.overview !== '') lines.push(...element.overview.split(/\n\s*\n/))
  return lines
}

function draftOutcomes(records: ArchitectureRecords): DraftOutcome[] {
  return records.drafts
    .map(document => draftRecordOf(document))
    .map(record => ({ id: record.id, outcome: record.outcome }))
    .sort(byId)
}

function draftLine(draft: DraftOutcome): string {
  return draft.outcome === '' ? draft.id : `${draft.id}  ${oneLine(draft.outcome)}`
}

/** The C4 context level: root elements, the relationships between them, and the flow and draft indexes. */
function formatPlainWorld(
  world: ArchitectureGraph,
  drafts: readonly DraftOutcome[],
): string {
  const roots = world.elements.filter(element => element.parent === null).sort(byId)
  const rootSection = (title: string, keep: (element: AnnotatedElement) => boolean) => {
    return plainSection(title, roots.filter(keep).flatMap(listedElement))
  }
  const sections = [
    rootSection('Actors', element => element.kind === 'actor'),
    rootSection('Systems', element => element.kind === 'system' && !element.external),
    rootSection('External systems', element => element.external),
    plainRelationshipSection('Relationships', rootRelationships(world)),
    plainSection('Flows', [...world.flows].sort(byId).map(flow => `${flow.id}  ${flow.title}`)),
  ]
  // Flows are part of the context level, so an empty index still says `none`; drafts are an optional extra index.
  if (drafts.length > 0) sections.push(plainSection('Drafts', drafts.map(draftLine)))
  return sections.join('\n\n')
}

/** One element one C4 level down: itself, its direct children, and the relationships crossing its boundary. */
function formatPlainElement(world: ArchitectureGraph, element: AnnotatedElement): string {
  const elements = new Map(world.elements.map(item => [item.id, item]))
  const { incoming, outgoing } = boundaryRelationships(world, element.id)
  return [
    plainSection('Element', elementDetails(element)),
    plainSection('Children', element.children.flatMap(id => listedElement(elements.get(id)!))),
    plainRelationshipSection('Incoming relationships', incoming),
    plainRelationshipSection('Outgoing relationships', outgoing),
  ].join('\n\n')
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

/** Resolves the target in order: element drill-down (plain only), element or flow Markdown, draft summary, source file, unknown target. */
export async function renderPlainRecord(
  repositoryRoot: string,
  target: string,
  plain: boolean,
): Promise<PlainRecordResult> {
  const records = await loadArchitecture(repositoryRoot)
  const model = annotateArchitecture(records)
  const element = plain ? model.elements.find(item => item.id === target) : undefined
  if (element !== undefined) return { ok: true, text: `${formatPlainElement(model, element)}\n` }
  const documents = [...records.documents, ...records.flows]
    .filter(document => document.frontmatter.type !== RELATIONSHIPS_TYPE)
  const documentById = new Map(documents.map(document => [
    requireGromaMapping(document.frontmatter, document.sourceFilename).id,
    document,
  ]))
  const document = documentById.get(target)
  if (document !== undefined) {
    return { ok: true, text: await readDocument(repositoryRoot, document.sourceFilename) }
  }
  const draft = draftOutcomes(records).find(item => item.id === target)
  if (draft !== undefined) {
    return { ok: true, text: `${formatDraftRecord(draft, draftItems(draft, model.elements))}\n` }
  }
  const [match, extra] = model.elements.filter(item => {
    return item.code.some(reference => reference.file === target)
  })
  if (extra !== undefined) {
    return { ok: false, message: `several elements share ${target}` }
  }
  if (match !== undefined) {
    return { ok: true, text: await readDocument(repositoryRoot, documentById.get(match.id)!.sourceFilename) }
  }
  return { ok: false, message: `unknown target: ${target}` }
}
