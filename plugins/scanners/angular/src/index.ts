import type { ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { readTypeScriptOutline } from '../../typescript-outline.ts'
import { frameworkSourceFiles } from '../../typescript-project.ts'
import { checkAngularReadiness, scanAngular } from './scan.ts'

export { scanAngular } from './scan.ts'

export default {
  id: 'angular',
  watch: { include: ['**/*.ts', '**/*.html', '**/*.css', '**/*.scss', '**/*.sass', '**/*.less', '**/*.styl', '**/tsconfig*.json', '**/package.json', '**/angular.json'], exclude: [] },
  checkReadiness: checkAngularReadiness,
  /** Each Angular project's TypeScript sources, plus the templates and stylesheets it can declare. */
  listSourceFiles: root => frameworkSourceFiles({ root, dependency: '@angular/core', projects: ['.ts'],
    sources: ['.ts', '.html', '.css', '.scss', '.sass', '.less', '.styl'] }),
  // Templates and stylesheets in a component's Code declare nothing.
  readCodeStructure: (root, references) => readTypeScriptOutline(ts, root, references.filter(reference => reference.file.endsWith('.ts'))),
  scan: scanAngular,
} satisfies ScannerPlugin
