import { spawn } from 'node:child_process'
import path from 'node:path'

export interface TypeScriptScannerConfig {
  globs: string[]
  ignore: string[]
}

export const defaultTypeScriptScannerConfig: TypeScriptScannerConfig = {
  globs: ['**/*.ts', '**/*.tsx'],
  ignore: [
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],
}

const regexSpecials = new Set(['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'])

function escapeRegex(character: string): string {
  return regexSpecials.has(character) ? `\\${character}` : character
}

function globToRegExp(glob: string): RegExp {
  let pattern = ''
  for (let index = 0; index < glob.length; ) {
    if (glob.startsWith('**/', index)) {
      pattern += '(?:.*/)?'
      index += 3
      continue
    }
    if (glob.startsWith('**', index)) {
      pattern += '.*'
      index += 2
      continue
    }
    if (glob[index] === '*') {
      pattern += '[^/]*'
      index += 1
      continue
    }
    if (glob[index] === '?') {
      pattern += '[^/]'
      index += 1
      continue
    }
    pattern += escapeRegex(glob[index] ?? '')
    index += 1
  }
  return new RegExp(`^${pattern}$`)
}

function matchesGlob(relative: string, glob: string): boolean {
  const normalized = glob.replace(/^\.\//, '')
  if (normalized.endsWith('/')) {
    return relative === normalized.slice(0, -1) || relative.startsWith(normalized)
  }
  if (!normalized.includes('*') && !normalized.includes('?')) {
    return relative === normalized
      || relative.startsWith(`${normalized}/`)
  }
  return globToRegExp(normalized).test(relative)
}

function matchesAny(relative: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchesGlob(relative, pattern))
}

function gitListFiles(repositoryRoot: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'git',
      ['-C', repositoryRoot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', chunk => {
      chunks.push(chunk as Buffer)
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `git ls-files exited ${code}`))
        return
      }
      const files = Buffer.concat(chunks).toString('utf8')
        .split('\0')
        .filter(file => file !== '')
      resolve(files)
    })
  })
}

export async function listTypeScriptFiles(
  repositoryRoot: string,
  config: TypeScriptScannerConfig = defaultTypeScriptScannerConfig,
): Promise<string[]> {
  const listed = await gitListFiles(repositoryRoot)
  return listed
    .map(file => file.split(path.sep).join('/'))
    .filter(file => matchesAny(file, config.globs))
    .filter(file => !matchesAny(file, config.ignore))
    .sort()
}
