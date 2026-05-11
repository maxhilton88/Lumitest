/**
 * thornhaven-map.ts — Map data for Thornhaven (Region 1).
 *
 * 24×24 tile grid with:
 * - Central village (buildings: player house, shop, spiritlab)
 * - Meadow paths with tall grass encounter zones
 * - River with bridges
 * - Forest border (trees)
 * - NPC locations
 *
 * Tile legend:
 *   0 = grass       1 = path        2 = tree
 *   3 = water       4 = wall        5 = door
 *   6 = tall grass   7 = NPC         8 = bridge
 *   9 = flower      10 = fence      11 = sign
 */
import { type MapDef, type DoorDef, TILE } from './TileMapEngine';

const _ = TILE.GRASS;       // 0
const P = TILE.PATH;        // 1
const T = TILE.TREE;        // 2
const W = TILE.WATER;       // 3
const B = TILE.WALL;        // 4
const D = TILE.DOOR;        // 5
const G = TILE.TALL_GRASS;  // 6
const N = TILE.NPC;         // 7
const R = TILE.BRIDGE;      // 8
const F = TILE.FLOWER;      // 9
const E = TILE.FENCE;       // 10
const S = TILE.SIGN;        // 11

const tiles: number[][] = [
  // Row 0  — dense tree border top
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  // Row 1
  [T,T,T,_,_,G,G,_,T,T,T,_,_,P,P,_,T,T,G,G,_,_,T,T],
  // Row 2
  [T,T,_,_,G,G,G,_,_,T,_,_,P,P,P,P,_,_,G,G,G,_,T,T],
  // Row 3 — meadow with tall grass
  [T,_,_,G,G,G,G,G,_,_,_,P,P,_,_,P,P,_,_,G,G,_,_,T],
  // Row 4
  [T,_,G,G,G,_,_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,G,_,T],
  // Row 5 — path leading to village
  [T,_,_,_,_,_,_,F,_,P,P,_,_,_,_,_,_,P,P,_,_,_,_,T],
  // Row 6 — river starts
  [T,_,_,_,_,_,_,_,P,P,_,_,_,S,_,_,_,_,P,_,_,_,_,T],
  // Row 7
  [T,T,_,W,W,W,W,W,R,W,W,W,W,W,W,W,_,_,P,_,_,T,T,T],
  // Row 8 — bridge crossing
  [T,_,_,W,W,W,W,W,R,W,W,W,W,W,W,W,_,_,P,_,_,_,_,T],
  // Row 9 — south of river, approach village
  [T,_,_,_,_,_,_,P,P,_,_,_,_,_,_,_,_,P,P,_,_,_,_,T],
  // Row 10
  [T,_,_,F,_,_,P,P,_,_,E,E,E,E,E,_,_,P,_,_,F,_,_,T],
  // Row 11 — Village north edge
  [T,_,_,_,_,P,P,_,_,E,_,_,_,_,_,E,_,_,P,P,_,_,_,T],
  // Row 12 — Player house (left), path
  [T,_,_,_,P,P,_,_,B,B,B,D,B,B,B,B,_,_,_,P,P,_,_,T],
  // Row 13
  [T,_,_,P,P,_,_,_,B,_,_,_,_,_,_,B,_,_,_,_,P,_,_,T],
  // Row 14 — center village path
  [T,_,P,P,_,_,N,_,B,B,B,B,B,B,B,B,_,_,N,_,P,P,_,T],
  // Row 15 — Main village square
  [T,_,P,_,_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_,_,P,_,T],
  // Row 16 — Shop (left building), Spiritlab (right building)
  [T,_,P,_,B,B,D,B,B,_,P,_,_,P,_,B,B,D,B,B,_,P,_,T],
  // Row 17
  [T,_,P,_,B,_,_,_,B,_,P,_,_,P,_,B,_,_,_,B,_,P,_,T],
  // Row 18
  [T,_,P,_,B,B,B,B,B,_,P,_,_,P,_,B,B,B,B,B,_,P,_,T],
  // Row 19 — south path exit
  [T,_,P,P,_,_,_,_,_,P,P,_,S,P,P,_,_,_,_,_,P,P,_,T],
  // Row 20
  [T,_,_,P,P,_,_,_,P,P,_,G,G,_,P,P,_,_,_,P,P,_,_,T],
  // Row 21 — south meadow
  [T,_,_,_,P,P,P,P,P,_,G,G,G,G,_,P,P,P,P,P,_,_,_,T],
  // Row 22
  [T,T,_,_,_,_,_,_,_,G,G,G,G,G,G,_,_,_,_,_,_,_,T,T],
  // Row 23 — dense tree border bottom
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
];

const doors: DoorDef[] = [
  { x: 11, y: 12, id: 'house',     label: 'Home' },
  { x: 6,  y: 16, id: 'shop',      label: 'Shop' },
  { x: 17, y: 16, id: 'spiritlab', label: 'Spiritlab' },
];

export const THORNHAVEN_MAP: MapDef = {
  id: 'thornhaven',
  name: 'Thornhaven',
  width: 24,
  height: 24,
  tiles: tiles as any,
  spawnX: 11,
  spawnY: 15,  // village square center
  doors,
  encounterSpiritIds: ['spirit-001', 'spirit-002', 'spirit-003'],  // Leafpup, Embrit, Dewspark
  encounterRate: 0.15,  // 15% chance per tall-grass step
};
