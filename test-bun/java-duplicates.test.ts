import { expect, test } from 'bun:test'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseScanObservation, type ScanObservation } from '@groma/scanner'
import { buildPackage, buildWorker } from '../plugins/scanners/java/build.ts'
import { javaCommand, run } from '../plugins/scanners/java/src/process.ts'
import { addScanner } from '../src/scanner/modules/inventory.ts'

const fixtures = path.resolve(import.meta.dir, '../test/fixtures')
const sources = ['Copy', 'Forms', 'Ready'].map(name => `src/main/java/duplicates/${name}.java`)

function lineOf(source: string, text: string): number {
  return source.slice(0, source.indexOf(text)).split('\n').length
}

async function observation(root: string): Promise<ScanObservation> {
  const worker = path.join(root, 'worker.jar')
  await buildWorker(worker)
  return parseScanObservation(await run(javaCommand(), ['-jar', worker, root, '21', 'UTF-8'], root, `${sources.join('\n')}\n`))
}

test.concurrent('Java reports tokens and ranges for named bodies only, normalizing local names', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-java-duplicates-'))
  try {
    await cp(path.join(fixtures, 'java-duplicates'), root, { recursive: true })
    const operations = (await observation(root)).operations!
    const named = (name: string) => operations.find(operation => operation.name.includes(name))!
    // Lambdas, anonymous class methods, initializer blocks and field initializers are not compared.
    expect(operations.filter(operation => !operation.tokens).map(operation => operation.name).sort()).toEqual([
      '<anonymous duplicates.Forms$1>#run()', '<initialize DEFAULTS>', '<initialize first>', '<instance-initializer>',
      '<lambda>', '<static-initializer>',
    ])
    // A method of a local class keeps its own name, so it is compared.
    expect(named('Trimmer#trim').tokens).toBeDefined()
    const source = await readFile(path.join(root, 'src/main/java/duplicates/Ready.java'), 'utf8')
    expect(named('Ready#canStart')).toMatchObject({
      startLine: lineOf(source, 'public boolean canStart'), endLine: lineOf(source, '    public int progress') - 2,
    })
    // Size is left to core, so an empty named body still reports its range.
    expect(named('Forms#apply').tokens).toEqual([])
    // Renamed parameters and locals produce the same tokens.
    expect(named('Copy#readyToRun').tokens).toEqual(named('Ready#canStart').tokens!)
    // A called name, including a recursive call and a call a local name shadows, keeps bodies apart.
    expect(named('Copy#fact(').tokens).not.toEqual(named('Ready#factorial').tokens!)
    expect(named('Copy#othered').tokens).not.toEqual(named('Ready#helped').tokens!)
    // Array index operands keep bodies apart.
    expect(named('Copy#head').tokens).not.toEqual(named('Ready#tail').tokens!)
  } finally { await rm(root, { recursive: true, force: true }) }
}, 60000)

test.concurrent('groma lint reports identical and near-duplicate Java bodies across renamed local names', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-java-lint-'))
  try {
    const root = path.join(temporary, 'project')
    const artifact = path.join(temporary, 'scanner')
    await buildPackage(artifact)
    await cp(path.join(fixtures, 'empty-project'), root, { recursive: true })
    await cp(path.join(fixtures, 'java-duplicates'), root, { recursive: true })
    const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
    expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
    await addScanner(root, artifact)
    const lint = Bun.spawn([process.execPath, path.resolve(import.meta.dir, '../src/cli.ts'), 'lint'],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, error] = await Promise.all([lint.exited, new Response(lint.stdout).text(), new Response(lint.stderr).text()])
    expect(code, error).toBe(1)
    const findings = out.split(/\n(?=\S)/).map(block => ({
      locations: [...block.matchAll(/\S+\.java:\d+/g)].map(match => match[0]).sort(),
      similar: block.includes('not identical'),
    }))
    const ready = await readFile(path.join(root, 'src/main/java/duplicates/Ready.java'), 'utf8')
    const copy = await readFile(path.join(root, 'src/main/java/duplicates/Copy.java'), 'utf8')
    const location = (file: string, source: string, text: string) => `${file}:${lineOf(source, text)}`
    expect(findings).toContainEqual({
      locations: [
        location('src/main/java/duplicates/Copy.java', copy, 'public boolean readyToRun'),
        location('src/main/java/duplicates/Ready.java', ready, 'public boolean canStart'),
      ].sort(),
      similar: false,
    })
    expect(findings).toContainEqual({
      locations: [
        location('src/main/java/duplicates/Copy.java', copy, 'public int completion'),
        location('src/main/java/duplicates/Ready.java', ready, 'public int progress'),
      ].sort(),
      similar: true,
    })
  } finally { await rm(temporary, { recursive: true, force: true }) }
}, 120000)
