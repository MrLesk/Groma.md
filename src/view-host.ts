import {
  createCliRenderer,
  normalizeTerminalPalette,
} from '@opentui/core'
import type { CliRenderer, NormalizedTerminalPalette } from '@opentui/core'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'
import { backlogPlugin } from '@groma/work-source-backlog'

import { watchArchitecture } from './architecture-watch.ts'
import { loadAnnotatedArchitecture } from './core.ts'
import { watchScan } from './scanner.ts'
import { sheetScene } from './sheet/scene.ts'
import { mountTerminalViewer } from './viewers/tui/terminal-viewer.ts'
import type { TerminalViewer } from './viewers/tui/terminal-viewer.ts'
import type { TerminalViewModel } from './viewers/tui/model.ts'

interface StartViewerOptions {
  renderer?: CliRenderer
  palette?: NormalizedTerminalPalette
  workSource?: WorkSource
}

export async function startTerminalViewer(
  repositoryRoot: string,
  options: StartViewerOptions = {},
): Promise<TerminalViewer> {
  const workSource = options.workSource ?? backlogPlugin.create(repositoryRoot)
  let work = EMPTY_WORK_SNAPSHOT
  let viewer: TerminalViewer
  let map: TerminalViewModel
  let closed = false
  let publishChain = Promise.resolve()
  const loadMap = async (): Promise<TerminalViewModel> => {
    const model = await loadAnnotatedArchitecture(repositoryRoot)
    return { ...model, sheet: sheetScene(model) }
  }
  const publish = () => {
    const run = publishChain.then(async () => {
      if (closed) return
      const next = await loadMap()
      if (closed) return
      map = next
      viewer.update({ ...map, work })
    }).catch(() => {})
    publishChain = run
    return run
  }
  const pullWork = () => {
    const run = workSource.read().then(snapshot => {
      if (closed) return
      work = snapshot
      viewer.update({ ...map, work })
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
    map = await loadMap()
    viewer = mountTerminalViewer(renderer, { ...map, work }, {
      palette,
      onRefresh: publish,
    })
    void pullWork()
    const sourceWatch = await watchScan(repositoryRoot, { onFold: publish })
    const architectureWatch = watchArchitecture(repositoryRoot, { onChange: publish })
    const workWatch = workSource.watch(() => {
      void pullWork()
    })
    const stopWatches = async () => {
      closed = true
      workWatch.close()
      await Promise.all([
        sourceWatch.close(),
        architectureWatch.close(),
      ])
    }
    return {
      closed: viewer.closed.finally(stopWatches),
      destroy() {
        closed = true
        void stopWatches()
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
