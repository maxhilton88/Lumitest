/**
 * rpg-types.ts — Shared types for RPG Game Entity Manager
 * Updated for the Aeluris 7-element type system
 */

// ── Element types (Aeluris 7-element system) ──
export const ELEMENTS = [
  { id: 'fire', label: 'Fire', emoji: '🔥', color: '#e05a2b' },
  { id: 'water', label: 'Water', emoji: '💧', color: '#2e7fbf' },
  { id: 'wood', label: 'Wood', emoji: '🌿', color: '#4a9c3f' },
  { id: 'thunder', label: 'Thunder', emoji: '⚡', color: '#c49a1a' },
  { id: 'earth', label: 'Earth', emoji: '🪨', color: '#7a6a52' },
  { id: 'shadow', label: 'Shadow', emoji: '🌑', color: '#6b4fa8' },
  { id: 'gold', label: 'Gold', emoji: '✨', color: '#d4a843' },
] as const;

export type ElementId = typeof ELEMENTS[number]['id'];

// ── Rarity tiers ──
export const RARITIES = [
  { id: 'common', label: 'Common', color: '#6b7280', stars: 1 },
  { id: 'uncommon', label: 'Uncommon', color: '#22c55e', stars: 2 },
  { id: 'rare', label: 'Rare', color: '#3b82f6', stars: 3 },
  { id: 'epic', label: 'Epic', color: '#a855f7', stars: 4 },
  { id: 'legendary', label: 'Legendary', color: '#f59e0b', stars: 5 },
] as const;

export type RarityId = typeof RARITIES[number]['id'];

// ── Move categories ──
export const MOVE_CATEGORIES = [
  { id: 'phys', label: 'Physical', color: '#c07030', bgColor: '#2a1a0a' },
  { id: 'spec', label: 'Special', color: '#3080c0', bgColor: '#0a1a2a' },
  { id: 'stat', label: 'Status', color: '#6060a0', bgColor: '#1a1a2a' },
] as const;

export type MoveCategoryId = typeof MOVE_CATEGORIES[number]['id'];

// ── Regions (14 regions of Aeluris) ──
export const REGIONS = [
  { id: 'thornhaven', label: 'Thornhaven', number: 1, continent: 'The Verdant Reach', levelRange: '1-5', emoji: '🏡' },
  { id: 'emberveil', label: 'Emberveil', number: 2, continent: 'The Verdant Reach', levelRange: '5-15', emoji: '🌴' },
  { id: 'cinderpost', label: 'Cinderpost', number: 3, continent: 'The Verdant Reach', levelRange: '10-20', emoji: '🌋' },
  { id: 'driftmoor', label: 'Driftmoor', number: 4, continent: 'The Verdant Reach', levelRange: '15-25', emoji: '🌾' },
  { id: 'vaulthollow', label: 'Vaulthollow', number: 5, continent: 'The Verdant Reach', levelRange: '20-30', emoji: '🕳️' },
  { id: 'stormreach', label: 'Stormreach', number: 6, continent: 'The Shattered Isles', levelRange: '28-38', emoji: '⛈️' },
  { id: 'ashenveil', label: 'Ashenveil', number: 7, continent: 'The Verdant Reach', levelRange: '25-35', emoji: '👻' },
  { id: 'lumenvast', label: 'Lumenvast', number: 8, continent: 'The Shattered Isles', levelRange: '35-45', emoji: '☁️' },
  { id: 'irondeep', label: 'Irondeep', number: 9, continent: 'The Shattered Isles', levelRange: '32-42', emoji: '⚒️' },
  { id: 'wraithspire', label: 'Wraithspire', number: 10, continent: 'The Southern Expanse', levelRange: '42-52', emoji: '🏛️' },
  { id: 'echovast', label: 'Echovast', number: 11, continent: 'The Southern Expanse', levelRange: '48-58', emoji: '🌳' },
  { id: 'goldenveil', label: 'Goldenveil', number: 12, continent: 'The Southern Expanse', levelRange: '55-70', emoji: '🏙️' },
  { id: 'nullspire', label: 'Nullspire', number: 13, continent: 'The Southern Expanse', levelRange: '70-85', emoji: '🏰' },
  { id: 'voidcore', label: 'Voidcore', number: 14, continent: 'The Void Core', levelRange: '85-100', emoji: '🕳️' },
] as const;

export type RegionId = typeof REGIONS[number]['id'];

// ── Power types ──
export const POWER_TYPES = [
  { id: 'attack', label: 'Attack', emoji: '⚔️' },
  { id: 'defense', label: 'Defense', emoji: '🛡️' },
  { id: 'heal', label: 'Heal', emoji: '💚' },
  { id: 'buff', label: 'Buff', emoji: '⬆️' },
  { id: 'debuff', label: 'Debuff', emoji: '⬇️' },
  { id: 'special', label: 'Special', emoji: '🌟' },
] as const;

export type PowerTypeId = typeof POWER_TYPES[number]['id'];

// ── Subjects for zone mapping ──
export const ZONE_SUBJECTS = [
  { id: 'english', label: 'English', emoji: '📖' },
  { id: 'numbers', label: 'Mathematics', emoji: '🔢' },
  { id: 'bahasa', label: 'Bahasa Melayu', emoji: '📝' },
  { id: 'mandarin', label: 'Mandarin', emoji: '🀄' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'sejarah', label: 'Sejarah', emoji: '📜' },
  { id: 'geography', label: 'Geography', emoji: '🌍' },
] as const;

// ── Entity interfaces ──

export interface ZoneEntity {
  id: string;
  type: 'zone';
  name: string;
  description: string;
  subjects: string[];       // mapped subject IDs
  difficulty: number;       // 1-10 scale
  order: number;            // display order
  unlockLevel: number;      // min player level to enter
  assets: {
    tileset?: string;       // storage path
    mapJson?: string;       // storage path
    preview?: string;       // storage path (thumbnail)
    music?: string;         // storage path
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface SpiritMove {
  name: string;
  element: ElementId;
  power: number;            // 0 = status move
  category: MoveCategoryId; // phys / spec / stat
  powerId?: string;         // links to a Power entity for the sprite
}

export interface SpiritEntity {
  id: string;
  type: 'spirit';
  spiritNumber: number;     // #001-035
  name: string;
  types: ElementId[];       // 1 or 2 elements (dual-type support)
  regionId: RegionId;       // which region this spirit appears in
  zoneDescription: string;  // e.g. "Meadow Path - tall grass"
  rarity: RarityId;
  statMultipliers: {        // multipliers applied to Lumi's base stats
    hp: number;             // e.g. 1.2
    atk: number;            // e.g. 0.9
    def: number;            // e.g. 1.1
  };
  moves: SpiritMove[];      // exactly 4 moves
  isFoxy?: boolean;         // true = this is the starter fox
  foxyStage?: number;       // 1-4 for Foxy evolution stages
  foxyEvolvesAt?: string;   // e.g. "Level 5", "Level 30 + 25 Wins"
  assets: {
    overworld?: string;     // small sprite for map
    battle?: string;        // large sprite for battle
    hurt?: string;          // battle hurt frame
    icon?: string;          // thumbnail/icon
  };
  // Legacy compat — keep old fields for backward compatibility
  element?: ElementId;
  zoneId?: string;
  stats?: { hp: number; atk: number; def: number; spd: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface PowerEntity {
  id: string;
  type: 'power';
  name: string;
  element: ElementId;
  powerType: PowerTypeId;
  baseDamage: number;
  accuracy: number;         // 0-100
  description: string;
  assets: {
    sprite?: string;        // attack animation sprite
    icon?: string;          // small icon
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CharacterEntity {
  id: string;
  type: 'character';
  characterType: 'boy' | 'girl' | 'companion';
  name: string;
  assets: {
    spritesheet?: string;   // 3×4 grid PNG: 3 walk frames × 4 directions
    battle?: string;
    portrait?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

// ── Asset slot definitions per entity type ──

export const ZONE_ASSET_SLOTS = [
  { key: 'tileset', label: 'Tileset PNG', accept: 'image/*', hint: 'Tile sheet image' },
  { key: 'mapJson', label: 'Map JSON', accept: '.json,application/json', hint: 'Tiled editor export' },
  { key: 'preview', label: 'Preview', accept: 'image/*', hint: 'Zone thumbnail' },
  { key: 'music', label: 'Music', accept: 'audio/*', hint: 'Background music' },
] as const;

export const SPIRIT_ASSET_SLOTS = [
  { key: 'overworld', label: 'Overworld', accept: 'image/*', hint: '32x32 map sprite' },
  { key: 'battle', label: 'Battle', accept: 'image/*', hint: '256x256 battle art' },
  { key: 'hurt', label: 'Hurt', accept: 'image/*', hint: 'Hit animation frame' },
  { key: 'icon', label: 'Icon', accept: 'image/*', hint: 'Small thumbnail' },
] as const;

export const POWER_ASSET_SLOTS = [
  { key: 'sprite', label: 'Effect Sprite', accept: 'image/*', hint: 'Attack animation' },
  { key: 'icon', label: 'Icon', accept: 'image/*', hint: 'Small icon' },
] as const;

export const CHARACTER_ASSET_SLOTS = [
  { key: 'spritesheet', label: 'Spritesheet', accept: 'image/png', hint: '3×4 grid PNG: 3 walk frames × 4 directions (Down/Left/Right/Up). Each cell 32×32 or 64×64px.' },
  { key: 'battle', label: 'Battle Sprite', accept: 'image/*', hint: 'Large illustrated battle sprite (256×256+)' },
  { key: 'portrait', label: 'Portrait', accept: 'image/*', hint: 'Dialogue/HUD portrait' },
] as const;

// ── Map entity ──
export interface MapDoor {
  x: number;
  y: number;
  id: string;
  label: string;
  /** Target map to warp to */
  targetMapId?: string;
  /** Target spawn X in destination map */
  targetX?: number;
  /** Target spawn Y in destination map */
  targetY?: number;
}

export interface MapEntity {
  id: string;
  type: 'map';
  name: string;
  /** Region/state this map belongs to (e.g. 'thornhaven') */
  regionId?: RegionId;
  width: number;
  height: number;
  tiles: number[][];
  spawnX: number;
  spawnY: number;
  doors: MapDoor[];
  encounterSpiritIds: string[];
  encounterRate: number;
  /** Storage paths for per-tile-type artwork (optional) */
  tileArt?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

/** Unique continents derived from REGIONS */
export const CONTINENTS = [...new Set(REGIONS.map(r => r.continent))] as string[];

// ── Tile type metadata for the map editor ──
export const TILE_TYPES = [
  { id: 0,  key: 'grass',      label: 'Grass',      color: '#1a2e1a', walkable: true },
  { id: 1,  key: 'path',       label: 'Path',       color: '#3a2f20', walkable: true },
  { id: 2,  key: 'tree',       label: 'Tree',       color: '#0f1f0f', walkable: false },
  { id: 3,  key: 'water',      label: 'Water',      color: '#0a1928', walkable: false },
  { id: 4,  key: 'wall',       label: 'Wall',       color: '#2a2520', walkable: false },
  { id: 5,  key: 'door',       label: 'Door',       color: '#8B6914', walkable: true },
  { id: 6,  key: 'tall_grass', label: 'Tall Grass',  color: '#1a3a1a', walkable: true },
  { id: 7,  key: 'npc',        label: 'NPC',        color: '#d4a44a', walkable: true },
  { id: 8,  key: 'bridge',     label: 'Bridge',     color: '#5a4530', walkable: true },
  { id: 9,  key: 'flower',     label: 'Flower',     color: '#d84a8a', walkable: true },
  { id: 10, key: 'fence',      label: 'Fence',      color: '#5a4a30', walkable: false },
  { id: 11, key: 'sign',       label: 'Sign',       color: '#b89050', walkable: true },
] as const;