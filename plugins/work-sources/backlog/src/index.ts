import { spawn } from 'node:child_process'

import {
  EMPTY_WORK_SOURCE,
  type WorkItem,
  type WorkItemDetails,
  type WorkSource,
  type WorkSourcePlugin,
} from '@groma/work-source'

type BacklogCommandResolver = () => string | null

const installCommand = 'bun i -g backlog.md'

function findBacklogCommand(): string | null {
  return Bun.which('backlog')
}

function startBacklog(
  command: string,
  arguments_: string[],
  repositoryRoot: string,
  detached = false,
) {
  const shim = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')
  const args = shim
    ? ['/d', '/s', '/c', `""${command}" ${arguments_.join(' ')}"`]
    : arguments_
  return spawn(shim ? 'cmd.exe' : command, args, {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsVerbatimArguments: shim,
    windowsHide: true,
    detached,
  })
}

function commandFailure(stderr: string, code: number | null): Error {
  if (/unknown option[^\n]*--(?:json|watch)\b/i.test(stderr)) {
    return new Error('Update Backlog.md to show tasks in Groma: npm install -g backlog.md. The installed CLI does not support the required JSON/watch commands.')
  }
  return new Error(stderr.trim() || `backlog exited ${code}`)
}

function runBacklog(command: string, arguments_: string[], repositoryRoot: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = startBacklog(command, arguments_, repositoryRoot)
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
      else reject(commandFailure(stderr, code))
    })
  })
}

type BacklogTaskSummary = Omit<WorkItem, 'updatedAt'> & { updatedAt: string | null }

/** Backlog emits complete JSON objects, which can span or share stdout chunks. */
function taskListStream(onTasks: (tasks: BacklogTaskSummary[]) => void): (chunk: string) => void {
  let buffer = ''
  let position = 0
  let depth = 0
  let quoted = false
  let escaped = false

  function endsObject(character: string): boolean {
    if (escaped) {
      escaped = false
      return false
    }
    if (quoted && character === '\\') {
      escaped = true
      return false
    }
    if (character === '"') quoted = !quoted
    if (quoted) return false
    if (character === '{') depth++
    return character === '}' && --depth === 0
  }

  return chunk => {
    buffer += chunk
    while (position < buffer.length) {
      if (!endsObject(buffer[position++]!)) continue
      const { tasks } = JSON.parse(buffer.slice(0, position)) as { tasks: BacklogTaskSummary[] }
      buffer = buffer.slice(position)
      position = 0
      onTasks(tasks)
    }
  }
}

function watchBacklog(command: string, repositoryRoot: string, onTasks: (tasks: BacklogTaskSummary[]) => void) {
  // The npm launcher and native watcher share a group owned by this subscription.
  const child = startBacklog(command, ['task', 'list', '--json', '--watch'], repositoryRoot, process.platform !== 'win32')
  let closed = false
  let stderr = ''
  const report = (error: unknown) => {
    if (!closed) console.error(`Backlog watch: ${error instanceof Error ? error.message : String(error)}`)
  }
  const finished = new Promise<void>(resolve => {
    child.on('error', report)
    child.on('close', code => {
      if (code !== 0) report(commandFailure(stderr, code))
      resolve()
    })
  })
  function stopProcess(): void {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return
    if (process.platform === 'win32') {
      // The npm command shim owns the actual Backlog process on Windows.
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      killer.on('error', error => console.error(error.message))
      return
    }
    try { process.kill(-child.pid, 'SIGTERM') }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
  }
  async function close(): Promise<void> {
    if (!closed) { closed = true; stopProcess() }
    await finished
  }
  const receive = taskListStream(tasks => { if (!closed) onTasks(tasks) })
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    if (closed) return
    try { receive(chunk) }
    catch (error) { report(error); void close() }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => { stderr += chunk })
  return { close }
}

type BacklogTaskDetails = Omit<WorkItemDetails,
  'description' | 'implementationPlan' | 'implementationNotes' | 'comments'
> & {
  description: string | null
  implementationPlan: string | null
  implementationNotes: string | null
  comments: { body: string; createdAt: string | null; author: string | null }[]
}

function createBacklogSource(
  repositoryRoot: string,
  command: string,
): WorkSource {
  let watchedTasks: BacklogTaskSummary[] | undefined
  const run = (args: string[]) => runBacklog(command, args, repositoryRoot)
  return {
    async read() {
      const [tasks, statusesText, defaultStatusText] = await Promise.all([
        watchedTasks ?? run(['task', 'list', '--json'])
          .then(text => (JSON.parse(text) as { tasks: BacklogTaskSummary[] }).tasks),
        run(['config', 'get', 'statuses']),
        run(['config', 'get', 'defaultStatus']),
      ])
      const items = (watchedTasks ?? tasks).map(task => ({
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
      const output = await run(['task', 'view', id, '--json'])
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
      const watcher = watchBacklog(command, repositoryRoot, tasks => {
        watchedTasks = tasks
        onChange()
      })
      return {
        async close() {
          await watcher.close()
          watchedTasks = undefined
        },
      }
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
        : createBacklogSource(repositoryRoot, command)
    },
  }
}

export const backlogPlugin = createBacklogPlugin()
