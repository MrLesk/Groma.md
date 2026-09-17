import { execFile } from 'node:child_process'
import { access, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScanObservation, type CodeFile, type ScanObservation, type SourceReference } from '@groma/scanner'

const packagedWorker = fileURLToPath(new URL(`../dist/${process.platform}-${process.arch}/worker${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url))

export interface GoScanOptions {
  worker?: string
}

export function run(command: string, args: string[], root: string,
  { env = process.env, input }: { env?: NodeJS.ProcessEnv; input?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { cwd: root, env, encoding: 'utf8', timeout: 120000,
      killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || stdout.trim() || error.message))
      else resolve(stdout)
    })
    if (input !== undefined) child.stdin?.end(input)
  })
}

async function workerPath(options: GoScanOptions): Promise<string> {
  const worker = options.worker ?? packagedWorker
  try { await access(worker) }
  catch { throw new Error('GO_WORKER_MISSING: Install the packaged Go scanner for this platform, or build it with bun plugins/scanners/go/build.ts.') }
  return worker
}

export async function checkGoReadiness(repositoryRoot: string, options: GoScanOptions = {}) {
  const root = await realpath(repositoryRoot)
  const worker = await workerPath(options)
  await access(path.join(root, 'go.mod'))
  return { root, worker }
}

/** The worker parses each referenced file and applies the shared outline rules. */
export async function readGoCodeStructure(repositoryRoot: string, references: readonly SourceReference[],
  options: GoScanOptions = {}): Promise<CodeFile[]> {
  const worker = await workerPath(options)
  return JSON.parse(await run(worker, ['outline', repositoryRoot], repositoryRoot, { input: JSON.stringify(references) }))
}

export async function scanGoSource(repositoryRoot: string, options: GoScanOptions = {}): Promise<ScanObservation> {
  const { root, worker } = await checkGoReadiness(repositoryRoot, options)
  try { return parseScanObservation(await run(worker, [root], root)) }
  catch (error) { throw new Error(`GO_SOURCE_INVALID: No observation was produced. Check Go source syntax and module declarations. ${error}`) }
}
