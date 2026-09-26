import { execFile } from 'node:child_process'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { SBT_VERSION, SCALAMETA_VERSION } from './versions.ts'

const execute = promisify(execFile)
const pluginRoot = fileURLToPath(new URL('./', import.meta.url))
const workerRoot = path.join(pluginRoot, 'worker')
const sbtRoot = path.join(pluginRoot, 'sbt')

function sbtCommand(): string {
  return process.env.SBT_HOME ? path.join(process.env.SBT_HOME, 'bin', 'sbt') : 'sbt'
}

function tool(name: string): string {
  const executable = process.platform === 'win32' ? `${name}.exe` : name
  return process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', executable) : executable
}

/** Maintainer build: compile the scalameta worker with sbt assembly. */
export async function buildWorker(destination: string): Promise<void> {
  await execute(sbtCommand(), ['-batch', 'assembly'], { cwd: workerRoot })
  const built = path.join(workerRoot, 'target/scala-3.9.0/worker.jar')
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(built, destination)
}

/** Maintainer build: package the sbt 2 `gromaModel` plugin. */
export async function buildGromaSbt(destination: string): Promise<void> {
  await execute(sbtCommand(), ['-batch', 'publishLocal'], { cwd: sbtRoot })
  const built = path.join(sbtRoot, 'target/out/jvm/scala-3.8.4/groma-sbt/groma-sbt_sbt2_3-0.1.0.jar')
  const ivyLocal = path.join(path.dirname(destination), 'ivy-local')
  const published = path.join(homedir(), '.ivy2/local/md.groma')
  await mkdir(path.dirname(destination), { recursive: true })
  await rm(ivyLocal, { recursive: true, force: true })
  await cp(published, path.join(ivyLocal, 'md.groma'), { recursive: true })
  await cp(built, destination)
}

/** Download the official sbt launcher for the pinned sbt 2 release. */
export async function fetchSbtLaunch(destination: string): Promise<void> {
  const url = `https://repo1.maven.org/maven2/org/scala-sbt/sbt-launch/${SBT_VERSION}/sbt-launch-${SBT_VERSION}.jar`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download sbt-launch ${SBT_VERSION}: ${response.status}`)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

export async function buildDist(dist = path.join(pluginRoot, 'dist')): Promise<void> {
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  await buildWorker(path.join(dist, 'worker.jar'))
  await buildGromaSbt(path.join(dist, 'groma-sbt.jar'))
  await fetchSbtLaunch(path.join(dist, 'sbt-launch.jar'))
}

async function writeNotices(inputs: string[], output: string): Promise<void> {
  const directories = new Set(inputs.flatMap(input => /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input.replaceAll('\\', '/'))?.[1] ?? []))
  const sections = [
    'The Scala scanner module bundles these npm packages. Their license texts follow.\n',
    `\nScalameta ${SCALAMETA_VERSION}\nLicense: Apache-2.0\n\nUsed by the worker JAR to parse Scala 3.9 source. See https://github.com/scalameta/scalameta\n`,
    `\norg.scala-sbt sbt-launch ${SBT_VERSION}\nLicense: Apache-2.0\n\nVendored launcher used to evaluate sbt build definitions. See https://github.com/sbt/sbt\n`,
  ]
  for (const directory of [...directories].map(item => path.resolve(item)).sort()) {
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    const license = (await readdir(directory)).find(name => /^licen[cs]e/i.test(name))
    if (!license) throw new Error(`Review the missing license text for ${manifest.name}@${manifest.version}`)
    sections.push(`\n${manifest.name} ${manifest.version}\nLicense: ${manifest.license}\n\n${await readFile(path.join(directory, license), 'utf8')}`)
  }
  await writeFile(output, sections.join(''))
}

/** Maintainer build; consumers receive bundled JavaScript, worker, sbt plugin, launcher, and a JRE. */
export async function buildPackage(destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  const distDir = path.join(destination, 'dist')
  await buildWorker(path.join(distDir, 'worker.jar'))
  await buildGromaSbt(path.join(distDir, 'groma-sbt.jar'))
  await fetchSbtLaunch(path.join(distDir, 'sbt-launch.jar'))
  const runtime = path.join(distDir, `${process.platform}-${process.arch}`, 'runtime')
  await mkdir(path.dirname(runtime), { recursive: true })
  // jdeps --print-module-deps on sbt-launch.jar plus the pinned sbt boot jars.
  await execute(tool('jlink'), ['--add-modules',
    'java.base,java.desktop,java.management,java.net.http,java.security.jgss,java.sql,java.xml,jdk.compiler,jdk.net,jdk.unsupported',
    '--strip-debug', '--no-header-files', '--no-man-pages', '--output', runtime])
  const built = await Bun.build({
    entrypoints: [path.join(pluginRoot, 'src/index.ts')],
    outdir: path.join(destination, 'src'),
    target: 'bun',
    format: 'esm',
    naming: 'index.js',
    metafile: true,
  })
  if (!built.success) throw new Error(built.logs.join('\n'))
  await cp(
    path.join(pluginRoot, 'src/sbt-global-plugin.sbt.template'),
    path.join(destination, 'src/sbt-global-plugin.sbt.template'),
  )
  await writeNotices(Object.keys(built.metafile?.inputs ?? {}), path.join(destination, 'THIRD-PARTY-NOTICES.txt'))
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'package.json'), 'utf8'))
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    private: manifest.private,
    type: 'module',
    license: 'MIT',
    os: [process.platform],
    cpu: [process.arch],
    groma: { scanner: { ...manifest.groma.scanner, entry: './src/index.js' } },
  }, null, 2)}\n`)
  await cp(path.join(pluginRoot, '../../../LICENSE'), path.join(destination, 'LICENSE'))
}

if (import.meta.main) {
  const output = path.join(pluginRoot, 'dist/package')
  await rm(output, { recursive: true, force: true })
  await buildPackage(output)
  await cp(path.join(output, 'dist'), path.join(pluginRoot, 'dist'), { recursive: true })
  console.log(output)
}
