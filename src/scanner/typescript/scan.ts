import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { displayName, kebabCase } from '../../naming.ts'
import {
  createScanObservation,
  type ScanObservation,
} from '../observation.ts'
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

  for (const scope of [...scopes]) {
    for (const imported of structuralImports(scope)) {
      if (structuralImports(imported).length === 0) continue
      if (liveImporters(imported).every(importer => scopes.has(importer))) scopes.add(imported)
    }
  }
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

function placementByFile(graph: ImportGraph, scopeFiles: string[]): Map<string, string> {
  const byFile = new Map(graph.files.map(node => [node.file, node]))
  const scopeSet = new Set(scopeFiles)
  const placements = new Map<string, string>()

  for (const node of graph.files) {
    if (scopeSet.has(node.file)) {
      placements.set(node.file, node.file)
      continue
    }
    const seen = new Set<string>()
    let frontier = [...node.importedBy]
    let placed: string | undefined
    while (frontier.length > 0 && placed === undefined) {
      const hits = frontier.filter(file => scopeSet.has(file)).sort()
      if (hits[0] !== undefined) {
        placed = hits[0]
        break
      }
      const next: string[] = []
      for (const file of frontier) {
        if (seen.has(file)) continue
        seen.add(file)
        next.push(...(byFile.get(file)?.importedBy ?? []))
      }
      frontier = next
    }
    placed ??= [...scopeFiles].sort((left, right) => {
      return commonDirectorySegments(node.file, right) - commonDirectorySegments(node.file, left)
        || left.localeCompare(right)
    })[0]
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
      const targetPlacement = placements.get(imported)
      if (targetPlacement === undefined || targetPlacement === sourcePlacement) continue
      const relationship = {
        source: scopeId(sourcePlacement),
        target: scopeId(targetPlacement),
        kind: 'imports',
      }
      relationships.set(`${relationship.source}\0${relationship.target}`, relationship)
    }
  }

  const name = await packageName(repositoryRoot)
  return createScanObservation({
    scanner: { language: 'typescript', engine: 'groma-source', engineVersion: '1' },
    root: {
      kind: 'package',
      name,
      file: existsSync(path.join(repositoryRoot, 'package.json')) ? 'package.json' : '.',
    },
    scopes: scopeFiles.map(file => ({ id: scopeId(file), name: names.get(file) ?? fileLabel(file) })),
    files: graph.files.map(node => ({ file: node.file, symbols: node.symbols })),
    placements: [...placements].map(([file, scope]) => ({ file, scope: scopeId(scope) })),
    relationships: [...relationships.values()],
    diagnostics: [],
  })
}
