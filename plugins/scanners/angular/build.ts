import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFrameworkPackage } from '../framework-package.ts'

const root = fileURLToPath(new URL('./', import.meta.url))

export async function buildPackage(destination: string): Promise<void> {
  await buildFrameworkPackage(root, destination)
}

if (import.meta.main) {
  const destination = path.join(root, 'dist/package')
  await rm(destination, { recursive: true, force: true })
  await buildPackage(destination)
  console.log(destination)
}
