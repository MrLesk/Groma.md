import { loadArchitecture } from '../../architecture-reader.ts'
import { buildArchitectureModel } from '../../architecture-model.ts'
import { configuredScannerModules } from '../../scanner/modules/inventory.ts'
import { scanRepository, watchScan } from '../../scanner.ts'

/** Incomplete source refresh must not replace the saved architecture a viewer opened. */
export async function canRefreshViewerSources(root: string): Promise<boolean> {
  const modules = await configuredScannerModules(root)
  if (!modules.length || modules.some(module => module.status !== 'found')) return false
  const available = new Set(modules.map(module => module.id))
  const model = buildArchitectureModel((await loadArchitecture(root)).documents)
  return model.elements.every(element => element.code.every(reference => available.has(reference.scanner)))
}

export async function scanForViewer(root: string): Promise<void> {
  if (await canRefreshViewerSources(root)) await scanRepository(root)
}

export async function watchViewerSources(root: string, options: Parameters<typeof watchScan>[1]) {
  if (await canRefreshViewerSources(root)) return watchScan(root, options)
  return undefined
}
