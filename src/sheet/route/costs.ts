import { ROUTE_UNIT } from './space.ts'

/*
 * The costs that shape routes, gathered so they can be tuned by eye, in plane units of route length. The path search
 * prices every path by them, and the finishing passes take a shortcut only when it is cheaper at the same bend price.
 */

/** A bend costs three cells of length. More gives routes with fewer bends that take longer ways round. */
export const BEND = ROUTE_UNIT * 3
/**
 * Crossing another route costs five bends: more than going round a small building, a few cells and a bend longer, by a
 * side wall of each end. More gives fewer crossings and longer detours.
 */
export const CROSSING = BEND * 5
/** Leaving or entering by a wall other than the preferred one; another wall wins only where it saves crossings or length. */
export const OTHER_WALL = BEND / 4
/**
 * Each route a channel holds beyond its comfortable spacing costs this much per unit of the stretch it crowds, and the
 * next one twice as much: a full channel sends routes around other buildings. More spreads routes over more channels.
 */
export const CROWDING = 2
/** A path that fits nowhere else may overfill a channel, at a cost above any detour. A sentinel rather than a dial. */
export const OVERFLOW = BEND * 40
