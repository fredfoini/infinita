'use client';

import { memo, useEffect, useState, type CSSProperties } from 'react';
import { SPRITE_FRAMES, type SpriteAnimation, type SpriteIdentity } from '@/lib/visual/sprite-system';

type Props = { identity: SpriteIdentity; animation?: SpriteAnimation; label: string; className?: string; facing?: 'left' | 'right'; compact?: boolean };

function PixelActor({ identity, animation = 'idle', label, className = '', facing = 'right', compact = false }: Props) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = SPRITE_FRAMES[animation] || SPRITE_FRAMES.idle;

  useEffect(() => {
    setFrameIndex(0);
    if (frames.length < 2 || animation === 'death') return;
    const interval = window.setInterval(() => setFrameIndex(index => (index + 1) % frames.length), ['walk', 'run', 'attack'].includes(animation) ? 210 : 420);
    return () => window.clearInterval(interval);
  }, [animation, frames.length]);

  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const style = {
    backgroundImage: `url('${identity.sheetUrl}')`,
    backgroundPosition: `${frame.column / 7 * 100}% ${frame.row / 3 * 100}%`,
    filter: `hue-rotate(${identity.hue}deg) saturate(${identity.saturation}%) brightness(${identity.brightness}%)`,
    '--actor-seed': identity.seed % 5,
  } as CSSProperties;

  return <span className={`pixel-actor ${identity.classLayer} ${animation} ${facing === 'left' ? 'face-left' : ''} ${compact ? 'compact' : ''} ${className}`.trim()} role="img" aria-label={label} title={label}>
    <i className="pixel-actor-sprite" style={style} />
    <i className="actor-equipment" aria-hidden="true" />
  </span>;
}

export default memo(PixelActor);
