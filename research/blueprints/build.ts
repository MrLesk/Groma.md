import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cssBlock, palettes } from '../../src/viewers/web/atoms/theme.ts'
import { mapCss } from '../../src/viewers/web/iso/style.ts'

const directory = resolve(import.meta.dir, '../../dist/blueprint-research')
await mkdir(directory, { recursive: true })
const result = await Bun.build({ entrypoints: [resolve(import.meta.dir, 'app.ts')], target: 'browser', minify: true })
if (!result.success) throw new AggregateError(result.logs, 'Blueprint prototype build failed')
const script = (await result.outputs[0]!.text()).replaceAll('</script', '<\\/script')
const css = await readFile(resolve(import.meta.dir, 'style.css'), 'utf8')
const theme = `:root { ${cssBlock(palettes.light)} } [data-theme="dark"] { ${cssBlock(palettes.dark)} } [data-theme="blueprint"] { ${cssBlock(palettes.blueprint)} }`
const license = await readFile(resolve(import.meta.dir, '../../LICENSE'), 'utf8')
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Groma — Blueprint placement research</title><style>${theme} ${mapCss} ${css}</style></head><body><!-- ${license} --><main id="app"></main><script>${script}</script></body></html>`
await writeFile(resolve(directory, 'index.html'), html)
console.log(`Built ${directory}/index.html (${Buffer.byteLength(html)} bytes)`)
