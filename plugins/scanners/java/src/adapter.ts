import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parseScanObservation, type ScanObservation } from '@groma/scanner'
import { exists, readJavaInput } from './maven.ts'
import { javaCommand, run } from './process.ts'

const worker = fileURLToPath(new URL('../dist/worker.jar', import.meta.url))

export interface JavaScanOptions {
  java?: string
  worker?: string
  maven?: string
  timeout?: number
}

export function isJavaScanFile(file: string): boolean {
  return file.endsWith('.java') || file === 'pom.xml' || file.startsWith('.mvn/')
}

export async function checkJavaReadiness(repositoryRoot: string, options: JavaScanOptions = {}) {
  const jar = options.worker ?? worker
  if (!await exists(jar)) throw new Error('JAVA_WORKER_MISSING: Install the packaged Java scanner, or build it with bun plugins/scanners/java/build.ts.')
  const command = options.java ?? javaCommand()
  try {
    const modules = await run(command, ['--list-modules'], repositoryRoot)
    if (!modules.includes('jdk.compiler@')) throw new Error('The selected runtime has no Java compiler module.')
  }
  catch (error) { throw new Error(`JAVA_JDK_MISSING: Install the project JDK (Java 25 for the supported example) and select it with JAVA_HOME. ${error}`) }
  const input = await readJavaInput(repositoryRoot, command, jar, options.maven)
  return { input, command, jar }
}

export async function scanJavaSource(repositoryRoot: string, options: JavaScanOptions = {}): Promise<ScanObservation> {
  const { input, command, jar } = await checkJavaReadiness(repositoryRoot, options)
  let stdout: string
  try {
    stdout = await run(command, ['-Xmx1024m', '-jar', jar, input.root, input.release,
      input.encoding, input.generatedRoot], input.root,
    `${input.classpath.join(path.delimiter)}\n${input.files.join('\n')}\n`, options.timeout)
  } catch (error) {
    throw new Error(`JAVA_COMPILATION_FAILED: No observation was produced. Use the project's declared JDK ${input.release}, resolve Maven dependencies, and prepare required generated sources with the project's documented build command. ${error}`)
  }
  const observation = parseScanObservation(stdout)
  observation.root.name = input.name
  observation.scopes[0]!.name = input.name
  return observation
}
