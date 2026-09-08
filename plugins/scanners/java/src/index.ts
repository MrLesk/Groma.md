import type { ScannerPlugin } from '@groma/scanner'
import { checkJavaReadiness, isJavaScanFile, scanJavaSource } from './adapter.ts'

const scanner = {
  id: 'java',
  matchesFile: isJavaScanFile,
  checkReadiness: async root => { await checkJavaReadiness(root) },
  scan: scanJavaSource,
} satisfies ScannerPlugin

export default scanner
