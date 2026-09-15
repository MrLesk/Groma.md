import { Worker } from 'node:worker_threads'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { parseScanObservation, type ScannerPlugin } from '@groma/scanner'
import { projectFiles } from '../../projects.ts'

const worker = new URL('../dist/worker/runtime.js', import.meta.url)
const declarations = new Set(['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'])
const excluded = ['**/.venv/**', '**/venv/**', '**/__pycache__/**', '**/test/**', '**/tests/**',
  '**/test_*.py', '**/*_test.py', '**/conftest.py']
const globs = excluded.map(pattern => new Bun.Glob(pattern))

async function inventory(root: string) {
  return projectFiles(root, file => (file.endsWith('.py') || declarations.has(path.posix.basename(file)))
    && !globs.some(glob => glob.match(file)))
}

function run(root: string, files: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const thread = new Worker(worker, { workerData: { root, files } })
    const timeout = setTimeout(() => { void thread.terminate(); reject(new Error('PYTHON_SCAN_FAILED: Source analysis exceeded 120 seconds.')) }, 120000)
    thread.once('message', (result: string) => { clearTimeout(timeout); void thread.terminate(); resolve(result) })
    thread.once('error', error => { clearTimeout(timeout); void thread.terminate(); reject(new Error(`PYTHON_SCAN_FAILED: ${error instanceof Error ? error.message : String(error)}`)) })
    thread.once('exit', code => { clearTimeout(timeout); if (code !== 0) reject(new Error(`PYTHON_SCAN_FAILED: Worker exited with code ${code}.`)) })
  })
}

export default {
  id: 'python',
  watch: { include: ['**/*.py', '**/pyproject.toml', '**/setup.cfg', '**/requirements.txt'], exclude: excluded },
  async checkReadiness(root) {
    if (!(await inventory(root)).some(file => file.endsWith('.py'))) {
      throw new Error('python: No supported Python source files were found in the Git repository.')
    }
    await access(worker)
  },
  async scan(root) {
    const files = await inventory(root)
    if (!files.some(file => file.endsWith('.py'))) return undefined
    return parseScanObservation(await run(root, files))
  },
} satisfies ScannerPlugin
