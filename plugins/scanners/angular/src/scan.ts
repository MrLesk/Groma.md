import { readFileSync } from 'node:fs'
import path from 'node:path'
import { VERSION } from '@angular/compiler'
import { createScanObservation, type ScanFile, type ScanObservation, type ScanSourceUnit } from '@groma/scanner'
import ts from 'typescript'
import { withJavaScriptEntries } from '../../entry-points/javascript.ts'
import { entrySourceInputs, type EntrySources } from '../../entry-points/source.ts'
import { classicChecker } from '../../http-checker.ts'
import { combineObservations } from '../../observations.ts'
import { sourceDirective } from './directives.ts'
import { enclosingOperation, Evidence } from './evidence.ts'
import { angularHttpRequests } from './http.ts'
import { angularPrograms, angularProjects, projectConfigs, relative, type AngularProgram } from './project.ts'
import { Templates } from './template.ts'

/** Readiness reads the configs of every Angular project among the scanner's files; source syntax is the scan's to check. */
export async function checkAngularReadiness(root: string, _settings: unknown, files: readonly string[]): Promise<void> {
  projectConfigs(root, [...(await angularProjects(root, files)).keys()], files)
}

export async function scanAngular(root: string, _settings: unknown, files: readonly string[]): Promise<ScanObservation | undefined> {
  const projects = await angularProjects(root, files)
  const { configs, diagnostics } = projectConfigs(root, [...projects.keys()], files)
  const inputs: EntrySources = { imports: new Map(), entries: [] }
  const readable = new Set(files)
  const parts = []
  for (const [directory, sources] of projects) {
    const programs = angularPrograms(root, sources, configs)
    if (programs.length) parts.push({ key: directory, observation: await scanProject(root, directory, programs, inputs, readable) })
  }
  const combined = combineObservations(parts)
  return withJavaScriptEntries(root, combined && { ...combined, diagnostics: [...combined.diagnostics, ...diagnostics] }, inputs, files)
}

function mergeInputs(inputs: EntrySources, next: EntrySources): void {
  for (const [file, targets] of next.imports) inputs.imports.set(file, [...new Set([...inputs.imports.get(file) ?? [], ...targets])])
  inputs.entries.push(...next.entries)
}

/**
 * One project's evidence across its programs. Each program reports only the sources it owns, while every repository
 * source it compiles, such as an imported library, can supply a child directive or a value. A component's templates
 * and stylesheets are read only from the scanner's files, which `readable` holds.
 */
async function scanProject(root: string, directory: string, programs: readonly AngularProgram[], inputs: EntrySources,
  readable: ReadonlySet<string>): Promise<ScanObservation> {
  const evidence = new Evidence(root)
  const templates = new Templates(root, evidence, readable)
  const files: Omit<ScanFile, 'roots'>[] = []
  const sourceUnits: ScanSourceUnit[] = []
  const httpRequests = []
  for (const { program, owned, sources } of programs) {
    const checker = program.getTypeChecker()
    const mine = new Set(owned)
    const directives = sources.flatMap(source => source.statements.filter(ts.isClassDeclaration).flatMap(node => sourceDirective(node, checker) ?? []))
    for (const component of directives.filter(directive => directive.view && mine.has(directive.declaration.getSourceFile()))) {
      templates.bindOutputs(component, directives, checker)
      sourceUnits.push(templates.unit(component))
    }
    httpRequests.push(...await angularHttpRequests(sources, checker, node => {
      const caller = mine.has(node.getSourceFile()) ? enclosingOperation(node) : undefined
      return caller && evidence.operationId(caller)
    }))
    files.push(...owned.map(source => ({ file: relative(root, source.fileName),
      symbols: source.statements.filter(ts.isClassDeclaration).map(node => ({
        id: `${relative(root, source.fileName)}#${node.getStart()}`, name: node.name?.text ?? 'default', kind: 'class' })) })))
    mergeInputs(inputs, await entrySourceInputs(root, ts, classicChecker(ts, checker), sources))
  }
  // Templates, stylesheets, and a directive in another project that a binding here names are read too.
  const observed = new Set(files.map(source => source.file))
  const operations = [...evidence.operations.values()].map(operation => operation.file)
  for (const file of new Set([...sourceUnits.flatMap(unit => unit.files), ...operations])) {
    if (!observed.has(file)) files.push({ file, symbols: [] })
  }
  const manifest = JSON.parse(readFileSync(path.join(root, directory, 'package.json'), 'utf8'))
  return createScanObservation({ scanner: { id: 'angular', technology: 'typescript/angular', engine: '@angular/compiler', engineVersion: VERSION.full },
    roots: [{ id: 'angular-project', kind: 'package', name: manifest.name, file: path.posix.join(directory, 'package.json') }],
    files: files.map(file => ({ ...file, roots: ['angular-project'] })),
    sourceUnits, operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics,
    ...(httpRequests.length ? { httpRequests } : {}) })
}
