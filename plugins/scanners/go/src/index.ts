import path from 'node:path'
import { projectFiles } from '../../projects.ts'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkGoReadiness, readGoCodeStructure, scanGoSource } from './adapter.ts'

/** The worker walks each module directory, skipping dot directories, vendor, testdata and tests. */
async function goSources(root: string): Promise<string[]> {
  const modules = (await projectFiles(root, file => path.posix.basename(file) === 'go.mod'))
    .map(file => path.posix.dirname(file))
  return projectFiles(root, file => file.endsWith('.go') && !file.endsWith('_test.go')
    && !file.split('/').some(part => part === 'testdata' || part.startsWith('.'))
    && modules.some(module => module === '.' || file.startsWith(`${module}/`)))
}

const scanner = {
  id: 'go',
  watch: { include: ['**/*.go', '**/go.mod', '**/go.sum', '**/go.work'], exclude: [] },
  listSourceFiles: goSources,
  checkReadiness: async root => { await checkGoReadiness(root) },
  readCodeStructure: readGoCodeStructure,
  scan: scanGoSource,
} satisfies ScannerPlugin

export default projectScanner(scanner, async root =>
  (await projectFiles(root, file => path.posix.basename(file) === 'go.mod'))
    .map(file => path.dirname(path.join(root, file))))
