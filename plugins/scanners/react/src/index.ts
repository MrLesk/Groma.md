import type { ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { readTypeScriptOutline } from '../../typescript-outline.ts'
import { typeScriptSources } from '../../typescript/src/files.ts'
import { checkReactReadiness, reactProjects, scanReact } from './scan.ts'

export { scanReact } from './scan.ts'

export default {
  id: 'react',
  checkReadiness: checkReactReadiness,
  /**
   * A React program can read any TypeScript source in the repository, a sibling library's included, so the
   * listing is every TypeScript source among the candidates while they hold a React project.
   */
  listSourceFiles: async (root, _settings, candidates) => (await reactProjects(root, candidates)).length ? typeScriptSources(candidates) : [],
  // Every reference the outline receives is a TypeScript or TSX source this scanner reads.
  readCodeStructure: (root, references) => readTypeScriptOutline(ts, root, references),
  scan: scanReact,
} satisfies ScannerPlugin
