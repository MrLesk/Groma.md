import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { readDocument, withStatus, writeDocument } from './markdown-emitter.ts'

export type AcceptResult = 'accepted' | 'unmatched' | 'not-draft'

/** Flips a scan-matched ghost to stable in place; the file and its draft tag stay where they are. */
export async function acceptGhost(
  repositoryRoot: string,
  id: string,
): Promise<AcceptResult> {
  const model = buildArchitectureModel((await loadArchitecture(repositoryRoot)).documents)
  const element = model.elements.find(candidate => candidate.id === id)
  if (element === undefined || element.status !== 'draft') return 'not-draft'
  if (element.code.length === 0) return 'unmatched'
  const source = await readDocument(repositoryRoot, element.sourceFilename)
  await writeDocument(repositoryRoot, element.sourceFilename, withStatus(source, 'stable'))
  return 'accepted'
}
