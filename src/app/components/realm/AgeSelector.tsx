/**
 * AgeSelector.tsx — RPG-style inline age/difficulty selector
 *
 * Uses a single dropdown instead of a 9-tile grid so content is bigger
 * and less crowded. Actual age is highlighted as "Recommended".
 * Displays a "Potential Loot" preview for the selected age.
 *
 * Cherry Bomb One for headings, Cinzel Decorative for stat numbers.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Zap, Shield, ChevronRight, ChevronDown, Loader2, Crown, Sparkles } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { fetchRewardConfig } from '../../utils/api';
import { getLootPreview, DEFAULT_REWARD_CONFIG } from '../../types/reward-config';
import type { RealmRewardConfig } from '../../types/reward-config';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';

interface AgeSelectorProps {
  actualAge: number;
  questionCount?: number;
  onSelect: (age: number) => void;
  onBack?: () => void;
}

const AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

// Tier color scheme — higher ages get warmer/more epic colors
const AGE_TIERS: Record<number, { color: string; glow: string; label: string }> = {
  4:  { color: '#7cc643', glow: 'rgba(124,198,67,0.3)',  label: 'Seedling' },
  5:  { color: '#4ecdc4', glow: 'rgba(78,205,196,0.3)',  label: 'Sprout' },
  6:  { color: '#4a90e2', glow: 'rgba(74,144,226,0.3)',  label: 'Scout' },
  7:  { color: '#a78bfa', glow: 'rgba(167,139,250,0.3)', label: 'Explorer' },
  8:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  label: 'Knight' },
  9:  { color: '#f97316', glow: 'rgba(249,115,22,0.3)',  label: 'Champion' },
  10: { color: '#ef4444', glow: 'rgba(239,68,68,0.3)',   label: 'Hero' },
  11: { color: '#ec4899', glow: 'rgba(236,72,153,0.3)',  label: 'Legend' },
  12: { color: '#ffd700', glow: 'rgba(255,215,0,0.4)',   label: 'Grandmaster' },
};

function GoldCoinSmall() {
  return (
    <div
      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: 'linear-gradient(135deg, #ffd700, #ff9800)',
        border: '1px solid #b8860b',
        boxShadow: '0 1px 3px rgba(255,215,0,0.3)',
      }}
    >
      <span style={{ fontFamily: F, fontSize: 7, color: '#5c3d00', lineHeight: 1 }}>G</span>
    </div>
  );
}

export function AgeSelector({ actualAge, questionCount = 10, onSelect, onBack }: AgeSelectorProps) {
  const { t, language } = useLanguage();
  const [config, setConfig] = useState<RealmRewardConfig>(DEFAULT_REWARD_CONFIG);
  const [selectedAge, setSelectedAge] = useState(actualAge);
  const [isLoading, setIsLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const fetched = await fetchRewardConfig();
        if (fetched) setConfig(fetched);
      } catch (err) {
        console.error('[AGE-SELECTOR] Failed to load reward config:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const preview = useMemo(() => getLootPreview(config, selectedAge, questionCount), [config, selectedAge, questionCount]);
  const isChallenge = selectedAge > actualAge;
  const selectedTier = AGE_TIERS[selectedAge];

  const titleText = language === 'en' ? 'Choose Your Challenge'
    : language === 'ms' ? 'Pilih Cabaran Anda'
    : '\u9009\u62e9\u4f60\u7684\u6311\u6218';

  const recText = language === 'en' ? 'Recommended'
    : language === 'ms' ? 'Disyorkan'
    : '\u63a8\u8350';

  const startText = language === 'en' ? 'Begin Challenge!'
    : language === 'ms' ? 'Mula Cabaran!'
    : '\u5f00\u59cb\u6311\u6218\uff01';

  const selectLabel = language === 'en' ? 'Difficulty Level'
    : language === 'ms' ? 'Tahap Kesukaran'
    : '\u96be\u5ea6\u7b49\u7ea7';

  const ageWord = language === 'en' ? 'Age' : language === 'ms' ? 'Umur' : '\u5e74\u9f84';

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      {/* Title */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 style={{ fontFamily: F, fontSize: 24, color: '#ffd700', textShadow: '0 2px 12px rgba(255,215,0,0.3)' }}>
          {titleText}
        </h2>
        <p style={{ fontFamily: F, fontSize: 13, color: '#c8b88a', marginTop: 6, opacity: 0.7 }}>
          {language === 'en' ? 'Higher age = harder questions = bigger loot!'
            : language === 'ms' ? 'Umur tinggi = soalan susah = ganjaran besar!'
            : '\u5e74\u9f84\u8d8a\u9ad8 = \u95ee\u9898\u8d8a\u96be = \u5956\u52b1\u8d8a\u5927\uff01'}
        </p>
      </motion.div>

      {/* ── Dropdown selector ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-5"
      >
        <p className="font-bold uppercase tracking-wider mb-2 px-1"
          style={{ color: 'rgba(200,184,138,0.55)', fontFamily: F, fontSize: 12 }}>
          {selectLabel}
        </p>

        <div ref={dropdownRef} className="relative">
          {/* Selected display / trigger */}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full rounded-xl px-4 py-4 flex items-center gap-3.5 transition-all"
            style={{
              background: `linear-gradient(135deg, ${selectedTier.color}15, ${selectedTier.color}08)`,
              border: `2px solid ${selectedTier.color}80`,
              boxShadow: `0 0 20px ${selectedTier.glow}, 0 4px 16px rgba(0,0,0,0.3)`,
            }}
          >
            {/* Age badge */}
            <div
              className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${selectedTier.color}30, ${selectedTier.color}15)`,
                border: `1.5px solid ${selectedTier.color}60`,
              }}
            >
              <span style={{ fontFamily: F, fontSize: 24, color: selectedTier.color, lineHeight: 1 }}>
                {selectedAge}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 text-left">
              <p style={{ fontFamily: F, fontSize: 11, color: `${selectedTier.color}88`, marginBottom: 1 }}>
                {ageWord} {selectedAge}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontFamily: F, fontSize: 17, color: selectedTier.color }}>
                  {selectedTier.label}
                </span>
                {selectedAge === actualAge && (
                  <span
                    className="px-2 py-0.5 rounded-full font-bold"
                    style={{ fontSize: 9, background: `${selectedTier.color}25`, color: selectedTier.color, border: `1px solid ${selectedTier.color}40` }}
                  >
                    ★ {recText}
                  </span>
                )}
                {isChallenge && (
                  <span
                    className="px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5"
                    style={{ fontSize: 9, background: 'rgba(255,215,0,0.12)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.2)' }}
                  >
                    <Crown className="w-3 h-3" /> Challenge
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#ffd700aa', fontFamily: F }}>
                  <GoldCoinSmall /> {getLootPreview(config, selectedAge, questionCount).maxGold}
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#22c55eaa', fontFamily: F }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: '#22c55e' }} /> {getLootPreview(config, selectedAge, questionCount).maxXp}
                </span>
              </div>
            </div>

            {/* Chevron */}
            <motion.div
              animate={{ rotate: dropdownOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-6 h-6" style={{ color: selectedTier.color }} />
            </motion.div>
          </button>

          {/* Dropdown list */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                className="absolute top-full left-0 right-0 z-50 mt-2 rounded-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,16,10,0.98), rgba(12,8,4,0.99))',
                  border: '1.5px solid rgba(212,164,74,0.25)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 20px rgba(212,164,74,0.08)',
                  maxHeight: 380,
                  overflowY: 'auto',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(212,164,74,0.2) transparent',
                }}
                initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                {AGES.map((age) => {
                  const tier = AGE_TIERS[age];
                  const isActual = age === actualAge;
                  const isSelected = age === selectedAge;
                  const loot = getLootPreview(config, age, questionCount);

                  return (
                    <button
                      key={age}
                      onClick={() => {
                        setSelectedAge(age);
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors"
                      style={{
                        background: isSelected
                          ? `${tier.color}12`
                          : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = `${tier.color}08`;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Age number */}
                      <div
                        className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0"
                        style={{
                          background: isSelected ? `${tier.color}20` : 'rgba(255,255,255,0.03)',
                          border: `1.5px solid ${isSelected ? tier.color : `${tier.color}30`}`,
                        }}
                      >
                        <span style={{
                          fontFamily: F,
                          fontSize: 20,
                          color: isSelected ? tier.color : `${tier.color}aa`,
                          lineHeight: 1,
                        }}>
                          {age}
                        </span>
                      </div>

                      {/* Label + badges */}
                      <div className="flex-1 text-left min-w-0">
                        <p style={{
                          fontFamily: F,
                          fontSize: 10,
                          color: isSelected ? `${tier.color}99` : `${tier.color}55`,
                          marginBottom: 1,
                        }}>
                          {ageWord} {age} {language === 'en' ? 'years old' : language === 'ms' ? 'tahun' : '\u5c81'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span style={{
                            fontFamily: F,
                            fontSize: 15,
                            color: isSelected ? tier.color : `${tier.color}cc`,
                          }}>
                            {tier.label}
                          </span>
                          {isActual && (
                            <span
                              className="px-1.5 py-0.5 rounded font-bold"
                              style={{ fontSize: 8, background: `${tier.color}20`, color: tier.color }}
                            >
                              ★ {recText}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Loot preview */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="flex items-center gap-1 font-bold" style={{ fontSize: 12, color: '#ffd700aa', fontFamily: F }}>
                          <GoldCoinSmall /> {loot.maxGold}
                        </span>
                        <span className="flex items-center gap-1 font-bold" style={{ fontSize: 12, color: '#22c55eaa', fontFamily: F }}>
                          <Zap className="w-3.5 h-3.5" /> {loot.maxXp}
                        </span>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: tier.color }}>
                          <span style={{ fontSize: 12, color: '#1a1000' }}>✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Potential Loot Preview ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedAge}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl p-5 mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(18,14,10,0.95), rgba(28,22,14,0.98))',
            border: `1.5px solid ${selectedTier.color}30`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontFamily: F, fontSize: 13, color: '#c8b88a', letterSpacing: '0.08em' }}>
              {language === 'en' ? 'POTENTIAL LOOT' : language === 'ms' ? 'GANJARAN POTENSI' : '\u6f5c\u5728\u5956\u52b1'}
            </span>
            {isChallenge && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <Crown className="w-3 h-3" style={{ color: '#ffd700' }} />
                <span style={{ fontFamily: F, fontSize: 9, color: '#ffd700' }}>
                  {language === 'en' ? 'Challenge Zone' : language === 'ms' ? 'Zon Cabaran' : '\u6311\u6218\u533a'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-10">
            {/* XP */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6" style={{ color: '#22c55e', filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.4))' }} />
                <span style={{
                  fontFamily: F,
                  fontSize: 28,
                  color: '#22c55e',
                  textShadow: '0 0 12px rgba(34,197,94,0.3)',
                }}>
                  +{preview.maxXp}
                </span>
              </div>
              <span style={{ fontFamily: F, fontSize: 11, color: '#22c55e88' }}>XP</span>
            </div>

            {/* Divider */}
            <div className="w-px h-12" style={{ background: 'rgba(200,184,138,0.15)' }} />

            {/* Gold */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <GoldCoinSmall />
                <span style={{
                  fontFamily: F,
                  fontSize: 28,
                  color: '#ffd700',
                  textShadow: '0 0 12px rgba(255,215,0,0.3)',
                }}>
                  +{preview.maxGold}
                </span>
              </div>
              <span style={{ fontFamily: F, fontSize: 11, color: '#ffd70088' }}>Gold</span>
            </div>
          </div>

          <p style={{ fontFamily: F, fontSize: 10, color: '#8a7e6a', textAlign: 'center', marginTop: 10 }}>
            {language === 'en' ? '* At 100% accuracy with all questions correct'
              : language === 'ms' ? '* Pada ketepatan 100% dengan semua soalan betul'
              : '* \u5728100%\u51c6\u786e\u7387\u4e0b\u6240\u6709\u95ee\u9898\u6b63\u786e'}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Start button */}
      <motion.button
        onClick={() => onSelect(selectedAge)}
        className="w-full py-4 rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${selectedTier.color} 0%, ${GOLD} 100%)`,
          border: '2.5px solid #ffeaa7',
          boxShadow: `0 4px 24px ${selectedTier.glow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: '#2a1f0e' }} />
          <span style={{
            fontFamily: F,
            fontSize: 18,
            color: '#2a1f0e',
            textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            letterSpacing: '0.05em',
          }}>
            {startText}
          </span>
        </div>
        <p style={{ fontFamily: F, fontSize: 11, color: '#5c3d00', marginTop: 3, opacity: 0.7, textAlign: 'center' }}>
          {language === 'en' ? `Age ${selectedAge} — ${selectedTier.label}`
            : language === 'ms' ? `Umur ${selectedAge} — ${selectedTier.label}`
            : `\u5e74\u9f84 ${selectedAge} — ${selectedTier.label}`}
        </p>
      </motion.button>
    </div>
  );
}