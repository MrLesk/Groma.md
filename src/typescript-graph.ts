import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  defaultTypeScriptScannerConfig,
  listTypeScriptFiles,
  type TypeScriptScannerConfig,
} from './typescript-files.ts'

export interface ImportGraphNode {
  file: string
  imports: string[]
  importedBy: string[]
  symbol?: string
}

export interface ImportGraph {
  files: ImportGraphNode[]
}

const importPattern =
  /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(importPattern)) {
    if (match[1] !== undefined) specifiers.push(match[1])
  }
  return specifiers
}

function resolveSpecifier(
  fromFile: string,
  specifier: string,
  files: Set<string>,
): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const directory = path.posix.dirname(fromFile)
  const joined = path.posix.normalize(path.posix.join(directory, specifier))
  const candidates = specifier.endsWith('.ts') || specifier.endsWith('.tsx')
    ? [joined]
    : [
      joined,
      `${joined}.ts`,
      `${joined}.tsx`,
      `${joined}.js`,
      `${joined}/index.ts`,
      `${joined}/index.tsx`,
    ]
  return candidates.find(candidate => files.has(candidate))
}

export function kebabCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function displayName(kebab: string): string {
  const words = kebab.split('-').filter(Boolean)
  if (words.length === 0) return kebab
  const [first, ...rest] = words
  return [first[0].toUpperCase() + first.slice(1), ...rest].join(' ')
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

function firstExportSymbol(source: string): string | undefined {
  return source.match(/^export\s+(?:async\s+)?function\s+(\w+)/m)?.[1]
    ?? source.match(/^export\s+class\s+(\w+)/m)?.[1]
}

export async function systemName(repositoryRoot: string): Promise<string> {
  try {
    const source = await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
    const name = (JSON.parse(source) as { name?: unknown }).name
    if (typeof name === 'string' && kebabCase(name) !== '') {
      return displayName(kebabCase(name))
    }
  } catch {
    // Fall through to the directory name.
  }
  return displayName(kebabCase(path.basename(repositoryRoot)))
}

export async function buildImportGraph(
  repositoryRoot: string,
  config: TypeScriptScannerConfig = defaultTypeScriptScannerConfig,
): Promise<ImportGraph> {
  const paths = await listTypeScriptFiles(repositoryRoot, config)
  const files = new Set(paths)
  const nodes = new Map<string, ImportGraphNode>()

  for (const file of paths) {
    nodes.set(file, {
      file,
      imports: [],
      importedBy: [],
    })
  }

  for (const file of paths) {
    const source = await readFile(path.join(repositoryRoot, ...file.split('/')), 'utf8')
    const node = nodes.get(file)
    if (node === undefined) continue
    const imports = new Set<string>()
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveSpecifier(file, specifier, files)
      if (resolved !== undefined) imports.add(resolved)
    }
    node.imports = [...imports].sort()
    const symbol = firstExportSymbol(source)
    if (symbol !== undefined) node.symbol = symbol
  }

  for (const node of nodes.values()) {
    for (const imported of node.imports) {
      nodes.get(imported)?.importedBy.push(node.file)
    }
  }
  for (const node of nodes.values()) {
    node.importedBy.sort()
  }

  return { files: [...nodes.values()] }
}
