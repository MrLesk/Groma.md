import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { withGitRevision } from '../../../history/git.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import type { WebRevision } from '../payload.ts'

export interface SourcePayload {
  source: string
}

/** Reads only a selected component's exact Code file from the same repository revision as its architecture. */
export async function readSource(
  repositoryRoot: string,
  world: ArchitectureGraph,
  revision: WebRevision | null,
  elementId: string,
  file: string,
): Promise<SourcePayload | undefined> {
  const element = world.elements.find(candidate => (
    candidate.kind === 'component'
    && candidate.representationId === elementId
  ))
  const reference = element?.code.find(candidate => candidate.file === file)
  if (reference === undefined) return undefined

  const load = async (root: string): Promise<SourcePayload> => {
    const source = await readFile(path.join(root, reference.file), 'utf8')
    return { source }
  }
  return revision === null
    ? load(repositoryRoot)
    : withGitRevision(repositoryRoot, revision.id, load)
}
