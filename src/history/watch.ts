import watcher from '@parcel/watcher'
import { runGit } from './revisions.ts'
import path from 'node:path'

/** One invalidation signal for source files and Git state, including files outside scanner coverage. */
export async function watchGitState(root: string, changed: () => void) {
  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => { if (!closed) changed() }, 180)
  }
  const gitPath = await runGit(['rev-parse', '--git-dir'], root).catch(() => undefined)
  if (gitPath === undefined) return { async close() {} }
  const gitDirectory = path.resolve(root, gitPath.trim())
  const files = await watcher.subscribe(root, (error, events) => {
    if (!error && events.some(event => !event.path.includes('/.git/'))) schedule()
  }, { ignore: ['.git', 'node_modules'] })
  const git = await watcher.subscribe(gitDirectory, (error, events) => {
    if (!error && events.some(event => !event.path.endsWith('.lock') && !event.path.endsWith('FETCH_HEAD'))) schedule()
  })
  return { async close() { closed = true; clearTimeout(timer); await Promise.all([files.unsubscribe(), git.unsubscribe()]) } }
}
