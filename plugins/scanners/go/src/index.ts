import path from 'node:path'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkGoReadiness, readGoCodeStructure, scanGoSource } from './adapter.ts'
import { goModules, goSources } from './sources.ts'

const scanner = {
  id: 'go',
  listSourceFiles: async (_root, _settings, candidates) => goSources(candidates),
  checkReadiness: async root => { await checkGoReadiness(root) },
  readCodeStructure: readGoCodeStructure,
  scan: scanGoSource,
} satisfies ScannerPlugin

export default projectScanner(scanner, async (root, _settings, files) =>
  goModules(files).map(module => path.join(root, module)))
