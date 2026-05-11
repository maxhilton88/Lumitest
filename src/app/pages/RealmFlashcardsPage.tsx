/**
 * RealmFlashcardsPage — Flashcard mode inside the Realm Shell.
 * Enforces free/premium daily access limits via useAccessGate.
 * Bible v5: Flashcard rewards age-gated to 4-6 only (7+ gets 0g/0xp).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { FlashcardMode } from '../components/flashcards/FlashcardMode';
import { useAppContext } from '../contexts/AppContext';
import { useRealmContext } from '../contexts/RealmContext';
import { recordDailyActivity, fetchRewardConfig } from '../utils/api';
import { useAccessGate, AccessBlockedModal, showGateNudge } from '../components/realm/AccessGate';
import { useLanguage } from '../components/LanguageContext';
import { isAgeEligibleForReward, DEFAULT_REWARD_CONFIG } from '../types/reward-config';
import type { RealmRewardConfig } from '../types/reward-config';

export function RealmFlashcardsPage() {
  const navigate = useNavigate();
  const ctx = useAppContext();
  const realm = useRealmContext();
  const { language } = useLanguage();
  const accessGate = useAccessGate('flashcard');
  const [showAccessBlocked, setShowAccessBlocked] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [rewardConfig, setRewardConfig] = useState<RealmRewardConfig>(DEFAULT_REWARD_CONFIG);

  // Load reward config for age gate check
  useEffect(() => {
    fetchRewardConfig().then(c => { if (c) setRewardConfig(c); }).catch(() => {});
  }, []);

  const childAge = ctx.age || realm.stats.age || 5;
  const ageEligible = useMemo(
    () => isAgeEligibleForReward(rewardConfig, 'flashcard', childAge),
    [rewardConfig, childAge]
  );

  const handleComplete = useCallback(() => {
    if (recorded || !realm.userId) return;
    setRecorded(true);

    // Record daily activity (always — for access counting + parent dashboard)
    recordDailyActivity(realm.userId, 'flashcard').then(result => {
      if (result.accessBlocked) {
        setShowAccessBlocked(true);
        return;
      }

      // Apply rewards ONLY if age-eligible (Bible v5: ages 4-6 only)
      if (ageEligible) {
        const goldEarned = result.goldAwarded || 0;
        const xpEarned = result.xpAwarded || 0;
        if (goldEarned > 0) realm.addGold(goldEarned);
        if (xpEarned > 0) realm.addXP(xpEarned);
        if (goldEarned > 0 || xpEarned > 0) realm.flushStats();
        console.log(`[FLASHCARD] Age ${childAge} eligible — rewards applied: +${goldEarned}g, +${xpEarned}xp`);
      } else {
        console.log(`[FLASHCARD] Age ${childAge} NOT eligible for rewards (age gate: ${rewardConfig.activities.flashcard.ageMin}-${rewardConfig.activities.flashcard.ageMax})`);
      }

      showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'flashcard', language);
      accessGate.recheck();
    }).catch(err => {
      console.error('[FLASHCARD] Failed to record daily activity:', err);
      setRecorded(false);
    });
  }, [realm.userId, recorded, accessGate, ageEligible, childAge, rewardConfig, realm, language]);

  // Pre-check: if already at limit, show modal immediately
  React.useEffect(() => {
    if (!accessGate.checking && !accessGate.canAccess) {
      setShowAccessBlocked(true);
    }
  }, [accessGate.checking, accessGate.canAccess]);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-14 pb-8">
        {/* Gate: show loading spinner while access check is in flight */}
        {accessGate.checking ? (
          <div className="flex flex-col items-center justify-center pt-32 gap-4">
            <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#d4a44a', borderTopColor: 'transparent' }} />
            <p style={{ fontFamily: "'Cherry Bomb One', cursive", fontSize: 13, color: '#d4a44a', opacity: 0.7 }}>Loading...</p>
          </div>
        ) : (
          <FlashcardMode
            parentData={ctx.parentData}
            onComplete={handleComplete}
          />
        )}
      </div>

      <AccessBlockedModal
        isOpen={showAccessBlocked}
        onClose={() => setShowAccessBlocked(false)}
        activityType="flashcard"
        maxPerDay={accessGate.maxPerDay}
        isPaid={accessGate.isPaid}
        onUpgrade={() => navigate('/parent/plan')}
      />
    </div>
  );
}