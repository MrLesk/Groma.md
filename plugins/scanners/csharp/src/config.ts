import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

export interface CSharpConfig {
  input?: string
  configuration: string
  maxProjects: number
  maxFiles: number
  timeoutSeconds: number
}

const defaults = { configuration: 'Debug', maxProjects: 128, maxFiles: 20_000, timeoutSeconds: 120 }
const configName = 'groma.csharp.json'

function positiveInteger(value: unknown, key: string, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${configName}: ${key} must be a positive integer`)
  return Number(value)
}

function optionalText(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${configName}: ${key} must be nonempty text`)
  return value
}

export async function readCSharpConfig(root: string): Promise<CSharpConfig> {
  let text: string
  try { text = await readFile(path.join(root, configName), 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...defaults }
    throw error
  }
  const value: unknown = JSON.parse(text)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${configName} must be an object`)
  const config = value as Record<string, unknown>
  for (const key of Object.keys(config)) {
    if (!['input', ...Object.keys(defaults)].includes(key)) throw new Error(`${configName}: unknown setting ${key}`)
  }
  const input = optionalText(config.input, 'input')
  const configuration = optionalText(config.configuration, 'configuration')
  return {
    ...(input === undefined ? {} : { input }),
    configuration: configuration ?? defaults.configuration,
    maxProjects: positiveInteger(config.maxProjects, 'maxProjects', defaults.maxProjects),
    maxFiles: positiveInteger(config.maxFiles, 'maxFiles', defaults.maxFiles),
    timeoutSeconds: positiveInteger(config.timeoutSeconds, 'timeoutSeconds', defaults.timeoutSeconds),
  }
}

export async function findCSharpInput(root: string, selected?: string): Promise<string | undefined> {
  if (selected !== undefined) return validateInput(root, selected)
  const files = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name).sort()
  const solutions = files.filter(file => /\.slnx?$/i.test(file))
  const candidates = solutions.length ? solutions : files.filter(file => /\.csproj$/i.test(file))
  if (candidates.length > 1) throw new Error(`Several C# scan inputs exist; select input in ${configName}: ${candidates.join(', ')}`)
  return candidates.length ? path.resolve(root, candidates[0]!) : undefined
}

async function validateInput(root: string, selected: string): Promise<string> {
  const full = path.resolve(root, selected)
  const relative = path.relative(root, full)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('C# scan input must stay inside the repository')
  if (!/\.(?:csproj|slnx?)$/i.test(full) || !(await stat(full)).isFile()) throw new Error('C# input must be an existing .csproj, .sln, or .slnx file')
  return full
}

export function isCSharpScanFile(file: string): boolean {
  const normalized = file.replaceAll('\\', '/').toLowerCase()
  if (normalized.split('/').some(part => part === 'bin' || part === 'obj')) return false
  const name = path.posix.basename(normalized)
  return /\.(?:cs|csproj|slnx?|props|targets)$/.test(normalized)
    || ['global.json', 'nuget.config', 'packages.lock.json', configName].includes(name)
}
