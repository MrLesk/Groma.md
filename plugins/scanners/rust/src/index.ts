import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { parseScanObservation, type ScanObservation, type ScannerPlugin, type ScannerSettings } from '@groma/scanner'
import { checkRustToolchain, execute, exists, readRustProject, type RustOptions } from './project.ts'

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
  await checkRustToolchain(root, options)
  return { input: await readRustProject(root, settings, options), worker }
}

export async function scanRustSource(
  repositoryRoot: string, settings: ScannerSettings = {}, options: RustOptions = {},
): Promise<ScanObservation> {
  const { input, worker } = await checkRustReadiness(repositoryRoot, settings, options)
  try {
    const pending = execute(worker, [], {
      cwd: input.root, encoding: 'utf8', timeout: 120_000,
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
  checkReadiness: async (root, settings) => { await checkRustReadiness(root, settings) },
  scan: scanRustSource,
} satisfies ScannerPlugin

export default scanner
