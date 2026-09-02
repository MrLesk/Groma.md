import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const cli = path.join(projectRoot, 'src', 'cli.ts')

export function run(command: string, args: string[], cwd: string) {
  return new Promise<{
    code: number | null
    stderr: string
  }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      resolve({ code, stderr })
    })
  })
}

/** Runs the Groma CLI inside the repository under test. */
export function groma(root: string, args: string[]) {
  return run('bun', [cli, ...args], root)
}

export async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, source] of Object.entries(files)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

/** Every file under a directory, keyed by repository-relative path, for before-and-after comparisons. */
export async function readTree(root: string, relative = 'groma'): Promise<Record<string, string>> {
  const directory = path.join(root, relative)
  const tree: Record<string, string> = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = `${relative}/${entry.name}`
    if (entry.isDirectory()) Object.assign(tree, await readTree(root, child))
    else tree[child] = await readFile(path.join(root, child), 'utf8')
  }
  return tree
}

export function readRelative(root: string, relative: string): Promise<string> {
  return readFile(path.join(root, ...relative.split('/')), 'utf8')
}

/** Copies a fixture into a fresh repository that disappears when the test ends. */
export async function copyFixture(
  t: TestContext,
  fixtureRoot: string,
  prefix: string,
): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), prefix))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const root = path.join(parent, 'repo')
  await cp(fixtureRoot, root, { recursive: true })
  return root
}
