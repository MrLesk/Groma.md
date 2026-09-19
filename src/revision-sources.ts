import { githubRevisionSource } from '@groma/revision-source-github'
import { localRevisionSource } from './history/local-source.ts'

/** Application composition is the only place that knows the optional provider package. */
export function createRevisionSources(root: string) {
  return [localRevisionSource(root), githubRevisionSource(root)]
}
