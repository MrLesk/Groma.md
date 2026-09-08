import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScanObservation, type ScanObservation } from '@groma/scanner'
import { findCSharpInput, readCSharpConfig } from './config.ts'
import { run } from './process.ts'
import { resolveDotnet } from './sdk.ts'

export { findCSharpInput, isCSharpScanFile } from './config.ts'

export const workerDll = fileURLToPath(new URL('../dist/worker/Groma.CSharpScanner.dll', import.meta.url))

export async function requireWorker(file = workerDll): Promise<void> {
  try { await access(file) }
  catch { throw new Error('C# worker is not prepared. Install a prebuilt scanner package; contributors run bun scripts/package-csharp-scanner.ts.') }
}

export async function scanCSharpSource(repositoryRoot: string, dotnet?: string, worker = workerDll): Promise<ScanObservation> {
  const root = path.resolve(repositoryRoot)
  const config = await readCSharpConfig(root)
  const input = await findCSharpInput(root, config.input)
  if (!input) throw new Error('No C# input was selected. Set input in groma.csharp.json or disable the csharp scanner.')
  await requireWorker(worker)
  const { stdout } = await run(dotnet ?? await resolveDotnet(), [
    worker, input, '--root', root,
    '--configuration', config.configuration,
    '--max-projects', String(config.maxProjects), '--max-files', String(config.maxFiles),
  ], { cwd: path.dirname(input), timeoutSeconds: config.timeoutSeconds })
  return parseScanObservation(stdout)
}
