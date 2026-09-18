import type { ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { readTypeScriptOutline } from '../../typescript-outline.ts'
import { checkReactReadiness, scanReact } from './scan.ts'

export { scanReact } from './scan.ts'

export default {
  id: 'react',
  watch: { include: ['**/*.tsx', '**/*.ts', '**/tsconfig*.json', '**/package.json'], exclude: [] },
  checkReadiness: checkReactReadiness,
  // Every reference the outline receives is a TypeScript or TSX source this scanner reads.
  readCodeStructure: (root, references) => readTypeScriptOutline(ts, root, references),
  scan: scanReact,
} satisfies ScannerPlugin
