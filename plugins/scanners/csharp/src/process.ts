import { spawn, type ChildProcess } from 'node:child_process'

export interface RunOptions {
  cwd: string
  timeoutSeconds?: number
  maxOutputBytes?: number
  env?: NodeJS.ProcessEnv
}

function stopTree(child: ChildProcess): void {
  if (child.pid === undefined) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    killer.on('error', () => child.kill())
    return
  }
  try { process.kill(-child.pid, 'SIGKILL') }
  catch { child.kill('SIGKILL') }
}

/** Captures a complete response or rejects; limits never turn truncated JSON into a successful scan. */
export function run(command: string, args: readonly string[], options: RunOptions): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const script = /\.[cm]?js$/.test(command)
    const child = spawn(script ? process.execPath : command, script ? [command, ...args] : [...args], {
      cwd: options.cwd,
      env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE: '1', ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let size = 0
    let failure: Error | undefined
    const fail = (error: Error) => {
      if (failure) return
      failure = error
      stopTree(child)
    }
    const timer = setTimeout(() => fail(new Error(`C# command exceeded ${options.timeoutSeconds ?? 120} seconds`)), (options.timeoutSeconds ?? 120) * 1000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      size += Buffer.byteLength(chunk)
      if (size > (options.maxOutputBytes ?? 128 * 1024 * 1024)) fail(new Error('C# command exceeded the output limit'))
      else stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      if (Buffer.byteLength(stderr) + Buffer.byteLength(chunk) > 1024 * 1024) fail(new Error('C# command exceeded the diagnostic output limit'))
      else stderr += chunk
    })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', code => {
      clearTimeout(timer)
      if (failure) reject(failure)
      else if (code !== 0) reject(new Error(stderr.trim() || stdout.trim() || `${command} exited ${code}`))
      else resolve({ stdout, stderr })
    })
  })
}
