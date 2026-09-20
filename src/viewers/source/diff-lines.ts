import { structuredPatch } from 'diff'

export type FileStatus = 'added' | 'removed' | 'modified' | 'unchanged'
export type DiffLineKind = 'added' | 'context' | 'removed'

export interface DiffLine {
  kind: DiffLineKind
  oldLine?: number
  newLine?: number
  text: string
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface FileDiff {
  file: string
  status: FileStatus
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

function statusOf(before: string | undefined, after: string | undefined): FileStatus {
  if (before === undefined) return after === undefined ? 'unchanged' : 'added'
  if (after === undefined) return 'removed'
  return before === after ? 'unchanged' : 'modified'
}

function projectHunk(hunk: {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}): DiffHunk {
  let oldLine = hunk.oldStart
  let newLine = hunk.newStart
  const lines: DiffLine[] = []
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
export function projectFileDiff(
  file: string,
  before: string | undefined,
  after: string | undefined,
): FileDiff {
  const status = statusOf(before, after)
  if (status === 'unchanged') return { file, status, additions: 0, deletions: 0, hunks: [] }
  const patch = structuredPatch(file, file, before ?? '', after ?? '', undefined, undefined, {
    context: 3,
    stripTrailingCr: true,
  })
  const hunks = patch.hunks.map(projectHunk)
  const lines = hunks.flatMap(hunk => hunk.lines)
  return {
    file,
    status,
    additions: lines.filter(line => line.kind === 'added').length,
    deletions: lines.filter(line => line.kind === 'removed').length,
    hunks,
  }
}
