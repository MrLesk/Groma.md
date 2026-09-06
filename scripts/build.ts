import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const outfile = process.argv[2] ?? path.join('dist', process.platform === 'win32' ? 'groma.exe' : 'groma')
await mkdir(path.dirname(outfile), { recursive: true })

await Bun.build({
  entrypoints: ['src/cli.ts'],
  target: 'bun',
  format: 'esm',
  compile: { outfile },
  bytecode: true,
  minify: true,
  sourcemap: 'linked',
})
