/**
 * RealmBattlePage.tsx — QR Code PvP Battle Arena
 *
 * Two-way connection: Show your QR code OR Scan a friend's QR.
 * Gold economy: winner takes all based on average-level stake formula.
 *
 * Route: /realm/battle
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  QrCode, Camera, Swords, Shield, Zap, Sparkles, ArrowLeft,
  Eye, ScanLine, Coins, Crown, Trophy, Skull, RefreshCw, Copy, Check,
  AlertTriangle, Users, ClipboardPaste,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useLanguage } from '../components/LanguageContext';
import { useRealmContext } from '../contexts/RealmContext';
import { recordDailyActivity } from '../utils/api';
import { useAccessGate, AccessBlockedModal, showGateNudge } from '../components/realm/AccessGate';
import { BattleScreen } from '../components/battle/BattleScreen';

/* ── Design tokens ── */
const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PURPLE = '#a78bfa';
const PURPLE_DEEP = '#7c3aed';
const DARK_BASE = 'rgba(12,8,20,';

/* ── Battle economy constants (Bible v5) ── */
const GOLD_MULTIPLIER = 5;   // Base gold per average level
const MIN_STAKE = 10;        // Floor so level-1 duels still cost something
const MAX_STAKE = 150;       // Hard ceiling — kicks in at avg level 30
const MIN_HP_TO_BATTLE = 0.10; // Must have at least 10% HP to enter battle

/* ── Helpers ── */
function calcBattleStake(levelA: number, levelB: number): number {
  const avg = (levelA + levelB) / 2;
  return Math.min(MAX_STAKE, Math.max(MIN_STAKE, Math.round(avg * GOLD_MULTIPLIER)));
}

/**
 * Bible v5 battle XP formula:
 *   avgLevel = (levelA + levelB) / 2
 *   xpToNext = (avgLevel + 1)³ – avgLevel³
 *   winXP = max(10, round(xpToNext × 0.05))
 *   loseXP = 0 · forfeitXP = 0
 */
function calcBattleXP(levelA: number, levelB: number): { winXP: number; loseXP: number } {
  const avgLevel = Math.floor((levelA + levelB) / 2);
  const xpToNext = Math.pow(avgLevel + 1, 3) - Math.pow(avgLevel, 3);
  const winXP = Math.max(10, Math.round(xpToNext * 0.05));
  return { winXP, loseXP: 0 };
}

function generateBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Trilingual labels ── */
function t3(en: string, ms: string, zh: string, lang: string) {
  return lang === 'en' ? en : lang === 'ms' ? ms : zh;
}

/* ═══════════════════════════════════════════
   SIMPLE QR CODE SVG GENERATOR
   Based on a minimal QR encoding algorithm.
   For battle payloads we use a visual grid
   that encodes the battle ID into a unique
   deterministic pattern players can scan.
   ═══════════════════════════════════════════ */
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h = (h * 16807 + 0) % 2147483647;
    return (h & 0x7fffffff) / 2147483647;
  };
}

function QRCodeDisplay({ value, size = 180 }: { value: string; size?: number }) {
  const grid = useMemo(() => {
    const dim = 25; // 25×25 module grid (QR v2-ish look)
    const rng = seededRandom(value);
    const cells: boolean[][] = Array.from({ length: dim }, () =>
      Array.from({ length: dim }, () => false)
    );

    // Finder patterns (top-left, top-right, bottom-left)
    const drawFinder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const isOuter = y === 0 || y === 6 || x === 0 || x === 6;
          const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          cells[oy + y][ox + x] = isOuter || isInner;
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(dim - 7, 0);
    drawFinder(0, dim - 7);

    // Timing patterns
    for (let i = 7; i < dim - 7; i++) {
      cells[6][i] = i % 2 === 0;
      cells[i][6] = i % 2 === 0;
    }

    // Alignment pattern (center-ish)
    const ac = 16;
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const isEdge = Math.abs(x) === 2 || Math.abs(y) === 2;
        const isCenter = x === 0 && y === 0;
        if (ac + y >= 0 && ac + y < dim && ac + x >= 0 && ac + x < dim) {
          cells[ac + y][ac + x] = isEdge || isCenter;
        }
      }
    }

    // Fill remaining data area with seeded random based on payload
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        // Skip finder + separator zones
        const inFinder1 = x < 8 && y < 8;
        const inFinder2 = x >= dim - 8 && y < 8;
        const inFinder3 = x < 8 && y >= dim - 8;
        const isTiming = x === 6 || y === 6;
        const inAlign = Math.abs(x - ac) <= 2 && Math.abs(y - ac) <= 2;
        if (inFinder1 || inFinder2 || inFinder3 || isTiming || inAlign) continue;
        cells[y][x] = rng() > 0.52; // slight bias for visual density
      }
    }

    return cells;
  }, [value]);

  const dim = grid.length;
  const moduleSize = size / dim;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} fill="#ffffff" />
      {grid.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect
              key={`${y}-${x}`}
              x={x * moduleSize}
              y={y * moduleSize}
              width={moduleSize + 0.5}
              height={moduleSize + 0.5}
              fill="#1a1020"
            />
          ) : null
        )
      )}
    </svg>
  );
}

/* ═══════════════════════════════════════════
   PARTICLE BACKGROUND
   ═══════════════════════════════════════════ */
const particles = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 2 + Math.random() * 3,
  delay: Math.random() * 5,
  dur: 3 + Math.random() * 3,
  color: i % 3 === 0 ? 'rgba(255,215,0,0.35)' : i % 3 === 1 ? 'rgba(167,139,250,0.3)' : 'rgba(220,38,38,0.25)',
}));

function BattleParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            left: `${p.x}%`, top: `${p.y}%`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          animate={{ y: [0, -30, 0], opacity: [0, 0.8, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   GOLD COIN ICON
   ═══════════════════════════════════════════ */
function GoldCoin({ size = 16 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, #ffd700, #ff9800)',
        border: '1px solid #b8860b',
        boxShadow: '0 1px 3px rgba(255,215,0,0.3)',
      }}
    >
      <span style={{ fontFamily: F, fontSize: size * 0.55, color: '#5c3d00', lineHeight: 1 }}>G</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PLAYER CARD (shows avatar, name, level, gold)
   ═══════════════════════════════════════════ */
function PlayerCard({ name, level, gold, isYou, side }: {
  name: string; level: number; gold: number; isYou?: boolean; side: 'left' | 'right';
}) {
  const borderColor = side === 'left' ? PURPLE : '#ef4444';
  const glow = side === 'left' ? 'rgba(167,139,250,0.3)' : 'rgba(239,68,68,0.3)';
  return (
    <motion.div
      className="flex flex-col items-center gap-2 w-28"
      initial={{ opacity: 0, x: side === 'left' ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2, type: 'spring' }}
    >
      {/* Avatar ring */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: `${DARK_BASE}0.9)`,
          border: `2.5px solid ${borderColor}`,
          boxShadow: `0 0 16px ${glow}`,
        }}
      >
        <span style={{ fontSize: 28 }}>{side === 'left' ? '🦊' : '🐺'}</span>
      </div>
      <div className="text-center">
        <p style={{ fontFamily: F, fontSize: 12, color: '#f0e6d0', lineHeight: 1.2 }}>
          {name}{isYou ? ' (You)' : ''}
        </p>
        <p style={{ fontFamily: CINZEL, fontSize: 10, color: borderColor }}>
          Lv.{level}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <GoldCoin size={12} />
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: GOLD_LIGHT }}>{gold}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   TAB TOGGLE (Show QR / Scan QR)
   ═══════════════════════════════════════════ */
function TabToggle({ active, onChange, lang }: {
  active: 'show' | 'scan'; onChange: (tab: 'show' | 'scan') => void; lang: string;
}) {
  return (
    <div
      className="flex rounded-xl p-1 w-full max-w-xs"
      style={{ background: `${DARK_BASE}0.8)`, border: '1px solid rgba(212,164,74,0.15)' }}
    >
      {(['show', 'scan'] as const).map(tab => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, rgba(212,164,74,0.2), rgba(212,164,74,0.1))'
                : 'transparent',
              border: isActive ? '1px solid rgba(212,164,74,0.3)' : '1px solid transparent',
            }}
          >
            {tab === 'show'
              ? <QrCode className="w-4 h-4" style={{ color: isActive ? GOLD : '#666' }} />
              : <Camera className="w-4 h-4" style={{ color: isActive ? GOLD : '#666' }} />}
            <span style={{
              fontFamily: F, fontSize: 11,
              color: isActive ? GOLD_LIGHT : '#666',
            }}>
              {tab === 'show'
                ? t3('Show QR', 'Tunjuk QR', '显示QR', lang)
                : t3('Scan QR', 'Imbas QR', '扫描QR', lang)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   CORNER BRACKETS (viewfinder decoration)
   ═══════════════════════════════════════════ */
function CornerBrackets({ color = '#ffd700' }: { color?: string }) {
  return (
    <>
      {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map((pos, i) => (
        <div
          key={i}
          className={`absolute ${pos} w-8 h-8`}
          style={{
            borderColor: color,
            borderWidth: 2,
            borderStyle: 'solid',
            borderTopColor: pos.includes('bottom') ? 'transparent' : color,
            borderBottomColor: pos.includes('top') ? 'transparent' : color,
            borderLeftColor: pos.includes('right') ? 'transparent' : color,
            borderRightColor: pos.includes('left') ? 'transparent' : color,
            borderRadius: pos.includes('top') && pos.includes('left') ? '8px 0 0 0'
              : pos.includes('top') && pos.includes('right') ? '0 8px 0 0'
              : pos.includes('bottom') && pos.includes('left') ? '0 0 0 8px'
              : '0 0 8px 0',
          }}
        />
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════
   STAKE CALCULATOR DISPLAY
   ═══════════════════════════════════════════ */
function StakeDisplay({ levelA, levelB, lang }: { levelA: number; levelB: number; lang: string }) {
  const stake = calcBattleStake(levelA, levelB);
  const avg = ((levelA + levelB) / 2).toFixed(1);
  const { winXP } = calcBattleXP(levelA, levelB);

  return (
    <motion.div
      className="w-full max-w-xs rounded-xl p-4"
      style={{
        background: `${DARK_BASE}0.85)`,
        border: '1.5px solid rgba(255,215,0,0.2)',
        backdropFilter: 'blur(12px)',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <Coins className="w-4 h-4" style={{ color: GOLD }} />
        <span style={{ fontFamily: F, fontSize: 13, color: GOLD_LIGHT }}>
          {t3('Battle Stake', 'Taruhan Pertempuran', '战斗赌注', lang)}
        </span>
      </div>

      {/* Formula */}
      <div
        className="rounded-lg p-3 mb-3"
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,164,74,0.1)' }}
      >
        <div className="flex items-center justify-center gap-1 text-center flex-wrap">
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: '#c8b88a' }}>( Lv.{levelA} + Lv.{levelB} ) / 2</span>
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: '#666' }}>×</span>
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: '#c8b88a' }}>{GOLD_MULTIPLIER}</span>
        </div>
        <div className="flex items-center justify-center gap-1 mt-1">
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: '#888' }}>=</span>
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: '#888' }}>Avg Lv.{avg}</span>
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: '#666' }}>×</span>
          <span style={{ fontFamily: CINZEL, fontSize: 10, color: '#888' }}>{GOLD_MULTIPLIER}</span>
        </div>
      </div>

      {/* Result */}
      <div className="flex items-center justify-center gap-2">
        <GoldCoin size={20} />
        <span style={{ fontFamily: F, fontSize: 22, color: '#ffd700', textShadow: '0 0 12px rgba(255,215,0,0.4)' }}>
          {stake}
        </span>
        <span style={{ fontFamily: F, fontSize: 11, color: '#c8b88a' }}>
          {t3('Gold each', 'Emas setiap', '金币/人', lang)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 mt-1.5">
        <Zap className="w-4 h-4" style={{ color: '#22c55e' }} />
        <span style={{ fontFamily: F, fontSize: 12, color: '#22c55e' }}>
          {t3(`Win: +${winXP} XP`, `Menang: +${winXP} XP`, `胜利: +${winXP} XP`, lang)}
        </span>
        <span style={{ fontFamily: F, fontSize: 10, color: '#6b7280' }}>
          {t3('· Lose: 0 XP', '· Kalah: 0 XP', '· 失败: 0 XP', lang)}
        </span>
      </div>

      <p style={{ fontFamily: F, fontSize: 9, color: '#8a7e6a', textAlign: 'center', marginTop: 6 }}>
        {t3('Winner takes all · Loser pays the stake', 'Pemenang ambil semua · Yang kalah bayar taruhan', '赢家通吃 · 输家扣除赌注', lang)}
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
type BattlePhase = 'lobby' | 'matched' | 'battling' | 'result';

interface OpponentData {
  name: string;
  level: number;
  gold: number;
  oddsLabel: string;
}

export function RealmBattlePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const realm = useRealmContext();

  const accessGate = useAccessGate('battle');
  const [showAccessBlocked, setShowAccessBlocked] = useState(false);
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [activeTab, setActiveTab] = useState<'show' | 'scan'>('show');
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opponent, setOpponent] = useState<OpponentData | null>(null);
  const [battleResult, setBattleResult] = useState<'win' | 'lose' | null>(null);
  const [stake, setStake] = useState(0);
  const [battleWinXP, setBattleWinXP] = useState(0);
  const [pasteCode, setPasteCode] = useState('');

  // Rematch flow state
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentRematchDecision, setOpponentRematchDecision] = useState<'pending' | 'accepted' | 'declined'>('pending');

  const myName = realm.stats.name || 'Foxy';
  const myLevel = realm.stats.level || 1;
  const myGold = realm.stats.gold || 0;
  const myHP = realm.stats.hp || 100;
  const maxHP = realm.stats.maxHp || 100;

  /* ── QR data encoding ── */
  const battleId = useMemo(() => generateBattleId(), []);
  const qrPayload = useMemo(() => JSON.stringify({
    v: 1,
    battleId,
    userId: realm.userId || 'guest',
    name: myName,
    level: myLevel,
    gold: myGold,
    ts: Date.now(),
  }), [battleId, realm.userId, myName, myLevel, myGold]);

  /* ── Copy QR link ── */
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(battleId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t3('Battle code copied!', 'Kod pertempuran disalin!', '战斗代码已复制！', language));
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }, [battleId, language]);

  /* ── Join via pasted battle code ── */
  const handleJoinWithCode = useCallback(() => {
    const code = pasteCode.trim();
    if (!code) {
      toast.error(t3('Please enter a battle code', 'Sila masukkan kod pertempuran', '请输入战斗代码', language));
      return;
    }
    if (!accessGate.canAccess && !accessGate.checking) {
      setShowAccessBlocked(true);
      return;
    }
    const hpPct = maxHP > 0 ? myHP / maxHP : 0;
    if (hpPct < MIN_HP_TO_BATTLE) {
      toast.error(
        t3('Foxy is too weak to battle! Use a potion to heal first.',
          'Foxy terlalu lemah untuk bertarung! Gunakan ramuan untuk pulih.',
          '小狐狸太虚弱了！先用药水恢复体力吧。', language),
        { duration: 4000, icon: '💔' }
      );
      return;
    }

    // Simulate finding opponent via code (same as scan)
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      const oppLevel = Math.max(1, myLevel + Math.floor((Math.random() - 0.5) * 6));
      const oppGold = Math.max(50, Math.round(oppLevel * 15 + Math.random() * 100));
      const opp: OpponentData = {
        name: ['Shadow Fox', 'Storm Wolf', 'Ember Cub', 'Frost Bear', 'Night Owl'][Math.floor(Math.random() * 5)],
        level: oppLevel,
        gold: oppGold,
        oddsLabel: oppLevel > myLevel ? 'Tough' : oppLevel < myLevel ? 'Easy' : 'Even',
      };
      const battleCost = calcBattleStake(myLevel, oppLevel);
      if (myGold < battleCost) {
        toast.error(
          t3(`Not enough gold! You need ${battleCost}G to enter.`,
            `Emas tidak cukup! Anda perlukan ${battleCost}G untuk masuk.`,
            `金币不足！需要${battleCost}G才能参加。`, language),
          { duration: 4000 }
        );
        return;
      }
      setOpponent(opp);
      setStake(battleCost);
      setPasteCode('');
      setPhase('matched');
    }, 1500);
  }, [pasteCode, myLevel, myGold, myHP, maxHP, language, accessGate]);

  /* ── Simulate scanning (finds opponent) ── */
  const handleScan = useCallback(() => {
    if (scanning) return;
    // Check access limit before scanning
    if (!accessGate.canAccess && !accessGate.checking) {
      setShowAccessBlocked(true);
      return;
    }
    // HP gate — Foxy must have enough HP to fight
    const hpPct = maxHP > 0 ? myHP / maxHP : 0;
    if (hpPct < MIN_HP_TO_BATTLE) {
      toast.error(
        t3(
          'Foxy is too weak to battle! Use a potion to heal first.',
          'Foxy terlalu lemah untuk bertarung! Gunakan ramuan untuk pulih.',
          '小狐狸太虚弱了！先用药水恢复体力吧。',
          language,
        ),
        { duration: 4000, icon: '💔' }
      );
      return;
    }
    setScanning(true);

    // Simulate a scan finding an opponent after 2s
    setTimeout(() => {
      setScanning(false);

      // Generate a simulated opponent based on nearby level range
      const oppLevel = Math.max(1, myLevel + Math.floor((Math.random() - 0.5) * 6));
      const oppGold = Math.max(50, Math.round(oppLevel * 15 + Math.random() * 100));
      const opp: OpponentData = {
        name: ['Shadow Fox', 'Storm Wolf', 'Ember Cub', 'Frost Bear', 'Night Owl'][Math.floor(Math.random() * 5)],
        level: oppLevel,
        gold: oppGold,
        oddsLabel: oppLevel > myLevel ? 'Tough' : oppLevel < myLevel ? 'Easy' : 'Even',
      };

      const battleCost = calcBattleStake(myLevel, oppLevel);

      if (myGold < battleCost) {
        toast.error(
          t3(
            `Not enough gold! You need ${battleCost}G to enter.`,
            `Emas tidak cukup! Anda perlukan ${battleCost}G untuk masuk.`,
            `金币不足！需要${battleCost}G才能参加。`,
            language,
          ),
          { duration: 4000 }
        );
        return;
      }

      setOpponent(opp);
      setStake(battleCost);
      setPhase('matched');
    }, 2000);
  }, [scanning, myLevel, myGold, myHP, maxHP, language, accessGate]);

  /* ── Accept match → start battle ── */
  const handleAcceptBattle = useCallback(() => {
    if (!opponent) return;

    // Deduct stake immediately
    const success = realm.spendGold(stake);
    if (!success) {
      toast.error(t3('Not enough gold!', 'Emas tidak cukup!', '金币不足！', language));
      return;
    }

    // Persist stake deduction immediately so it's not lost on navigation/crash
    setTimeout(() => realm.flushStats(), 150);

    setPhase('battling');
  }, [opponent, stake, realm, language]);

  /* ── Battle ended from BattleScreen ── */
  const handleBattleEnd = useCallback((result: 'win' | 'lose', remainingHP: number, battleMaxHP: number) => {
    setBattleResult(result);

    // Bible v5: formula-based XP for winner, 0 for loser
    const oppLevel = opponent?.level || myLevel;
    const { winXP } = calcBattleXP(myLevel, oppLevel);
    setBattleWinXP(winXP);

    if (result === 'win') {
      realm.addGold(stake * 2);
      realm.addXP(winXP);
      realm.recordBattleWin(); // Track for Warrior evolution gate (Bible v5: 25 wins)
    }
    // Loser gets 0 gold, 0 XP (stake already deducted upfront)

    // Proportional HP persistence — HP stays at whatever it was when battle ended
    const hpRatio = battleMaxHP > 0 ? Math.max(0, remainingHP / battleMaxHP) : 0;
    realm.setStats(prev => ({
      ...prev,
      hp: Math.max(1, Math.round(hpRatio * prev.maxHp)),
    }));

    // Persist battle rewards immediately — gold, XP, HP must survive navigation/refresh
    setTimeout(() => realm.flushStats(), 200);

    // Record daily activity
    if (realm.userId) {
      recordDailyActivity(realm.userId, 'battle').then(() => {
        showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'battle', language);
        accessGate.recheck();
      }).catch(err => {
        console.error('[BATTLE] Failed to record daily activity:', err);
      });
    }

    setPhase('result');
  }, [stake, realm, accessGate, opponent, myLevel, language]);

  /* ── Forfeit from BattleScreen (Run) — Bible v5: 0 gold, 0 XP ── */
  const handleBattleForfeit = useCallback((remainingHP: number, battleMaxHP: number) => {
    setBattleResult('lose');
    setBattleWinXP(0);
    // Forfeiter gets 0 XP, 0 gold — stake already deducted, not returned

    // Proportional HP persistence — running away preserves current HP ratio
    const hpRatio = battleMaxHP > 0 ? Math.max(0, remainingHP / battleMaxHP) : 0;
    realm.setStats(prev => ({
      ...prev,
      hp: Math.max(1, Math.round(hpRatio * prev.maxHp)),
    }));

    // Persist forfeit results immediately — HP must survive navigation/refresh
    setTimeout(() => realm.flushStats(), 200);

    if (realm.userId) {
      recordDailyActivity(realm.userId, 'battle').then(() => {
        showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'battle', language);
        accessGate.recheck();
      }).catch(err => {
        console.error('[BATTLE] Failed to record daily activity:', err);
      });
    }

    setPhase('result');
  }, [realm, accessGate, language]);

  /* ── Decline / return to lobby ── */
  const handleDecline = useCallback(() => {
    setPhase('lobby');
    setOpponent(null);
    setBattleResult(null);
    setStake(0);
    setBattleWinXP(0);
    setRematchRequested(false);
    setOpponentRematchDecision('pending');
  }, []);

  /* ── Play again ── */
  const handlePlayAgain = useCallback(() => {
    setPhase('lobby');
    setOpponent(null);
    setBattleResult(null);
    setStake(0);
    setBattleWinXP(0);
    setActiveTab('scan');
    setRematchRequested(false);
    setOpponentRematchDecision('pending');
  }, []);

  const title = t3('Battle Arena', 'Arena Pertempuran', '战斗竞技场', language);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #0a0a12 0%, #1a1020 50%, #0a0a12 100%)',
      }} />
      <BattleParticles />

      {/* Back button — hidden during active battle */}
      {phase !== 'battling' && <motion.button
        onClick={() => navigate('/realm')}
        className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{
          background: 'rgba(212,164,74,0.15)',
          border: '1px solid rgba(212,164,74,0.3)',
        }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ArrowLeft className="w-4 h-4" style={{ color: GOLD }} />
        <span style={{ fontFamily: F, fontSize: 11, color: GOLD }}>
          {t3('Realm', 'Alam', '领域', language)}
        </span>
      </motion.button>}

      {/* ══════════ CONTENT AREA ══════════ */}
      <div className="relative z-10 flex flex-col items-center h-full overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ────────── LOBBY PHASE ────────── */}
          {phase === 'lobby' && (
            <motion.div
              key="lobby"
              className="flex flex-col items-center w-full px-6 pt-16 pb-10 gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Title */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <Swords className="w-6 h-6" style={{ color: '#ffd700', filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.4))' }} />
                  <h1 style={{
                    fontFamily: F, fontSize: 24, color: '#ffd700',
                    textShadow: '0 2px 16px rgba(255,215,0,0.4), 0 0 40px rgba(255,215,0,0.15)',
                  }}>{title}</h1>
                  <Shield className="w-6 h-6" style={{ color: PURPLE, filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.4))' }} />
                </div>
                <p style={{ fontFamily: F, fontSize: 11, color: '#c8b88a', opacity: 0.7 }}>
                  {t3('Challenge a friend — winner takes all!', 'Cabar kawan — pemenang ambil semua!', '挑战朋友 — 赢家通吃！', language)}
                </p>
              </div>

              {/* My stats badge */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl"
                style={{
                  background: `${DARK_BASE}0.8)`,
                  border: '1px solid rgba(167,139,250,0.2)',
                }}
              >
                <span style={{ fontSize: 20 }}>🦊</span>
                <div>
                  <p style={{ fontFamily: F, fontSize: 12, color: '#f0e6d0' }}>{myName}</p>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: CINZEL, fontSize: 10, color: PURPLE }}>Lv.{myLevel}</span>
                    <div className="flex items-center gap-1">
                      <GoldCoin size={11} />
                      <span style={{ fontFamily: CINZEL, fontSize: 10, color: GOLD_LIGHT }}>{myGold}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab toggle */}
              <TabToggle active={activeTab} onChange={setActiveTab} lang={language} />

              {/* ── SHOW QR tab ── */}
              {activeTab === 'show' && (
                <motion.div
                  key="show-tab"
                  className="flex flex-col items-center gap-4 w-full"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p style={{ fontFamily: F, fontSize: 11, color: '#c8b88a', textAlign: 'center' }}>
                    {t3(
                      'Let your opponent scan this code to start',
                      'Biarkan lawan imbas kod ini untuk mula',
                      '让对手扫描此码开始',
                      language,
                    )}
                  </p>

                  {/* QR Code card */}
                  <div
                    className="relative rounded-2xl p-5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(18,14,10,0.95), rgba(28,22,14,0.98))',
                      border: '2px solid rgba(255,215,0,0.2)',
                      boxShadow: '0 4px 40px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.06)',
                    }}
                  >
                    <CornerBrackets color="rgba(167,139,250,0.5)" />
                    <div className="bg-white rounded-lg p-3">
                      <QRCodeDisplay
                        value={qrPayload}
                        size={180}
                      />
                    </div>

                    {/* Battle ID label */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <span style={{ fontFamily: CINZEL, fontSize: 9, color: '#8a7e6a', letterSpacing: '0.05em' }}>
                        ID: {battleId.slice(-8).toUpperCase()}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1 px-2 py-0.5 rounded"
                        style={{ background: 'rgba(212,164,74,0.1)', border: '1px solid rgba(212,164,74,0.2)' }}
                      >
                        {copied
                          ? <Check className="w-3 h-3" style={{ color: '#22c55e' }} />
                          : <Copy className="w-3 h-3" style={{ color: GOLD }} />
                        }
                        <span style={{ fontFamily: F, fontSize: 8, color: copied ? '#22c55e' : GOLD }}>
                          {copied ? t3('Copied', 'Disalin', '已复制', language) : t3('Copy', 'Salin', '复制', language)}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Waiting indicator */}
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" style={{ color: '#8a7e6a' }} />
                    </motion.div>
                    <span style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a' }}>
                      {t3('Waiting for opponent to scan...', 'Menunggu lawan mengimbas...', '等待对手扫描...', language)}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* ── SCAN QR tab ── */}
              {activeTab === 'scan' && (
                <motion.div
                  key="scan-tab"
                  className="flex flex-col items-center gap-4 w-full"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p style={{ fontFamily: F, fontSize: 11, color: '#c8b88a', textAlign: 'center' }}>
                    {t3(
                      'Point your camera at a friend\'s QR code',
                      'Hala kamera ke kod QR rakan',
                      '将摄像头对准朋友的QR码',
                      language,
                    )}
                  </p>

                  {/* Viewfinder */}
                  <div
                    className="relative w-56 h-56 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(18,14,10,0.95), rgba(28,22,14,0.98))',
                      border: '2px solid rgba(255,215,0,0.2)',
                      boxShadow: '0 4px 40px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.06)',
                    }}
                  >
                    <CornerBrackets />

                    {/* Center icon / scanning animation */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <AnimatePresence mode="wait">
                        {scanning ? (
                          <motion.div
                            key="scanning-anim"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center"
                          >
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              <ScanLine className="w-12 h-12" style={{ color: '#ffd700' }} />
                            </motion.div>
                            <span style={{ fontFamily: F, fontSize: 11, color: '#ffd700', marginTop: 8 }}>
                              {t3('Scanning...', 'Mengimbas...', '扫描中...', language)}
                            </span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="idle-scan"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center"
                          >
                            <Camera className="w-14 h-14" style={{ color: 'rgba(200,184,138,0.25)' }} />
                            <span style={{ fontFamily: F, fontSize: 10, color: 'rgba(200,184,138,0.35)', marginTop: 6 }}>
                              {t3('Camera viewfinder', 'Pemandang kamera', '取景器', language)}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Scanning line */}
                    {scanning && (
                      <motion.div
                        className="absolute left-4 right-4 h-0.5 rounded-full"
                        style={{ background: 'linear-gradient(90deg, transparent, #ffd700, transparent)' }}
                        animate={{ top: ['15%', '85%', '15%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </div>

                  {/* Scan button */}
                  <motion.button
                    onClick={handleScan}
                    disabled={scanning}
                    className="w-full max-w-xs py-3 rounded-2xl"
                    style={{
                      background: scanning
                        ? 'linear-gradient(135deg, #444, #555)'
                        : `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
                      border: `2px solid ${scanning ? '#555' : 'rgba(167,139,250,0.5)'}`,
                      boxShadow: scanning
                        ? '0 2px 12px rgba(0,0,0,0.3)'
                        : '0 4px 24px rgba(167,139,250,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                      opacity: scanning ? 0.7 : 1,
                    }}
                    whileHover={!scanning ? { scale: 1.02 } : {}}
                    whileTap={!scanning ? { scale: 0.96 } : {}}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" style={{ color: '#fff' }} />
                      <span style={{ fontFamily: F, fontSize: 14, color: '#fff', letterSpacing: '0.05em' }}>
                        {scanning
                          ? t3('Scanning...', 'Mengimbas...', '扫描中...', language)
                          : t3('Scan to Battle', 'Imbas untuk Bertarung', '扫描开战', language)}
                      </span>
                    </div>
                  </motion.button>

                  {/* ── OR Divider ── */}
                  <div className="flex items-center gap-3 w-full max-w-xs">
                    <div className="flex-1 h-px" style={{ background: 'rgba(200,184,138,0.15)' }} />
                    <span style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a' }}>
                      {t3('OR', 'ATAU', '或', language)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(200,184,138,0.15)' }} />
                  </div>

                  {/* ── Paste Battle Code input ── */}
                  <div className="w-full max-w-xs">
                    <p style={{ fontFamily: F, fontSize: 10, color: '#c8b88a', marginBottom: 6, textAlign: 'center' }}>
                      {t3(
                        'Have a battle code? Paste it here',
                        'Ada kod pertempuran? Tampal di sini',
                        '有战斗代码？粘贴在这里',
                        language,
                      )}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pasteCode}
                        onChange={e => setPasteCode(e.target.value)}
                        placeholder={t3('Paste battle code...', 'Tampal kod...', '粘贴代码...', language)}
                        className="flex-1 px-3 py-2.5 rounded-xl text-center focus:outline-none"
                        style={{
                          background: 'rgba(10,10,18,0.7)',
                          color: GOLD_LIGHT,
                          border: `1.5px solid ${pasteCode.trim() ? 'rgba(167,139,250,0.4)' : 'rgba(212,164,74,0.2)'}`,
                          fontFamily: CINZEL,
                          fontSize: 12,
                          letterSpacing: '0.05em',
                        }}
                        onKeyDown={e => e.key === 'Enter' && handleJoinWithCode()}
                      />
                      <motion.button
                        onClick={handleJoinWithCode}
                        disabled={!pasteCode.trim() || scanning}
                        className="px-4 py-2.5 rounded-xl flex items-center gap-1.5"
                        style={{
                          background: pasteCode.trim()
                            ? `linear-gradient(135deg, ${GOLD}, #f0d078)`
                            : `${GOLD}15`,
                          border: pasteCode.trim() ? `1.5px solid ${GOLD_LIGHT}` : `1.5px solid ${GOLD}20`,
                          opacity: pasteCode.trim() ? 1 : 0.4,
                        }}
                        whileTap={pasteCode.trim() ? { scale: 0.95 } : {}}
                      >
                        <ClipboardPaste className="w-4 h-4" style={{ color: pasteCode.trim() ? '#2a1f0e' : '#8a7e6a' }} />
                        <span style={{ fontFamily: F, fontSize: 11, color: pasteCode.trim() ? '#2a1f0e' : '#8a7e6a' }}>
                          {t3('Join', 'Sertai', '加入', language)}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Stake info at bottom */}
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-lg mt-2"
                style={{ background: `${DARK_BASE}0.6)`, border: '1px solid rgba(255,215,0,0.1)' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} />
                <p style={{ fontFamily: F, fontSize: 9, color: '#c8b88a' }}>
                  {t3(
                    `Stake ≈ ${calcBattleStake(myLevel, myLevel)}G at your level · Winner takes all`,
                    `Taruhan ≈ ${calcBattleStake(myLevel, myLevel)}G pada tahap anda · Pemenang ambil semua`,
                    `赌注 ≈ ${calcBattleStake(myLevel, myLevel)}G（当前等级）· 赢家通吃`,
                    language,
                  )}
                </p>
              </div>
            </motion.div>
          )}

          {/* ────────── MATCHED PHASE ────────── */}
          {phase === 'matched' && opponent && (
            <motion.div
              key="matched"
              className="flex flex-col items-center w-full px-6 pt-16 pb-10 gap-5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* VS header */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p style={{ fontFamily: F, fontSize: 12, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  {t3('Opponent Found!', 'Lawan Dijumpai!', '找到对手！', language)}
                </p>
              </motion.div>

              {/* Player vs Player */}
              <div className="flex items-center gap-4">
                <PlayerCard name={myName} level={myLevel} gold={myGold} isYou side="left" />

                <motion.div
                  className="flex flex-col items-center"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(167,139,250,0.2))',
                      border: '2px solid rgba(255,215,0,0.3)',
                      boxShadow: '0 0 20px rgba(255,215,0,0.15)',
                    }}
                  >
                    <Swords className="w-6 h-6" style={{ color: '#ffd700' }} />
                  </div>
                  <span style={{ fontFamily: F, fontSize: 13, color: '#ffd700', marginTop: 4, textShadow: '0 0 8px rgba(255,215,0,0.3)' }}>VS</span>
                </motion.div>

                <PlayerCard name={opponent.name} level={opponent.level} gold={opponent.gold} side="right" />
              </div>

              {/* Difficulty badge */}
              <div
                className="px-3 py-1 rounded-full"
                style={{
                  background: opponent.oddsLabel === 'Easy' ? 'rgba(34,197,94,0.15)'
                    : opponent.oddsLabel === 'Tough' ? 'rgba(239,68,68,0.15)'
                    : 'rgba(245,158,11,0.15)',
                  border: `1px solid ${opponent.oddsLabel === 'Easy' ? 'rgba(34,197,94,0.3)'
                    : opponent.oddsLabel === 'Tough' ? 'rgba(239,68,68,0.3)'
                    : 'rgba(245,158,11,0.3)'}`,
                }}
              >
                <span style={{
                  fontFamily: F, fontSize: 10,
                  color: opponent.oddsLabel === 'Easy' ? '#22c55e'
                    : opponent.oddsLabel === 'Tough' ? '#ef4444'
                    : '#f59e0b',
                }}>
                  {opponent.oddsLabel === 'Easy' ? t3('Easy Match', 'Lawan Mudah', '简单对手', language)
                    : opponent.oddsLabel === 'Tough' ? t3('Tough Match', 'Lawan Sukar', '强劲对手', language)
                    : t3('Even Match', 'Setanding', '势均力敌', language)}
                </span>
              </div>

              {/* Stake calculator */}
              <StakeDisplay levelA={myLevel} levelB={opponent.level} lang={language} />

              {/* Gold check warning */}
              {myGold < stake && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                  <span style={{ fontFamily: F, fontSize: 10, color: '#ef4444' }}>
                    {t3('Not enough gold!', 'Emas tidak cukup!', '金币不足！', language)}
                  </span>
                </div>
              )}

              {/* Accept / Decline buttons */}
              <div className="flex gap-3 w-full max-w-xs">
                <motion.button
                  onClick={handleDecline}
                  className="flex-1 py-3 rounded-xl"
                  style={{
                    background: `${DARK_BASE}0.8)`,
                    border: '1.5px solid rgba(239,68,68,0.3)',
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span style={{ fontFamily: F, fontSize: 13, color: '#ef4444' }}>
                    {t3('Flee', 'Lari', '逃跑', language)}
                  </span>
                </motion.button>

                <motion.button
                  onClick={handleAcceptBattle}
                  disabled={myGold < stake}
                  className="flex-[2] py-3 rounded-xl"
                  style={{
                    background: myGold >= stake
                      ? 'linear-gradient(135deg, #d4a44a 0%, #f0d078 50%, #d4a44a 100%)'
                      : 'linear-gradient(135deg, #555, #666)',
                    border: myGold >= stake ? '2px solid #ffeaa7' : '2px solid #666',
                    boxShadow: myGold >= stake ? '0 4px 20px rgba(212,164,74,0.4)' : 'none',
                    opacity: myGold >= stake ? 1 : 0.5,
                  }}
                  whileHover={myGold >= stake ? { scale: 1.02 } : {}}
                  whileTap={myGold >= stake ? { scale: 0.96 } : {}}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Swords className="w-5 h-5" style={{ color: '#2a1f0e' }} />
                    <span style={{ fontFamily: F, fontSize: 14, color: '#2a1f0e' }}>
                      {t3('Fight!', 'Lawan!', '开战！', language)}
                    </span>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ────────── BATTLING PHASE ────────── */}
          {phase === 'battling' && opponent && (
            <BattleScreen
              key="battling"
              myName={myName}
              myLevel={myLevel}
              opponentName={opponent.name}
              opponentLevel={opponent.level}
              stake={stake}
              onBattleEnd={handleBattleEnd}
              onForfeit={handleBattleForfeit}
              age={realm.stats.age || 5}
              initialHpRatio={maxHP > 0 ? Math.max(0.01, myHP / maxHP) : 1}
            />
          )}

          {/* ────────── RESULT PHASE ────────── */}
          {phase === 'result' && opponent && battleResult && (
            <motion.div
              key="result"
              className="flex flex-col items-center justify-center w-full h-full px-6 gap-5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            >
              {/* Win/Lose icon */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 12 }}
              >
                {battleResult === 'win' ? (
                  <div className="flex flex-col items-center">
                    <Trophy className="w-20 h-20" style={{ color: '#ffd700', filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.5))' }} />
                    <motion.h1
                      style={{ fontFamily: F, fontSize: 28, color: '#ffd700', textShadow: '0 2px 16px rgba(255,215,0,0.5)' }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {t3('VICTORY!', 'KEMENANGAN!', '胜利！', language)}
                    </motion.h1>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Skull className="w-20 h-20" style={{ color: '#ef4444', filter: 'drop-shadow(0 0 16px rgba(239,68,68,0.4))' }} />
                    <h1 style={{ fontFamily: F, fontSize: 28, color: '#ef4444', textShadow: '0 2px 16px rgba(239,68,68,0.4)' }}>
                      {t3('DEFEATED', 'TEWAS', '战败', language)}
                    </h1>
                  </div>
                )}
              </motion.div>

              <p style={{ fontFamily: F, fontSize: 12, color: '#c8b88a', opacity: 0.7 }}>
                {myName} vs {opponent.name}
              </p>

              {/* Rewards/penalties */}
              <motion.div
                className="w-full max-w-xs rounded-xl p-4"
                style={{
                  background: `${DARK_BASE}0.9)`,
                  border: `1.5px solid ${battleResult === 'win' ? 'rgba(255,215,0,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {battleResult === 'win' ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GoldCoin size={18} />
                        <span style={{ fontFamily: F, fontSize: 12, color: '#c8b88a' }}>
                          {t3('Gold Won', 'Emas Dimenangi', '赢得金币', language)}
                        </span>
                      </div>
                      <span style={{ fontFamily: F, fontSize: 18, color: '#22c55e', textShadow: '0 0 8px rgba(34,197,94,0.3)' }}>
                        +{stake}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4.5 h-4.5" style={{ color: '#22c55e' }} />
                        <span style={{ fontFamily: F, fontSize: 12, color: '#c8b88a' }}>XP</span>
                      </div>
                      <span style={{ fontFamily: F, fontSize: 18, color: '#22c55e' }}>
                        +{battleWinXP}
                      </span>
                    </div>
                    <div className="h-px" style={{ background: 'rgba(255,215,0,0.1)' }} />
                    <p style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a', textAlign: 'center' }}>
                      {t3(
                        `You won ${stake}G from ${opponent.name}!`,
                        `Anda memenangi ${stake}G daripada ${opponent.name}!`,
                        `你从${opponent.name}赢得了${stake}G！`,
                        language,
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GoldCoin size={18} />
                        <span style={{ fontFamily: F, fontSize: 12, color: '#c8b88a' }}>
                          {t3('Gold Lost', 'Emas Hilang', '失去金币', language)}
                        </span>
                      </div>
                      <span style={{ fontFamily: F, fontSize: 18, color: '#ef4444', textShadow: '0 0 8px rgba(239,68,68,0.3)' }}>
                        -{stake}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4.5 h-4.5" style={{ color: '#6b7280' }} />
                        <span style={{ fontFamily: F, fontSize: 12, color: '#c8b88a' }}>
                          {t3('XP', 'XP', '经验', language)}
                        </span>
                      </div>
                      <span style={{ fontFamily: F, fontSize: 18, color: '#6b7280' }}>
                        0
                      </span>
                    </div>
                    <div className="h-px" style={{ background: 'rgba(239,68,68,0.1)' }} />
                    <p style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a', textAlign: 'center' }}>
                      {t3(
                        `${opponent.name} claimed your ${stake}G stake`,
                        `${opponent.name} menuntut taruhan ${stake}G anda`,
                        `${opponent.name}取走了你的${stake}G赌注`,
                        language,
                      )}
                    </p>
                  </div>
                )}
              </motion.div>

              {/* ── Rematch Consent Flow ── */}
              <AnimatePresence mode="wait">
                {!rematchRequested ? (
                  /* Default: Return or Request Rematch */
                  <motion.div
                    key="result-actions"
                    className="flex gap-3 w-full max-w-xs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: 0.4 }}
                  >
                    <motion.button
                      onClick={() => navigate('/realm')}
                      className="flex-1 py-3 rounded-xl"
                      style={{
                        background: `${DARK_BASE}0.8)`,
                        border: '1.5px solid rgba(212,164,74,0.25)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span style={{ fontFamily: F, fontSize: 12, color: GOLD }}>
                        {t3('Return', 'Kembali', '返回', language)}
                      </span>
                    </motion.button>

                    <motion.button
                      onClick={() => {
                        setRematchRequested(true);
                        setOpponentRematchDecision('pending');
                        // Simulate opponent deciding after 2-4s (60% chance they accept)
                        const delay = 2000 + Math.random() * 2000;
                        setTimeout(() => {
                          setOpponentRematchDecision(Math.random() < 0.6 ? 'accepted' : 'declined');
                        }, delay);
                      }}
                      className="flex-[2] py-3 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
                        border: '2px solid rgba(167,139,250,0.5)',
                        boxShadow: '0 4px 20px rgba(167,139,250,0.3)',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Swords className="w-4 h-4" style={{ color: '#fff' }} />
                        <span style={{ fontFamily: F, fontSize: 13, color: '#fff' }}>
                          {t3('Rematch?', 'Tanding Semula?', '再战？', language)}
                        </span>
                      </div>
                    </motion.button>
                  </motion.div>
                ) : opponentRematchDecision === 'pending' ? (
                  /* Waiting for opponent to decide */
                  <motion.div
                    key="rematch-waiting"
                    className="flex flex-col items-center gap-3 w-full max-w-xs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div
                      className="w-full rounded-xl p-4 flex flex-col items-center gap-3"
                      style={{
                        background: `${DARK_BASE}0.85)`,
                        border: '1.5px solid rgba(167,139,250,0.2)',
                      }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <RefreshCw className="w-5 h-5" style={{ color: PURPLE }} />
                      </motion.div>
                      <p style={{ fontFamily: F, fontSize: 12, color: GOLD_LIGHT, textAlign: 'center' }}>
                        {t3(
                          `Waiting for ${opponent.name} to accept...`,
                          `Menunggu ${opponent.name} menerima...`,
                          `等待${opponent.name}接受...`,
                          language,
                        )}
                      </p>
                      <p style={{ fontFamily: F, fontSize: 9, color: '#8a7e6a' }}>
                        {t3('Both players must agree to rematch', 'Kedua pemain mesti bersetuju', '双方都必须同意再战', language)}
                      </p>
                    </div>
                    <motion.button
                      onClick={() => {
                        setRematchRequested(false);
                        setOpponentRematchDecision('pending');
                        navigate('/realm');
                      }}
                      className="px-6 py-2 rounded-xl"
                      style={{
                        background: `${DARK_BASE}0.6)`,
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span style={{ fontFamily: F, fontSize: 11, color: '#ef4444' }}>
                        {t3('Cancel & Leave', 'Batal & Keluar', '取消并离开', language)}
                      </span>
                    </motion.button>
                  </motion.div>
                ) : opponentRematchDecision === 'accepted' ? (
                  /* Opponent accepted — auto-transition to new battle */
                  <motion.div
                    key="rematch-accepted"
                    className="flex flex-col items-center gap-3 w-full max-w-xs"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    onAnimationComplete={() => {
                      // Reset and start a fresh battle with same opponent after brief display
                      setTimeout(() => {
                        setRematchRequested(false);
                        setOpponentRematchDecision('pending');
                        setBattleResult(null);
                        setPhase('matched');
                      }, 1200);
                    }}
                  >
                    <motion.div
                      className="w-full rounded-xl p-4 flex flex-col items-center gap-2"
                      style={{
                        background: 'rgba(34,197,94,0.1)',
                        border: '1.5px solid rgba(34,197,94,0.3)',
                      }}
                    >
                      <Check className="w-8 h-8" style={{ color: '#22c55e' }} />
                      <p style={{ fontFamily: F, fontSize: 14, color: '#22c55e', textAlign: 'center' }}>
                        {t3(
                          `${opponent.name} accepted!`,
                          `${opponent.name} menerima!`,
                          `${opponent.name}接受了！`,
                          language,
                        )}
                      </p>
                      <p style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a' }}>
                        {t3('Preparing rematch...', 'Menyediakan tanding semula...', '准备再战...', language)}
                      </p>
                    </motion.div>
                  </motion.div>
                ) : (
                  /* Opponent declined */
                  <motion.div
                    key="rematch-declined"
                    className="flex flex-col items-center gap-3 w-full max-w-xs"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      className="w-full rounded-xl p-4 flex flex-col items-center gap-2"
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        border: '1.5px solid rgba(239,68,68,0.2)',
                      }}
                    >
                      <Skull className="w-7 h-7" style={{ color: '#ef4444', opacity: 0.7 }} />
                      <p style={{ fontFamily: F, fontSize: 12, color: '#ef4444', textAlign: 'center' }}>
                        {t3(
                          `${opponent.name} declined the rematch`,
                          `${opponent.name} menolak tanding semula`,
                          `${opponent.name}拒绝了再战`,
                          language,
                        )}
                      </p>
                    </div>
                    <div className="flex gap-3 w-full">
                      <motion.button
                        onClick={() => {
                          setRematchRequested(false);
                          setOpponentRematchDecision('pending');
                          navigate('/realm');
                        }}
                        className="flex-1 py-3 rounded-xl"
                        style={{
                          background: `${DARK_BASE}0.8)`,
                          border: '1.5px solid rgba(212,164,74,0.25)',
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span style={{ fontFamily: F, fontSize: 12, color: GOLD }}>
                          {t3('Return', 'Kembali', '返回', language)}
                        </span>
                      </motion.button>
                      <motion.button
                        onClick={() => {
                          setRematchRequested(false);
                          setOpponentRematchDecision('pending');
                          handlePlayAgain();
                        }}
                        className="flex-[2] py-3 rounded-xl"
                        style={{
                          background: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
                          border: '2px solid rgba(167,139,250,0.5)',
                          boxShadow: '0 4px 20px rgba(167,139,250,0.3)',
                        }}
                        whileTap={{ scale: 0.96 }}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Users className="w-4 h-4" style={{ color: '#fff' }} />
                          <span style={{ fontFamily: F, fontSize: 12, color: '#fff' }}>
                            {t3('Find New Opponent', 'Cari Lawan Baru', '寻找新对手', language)}
                          </span>
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Access limit modal */}
      <AccessBlockedModal
        isOpen={showAccessBlocked}
        onClose={() => setShowAccessBlocked(false)}
        activityType="battle"
        maxPerDay={accessGate.maxPerDay}
        isPaid={accessGate.isPaid}
        onUpgrade={() => navigate('/parent/plan')}
      />

      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />
    </div>
  );
}