import { execFile } from 'node:child_process'
import { access, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScanObservation, type ScanObservation } from '@groma/scanner'

const packagedWorker = fileURLToPath(new URL(`../dist/worker${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url))

export interface GoScanOptions {
  go?: string
  worker?: string
}

export function run(command: string, args: string[], root: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: root, env, encoding: 'utf8', timeout: 120000,
      killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || stdout.trim() || error.message))
      else resolve(stdout)
    })
  })
}

export async function checkGoReadiness(repositoryRoot: string, options: GoScanOptions = {}) {
  const root = await realpath(repositoryRoot)
  const worker = options.worker ?? packagedWorker
  try { await access(worker) }
  catch { throw new Error('GO_WORKER_MISSING: Install the packaged Go scanner for this platform, or build it with bun plugins/scanners/go/build.ts.') }
  const env: NodeJS.ProcessEnv = { ...process.env, GOTOOLCHAIN: 'local', GOPROXY: 'off', GOSUMDB: 'off' }
  let context: { GOMOD: string; GOWORK: string; GOROOT: string }
  try {
    context = JSON.parse(await run(options.go ?? 'go', ['env', '-json', 'GOMOD', 'GOWORK', 'GOROOT'], root, env))
  } catch (error) {
    throw new Error(`GO_TOOLCHAIN_MISSING: Install the project's Go toolchain and add its bin directory to PATH (Go 1.27.1 for the qualified example). ${error}`)
  }
  if (context.GOWORK && context.GOWORK !== 'off') {
    throw new Error('GO_PROJECT_SCOPE: This scanner supports one root module. Select the supported module with GOWORK=off; workspace analysis is not qualified.')
  }
  if (context.GOMOD !== path.join(root, 'go.mod')) {
    throw new Error('GO_PROJECT_SCOPE: Run Groma at the supported Go module root containing go.mod.')
  }
  env.PATH = `${path.join(context.GOROOT, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`
  try { await run(options.go ?? 'go', ['list', '-mod=readonly', '-deps', './...'], root, env) }
  catch (error) {
    throw new Error(`GO_PROJECT_PREPARATION: Prepare dependencies and generated source with the project's documented build commands (go mod download for module dependencies), then retry. Scan does not download tools or modules. ${error}`)
  }
  return { root, worker, env }
}

export async function scanGoSource(repositoryRoot: string, options: GoScanOptions = {}): Promise<ScanObservation> {
  const { root, worker, env } = await checkGoReadiness(repositoryRoot, options)
  try { return parseScanObservation(await run(worker, [root], root, env)) }
  catch (error) { throw new Error(`GO_COMPILATION_FAILED: No observation was produced. Correct compilation errors with the project's Go toolchain and prepare its dependencies and generated source. ${error}`) }
}
