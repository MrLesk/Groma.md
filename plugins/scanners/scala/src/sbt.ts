import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ScannerSettings } from '@groma/scanner'
import { defaultScannerCacheRoot } from '../../../../src/scanner/modules/package.ts'
import { parseGromaModel, type GromaModel } from './model.ts'
import { javaCommand, gromaSbtJar, sbtLaunchJar } from './adapter.ts'
import { run } from './process.ts'

const globalPluginTemplate = fileURLToPath(new URL('./sbt-global-plugin.sbt.template', import.meta.url))
const ivyLocal = fileURLToPath(new URL('../dist/ivy-local', import.meta.url))

function scalaCacheRoot(): string {
  return path.join(defaultScannerCacheRoot(), 'scala')
}

function sbtBootDirectory(): string {
  return path.join(scalaCacheRoot(), 'sbt-boot')
}

function xdgConfigRoot(): string {
  return path.join(scalaCacheRoot(), 'xdg-config')
}

async function ensureGlobalPlugin(): Promise<{ xdgConfigHome: string }> {
  const pluginFile = path.join(xdgConfigRoot(), 'sbt', '2', 'plugins', 'groma.sbt')
  const contents = (await readFile(globalPluginTemplate, 'utf8'))
    .replace('@@IVY_LOCAL@@', JSON.stringify(ivyLocal))
  if (!existsSync(pluginFile) || (await readFile(pluginFile, 'utf8')) !== contents) {
    await mkdir(path.dirname(pluginFile), { recursive: true })
    await writeFile(pluginFile, contents)
  }
  return { xdgConfigHome: xdgConfigRoot() }
}

function parseModelOutput(stdout: string): GromaModel {
  const trimmed = stdout.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('SCALA_SBT_FAILED: gromaModel did not print JSON.')
  }
  return parseGromaModel(trimmed.slice(start, end + 1))
}

/** Run the bundled sbt launcher and return the parsed `gromaModel` document. */
export async function loadGromaModel(
  repositoryRoot: string,
  buildKey: string,
  _buildFiles: readonly string[],
  settings: ScannerSettings = {},
): Promise<GromaModel> {
  const { xdgConfigHome } = await ensureGlobalPlugin()
  const buildRoot = path.join(repositoryRoot, buildKey.split('/').join(path.sep))
  const offline = settings.offline === true
  const args = [
    `-Dsbt.boot.directory=${sbtBootDirectory()}`,
    '-jar', sbtLaunchJar(),
    ...(offline ? ['--offline'] : []),
    'gromaModel',
  ]
  const env = { ...process.env, XDG_CONFIG_HOME: xdgConfigHome }
  try {
    const stdout = await run(javaCommand(), args, buildRoot, '', 600000, env)
    return parseModelOutput(stdout)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const line = message.split('\n').find(entry => /^\[error\]/.test(entry.trim()))
      ?? message.split('\n').find(entry => entry.trim().length > 0)
      ?? message
    throw new Error(`SCALA_SBT_FAILED: ${buildRoot}: ${line}`)
  }
}

export function sbtArtifactPaths(): { launch: string; plugin: string } {
  return { launch: sbtLaunchJar(), plugin: gromaSbtJar() }
}
