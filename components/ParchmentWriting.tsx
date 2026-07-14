'use client';

import { PARCHMENT_ASSET_ID } from '@/lib/visual/visual-cycle';

export default function ParchmentWriting({ label = 'O cronista registra as consequências da jornada' }: { label?: string }) {
  return <div className="parchment-writing" data-asset-id={PARCHMENT_ASSET_ID} role="img" aria-label={label}>
    <svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ead9a4"/><stop offset=".5" stopColor="#c7a969"/><stop offset="1" stopColor="#80603d"/></linearGradient>
        <radialGradient id="light"><stop stopColor="#ffecc2" stopOpacity=".62"/><stop offset="1" stopColor="#4a2e28" stopOpacity="0"/></radialGradient>
        <filter id="grain"><feTurbulence baseFrequency=".025" numOctaves="3" seed="17" type="fractalNoise"/><feColorMatrix values=".25 0 0 0 .4  0 .18 0 0 .32  0 0 .1 0 .16  0 0 0 .18 0"/></filter>
      </defs>
      <rect width="960" height="540" fill="#241a27"/>
      <ellipse cx="480" cy="275" rx="430" ry="250" fill="url(#light)"/>
      <path d="M180 86 Q151 110 176 143 L164 407 Q150 446 197 461 L757 461 Q803 445 783 407 L795 136 Q812 96 767 79 Z" fill="url(#paper)" stroke="#51344f" strokeWidth="13"/>
      <path d="M178 111 Q266 73 379 100 T597 92 T786 111 M181 430 Q277 465 382 438 T601 445 T779 427" fill="none" stroke="#6f4b3c" strokeWidth="7" opacity=".65"/>
      <g className="parchment-marks" fill="none" stroke="#5b3b36" strokeLinecap="round">
        <path d="M260 190 Q330 172 410 190 M445 190 Q532 172 683 188"/>
        <path d="M247 224 Q350 207 493 225 M526 224 Q596 210 691 222"/>
        <path d="M254 258 Q302 246 371 260 M404 258 Q532 241 677 258"/>
        <path d="M246 293 Q378 273 500 292 M534 290 Q598 281 687 291"/>
        <path d="M257 327 Q326 314 420 327 M450 327 Q560 310 672 326"/>
        <path d="M247 362 Q392 341 522 360 M552 360 Q608 350 682 359"/>
      </g>
      <g className="inkwell"><path d="M680 356 h91 l17 68 h-124z" fill="#322b43" stroke="#b89152" strokeWidth="8"/><path d="M690 342 h69 l10 25 h-87z" fill="#171524" stroke="#725b50" strokeWidth="7"/><ellipse cx="726" cy="346" rx="24" ry="8" fill="#090914"/></g>
      <g className="quill">
        <path d="M724 352 Q759 206 861 129 Q839 248 744 357" fill="#f3e3bb" stroke="#4c3658" strokeWidth="8"/>
        <path d="M741 326 Q780 270 838 175 M757 287 l52 -1 M775 249 l45 -3 M790 217 l35 -2" fill="none" stroke="#7d567f" strokeWidth="5"/>
      </g>
      <g fill="#d8b65f"><path d="M208 128h16v16h-16zM742 394h12v12h-12zM214 392h10v10h-10z"/><path d="M230 147l9 9-9 9-9-9zM716 127l11 11-11 11-11-11z"/></g>
      <rect x="164" y="78" width="632" height="384" filter="url(#grain)" opacity=".42"/>
    </svg>
    <span className="parchment-caption">A CRÔNICA CONTINUA...</span>
  </div>;
}
