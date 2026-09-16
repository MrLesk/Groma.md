import type { ScannerPlugin } from '@groma/scanner'
import { checkAngularReadiness, scanAngular } from './scan.ts'

export { scanAngular } from './scan.ts'

export default {
  id: 'angular',
  watch: { include: ['**/*.ts', '**/*.html', '**/*.css', '**/*.scss', '**/*.sass', '**/*.less', '**/*.styl', '**/tsconfig*.json', '**/package.json'], exclude: [] },
  checkReadiness: checkAngularReadiness,
  scan: scanAngular,
} satisfies ScannerPlugin
