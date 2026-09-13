import path from 'node:path'
import { projectFiles } from '../../projects.ts'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkGoReadiness, scanGoSource } from './adapter.ts'

const scanner = {
  id: 'go',
  watch: { include: ['**/*.go', '**/go.mod', '**/go.sum', '**/go.work'], exclude: [] },
  checkReadiness: async root => { await checkGoReadiness(root) },
  scan: scanGoSource,
} satisfies ScannerPlugin

export default projectScanner(scanner, async root =>
  (await projectFiles(root, file => path.posix.basename(file) === 'go.mod'))
    .map(file => path.dirname(path.join(root, file))))
