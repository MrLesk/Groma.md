import { annotateArchitecture } from './core.ts'
import { loadArchitecture } from './architecture-reader.ts'
import type {
  AnnotatedArchitectureModel,
  AnnotatedElement,
  AnnotatedRelationship,
  C4Kind,
  MarkdownNode,
  Origin,
  RevisionRecord,
} from './types.ts'

interface PlanOutcome {
  id: string
  outcome: string
}

const originRank: Record<Origin, number> = {
  missing: 0,
  observed: 1,
  planned: 2,
}

function nodeText(node: MarkdownNode | undefined): string {
  if (typeof node === 'string') return node
  if (!Array.isArray(node)) return ''
  return (node.slice(2) as MarkdownNode[]).map(nodeText).join('')
}

function firstSectionParagraph(nodes: readonly MarkdownNode[], headingId: string): string {
  let inSection = false
  for (const node of nodes) {
    if (!Array.isArray(node)) continue
    if (node[0] === 'h2') {
      if (inSection) break
      inSection = node[1]?.id === headingId
      continue
    }
    if (inSection && node[0] === 'p') return nodeText(node).trim()
  }
  return ''
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function rootRank(element: AnnotatedElement): number {
  if (element.kind === 'actor') return 0
  return element.external ? 2 : 1
}

function winningElements(elements: readonly AnnotatedElement[]): AnnotatedElement[] {
  const winners = new Map<string, AnnotatedElement>()
  for (const element of elements) {
    const current = winners.get(element.id)
    if (current === undefined || originRank[element.origin] > originRank[current.origin]) {
      winners.set(element.id, element)
    }
  }
  return [...winners.values()]
}

function parentArchitectureId(
  element: AnnotatedElement,
  byRepresentation: Map<string, AnnotatedElement>,
): string | null {
  if (element.parent === null) return null
  return byRepresentation.get(element.parent)?.id ?? null
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
  if (element.origin === 'planned' && element.plan !== undefined) {
    tokens.push(`planned:${element.plan}`)
  }
  const file = element.code[0]?.file
  if (file !== undefined) tokens.push(file)
  return tokens
}

function outgoingEdges(
  element: AnnotatedElement,
  relationships: readonly AnnotatedRelationship[],
  byRepresentation: Map<string, AnnotatedElement>,
): Array<{ description: string; targetId: string }> {
  return relationships.flatMap(relationship => {
    if (relationship.source !== element.representationId) return []
    const target = byRepresentation.get(relationship.target)
    if (target === undefined) return []
    return [{ description: relationship.description, targetId: target.id }]
  })
}

function planOutcomes(revisions: readonly RevisionRecord[]): PlanOutcome[] {
  return revisions.flatMap(record => {
    if (record.revision.kind !== 'plan') return []
    return [{
      id: record.revision.name,
      outcome: firstSectionParagraph(record.context.nodes, 'outcome'),
    }]
  })
}

function childrenByArchitectureId(
  winners: readonly AnnotatedElement[],
  byRepresentation: Map<string, AnnotatedElement>,
): Map<string | null, AnnotatedElement[]> {
  const children = new Map<string | null, AnnotatedElement[]>()
  for (const element of winners) {
    const parentId = parentArchitectureId(element, byRepresentation)
    const siblings = children.get(parentId) ?? []
    siblings.push(element)
    children.set(parentId, siblings)
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
  byRepresentation: Map<string, AnnotatedElement>,
): void {
  const indent = '  '.repeat(depth)
  const bodyIndent = '  '.repeat(depth + 1)
  lines.push(`${indent}${headerTokens(element).join('  ')}`)
  if (element.overview !== '') lines.push(`${bodyIndent}${element.overview}`)
  for (const edge of outgoingEdges(element, relationships, byRepresentation)) {
    lines.push(`${bodyIndent}->  ${edge.description}  ${edge.targetId}`)
  }
  for (const child of children.get(element.id) ?? []) {
    emitElement(lines, child, depth + 1, children, relationships, byRepresentation)
  }
}

function appendPlans(
  lines: string[],
  plans: readonly PlanOutcome[],
  winners: readonly AnnotatedElement[],
): void {
  if (plans.length === 0) return
  if (lines.length > 0) lines.push('')
  lines.push('plans')
  for (const plan of plans) {
    lines.push(plan.id)
    if (plan.outcome !== '') lines.push(`  ${plan.outcome}`)
    const ghosts = winners
      .filter(element => element.origin === 'planned' && element.plan === plan.id)
      .sort((left, right) => compareIds(left.id, right.id))
    for (const ghost of ghosts) lines.push(`  ${ghost.id}`)
  }
}

export function formatPlainWorld(
  model: AnnotatedArchitectureModel,
  plans: readonly PlanOutcome[] = [],
): string {
  const winners = winningElements(model.elements)
  const byRepresentation = new Map(
    model.elements.map(element => [element.representationId, element]),
  )
  const children = childrenByArchitectureId(winners, byRepresentation)
  const lines: string[] = []
  for (const root of children.get(null) ?? []) {
    emitElement(lines, root, 0, children, model.relationships, byRepresentation)
  }
  appendPlans(lines, plans, winners)
  if (lines.length > 0) lines.push('')
  lines.push(countLine(winners))
  return lines.join('\n')
}

export async function renderPlainWorld(repositoryRoot: string): Promise<string> {
  const revisions = await loadArchitecture(repositoryRoot)
  return formatPlainWorld(annotateArchitecture(revisions), planOutcomes(revisions))
}

export type PlainRecordResult =
  | { ok: true; text: string }
  | { ok: false; message: string }

function formatElementRecord(
  element: AnnotatedElement,
  model: AnnotatedArchitectureModel,
  byRepresentation: Map<string, AnnotatedElement>,
): string {
  const lines = [element.id, `kind: ${element.kind}`]
  const parentId = parentArchitectureId(element, byRepresentation)
  if (parentId !== null) lines.push(`parent: ${parentId}`)
  lines.push(`origin: ${element.origin}`)
  if (element.origin === 'planned' && element.plan !== undefined) {
    lines.push(`plan: ${element.plan}`)
  }
  const file = element.code[0]?.file
  if (file !== undefined) lines.push(`code: ${file}`)

  const sections = [lines.join('\n')]
  if (element.overview !== '') sections.push(element.overview)
  const edges = outgoingEdges(element, model.relationships, byRepresentation)
  if (edges.length > 0) {
    sections.push(
      edges.map(edge => `->  ${edge.description}  ${edge.targetId}`).join('\n'),
    )
  }
  return sections.join('\n\n')
}

function formatPlanRecord(
  plan: PlanOutcome,
  ghosts: readonly AnnotatedElement[],
): string {
  const header = `${plan.id}\nkind: plan`
  if (ghosts.length === 0) return `${header}\n\ncomplete`
  const ghostBlock = ['ghosts', ...ghosts.map(ghost => ghost.id)].join('\n')
  if (plan.outcome === '') return `${header}\n\n${ghostBlock}`
  return `${header}\n\n${plan.outcome}\n\n${ghostBlock}`
}

export function formatPlainRecord(
  model: AnnotatedArchitectureModel,
  plans: readonly PlanOutcome[],
  target: string,
): PlainRecordResult {
  const winners = winningElements(model.elements)
  const byRepresentation = new Map(
    model.elements.map(element => [element.representationId, element]),
  )
  const element = winners.find(item => item.id === target)
  if (element !== undefined) {
    return {
      ok: true,
      text: formatElementRecord(element, model, byRepresentation),
    }
  }
  const plan = plans.find(item => item.id === target)
  if (plan !== undefined) {
    const ghosts = winners
      .filter(item => item.origin === 'planned' && item.plan === plan.id)
      .sort((left, right) => compareIds(left.id, right.id))
    return { ok: true, text: formatPlanRecord(plan, ghosts) }
  }
  const [match, extra] = winners.filter(item => {
    return item.code.some(reference => reference.file === target)
  })
  if (extra !== undefined) {
    return { ok: false, message: `several elements share ${target}` }
  }
  if (match !== undefined) {
    return {
      ok: true,
      text: formatElementRecord(match, model, byRepresentation),
    }
  }
  return { ok: false, message: `unknown target: ${target}` }
}

export async function renderPlainRecord(
  repositoryRoot: string,
  target: string,
): Promise<PlainRecordResult> {
  const revisions = await loadArchitecture(repositoryRoot)
  return formatPlainRecord(
    annotateArchitecture(revisions),
    planOutcomes(revisions),
    target,
  )
}
