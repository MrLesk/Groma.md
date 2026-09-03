import { fileURLToPath } from 'node:url'

import { loadAnnotatedArchitecture } from '../../core.ts'
import { loadProjectProfile } from '../../project-profile.ts'
import { measuredSheetScene } from '../../sheet/scene.ts'
import type { WebMapPayload } from './payload.ts'

/** Builds the same browser runtime used by live and published delivery. */
export async function bundleRenderer(): Promise<string> {
  const build = await Bun.build({
    entrypoints: [fileURLToPath(new URL('./render.ts', import.meta.url))],
    target: 'browser',
  })
  return build.outputs[0]!.text()
}

/** Loads and composes the current architecture map without optional work data. */
export async function loadMapRoot(
  repositoryRoot: string,
): Promise<Pick<WebMapPayload, 'project' | 'world' | 'sheet' | 'timings'>> {
  const started = performance.now()
  const [architecture, project] = await Promise.all([
    (async () => {
      const loadStarted = performance.now()
      const world = await loadAnnotatedArchitecture(repositoryRoot)
      return { world, milliseconds: performance.now() - loadStarted }
    })(),
    loadProjectProfile(repositoryRoot),
  ])
  const world = {
    elements: architecture.world.elements,
    relationships: architecture.world.relationships,
    drafts: architecture.world.drafts,
  }
  const sheet = measuredSheetScene(world)
  return {
    project: project ?? null,
    world,
    sheet: sheet.scene,
    timings: {
      architectureLoadMilliseconds: architecture.milliseconds,
      placementMilliseconds: sheet.timings.placementMilliseconds,
      routingMilliseconds: sheet.timings.routingMilliseconds,
      totalMilliseconds: performance.now() - started,
    },
  }
}
