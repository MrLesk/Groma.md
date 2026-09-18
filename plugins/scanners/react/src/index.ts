import type { ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { readTypeScriptOutline } from '../../typescript-outline.ts'
import { frameworkSourceFiles } from '../../typescript-project.ts'
import { routeCandidate } from './routes.ts'
import { checkReactReadiness, scanReact } from './scan.ts'

export { scanReact } from './scan.ts'

export default {
  id: 'react',
  watch: { include: ['**/*.tsx', '**/*.ts', '**/tsconfig*.json', '**/package.json'], exclude: [] },
  checkReadiness: checkReactReadiness,
  /** The TSX components of each React project, and the files whose location may declare a Next.js route. */
  listSourceFiles: root => frameworkSourceFiles({ root, dependency: 'react', projects: ['.tsx'],
    sources: ['.tsx'], also: routeCandidate }),
  // Every reference the outline receives is a TypeScript or TSX source this scanner reads.
  readCodeStructure: (root, references) => readTypeScriptOutline(ts, root, references),
  scan: scanReact,
} satisfies ScannerPlugin
