import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))
const require = createRequire(new URL('./package.json', import.meta.url))

/** Bundle the compiler and its own TypeScript so workspace hoisting cannot select Groma's SDK. */
export async function buildPackage(destination: string): Promise<void> {
  const output = path.join(destination, 'dist')
  await mkdir(output, { recursive: true })
  const typescript = require.resolve('typescript')
  const result = await Bun.build({
    entrypoints: [path.join(root, 'src/index.ts')], outdir: output, target: 'bun', format: 'esm', naming: 'index.js',
    plugins: [{ name: 'angular-typescript', setup(build) {
      build.onResolve({ filter: /^typescript$/ }, () => ({ path: typescript }))
    } }],
  })
  if (!result.success) throw new Error(result.logs.join('\n'))
  for (const file of await readdir(path.dirname(typescript))) {
    if (file.startsWith('lib.') && file.endsWith('.d.ts')) await cp(path.join(path.dirname(typescript), file), path.join(output, file))
  }
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
    name: manifest.name, version: manifest.version, private: true, type: 'module', license: 'MIT',
    groma: { scanner: { id: 'angular', entry: './dist/index.js' } },
  }, null, 2)}\n`)
  await cp(path.join(root, '../../../LICENSE'), path.join(destination, 'LICENSE'))
  await cp(path.join(root, '../../../docs/scanners/angular/index.md'), path.join(destination, 'README.md'))
  await cp(path.join(root, '../../../docs/scanners/angular/validation.md'), path.join(destination, 'validation.md'))
}

if (import.meta.main) {
  const destination = path.join(root, 'dist/package')
  await rm(destination, { recursive: true, force: true })
  await buildPackage(destination)
  console.log(destination)
}
