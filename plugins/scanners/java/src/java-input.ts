import { access, readFile, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { readGradleProject } from './gradle.ts'
import { mavenSourceRoots } from './maven.ts'
import { run } from './process.ts'

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

async function collect(root: string, directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(root, file))
    else if (entry.isFile() && file.endsWith('.java')) files.push(path.relative(root, file).split(path.sep).join('/'))
  }
  return files.sort()
}

/** The source root comes from maven.ts, which the listing shares; the worker reads the version, encoding and name. */
async function mavenProject(root: string, java: string, worker: string): Promise<JavaProject | undefined> {
  const pom = path.join(root, 'pom.xml')
  const sourceRoots = mavenSourceRoots(root, await readFile(pom, 'utf8'))
  if (sourceRoots.length === 0) return undefined
  const model = JSON.parse(await run(java, ['-jar', worker, 'model', pom], root)) as { release: string; encoding: string; name: string }
  return { release: model.release, encoding: model.encoding, sourceRoots, name: model.name, kind: 'maven-project', file: 'pom.xml' }
}

/** A directory with pom.xml is a Maven project; every other selected directory is a Gradle project. */
export async function readJavaInput(repositoryRoot: string, java: string, worker: string): Promise<JavaInput | undefined> {
  const root = await realpath(repositoryRoot)
  const project = await exists(path.join(root, 'pom.xml'))
    ? await mavenProject(root, java, worker)
    : { release: '', ...await readGradleProject(root), encoding: 'UTF-8', kind: 'gradle-project' as const }
  if (!project) return undefined
  const { sourceRoots, ...input } = project
  const found = await Promise.all(sourceRoots.map(async sourceRoot => {
    const directory = path.resolve(root, sourceRoot)
    return await exists(directory) ? collect(root, directory) : []
  }))
  const files = [...new Set(found.flat())].sort()
  if (!files.length) return undefined
  return { ...input, root, files }
}
