import { useCallback } from 'react';

export const useSoundEffects = () => {
  const playCorrectSound = useCallback(() => {
    // Create a cheerful success sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
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
    });

    // Add a celebratory "ding" at the end
    setTimeout(() => {
      const ding = audioContext.createOscillator();
      const dingGain = audioContext.createGain();
      
      ding.connect(dingGain);
      dingGain.connect(audioContext.destination);
      
      ding.frequency.value = 1568; // G6
      ding.type = 'sine';
      
      dingGain.gain.setValueAtTime(0.4, audioContext.currentTime);
      dingGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      ding.start();
      ding.stop(audioContext.currentTime + 0.5);
    }, 400);
  }, []);

  const playWrongSound = useCallback(() => {
    // Create a dramatic "boom" / explosion sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
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
  }, []);

  return { playCorrectSound, playWrongSound };
};
