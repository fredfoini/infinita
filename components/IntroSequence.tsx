'use client';

import { useEffect, useRef, useState } from 'react';
import { currentLocation, type GameState } from '@/lib/engine';
import Logo from '@/components/Logo';
import PixelActor from '@/components/PixelActor';

export default function IntroSequence({ campaign, onComplete }: { campaign: GameState; onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const location = currentLocation(campaign);

  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed((performance.now() - started) / 1000), 100);
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const audio = new AudioContextClass();
      const master = audio.createGain(); master.gain.value = 0.025; master.connect(audio.destination);
      const start = audio.currentTime;
      [174.61, 220, 261.63, 329.63].forEach((frequency, index) => {
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.type = index === 3 ? 'sine' : 'triangle'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start + index * 2.5); gain.gain.linearRampToValueAtTime(0.22, start + index * 2.5 + 0.7); gain.gain.exponentialRampToValueAtTime(0.001, start + index * 2.5 + 4.5);
        oscillator.connect(gain); gain.connect(master); oscillator.start(start + index * 2.5); oscillator.stop(start + index * 2.5 + 4.8);
      });
      audioRef.current = audio;
    }
    return () => { window.clearInterval(timer); void audioRef.current?.close(); };
  }, []);

  function finish() {
    localStorage.setItem(`infinita-intro-seen:${campaign.campaignId}`, '1');
    onComplete();
  }

  return <main className="intro-screen" aria-label="Introdução da campanha">
    <button type="button" className="intro-skip" onClick={finish}>PULAR</button>
    <section className="intro-stage">
      <div className="intro-pixel-sequence" aria-hidden="true">
        <div className="intro-frame intro-sky frame-dawn" />
        <div className="intro-frame frame-waterfall" />
        <div className="intro-frame frame-village" />
        <div className="intro-frame frame-shrine" />
      </div>
      <PixelActor identity={campaign.character.sprite} animation="walk" label={`${campaign.character.name} inicia a jornada`} className="intro-hero" />
      <div className="intro-leaves"><i/><i/><i/><i/><i/></div>
      <div className="intro-brand"><Logo variant="intro" priority/><small>{campaign.character.name} · {campaign.character.className} · {location.name}</small></div>
      <div className="intro-message"><p>Uma nova aventura criada por você,<br/>como quiser, começa agora…</p>{elapsed >= 11.5 && <button type="button" onClick={finish}>COMEÇAR JORNADA</button>}</div>
      <div className="intro-progress"><i style={{ width: `${Math.min(100, elapsed / 12 * 100)}%` }} /></div>
    </section>
  </main>;
}
