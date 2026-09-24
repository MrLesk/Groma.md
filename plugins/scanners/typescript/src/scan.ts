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
import { withJavaScriptEntries } from '../../entry-points/javascript.ts'

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
  const declared = new Set(bins)
  // Entry candidates may own helpers; a helper's dependencies or callers do not make it an entry.
  const scopes = new Set(graph.files
    .filter(node => declared.has(node.file) || node.importedBy.length === 0)
    .map(node => node.file))
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
  const name = await packageName(repositoryRoot)
  return withJavaScriptEntries(repositoryRoot, createScanObservation({
    scanner: {
      id: 'typescript',
      technology: 'typescript',
      engine: 'typescript-sdk',
      engineVersion: typescriptVersion,
    },
    roots: [
      { id: 'package', kind: 'package', name,
        ...(existsSync(path.join(repositoryRoot, 'package.json')) ? { file: 'package.json' } : {}) },
      ...scopeFiles.map(file => ({ id: scopeId(file), kind: 'module', parent: 'package',
        name: names.get(file) ?? fileLabel(file), file })),
    ],
    files: graph.files.map(node => ({ file: node.file, roots: [scopeId(placements.get(node.file)!)], symbols: node.symbols })),
    operations: graph.operations,
    invocations: graph.invocations,
    httpEndpoints: graph.httpEndpoints,
    httpRequests: graph.httpRequests,
    diagnostics: graph.diagnostics,
  }), { imports: new Map(graph.files.map(node => [node.file, node.imports])), entries: graph.entries, buildOutputs: graph.buildOutputs })
}
