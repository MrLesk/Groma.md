import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { parseScanObservation, type ScanObservation, type ScannerPlugin } from '@groma/scanner'

const execute = promisify(execFile)
const executable = fileURLToPath(new URL(
  `./bin/groma-rust-scanner${process.platform === 'win32' ? '.exe' : ''}`,
  import.meta.url,
))

export function isRustScanFile(file: string): boolean {
  const segments = file.replaceAll('\\', '/').split('/')
  if (segments.some(segment => ['target', 'node_modules', '.git', 'vendor', 'dist'].includes(segment))) return false
  const name = segments.at(-1)
  return file.endsWith('.rs') || name === 'Cargo.toml' || name === '.groma-rust.json'
}

export async function scanRustSource(
  repositoryRoot: string,
  nativeExecutable = executable,
): Promise<ScanObservation | undefined> {
  let stdout: string
  try {
    const result = await execute(nativeExecutable, [repositoryRoot], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
      killSignal: 'SIGKILL',
      windowsHide: true,
    })
    stdout = result.stdout
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Rust scanner executable is missing; build the local scanner package or reinstall its matching platform package.')
    }
    throw error
  }
  if (stdout.trim() === 'null') return undefined
  return parseScanObservation(stdout)
}

const scanner = {
  id: 'rust',
  matchesFile: isRustScanFile,
  scan: scanRustSource,
} satisfies ScannerPlugin

export default scanner
