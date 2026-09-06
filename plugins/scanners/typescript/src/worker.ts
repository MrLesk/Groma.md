import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { version } from 'typescript'

const executable = process.platform === 'win32' ? 'tsc.exe' : 'tsc'

/** The build embeds the worker under `groma-typescript-worker` at the standalone executable's root. */
function embeddedWorker(): string | undefined {
  if (globalThis.Bun?.isStandaloneExecutable !== true) return undefined
  return path.join(import.meta.dir, 'groma-typescript-worker')
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
    const embedded = embeddedWorker()
    if (embedded === undefined) return undefined
    const directory = path.join(os.tmpdir(), `groma-typescript-worker-${version}`)
    const tsc = path.join(directory, executable)
    if (!existsSync(tsc)) await unpack(embedded, directory)
    return tsc
  })()
  return resolved
}
