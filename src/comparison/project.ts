import type { AnnotatedArchitectureModel, AnnotatedElement, AnnotatedRelationship } from '../types.ts'
import type { GitFileChange, GitRange } from '../history/git-state.ts'
import type { ChangeSet, Comparison, ElementChange, RelationshipChange } from './model.ts'

function owners(world: AnnotatedArchitectureModel): Map<string, string> {
  return new Map(world.elements.flatMap(element => element.code.map(code => [code.file, element.id] as const)))
}

const fields = ['title', 'description', 'overview', 'parent', 'external', 'group', 'technology', 'origin', 'draft'] as const
const names = { title: 'Name', description: 'Description', overview: 'Description', parent: 'Parent', external: 'Boundary', group: 'Group', technology: 'Technology', origin: 'Lifecycle', draft: 'Draft' }
const membership = (element: AnnotatedElement) => JSON.stringify(element.code.map(code => [code.file, code.symbol ?? '', code.scanner]).sort())

function elementChanges(before: AnnotatedArchitectureModel, after: AnnotatedArchitectureModel, changedOwners: Set<string>): ElementChange[] {
  const old = new Map(before.elements.map(element => [element.id, element]))
  const current = new Map(after.elements.map(element => [element.id, element]))
  const changes: ElementChange[] = []
  for (const element of after.elements) {
    const previous = old.get(element.id)
    if (previous === undefined) { changes.push({ id: element.id, status: 'added', reasons: ['Architecture'] }); continue }
    const reasons: string[] = fields.filter(key => previous[key] !== element[key]).map(key => names[key])
    if (membership(previous) !== membership(element)) reasons.push('Source membership')
    if (changedOwners.has(element.id)) reasons.push('Code')
    if (reasons.length) changes.push({ id: element.id, status: 'edited', reasons: [...new Set(reasons)],
      ...(previous.parent === element.parent ? {} : { previousParent: previous.parent }) })
  }
  for (const element of before.elements) {
    if (!current.has(element.id)) changes.push({ id: element.id, status: 'removed', reasons: ['Architecture'] })
  }
  return changes
}

function relationshipValue(item: AnnotatedRelationship): string {
  const connections = item.connections?.map(connection => JSON.stringify([
    connection.source, connection.target, connection.description, connection.technology, connection.status, connection.authored,
  ])).sort()
  return JSON.stringify([item.source, item.target, item.description, item.technology, item.origin, item.draft, connections])
}

function relationshipChanges(before: AnnotatedArchitectureModel, after: AnnotatedArchitectureModel): RelationshipChange[] {
  const old = new Map(before.relationships.map(item => [item.id, item]))
  const current = new Map(after.relationships.map(item => [item.id, item]))
  const changes: RelationshipChange[] = []
  for (const item of after.relationships) {
    const previous = old.get(item.id)
    if (previous === undefined) changes.push({ id: item.id, status: 'added' })
    else if (relationshipValue(previous) !== relationshipValue(item)) changes.push({ id: item.id, status: 'edited' })
  }
  for (const item of before.relationships) {
    if (!current.has(item.id)) changes.push({ id: item.id, status: 'removed' })
  }
  return changes
}

/** Render IDs are ordinal; comparison matches endpoint/connection identity instead. */
function comparisonRelationships(world: AnnotatedArchitectureModel): AnnotatedArchitectureModel {
  const ids = new Map<string, string>()
  const relationships = world.relationships.map(item => {
    const endpoints = item.connections?.map(connection => [connection.source, connection.target]).sort()
    const id = 'comparison:' + JSON.stringify([item.source, item.target, endpoints])
    ids.set(item.id, id)
    return { ...item, id }
  })
  return { ...world, relationships, flows: world.flows.map(flow => ({
    ...flow, steps: flow.steps.map(step => ({ ...step, relationshipId: ids.get(step.relationshipId) ?? step.relationshipId })),
  })) }
}

/** Architecture IDs establish identity. A changed file never creates a component. */
export function projectChanges(range: GitRange, before: AnnotatedArchitectureModel, after: AnnotatedArchitectureModel, changes: GitFileChange[]): Comparison {
  before = comparisonRelationships(before)
  after = comparisonRelationships(after)
  const oldOwners = owners(before)
  const newOwners = owners(after)
  const files = changes.map(change => ({
    ...change,
    beforeOwner: oldOwners.get(change.previousFile ?? change.file),
    afterOwner: newOwners.get(change.file),
  }))
  const changedOwners = new Set(files.flatMap(file => [file.beforeOwner, file.afterOwner].filter((id): id is string => id !== undefined)))
  return { range, files, before, after,
    elements: elementChanges(before, after, changedOwners),
    relationships: relationshipChanges(before, after) }
}

/** One temporary world: target containment wins; removed identities retain their base context. */
export function comparisonWorld(comparison: Comparison): AnnotatedArchitectureModel {
  const targetIds = new Set(comparison.after.elements.map(element => element.id))
  const elements = [
    ...comparison.after.elements,
    ...comparison.before.elements.filter(element => !targetIds.has(element.id)),
  ].map(element => ({ ...element, children: [] as string[], code: element.code.map(code => ({ ...code })) }))
  const byRepresentation = new Map(elements.map(element => [element.representationId, element]))
  for (const element of elements) {
    if (element.parent !== null) byRepresentation.get(element.parent)?.children.push(element.representationId)
  }
  const relationships = new Map(comparison.before.relationships.map(item => [item.id, item]))
  for (const item of comparison.after.relationships) relationships.set(item.id, item)
  return { ...comparison.after, elements, relationships: structuredClone([...relationships.values()]) }
}

export function changePaint(changes: ChangeSet): Record<string, 'added' | 'edited' | 'removed'> {
  return Object.fromEntries([...changes.elements, ...changes.relationships].map(change => [change.id, change.status]))
}
