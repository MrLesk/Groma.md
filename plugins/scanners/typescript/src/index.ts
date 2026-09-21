import type { ScannerPlugin } from '@groma/scanner'

import { defaultTypeScriptScannerConfig, listTypeScriptFiles } from './files.ts'
import { scanTypeScriptSource } from './scan.ts'
import { readCodeStructure } from './structure.ts'

const scanner = {
  id: 'typescript',
  readCodeStructure,
  watch: { include: [...defaultTypeScriptScannerConfig.globs, '**/tsconfig*.json', '**/package.json', '**/*.html', '**/angular.json'], exclude: defaultTypeScriptScannerConfig.ignore },
  listSourceFiles: (root: string) => listTypeScriptFiles(root),
  scan: (root: string) => scanTypeScriptSource(root),
} satisfies ScannerPlugin

export default scanner
