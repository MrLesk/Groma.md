import { buildArchitectureModel, draftRecordOf } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { annotateArchitecture } from './core.ts'
import {
  readDocument,
  removeDocument,
  withGromaField,
  writeDocument,
} from './markdown-emitter.ts'
import { removeRelation } from './relation.ts'
import { draftRemovalBlocker, removalBlocker } from './removable.ts'

export interface RemoveInput {
  id: string
  /** The target id of the relationship from id to remove instead of the element itself. */
  relation?: string
}

/** Removes a person, an external, a ghost, or a draft record nothing still belongs to; the scanner keeps what it found. */
export async function removeThing(repositoryRoot: string, { id, relation }: RemoveInput): Promise<string> {
  if (relation !== undefined) return removeRelation(repositoryRoot, { source: id, target: relation })
  const records = await loadArchitecture(repositoryRoot)
  const graph = annotateArchitecture(records)
  const model = buildArchitectureModel(records.documents)
  const element = model.elements.find(candidate => candidate.id === id)
  if (element !== undefined) {
    const blocker = removalBlocker(graph, id)
    if (blocker !== undefined) throw new Error(blocker)
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
