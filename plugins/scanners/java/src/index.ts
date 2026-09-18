import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { projectFiles } from '../../projects.ts'
import { projectScanner } from '../../project-scanner.ts'
import type { ScannerPlugin } from '@groma/scanner'
import { checkJavaReadiness, readJavaOutline, scanJavaSource } from './adapter.ts'
import { buildScripts, gradleProjects, readGradleProject, settingsScripts, withGradleDiagnostics } from './gradle.ts'

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

/** Maven's declared source directory, or the convention; a Gradle build states its own roots. */
async function sourceRoots(directory: string): Promise<string[]> {
  const pom = await readFile(path.join(directory, 'pom.xml'), 'utf8').catch(() => undefined)
  if (pom === undefined) return (await readGradleProject(directory)).sourceRoots
  const declared = /<sourceDirectory>([^<]+)<\/sourceDirectory>/.exec(pom)?.[1]?.trim()
  return [declared?.replace(/^\$\{project\.basedir\}\//, '') ?? 'src/main/java']
}

/** The compiler reads each project's source roots, never its test sources or generated output. */
async function javaSources(root: string): Promise<string[]> {
  const { directories } = await javaProjects(root)
  const roots: string[] = []
  for (const directory of directories) {
    const project = path.relative(root, directory).split(path.sep).join('/')
    for (const source of await sourceRoots(directory)) roots.push(path.posix.join(project, source))
  }
  return projectFiles(root, file => file.endsWith('.java') && roots.some(source => file.startsWith(`${source}/`)))
}

export default {
  ...projectScanner(scanner, async root => (await javaProjects(root)).directories),
  listSourceFiles: javaSources,
  scan: async (root, settings) => {
    const projects = await javaProjects(root)
    const observation = await projectScanner(scanner, async () => projects.directories).scan(root, settings)
    return withGradleDiagnostics(observation, projects.diagnostics)
  },
} satisfies ScannerPlugin
