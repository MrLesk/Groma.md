import { access, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { run } from './process.ts'

export interface JavaInput {
  root: string
  release: string
  encoding: string
  files: string[]
  name: string
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

export async function readJavaInput(repositoryRoot: string, java: string, worker: string): Promise<JavaInput | undefined> {
  const root = await realpath(repositoryRoot)
  const pom = path.join(root, 'pom.xml')
  if (!await exists(pom)) throw new Error('JAVA_UNSUPPORTED_BUILD: The Java scanner supports Maven pom.xml projects.')
  const model = JSON.parse(await run(java, ['-jar', worker, 'model', pom], root)) as {
    aggregator?: boolean; release: string; encoding: string; sourceRoot: string; name: string
  }
  if (model.aggregator) return undefined
  const sourceRoot = path.resolve(root, model.sourceRoot)
  const files = await exists(sourceRoot) ? await collect(root, sourceRoot) : []
  if (!files.length) return undefined
  return { root, release: model.release, encoding: model.encoding, name: model.name, files }
}
