import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import javaManifest from '../plugins/scanners/java/package.json'
import java from '../plugins/scanners/java/src/index.ts'
import { readJavaInput } from '../plugins/scanners/java/src/java-input.ts'
import { readMavenProject } from '../plugins/scanners/java/src/maven.ts'
import rustManifest from '../plugins/scanners/rust/package.json'
import rust from '../plugins/scanners/rust/src/index.ts'
import { scannerFiles } from '../src/scanner/modules/selection.ts'

/** The files a scanner package's include list names under `root`, before exclusions: a listing's candidates. */
function candidates(root: string, manifest: { groma: { scanner: { include: string[] } } }): Promise<string[]> {
  return scannerFiles(root, { include: manifest.groma.scanner.include })
}

async function repository(fixture: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-declared-listing-'))
  await cp(path.resolve(import.meta.dir, `../test/fixtures/${fixture}`), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet', root], { stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  return root
}

test.concurrent('the Java listing reads each Maven source root the way the scan does', async () => {
  const [root, top] = await Promise.all([repository('java-declared-roots'), repository('java-root-source')])
  try {
    // basedir, property, entity and CDATA roots, the project directory itself and a root inside a build directory
    // are listed, because the listing comes before exclusions; an aggregator has none.
    expect(await java.listSourceFiles(root, {}, await candidates(root, javaManifest))).toEqual([
      'basedir/source/A.java', 'cdata/src/cd/D.java', 'entity/src/a&b/E.java', 'gen/build/generated/java/G.java',
      'property/code/B.java', 'whole/W.java',
    ])
    expect(await java.listSourceFiles(top, {}, await candidates(top, javaManifest))).toEqual(['Root.java'])
  } finally { await Promise.all([root, top].map(directory => rm(directory, { recursive: true, force: true }))) }
})

test.concurrent('the Java scan reads the files its listing names', async () => {
  const root = await repository('java-declared-roots')
  try {
    const scanned: string[] = []
    for (const project of await readdir(root)) {
      if (project === '.git') continue
      const directory = path.join(root, project)
      const input = await readJavaInput(directory, await candidates(directory, javaManifest))
      scanned.push(...(input?.files ?? []).map(file => `${project}/${file}`))
    }
    expect(scanned.sort()).toEqual(await java.listSourceFiles(root, {}, await candidates(root, javaManifest)))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('a Maven POM supplies its language version, encoding and name without Maven', () => {
  const compiler = '<build><plugins><plugin><artifactId>maven-surefire-plugin</artifactId></plugin>'
    + '<plugin><artifactId>maven-compiler-plugin</artifactId><configuration><release>17</release>'
    + '<encoding>ISO-8859-1</encoding></configuration></plugin></plugins></build>'
  expect(readMavenProject('/app', `<project><artifactId>shop</artifactId>${compiler}</project>`))
    .toEqual({ release: '17', encoding: 'ISO-8859-1', name: 'shop', sourceRoots: ['src/main/java'] })
  const properties = '<properties><maven.compiler.source>1.8</maven.compiler.source></properties>'
  expect(readMavenProject('/app', `<project><artifactId>legacy</artifactId>${properties}</project>`))
    .toEqual({ release: '8', encoding: 'UTF-8', name: 'legacy', sourceRoots: ['src/main/java'] })
})

test.concurrent('the Rust listing follows the selected manifest to every target root module', async () => {
  const root = await repository('rust-declared-roots')
  try {
    expect(await rust.listSourceFiles(root, { manifest: 'app/Cargo.toml' }, await candidates(root, rustManifest)))
      .toEqual(['app/core/lib.rs', 'app/core/model.rs', 'app/src/bin/extra.rs', 'app/tools/cli.rs'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('the Rust listing names no file of a manifest Cargo cannot build', async () => {
  const root = await repository('rust-declared-roots')
  try {
    // The listing runs before exclusions, so a vendored manifest that is not TOML, or that has no target, names no
    // file instead of failing the listing that explains why a file has no owner.
    await mkdir(path.join(root, 'vendor/broken/src'), { recursive: true })
    await writeFile(path.join(root, 'vendor/broken/Cargo.toml'), '[package')
    await writeFile(path.join(root, 'vendor/broken/src/lib.rs'), 'pub fn broken() {}\n')
    await mkdir(path.join(root, 'vendor/empty'))
    await writeFile(path.join(root, 'vendor/empty/Cargo.toml'), '[package]\nname = "empty"\n')
    expect(await rust.listSourceFiles(root, {}, await candidates(root, rustManifest))).toEqual([
      'app/core/lib.rs', 'app/core/model.rs', 'app/src/bin/extra.rs', 'app/tools/cli.rs', 'worker/src/lib.rs',
    ])
  } finally { await rm(root, { recursive: true, force: true }) }
})
