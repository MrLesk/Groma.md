import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))

/** Bundle the SDK and ship its already compiled worker beside the scanner. */
export async function buildPackage(destination: string): Promise<void> {
  const require = createRequire(path.join(root, 'package.json'))
  const platform = `${process.platform}-${process.arch}`
  const worker = path.join(path.dirname(require.resolve(`@typescript/typescript-${platform}/package.json`)), 'lib')
  const output = path.join(destination, 'dist', platform)
  await mkdir(output, { recursive: true })
  for (const file of [process.platform === 'win32' ? 'tsc.exe' : 'tsc', 'lib.d.ts']) {
    await cp(path.join(worker, file), path.join(output, file))
  }
  const result = await Bun.build({
    entrypoints: [path.join(root, 'src/index.ts')], outdir: path.join(destination, 'src'),
    target: 'bun', format: 'esm', naming: 'index.js',
    plugins: [{ name: 'packaged-typescript-worker', setup(build) {
      // The pinned SDK normally resolves its platform package; the bundle owns that worker instead.
      build.onLoad({ filter: /[/\\]typescript[/\\]lib[/\\]getExePath\.js$/ }, () => ({
        loader: 'js', contents: `import path from 'node:path'
export default function getExePath() {
  return path.join(import.meta.dir, '../dist', process.platform + '-' + process.arch,
    process.platform === 'win32' ? 'tsc.exe' : 'tsc')
}`,
      }))
    } }],
  })
  if (!result.success) throw new Error(result.logs.join('\n'))
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
    name: manifest.name, version: manifest.version, description: manifest.description,
    private: manifest.private, type: 'module', license: 'MIT', os: [process.platform], cpu: [process.arch],
    groma: { scanner: { ...manifest.groma.scanner, entry: './src/index.js' } },
  }, null, 2)}\n`)
  await cp(path.join(root, '../../../LICENSE'), path.join(destination, 'LICENSE'))
  const compiler = path.dirname(require.resolve('typescript/package.json'))
  await cp(path.join(compiler, 'LICENSE'), path.join(destination, 'TYPESCRIPT-LICENSE'))
  await cp(path.join(compiler, 'NOTICE.txt'), path.join(destination, 'TYPESCRIPT-NOTICE.txt'))
}

if (import.meta.main) {
  const destination = process.argv[2] ?? path.join(root, 'dist/package')
  await rm(destination, { recursive: true, force: true })
  await buildPackage(destination)
  console.log(destination)
}
