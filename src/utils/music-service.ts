/**
 * music-service.ts — Global RPG background music controller.
 *
 * Single audio element persists across all screens. Preference is stored
 * in localStorage so it survives page reloads. Components can subscribe
 * to state changes via `subscribe()`.
 *
 * Usage:
 *   import { playMusic, pauseMusic, ... } from '../utils/music-service';
 */

const MUSIC_URL =
  'https://zrtbjefoaennvtlcneal.supabase.co/storage/v1/object/public/music/Quest%20of%20the%20Little%20Stars.mp3';
const LS_KEY = 'foxy_music_enabled';

// ── Singleton audio element ──
let audio: HTMLAudioElement | null = null;
let playing = false;
// Track whether music was playing before a temporary pause (e.g. video section)
let pausedBySystem = false;
// Track whether music was playing before the screen went off (visibilitychange)
let pausedByVisibility = false;

type Listener = (isPlaying: boolean) => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn(playing));
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.volume = 0.25;
    audio.preload = 'metadata';
  }
  return audio;
}

// ── Public API ──

/** Whether the user has enabled music (persisted preference). Defaults to ON. */
export function isMusicEnabled(): boolean {
  const stored = localStorage.getItem(LS_KEY);
  return stored === null ? true : stored === '1';
}

export function setMusicEnabled(enabled: boolean) {
  localStorage.setItem(LS_KEY, enabled ? '1' : '0');
  if (enabled) {
    playMusic();
  } else {
    pauseMusic();
  }
}

export function isMusicPlaying(): boolean {
  return playing;
}

export function playMusic() {
  if (playing) return;
  const a = getAudio();
  a.play()
    .then(() => {
      playing = true;
      pausedBySystem = false;
      pausedByVisibility = false;
      notify();
    })
    .catch((err) => {
      console.warn('[Music] Auto-play blocked by browser:', err.message);
    });
}

export function pauseMusic() {
  if (!playing) return;
  const a = getAudio();
  a.pause();
  playing = false;
  notify();
}

export function toggleMusic() {
  if (playing) {
    pauseMusic();
    setMusicEnabled(false);
  } else {
    setMusicEnabled(true); // this calls playMusic internally
  }
}

/**
 * Temporarily pause music (e.g. when entering Video section).
 * Call `resumeMusic()` to restore playback if it was previously playing.
 */
export function systemPause() {
  if (playing) {
    pausedBySystem = true;
    const a = getAudio();
    a.pause();
    playing = false;
    notify();
  }
}

/**
 * Resume music after a `systemPause()`, but only if music was playing
 * before the pause AND the user preference is still enabled.
 */
export function systemResume() {
  if (pausedBySystem && isMusicEnabled()) {
    pausedBySystem = false;
    playMusic();
  }
}

/**
 * Pause music when the screen goes off (visibilitychange).
 * Call `resumeMusic()` to restore playback if it was previously playing.
 */
export function visibilityPause() {
  if (playing) {
    pausedByVisibility = true;
    const a = getAudio();
    a.pause();
    playing = false;
    notify();
  }
}

/**
 * Resume music after a `visibilityPause()`, but only if music was playing
 * before the pause AND the user preference is still enabled.
 */
export function visibilityResume() {
  if (pausedByVisibility && isMusicEnabled()) {
    pausedByVisibility = false;
    playMusic();
  }
}

/** Subscribe to playing-state changes. Returns an unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Auto-pause/resume on screen visibility change ──
// When the phone screen goes off or the tab is hidden, pause the RPG music.
// When the screen comes back, resume if it was playing before.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      visibilityPause();
    } else {
      visibilityResume();
    }
  });
}