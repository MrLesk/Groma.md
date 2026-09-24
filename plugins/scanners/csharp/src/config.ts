import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { ScannerSettings } from '@groma/scanner'

export interface CSharpConfig {
  input?: string
  configuration: string
  maxProjects: number
  maxFiles: number
  timeoutSeconds: number
}

const defaults = { configuration: 'Debug', maxProjects: 128, maxFiles: 20_000, timeoutSeconds: 120 }
const configName = 'csharp scanner settings'

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

export function parseCSharpSettings(config: ScannerSettings = {}): CSharpConfig {
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

export async function validateInput(root: string, selected: string): Promise<string> {
  const full = path.resolve(root, selected)
  const relative = path.relative(root, full)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('C# scan input must stay inside the repository')
  if (!/\.(?:csproj|slnx?)$/i.test(full) || !(await stat(full)).isFile()) throw new Error('C# input must be an existing .csproj, .sln, or .slnx file')
  return full
}
