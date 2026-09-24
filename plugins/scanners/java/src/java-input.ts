import { access, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { isUnder } from '../../projects.ts'
import { readGradleProject } from './gradle.ts'
import { readMavenProject } from './maven.ts'

interface JavaProject {
  /** An empty release selects the bundled compiler's language version. */
  release: string
  encoding: string
  sourceRoots: string[]
  name: string
  kind: 'maven-project' | 'gradle-project'
  /** The build declaration, relative to the project directory. */
  file?: string
}

export interface JavaInput extends Omit<JavaProject, 'sourceRoots'> {
  root: string
  files: string[]
}

export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/**
 * A project whose files, relative to its directory, include a pom.xml is a Maven project, and any other a Gradle
 * project. Undefined for a Maven aggregator.
 */
async function readJavaProject(directory: string, files: readonly string[]): Promise<JavaProject | undefined> {
  if (!files.includes('pom.xml')) {
    return { release: '', ...await readGradleProject(directory, files), encoding: 'UTF-8', kind: 'gradle-project' }
  }
  const maven = readMavenProject(directory, await readFile(path.join(directory, 'pom.xml'), 'utf8'))
  return maven && { ...maven, kind: 'maven-project', file: 'pom.xml' }
}

/**
 * The project's declarations and the Java files among its files, which are relative to its directory, that lie under
 * its main source roots. The scan and the source listing both read a project here.
 */
export async function readJavaInput(projectRoot: string, files: readonly string[]): Promise<JavaInput | undefined> {
  const root = await realpath(projectRoot)
  const project = await readJavaProject(root, files)
  if (!project) return undefined
  const { sourceRoots, ...input } = project
  // Each root as a folder of the project, where '' is the project directory itself.
  const folders = sourceRoots.map(sourceRoot => path.relative(root, path.resolve(root, sourceRoot)).split(path.sep).join('/'))
  const sources = files.filter(file => file.endsWith('.java') && folders.some(folder => isUnder(file, folder)))
  if (!sources.length) return undefined
  return { ...input, root, files: sources }
}
