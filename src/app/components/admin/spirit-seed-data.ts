/**
 * spirit-seed-data.ts — All 35 Aeluris spirits + 4 Foxy stages
 * from the Spirit Compendium game bible.
 */
import type { SpiritEntity, ElementId, MoveCategoryId, RarityId, RegionId } from './rpg-types';

type SeedSpirit = Omit<SpiritEntity, 'createdAt' | 'updatedAt' | 'type'>;

function m(name: string, element: ElementId, power: number, category: MoveCategoryId) {
  return { name, element, power, category };
}

// ── FOXY (4 evolution stages) ──
export const FOXY_STAGES: SeedSpirit[] = [
  {
    id: 'foxy-stage-1', spiritNumber: 0, name: 'Foxkit', isFoxy: true, foxyStage: 1,
    foxyEvolvesAt: 'Starter — hatches from the o1 device',
    types: ['gold', 'fire'], regionId: 'thornhaven', zoneDescription: 'Starter companion',
    rarity: 'legendary' as RarityId,
    statMultipliers: { hp: 1.0, atk: 1.0, def: 1.0 },
    moves: [m('Ember Strike','fire',40,'phys'), m('Auric Pulse','gold',45,'spec'), m('Ashveil','fire',0,'stat'), m('Pyrestep','fire',50,'phys')],
    assets: {},
  },
  {
    id: 'foxy-stage-2', spiritNumber: 0, name: 'Foxara', isFoxy: true, foxyStage: 2,
    foxyEvolvesAt: 'Lumi reaches Level 5',
    types: ['gold', 'fire'], regionId: 'thornhaven', zoneDescription: 'Evolves from Foxkit',
    rarity: 'legendary' as RarityId,
    statMultipliers: { hp: 1.05, atk: 1.05, def: 1.0 },
    moves: [m('Flameburst','fire',65,'spec'), m('Codex Beam','gold',70,'spec'), m('Inferno Veil','fire',70,'spec'), m('Star Fragment','gold',55,'phys')],
    assets: {},
  },
  {
    id: 'foxy-stage-3', spiritNumber: 0, name: 'Foxen', isFoxy: true, foxyStage: 3,
    foxyEvolvesAt: 'Lumi reaches Level 20',
    types: ['gold', 'fire'], regionId: 'thornhaven', zoneDescription: 'Evolves from Foxara',
    rarity: 'legendary' as RarityId,
    statMultipliers: { hp: 1.1, atk: 1.1, def: 1.0 },
    moves: [m('Nova Surge','fire',90,'spec'), m('Lumira Flare','gold',80,'spec'), m('Golden Age','gold',90,'spec'), m("Foxy's Bond",'gold',75,'phys')],
    assets: {},
  },
  {
    id: 'foxy-stage-4', spiritNumber: 0, name: 'Forveil', isFoxy: true, foxyStage: 4,
    foxyEvolvesAt: 'Lumi reaches Level 30 + 25 Battle Wins',
    types: ['gold', 'fire'], regionId: 'thornhaven', zoneDescription: 'Warrior form — Malachar\'s agents flee',
    rarity: 'legendary' as RarityId,
    statMultipliers: { hp: 1.15, atk: 1.2, def: 1.05 },
    moves: [m('Final Ember','fire',120,'spec'), m('Codex Restored','gold',150,'spec'), m('Knowledge Surge','gold',0,'stat'), m('Ancient Light','gold',0,'stat')],
    assets: {},
  },
];

// ── ALL 35 WILD SPIRITS ──
export const WILD_SPIRITS: SeedSpirit[] = [
  // ─── THORNHAVEN (R1) ───
  {
    id: 'spirit-001', spiritNumber: 1, name: 'Leafpup',
    types: ['wood'], regionId: 'thornhaven', zoneDescription: 'Meadow Path — tall grass',
    rarity: 'common', statMultipliers: { hp: 1.2, atk: 0.9, def: 1.1 },
    moves: [m('Leaf Slash','wood',40,'phys'), m('Vine Whip','wood',35,'phys'), m('Forest Breath','wood',0,'stat'), m('Root Grasp','wood',50,'phys')],
    assets: {},
  },
  {
    id: 'spirit-002', spiritNumber: 2, name: 'Embrit',
    types: ['fire'], regionId: 'thornhaven', zoneDescription: 'Near the blacksmith forge',
    rarity: 'uncommon', statMultipliers: { hp: 1.0, atk: 1.15, def: 0.85 },
    moves: [m('Ember Strike','fire',40,'phys'), m('Ashveil','fire',0,'stat'), m('Cinderlash','fire',55,'phys'), m('Pyrestep','fire',50,'phys')],
    assets: {},
  },
  {
    id: 'spirit-003', spiritNumber: 3, name: 'Dewspark',
    types: ['water'], regionId: 'thornhaven', zoneDescription: 'Stream near the eastern trail',
    rarity: 'common', statMultipliers: { hp: 1.1, atk: 0.95, def: 1.0 },
    moves: [m('Aqua Tap','water',40,'phys'), m('Dewshield','water',0,'stat'), m('Surge Pulse','water',60,'spec'), m('Mistform','water',0,'stat')],
    assets: {},
  },
  // ─── EMBERVEIL (R2) ───
  {
    id: 'spirit-004', spiritNumber: 4, name: 'Mosscrawl',
    types: ['earth'], regionId: 'emberveil', zoneDescription: 'Jungle floor — all paths',
    rarity: 'common', statMultipliers: { hp: 1.1, atk: 0.9, def: 1.25 },
    moves: [m('Rock Slam','earth',50,'phys'), m('Stone Guard','earth',0,'stat'), m('Quicksand','earth',40,'stat'), m('Tremor','earth',60,'spec')],
    assets: {},
  },
  {
    id: 'spirit-005', spiritNumber: 5, name: 'Sivox',
    types: ['wood', 'thunder'], regionId: 'emberveil', zoneDescription: 'Near the waterfall — rare spawn',
    rarity: 'uncommon', statMultipliers: { hp: 1.05, atk: 1.0, def: 1.0 },
    moves: [m('Leaf Slash','wood',40,'phys'), m('Static Snap','thunder',40,'phys'), m('Petal Storm','wood',65,'spec'), m('Charge Up','thunder',0,'stat')],
    assets: {},
  },
  {
    id: 'spirit-006', spiritNumber: 6, name: 'Blazefang',
    types: ['fire'], regionId: 'emberveil', zoneDescription: 'Deep jungle interior only',
    rarity: 'rare', statMultipliers: { hp: 1.0, atk: 1.15, def: 0.85 },
    moves: [m('Flameburst','fire',65,'spec'), m('Scorchtail','fire',45,'phys'), m('Ashveil','fire',0,'stat'), m('Magma Core','fire',80,'spec')],
    assets: {},
  },
  {
    id: 'spirit-007', spiritNumber: 7, name: 'Tanglevine',
    types: ['wood'], regionId: 'emberveil', zoneDescription: 'Ruin interior — vine-covered walls',
    rarity: 'common', statMultipliers: { hp: 1.2, atk: 0.9, def: 1.1 },
    moves: [m('Thornwall','wood',0,'stat'), m('Root Grasp','wood',50,'phys'), m('Bark Armour','wood',0,'stat'), m('Ancient Growth','wood',80,'spec')],
    assets: {},
  },
  // ─── CINDERPOST (R3) ───
  {
    id: 'spirit-008', spiritNumber: 8, name: 'Magmort',
    types: ['fire', 'earth'], regionId: 'cinderpost', zoneDescription: 'Lava fields outside the city',
    rarity: 'uncommon', statMultipliers: { hp: 1.05, atk: 1.025, def: 1.05 },
    moves: [m('Rock Slam','earth',50,'phys'), m('Ember Strike','fire',40,'phys'), m('Boulder Drop','earth',80,'phys'), m('Eruption','fire',100,'spec')],
    assets: {},
  },
  {
    id: 'spirit-009', spiritNumber: 9, name: 'Ashscale',
    types: ['fire'], regionId: 'cinderpost', zoneDescription: 'Volcanic summit — high altitude only',
    rarity: 'rare', statMultipliers: { hp: 1.0, atk: 1.15, def: 0.85 },
    moves: [m('Cinderlash','fire',55,'phys'), m('Magma Core','fire',80,'spec'), m('Inferno Veil','fire',70,'spec'), m('Final Ember','fire',120,'spec')],
    assets: {},
  },
  {
    id: 'spirit-010', spiritNumber: 10, name: 'Slagbit',
    types: ['earth'], regionId: 'cinderpost', zoneDescription: 'Fire caves — underground tunnels',
    rarity: 'common', statMultipliers: { hp: 1.1, atk: 0.9, def: 1.25 },
    moves: [m('Stone Guard','earth',0,'stat'), m('Ironstone','earth',70,'phys'), m('Rockslide','earth',75,'phys'), m('Titan Crush','earth',120,'spec')],
    assets: {},
  },
  // ─── DRIFTMOOR (R4) ───
  {
    id: 'spirit-011', spiritNumber: 11, name: 'Gustpup',
    types: ['thunder'], regionId: 'driftmoor', zoneDescription: 'Open plains — everywhere',
    rarity: 'common', statMultipliers: { hp: 0.9, atk: 1.1, def: 0.9 },
    moves: [m('Static Snap','thunder',40,'phys'), m('Voltdash','thunder',60,'phys'), m('Spark Frenzy','thunder',30,'phys'), m('Charge Up','thunder',0,'stat')],
    assets: {},
  },
  {
    id: 'spirit-012', spiritNumber: 12, name: 'Thundermane',
    types: ['thunder', 'earth'], regionId: 'driftmoor', zoneDescription: 'Underground cavern beneath the plains',
    rarity: 'uncommon', statMultipliers: { hp: 1.0, atk: 1.0, def: 1.075 },
    moves: [m('Thunderclap','thunder',75,'spec'), m('Rock Slam','earth',50,'phys'), m('Storm Surge','thunder',85,'spec'), m('Quicksand','earth',40,'stat')],
    assets: {},
  },
  {
    id: 'spirit-013', spiritNumber: 13, name: 'Cloudwhisper',
    types: ['wood', 'thunder'], regionId: 'driftmoor', zoneDescription: 'Underground cavern — rare, night spawn',
    rarity: 'rare', statMultipliers: { hp: 1.05, atk: 1.0, def: 1.0 },
    moves: [m('Petal Storm','wood',65,'spec'), m('Thunderclap','thunder',75,'spec'), m('Charge Up','thunder',0,'stat'), m('Ancient Growth','wood',80,'spec')],
    assets: {},
  },
  {
    id: 'spirit-014', spiritNumber: 14, name: 'Windshard',
    types: ['thunder'], regionId: 'driftmoor', zoneDescription: 'Windstone ruins — daytime only',
    rarity: 'common', statMultipliers: { hp: 0.9, atk: 1.1, def: 0.9 },
    moves: [m('Voltdash','thunder',60,'phys'), m('Storm Surge','thunder',85,'spec'), m('Megavolt','thunder',95,'spec'), m('Lightning Rod','thunder',0,'stat')],
    assets: {},
  },
  // ─── VAULTHOLLOW (R5) ───
  {
    id: 'spirit-015', spiritNumber: 15, name: 'Shadowstone',
    types: ['shadow', 'earth'], regionId: 'vaulthollow', zoneDescription: 'Upper caves',
    rarity: 'uncommon', statMultipliers: { hp: 1.05, atk: 0.95, def: 1.125 },
    moves: [m('Void Touch','shadow',40,'phys'), m('Stone Guard','earth',0,'stat'), m('Darkpulse','shadow',65,'spec'), m('Boulder Drop','earth',80,'phys')],
    assets: {},
  },
  {
    id: 'spirit-016', spiritNumber: 16, name: 'Crystalwing',
    types: ['thunder', 'gold'], regionId: 'vaulthollow', zoneDescription: 'Crystal cavern — glowing tiles',
    rarity: 'rare', statMultipliers: { hp: 0.9, atk: 1.15, def: 0.85 },
    moves: [m('Static Snap','thunder',40,'phys'), m('Auric Pulse','gold',45,'spec'), m('Megavolt','thunder',95,'spec'), m('Ancient Light','gold',0,'stat')],
    assets: {},
  },
  {
    id: 'spirit-017', spiritNumber: 17, name: 'Gloomfang',
    types: ['shadow'], regionId: 'vaulthollow', zoneDescription: 'Underground river banks',
    rarity: 'uncommon', statMultipliers: { hp: 1.0, atk: 1.0, def: 1.0 },
    moves: [m('Shadow Step','shadow',55,'phys'), m('Nightmare','shadow',0,'stat'), m('Null Drain','shadow',60,'spec'), m('Voidstrike','shadow',80,'spec')],
    assets: {},
  },
  // ─── STORMREACH (R6) ───
  {
    id: 'spirit-018', spiritNumber: 18, name: 'Coralyx',
    types: ['water'], regionId: 'stormreach', zoneDescription: 'Beach shore and reef shallows',
    rarity: 'common', statMultipliers: { hp: 1.1, atk: 0.95, def: 1.0 },
    moves: [m('Aqua Tap','water',40,'phys'), m('Tidecrash','water',70,'spec'), m('Dewshield','water',0,'stat'), m('Whirlpool','water',50,'spec')],
    assets: {},
  },
  {
    id: 'spirit-019', spiritNumber: 19, name: 'Stormfin',
    types: ['water', 'thunder'], regionId: 'stormreach', zoneDescription: 'Storm sea — offshore tiles',
    rarity: 'uncommon', statMultipliers: { hp: 1.0, atk: 1.025, def: 0.95 },
    moves: [m('Tidecrash','water',70,'spec'), m('Thunderclap','thunder',75,'spec'), m('Riptide','water',55,'phys'), m('Storm Surge','thunder',85,'spec')],
    assets: {},
  },
  {
    id: 'spirit-020', spiritNumber: 20, name: 'Boltserpent',
    types: ['thunder'], regionId: 'stormreach', zoneDescription: 'Shipwreck interior — dark zones',
    rarity: 'rare', statMultipliers: { hp: 0.9, atk: 1.1, def: 0.9 },
    moves: [m('Voltdash','thunder',60,'phys'), m('Spark Frenzy','thunder',30,'phys'), m('Thundergod Strike','thunder',130,'spec'), m('Lightning Rod','thunder',0,'stat')],
    assets: {},
  },
  // ─── ASHENVEIL (R7) ───
  {
    id: 'spirit-021', spiritNumber: 21, name: 'Ashwraith',
    types: ['shadow'], regionId: 'ashenveil', zoneDescription: 'Ghost ruins — corrupted zones',
    rarity: 'uncommon', statMultipliers: { hp: 1.0, atk: 1.0, def: 1.0 },
    moves: [m('Phantom Cloak','shadow',0,'stat'), m('Darkpulse','shadow',65,'spec'), m('Eclipse','shadow',90,'spec'), m('Abyssal Cry','shadow',0,'stat')],
    assets: {},
  },
  {
    id: 'spirit-022', spiritNumber: 22, name: 'Grimclaw',
    types: ['shadow', 'earth'], regionId: 'ashenveil', zoneDescription: 'Ruin foundations — underground',
    rarity: 'uncommon', statMultipliers: { hp: 1.05, atk: 0.95, def: 1.125 },
    moves: [m('Void Touch','shadow',40,'phys'), m('Rock Slam','earth',50,'phys'), m('Nightmare','shadow',0,'stat'), m('Titan Crush','earth',120,'spec')],
    assets: {},
  },
  {
    id: 'spirit-023', spiritNumber: 23, name: 'Hazewisp',
    types: ['shadow', 'wood'], regionId: 'ashenveil', zoneDescription: 'Ruins — night only, rare encounter',
    rarity: 'epic', statMultipliers: { hp: 1.1, atk: 0.95, def: 1.05 },
    moves: [m('Thornwall','wood',0,'stat'), m('Null Drain','shadow',60,'spec'), m('Eclipse','shadow',90,'spec'), m('Forest Breath','wood',0,'stat')],
    assets: {},
  },
  // ─── LUMENVAST (R8) ───
  {
    id: 'spirit-024', spiritNumber: 24, name: 'Galewisp',
    types: ['thunder', 'gold'], regionId: 'lumenvast', zoneDescription: 'Cloud fields — sky kingdom paths',
    rarity: 'uncommon', statMultipliers: { hp: 0.9, atk: 1.15, def: 0.85 },
    moves: [m('Voltdash','thunder',60,'phys'), m('Auric Pulse','gold',45,'spec'), m('Storm Surge','thunder',85,'spec'), m('Auraveil','gold',0,'stat')],
    assets: {},
  },
  {
    id: 'spirit-025', spiritNumber: 25, name: 'Starfleck',
    types: ['gold'], regionId: 'lumenvast', zoneDescription: 'Wind temple interior — golden tiles',
    rarity: 'rare', statMultipliers: { hp: 0.9, atk: 1.2, def: 0.8 },
    moves: [m('Codex Beam','gold',70,'spec'), m('Star Fragment','gold',55,'phys'), m('Lumira Flare','gold',80,'spec'), m('Knowledge Surge','gold',0,'stat')],
    assets: {},
  },
  {
    id: 'spirit-026', spiritNumber: 26, name: 'Mistvane',
    types: ['water', 'thunder'], regionId: 'lumenvast', zoneDescription: 'Cloud border — sky edge tiles',
    rarity: 'common', statMultipliers: { hp: 1.0, atk: 1.025, def: 0.95 },
    moves: [m('Aqua Tap','water',40,'phys'), m('Static Snap','thunder',40,'phys'), m('Mistform','water',0,'stat'), m('Deep Current','water',85,'spec')],
    assets: {},
  },
  // ─── IRONDEEP (R9) ───
  {
    id: 'spirit-027', spiritNumber: 27, name: 'Gearbit',
    types: ['earth', 'thunder'], regionId: 'irondeep', zoneDescription: 'Underground forge tunnels',
    rarity: 'common', statMultipliers: { hp: 1.0, atk: 1.0, def: 1.075 },
    moves: [m('Rock Slam','earth',50,'phys'), m('Spark Frenzy','thunder',30,'phys'), m('Ironstone','earth',70,'phys'), m('Tremor','earth',60,'spec')],
    assets: {},
  },
  {
    id: 'spirit-028', spiritNumber: 28, name: 'Forgeclaw',
    types: ['fire', 'earth'], regionId: 'irondeep', zoneDescription: 'Master forge chamber',
    rarity: 'uncommon', statMultipliers: { hp: 1.05, atk: 1.025, def: 1.05 },
    moves: [m('Magma Core','fire',80,'spec'), m('Boulder Drop','earth',80,'phys'), m('Inferno Veil','fire',70,'spec'), m('Eruption','fire',100,'spec')],
    assets: {},
  },
  {
    id: 'spirit-029', spiritNumber: 29, name: 'Vaultbreaker',
    types: ['earth', 'shadow'], regionId: 'irondeep', zoneDescription: 'Deepest forge vault — rare encounter',
    rarity: 'epic', statMultipliers: { hp: 1.05, atk: 0.95, def: 1.125 },
    moves: [m('Titan Crush','earth',120,'spec'), m('Voidstrike','shadow',80,'spec'), m('Stone Guard','earth',0,'stat'), m('Nightmare','shadow',0,'stat')],
    assets: {},
  },
  // ─── WRAITHSPIRE (R10) ───
  {
    id: 'spirit-030', spiritNumber: 30, name: 'Stonewing',
    types: ['earth', 'gold'], regionId: 'wraithspire', zoneDescription: 'Temple exterior — stone plateaus',
    rarity: 'rare', statMultipliers: { hp: 1.0, atk: 1.05, def: 1.025 },
    moves: [m('Rock Slam','earth',50,'phys'), m('Auric Pulse','gold',45,'spec'), m('Foundation Wall','earth',0,'stat'), m('Golden Age','gold',90,'spec')],
    assets: {},
  },
  {
    id: 'spirit-031', spiritNumber: 31, name: 'Wispseal',
    types: ['gold', 'shadow'], regionId: 'wraithspire', zoneDescription: 'Temple inner sanctum — ultra rare',
    rarity: 'epic', statMultipliers: { hp: 0.95, atk: 1.1, def: 0.9 },
    moves: [m('Ancient Light','gold',0,'stat'), m('Eclipse','shadow',90,'spec'), m('Lumira Flare','gold',80,'spec'), m('Phantom Cloak','shadow',0,'stat')],
    assets: {},
  },
  // ─── ECHOVAST (R11) ───
  {
    id: 'spirit-032', spiritNumber: 32, name: 'Rootwarden',
    types: ['wood'], regionId: 'echovast', zoneDescription: 'Old growth forest — ancient tree bases',
    rarity: 'uncommon', statMultipliers: { hp: 1.2, atk: 0.9, def: 1.1 },
    moves: [m('Bark Armour','wood',0,'stat'), m('Thornwall','wood',0,'stat'), m('Vine Whip','wood',35,'phys'), m('World Tree','wood',100,'spec')],
    assets: {},
  },
  {
    id: 'spirit-033', spiritNumber: 33, name: 'Heartwood',
    types: ['wood', 'gold'], regionId: 'echovast', zoneDescription: 'Heart of the forest — centre tile only',
    rarity: 'rare', statMultipliers: { hp: 1.05, atk: 1.05, def: 0.95 },
    moves: [m('Ancient Growth','wood',80,'spec'), m('Codex Beam','gold',70,'spec'), m('Forest Breath','wood',0,'stat'), m('Knowledge Surge','gold',0,'stat')],
    assets: {},
  },
  // ─── GOLDENVEIL (R12) ───
  {
    id: 'spirit-034', spiritNumber: 34, name: 'Goldwing',
    types: ['gold'], regionId: 'goldenveil', zoneDescription: 'Outer wastelands approaching the city',
    rarity: 'rare', statMultipliers: { hp: 0.9, atk: 1.2, def: 0.8 },
    moves: [m('Lumira Flare','gold',80,'spec'), m('Star Fragment','gold',55,'phys'), m('Golden Age','gold',90,'spec'), m('Auraveil','gold',0,'stat')],
    assets: {},
  },
  {
    id: 'spirit-035', spiritNumber: 35, name: 'Brightmane',
    types: ['gold', 'earth'], regionId: 'goldenveil', zoneDescription: 'City coliseum — post-champion battle only',
    rarity: 'epic', statMultipliers: { hp: 1.0, atk: 1.05, def: 1.025 },
    moves: [m('Codex Beam','gold',70,'spec'), m('Ironstone','earth',70,'phys'), m('Foundation Wall','earth',0,'stat'), m('Codex Restored','gold',150,'spec')],
    assets: {},
  },
];

export const ALL_SEED_SPIRITS: SeedSpirit[] = [...FOXY_STAGES, ...WILD_SPIRITS];
