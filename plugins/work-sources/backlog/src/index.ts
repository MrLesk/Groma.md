import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, watch } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comark'

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
    // Only the fixed config queries below reach the command interpreter.
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

const textList = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string')
  : typeof value === 'string' && value !== '' ? [value] : []

function section(source: string, name: string): string {
  const match = source.match(new RegExp(`<!-- SECTION:${name}:BEGIN -->\\s*([\\s\\S]*?)\\s*<!-- SECTION:${name}:END -->`))
  return match?.[1]?.trim() ?? ''
}

function checklist(source: string, marker: 'AC' | 'DOD') {
  const match = source.match(new RegExp(`<!-- ${marker}:BEGIN -->\\s*([\\s\\S]*?)\\s*<!-- ${marker}:END -->`))
  return (match?.[1] ?? '').split(/\r?\n/).flatMap(line => {
    const item = line.match(/^- \[([ xX])] (?:#\d+ )?(.*)$/)
    return item ? [{ text: item[2]!, checked: item[1]!.toLowerCase() === 'x' }] : []
  })
}

function comments(source: string) {
  const body = source.match(/<!-- COMMENTS:BEGIN -->\s*([\s\S]*?)\s*<!-- COMMENTS:END -->/)?.[1] ?? ''
  const pattern = /(?:^|\r?\n)(?:author: (.*)\r?\n)?created: (.*)\r?\n---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/g
  return [...body.matchAll(pattern)].map(match => ({
    author: match[1] ?? '', createdAt: match[2]!, body: match[3]!.trim(),
  }))
}

async function taskFiles(repositoryRoot: string): Promise<string[]> {
  const directory = taskDirectory(repositoryRoot)
  const names = await readdir(directory)
  return names.filter(name => name.endsWith('.md')).map(name => path.join(directory, name))
}

async function readTask(filename: string) {
  const source = await readFile(filename, 'utf8')
  const document = await parse(source)
  return { source, frontmatter: document.frontmatter }
}

export function createBacklogSource(
  repositoryRoot: string,
  run: BacklogCommand,
): WorkSource {
  return {
    async read() {
      const files = await taskFiles(repositoryRoot)
      const [statusesText, defaultStatusText] = await Promise.all([
        run(['config', 'get', 'statuses'], repositoryRoot),
        run(['config', 'get', 'defaultStatus'], repositoryRoot),
      ])
      const items = await Promise.all(files.map(async filename => {
        const { source, frontmatter } = await readTask(filename)
        const criteria = checklist(source, 'AC')
        return {
          id: String(frontmatter.id ?? ''),
          title: String(frontmatter.title ?? ''),
          status: String(frontmatter.status ?? ''),
          assignees: textList(frontmatter.assignee),
          references: textList(frontmatter.references),
          modifiedFiles: textList(frontmatter.modified_files),
          acceptanceCriteriaCompleted: criteria.filter(item => item.checked).length,
          acceptanceCriteriaCount: criteria.length,
          updatedAt: String(frontmatter.updated_date ?? ''),
        }
      }))
      const statuses = statusesText.split(',').map(status => status.trim()).filter(Boolean)
      return { statuses, defaultStatus: defaultStatusText.trim(), items }
    },
    async readItem(id) {
      const filename = (await taskFiles(repositoryRoot)).find(candidate =>
        path.basename(candidate).toLowerCase().startsWith(`${id.toLowerCase()} - `))
      if (!filename) throw new Error(`Backlog task not found: ${id}`)
      const task = await readTask(filename)
      return {
        id,
        description: section(task.source, 'DESCRIPTION'),
        acceptanceCriteria: checklist(task.source, 'AC'),
        definitionOfDone: checklist(task.source, 'DOD'),
        implementationPlan: section(task.source, 'PLAN'),
        implementationNotes: section(task.source, 'NOTES'),
        comments: comments(task.source),
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
