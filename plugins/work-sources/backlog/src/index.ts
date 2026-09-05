import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, watch } from 'node:fs'
import path from 'node:path'

import {
  EMPTY_WORK_SOURCE,
  type WorkItem,
  type WorkItemDetails,
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
  const names = process.platform === 'win32'
    ? ['backlog.exe', 'backlog.cmd', 'backlog']
    : ['backlog']
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const name of names) {
      const command = path.join(directory, name)
      try {
        accessSync(command, constants.X_OK)
        return command
      } catch {
        // Keep looking through PATH.
      }
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
    const shim = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')
    const args = shim
      ? ['/d', '/s', '/c', `""${command}" ${arguments_.join(' ')}"`]
      : arguments_
    const child = spawn(shim ? 'cmd.exe' : command, args, {
      cwd: repositoryRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: shim,
      windowsHide: true,
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

const taskDirectory = (repositoryRoot: string): string => path.join(repositoryRoot, 'backlog', 'tasks')

type BacklogTaskSummary = Omit<WorkItem, 'updatedAt'> & { updatedAt: string | null }

type BacklogTaskDetails = Omit<WorkItemDetails,
  'description' | 'implementationPlan' | 'implementationNotes' | 'comments'
> & {
  description: string | null
  implementationPlan: string | null
  implementationNotes: string | null
  comments: { body: string; createdAt: string | null; author: string | null }[]
}

export function createBacklogSource(
  repositoryRoot: string,
  run: BacklogCommand,
): WorkSource {
  return {
    async read() {
      const [tasksText, statusesText, defaultStatusText] = await Promise.all([
        run(['task', 'list', '--json'], repositoryRoot),
        run(['config', 'get', 'statuses'], repositoryRoot),
        run(['config', 'get', 'defaultStatus'], repositoryRoot),
      ])
      const { tasks } = JSON.parse(tasksText) as { tasks: BacklogTaskSummary[] }
      const items = tasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        assignees: task.assignees,
        references: task.references,
        modifiedFiles: task.modifiedFiles,
        acceptanceCriteriaCompleted: task.acceptanceCriteriaCompleted,
        acceptanceCriteriaCount: task.acceptanceCriteriaCount,
        updatedAt: task.updatedAt ?? '',
      }))
      const statuses = statusesText.split(',').map(status => status.trim()).filter(Boolean)
      return { statuses, defaultStatus: defaultStatusText.trim(), items }
    },
    async readItem(id) {
      const output = await run(['task', 'view', id, '--json'], repositoryRoot)
      const { task } = JSON.parse(output) as { task: BacklogTaskDetails }
      return {
        id: task.id,
        description: task.description ?? '',
        acceptanceCriteria: task.acceptanceCriteria.map(({ text, checked }) => ({ text, checked })),
        definitionOfDone: task.definitionOfDone.map(({ text, checked }) => ({ text, checked })),
        implementationPlan: task.implementationPlan ?? '',
        implementationNotes: task.implementationNotes ?? '',
        comments: task.comments.map(comment => ({
          body: comment.body,
          createdAt: comment.createdAt ?? '',
          author: comment.author ?? '',
        })),
      }
    },
    watch(onChange) {
      const tasks = taskDirectory(repositoryRoot)
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
