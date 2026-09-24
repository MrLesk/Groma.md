import path from 'node:path'
import { API, ModuleKind, ModuleResolutionKind } from 'typescript/unstable/async'
import { SyntaxKind, type SourceFile } from 'typescript/unstable/ast'
import type { ScanDiagnostic, ScanHttpEndpoint, ScanHttpRequest, ScanSymbol, ScanOperation, ScanInvocation } from '@groma/scanner'

import { usedImportSpecifiers } from './source-usage.ts'
import { typescriptProjects, type TypeScriptProject } from './projects.ts'
import { resolvedImports } from './source-imports.ts'
import { sourceOperations } from './source-operations.ts'
import { exportSymbols } from './source-symbols.ts'
import { nativeChecker, syntax } from './native-checker.ts'
import { sourceBuildEntries } from '../../entry-points/source.ts'
import type { SourceEntry } from '../../entry-points/javascript.ts'

export interface SourceAnalysis {
  file: string
  imports: string[]
  symbols: ScanSymbol[]
}

type ProjectEvidence = {
  entries: SourceEntry[]
  files: SourceAnalysis[]
  operations: ScanOperation[]
  invocations: ScanInvocation[]
  httpEndpoints: ScanHttpEndpoint[]
  httpRequests: ScanHttpRequest[]
}

type SourceEvidence = ProjectEvidence & { diagnostics: ScanDiagnostic[] }

function unique<Fact>(facts: Fact[]): Fact[] {
  return [...new Map(facts.map(fact => [JSON.stringify(fact), fact])).values()]
}

/**
 * A program that compiles a NestJS controller without the file creating its application, such as a check outside
 * every config or the controller's own library config, places its routes in the controller's own file
 * (./http-controllers.ts). Where another program places the same route in its application, that reading stands.
 */
function placedEndpoints(endpoints: readonly ScanHttpEndpoint[], operationFiles: ReadonlyMap<string, string>): ScanHttpEndpoint[] {
  const route = ({ operation, method, path }: ScanHttpEndpoint) => JSON.stringify([operation, method, path])
  const unplaced = ({ order, operation }: ScanHttpEndpoint) => order !== undefined && order.application === operationFiles.get(operation)
  const placed = new Set(endpoints.filter(endpoint => !unplaced(endpoint)).map(route))
  return unique(endpoints.filter(endpoint => !unplaced(endpoint) || !placed.has(route(endpoint))))
}

/**
 * The facts of every program, where a file two programs compile states its facts twice: one operation per id, every
 * invocation claim so core can detect conflicting resolutions, each request once and each route as placed.
 */
function mergedEvidence(programs: readonly ProjectEvidence[]): ProjectEvidence {
  const operations = [...new Map(programs.flatMap(program => program.operations).map(operation => [operation.id, operation])).values()]
  return {
    entries: programs.flatMap(program => program.entries),
    files: programs.flatMap(program => program.files),
    operations,
    invocations: programs.flatMap(program => program.invocations),
    httpEndpoints: placedEndpoints(programs.flatMap(program => program.httpEndpoints),
      new Map(operations.map(operation => [operation.id, operation.file]))),
    httpRequests: unique(programs.flatMap(program => program.httpRequests)),
  }
}

/** Each compiler project resolves its own aliases; only selected repository source becomes evidence. */
export async function analyzeSourceFiles(repositoryRoot: string, paths: string[]): Promise<SourceEvidence> {
  if (paths.length === 0) return { ...mergedEvidence([]), diagnostics: [] }
  const api = new API({ cwd: repositoryRoot })
  try {
    const { projects, diagnostics } = await typescriptProjects(api, repositoryRoot, paths)
    const programs: ProjectEvidence[] = []
    for (const project of projects) {
      if (!project.config) {
        const analyzed = new Set(programs.flatMap(program => program.files).map(file => path.resolve(repositoryRoot, file.file)))
        project.files = project.files.filter(file => !analyzed.has(file))
        if (!project.files.length) continue
      }
      programs.push(await analyzeProject(api, repositoryRoot, paths, project))
    }
    return { ...mergedEvidence(programs), diagnostics }
  } finally {
    await api.close()
  }
}

async function analyzeProject(api: API, repositoryRoot: string, paths: string[], project: TypeScriptProject): Promise<ProjectEvidence> {
    const program = await api.createProgram(project.files, {
      compilerOptions: { ...(project.config?.options ?? {
        noLib: true, types: [], allowJs: true,
        moduleResolution: ModuleResolutionKind.Bundler, module: ModuleKind.Preserve,
      }), noEmit: true },
    })
    const sources = await Promise.all(paths.map(file => program.getSourceFile(path.join(repositoryRoot, file))))
    const selectedProgramSources = sources.filter((source): source is SourceFile => source !== undefined)
    const checker = program.getProject().checker
    // One adapter per program, so operations and entries share its answers.
    const sharedChecker = nativeChecker(checker)
    const evidence = await sourceOperations(repositoryRoot, selectedProgramSources, checker, sharedChecker)
    const files = await Promise.all(selectedProgramSources.map(async source => {
      const file = path.relative(repositoryRoot, source.fileName).split(path.sep).join('/')
      return { file, imports: await resolvedImports(repositoryRoot, source, await usedImportSpecifiers(source, checker), checker),
        symbols: exportSymbols(file, source) }
    }))
    const entries = await sourceBuildEntries(repositoryRoot, { ...syntax, SyntaxKind }, sharedChecker, selectedProgramSources)
    return { files, ...evidence, entries }
}
