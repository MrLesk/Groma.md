import type { ScannerPlugin } from '@groma/scanner'
import { checkGoReadiness, scanGoSource } from './adapter.ts'

export default {
  id: 'go',
  matchesFile: file => file.endsWith('.go') || /(^|\/)go\.(mod|sum|work)$/.test(file),
  checkReadiness: async root => { await checkGoReadiness(root) },
  scan: scanGoSource,
} satisfies ScannerPlugin
