import { repositoryListing } from '../../repository-listing.ts'
import { exclusion, exclusionPatterns, inclusion, type ScannerConfig } from './config.ts'

/** Which repository files a scanner reads: those its include list names and no exclusion names. */
export interface ScannerSelection {
  included(file: string): boolean
  excluded(file: string): boolean
}

/** The selection of a scanner with these lists, such as the defaults its package declares. */
export function scannerSelection(lists: { include: readonly string[]; exclude?: readonly string[] }): ScannerSelection {
  return { included: inclusion(lists.include), excluded: exclusion(lists.exclude ?? []) }
}

/** A configured scanner's selection: its include list, then the global exclusions followed by its own. */
export function configuredSelection(config: ScannerConfig, scanner: string): ScannerSelection {
  return scannerSelection({
    include: config.scanners.find(entry => entry.id === scanner)?.include ?? [],
    exclude: exclusionPatterns(config, scanner),
  })
}

/** The files a selection reads from a repository listing. */
export function selectedFiles(listing: readonly string[], selection: ScannerSelection): string[] {
  return listing.filter(file => selection.included(file) && !selection.excluded(file))
}

/** The files a scanner with these lists reads in a repository, as Groma hands them to its scan. */
export async function scannerFiles(
  root: string, lists: { include: readonly string[]; exclude?: readonly string[] }, useGitignore = true,
): Promise<string[]> {
  return selectedFiles(await repositoryListing(root, useGitignore), scannerSelection(lists))
}
