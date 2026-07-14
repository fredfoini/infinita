'use client';

import { PARCHMENT_ASSET_ID } from '@/lib/visual/visual-cycle';

export default function ParchmentWriting({ label = 'O cronista registra as consequências da jornada' }: { label?: string }) {
  return <div className="parchment-writing" data-asset-id={PARCHMENT_ASSET_ID} role="img" aria-label={label}>
    <img className="parchment-gif" src="/assets/parchment-writing-v1.gif" alt="" aria-hidden="true" draggable={false} />
    <span className="parchment-caption">A CRÔNICA CONTINUA...</span>
  </div>;
}
