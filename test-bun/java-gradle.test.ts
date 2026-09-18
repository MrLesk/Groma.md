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

const input = (directory: string) => readJavaInput(directory)

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

test.concurrent('declarations under control flow, in a function or for an unreadable source set are reported, not applied', async () => {
  const root = await repository('java-gradle-scopes')
  try {
    const found = await gradleProjects(root)
    // allprojects applies to this project too and is reported for the other projects it configures.
    expect(found.diagnostics.map(diagnostic => diagnostic.line)).toEqual([6, 10, 12, 16, 19])
    expect(await input(root)).toMatchObject({ release: '17', files: ['src/main/java/scopes/Main.java'] })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.concurrent('declarations under control flow, in a function, for every source set or for other projects are reported, not applied', () => {
  const scripts: [string, string][] = [
    ['if (x) {\n}\nelse {\n  sourceCompatibility = 8\n}', 'build.gradle'],
    ['try {\n}\ncatch (Exception e) {\n  sourceCompatibility = 8\n}', 'build.gradle'],
    ["try {\n}\nfinally {\n  sourceSets.main.java.srcDirs = ['a']\n}", 'build.gradle'],
    ['private def f() {\n  sourceCompatibility = 8\n}', 'build.gradle'],
    ['private fun f() {\n  sourceSets["main"].java.setSrcDirs(listOf("a"))\n}', 'build.gradle.kts'],
    ["sourceSets.all { java.srcDir 'gen' }", 'build.gradle'],
    ["sourceSets.configureEach { java.srcDirs = ['gen'] }", 'build.gradle'],
    ["sourceSets { all { java.srcDir 'gen' } }", 'build.gradle'],
    ["sourceSets.each { it.java.srcDir 'gen' }", 'build.gradle'],
    ['configure(subprojects) { sourceCompatibility = 8 }', 'build.gradle'],
    ["project('app') { sourceCompatibility = 8 }", 'build.gradle'],
    ['rootProject { sourceCompatibility = 8 }', 'build.gradle'],
  ]
  for (const [source, file] of scripts) {
    const script = readGradleScript(source, file)
    expect([source, script.sourceRoots, script.release, script.diagnostics.length]).toEqual([source, ['src/main/java'], undefined, 1])
  }
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
