import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('./', import.meta.url))
const libraries = ['SwiftSyntax', 'SwiftParser', 'SwiftDiagnostics', 'SwiftBasicFormat', 'SwiftParserDiagnostics']

/** Ship the compiler's source parser libraries; installed scanners never invoke swiftc. */
export async function buildPackage(destination: string): Promise<void> {
  if (process.platform !== 'darwin') throw new Error('The Swift scanner package currently supports macOS.')
  const target = JSON.parse((await execute('swiftc', ['-print-target-info'])).stdout)
  const host = path.join(target.paths.runtimeResourcePath, 'host')
  const platform = `${process.platform}-${process.arch}`
  const assets = path.join(destination, 'dist', platform)
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-swift-build-'))
  try {
    await mkdir(assets, { recursive: true })
    const sources = (await readdir(path.join(root, 'worker'))).filter(file => file.endsWith('.swift')).sort()
    await execute('swiftc', ['-O', '-module-cache-path', temporary,
      '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx14.0`,
      '-I', host, '-L', host, '-Xlinker', '-rpath', '-Xlinker', '@executable_path',
      ...sources.map(file => path.join(root, 'worker', file)), '-o', path.join(assets, 'worker')])
    for (const library of libraries) await copyLibrary(host, assets, library)
    await writeFile(path.join(assets, 'engine.json'), `${JSON.stringify({ version: target.compilerVersion })}\n`)
    const bundle = await Bun.build({ entrypoints: [path.join(root, 'src/index.ts')], outdir: path.join(destination, 'src'),
      target: 'bun', format: 'esm', naming: 'index.js' })
    if (!bundle.success) throw new AggregateError(bundle.logs, 'Swift scanner adapter build failed')
    const { dependencies: _, ...manifest } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
    await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({ ...manifest, cpu: [process.arch],
      groma: { scanner: { ...manifest.groma.scanner, entry: './src/index.js' } },
      repository: { type: 'git', url: 'https://github.com/MrLesk/Groma.md.git', directory: 'plugins/scanners/swift' },
      files: ['src', 'dist', 'LICENSE', 'SwiftSyntax.LICENSE', 'README.md', 'validation.md'],
    }, null, 2)}\n`)
    await cp(path.join(root, '../../../LICENSE'), path.join(destination, 'LICENSE'))
    await cp(path.join(root, 'SwiftSyntax.LICENSE'), path.join(destination, 'SwiftSyntax.LICENSE'))
    await cp(path.join(root, '../../../docs/scanners/swift/index.md'), path.join(destination, 'README.md'))
    await cp(path.join(root, '../../../docs/scanners/swift/validation.md'), path.join(destination, 'validation.md'))
  } finally { await rm(temporary, { recursive: true, force: true }) }
}

async function copyLibrary(host: string, destination: string, name: string): Promise<void> {
  const file = path.join(destination, `lib${name}.dylib`)
  await cp(path.join(host, `lib${name}.dylib`), file)
  const linked = (await execute('otool', ['-L', file])).stdout.split('\n').slice(1)
    .map(line => line.trim().split(' ')[0]!).filter(library => library.startsWith('@rpath/'))
  const changes = linked.flatMap(library => ['-change', library, `@loader_path/${path.basename(library)}`])
  await execute('install_name_tool', ['-id', `@rpath/lib${name}.dylib`, ...changes, file])
  await execute('codesign', ['--force', '--sign', '-', file])
}

if (import.meta.main) {
  const destination = process.argv[2] ?? path.join(root, 'dist/package')
  await buildPackage(destination)
  await cp(path.join(destination, 'dist', `${process.platform}-${process.arch}`),
    path.join(root, 'dist', `${process.platform}-${process.arch}`), { recursive: true })
  console.log(destination)
}
