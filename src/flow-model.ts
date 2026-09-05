import { collectNodes, elementOverview, nodeText, relationshipTargetFilename, tableHeaderNames } from './architecture-markdown.ts'
import { ArchitectureModelError } from './architecture-model.ts'
import { requireGromaMapping } from './okf-profile.ts'
import type { ArchitectureDocument, ArchitectureFlow, ArchitectureModel, FlowStep, MarkdownElement, MarkdownNode } from './types.ts'

function invalid(document: ArchitectureDocument, message: string): never {
  throw new ArchitectureModelError('INVALID_FLOW', document.sourceFilename, message)
}

function textField(document: ArchitectureDocument, value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalid(document, `${field} must be non-empty text`)
  return value
}

function stepRows(document: ArchitectureDocument): MarkdownElement[] {
  const rows: MarkdownElement[] = []
  let inSteps = false
  for (const node of document.nodes) {
    if (!Array.isArray(node)) continue
    if (node[0] === 'h2') inSteps = nodeText(node).trim() === 'Steps'
    if (node[0] !== 'table' || !inSteps) continue
    if (tableHeaderNames(node).join('|') !== 'From|To|Action') {
      invalid(document, 'Steps table must use columns "From | To | Action"')
    }
    rows.push(...collectNodes(node, 'tbody').flatMap(body => collectNodes(body, 'tr')))
  }
  if (rows.length === 0) invalid(document, 'requires an ordered table under "## Steps"')
  return rows
}

function endpoint(document: ArchitectureDocument, cell: MarkdownNode | undefined, model: ArchitectureModel): string {
  const links = collectNodes(cell, 'a')
  if (links.length !== 1) invalid(document, 'each step endpoint requires exactly one Markdown link')
  const filename = relationshipTargetFilename(document.sourceFilename, links[0]![1].href)
  const element = model.elements.find(candidate => candidate.sourceFilename === filename)
  if (!element) invalid(document, `step endpoint does not resolve to an element: ${String(links[0]![1].href)}`)
  return element.id
}

function resolveStep(document: ArchitectureDocument, row: MarkdownElement, model: ArchitectureModel): FlowStep {
  const cells = collectNodes(row, 'td')
  if (cells.length !== 3) invalid(document, 'each step requires From, To and Action')
  const source = endpoint(document, cells[0], model)
  const target = endpoint(document, cells[1], model)
  const matches = model.relationships.flatMap((relationship, index) => {
    return relationship.sourceId === source && relationship.targetId === target ? [index] : []
  })
  if (matches.length !== 1) {
    invalid(document, `${source} → ${target} must resolve exactly one directed relationship (found ${matches.length})`)
  }
  return {
    relationshipId: `relationship:${matches[0]}`,
    source,
    target,
    action: textField(document, nodeText(cells[2]).trim(), 'step action'),
  }
}

/** Resolves normal Markdown links against this revision, without deriving any connections. */
export function resolveFlows(documents: readonly ArchitectureDocument[], model: ArchitectureModel): ArchitectureFlow[] {
  const ids = new Set(model.elements.map(element => element.id))
  return documents.map(document => {
    const groma = requireGromaMapping(document.frontmatter, document.sourceFilename)
    const id = textField(document, groma.id, 'groma.id')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) invalid(document, 'groma.id must be lowercase kebab-case')
    if (ids.has(id)) invalid(document, `duplicate id "${id}"`)
    ids.add(id)
    if (document.sourceFilename.split('/').slice(1).join('/') !== `flows/${id}.md`) {
      invalid(document, `flow must be stored at flows/${id}.md`)
    }
    if (Object.keys(groma).some(field => field !== 'id')) invalid(document, 'flow groma mapping only supports id')
    const overview = elementOverview(document, (_code, _filename, message) => invalid(document, message))
    textField(document, overview, 'overview')
    const description = document.frontmatter.description
    if (description !== undefined && typeof description !== 'string') invalid(document, 'description must be text')
    return {
      id,
      title: textField(document, document.frontmatter.title, 'title'),
      ...(description === undefined ? {} : { description }),
      overview,
      sourceFilename: document.sourceFilename,
      steps: stepRows(document).map(row => resolveStep(document, row, model)),
    }
  })
}
