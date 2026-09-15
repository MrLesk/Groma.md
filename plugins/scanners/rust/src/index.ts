import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { combineObservations } from '../../observations.ts'
import { parseScanObservation, type ScanObservation, type ScannerPlugin, type ScannerSettings } from '@groma/scanner'
import { execute, exists, readRustProject, rustProjects, type RustOptions } from './project.ts'

const executable = fileURLToPath(new URL(
  `../dist/bin/${process.platform}-${process.arch}/groma-rust-scanner${process.platform === 'win32' ? '.exe' : ''}`,
  import.meta.url,
))

export async function checkRustReadiness(repositoryRoot: string, settings: ScannerSettings = {}, options: RustOptions = {}) {
  const root = path.resolve(repositoryRoot)
  const worker = options.worker ?? executable
  if (!await exists(worker)) {
    throw new Error('RUST_WORKER_MISSING: Install the packaged Rust scanner, or build it with bun plugins/scanners/rust/build.ts.')
  }
  return { input: await readRustProject(root, settings), worker }
}

export async function scanRustSource(
  repositoryRoot: string, settings: ScannerSettings = {}, options: RustOptions = {},
): Promise<ScanObservation> {
  const { input, worker } = await checkRustReadiness(repositoryRoot, settings, options)
  return runRust(input, worker)
}

async function runRust(input: Awaited<ReturnType<typeof readRustProject>>, worker: string): Promise<ScanObservation> {
  try {
    const pending = execute(worker, [], {
      cwd: path.dirname(input.manifest), encoding: 'utf8', timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024, killSignal: 'SIGKILL', windowsHide: true,
    })
    pending.child.stdin?.end(JSON.stringify(input))
    const { stdout } = await pending
    return parseScanObservation(stdout)
  } catch (error) {
    throw new Error(`RUST_ANALYSIS_FAILED: No observation was produced. Check the selected Cargo project and the engine diagnostic. ${error}`)
  }
}

const scanner = {
  id: 'rust',
  watch: {
    include: ['**/*.rs', '**/Cargo.toml', '**/Cargo.lock',
      '**/rust-toolchain', '**/rust-toolchain.toml', '**/.cargo/**'],
    exclude: ['**/target/**', '**/node_modules/**', '**/.git/**', '**/vendor/**', '**/dist/**'],
  },
  checkReadiness: async (root, settings = {}) => {
    const projects = await rustProjects(root, settings)
    if (!projects.length) throw new Error('RUST_PROJECT_MISSING: No Cargo.toml was found.')
    for (const manifest of projects) await checkRustReadiness(root, { ...settings, manifest })
  },
  scan: async (root, settings = {}) => {
    const parts = []
    for (const manifest of await rustProjects(root, settings)) {
      const options = { ...settings, manifest }
      const { input, worker } = await checkRustReadiness(root, options)
      const observation = await runRust(input, worker)
      parts.push({ key: path.relative(root, manifest).split(path.sep).join('/'), observation })
    }
    return combineObservations(parts)
  },
} satisfies ScannerPlugin

export default scanner
