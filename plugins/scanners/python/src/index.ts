import { Worker } from 'node:worker_threads'
import { access } from 'node:fs/promises'
import { parseScanObservation, type CodeFile, type ScannerPlugin, type SourceReference } from '@groma/scanner'

const worker = new URL('../dist/worker/runtime.js', import.meta.url)

/** A Python source; the other files the scanner reads are project declarations, which describe projects, not source. */
const isSource = (file: string) => file.endsWith('.py')

/** Scans the files, or outlines them when references are given. */
function run(workerData: { root: string; files?: readonly string[]; references?: readonly SourceReference[] }): Promise<string> {
  return new Promise((resolve, reject) => {
    const thread = new Worker(worker, { workerData })
    const timeout = setTimeout(() => { void thread.terminate(); reject(new Error('PYTHON_SCAN_FAILED: Source analysis exceeded 120 seconds.')) }, 120000)
    thread.once('message', (result: string) => { clearTimeout(timeout); void thread.terminate(); resolve(result) })
    thread.once('error', error => { clearTimeout(timeout); void thread.terminate(); reject(new Error(`PYTHON_SCAN_FAILED: ${error instanceof Error ? error.message : String(error)}`)) })
    thread.once('exit', code => { clearTimeout(timeout); if (code !== 0) reject(new Error(`PYTHON_SCAN_FAILED: Worker exited with code ${code}.`)) })
  })
}

export default {
  id: 'python',
  listSourceFiles: async (_root, _settings, candidates) => candidates.filter(isSource),
  async checkReadiness(_root, _settings, files) {
    if (!files.some(isSource)) {
      throw new Error('python: No supported Python source files were found in the Git repository.')
    }
    await access(worker)
  },
  async readCodeStructure(root, references): Promise<CodeFile[]> {
    if (references.length === 0) return []
    return JSON.parse(await run({ root, references }))
  },
  async scan(root, _settings, files) {
    if (!files.some(isSource)) return undefined
    return parseScanObservation(await run({ root, files }))
  },
} satisfies ScannerPlugin
