import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { subscribe } from '@parcel/watcher'

const root = await realpath(await mkdtemp(path.join(tmpdir(), 'groma-native-watch-')))
const filename = path.join(root, 'change.txt')
const event = Promise.withResolvers<void>()
let timer: ReturnType<typeof setTimeout> | undefined
let subscription: Awaited<ReturnType<typeof subscribe>> | undefined
try {
  subscription = await subscribe(root, (error, events) => {
    if (error) event.reject(error)
    if (events.some(change => change.path === filename && change.type === 'create')) {
      event.resolve()
    }
  })
  timer = setTimeout(() => event.reject(new Error('No native create event received')), 5000)
  await writeFile(filename, 'created')
  await event.promise
} finally {
  clearTimeout(timer)
  await subscription?.unsubscribe()
  await rm(root, { recursive: true, force: true })
}
