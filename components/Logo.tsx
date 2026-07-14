'use client';

import Image from 'next/image';
import { useState } from 'react';

type Props = { variant?: 'menu' | 'intro' | 'loading' | 'header'; priority?: boolean; className?: string };

export default function Logo({ variant = 'menu', priority = false, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`official-logo-fallback ${className}`} role="img" aria-label="INFINITA RPG">INFINITA RPG</span>;
  return <Image
    className={`official-logo official-logo-${variant} ${className}`.trim()}
    src="/assets/logo.png"
    alt="INFINITA RPG"
    width={1254}
    height={1254}
    sizes={variant === 'header' ? '(max-width: 720px) 92px, 112px' : variant === 'menu' ? '(max-width: 800px) 76vw, 430px' : '(max-width: 800px) 82vw, 520px'}
    priority={priority}
    unoptimized
    onError={() => { console.error('INFINITA: asset oficial /assets/logo.png não foi encontrado.'); setFailed(true); }}
  />;
}
