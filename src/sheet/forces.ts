/**
 * The forces that shape the sheet, gathered so they can be tuned by eye. Each
 * one buys legibility and pays in room or in detours, and the note on each
 * says which way. The geometry they act on, such as the lanes in a cell or
 * the half cell of ground a floor hides, is not a matter of taste and lives
 * in grid.ts.
 *
 * Every number here was measured on this repository's own world, 44
 * buildings and 55 routes.
 */

/* How buildings stand, in cells ------------------------------------------ */

/**
 * Cells between siblings: the main airiness knob. 2 to 4 takes arrows hugging
 * something from 3% to 2%, and costs a third more sheet and a quarter more
 * arrow.
 */
export const GAP = 2
/** Cells of screen width between islands. More separates the people, the systems and the externals; the sheet widens by as much. */
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

/* How arrows run: clearances and costs in lanes, four to a cell ---------- */

/** Lanes of clearance an arrow keeps from a foreign footprint. A clearance, not a cost: raising it can leave a crowded world with no route at all. */
export const RING = 1
/** What one turn costs against one lane of length: more gives straighter arrows and longer ways round. */
export const BEND = 6
/** What a lane another arrow already uses costs: high enough that two arrows share a lane only when there is no other way. */
export const REUSE = 24
/** What it costs to leave or arrive through a side that does not face the other end. Less lets arrows hook around a building to reach a nearer port. */
export const SIDE_PENALTY = 24
/** What one port step off the middle of a side costs, so arrows meet sides in the middle rather than at their corners. */
export const OFF_CENTRE = 8
/** Preferred distance from a building an arrow passes or a surface border, and the cost of each lane inside it. RING remains the hard building clearance. */
export const CLEARANCE_REACH = 4
export const CLEARANCE_PUSH = 3
/**
 * The same, measured from the arrows already drawn, so they push each other
 * apart instead of squeezing into neighbouring lanes. Again the reach is the
 * spacing: at 2 lanes 38% of arrow lanes had another arrow within half a
 * cell, at a full cell 9%, for 7% more arrow and a quarter more bends.
 */
export const ROUTE_REACH = 4
export const ROUTE_PUSH = 3
