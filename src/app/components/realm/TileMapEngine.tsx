/**
 * TileMapEngine.tsx — Canvas-based tile map for Foxy Adventure quest mode.
 *
 * Features:
 * - 2D tile map rendering on <canvas>
 * - Camera follows player (centered)
 * - Virtual joystick: press anywhere & drag to move (Pokémon-style)
 * - Bigger player + fox sprites (~1.6x, Pokémon proportions)
 * - Fox companion follows player with 1-step delay
 * - Collision detection (trees, water, buildings)
 * - Wild encounter triggers on tall grass tiles
 * - Building interaction triggers (doors)
 * - Smooth movement animation via requestAnimationFrame
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

// ── Tile Types ──
export const TILE = {
  GRASS: 0,
  PATH: 1,
  TREE: 2,
  WATER: 3,
  WALL: 4,
  DOOR: 5,
  TALL_GRASS: 6,
  NPC: 7,
  BRIDGE: 8,
  FLOWER: 9,
  FENCE: 10,
  SIGN: 11,
} as const;

export type TileType = (typeof TILE)[keyof typeof TILE];

// ── Direction ──
export type Direction = 'up' | 'down' | 'left' | 'right';

// ── Door / interaction metadata ──
export interface DoorDef {
  x: number;
  y: number;
  id: string;
  label: string;
}

// ── Map Definition ──
export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: TileType[][];
  spawnX: number;
  spawnY: number;
  doors: DoorDef[];
  encounterSpiritIds: string[];
  encounterRate: number;
}

// ── Tile Colors (dark-fantasy palette) ──
const TILE_COLORS: Record<number, { fill: string; stroke?: string; detail?: string }> = {
  [TILE.GRASS]:      { fill: '#1a2e1a', stroke: '#152812', detail: '#1e3420' },
  [TILE.PATH]:       { fill: '#3a2f20', stroke: '#2e2518', detail: '#453828' },
  [TILE.TREE]:       { fill: '#0f1f0f', stroke: '#0a160a', detail: '#2d5a2d' },
  [TILE.WATER]:      { fill: '#0a1928', stroke: '#071420', detail: '#1a3a5a' },
  [TILE.WALL]:       { fill: '#2a2520', stroke: '#1e1a16', detail: '#3a3530' },
  [TILE.DOOR]:       { fill: '#4a3520', stroke: '#3a2a18', detail: '#8B6914' },
  [TILE.TALL_GRASS]: { fill: '#1a3a1a', stroke: '#153012', detail: '#2a5a2a' },
  [TILE.NPC]:        { fill: '#3a2f20', stroke: '#2e2518', detail: '#d4a44a' },
  [TILE.BRIDGE]:     { fill: '#5a4530', stroke: '#4a3a28', detail: '#6a5540' },
  [TILE.FLOWER]:     { fill: '#1a2e1a', stroke: '#152812', detail: '#d84a8a' },
  [TILE.FENCE]:      { fill: '#1a2e1a', stroke: '#3a3020', detail: '#5a4a30' },
  [TILE.SIGN]:       { fill: '#3a2f20', stroke: '#2e2518', detail: '#b89050' },
};

// ── Walkable tiles ──
const WALKABLE = new Set([TILE.GRASS, TILE.PATH, TILE.TALL_GRASS, TILE.DOOR, TILE.NPC, TILE.BRIDGE, TILE.FLOWER, TILE.SIGN]);

export interface Position { x: number; y: number; }

interface TileMapEngineProps {
  map: MapDef;
  tileSize?: number;
  onEncounter: (spiritId: string) => void;
  onDoorInteract: (door: DoorDef) => void;
  onPlayerMove?: (pos: Position) => void;
  paused?: boolean;
  /** Pre-loaded spritesheet Image (3 cols × 4 rows). Falls back to procedural if null. */
  playerSprite?: HTMLImageElement | null;
  foxSprite?: HTMLImageElement | null;
  /** Per-tile-type uploaded artwork images. Key = tile id (0-11). */
  tileArtImages?: Record<number, HTMLImageElement>;
}

// Joystick dead-zone in px
const JOY_DEADZONE = 18;
// Continuous move interval (ms)
const JOY_REPEAT = 170;

export function TileMapEngine({
  map,
  tileSize = 32,
  onEncounter,
  onDoorInteract,
  onPlayerMove,
  paused = false,
  playerSprite = null,
  foxSprite = null,
  tileArtImages,
}: TileMapEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Player state
  const playerRef = useRef<Position>({ x: map.spawnX, y: map.spawnY });
  const playerDirRef = useRef<Direction>('down');
  const foxRef = useRef<Position>({ x: map.spawnX, y: map.spawnY - 1 < 0 ? map.spawnY : map.spawnY });
  const foxTrailRef = useRef<Position[]>([{ x: map.spawnX, y: map.spawnY }]);

  // Animation state
  const isMovingRef = useRef(false);
  const moveProgressRef = useRef(0);
  const moveDirRef = useRef<Direction>('down');
  const prevPosRef = useRef<Position>({ x: map.spawnX, y: map.spawnY });
  const stepCountRef = useRef(0);

  // Interaction cooldown
  const interactCooldownRef = useRef(false);

  // Door proximity state
  const [nearbyDoor, setNearbyDoor] = useState<DoorDef | null>(null);

  // Force re-render trigger
  const [, setRenderTick] = useState(0);

  // ── Virtual joystick state ──
  const joyOriginRef = useRef<{ x: number; y: number } | null>(null);
  const joyDirRef = useRef<Direction | null>(null);
  const joyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [joyVisual, setJoyVisual] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    obs.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // Check if tile is walkable
  const isWalkable = useCallback((x: number, y: number) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    return WALKABLE.has(map.tiles[y][x]);
  }, [map]);

  // Get door at position
  const getDoorAt = useCallback((x: number, y: number): DoorDef | undefined => {
    return map.doors.find(d => d.x === x && d.y === y);
  }, [map.doors]);

  // Move player
  const movePlayer = useCallback((dir: Direction) => {
    if (paused || isMovingRef.current) return;

    const pos = playerRef.current;
    let nx = pos.x, ny = pos.y;
    if (dir === 'up') ny--;
    else if (dir === 'down') ny++;
    else if (dir === 'left') nx--;
    else if (dir === 'right') nx++;

    playerDirRef.current = dir;

    if (!isWalkable(nx, ny)) {
      setRenderTick(t => t + 1);
      return;
    }

    // Start move animation
    prevPosRef.current = { ...pos };
    moveDirRef.current = dir;
    isMovingRef.current = true;
    moveProgressRef.current = 0;

    // Update fox trail
    foxTrailRef.current.push({ ...pos });
    if (foxTrailRef.current.length > 2) {
      const oldPos = foxTrailRef.current.shift()!;
      foxRef.current = oldPos;
    }

    playerRef.current = { x: nx, y: ny };
    stepCountRef.current++;
    onPlayerMove?.({ x: nx, y: ny });

    // Check for door interaction
    const door = getDoorAt(nx, ny);
    if (door) {
      setNearbyDoor(door);
    } else {
      setNearbyDoor(null);
    }

    // Check for wild encounter on tall grass
    const tile = map.tiles[ny][nx];
    if (tile === TILE.TALL_GRASS) {
      const roll = Math.random();
      if (roll < map.encounterRate) {
        setTimeout(() => {
          const spiritIdx = Math.floor(Math.random() * map.encounterSpiritIds.length);
          onEncounter(map.encounterSpiritIds[spiritIdx]);
        }, 300);
      }
    }
  }, [paused, isWalkable, getDoorAt, map, onEncounter, onPlayerMove]);

  // Handle door interaction
  const handleDoorInteract = useCallback(() => {
    if (!nearbyDoor || interactCooldownRef.current) return;
    interactCooldownRef.current = true;
    onDoorInteract(nearbyDoor);
    setTimeout(() => { interactCooldownRef.current = false; }, 1000);
  }, [nearbyDoor, onDoorInteract]);

  // ── Stop joystick ──
  const stopJoy = useCallback(() => {
    joyOriginRef.current = null;
    joyDirRef.current = null;
    setJoyVisual(null);
    if (joyIntervalRef.current) {
      clearInterval(joyIntervalRef.current);
      joyIntervalRef.current = null;
    }
  }, []);

  // ── Derive direction from dx/dy ──
  const dirFromDelta = useCallback((dx: number, dy: number): Direction | null => {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < JOY_DEADZONE) return null;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }, []);

  // ── Start continuous move in direction ──
  const startContinuousMove = useCallback((dir: Direction) => {
    if (joyDirRef.current === dir) return; // already going this way
    joyDirRef.current = dir;
    // Clear old interval
    if (joyIntervalRef.current) clearInterval(joyIntervalRef.current);
    // Immediate first step
    movePlayer(dir);
    // Repeat
    joyIntervalRef.current = setInterval(() => movePlayer(dir), JOY_REPEAT);
  }, [movePlayer]);

  // ── Touch handlers (virtual joystick — press anywhere) ──
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (paused) return;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    joyOriginRef.current = { x, y };
    setJoyVisual({ ox: x, oy: y, dx: 0, dy: 0 });
  }, [paused]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (paused || !joyOriginRef.current) return;
    e.preventDefault();
    const origin = joyOriginRef.current;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;

    // Clamp visual thumb
    const maxR = 40;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDx = dist > maxR ? (dx / dist) * maxR : dx;
    const clampedDy = dist > maxR ? (dy / dist) * maxR : dy;
    setJoyVisual({ ox: origin.x, oy: origin.y, dx: clampedDx, dy: clampedDy });

    const dir = dirFromDelta(dx, dy);
    if (dir) {
      startContinuousMove(dir);
    } else {
      // Back inside dead zone — stop
      joyDirRef.current = null;
      if (joyIntervalRef.current) {
        clearInterval(joyIntervalRef.current);
        joyIntervalRef.current = null;
      }
    }
  }, [paused, dirFromDelta, startContinuousMove]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // If it was a quick tap without drag, try door interact
    if (joyOriginRef.current && joyDirRef.current === null) {
      handleDoorInteract();
    }
    stopJoy();
  }, [stopJoy, handleDoorInteract]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (paused) return;
      const dirMap: Record<string, Direction> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right',
      };
      const dir = dirMap[e.key];
      if (dir) {
        e.preventDefault();
        movePlayer(dir);
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDoorInteract();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [movePlayer, handleDoorInteract, paused]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (joyIntervalRef.current) clearInterval(joyIntervalRef.current);
    };
  }, []);

  // ── Canvas Rendering ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0 || dims.h === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    let lastTime = 0;
    const MOVE_DURATION = 150;

    // Sprite scale factor — makes player & fox big like Pokémon
    const S = 1.6;
    const half = tileSize / 2;

    // ── Spritesheet helpers ──
    // Layout: 3 cols (left-step, stand, right-step) × 4 rows (down, left, right, up)
    const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
    // Walk cycle: 0→1→2→1 (left-step, stand, right-step, stand)
    const WALK_CYCLE = [0, 1, 2, 1];

    /** Draw a spritesheet character on the canvas */
    function drawSprite(
      img: HTMLImageElement,
      cx: number, cy: number,       // center position on canvas
      dir: Direction,
      step: number,                  // total steps taken
      moving: boolean,
      drawSize: number,              // how big to draw on canvas (e.g. tileSize * 1.6)
    ) {
      const cellW = img.width / 3;
      const cellH = img.height / 4;
      const row = DIR_ROW[dir];
      const col = moving ? WALK_CYCLE[step % 4] : 1; // standing = middle frame
      const sx = col * cellW;
      const sy = row * cellH;

      // Draw shadow first
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + drawSize * 0.42, drawSize * 0.35, drawSize * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Disable image smoothing for pixel art
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        sx, sy, cellW, cellH,        // source rect
        cx - drawSize / 2,           // dest x
        cy - drawSize / 2,           // dest y
        drawSize, drawSize,          // dest size (square — assumes cells are square or close)
      );
      ctx.imageSmoothingEnabled = true;
    }

    // Keep refs to sprites in closure for render loop
    const pSprite = playerSprite;
    const fSprite = foxSprite;
    const tArtImgs = tileArtImages;

    const render = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;

      // Update move animation
      if (isMovingRef.current) {
        moveProgressRef.current += dt / MOVE_DURATION;
        if (moveProgressRef.current >= 1) {
          moveProgressRef.current = 1;
          isMovingRef.current = false;
        }
      }

      const player = playerRef.current;
      const prev = prevPosRef.current;
      const progress = isMovingRef.current ? moveProgressRef.current : 1;

      const interpX = prev.x + (player.x - prev.x) * progress;
      const interpY = prev.y + (player.y - prev.y) * progress;

      // Camera center on player
      const camX = interpX * tileSize - dims.w / 2 + half;
      const camY = interpY * tileSize - dims.h / 2 + half;

      // Clear
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, dims.w, dims.h);

      // Visible tile range
      const startCol = Math.max(0, Math.floor(camX / tileSize) - 1);
      const endCol = Math.min(map.width, Math.ceil((camX + dims.w) / tileSize) + 1);
      const startRow = Math.max(0, Math.floor(camY / tileSize) - 1);
      const endRow = Math.min(map.height, Math.ceil((camY + dims.h) / tileSize) + 1);

      // ── Draw tiles ──
      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          const tile = map.tiles[row][col];
          const tc = TILE_COLORS[tile] || TILE_COLORS[0];
          const sx = col * tileSize - camX;
          const sy = row * tileSize - camY;

          // Check for uploaded tile art image first
          const tileArtImg = tArtImgs?.[tile];
          if (tileArtImg) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tileArtImg, sx, sy, tileSize, tileSize);
            ctx.imageSmoothingEnabled = true;
          } else {
            // Procedural tile drawing fallback
            ctx.fillStyle = tc.fill;
            ctx.fillRect(sx, sy, tileSize, tileSize);

            if (tile === TILE.TREE) {
              ctx.fillStyle = '#2a1a0a';
              ctx.fillRect(sx + 12, sy + 18, 8, 14);
              ctx.fillStyle = tc.detail!;
              ctx.beginPath();
              ctx.arc(sx + half, sy + 14, 12, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#3a7a3a';
              ctx.beginPath();
              ctx.arc(sx + 14, sy + 11, 5, 0, Math.PI * 2);
              ctx.fill();
            } else if (tile === TILE.WATER) {
              const shimmer = Math.sin(time * 0.002 + col * 0.5 + row * 0.3) * 0.15 + 0.85;
              ctx.fillStyle = `rgba(26, 58, 90, ${shimmer})`;
              ctx.fillRect(sx + 2, sy + 2, tileSize - 4, tileSize - 4);
              ctx.strokeStyle = `rgba(60, 120, 180, ${shimmer * 0.4})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              const waveOffset = Math.sin(time * 0.003 + col) * 3;
              ctx.moveTo(sx + 4, sy + 12 + waveOffset);
              ctx.quadraticCurveTo(sx + half, sy + 8 + waveOffset, sx + 28, sy + 12 + waveOffset);
              ctx.moveTo(sx + 4, sy + 22 + waveOffset);
              ctx.quadraticCurveTo(sx + half, sy + 18 + waveOffset, sx + 28, sy + 22 + waveOffset);
              ctx.stroke();
            } else if (tile === TILE.TALL_GRASS) {
              const sway = Math.sin(time * 0.002 + col * 0.7 + row * 0.5) * 2;
              ctx.strokeStyle = tc.detail!;
              ctx.lineWidth = 1.5;
              for (let i = 0; i < 5; i++) {
                const gx = sx + 4 + i * 6;
                const gy = sy + tileSize - 4;
                ctx.beginPath();
                ctx.moveTo(gx, gy);
                ctx.quadraticCurveTo(gx + sway + i * 0.3, gy - 14, gx + sway, gy - 20);
                ctx.stroke();
              }
            } else if (tile === TILE.DOOR) {
              ctx.fillStyle = '#6a4a20';
              ctx.fillRect(sx + 6, sy + 2, 20, 28);
              ctx.fillStyle = tc.detail!;
              ctx.fillRect(sx + 8, sy + 4, 16, 24);
              ctx.fillStyle = '#ffd700';
              ctx.beginPath();
              ctx.arc(sx + 20, sy + 18, 2, 0, Math.PI * 2);
              ctx.fill();
            } else if (tile === TILE.WALL) {
              ctx.strokeStyle = tc.detail!;
              ctx.lineWidth = 0.5;
              for (let by = 0; by < 4; by++) {
                const brickY = sy + by * 8;
                ctx.beginPath();
                ctx.moveTo(sx, brickY);
                ctx.lineTo(sx + tileSize, brickY);
                ctx.stroke();
                const offset = by % 2 === 0 ? 0 : tileSize / 2;
                ctx.beginPath();
                ctx.moveTo(sx + offset, brickY);
                ctx.lineTo(sx + offset, brickY + 8);
                ctx.stroke();
              }
            } else if (tile === TILE.FLOWER) {
              ctx.fillStyle = tc.detail!;
              ctx.beginPath(); ctx.arc(sx + 8, sy + 10, 3, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#e8a0c0';
              ctx.beginPath(); ctx.arc(sx + 22, sy + 20, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffd700';
              ctx.beginPath(); ctx.arc(sx + 14, sy + 26, 2, 0, Math.PI * 2); ctx.fill();
            } else if (tile === TILE.FENCE) {
              ctx.fillStyle = tc.detail!;
              ctx.fillRect(sx + 2, sy + 8, 4, 24);
              ctx.fillRect(sx + 26, sy + 8, 4, 24);
              ctx.fillRect(sx, sy + 12, tileSize, 3);
              ctx.fillRect(sx, sy + 22, tileSize, 3);
            } else if (tile === TILE.SIGN) {
              ctx.fillStyle = '#5a4020';
              ctx.fillRect(sx + 14, sy + 16, 4, 16);
              ctx.fillStyle = tc.detail!;
              ctx.fillRect(sx + 4, sy + 6, 24, 14);
              ctx.strokeStyle = '#8a7040';
              ctx.lineWidth = 1;
              ctx.strokeRect(sx + 4, sy + 6, 24, 14);
            } else if (tile === TILE.NPC) {
              ctx.fillStyle = tc.detail!;
              ctx.beginPath(); ctx.arc(sx + half, sy + 12, 3, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffd700';
              ctx.font = 'bold 10px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('!', sx + half, sy + 8);
            } else if (tile === TILE.PATH) {
              ctx.fillStyle = 'rgba(80,65,45,0.3)';
              for (let p = 0; p < 3; p++) {
                const px = sx + 6 + ((col * 7 + p * 11) % 20);
                const py = sy + 5 + ((row * 5 + p * 13) % 22);
                ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
              }
            } else if (tile === TILE.BRIDGE) {
              ctx.fillStyle = tc.detail!;
              for (let i = 0; i < 4; i++) ctx.fillRect(sx + 2, sy + i * 8 + 1, tileSize - 4, 6);
              ctx.fillStyle = '#4a3520';
              ctx.fillRect(sx, sy, 3, tileSize);
              ctx.fillRect(sx + tileSize - 3, sy, 3, tileSize);
            }

            // Grid lines (subtle)
            if (tc.stroke) {
              ctx.strokeStyle = tc.stroke;
              ctx.lineWidth = 0.5;
              ctx.strokeRect(sx, sy, tileSize, tileSize);
            }
          }
        }
      }

      // ── Draw Fox companion (scaled up) ──
      const fox = foxRef.current;
      const fcx = fox.x * tileSize - camX + half;
      const fcy = fox.y * tileSize - camY + half;

      if (fSprite) {
        // Spritesheet fox — derive direction from fox→player vector
        const fdx = player.x - fox.x;
        const fdy = player.y - fox.y;
        const foxDir: Direction = Math.abs(fdx) > Math.abs(fdy)
          ? (fdx > 0 ? 'right' : 'left')
          : (fdy > 0 ? 'down' : 'up');
        const foxMoving = fox.x !== player.x || fox.y !== player.y;
        const foxDrawSize = tileSize * S;
        drawSprite(fSprite, fcx, fcy, foxDir, stepCountRef.current - 1, foxMoving, foxDrawSize);
      } else {
        // ── Procedural fox fallback ──
        const foxBob = Math.sin(time * 0.003 + 1) * 1;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(fcx, fcy + 12 * S, 7 * S, 2.5 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#e87030';
        ctx.beginPath();
        ctx.ellipse(fcx, fcy + 4 * S + foxBob, 7 * S, 5 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        // Belly
        ctx.fillStyle = '#f5c090';
        ctx.beginPath();
        ctx.ellipse(fcx, fcy + 5.5 * S + foxBob, 4.5 * S, 3 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = '#f08040';
        ctx.beginPath();
        ctx.arc(fcx, fcy - 5 * S + foxBob, 6.5 * S, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.fillStyle = '#e87030';
        ctx.beginPath();
        ctx.moveTo(fcx - 5 * S, fcy - 8 * S + foxBob);
        ctx.lineTo(fcx - 8 * S, fcy - 16 * S + foxBob);
        ctx.lineTo(fcx - 1 * S, fcy - 9 * S + foxBob);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(fcx + 5 * S, fcy - 8 * S + foxBob);
        ctx.lineTo(fcx + 8 * S, fcy - 16 * S + foxBob);
        ctx.lineTo(fcx + 1 * S, fcy - 9 * S + foxBob);
        ctx.fill();
        // Inner ears
        ctx.fillStyle = '#ffb080';
        ctx.beginPath();
        ctx.moveTo(fcx - 5 * S, fcy - 9 * S + foxBob);
        ctx.lineTo(fcx - 7 * S, fcy - 14 * S + foxBob);
        ctx.lineTo(fcx - 2 * S, fcy - 9.5 * S + foxBob);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(fcx + 5 * S, fcy - 9 * S + foxBob);
        ctx.lineTo(fcx + 7 * S, fcy - 14 * S + foxBob);
        ctx.lineTo(fcx + 2 * S, fcy - 9.5 * S + foxBob);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#1a1a2a';
        ctx.beginPath();
        ctx.arc(fcx - 2.5 * S, fcy - 5 * S + foxBob, 1.8 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fcx + 2.5 * S, fcy - 5 * S + foxBob, 1.8 * S, 0, Math.PI * 2);
        ctx.fill();
        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(fcx - 1.5 * S, fcy - 5.8 * S + foxBob, 0.7 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fcx + 3.5 * S, fcy - 5.8 * S + foxBob, 0.7 * S, 0, Math.PI * 2);
        ctx.fill();
        // Nose
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.ellipse(fcx, fcy - 2.5 * S + foxBob, 1.2 * S, 0.8 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.strokeStyle = '#e87030';
        ctx.lineWidth = 3 * S;
        ctx.lineCap = 'round';
        const tailSway = Math.sin(time * 0.004) * 4 * S;
        ctx.beginPath();
        ctx.moveTo(fcx, fcy + 9 * S + foxBob);
        ctx.quadraticCurveTo(fcx - 8 * S + tailSway, fcy + 12 * S, fcx - 10 * S + tailSway, fcy + 4 * S);
        ctx.stroke();
        ctx.strokeStyle = '#fff8e8';
        ctx.lineWidth = 2.5 * S;
        ctx.beginPath();
        ctx.moveTo(fcx - 9 * S + tailSway, fcy + 5 * S);
        ctx.lineTo(fcx - 10 * S + tailSway, fcy + 4 * S);
        ctx.stroke();
      }

      // ── Draw Player (scaled up) ──
      const pcx = interpX * tileSize - camX + half;
      const pcy = interpY * tileSize - camY + half;
      const dir = playerDirRef.current;

      if (pSprite) {
        // Spritesheet player
        const playerDrawSize = tileSize * S;
        drawSprite(pSprite, pcx, pcy, dir, stepCountRef.current, isMovingRef.current, playerDrawSize);
      } else {
        // ── Procedural player fallback (Pokémon chibi style) ──
        const walkBob = isMovingRef.current ? Math.sin(time * 0.015) * 2 : 0;
        const walkLeg = isMovingRef.current ? Math.sin(time * 0.02) * 3 : 0;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(pcx, pcy + 14 * S, 8 * S, 3 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.fillStyle = '#1a1030';
        ctx.beginPath();
        ctx.ellipse(pcx - 3 * S, pcy + 10 * S + walkLeg, 2.5 * S, 4 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pcx + 3 * S, pcy + 10 * S - walkLeg, 2.5 * S, 4 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shoes
        ctx.fillStyle = '#4a2010';
        ctx.beginPath();
        ctx.ellipse(pcx - 3 * S, pcy + 13 * S + walkLeg, 3 * S, 1.5 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pcx + 3 * S, pcy + 13 * S - walkLeg, 3 * S, 1.5 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        // Body / cloak
        ctx.fillStyle = '#2a1a3a';
        ctx.beginPath();
        ctx.ellipse(pcx, pcy + 3 * S + walkBob, 9 * S, 8 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a2a4a';
        ctx.beginPath();
        ctx.ellipse(pcx - 2 * S, pcy + 1 * S + walkBob, 4 * S, 5 * S, -0.2, 0, Math.PI * 2);
        ctx.fill();
        // Belt
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(pcx - 8 * S, pcy + 2 * S + walkBob, 16 * S, 2 * S);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(pcx - 1.5 * S, pcy + 1.5 * S + walkBob, 3 * S, 3 * S);
        // Head
        ctx.fillStyle = '#f0c8a0';
        ctx.beginPath();
        ctx.arc(pcx, pcy - 10 * S + walkBob, 8.5 * S, 0, Math.PI * 2);
        ctx.fill();
        // Hair
        ctx.fillStyle = '#4a2a10';
        ctx.beginPath();
        ctx.arc(pcx, pcy - 12 * S + walkBob, 9 * S, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(pcx - 8 * S, pcy - 12 * S + walkBob);
        ctx.quadraticCurveTo(pcx - 4 * S, pcy - 7 * S + walkBob, pcx - 1 * S, pcy - 10 * S + walkBob);
        ctx.quadraticCurveTo(pcx + 2 * S, pcy - 6 * S + walkBob, pcx + 5 * S, pcy - 10 * S + walkBob);
        ctx.quadraticCurveTo(pcx + 7 * S, pcy - 7 * S + walkBob, pcx + 9 * S, pcy - 11 * S + walkBob);
        ctx.lineTo(pcx + 9 * S, pcy - 14 * S + walkBob);
        ctx.lineTo(pcx - 8 * S, pcy - 14 * S + walkBob);
        ctx.fill();
        // Eyes
        const eyeOffX = (dir === 'left' ? -2 : dir === 'right' ? 2 : 0) * S;
        const eyeOffY = (dir === 'up' ? -1 : dir === 'down' ? 1 : 0) * S;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(pcx - 3 * S + eyeOffX, pcy - 9 * S + eyeOffY + walkBob, 2.5 * S, 3 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pcx + 3 * S + eyeOffX, pcy - 9 * S + eyeOffY + walkBob, 2.5 * S, 3 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a3a';
        ctx.beginPath();
        ctx.arc(pcx - 2.5 * S + eyeOffX * 0.7, pcy - 9 * S + eyeOffY * 0.7 + walkBob, 1.5 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pcx + 3.5 * S + eyeOffX * 0.7, pcy - 9 * S + eyeOffY * 0.7 + walkBob, 1.5 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(pcx - 1.8 * S + eyeOffX * 0.5, pcy - 10 * S + eyeOffY * 0.5 + walkBob, 0.7 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pcx + 4.2 * S + eyeOffX * 0.5, pcy - 10 * S + eyeOffY * 0.5 + walkBob, 0.7 * S, 0, Math.PI * 2);
        ctx.fill();
        // Mouth
        if (dir !== 'up') {
          ctx.strokeStyle = '#8a5a40';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(pcx + eyeOffX * 0.3, pcy - 6 * S + eyeOffY * 0.3 + walkBob, 2 * S, 0.1 * Math.PI, 0.9 * Math.PI);
          ctx.stroke();
        }
      }

      // ── Ambient vignette ──
      const gradient = ctx.createRadialGradient(dims.w / 2, dims.h / 2, dims.w * 0.25, dims.w / 2, dims.h / 2, dims.w * 0.7);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dims.w, dims.h);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dims, map, tileSize, playerSprite, foxSprite, tileArtImages]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* ── Virtual Joystick Visual ── */}
      {joyVisual && (
        <div className="absolute z-10 pointer-events-none" style={{
          left: joyVisual.ox - 44,
          top: joyVisual.oy - 44,
          width: 88,
          height: 88,
        }}>
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full" style={{
            border: '2px solid rgba(212,164,74,0.25)',
            background: 'rgba(10,8,6,0.2)',
          }} />
          {/* Thumb */}
          <div className="absolute rounded-full" style={{
            width: 28,
            height: 28,
            left: 44 + joyVisual.dx - 14,
            top: 44 + joyVisual.dy - 14,
            background: 'radial-gradient(circle, rgba(212,164,74,0.6), rgba(180,130,50,0.3))',
            border: '2px solid rgba(255,215,0,0.4)',
            boxShadow: '0 0 12px rgba(255,215,0,0.2)',
          }} />
        </div>
      )}

      {/* ── Interaction prompt ── */}
      {nearbyDoor && !paused && (
        <button
          onClick={handleDoorInteract}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl animate-pulse"
          style={{
            background: 'linear-gradient(135deg, rgba(212,164,74,0.85), rgba(180,130,50,0.9))',
            border: '2px solid rgba(255,215,0,0.5)',
            boxShadow: '0 4px 20px rgba(212,164,74,0.4), 0 0 30px rgba(255,215,0,0.15)',
            fontFamily: "'Cherry Bomb One', cursive",
            fontSize: 13,
            color: '#1a0f00',
            letterSpacing: '0.02em',
          }}
        >
          Enter {nearbyDoor.label}
        </button>
      )}
    </div>
  );
}