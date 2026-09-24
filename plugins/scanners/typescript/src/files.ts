import { repositoryFiles } from '../../projects.ts'

/**
 * The repository's `.ts` and `.tsx` sources, before the project's exclusions. A declaration file (`.d.ts`) only
 * describes types, so it is never a source.
 */
export function listTypeScriptFiles(repositoryRoot: string): Promise<string[]> {
  return repositoryFiles(repositoryRoot, file => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
}
