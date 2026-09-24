import { access } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { parseScanObservation, type CodeFile, type ScanObservation, type ScannerSettings, type SourceReference } from '@groma/scanner'
import { projectFiles } from '../../projects.ts'
import { validateInput, parseCSharpSettings, type CSharpConfig } from './config.ts'
import { run } from './process.ts'

/** Resolve the runtime installed for this host; scanning never downloads or builds it. */
async function requireWorker(): Promise<string> {
  try {
    const manifest = createRequire(import.meta.url).resolve(`@groma/scanner-csharp-${process.platform}-${process.arch}/package.json`)
    const worker = path.join(path.dirname(manifest), 'worker', `Groma.CSharpScanner${process.platform === 'win32' ? '.exe' : ''}`)
    await access(worker)
    return worker
  } catch {
    throw new Error('C# runtime package is missing. Reinstall the scanner with optional dependencies enabled; contributors run bun scripts/package-csharp-scanner.ts.')
  }
}

/**
 * Build output, test code and generated files are never read. `bin` and `obj` match in any letter case, while the test
 * suffixes stay case-sensitive, so a folder such as Contests or Latest is still read.
 */
export const exclude = ['**/[bB][iI][nN]/**', '**/[oO][bB][jJ]/**', '**/[tT]est/**', '**/[tT]ests/**', '**/*Tests/**', '**/*.Test/**',
  '**/*.[dD]esigner.cs', '**/*.g.cs', '**/*.g.i.cs', '**/*.generated.cs']
const exclusions = exclude.map(pattern => new Bun.Glob(pattern))

/**
 * The tracked, unignored and not excluded C# files, and every solution and project among them, or the configured
 * input. Undefined when the repository has no C# project.
 */
async function csharpInventory(root: string, config: CSharpConfig, excluded?: (file: string) => boolean) {
  const files = await projectFiles(root, file => /\.(?:cs|csproj|slnx?)$/i.test(file)
    && !exclusions.some(pattern => pattern.match(file)) && !excluded?.(file))
  const inputs = config.input
    ? [path.relative(root, await validateInput(root, config.input)).split(path.sep).join('/')]
    : files.filter(file => /\.(?:csproj|slnx?)$/i.test(file))
  return inputs.length ? { files, inputs } : undefined
}

/** Checks that the repository declares a C# project or solution, or the configured input, and the packaged runtime. */
export async function checkCSharpReadiness(repositoryRoot: string, settings: ScannerSettings = {}): Promise<void> {
  if (await csharpInventory(path.resolve(repositoryRoot), parseCSharpSettings(settings)) === undefined)
    throw new Error('No C# project or solution was found. The C# scanner reads SDK-style .csproj projects and the .sln or .slnx files that list them.')
  await requireWorker()
}

/** One worker request for the whole repository, so each project loads once however many inputs name it. */
export async function scanCSharpSource(repositoryRoot: string, settings: ScannerSettings = {},
  excluded?: (file: string) => boolean): Promise<ScanObservation | undefined> {
  const root = path.resolve(repositoryRoot)
  const config = parseCSharpSettings(settings)
  const inventory = await csharpInventory(root, config, excluded)
  if (inventory === undefined) return undefined
  const request = JSON.stringify({ root, ...inventory, configuration: config.configuration, maxProjects: config.maxProjects, maxFiles: config.maxFiles })
  const { stdout } = await run(await requireWorker(), ['--scan'], { cwd: root, timeoutSeconds: config.timeoutSeconds, input: request })
  return parseScanObservation(stdout)
}

/**
 * Every C# file of the inventory once the repository declares a C# project. A project may compile any repository
 * file, so this superset never leaves out a file a scan reads, without evaluating a project.
 */
export async function listCSharpSources(repositoryRoot: string, settings: ScannerSettings = {}): Promise<string[]> {
  const inventory = await csharpInventory(path.resolve(repositoryRoot), parseCSharpSettings(settings))
  return inventory?.files.filter(file => /\.cs$/i.test(file)) ?? []
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
