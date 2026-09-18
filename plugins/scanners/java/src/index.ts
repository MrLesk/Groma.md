import path from 'node:path'
import { isUnder, projectFiles, repositoryFiles } from '../../projects.ts'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkJavaReadiness, readJavaOutline, scanJavaSource } from './adapter.ts'
import { buildScripts, gradleProjects, settingsScripts, withGradleDiagnostics } from './gradle.ts'
import { readJavaProject } from './java-input.ts'
import { summarizeMissingTypes } from './missing-types.ts'

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

/** The compiler reads every file under each project's source roots, never its test sources. */
async function javaSources(root: string): Promise<string[]> {
  const { directories } = await javaProjects(root)
  const roots: string[] = []
  for (const directory of directories) {
    for (const source of (await readJavaProject(directory))?.sourceRoots ?? []) {
      roots.push(path.relative(root, path.resolve(directory, source)).split(path.sep).join('/'))
    }
  }
  // A declared root is read whole, even inside a build or generated directory.
  return repositoryFiles(root, file => file.endsWith('.java') && roots.some(source => isUnder(file, source)))
}

export default {
  ...projectScanner(scanner, async root => (await javaProjects(root)).directories),
  listSourceFiles: javaSources,
  scan: async (root, settings) => {
    const projects = await javaProjects(root)
    const observation = await projectScanner(scanner, async () => projects.directories).scan(root, settings)
    return withGradleDiagnostics(summarizeMissingTypes(observation), projects.diagnostics)
  },
} satisfies ScannerPlugin
