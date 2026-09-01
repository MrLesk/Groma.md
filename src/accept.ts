import { loadArchitecture } from './architecture-reader.ts'
import { architectureRelative } from './architecture-path.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  readDocument,
  removeDocument,
  withRepresentationStatus,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { requireGromaMapping } from './okf-profile.ts'
import { readCode } from './scan-reconciler.ts'
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
    const document = record.documents.find(entry => {
      return requireGromaMapping(entry.frontmatter, entry.sourceFilename).id === id
    })
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
  const plannedGroma = requireGromaMapping(
    planned.frontmatter,
    planned.sourceFilename,
  )
  if (readCode(plannedGroma.code).length === 0) return 'unmatched'

  const observedPath = GromaFileSystem.open(repositoryRoot).sourceFilename(
    `observed/${architectureRelative(planned.sourceFilename)}`,
  )
  const observed = findDocument(revisions, 'observed', id)
  await writeObservedDocument(
    repositoryRoot,
    observedPath,
    withRepresentationStatus(
      await readDocument(repositoryRoot, planned.sourceFilename),
      'stable',
    ),
  )
  if (observed !== undefined && observed.sourceFilename !== observedPath) {
    await removeDocument(repositoryRoot, observed.sourceFilename)
  }
  await removeDocument(repositoryRoot, planned.sourceFilename)
  return 'accepted'
}
