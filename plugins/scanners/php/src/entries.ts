import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ScanEntryPoint } from '@groma/scanner'
import type { PhpHttpFacts } from './http.ts'

type Source = { file: string } & PhpHttpFacts

function includedFiles(entry: string, sources: ReadonlyMap<string, Source>, owner: (file: string) => string | undefined): string[] {
  const pending = [entry], found = new Set<string>()
  while (pending.length) {
    const member = pending.pop()!, source = sources.get(member)
    if (!source || found.has(member) || owner(member) !== owner(entry)) continue
    found.add(member)
    for (const load of source.loads) if (load.include && load.target && !load.target.fromRoot) pending.push(load.target.path)
  }
  return [...found]
}

/** Composer command declarations and the local files they explicitly include. */
export async function phpEntries(root: string, evidence: Source[], manifests: string[]): Promise<ScanEntryPoint[]> {
  const owner = (file: string) => manifests.filter(manifest => {
    const directory = path.posix.dirname(manifest)
    return directory === '.' || file.startsWith(`${directory}/`)
  }).sort((a, b) => b.length - a.length)[0]
  const byFile = new Map(evidence.map(file => [file.file, file]))
  const entries: ScanEntryPoint[] = []
  for (const declaration of manifests) {
    const manifest = JSON.parse(await readFile(path.join(root, declaration), 'utf8'))
    const bins: string[] = typeof manifest.bin === 'string' ? [manifest.bin] : manifest.bin ?? []
    const scripts = Object.values(manifest.scripts ?? {}).flat().flatMap(script => {
      const match = typeof script === 'string' && /^@?php\s+([\w./-]+\.php)(?:\s|$)/.exec(script)
      return match ? [match[1]!] : []
    })
    for (const target of [...bins, ...scripts]) {
      const file = path.posix.join(path.posix.dirname(declaration), target)
      const files = owner(file) === declaration ? includedFiles(file, byFile, owner) : []
      if (files.length) entries.push({ file, declaration, name: path.posix.basename(target, '.php'), files })
    }
  }
  return entries
}
