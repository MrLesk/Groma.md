import { execFile } from 'node:child_process'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { SBT_VERSION } from './versions.ts'

const execute = promisify(execFile)
const pluginRoot = fileURLToPath(new URL('./', import.meta.url))
const workerRoot = path.join(pluginRoot, 'worker')
const sbtRoot = path.join(pluginRoot, 'sbt')

function sbtCommand(): string {
  return process.env.SBT_HOME ? path.join(process.env.SBT_HOME, 'bin', 'sbt') : 'sbt'
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

if (import.meta.main) {
  const output = path.join(pluginRoot, 'dist')
  await buildDist(output)
  console.log(output)
}
