import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { version as typescriptVersion } from 'typescript'

import {
  createScanObservation,
  type ScanObservation,
} from '@groma/scanner'

import {
  defaultTypeScriptScannerConfig,
  type TypeScriptScannerConfig,
} from './files.ts'
import {
  buildImportGraph,
  fileLabel,
  fileStem,
  packageName,
  type ImportGraph,
  type ImportGraphNode,
} from './graph.ts'
import { displayName, kebabCase } from './naming.ts'

function isPaintFile(file: string, node: ImportGraphNode): boolean {
  const segments = file.split('/')
  return segments.includes('atoms')
    || segments.includes('molecules')
    || segments.includes('organisms')
    || fileStem(file) === 'paint'
    || node.symbols.some(symbol => symbol.name.startsWith('draw'))
}

async function packageBins(repositoryRoot: string): Promise<string[]> {
  try {
    const source = await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
    const bin = (JSON.parse(source) as { bin?: unknown }).bin
    if (typeof bin === 'string') return [bin.replace(/^\.\//, '')]
    if (bin !== null && typeof bin === 'object') {
      return Object.values(bin as Record<string, string>)
        .map(value => value.replace(/^\.\//, ''))
    }
  } catch {
    return []
  }
  return []
}

function includeImportedScopes(
  scopes: Set<string>,
  structuralImports: (file: string) => string[],
  liveImporters: (file: string) => string[],
): void {
  for (const scope of [...scopes]) {
    for (const imported of structuralImports(scope)) {
      if (structuralImports(imported).length === 0) continue
      if (liveImporters(imported).every(importer => scopes.has(importer))) scopes.add(imported)
    }
  }
}

function includeSharedScopes(
  graph: ImportGraph,
  scopes: Set<string>,
  excluded: Set<string>,
  structuralImports: (file: string) => string[],
  liveImporters: (file: string) => string[],
): void {
  let grew = true
  while (grew) {
    grew = false
    for (const node of graph.files) {
      if (excluded.has(node.file) || scopes.has(node.file)) continue
      if (structuralImports(node.file).length === 0) continue
      if (liveImporters(node.file).filter(importer => scopes.has(importer)).length < 2) continue
      scopes.add(node.file)
      grew = true
    }
  }
}

function inferScopeFiles(graph: ImportGraph, bins: string[]): string[] {
  const byFile = new Map(graph.files.map(node => [node.file, node]))
  const excluded = new Set(graph.files.flatMap(node => {
    return fileStem(node.file) === 'types' || isPaintFile(node.file, node)
      ? [node.file]
      : []
  }))
  const structuralImports = (file: string) => {
    return (byFile.get(file)?.imports ?? []).filter(imported => !excluded.has(imported))
  }
  const liveImporters = (file: string) => {
    return (byFile.get(file)?.importedBy ?? []).filter(importer => !excluded.has(importer))
  }
  const roots = graph.files
    .filter(node => node.importedBy.length === 0 && !excluded.has(node.file))
    .sort((left, right) => {
      return structuralImports(right.file).length - structuralImports(left.file).length
        || left.file.localeCompare(right.file)
    })
  const scopes = new Set(bins.filter(file => byFile.has(file)))
  if (scopes.size === 0 && roots[0] !== undefined) scopes.add(roots[0].file)
  includeImportedScopes(scopes, structuralImports, liveImporters)
  includeSharedScopes(graph, scopes, excluded, structuralImports, liveImporters)
  if (scopes.size === 0 && graph.files[0] !== undefined) scopes.add(graph.files[0].file)
  return [...scopes].sort()
}

function commonDirectorySegments(left: string, right: string): number {
  const leftParts = path.posix.dirname(left).split('/')
  const rightParts = path.posix.dirname(right).split('/')
  let count = 0
  while (leftParts[count] !== undefined && leftParts[count] === rightParts[count]) count += 1
  return count
}

function importerScope(
  importedBy: string[],
  byFile: Map<string, ImportGraphNode>,
  scopeSet: Set<string>,
): string | undefined {
  const seen = new Set<string>()
  let frontier = importedBy
  while (frontier.length > 0) {
    const placed = frontier.filter(file => scopeSet.has(file)).sort()[0]
    if (placed !== undefined) return placed
    const next: string[] = []
    for (const file of frontier) {
      if (seen.has(file)) continue
      seen.add(file)
      next.push(...(byFile.get(file)?.importedBy ?? []))
    }
    frontier = next
  }
  return undefined
}

function nearestDirectoryScope(file: string, scopeFiles: string[]): string | undefined {
  return [...scopeFiles].sort((left, right) => {
    return commonDirectorySegments(file, right) - commonDirectorySegments(file, left)
      || left.localeCompare(right)
  })[0]
}

function placementByFile(graph: ImportGraph, scopeFiles: string[]): Map<string, string> {
  const byFile = new Map(graph.files.map(node => [node.file, node]))
  const scopeSet = new Set(scopeFiles)
  const placements = new Map<string, string>()

  for (const node of graph.files) {
    if (scopeSet.has(node.file)) {
      placements.set(node.file, node.file)
      continue
    }
    const placed = importerScope(node.importedBy, byFile, scopeSet)
      ?? nearestDirectoryScope(node.file, scopeFiles)
    if (placed !== undefined) placements.set(node.file, placed)
  }
  return placements
}

function scopeNames(scopeFiles: string[]): Map<string, string> {
  const names = new Map<string, string>()
  const used = new Set<string>()
  for (const file of scopeFiles) {
    let name = fileStem(file) === 'cli' ? 'Cli' : fileLabel(file)
    if (used.has(name)) {
      name = displayName(kebabCase(`${path.posix.basename(path.posix.dirname(file))}-${fileStem(file)}`))
    }
    if (used.has(name)) name = `${name} ${file}`
    used.add(name)
    names.set(file, name)
  }
  return names
}

export async function scanTypeScriptSource(
  repositoryRoot: string,
  config: TypeScriptScannerConfig = defaultTypeScriptScannerConfig,
): Promise<ScanObservation | undefined> {
  const graph = await buildImportGraph(repositoryRoot, config)
  if (graph.files.length === 0) return undefined
  const scopeFiles = inferScopeFiles(graph, await packageBins(repositoryRoot))
  const placements = placementByFile(graph, scopeFiles)
  const names = scopeNames(scopeFiles)
  const scopeId = (file: string) => `scope:${file}`
  const relationships = new Map<string, { source: string; target: string; kind: string }>()

  for (const node of graph.files) {
    const sourcePlacement = placements.get(node.file)
    if (sourcePlacement === undefined) continue
    for (const imported of node.imports) {
      const dependency = {
        source: node.file,
        target: imported,
        kind: 'source-dependency',
      }
      relationships.set(
        `${dependency.source}\0${dependency.target}\0${dependency.kind}`,
        dependency,
      )
      const targetPlacement = placements.get(imported)
      if (targetPlacement === undefined || targetPlacement === sourcePlacement) continue
      const relationship = {
        source: scopeId(sourcePlacement),
        target: scopeId(targetPlacement),
        kind: 'imports',
      }
      relationships.set(
        `${relationship.source}\0${relationship.target}\0${relationship.kind}`,
        relationship,
      )
    }
  }

  const name = await packageName(repositoryRoot)
  return createScanObservation({
    scanner: {
      language: 'typescript',
      engine: 'typescript',
      engineVersion: typescriptVersion,
    },
    root: {
      kind: 'package',
      name,
      file: existsSync(path.join(repositoryRoot, 'package.json')) ? 'package.json' : '.',
    },
    scopes: scopeFiles.map(file => ({ id: scopeId(file), name: names.get(file) ?? fileLabel(file) })),
    files: graph.files.map(node => ({ file: node.file, symbols: node.symbols })),
    placements: [...placements].map(([file, scope]) => ({ file, scope: scopeId(scope) })),
    relationships: [...relationships.values()],
    operations: graph.operations,
    invocations: graph.invocations,
    diagnostics: [],
  })
}
