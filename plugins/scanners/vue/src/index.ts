import { createScanObservation, type ScanObservation, type ScannerPlugin } from '@groma/scanner'
import { VueEvidence } from './evidence.ts'
import { relative, vueProject } from './project.ts'

export async function scanVue(root: string): Promise<ScanObservation | undefined> {
  const prepared = vueProject(root)
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
    roots: [{ id: 'vue-project', kind: 'package', name: manifest.name, file: 'package.json' }],
    files: files.map(file => ({ ...file, roots: ['vue-project'] })),
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics,
  })
}

export default {
  id: 'vue',
  watch: { include: ['**/*.vue', '**/*.ts', 'tsconfig.json', 'package.json'], exclude: [] },
  checkReadiness: async root => {
    if (!vueProject(root)) throw new Error('VUE_PROJECT_REQUIRED: Select a project with vue in its root package.json, or disable the vue scanner.')
  },
  scan: scanVue,
} satisfies ScannerPlugin
