'use client';

import { PARCHMENT_ASSET_ID } from '@/lib/visual/visual-cycle';
import Image from 'next/image';

export default function ParchmentWriting({ label = 'O cronista registra as consequências da jornada' }: { label?: string }) {
  return <div className="parchment-writing" data-asset-id={PARCHMENT_ASSET_ID} role="img" aria-label={label}>
    <Image className="parchment-gif" src="/assets/parchment-writing-v1.gif" alt="" aria-hidden="true" draggable={false} fill sizes="(max-width: 800px) 100vw, 900px" unoptimized />
    <span className="parchment-caption">A CRÔNICA CONTINUA...</span>
  </div>;
}
