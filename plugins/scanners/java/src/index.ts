import type { ScannerPlugin } from '@groma/scanner'
import { isJavaScanFile, scanJavaSource } from './adapter.ts'

const scanner = {
  id: 'java',
  matchesFile: isJavaScanFile,
  scan: scanJavaSource,
} satisfies ScannerPlugin

export default scanner
