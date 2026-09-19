import { loadAnnotatedArchitecture } from '../core.ts'
import { loadProjectProfile, type ProjectProfile } from '../project-profile.ts'
import { withGitRevision } from '../history/revisions.ts'
import { readGitChanges, readStateText, resolveRange, type GitRange } from '../history/git-state.ts'
import { projectFileDiff, type FileDiff } from '../viewers/source/diff-lines.ts'
import type { Comparison, ChangedFile } from './model.ts'
import { projectChanges } from './project.ts'

export interface LoadedComparison extends Comparison {
  projects: { before: ProjectProfile; after: ProjectProfile }
}

async function readSnapshot(root: string) {
  const [world, project] = await Promise.all([loadAnnotatedArchitecture(root), loadProjectProfile(root)])
  if (project === undefined) throw new Error('Missing project profile')
  return { world, project }
}

async function readCommitSnapshot(root: string, sha: string) {
  try {
    return await withGitRevision(root, sha, readSnapshot)
  } catch (error) {
    throw new Error('Architecture snapshot unavailable at ' + sha.slice(0, 8) + ': ' + (error instanceof Error ? error.message : String(error)))
  }
}

export async function readComparison(root: string, input: GitRange): Promise<LoadedComparison> {
  const range = await resolveRange(root, input)
  const [before, after, files] = await Promise.all([
    readCommitSnapshot(root, range.base),
    range.target.kind === 'commit' ? readCommitSnapshot(root, range.target.sha) : readSnapshot(root),
    readGitChanges(root, range),
  ])
  return { ...projectChanges(range, before.world, after.world, files), projects: { before: before.project, after: after.project } }
}

/** The opened file uses the already-applied range and rename paths. */
export async function readChangeFile(root: string, range: GitRange, file: ChangedFile): Promise<FileDiff> {
  const [before, after] = await Promise.all([
    readStateText(root, { kind: 'commit', sha: range.base }, file.previousFile ?? file.file),
    readStateText(root, range.target, file.file),
  ])
  return { ...projectFileDiff(file.file, before, after, file.shared ?? false), ...(file.previousFile ? { previousFile: file.previousFile } : {}) }
}
