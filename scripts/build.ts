import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
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

async function prepareCreditAssets(): Promise<{ root: string; assets: string[] }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-credit-assets-'))
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
  return { root, assets }
}

const creditAssets = await prepareCreditAssets()
const compile: Bun.CompileBuildOptions = {
  outfile,
  assets: [
    ...creditAssets.assets,
    'docs',
    'package.json',
    'src/viewers/web/atoms/lockup.svg',
    'src/viewers/web/work/backlog-mark.png',
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
  await rm(creditAssets.root, { recursive: true, force: true })
}
