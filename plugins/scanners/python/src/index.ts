import { Worker } from 'node:worker_threads'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { parseScanObservation, type CodeFile, type ScannerPlugin, type SourceReference } from '@groma/scanner'
import { repositoryFiles } from '../../projects.ts'

const worker = new URL('../dist/worker/runtime.js', import.meta.url)
const declarations = new Set(['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'])

/** The `.py` sources and project declarations the worker reads, skipping every file `excluded` names. */
async function inventory(root: string, excluded?: (file: string) => boolean) {
  return repositoryFiles(root, file => (file.endsWith('.py') || declarations.has(path.posix.basename(file))) && !excluded?.(file))
}

/** The analyzed sources before exclusions; the declaration files in the inventory describe projects, not source. */
async function sources(root: string): Promise<string[]> {
  return (await inventory(root)).filter(file => file.endsWith('.py'))
}

/** Scans the files, or outlines them when references are given. */
function run(workerData: { root: string; files?: string[]; references?: readonly SourceReference[] }): Promise<string> {
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
  watch: { include: ['**/*.py', '**/pyproject.toml', '**/setup.cfg', '**/requirements.txt'], exclude: [] },
  listSourceFiles: sources,
  async checkReadiness(root, _settings, excluded) {
    if (!(await inventory(root, excluded)).some(file => file.endsWith('.py'))) {
      throw new Error('python: No supported Python source files were found in the Git repository.')
    }
    await access(worker)
  },
  async readCodeStructure(root, references): Promise<CodeFile[]> {
    if (references.length === 0) return []
    return JSON.parse(await run({ root, references }))
  },
  async scan(root, _settings, excluded) {
    const files = await inventory(root, excluded)
    if (!files.some(file => file.endsWith('.py'))) return undefined
    return parseScanObservation(await run({ root, files }))
  },
} satisfies ScannerPlugin
