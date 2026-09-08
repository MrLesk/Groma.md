import type { ScannerRecommendation } from './catalog.ts'
import { discoverScanners, formatDiscovery, type ScannerDiscovery } from './discovery.ts'
import { addScanner, type ScannerInstallOptions } from './inventory.ts'
import { checkScannerReadiness, formatReadiness, requireScannerReadiness } from './readiness.ts'

export interface ScannerSetupUi {
  note(message: string, title: string): void
  selectScanners(candidates: ScannerRecommendation[]): Promise<string[] | undefined>
}

export function installableScanners(proposal: ScannerDiscovery): ScannerRecommendation[] {
  return proposal.recommendations.filter(item => item.status === 'installable' && item.installSource !== undefined)
}

/** Selection contains additions only. Existing enabled scanners are retained. */
export async function installSelectedScanners(
  root: string,
  proposal: ScannerDiscovery,
  selected: readonly string[],
  options: ScannerInstallOptions = {},
): Promise<void> {
  const candidates = installableScanners(proposal)
  const sources = [...new Set(selected)].map(id => {
    const candidate = candidates.find(item => item.id === id)
    if (candidate === undefined) throw new Error(`Scanner ${id} is not an installable recommendation.`)
    return candidate.installSource!
  })
  for (const source of sources) await addScanner(root, source, options)
}

/** One proposal is reviewed before installation; noninteractive callers only receive the report. */
export async function setupScanners(
  root: string,
  interactive: boolean,
  ui: ScannerSetupUi,
  output: (message: string) => void,
): Promise<boolean> {
  const proposal = await discoverScanners(root)
  const report = (message: string, title: string) => interactive ? ui.note(message, title) : output(message)
  report(formatDiscovery(proposal), 'Project scanners')
  if (interactive) {
    const candidates = installableScanners(proposal)
    const selected = candidates.length ? await ui.selectScanners(candidates) : []
    if (selected === undefined) return false
    await installSelectedScanners(root, proposal, selected)
  }
  const readiness = await checkScannerReadiness(root)
  report(formatReadiness(readiness), 'Project readiness')
  requireScannerReadiness(readiness)
  return true
}
