import { loadArchitecture } from './architecture-reader.ts'
import {
  readDocument,
  removeDocument,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { architectureRelative, readCode } from './scan-reconciler.ts'
import type { ArchitectureDocument, RevisionRecord } from './types.ts'

export type AcceptResult = 'accepted' | 'unmatched' | 'missing'

function findDocument(
  revisions: RevisionRecord[],
  origin: 'observed' | 'planned',
  id: string,
): ArchitectureDocument | undefined {
  const kind = origin === 'planned' ? 'plan' : 'observed'
  for (const record of revisions) {
    if (record.revision.kind !== kind) continue
    const document = record.documents.find(entry => entry.frontmatter.id === id)
    if (document !== undefined) return document
  }
}

export async function acceptGhost(
  repositoryRoot: string,
  id: string,
): Promise<AcceptResult> {
  const revisions = await loadArchitecture(repositoryRoot)
  const planned = findDocument(revisions, 'planned', id)
  if (planned === undefined) return 'missing'
  if (readCode(planned.frontmatter.code).length === 0) return 'unmatched'

  const observedPath = `groma/observed/${architectureRelative(planned.sourceFilename)}`
  const observed = findDocument(revisions, 'observed', id)
  await writeObservedDocument(
    repositoryRoot,
    observedPath,
    await readDocument(repositoryRoot, planned.sourceFilename),
  )
  if (observed !== undefined && observed.sourceFilename !== observedPath) {
    await removeDocument(repositoryRoot, observed.sourceFilename)
  }
  await removeDocument(repositoryRoot, planned.sourceFilename)
  return 'accepted'
}
