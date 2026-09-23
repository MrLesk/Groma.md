import type { AnnotatedArchitectureModel, AnnotatedElement, AnnotatedRelationship } from '../types.ts'
import type { GitRevision } from './revisions.ts'
import { projectFileDiff, type FileDiff } from '../viewers/source/diff-lines.ts'

export type ChangeStatus = FileDiff['status']
export type SourceTexts = Record<string, string | undefined>
export interface ComponentChange {
  status: ChangeStatus
  before?: AnnotatedElement
  after?: AnnotatedElement
  files: FileDiff[]
}
export interface Comparison {
  from: GitRevision | null
  components: Record<string, ComponentChange>
  relationships: Record<string, ChangeStatus>
}

export function ownedFiles(world: AnnotatedArchitectureModel): string[] {
  return [...new Set(world.elements.flatMap(element => element.code.map(code => code.file)))]
}

function ownContent(element: AnnotatedElement): string {
  const { title, description, overview, parent, external, group, technology, origin, draft } = element
  const code = element.code.map(({ scanner, file, symbol }) => JSON.stringify([scanner, file, symbol])).sort()
  return JSON.stringify({ title, description, overview, parent, external, group, technology, origin, draft, code })
}

function componentChange(before: AnnotatedElement | undefined, after: AnnotatedElement | undefined,
  oldSources: SourceTexts, newSources: SourceTexts): ComponentChange {
  const paths = [...new Set([...(after?.code ?? []), ...(before?.code ?? [])].map(code => code.file))]
  const files = paths.map(file => projectFileDiff(file, oldSources[file], newSources[file]))
  const status = before === undefined ? 'added' : after === undefined ? 'removed'
    : ownContent(before) !== ownContent(after) || files.some(file => file.status !== 'unchanged') ? 'modified' : 'unchanged'
  return { status, before, after, files }
}

/** Relationships have no persisted ID: their directed endpoints and origin identify one collaboration. */
function relationshipKey(relationship: AnnotatedRelationship): string {
  return JSON.stringify([relationship.source, relationship.target, relationship.origin])
}

function relationshipContent(relationship: AnnotatedRelationship): string {
  const { description, technology, draft } = relationship
  const connections = relationship.connections?.map(connection => JSON.stringify([
    connection.source, connection.target, connection.description, connection.technology, connection.status, connection.authored,
  ])).sort()
  return JSON.stringify({ description, technology, draft, connections })
}

function compareRelationships(before: AnnotatedArchitectureModel, after: AnnotatedArchitectureModel) {
  const old = new Map(before.relationships.map(item => [relationshipKey(item), item]))
  const changes: Record<string, ChangeStatus> = {}
  const relationships = after.relationships.map(item => {
    const previous = old.get(relationshipKey(item))
    changes[item.id] = previous === undefined ? 'added'
      : relationshipContent(previous) === relationshipContent(item) ? 'unchanged' : 'modified'
    old.delete(relationshipKey(item))
    return item
  })
  for (const item of old.values()) {
    const removed = { ...item, id: `removed:${item.id}` }
    relationships.push(removed)
    changes[removed.id] = 'removed'
  }
  return { relationships, changes }
}

/** B owns the map; missing A components and only their required context remain inspectable. */
function combinedElements(before: AnnotatedArchitectureModel, after: AnnotatedArchitectureModel,
  relationships: AnnotatedRelationship[]): AnnotatedElement[] {
  const old = new Map(before.elements.map(item => [item.representationId, item]))
  const elements = new Map(after.elements.map(item => [item.representationId, item]))
  function include(id: string): void {
    if (elements.has(id)) return
    const item = old.get(id)
    if (item === undefined) return
    elements.set(id, item)
    if (item.parent !== null) include(item.parent)
  }
  for (const item of before.elements) if (item.kind === 'component') include(item.representationId)
  for (const item of relationships) { include(item.source); include(item.target) }
  const children = new Map<string, string[]>()
  for (const item of elements.values()) {
    if (item.parent === null) continue
    const siblings = children.get(item.parent) ?? []
    siblings.push(item.representationId)
    children.set(item.parent, siblings)
  }
  return [...elements.values()].map(item => ({ ...item, children: children.get(item.representationId) ?? [] }))
}

/**
 * An id that names a different kind of element in each revision stands for two elements: the destination's keeps the
 * id, and the start's becomes `removed:<id>`, as a removed relationship does, together with every reference to it in
 * the start revision. Otherwise the start's children would hang under the destination's element of the wrong kind.
 */
function withChangedKindsApart(before: AnnotatedArchitectureModel, after: AnnotatedArchitectureModel): AnnotatedArchitectureModel {
  const kinds = new Map(after.elements.map(item => [item.representationId, item.kind]))
  const changed = new Set(before.elements
    .filter(item => kinds.has(item.representationId) && kinds.get(item.representationId) !== item.kind)
    .map(item => item.representationId))
  if (changed.size === 0) return before
  const apart = (id: string): string => changed.has(id) ? `removed:${id}` : id
  return {
    ...before,
    elements: before.elements.map(item => ({
      ...item,
      ...(changed.has(item.representationId) ? { id: `removed:${item.id}`, representationId: apart(item.representationId) } : {}),
      parent: item.parent === null ? null : apart(item.parent),
    })),
    relationships: before.relationships.map(item => ({ ...item, source: apart(item.source), target: apart(item.target) })),
  }
}

/** Pure comparison: never changes either snapshot or propagates a change to neighbors or ancestors. */
export function compareArchitecture(start: AnnotatedArchitectureModel, after: AnnotatedArchitectureModel,
  oldSources: SourceTexts, newSources: SourceTexts) {
  const before = withChangedKindsApart(start, after)
  const old = new Map(before.elements.filter(item => item.kind === 'component').map(item => [item.id, item]))
  const next = new Map(after.elements.filter(item => item.kind === 'component').map(item => [item.id, item]))
  const components: Record<string, ComponentChange> = {}
  for (const id of new Set([...old.keys(), ...next.keys()])) {
    components[id] = componentChange(old.get(id), next.get(id), oldSources, newSources)
  }
  const { relationships, changes } = compareRelationships(before, after)
  const world: AnnotatedArchitectureModel = {
    ...after, elements: combinedElements(before, after, relationships), relationships,
  }
  return { world, components, relationships: changes }
}
