import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScannerPlugin } from '@groma/scanner'
import { phpEvidence } from './evidence.ts'
import { moduleOperation, phpHttpFacts, resolveEndpoints } from './http.ts'
import { readCodeStructure } from './outline.ts'
import { parsePhp } from './syntax.ts'
import { commandTargets, phpEntries } from './entries.ts'

/**
 * The files a Composer manifest names as commands. A manifest that is not JSON names none, so the source listing, which
 * reads manifests before exclusions, never fails on one; a scan that reads it still fails when it reads the entries.
 */
async function commandFiles(root: string, declaration: string): Promise<string[]> {
  const text = await readFile(path.join(root, declaration), 'utf8')
  let manifest: Record<string, unknown>
  try { manifest = JSON.parse(text) } catch { return [] }
  return commandTargets(manifest).map(target => path.posix.join(path.posix.dirname(declaration), target))
}

/**
 * The PHP sources and Composer manifests among `files`. A source may also be an extensionless PHP command that a
 * manifest names, read only when it is among `files` too.
 */
async function inventory(root: string, files: readonly string[]) {
  const sources = files.filter(file => file.endsWith('.php'))
  const manifests = files.filter(file => path.posix.basename(file) === 'composer.json')
  const commands = new Set<string>()
  for (const declaration of manifests) for (const file of await commandFiles(root, declaration)) commands.add(file)
  for (const file of files.filter(file => commands.has(file) && !file.endsWith('.php'))) {
    if ((await readFile(path.join(root, file), 'utf8')).includes('<?php')) sources.push(file)
  }
  return { sources: sources.sort(), manifests }
}

export default {
  id: 'php',
  readCodeStructure,
  listSourceFiles: async (root, _settings, candidates) => (await inventory(root, candidates)).sources,
  async checkReadiness(root, _settings, files) {
    if (!(await inventory(root, files)).sources.length) throw new Error('php: No PHP source files were found in the Git repository.')
  },
  async scan(root, _settings, files) {
    const { sources, manifests } = await inventory(root, files)
    if (!sources.length) return undefined
    const evidence = []
    for (const file of sources) {
      const tree = parsePhp(file, await readFile(path.join(root, file), 'utf8'))
      evidence.push({ file, ...phpEvidence(file, tree), ...phpHttpFacts(file, tree) })
    }
    const declared = evidence.flatMap(file => file.operations)
    const httpEndpoints = resolveEndpoints(evidence, declared, manifests)
    const httpRequests = evidence.flatMap(file => file.requests)
    // A file's top-level code is an operation only when an HTTP fact names it.
    const named = new Set([...httpEndpoints, ...httpRequests].map(fact => fact.operation))
    const operations = [...declared, ...sources.map(moduleOperation).filter(operation => named.has(operation.id))]
    return createScanObservation({
      scanner: { id: 'php', technology: 'php', engine: 'php-parser', engineVersion: '3.7.0' },
      roots: [{ id: 'php-source', kind: 'source-group', name: path.basename(root) }],
      files: evidence.map(({ file, symbols }) => ({ file, roots: ['php-source'], symbols })),
      entryPoints: await phpEntries(root, evidence, manifests),
      operations,
      invocations: evidence.flatMap(file => file.invocations),
      httpEndpoints,
      httpRequests,
      diagnostics: [{ severity: 'info', code: 'PHP_SOURCE_SCOPE',
        message: 'PHP syntax through 8.4. Runtime loading, external symbols, dynamic calls, framework hooks and protocol wiring remain unresolved.' }],
    })
  },
} satisfies ScannerPlugin
