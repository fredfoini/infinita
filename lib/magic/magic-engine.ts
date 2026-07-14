import type { GameState } from '@/lib/engine';
import type { EventDraft } from '@/lib/events/event-bus';

export type SpellType = 'attack' | 'healing' | 'defense' | 'control' | 'utility' | 'summoning' | 'movement' | 'narrative';
export type SpellPower = 'low' | 'medium' | 'high';
export type Spell = {
  id: string; campaignId: string; name: string; description: string; origin: string; type: SpellType; element?: string;
  manaCost: number; cooldownTurns: number; currentCooldown: number; range: string; targetType: string;
  damage?: number; healing?: number; effects: Array<{ type: string; value: number; duration?: number }>;
  conditions: string[]; learned: boolean; enabled: boolean; balanceVersion: 1;
};
export type SpellSuggestion = { name: string; fantasy: string; suggestedType: SpellType; suggestedPower?: SpellPower; element?: string; origin?: string };

const clean = (value: unknown, max: number) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const hash = (value: string) => Array.from(value).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0) >>> 0;

export function normalizeSpellSuggestion(state: GameState, suggestion: SpellSuggestion): Spell | null {
  const name = clean(suggestion.name, 80);
  const description = clean(suggestion.fantasy, 260);
  if (!name || !description || state.character.spells.some(spell => spell.name.toLowerCase() === name.toLowerCase())) return null;
  const types: SpellType[] = ['attack', 'healing', 'defense', 'control', 'utility', 'summoning', 'movement', 'narrative'];
  const type = types.includes(suggestion.suggestedType) ? suggestion.suggestedType : 'utility';
  const tier = suggestion.suggestedPower === 'high' ? 3 : suggestion.suggestedPower === 'medium' ? 2 : 1;
  const levelScale = Math.max(1, Math.ceil(state.character.level / 4));
  const manaCost = clamp(2 + tier * 2 + levelScale, 3, Math.max(3, state.character.maxMana));
  const power = clamp(2 + tier * 2 + Math.floor(state.character.level / 2), 3, 30);
  return {
    id: `spell-${hash(`${state.campaignId}:${name}`).toString(36)}`, campaignId: state.campaignId, name, description,
    origin: clean(suggestion.origin || `Aprendida no turno ${state.session.turn}.`, 180), type, element: clean(suggestion.element, 40) || undefined,
    manaCost, cooldownTurns: tier, currentCooldown: 0, range: type === 'attack' ? 'médio' : 'pessoal', targetType: type === 'attack' ? 'enemy' : 'self',
    damage: type === 'attack' ? power : undefined, healing: type === 'healing' ? power : undefined,
    effects: type === 'defense' ? [{ type: 'defense_bonus', value: tier, duration: 2 }] : [], conditions: [], learned: true, enabled: true, balanceVersion: 1,
  };
}

export function learnSuggestedSpells(state: GameState, suggestions: SpellSuggestion[] = []) {
  const learned: Spell[] = [];
  for (const suggestion of suggestions.slice(0, 1)) {
    const spell = normalizeSpellSuggestion(state, suggestion);
    if (!spell) continue;
    state.character.spells.push(spell);
    learned.push(spell);
  }
  return learned;
}

export function tickSpellCooldowns(state: GameState) {
  state.character.spells = state.character.spells.map(spell => ({ ...spell, currentCooldown: Math.max(0, spell.currentCooldown - 1) }));
}

export function castSpell(input: GameState, spellId: string) {
  const state = structuredClone(input);
  const spell = state.character.spells.find(candidate => candidate.id === spellId);
  if (!spell || !spell.learned || !spell.enabled) throw new Error('Magia desconhecida ou indisponível.');
  if (spell.currentCooldown > 0) throw new Error(`${spell.name} está em recarga por ${spell.currentCooldown} turno(s).`);
  if (spell.manaCost <= 0) throw new Error('Magia inválida: custo de mana ausente.');
  if (state.character.mana < spell.manaCost) throw new Error(`Mana insuficiente: ${spell.manaCost} necessária, ${state.character.mana} disponível.`);
  state.character.mana = Math.max(0, state.character.mana - spell.manaCost);
  spell.currentCooldown = spell.cooldownTurns;
  const events: EventDraft[] = [
    { type: 'ManaSpent', text: `${spell.manaCost} de mana consumida por ${spell.name}.`, targetIds: [state.character.name], payload: { amount: spell.manaCost, spellId }, priority: 85 },
    { type: 'SpellCast', text: `${spell.name} foi conjurada.`, targetIds: [spell.targetType], payload: { spellId }, priority: 90 },
  ];
  if (spell.damage) {
    const combat = state.session.combat || { enemyName: 'Oponente atual', enemyHp: 10, enemyMaxHp: 10, defense: 10, initiative: 'player' as const };
    const damage = Math.max(1, spell.damage);
    combat.enemyHp = Math.max(0, combat.enemyHp - damage);
    state.session.combat = combat.enemyHp > 0 ? combat : null;
    events.push({ type: 'DamageApplied', text: `${combat.enemyName} sofreu ${damage} de dano de ${spell.name}.`, targetIds: [combat.enemyName], payload: { amount: damage, spellId }, priority: 90 });
  }
  if (spell.healing) {
    const before = state.character.hp;
    state.character.hp = Math.min(state.character.maxHp, state.character.hp + spell.healing);
    events.push({ type: 'HealingApplied', text: `${spell.name} restaurou ${state.character.hp - before} de vitalidade.`, targetIds: [state.character.name], payload: { amount: state.character.hp - before, spellId }, priority: 85 });
  }
  if (spell.type === 'defense') state.character.activeEffects.push({ id: `effect-${spell.id}-${state.session.turn}`, name: spell.name, type: 'defense_bonus', value: spell.effects[0]?.value || 1, remainingTurns: spell.effects[0]?.duration || 2 });
  return { state, spell, events };
}

export const MagicEngine = { normalize: normalizeSpellSuggestion, learnSuggestions: learnSuggestedSpells, cast: castSpell, tickCooldowns: tickSpellCooldowns };
