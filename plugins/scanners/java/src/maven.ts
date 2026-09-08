import { access, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { mavenInvocation, run } from './process.ts'

export interface JavaInput {
  root: string
  release: string
  encoding: string
  classpath: string[]
  files: string[]
  generatedRoot: string
  name: string
}

export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function collect(root: string, directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(root, file))
    else if (entry.isFile() && file.endsWith('.java')) files.push(path.relative(root, file).split(path.sep).join('/'))
  }
  return files.sort()
}

export async function mavenCommand(root: string): Promise<string> {
  const wrapper = path.join(root, process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw')
  return await exists(wrapper) ? wrapper : process.platform === 'win32' ? 'mvn.cmd' : 'mvn'
}

export const mavenGoals = ['org.apache.maven.plugins:maven-help-plugin:3.5.1:effective-pom',
  'org.apache.maven.plugins:maven-dependency-plugin:3.9.0:build-classpath']

export async function readJavaInput(repositoryRoot: string, java: string, worker: string, maven?: string): Promise<JavaInput> {
  const root = await realpath(repositoryRoot)
  if (!await exists(path.join(root, 'pom.xml'))) {
    throw new Error('JAVA_UNSUPPORTED_BUILD: The Java scanner supports a root single-module Maven pom.xml. Gradle and other build arrangements are not supported.')
  }
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-java-model-'))
  try {
    const model = path.join(temporary, 'pom.xml')
    const classpath = path.join(temporary, 'classpath.txt')
    const command = maven ?? await mavenCommand(root)
    const args = ['--offline', '--batch-mode', '--no-transfer-progress', '--non-recursive', ...mavenGoals,
      `-Doutput=${model}`, `-Dmdep.outputFile=${classpath}`, '-DincludeScope=compile']
    try { await run(...mavenInvocation(command, args), root) }
    catch (error) {
      throw new Error(`JAVA_MAVEN_PREPARATION: Install the project JDK and Maven (or use its wrapper), then run ${command} ${mavenGoals.join(' ')} -DincludeScope=compile once with dependency access. Scans use Maven offline. ${error instanceof Error ? error.message : error}`)
    }
    const exported = JSON.parse(await run(java, ['-jar', worker, 'model', model], root)) as {
      release: string; encoding: string; sourceRoot: string; generatedRoot: string; output: string; name: string
    }
    const files = await collect(root, exported.sourceRoot)
    if (!files.length) throw new Error('JAVA_EMPTY_SOURCE_SET: Maven main source directory contains no Java sources.')
    if (files.some(file => file.endsWith('module-info.java'))) throw new Error('JAVA_UNSUPPORTED_BUILD: JPMS module paths are not supported.')
    const dependencies = (await readFile(classpath, 'utf8')).trim().split(path.delimiter).filter(Boolean)
    if (await exists(exported.output)) dependencies.push(exported.output)
    return { root, release: exported.release, encoding: exported.encoding, name: exported.name, files,
      classpath: dependencies, generatedRoot: await exists(exported.generatedRoot) ? exported.generatedRoot : '' }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
