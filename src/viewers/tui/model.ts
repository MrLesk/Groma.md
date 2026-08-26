import type { SheetScene } from '../../sheet/types.ts'
import type { AnnotatedArchitectureModel, WorkSnapshot } from '../../types.ts'

/** Architecture meaning plus the shared web/TUI sheet geometry. */
export interface TerminalViewModel extends AnnotatedArchitectureModel {
  sheet: SheetScene
  work?: WorkSnapshot
}
