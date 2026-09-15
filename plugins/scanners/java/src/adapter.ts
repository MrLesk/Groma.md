import { fileURLToPath } from 'node:url'
import { parseScanObservation, type ScanObservation } from '@groma/scanner'
import { exists, readJavaInput } from './maven.ts'
import { run } from './process.ts'

const worker = fileURLToPath(new URL('../dist/worker.jar', import.meta.url))

export interface JavaScanOptions {
  worker?: string
  timeout?: number
}

export async function checkJavaReadiness(repositoryRoot: string, options: JavaScanOptions = {}) {
  const jar = options.worker ?? worker
  if (!await exists(jar)) throw new Error('JAVA_WORKER_MISSING: Install the packaged Java scanner, or build it with bun plugins/scanners/java/build.ts.')
  const command = fileURLToPath(new URL(`../dist/${process.platform}-${process.arch}/runtime/bin/java${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url))
  try {
    const modules = await run(command, ['--list-modules'], repositoryRoot)
    if (!modules.includes('jdk.compiler@')) throw new Error('The selected runtime has no Java compiler module.')
  }
  catch (error) { throw new Error(`JAVA_RUNTIME_MISSING: Reinstall the Java scanner with its bundled compiler runtime. ${error}`) }
  const input = await readJavaInput(repositoryRoot, command, jar)
  return { input, command, jar }
}

export async function scanJavaSource(repositoryRoot: string, options: JavaScanOptions = {}): Promise<ScanObservation | undefined> {
  const { input, command, jar } = await checkJavaReadiness(repositoryRoot, options)
  if (!input) return undefined
  let stdout: string
  try {
    stdout = await run(command, ['-Xmx1024m', '-jar', jar, input.root, input.release,
      input.encoding], input.root,
    `${input.files.join('\n')}\n`, options.timeout)
  } catch (error) {
    throw new Error(`JAVA_SOURCE_INVALID: No observation was produced. Check the declared Java language version and source syntax. ${error}`)
  }
  const observation = parseScanObservation(stdout)
  observation.roots[0]!.name = input.name
  return observation
}
