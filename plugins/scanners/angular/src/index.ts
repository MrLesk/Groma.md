import type { ScannerPlugin } from '@groma/scanner'
import { scanAngular } from './scan.ts'

export { scanAngular } from './scan.ts'

export default {
  id: 'angular',
  matchesFile: file => file.endsWith('.ts') || file.endsWith('.html') || file === 'tsconfig.json' || file === 'package.json',
  scan: scanAngular,
} satisfies ScannerPlugin
