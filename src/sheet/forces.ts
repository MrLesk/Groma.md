/**
 * The forces that shape the sheet, gathered so they can be tuned by eye. Each
 * one buys legibility and pays in room or in detours, and the note on each
 * says which way. The geometry they act on, such as the lanes in a cell or
 * the half cell of ground a floor hides, is not a matter of taste and lives
 * in grid.ts.
 *
 * Placement values are tuned against the current Groma map and its focused
 * fixtures; route geometry has its own pixel-space constants.
 */

/* How buildings stand, in cells ------------------------------------------ */

/**
 * Cells between siblings: the main airiness knob. 2 to 4 takes arrows hugging
 * something from 3% to 2%, and costs a third more sheet and a quarter more
 * arrow.
 */
export const GAP = 2
/** Cells between nested contents and a system, slab or group edge. More gives inner buildings room and makes every nested surface larger. */
export const NESTED_CONTENT_PAD = 2
/** Cells of screen width between islands. More separates the actors, the systems and the externals; the sheet widens by as much. */
export const ISLAND_GAP = 3
/**
 * Cells of visible ground a corridor keeps behind a roof. An arrow leaves its
 * port and enters its goal along two lanes each, so one cell is the least it
 * can carry; more pushes the neighbours of tall buildings further north and
 * west and widens their surface.
 */
export const CORRIDOR = 1

/* How buildings are arranged: costs in cells ----------------------------- */

/** Cells a bend costs when a spot is priced for a building, so a straight run of arrows beats a shorter dog-leg. More gives straighter arrows and looser surfaces. */
export const SPOT_BEND = 2
/** What it costs to put a building where an arrow would have to go around a sibling. A sentinel rather than a dial: high enough to lose against any length. */
export const SPOT_DETOUR = 100
/** An entry column deeper than this many times its width folds into a square-ish block. Lower folds sooner, giving squarer surfaces and longer entry arrows. */
export const FOLD_ASPECT = 3
