import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScanObservation, type CodeFile, type ScanObservation, type ScannerSettings, type SourceReference } from '@groma/scanner'
import { validateInput, parseCSharpSettings } from './config.ts'
import { run } from './process.ts'

export const workerExecutable = fileURLToPath(new URL(`../dist/${process.platform}-${process.arch}/worker/Groma.CSharpScanner${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url))

export async function requireWorker(file = workerExecutable): Promise<void> {
  try { await access(file) }
  catch { throw new Error('C# worker is not prepared. Install a prebuilt scanner package; contributors run bun scripts/package-csharp-scanner.ts.') }
}

async function prepareCSharpScan(repositoryRoot: string, settings: ScannerSettings, worker: string) {
  const root = path.resolve(repositoryRoot)
  const config = parseCSharpSettings(settings)
  if (!config.input) throw new Error('C# analysis requires a selected project or solution input.')
  const input = await validateInput(root, config.input)
  await requireWorker(worker)
  return { root, config, input }
}

/** Checks declared input and the scanner's own packaged runtime. */
export async function checkCSharpReadiness(repositoryRoot: string, settings: ScannerSettings = {}, worker = workerExecutable): Promise<{ input: string }> {
  const { input } = await prepareCSharpScan(repositoryRoot, settings, worker)
  return { input }
}

export async function scanCSharpSource(repositoryRoot: string, settings: ScannerSettings = {}, worker = workerExecutable): Promise<ScanObservation> {
  const { root, config, input } = await prepareCSharpScan(repositoryRoot, settings, worker)
  const { stdout } = await run(worker, [input, '--root', root,
    '--configuration', config.configuration,
    '--max-projects', String(config.maxProjects), '--max-files', String(config.maxFiles),
  ], { cwd: path.dirname(input), timeoutSeconds: config.timeoutSeconds })
  return parseScanObservation(stdout)
}

/** Outlines Code reference files from C# syntax alone, without loading a project. */
export async function readCSharpOutline(repositoryRoot: string, references: readonly SourceReference[], settings: ScannerSettings = {}): Promise<CodeFile[]> {
  await requireWorker()
  const root = path.resolve(repositoryRoot)
  // The request travels on standard input: many Code files would exceed the command-line length limit.
  const { stdout } = await run(workerExecutable, ['--outline'], {
    cwd: root, timeoutSeconds: parseCSharpSettings(settings).timeoutSeconds, input: JSON.stringify({ root, references }),
  })
  return JSON.parse(stdout) as CodeFile[]
}
