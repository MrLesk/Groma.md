import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScanObservation, type ScannerPlugin, type ScannerSettings } from '@groma/scanner'
import { projectFiles } from '../../projects.ts'

const worker = fileURLToPath(new URL('../worker/scan.py', import.meta.url))
const declarations = new Set(['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'])
const excluded = ['**/.venv/**', '**/venv/**', '**/__pycache__/**', '**/test/**', '**/tests/**',
  '**/test_*.py', '**/*_test.py', '**/conftest.py']
const globs = excluded.map(pattern => new Bun.Glob(pattern))

function interpreter(settings: ScannerSettings): string {
  const executable = settings.python ?? (process.platform === 'win32' ? 'python' : 'python3')
  if (typeof executable !== 'string' || executable.trim() === '') {
    throw new Error('python: settings.python must be a nonempty executable name or path.')
  }
  return executable
}

async function inventory(root: string) {
  return projectFiles(root, file => (file.endsWith('.py') || declarations.has(path.posix.basename(file)))
    && !globs.some(glob => glob.match(file)))
}

function run(root: string, settings: ScannerSettings, files?: string[]): Promise<string> {
  const executable = interpreter(settings)
  return new Promise((resolve, reject) => {
    const child = execFile(executable, ['-I', '-B', worker, ...(files ? [] : ['--check'])],
      { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`PYTHON_SCAN_FAILED: ${stderr.trim() || error.message}. Use Python 3.11 or newer with support for the project's syntax; set settings.python to its executable.`))
        else resolve(stdout)
      })
    // Process failures are reported by execFile; a closed pipe must not emit an unhandled error.
    child.stdin!.on('error', () => {})
    child.stdin!.end(files ? JSON.stringify({ files }) : '')
  })
}

export default {
  id: 'python',
  watch: { include: ['**/*.py', '**/pyproject.toml', '**/setup.cfg', '**/requirements.txt'], exclude: excluded },
  async checkReadiness(root, settings = {}) {
    if (!(await inventory(root)).some(file => file.endsWith('.py'))) {
      throw new Error('python: No supported Python source files were found in the Git repository.')
    }
    await run(root, settings)
  },
  async scan(root, settings = {}) {
    const files = await inventory(root)
    if (!files.some(file => file.endsWith('.py'))) return undefined
    return parseScanObservation(await run(root, settings, files))
  },
} satisfies ScannerPlugin
