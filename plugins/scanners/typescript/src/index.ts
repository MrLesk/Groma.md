import type { ScannerPlugin } from '@groma/scanner'

import { defaultTypeScriptScannerConfig } from './files.ts'
import { scanTypeScriptSource } from './scan.ts'
import { readCodeStructure } from './structure.ts'

const scanner = {
  id: 'typescript',
  readCodeStructure,
  watch: { include: [...defaultTypeScriptScannerConfig.globs, '**/tsconfig*.json', '**/package.json'], exclude: defaultTypeScriptScannerConfig.ignore },
  scan: (root: string) => scanTypeScriptSource(root),
} satisfies ScannerPlugin

export default scanner
