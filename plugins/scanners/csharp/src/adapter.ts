import { access } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { parseScanObservation, type CodeFile, type ScanObservation, type ScannerSettings, type SourceReference } from '@groma/scanner'
import { repositoryFiles } from '../../projects.ts'
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
 * The tracked and unignored C# files that `excluded` leaves in, and the inputs among them: the configured input, or
 * else every solution and project. The worker loads no other project and compiles no other repository source.
 * Undefined without an input.
 */
async function csharpInventory(root: string, config: CSharpConfig, excluded: (file: string) => boolean = () => false) {
  const files = await repositoryFiles(root, file => /\.(?:cs|csproj|slnx?)$/i.test(file) && !excluded(file))
  const input = config.input && path.relative(root, await validateInput(root, config.input)).split(path.sep).join('/')
  const inputs = input ? files.filter(file => file === input) : files.filter(file => /\.(?:csproj|slnx?)$/i.test(file))
  return inputs.length ? { files, inputs } : undefined
}

/** Checks that the files `excluded` leaves in hold a C# project or solution, or the configured input, and the packaged runtime. */
export async function checkCSharpReadiness(repositoryRoot: string, settings: ScannerSettings = {},
  excluded?: (file: string) => boolean): Promise<void> {
  if (await csharpInventory(path.resolve(repositoryRoot), parseCSharpSettings(settings), excluded) === undefined)
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
 * Every C# file of the inventory before exclusions, once the repository declares a C# project. A project may compile
 * any repository file, so this superset never leaves out a file a scan reads, without evaluating a project.
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
