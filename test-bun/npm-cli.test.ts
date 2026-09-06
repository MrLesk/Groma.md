import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'bun:test'

type Exec = (file: string, args: string[], options: { encoding?: string; stdio?: unknown }) => string

interface NpmCli {
  isAppleSilicon: (platform?: string, exec?: Exec) => boolean
  platformPackageName: (platform?: string, arch?: string, appleSilicon?: boolean) => string | undefined
  runWrapper: (options?: {
    platform?: string
    arch?: string
    appleSilicon?: boolean
    spawnBinary?: (...args: unknown[]) => unknown
    writeError?: (message: string) => void
  }) => { spawned: boolean }
  unsupportedArchitectureMessage: (platform?: string, arch?: string) => string
}

const {
  isAppleSilicon,
  platformPackageName,
  runWrapper,
  unsupportedArchitectureMessage,
} = createRequire(import.meta.url)('../scripts/npm/cli.cjs') as NpmCli

test.concurrent('native Apple Silicon Node resolves the Darwin arm64 package', () => {
  assert.equal(platformPackageName('darwin', 'arm64', false), 'groma.md-darwin-arm64')
  assert.equal(platformPackageName('darwin', 'arm64', true), 'groma.md-darwin-arm64')
})

test.concurrent('Rosetta Node on Apple Silicon still resolves the Darwin arm64 package', () => {
  assert.equal(platformPackageName('darwin', 'x64', true), 'groma.md-darwin-arm64')
})

test.concurrent('Intel Macs have no Darwin package and an unsupported-architecture error', () => {
  assert.equal(platformPackageName('darwin', 'x64', false), undefined)
  assert.match(unsupportedArchitectureMessage('darwin', 'x64'), /Intel Macs/)
  let spawned = false
  const errors: string[] = []
  const result = runWrapper({
    platform: 'darwin',
    arch: 'x64',
    appleSilicon: false,
    spawnBinary: () => {
      spawned = true
    },
    writeError: message => {
      errors.push(message)
    },
  })
  assert.equal(result.spawned, false)
  assert.equal(spawned, false)
  assert.match(errors.join('\n'), /Intel Macs/)
})

test.concurrent('Linux and Windows keep per-arch packages', () => {
  assert.equal(platformPackageName('linux', 'x64', false), 'groma.md-linux-x64')
  assert.equal(platformPackageName('linux', 'arm64', false), 'groma.md-linux-arm64')
  assert.equal(platformPackageName('win32', 'x64', false), 'groma.md-windows-x64')
  assert.equal(platformPackageName('win32', 'arm64', false), 'groma.md-windows-arm64')
})

test.concurrent('unknown platforms have no package', () => {
  assert.equal(platformPackageName('freebsd', 'x64', false), undefined)
  assert.match(unsupportedArchitectureMessage('linux', 'ppc64'), /linux\/ppc64/)
})

test.concurrent('Apple Silicon detection uses hw.optional.arm64 and ignores stderr', () => {
  const calls: Array<{ file: string; args: string[]; options: { encoding?: string; stdio?: unknown } }> = []
  const exec: Exec = (file, args, options) => {
    calls.push({ file, args, options })
    return '1\n'
  }
  assert.equal(isAppleSilicon('darwin', exec), true)
  assert.equal(isAppleSilicon('darwin', () => '0\n'), false)
  assert.equal(calls[0]?.file, '/usr/sbin/sysctl')
  assert.deepEqual(calls[0]?.args, ['-n', 'hw.optional.arm64'])
  assert.deepEqual(calls[0]?.options.stdio, ['ignore', 'pipe', 'ignore'])
})

test.concurrent('Apple Silicon detection is false off macOS and when sysctl fails', () => {
  const exec: Exec = () => {
    throw new Error('Operation not permitted')
  }
  assert.equal(isAppleSilicon('linux', exec), false)
  assert.equal(isAppleSilicon('darwin', exec), false)
})
