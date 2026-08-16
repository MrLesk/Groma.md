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
  if (element.kind === 'person') return 0
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
    person: 0,
    system: 0,
    container: 0,
    component: 0,
  }
  for (const element of elements) counts[element.kind] += 1
  return [
    plural(counts.person, 'person', 'people'),
    plural(counts.system, 'system', 'systems'),
    plural(counts.container, 'container', 'containers'),
    plural(counts.component, 'component', 'components'),
  ].join(', ')
}

function headerTokens(element: AnnotatedElement): string[] {
  const tokens = [element.id, element.kind, element.name]
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

export function formatPlainWorld(
  model: AnnotatedArchitectureModel,
  plans: readonly PlanOutcome[] = [],
): string {
  const winners = winningElements(model.elements)
  const byRepresentation = new Map(
    model.elements.map(element => [element.representationId, element]),
  )
  const childrenOf = new Map<string | null, AnnotatedElement[]>()
  for (const element of winners) {
    const parentId = parentArchitectureId(element, byRepresentation)
    const siblings = childrenOf.get(parentId) ?? []
    siblings.push(element)
    childrenOf.set(parentId, siblings)
  }
  for (const [parentId, siblings] of childrenOf) {
    siblings.sort((left, right) => {
      if (parentId === null) {
        return rootRank(left) - rootRank(right) || compareIds(left.id, right.id)
      }
      return compareIds(left.id, right.id)
    })
  }

  const lines: string[] = []

  function emit(element: AnnotatedElement, depth: number): void {
    const indent = '  '.repeat(depth)
    const bodyIndent = '  '.repeat(depth + 1)
    lines.push(`${indent}${headerTokens(element).join('  ')}`)
    if (element.description !== '') lines.push(`${bodyIndent}${element.description}`)
    for (const edge of outgoingEdges(element, model.relationships, byRepresentation)) {
      lines.push(`${bodyIndent}->  ${edge.description}  ${edge.targetId}`)
    }
    for (const child of childrenOf.get(element.id) ?? []) emit(child, depth + 1)
  }

  for (const root of childrenOf.get(null) ?? []) emit(root, 0)

  if (plans.length > 0) {
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

  if (lines.length > 0) lines.push('')
  lines.push(countLine(winners))
  return lines.join('\n')
}

export async function renderPlainWorld(repositoryRoot: string): Promise<string> {
  const revisions = await loadArchitecture(repositoryRoot)
  return formatPlainWorld(annotateArchitecture(revisions), planOutcomes(revisions))
}
