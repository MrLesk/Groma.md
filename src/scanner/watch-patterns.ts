import ignore from 'ignore'

/** Compile discovery rules' file patterns once, anchored at the repository root; rules supply data, not matching code. */
export function compileWatchPatterns(include: readonly string[]): (file: string) => boolean {
  const matcher = ignore({ ignorecase: false }).add(include.map(pattern => `/${pattern}`))
  return file => matcher.ignores(file.replaceAll('\\', '/'))
}
