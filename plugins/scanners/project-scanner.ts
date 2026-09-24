import path from 'node:path'
import type { ScannerPlugin, ScannerSettings } from '@groma/scanner'
import { combineObservations, relocateObservation } from './observations.ts'

/** A project's folder in the repository, and the scanner's files inside it as paths relative to that folder. */
export function within(root: string, project: string, files: readonly string[]): { key: string; files: string[] } {
  const key = path.relative(root, project).split(path.sep).join('/')
  if (key === '') return { key, files: [...files] }
  return { key, files: files.flatMap(file => file.startsWith(`${key}/`) ? [file.slice(key.length + 1)] : []) }
}

/**
 * Adapt project-local compiler entry points to one repository scan. The scanner's files select the projects and reach
 * each project's readiness check and scan as paths inside that project.
 */
export function projectScanner(scanner: ScannerPlugin,
  select: (root: string, settings: ScannerSettings, files: readonly string[]) => Promise<string[]>): ScannerPlugin {
  return { ...scanner,
    checkReadiness: async (root, settings, files) => {
      const projects = await select(root, settings, files)
      if (!projects.length) throw new Error(`${scanner.id}: No supported project declaration was found.`)
      for (const project of projects) await scanner.checkReadiness?.(project, settings, within(root, project, files).files)
    },
    scan: async (root, settings, files) => {
      const parts = []
      for (const project of await select(root, settings, files)) {
        const local = within(root, project, files)
        const observation = await scanner.scan(project, settings, local.files)
        if (observation) parts.push({ key: local.key, observation: relocateObservation(observation, local.key) })
      }
      return combineObservations(parts)
    },
  }
}
