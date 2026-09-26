import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { defaultScannerCacheRoot } from '../../../../src/scanner/modules/package.ts'
import type { GromaModel, ModelLoader } from './model.ts'
import { parseGromaModel } from './model.ts'

const buildFile = 'build.sbt'

function scalaCacheRoot(cacheRoot = defaultScannerCacheRoot()): string {
  return path.join(cacheRoot, 'scala')
}

/** Build-local scanner paths as repository-relative paths for hashing. */
export function repositoryRelativeFiles(buildKey: string, buildFiles: readonly string[]): string[] {
  if (buildKey === '') return [...buildFiles]
  return buildFiles.map(file => `${buildKey}/${file}`)
}

function modelCacheDirectory(buildRoot: string, cacheRoot = defaultScannerCacheRoot()): string {
  const id = createHash('sha256').update(path.resolve(buildRoot)).digest('hex')
  return path.join(scalaCacheRoot(cacheRoot), 'groma-model', id)
}

function modelCacheFile(buildRoot: string, definitionKey: string, cacheRoot = defaultScannerCacheRoot()): string {
  return path.join(modelCacheDirectory(buildRoot, cacheRoot), `${definitionKey}.json`)
}

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

async function readCachedModel(
  buildRoot: string,
  definitionKey: string,
  cacheRoot = defaultScannerCacheRoot(),
): Promise<GromaModel | undefined> {
  const file = modelCacheFile(buildRoot, definitionKey, cacheRoot)
  if (!existsSync(file)) return undefined
  return parseGromaModel(await readFile(file, 'utf8'))
}

async function writeCachedModel(
  buildRoot: string,
  definitionKey: string,
  model: GromaModel,
  cacheRoot = defaultScannerCacheRoot(),
): Promise<void> {
  const file = modelCacheFile(buildRoot, definitionKey, cacheRoot)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(model))
}

/**
 * Cache `gromaModel` JSON on disk under the scanner cache. The key is the absolute build root
 * plus a hash of build-definition files among the scanner's paths.
 */
export function createCachedModelLoader(
  load: ModelLoader,
  cacheRoot = defaultScannerCacheRoot(),
): ModelLoader {
  return async (repositoryRoot, buildKey, buildFiles) => {
    const buildRoot = path.join(repositoryRoot, buildKey.split('/').join(path.sep))
    const repoFiles = repositoryRelativeFiles(buildKey, buildFiles)
    const key = await definitionHash(repositoryRoot, buildKey, repoFiles)
    const cached = await readCachedModel(buildRoot, key, cacheRoot)
    if (cached !== undefined) return cached
    const model = await load(repositoryRoot, buildKey, buildFiles)
    await writeCachedModel(buildRoot, key, model, cacheRoot)
    return model
  }
}
