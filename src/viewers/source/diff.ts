import { currentGitRevision, findGitCommitBySubject, parentGitRevision } from '../../history/revisions.ts'
import { readStateText, readGitChanges, type GitRange } from '../../history/git-state.ts'
import type { WorkItem, WorkSnapshot } from '../../types.ts'
import { projectFileDiff, type FileDiff } from './diff-lines.ts'

export interface TaskDiffPayload {
  taskId: string
  source: { kind: 'commit' | 'working-tree'; base: string; revision: string }
  files: FileDiff[]
}

import { sharedFiles } from '../../work/pins.ts'

/** Task policy chooses versions and scope; comparison owns what those versions changed. */
export async function taskRange(root: string, item: WorkItem, work: WorkSnapshot): Promise<GitRange> {
  if (item.status !== work.statuses.at(-1)) return { base: await currentGitRevision(root), target: { kind: 'working-tree' } }
  const sha = await findGitCommitBySubject(root, item.id + ' - ' + item.title)
  if (sha === undefined) throw new Error('Commit not found for ' + item.id)
  return { base: await parentGitRevision(root, sha), target: { kind: 'commit', sha } }
}

export async function readTaskDiff(root: string, item: WorkItem, work: WorkSnapshot, selectedRange?: GitRange): Promise<TaskDiffPayload> {
  const range = selectedRange ?? await taskRange(root, item, work)
  const shared = sharedFiles(item, work)
  const changed = await readGitChanges(root, range)
  const files: FileDiff[] = []
  for (const recorded of item.modifiedFiles) {
    const change = changed.find(file => file.file === recorded || file.previousFile === recorded)
    const file = change?.file ?? recorded
    if (files.some(value => value.file === file)) continue
    const before = await readStateText(root, { kind: 'commit', sha: range.base }, change?.previousFile ?? file)
    const after = await readStateText(root, range.target, file)
    files.push({ ...projectFileDiff(file, before, after, shared.has(file) || shared.has(recorded)),
      ...(change?.previousFile ? { previousFile: change.previousFile } : {}) })
  }
  return { taskId: item.id, source: {
    kind: range.target.kind, base: range.base,
    revision: range.target.kind === 'commit' ? range.target.sha : range.base,
  }, files }
}
