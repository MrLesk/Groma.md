import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { OfficialScanner } from '../src/scanner/modules/catalog.ts'
import { discoverScanners, formatDiscovery } from '../src/scanner/modules/discovery.ts'

/** One scanner is identified by source files, the other by an exact project file. */
const catalog: OfficialScanner[] = [
  {
    id: 'source-plugin', package: 'example-source-scanner', description: '', technologies: ['sourcelang'],
    rules: [{
      type: 'file', kind: 'language', technology: 'sourcelang',
      files: ['**/*.example'], declaration: 'Example source files',
    }],
  },
  {
    id: 'project-plugin', package: 'example-project-scanner', description: '', technologies: ['projectlang'],
    rules: [{
      type: 'file', kind: 'language', technology: 'projectlang',
      files: ['**/project.json'], declaration: 'Example project configuration',
    }],
  },
]

async function repository(sources: number): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-discovery-'))
  for (let index = 0; index < sources; index += 1) {
    await writeFile(path.join(root, `page-${index}.example`), 'source\n')
  }
  await writeFile(path.join(root, 'project.json'), '{}')
  await mkdir(path.join(root, 'web'), { recursive: true })
  await writeFile(path.join(root, 'web/project.json'), '{}')
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited).toBe(0)
  return root
}

/** The evidence column of every finding line for one technology. */
function evidence(report: string, technology: string): string[] {
  return report.split('\n').flatMap(line => {
    const columns = line.split('\t')
    return columns[0] === technology ? [columns[2]!] : []
  })
}

test.concurrent('a source-file technology reports one line with the file count and the first path', async () => {
  const root = await repository(3)
  try {
    const discovery = await discoverScanners(root, {}, catalog)
    expect(discovery.findings.filter(finding => finding.sourceFiles)).toHaveLength(3)
    const [line, ...extra] = evidence(formatDiscovery(discovery), 'sourcelang')
    expect(extra).toEqual([])
    expect(line).toContain('3 files')
    expect(line).toContain('page-0.example')
    expect(line).not.toContain('page-1.example')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a single source file needs no count, and exact project files keep one line each', async () => {
  const root = await repository(1)
  try {
    const report = formatDiscovery(await discoverScanners(root, {}, catalog))
    expect(evidence(report, 'sourcelang')).toEqual([expect.stringContaining('page-0.example')])
    expect(evidence(report, 'sourcelang')[0]).not.toContain('1 files')
    expect(evidence(report, 'projectlang').map(column => column.split(' ')[0]))
      .toEqual(['project.json', 'web/project.json'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a source-file technology counts each file once, whichever rules and scanners match it', async () => {
  const rule = (files: string[], declaration: string) => ({
    type: 'file' as const, kind: 'language' as const, technology: 'sourcelang', files, declaration,
  })
  const [source] = catalog
  const overlapping: OfficialScanner[] = [
    { ...source!, rules: [rule(['**/*.example'], 'Example source files'), rule(['**/*.sample'], 'Example samples')] },
    { ...source!, id: 'other-source-plugin', package: 'other-source-scanner', rules: [rule(['**/*.example'], 'Example source files')] },
  ]
  const root = await repository(2)
  try {
    await writeFile(path.join(root, 'page.sample'), 'sample\n')
    const [line, ...extra] = evidence(formatDiscovery(await discoverScanners(root, {}, overlapping)), 'sourcelang')
    expect(extra).toEqual([])
    expect(line).toContain('3 files; first page-0.example')
  } finally { await rm(root, { recursive: true, force: true }) }
})
