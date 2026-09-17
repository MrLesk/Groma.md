import path from 'node:path'
import { csharpInputs } from './config.ts'
import { combineObservations } from '../../observations.ts'
import type { ScannerPlugin } from '@groma/scanner'

import { checkCSharpReadiness, readCSharpOutline, scanCSharpSource } from './adapter.ts'
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
  checkReadiness: async (root, settings = {}) => {
    const inputs = await csharpInputs(root, settings)
    if (!inputs.length) throw new Error('No C# project or solution was found.')
    for (const input of inputs) await checkCSharpReadiness(root, { ...settings, input })
  },
  readCodeStructure: readCSharpOutline,
  scan: async (root, settings = {}) => {
    const parts = []
    const covered = new Set<string>()
    for (const input of await csharpInputs(root, settings)) {
      if (covered.has(input)) continue
      const observation = await scanCSharpSource(root, { ...settings, input })
      for (const project of observation.roots) if (project.file) covered.add(path.resolve(root, project.file))
      parts.push({ key: path.relative(root, input).split(path.sep).join('/'), observation })
    }
    return combineObservations(parts)
  },
} satisfies ScannerPlugin

export default scanner
