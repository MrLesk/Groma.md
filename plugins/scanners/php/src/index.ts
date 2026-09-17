import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScannerPlugin } from '@groma/scanner'
import { projectFiles } from '../../projects.ts'
import { phpEvidence } from './evidence.ts'
import { readCodeStructure } from './outline.ts'

async function inventory(root: string) {
  return projectFiles(root, file => file.endsWith('.php'))
}

export default {
  id: 'php',
  readCodeStructure,
  watch: { include: ['**/*.php'], exclude: [] },
  async checkReadiness(root) {
    if (!(await inventory(root)).length) throw new Error('php: No PHP source files were found in the Git repository.')
  },
  async scan(root) {
    const files = await inventory(root)
    if (!files.length) return undefined
    const evidence = []
    for (const file of files) evidence.push({ file, ...phpEvidence(file, await readFile(path.join(root, file), 'utf8')) })
    return createScanObservation({
      scanner: { id: 'php', technology: 'php', engine: 'php-parser', engineVersion: '3.7.0' },
      roots: [{ id: 'php-source', kind: 'source-group', name: path.basename(root) }],
      files: evidence.map(({ file, symbols }) => ({ file, roots: ['php-source'], symbols })),
      operations: evidence.flatMap(file => file.operations),
      invocations: evidence.flatMap(file => file.invocations),
      diagnostics: [{ severity: 'info', code: 'PHP_SOURCE_SCOPE',
        message: 'PHP syntax through 8.4. Runtime loading, external symbols, dynamic calls, framework hooks and protocol wiring remain unresolved.' }],
    })
  },
} satisfies ScannerPlugin
