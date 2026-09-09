import type { ScannerPlugin } from '@groma/scanner'
import { checkReactReadiness, scanReact } from './scan.ts'

export { scanReact } from './scan.ts'

export default {
  id: 'react',
  matchesFile: file => file.endsWith('.tsx') || file.endsWith('.ts') || file === 'tsconfig.json' || file === 'package.json',
  checkReadiness: checkReactReadiness,
  scan: scanReact,
} satisfies ScannerPlugin
