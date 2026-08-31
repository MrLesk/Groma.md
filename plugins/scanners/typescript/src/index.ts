import type { ScannerPlugin } from '@groma/scanner'

import { isTypeScriptScanFile } from './files.ts'
import { scanTypeScriptSource } from './scan.ts'

const scanner = {
  id: 'typescript',
  matchesFile: isTypeScriptScanFile,
  scan: scanTypeScriptSource,
} satisfies ScannerPlugin

export default scanner
