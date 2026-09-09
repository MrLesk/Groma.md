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
    scanner: { language: 'vue', engine: '@vue/language-core', engineVersion: '3.3.11' },
    root: { kind: 'package', name: manifest.name, file: 'package.json' },
    scopes: [{ id: 'vue-project', name: manifest.name }], files,
    placements: files.map(({ file }) => ({ file, scope: 'vue-project' })), relationships: [],
    operations: [...evidence.operations.values()], invocations: evidence.invocations, diagnostics: evidence.diagnostics,
  })
}

export default {
  id: 'vue',
  matchesFile: file => file.endsWith('.vue') || file.endsWith('.ts') || file === 'tsconfig.json' || file === 'package.json',
  checkReadiness: async root => {
    if (!vueProject(root)) throw new Error('VUE_PROJECT_REQUIRED: Select a project with vue in its root package.json, or disable the vue scanner.')
  },
  scan: scanVue,
} satisfies ScannerPlugin
