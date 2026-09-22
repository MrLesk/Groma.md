import type { CodeFile, SourceReference } from '@groma/scanner'
import { configuredScannerModules, type FoundScannerModule } from '../../scanner/modules/inventory.ts'
import { importScanner } from '../../scanner/registry.ts'
import { withGitRevision } from '../../history/revisions.ts'
import type { ArchitectureGraph, CodeReference } from '../../types.ts'
export type { CodeDeclaration, CodeFile, CodeSymbol, CodeVisibility } from '@groma/scanner'

interface OutlineRequest {
  /** The configured scanner that outlines the file. */
  scanner?: string
  reference: SourceReference
}

/**
 * One request per Code file, in Code order. A file several scanners own, such as an Angular source that
 * TypeScript also owns, is outlined once: by the lowest configured scanner id among its links, with the
 * symbols of all its links.
 */
function outlineRequests(code: readonly CodeReference[], scannerIds: ReadonlySet<string>): OutlineRequest[] {
  const requests = new Map<string, OutlineRequest>()
  for (const link of code) {
    const request = requests.get(link.file) ?? { reference: { file: link.file, symbols: [] } }
    const { symbols } = request.reference
    if (link.symbol !== undefined && !symbols.includes(link.symbol)) symbols.push(link.symbol)
    if (scannerIds.has(link.scanner) && (request.scanner === undefined || link.scanner < request.scanner)) {
      request.scanner = link.scanner
    }
    requests.set(link.file, request)
  }
  return [...requests.values()]
}

/** Ask the configured scanners for the outline of each file in the component's Code, in Code order. */
export async function readCodeStructure(
  repositoryRoot: string,
  world: ArchitectureGraph,
  revision: string | null,
  elementId: string,
): Promise<CodeFile[] | undefined> {
  const load = (root: string) => readSnapshotCodeStructure(repositoryRoot, root, world, elementId)
  return revision === null ? load(repositoryRoot) : withGitRevision(repositoryRoot, revision, load)
}

/** Installed scanners belong to the repository; their source input can be an already-open Git snapshot. */
export async function readSnapshotCodeStructure(
  repositoryRoot: string,
  snapshotRoot: string,
  world: ArchitectureGraph,
  elementId: string,
): Promise<CodeFile[] | undefined> {
  const element = world.elements.find(candidate => (
    candidate.kind === 'component' && candidate.representationId === elementId
  ))
  if (element === undefined) return undefined
  const modules = (await configuredScannerModules(repositoryRoot))
    .filter((module): module is FoundScannerModule => module.status === 'found')
  const requests = outlineRequests(element.code, new Set(modules.map(module => module.id)))
  const order = requests.map(request => request.reference.file)
  const files = await Promise.all(modules.map(async module => {
    const references = requests.filter(request => request.scanner === module.id).map(request => request.reference)
    if (references.length === 0) return []
    // A scanner that cannot load or outline here, such as one missing its worker, contributes no outline, like one without the hook.
    try {
      const scanner = await importScanner(module.entry, module.id)
      return await scanner.readCodeStructure?.(snapshotRoot, references, module.settings) ?? []
    } catch {
      return []
    }
  }))
  return files.flat().sort((left, right) => order.indexOf(left.file) - order.indexOf(right.file))
}
