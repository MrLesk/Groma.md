import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScannerPlugin } from '@groma/scanner'

/** Teaching example: only direct JavaScript files in src/, with no language analysis. */
const scanner: ScannerPlugin = {
  id: 'example-inventory',
  watch: { include: ['src/*.js'], exclude: [] },
  async scan(repositoryRoot) {
    const entries = await readdir(path.join(repositoryRoot, 'src'), { withFileTypes: true })
    return createScanObservation({
      scanner: { id: 'example-inventory', technology: 'JavaScript inventory', engine: 'directory inventory', engineVersion: '1' },
      roots: [{ id: 'source', kind: 'package', name: 'Example source', file: 'inventory-example.json' }],
      files: entries.filter(entry => entry.isFile() && entry.name.endsWith('.js')).map(entry => ({
        file: `src/${entry.name}`, roots: ['source'], symbols: [],
      })),
      diagnostics: [],
    })
  },
}

export default scanner
