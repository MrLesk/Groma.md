import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { run } from './process.ts'

export const sdkVersion = '10.0.400'
const metadataUrl = 'https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json'

export function sdkRid(platform = process.platform, arch = process.arch): string {
  const os = { linux: 'linux', darwin: 'osx', win32: 'win' }[platform as 'linux' | 'darwin' | 'win32']
  if (!os || !['x64', 'arm64'].includes(arch)) throw new Error(`Private .NET SDK installation is unsupported on ${platform}/${arch}`)
  return `${os}-${arch}`
}

function sdkDirectory(): string {
  return path.join(process.env.GROMA_CSHARP_CACHE ?? path.join(homedir(), '.groma', 'cache', 'csharp'), sdkVersion, sdkRid())
}

function executable(directory: string): string {
  return path.join(directory, process.platform === 'win32' ? 'dotnet.exe' : 'dotnet')
}

async function exists(file: string): Promise<boolean> {
  try { await access(file); return true }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error }
}

export async function resolveDotnet(): Promise<string> {
  if (process.env.DOTNET_HOST_PATH) return process.env.DOTNET_HOST_PATH
  const installed = executable(sdkDirectory())
  return await exists(installed) ? installed : 'dotnet'
}

interface SdkFile { rid: string; name: string; url: string; hash: string }
interface ReleaseMetadata { releases?: { sdk?: { version: string; files: SdkFile[] } }[] }

/** The metadata and archive are both from Microsoft's HTTPS release service; this is integrity checking, not independent signing. */
export function sdkArchive(metadata: unknown, rid: string): SdkFile {
  const releases = (metadata as ReleaseMetadata)?.releases
  if (!Array.isArray(releases)) throw new Error('Invalid .NET release metadata')
  const sdk = releases.find(release => release.sdk?.version === sdkVersion)?.sdk
  const file = sdk?.files.find(file => file.rid === rid && /\.(?:tar\.gz|zip)$/.test(file.name))
  if (!file || !/^[0-9a-f]{128}$/i.test(file.hash)) throw new Error(`No verified SDK ${sdkVersion} archive for ${rid}`)
  const url = new URL(file.url)
  if (url.protocol !== 'https:' || url.hostname !== 'builds.dotnet.microsoft.com') throw new Error('Unexpected .NET archive origin')
  return file
}

export function verifyArchiveDigest(actual: string, expected: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error('.NET SDK archive SHA-512 mismatch; nothing was installed')
}

async function downloadArchive(file: SdkFile, destination: string): Promise<void> {
  const response = await fetch(file.url, { signal: AbortSignal.timeout(300_000), redirect: 'error' })
  if (!response.ok || !response.body) throw new Error(`SDK download failed: ${response.status}`)
  const handle = await open(destination, 'wx')
  const hash = createHash('sha512')
  const reader = response.body.getReader()
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 512 * 1024 * 1024) throw new Error('SDK download exceeded 512 MiB')
      hash.update(value)
      await handle.writeFile(value)
    }
  } finally { await reader.cancel(); await handle.close() }
  verifyArchiveDigest(hash.digest('hex'), file.hash)
}

async function extractArchive(archive: string, directory: string): Promise<void> {
  if (process.platform !== 'win32') {
    await run('tar', ['-xzf', archive, '-C', directory], { cwd: directory, timeoutSeconds: 120 })
    return
  }
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(directory)} -Force`], { cwd: directory, timeoutSeconds: 120 })
}

/** Only called by an explicit scanner setup --install-sdk request. No administrator privileges or PATH edits. */
export async function installSdk(): Promise<string> {
  const destination = sdkDirectory()
  const host = executable(destination)
  if (await exists(host)) return host
  const metadata = await fetch(metadataUrl, { signal: AbortSignal.timeout(30_000), redirect: 'error' })
  if (!metadata.ok) throw new Error(`SDK metadata request failed: ${metadata.status}`)
  const file = sdkArchive(await metadata.json(), sdkRid())
  await mkdir(path.dirname(destination), { recursive: true })
  const staging = await mkdtemp(`${destination}-staging-`)
  const archive = path.join(staging, file.name)
  const payload = path.join(staging, 'sdk')
  try {
    await mkdir(payload)
    await downloadArchive(file, archive)
    await extractArchive(archive, payload)
    await run(executable(payload), ['--list-sdks'], { cwd: payload, timeoutSeconds: 30 })
    await rename(payload, destination)
    return host
  } finally { await rm(staging, { recursive: true, force: true }) }
}
