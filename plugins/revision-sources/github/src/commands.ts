import { execFile } from 'node:child_process'

export type Run = (program: string, args: string[], signal?: AbortSignal) => Promise<string>

/** Authentication remains in gh; no credential is returned to the host or browser. */
export function commandRunner(root: string): Run {
  return (program, args, signal) => new Promise((resolve, reject) => {
    execFile(program, args, {
      cwd: root, signal, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout, stderr) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && program === 'gh') reject(new Error('Install GitHub CLI, then run gh auth login.'))
        else reject(new Error(stderr.trim() || error.message))
      } else resolve(stdout)
    })
  })
}
