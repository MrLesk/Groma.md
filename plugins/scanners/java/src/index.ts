import type { ScannerPlugin } from '@groma/scanner'
import { checkJavaReadiness, scanJavaSource } from './adapter.ts'

const scanner = {
  id: 'java',
  watch: { include: ['**/*.java', 'pom.xml', '.mvn/**'], exclude: [] },
  checkReadiness: async root => { await checkJavaReadiness(root) },
  scan: scanJavaSource,
} satisfies ScannerPlugin

export default scanner
