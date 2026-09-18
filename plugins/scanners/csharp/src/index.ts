import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { csharpInputs } from './config.ts'
import { projectFiles } from '../../projects.ts'
import { combineObservations } from '../../observations.ts'
import type { ScannerPlugin } from '@groma/scanner'

import { checkCSharpReadiness, readCSharpOutline, scanCSharpSource } from './adapter.ts'
export { checkCSharpReadiness } from './adapter.ts'

/** A project input is itself; a solution names its projects in text, so no build runs. */
async function solutionProjects(input: string): Promise<string[]> {
  if (/\.csproj$/i.test(input)) return [input]
  const source = await readFile(input, 'utf8')
  return [...source.matchAll(/"([^"]+\.csproj)"|Path="([^"]+\.csproj)"/gi)]
    .map(match => path.resolve(path.dirname(input), (match[1] ?? match[2]!).split('\\').join('/')))
}

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
  /** Project directories come from the configured inputs; MSBuild item globs are not evaluated. */
  listSourceFiles: async (root, settings = {}) => {
    const directories: string[] = []
    for (const input of await csharpInputs(root, settings)) {
      for (const project of await solutionProjects(input)) {
        directories.push(path.relative(root, path.dirname(project)).split(path.sep).join('/'))
      }
    }
    return projectFiles(root, file => /\.cs$/i.test(file)
      && !file.split('/').some(part => /^(?:bin|obj)$/i.test(part))
      && directories.some(directory => directory === '' || file.startsWith(`${directory}/`)))
  },
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
