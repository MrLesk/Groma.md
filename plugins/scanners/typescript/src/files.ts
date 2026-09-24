import { repositoryFiles } from '../../projects.ts'

export interface TypeScriptScannerConfig {
  globs: string[]
  ignore: string[]
}

export const defaultTypeScriptScannerConfig: TypeScriptScannerConfig = {
  globs: ['**/*.ts', '**/*.tsx'],
  ignore: [
    'test/**',
    'test-bun/**',
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

function globMatcher(glob: string): (relative: string) => boolean {
  const normalized = glob.replace(/^\.\//, '')
  if (normalized.endsWith('/')) {
    return relative => relative === normalized.slice(0, -1) || relative.startsWith(normalized)
  }
  if (!normalized.includes('*') && !normalized.includes('?')) {
    return relative => relative === normalized || relative.startsWith(`${normalized}/`)
  }
  const pattern = globToRegExp(normalized)
  return relative => pattern.test(relative)
}

function fileMatcher(config: TypeScriptScannerConfig): (file: string) => boolean {
  const included = config.globs.map(globMatcher)
  const excluded = config.ignore.map(globMatcher)
  return file => included.some(matches => matches(file)) && !excluded.some(matches => matches(file))
}

export function listTypeScriptFiles(
  repositoryRoot: string,
  config: TypeScriptScannerConfig = defaultTypeScriptScannerConfig,
): Promise<string[]> {
  return repositoryFiles(repositoryRoot, fileMatcher(config))
}
