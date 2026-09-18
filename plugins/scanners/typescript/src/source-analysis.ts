import path from 'node:path'
import { API, ModuleKind, ModuleResolutionKind } from 'typescript/unstable/async'
import {
  isClassDeclaration, isEnumDeclaration, isFunctionDeclaration, isIdentifier,
  isInterfaceDeclaration, isTypeAliasDeclaration, isVariableStatement,
  NodeFlags, SyntaxKind, type SourceFile, type VariableDeclarationList,
} from 'typescript/unstable/ast'
import type { ScanHttpEndpoint, ScanHttpRequest, ScanSymbol, ScanOperation, ScanInvocation } from '@groma/scanner'

import { usedImportSpecifiers } from './source-usage.ts'
import { typescriptProjects, type TypeScriptProject } from './projects.ts'
import { resolvedImports } from './source-imports.ts'
import { sourceOperations } from './source-operations.ts'

export interface SourceAnalysis {
  file: string
  imports: string[]
  symbols: ScanSymbol[]
}

type SourceEvidence = {
  files: SourceAnalysis[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
  httpEndpoints: ScanHttpEndpoint[]
  httpRequests: ScanHttpRequest[]
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

function unique<Fact>(facts: Fact[]): Fact[] {
  return [...new Map(facts.map(fact => [JSON.stringify(fact), fact])).values()]
}

/** Each compiler project resolves its own aliases; only selected repository source becomes evidence. */
export async function analyzeSourceFiles(repositoryRoot: string, paths: string[]): Promise<SourceEvidence> {
  if (paths.length === 0) return { files: [], operations: [], invocations: [], httpEndpoints: [], httpRequests: [] }
  const api = new API({ cwd: repositoryRoot })
  try {
    const result: SourceEvidence = { files: [], operations: [], invocations: [], httpEndpoints: [], httpRequests: [] }
    for (const project of await typescriptProjects(api, repositoryRoot, paths)) {
      if (!project.config) {
        const analyzed = new Set(result.files.map(file => path.resolve(repositoryRoot, file.file)))
        project.files = project.files.filter(file => !analyzed.has(file))
        if (!project.files.length) continue
      }
      const evidence = await analyzeProject(api, repositoryRoot, paths, project)
      result.files.push(...evidence.files)
      result.operations.push(...evidence.operations)
      result.invocations.push(...evidence.invocations)
      result.httpEndpoints.push(...evidence.httpEndpoints)
      result.httpRequests.push(...evidence.httpRequests)
    }
    result.operations = [...new Map(result.operations.map(operation => [operation.id, operation])).values()]
    // A file shared by two projects states the same facts twice.
    result.httpEndpoints = unique(result.httpEndpoints)
    result.httpRequests = unique(result.httpRequests)
    return result
  } finally {
    await api.close()
  }
}

async function analyzeProject(api: API, repositoryRoot: string, paths: string[], project: TypeScriptProject): Promise<SourceEvidence> {
    const program = await api.createProgram(project.files, {
      compilerOptions: { ...(project.config?.options ?? {
        noLib: true, types: [], allowJs: true,
        moduleResolution: ModuleResolutionKind.Bundler, module: ModuleKind.Preserve,
      }), noEmit: true },
    })
    const sources = await Promise.all(paths.map(file => program.getSourceFile(path.join(repositoryRoot, file))))
    const selectedProgramSources = sources.filter((source): source is SourceFile => source !== undefined)
    const checker = program.getProject().checker
    const evidence = await sourceOperations(repositoryRoot, selectedProgramSources, checker)
    const files = await Promise.all(selectedProgramSources.map(async source => {
      const file = path.relative(repositoryRoot, source.fileName).split(path.sep).join('/')
      return { file, imports: await resolvedImports(repositoryRoot, source, await usedImportSpecifiers(source, checker), checker),
        symbols: exportSymbols(file, source) }
    }))
    return { files, ...evidence }
}
