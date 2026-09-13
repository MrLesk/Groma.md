import { expect, test } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const adapter = path.resolve(import.meta.dir, '../plugins/work-sources/backlog/src/index.ts')

async function fixture(root: string, unsupported: string) {
  const command = path.join(root, 'backlog.js')
  await writeFile(command, `#!${process.execPath}
    const args = process.argv.slice(2);
    if (${JSON.stringify(unsupported)} && args.includes(${JSON.stringify(unsupported)})) {
      console.error("error: unknown option '${unsupported}'"); process.exit(1);
    }
    if (args[0] === 'config') { console.log('To Do'); process.exit(0) }
    const snapshot = id => ({ tasks: [{ id, title: id, status: 'To Do', assignees: [], references: [], modifiedFiles: [], acceptanceCriteriaCount: 0, acceptanceCriteriaCompleted: 0, updatedAt: null }] });
    console.log(JSON.stringify(snapshot('first')));
    if (args.includes('--watch')) {
      setTimeout(() => console.log(JSON.stringify(snapshot('second'))), 20);
      setInterval(() => {}, 1000);
    }
  `)
  await chmod(command, 0o755)
  return command
}

async function probe(unsupported: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-backlog-cli-'))
  try {
    const command = await fixture(root, unsupported)
    const probeFile = path.join(root, 'probe.ts')
    await writeFile(probeFile, `
      import { createBacklogPlugin } from ${JSON.stringify(adapter)};
      const source = createBacklogPlugin(() => ${JSON.stringify(command)}).create(${JSON.stringify(root)});
      let readError;
      try { await source.read() } catch (error) { readError = error.message }
      const finished = Promise.withResolvers();
      const timer = setTimeout(() => finished.reject(new Error('No watch result')), 3000);
      const errors = [];
      console.error = error => { errors.push(String(error)); finished.resolve() };
      let updates = 0;
      const watcher = source.watch(() => { if (++updates === 2) finished.resolve() });
      try {
        await finished.promise;
        const work = errors.length ? undefined : await source.read();
        console.log(JSON.stringify({ readError, errors, updates, work }));
      } finally { clearTimeout(timer); await watcher.close() }
    `)
    const child = Bun.spawn([process.execPath, probeFile], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, stderr).toBe(0)
    return JSON.parse(stdout)
  } finally { await rm(root, { recursive: true, force: true }) }
}

for (const option of ['--json', '--watch']) {
  test.skipIf(process.platform === 'win32').concurrent(`Backlog rejecting ${option} produces upgrade guidance`, async () => {
    const result = await probe(option)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('npm install -g backlog.md')
    expect(result.updates).toBe(0)
    if (option === '--json') expect(result.readError).toContain('npm install -g backlog.md')
    else expect(result.readError).toBeUndefined()
  })
}

test.skipIf(process.platform === 'win32').concurrent('supported Backlog watch snapshots replace task state', async () => {
  const result = await probe('')
  expect(result.errors).toEqual([])
  expect(result.readError).toBeUndefined()
  expect(result.updates).toBe(2)
  expect(result.work.items.map((item: { id: string }) => item.id)).toEqual(['second'])
})
