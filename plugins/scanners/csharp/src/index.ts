import type { ScannerPlugin } from '@groma/scanner'

import { isCSharpScanFile, scanCSharpSource } from './adapter.ts'
import { setupCSharp } from './setup.ts'

const scanner = {
  id: 'csharp',
  matchesFile: isCSharpScanFile,
  scan: scanCSharpSource,
  setup: setupCSharp,
} satisfies ScannerPlugin

export default scanner
