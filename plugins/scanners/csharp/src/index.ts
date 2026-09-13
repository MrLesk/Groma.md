import type { ScannerPlugin } from '@groma/scanner'

import { checkCSharpReadiness, scanCSharpSource } from './adapter.ts'
export { checkCSharpReadiness } from './adapter.ts'

const scanner = {
  id: 'csharp',
  watch: {
    // Character classes preserve C#'s case-insensitive source and configuration subscriptions.
    include: ['**/*.cs', '**/*.csproj', '**/*.sln', '**/*.slnx', '**/*.props', '**/*.targets',
      '**/global.json', '**/nuget.config', '**/packages.lock.json']
      .map(pattern => pattern.replace(/[a-z]/g, letter => `[${letter}${letter.toUpperCase()}]`)),
    exclude: ['**/[bB][iI][nN]/**', '**/[oO][bB][jJ]/**'],
  },
  checkReadiness: async (root, settings) => { await checkCSharpReadiness(root, settings) },
  scan: scanCSharpSource,
} satisfies ScannerPlugin

export default scanner
