import type { ScannerPlugin } from '@groma/scanner'

import { checkCSharpReadiness, isCSharpScanFile, scanCSharpSource } from './adapter.ts'
export { checkCSharpReadiness } from './adapter.ts'

const scanner = {
  id: 'csharp',
  matchesFile: isCSharpScanFile,
  checkReadiness: async root => { await checkCSharpReadiness(root) },
  scan: scanCSharpSource,
} satisfies ScannerPlugin

export default scanner
