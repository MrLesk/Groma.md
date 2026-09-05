import {
  createCliRenderer,
} from '@opentui/core'
import type { CliRenderer } from '@opentui/core'
import { EMPTY_WORK_SNAPSHOT } from '@groma/work-source'
import type { WorkSource } from '@groma/work-source'
import { backlogPlugin } from '@groma/work-source-backlog'

import { watchArchitecture } from './architecture-watch.ts'
import { loadAnnotatedArchitecture } from './core.ts'
import { loadProjectProfile } from './project-profile.ts'
import { listGromaRevisions, withGitRevision, type GromaRevision } from './history/revisions.ts'
import { readTaskDiff } from './viewers/source/diff.ts'
import { readSource } from './viewers/source/read.ts'
import { readCodeStructure } from './viewers/source/structure.ts'
import { watchScan } from './scanner.ts'
import { sheetScene } from './sheet/scene.ts'
import { mountTerminalViewer } from './viewers/tui/terminal-viewer.ts'
import type { TerminalViewer } from './viewers/tui/terminal-viewer.ts'
import type { TerminalViewModel } from './viewers/tui/model.ts'

interface StartViewerOptions {
  renderer?: CliRenderer
  workSource?: WorkSource
}

/** The architecture, its sheet geometry and the project profile, as the terminal viewer reads them. */
export async function loadTerminalModel(repositoryRoot: string): Promise<TerminalViewModel> {
  const model = await loadAnnotatedArchitecture(repositoryRoot)
  return { ...model, sheet: sheetScene(model), project: await loadProjectProfile(repositoryRoot) }
}

export async function startTerminalViewer(
  repositoryRoot: string,
  options: StartViewerOptions = {},
): Promise<TerminalViewer> {
  const workSource = options.workSource ?? backlogPlugin.create(repositoryRoot)
  let work = EMPTY_WORK_SNAPSHOT
  let viewer: TerminalViewer
  let map: TerminalViewModel
  let revisions: GromaRevision[] = []
  let wantedRevision: string | null = null
  let closed = false
  let publishChain = Promise.resolve()
  const publish = () => {
    const run = publishChain.then(async () => {
      if (closed || wantedRevision !== null || map.revision !== undefined) return
      const next = { ...await loadTerminalModel(repositoryRoot), revisions }
      if (closed || wantedRevision !== null || map.revision !== undefined) return
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
      if (map.revision === undefined && wantedRevision === null) viewer.update({ ...map, work })
    }).catch(() => {})
    return run
  }
  const readRevision = async (revisionId?: string): Promise<TerminalViewModel | undefined> => {
    const wanted = revisionId ?? null
    wantedRevision = wanted
    const revision = revisionId === undefined
      ? undefined
      : revisions.find(candidate => candidate.id === revisionId && candidate.compatible)
    if (revisionId !== undefined && revision === undefined) return undefined
    const next = revision === undefined
      ? { ...await loadTerminalModel(repositoryRoot), revisions }
      : {
          ...await withGitRevision(repositoryRoot, revision.id, loadTerminalModel),
          revisions,
          revision,
        }
    if (closed || wantedRevision !== wanted) return undefined
    map = next
    return { ...next, work: revision === undefined ? work : EMPTY_WORK_SNAPSHOT }
  }
  const renderer = options.renderer ?? await createCliRenderer({
    clearOnShutdown: true,
    consoleMode: 'disabled',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
    useMouse: true,
  })

  try {
    revisions = await listGromaRevisions(repositoryRoot)
    map = { ...await loadTerminalModel(repositoryRoot), revisions }
    viewer = mountTerminalViewer(renderer, { ...map, work }, {
      onRefresh: publish,
      readTask: id => workSource.readItem(id),
      readStructure: elementId => readCodeStructure(repositoryRoot, map, map.revision?.id ?? null, elementId),
      readSource: (elementId, file) => readSource(repositoryRoot, map, map.revision?.id ?? null, elementId, file),
      readTaskDiff: async taskId => {
        const item = work.items.find(candidate => candidate.id === taskId)
        return item === undefined ? undefined : readTaskDiff(repositoryRoot, item, work)
      },
      readRevision,
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
