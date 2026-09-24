import path from 'node:path'
import type { ScannerPlugin, ScannerSettings } from '@groma/scanner'
import { combineObservations, relocateObservation } from './observations.ts'

type Excluded = (file: string) => boolean

const none: Excluded = () => false

/** A project's folder in the repository, and the host's exclusions for the project-relative paths a project scan reads. */
function within(root: string, project: string, excluded: Excluded): { key: string; excluded: Excluded } {
  const key = path.relative(root, project).split(path.sep).join('/')
  return { key, excluded: file => excluded(path.posix.join(key, file)) }
}

/**
 * Adapt project-local compiler entry points to one repository scan. The host's exclusions select the projects and reach
 * each project's readiness check and scan as paths inside that project.
 */
export function projectScanner(scanner: ScannerPlugin,
  select: (root: string, settings: ScannerSettings, excluded: Excluded) => Promise<string[]>): ScannerPlugin {
  return { ...scanner,
    checkReadiness: async (root, settings = {}, excluded = none) => {
      const projects = await select(root, settings, excluded)
      if (!projects.length) throw new Error(`${scanner.id}: No supported project declaration was found.`)
      for (const project of projects) await scanner.checkReadiness?.(project, settings, within(root, project, excluded).excluded)
    },
    scan: async (root, settings = {}, excluded = none) => {
      const parts = []
      for (const project of await select(root, settings, excluded)) {
        const local = within(root, project, excluded)
        const observation = await scanner.scan(project, settings, local.excluded)
        if (observation) parts.push({ key: local.key, observation: relocateObservation(observation, local.key) })
      }
      return combineObservations(parts)
    },
  }
}
