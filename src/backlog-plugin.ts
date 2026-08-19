import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import path from 'node:path'

import type { ActiveWorkItem } from './types.ts'

export type BacklogCommand = (
  arguments_: string[],
  repositoryRoot: string,
) => Promise<string>

export interface WorkSource {
  read(): Promise<ActiveWorkItem[]>
  watch(onChange: () => void): { close(): void }
}

function runBacklog(arguments_: string[], repositoryRoot: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('backlog', arguments_, {
      cwd: repositoryRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', chunk => stdout.push(chunk as Buffer))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'))
      else reject(new Error(stderr.trim() || `backlog exited ${code}`))
    })
  })
}

interface TaskListJson {
  tasks: { id: string }[]
}

interface TaskViewJson {
  task: {
    id: string
    title: string
    assignees: string[]
    references: string[]
  }
}

export function createBacklogPlugin(
  repositoryRoot: string,
  run: BacklogCommand = runBacklog,
): WorkSource {
  return {
    async read() {
      const list = JSON.parse(await run(
        ['task', 'list', '--status', 'In Progress', '--json'],
        repositoryRoot,
      )) as TaskListJson
      return Promise.all(list.tasks.map(async summary => {
        const { task } = JSON.parse(await run(
          ['task', 'view', summary.id, '--json'],
          repositoryRoot,
        )) as TaskViewJson
        return {
          id: task.id,
          title: task.title,
          assignees: task.assignees,
          references: task.references,
        }
      }))
    },
    watch(onChange) {
      const watcher = watch(
        path.join(repositoryRoot, 'backlog', 'tasks'),
        { recursive: false },
        onChange,
      )
      return { close: () => watcher.close() }
    },
  }
}
