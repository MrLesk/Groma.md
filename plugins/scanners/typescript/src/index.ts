import type { ScannerPlugin } from '@groma/scanner'

import { typeScriptSources } from './files.ts'
import { scanTypeScriptSource } from './scan.ts'
import { readCodeStructure } from './structure.ts'

const scanner = {
  id: 'typescript',
  readCodeStructure,
  listSourceFiles: async (_root, _settings, candidates) => typeScriptSources(candidates),
  scan: (root, _settings, files) => scanTypeScriptSource(root, files),
} satisfies ScannerPlugin

export default scanner
