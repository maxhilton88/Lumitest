import { useCallback, useRef, useEffect } from 'react';

/**
 * Singleton AudioContext — reused across all sound effect calls.
 * Creating a new AudioContext per call leaks ~2-5MB each on Chrome
 * and Chrome limits you to ~6 before degrading.
 */
let sharedAudioContext: AudioContext | null = null;

async function getAudioContext(): Promise<AudioContext> {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browsers suspend until user gesture) — must await!
  if (sharedAudioContext.state === 'suspended') {
    await sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

export const useSoundEffects = () => {
  // Track if component is mounted to avoid playing after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const playCorrectSound = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const audioContext = await getAudioContext();

      // Play a happy ascending arpeggio
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const startTime = audioContext.currentTime + (index * 0.1);
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);

        // Disconnect nodes after they're done to free graph memory
        oscillator.onended = () => {
          oscillator.disconnect();
          gainNode.disconnect();
        };
      });

      // Add a celebratory "ding" at the end
      const dingDelay = 0.4;
      const ding = audioContext.createOscillator();
      const dingGain = audioContext.createGain();

      ding.connect(dingGain);
      dingGain.connect(audioContext.destination);

      ding.frequency.value = 1568; // G6
      ding.type = 'sine';

      const dingStart = audioContext.currentTime + dingDelay;
      dingGain.gain.setValueAtTime(0.4, dingStart);
      dingGain.gain.exponentialRampToValueAtTime(0.01, dingStart + 0.5);

      ding.start(dingStart);
      ding.stop(dingStart + 0.5);

      ding.onended = () => {
        ding.disconnect();
        dingGain.disconnect();
      };
    } catch (e) {
      // Silently ignore audio errors (e.g. no audio device)
      console.warn('[SFX] playCorrectSound error:', e);
    }
  }, []);

  const playWrongSound = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const audioContext = await getAudioContext();

      // Create noise for explosion effect
      const bufferSize = audioContext.sampleRate * 0.5;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = audioContext.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 1000;

      const noiseGain = audioContext.createGain();
      noiseGain.gain.setValueAtTime(0.5, audioContext.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioContext.destination);

      noise.start();
      noise.stop(audioContext.currentTime + 0.5);

      noise.onended = () => {
        noise.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
      };

      // Add a descending "whomp" sound
      const whomp = audioContext.createOscillator();
      const whompGain = audioContext.createGain();

      whomp.connect(whompGain);
      whompGain.connect(audioContext.destination);

      whomp.frequency.setValueAtTime(200, audioContext.currentTime);
      whomp.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
      whomp.type = 'sawtooth';

      whompGain.gain.setValueAtTime(0.4, audioContext.currentTime);
      whompGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      whomp.start();
      whomp.stop(audioContext.currentTime + 0.3);

      whomp.onended = () => {
        whomp.disconnect();
        whompGain.disconnect();
      };
    } catch (e) {
      // Silently ignore audio errors
      console.warn('[SFX] playWrongSound error:', e);
    }
  }, []);

  return { playCorrectSound, playWrongSound };
};

/**
 * playMenuSelect — RPG-style menu select "pip" sound.
 * Standalone async function (no React hook needed) so any component can import & call it.
 * Two layered oscillators: a sine hit with slight pitch drop + a sparkly triangle overtone.
 * ~100ms total, low volume — feels like a classic JRPG cursor/select SFX.
 */
export async function playMenuSelect(): Promise<void> {
  try {
    const ctx = await getAudioContext();
    const now = ctx.currentTime;

    // ── Main tone: sine 880→700 Hz, 90ms ──
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.setValueAtTime(880, now);
    main.frequency.exponentialRampToValueAtTime(700, now + 0.09);
    mainGain.gain.setValueAtTime(0.18, now);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    main.connect(mainGain).connect(ctx.destination);
    main.start(now);
    main.stop(now + 0.1);
    main.onended = () => { main.disconnect(); mainGain.disconnect(); };

    // ── Sparkle overtone: triangle 1760→1200 Hz, 70ms ──
    const sparkle = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkle.type = 'triangle';
    sparkle.frequency.setValueAtTime(1760, now);
    sparkle.frequency.exponentialRampToValueAtTime(1200, now + 0.07);
    sparkleGain.gain.setValueAtTime(0.08, now);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    sparkle.connect(sparkleGain).connect(ctx.destination);
    sparkle.start(now);
    sparkle.stop(now + 0.07);
    sparkle.onended = () => { sparkle.disconnect(); sparkleGain.disconnect(); };
  } catch {
    // Silently ignore audio errors (no audio device, suspended context, etc.)
  }
}