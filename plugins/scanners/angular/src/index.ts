import type { ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { readTypeScriptOutline } from '../../typescript-outline.ts'
import { angularSourceFiles } from './project.ts'
import { checkAngularReadiness, scanAngular } from './scan.ts'

export { scanAngular } from './scan.ts'

export default {
  id: 'angular',
  checkReadiness: checkAngularReadiness,
  listSourceFiles: (root, _settings, candidates) => angularSourceFiles(root, candidates),
  // Templates and stylesheets in a component's Code declare nothing.
  readCodeStructure: (root, references) => readTypeScriptOutline(ts, root, references.filter(reference => reference.file.endsWith('.ts'))),
  scan: scanAngular,
} satisfies ScannerPlugin
