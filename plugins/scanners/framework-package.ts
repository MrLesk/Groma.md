import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

/** Build the three TypeScript-backed framework packages with their own pinned compiler. */
export async function buildFrameworkPackage(root: string, destination: string): Promise<string> {
  const manifestFile = path.join(root, 'package.json')
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  const id: string = manifest.groma.scanner.id
  const typescript = createRequire(manifestFile).resolve('typescript')
  const declarations = path.dirname(typescript)
  const output = path.join(destination, 'dist')
  await mkdir(output, { recursive: true })
  const result = await Bun.build({
    entrypoints: [path.join(root, 'src/index.ts')], outdir: output, target: 'bun', format: 'esm', naming: 'index.js',
    plugins: [{ name: `${id}-typescript`, setup(build) {
      build.onResolve({ filter: /^typescript$/ }, () => ({ path: './typescript.cjs', external: true }))
    } }],
  })
  if (!result.success) throw new Error(result.logs.join('\n'))
  // Keep the compiler beside its libraries so its own filename resolves at runtime.
  await cp(typescript, path.join(output, 'typescript.cjs'))
  for (const file of await readdir(declarations)) {
    if (file.startsWith('lib.') && file.endsWith('.d.ts')) await cp(path.join(declarations, file), path.join(output, file))
  }
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
    name: manifest.name, version: manifest.version, description: manifest.description, private: manifest.private, type: 'module', license: 'MIT',
    groma: { scanner: { ...manifest.groma.scanner, entry: './dist/index.js' } },
  }, null, 2)}\n`)
  await cp(path.join(root, '../../../LICENSE'), path.join(destination, 'LICENSE'))
  await cp(path.join(root, '../../../docs/scanners', id, 'index.md'), path.join(destination, 'README.md'))
  await cp(path.join(root, '../../../docs/scanners', id, 'validation.md'), path.join(destination, 'validation.md'))
  return declarations
}
