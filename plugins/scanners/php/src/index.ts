import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScannerPlugin } from '@groma/scanner'
import { projectFiles } from '../../projects.ts'
import { phpEvidence } from './evidence.ts'
import { moduleOperation, phpHttpFacts, resolveEndpoints } from './http.ts'
import { readCodeStructure } from './outline.ts'
import { parsePhp } from './syntax.ts'

async function inventory(root: string) {
  return projectFiles(root, file => file.endsWith('.php'))
}

export default {
  id: 'php',
  readCodeStructure,
  listSourceFiles: inventory,
  watch: { include: ['**/*.php'], exclude: [] },
  async checkReadiness(root) {
    if (!(await inventory(root)).length) throw new Error('php: No PHP source files were found in the Git repository.')
  },
  async scan(root) {
    const files = await inventory(root)
    if (!files.length) return undefined
    const evidence = []
    for (const file of files) {
      const tree = parsePhp(file, await readFile(path.join(root, file), 'utf8'))
      evidence.push({ file, ...phpEvidence(file, tree), ...phpHttpFacts(file, tree) })
    }
    const declared = evidence.flatMap(file => file.operations)
    const httpEndpoints = resolveEndpoints(evidence, declared, await projectFiles(root, file => path.basename(file) === 'composer.json'))
    const httpRequests = evidence.flatMap(file => file.requests)
    // A file's top-level code is an operation only when an HTTP fact names it.
    const named = new Set([...httpEndpoints, ...httpRequests].map(fact => fact.operation))
    const operations = [...declared, ...files.map(moduleOperation).filter(operation => named.has(operation.id))]
    return createScanObservation({
      scanner: { id: 'php', technology: 'php', engine: 'php-parser', engineVersion: '3.7.0' },
      roots: [{ id: 'php-source', kind: 'source-group', name: path.basename(root) }],
      files: evidence.map(({ file, symbols }) => ({ file, roots: ['php-source'], symbols })),
      operations,
      invocations: evidence.flatMap(file => file.invocations),
      httpEndpoints,
      httpRequests,
      diagnostics: [{ severity: 'info', code: 'PHP_SOURCE_SCOPE',
        message: 'PHP syntax through 8.4. Runtime loading, external symbols, dynamic calls, framework hooks and protocol wiring remain unresolved.' }],
    })
  },
} satisfies ScannerPlugin
