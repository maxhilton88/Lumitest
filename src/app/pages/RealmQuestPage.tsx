/**
 * RealmQuestPage.tsx — Open-world exploration page for Foxy Adventure.
 *
 * Route: /realm/quest
 *
 * Renders the tile-based map (Thornhaven), handles:
 * - Player movement via virtual joystick (press anywhere & drag)
 * - Wild encounters → transitions to BattleScreen with isWildEncounter=true
 * - Building interactions (Shop → /realm/bag, Spiritlab modal, Home)
 * - 3 floating RPG orbs: Spirit, Bag, Map — each opens a popup
 * - Back button to return to Realm hub
 * - Screen flash + sound effect on encounter start
 * - Victory/defeat handling + HP persistence
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Sparkles, Heart, ArrowLeft, Swords, ShoppingBag, Map as MapIcon,
  X, FlaskConical, Compass, Ghost, Zap, Star, TrendingUp, Shield, Clock, Coins, Package,
} from 'lucide-react';
import { TileMapEngine, TILE, type DoorDef, type MapDef, type Position } from '../components/realm/TileMapEngine';
import { THORNHAVEN_MAP } from '../components/realm/thornhaven-map';
import { BattleScreen } from '../components/battle/BattleScreen';
import { SpiritlabModal } from '../components/realm/SpiritlabModal';
import { useRealmContext, xpRequiredForLevel, type PartySlot } from '../contexts/RealmContext';
import { useLanguage } from '../components/LanguageContext';
import { fetchShopItems, fetchRPGAssets, type ShopItemDef } from '../utils/api';
import { rpgGameListEntities, rpgGameSignedUrls } from '../utils/api';
import type { CharacterEntity, MapEntity } from '../components/admin/rpg-types';
import { TILE_TYPES } from '../components/admin/rpg-types';

const F = "'Cherry Bomb One', cursive";

function t3(en: string, ms: string, zh: string, lang: string) {
  return lang === 'en' ? en : lang === 'ms' ? ms : zh;
}

const WILD_SPIRIT_NAMES: Record<string, string> = {
  'spirit-001': 'Leafpup',
  'spirit-002': 'Embrit',
  'spirit-003': 'Dewspark',
};

type QuestPhase = 'exploring' | 'encounter-flash' | 'battling' | 'battle-result' | 'spiritlab';
type PopupType = 'spirit' | 'bag' | 'map' | null;

// ── Floating Action Orb ──
function ActionOrb({
  icon,
  label,
  color,
  glow,
  onClick,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  glow: string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-1 pointer-events-auto"
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
      whileTap={{ scale: 0.85 }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 52,
          height: 52,
          background: `linear-gradient(135deg, rgba(15,12,8,0.92), rgba(25,20,14,0.96))`,
          border: `2.5px solid ${color}50`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 20px ${glow}30, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontFamily: F,
          fontSize: 9,
          color: color,
          textShadow: `0 1px 4px rgba(0,0,0,0.9), 0 0 8px ${glow}20`,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </motion.button>
  );
}

// ── Mini party HP row for Spirit popup ──
function PartyList({ party }: { party: (PartySlot | null)[] }) {
  const { language } = useLanguage();
  const filledSlots = party.filter(Boolean) as PartySlot[];

  if (filledSlots.length === 0) {
    return (
      <p style={{ fontFamily: F, fontSize: 11, color: '#8a7e6a', textAlign: 'center', padding: 16 }}>
        {t3('No spirits in party', 'Tiada spirit dalam parti', '队伍中没有灵体', language)}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {filledSlots.map((slot, i) => {
        const hpRatio = slot.currentHp / 100;
        const isFainted = slot.currentHp <= 0;
        return (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{
            background: isFainted ? 'rgba(60,20,20,0.4)' : 'rgba(20,15,10,0.5)',
            border: `1px solid ${isFainted ? 'rgba(239,68,68,0.2)' : 'rgba(212,164,74,0.15)'}`,
          }}>
            <div className="flex items-center justify-center rounded-full" style={{
              width: 32, height: 32,
              background: isFainted ? 'rgba(60,20,20,0.5)' : 'rgba(20,15,10,0.6)',
              border: `1.5px solid ${isFainted ? 'rgba(239,68,68,0.3)' : 'rgba(212,164,74,0.2)'}`,
            }}>
              <span style={{ fontSize: 16 }}>{i === 0 ? '🦊' : '✦'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: F, fontSize: 11, color: isFainted ? '#ef4444' : '#e8dcc8' }}>
                {slot.spiritId || `Spirit ${i + 1}`}
              </p>
              <div className="mt-1 rounded-full overflow-hidden" style={{
                height: 6,
                background: 'rgba(0,0,0,0.4)',
              }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.max(0, Math.min(100, hpRatio * 100))}%`,
                  background: hpRatio > 0.5 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : hpRatio > 0.2 ? '#eab308' : '#ef4444',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
            <span style={{ fontFamily: F, fontSize: 10, color: isFainted ? '#ef4444' : '#c8b88a' }}>
              {slot.currentHp}/100
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Minimap Canvas ──
const MINI_TILE_COLORS: Record<number, string> = {
  [TILE.GRASS]: '#1a2e1a',
  [TILE.PATH]: '#3a2f20',
  [TILE.TREE]: '#0f1f0f',
  [TILE.WATER]: '#0a1928',
  [TILE.WALL]: '#2a2520',
  [TILE.DOOR]: '#8B6914',
  [TILE.TALL_GRASS]: '#1a3a1a',
  [TILE.NPC]: '#d4a44a',
  [TILE.BRIDGE]: '#5a4530',
  [TILE.FLOWER]: '#1a2e1a',
  [TILE.FENCE]: '#3a3020',
  [TILE.SIGN]: '#b89050',
};

function Minimap({ map, playerPos }: { map: MapDef; playerPos: Position }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Each tile = 4px on minimap
    const ps = 4;
    const dpr = window.devicePixelRatio || 1;
    const cw = map.width * ps;
    const ch = map.height * ps;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    // Draw tiles
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tile = map.tiles[row][col];
        ctx.fillStyle = MINI_TILE_COLORS[tile] || '#111';
        ctx.fillRect(col * ps, row * ps, ps, ps);
      }
    }

    // Draw door markers
    for (const door of map.doors) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(door.x * ps, door.y * ps, ps, ps);
    }

    // Draw player position — pulsing bright dot
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(playerPos.x * ps + ps / 2, playerPos.y * ps + ps / 2, ps * 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Outer glow ring
    ctx.strokeStyle = 'rgba(239,68,68,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(playerPos.x * ps + ps / 2, playerPos.y * ps + ps / 2, ps * 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }, [map, playerPos]);

  return (
    <div className="flex justify-center">
      <div className="rounded-xl overflow-hidden" style={{
        border: '1.5px solid rgba(212,164,74,0.2)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// ── Popup Panel (shared shell for Spirit/Bag/Map) ──
function PopupPanel({
  title,
  icon,
  color,
  children,
  onClose,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-[55] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {/* Panel */}
      <motion.div
        className="relative z-10 w-full rounded-t-2xl overflow-hidden"
        style={{
          maxWidth: 420,
          maxHeight: '70vh',
          background: 'linear-gradient(180deg, rgba(20,16,10,0.98), rgba(12,10,6,0.99))',
          border: '1.5px solid rgba(212,164,74,0.2)',
          borderBottom: 'none',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{
          borderBottom: '1px solid rgba(212,164,74,0.1)',
        }}>
          <div className="flex items-center gap-2">
            {icon}
            <span style={{ fontFamily: F, fontSize: 16, color }}>{title}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full" style={{
            background: 'rgba(255,255,255,0.05)',
          }}>
            <X size={16} color="#8a7e6a" />
          </button>
        </div>
        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 56px)' }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function RealmQuestPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const realm = useRealmContext();
  const { stats } = realm;

  const [phase, setPhase] = useState<QuestPhase>('exploring');
  const [encounteredSpiritId, setEncounteredSpiritId] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<'win' | 'lose' | null>(null);
  const [showSpiritlab, setShowSpiritlab] = useState(false);
  const [activePopup, setActivePopup] = useState<PopupType>(null);
  const [playerPos, setPlayerPos] = useState<Position>({ x: THORNHAVEN_MAP.spawnX, y: THORNHAVEN_MAP.spawnY });

  // ── Server-loaded map state ──
  const [activeMap, setActiveMap] = useState<MapDef>(THORNHAVEN_MAP as MapDef);
  const [mapName, setMapName] = useState<string>('Thornhaven');
  const [tileArtImages, setTileArtImages] = useState<Record<number, HTMLImageElement> | undefined>(undefined);

  // Load map from server (falls back to hardcoded THORNHAVEN_MAP)
  useEffect(() => {
    (async () => {
      try {
        const entities = await rpgGameListEntities('map');
        const mapList = entities as unknown as MapEntity[];
        // Prefer 'thornhaven' map, or first available
        const serverMap = mapList.find(m => m.id === 'thornhaven') || mapList[0];

        if (!serverMap || !serverMap.tiles || !serverMap.width || !serverMap.height) {
          console.log('[QuestMap] No server map found — using hardcoded Thornhaven');
          return;
        }

        // Convert MapEntity → MapDef
        const mapDef: MapDef = {
          id: serverMap.id,
          name: serverMap.name,
          width: serverMap.width,
          height: serverMap.height,
          tiles: serverMap.tiles as any,
          spawnX: serverMap.spawnX,
          spawnY: serverMap.spawnY,
          doors: serverMap.doors || [],
          encounterSpiritIds: serverMap.encounterSpiritIds || [],
          encounterRate: serverMap.encounterRate ?? 0.15,
        };
        setActiveMap(mapDef);
        setMapName(serverMap.name);
        setPlayerPos({ x: mapDef.spawnX, y: mapDef.spawnY });
        console.log(`[QuestMap] Loaded server map: ${serverMap.name} (${serverMap.width}x${serverMap.height})`);

        // Load tile art images if present
        if (serverMap.tileArt) {
          const artEntries = Object.entries(serverMap.tileArt).filter(([, v]) => !!v);
          if (artEntries.length > 0) {
            const artPaths = artEntries.map(([, v]) => v as string);
            const urls = await rpgGameSignedUrls(artPaths);
            const loadedImgs: Record<number, HTMLImageElement> = {};
            let pending = 0;
            const totalToLoad = artEntries.length;

            for (const [tileKey, storagePath] of artEntries) {
              const url = urls[storagePath as string];
              if (!url) { pending++; if (pending >= totalToLoad) setTileArtImages({ ...loadedImgs }); continue; }

              const tileDef = TILE_TYPES.find(t => t.key === tileKey);
              if (!tileDef) { pending++; if (pending >= totalToLoad) setTileArtImages({ ...loadedImgs }); continue; }

              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                loadedImgs[tileDef.id] = img;
                pending++;
                if (pending >= totalToLoad) {
                  setTileArtImages({ ...loadedImgs });
                  console.log(`[QuestMap] Loaded ${Object.keys(loadedImgs).length} tile art images`);
                }
              };
              img.onerror = () => {
                pending++;
                if (pending >= totalToLoad) setTileArtImages({ ...loadedImgs });
              };
              img.src = url;
            }
          }
        }
      } catch (err) {
        console.error('[QuestMap] Failed to load server map:', err);
      }
    })();
  }, []);

  // ── Character spritesheet state ──
  const [playerSpriteImg, setPlayerSpriteImg] = useState<HTMLImageElement | null>(null);
  const [foxSpriteImg, setFoxSpriteImg] = useState<HTMLImageElement | null>(null);

  // Load character spritesheets on mount
  useEffect(() => {
    (async () => {
      try {
        const entities = await rpgGameListEntities('character') as unknown as CharacterEntity[];
        // Determine which player character to use (boy by default, or based on stats.gender)
        const gender = stats.gender || 'boy';
        const playerChar = entities.find(e => e.characterType === gender) || entities.find(e => e.characterType === 'boy');
        const foxChar = entities.find(e => e.characterType === 'companion');

        const paths: string[] = [];
        if (playerChar?.assets?.spritesheet) paths.push(playerChar.assets.spritesheet);
        if (foxChar?.assets?.spritesheet) paths.push(foxChar.assets.spritesheet);

        if (paths.length === 0) {
          console.log('[QuestSprites] No spritesheets uploaded — using procedural fallback');
          return;
        }

        const urls = await rpgGameSignedUrls(paths);

        // Load player spritesheet
        if (playerChar?.assets?.spritesheet && urls[playerChar.assets.spritesheet]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            console.log(`[QuestSprites] Player spritesheet loaded: ${img.width}×${img.height}`);
            setPlayerSpriteImg(img);
          };
          img.onerror = () => console.warn('[QuestSprites] Failed to load player spritesheet');
          img.src = urls[playerChar.assets.spritesheet];
        }

        // Load fox spritesheet
        if (foxChar?.assets?.spritesheet && urls[foxChar.assets.spritesheet]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            console.log(`[QuestSprites] Fox spritesheet loaded: ${img.width}×${img.height}`);
            setFoxSpriteImg(img);
          };
          img.onerror = () => console.warn('[QuestSprites] Failed to load fox spritesheet');
          img.src = urls[foxChar.assets.spritesheet];
        }
      } catch (err) {
        console.error('[QuestSprites] Failed to load character sprites:', err);
      }
    })();
  }, []); // Only run once on mount

  // ── Bag popup state ──
  const [bagItems, setBagItems] = useState<ShopItemDef[]>([]);
  const [bagAssetMap, setBagAssetMap] = useState<Record<string, string>>({});
  const [bagLoaded, setBagLoaded] = useState(false);
  const [useFlash, setUseFlash] = useState<string | null>(null);

  const inventory: Record<string, number> = stats.inventory || {};
  const setInventory = useCallback((updater: (prev: Record<string, number>) => Record<string, number>) => {
    realm.setStats(prev => ({ ...prev, inventory: updater(prev.inventory || {}) }));
  }, [realm]);

  // Load item defs when bag popup opens
  useEffect(() => {
    if (activePopup !== 'bag' || bagLoaded) return;
    (async () => {
      try {
        const [shopRes, assetRes] = await Promise.all([
          fetchShopItems(),
          fetchRPGAssets(),
        ]);
        setBagItems(shopRes.items || []);
        const m: Record<string, string> = {};
        for (const a of assetRes.assets) m[a.slug] = a.url;
        setBagAssetMap(m);
        setBagLoaded(true);
      } catch (err) {
        console.error('[QuestBag] Failed to load items:', err);
      }
    })();
  }, [activePopup, bagLoaded]);

  // Use item handler (consumable only)
  const handleUseItem = useCallback((item: ShopItemDef) => {
    const qty = inventory[item.id] || 0;
    if (qty <= 0) return;

    // Decrement inventory
    setInventory(inv => {
      const next = { ...inv, [item.id]: inv[item.id] - 1 };
      if (next[item.id] <= 0) delete next[item.id];
      return next;
    });

    // Flash effect
    setUseFlash(item.id);
    setTimeout(() => setUseFlash(null), 600);

    // Apply effects
    if (item.effects?.length) {
      realm.setStats(prev => {
        let u = { ...prev };
        for (const eff of item.effects) {
          const raw = eff.value;
          switch (eff.type) {
            case 'hp': {
              const delta = eff.isPercent ? Math.round(u.maxHp * raw / 100) : raw;
              u.hp = Math.min(u.maxHp, u.hp + delta);
              break;
            }
            case 'xp': {
              const delta = eff.isPercent ? Math.round(u.xpToNext * raw / 100) : raw;
              let xp = u.xp + delta;
              let lvl = u.level;
              let xpNext = u.xpToNext;
              while (xp >= xpNext) { xp -= xpNext; lvl += 1; xpNext = xpRequiredForLevel(lvl); }
              u.level = lvl; u.xp = xp; u.xpToNext = xpNext;
              break;
            }
            case 'energy': {
              const delta = eff.isPercent ? Math.round(100 * raw / 100) : raw;
              u.hunger = Math.min(100, u.hunger + delta);
              break;
            }
            case 'gold': {
              const delta = eff.isPercent ? Math.round(u.gold * raw / 100) : raw;
              u.gold += delta;
              break;
            }
            case 'shield': break;
            case 'time_extend': break;
          }
        }
        return u;
      });
    }
    setTimeout(() => realm.flushStats(), 200);
  }, [inventory, setInventory, realm]);

  const myLevel = stats.level || 1;
  const myName = stats.name || 'Foxy';
  const myHp = stats.hp || 100;
  const myMaxHp = stats.maxHp || 100;
  const hpRatio = myMaxHp > 0 ? myHp / myMaxHp : 1;
  const party = stats.party || [];
  const gold = stats.gold || 0;
  const diamond = stats.diamond || 0;

  // ── Wild encounter handler ──
  const handleEncounter = useCallback((spiritId: string) => {
    if (phase !== 'exploring') return;
    if (hpRatio < 0.05) return;

    setEncounteredSpiritId(spiritId);
    setPhase('encounter-flash');
    setTimeout(() => setPhase('battling'), 1200);
  }, [phase, hpRatio]);

  // ── Door interaction handler ──
  const handleDoorInteract = useCallback((door: DoorDef) => {
    switch (door.id) {
      case 'shop': navigate('/realm/bag?shop=1'); break;
      case 'spiritlab':
        setShowSpiritlab(true);
        setPhase('spiritlab');
        break;
      case 'house':
        realm.setStats(prev => ({
          ...prev,
          hp: prev.maxHp,
          party: prev.party?.map(slot => slot ? { ...slot, currentHp: 100 } : null),
        }));
        setTimeout(() => realm.flushStats(), 200);
        break;
    }
  }, [navigate, realm]);

  // ── Battle end handler ──
  const handleBattleEnd = useCallback((result: 'win' | 'lose', remainingHP: number, battleMaxHP: number) => {
    setBattleResult(result);
    if (result === 'win') {
      realm.addXP(Math.max(5, Math.round(myLevel * 3)));
      realm.addGold(Math.max(3, Math.round(myLevel * 2)));
    }
    const hpRat = battleMaxHP > 0 ? Math.max(0, remainingHP / battleMaxHP) : 0;
    realm.setStats(prev => ({ ...prev, hp: Math.max(1, Math.round(hpRat * prev.maxHp)) }));
    setTimeout(() => realm.flushStats(), 200);
    setPhase('battle-result');
    setTimeout(() => {
      setPhase('exploring');
      setBattleResult(null);
      setEncounteredSpiritId(null);
    }, 2000);
  }, [realm, myLevel]);

  // ── Forfeit (run away) ──
  const handleForfeit = useCallback((remainingHP: number, battleMaxHP: number) => {
    const hpRat = battleMaxHP > 0 ? Math.max(0, remainingHP / battleMaxHP) : 0;
    realm.setStats(prev => ({ ...prev, hp: Math.max(1, Math.round(hpRat * prev.maxHp)) }));
    setTimeout(() => realm.flushStats(), 200);
    setPhase('exploring');
    setBattleResult(null);
    setEncounteredSpiritId(null);
  }, [realm]);

  const handleBack = useCallback(() => navigate('/realm'), [navigate]);

  const handleCloseSpiritlab = useCallback(() => {
    setShowSpiritlab(false);
    setPhase('exploring');
  }, []);

  const spiritLevelRef = useRef(1);
  const spiritName = encounteredSpiritId ? (WILD_SPIRIT_NAMES[encounteredSpiritId] || 'Wild Spirit') : 'Wild Spirit';

  useEffect(() => {
    if (phase === 'encounter-flash') {
      spiritLevelRef.current = Math.max(1, myLevel + Math.floor(Math.random() * 5) - 2);
    }
  }, [phase, myLevel]);

  const isPaused = phase !== 'exploring' || activePopup !== null;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#050505' }}>
      {/* ── Map ── */}
      <TileMapEngine
        map={activeMap}
        tileSize={32}
        onEncounter={handleEncounter}
        onDoorInteract={handleDoorInteract}
        onPlayerMove={setPlayerPos}
        paused={isPaused}
        playerSprite={playerSpriteImg}
        foxSprite={foxSpriteImg}
        tileArtImages={tileArtImages}
      />

      {/* ── Exploring UI ── */}
      {phase === 'exploring' && !activePopup && (
        <>
          {/* Back button — top left */}
          <motion.button
            onClick={handleBack}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-4 left-3 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full pointer-events-auto"
            style={{
              background: 'rgba(10,8,6,0.75)',
              border: '1.5px solid rgba(212,164,74,0.25)',
              backdropFilter: 'blur(8px)',
            }}
            whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <ArrowLeft size={14} color="#d4a44a" />
            <span style={{ fontFamily: F, fontSize: 11, color: '#d4a44a' }}>
              {t3('Realm', 'Alam', '领域', language)}
            </span>
          </motion.button>

          {/* Location name — top center */}
          <motion.div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="px-4 py-1.5 rounded-full" style={{
              background: 'rgba(10,8,6,0.65)',
              border: '1px solid rgba(212,164,74,0.15)',
              backdropFilter: 'blur(6px)',
            }}>
              <span style={{ fontFamily: F, fontSize: 10, color: '#c8b88a', letterSpacing: '0.05em' }}>
                {mapName}
              </span>
            </div>
          </motion.div>

          {/* Mini gold/diamond — top right */}
          <motion.div
            className="absolute top-4 right-3 z-40 flex items-center gap-2 pointer-events-none"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
              background: 'rgba(10,8,6,0.75)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}>
              <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ffd700, #ff9800)', border: '1px solid #b8860b' }}>
                <span style={{ fontFamily: F, fontSize: 7, color: '#5c3d00' }}>G</span>
              </div>
              <span style={{ fontFamily: F, fontSize: 10, color: '#ffd700' }}>
                {gold >= 10000 ? `${(gold / 1000).toFixed(1)}k` : gold}
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
              background: 'rgba(10,8,6,0.75)',
              border: '1px solid rgba(168,85,247,0.2)',
            }}>
              <svg viewBox="0 0 26 26" width={12} height={12}>
                <polygon points="13,1 24,9 13,25 2,9" fill="#a855f7" stroke="#6d28d9" strokeWidth="1.2" />
              </svg>
              <span style={{ fontFamily: F, fontSize: 10, color: '#c084fc' }}>{diamond}</span>
            </div>
          </motion.div>

          {/* ── 3 Floating Action Orbs — bottom right ── */}
          <div className="absolute bottom-8 right-4 z-40 flex flex-col items-center gap-3 pointer-events-none">
            <ActionOrb
              icon={<Ghost size={22} color="#a78bfa" />}
              label={t3('Spirit', 'Spirit', '灵体', language)}
              color="#a78bfa"
              glow="#8b5cf6"
              onClick={() => setActivePopup('spirit')}
              delay={0}
            />
            <ActionOrb
              icon={<ShoppingBag size={22} color="#fbbf24" />}
              label={t3('Bag', 'Beg', '背包', language)}
              color="#fbbf24"
              glow="#f59e0b"
              onClick={() => setActivePopup('bag')}
              delay={0.05}
            />
            <ActionOrb
              icon={<Compass size={22} color="#34d399" />}
              label={t3('Map', 'Peta', '地图', language)}
              color="#34d399"
              glow="#10b981"
              onClick={() => setActivePopup('map')}
              delay={0.1}
            />
          </div>

          {/* Low HP Warning */}
          {hpRatio < 0.2 && (
            <motion.div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-xl pointer-events-none"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                backdropFilter: 'blur(6px)',
              }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Heart size={14} color="#ef4444" />
              <span style={{ fontFamily: F, fontSize: 10, color: '#fca5a5' }}>
                {t3('Low HP! Visit Home to heal', 'HP rendah! Pulang untuk pulih', 'HP低！回家恢复', language)}
              </span>
            </motion.div>
          )}
        </>
      )}

      {/* ── Popup: Spirit ── */}
      <AnimatePresence>
        {activePopup === 'spirit' && (
          <PopupPanel
            title={t3('Party', 'Parti', '队伍', language)}
            icon={<Ghost size={18} color="#a78bfa" />}
            color="#a78bfa"
            onClose={() => setActivePopup(null)}
          >
            <PartyList party={party} />
            <div className="px-4 pb-4">
              <button
                onClick={() => { setActivePopup(null); setShowSpiritlab(true); setPhase('spiritlab'); }}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(168,85,247,0.1))',
                  border: '1.5px solid rgba(168,85,247,0.25)',
                  fontFamily: F, fontSize: 13, color: '#c4b5fd',
                }}
              >
                <FlaskConical size={16} color="#a78bfa" />
                {t3('Open Spiritlab', 'Buka Makmal', '打开灵实验室', language)}
              </button>
            </div>
          </PopupPanel>
        )}
      </AnimatePresence>

      {/* ── Popup: Map ── */}
      <AnimatePresence>
        {activePopup === 'map' && (
          <PopupPanel
            title={mapName}
            icon={<Compass size={18} color="#34d399" />}
            color="#34d399"
            onClose={() => setActivePopup(null)}
          >
            <div className="p-4">
              <Minimap map={activeMap} playerPos={playerPos} />
            </div>
          </PopupPanel>
        )}
      </AnimatePresence>

      {/* ── Popup: Bag ── */}
      <AnimatePresence>
        {activePopup === 'bag' && (
          <PopupPanel
            title={t3('Bag', 'Beg', '背包', language)}
            icon={<ShoppingBag size={18} color="#fbbf24" />}
            color="#fbbf24"
            onClose={() => setActivePopup(null)}
          >
            <div className="p-3">
              {!bagLoaded ? (
                <div className="flex items-center justify-center py-10">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Package size={24} color="#8a7e6a" />
                  </motion.div>
                </div>
              ) : (() => {
                // Build list of owned items
                const ownedItems = bagItems.filter(item => (inventory[item.id] || 0) > 0);
                if (ownedItems.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <Package size={32} color="#3a3020" style={{ margin: '0 auto 8px' }} />
                      <p style={{ fontFamily: F, fontSize: 12, color: '#8a7e6a' }}>
                        {t3('Bag is empty', 'Beg kosong', '背包是空的', language)}
                      </p>
                      <p style={{ fontFamily: F, fontSize: 10, color: '#5a5040', marginTop: 4 }}>
                        {t3('Visit the Shop building to buy items!', 'Lawati bangunan Kedai untuk membeli barang!', '去商店建筑购买物品吧！', language)}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {ownedItems.map(item => {
                      const qty = inventory[item.id] || 0;
                      const imgUrl = bagAssetMap[item.imageSlug] || null;
                      const isFlashing = useFlash === item.id;
                      const isConsumable = item.category === 'consumable' || item.category === 'battle';
                      return (
                        <motion.div
                          key={item.id}
                          className="relative rounded-xl overflow-hidden"
                          style={{
                            background: 'rgba(20,15,10,0.6)',
                            border: isFlashing
                              ? '1.5px solid rgba(34,197,94,0.6)'
                              : '1px solid rgba(212,164,74,0.12)',
                            boxShadow: isFlashing ? '0 0 16px rgba(34,197,94,0.3)' : 'none',
                          }}
                          animate={isFlashing ? { scale: [1, 1.05, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="p-2.5">
                            {/* Icon + Quantity badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{
                                background: 'rgba(15,12,8,0.6)',
                                border: '1px solid rgba(212,164,74,0.1)',
                              }}>
                                {imgUrl ? (
                                  <img src={imgUrl} alt="" className="w-8 h-8 object-contain" />
                                ) : (
                                  <Package size={18} color="#8a7e6a" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate" style={{ fontFamily: F, fontSize: 11, color: '#e8dcc8', lineHeight: 1.2 }}>
                                  {item.name}
                                </p>
                                <p style={{ fontFamily: F, fontSize: 9, color: '#8a7e6a', marginTop: 1 }}>
                                  ×{qty}
                                </p>
                              </div>
                            </div>
                            {/* Effect summary */}
                            {item.effects?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {item.effects.slice(0, 2).map((eff, ei) => (
                                  <span key={ei} className="px-1.5 py-0.5 rounded" style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    fontFamily: F, fontSize: 8, color: '#c8b88a',
                                  }}>
                                    +{eff.value}{eff.isPercent ? '%' : ''} {eff.type.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Use button */}
                            {isConsumable && (
                              <motion.button
                                onClick={() => handleUseItem(item)}
                                className="w-full py-1.5 rounded-lg flex items-center justify-center gap-1"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.1))',
                                  border: '1px solid rgba(34,197,94,0.25)',
                                  fontFamily: F, fontSize: 10, color: '#4ade80',
                                }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Sparkles size={10} />
                                {t3('Use', 'Guna', '使用', language)}
                              </motion.button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            {/* Shop shortcut button */}
            <div className="px-3 pb-4 pt-1">
              <motion.button
                onClick={() => { setActivePopup(null); navigate('/realm/bag?shop=1'); }}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.1))',
                  border: '1.5px solid rgba(251,191,36,0.25)',
                  fontFamily: F, fontSize: 13, color: '#fbbf24',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <Coins size={16} color="#fbbf24" />
                {t3('Visit Shop', 'Lawati Kedai', '前往商店', language)}
              </motion.button>
            </div>
          </PopupPanel>
        )}
      </AnimatePresence>

      {/* ── Encounter Flash ── */}
      <AnimatePresence>
        {phase === 'encounter-flash' && (
          <motion.div
            className="absolute inset-0 z-[80] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: '#fff' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0, 1, 0, 0.8, 0] }}
              transition={{ duration: 1, times: [0, 0.1, 0.2, 0.3, 0.4, 0.6, 1] }}
            />
            <motion.div
              className="relative z-10 text-center"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 1] }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <Sparkles className="w-10 h-10 mx-auto mb-2" style={{ color: '#ffd700' }} />
              <p style={{
                fontFamily: F, fontSize: 22, color: '#ffd700',
                textShadow: '0 2px 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3)',
              }}>
                {t3('Wild Encounter!', 'Pertemuan Liar!', '野外遭遇！', language)}
              </p>
              <p style={{ fontFamily: F, fontSize: 14, color: '#e0d0b0', marginTop: 4 }}>
                {spiritName} {t3('appeared!', 'muncul!', '出现了！', language)}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Battle Screen ── */}
      {phase === 'battling' && encounteredSpiritId && (
        <div className="absolute inset-0 z-[70]">
          <BattleScreen
            myName={myName}
            myLevel={myLevel}
            opponentName={spiritName}
            opponentLevel={spiritLevelRef.current}
            stake={0}
            onBattleEnd={handleBattleEnd}
            onForfeit={handleForfeit}
            age={stats.age || 5}
            initialHpRatio={hpRatio}
            isWildEncounter={true}
            opponentSpiritId={encounteredSpiritId}
          />
        </div>
      )}

      {/* ── Battle Result Toast ── */}
      <AnimatePresence>
        {phase === 'battle-result' && battleResult && (
          <motion.div
            className="absolute inset-0 z-[80] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center px-8 py-6 rounded-2xl"
              style={{
                background: battleResult === 'win'
                  ? 'linear-gradient(135deg, rgba(20,40,10,0.95), rgba(10,30,5,0.98))'
                  : 'linear-gradient(135deg, rgba(40,10,10,0.95), rgba(30,5,5,0.98))',
                border: `2px solid ${battleResult === 'win' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                boxShadow: `0 0 40px ${battleResult === 'win' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <p style={{
                fontFamily: F, fontSize: 24,
                color: battleResult === 'win' ? '#22c55e' : '#ef4444',
                textShadow: `0 0 20px ${battleResult === 'win' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
              }}>
                {battleResult === 'win'
                  ? t3('Victory!', 'Kemenangan!', '胜利！', language)
                  : t3('Defeated...', 'Kalah...', '战败...', language)}
              </p>
              {battleResult === 'win' && (
                <p style={{ fontFamily: F, fontSize: 12, color: '#c8b88a', marginTop: 8 }}>
                  {t3('Returning to exploration...', 'Kembali meneroka...', '返回探索...', language)}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Spiritlab Modal ── */}
      {showSpiritlab && (
        <div className="absolute inset-0 z-[60]">
          <SpiritlabModal open={showSpiritlab} onClose={handleCloseSpiritlab} />
        </div>
      )}
    </div>
  );
}