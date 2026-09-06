import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import packageJson from '../package.json' with { type: 'json' }

const outfile = process.env.GROMA_BUILD_OUTFILE
  ?? process.argv[2]
  ?? path.join('dist', process.platform === 'win32' ? 'groma.exe' : 'groma')
const target = process.env.GROMA_BUILD_TARGET as Bun.Build.CompileTarget | undefined
const dependencyAssets = Object.entries({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
})
  .filter(([, version]) => !version.startsWith('workspace:'))

function packageAssetName(name: string): string {
  return `groma-package-${encodeURIComponent(name)}`
}

async function prepareCreditAssets(root: string): Promise<string[]> {
  const assets: string[] = []
  for (const [name] of dependencyAssets) {
    const directory = path.join(root, packageAssetName(name))
    await mkdir(directory)
    await copyFile(path.join('node_modules', name, 'package.json'), path.join(directory, 'package.json'))
    for (const license of ['LICENSE', 'LICENSE.md']) {
      try {
        await copyFile(path.join('node_modules', name, license), path.join(directory, 'LICENSE'))
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    assets.push(directory)
  }
  return assets
}

/** `<os>-<cpu>` of the compile target as TypeScript names it, e.g. `bun-windows-x64-baseline` → `win32-x64`. */
function typescriptPlatform(): string {
  if (target === undefined) return `${process.platform}-${process.arch}`
  return target.replace(/^bun-/, '').replace(/-baseline$/, '').replace(/^windows-/, 'win32-')
}

/** The native TypeScript worker starts only with `lib.d.ts` beside it; scanner programs use `noLib`, so nothing else ships. */
async function prepareTypeScriptWorkerAsset(root: string): Promise<string> {
  const platform = typescriptPlatform()
  const lib = path.join('node_modules', '@typescript', `typescript-${platform}`, 'lib')
  const executable = platform.startsWith('win32-') ? 'tsc.exe' : 'tsc'
  const directory = path.join(root, 'groma-typescript-worker')
  await mkdir(directory)
  await copyFile(path.join(lib, executable), path.join(directory, executable))
  await copyFile(path.join(lib, 'lib.d.ts'), path.join(directory, 'lib.d.ts'))
  return directory
}

async function prepareRendererAsset(root: string): Promise<string> {
  const build = await Bun.build({
    entrypoints: [path.resolve('src/viewers/web/render.ts')],
    target: 'browser',
  })
  const directory = path.join(root, 'groma-web-render')
  await mkdir(directory)
  await writeFile(path.join(directory, 'index.js'), await build.outputs[0]!.text())
  return directory
}

const packedRoot = await mkdtemp(path.join(os.tmpdir(), 'groma-compile-assets-'))
const compile: Bun.CompileBuildOptions = {
  outfile,
  assets: [
    ...await prepareCreditAssets(packedRoot),
    await prepareRendererAsset(packedRoot),
    await prepareTypeScriptWorkerAsset(packedRoot),
    'docs',
  ],
  autoloadDotenv: false,
  autoloadBunfig: false,
  autoloadTsconfig: false,
  autoloadPackageJson: false,
  ...(target === undefined ? {} : { target }),
  ...(target?.startsWith('bun-windows-') === true
    ? {
        windows: {
          title: 'Groma',
          publisher: packageJson.author,
          version: packageJson.version,
          description: packageJson.description,
          copyright: `Copyright ${new Date().getFullYear()} ${packageJson.author}`,
        },
      }
    : {}),
}

await mkdir(path.dirname(outfile), { recursive: true })
try {
  await Bun.build({
    entrypoints: ['src/cli.ts'],
    target: 'bun',
    format: 'esm',
    compile,
    bytecode: true,
    minify: true,
    sourcemap: 'linked',
  })
} finally {
  await rm(packedRoot, { recursive: true, force: true })
}
