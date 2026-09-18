import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import { httpRelationships } from '../src/http-relationships.ts'

const artifact = process.env.GROMA_TEST_CSHARP_PACKAGE
const packaged = artifact ? test.concurrent : test.skip

packaged('C# HTTP facts reach core, which derives a row for the paths it can compare', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-http-'))
  try {
    await cp(path.resolve(import.meta.dir, '../test/fixtures/csharp-http'), root, { recursive: true })
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    const scanner: ScannerPlugin = (await import(path.join(artifact!, 'dist/index.js'))).default
    // The contract validates the facts while parsing, and combining remaps their operation ids.
    const scan = (await scanner.scan(root))!
    const operations = new Map(scan.operations!.map(operation => [operation.id, operation.file]))
    expect(scan.httpEndpoints!.every(endpoint => operations.has(endpoint.operation))).toBe(true)
    expect(scan.httpRequests!.every(request => operations.has(request.operation))).toBe(true)

    const owners = new Map(scan.files.map(file => [file.file, file.file]))
    const rows = httpRelationships([scan], owners).map(row => [row.source, row.target, row.description, row.technology])
    // Core compares literals case-insensitively, so lowercase client URLs reach the [controller] routes.
    expect(rows.sort()).toEqual([
      ['TalkClient.cs', 'Program.cs', 'Calls HTTP endpoint: HEAD /ping', 'csharp'],
      ['TalkClient.cs', 'TalksController.cs',
        'Calls HTTP endpoints: GET /api/Talks, GET /api/Talks/:id, GET /api/Talks/Feed, GET /api/Talks/latest, POST /api/Talks', 'csharp'],
      ['TalksApi.cs', 'TalksController.cs',
        'Calls HTTP endpoints: GET /api/Talks, GET /api/Talks/:id, POST /api/Talks', 'csharp'],
    ])
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
