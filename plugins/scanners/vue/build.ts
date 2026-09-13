import { cp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFrameworkPackage } from '../framework-package.ts'

const root = fileURLToPath(new URL('./', import.meta.url))
const require = createRequire(new URL('./package.json', import.meta.url))

export async function buildPackage(destination: string): Promise<void> {
  await buildFrameworkPackage(root, destination)
  await cp(path.join(path.dirname(require.resolve('@vue/language-core/package.json')), 'types'), path.join(destination, 'types'), { recursive: true })
}

if (import.meta.main) {
  const destination = path.join(root, 'dist/package')
  await rm(destination, { recursive: true, force: true })
  await buildPackage(destination)
  console.log(destination)
}
