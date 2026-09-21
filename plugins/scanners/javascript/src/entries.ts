import path from 'node:path'
import ts from 'typescript'
import { classicChecker } from '../../http-checker.ts'
import { sourceBuildEntries, type EntrySources } from '../../entry-points/source.ts'
import { fileChecker } from './http.ts'

/** Literal local module paths in authored JavaScript; external packages remain separate units. */
export async function javaScriptEntries(root: string, sources: ts.SourceFile[]): Promise<EntrySources> {
  const files = new Set(sources.map(source => source.fileName))
  const imports = new Map(sources.map(source => {
    const targets = ts.preProcessFile(source.text, true, true).importedFiles.flatMap(imported => {
      if (!imported.fileName.startsWith('.')) return []
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(source.fileName), imported.fileName))
      const candidates = [base, ...['.js', '.mjs', '.cjs', '.jsx'].flatMap(extension => [base + extension, `${base}/index${extension}`])]
      return candidates.find(file => files.has(file)) ?? []
    })
    return [source.fileName, targets] as const
  }))
  const entries = (await Promise.all(sources.map(source => sourceBuildEntries(root, ts,
    classicChecker(ts, fileChecker(source)), [source])))).flat()
  return { imports, entries }
}
