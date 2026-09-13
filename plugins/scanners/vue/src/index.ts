import { createScanObservation, type ScanObservation, type ScannerPlugin } from '@groma/scanner'
import { VueEvidence } from './evidence.ts'
import path from 'node:path'
import { frameworkProjects } from '../../projects.ts'
import { combineObservations } from '../../observations.ts'
import { relative, vueProject } from './project.ts'

export async function scanVue(root: string): Promise<ScanObservation | undefined> {
  const parts = []
  for (const project of await frameworkProjects(root, 'vue')) {
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
  const files = project.files.map(source => ({ file: relative(root, source.fileName), symbols: [] }))
  return createScanObservation({
    scanner: { id: 'vue', technology: 'typescript/vue', engine: '@vue/language-core', engineVersion: '3.3.11' },
    roots: [{ id: 'vue-project', kind: 'package', name: manifest.name, file: relative(root, path.join(projectRoot, 'package.json')) }],
    files: files.map(file => ({ ...file, roots: ['vue-project'] })),
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics,
  })
}

export default {
  id: 'vue',
  watch: { include: ['**/*.vue', '**/*.ts', '**/tsconfig*.json', '**/package.json'], exclude: [] },
  checkReadiness: async root => {
    const projects = await frameworkProjects(root, 'vue')
    if (!projects.length) throw new Error('VUE_PROJECT_REQUIRED: No Vue project declaration was found.')
    for (const project of projects) vueProject(project, root)
  },
  scan: scanVue,
} satisfies ScannerPlugin
