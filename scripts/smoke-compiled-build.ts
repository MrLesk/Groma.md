import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const [binary, expectedVersion] = process.argv.slice(2)
if (binary === undefined || expectedVersion === undefined) {
  throw new Error('usage: bun scripts/smoke-compiled-build.ts <binary> <version>')
}

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', reject)
    child.once('close', code => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

const version = await run(['--version'])
assert.equal(version.code, 0, version.stderr)
assert.equal(version.stdout.trim(), expectedVersion)

const help = await run(['--help'])
assert.equal(help.code, 0, help.stderr)
assert.match(help.stdout, /Usage:.*groma/s)
