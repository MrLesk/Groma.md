import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { architectureFindingsFor } from './architecture-findings.ts'
import { buildArchitectureModel, draftRecordOf } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { resolveFlows } from './flow-model.ts'
import { moveBlocker } from './move.ts'
import type {
  AnnotatedArchitectureModel,
  AnnotatedElement,
  ArchitectureRecords,
  ArchitectureRelationship,
  ElementStatus,
  FilesystemAccessHandler,
  Origin,
} from './types.ts'

export { acceptGhost, type AcceptResult } from './accept.ts'
export { reconcileScanObservations } from './scan-reconciler.ts'

/** The map word for a lifecycle status: drafts are ghosts, everything stable was observed. */
function originOf(status: ElementStatus): Origin {
  return status === 'draft' ? 'draft' : 'observed'
}

function withDirectChildren(elements: AnnotatedElement[]): AnnotatedElement[] {
  const childrenByParent = new Map<string, string[]>()

  for (const element of elements) {
    if (element.parent === null) continue
    const children = childrenByParent.get(element.parent) ?? []
    children.push(element.representationId)
    childrenByParent.set(element.parent, children)
  }

  return elements.map(element => ({
    ...element,
    children: (childrenByParent.get(element.representationId) ?? []).sort(),
  }))
}

/** File footprint counts come from durable interactions, not a persisted analysis graph. */
function connectionCounts(relationships: readonly ArchitectureRelationship[]): Map<string, { dependencies: number; dependents: number }> {
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  for (const relationship of relationships) {
    for (const connection of relationship.connections) {
      const targets = outgoing.get(connection.source) ?? new Set<string>()
      targets.add(connection.target)
      outgoing.set(connection.source, targets)
      const sources = incoming.get(connection.target) ?? new Set<string>()
      sources.add(connection.source)
      incoming.set(connection.target, sources)
    }
  }
  return new Map([...new Set([...outgoing.keys(), ...incoming.keys()])].map(file => [file, {
    dependencies: outgoing.get(file)?.size ?? 0, dependents: incoming.get(file)?.size ?? 0,
  }]))
}

export function annotateArchitecture(
  records: ArchitectureRecords,
): AnnotatedArchitectureModel {
  const model = buildArchitectureModel(records.documents)
  const counts = connectionCounts(model.relationships)
  const byId = new Map(model.elements.map(element => [element.id, element]))
  const documents = new Map(records.documents.map(document => [document.sourceFilename, document]))
  const authored = model.relationships.filter(relationship =>
    relationship.connections.some(connection => connection.authored))
  const elements = model.elements.map<AnnotatedElement>(element => ({
    representationId: element.id,
    id: element.id,
    kind: element.kind,
    title: element.title,
    ...(element.description === undefined ? {} : { description: element.description }),
    overview: element.overview,
    parent: element.parentId,
    children: [],
    external: element.external,
    ...(element.group === undefined ? {} : { group: element.group }),
    ...(element.technology === undefined ? {} : { technology: element.technology }),
    code: element.code.map(reference => ({ ...reference, ...(counts.get(reference.file) ?? { dependencies: 0, dependents: 0 }) })),
    movable: moveBlocker(element, authored, documents.get(element.sourceFilename)!.body) === undefined,
    origin: originOf(element.status),
    ...(element.draft === undefined ? {} : { draft: element.draft }),
  }))

  return {
    flows: resolveFlows(records.flows, model),
    drafts: records.drafts.map(document => draftRecordOf(document).id).sort(),
    elements: withDirectChildren(elements),
    relationships: model.relationships.map((relationship, index) => {
      const source = byId.get(relationship.sourceId)!
      return {
        id: `relationship:${index}`,
        source: relationship.sourceId,
        target: relationship.targetId,
        connections: relationship.connections,
        description: relationship.description,
        technology: relationship.technology,
        origin: originOf(relationship.status),
        ...(source.draft === undefined ? {} : { draft: source.draft }),
      }
    }),
  }
}

/** Measures each code file and its element total; an unreadable file counts 0. */
async function attachCodeLines(
  repositoryRoot: string,
  elements: AnnotatedElement[],
): Promise<void> {
  const files = new Set(elements.flatMap(element => element.code.map(ref => ref.file)))
  const lineCounts = new Map<string, number>()
  await Promise.all([...files].map(async file => {
    try {
      const text = await readFile(path.join(repositoryRoot, file), 'utf8')
      lineCounts.set(file, text.split('\n').length)
    } catch {
      lineCounts.set(file, 0)
    }
  }))
  for (const element of elements) {
    element.code = element.code.map(reference => ({
      ...reference,
      lines: lineCounts.get(reference.file) ?? 0,
    }))
    const own = new Set(element.code.map(ref => ref.file))
    element.codeLines = [...own].reduce((total, file) => total + (lineCounts.get(file) ?? 0), 0)
  }
}

export async function loadAnnotatedArchitecture(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<AnnotatedArchitectureModel> {
  const model = annotateArchitecture(await loadArchitecture(repositoryRoot, options))
  await attachCodeLines(repositoryRoot, model.elements)
  const findings = architectureFindingsFor(repositoryRoot)
  return findings.length === 0 ? model : { ...model, findings }
}
