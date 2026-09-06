#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const packages = {
  darwin: {
    arm64: 'groma.md-darwin-arm64',
    x64: 'groma.md-darwin-x64',
  },
  linux: {
    arm64: 'groma.md-linux-arm64',
    x64: 'groma.md-linux-x64',
  },
  win32: {
    arm64: 'groma.md-windows-arm64',
    x64: 'groma.md-windows-x64',
  },
}

const platformPackages = packages[process.platform]
const packageName = platformPackages?.[process.arch]
const binaryName = process.platform === 'win32' ? 'groma.exe' : 'groma'

if (packageName === undefined) {
  console.error(`groma.md does not provide a binary for ${process.platform}/${process.arch}.`)
  process.exitCode = 1
} else {
  let binary
  try {
    const manifest = require.resolve(`${packageName}/package.json`)
    binary = path.join(path.dirname(manifest), binaryName)
    if (!fs.existsSync(binary)) throw new Error(`missing ${binaryName}`)
  } catch {
    console.error(`groma.md could not load its platform package ${packageName}.`)
    console.error('Reinstall groma.md with optional dependencies enabled.')
    process.exitCode = 1
  }

  if (binary !== undefined) {
    const child = spawn(binary, process.argv.slice(2), { stdio: 'inherit' })
    child.once('error', error => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
    child.once('exit', (code, signal) => {
      process.exitCode = code ?? (signal === null ? 1 : 1)
    })
  }
}
