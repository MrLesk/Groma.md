import type { ScannerPlugin } from '@groma/scanner'
import { checkGoReadiness, scanGoSource } from './adapter.ts'

export default {
  id: 'go',
  watch: { include: ['**/*.go', '**/go.mod', '**/go.sum', '**/go.work'], exclude: [] },
  checkReadiness: async root => { await checkGoReadiness(root) },
  scan: scanGoSource,
} satisfies ScannerPlugin
