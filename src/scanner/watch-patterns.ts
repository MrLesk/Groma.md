import ignore from 'ignore'
import type { ScannerPlugin } from '@groma/scanner'

/** Compile scanner subscriptions once; plugins supply data, not path-matching code. */
export function compileWatchPatterns(watch: ScannerPlugin['watch']): (file: string) => boolean {
  const include = ignore({ ignorecase: false }).add(watch.include.map(pattern => `/${pattern}`))
  const exclude = ignore({ ignorecase: false }).add(watch.exclude.map(pattern => `/${pattern}`))
  return file => {
    const normalized = file.replaceAll('\\', '/')
    return include.ignores(normalized) && !exclude.ignores(normalized)
  }
}
