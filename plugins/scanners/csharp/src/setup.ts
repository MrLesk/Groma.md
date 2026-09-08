import path from 'node:path'
import { findCSharpInput, readCSharpConfig } from './config.ts'
import { requireWorker } from './adapter.ts'
import { installSdk, resolveDotnet } from './sdk.ts'
import { run } from './process.ts'

export async function setupCSharp(repositoryRoot: string, args: readonly string[]): Promise<void> {
  const flags = args.filter(arg => arg !== '--')
  if (new Set(flags).size !== flags.length || flags.some(arg => !['--install-sdk', '--restore', '--trust-project'].includes(arg))) {
    throw new Error('C# setup options: --install-sdk --restore --trust-project')
  }
  if (flags.includes('--restore') && !flags.includes('--trust-project')) throw new Error('Restore can execute repository build logic. Add --trust-project only for a trusted repository.')
  await requireWorker()
  const config = await readCSharpConfig(repositoryRoot)
  const input = await findCSharpInput(repositoryRoot, config.input)
  if (!input) throw new Error('Select a C# input in groma.csharp.json before setup')
  const host = flags.includes('--install-sdk') ? await installSdk() : await resolveDotnet()
  const cwd = path.dirname(input)
  const { stdout } = await run(host, ['--version'], { cwd, timeoutSeconds: 30 })
  console.log(`Project SDK: ${stdout.trim()}`)
  // The published worker targets net10.0, independently of the project's selected SDK/TFM.
  const runtimes = await run(host, ['--list-runtimes'], { cwd, timeoutSeconds: 30 })
  if (!/^Microsoft\.NETCore\.App 10\./m.test(runtimes.stdout)) throw new Error('The C# worker requires a .NET 10 runtime; use --install-sdk or install .NET 10 alongside the project SDK.')
  if (flags.includes('--restore')) {
    console.error('Restoring the selected trusted project graph using its configured NuGet feeds.')
    const result = await run(host, ['restore', input, '--nologo', `-p:Configuration=${config.configuration}`], { cwd, timeoutSeconds: 300 })
    if (result.stdout.trim()) console.log(result.stdout.trim())
  }
  console.log('C# dependencies checked. Scanning evaluates MSBuild projects: scan only repositories you trust.')
}
