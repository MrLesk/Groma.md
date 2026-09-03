import { structuredPatch } from 'diff'

export type TaskFileStatus = 'added' | 'deleted' | 'modified' | 'unchanged'
export type TaskDiffLineKind = 'added' | 'context' | 'removed'

export interface TaskDiffLine {
  kind: TaskDiffLineKind
  oldLine?: number
  newLine?: number
  text: string
}

export interface TaskDiffHunk {
  header: string
  lines: TaskDiffLine[]
}

export interface TaskFileDiff {
  file: string
  status: TaskFileStatus
  shared: boolean
  additions: number
  deletions: number
  hunks: TaskDiffHunk[]
}

function statusOf(before: string | undefined, after: string | undefined): TaskFileStatus {
  if (before === undefined) return after === undefined ? 'unchanged' : 'added'
  if (after === undefined) return 'deleted'
  return before === after ? 'unchanged' : 'modified'
}

function projectHunk(hunk: {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}): TaskDiffHunk {
  let oldLine = hunk.oldStart
  let newLine = hunk.newStart
  const lines: TaskDiffLine[] = []
  for (const raw of hunk.lines) {
    const marker = raw[0]
    if (marker === '+') {
      lines.push({ kind: 'added', newLine, text: raw.slice(1) })
      newLine += 1
    } else if (marker === '-') {
      lines.push({ kind: 'removed', oldLine, text: raw.slice(1) })
      oldLine += 1
    } else if (marker === ' ') {
      lines.push({ kind: 'context', oldLine, newLine, text: raw.slice(1) })
      oldLine += 1
      newLine += 1
    }
  }
  return {
    header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    lines,
  }
}

/** Projects two file versions into the small unified-diff shape the browser needs. */
export function projectTaskFileDiff(
  file: string,
  before: string | undefined,
  after: string | undefined,
  shared: boolean,
): TaskFileDiff {
  const status = statusOf(before, after)
  const patch = structuredPatch(file, file, before ?? '', after ?? '', undefined, undefined, {
    context: 3,
    stripTrailingCr: true,
  })
  const hunks = status === 'unchanged' ? [] : patch.hunks.map(projectHunk)
  const lines = hunks.flatMap(hunk => hunk.lines)
  return {
    file,
    status,
    shared,
    additions: lines.filter(line => line.kind === 'added').length,
    deletions: lines.filter(line => line.kind === 'removed').length,
    hunks,
  }
}
