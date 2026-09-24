import type { ScannerPlugin } from '@groma/scanner'

import { listTypeScriptFiles } from './files.ts'
import { scanTypeScriptSource } from './scan.ts'
import { readCodeStructure } from './structure.ts'

const scanner = {
  id: 'typescript',
  readCodeStructure,
  watch: { include: ['**/*.ts', '**/*.tsx', '**/tsconfig*.json', '**/package.json', '**/*.html', '**/angular.json'], exclude: [] },
  listSourceFiles: listTypeScriptFiles,
  scan: (root, _settings?, excluded?) => scanTypeScriptSource(root, excluded),
} satisfies ScannerPlugin

export default scanner
