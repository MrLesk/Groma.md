import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { combineObservations } from '../../observations.ts'
import { repositoryFiles } from '../../projects.ts'
import { parseScanObservation, type CodeFile, type ScanObservation, type ScannerPlugin, type ScannerSettings } from '@groma/scanner'
import {
  execute, exists, noExclusions, readRustProject, rustProjects, rustSourceFiles, type RustOptions,
} from './project.ts'

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
  return { input: await readRustProject(root, settings, options.excluded), worker }
}

/**
 * Scans one Cargo project. The worker follows module declarations on disk and cannot call the exclusion predicate, so
 * it receives the repository's Rust files that `options.excluded` names, and reads none of them.
 */
export async function scanRustSource(
  repositoryRoot: string, settings: ScannerSettings = {}, options: RustOptions = {},
): Promise<ScanObservation> {
  const { input, worker } = await checkRustReadiness(repositoryRoot, settings, options)
  const { excluded } = options
  const excludedFiles = excluded ? await repositoryFiles(input.root, file => file.endsWith('.rs') && excluded(file)) : []
  try {
    return parseScanObservation(await runWorker(worker, [], { ...input, excluded: excludedFiles }, path.dirname(input.manifest)))
  } catch (error) {
    throw new Error(`RUST_ANALYSIS_FAILED: No observation was produced. Check the selected Cargo project and the engine diagnostic. ${error}`)
  }
}

/** Runs the native worker with JSON on stdin and returns its JSON output. */
async function runWorker(worker: string, args: string[], input: unknown, cwd: string): Promise<string> {
  const pending = execute(worker, args, {
    cwd, encoding: 'utf8', timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024, killSignal: 'SIGKILL', windowsHide: true,
  })
  pending.child.stdin?.end(JSON.stringify(input))
  return (await pending).stdout
}

const scanner = {
  id: 'rust',
  watch: {
    include: ['**/*.rs', '**/Cargo.toml', '**/Cargo.lock',
      '**/rust-toolchain', '**/rust-toolchain.toml', '**/.cargo/**'],
    exclude: [],
  },
  listSourceFiles: (root, settings = {}) => rustSourceFiles(root, settings),
  checkReadiness: async (root, settings = {}, excluded = noExclusions) => {
    const projects = await rustProjects(root, settings, excluded)
    if (!projects.length) throw new Error('RUST_PROJECT_MISSING: No Cargo.toml was found outside the excluded paths.')
    for (const manifest of projects) await checkRustReadiness(root, { ...settings, manifest }, { excluded })
  },
  // Each file is parsed alone, so the outline needs no Cargo project.
  readCodeStructure: async (root, references): Promise<CodeFile[]> => {
    if (references.length === 0) return []
    return JSON.parse(await runWorker(executable, ['outline'], { root, references }, root))
  },
  scan: async (root, settings = {}, excluded = noExclusions) => {
    const parts = []
    for (const manifest of await rustProjects(root, settings, excluded)) {
      const observation = await scanRustSource(root, { ...settings, manifest }, { excluded })
      parts.push({ key: path.relative(root, manifest).split(path.sep).join('/'), observation })
    }
    return combineObservations(parts)
  },
} satisfies ScannerPlugin

export default scanner
