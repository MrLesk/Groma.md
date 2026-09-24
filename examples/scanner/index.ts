import { createScanObservation, type ScannerPlugin } from '@groma/scanner'

/** Teaching example: an inventory of the files its include list names, with no language analysis. */
const scanner: ScannerPlugin = {
  id: 'example-inventory',
  async scan(_repositoryRoot, _settings, files) {
    return createScanObservation({
      scanner: { id: 'example-inventory', technology: 'JavaScript inventory', engine: 'directory inventory', engineVersion: '1' },
      roots: [{ id: 'source', kind: 'package', name: 'Example source', file: 'inventory-example.json' }],
      files: files.map(file => ({ file, roots: ['source'], symbols: [] })),
      diagnostics: [],
    })
  },
}

export default scanner
