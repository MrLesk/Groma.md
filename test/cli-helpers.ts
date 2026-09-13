import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

export function readRelative(root: string, relative: string): Promise<string> {
  return readFile(path.join(root, ...relative.split('/')), 'utf8')
}
