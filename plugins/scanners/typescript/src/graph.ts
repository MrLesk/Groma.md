import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ScanSymbol, ScanOperation, ScanInvocation } from '@groma/scanner'

import {
  defaultTypeScriptScannerConfig,
  listTypeScriptFiles,
  type TypeScriptScannerConfig,
} from './files.ts'
import { displayName, kebabCase } from './naming.ts'
import { analyzeSourceFiles } from './source-analysis.ts'

export interface ImportGraphNode {
  file: string
  imports: string[]
  importedBy: string[]
  symbols: ScanSymbol[]
}

export interface ImportGraph {
  files: ImportGraphNode[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
}

function resolveSpecifier(
  fromFile: string,
  specifier: string,
  files: Set<string>,
): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier))
  const candidates = specifier.endsWith('.ts') || specifier.endsWith('.tsx')
    ? [joined]
    : [
      joined,
      joined.replace(/\.jsx?$/, '.ts'),
      joined.replace(/\.jsx?$/, '.tsx'),
      `${joined}.ts`,
      `${joined}.tsx`,
      `${joined}.js`,
      `${joined}/index.ts`,
      `${joined}/index.tsx`,
    ]
  return candidates.find(candidate => files.has(candidate))
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
  const { files: analyses, operations, invocations } = await analyzeSourceFiles(repositoryRoot, paths)
  const nodes = new Map<string, ImportGraphNode>(analyses.map(({ file, specifiers, symbols }) => [file, {
    file,
    imports: [...new Set(specifiers.flatMap(specifier => {
      const resolved = resolveSpecifier(file, specifier, files)
      return resolved === undefined ? [] : [resolved]
    }))].sort(),
    importedBy: [],
    symbols,
  }]))

  for (const node of nodes.values()) {
    for (const imported of node.imports) nodes.get(imported)?.importedBy.push(node.file)
  }
  for (const node of nodes.values()) node.importedBy.sort()
  return { files: [...nodes.values()], operations, invocations }
}
