import path from 'node:path'
import type { ScannerPlugin, ScannerSettings } from '@groma/scanner'
import { combineObservations, relocateObservation } from './observations.ts'

/** Adapt project-local compiler entry points to one repository scan. */
export function projectScanner(scanner: ScannerPlugin,
  select: (root: string, settings: ScannerSettings) => Promise<string[]>): ScannerPlugin {
  return { ...scanner,
    checkReadiness: async (root, settings = {}) => {
      const projects = await select(root, settings)
      if (!projects.length) throw new Error(`${scanner.id}: No supported project declaration was found.`)
      for (const project of projects) await scanner.checkReadiness?.(project, settings)
    },
    scan: async (root, settings = {}) => {
      const parts = []
      for (const project of await select(root, settings)) {
        const observation = await scanner.scan(project, settings)
        const key = path.relative(root, project).split(path.sep).join('/')
        if (observation) parts.push({ key, observation: relocateObservation(observation, key) })
      }
      return combineObservations(parts)
    },
  }
}
