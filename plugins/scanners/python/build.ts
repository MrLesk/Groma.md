import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))

/** Ship the Python interpreter, standard library and parser together. */
export async function buildPackage(destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  const result = await Bun.build({ entrypoints: [path.join(root, 'src/index.ts')],
    outdir: path.join(destination, 'src'), target: 'bun', format: 'esm', naming: 'index.js' })
  if (!result.success) throw new Error(result.logs.join('\n'))
  const worker = await Bun.build({ entrypoints: [path.join(root, 'worker/runtime.ts')],
    outdir: path.join(destination, 'dist/worker'), target: 'bun', format: 'esm', naming: 'runtime.js' })
  if (!worker.success) throw new Error(worker.logs.join('\n'))
  await cp(path.join(root, 'worker/scan.py'), path.join(destination, 'dist/worker/scan.py'))
  const require = createRequire(import.meta.url)
  const runtime = path.dirname(require.resolve('pyodide/package.json'))
  await cp(runtime, path.join(destination, 'dist/runtime'), { recursive: true })
  await cp(path.join(root, 'THIRD-PARTY-NOTICES.txt'), path.join(destination, 'THIRD-PARTY-NOTICES.txt'))
  await cp(path.join(root, '../../../LICENSE'), path.join(destination, 'LICENSE'))
  const { dependencies: _, ...manifest } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({ ...manifest,
    groma: { scanner: { ...manifest.groma.scanner, entry: './src/index.js' } },
  }, null, 2)}\n`)
}

if (import.meta.main) {
  const destination = process.argv[2] ?? path.join(root, 'dist/package')
  await rm(destination, { recursive: true, force: true })
  await buildPackage(destination)
  await cp(path.join(destination, 'dist'), path.join(root, 'dist'), { recursive: true })
  console.log(destination)
}
