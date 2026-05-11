/**
 * battle-sfx.ts — 3-layer battle audio system for Foxy Adventure
 *
 * Layer 1: Battle BGM (separate from overworld, auto-swaps on enter/exit)
 * Layer 2: Combat SFX (hit, crit, shield, miss, KO)
 * Layer 3: UI SFX (menu select, timer tick, answer correct/wrong)
 *
 * All SFX are synthesized via Web Audio API (no external files needed).
 * Reuses the singleton AudioContext pattern from useSoundEffects.ts.
 *
 * Usage:
 *   import { startBattleBGM, stopBattleBGM, playSfx } from './battle-sfx';
 *   startBattleBGM();  // on battle start (auto-pauses overworld music)
 *   playSfx('hit');     // on correct answer + damage
 *   stopBattleBGM();   // on battle end (auto-resumes overworld music)
 */

import { systemPause, systemResume } from './music-service';

// ── Singleton AudioContext ──
let ctx: AudioContext | null = null;

async function getCtx(): Promise<AudioContext> {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

// ── Battle BGM (Layer 1) ──
// Procedural battle loop using oscillators (dramatic minor-key arpeggio)
let bgmNodes: { gainNode: GainNode; oscillators: OscillatorNode[] } | null = null;
let bgmPlaying = false;

const BATTLE_BGM_VOLUME = 0.08;

export async function startBattleBGM(): Promise<void> {
  if (bgmPlaying) return;

  // Pause overworld music
  systemPause();

  try {
    const ac = await getCtx();
    const masterGain = ac.createGain();
    masterGain.gain.setValueAtTime(0, ac.currentTime);
    masterGain.gain.linearRampToValueAtTime(BATTLE_BGM_VOLUME, ac.currentTime + 0.5);
    masterGain.connect(ac.destination);

    const oscillators: OscillatorNode[] = [];

    // Bass drone (A2 = 110Hz)
    const bass = ac.createOscillator();
    const bassGain = ac.createGain();
    bass.type = 'sawtooth';
    bass.frequency.value = 110;
    bassGain.gain.value = 0.4;
    bass.connect(bassGain).connect(masterGain);
    bass.start();
    oscillators.push(bass);

    // Pulse rhythm (minor arpeggio: A3, C4, E4, A4)
    const notes = [220, 261.63, 329.63, 440];
    const pulseGain = ac.createGain();
    pulseGain.gain.value = 0.25;
    pulseGain.connect(masterGain);

    const pulse = ac.createOscillator();
    pulse.type = 'square';
    pulse.frequency.value = notes[0];
    pulse.connect(pulseGain);

    // Modulate the pulse note every beat (BPM ~140)
    const beatInterval = 60 / 140;
    const loopDuration = notes.length * beatInterval;
    const now = ac.currentTime;
    // Schedule note changes for 60 seconds (enough for any battle)
    for (let t = 0; t < 60; t += beatInterval) {
      const noteIdx = Math.floor(t / beatInterval) % notes.length;
      pulse.frequency.setValueAtTime(notes[noteIdx], now + t);
    }
    pulse.start();
    oscillators.push(pulse);

    // High tension pad (E5 + F5 minor second for tension)
    const pad1 = ac.createOscillator();
    const pad2 = ac.createOscillator();
    const padGain = ac.createGain();
    pad1.type = 'sine';
    pad2.type = 'sine';
    pad1.frequency.value = 659.25; // E5
    pad2.frequency.value = 698.46; // F5 (minor second = tension)
    padGain.gain.value = 0.08;
    pad1.connect(padGain).connect(masterGain);
    pad2.connect(padGain);
    pad1.start();
    pad2.start();
    oscillators.push(pad1, pad2);

    bgmNodes = { gainNode: masterGain, oscillators };
    bgmPlaying = true;
    console.log('[BATTLE-SFX] BGM started');
  } catch (err) {
    console.warn('[BATTLE-SFX] Failed to start BGM:', err);
  }
}

export function stopBattleBGM(): void {
  if (!bgmPlaying || !bgmNodes) return;

  try {
    const ac = ctx;
    if (ac) {
      // Fade out
      bgmNodes.gainNode.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3);
      // Stop oscillators after fade
      setTimeout(() => {
        bgmNodes?.oscillators.forEach(osc => {
          try { osc.stop(); osc.disconnect(); } catch {}
        });
        bgmNodes?.gainNode.disconnect();
        bgmNodes = null;
      }, 400);
    }
  } catch {}

  bgmPlaying = false;

  // Resume overworld music
  systemResume();
  console.log('[BATTLE-SFX] BGM stopped');
}

export function isBattleBGMPlaying(): boolean {
  return bgmPlaying;
}

// ── Combat SFX (Layer 2) ──

export type BattleSfxType =
  | 'hit'           // normal hit (correct answer → damage)
  | 'critical'      // critical/speed-bonus hit
  | 'shield'        // shield block (reduced damage)
  | 'miss'          // miss/fizzle (wrong answer)
  | 'counter'       // opponent counter-attack
  | 'ko'            // KO (battle end)
  | 'timer_tick'    // timer countdown tick
  | 'timer_urgent'  // timer < 3s warning
  | 'victory'       // battle won
  | 'defeat'        // battle lost
  | 'select'        // skill/menu selection
  | 'heal'          // HP heal from bag item
  | 'catch_success' // Lumicore catch succeeded
  | 'catch_fail';   // Lumicore catch failed

export async function playSfx(type: BattleSfxType): Promise<void> {
  try {
    const ac = await getCtx();
    const now = ac.currentTime;

    switch (type) {
      case 'hit': {
        // Impact: low thud + high ping
        const thud = ac.createOscillator();
        const thudGain = ac.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(150, now);
        thud.frequency.exponentialRampToValueAtTime(60, now + 0.15);
        thudGain.gain.setValueAtTime(0.35, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        thud.connect(thudGain).connect(ac.destination);
        thud.start(now); thud.stop(now + 0.2);
        thud.onended = () => { thud.disconnect(); thudGain.disconnect(); };

        const ping = ac.createOscillator();
        const pingGain = ac.createGain();
        ping.type = 'triangle';
        ping.frequency.setValueAtTime(1200, now);
        ping.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        pingGain.gain.setValueAtTime(0.15, now);
        pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        ping.connect(pingGain).connect(ac.destination);
        ping.start(now); ping.stop(now + 0.12);
        ping.onended = () => { ping.disconnect(); pingGain.disconnect(); };
        break;
      }

      case 'critical': {
        // Bigger hit: chord crash + sparkle
        const freqs = [200, 400, 800];
        freqs.forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = i === 0 ? 'sawtooth' : 'triangle';
          o.frequency.setValueAtTime(f, now);
          o.frequency.exponentialRampToValueAtTime(f * 0.5, now + 0.25);
          g.gain.setValueAtTime(0.2, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          o.connect(g).connect(ac.destination);
          o.start(now); o.stop(now + 0.3);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        // Sparkle overtone
        const sp = ac.createOscillator();
        const spG = ac.createGain();
        sp.type = 'sine';
        sp.frequency.setValueAtTime(2400, now + 0.05);
        sp.frequency.exponentialRampToValueAtTime(1600, now + 0.2);
        spG.gain.setValueAtTime(0.1, now + 0.05);
        spG.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        sp.connect(spG).connect(ac.destination);
        sp.start(now + 0.05); sp.stop(now + 0.2);
        sp.onended = () => { sp.disconnect(); spG.disconnect(); };
        break;
      }

      case 'shield': {
        // Metallic clang
        const clang = ac.createOscillator();
        const clangGain = ac.createGain();
        clang.type = 'square';
        clang.frequency.setValueAtTime(600, now);
        clang.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        clangGain.gain.setValueAtTime(0.15, now);
        clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        clang.connect(clangGain).connect(ac.destination);
        clang.start(now); clang.stop(now + 0.2);
        clang.onended = () => { clang.disconnect(); clangGain.disconnect(); };
        break;
      }

      case 'miss': {
        // Whoosh + descending puff
        const bufSize = ac.sampleRate * 0.2;
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        const noise = ac.createBufferSource();
        noise.buffer = buf;
        const filt = ac.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 2000;
        filt.Q.value = 1;
        const nG = ac.createGain();
        nG.gain.setValueAtTime(0.2, now);
        nG.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        noise.connect(filt).connect(nG).connect(ac.destination);
        noise.start(now); noise.stop(now + 0.25);
        noise.onended = () => { noise.disconnect(); filt.disconnect(); nG.disconnect(); };
        break;
      }

      case 'counter': {
        // Double hit: two quick thuds
        [0, 0.12].forEach(delay => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(180, now + delay);
          o.frequency.exponentialRampToValueAtTime(80, now + delay + 0.1);
          g.gain.setValueAtTime(0.25, now + delay);
          g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
          o.connect(g).connect(ac.destination);
          o.start(now + delay); o.stop(now + delay + 0.15);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }

      case 'ko': {
        // Dramatic descending chord
        const koFreqs = [400, 300, 200, 100];
        koFreqs.forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(f, now + i * 0.15);
          o.frequency.exponentialRampToValueAtTime(f * 0.3, now + i * 0.15 + 0.4);
          g.gain.setValueAtTime(0.2, now + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
          o.connect(g).connect(ac.destination);
          o.start(now + i * 0.15); o.stop(now + i * 0.15 + 0.5);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }

      case 'timer_tick': {
        // Soft click
        const tick = ac.createOscillator();
        const tickG = ac.createGain();
        tick.type = 'sine';
        tick.frequency.value = 1000;
        tickG.gain.setValueAtTime(0.08, now);
        tickG.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        tick.connect(tickG).connect(ac.destination);
        tick.start(now); tick.stop(now + 0.04);
        tick.onended = () => { tick.disconnect(); tickG.disconnect(); };
        break;
      }

      case 'timer_urgent': {
        // Urgent double beep
        [0, 0.08].forEach(d => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'square';
          o.frequency.value = 1500;
          g.gain.setValueAtTime(0.12, now + d);
          g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.06);
          o.connect(g).connect(ac.destination);
          o.start(now + d); o.stop(now + d + 0.06);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }

      case 'victory': {
        // Triumphant ascending fanfare: C5 → E5 → G5 → C6
        const fanfare = [523, 659, 784, 1047];
        fanfare.forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          const t = now + i * 0.15;
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          o.connect(g).connect(ac.destination);
          o.start(t); o.stop(t + 0.4);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }

      case 'defeat': {
        // Sad descending: C4 → Bb3 → Ab3 → G3
        const sad = [261, 233, 207, 196];
        sad.forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          const t = now + i * 0.2;
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          o.connect(g).connect(ac.destination);
          o.start(t); o.stop(t + 0.5);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }

      case 'select': {
        // Quick pip (same as playMenuSelect but inline)
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, now);
        o.frequency.exponentialRampToValueAtTime(700, now + 0.06);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        o.connect(g).connect(ac.destination);
        o.start(now); o.stop(now + 0.08);
        o.onended = () => { o.disconnect(); g.disconnect(); };
        break;
      }

      case 'heal': {
        // Gentle ascending chime
        const chime = [523, 659, 784];
        chime.forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          const t = now + i * 0.1;
          g.gain.setValueAtTime(0.15, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          o.connect(g).connect(ac.destination);
          o.start(t); o.stop(t + 0.3);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }

      case 'catch_success': {
        // Catch success: ascending chime
        const chime = [523, 659, 784];
        chime.forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          const t = now + i * 0.1;
          g.gain.setValueAtTime(0.15, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          o.connect(g).connect(ac.destination);
          o.start(t); o.stop(t + 0.3);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }

      case 'catch_fail': {
        // Catch fail: descending chime
        const chime = [784, 659, 523];
        chime.forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          const t = now + i * 0.1;
          g.gain.setValueAtTime(0.15, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          o.connect(g).connect(ac.destination);
          o.start(t); o.stop(t + 0.3);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        });
        break;
      }
    }
  } catch {
    // Silently ignore audio errors
  }
}