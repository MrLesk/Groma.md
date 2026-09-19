import type { GitRange } from '@groma/revision-source'
import type { WorkSnapshot } from '../../../types.ts'
import { readComparison, readChangeFile } from '../../../comparison/read.ts'
import { comparisonWorld } from '../../../comparison/project.ts'
import type { Comparison } from '../../../comparison/model.ts'
import { taskRange, readTaskDiff } from '../../source/diff.ts'
import { measuredSheetScene } from '../../../sheet/scene.ts'
import type { WebPayload, WebComparison } from '../payload.ts'

export function createComparisonSession(root: string, live: () => WebPayload, work: () => WorkSnapshot) {
  let version = 0
  let serial = 0
  const reviews = new Map<string, { comparison: Comparison; version: number }>()
  function task(id: string) {
    const item = work().items.find(item => item.id === id)
    if (!item) throw new Error('Task not found: ' + id)
    return item
  }
  async function read(range: GitRange, scope?: string): Promise<WebPayload> {
    const generation = version
    const comparison = await readComparison(root, range)
    if (comparison.range.target.kind === 'working-tree' && generation !== version) throw new Error('Working tree changed during comparison. Refresh to review the new state.')
    const id = String(++serial)
    reviews.set(id, { comparison, version })
    if (reviews.size > 16) reviews.delete(reviews.keys().next().value!)
    const world = comparisonWorld(comparison)
    const snapshot = live()
    const target = comparison.range.target
    const scopedTask = scope === undefined ? undefined : task(scope)
    const review: WebComparison = {
      ...comparison, id,
      ...(scopedTask ? { task: scopedTask } : {}),
      scenes: { before: measuredSheetScene(comparison.before).scene, after: measuredSheetScene(comparison.after).scene },
    }
    return {
      ...snapshot, world, project: comparison.projects.after, sheet: measuredSheetScene(world).scene,
      revision: target.kind === 'working-tree' ? null : { id: target.sha, shortId: target.sha.slice(0, 8), subject: '', body: '', date: '', compatible: true },
      comparison: review,
      work: work(), pins: target.kind === 'working-tree' ? snapshot.pins : [],
    }
  }
  return {
    read,
    invalidate() { version++ },
    async taskDiff(id: string, taskId: string) {
      const cached = reviews.get(id)
      if (!cached) throw new Error('Comparison expired. Refresh the comparison.')
      const generation = version
      const result = await readTaskDiff(root, task(taskId), work(), cached.comparison.range)
      if (cached.comparison.range.target.kind === 'working-tree' && (cached.version !== version || generation !== version)) throw new Error('Working tree changed. Refresh the comparison.')
      return result
    },
    async taskReview(id: string) { return read(await taskRange(root, task(id), work()), id) },
    async file(id: string, path: string) {
      const cached = reviews.get(id)
      if (!cached) throw new Error('Comparison expired. Refresh the comparison.')
      const { comparison, version: applied } = cached
      const file = comparison.files.find(file => file.file === path)
      if (!file) throw new Error('File is not part of this comparison')
      const isLive = comparison.range.target.kind === 'working-tree'
      if (isLive && applied !== version) throw new Error('Working tree changed. Refresh the comparison.')
      const result = await readChangeFile(root, comparison.range, file)
      if (isLive && applied !== version) throw new Error('Working tree changed. Refresh the comparison.')
      return result
    },
    close() { reviews.clear() },
  }
}
