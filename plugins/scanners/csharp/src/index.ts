import type { ScannerPlugin } from '@groma/scanner'

import { isCSharpScanFile, scanCSharpSource } from './adapter.ts'
export { checkCSharpReadiness } from './adapter.ts'

const scanner = {
  id: 'csharp',
  matchesFile: isCSharpScanFile,
  scan: scanCSharpSource,
} satisfies ScannerPlugin

export default scanner
