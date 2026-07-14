export type SpriteAnimation = 'idle' | 'walk' | 'attack' | 'cast' | 'talk' | 'celebrate' | 'hurt' | 'death' | 'run' | 'fishing' | 'craft' | 'sit' | 'sleep';

export type SpriteIdentity = {
  id: string;
  sheetUrl: '/assets/hero-sprite-sheet-v1.png';
  seed: number;
  hue: number;
  saturation: number;
  brightness: number;
  classLayer: 'blade' | 'focus' | 'bow' | 'tool' | 'travel';
  description: string;
  version: 1;
};

export const SPRITE_FRAMES: Record<SpriteAnimation, Array<{ column: number; row: number }>> = {
  idle: [{ column: 0, row: 0 }, { column: 1, row: 0 }],
  walk: [{ column: 2, row: 0 }, { column: 3, row: 0 }],
  talk: [{ column: 4, row: 0 }, { column: 5, row: 0 }],
  celebrate: [{ column: 6, row: 0 }, { column: 7, row: 0 }],
  attack: [{ column: 0, row: 1 }, { column: 1, row: 1 }, { column: 2, row: 1 }],
  cast: [{ column: 3, row: 1 }, { column: 4, row: 1 }],
  hurt: [{ column: 5, row: 1 }],
  death: [{ column: 6, row: 1 }, { column: 7, row: 1 }],
  run: [{ column: 0, row: 2 }, { column: 1, row: 2 }],
  fishing: [{ column: 2, row: 2 }, { column: 3, row: 2 }],
  craft: [{ column: 4, row: 2 }, { column: 5, row: 2 }],
  sit: [{ column: 6, row: 2 }],
  sleep: [{ column: 7, row: 2 }],
};

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return result >>> 0;
}

function classLayer(value: string): SpriteIdentity['classLayer'] {
  const normalized = value.toLocaleLowerCase('pt-BR');
  if (/mago|brux|místic|feit|clérig|arcano/.test(normalized)) return 'focus';
  if (/arque|caçad|explor|batedor/.test(normalized)) return 'bow';
  if (/ferreiro|artes|miner|cozin|pesc/.test(normalized)) return 'tool';
  if (/guerre|cavale|soldad|paladin|ladino|pirata|assass/.test(normalized)) return 'blade';
  return 'travel';
}

export function createSpriteIdentity(input: { id: string; name: string; className: string; personality?: string; appearance?: string; story?: string }): SpriteIdentity {
  const seed = hash(`${input.id}:${input.name}:${input.className}:${input.personality || ''}:${input.appearance || ''}:${input.story || ''}`);
  return {
    id: `sprite-${input.id}`,
    sheetUrl: '/assets/hero-sprite-sheet-v1.png',
    seed,
    hue: (seed % 67) - 33,
    saturation: 82 + (seed % 25),
    brightness: 90 + (seed % 16),
    classLayer: classLayer(input.className),
    description: [input.appearance, input.personality, input.className].filter(Boolean).join(' · ').slice(0, 220),
    version: 1,
  };
}

export function migrateSpriteIdentity(value: Partial<SpriteIdentity> | undefined, input: Parameters<typeof createSpriteIdentity>[0]) {
  const generated = createSpriteIdentity(input);
  if (!value?.sheetUrl) return generated;
  return { ...generated, ...value, sheetUrl: '/assets/hero-sprite-sheet-v1.png', version: 1 } as SpriteIdentity;
}

export function animationForAction(action: string, success?: boolean, hp = 1): SpriteAnimation {
  if (hp <= 0) return 'death';
  const value = action.toLocaleLowerCase('pt-BR');
  if (success === false && /atac|lut|golpe|fug|perigo/.test(value)) return 'hurt';
  if (success === true && /vitória|venci|conclu|celebr/.test(value)) return 'celebrate';
  if (/atac|lut|golpe|soco|espada|adaga|dispar/.test(value)) return 'attack';
  if (/magia|runa|feiti|ritual|conjur/.test(value)) return 'cast';
  if (/pesc|anzol|peixe/.test(value)) return 'fishing';
  if (/fabric|forj|cozinh|constru|repar/.test(value)) return 'craft';
  if (/corr|fug|persegu/.test(value)) return 'run';
  if (/caminh|viaj|entro|sigo|vou|saio/.test(value)) return 'walk';
  if (/convers|falo|digo|pergunt|negoci|flert/.test(value)) return 'talk';
  if (/sent|descans/.test(value)) return 'sit';
  if (/dorm|sono/.test(value)) return 'sleep';
  return 'idle';
}

export const SpriteSystem = { create: createSpriteIdentity, migrate: migrateSpriteIdentity, animationForAction, frames: SPRITE_FRAMES };
