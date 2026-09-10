import path from 'node:path'
import { API, ModuleKind, ModuleResolutionKind } from 'typescript/unstable/async'
import {
  isClassDeclaration, isEnumDeclaration, isFunctionDeclaration, isIdentifier,
  isInterfaceDeclaration, isTypeAliasDeclaration, isVariableStatement,
  NodeFlags, SyntaxKind, type SourceFile, type VariableDeclarationList,
} from 'typescript/unstable/ast'
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

const declarationKinds: Partial<Record<SyntaxKind, string>> = {
  [SyntaxKind.FunctionDeclaration]: 'function',
  [SyntaxKind.ClassDeclaration]: 'class',
  [SyntaxKind.InterfaceDeclaration]: 'interface',
  [SyntaxKind.TypeAliasDeclaration]: 'type',
  [SyntaxKind.EnumDeclaration]: 'enum',
}

function variableSymbols(file: string, list: VariableDeclarationList): ScanSymbol[] {
  const kind = list.flags & NodeFlags.Const ? 'const' : list.flags & NodeFlags.Let ? 'let' : 'var'
  return list.declarations.flatMap(declaration => isIdentifier(declaration.name)
    ? [{ id: `${file}#${declaration.name.text}`, name: declaration.name.text, kind }] : [])
}

function exportSymbols(file: string, source: SourceFile): ScanSymbol[] {
  return source.statements.flatMap(statement => {
    if (!isFunctionDeclaration(statement) && !isClassDeclaration(statement)
      && !isInterfaceDeclaration(statement) && !isTypeAliasDeclaration(statement)
      && !isEnumDeclaration(statement) && !isVariableStatement(statement)) return []
    if (!statement.modifiers?.some(modifier => modifier.kind === SyntaxKind.ExportKeyword)) return []
    if (isVariableStatement(statement)) return variableSymbols(file, statement.declarationList)
    if (!statement.name) return []
    const name = statement.name.text
    const kind = declarationKinds[statement.kind]!
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
      symbols: exportSymbols(paths[index]!, source),
    })))
    return { files, ...evidence }
  } finally {
    await api.close()
  }
}
