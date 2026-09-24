/**
 * The `.ts` and `.tsx` sources among a scanner's files. A declaration file (`.d.ts`) only describes types, so it is
 * never a source.
 */
export function typeScriptSources(files: readonly string[]): string[] {
  return files.filter(file => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
}
