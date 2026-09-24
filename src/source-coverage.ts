import { repositoryListing } from './repository-listing.ts'
import { exclusion, exclusionPatterns, readScannerConfig } from './scanner/modules/config.ts'
import { loadScannerRegistry } from './scanner/registry.ts'

/**
 * The combined list decides, because a later negation can restore a file an earlier pattern hid.
 * The answer then names the last pattern that selected it, which is the one a reader must change.
 */
function excludingPattern(patterns: readonly string[], file: string): string | undefined {
  if (!exclusion(patterns)(file)) return undefined
  return [...patterns].reverse().find(pattern => !pattern.startsWith('!') && exclusion([pattern])(file))
}

/**
 * Why a file has no architecture owner: it is not in the repository, a configured pattern hides it,
 * no enabled scanner reads it, or it waits for a scan by the scanners that read it, being new or detached.
 * A reader whose exclusions hide the file is named with the hiding pattern, and a scanner whose listing fails
 * with its error, beside the other scanners' answer.
 */
export async function missingOwnerReason(repositoryRoot: string, file: string): Promise<string> {
  const config = await readScannerConfig(repositoryRoot)
  if (!(await repositoryListing(repositoryRoot, config.useGitignore ?? true)).includes(file)) {
    return `unknown target: ${file}; not a repository file`
  }
  const hidingPattern = (scanner: string) => excludingPattern(exclusionPatterns(config, scanner), file)
  const globalPattern = excludingPattern(config.exclude ?? [], file)
  // A scanner's own `!pattern` can restore the file, so the global pattern answers only when no scanner keeps it.
  if (globalPattern !== undefined && config.scanners.every(scanner => hidingPattern(scanner.id) !== undefined)) {
    return `no owner: ${file}; excluded by scanners.json pattern ${globalPattern}`
  }
  const registry = await loadScannerRegistry(repositoryRoot)
  const { readers, failures } = await registry.readersOfFile(repositoryRoot, file)
  const readerPatterns = readers.map(scanner => ({ scanner, pattern: hidingPattern(scanner) }))
  const waiting = readerPatterns.filter(({ pattern }) => pattern === undefined).map(({ scanner }) => scanner)
  const reasons = [
    ...(waiting.length > 0 ? [`read by ${waiting.join(', ')} and waiting for a scan, so run groma scan`] : []),
    ...readerPatterns.flatMap(({ scanner, pattern }) => pattern === undefined ? [] : [`excluded for ${scanner} by scanners.json pattern ${pattern}`]),
    ...failures.map(({ scanner, message }) => `${scanner} could not list its sources: ${message}`),
  ]
  return `no owner: ${file}; ${reasons.length > 0 ? reasons.join('; ') : 'no enabled scanner reads it'}`
}
