import { expect, test } from 'bun:test'
import { recommendScanners, type TechnologyFinding, type OfficialScanner } from '../src/scanner/modules/catalog.ts'

const catalog: OfficialScanner[] = [{
  id: 'language', package: 'example-scanner', description: '', technologies: ['language'], rules: [],
  release: { version: '1.0.0', groma: '^0.2.0', technologyVersions: { language: '^7.0.0' } },
}]
const declaration: TechnologyFinding = {
  technology: 'language', kind: 'language', file: 'app/package.json', declaration: 'compiler', version: '7.0.2',
}
const clue: TechnologyFinding = {
  technology: 'language', kind: 'language', file: 'app/compiler.json', declaration: 'configuration',
}

test.concurrent('a configuration clue uses the version declared in its own project directory', () => {
  expect(recommendScanners([clue, declaration], [], '0.2.0', catalog)[0]?.status).toBe('installable')
  expect(recommendScanners([clue], [], '0.2.0', catalog)[0]?.status).toBe('uncertain')
  expect(recommendScanners([clue, { ...declaration, file: 'other/package.json' }], [], '0.2.0', catalog)[0]?.status).toBe('uncertain')
})

test.concurrent('presence clues do not override unresolved or incompatible compiler declarations', () => {
  for (const version of ['^7.0.0', '8.0.0']) {
    expect(recommendScanners([clue, { ...declaration, version }], [], '0.2.0', catalog)[0]?.status)
      .toBe(version.startsWith('^') ? 'uncertain' : 'incompatible')
  }
})
