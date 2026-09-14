import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))

/** Ship a portable worker; the consumer supplies its Python interpreter. */
export async function buildPackage(destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  const result = await Bun.build({ entrypoints: [path.join(root, 'src/index.ts')],
    outdir: path.join(destination, 'src'), target: 'bun', format: 'esm', naming: 'index.js' })
  if (!result.success) throw new Error(result.logs.join('\n'))
  await cp(path.join(root, 'worker'), path.join(destination, 'worker'), { recursive: true })
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
  console.log(destination)
}
