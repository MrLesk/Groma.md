import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { combineObservations } from '../../observations.ts'
import { parseScanObservation, type CodeFile, type ScanObservation, type ScannerPlugin, type ScannerSettings } from '@groma/scanner'
import { execute, exists, readRustProject, rustProjects, rustSourceFiles, type RustInput } from './project.ts'

const executable = fileURLToPath(new URL(
  `../dist/bin/${process.platform}-${process.arch}/groma-rust-scanner${process.platform === 'win32' ? '.exe' : ''}`,
  import.meta.url,
))

/** Checks that the worker is installed, and returns the crate graph of the Cargo project `settings.manifest` names. */
export async function checkRustReadiness(
  repositoryRoot: string, settings: ScannerSettings, files: readonly string[], worker = executable,
): Promise<RustInput> {
  if (!await exists(worker)) {
    throw new Error('RUST_WORKER_MISSING: Install the packaged Rust scanner, or build it with bun plugins/scanners/rust/build.ts.')
  }
  return readRustProject(path.resolve(repositoryRoot), settings, files)
}

/**
 * Scans one Cargo project. The worker follows module declarations on disk, so it receives the Rust files among the
 * scanner's files and reads no other module file.
 */
export async function scanRustSource(
  repositoryRoot: string, settings: ScannerSettings, files: readonly string[], worker = executable,
): Promise<ScanObservation> {
  const input = await checkRustReadiness(repositoryRoot, settings, files, worker)
  const sources = files.filter(file => file.endsWith('.rs'))
  try {
    return parseScanObservation(await runWorker(worker, [], { ...input, files: sources }, path.dirname(input.manifest)))
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
  listSourceFiles: rustSourceFiles,
  checkReadiness: async (root, settings, files) => {
    const projects = await rustProjects(root, settings, files)
    if (!projects.length) {
      throw new Error('RUST_PROJECT_MISSING: No Cargo project was found. The Rust scanner reads the Cargo.toml files among its files, or only the one settings.manifest names.')
    }
    for (const manifest of projects) await checkRustReadiness(root, { ...settings, manifest }, files)
  },
  // Each file is parsed alone, so the outline needs no Cargo project.
  readCodeStructure: async (root, references): Promise<CodeFile[]> => {
    if (references.length === 0) return []
    return JSON.parse(await runWorker(executable, ['outline'], { root, references }, root))
  },
  scan: async (root, settings, files) => {
    const parts = []
    for (const manifest of await rustProjects(root, settings, files)) {
      const observation = await scanRustSource(root, { ...settings, manifest }, files)
      parts.push({ key: path.relative(root, manifest).split(path.sep).join('/'), observation })
    }
    return combineObservations(parts)
  },
} satisfies ScannerPlugin

export default scanner
