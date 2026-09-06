import path from 'node:path'
import { buildArchitectureModel, draftRecordOf } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { annotateArchitecture } from './core.ts'
import {
  readDocument,
  removeDocument,
  withGromaField,
  withoutRelationship,
  writeDocument,
} from './markdown-emitter.ts'
import { removeGroup } from './group.ts'
import type { StructuralResult } from './curate.ts'
import { isGroupAddress } from './naming.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import { storedConnections } from './relationship-markdown.ts'
import type { ArchitectureDocument, ArchitectureElement } from './types.ts'
import { removeRelation } from './relation.ts'
import { draftRemovalBlocker, removalBlocker } from './removable.ts'

export interface RemoveInput {
  id: string
  /** The target id of the relationship from id to remove instead of the element itself. */
  relation?: string
  /** With a group address: the members leaving; none dissolves the group. */
  members?: string[]
}

/** Removes a person, an external, a ghost, or a draft record nothing still belongs to; the scanner keeps what it found. */
export async function removeThing(repositoryRoot: string, { id, relation, members }: RemoveInput): Promise<string | StructuralResult> {
  if (relation !== undefined) return removeRelation(repositoryRoot, { source: id, target: relation })
  if (isGroupAddress(id)) return removeGroup(repositoryRoot, { address: id, members })
  const records = await loadArchitecture(repositoryRoot)
  const graph = annotateArchitecture(records)
  const model = buildArchitectureModel(records.documents)
  const flow = graph.flows.find(candidate => candidate.id === id)
  if (flow !== undefined) {
    await removeDocument(repositoryRoot, flow.sourceFilename)
    return id
  }
  const element = model.elements.find(candidate => candidate.id === id)
  if (element !== undefined) {
    const blocker = removalBlocker(graph, id)
    if (blocker !== undefined) throw new Error(blocker)
    await removeOutgoingConnections(repositoryRoot, records.documents, model.elements, element)
    await removeDocument(repositoryRoot, element.sourceFilename)
    return id
  }

  const record = records.drafts.map(draftRecordOf).find(candidate => candidate.id === id)
  if (record === undefined) throw new Error(`unknown id "${id}"`)
  const blocker = draftRemovalBlocker(graph, id)
  if (blocker !== undefined) throw new Error(blocker)
  for (const touched of model.elements.filter(candidate => candidate.draft === id)) {
    const source = await readDocument(repositoryRoot, touched.sourceFilename)
    await writeDocument(repositoryRoot, touched.sourceFilename, withGromaField(source, 'draft', undefined))
  }
  await removeDocument(repositoryRoot, record.sourceFilename)
  return id
}

/** Deleting an allowed element also deletes the authored claims that it owns. */
async function removeOutgoingConnections(
  repositoryRoot: string,
  documents: readonly ArchitectureDocument[],
  elements: readonly ArchitectureElement[],
  element: ArchitectureElement,
): Promise<void> {
  const endpoints = new Set([element.id, ...element.code.map(reference => reference.file)])
  const connections = storedConnections(documents, elements, (_code, filename, message) => {
    throw new Error(`${filename}: ${message}`)
  }).filter(connection => endpoints.has(connection.source))
  if (!connections.length) return
  const filename = GromaFileSystem.open(repositoryRoot).sourceFilename('relationships.md')
  const endpointPath = (value: string) => elements.find(candidate => candidate.id === value)?.sourceFilename ?? value
  const href = (value: string) => path.posix.relative(path.posix.dirname(filename), endpointPath(value))
  let source = await readDocument(repositoryRoot, filename)
  for (const connection of connections) {
    source = withoutRelationship(source, {
      ...connection, sourceHref: href(connection.source), targetHref: href(connection.target),
    })
  }
  await writeDocument(repositoryRoot, filename, source)
}
