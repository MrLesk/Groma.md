import path from 'node:path'
import type { ScannerPlugin, ScannerSettings } from '@groma/scanner'
import { projectScanner } from '../../project-scanner.ts'
import { checkScalaReadiness, readScalaOutline } from './adapter.ts'
import { buildDirectories } from './model.ts'
import type { ModelLoader } from './model.ts'
import { listScalaSourceFiles, scanScalaBuild } from './scan.ts'
import { createCachedModelLoader } from './cache.ts'
import { loadGromaModel } from './sbt.ts'

export type { BuildSelection, GromaModel, GromaModelProject, ModelLoader, SelectedProject } from './model.ts'
export {
  buildDirectories, filesForBuild, owningBuildDirectory, parseGromaModel, selectBuildSources, sbtVersionGate,
} from './model.ts'
export { createCachedModelLoader, definitionHash, definitionPaths, repositoryRelativeFiles } from './cache.ts'
export { loadGromaModel } from './sbt.ts'

export type ModelLoaderFactory = (settings: ScannerSettings) => ModelLoader

function defaultModelLoader(settings: ScannerSettings): ModelLoader {
  return createCachedModelLoader(
    (repositoryRoot, buildKey, buildFiles) => loadGromaModel(repositoryRoot, buildKey, buildFiles, settings),
  )
}

async function scanBuild(
  repositoryRoot: string,
  buildKey: string,
  files: readonly string[],
  loadModel: ModelLoader,
): Promise<Awaited<ReturnType<typeof scanScalaBuild>>> {
  try {
    return await scanScalaBuild(repositoryRoot, buildKey, files, loadModel)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SCALA_SBT_FAILED:')) return undefined
    throw error
  }
}

export function createScalaScanner(modelLoader: ModelLoaderFactory = defaultModelLoader): ScannerPlugin {
  let repositoryRoot = ''
  const selectBuilds = async (root: string, _settings: ScannerSettings, files: readonly string[]) => {
    repositoryRoot = root
    return buildDirectories(files).map(key => path.join(root, key.split('/').join(path.sep)))
  }
  const inner = {
    id: 'scala',
    checkReadiness: async () => { await checkScalaReadiness() },
    readCodeStructure: readScalaOutline,
    scan: async (projectRoot: string, settings: ScannerSettings, files: readonly string[]) => {
      if (files.length === 0) return undefined
      const buildKey = path.relative(repositoryRoot, projectRoot).split(path.sep).join('/')
      return scanBuild(repositoryRoot, buildKey === '.' ? '' : buildKey, files, modelLoader(settings))
    },
  } satisfies ScannerPlugin

  return {
    ...projectScanner(inner, selectBuilds),
    listSourceFiles: async (root, settings, candidates) => listScalaSourceFiles(root, candidates, modelLoader(settings)),
  }
}

export default createScalaScanner()
