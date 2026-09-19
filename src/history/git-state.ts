import { diffLines } from 'diff'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { runGit } from './revisions.ts'

import type { GitState, GitRange } from '@groma/revision-source'
export type { GitState, GitRange } from '@groma/revision-source'
export interface GitFileChange {
  file: string
  previousFile?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  binary: boolean
  additions?: number
  deletions?: number
}

/** Resolve before using a revision as an argument or persisting a view identity. */
export async function resolveCommit(root: string, ref: string): Promise<string> {
  return (await runGit(['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'], root)).trim()
}

export async function resolveRange(root: string, range: GitRange): Promise<GitRange> {
  return {
    base: await resolveCommit(root, range.base),
    target: range.target.kind === 'working-tree' ? range.target
      : { kind: 'commit', sha: await resolveCommit(root, range.target.sha) },
  }
}

function pathsFromStatus(output: string): GitFileChange[] {
  const fields = output.split('\0')
  const files: GitFileChange[] = []
  for (let index = 0; index < fields.length - 1;) {
    const code = fields[index++]!
    const first = fields[index++]!
    const renamed = code.startsWith('R')
    const file = renamed ? fields[index++]! : first
    files.push({
      file, ...(renamed ? { previousFile: first } : {}),
      status: renamed ? 'renamed' : code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified',
      binary: false,
    })
  }
  return files
}

function addCounts(files: GitFileChange[], output: string): void {
  const fields = output.split('\0')
  for (let index = 0; index < fields.length - 1; index++) {
    const record = fields[index]!
    const firstTab = record.indexOf('\t')
    const secondTab = record.indexOf('\t', firstTab + 1)
    const additions = record.slice(0, firstTab)
    const deletions = record.slice(firstTab + 1, secondTab)
    let file = record.slice(secondTab + 1)
    if (file === '') { index += 2; file = fields[index]! }
    const change = files.find(candidate => candidate.file === file)
    if (change === undefined) continue
    change.binary = additions === '-'
    if (!change.binary) {
      change.additions = Number(additions)
      change.deletions = Number(deletions)
    }
  }
}

/** An untracked path may still exist in the base after an index-only deletion. */
async function untrackedChange(root: string, base: string, file: string): Promise<GitFileChange | undefined> {
  const before = await readStateText(root, { kind: 'commit', sha: base }, file)
  const after = await readFile(path.join(root, file), 'utf8')
  if (before === after) return undefined
  const binary = before?.includes('\0') === true || after.includes('\0')
  const counts = { additions: 0, deletions: 0 }
  if (!binary) for (const part of diffLines(before ?? '', after)) {
    if (part.added) counts.additions += part.count
    if (part.removed) counts.deletions += part.count
  }
  return { file, status: before === undefined ? 'added' : 'modified', binary, ...(binary ? {} : counts) }
}

/** Direct tree-to-tree, or committed tree to the net index/worktree contents. */
export async function readGitChanges(root: string, range: GitRange): Promise<GitFileChange[]> {
  const refs = [range.base, ...(range.target.kind === 'commit' ? [range.target.sha] : [])]
  const [names, counts] = await Promise.all([
    runGit(['diff', '--no-ext-diff', '--name-status', '-z', '--find-renames', ...refs, '--'], root),
    runGit(['diff', '--no-ext-diff', '--numstat', '-z', '--find-renames', ...refs, '--'], root),
  ])
  const files = pathsFromStatus(names)
  addCounts(files, counts)
  if (range.target.kind === 'working-tree') {
    const untracked = (await runGit(['ls-files', '--others', '--exclude-standard', '-z'], root)).split('\0').filter(Boolean)
    for (const file of untracked) {
      const index = files.findIndex(change => change.file === file)
      if (index !== -1) files.splice(index, 1)
      const change = await untrackedChange(root, range.base, file)
      if (change) files.push(change)
    }
  }
  return files.sort((a, b) => a.file.localeCompare(b.file))
}

export async function readStateText(root: string, state: GitState, file: string): Promise<string | undefined> {
  if (state.kind === 'commit') {
    // ls-tree distinguishes a missing path from an unreadable commit.
    const exists = await runGit(['ls-tree', '-z', state.sha, '--', file], root)
    return exists === '' ? undefined : runGit(['show', state.sha + ':' + file], root)
  }
  try { return await readFile(path.join(root, file), 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}
