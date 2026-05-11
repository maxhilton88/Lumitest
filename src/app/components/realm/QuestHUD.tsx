/**
 * QuestHUD.tsx — Heads-Up Display overlay for quest/exploration mode.
 *
 * Shows:
 * - Gold/diamond currency pills (top-right)
 * - Party HP bars (top-left)
 * - Menu button (hamburger → opens quick nav)
 * - Location name banner
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu, X, ShoppingBag, Swords, BookOpen, ArrowLeft,
  Heart, Coins, Gem, Map, FlaskConical,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useRealmContext, type PartySlot } from '../../contexts/RealmContext';
import { useLanguage } from '../LanguageContext';

const F = "'Cherry Bomb One', cursive";

function t3(en: string, ms: string, zh: string, lang: string) {
  return lang === 'en' ? en : lang === 'ms' ? ms : zh;
}

function GoldIcon({ size = 14 }: { size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center shrink-0" style={{
      width: size, height: size,
      background: 'linear-gradient(135deg, #ffd700, #ff9800)',
      border: '1px solid #b8860b',
    }}>
      <span style={{ fontFamily: F, fontSize: size * 0.5, color: '#5c3d00', lineHeight: 1 }}>G</span>
    </div>
  );
}

function DiamondIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} className="shrink-0">
      <defs><linearGradient id="hd" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e9d5ff" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient></defs>
      <polygon points="13,1 24,9 13,25 2,9" fill="url(#hd)" stroke="#6d28d9" strokeWidth="1.2" />
    </svg>
  );
}

// ── Mini party HP row ──
function PartyRow({ party }: { party: (PartySlot | null)[] }) {
  const filledSlots = party.filter(Boolean) as PartySlot[];
  if (filledSlots.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {filledSlots.slice(0, 5).map((slot, i) => {
        const hpRatio = slot.currentHp / 100; // We'll normalize to 100 for display
        const isFainted = slot.currentHp <= 0;
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 20, height: 20,
                background: isFainted ? 'rgba(60,20,20,0.8)' : 'rgba(20,15,10,0.8)',
                border: `1.5px solid ${isFainted ? 'rgba(239,68,68,0.4)' : 'rgba(212,164,74,0.3)'}`,
              }}
            >
              <span style={{ fontSize: 10 }}>{i === 0 ? '🦊' : '✦'}</span>
            </div>
            {/* Mini HP bar */}
            <div className="rounded-full overflow-hidden" style={{
              width: 18, height: 3,
              background: 'rgba(0,0,0,0.5)',
            }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.max(0, Math.min(100, hpRatio * 100))}%`,
                background: hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface QuestHUDProps {
  locationName: string;
  onBack: () => void;
}

export function QuestHUD({ locationName, onBack }: QuestHUDProps) {
  const realm = useRealmContext();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const party = realm.stats.party || [];
  const gold = realm.stats.gold || 0;
  const diamond = realm.stats.diamond || 0;

  const menuItems = [
    { icon: ShoppingBag, label: t3('Bag', 'Beg', '背包', language), action: () => navigate('/realm/bag') },
    { icon: FlaskConical, label: t3('Spiritlab', 'Makmal', '灵实验室', language), action: () => navigate('/realm') },
    { icon: Swords, label: t3('Battle', 'Pertempuran', '战斗', language), action: () => navigate('/realm/battle') },
    { icon: BookOpen, label: t3('Test', 'Ujian', '测试', language), action: () => navigate('/realm/test') },
    { icon: Map, label: t3('Realm Hub', 'Hub', '领域', language), action: () => navigate('/realm') },
  ];

  return (
    <>
      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-start justify-between px-3 pt-3 pointer-events-none">
        {/* Left side: back + party */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 32, height: 32,
              background: 'rgba(10,8,6,0.75)',
              border: '1px solid rgba(212,164,74,0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ArrowLeft size={16} color="#d4a44a" />
          </button>
          <PartyRow party={party} />
        </div>

        {/* Right side: currency + menu */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Gold pill */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
            background: 'rgba(10,8,6,0.75)',
            border: '1px solid rgba(255,215,0,0.2)',
            backdropFilter: 'blur(8px)',
          }}>
            <GoldIcon size={14} />
            <span style={{ fontFamily: F, fontSize: 11, color: '#ffd700' }}>
              {gold >= 10000 ? `${(gold/1000).toFixed(1)}k` : gold}
            </span>
          </div>
          {/* Diamond pill */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
            background: 'rgba(10,8,6,0.75)',
            border: '1px solid rgba(168,85,247,0.2)',
            backdropFilter: 'blur(8px)',
          }}>
            <DiamondIcon size={12} />
            <span style={{ fontFamily: F, fontSize: 11, color: '#c084fc' }}>{diamond}</span>
          </div>
          {/* Menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 32, height: 32,
              background: 'rgba(10,8,6,0.75)',
              border: '1px solid rgba(212,164,74,0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {menuOpen ? <X size={16} color="#d4a44a" /> : <Menu size={16} color="#d4a44a" />}
          </button>
        </div>
      </div>

      {/* ── Location name banner ── */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="px-4 py-1 rounded-full" style={{
          background: 'rgba(10,8,6,0.6)',
          border: '1px solid rgba(212,164,74,0.15)',
          backdropFilter: 'blur(6px)',
        }}>
          <span style={{ fontFamily: F, fontSize: 10, color: '#c8b88a', letterSpacing: '0.05em' }}>
            {locationName}
          </span>
        </div>
      </div>

      {/* ── Slide-out menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 z-45"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            {/* Menu panel */}
            <motion.div
              className="absolute top-14 right-3 z-50 rounded-xl overflow-hidden"
              style={{
                width: 180,
                background: 'linear-gradient(135deg, rgba(15,12,8,0.95), rgba(25,20,14,0.98))',
                border: '1.5px solid rgba(212,164,74,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(16px)',
              }}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { setMenuOpen(false); item.action(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                  style={{ borderBottom: i < menuItems.length - 1 ? '1px solid rgba(100,80,50,0.12)' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,164,74,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <item.icon size={16} color="#d4a44a" />
                  <span style={{ fontFamily: F, fontSize: 12, color: '#e8dcc8' }}>{item.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
