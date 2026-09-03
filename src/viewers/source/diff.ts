import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  currentGitRevision,
  findGitCommitBySubject,
  parentGitRevision,
  readGitText,
} from '../../history/git.ts'
import type { WorkItem, WorkSnapshot } from '../../types.ts'
import { projectTaskFileDiff, type TaskFileDiff } from './diff-lines.ts'

export interface TaskDiffPayload {
  taskId: string
  source: {
    kind: 'commit' | 'working-tree'
    base: string
    revision: string
  }
  files: TaskFileDiff[]
}

async function workingText(repositoryRoot: string, filename: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(repositoryRoot, filename), 'utf8')
  } catch {
    return undefined
  }
}

function sharedFiles(item: WorkItem, work: WorkSnapshot): Set<string> {
  const terminal = work.statuses.at(-1)
  const otherActive = work.items.filter(candidate => (
    candidate.id !== item.id && candidate.status !== terminal
  ))
  return new Set(otherActive.flatMap(candidate => candidate.modifiedFiles))
}

/** Reads the selected task against one honest Git source without adding data to the boot payload. */
export async function readTaskDiff(
  repositoryRoot: string,
  item: WorkItem,
  work: WorkSnapshot,
): Promise<TaskDiffPayload> {
  const terminal = work.statuses.at(-1)
  const completed = item.status === terminal
  const revision = completed
    ? await findGitCommitBySubject(repositoryRoot, `${item.id} - ${item.title}`)
    : await currentGitRevision(repositoryRoot)
  if (revision === undefined) throw new Error(`Commit not found for ${item.id}`)
  const base = completed ? await parentGitRevision(repositoryRoot, revision) : revision
  const shared = completed ? new Set<string>() : sharedFiles(item, work)
  const files = await Promise.all(item.modifiedFiles.map(async file => {
    const before = await readGitText(repositoryRoot, base, file)
    const after = completed
      ? await readGitText(repositoryRoot, revision, file)
      : await workingText(repositoryRoot, file)
    return projectTaskFileDiff(file, before, after, shared.has(file))
  }))
  return {
    taskId: item.id,
    source: { kind: completed ? 'commit' : 'working-tree', base, revision },
    files,
  }
}
