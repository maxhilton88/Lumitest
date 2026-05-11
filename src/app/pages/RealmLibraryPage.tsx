/**
 * RealmLibraryPage — Video Library inside the Realm Shell.
 * Wraps VideoLibrary with realm-compatible layout (no sidebar).
 * Enforces free/premium daily access limits via useAccessGate.
 */
import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { VideoLibrary } from '../components/parent/VideoLibrary';
import { useAppContext } from '../contexts/AppContext';
import { useRealmContext } from '../contexts/RealmContext';
import { recordDailyActivity } from '../utils/api';
import { useAccessGate, AccessBlockedModal, showGateNudge } from '../components/realm/AccessGate';
import { useLanguage } from '../components/LanguageContext';
import { toast } from 'sonner@2.0.3';
import { systemPause, systemResume } from '../utils/music-service';

export function RealmLibraryPage() {
  const navigate = useNavigate();
  const ctx = useAppContext();
  const realm = useRealmContext();
  const { language } = useLanguage();
  const accessGate = useAccessGate('video');
  const [showAccessBlocked, setShowAccessBlocked] = useState(false);

  // Pause BG music while on the video page, resume when leaving
  useEffect(() => {
    systemPause();
    return () => { systemResume(); };
  }, []);

  const handleVideoWatched = useCallback(() => {
    if (!realm.userId) return;
    recordDailyActivity(realm.userId, 'video').then(result => {
      if (result.accessBlocked) {
        setShowAccessBlocked(true);
      }
      showGateNudge(accessGate.remaining - 1, accessGate.maxPerDay, accessGate.isPaid, 'video', language);
      accessGate.recheck();
    }).catch(err => {
      console.error('[VIDEO] Failed to record daily activity:', err);
    });
  }, [realm.userId, accessGate, language]);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-14 pb-8">
        <VideoLibrary
          parentData={ctx.parentData}
          onVideoWatched={handleVideoWatched}
          onShowUpgrade={() => navigate('/parent/plan')}
        />
      </div>

      <AccessBlockedModal
        isOpen={showAccessBlocked}
        onClose={() => setShowAccessBlocked(false)}
        activityType="video"
        maxPerDay={accessGate.maxPerDay}
        isPaid={accessGate.isPaid}
        onUpgrade={() => navigate('/parent/plan')}
      />
    </div>
  );
}