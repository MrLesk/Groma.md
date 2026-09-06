import path from 'node:path'
import { API, ModuleKind, ModuleResolutionKind } from 'typescript/unstable/async'
import type { ScanSymbol, ScanOperation, ScanInvocation } from '@groma/scanner'

import { usedImportSpecifiers } from './source-usage.ts'
import { sourceOperations } from './source-operations.ts'
import { typescriptWorkerPath } from './worker.ts'

export interface SourceAnalysis {
  file: string
  specifiers: string[]
  symbols: ScanSymbol[]
}

type SourceEvidence = {
  files: SourceAnalysis[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
}

const exportPattern = /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(function|class|interface|type|enum|const|let|var)\s+(\w+)/gm

function exportSymbols(file: string, source: string): ScanSymbol[] {
  return [...source.matchAll(exportPattern)].flatMap(match => {
    const kind = match[1]
    const name = match[2]
    if (kind === undefined || name === undefined) return []
    return [{ id: `${file}#${name}`, name, kind }]
  })
}

/** One program keeps operation identity and callback wiring shared across the owned source set. */
export async function analyzeSourceFiles(repositoryRoot: string, paths: string[]): Promise<SourceEvidence> {
  if (paths.length === 0) return { files: [], operations: [], invocations: [] }
  const tsserverPath = await typescriptWorkerPath()
  const api = new API({
    cwd: repositoryRoot,
    ...(tsserverPath === undefined ? {} : { tsserverPath }),
  })
  try {
    const program = await api.createProgram(paths.map(file => path.join(repositoryRoot, file)), {
      compilerOptions: {
        noLib: true, noResolve: true, types: [], allowJs: true,
        moduleResolution: ModuleResolutionKind.Bundler, module: ModuleKind.Preserve,
      },
    })
    const sources = await Promise.all(paths.map(async file => {
      const source = await program.getSourceFile(path.join(repositoryRoot, file))
      if (!source) throw new Error(`TypeScript could not parse ${file}`)
      return source
    }))
    const evidence = await sourceOperations(repositoryRoot, sources, program.getProject().checker)
    const files = await Promise.all(sources.map(async (source, index) => ({
      file: paths[index]!,
      specifiers: await usedImportSpecifiers(source, program.getProject().checker),
      symbols: exportSymbols(paths[index]!, source.text),
    })))
    return { files, ...evidence }
  } finally {
    await api.close()
  }
}
