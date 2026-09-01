import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseScanObservation, type ScanObservation } from '@groma/scanner'

const scannerDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dotnet',
)
const scannerProject = path.join(scannerDirectory, 'Groma.CSharpScanner.csproj')
const scannerDll = path.join(
  scannerDirectory,
  'bin',
  'Debug',
  'net10.0',
  'Groma.CSharpScanner.dll',
)

export function isCSharpScanFile(file: string): boolean {
  const segments = file.split('/')
  return !segments.includes('bin')
    && !segments.includes('obj')
    && /\.(?:cs|csproj|sln)$/.test(file)
}

function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const scriptHost = process.platform === 'win32' && /\.[cm]?js$/.test(command)
    const child = spawn(scriptHost ? process.execPath : command, scriptHost ? [command, ...args] : args, {
      cwd,
      env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr.trim() || stdout.trim() || `${command} exited ${code}`))
    })
  })
}

export async function findCSharpInput(repositoryRoot: string): Promise<string | undefined> {
  const files = (await readdir(repositoryRoot, { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort()
  const solution = files.find(file => file.endsWith('.sln'))
  const project = files.find(file => file.endsWith('.csproj'))
  const input = solution ?? project
  return input === undefined ? undefined : path.join(repositoryRoot, input)
}

export async function scanCSharpSource(
  repositoryRoot: string,
  dotnet: string = process.env.DOTNET_HOST_PATH || 'dotnet',
): Promise<ScanObservation | undefined> {
  const input = await findCSharpInput(repositoryRoot)
  if (input === undefined) return undefined
  await run(dotnet, ['build', scannerProject, '--nologo', '--verbosity', 'quiet'], scannerDirectory)
  const { stdout } = await run(dotnet, [scannerDll, input], repositoryRoot)
  return parseScanObservation(stdout)
}
