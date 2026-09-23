import path from 'node:path'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkGoReadiness, readGoCodeStructure, scanGoSource } from './adapter.ts'
import { goModules, goSources } from './sources.ts'

const scanner = {
  id: 'go',
  watch: { include: ['**/*.go', '**/go.mod', '**/go.sum', '**/go.work'], exclude: [] },
  listSourceFiles: goSources,
  checkReadiness: async root => { await checkGoReadiness(root) },
  readCodeStructure: readGoCodeStructure,
  scan: scanGoSource,
} satisfies ScannerPlugin

export default projectScanner(scanner, async root => (await goModules(root)).map(module => path.join(root, module)))
