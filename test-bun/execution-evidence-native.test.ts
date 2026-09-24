import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseScanObservation, type ScannerPlugin } from '@groma/scanner'
import { buildPackage as buildPython } from '../plugins/scanners/python/build.ts'
import { buildPackage as buildSwift } from '../plugins/scanners/swift/build.ts'
import { buildWorker as buildJava } from '../plugins/scanners/java/build.ts'
import { javaCommand, run } from '../plugins/scanners/java/src/process.ts'
import { buildWorker as buildGo } from '../plugins/scanners/go/build.ts'
import { scanGoSource } from '../plugins/scanners/go/src/adapter.ts'
import { scanRustSource } from '../plugins/scanners/rust/src/index.ts'

async function example(files: Record<string, string>, action: (root: string, artifact: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'groma-native-entry-'))
  const root = path.join(directory, 'project'), artifact = path.join(directory, 'scanner')
  try {
    for (const [file, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), text)
    }
    expect(await Bun.spawn(['git', 'init', '--quiet'], { cwd: root }).exited).toBe(0)
    await action(root, artifact)
  } finally { await rm(directory, { recursive: true, force: true }) }
}

/** Builds the scanner package, or copies a prebuilt one: CI caches the Swift package, whose build takes minutes. */
async function packaged(build: (directory: string) => Promise<void>, artifact: string, prebuilt?: string): Promise<ScannerPlugin> {
  if (prebuilt) await cp(prebuilt, artifact, { recursive: true })
  else await build(artifact)
  return (await import(path.join(artifact, 'src/index.js'))).default
}

test.concurrent('Python execution guards and console scripts identify entries without claiming another project', async () => {
  await example({
    'pyproject.toml': '[project]\nname = "commands"\n[project.scripts]\nserve = "service:run"\n',
    'service.py': 'import helper\nimport library.shared\ndef run():\n    helper.run()\n',
    'helper.py': 'def run():\n    pass\n',
    'worker.py': 'if __name__ == "__main__":\n    print("ready")\n',
    'library/pyproject.toml': '[project]\nname = "library"\n',
    'library/shared.py': 'def work():\n    pass\n',
  }, async (root, artifact) => {
    const scan = await (await packaged(buildPython, artifact)).scan(root)
    expect(scan!.entryPoints!.map(entry => entry.file).sort()).toEqual(['service.py', 'worker.py'])
    expect(scan!.entryPoints!.find(entry => entry.file === 'service.py')!.files).toEqual(['helper.py', 'service.py'])
  })
}, 60000)

test.concurrent('Swift reports the main attribute without treating source files or imports as applications', async () => {
  await example({ 'App.swift': '@main struct App { static func main() {} }', 'Library.swift': 'struct Library {}' }, async (root, artifact) => {
    const scan = await (await packaged(buildSwift, artifact, process.env.GROMA_TEST_SWIFT_PACKAGE)).scan(root)
    expect(scan!.entryPoints).toEqual([{ file: 'App.swift', declaration: 'App.swift', name: 'App', files: ['App.swift'] }])
  })
}, 60000)

test.concurrent('Java reports executable main signatures and their compilation inputs', async () => {
  await example({
    'Service.java': 'public class Service { public static void main(String[] args) { Helper.run(); } }',
    'Worker.java': 'public class Worker { public static void main(String... args) {} }',
    'Helper.java': 'class Helper { static void run() {} public void main(String[] args) {} }',
  }, async (root, artifact) => {
    const worker = path.join(artifact, 'worker.jar')
    await buildJava(worker)
    const scan = parseScanObservation(await run(javaCommand(), ['-jar', worker, root, '21', 'UTF-8'], root, 'Service.java\nWorker.java\nHelper.java\n'))
    expect(scan.entryPoints!.map(entry => entry.file).sort()).toEqual(['Service.java', 'Worker.java'])
    expect(scan.entryPoints!.every(entry => entry.files.includes('Helper.java'))).toBe(true)
  })
}, 60000)

const goTest = process.env.GROMA_TEST_GO ? test.concurrent : test.skip
goTest('Go main packages include the module packages they import, directly or indirectly', async () => {
  await example({
    'go.mod': 'module example.test/entries\n\ngo 1.24\n',
    'cmd/api/main.go': 'package main\nimport (\n"example.test/entries/lib"\n_ "example.test/entries/plugins/one"\n_ "example.test/entries/plugins/two"\n)\nfunc main() { lib.Run(); help() }\n',
    'cmd/api/helper.go': 'package main\nfunc help() {}\n',
    'cmd/worker/main.go': 'package main\nfunc main() {}\n',
    'lib/library.go': 'package lib\nimport "example.test/entries/lib/store"\nfunc Run() { store.Save() }\n',
    'lib/store/store.go': 'package store\nfunc Save() {}\n',
    'plugins/one/one.go': 'package one\n',
    'plugins/two/two.go': 'package two\n',
  }, async (root, artifact) => {
    const worker = path.join(artifact, process.platform === 'win32' ? 'worker.exe' : 'worker')
    await buildGo(worker, process.env.GROMA_TEST_GO)
    const scan = await scanGoSource(root, { worker })
    const files = (file: string) => scan.entryPoints!.find(entry => entry.file === file)!.files
    // Blank imports are compiled into the binary too.
    expect(files('cmd/api/main.go')).toEqual([
      'cmd/api/helper.go', 'cmd/api/main.go', 'lib/library.go', 'lib/store/store.go', 'plugins/one/one.go', 'plugins/two/two.go',
    ])
    expect(files('cmd/worker/main.go')).toEqual(['cmd/worker/main.go'])
  })
}, 60000)

const rustTest = process.env.GROMA_TEST_RUST ? test.concurrent : test.skip
rustTest('Rust reports separate binary targets and excludes the library crate from their source units', async () => {
  await example({
    'Cargo.toml': '[package]\nname = "entries"\nversion = "0.1.0"\nedition = "2021"\n',
    'src/main.rs': 'mod helper; fn main() { helper::run(); }',
    'src/helper.rs': 'pub fn run() {}',
    'src/bin/worker.rs': 'fn main() {}',
    'src/lib.rs': 'pub fn library() {}',
  }, async root => {
    const scan = await scanRustSource(root)
    expect(scan.entryPoints!.map(entry => entry.file).sort()).toEqual(['src/bin/worker.rs', 'src/main.rs'])
    expect(scan.entryPoints!.find(entry => entry.file === 'src/main.rs')!.files).toEqual(['src/helper.rs', 'src/main.rs'])
  })
}, 60000)
