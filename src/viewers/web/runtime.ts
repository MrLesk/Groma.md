import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { compiledAsset } from '../../compiled-asset.ts'
import { loadAnnotatedArchitecture } from '../../core.ts'
import { loadProjectProfile } from '../../project-profile.ts'
import { measuredSheetScene } from '../../sheet/scene.ts'
import type { WebMapPayload } from './payload.ts'

export type MapLoadPhase = 'loading-architecture' | 'preparing-map'

/** The interactive browser entry included in source runs and the standalone CLI. */
export const browserRenderer = { asset: 'groma-web-render', entry: 'src/viewers/web/render.ts' }

/** Builds the same browser runtime used by live and published delivery. */
export async function bundleRenderer(): Promise<string> {
  const renderer = browserRenderer
  const compiledRenderer = compiledAsset(renderer.asset, 'index.js')
  if (compiledRenderer !== undefined) return readFileSync(compiledRenderer, 'utf8')
  const build = await Bun.build({
    entrypoints: [fileURLToPath(new URL(`../../../${renderer.entry}`, import.meta.url))],
    target: 'browser',
  })
  return build.outputs[0]!.text()
}

/** Loads and composes the current architecture map without optional work data. */
export async function loadMapRoot(
  repositoryRoot: string,
  onProgress?: (phase: MapLoadPhase) => void,
): Promise<Pick<WebMapPayload, 'project' | 'world' | 'sheet' | 'timings'>> {
  onProgress?.('loading-architecture')
  const started = performance.now()
  const [architecture, project] = await Promise.all([
    (async () => {
      const loadStarted = performance.now()
      const world = await loadAnnotatedArchitecture(repositoryRoot)
      return { world, milliseconds: performance.now() - loadStarted }
    })(),
    loadProjectProfile(repositoryRoot),
  ])
  const world = architecture.world
  onProgress?.('preparing-map')
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
