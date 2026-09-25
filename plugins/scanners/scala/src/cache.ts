import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const buildFile = 'build.sbt'

/** Repository-relative paths that invalidate a cached sbt model when their contents change. */
export function definitionPaths(buildKey: string, files: readonly string[]): string[] {
  const prefix = buildKey === '' ? '' : `${buildKey}/`
  const projectPrefix = `${prefix}project/`
  const paths: string[] = []
  for (const file of files) {
    if (file === `${prefix}${buildFile}`) paths.push(file)
    else if (file.startsWith(projectPrefix)) {
      const name = file.slice(projectPrefix.length)
      if (name === 'build.properties' || name === 'plugins.sbt' || name.endsWith('.sbt') || name.endsWith('.scala')) paths.push(file)
    }
  }
  return [...paths].sort()
}

/** Content hash of the build definition files among `files`. Source edits under `src/` are excluded. */
export async function definitionHash(repositoryRoot: string, buildKey: string, files: readonly string[]): Promise<string> {
  const digest = createHash('sha256')
  for (const file of definitionPaths(buildKey, files)) {
    digest.update(file)
    digest.update('\0')
    digest.update(await readFile(path.join(repositoryRoot, file)))
    digest.update('\0')
  }
  return digest.digest('hex')
}
