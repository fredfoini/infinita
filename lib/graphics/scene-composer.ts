import type { SceneBlueprint, SceneKind } from '@/lib/graphics/types';

const hash = (value: string) => Array.from(value).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0) >>> 0;

function inferKind(location: string): SceneKind {
  if (/taverna|estalagem|casa|loja|salão/i.test(location)) return 'interior';
  if (/floresta|bosque|selva|mata/i.test(location)) return 'forest';
  if (/rio|riacho|ponte|lago|costa/i.test(location)) return 'river';
  if (/ruína|templo|torre|cripta/i.test(location)) return 'ruin';
  if (/estrada|trilha|caminho/i.test(location)) return 'road';
  return 'settlement';
}

export function composeScene(input: { location: string; weather: string; hour: number; campaignSeed: string }): SceneBlueprint {
  const kind = inferKind(input.location);
  const seed = hash(`${input.campaignSeed}:${input.location}`);
  const palettes: Record<SceneKind, SceneBlueprint['palette']> = {
    settlement: { sky: '#91c8d2', ground: '#d2ad72', shadow: '#473949', accent: '#e7c36d' },
    interior: { sky: '#332a3c', ground: '#8b5940', shadow: '#201c2c', accent: '#efb85c' },
    forest: { sky: '#356c5b', ground: '#648052', shadow: '#243b38', accent: '#c8b16a' },
    river: { sky: '#78b5c7', ground: '#397d99', shadow: '#31566d', accent: '#b7e2df' },
    ruin: { sky: '#70798b', ground: '#68715d', shadow: '#42414d', accent: '#a996c8' },
    road: { sky: '#9cc9cf', ground: '#bb9564', shadow: '#4d4b48', accent: '#e4ca83' },
  };
  return { kind, location: input.location, weather: input.weather, hour: input.hour, seed, backgroundAssetId: kind === 'settlement' ? 'background.settlement.square.01' : undefined, palette: palettes[kind], density: 4 + seed % 5 };
}
