import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'bun:test'

import fixture from '../test/fixtures/scanner-discovery.json'
import { discoverScanners } from '../src/scanner/modules/discovery.ts'
import { recommendScanners } from '../src/scanner/modules/catalog.ts'
import type { OfficialScanner, TechnologyFinding } from '../src/scanner/modules/catalog.ts'

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(root, file)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, content)
  }
}

async function project(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-discovery-'))
  const child = Bun.spawn(['git', 'init', '--quiet', root], { stderr: 'pipe' })
  if (await child.exited !== 0) throw new Error(await new Response(child.stderr).text())
  return root
}

test.concurrent('mixed nested declarations produce complementary candidates and skip dependency/build content', async () => {
  const root = await project()
  try {
    await writeTree(root, fixture)
    await writeTree(root, { '.gitignore': 'ignored/\n', 'ignored/go.mod': 'module ignored\ngo 1.1\n' })
    const result = await discoverScanners(root)
    expect(new Set(result.findings.map(finding => finding.technology))).toEqual(
      new Set(['java', 'angular', 'vue', 'react', 'typescript', 'csharp', 'go', 'rust', 'spring-boot']),
    )
    expect(result.findings.every(finding => !/^(node_modules|vendor|target|dist|ignored)\//.test(finding.file))).toBe(true)
    expect(result.findings.some(finding => finding.file.includes('/obj/'))).toBe(false)
    expect(result.findings.find(finding => finding.technology === 'angular')).toMatchObject({
      kind: 'framework', file: 'frontend/package.json', version: '^21.2.17',
    })
    expect(result.findings.find(finding => finding.technology === 'angular')?.resolvedVersion).toBeUndefined()
    expect(result.recommendations.map(item => item.id)).toEqual(['typescript', 'java', 'angular', 'vue', 'react', 'csharp', 'go', 'rust'])
    expect(result.recommendations.find(item => item.id === 'typescript')?.status).toBe('embedded')
    expect(result.recommendations.filter(item => item.id !== 'typescript').every(item => item.status === 'unavailable' && item.installSource === undefined)).toBe(true)
    expect(result.limits.some(limit => limit.includes('spring-boot'))).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('root React and nested Vue retain installed version evidence and complementary coverage limits', async () => {
  const root = await project()
  try {
    await writeTree(root, {
      'package.json': fixture['package.json'],
      'apps/dashboard/package.json': fixture['apps/dashboard/package.json'],
      'node_modules/react/package.json': '{"name":"react","version":"19.1.0"}',
      'apps/dashboard/node_modules/vue/package.json': '{"name":"vue","version":"3.5.1"}',
    })
    const result = await discoverScanners(root)
    expect(result.findings).toHaveLength(2)
    expect(result.recommendations.find(item => item.id === 'typescript')?.status).toBe('embedded')
    for (const [technology, file, version, installed, supported] of [
      ['react', 'package.json', '^19.0.0', '19.1.0', '^19.0.0'],
      ['vue', 'apps/dashboard/package.json', '^3.5.0', '3.5.1', '^3.5.0'],
    ]) {
      const evidence = result.findings.filter(item => item.technology === technology)
      expect(evidence[0]).toMatchObject({ kind: 'framework', file, version, resolvedVersion: { version: installed } })
      const candidate = result.recommendations.find(item => item.id === technology)
      expect(candidate?.status).toBe('unavailable')
      expect(candidate?.installSource).toBeUndefined()
      const compatible: OfficialScanner = {
        id: technology, package: `@fixture/scanner-${technology}`, technologies: [technology], description: 'Fixture support.',
        release: { version: '1.0.0', groma: '^0.2.0', technologyVersions: { [technology]: supported } },
      }
      expect(recommendScanners(evidence, [], '0.2.0', [compatible])[0]?.status).toBe('installable')
      const incompatible = { ...compatible, release: { ...compatible.release!, technologyVersions: { [technology]: '<1.0.0' } } }
      expect(recommendScanners(evidence, [], '0.2.0', [incompatible])[0]?.status).toBe('incompatible')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('discovery retains configured selection and notices a newly added nested project', async () => {
  const root = await project()
  const selected = '{"scanners":[{"id":"java","source":"./plugins/java"}]}'
  try {
    await writeTree(root, {
      'groma/scanners.json': selected,
      'pom.xml': fixture['pom.xml'],
    })
    const before = await discoverScanners(root)
    expect(before.recommendations.find(item => item.id === 'java')?.status).toBe('configured')
    expect(before.inventory.find(item => item.id === 'java')?.status).toBe('missing')
    await writeTree(root, { 'new-client/package.json': fixture['frontend/package.json'] })
    const after = await discoverScanners(root)
    expect(after.recommendations.find(item => item.id === 'angular')?.evidence[0]?.file).toBe('new-client/package.json')
    expect(after.inventory).toEqual(before.inventory)
    expect(await readFile(path.join(root, 'groma/scanners.json'), 'utf8')).toBe(selected)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

const release: OfficialScanner = {
  id: 'java', package: '@fixture/scanner-java', technologies: ['java'], description: 'Fixture compiler support.',
  release: { version: '1.0.0', groma: '^0.2.0', technologyVersions: { java: '>=21.0.0 <26.0.0' } },
}

function java(version?: string): TechnologyFinding {
  return { technology: 'java', kind: 'language', file: 'pom.xml', declaration: 'java.version', version }
}

test.concurrent('catalog matching offers only compatible releases and avoids replacing configured scanners', () => {
  expect(recommendScanners([java('25')], [], '0.2.0', [release])[0]).toMatchObject({
    status: 'installable', installSource: '@fixture/scanner-java@1.0.0',
  })
  for (const [finding, groma, status] of [
    [java('25'), '1.0.0', 'incompatible'],
    [java('17'), '0.2.0', 'incompatible'],
    [java(`\${jdk.version}`), '0.2.0', 'uncertain'],
    [java(), '0.2.0', 'uncertain'],
    [java('^25.0.0'), '0.2.0', 'uncertain'],
  ] as const) {
    const recommendation = recommendScanners([finding], [], groma, [release])[0]
    expect(recommendation?.status).toBe(status)
    expect(recommendation?.installSource).toBeUndefined()
  }
  const selected = [{ id: 'java', source: './java', status: 'found' as const }]
  expect(recommendScanners([java('25')], selected, '0.2.0', [release])[0]).toMatchObject({ status: 'configured' })
  expect(recommendScanners([java('25')], selected, '0.2.0', [release])[0]?.installSource).toBeUndefined()
})

test.concurrent('all project versions must fit and unresolved declarations stay visible', async () => {
  const incompatible = recommendScanners([java('25'), java('17')], [], '0.2.0', [release])[0]
  expect(incompatible?.status).toBe('incompatible')
  const root = await project()
  try {
    await writeTree(root, { 'pom.xml': '<project />', 'client/package.json': '{bad json}' })
    const result = await discoverScanners(root)
    expect(result.findings.find(finding => finding.technology === 'java')?.version).toBeUndefined()
    expect(result.limits.some(limit => limit.includes('client/package.json'))).toBe(true)
    expect(result.limits.some(limit => limit.includes('pom.xml'))).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('installed Angular version confirms its declaration range without loading package code', async () => {
  const root = await project()
  const angular: OfficialScanner = {
    id: 'angular', package: '@fixture/scanner-angular', technologies: ['angular'], description: 'Fixture Angular support.',
    release: { version: '1.0.0', groma: '^0.2.0', technologyVersions: { angular: '^21.2.0' } },
  }
  try {
    await writeTree(root, {
      'client/package.json': fixture['frontend/package.json'],
      'client/node_modules/@angular/core/package.json': '{"name":"@angular/core","version":"21.2.17","main":"index.js"}',
      'client/node_modules/@angular/core/index.js': 'throw new Error("Package code must not execute")',
    })
    const result = await discoverScanners(root)
    const evidence = result.findings.filter(item => item.technology === 'angular')
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({
      version: '^21.2.17',
      resolvedVersion: { version: '21.2.17', file: 'client/node_modules/@angular/core/package.json' },
    })
    expect(recommendScanners(evidence, result.inventory, '0.2.0', [angular])[0]).toMatchObject({
      status: 'installable', installSource: '@fixture/scanner-angular@1.0.0',
    })
    await writeTree(root, {
      'client/node_modules/@angular/core/package.json': '{"name":"@angular/core","version":"21.2.1"}',
    })
    const mismatched = await discoverScanners(root)
    expect(recommendScanners(mismatched.findings, mismatched.inventory, '0.2.0', [angular])[0]?.status).toBe('incompatible')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.concurrent('scanner discover JSON works before initialization without creating configuration', async () => {
  const root = await project()
  try {
    await writeTree(root, { 'pom.xml': fixture['pom.xml'] })
    const child = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../src/cli.ts'), 'scanner', 'discover', '--json'], {
      cwd: root, stdout: 'pipe', stderr: 'pipe',
    })
    const [code, output] = await Promise.all([child.exited, new Response(child.stdout).text()])
    expect(code).toBe(0)
    expect(JSON.parse(output).recommendations.map((item: { id: string }) => item.id)).toEqual(['typescript', 'java'])
    expect(await Bun.file(path.join(root, 'groma/scanners.json')).exists()).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
