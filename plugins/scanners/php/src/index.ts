import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScannerPlugin } from '@groma/scanner'
import { repositoryFiles } from '../../projects.ts'
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
 * The PHP sources and Composer manifests outside `excluded`. A source may be an extensionless PHP command that a
 * manifest names.
 */
async function inventory(root: string, excluded?: (file: string) => boolean) {
  const available = await repositoryFiles(root, file => !excluded?.(file))
  const files = available.filter(file => file.endsWith('.php'))
  const manifests = available.filter(file => path.basename(file) === 'composer.json')
  const commands = new Set<string>()
  for (const declaration of manifests) for (const file of await commandFiles(root, declaration)) commands.add(file)
  for (const file of available.filter(file => commands.has(file))) {
    if (!file.endsWith('.php') && (await readFile(path.join(root, file), 'utf8')).includes('<?php')) files.push(file)
  }
  return { files: [...new Set(files)].sort(), manifests }
}

export default {
  id: 'php',
  readCodeStructure,
  // The listing comes before exclusions; the host applies them to it.
  listSourceFiles: async root => (await inventory(root)).files,
  // Composer can name an extensionless PHP command at any path.
  watch: { include: ['**/*'], exclude: [] },
  async checkReadiness(root, _settings, excluded) {
    if (!(await inventory(root, excluded)).files.length) throw new Error('php: No PHP source files were found in the Git repository.')
  },
  async scan(root, _settings, excluded) {
    const { files, manifests } = await inventory(root, excluded)
    if (!files.length) return undefined
    const evidence = []
    for (const file of files) {
      const tree = parsePhp(file, await readFile(path.join(root, file), 'utf8'))
      evidence.push({ file, ...phpEvidence(file, tree), ...phpHttpFacts(file, tree) })
    }
    const declared = evidence.flatMap(file => file.operations)
    const httpEndpoints = resolveEndpoints(evidence, declared, manifests)
    const httpRequests = evidence.flatMap(file => file.requests)
    // A file's top-level code is an operation only when an HTTP fact names it.
    const named = new Set([...httpEndpoints, ...httpRequests].map(fact => fact.operation))
    const operations = [...declared, ...files.map(moduleOperation).filter(operation => named.has(operation.id))]
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
