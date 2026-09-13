import type { ScannerPlugin } from '@groma/scanner'
import { checkReactReadiness, scanReact } from './scan.ts'

export { scanReact } from './scan.ts'

export default {
  id: 'react',
  watch: { include: ['**/*.tsx', '**/*.ts', '**/tsconfig*.json', '**/package.json'], exclude: [] },
  checkReadiness: checkReactReadiness,
  scan: scanReact,
} satisfies ScannerPlugin
