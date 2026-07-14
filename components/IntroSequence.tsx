'use client';

import { useEffect, useState } from 'react';
import { currentLocation, type GameState } from '@/lib/engine';
import Logo from '@/components/Logo';

const INTRO_DURATION = 5;

export default function IntroSequence({ campaign, onComplete }: { campaign: GameState; onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const location = currentLocation(campaign);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      setElapsed(Math.min(INTRO_DURATION, (time - started) / 1000));
      if (time - started < INTRO_DURATION * 1000) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function finish() {
    localStorage.setItem(`infinita-intro-seen:${campaign.campaignId}`, '1');
    onComplete();
  }

  return <main className="intro-screen quick-intro" aria-label="Introdução da campanha">
    <button type="button" className="intro-skip" onClick={finish}>PULAR</button>
    <section className="intro-stage">
      <div className="intro-particles">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
      <div className="intro-brand"><Logo variant="intro" priority /></div>
      <div className="intro-parchment-card"><span>UMA NOVA CRÔNICA</span><p>{campaign.character.name}, {campaign.character.className}, desperta em {location.name}.</p></div>
      <div className="intro-party"><i className="pixel-hero"/><i className="pixel-mage"/><i className="pixel-rival"/></div>
      <div className="intro-message"><p>O mundo se lembrará<br/>de cada consequência.</p>{elapsed >= 3.5 && <button type="button" onClick={finish}>COMEÇAR JORNADA</button>}</div>
      <div className="intro-progress"><i style={{ width: `${Math.min(100, elapsed / INTRO_DURATION * 100)}%` }} /></div>
    </section>
  </main>;
}
