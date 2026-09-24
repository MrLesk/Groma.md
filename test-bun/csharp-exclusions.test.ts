import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'
import manifest from '../plugins/scanners/csharp/package.json'
import { scannerFiles } from '../src/scanner/modules/selection.ts'

const artifact = process.env.GROMA_TEST_CSHARP_PACKAGE
const packaged = artifact ? test.concurrent : test.skip

// The worker reads what the adapter selects, so a file it could not read proves the adapter left it out.
packaged('the C# worker reads no project or source outside the scanner\'s files, and a ! pattern restores a file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-csharp-exclusions-'))
  try {
    // Each default-excluded input fails the scan if read: invalid project XML, and invalid syntax App would compile.
    const sources: Record<string, string> = {
      'App/App.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
      'App/Program.cs': 'namespace App; public static class Program { }',
      'App/Form.Designer.cs': 'namespace App; public partial class Form { }',
      'App/obj/Debug/Broken.cs': 'namespace App; public class Broken {',
      'tests/App.Tests/App.Tests.csproj': '<Project',
    }
    for (const [file, text] of Object.entries(sources)) {
      await mkdir(path.join(root, path.dirname(file)), { recursive: true })
      await writeFile(path.join(root, file), text)
    }
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited).toBe(0)
    const scanner: ScannerPlugin = (await import(path.join(artifact!, 'dist/index.js'))).default
    const { include, exclude } = manifest.groma.scanner
    const files = await scannerFiles(root, { include, exclude: [...exclude, '!App/Form.Designer.cs'] })

    expect((await scanner.scan(root, {}, files))!.files.map(file => file.file)).toEqual(['App/Form.Designer.cs', 'App/Program.cs'])
    // A configured input outside the scanner's files is not read, like any other project.
    const input = { input: 'tests/App.Tests/App.Tests.csproj' }
    expect(await scanner.scan(root, input, files)).toBeUndefined()
    await expect(scanner.checkReadiness!(root, input, files)).rejects.toThrow('No C# project')
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)
