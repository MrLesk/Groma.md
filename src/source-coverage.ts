import ignore from 'ignore'

import { repositoryListing } from './repository-listing.ts'
import { readScannerConfig } from './scanner/modules/config.ts'
import { loadScannerRegistry } from './scanner/registry.ts'

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
  if (!(await repositoryListing(repositoryRoot)).includes(file)) return `unknown target: ${file}; not a repository file`
  const excluded = excludingPattern((await readScannerConfig(repositoryRoot)).exclude ?? [], file)
  if (excluded !== undefined) return `no owner: ${file}; excluded by scanners.json pattern ${excluded}`
  const registry = await loadScannerRegistry(repositoryRoot)
  const { readers, failures } = await registry.readersOfFile(repositoryRoot, file)
  const reasons = [
    ...(readers.length > 0 ? [`read by ${readers.join(', ')} and waiting for a scan, so run groma scan`] : []),
    ...failures.map(({ scanner, message }) => `${scanner} could not list its sources: ${message}`),
  ]
  return `no owner: ${file}; ${reasons.length > 0 ? reasons.join('; ') : 'no enabled scanner reads it'}`
}
