import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../core.ts'
import { loadProjectProfile } from '../project-profile.ts'
import type { GitRevision } from './revisions.ts'
import { withGitRevision } from './revisions.ts'
import { compareArchitecture, ownedFiles, type SourceTexts } from './comparison.ts'

/** A working tree stays in place; a commit is read in an isolated temporary archive. */
export function atRevision<T>(root: string, revision: GitRevision | null, read: (root: string) => Promise<T>): Promise<T> {
  return revision === null ? read(root) : withGitRevision(root, revision.id, read)
}

export async function readSnapshot(root: string) {
  const [world, project] = await Promise.all([loadAnnotatedArchitecture(root), loadProjectProfile(root)])
  if (project === undefined) throw new Error('No Groma architecture in this revision')
  return { world, project }
}

/** Missing files are meaningful deletions; other read failures remain visible. */
export async function readSourceTexts(root: string, files: string[]): Promise<SourceTexts> {
  return Object.fromEntries(await Promise.all(files.map(async file => {
    try { return [file, await readFile(path.join(root, file), 'utf8')] }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [file, undefined]
      throw error
    }
  })))
}

/** Read both complete roots while their archives exist, including files no longer owned on one side. */
export function readComparison(root: string, from: GitRevision | null, to: GitRevision | null) {
  return atRevision(root, from, beforeRoot => atRevision(root, to, async afterRoot => {
    const [before, after] = await Promise.all([readSnapshot(beforeRoot), readSnapshot(afterRoot)])
    const files = [...new Set([...ownedFiles(before.world), ...ownedFiles(after.world)])]
    const [oldSources, newSources] = await Promise.all([readSourceTexts(beforeRoot, files), readSourceTexts(afterRoot, files)])
    const { world, components, relationships } = compareArchitecture(before.world, after.world, oldSources, newSources)
    return { project: after.project, world, comparison: { from, components, relationships } }
  }))
}
