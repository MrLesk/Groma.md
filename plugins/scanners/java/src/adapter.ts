import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseScanObservation, type ScanObservation } from '@groma/scanner'
import { configFile, readJavaInput } from './config.ts'

const worker = fileURLToPath(new URL('../dist/worker.jar', import.meta.url))
const bundledRuntime = fileURLToPath(new URL('../dist/runtime', import.meta.url))

export interface JavaScanOptions {
  java?: string
  worker?: string
  timeout?: number
}

export function isJavaScanFile(file: string): boolean {
  return file === configFile || /\.(?:java|jar)$/.test(file)
}

async function javaCommand(explicit?: string): Promise<string> {
  if (explicit) return explicit
  const executable = process.platform === 'win32' ? 'java.exe' : 'java'
  if (process.env.GROMA_JAVA_HOME) return path.join(process.env.GROMA_JAVA_HOME, 'bin', executable)
  const bundled = path.join(bundledRuntime, 'bin', executable)
  try { await access(bundled); return bundled }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  return process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', executable) : executable
}

function run(java: string, args: string[], root: string, files: string[], timeout: number): Promise<string> {
  const env = { ...process.env }
  // Compiler behavior must not be changed by ambient launcher options or classpaths.
  for (const key of ['JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS', 'CLASSPATH']) delete env[key]
  return new Promise((resolve, reject) => {
    const child = execFile(java, args, {
      cwd: root, env, encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr.trim() || error.message
        reject(new Error(`Java scanner failed (no observation): ${detail}. Use the runtime-bundled package or set GROMA_JAVA_HOME to a JDK 21+ installation.`))
      } else resolve(stdout)
    })
    child.stdin?.on('error', () => { /* execFile reports early worker termination. */ })
    child.stdin?.end(`${files.join('\n')}\n`)
  })
}

export async function scanJavaSource(repositoryRoot: string, options: JavaScanOptions = {}): Promise<ScanObservation | undefined> {
  const input = await readJavaInput(repositoryRoot)
  if (!input) return undefined
  const jar = options.worker ?? worker
  try { await access(jar) }
  catch { throw new Error('Java scanner worker is missing; build the local plugin with bun plugins/scanners/java/build.ts or install a packaged scanner') }
  const command = await javaCommand(options.java)
  const stdout = await run(command, [
    '-Xmx1024m', '-jar', jar, input.root, String(input.release), input.classpath.join(path.delimiter),
  ], input.root, input.files, options.timeout ?? 120000)
  return parseScanObservation(stdout)
}
