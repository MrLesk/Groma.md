import { createScanObservation, type ScanObservation, type ScannerPlugin } from '@groma/scanner'
import { VueEvidence } from './evidence.ts'
import path from 'node:path'
import { frameworkProjects, hasDependency } from '../../projects.ts'
import { combineObservations } from '../../observations.ts'
import { vueHttpFacts } from './http.ts'
import { addComparedOperations } from './operations.ts'
import { readVueOutline } from './outline.ts'
import { relative, vueProject } from './project.ts'

export async function scanVue(root: string): Promise<ScanObservation | undefined> {
  const parts = []
  for (const project of await frameworkProjects(root, 'vue', ['.vue'])) {
    const observation = await scanVueProject(project, root)
    if (observation) parts.push({ key: relative(root, project), observation })
  }
  return combineObservations(parts)
}

async function scanVueProject(projectRoot: string, root: string): Promise<ScanObservation | undefined> {
  const prepared = vueProject(projectRoot, root)
  if (!prepared) return undefined
  const { manifest, project } = prepared
  const evidence = new VueEvidence(project)
  for (const source of project.files) {
    const sfc = project.sfc(source.fileName)
    if (sfc) evidence.inspect(source.fileName, sfc)
  }
  const { httpRequests, httpEndpoints } = vueHttpFacts({
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
  return createScanObservation({
    scanner: { id: 'vue', technology: 'typescript/vue', engine: '@vue/language-core', engineVersion: '3.3.11' },
    roots: [{ id: 'vue-project', kind: 'package', name: manifest.name, file: relative(root, path.join(projectRoot, 'package.json')) }],
    files: files.map(file => ({ ...file, roots: ['vue-project'] })),
    sourceUnits,
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics,
    ...(httpEndpoints.length ? { httpEndpoints } : {}), ...(httpRequests.length ? { httpRequests } : {}),
  })
}

export default {
  id: 'vue',
  watch: { include: ['**/*.vue', '**/*.ts', '**/*.js', '**/*.html', '**/*.css', '**/*.scss', '**/*.sass', '**/*.less', '**/*.styl', '**/tsconfig*.json', '**/package.json'], exclude: [] },
  readCodeStructure: readVueOutline,
  checkReadiness: async root => {
    const projects = await frameworkProjects(root, 'vue', ['.vue'])
    for (const project of projects) vueProject(project, root)
  },
  scan: scanVue,
} satisfies ScannerPlugin
