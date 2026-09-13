import { architectureFindingsFor, formatArchitectureFindings } from './architecture-findings.ts'
import { reconcileScanObservations } from './core.ts'
import { loadScannerRegistry, type ScanBatch } from './scanner/registry.ts'
import { watchObservations } from './scanner/source-watch.ts'
import type { ScanSummary } from './types.ts'

export function formatScanSummary(summary: ScanSummary): string {
  const counts = `created ${summary.created}, refreshed ${summary.refreshed}, matched ${summary.matched}`
  const findings = summary.findings ? `, findings ${summary.findings}` : ''
  const conflicts = summary.evidenceConflicts?.length ? `, evidence conflicts ${summary.evidenceConflicts.length}` : ''
  return `${counts}${findings}${conflicts}`
}

export function formatScanReport(repositoryRoot: string, summary: ScanSummary): string {
  const findings = formatArchitectureFindings(architectureFindingsFor(repositoryRoot))
  const conflicts = summary.evidenceConflicts?.map(conflict => `${conflict.code}: ${conflict.message}`) ?? []
  const diagnostics = summary.scannerDiagnostics?.map(({ scanner, diagnostic }) => {
    const location = [diagnostic.file, diagnostic.line].filter(value => value !== undefined).join(':')
    const message = location ? `${location}: ${diagnostic.message}` : diagnostic.message
    return `${scanner.id} · ${diagnostic.severity} · ${diagnostic.code}: ${message}`
  }) ?? []
  const failures = summary.scannerFailures?.map(failure => `${failure.message} (saved scanner data kept)`) ?? []
  return [formatScanSummary(summary), ...failures, ...diagnostics, ...conflicts, ...findings].join('\n')
}

async function reconcileBatch(root: string, { observations, failures }: ScanBatch): Promise<ScanSummary> {
  const summary = await reconcileScanObservations(root, observations)
  if (failures.length) summary.scannerFailures = failures.map(({ scanner, message }) => ({ scanner, message }))
  return summary
}

export async function scanRepository(
  repositoryRoot: string,
): Promise<ScanSummary> {
  const registry = await loadScannerRegistry(repositoryRoot)
  return reconcileBatch(repositoryRoot, await registry.collectObservations(repositoryRoot))
}

export async function watchScan(
  repositoryRoot: string,
  options: {
    onFold?: (summary: ScanSummary) => void | Promise<void>
    onError?: (error: unknown) => void
  } = {},
): Promise<{ close(): Promise<void> }> {
  const registry = await loadScannerRegistry(repositoryRoot)
  if (!registry.scannerIds.length) return { async close() {} }
  return watchObservations(repositoryRoot, registry, {
    async onObservations(batch) {
      const summary = await reconcileBatch(repositoryRoot, batch)
      await options.onFold?.(summary)
    },
    onError: options.onError,
  })
}
