import { execFile } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const pluginRoot = fileURLToPath(new URL('./', import.meta.url))
const workerRoot = path.join(pluginRoot, 'worker')

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

if (import.meta.main) {
  const output = path.join(pluginRoot, 'dist/worker.jar')
  await rm(path.dirname(output), { recursive: true, force: true })
  await buildWorker(output)
  console.log(output)
}
