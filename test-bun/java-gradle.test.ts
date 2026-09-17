import { expect, test } from 'bun:test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import java from '../plugins/scanners/java/src/index.ts'
import { gradleProjects, readGradleScript, withGradleDiagnostics } from '../plugins/scanners/java/src/gradle.ts'
import { readJavaInput } from '../plugins/scanners/java/src/java-input.ts'
import { reconcileScanObservations } from '../src/core.ts'
import { formatScanReport } from '../src/scanner.ts'
import { compileWatchPatterns } from '../src/scanner/watch-patterns.ts'

async function repository(fixture: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-gradle-'))
  await cp(path.resolve(import.meta.dir, '../test/fixtures/empty-project'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../test/fixtures', fixture), root, { recursive: true })
  const git = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await git.exited, await new Response(git.stderr).text()).toBe(0)
  return root
}

// Gradle projects are read without Java; only Maven projects ask the worker for their model.
const input = (directory: string) => readJavaInput(directory, 'unused-java', 'unused-worker')

test.concurrent('Groovy settings include projects whose literal source sets and Java versions are read without Gradle', async () => {
  const root = await repository('java-gradle-groovy')
  try {
    const found = await gradleProjects(root)
    expect(found.directories.map(directory => path.relative(root, directory)).sort()).toEqual(['', 'app', 'libs/core'])
    expect(found.diagnostics.map(diagnostic => diagnostic.file).sort()).toEqual(['app/build.gradle', 'build.gradle'])
    expect(await input(root)).toBeUndefined()
    expect(await input(path.join(root, 'app'))).toMatchObject({
      name: 'app', kind: 'gradle-project', file: 'build.gradle', release: '17', files: ['src/main/java/shop/App.java'],
    })
    expect(await input(path.join(root, 'libs/core'))).toMatchObject({
      name: 'core', release: '8', files: ['src/java/shop/core/Core.java'],
    })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Kotlin builds keep literal and conventional sources while unresolvable declarations are reported', async () => {
  const root = await repository('java-gradle-kotlin')
  try {
    const found = await gradleProjects(root)
    expect(found.directories).toEqual([root])
    expect(found.diagnostics.map(diagnostic => diagnostic.file).sort())
      .toEqual(['build.gradle.kts', 'build.gradle.kts', 'settings.gradle.kts', 'settings.gradle.kts'])
    expect(await input(root)).toMatchObject({
      name: 'tool', kind: 'gradle-project', file: 'build.gradle.kts', release: '21',
      files: ['src/extra/java/tool/Extra.java', 'src/main/java/tool/Main.java'],
    })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('Gradle warnings reach the scan report when no project produced Java evidence', async () => {
  const root = await repository('java-gradle-unresolved')
  try {
    const found = await gradleProjects(root)
    expect(await input(root)).toBeUndefined()
    const summary = await reconcileScanObservations(root, [withGradleDiagnostics(undefined, found.diagnostics)!])
    expect(summary.scannerDiagnostics?.map(({ diagnostic }) => [diagnostic.code, diagnostic.file]))
      .toEqual([['JAVA_GRADLE_UNRESOLVED', 'build.gradle']])
    expect(formatScanReport(root, summary)).toContain('JAVA_GRADLE_UNRESOLVED')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('only literal values become versions, source directories and included projects', () => {
  const versions: [string, string | undefined][] = [
    ['sourceCompatibility = 1.8', '8'],
    ['java { sourceCompatibility = JavaVersion.VERSION_17 }', '17'],
    ['java.toolchain.languageVersion = JavaLanguageVersion.of("25")', '25'],
    ['tasks.withType<JavaCompile> { options.release.set(11) }\nsourceCompatibility = 17', '11'],
    ['sourceCompatibility = libs.versions.java.get()', undefined],
  ]
  for (const [source, release] of versions) expect(readGradleScript(source, 'build.gradle').release).toBe(release)
  const sources: [string, string[], number][] = [
    ["sourceSets.main.java.srcDir tasks.named('generateGrammar')", ['src/main/java'], 1],
    ['sourceSets { main { java.srcDir(layout.buildDirectory.dir("generated/sources")) } }', ['src/main/java'], 1],
    ["sourceSets.main.java.srcDirs = ['src', generated]", ['src'], 1],
    ['sourceSets["main"].java.setSrcDirs(listOf("a", "b"))', ['a', 'b'], 0],
  ]
  for (const [source, roots, warnings] of sources) {
    const script = readGradleScript(source, 'build.gradle.kts')
    expect([script.sourceRoots, script.diagnostics.length]).toEqual([roots, warnings])
  }
  const settings = readGradleScript('include(*file("modules").list())', 'settings.gradle.kts')
  expect([settings.includes, settings.diagnostics.length]).toEqual([[], 1])
})

test.concurrent('editing a Gradle build or settings script triggers a Java scan', () => {
  const watches = compileWatchPatterns(java.watch)
  for (const file of ['settings.gradle', 'settings.gradle.kts', 'app/build.gradle', 'libs/core/build.gradle.kts']) {
    expect(watches(file)).toBeTrue()
  }
})
