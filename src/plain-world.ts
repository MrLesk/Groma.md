import { draftRecordOf } from './architecture-model.ts'
import { annotateArchitecture, originOf } from './core.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { emptyWorldLines, isEmptyWorld } from './empty-world.ts'
import { loadProjectProfile } from './project-profile.ts'
import { readDocument } from './markdown-emitter.ts'
import { listPage, listWindowFooter, type ListWindow } from './list-window.ts'
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

/** One titled list of items; an item may span more than one line. */
interface PlainSection {
  title: string
  items: string[]
}

/** A title line, a separator as long as the title, then the lines, or `none` when there are none. */
function plainBlock(title: string, lines: readonly string[]): string {
  return [title, '-'.repeat(title.length), ...(lines.length > 0 ? lines : ['none'])].join('\n')
}

/**
 * Head and tail blocks always print. The sections share one window over their items in order, so a
 * cut page prints only the sections whose items it reaches, and ends with the footer naming the
 * following items. A section without items anywhere stays on every page, so paged reading shows the
 * same sections as the complete answer.
 */
function pagedAnswer(
  answer: { head?: readonly string[]; sections: readonly PlainSection[]; tail?: readonly string[] },
  window: ListWindow,
): string {
  const numbered = answer.sections.flatMap((section, index) => section.items.map(item => ({ index, item })))
  const page = listPage(numbered, window)
  if (window.count) return String(page.items.length)
  const complete = page.items.length === page.total
  const blocks = answer.sections.flatMap((section, index) => {
    const items = page.items.filter(entry => entry.index === index).map(entry => entry.item)
    const elsewhere = items.length === 0 && !complete && section.items.length > 0
    return elsewhere ? [] : [plainBlock(section.title, items)]
  })
  const footer = listWindowFooter(page, window.command)
  return [...answer.head ?? [], ...blocks, ...answer.tail ?? [], ...footer === undefined ? [] : [footer]].join('\n\n')
}

function relationshipLine(relationship: PlainRelationship): string {
  const fields = [`${relationship.source} -> ${relationship.target}`, relationship.description, relationship.technology]
  if (relationship.origin === 'draft') fields.push('draft')
  return fields.join(' | ')
}

/** One item per distinct printed relationship. Sorting the text orders by source and then target, because each line starts with `source -> ` and ids contain no spaces. */
function plainRelationshipSection(title: string, relationships: readonly PlainRelationship[]): PlainSection {
  return { title, items: [...new Set(relationships.map(relationshipLine))].sort() }
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

/** One listed element: its header tokens and, when it has one, its overview. */
function listedElement(element: AnnotatedElement): string {
  const lines = [headerTokens(element).join('  ')]
  if (element.overview !== '') lines.push(`  ${oneLine(element.overview)}`)
  return lines.join('\n')
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
  window: ListWindow,
): string {
  const roots = world.elements.filter(element => element.parent === null).sort(byId)
  const rootSection = (title: string, keep: (element: AnnotatedElement) => boolean): PlainSection => {
    return { title, items: roots.filter(keep).map(listedElement) }
  }
  const sections = [
    rootSection('Actors', element => element.kind === 'actor'),
    rootSection('Systems', element => element.kind === 'system' && !element.external),
    rootSection('External systems', element => element.external),
    plainRelationshipSection('Relationships', rootRelationships(world)),
    { title: 'Flows', items: [...world.flows].sort(byId).map(flow => `${flow.id}  ${flow.title}`) },
  ]
  // Flows are part of the context level, so an empty index still says `none`; drafts are an optional extra index.
  if (drafts.length > 0) sections.push({ title: 'Drafts', items: drafts.map(draftLine) })
  return pagedAnswer({ sections }, window)
}

/** One element one C4 level down: itself, its direct children, and the relationships crossing its boundary. */
function formatPlainElement(world: ArchitectureGraph, element: AnnotatedElement, window: ListWindow): string {
  const elements = new Map(world.elements.map(item => [item.id, item]))
  const { incoming, outgoing } = boundaryRelationships(world, element.id)
  return pagedAnswer({
    head: [plainBlock('Element', elementDetails(element))],
    sections: [
      { title: 'Children', items: element.children.map(id => listedElement(elements.get(id)!)) },
      plainRelationshipSection('Incoming relationships', incoming),
      plainRelationshipSection('Outgoing relationships', outgoing),
    ],
  }, window)
}

export async function renderPlainWorld(repositoryRoot: string, window: ListWindow): Promise<string> {
  const records = await loadArchitecture(repositoryRoot)
  const model = annotateArchitecture(records)
  if (isEmptyWorld(model)) {
    if (window.count) return '0'
    const project = await loadProjectProfile(repositoryRoot)
    return emptyWorldLines(project?.title ?? '').join('\n')
  }
  return formatPlainWorld(model, draftOutcomes(records), window)
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

/**
 * The file connections of map relationships whose endpoint is this exact file. Rows addressed to the owning
 * element, and rows between files of one component, are not listed.
 */
export function fileConnections(
  world: ArchitectureGraph,
  file: string,
): { incoming: PlainRelationship[]; outgoing: PlainRelationship[] } {
  const rows = world.relationships.flatMap(relationship => relationship.connections ?? []).map(connection => ({
    ...connection,
    origin: originOf(connection.status),
  }))
  return {
    incoming: rows.filter(row => row.target === file),
    outgoing: rows.filter(row => row.source === file),
  }
}

/**
 * Answers every target no earlier branch resolved, including mistyped ids: a source file answers with its owning
 * component, the file's connections, and the command for the owner's record.
 */
function fileAnswer(world: ArchitectureGraph, file: string, window: ListWindow): PlainRecordResult {
  const owner = world.elements.find(element => element.code.some(reference => reference.file === file))
  if (owner === undefined) return { ok: false, message: `unknown target: ${file}` }
  const { incoming, outgoing } = fileConnections(world, file)
  const text = pagedAnswer({
    head: [plainBlock('Owner', [`${owner.id}  ${owner.kind}  ${owner.title}`, `parent: ${owner.parent}`])],
    sections: [
      plainRelationshipSection('Incoming relationships', incoming),
      plainRelationshipSection('Outgoing relationships', outgoing),
    ],
    tail: [`Complete owner record: groma view ${owner.id}`],
  }, window)
  return { ok: true, text: `${text}\n` }
}

/** Resolves the target in order: element drill-down (plain only), element or flow Markdown, draft summary, source file answer, unknown target. */
export async function renderPlainRecord(
  repositoryRoot: string,
  target: string,
  plain: boolean,
  window: ListWindow,
): Promise<PlainRecordResult> {
  const records = await loadArchitecture(repositoryRoot)
  const model = annotateArchitecture(records)
  const element = plain ? model.elements.find(item => item.id === target) : undefined
  if (element !== undefined) return { ok: true, text: `${formatPlainElement(model, element, window)}\n` }
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
  return fileAnswer(model, target, window)
}
