import {
  createCliRenderer,
  normalizeTerminalPalette,
} from '@opentui/core'
import type { CliRenderer, NormalizedTerminalPalette } from '@opentui/core'

import { watchArchitecture } from './architecture-watch.ts'
import { createBacklogPlugin } from './backlog-plugin.ts'
import type { WorkSource } from './backlog-plugin.ts'
import { loadArchitectureViewModel } from './core.ts'
import { watchScan } from './scanner.ts'
import type { ActiveWorkItem } from './types.ts'
import { mountTerminalViewer } from './viewers/tui/terminal-viewer.ts'
import type { TerminalViewer } from './viewers/tui/terminal-viewer.ts'
import { projectActiveWork } from './work-projection.ts'

interface StartViewerOptions {
  renderer?: CliRenderer
  palette?: NormalizedTerminalPalette
  workSource?: WorkSource
}

export async function startTerminalViewer(
  repositoryRoot: string,
  options: StartViewerOptions = {},
): Promise<TerminalViewer> {
  const workSource = options.workSource ?? createBacklogPlugin(repositoryRoot)
  let work: ActiveWorkItem[] = []
  let viewer: TerminalViewer
  let closed = false
  let publishChain = Promise.resolve()
  const project = async () => projectActiveWork(
    await loadArchitectureViewModel(repositoryRoot),
    work,
  )
  const publish = () => {
    const run = publishChain.then(async () => {
      if (closed) return
      viewer.update(await project())
    }).catch(() => {})
    publishChain = run
    return run
  }
  const pullWork = () => {
    const run = workSource.read().then(items => {
      if (closed) return
      work = items
      return publish()
    }).catch(() => {})
    return run
  }
  const renderer = options.renderer ?? await createCliRenderer({
    clearOnShutdown: true,
    consoleMode: 'disabled',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
    useMouse: false,
  })

  try {
    const palette = options.palette ?? normalizeTerminalPalette(
      await renderer.getPalette({ timeout: 100 }),
    )
    viewer = mountTerminalViewer(renderer, await project(), {
      palette,
      onRefresh: publish,
    })
    void pullWork()
    const sourceWatch = watchScan(repositoryRoot, { onFold: publish })
    const architectureWatch = watchArchitecture(repositoryRoot, { onChange: publish })
    const workWatch = workSource.watch(() => {
      void pullWork()
    })
    const stopWatches = () => {
      sourceWatch.close()
      architectureWatch.close()
      workWatch.close()
    }
    return {
      closed: viewer.closed.finally(stopWatches),
      destroy() {
        closed = true
        stopWatches()
        viewer.destroy()
      },
      refresh: () => viewer.refresh(),
      setView: next => viewer.setView(next),
      update: next => viewer.update(next),
    }
  } catch (error) {
    renderer.destroy()
    throw error
  }
}
