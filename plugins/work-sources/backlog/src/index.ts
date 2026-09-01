import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, watch } from 'node:fs'
import path from 'node:path'

import {
  EMPTY_WORK_SOURCE,
  type WorkSource,
  type WorkSourcePlugin,
} from '@groma/work-source'

export type BacklogCommand = (
  arguments_: string[],
  repositoryRoot: string,
) => Promise<string>

type BacklogCommandResolver = () => string | null

const installCommand = 'bun i -g backlog.md'

function findBacklogCommand(): string | null {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    const command = path.join(directory, 'backlog')
    try {
      accessSync(command, constants.X_OK)
      return command
    } catch {
      // Keep looking through PATH.
    }
  }
  return null
}

function runBacklog(
  command: string,
  arguments_: string[],
  repositoryRoot: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
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
  tasks: {
    id: string
    title: string
    status: string
    assignees: string[]
    references: string[]
    modifiedFiles: string[]
    acceptanceCriteriaCompleted: number
    acceptanceCriteriaCount: number
    updatedAt: string
  }[]
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
    definitionOfDone: { text: string; checked: boolean }[]
    implementationPlan: string | null
    implementationNotes: string | null
    comments: { body: string; createdAt: string; author: string }[]
  }
}

export function createBacklogSource(
  repositoryRoot: string,
  run: BacklogCommand,
): WorkSource {
  return {
    async read() {
      const [listText, statusesText, defaultStatusText] = await Promise.all([
        run(['task', 'list', '--json'], repositoryRoot),
        run(['config', 'get', 'statuses'], repositoryRoot),
        run(['config', 'get', 'defaultStatus'], repositoryRoot),
      ])
      const list = JSON.parse(listText) as TaskListJson
      const statuses = statusesText.split(',').map(status => status.trim()).filter(Boolean)
      return { statuses, defaultStatus: defaultStatusText.trim(), items: list.tasks }
    },
    async readItem(id) {
      const { task } = JSON.parse(await run(
        ['task', 'view', id, '--json'],
        repositoryRoot,
      )) as TaskViewJson
      return {
        id: task.id,
        description: task.description ?? '',
        acceptanceCriteria: task.acceptanceCriteria.map(({ text, checked }) => ({ text, checked })),
        definitionOfDone: task.definitionOfDone.map(({ text, checked }) => ({ text, checked })),
        implementationPlan: task.implementationPlan ?? '',
        implementationNotes: task.implementationNotes ?? '',
        comments: task.comments.map(({ body, createdAt, author }) => ({ body, createdAt, author })),
      }
    },
    watch(onChange) {
      const tasks = path.join(repositoryRoot, 'backlog', 'tasks')
      if (!existsSync(tasks)) return { close() {} }
      const watcher = watch(tasks, { recursive: false }, onChange)
      return { close: () => watcher.close() }
    },
  }
}

export function createBacklogPlugin(
  resolveCommand: BacklogCommandResolver = findBacklogCommand,
): WorkSourcePlugin {
  return {
    id: 'backlog.md',
    readiness() {
      return resolveCommand() === null
        ? { status: 'missing', install: installCommand }
        : { status: 'found' }
    },
    create(repositoryRoot) {
      const command = resolveCommand()
      return command === null
        ? EMPTY_WORK_SOURCE
        : createBacklogSource(repositoryRoot, (arguments_, root) => {
          return runBacklog(command, arguments_, root)
        })
    },
  }
}

export const backlogPlugin = createBacklogPlugin()
