import type { CodeFile, SourceReference } from '@groma/scanner'
import { configuredScannerModules, type FoundScannerModule } from '../../scanner/modules/inventory.ts'
import { importScanner } from '../../scanner/registry.ts'
import { withGitRevision } from '../../history/revisions.ts'
import type { ArchitectureGraph } from '../../types.ts'
export type { CodeDeclaration, CodeFile } from '@groma/scanner'

/** Ask configured scanners for the selected component's source outline. */
export async function readCodeStructure(
  repositoryRoot: string,
  world: ArchitectureGraph,
  revision: string | null,
  elementId: string,
): Promise<CodeFile[] | undefined> {
  const element = world.elements.find(candidate => (
    candidate.kind === 'component' && candidate.representationId === elementId
  ))
  if (element === undefined) return undefined
  const modules = await configuredScannerModules(repositoryRoot)
  const providers = await Promise.all(modules.filter((module): module is FoundScannerModule => (
    module.status === 'found' && element.code.some(reference => reference.scanner === module.id)
  )).map(async module => {
    const scanner = await importScanner(module.entry, module.id)
    const references = new Map<string, SourceReference>()
    for (const reference of element.code.filter(reference => reference.scanner === module.id)) {
      const found = references.get(reference.file) ?? { file: reference.file, symbols: [] }
      if (reference.symbol !== undefined && !found.symbols.includes(reference.symbol)) found.symbols.push(reference.symbol)
      references.set(reference.file, found)
    }
    return { scanner, references: [...references.values()], settings: module.settings }
  }))
  const load = async (root: string): Promise<CodeFile[]> => {
    const files = await Promise.all(providers.map(({ scanner, references, settings }) => (
      scanner.readCodeStructure?.(root, references, settings) ?? []
    )))
    return files.flat()
  }
  return revision === null ? load(repositoryRoot) : withGitRevision(repositoryRoot, revision, load)
}
