'use client';
import { useEffect, useRef } from 'react';
type Props={location:string;className:string;seed:string};
const hash=(s:string)=>Array.from(s).reduce((n,c)=>((n<<5)-n+c.charCodeAt(0))|0,0)>>>0;

export default function ProceduralScene({location,className,seed}:Props){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;const g=canvas.getContext('2d');if(!g)return;const rnd=hash(`${seed}-${location}`),kind=/taverna|casa|senhorio/i.test(location)?'tavern':/floresta|bosque/i.test(location)?'forest':/rio|riacho|ponte/i.test(location)?'river':'village';const tiles=new Image(),npcs=new Image();tiles.src='/assets/tile-prop-atlas-v1.png';npcs.src='/assets/npc-atlas-v1.png';let frame=0,raf=0;
 const rect=(x:number,y:number,w:number,h:number,c:string)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
 const tile=(index:number,x:number,y:number,w=34,h=26)=>{if(!tiles.complete)return;const col=index%8,row=Math.floor(index/8);g.drawImage(tiles,col*160,row*160,160,160,x,y,w,h)};
 const npc=(index:number,x:number,y:number,flip=false)=>{if(!npcs.complete)return;const off=document.createElement('canvas');off.width=192;off.height=256;const c=off.getContext('2d');if(!c)return;c.drawImage(npcs,(index%8)*192,Math.floor(index/8)*256,192,256,0,0,192,256);const px=c.getImageData(0,0,192,256),d=px.data;for(let i=0;i<d.length;i+=4){if(d[i]>180&&d[i+1]>205&&d[i+2]>175&&d[i+1]>=d[i])d[i+3]=0}c.putImageData(px,0,0);g.save();if(flip){g.translate(x+34,y);g.scale(-1,1);g.drawImage(off,0,0,34,45)}else g.drawImage(off,x,y,34,45);g.restore()};
 const draw=()=>{g.imageSmoothingEnabled=false;g.clearRect(0,0,320,180);if(kind==='tavern'){rect(0,0,320,180,'#403038');for(let x=0;x<320;x+=32)rect(x,0,4,118,'#201f29');rect(0,116,320,64,'#805338');tile(4,0,132,320,48);tile(26,218,96,72,45);tile(25,144,112,48,35);tile(20,46,112,38,35)}else if(kind==='forest'){rect(0,0,320,180,'#2c6257');tile(7,0,0,320,110);tile(0,0,110,320,70);for(let i=0;i<7;i++)tile(7,(i*51+rnd%22)%320,18+(i%3)*20,48,64);tile(1,112,125,100,55)}else if(kind==='river'){rect(0,0,320,180,'#75aec4');tile(5,0,58,320,122);tile(0,0,130,72,50);tile(0,248,130,72,50);tile(14,90,108,140,24)}else{rect(0,0,320,180,'#b7d6dd');tile(1,0,92,320,88);for(let i=0;i<5;i++){tile(9,(i*68+rnd%15)%320,27+(i%2)*14,58,65);tile(10,(i*68+rnd%15)+8,65+(i%2)*14,42,40)}tile(3,112,110,98,55)}
 for(let i=0;i<5;i++)tile((rnd+i*11)%64,8+i*62,148+(i%2)*7,34,26);const bob=frame%2?1:0;npc((rnd%24),78,100+bob);npc((rnd+7)%24,190,103+(frame%2),true);if(kind==='tavern')npc((rnd+15)%24,250,91+bob);const glove=/guerreiro|pirata/i.test(className)?'#9a593d':/mist|druid/i.test(className)?'#75639c':'#566c64';rect(123,160,26,20,glove);rect(172,160,26,20,glove);rect(151,145,18,35,'#6b4b36')};
 let last=0;const loop=(time:number)=>{if(time-last>180){frame++;draw();last=time}raf=requestAnimationFrame(loop)};tiles.onload=draw;npcs.onload=draw;draw();raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf)},[location,className,seed]);
 return <canvas ref={ref} width="320" height="180" aria-label={`Cena pixelada: ${location}`} style={{width:'100%',height:'100%',display:'block',imageRendering:'pixelated'}}/>;
}
