/**
 * RPGMapEditor.tsx — Visual tile map editor for the admin backend.
 *
 * Features:
 *  - Canvas-based tile grid with zoom/pan
 *  - Tile palette (12 tile types with color swatches)
 *  - Paint, erase, fill, eyedropper tools
 *  - Door placement & management with target map linking
 *  - Spawn point placement
 *  - Per-tile-type tileset image upload (optional visual artwork)
 *  - Map properties panel (name, size, region, encounter settings)
 *  - Hierarchical map browser (continent → region → map)
 *  - Region overview with mini-map previews & door connections
 *  - Load/save maps from KV store (entity type: 'map')
 *  - Import existing Thornhaven map as starting template
 *  - Export as JSON
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Save, Loader2, Plus, Trash2, Download, Upload, Paintbrush, Eraser,
  Pipette, Grid3X3, ZoomIn, ZoomOut, RefreshCw, MapPin, Crosshair,
  DoorOpen, Eye, EyeOff, ChevronDown, ChevronRight, X, PaintBucket, Move,
  AlertTriangle, Check, Settings, Layers, Copy, Globe, Map as MapIcon,
  FolderOpen, ArrowRight, Link2, Unlink,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  rpgGameListEntities, rpgGameSaveEntity, rpgGameDeleteEntity,
  rpgGameSignedUrls, rpgGameUpload,
} from '../../utils/api';
import { TILE_TYPES, REGIONS, CONTINENTS, type MapEntity, type MapDoor, type RegionId } from './rpg-types';

const GOLD = '#d4a44a';

type Tool = 'paint' | 'erase' | 'fill' | 'eyedropper' | 'door' | 'spawn';

const TOOLS: { id: Tool; label: string; icon: React.ElementType; hotkey: string }[] = [
  { id: 'paint', label: 'Paint', icon: Paintbrush, hotkey: 'B' },
  { id: 'erase', label: 'Erase', icon: Eraser, hotkey: 'E' },
  { id: 'fill', label: 'Fill', icon: PaintBucket, hotkey: 'G' },
  { id: 'eyedropper', label: 'Pick', icon: Pipette, hotkey: 'I' },
  { id: 'door', label: 'Door', icon: DoorOpen, hotkey: 'D' },
  { id: 'spawn', label: 'Spawn', icon: Crosshair, hotkey: 'S' },
];

function createEmptyMap(w: number, h: number): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function newMapDefaults(id?: string, regionId?: RegionId): Omit<MapEntity, 'createdAt' | 'updatedAt'> {
  return {
    id: id || `map-${Date.now().toString(36)}`,
    type: 'map',
    name: 'New Map',
    regionId,
    width: 24,
    height: 24,
    tiles: createEmptyMap(24, 24),
    spawnX: 12,
    spawnY: 12,
    doors: [],
    encounterSpiritIds: [],
    encounterRate: 0.15,
  };
}

// ── Flood fill algorithm ──
function floodFill(tiles: number[][], x: number, y: number, newTile: number): number[][] {
  const h = tiles.length;
  const w = tiles[0].length;
  const oldTile = tiles[y][x];
  if (oldTile === newTile) return tiles;

  const result = tiles.map(row => [...row]);
  const stack: [number, number][] = [[x, y]];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    if (result[cy][cx] !== oldTile) continue;

    visited.add(key);
    result[cy][cx] = newTile;

    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return result;
}

// ── Mini map canvas rendering (for overview) ──
function MiniMapPreview({ map, size = 80, onClick, isSelected }: {
  map: MapEntity; size?: number; onClick?: () => void; isSelected?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const tileW = size / map.width;
    const tileH = size / map.height;

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tileId = map.tiles[row]?.[col] ?? 0;
        const tt = TILE_TYPES.find(t => t.id === tileId);
        ctx.fillStyle = tt?.color || '#111';
        ctx.fillRect(col * tileW, row * tileH, tileW + 0.5, tileH + 0.5);
      }
    }

    // Draw spawn
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(map.spawnX * tileW + tileW / 2, map.spawnY * tileH + tileH / 2, Math.max(2, tileW), 0, Math.PI * 2);
    ctx.fill();

    // Draw doors
    for (const door of map.doors) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(door.x * tileW, door.y * tileH, Math.max(2, tileW), Math.max(2, tileH));
    }
  }, [map, size]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      style={{ width: size, height: size, imageRendering: 'pixelated', cursor: onClick ? 'pointer' : 'default' }}
      className={`rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-amber-400 shadow-lg shadow-amber-500/20'
          : 'border-gray-700/50 hover:border-gray-600'
      }`}
    />
  );
}

// ── Door Edit Dialog (inline, enhanced with target) ──
function DoorEditInline({
  door,
  allMaps,
  onChange,
  onDelete,
}: {
  door: MapDoor;
  allMaps: MapEntity[];
  onChange: (d: MapDoor) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const targetMap = allMaps.find(m => m.id === door.targetMapId);

  return (
    <div className="rounded-lg bg-gray-800/60 border border-gray-700/50 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button onClick={() => setExpanded(!expanded)} className="p-0.5">
          {expanded ? <ChevronDown className="w-2.5 h-2.5 text-gray-500" /> : <ChevronRight className="w-2.5 h-2.5 text-gray-500" />}
        </button>
        <DoorOpen className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="text-[10px] text-gray-500 w-10">({door.x},{door.y})</span>
        <span className="text-[10px] text-white truncate flex-1">{door.label || door.id}</span>
        {door.targetMapId && <Link2 className="w-2.5 h-2.5 text-green-400" />}
        <button onClick={onDelete} className="p-0.5 rounded hover:bg-red-500/20 text-red-400">
          <X className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-gray-700/30 pt-1.5">
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-[8px] text-gray-600">Door ID</label>
              <input
                value={door.id}
                onChange={e => onChange({ ...door, id: e.target.value })}
                className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-[8px] text-gray-600">Label</label>
              <input
                value={door.label}
                onChange={e => onChange({ ...door, label: e.target.value })}
                className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[8px] text-gray-600">Target Map</label>
            <select
              value={door.targetMapId || ''}
              onChange={e => onChange({ ...door, targetMapId: e.target.value || undefined })}
              className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-700 text-white"
            >
              <option value="">-- none --</option>
              {allMaps.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.width}x{m.height})
                </option>
              ))}
            </select>
          </div>

          {door.targetMapId && (
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="text-[8px] text-gray-600">Target X</label>
                <input
                  type="number"
                  value={door.targetX ?? (targetMap ? targetMap.spawnX : 0)}
                  onChange={e => onChange({ ...door, targetX: parseInt(e.target.value) || 0 })}
                  className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-700 text-white text-center"
                  min={0} max={targetMap ? targetMap.width - 1 : 999}
                />
              </div>
              <div>
                <label className="text-[8px] text-gray-600">Target Y</label>
                <input
                  type="number"
                  value={door.targetY ?? (targetMap ? targetMap.spawnY : 0)}
                  onChange={e => onChange({ ...door, targetY: parseInt(e.target.value) || 0 })}
                  className="w-full text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-700 text-white text-center"
                  min={0} max={targetMap ? targetMap.height - 1 : 999}
                />
              </div>
            </div>
          )}

          {targetMap && (
            <div className="flex items-center gap-2 pt-1">
              <MiniMapPreview map={targetMap} size={48} />
              <div>
                <p className="text-[9px] text-amber-400">{targetMap.name}</p>
                <p className="text-[8px] text-gray-600">{targetMap.width}x{targetMap.height}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Region Overview Panel ──
function RegionOverview({
  regionId,
  maps,
  onSelectMap,
  onNewMap,
}: {
  regionId: RegionId;
  maps: MapEntity[];
  onSelectMap: (m: MapEntity) => void;
  onNewMap: (regionId: RegionId) => void;
}) {
  const region = REGIONS.find(r => r.id === regionId);
  const regionMaps = maps.filter(m => m.regionId === regionId);

  // Build connection graph
  const connections: { from: string; to: string; doorLabel: string }[] = [];
  for (const m of regionMaps) {
    for (const door of m.doors) {
      if (door.targetMapId && regionMaps.some(rm => rm.id === door.targetMapId)) {
        connections.push({ from: m.id, to: door.targetMapId, doorLabel: door.label });
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-amber-400">{region?.emoji} {region?.label || regionId}</h4>
          <p className="text-[10px] text-gray-500">
            {regionMaps.length} maps | Level {region?.levelRange} | {connections.length} connections
          </p>
        </div>
        <button
          onClick={() => onNewMap(regionId)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
        >
          <Plus className="w-3 h-3" /> Add Map
        </button>
      </div>

      {/* Mini map grid */}
      <div className="grid grid-cols-4 gap-3">
        {regionMaps.map(m => {
          const outgoing = m.doors.filter(d => d.targetMapId).length;
          const incoming = connections.filter(c => c.to === m.id).length;
          return (
            <div key={m.id} className="flex flex-col items-center gap-1">
              <MiniMapPreview map={m} size={72} onClick={() => onSelectMap(m)} />
              <p className="text-[9px] text-white font-medium text-center truncate max-w-[80px]">{m.name}</p>
              <p className="text-[8px] text-gray-600">
                {m.width}x{m.height}
                {(outgoing > 0 || incoming > 0) && (
                  <span className="text-green-400 ml-1">{outgoing} out / {incoming} in</span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Connection list */}
      {connections.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">Door Connections</p>
          {connections.map((c, i) => {
            const fromMap = regionMaps.find(m => m.id === c.from);
            const toMap = regionMaps.find(m => m.id === c.to);
            return (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/40 text-[9px]">
                <Link2 className="w-2.5 h-2.5 text-green-400 shrink-0" />
                <span className="text-white">{fromMap?.name || c.from}</span>
                <ArrowRight className="w-2.5 h-2.5 text-gray-600" />
                <span className="text-white">{toMap?.name || c.to}</span>
                <span className="text-gray-600 ml-auto">{c.doorLabel}</span>
              </div>
            );
          })}
        </div>
      )}

      {regionMaps.length === 0 && (
        <div className="text-center py-8 text-gray-600 text-xs">
          No maps in this region yet. Click "Add Map" to create one.
        </div>
      )}
    </div>
  );
}

// ── Hierarchical Map Browser ──
function MapBrowser({
  maps,
  onSelectMap,
  onNewMap,
  onShowOverview,
}: {
  maps: MapEntity[];
  onSelectMap: (m: MapEntity) => void;
  onNewMap: (regionId?: RegionId) => void;
  onShowOverview: (regionId: RegionId) => void;
}) {
  const [expandedContinents, setExpandedContinents] = useState<Record<string, boolean>>({});
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

  const toggleContinent = (c: string) => setExpandedContinents(prev => ({ ...prev, [c]: !prev[c] }));
  const toggleRegion = (r: string) => setExpandedRegions(prev => ({ ...prev, [r]: !prev[r] }));

  // Group maps by region
  const mapsByRegion = useMemo(() => {
    const grouped: Record<string, MapEntity[]> = {};
    for (const m of maps) {
      const key = m.regionId || '__unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    return grouped;
  }, [maps]);

  const unassigned = mapsByRegion['__unassigned'] || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> World Map Browser
        </h3>
        <button
          onClick={() => onNewMap()}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700"
        >
          <Plus className="w-3 h-3" /> New Map
        </button>
      </div>

      <p className="text-[10px] text-gray-600">
        {maps.length} total maps across {CONTINENTS.length} continents, {REGIONS.length} regions
      </p>

      {/* Continent → Region → Map tree */}
      {CONTINENTS.map(continent => {
        const continentRegions = REGIONS.filter(r => r.continent === continent);
        const continentMapCount = continentRegions.reduce((acc, r) => acc + (mapsByRegion[r.id]?.length || 0), 0);
        const isExpanded = expandedContinents[continent] ?? false;

        return (
          <div key={continent} className="rounded-xl border border-gray-700/40 overflow-hidden bg-gray-900/30">
            {/* Continent header */}
            <button
              onClick={() => toggleContinent(continent)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-800/40 transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              }
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-white flex-1">{continent}</span>
              <span className="text-[10px] text-gray-600">
                {continentRegions.length} regions | {continentMapCount} maps
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-800 px-1 pb-1">
                {continentRegions.map(region => {
                  const regionMaps = mapsByRegion[region.id] || [];
                  const isRegionExpanded = expandedRegions[region.id] ?? false;

                  return (
                    <div key={region.id} className="mt-1">
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleRegion(region.id)}
                          className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left rounded-lg hover:bg-gray-800/40 transition-colors"
                        >
                          {isRegionExpanded
                            ? <ChevronDown className="w-3 h-3 text-amber-400" />
                            : <ChevronRight className="w-3 h-3 text-gray-500" />
                          }
                          <span className="text-sm">{region.emoji}</span>
                          <span className="text-[11px] font-medium text-gray-300">{region.label}</span>
                          <span className="text-[9px] text-gray-600 ml-auto">
                            Lv{region.levelRange} | {regionMaps.length} maps
                          </span>
                        </button>
                        <button
                          onClick={() => onShowOverview(region.id as RegionId)}
                          title="Region overview"
                          className="p-1 rounded text-gray-600 hover:text-amber-400 hover:bg-gray-800"
                        >
                          <MapIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onNewMap(region.id as RegionId)}
                          title="Add map to region"
                          className="p-1 rounded text-gray-600 hover:text-green-400 hover:bg-gray-800"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {isRegionExpanded && (
                        <div className="ml-5 space-y-0.5 mt-0.5">
                          {regionMaps.length === 0 ? (
                            <p className="text-[9px] text-gray-700 px-2 py-1 italic">No maps yet</p>
                          ) : (
                            regionMaps.map(m => (
                              <button
                                key={m.id}
                                onClick={() => onSelectMap(m)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-800/60 transition-colors group"
                              >
                                <Layers className="w-3 h-3 text-gray-600 group-hover:text-amber-400 shrink-0" />
                                <span className="text-[10px] text-gray-400 group-hover:text-white truncate flex-1">{m.name}</span>
                                <span className="text-[8px] text-gray-700">{m.width}x{m.height}</span>
                                {m.doors.length > 0 && (
                                  <span className="text-[8px] text-green-600">{m.doors.length}d</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned maps */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-gray-700/40 overflow-hidden bg-gray-900/30">
          <div className="px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-medium text-orange-400">Unassigned Maps</span>
            <span className="text-[10px] text-gray-600">{unassigned.length}</span>
          </div>
          <div className="px-2 pb-2 space-y-0.5">
            {unassigned.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectMap(m)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-800/60 transition-colors group"
              >
                <Layers className="w-3 h-3 text-gray-600 group-hover:text-amber-400 shrink-0" />
                <span className="text-[10px] text-gray-400 group-hover:text-white truncate flex-1">{m.name}</span>
                <span className="text-[8px] text-gray-700">{m.width}x{m.height}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={() => onNewMap()}
          className="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-amber-500/40 hover:bg-gray-800/30 transition-all"
        >
          <Plus className="w-6 h-6 text-gray-600" />
          <span className="text-[10px] font-medium text-gray-400">New Blank Map</span>
          <span className="text-[8px] text-gray-600">24x24 empty grid</span>
        </button>
        <ImportTemplateButton />
      </div>
    </div>
  );
}

function ImportTemplateButton() {
  return (
    <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-gray-700 text-center opacity-50 cursor-default">
      <Copy className="w-6 h-6 text-gray-600" />
      <span className="text-[10px] font-medium text-gray-400">Templates</span>
      <span className="text-[8px] text-gray-600">Use from editor toolbar</span>
    </div>
  );
}

// ════════════════════════════════════════════════
// ══ MAIN MAP EDITOR COMPONENT ══
// ════════════════════════════════════════════════

export function RPGMapEditor() {
  // ── Map state ──
  const [maps, setMaps] = useState<MapEntity[]>([]);
  const [currentMap, setCurrentMap] = useState<MapEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showMapList, setShowMapList] = useState(false);

  // ── View mode: 'browser' | 'overview' | 'editor' ──
  const [viewMode, setViewMode] = useState<'browser' | 'overview'>('browser');
  const [overviewRegionId, setOverviewRegionId] = useState<RegionId | null>(null);

  // ── Editor state ──
  const [tool, setTool] = useState<Tool>('paint');
  const [selectedTile, setSelectedTile] = useState(0);
  const [zoom, setZoom] = useState(20); // pixels per tile
  const [showGrid, setShowGrid] = useState(true);
  const [showDoors, setShowDoors] = useState(true);
  const [showSpawn, setShowSpawn] = useState(true);
  const [isPainting, setIsPainting] = useState(false);

  // ── Per-tile-type art images ──
  const [tileArtUrls, setTileArtUrls] = useState<Record<string, string>>({});
  const [tileArtImages, setTileArtImages] = useState<Record<number, HTMLImageElement>>({});

  // ── Canvas refs ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });

  // ── Pan state ──
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const middleDownRef = useRef(false);

  // ── Undo stack ──
  const undoStackRef = useRef<number[][][]>([]);
  const [undoCount, setUndoCount] = useState(0);

  // ── Properties panel ──
  const [showProps, setShowProps] = useState(false);

  // ── Load maps from server ──
  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      const entities = await rpgGameListEntities('map');
      const mapList = entities as unknown as MapEntity[];
      setMaps(mapList);

      // Load tile art signed URLs
      const allPaths: string[] = [];
      for (const m of mapList) {
        if (m.tileArt) Object.values(m.tileArt).forEach(p => { if (p) allPaths.push(p); });
      }
      if (allPaths.length > 0) {
        const urls = await rpgGameSignedUrls(allPaths);
        setTileArtUrls(urls);
      }
    } catch (err: any) {
      toast.error(`Failed to load maps: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMaps(); }, [loadMaps]);

  // ── Load tile art images when URLs change ──
  useEffect(() => {
    if (!currentMap?.tileArt) return;
    const imgs: Record<number, HTMLImageElement> = {};
    let loaded = 0;
    const entries = Object.entries(currentMap.tileArt);
    if (entries.length === 0) return;

    for (const [tileKey, storagePath] of entries) {
      const url = tileArtUrls[storagePath];
      if (!url) continue;
      const tileType = TILE_TYPES.find(t => t.key === tileKey);
      if (!tileType) continue;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgs[tileType.id] = img;
        loaded++;
        if (loaded === entries.length) setTileArtImages({ ...imgs });
      };
      img.onerror = () => { loaded++; };
      img.src = url;
    }
  }, [currentMap?.tileArt, tileArtUrls]);

  // ── Save current map ──
  const handleSave = useCallback(async () => {
    if (!currentMap) return;
    setSaving(true);
    try {
      await rpgGameSaveEntity('map', currentMap.id, currentMap as any);
      toast.success(`Map "${currentMap.name}" saved`);
      setDirty(false);
      loadMaps();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [currentMap, loadMaps]);

  // ── Create new map ──
  const handleNew = useCallback((regionId?: RegionId) => {
    const m = newMapDefaults(undefined, regionId) as MapEntity;
    setCurrentMap(m);
    setDirty(true);
    setShowMapList(false);
    setPanOffset({ x: 0, y: 0 });
    undoStackRef.current = [];
    setUndoCount(0);
  }, []);

  // ── Load Thornhaven template ──
  const handleLoadThornhaven = useCallback(async () => {
    try {
      const { THORNHAVEN_MAP } = await import('../realm/thornhaven-map');
      const m: MapEntity = {
        id: 'thornhaven',
        type: 'map',
        name: THORNHAVEN_MAP.name,
        regionId: 'thornhaven',
        width: THORNHAVEN_MAP.width,
        height: THORNHAVEN_MAP.height,
        tiles: THORNHAVEN_MAP.tiles.map(row => [...row]),
        spawnX: THORNHAVEN_MAP.spawnX,
        spawnY: THORNHAVEN_MAP.spawnY,
        doors: (THORNHAVEN_MAP as any).doors || [],
        encounterSpiritIds: (THORNHAVEN_MAP as any).encounterSpiritIds || [],
        encounterRate: (THORNHAVEN_MAP as any).encounterRate ?? 0.15,
      };
      setCurrentMap(m);
      setDirty(true);
      setShowMapList(false);
      setPanOffset({ x: 0, y: 0 });
      undoStackRef.current = [];
      setUndoCount(0);
      toast.success('Loaded Thornhaven template');
    } catch (err: any) {
      toast.error(`Failed to load template: ${err.message}`);
    }
  }, []);

  // ── Select existing map ──
  const handleSelectMap = useCallback((m: MapEntity) => {
    setCurrentMap({ ...m, tiles: m.tiles.map(r => [...r]), doors: m.doors.map(d => ({ ...d })) });
    setDirty(false);
    setShowMapList(false);
    setPanOffset({ x: 0, y: 0 });
    undoStackRef.current = [];
    setUndoCount(0);
  }, []);

  // ── Delete map ──
  const handleDelete = useCallback(async () => {
    if (!currentMap) return;
    if (!window.confirm(`Delete map "${currentMap.name}"?`)) return;
    try {
      await rpgGameDeleteEntity('map', currentMap.id);
      toast.success('Map deleted');
      setCurrentMap(null);
      setDirty(false);
      loadMaps();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  }, [currentMap, loadMaps]);

  // ── Export JSON ──
  const handleExport = useCallback(() => {
    if (!currentMap) return;
    const json = JSON.stringify(currentMap, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentMap.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentMap]);

  // ── Import JSON ──
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.tiles || !data.width || !data.height) {
          toast.error('Invalid map JSON');
          return;
        }
        const m: MapEntity = {
          id: data.id || `map-${Date.now().toString(36)}`,
          type: 'map',
          name: data.name || 'Imported Map',
          regionId: data.regionId,
          width: data.width,
          height: data.height,
          tiles: data.tiles,
          spawnX: data.spawnX ?? Math.floor(data.width / 2),
          spawnY: data.spawnY ?? Math.floor(data.height / 2),
          doors: data.doors || [],
          encounterSpiritIds: data.encounterSpiritIds || [],
          encounterRate: data.encounterRate ?? 0.15,
          tileArt: data.tileArt,
        };
        setCurrentMap(m);
        setDirty(true);
        setPanOffset({ x: 0, y: 0 });
        toast.success('Map imported');
      } catch (err: any) {
        toast.error(`Import failed: ${err.message}`);
      }
    };
    input.click();
  }, []);

  // ── Tile art upload ──
  const handleTileArtUpload = useCallback(async (tileKey: string) => {
    if (!currentMap) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const storagePath = `maps/${currentMap.id}/tileart/${tileKey}.${file.name.split('.').pop()}`;
        const result = await rpgGameUpload(file, storagePath);
        if (!result.path) throw new Error('Upload returned no path');

        setCurrentMap(prev => {
          if (!prev) return prev;
          return { ...prev, tileArt: { ...(prev.tileArt || {}), [tileKey]: result.path } };
        });
        setDirty(true);

        // Get signed URL for immediate preview
        const urls = await rpgGameSignedUrls([result.path]);
        setTileArtUrls(prev => ({ ...prev, ...urls }));
        toast.success(`Tile art uploaded: ${tileKey}`);
      } catch (err: any) {
        toast.error(`Upload failed: ${err.message}`);
      }
    };
    input.click();
  }, [currentMap]);

  // ── Clear tile art ──
  const handleTileArtClear = useCallback((tileKey: string) => {
    if (!currentMap) return;
    setCurrentMap(prev => {
      if (!prev || !prev.tileArt) return prev;
      const newArt = { ...prev.tileArt };
      delete newArt[tileKey];
      return { ...prev, tileArt: Object.keys(newArt).length > 0 ? newArt : undefined };
    });
    // Clear the cached image
    const tileType = TILE_TYPES.find(t => t.key === tileKey);
    if (tileType) {
      setTileArtImages(prev => {
        const next = { ...prev };
        delete next[tileType.id];
        return next;
      });
    }
    setDirty(true);
    toast.success(`Tile art cleared: ${tileKey}`);
  }, [currentMap]);

  // ── Push undo ──
  const pushUndo = useCallback(() => {
    if (!currentMap) return;
    undoStackRef.current.push(currentMap.tiles.map(r => [...r]));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    setUndoCount(undoStackRef.current.length);
  }, [currentMap]);

  // ── Undo ──
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0 || !currentMap) return;
    const prev = undoStackRef.current.pop()!;
    setCurrentMap(m => m ? { ...m, tiles: prev } : m);
    setUndoCount(undoStackRef.current.length);
    setDirty(true);
  }, [currentMap]);

  // ── Apply tool at position ──
  const applyTool = useCallback((x: number, y: number, isStart: boolean) => {
    if (!currentMap) return;
    if (x < 0 || y < 0 || x >= currentMap.width || y >= currentMap.height) return;

    switch (tool) {
      case 'paint': {
        if (isStart) pushUndo();
        setCurrentMap(prev => {
          if (!prev || prev.tiles[y][x] === selectedTile) return prev;
          const newTiles = prev.tiles.map(r => [...r]);
          newTiles[y][x] = selectedTile;
          return { ...prev, tiles: newTiles };
        });
        setDirty(true);
        break;
      }
      case 'erase': {
        if (isStart) pushUndo();
        setCurrentMap(prev => {
          if (!prev || prev.tiles[y][x] === 0) return prev;
          const newTiles = prev.tiles.map(r => [...r]);
          newTiles[y][x] = 0; // grass
          return { ...prev, tiles: newTiles };
        });
        setDirty(true);
        break;
      }
      case 'fill': {
        if (!isStart) return;
        pushUndo();
        setCurrentMap(prev => {
          if (!prev) return prev;
          return { ...prev, tiles: floodFill(prev.tiles, x, y, selectedTile) };
        });
        setDirty(true);
        break;
      }
      case 'eyedropper': {
        if (!isStart) return;
        setSelectedTile(currentMap.tiles[y][x]);
        setTool('paint');
        break;
      }
      case 'spawn': {
        if (!isStart) return;
        setCurrentMap(prev => prev ? { ...prev, spawnX: x, spawnY: y } : prev);
        setDirty(true);
        toast.success(`Spawn set to (${x}, ${y})`);
        break;
      }
      case 'door': {
        if (!isStart) return;
        // If door already exists at position, remove it
        const existingIdx = currentMap.doors.findIndex(d => d.x === x && d.y === y);
        if (existingIdx >= 0) {
          setCurrentMap(prev => {
            if (!prev) return prev;
            const doors = [...prev.doors];
            doors.splice(existingIdx, 1);
            return { ...prev, doors };
          });
          toast.success(`Door removed at (${x}, ${y})`);
        } else {
          setCurrentMap(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              doors: [...prev.doors, { x, y, id: `door_${x}_${y}`, label: 'New Door' }],
            };
          });
          // Also set the tile to DOOR type
          setCurrentMap(prev => {
            if (!prev) return prev;
            const newTiles = prev.tiles.map(r => [...r]);
            newTiles[y][x] = 5; // DOOR
            return { ...prev, tiles: newTiles };
          });
          toast.success(`Door placed at (${x}, ${y})`);
        }
        setDirty(true);
        break;
      }
    }
  }, [currentMap, tool, selectedTile, pushUndo]);

  // ── Canvas coords from mouse event ──
  const getTilePos = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || !currentMap) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - panOffset.x;
    const my = e.clientY - rect.top - panOffset.y;
    const tx = Math.floor(mx / zoom);
    const ty = Math.floor(my / zoom);
    if (tx < 0 || ty < 0 || tx >= currentMap.width || ty >= currentMap.height) return null;
    return { x: tx, y: ty };
  }, [zoom, panOffset, currentMap]);

  // ── Mouse handlers ──
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button for pan
    if (e.button === 1) {
      e.preventDefault();
      middleDownRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
      return;
    }
    if (e.button !== 0) return;

    // Check for Alt+Click as eyedropper shortcut
    if (e.altKey) {
      const pos = getTilePos(e);
      if (pos && currentMap) {
        setSelectedTile(currentMap.tiles[pos.y][pos.x]);
        setTool('paint');
      }
      return;
    }

    setIsPainting(true);
    const pos = getTilePos(e);
    if (pos) applyTool(pos.x, pos.y, true);
  }, [getTilePos, applyTool, panOffset, currentMap]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    // Pan with middle mouse
    if (middleDownRef.current && panStartRef.current) {
      setPanOffset({
        x: panStartRef.current.ox + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.oy + (e.clientY - panStartRef.current.y),
      });
      return;
    }

    if (!isPainting) return;
    const pos = getTilePos(e);
    if (pos) applyTool(pos.x, pos.y, false);
  }, [isPainting, getTilePos, applyTool]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPainting(false);
    middleDownRef.current = false;
    panStartRef.current = null;
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'b': setTool('paint'); break;
        case 'e': setTool('erase'); break;
        case 'g': setTool('fill'); break;
        case 'i': setTool('eyedropper'); break;
        case 'd': setTool('door'); break;
        case '=':
        case '+': setZoom(z => Math.min(64, z + 4)); break;
        case '-': setZoom(z => Math.max(8, z - 4)); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleUndo, handleSave]);

  // ── Resize observer ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        if (w > 0 && h > 0) {
          setCanvasDims({ w, h });
        }
      }
    });
    obs.observe(el);
    // Immediate measurement + delayed fallback for layout settling
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setCanvasDims({ w, h });
    };
    measure();
    const timer = setTimeout(measure, 100);
    return () => { obs.disconnect(); clearTimeout(timer); };
  }, [currentMap]); // Re-attach when map changes (triggers layout shift)

  // ── Canvas rendering ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentMap || canvasDims.w === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDims.w * dpr;
    canvas.height = canvasDims.h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasDims.w, canvasDims.h);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);

    const { tiles, width, height } = currentMap;

    // Draw tiles
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tileId = tiles[row][col];
        const x = col * zoom;
        const y = row * zoom;

        // Check for tile art image
        const artImg = tileArtImages[tileId];
        if (artImg) {
          ctx.drawImage(artImg, x, y, zoom, zoom);
        } else {
          const tt = TILE_TYPES.find(t => t.id === tileId);
          ctx.fillStyle = tt?.color || '#111';
          ctx.fillRect(x, y, zoom, zoom);
        }
      }
    }

    // Grid
    if (showGrid && zoom >= 12) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      for (let row = 0; row <= height; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * zoom);
        ctx.lineTo(width * zoom, row * zoom);
        ctx.stroke();
      }
      for (let col = 0; col <= width; col++) {
        ctx.beginPath();
        ctx.moveTo(col * zoom, 0);
        ctx.lineTo(col * zoom, height * zoom);
        ctx.stroke();
      }
    }

    // Doors
    if (showDoors) {
      for (const door of currentMap.doors) {
        const dx = door.x * zoom;
        const dy = door.y * zoom;
        ctx.fillStyle = 'rgba(255,215,0,0.35)';
        ctx.fillRect(dx, dy, zoom, zoom);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(dx + 1, dy + 1, zoom - 2, zoom - 2);

        // Show linked indicator
        if (door.targetMapId) {
          ctx.fillStyle = '#00ff88';
          ctx.beginPath();
          ctx.arc(dx + zoom - 3, dy + 3, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        if (zoom >= 16) {
          ctx.fillStyle = '#ffd700';
          ctx.font = `${Math.min(9, zoom * 0.35)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(door.id.substring(0, 6), dx + zoom / 2, dy + zoom / 2 + 3);
        }
      }
    }

    // Spawn
    if (showSpawn) {
      const sx = currentMap.spawnX * zoom;
      const sy = currentMap.spawnY * zoom;
      ctx.fillStyle = 'rgba(255,50,50,0.4)';
      ctx.fillRect(sx, sy, zoom, zoom);
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, zoom - 2, zoom - 2);
    }

    // Border
    ctx.strokeStyle = 'rgba(212,164,74,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width * zoom, height * zoom);

    ctx.restore();
  }, [currentMap, zoom, panOffset, showGrid, showDoors, showSpawn, canvasDims, tileArtImages]);

  // ── Update map property helper ──
  const updateProp = useCallback(<K extends keyof MapEntity>(key: K, value: MapEntity[K]) => {
    setCurrentMap(prev => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }, []);

  // ── Resize map ──
  const handleResize = useCallback((newW: number, newH: number) => {
    if (!currentMap) return;
    pushUndo();
    const oldTiles = currentMap.tiles;
    const newTiles = Array.from({ length: newH }, (_, r) =>
      Array.from({ length: newW }, (_, c) =>
        r < oldTiles.length && c < (oldTiles[0]?.length || 0) ? oldTiles[r][c] : 0
      )
    );
    setCurrentMap(prev => prev ? {
      ...prev,
      width: newW,
      height: newH,
      tiles: newTiles,
      spawnX: Math.min(prev.spawnX, newW - 1),
      spawnY: Math.min(prev.spawnY, newH - 1),
      doors: prev.doors.filter(d => d.x < newW && d.y < newH),
    } : prev);
    setDirty(true);
  }, [currentMap, pushUndo]);

  // ── Cursor style ──
  const cursorStyle = useMemo(() => {
    switch (tool) {
      case 'paint': return 'crosshair';
      case 'erase': return 'crosshair';
      case 'fill': return 'crosshair';
      case 'eyedropper': return 'copy';
      case 'door': return 'cell';
      case 'spawn': return 'cell';
      default: return 'default';
    }
  }, [tool]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  // ── No map selected — show hierarchical browser or region overview ──
  if (!currentMap) {
    if (viewMode === 'overview' && overviewRegionId) {
      return (
        <div className="space-y-3">
          <button
            onClick={() => { setViewMode('browser'); setOverviewRegionId(null); }}
            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-white"
          >
            <ChevronRight className="w-3 h-3 rotate-180" /> Back to Browser
          </button>
          <RegionOverview
            regionId={overviewRegionId}
            maps={maps}
            onSelectMap={handleSelectMap}
            onNewMap={(rid) => handleNew(rid)}
          />
        </div>
      );
    }

    return (
      <MapBrowser
        maps={maps}
        onSelectMap={handleSelectMap}
        onNewMap={(rid) => handleNew(rid)}
        onShowOverview={(rid) => { setOverviewRegionId(rid); setViewMode('overview'); }}
      />
    );
  }

  // ── Map Editor UI ──
  const currentRegion = REGIONS.find(r => r.id === currentMap.regionId);

  return (
    <div className="flex flex-col gap-3 -mx-1 sm:-mx-2">
      {/* ── Top Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        {/* Map name + region badge */}
        <button
          onClick={() => setShowMapList(!showMapList)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-amber-500/30"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-white max-w-[120px] truncate">{currentMap.name}</span>
          {currentRegion && (
            <span className="text-[9px] text-gray-500">{currentRegion.emoji}</span>
          )}
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Tools */}
        <div className="flex items-center gap-0.5 bg-gray-800/60 rounded-lg p-0.5">
          {TOOLS.map(t => {
            const Icon = t.icon;
            const isActive = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={`${t.label} (${t.hotkey})`}
                className={`p-1.5 rounded-md transition-all ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-gray-700" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(8, z - 4))} className="p-1 rounded text-gray-500 hover:text-white">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-gray-500 w-8 text-center">{zoom}px</span>
          <button onClick={() => setZoom(z => Math.min(64, z + 4))} className="p-1 rounded text-gray-500 hover:text-white">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-700" />

        {/* Toggles */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle grid"
          className={`p-1.5 rounded-md ${showGrid ? 'text-amber-400' : 'text-gray-600'}`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowDoors(!showDoors)}
          title="Toggle doors"
          className={`p-1.5 rounded-md ${showDoors ? 'text-amber-400' : 'text-gray-600'}`}
        >
          <DoorOpen className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowSpawn(!showSpawn)}
          title="Toggle spawn"
          className={`p-1.5 rounded-md ${showSpawn ? 'text-red-400' : 'text-gray-600'}`}
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={undoCount === 0}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-md text-gray-500 hover:text-white disabled:opacity-30"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Properties */}
        <button
          onClick={() => setShowProps(!showProps)}
          className={`p-1.5 rounded-md ${showProps ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500 hover:text-white'}`}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Thornhaven template */}
        <button
          onClick={handleLoadThornhaven}
          title="Load Thornhaven template"
          className="p-1.5 rounded-md text-gray-500 hover:text-white"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Import */}
        <button
          onClick={handleImport}
          title="Import JSON"
          className="p-1.5 rounded-md text-gray-500 hover:text-white"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          title="Export JSON"
          className="p-1.5 rounded-md text-gray-500 hover:text-white"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          title="Delete map"
          className="p-1.5 rounded-md text-gray-500 hover:text-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-30 transition-all"
          style={dirty ? { background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' } : { background: 'transparent', color: '#6b7280' }}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>

        {/* Back */}
        <button
          onClick={() => { setCurrentMap(null); setDirty(false); }}
          className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-gray-500 hover:text-white rounded-lg hover:bg-gray-800"
        >
          <X className="w-3 h-3" />
          Close
        </button>
      </div>

      {/* ── Map List Dropdown ── */}
      {showMapList && (
        <div className="mx-1 p-2 bg-gray-800 border border-gray-700 rounded-xl space-y-1 max-h-[300px] overflow-y-auto">
          <button
            onClick={() => { handleNew(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-gray-400 hover:bg-gray-700/50"
          >
            <Plus className="w-3 h-3" /> New blank map
          </button>
          <button
            onClick={() => { handleLoadThornhaven(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-gray-400 hover:bg-gray-700/50"
          >
            <Copy className="w-3 h-3" /> Thornhaven template
          </button>

          {/* Group by region */}
          {(() => {
            const byRegion: Record<string, MapEntity[]> = {};
            const unassigned: MapEntity[] = [];
            for (const m of maps) {
              if (m.regionId) {
                if (!byRegion[m.regionId]) byRegion[m.regionId] = [];
                byRegion[m.regionId].push(m);
              } else {
                unassigned.push(m);
              }
            }

            return (
              <>
                {Object.entries(byRegion).map(([rid, regionMaps]) => {
                  const region = REGIONS.find(r => r.id === rid);
                  return (
                    <div key={rid}>
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider px-3 pt-2 pb-1">
                        {region?.emoji} {region?.label || rid}
                      </p>
                      {regionMaps.map(m => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectMap(m)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs hover:bg-gray-700/50 ${
                            m.id === currentMap.id ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400'
                          }`}
                        >
                          <Layers className="w-3 h-3" /> {m.name}
                          <span className="text-[9px] text-gray-600 ml-auto">{m.width}x{m.height}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {unassigned.length > 0 && (
                  <div>
                    <p className="text-[9px] text-orange-400 font-bold uppercase tracking-wider px-3 pt-2 pb-1">
                      Unassigned
                    </p>
                    {unassigned.map(m => (
                      <button
                        key={m.id}
                        onClick={() => handleSelectMap(m)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs hover:bg-gray-700/50 ${
                          m.id === currentMap.id ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400'
                        }`}
                      >
                        <Layers className="w-3 h-3" /> {m.name}
                        <span className="text-[9px] text-gray-600 ml-auto">{m.width}x{m.height}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Main Content: Palette + Canvas + Properties ── */}
      <div className="flex gap-2 px-1" style={{ height: 560 }}>
        {/* ── Left: Tile Palette ── */}
        <div className="w-[100px] shrink-0 space-y-1 overflow-y-auto" style={{ maxHeight: 560 }}>
          <p className="text-[9px] text-gray-600 px-1 mb-1 font-bold uppercase tracking-wider">Tiles</p>
          {TILE_TYPES.map(t => {
            const isSelected = selectedTile === t.id;
            const hasArt = currentMap.tileArt?.[t.key];
            const artUrl = hasArt ? tileArtUrls[hasArt] : null;

            return (
              <div key={t.id} className="relative group">
                <button
                  onClick={() => { setSelectedTile(t.id); setTool('paint'); }}
                  className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border border-amber-500/40'
                      : 'bg-gray-800/30 border border-transparent hover:border-gray-700'
                  }`}
                >
                  {/* Color/art swatch */}
                  <div
                    className="w-6 h-6 rounded shrink-0 border border-gray-700/50 overflow-hidden"
                    style={{ background: artUrl ? undefined : t.color }}
                  >
                    {artUrl && (
                      <img src={artUrl} alt="" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[9px] font-medium truncate ${isSelected ? 'text-amber-300' : 'text-gray-400'}`}>
                      {t.label}
                    </p>
                    <p className="text-[7px] text-gray-600">
                      {t.walkable ? 'walk' : 'block'}
                    </p>
                  </div>
                </button>

                {/* Upload / Clear art buttons on hover */}
                <div className="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleTileArtUpload(t.key)}
                    className="p-0.5 rounded bg-gray-900/80 text-gray-500 hover:text-amber-400"
                    title={`Upload art for ${t.label}`}
                  >
                    <Upload className="w-2.5 h-2.5" />
                  </button>
                  {hasArt && (
                    <button
                      onClick={() => handleTileArtClear(t.key)}
                      className="p-0.5 rounded bg-gray-900/80 text-gray-500 hover:text-red-400"
                      title={`Clear art for ${t.label}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Selected tile info */}
          <div className="mt-3 pt-2 border-t border-gray-800">
            <p className="text-[8px] text-gray-600 px-1">Selected</p>
            <div className="flex items-center gap-1.5 px-1 py-1">
              <div className="w-5 h-5 rounded border border-gray-700" style={{ background: TILE_TYPES[selectedTile]?.color }} />
              <span className="text-[10px] text-amber-400 font-medium">{TILE_TYPES[selectedTile]?.label}</span>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="mt-2 pt-2 border-t border-gray-800 px-1 space-y-0.5">
            <p className="text-[8px] text-gray-600 font-bold uppercase tracking-wider mb-1">Keys</p>
            {TOOLS.map(t => (
              <p key={t.id} className="text-[8px] text-gray-600">
                <span className="text-gray-500 font-mono">{t.hotkey}</span> {t.label}
              </p>
            ))}
            <p className="text-[8px] text-gray-600"><span className="text-gray-500 font-mono">Alt</span>+Click = Pick</p>
            <p className="text-[8px] text-gray-600"><span className="text-gray-500 font-mono">Ctrl+Z</span> Undo</p>
            <p className="text-[8px] text-gray-600"><span className="text-gray-500 font-mono">+/-</span> Zoom</p>
            <p className="text-[8px] text-gray-600"><span className="text-gray-500 font-mono">MMB</span> Pan</p>
          </div>
        </div>

        {/* ── Center: Canvas ── */}
        <div className="flex-1 min-w-0 relative">
          <div
            ref={containerRef}
            className="absolute inset-0 overflow-hidden rounded-xl"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(212,164,74,0.15)',
              cursor: cursorStyle,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onContextMenu={e => e.preventDefault()}
            />

            {/* Coords overlay */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-gray-900/80 text-[9px] text-gray-500 pointer-events-none">
              {currentMap.width}x{currentMap.height} | Zoom: {zoom}px | Spawn: ({currentMap.spawnX},{currentMap.spawnY})
              {currentRegion && <span className="text-amber-400 ml-2">{currentRegion.emoji} {currentRegion.label}</span>}
              {dirty && <span className="text-amber-400 ml-2">* unsaved</span>}
            </div>
          </div>
        </div>

        {/* ── Right: Properties Panel ── */}
        {showProps && (
          <div className="w-[220px] shrink-0 overflow-y-auto space-y-3" style={{ maxHeight: 600 }}>
            <p className="text-[9px] text-gray-600 px-1 font-bold uppercase tracking-wider">Properties</p>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 px-1">Map Name</label>
              <input
                value={currentMap.name}
                onChange={e => updateProp('name', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white"
              />
            </div>

            {/* ID */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 px-1">Map ID</label>
              <input
                value={currentMap.id}
                onChange={e => updateProp('id', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white font-mono"
              />
            </div>

            {/* Region */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 px-1">Region / State</label>
              <select
                value={currentMap.regionId || ''}
                onChange={e => updateProp('regionId', (e.target.value || undefined) as RegionId | undefined)}
                className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white"
              >
                <option value="">-- unassigned --</option>
                {CONTINENTS.map(continent => (
                  <optgroup key={continent} label={continent}>
                    {REGIONS.filter(r => r.continent === continent).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.emoji} {r.label} (Lv{r.levelRange})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {currentRegion && (
                <p className="text-[8px] text-gray-600 px-1">
                  {currentRegion.continent} | Level {currentRegion.levelRange}
                </p>
              )}
            </div>

            {/* Dimensions */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 px-1">Dimensions</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentMap.width}
                  onChange={e => handleResize(Math.max(4, Math.min(128, parseInt(e.target.value) || 4)), currentMap.height)}
                  className="w-16 px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white text-center"
                  min={4} max={128}
                />
                <span className="text-[10px] text-gray-600">x</span>
                <input
                  type="number"
                  value={currentMap.height}
                  onChange={e => handleResize(currentMap.width, Math.max(4, Math.min(128, parseInt(e.target.value) || 4)))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white text-center"
                  min={4} max={128}
                />
              </div>
            </div>

            {/* Spawn */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 px-1">Spawn Point</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentMap.spawnX}
                  onChange={e => updateProp('spawnX', Math.max(0, Math.min(currentMap.width - 1, parseInt(e.target.value) || 0)))}
                  className="w-14 px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white text-center"
                />
                <span className="text-[10px] text-gray-600">,</span>
                <input
                  type="number"
                  value={currentMap.spawnY}
                  onChange={e => updateProp('spawnY', Math.max(0, Math.min(currentMap.height - 1, parseInt(e.target.value) || 0)))}
                  className="w-14 px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white text-center"
                />
                <button
                  onClick={() => setTool('spawn')}
                  title="Click on map to set spawn"
                  className={`p-1 rounded ${tool === 'spawn' ? 'text-red-400 bg-red-500/10' : 'text-gray-500 hover:text-white'}`}
                >
                  <Crosshair className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Encounter Rate */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 px-1">Encounter Rate</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={Math.round(currentMap.encounterRate * 100)}
                  onChange={e => updateProp('encounterRate', parseInt(e.target.value) / 100)}
                  className="flex-1"
                />
                <span className="text-[10px] text-white w-8 text-right">
                  {Math.round(currentMap.encounterRate * 100)}%
                </span>
              </div>
            </div>

            {/* Encounter Spirits */}
            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 px-1">Encounter Spirit IDs</label>
              <textarea
                value={currentMap.encounterSpiritIds.join('\n')}
                onChange={e => updateProp('encounterSpiritIds', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                placeholder={"spirit-001\nspirit-002"}
                className="w-full px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white font-mono resize-none"
                rows={3}
              />
            </div>

            {/* Doors */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] text-gray-500">Doors ({currentMap.doors.length})</label>
                <button
                  onClick={() => setTool('door')}
                  className={`text-[8px] px-1.5 py-0.5 rounded ${tool === 'door' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500 hover:text-white'}`}
                >
                  + Add
                </button>
              </div>
              <div className="space-y-1">
                {currentMap.doors.map((door, i) => (
                  <DoorEditInline
                    key={`${door.x}-${door.y}`}
                    door={door}
                    allMaps={maps}
                    onChange={d => {
                      setCurrentMap(prev => {
                        if (!prev) return prev;
                        const doors = [...prev.doors];
                        doors[i] = d;
                        return { ...prev, doors };
                      });
                      setDirty(true);
                    }}
                    onDelete={() => {
                      setCurrentMap(prev => {
                        if (!prev) return prev;
                        const doors = [...prev.doors];
                        doors.splice(i, 1);
                        return { ...prev, doors };
                      });
                      setDirty(true);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="pt-2 border-t border-gray-800 px-1 space-y-0.5">
              <p className="text-[8px] text-gray-600">
                Tile count: {currentMap.width * currentMap.height}
              </p>
              <p className="text-[8px] text-gray-600">
                Walkable: {currentMap.tiles.flat().filter(t => TILE_TYPES.find(tt => tt.id === t)?.walkable).length}
              </p>
              <p className="text-[8px] text-gray-600">
                Tall grass: {currentMap.tiles.flat().filter(t => t === 6).length}
              </p>
              <p className="text-[8px] text-gray-600">
                Linked doors: {currentMap.doors.filter(d => d.targetMapId).length} / {currentMap.doors.length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
