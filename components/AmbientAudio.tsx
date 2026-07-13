'use client';

import { useEffect, useRef, useState } from 'react';

export default function AmbientAudio({ location }: { location: string }) {
  const [enabled, setEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number>();

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    void contextRef.current?.close();
  }, []);

  async function toggle() {
    if (enabled) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      await contextRef.current?.close();
      contextRef.current = null;
      setEnabled(false);
      return;
    }
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const master = audio.createGain();
    master.gain.value = 0.025;
    master.connect(audio.destination);
    const forest = /floresta|bosque|rio/i.test(location);
    const notes = forest ? [196, 220, 261.63, 293.66] : [174.61, 220, 261.63, 329.63];
    const playChord = () => {
      const start = audio.currentTime;
      const root = notes[Math.floor(Math.random() * notes.length)];
      [root, root * 1.5].forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = index ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(index ? 0.18 : 0.28, start + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 3.8);
        oscillator.connect(gain); gain.connect(master); oscillator.start(start); oscillator.stop(start + 4);
      });
    };
    playChord();
    timerRef.current = window.setInterval(playChord, 4200);
    contextRef.current = audio;
    setEnabled(true);
  }

  return <button type="button" className={`audio-toggle ${enabled ? 'active' : ''}`} onClick={() => void toggle()} aria-label={enabled ? 'Desligar música' : 'Ligar música'}>{enabled ? '♫ ON' : '♫ OFF'}</button>;
}
