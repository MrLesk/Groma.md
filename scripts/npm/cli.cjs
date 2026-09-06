#!/usr/bin/env node
'use strict'

const { execFileSync, spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const packages = {
  linux: {
    arm64: 'groma.md-linux-arm64',
    x64: 'groma.md-linux-x64',
  },
  win32: {
    arm64: 'groma.md-windows-arm64',
    x64: 'groma.md-windows-x64',
  },
}

function isAppleSilicon(platform = process.platform, exec = execFileSync) {
  if (platform !== 'darwin') return false
  try {
    return exec('/usr/sbin/sysctl', ['-n', 'hw.optional.arm64'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === '1'
  } catch {
    return false
  }
}

function platformPackageName(
  platform = process.platform,
  arch = process.arch,
  appleSilicon = isAppleSilicon(platform),
) {
  if (platform === 'darwin' && (arch === 'arm64' || appleSilicon)) {
    return 'groma.md-darwin-arm64'
  }
  return packages[platform]?.[arch]
}

function unsupportedArchitectureMessage(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin') {
    return `groma.md does not support Intel Macs (${platform}/${arch}).`
  }
  return `groma.md does not provide a binary for ${platform}/${arch}.`
}

function resolveBinaryPath(packageName, binaryName, resolver = require.resolve) {
  const manifest = resolver(`${packageName}/package.json`)
  const binary = path.join(path.dirname(manifest), binaryName)
  if (!fs.existsSync(binary)) throw new Error(`missing ${binaryName}`)
  return binary
}

function runWrapper({
  platform = process.platform,
  arch = process.arch,
  appleSilicon = isAppleSilicon(platform),
  argv = process.argv.slice(2),
  spawnBinary = spawn,
  writeError = message => console.error(message),
} = {}) {
  const packageName = platformPackageName(platform, arch, appleSilicon)
  if (packageName === undefined) {
    writeError(unsupportedArchitectureMessage(platform, arch))
    return { spawned: false }
  }

  const binaryName = platform === 'win32' ? 'groma.exe' : 'groma'
  let binary
  try {
    binary = resolveBinaryPath(packageName, binaryName)
  } catch {
    writeError(`groma.md could not load its platform package ${packageName}.`)
    writeError('Reinstall groma.md with optional dependencies enabled.')
    return { spawned: false }
  }

  const child = spawnBinary(binary, argv, { stdio: 'inherit' })
  child.once('error', error => {
    writeError(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal === null ? 1 : 1)
  })
  return { spawned: true, child }
}

function main() {
  if (runWrapper().spawned !== true) process.exitCode = 1
}

if (require.main === module) main()

module.exports = {
  isAppleSilicon,
  platformPackageName,
  resolveBinaryPath,
  runWrapper,
  unsupportedArchitectureMessage,
}
