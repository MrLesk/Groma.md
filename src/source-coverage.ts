import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import ignore from 'ignore'

import { readScannerConfig } from './scanner/modules/config.ts'
import { loadScannerRegistry } from './scanner/registry.ts'

const execute = promisify(execFile)

/** Repository membership is the tracked and unignored listing every scan selects from. */
async function repositoryFileSet(repositoryRoot: string): Promise<Set<string>> {
  const { stdout } = await execute(
    'git', ['-C', repositoryRoot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { maxBuffer: 64 * 1024 * 1024 },
  )
  return new Set(stdout.split('\0').filter(Boolean))
}

/**
 * The combined list decides, because a later negation can restore a file an earlier pattern hid.
 * The answer then names the last pattern that selected it, which is the one a reader must change.
 */
function excludingPattern(patterns: readonly string[], file: string): string | undefined {
  if (!ignore({ ignorecase: false }).add([...patterns]).ignores(file)) return undefined
  return [...patterns].reverse().find(pattern => !pattern.startsWith('!')
    && ignore({ ignorecase: false }).add(pattern).ignores(file))
}

/**
 * Why a file has no architecture owner: it is not in the repository, a configured pattern hides it,
 * no enabled scanner reads it, or it waits for a scan by the scanners that read it, being new or detached.
 * A scanner whose listing fails is named with its error beside the other scanners' answer.
 */
export async function missingOwnerReason(repositoryRoot: string, file: string): Promise<string> {
  if (!(await repositoryFileSet(repositoryRoot)).has(file)) return `unknown target: ${file}; not a repository file`
  const excluded = excludingPattern((await readScannerConfig(repositoryRoot)).exclude ?? [], file)
  if (excluded !== undefined) return `no owner: ${file}; excluded by scanners.json pattern ${excluded}`
  const registry = await loadScannerRegistry(repositoryRoot)
  const { readers, failures } = await registry.readersOfFile(repositoryRoot, file)
  const unlisted = failures.map(({ scanner, message }) => `${scanner} could not list its sources: ${message}`)
  if (readers.length > 0) {
    return `no owner: ${file}; ${[`read by ${readers.join(', ')} and waiting for a scan, so run groma scan`, ...unlisted].join('; ')}`
  }
  return `no owner: ${file}; ${unlisted.length > 0 ? unlisted.join('; ') : 'no enabled scanner reads it'}`
}
