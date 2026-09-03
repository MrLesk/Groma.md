import type { ProjectProfile } from '../../project-profile.ts'
import type { SheetScene } from '../../sheet/types.ts'
import type { AnnotatedArchitectureModel, WorkSnapshot } from '../../types.ts'
import type { GromaRevision } from '../../history/revisions.ts'

/** Architecture meaning plus the shared web/TUI sheet geometry. */
export interface TerminalViewModel extends AnnotatedArchitectureModel {
  sheet: SheetScene
  /** groma/project.md, shown read-only under p. */
  project?: ProjectProfile
  work?: WorkSnapshot
  /** Current-branch commits that changed the Groma tree, newest first. */
  revisions?: readonly GromaRevision[]
  /** The read-only commit currently shown; absent for the live working tree. */
  revision?: GromaRevision
}
