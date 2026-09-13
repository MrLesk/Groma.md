import { architectureFindingsFor, formatArchitectureFindings } from './architecture-findings.ts'
import { reconcileScanObservations } from './core.ts'
import { loadScannerRegistry } from './scanner/registry.ts'
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
  return [formatScanSummary(summary), ...diagnostics, ...conflicts, ...findings].join('\n')
}

export async function scanRepository(
  repositoryRoot: string,
): Promise<ScanSummary> {
  const registry = await loadScannerRegistry(repositoryRoot)
  const observations = await registry.collectObservations(repositoryRoot)
  return reconcileScanObservations(repositoryRoot, observations)
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
    async onObservations(observations) {
      const summary = await reconcileScanObservations(repositoryRoot, observations)
      await options.onFold?.(summary)
    },
    onError: options.onError,
  })
}
