import type { ScannerPlugin } from '@groma/scanner'
import { buildDirectories } from './model.ts'
import type { ModelLoader } from './model.ts'

export type { BuildSelection, GromaModel, GromaModelProject, ModelLoader, SelectedProject } from './model.ts'
export {
  buildDirectories, filesForBuild, owningBuildDirectory, parseGromaModel, selectBuildSources, sbtVersionGate,
} from './model.ts'
export { definitionHash, definitionPaths } from './cache.ts'

/** Placeholder until step 4 wires the sbt launcher. Tests inject a loader. */
async function unavailableModelLoader(): Promise<never> {
  throw new Error('SCALA_SBT_UNAVAILABLE: The Scala scanner sbt integration is not installed yet.')
}

export function createScalaScanner(_loadModel: ModelLoader = unavailableModelLoader): ScannerPlugin {
  return {
    id: 'scala',
    async scan(_repositoryRoot, _settings, files) {
      if (buildDirectories(files).length === 0) return undefined
      return undefined
    },
  }
}

export default createScalaScanner()
