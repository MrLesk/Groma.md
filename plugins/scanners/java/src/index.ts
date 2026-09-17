import path from 'node:path'
import { projectFiles } from '../../projects.ts'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkJavaReadiness, readJavaOutline, scanJavaSource } from './adapter.ts'
import { buildScripts, gradleProjects, settingsScripts, withGradleDiagnostics } from './gradle.ts'

const scanner = {
  id: 'java',
  watch: {
    include: ['**/*.java', '**/pom.xml', '**/.mvn/**', ...[...buildScripts, ...settingsScripts].map(file => `**/${file}`)],
    exclude: [],
  },
  checkReadiness: async root => { await checkJavaReadiness(root) },
  readCodeStructure: readJavaOutline,
  scan: scanJavaSource,
} satisfies ScannerPlugin

/** Maven and Gradle project directories, with the Gradle declarations only a Gradle run could resolve. */
async function javaProjects(root: string) {
  const maven = await projectFiles(root, file => path.posix.basename(file) === 'pom.xml')
  const gradle = await gradleProjects(root)
  const directories = new Set([...maven.map(file => path.dirname(path.join(root, file))), ...gradle.directories])
  return { directories: [...directories].sort(), diagnostics: gradle.diagnostics }
}

export default {
  ...projectScanner(scanner, async root => (await javaProjects(root)).directories),
  scan: async (root, settings) => {
    const projects = await javaProjects(root)
    const observation = await projectScanner(scanner, async () => projects.directories).scan(root, settings)
    return withGradleDiagnostics(observation, projects.diagnostics)
  },
} satisfies ScannerPlugin
