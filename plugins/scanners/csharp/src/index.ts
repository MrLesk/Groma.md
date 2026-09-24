import type { ScannerPlugin } from '@groma/scanner'
import { checkCSharpReadiness, listCSharpSources, readCSharpOutline, scanCSharpSource } from './adapter.ts'

const scanner = {
  id: 'csharp',
  checkReadiness: checkCSharpReadiness,
  readCodeStructure: readCSharpOutline,
  listSourceFiles: listCSharpSources,
  scan: scanCSharpSource,
} satisfies ScannerPlugin

export default scanner
