import type { CharacterBlueprint } from '@/lib/graphics/types';

export function composeCharacters(className: string, seed: number, frame: number): CharacterBlueprint {
  const lower = className.toLowerCase();
  const martial = /guerreiro|pirata|cavaleiro|soldado|caçador/.test(lower);
  const arcane = /mago|míst|brux|druid|oráculo|feitice/.test(lower);
  return { npcIndices: [seed % 32, (seed + 7) % 32, (seed + 17) % 32], playerSleeve: martial ? '#a85f45' : arcane ? '#8062a8' : '#52796e', playerGlove: martial ? '#d0b28a' : arcane ? '#c5a9df' : '#c3a47c', bobOffset: frame % 2 };
}
