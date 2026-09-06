import path from 'node:path'

/**
 * Path of a file the build embedded through `compile.assets`, or undefined when running from source.
 * Inside a standalone executable every bundled module's `import.meta.dir` is the embedded root.
 */
export function compiledAsset(...parts: string[]): string | undefined {
  if (globalThis.Bun?.isStandaloneExecutable !== true) return undefined
  return path.join(import.meta.dir, ...parts)
}
