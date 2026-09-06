import path from 'node:path'

import marker from './compiled-marker.txt' with { type: 'file' }

/** Path into the compiled binary's embedded files, or undefined when running from source. */
export function compiledAsset(...parts: string[]): string | undefined {
  if (!marker.includes('$bunfs') && !/~BUN/i.test(marker)) return undefined
  return path.join(path.dirname(marker), ...parts)
}
