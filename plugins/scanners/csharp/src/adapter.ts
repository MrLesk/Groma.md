import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScanObservation, type ScanObservation } from '@groma/scanner'
import { findCSharpInput, readCSharpConfig } from './config.ts'
import { run } from './process.ts'

export { findCSharpInput, isCSharpScanFile } from './config.ts'

export const workerDll = fileURLToPath(new URL('../dist/worker/Groma.CSharpScanner.dll', import.meta.url))

export async function requireWorker(file = workerDll): Promise<void> {
  try { await access(file) }
  catch { throw new Error('C# worker is not prepared. Install a prebuilt scanner package; contributors run bun scripts/package-csharp-scanner.ts.') }
}

async function prepareCSharpScan(repositoryRoot: string, dotnet: string, worker: string) {
  const root = path.resolve(repositoryRoot)
  const config = await readCSharpConfig(root)
  const input = await findCSharpInput(root, config.input)
  if (!input) throw new Error('No C# input was selected. Set input in groma.csharp.json or disable the csharp scanner.')
  await requireWorker(worker)
  const options = { cwd: path.dirname(input), timeoutSeconds: config.timeoutSeconds }
  let sdkVersion: string
  try { sdkVersion = (await run(dotnet, ['--version'], options)).stdout.trim() }
  catch (error) { throw new Error(`C# project SDK is unavailable. Install the SDK selected by global.json and ensure dotnet is on PATH (or set DOTNET_HOST_PATH). ${String(error)}`) }
  const runtimes = (await run(dotnet, ['--list-runtimes'], options)).stdout
  if (!/^Microsoft\.NETCore\.App 10\./m.test(runtimes)) throw new Error('The C# scanner worker requires the .NET 10 runtime alongside the project SDK.')
  return { root, config, input, sdkVersion }
}

/** Checks input and installed tools; successful compilation is established only by scan. */
export async function checkCSharpReadiness(repositoryRoot: string, dotnet = process.env.DOTNET_HOST_PATH ?? 'dotnet', worker = workerDll): Promise<{ input: string; sdkVersion: string }> {
  const { input, sdkVersion } = await prepareCSharpScan(repositoryRoot, dotnet, worker)
  return { input, sdkVersion }
}

export async function scanCSharpSource(repositoryRoot: string, dotnet = process.env.DOTNET_HOST_PATH ?? 'dotnet', worker = workerDll): Promise<ScanObservation> {
  const { root, config, input } = await prepareCSharpScan(repositoryRoot, dotnet, worker)
  const { stdout } = await run(dotnet, [
    worker, input, '--root', root,
    '--configuration', config.configuration,
    '--max-projects', String(config.maxProjects), '--max-files', String(config.maxFiles),
  ], { cwd: path.dirname(input), timeoutSeconds: config.timeoutSeconds })
  return parseScanObservation(stdout)
}
