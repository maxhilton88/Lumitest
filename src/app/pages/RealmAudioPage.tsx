/**
 * RealmAudioPage — Audio Library inside the Realm Shell.
 * Wraps AudioLibrary with realm-compatible layout.
 * Enforces free/premium daily access limits via useAccessGate.
 */
import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AudioLibrary } from '../components/parent/AudioLibrary';
import { useAppContext } from '../contexts/AppContext';
import { useRealmContext } from '../contexts/RealmContext';
import { recordDailyActivity } from '../utils/api';
import { useAccessGate, AccessBlockedModal, showGateNudge } from '../components/realm/AccessGate';
import { useLanguage } from '../components/LanguageContext';
import { systemPause, systemResume } from '../utils/music-service';

export function RealmAudioPage() {
  const navigate = useNavigate();
  const ctx = useAppContext();
  const realm = useRealmContext();
  const { language } = useLanguage();
  const accessGate = useAccessGate('music');
  const [showAccessBlocked, setShowAccessBlocked] = useState(false);

  // Pause BG music while on the audio page, resume when leaving
  useEffect(() => {
    systemPause();
    return () => { systemResume(); };
  }, []);

  const handleTrackComplete = useCallback(() => {
    if (!realm.userId) return;
    recordDailyActivity(realm.userId, 'music').then(result => {
      if (result.accessBlocked) {
        setShowAccessBlocked(true);
      }
      showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'music', language);
      accessGate.recheck();
    }).catch(err => {
      console.error('[MUSIC] Failed to record daily activity:', err);
    });
  }, [realm.userId, accessGate, language]);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-14 pb-8">
        <AudioLibrary
          parentData={ctx.parentData}
          onTrackComplete={handleTrackComplete}
          onShowUpgrade={() => navigate('/parent/plan')}
        />
      </div>

      <AccessBlockedModal
        isOpen={showAccessBlocked}
        onClose={() => setShowAccessBlocked(false)}
        activityType="music"
        maxPerDay={accessGate.maxPerDay}
        isPaid={accessGate.isPaid}
        onUpgrade={() => navigate('/parent/plan')}
      />
    </div>
  );
}