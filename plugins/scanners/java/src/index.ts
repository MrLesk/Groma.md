import path from 'node:path'
import { projectFiles } from '../../projects.ts'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkJavaReadiness, scanJavaSource } from './adapter.ts'

const scanner = {
  id: 'java',
  watch: { include: ['**/*.java', '**/pom.xml', '**/.mvn/**'], exclude: [] },
  checkReadiness: async root => { await checkJavaReadiness(root) },
  scan: scanJavaSource,
} satisfies ScannerPlugin


export default projectScanner(scanner, async root =>
  (await projectFiles(root, file => path.posix.basename(file) === 'pom.xml'))
    .map(file => path.dirname(path.join(root, file))))
