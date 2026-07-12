'use client';
import { useEffect, useRef } from 'react';

type Props = { location: string; className: string; seed: string };
const hash = (text: string) => Array.from(text).reduce((n, c) => ((n << 5) - n + c.charCodeAt(0)) | 0, 0) >>> 0;

export default function ProceduralScene({ location, className, seed }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return; const g = canvas.getContext('2d'); if (!g) return;
    const rnd = hash(`${seed}-${location}`); const kind = /taverna|casa|senhorio/i.test(location) ? 'tavern' : /floresta|bosque/i.test(location) ? 'forest' : /rio|riacho|ponte/i.test(location) ? 'river' : 'village';
    g.imageSmoothingEnabled = false; const rect = (x:number,y:number,w:number,h:number,c:string) => { g.fillStyle=c; g.fillRect(x,y,w,h); };
    const sprite = (x:number,y:number,coat:string) => { rect(x+3,y,7,7,'#e8bb84'); rect(x+1,y+7,11,12,coat); rect(x,y+19,5,8,'#2d2934'); rect(x+8,y+19,5,8,'#2d2934'); rect(x+2,y-2,9,3,'#392837'); };
    if (kind === 'tavern') {
      rect(0,0,320,180,'#3d2930'); for(let x=0;x<320;x+=28) rect(x,0,4,118,'#1d2027'); for(let y=16;y<110;y+=28) rect(0,y,320,3,'#5c3b31');
      rect(0,110,320,70,'#70442c'); for(let y=118;y<180;y+=12) rect(0,y,320,2,'#3b2929'); rect(210,76,110,58,'#2d2021'); rect(216,82,98,8,'#b36e3e');
      rect(18,35,42,40,'#1b2533'); rect(23,40,32,30,'#e6aa5c'); rect(26,43,26,24,'#7c593c'); sprite(118,94,'#6d657e'); sprite(88,99,'#485e74'); sprite(154,96,'#8d4f3b');
      rect(0,0,320,10,'#291f2e'); rect(10,10,6,6,'#f6c15e'); rect(290,12,6,6,'#f6c15e');
    } else if (kind === 'forest') {
      rect(0,0,320,180,'#264a4c'); rect(0,92,320,88,'#547349'); for(let i=0;i<12;i++){const x=(i*31+(rnd%17))%320;rect(x,8+(i%3)*8,12,118,'#233638');rect(x-12,12+(i%4)*8,36,40,'#1e4a3b');rect(x-7,4+(i%5)*7,26,24,'#315d43')} rect(106,96,108,84,'#b68d55'); for(let y=105;y<180;y+=13)rect(110,y,100,2,'#d9b979'); rect(148,128,24,18,'#25323a');
    } else if (kind === 'river') {
      rect(0,0,320,180,'#6b98ae'); rect(0,0,320,65,'#8ab5c4'); rect(0,65,320,115,'#3e7891'); for(let y=72;y<180;y+=14)for(let x=(y%28);x<320;x+=44)rect(x,y,24,3,'#9ed1d7'); rect(0,118,94,62,'#496d47'); rect(246,110,74,70,'#496d47'); rect(92,104,154,13,'#714e34'); for(let x=104;x<238;x+=22)rect(x,100,5,28,'#49352c');
    } else {
      rect(0,0,320,180,'#b9d3dc'); rect(0,82,320,98,'#c49c69'); rect(0,110,320,70,'#d8b883'); for(let x=0;x<320;x+=46){rect(x,35+(x%3)*7,38,72,'#62463a');rect(x+4,42+(x%3)*7,30,30,'#d1a369');rect(x-2,30+(x%3)*7,42,10,'#3d3034')} for(let y=120;y<180;y+=14)rect(0,y,320,2,'#b08558'); sprite(145,105,'#6b567f');
    }
    // First-person class cue: simple gloved hands/item at the bottom, never a portrait.
    const glove = /guerreiro|pirata/i.test(className) ? '#9a593d' : /mist|druid/i.test(className) ? '#75639c' : '#566c64'; rect(123,160,26,20,glove); rect(172,160,26,20,glove); rect(151,145,18,35,'#6b4b36');
  }, [location, className, seed]);
  return <canvas ref={ref} width="320" height="180" aria-label={`Cena pixelada: ${location}`} style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }} />;
}
