import { cp, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFrameworkPackage } from '../framework-package.ts'

const root = fileURLToPath(new URL('./', import.meta.url))

export async function buildPackage(destination: string): Promise<void> {
  const declarations = await buildFrameworkPackage(root, destination)
  await cp(path.join(declarations, '../LICENSE.txt'), path.join(destination, 'typescript-LICENSE.txt'))
  await cp(path.join(declarations, '../ThirdPartyNoticeText.txt'), path.join(destination, 'typescript-ThirdPartyNoticeText.txt'))
}

if (import.meta.main) {
  const destination = path.join(root, 'dist/package')
  await rm(destination, { recursive: true, force: true })
  await buildPackage(destination)
  console.log(destination)
}
