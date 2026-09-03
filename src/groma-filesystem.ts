import { existsSync, watch } from 'node:fs'
import type { Dirent, FSWatcher, WatchOptions } from 'node:fs'
import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

export const gromaDirectories = ['groma', '.groma'] as const

/** The one sentence every command prints when the repository has no Groma directory. */
export const NOT_INITIALIZED = 'Groma is not initialized here. Run groma init.'

export type GromaDirectory = typeof gromaDirectories[number]

function isGromaDirectory(value: string): value is GromaDirectory {
  return gromaDirectories.includes(value as GromaDirectory)
}

function selectedDirectory(repositoryRoot: string): GromaDirectory | undefined {
  const found = gromaDirectories.filter(directory => {
    return existsSync(path.join(repositoryRoot, directory))
  })
  if (found.length > 1) {
    throw new Error('Both groma/ and .groma/ exist; keep one Groma directory')
  }
  return found[0]
}

export class GromaFileSystem {
  readonly repositoryRoot: string
  readonly directory: GromaDirectory

  private constructor(repositoryRoot: string, directory: GromaDirectory) {
    this.repositoryRoot = path.resolve(repositoryRoot)
    this.directory = directory
  }

  static find(repositoryRoot: string): GromaFileSystem | undefined {
    const root = path.resolve(repositoryRoot)
    const directory = selectedDirectory(root)
    if (directory === undefined) return undefined
    return new GromaFileSystem(root, directory)
  }

  static open(repositoryRoot: string): GromaFileSystem {
    const filesystem = GromaFileSystem.find(repositoryRoot)
    if (filesystem === undefined) {
      throw new Error(NOT_INITIALIZED)
    }
    return filesystem
  }

  static initialize(
    repositoryRoot: string,
    requestedDirectory?: string,
  ): GromaFileSystem {
    const root = path.resolve(repositoryRoot)
    const existing = selectedDirectory(root)
    if (existing !== undefined) {
      if (requestedDirectory !== undefined && requestedDirectory !== existing) {
        throw new Error(`Groma already uses ${existing}/`)
      }
      return new GromaFileSystem(root, existing)
    }
    if (requestedDirectory === undefined || !isGromaDirectory(requestedDirectory)) {
      throw new Error('Groma directory must be groma or .groma')
    }
    return new GromaFileSystem(root, requestedDirectory)
  }

  sourceFilename(relative = ''): string {
    return relative === ''
      ? this.directory
      : path.posix.join(this.directory, relative)
  }

  relative(sourceFilename: string): string {
    if (sourceFilename === this.directory) return ''
    const prefix = `${this.directory}/`
    if (!sourceFilename.startsWith(prefix)) {
      throw new Error(`${sourceFilename} is outside ${this.directory}/`)
    }
    return sourceFilename.slice(prefix.length)
  }

  absolute(relative = ''): string {
    return path.join(this.repositoryRoot, this.directory, ...relative.split('/'))
  }

  exists(relative = ''): boolean {
    return existsSync(this.absolute(relative))
  }

  list(relative: string): Promise<Dirent[]> {
    return readdir(this.absolute(relative), { withFileTypes: true })
  }

  read(relative: string): Promise<string> {
    return readFile(this.absolute(relative), 'utf8')
  }

  readSource(sourceFilename: string): Promise<string> {
    return this.read(this.relative(sourceFilename))
  }

  async write(relative: string, source: string): Promise<void> {
    const filename = this.absolute(relative)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }

  writeSource(sourceFilename: string, source: string): Promise<void> {
    return this.write(this.relative(sourceFilename), source)
  }

  removeSource(sourceFilename: string): Promise<void> {
    return unlink(this.absolute(this.relative(sourceFilename)))
  }

  modifiedAt(relative: string): Promise<number> {
    return stat(this.absolute(relative)).then(info => info.mtimeMs)
  }

  watch(
    relative: string,
    options: WatchOptions,
    listener: (filename: string | null) => void,
  ): FSWatcher {
    return watch(this.absolute(relative), options, (_event, filename) => {
      listener(filename === null ? null : String(filename))
    })
  }
}
