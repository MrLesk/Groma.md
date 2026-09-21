import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ScanHttpEndpoint, ScanHttpRequest, ScanSymbol, ScanOperation, ScanInvocation } from '@groma/scanner'

import {
  defaultTypeScriptScannerConfig,
  listTypeScriptFiles,
  type TypeScriptScannerConfig,
} from './files.ts'
import { displayName, kebabCase } from './naming.ts'
import { analyzeSourceFiles } from './source-analysis.ts'
import type { SourceEntry } from '../../entry-points/javascript.ts'

export interface ImportGraphNode {
  file: string
  imports: string[]
  importedBy: string[]
  symbols: ScanSymbol[]
}

export interface ImportGraph {
  entries: SourceEntry[]
  files: ImportGraphNode[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
  httpEndpoints: ScanHttpEndpoint[]
  httpRequests: ScanHttpRequest[]
}

export function fileStem(file: string): string {
  return path.posix.basename(file).replace(/\.tsx?$/, '')
}

export function fileLabel(file: string): string {
  const stem = fileStem(file)
  if (stem === 'index') {
    const parent = path.posix.basename(path.posix.dirname(file))
    return displayName(kebabCase(parent === '.' || parent === '' ? stem : parent))
  }
  return displayName(kebabCase(stem))
}

export async function packageName(repositoryRoot: string): Promise<string> {
  try {
    const source = await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
    const name = (JSON.parse(source) as { name?: unknown }).name
    if (typeof name === 'string' && kebabCase(name) !== '') {
      return displayName(kebabCase(name))
    }
  } catch {
    // The repository directory remains the deterministic name.
  }
  return displayName(kebabCase(path.basename(repositoryRoot)))
}

export async function buildImportGraph(
  repositoryRoot: string,
  config: TypeScriptScannerConfig = defaultTypeScriptScannerConfig,
): Promise<ImportGraph> {
  const paths = await listTypeScriptFiles(repositoryRoot, config)
  const files = new Set(paths)
  const { files: analyses, operations, invocations, httpEndpoints, httpRequests, entries } = await analyzeSourceFiles(repositoryRoot, paths)
  const nodes = new Map<string, ImportGraphNode>()
  for (const analysis of analyses) {
    const node = nodes.get(analysis.file) ?? { file: analysis.file, imports: [], importedBy: [], symbols: [] }
    node.imports = [...new Set([...node.imports, ...analysis.imports.filter(file => files.has(file))])].sort()
    node.symbols = [...new Map([...node.symbols, ...analysis.symbols].map(symbol => [symbol.id, symbol])).values()]
    nodes.set(node.file, node)
  }

  for (const node of nodes.values()) {
    for (const imported of node.imports) nodes.get(imported)?.importedBy.push(node.file)
  }
  for (const node of nodes.values()) node.importedBy.sort()
  return { files: [...nodes.values()], operations, invocations, httpEndpoints, httpRequests, entries }
}
