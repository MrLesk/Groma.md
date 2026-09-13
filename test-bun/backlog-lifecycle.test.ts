import { expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createBacklogPlugin } from '../plugins/work-sources/backlog/src/index.ts'

async function executable(root: string, name: string, source: string) {
  const file = path.join(root, name)
  await writeFile(file, `#!${process.execPath}\n${source}`)
  await chmod(file, 0o755)
  return file
}

async function subscription(wrapped: boolean) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-backlog-close-'))
  const native = await executable(root, 'native.js', `
    import { writeFileSync } from 'node:fs';
    writeFileSync('native.pid', String(process.pid));
    console.log(JSON.stringify({ tasks: [] }));
    setInterval(() => {}, 1000);
  `)
  const command = wrapped ? await executable(root, 'launcher.js', `
    import { spawn } from 'node:child_process';
    import { writeFileSync } from 'node:fs';
    writeFileSync('launcher.pid', String(process.pid));
    const child = spawn(${JSON.stringify(process.execPath)}, [${JSON.stringify(native)}], { stdio: 'inherit' });
    child.on('exit', code => process.exit(code ?? 1));
  `) : native
  const first = Promise.withResolvers<void>()
  const watcher = createBacklogPlugin(() => command).create(root).watch(() => first.resolve())
  const timer = setTimeout(() => first.reject(new Error('Watcher did not emit its initial tasks')), 3000)
  try { await first.promise } finally { clearTimeout(timer) }
  const nativePid = Number(await readFile(path.join(root, 'native.pid'), 'utf8'))
  const launcherPid = wrapped ? Number(await readFile(path.join(root, 'launcher.pid'), 'utf8')) : nativePid
  return { root, watcher, nativePid, launcherPid }
}

function alive(pid: number) {
  try { process.kill(pid, 0); return true }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error }
}

async function close(watcher: { close(): void | Promise<void> }) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([watcher.close(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Backlog shutdown did not finish')), 3000)
    })])
  } finally { clearTimeout(timer) }
}

// Unix executable wrappers reproduce the npm launcher. Windows uses taskkill /T.
for (const wrapped of [false, true]) {
  test.skipIf(process.platform === 'win32').concurrent(`closing a ${wrapped ? 'wrapped' : 'direct'} watcher only stops its own processes`, async () => {
    const first = await subscription(wrapped)
    const second = await subscription(wrapped)
    try {
      await close(first.watcher)
      expect(alive(first.nativePid)).toBe(false)
      expect(alive(first.launcherPid)).toBe(false)
      expect(alive(second.nativePid)).toBe(true)
      await close(second.watcher)
      expect(alive(second.nativePid)).toBe(false)
    } finally {
      for (const item of [first, second]) {
        for (const pid of [item.nativePid, item.launcherPid]) {
          if (alive(pid)) process.kill(pid, 'SIGKILL')
        }
        await item.watcher.close()
        await rm(item.root, { recursive: true, force: true })
      }
    }
  })
}
