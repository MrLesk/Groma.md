import type { ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { readTypeScriptOutline } from '../../typescript-outline.ts'
import { listTypeScriptFiles } from '../../typescript/src/files.ts'
import { checkReactReadiness, reactProjects, scanReact } from './scan.ts'

export { scanReact } from './scan.ts'

export default {
  id: 'react',
  watch: { include: ['**/*.tsx', '**/*.ts', '**/tsconfig*.json', '**/package.json', '**/*.html', '**/angular.json'], exclude: [] },
  checkReadiness: checkReactReadiness,
  /**
   * A React program can read any source the TypeScript scanner reads, a sibling library's included, so the
   * listing is all of them while the repository has a React project.
   */
  listSourceFiles: async root => (await reactProjects(root)).length ? listTypeScriptFiles(root) : [],
  // Every reference the outline receives is a TypeScript or TSX source this scanner reads.
  readCodeStructure: (root, references) => readTypeScriptOutline(ts, root, references),
  scan: scanReact,
} satisfies ScannerPlugin
