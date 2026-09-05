export type TokenKind = 'comment' | 'function' | 'keyword' | 'number' | 'string' | 'type'

const keywords = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default',
  'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'foreach', 'from',
  'function', 'get', 'if', 'implements', 'import', 'in', 'interface', 'internal', 'is', 'let',
  'namespace', 'new', 'null', 'of', 'override', 'private', 'protected', 'public', 'readonly',
  'return', 'set', 'static', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof',
  'undefined', 'using', 'var', 'virtual', 'void', 'while', 'yield',
])

const tokenPattern = /\/\/.*|\/\*.*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g

function tokenKind(token: string, rest: string): TokenKind | undefined {
  if (token.startsWith('//') || token.startsWith('/*')) return 'comment'
  if (/^['"`]/.test(token)) return 'string'
  if (/^\d/.test(token)) return 'number'
  if (keywords.has(token)) return 'keyword'
  if (/^[A-Z]/.test(token)) return 'type'
  return /^\s*\(/.test(rest) ? 'function' : undefined
}

export interface CodeToken {
  text: string
  kind?: TokenKind
}

/** The same lightweight syntax tokens for browser and terminal source/diff readers. */
export function codeTokens(source: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let offset = 0
  for (const match of source.matchAll(tokenPattern)) {
    if (match.index > offset) tokens.push({ text: source.slice(offset, match.index) })
    offset = match.index + match[0].length
    tokens.push({ text: match[0], kind: tokenKind(match[0], source.slice(offset)) })
  }
  if (offset < source.length) tokens.push({ text: source.slice(offset) })
  return tokens
}
