/**
 * The forces that shape the sheet, gathered so they can be tuned by eye. Each
 * one buys legibility and pays in room or in detours, and the note on each
 * says which way. The geometry they act on, such as the lanes in a cell or
 * the half cell of ground a floor hides, is not a matter of taste and lives
 * in grid.ts.
 *
 * These values set minimum visual gaps. Connection space is measured by
 * route/space.ts and can require larger envelopes. Routes are shaped by their
 * own costs, in route/costs.ts.
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

/* How buildings are arranged: costs in cells ----------------------------- */

/** Cells a bend costs when a spot is priced for a building, so a straight run of arrows beats a shorter dog-leg. More gives straighter arrows and looser surfaces. */
export const SPOT_BEND = 2
/** What it costs to put a building where an arrow would have to go around a sibling. A sentinel rather than a dial: high enough to lose against any length. */
export const SPOT_DETOUR = 100
/** An entry column deeper than this many times its width folds into a square-ish block. Lower folds sooner, giving squarer surfaces and longer entry arrows. */
export const FOLD_ASPECT = 3

/* How siblings settle: the force balance on a surface ------------------- */

/** Cells of ground two siblings push apart to, partners too, so the routes between them have room. More spreads surfaces and their routes; the sheet grows. */
export const SIBLING_SPREAD = GAP + 2
/** Push per cell two siblings stand closer than SIBLING_SPREAD. More holds the spread against the partners' pull and the surface's gravity. */
export const SIBLING_PUSH = 0.5
/** Pull per relationship and per cell two partners stand farther than the sibling gap. More draws partners closer and gives their routes less room. */
export const PARTNER_PULL = 0.05
/** Pull per relationship and per cell of offset that lines partners up face to face. More lines them up sooner, so more of their routes run straight. */
export const PARTNER_ALIGN = 0.05
/** Pull of every child toward the middle of its siblings, per cell of distance. More gives tighter, rounder surfaces. */
export const SURFACE_GRAVITY = 0.01
/** Cells per round an entry drifts west, where the outside feeds it. Without it entries wander and routes cross and bend more. */
export const ENTRY_DRIFT = 0.1
