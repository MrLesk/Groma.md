import path from 'node:path'
import type { ScannerPlugin, ScannerSettings } from '@groma/scanner'
import { projectScanner } from '../../project-scanner.ts'
import { checkScalaReadiness, readScalaOutline } from './adapter.ts'
import { buildDirectories } from './model.ts'
import type { ModelLoader } from './model.ts'
import { listScalaSourceFiles, scanScalaBuild } from './scan.ts'

export type { BuildSelection, GromaModel, GromaModelProject, ModelLoader, SelectedProject } from './model.ts'
export {
  buildDirectories, filesForBuild, owningBuildDirectory, parseGromaModel, selectBuildSources, sbtVersionGate,
} from './model.ts'
export { definitionHash, definitionPaths } from './cache.ts'

/** Placeholder until step 4 wires the sbt launcher. */
async function unavailableModelLoader(): Promise<never> {
  throw new Error('SCALA_SBT_UNAVAILABLE: The Scala scanner sbt integration is not installed yet.')
}

export function createScalaScanner(loadModel: ModelLoader = unavailableModelLoader): ScannerPlugin {
  let repositoryRoot = ''
  const selectBuilds = async (root: string, _settings: ScannerSettings, files: readonly string[]) => {
    repositoryRoot = root
    return buildDirectories(files).map(key => path.join(root, key.split('/').join(path.sep)))
  }
  const inner = {
    id: 'scala',
    checkReadiness: async () => { await checkScalaReadiness() },
    readCodeStructure: readScalaOutline,
    scan: async (projectRoot: string, _settings: ScannerSettings, files: readonly string[]) => {
      if (files.length === 0) return undefined
      const buildKey = path.relative(repositoryRoot, projectRoot).split(path.sep).join('/')
      return scanScalaBuild(repositoryRoot, buildKey === '.' ? '' : buildKey, files, loadModel)
    },
  } satisfies ScannerPlugin

  return {
    ...projectScanner(inner, selectBuilds),
    listSourceFiles: async (root, _settings, candidates) => listScalaSourceFiles(root, candidates, loadModel),
  }
}

export default createScalaScanner()
