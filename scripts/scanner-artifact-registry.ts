import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/** Serve only npm-packed release candidates to the compiled consumer's normal installer. */
export async function scannerArtifactRegistry(packages: string[], output: string) {
  await mkdir(output, { recursive: true })
  const artifacts = await Promise.all(packages.map(async directory => {
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    const packed = await execute(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
      'pack', path.resolve(directory), '--ignore-scripts', '--json', '--pack-destination', path.resolve(output),
    ], { maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32' })
    const filename = JSON.parse(packed.stdout)[0].filename as string
    const bytes = await readFile(path.join(output, filename))
    return {
      manifest, filename, bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    }
  }))
  const downloads = new Set<string>()
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const url = new URL(request.url)
    const resource = decodeURIComponent(url.pathname.slice(1))
    const tarball = artifacts.find(item => item.filename === resource)
    if (tarball) {
      downloads.add(tarball.manifest.name)
      return new Response(tarball.bytes)
    }
    const artifact = artifacts.find(item => item.manifest.name === resource)
    if (!artifact) return new Response('Unknown release candidate', { status: 404 })
    const { manifest, filename, integrity } = artifact
    return Response.json({ name: manifest.name, 'dist-tags': { latest: manifest.version }, versions: {
      [manifest.version]: { ...manifest, dist: { tarball: `${url.origin}/${filename}`, integrity } },
    } })
  } })
  return {
    url: `http://127.0.0.1:${server.port}`,
    artifacts: artifacts.map(({ manifest, filename, sha256 }) => ({
      id: manifest.groma.scanner.id as string, name: manifest.name as string,
      version: manifest.version as string, filename, sha256,
    })),
    downloads,
    close: () => server.stop(true),
  }
}
