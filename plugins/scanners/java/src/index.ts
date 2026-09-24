import path from 'node:path'
import { projectScanner, within } from '../../project-scanner.ts'
import type { ScannerPlugin, ScannerSettings } from '@groma/scanner'
import { checkJavaReadiness, readJavaOutline, scanJavaSource } from './adapter.ts'
import { gradleProjects, withGradleDiagnostics } from './gradle.ts'
import { readJavaInput } from './java-input.ts'
import { summarizeMissingTypes } from './missing-types.ts'

const scanner = {
  id: 'java',
  checkReadiness: async (root, _settings, files) => { await checkJavaReadiness(root, {}, files) },
  readCodeStructure: readJavaOutline,
  scan: scanJavaSource,
} satisfies ScannerPlugin

/** Maven and Gradle project directories among the files, with the Gradle declarations only a Gradle run could resolve. */
async function javaProjects(root: string, files: readonly string[]) {
  const maven = files.filter(file => path.posix.basename(file) === 'pom.xml')
  const gradle = await gradleProjects(root, files)
  const directories = new Set([...maven.map(file => path.dirname(path.join(root, file))), ...gradle.directories])
  return { directories: [...directories].sort(), diagnostics: gradle.diagnostics }
}

/**
 * The files the build compiles, before exclusions: the candidates under each project's main source roots, never its
 * test sources, read the way the scan reads them.
 */
async function javaSources(root: string, _settings: ScannerSettings, candidates: readonly string[]): Promise<string[]> {
  const sources = new Set<string>()
  for (const directory of (await javaProjects(root, candidates)).directories) {
    const project = within(root, directory, candidates)
    const input = await readJavaInput(directory, project.files)
    for (const file of input?.files ?? []) sources.add(path.posix.join(project.key, file))
  }
  return [...sources].sort()
}

export default {
  ...projectScanner(scanner, async (root, _settings, files) => (await javaProjects(root, files)).directories),
  listSourceFiles: javaSources,
  scan: async (root, settings, files) => {
    const projects = await javaProjects(root, files)
    const observation = await projectScanner(scanner, async () => projects.directories).scan(root, settings, files)
    return withGradleDiagnostics(summarizeMissingTypes(observation), projects.diagnostics)
  },
} satisfies ScannerPlugin
