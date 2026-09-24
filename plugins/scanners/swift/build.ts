import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('./', import.meta.url))
const libraries = ['SwiftSyntax', 'SwiftParser', 'SwiftDiagnostics', 'SwiftBasicFormat', 'SwiftParserDiagnostics']

/** Ship the compiler's source parser libraries; installed scanners never invoke swiftc. */
export async function buildPackage(destination: string): Promise<void> {
  const target = JSON.parse((await execute('swiftc', ['-print-target-info'])).stdout)
  const compilerBin = path.dirname(Bun.which('swiftc')!)
  const host = path.join(target.paths.runtimeResourcePath, 'host')
  const platform = `${process.platform}-${process.arch}`
  const assets = path.join(destination, 'dist', platform)
  const moduleCache = process.platform === 'win32' ? undefined : await mkdtemp(path.join(os.tmpdir(), 'groma-swift-build-'))
  try {
    await mkdir(assets, { recursive: true })
    const sources = (await readdir(path.join(root, 'worker'))).filter(file => file.endsWith('.swift')).sort()
    const worker = path.join(assets, process.platform === 'win32' ? 'worker.exe' : 'worker')
    if (moduleCache === undefined) await buildWindowsWorker(worker)
    else await execute('swiftc', ['-O', '-module-cache-path', moduleCache, '-I', host, '-L', host,
      ...linkerFlags(host), ...sources.map(file => path.join(root, 'worker', file)), '-o', worker])
    if (process.platform === 'darwin') {
      for (const library of libraries) await copyLibrary(host, assets, library)
    } else if (process.platform === 'linux') await copyLinuxLibraries(worker, target.paths.runtimeResourcePath, assets)
    else await copyWindowsLibraries(worker, compilerBin, assets)
    await writeFile(path.join(assets, 'engine.json'), `${JSON.stringify({ version: target.compilerVersion })}\n`)
    const bundle = await Bun.build({ entrypoints: [path.join(root, 'src/index.ts')], outdir: path.join(destination, 'src'),
      target: 'bun', format: 'esm', naming: 'index.js' })
    if (!bundle.success) throw new AggregateError(bundle.logs, 'Swift scanner adapter build failed')
    const { dependencies: _, ...manifest } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
    await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({ ...manifest, os: [process.platform], cpu: [process.arch],
      groma: { scanner: { ...manifest.groma.scanner, entry: './src/index.js' } },
      repository: { type: 'git', url: 'https://github.com/MrLesk/groma.md.git', directory: 'plugins/scanners/swift' },
      files: ['src', 'dist', 'LICENSE', 'SwiftSyntax.LICENSE', 'THIRD-PARTY-NOTICES.txt', 'README.md', 'validation.md'],
    }, null, 2)}\n`)
    await cp(path.join(root, '../../../LICENSE'), path.join(destination, 'LICENSE'))
    await cp(path.join(root, 'SwiftSyntax.LICENSE'), path.join(destination, 'SwiftSyntax.LICENSE'))
    await cp(path.join(root, 'THIRD-PARTY-NOTICES.txt'), path.join(destination, 'THIRD-PARTY-NOTICES.txt'))
    await cp(path.join(root, '../../../docs/scanners/swift/index.md'), path.join(destination, 'README.md'))
    await cp(path.join(root, '../../../docs/scanners/swift/validation.md'), path.join(destination, 'validation.md'))
  } finally { if (moduleCache !== undefined) await rm(moduleCache, { recursive: true, force: true }) }
}

/** SwiftPM package whose .build CI caches by toolchain and the SwiftSyntax revision. */
export function windowsSwiftPackageRoot(): string {
  const configured = process.env.GROMA_SWIFT_PM_CACHE
  return configured ? path.resolve(configured) : path.join(os.homedir(), '.cache', 'groma', 'swift-scanner')
}

/** Copy the manifest and worker into a SwiftPM package without removing its build directory. */
export async function prepareWindowsSwiftPackage(packageRoot: string): Promise<void> {
  const worker = path.join(packageRoot, 'worker')
  await rm(worker, { recursive: true, force: true })
  await mkdir(packageRoot, { recursive: true })
  await copyFile(path.join(root, 'Package.swift'), path.join(packageRoot, 'Package.swift'))
  await cp(path.join(root, 'worker'), worker, { recursive: true })
}

function linkerFlags(host: string): string[] {
  if (process.platform === 'darwin') return [
    '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx14.0`,
    '-Xlinker', '-rpath', '-Xlinker', '@executable_path',
  ]
  if (process.platform === 'linux') return ['-Xlinker', '-rpath', '-Xlinker', host]
  throw new Error(`Unsupported Swift scanner build host: ${process.platform}`)
}

/** Build the pinned parser sources because Windows ships only their runtime DLLs. */
async function buildWindowsWorker(worker: string): Promise<void> {
  const packageRoot = windowsSwiftPackageRoot()
  await prepareWindowsSwiftPackage(packageRoot)
  const args = ['build', '--package-path', packageRoot, '--configuration', 'release',
    '--disable-index-store', '--product', 'groma-swift-scanner', '-Xswiftc', '-use-ld=lld-link']
  await execute('swift', args)
  const binaries = (await execute('swift', [...args, '--show-bin-path'])).stdout.trim()
  await copyFile(path.join(binaries, 'groma-swift-scanner.exe'), worker)
}

/** ldd includes transitive dependencies; keep OS libraries on the host. */
async function copyLinuxLibraries(worker: string, runtime: string, destination: string): Promise<void> {
  const linked = (await execute('ldd', [worker])).stdout
  if (linked.includes('=> not found')) throw new Error(`Swift runtime library is missing:\n${linked}`)
  const files = [...linked.matchAll(/=> (\/.+) \(0x[0-9a-f]+\)/g)].map(match => match[1]!)
    .filter(file => file.startsWith(`${runtime}${path.sep}`))
  for (const file of files) {
    const bundled = path.join(destination, path.basename(file))
    await copyFile(file, bundled)
    await execute('patchelf', ['--set-rpath', '$ORIGIN', bundled])
  }
  await execute('patchelf', ['--set-rpath', '$ORIGIN', worker])
}

/** Follow PE imports so the package carries only the DLLs its worker needs. */
async function copyWindowsLibraries(worker: string, compilerBin: string, destination: string): Promise<void> {
  const system = path.join(process.env.SystemRoot!, 'System32')
  const search = [compilerBin, ...(process.env.PATH ?? '').split(path.delimiter), system]
  const pending = [worker], copied = new Set<string>()
  for (const file of pending) {
    const imports = (await execute(path.join(compilerBin, 'llvm-readobj.exe'), ['--coff-imports', file])).stdout
    for (const match of imports.matchAll(/^\s*Name: (.+\.dll)\s*$/gim)) {
      const name = match[1]!.trim(), key = name.toLowerCase()
      if (copied.has(key) || /^(api|ext)-ms-win-/.test(key)) continue
      copied.add(key)
      const library = windowsLibrary(name, [path.dirname(file), ...search], system)
      if (!library) continue
      await copyFile(library, path.join(destination, name))
      pending.push(library)
    }
  }
}

function windowsLibrary(name: string, directories: string[], system: string): string | undefined {
  const file = directories.map(directory => path.join(directory, name)).find(existsSync)
  if (!file) throw new Error(`Swift runtime DLL is missing: ${name}`)
  // The Visual C++ runtime is redistributable; the Windows API belongs to the OS.
  if (path.dirname(file).toLowerCase() === system.toLowerCase() && !/^(msvcp|vcruntime|concrt)\d/i.test(name)) return
  return file
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
