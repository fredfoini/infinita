'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAssetRegistry } from '@/lib/graphics/asset-registry';
import { composeBuildings } from '@/lib/graphics/building-composer';
import { composeCharacters } from '@/lib/graphics/character-composer';
import { preloadSceneAssets, renderScene, type RenderAssets } from '@/lib/graphics/renderer';
import { composeScene } from '@/lib/graphics/scene-composer';

type Props = { location: string; className: string; seed: string; weather?: string; hour?: number };

export default function ProceduralScene({ location, className, seed, weather = 'Céu limpo', hour = 12 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const scene = useMemo(() => composeScene({ location, weather, hour, campaignSeed: seed }), [location, weather, hour, seed]);
  const buildings = useMemo(() => composeBuildings(scene), [scene]);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!context) return;
    let cancelled = false;
    let animation = 0;
    let frame = 0;
    let assets: RenderAssets | null = null;
    const paintFallback = () => {
      context.imageSmoothingEnabled = false;
      for (const layer of buildings.layers) { context.fillStyle = layer.color; context.fillRect(layer.x, layer.y, layer.width, layer.height); }
    };
    paintFallback();
    loadAssetRegistry().then(registry => preloadSceneAssets(registry, scene)).then(loaded => {
      if (cancelled) return;
      assets = loaded; setStatus('ready');
      let previous = 0;
      const loop = (time: number) => {
        if (time - previous > 160 && assets) { frame += 1; renderScene(context, scene, buildings, composeCharacters(className, scene.seed, frame), assets, frame); previous = time; }
        animation = requestAnimationFrame(loop);
      };
      renderScene(context, scene, buildings, composeCharacters(className, scene.seed, frame), assets, frame);
      animation = requestAnimationFrame(loop);
    }).catch(() => { if (!cancelled) { setStatus('fallback'); paintFallback(); } });
    return () => { cancelled = true; cancelAnimationFrame(animation); };
  }, [scene, buildings, className]);

  return <div className="scene-renderer">
    <canvas ref={ref} width="320" height="180" aria-label={`Cena pixel art em ${location}`} />
    {status === 'loading' && <span className="asset-loading">MONTANDO CENA...</span>}
  </div>;
}
