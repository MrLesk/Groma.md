import { execFile } from 'node:child_process'
import path from 'node:path'

export function javaCommand(): string {
  const executable = process.platform === 'win32' ? 'java.exe' : 'java'
  return process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', executable) : executable
}

export function run(command: string, args: string[], root: string, input = '', timeout = 120000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, {
      cwd: root, encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || stdout.trim() || error.message))
      else resolve(stdout)
    })
    child.stdin?.on('error', () => { /* execFile reports early process termination. */ })
    child.stdin?.end(input)
  })
}
