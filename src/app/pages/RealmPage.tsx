/**
 * RealmPage.tsx — Foxy Realm Hub (index route inside RealmShell)
 *
 * The main game hub with egg/sprite, HUD, actions, and spell menu.
 * Background, particles, loading, and fonts are handled by RealmShell.
 * Stats and assets come from RealmContext.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Box } from 'lucide-react';
import { FoxySprite } from '../components/realm/FoxySprite';
import { RealmHUD } from '../components/realm/RealmHUD';
import { RealmActions } from '../components/realm/RealmActions';
import { FeedAnimation } from '../components/realm/FeedAnimation';
import { SpellMenu } from '../components/realm/SpellMenu';
import { EggHatchBubble } from '../components/realm/EggHatchBubble';
import { SettingsPopup } from '../components/realm/SettingsPopup';
import { DailyQuestsPanel, useDailyLog } from '../components/realm/DailyQuestsPanel';
import { EarnMorePopup } from '../components/realm/EarnMorePopup';
import { useRealmContext } from '../contexts/RealmContext';
import { PartySpiritsCarousel } from '../components/realm/PartySpiritsCarousel';
import { SpiritlabModal } from '../components/realm/SpiritlabModal';
import { isEggHatchedFromStats } from '../utils/hatch';
import { useAccessGate } from '../components/realm/AccessGate';

export function RealmPage() {
  const navigate = useNavigate();
  const { stats, setStats, assets, isLoading, isLandscape, musicOn, toggleMusicFn } = useRealmContext();

  const [feedType, setFeedType] = useState<'food' | 'water' | null>(null);
  const [foxyState, setFoxyState] = useState<'idle' | 'happy' | 'sad' | 'eating'>('idle');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dailyQuestsOpen, setDailyQuestsOpen] = useState(false);
  const [earnMoreType, setEarnMoreType] = useState<'gold' | 'diamond' | null>(null);
  const [spiritlabOpen, setSpiritlabOpen] = useState(false);
  const { log: dailyLog, refresh: refreshDailyLog } = useDailyLog();

  // Access gate for battle button indicator
  const battleGate = useAccessGate('battle');

  // Calculate daily remaining for action bar glow
  const dailyCompleted = ['test','practice','flashcard','video','music','battle'].filter(k => (dailyLog[k]?.count || 0) > 0).length;
  const dailyRemaining = 6 - dailyCompleted;

  // Derive foxy visual state from stats
  React.useEffect(() => {
    if (stats.hunger < 20 && stats.thirst < 20) {
      setFoxyState('sad');
    } else if (stats.hunger > 80 && stats.thirst > 80 && stats.hp > 80) {
      setFoxyState('happy');
    } else {
      setFoxyState('idle');
    }
  }, [stats.hunger, stats.thirst, stats.hp]);

  const handleSettings = useCallback(() => setSettingsOpen(true), []);
  const handleAvatarTap = useCallback(() => navigate('/realm/mastery'), [navigate]);

  const handleFeed = useCallback(() => {
    setFeedType('food');
    setFoxyState('eating');
    setStats(prev => ({ ...prev, hunger: Math.min(100, prev.hunger + 15) }));
    setTimeout(() => {
      setFeedType(null);
      setFoxyState('happy');
      setTimeout(() => setFoxyState('idle'), 2000);
    }, 1500);
  }, [setStats]);

  const handleWater = useCallback(() => {
    setFeedType('water');
    setFoxyState('eating');
    setStats(prev => ({ ...prev, thirst: Math.min(100, prev.thirst + 15) }));
    setTimeout(() => {
      setFeedType(null);
      setFoxyState('happy');
      setTimeout(() => setFoxyState('idle'), 2000);
    }, 1500);
  }, [setStats]);

  const handleBag = useCallback(() => navigate('/realm/bag'), [navigate]);
  const handleQuest = useCallback(() => navigate('/realm/quest'), [navigate]);
  const handleBattle = useCallback(() => navigate('/realm/battle'), [navigate]);
  const handleMusicToggle = useCallback(() => {
    toggleMusicFn();
    console.log('[REALM] Music toggled');
  }, [toggleMusicFn]);

  // hatchStartMs initialization is now handled in RealmContext hydration.
  // No longer needed here — the old useEffect reset the timer on every visit
  // if KV data was lost, preventing the egg from ever hatching.

  // Don't render content while shell is loading
  if (isLoading) return null;

  // Determine egg vs hatched Foxy
  // NOTE: We pass `undefined` for the setHatchStart callback during render
  // to avoid calling setState on RealmProvider while rendering RealmPage.
  // The hatchStartMs initialization is handled in the useEffect above.
  const hatched = isEggHatchedFromStats(stats.hatchStartMs, undefined, stats.evolutionStage);

  // PROMOTE evolutionStage — now handled by RealmContext's hydration auto-promote
  // and tryEvolve() on level-up/battle-win. No direct promotion here.
  // The sprite selection below uses evolutionStage from stats (which is authoritative).

  // Bible v5: egg → baby also requires Level 5 (not just timer)
  const showHatchedSprite = hatched && stats.level >= 5 && stats.evolutionStage !== 'egg';

  const spriteImg = showHatchedSprite
    ? (assets.foxyHatchedImg || assets.foxyEggImg || assets.foxyImg)
    : (assets.foxyEggImg || assets.foxyImg);

  return (
    <div className="absolute inset-0">
      {/* ── HUD ── */}
      <RealmHUD
        stats={stats}
        coinIconUrl={assets.iconCoin}
        diamondIconUrl={assets.iconDiamond}
        onSettings={handleSettings}
        onMusicToggle={handleMusicToggle}
        onAvatarTap={handleAvatarTap}
        onDailyQuestsTap={() => { refreshDailyLog(); setDailyQuestsOpen(true); }}
        onGoldTap={() => setEarnMoreType('gold')}
        onDiamondTap={() => setEarnMoreType('diamond')}
        dailyLog={dailyLog}
        musicOn={musicOn}
        isLandscape={isLandscape}
      />

      {/* ── Spell Menu — magical radial nav on right edge ── */}
      <SpellMenu magicButtonUrl={assets.magicBtnImg} isLandscape={isLandscape} dailyLog={dailyLog} />

      {/* ── Egg Hatch Countdown Bubble (hidden once hatched) ── */}
      {spriteImg && <EggHatchBubble />}

      {/* ── Foxy Sprite ── */}
      {spriteImg && (
        <motion.div
          className="absolute inset-0 flex items-end justify-center"
          style={{ paddingBottom: isLandscape ? '4%' : '26%' }}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        >
          <FoxySprite
            imageUrl={spriteImg}
            state={foxyState}
            isLandscape={isLandscape}
          />
        </motion.div>
      )}

      {/* ── Party Spirits Carousel — swipe to browse party ── */}
      {showHatchedSprite && (
        <div
          className="absolute left-0 right-0 flex justify-center pointer-events-none"
          style={{ bottom: isLandscape ? '12%' : '34%' }}
        >
          <PartySpiritsCarousel isLandscape={isLandscape} />
        </div>
      )}

      {/* Feed Animation */}
      <FeedAnimation type={feedType} />

      {/* ── Action Bar ── */}
      <RealmActions
        onBag={handleBag}
        onBattle={handleBattle}
        onQuest={handleQuest}
        bagIconUrl={assets.iconBag}
        battleIconUrl={assets.iconBattle}
        questIconUrl={assets.iconQuest}
        isLandscape={isLandscape}
        dailyRemaining={dailyRemaining}
        battleGate={{
          remaining: battleGate.remaining,
          maxPerDay: battleGate.maxPerDay,
          isPaid: battleGate.isPaid,
        }}
        onUpgrade={() => navigate('/plan')}
      />

      {/* ── Settings Popup ── */}
      <SettingsPopup
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* ── Daily Quests Panel ── */}
      <DailyQuestsPanel
        isOpen={dailyQuestsOpen}
        onClose={() => setDailyQuestsOpen(false)}
      />

      {/* ── Earn More Popup ── */}
      <EarnMorePopup
        isOpen={earnMoreType !== null}
        type={earnMoreType || 'gold'}
        onClose={() => setEarnMoreType(null)}
      />

      {/* ── Spiritlab Button (top-left, below HUD) ── */}
      {showHatchedSprite && (
        <motion.button
          className="absolute z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{
            top: isLandscape ? 56 : 72,
            left: 12,
            background: 'rgba(10,8,18,0.85)',
            border: '1.5px solid rgba(212,164,74,0.25)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setSpiritlabOpen(true)}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Box size={14} style={{ color: '#d4a44a' }} />
          <span style={{ fontFamily: "'Cherry Bomb One', cursive", fontSize: 10, color: '#d4a44a' }}>
            Spiritlab
          </span>
          {(stats.spiritlab?.length || 0) > 0 && (
            <span className="px-1 py-0.5 rounded-full text-[8px] font-bold" style={{
              background: 'rgba(212,164,74,0.2)', color: '#d4a44a',
            }}>
              {stats.spiritlab?.length}
            </span>
          )}
        </motion.button>
      )}

      {/* ── Spiritlab Modal ── */}
      <SpiritlabModal open={spiritlabOpen} onClose={() => setSpiritlabOpen(false)} />
    </div>
  );
}