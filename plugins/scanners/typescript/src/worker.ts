import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { version } from 'typescript'

const executable = process.platform === 'win32' ? 'tsc.exe' : 'tsc'

/** Bun's embedded file root inside a compiled executable, or undefined when running from source. */
function packedRoot(): string | undefined {
  return ['/$bunfs/root', 'B:\\~BUN\\root'].find(root => existsSync(root))
}

/** Fills `directory` through a staged rename so a half-written worker is never picked up. */
async function unpack(embedded: string, directory: string): Promise<void> {
  const staging = await mkdtemp(`${directory}-`)
  for (const file of [executable, 'lib.d.ts']) {
    await writeFile(path.join(staging, file), await readFile(path.join(embedded, file)))
  }
  await chmod(path.join(staging, executable), 0o755)
  try {
    await rename(staging, directory)
  } catch (error) {
    if (!existsSync(directory)) throw error
    await rm(staging, { recursive: true, force: true })
  }
}

let resolved: Promise<string | undefined> | undefined

/**
 * Compiled Groma cannot spawn the TypeScript worker from its embedded filesystem, so it unpacks the
 * embedded `tsc` once per TypeScript version into the OS temp directory and reuses it from there.
 * From source, TypeScript resolves its own worker.
 */
export function typescriptWorkerPath(): Promise<string | undefined> {
  resolved ??= (async () => {
    const root = packedRoot()
    if (root === undefined) return undefined
    const directory = path.join(os.tmpdir(), `groma-typescript-worker-${version}`)
    const tsc = path.join(directory, executable)
    if (!existsSync(tsc)) await unpack(path.join(root, 'groma-typescript-worker'), directory)
    return tsc
  })()
  return resolved
}
