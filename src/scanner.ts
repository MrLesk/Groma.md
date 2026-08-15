import { foldScanResult } from './core.ts'
import { scanTypeScriptSource } from './typescript-scanner.ts'
import type { ScanSummary } from './types.ts'

export function formatScanSummary(summary: ScanSummary): string {
  return `created ${summary.created}, refreshed ${summary.refreshed}, matched ${summary.matched}`
}

export async function scanRepository(
  repositoryRoot: string,
): Promise<ScanSummary> {
  return foldScanResult(repositoryRoot, await scanTypeScriptSource(repositoryRoot))
}
