/**
 * SpiritlabModal.tsx — PC Box equivalent for storing overflow spirits.
 *
 * Shows spirits stored in the Spiritlab (not in active party).
 * Player can move spirits between party and Spiritlab.
 * Accessed from the Realm hub via a "Spiritlab" button.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRightLeft, Heart, Users, Box, Crown, Sparkles } from 'lucide-react';
import { useRealmContext, type PartySlot, type SpiritlabSlot } from '../../contexts/RealmContext';
import { rpgGameListEntities, rpgGameSignedUrls } from '../../utils/api';
import { FOXY_STAGES, WILD_SPIRITS } from '../admin/spirit-seed-data';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';

const ELEMENT_CONFIG: Record<string, { emoji: string; color: string }> = {
  fire: { emoji: '🔥', color: '#e05a2b' },
  water: { emoji: '💧', color: '#2e7fbf' },
  wood: { emoji: '🌿', color: '#4a9c3f' },
  thunder: { emoji: '⚡', color: '#c49a1a' },
  earth: { emoji: '🪨', color: '#7a6a52' },
  shadow: { emoji: '🌑', color: '#6b4fa8' },
  gold: { emoji: '✨', color: '#d4a843' },
};

interface SpiritInfo {
  id: string;
  name: string;
  types: string[];
  isFoxy?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SpiritlabModal({ open, onClose }: Props) {
  const {
    stats, movePartyToSpiritlab, moveSpiritlabToParty, flushStats,
  } = useRealmContext();

  const [spiritInfoMap, setSpiritInfoMap] = useState<Record<string, SpiritInfo>>({});
  const [tab, setTab] = useState<'party' | 'lab'>('lab');

  const party = stats.party || [];
  const spiritlab = stats.spiritlab || [];

  // Build spirit info map from seed data (no KV fetch needed for names/types)
  useEffect(() => {
    const map: Record<string, SpiritInfo> = {};
    for (const s of [...FOXY_STAGES, ...WILD_SPIRITS]) {
      map[s.id] = { id: s.id, name: s.name, types: s.types, isFoxy: s.isFoxy };
    }
    // Also try to load from KV for any spirits not in seed data
    rpgGameListEntities('spirit').then((entities: any[]) => {
      for (const e of entities) {
        if (!map[e.id]) {
          map[e.id] = { id: e.id, name: e.name || 'Unknown', types: e.types || [], isFoxy: e.isFoxy };
        }
      }
      setSpiritInfoMap({ ...map });
    }).catch(() => setSpiritInfoMap({ ...map }));
  }, []);

  const filledParty = party
    .map((slot, idx) => ({ slot, idx }))
    .filter((x): x is { slot: PartySlot; idx: number } => x.slot !== null);

  const partyHasRoom = party.some((s, i) => i > 0 && s === null);

  const handleMoveToLab = (partyIdx: number) => {
    if (partyIdx === 0) return; // can't move Foxy
    movePartyToSpiritlab(partyIdx);
    flushStats();
  };

  const handleMoveToParty = (spiritId: string) => {
    if (!partyHasRoom) return;
    moveSpiritlabToParty(spiritId);
    flushStats();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-md max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'linear-gradient(180deg, #1a1428 0%, #0f0b1a 100%)',
            border: `2px solid ${GOLD}30`,
            boxShadow: `0 0 40px rgba(212,164,74,0.15)`,
          }}
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${GOLD}20` }}>
            <div className="flex items-center gap-2">
              <Box className="w-5 h-5" style={{ color: GOLD }} />
              <span style={{ fontFamily: F, fontSize: 16, color: '#f0e6d0' }}>Spiritlab</span>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={18} style={{ color: '#888' }} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3">
            {(['lab', 'party'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                style={{
                  background: tab === t ? `${GOLD}20` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${tab === t ? GOLD + '40' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                {t === 'lab' ? <Box size={14} style={{ color: tab === t ? GOLD : '#666' }} /> :
                  <Users size={14} style={{ color: tab === t ? GOLD : '#666' }} />}
                <span style={{ fontFamily: F, fontSize: 11, color: tab === t ? GOLD : '#888' }}>
                  {t === 'lab' ? `Spiritlab (${spiritlab.length})` : `Party (${filledParty.length}/5)`}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {tab === 'lab' ? (
              spiritlab.length === 0 ? (
                <div className="text-center py-10">
                  <Box className="w-10 h-10 mx-auto mb-3" style={{ color: '#444' }} />
                  <p style={{ fontFamily: F, fontSize: 12, color: '#666' }}>
                    No spirits stored yet
                  </p>
                  <p style={{ fontFamily: F, fontSize: 10, color: '#555', marginTop: 4 }}>
                    Catch spirits with Lumicores in wild battles!
                  </p>
                </div>
              ) : (
                spiritlab.map((slot) => {
                  const info = spiritInfoMap[slot.spiritId];
                  return (
                    <SpiritCard
                      key={slot.spiritId}
                      spiritId={slot.spiritId}
                      name={slot.nickname || info?.name || slot.spiritId}
                      types={info?.types || []}
                      currentHp={slot.currentHp}
                      isFoxy={info?.isFoxy}
                      actionLabel="To Party"
                      actionDisabled={!partyHasRoom}
                      actionColor="#22c55e"
                      onAction={() => handleMoveToParty(slot.spiritId)}
                    />
                  );
                })
              )
            ) : (
              filledParty.map(({ slot, idx }) => {
                const info = spiritInfoMap[slot.spiritId];
                const isFoxySlot = idx === 0;
                return (
                  <SpiritCard
                    key={`party-${idx}`}
                    spiritId={slot.spiritId}
                    name={slot.nickname || info?.name || slot.spiritId}
                    types={info?.types || []}
                    currentHp={slot.currentHp}
                    isFoxy={info?.isFoxy || isFoxySlot}
                    actionLabel={isFoxySlot ? 'Lead' : 'To Lab'}
                    actionDisabled={isFoxySlot}
                    actionColor={isFoxySlot ? '#555' : '#f59e0b'}
                    onAction={() => !isFoxySlot && handleMoveToLab(idx)}
                    slotLabel={`Slot ${idx + 1}`}
                  />
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Spirit Card ── */
function SpiritCard({ spiritId, name, types, currentHp, isFoxy, actionLabel, actionDisabled, actionColor, onAction, slotLabel }: {
  spiritId: string; name: string; types: string[]; currentHp: number;
  isFoxy?: boolean; actionLabel: string; actionDisabled?: boolean;
  actionColor: string; onAction: () => void; slotLabel?: string;
}) {
  return (
    <motion.div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        background: isFoxy ? `${GOLD}08` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isFoxy ? GOLD + '25' : 'rgba(255,255,255,0.06)'}`,
      }}
      whileHover={{ scale: 1.01 }}
    >
      {/* Spirit icon */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{
        background: `${types[0] ? (ELEMENT_CONFIG[types[0]]?.color || '#666') : '#666'}15`,
        border: `1px solid ${types[0] ? (ELEMENT_CONFIG[types[0]]?.color || '#666') : '#666'}25`,
      }}>
        {isFoxy ? (
          <Crown size={18} style={{ color: GOLD }} />
        ) : (
          <Sparkles size={18} style={{ color: types[0] ? (ELEMENT_CONFIG[types[0]]?.color || '#888') : '#888' }} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate" style={{ fontFamily: F, fontSize: 12, color: isFoxy ? '#ffeaa7' : '#e8dcc8' }}>
            {name}
          </span>
          {types.map(t => {
            const el = ELEMENT_CONFIG[t];
            if (!el) return null;
            return (
              <span key={t} className="text-[8px]" style={{ color: el.color }}>
                {el.emoji}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1">
            <Heart size={9} style={{ color: '#ef4444' }} fill="#ef4444" />
            <span style={{ fontFamily: CINZEL, fontSize: 8, color: '#aaa' }}>
              {currentHp} HP
            </span>
          </div>
          {slotLabel && (
            <span style={{ fontFamily: CINZEL, fontSize: 7, color: '#666' }}>
              {slotLabel}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      <motion.button
        onClick={onAction}
        disabled={actionDisabled}
        className="px-3 py-1.5 rounded-lg flex items-center gap-1"
        style={{
          background: actionDisabled ? 'rgba(255,255,255,0.03)' : `${actionColor}15`,
          border: `1px solid ${actionDisabled ? 'rgba(255,255,255,0.05)' : actionColor + '30'}`,
          opacity: actionDisabled ? 0.4 : 1,
        }}
        whileTap={!actionDisabled ? { scale: 0.95 } : {}}
      >
        <ArrowRightLeft size={10} style={{ color: actionDisabled ? '#555' : actionColor }} />
        <span style={{ fontFamily: F, fontSize: 9, color: actionDisabled ? '#555' : actionColor }}>
          {actionLabel}
        </span>
      </motion.button>
    </motion.div>
  );
}
