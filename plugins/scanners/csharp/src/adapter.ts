import { access } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { parseScanObservation, type CodeFile, type ScanObservation, type ScannerSettings, type SourceReference } from '@groma/scanner'
import { validateInput, parseCSharpSettings } from './config.ts'
import { run } from './process.ts'

/** Resolve the runtime installed for this host; scanning never downloads or builds it. */
export async function requireWorker(file?: string): Promise<string> {
  try {
    const manifest = file ? undefined : createRequire(import.meta.url).resolve(
      `@groma/scanner-csharp-${process.platform}-${process.arch}/package.json`)
    const worker = file ?? path.join(path.dirname(manifest!), 'worker',
      `Groma.CSharpScanner${process.platform === 'win32' ? '.exe' : ''}`)
    await access(worker)
    return worker
  } catch {
    throw new Error('C# runtime package is missing. Reinstall the scanner with optional dependencies enabled; contributors run bun scripts/package-csharp-scanner.ts.')
  }
}

async function prepareCSharpScan(repositoryRoot: string, settings: ScannerSettings, worker?: string) {
  const root = path.resolve(repositoryRoot)
  const config = parseCSharpSettings(settings)
  if (!config.input) throw new Error('C# analysis requires a selected project or solution input.')
  const input = await validateInput(root, config.input)
  const executable = await requireWorker(worker)
  return { root, config, input, executable }
}

/** Checks declared input and the scanner's own packaged runtime. */
export async function checkCSharpReadiness(repositoryRoot: string, settings: ScannerSettings = {}, worker?: string): Promise<{ input: string }> {
  const { input } = await prepareCSharpScan(repositoryRoot, settings, worker)
  return { input }
}

export async function scanCSharpSource(repositoryRoot: string, settings: ScannerSettings = {}, worker?: string): Promise<ScanObservation> {
  const { root, config, input, executable } = await prepareCSharpScan(repositoryRoot, settings, worker)
  const { stdout } = await run(executable, [input, '--root', root,
    '--configuration', config.configuration,
    '--max-projects', String(config.maxProjects), '--max-files', String(config.maxFiles),
  ], { cwd: path.dirname(input), timeoutSeconds: config.timeoutSeconds })
  return parseScanObservation(stdout)
}

/** Outlines Code reference files from C# syntax alone, without loading a project. */
export async function readCSharpOutline(repositoryRoot: string, references: readonly SourceReference[], settings: ScannerSettings = {}): Promise<CodeFile[]> {
  const worker = await requireWorker()
  const root = path.resolve(repositoryRoot)
  // The request travels on standard input: many Code files would exceed the command-line length limit.
  const { stdout } = await run(worker, ['--outline'], {
    cwd: root, timeoutSeconds: parseCSharpSettings(settings).timeoutSeconds, input: JSON.stringify({ root, references }),
  })
  return JSON.parse(stdout) as CodeFile[]
}
