import assert from 'node:assert/strict'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'bun:test'

import { repositoryRoot } from './helpers.ts'

// Process isolation keeps the read and request barriers private to this concurrent test.
const scenario = `
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { GromaFileSystem } from './src/groma-filesystem.ts';
import { writes } from './src/authoring.ts';
import { startWebViewer } from './src/viewers/web/server.ts';

const root = process.env.RACE_ROOT;
const server = await startWebViewer(root, { port: 0 });
const post = (verb, input) => fetch(server.url + '/' + verb, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
});
const entered = Promise.withResolvers();
const release = Promise.withResolvers();
const received = Promise.withResolvers();
let removed;
try {
  assert.equal((await post('add', { thing: 'actor', name: 'Operator', overview: 'Uses the system.' })).status, 200);
  const read = GromaFileSystem.prototype.read;
  let held = false;
  let completed = false;
  GromaFileSystem.prototype.read = async function(file) {
    if (this.repositoryRoot !== root || file !== 'actors/operator.md' || held) return read.call(this, file);
    held = true;
    entered.resolve();
    await release.promise;
    const source = await read.call(this, file);
    completed = true;
    return source;
  };
  const remove = writes.remove;
  let writeStarted = false;
  writes.remove = async (...args) => {
    writeStarted = true;
    assert.equal(completed, true, 'removal must start after the pending actor read completes');
    return remove(...args);
  };
  const json = Request.prototype.json;
  Request.prototype.json = async function() {
    const input = await json.call(this);
    if (new URL(this.url).pathname === '/remove') received.resolve();
    return input;
  };

  // Make a real watcher event, then pause the reload after it has listed the actor.
  const actor = root + '/groma/actors/operator.md';
  await writeFile(actor, await readFile(actor, 'utf8'));
  await entered.promise;
  removed = post('remove', { id: 'operator' });
  await received.promise;
  // Let the request continuation reach the queue while the watcher read stays held.
  await setImmediate();
  assert.equal(writeStarted, false, 'HTTP removal must wait for the watcher reload');
  release.resolve();
  const response = await removed;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: 'operator' });
  const payload = await (await fetch(server.url + '/world.json')).json();
  assert.equal(payload.world.elements.some(element => element.id === 'operator'), false);
} finally {
  release.resolve();
  await removed;
  await server.close();
}
`;

test.concurrent('HTTP removal waits for a watcher reload and publishes before shutdown', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-web-authoring-race-'))
  try {
    await cp(path.join(repositoryRoot, 'test/fixtures/plain-view'), root, { recursive: true })
    const init = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
    assert.equal(await init.exited, 0, await new Response(init.stderr).text())
    const child = Bun.spawn([process.execPath, '-e', scenario], {
      cwd: repositoryRoot,
      env: { ...process.env, RACE_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ])
    assert.equal(code, 0, stdout + stderr)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
