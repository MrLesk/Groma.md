import { createScanObservation, type ScanObservation, type ScannerPlugin } from '@groma/scanner'
import { VueEvidence } from './evidence.ts'
import path from 'node:path'
import { frameworkProjects, hasDependency, isUnder, projectFiles } from '../../projects.ts'
import { frameworkSourceFiles } from '../../typescript-project.ts'
import { combineObservations } from '../../observations.ts'
import { vueHttpFacts } from './http.ts'
import { addComparedOperations } from './operations.ts'
import { readVueOutline } from './outline.ts'
import { relative, vueProject } from './project.ts'
import { withJavaScriptEntries } from '../../entry-points/javascript.ts'
import { entrySourceInputs } from '../../entry-points/source.ts'
import { classicChecker } from '../../http-checker.ts'
import ts from 'typescript'

export async function scanVue(root: string): Promise<ScanObservation | undefined> {
  const parts = []
  const { selected, owners } = await vueProjects(root)
  for (const [project, sources] of selected) {
    const observation = await scanVueProject(project, root, sources, owners)
    if (observation) parts.push({ key: relative(root, project), observation })
  }
  return combineObservations(parts)
}

async function vueProjects(root: string): Promise<{ selected: Map<string, string[]>; owners: Map<string, string> }> {
  const projects = await frameworkProjects(root, 'vue', ['.vue'], { inheritConfig: true })
  const selected = new Map(projects.map(project => [project, [] as string[]]))
  const owners = new Map<string, string>()
  // Each source belongs to its nearest selected Vue package, even under an export-only package.json.
  const ordered = projects.map(project => ({ project, directory: relative(root, project) }))
    .sort((left, right) => right.directory.length - left.directory.length)
  for (const file of await projectFiles(root, file => /\.(?:vue|[cm]?[jt]sx?)$/.test(file))) {
    const owner = ordered.find(item => isUnder(file, item.directory))
    if (owner) {
      selected.get(owner.project)!.push(file)
      owners.set(file, owner.project)
    }
  }
  return { selected, owners }
}

async function scanVueProject(projectRoot: string, root: string, sources: string[], owners: ReadonlyMap<string, string>): Promise<ScanObservation | undefined> {
  const prepared = vueProject(projectRoot, root, sources, owners)
  if (!prepared) return undefined
  const { manifest, project } = prepared
  const evidence = new VueEvidence(project)
  for (const source of project.files) {
    const sfc = project.sfc(source.fileName)
    if (sfc) evidence.inspect(source.fileName, sfc)
  }
  const { httpRequests, httpEndpoints } = await vueHttpFacts({
    project,
    projectRoot,
    nuxt: hasDependency(manifest, 'nuxt'),
    operationId: node => evidence.operationId(node),
    moduleOperation: file => {
      const id = `${file}#module`
      evidence.operations.set(id, { id, file, name: '(module)' })
      return id
    },
  })
  addComparedOperations(project, evidence.operations)
  const files = project.files.map(source => ({ file: relative(root, source.fileName), symbols: [] }))
  const sourceUnits = project.files.flatMap(source => project.sourceUnit(source.fileName) ?? [])
  for (const file of new Set(sourceUnits.flatMap(unit => unit.files))) {
    if (!files.some(source => source.file === file)) files.push({ file, symbols: [] })
  }
  return withJavaScriptEntries(root, createScanObservation({
    scanner: { id: 'vue', technology: 'typescript/vue', engine: '@vue/language-core', engineVersion: '3.3.11' },
    roots: [{ id: 'vue-project', kind: 'package', name: manifest.name, file: relative(root, path.join(projectRoot, 'package.json')) }],
    files: files.map(file => ({ ...file, roots: ['vue-project'] })),
    sourceUnits,
    operations: [...evidence.operations.values()], invocations: evidence.invocations,
    diagnostics: [...project.diagnostics, ...evidence.diagnostics],
    ...(httpEndpoints.length ? { httpEndpoints } : {}), ...(httpRequests.length ? { httpRequests } : {}),
  }), await entrySourceInputs(root, ts, classicChecker(ts, project.checker), project.files))
}

export default {
  id: 'vue',
  watch: { include: ['**/*.vue', '**/*.ts', '**/*.js', '**/*.html', '**/*.css', '**/*.scss', '**/*.sass', '**/*.less', '**/*.styl', '**/tsconfig*.json', '**/package.json', '**/angular.json'], exclude: [] },
  readCodeStructure: readVueOutline,
  /** Each Vue project's sources, including its `.vue` files and a Nuxt project's server routes. */
  listSourceFiles: root => frameworkSourceFiles({ root, dependency: 'vue', projects: ['.vue'],
    inheritConfig: true, sources: ['.vue', '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.scss', '.sass', '.less', '.styl'] }),
  checkReadiness: async root => {
    const { selected, owners } = await vueProjects(root)
    for (const [project, sources] of selected) vueProject(project, root, sources, owners)
  },
  scan: scanVue,
} satisfies ScannerPlugin
