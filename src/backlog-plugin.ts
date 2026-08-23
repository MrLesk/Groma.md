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

/** Done tasks stay in the active work this long after their last change, so their pins can show the finish. */
const DONE_WINDOW_MS = 24 * 60 * 60 * 1000

interface TaskListJson {
  tasks: { id: string; status: string; updatedAt: string }[]
}

interface TaskViewJson {
  task: {
    id: string
    title: string
    status: string
    assignees: string[]
    references: string[]
    description: string | null
    modifiedFiles: string[]
    acceptanceCriteria: { text: string; checked: boolean }[]
  }
}

export function createBacklogPlugin(
  repositoryRoot: string,
  run: BacklogCommand = runBacklog,
  now: () => number = () => Date.now(),
): WorkSource {
  return {
    async read() {
      const list = JSON.parse(await run(['task', 'list', '--json'], repositoryRoot)) as TaskListJson
      const since = now() - DONE_WINDOW_MS
      const active = list.tasks.filter(task =>
        task.status === 'In Progress' || (task.status === 'Done' && Date.parse(task.updatedAt) >= since))
      return Promise.all(active.map(async summary => {
        const { task } = JSON.parse(await run(
          ['task', 'view', summary.id, '--json'],
          repositoryRoot,
        )) as TaskViewJson
        return {
          id: task.id,
          title: task.title,
          status: task.status,
          assignees: task.assignees,
          description: task.description ?? '',
          references: task.references,
          modifiedFiles: task.modifiedFiles,
          criteria: task.acceptanceCriteria.map(({ text, checked }) => ({ text, checked })),
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
