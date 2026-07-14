import type { AttributeKey, GameState, Item, ItemCategory, ItemMechanicalEffect, ItemRarity, NarrativeWorldDelta } from '@/lib/engine';

export type ItemAction = 'use' | 'equip' | 'store' | 'lend' | 'sell' | 'lose' | 'steal' | 'destroy' | 'discard' | 'craft' | 'combine' | 'repair';
export type ItemActionInput = { action: ItemAction; itemId: string; targetNpcId?: string; secondaryItemId?: string };

const CATEGORY_TO_KIND: Record<ItemCategory, Item['kind']> = {
  consumable: 'consumível', tool: 'ferramenta', weapon: 'arma', armor: 'armadura', accessory: 'armadura', material: 'material',
  quest: 'missão', document: 'missão', key: 'missão', relic: 'missão', narrative: 'missão',
};
const KIND_TO_CATEGORY: Record<Item['kind'], ItemCategory> = { arma: 'weapon', armadura: 'armor', consumível: 'consumable', ferramenta: 'tool', material: 'material', missão: 'quest' };
const RARITY_VALUE: Record<ItemRarity, number> = { common: 1, uncommon: 1.35, rare: 1.8, epic: 2.6, legendary: 4 };
const ALLOWED_EFFECTS = new Set<ItemMechanicalEffect['type']>(['restore_hp', 'restore_mana', 'attribute_bonus', 'skill_bonus', 'unlock_action', 'unlock_location', 'unlock_dialogue', 'unlock_profession', 'trigger_event', 'damage_bonus', 'defense_bonus']);
const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clean = (value: unknown, max: number) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

function defaultEffect(category: ItemCategory, name: string): ItemMechanicalEffect {
  if (category === 'consumable') return { type: 'restore_hp', value: 2 };
  if (category === 'weapon') return { type: 'damage_bonus', value: 1 };
  if (category === 'armor' || category === 'accessory') return { type: 'defense_bonus', value: 1 };
  if (category === 'material') return { type: 'unlock_action', target: `fabricar com ${name}`, value: 1 };
  if (category === 'document') return { type: 'unlock_dialogue', target: `informações de ${name}`, value: 1 };
  if (category === 'key') return { type: 'unlock_location', target: `acesso relacionado a ${name}`, value: 1 };
  if (category === 'relic') return { type: 'trigger_event', target: `mistério de ${name}`, value: 1 };
  return { type: 'unlock_action', target: `usar ${name}`, value: 1 };
}

export function normalizeItem(value: Partial<Item> & Pick<Item, 'name' | 'description'>, ownerId: string, origin: string, turn = 0): Item {
  const category = value.category || KIND_TO_CATEGORY[value.kind || 'material'] || 'material';
  const maxDurability = value.durability?.max ?? (['weapon', 'armor', 'accessory', 'tool'].includes(category) ? 20 : 0);
  const effects = (value.effects?.mechanical || []).filter(effect => ALLOWED_EFFECTS.has(effect.type)).slice(0, 4).map(effect => ({ ...effect, target: clean(effect.target, 100) || undefined, value: clamp(Number(effect.value) || 1, -10, 20), duration: effect.duration ? clamp(Number(effect.duration), 1, 20) : undefined }));
  const item: Item = {
    id: value.id || uid(), name: clean(value.name, 80), description: clean(value.description, 240), kind: CATEGORY_TO_KIND[category], category,
    rarity: value.rarity || 'common', weight: clamp(Number(value.weight) || .1, 0, 100), quantity: clamp(Number(value.quantity) || 1, 1, 99), value: clamp(Number(value.value) || 1, 0, 10000),
    state: value.state || 'carried', origin: clean(value.origin || origin, 220),
    effects: { narrative: (value.effects?.narrative || []).map(effect => clean(effect, 180)).filter(Boolean).slice(0, 4), mechanical: effects.length ? effects : [defaultEffect(category, value.name)] },
    stack: value.stack || { stackable: ['consumable', 'material'].includes(category), max: ['consumable', 'material'].includes(category) ? 99 : 1 },
    durability: maxDurability > 0 ? { current: clamp(value.durability?.current ?? maxDurability, 0, maxDurability), max: maxDurability } : null,
    ownerId: value.ownerId || ownerId, history: value.history || [{ turn, action: 'created', detail: clean(origin, 180), ownerId, createdAt: new Date().toISOString() }], equipped: Boolean(value.equipped),
  };
  return item;
}

export function materializeItemSuggestion(state: GameState, suggestion: NonNullable<NarrativeWorldDelta['items']>[number], narrative: string): Item | null {
  const name = clean(suggestion.name, 80);
  const description = clean(suggestion.description, 240);
  if (!name || !description || !narrative.toLocaleLowerCase('pt-BR').includes(name.toLocaleLowerCase('pt-BR'))) return null;
  if (state.character.inventory.some(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return null;
  const category: ItemCategory = Object.hasOwn(CATEGORY_TO_KIND, suggestion.category) ? suggestion.category : 'narrative';
  const validEffects = (suggestion.mechanicalEffects || []).filter(effect => ALLOWED_EFFECTS.has(effect.type));
  if (!validEffects.length) return null;
  return normalizeItem({
    name, description, category, rarity: suggestion.rarity || 'common', weight: suggestion.weight || .2, value: suggestion.value || 1, quantity: suggestion.quantity || 1,
    origin: suggestion.origin, effects: { narrative: suggestion.narrativeEffects || [], mechanical: validEffects },
    durability: suggestion.durability ? { current: suggestion.durability, max: suggestion.durability } : null,
  }, state.character.name, suggestion.origin, state.session.turn);
}

export function registerSuggestedItems(inputState: GameState, suggestions: NarrativeWorldDelta['items'], narrative: string) {
  if (!suggestions?.length) return { state: inputState, created: [] as Item[] };
  const state = inputState;
  const created: Item[] = [];
  for (const suggestion of suggestions.slice(0, 1)) {
    const item = materializeItemSuggestion(state, suggestion, narrative);
    if (!item) continue;
    state.character.inventory.push(item);
    state.world.itemRegistry[item.id] = structuredClone(item);
    created.push(item);
  }
  return { state, created };
}

function record(item: Item, state: GameState, action: string, detail: string, ownerId = item.ownerId) {
  item.history = [...item.history, { turn: state.session.turn, action, detail: clean(detail, 180), ownerId, createdAt: new Date().toISOString() }].slice(-40);
  item.ownerId = ownerId;
}

function applyEffects(state: GameState, item: Item) {
  const messages: string[] = [];
  for (const effect of item.effects.mechanical) {
    if (effect.type === 'restore_hp') { const before = state.character.hp; state.character.hp = clamp(before + effect.value, 0, state.character.maxHp); messages.push(`Vitalidade +${state.character.hp - before}.`); }
    if (effect.type === 'restore_mana') { const before = state.character.mana; state.character.mana = clamp(before + effect.value, 0, state.character.maxMana); messages.push(`Mana +${state.character.mana - before}.`); }
    if (effect.type === 'unlock_action' && effect.target) { state.character.unlockedActions = Array.from(new Set([...state.character.unlockedActions, effect.target])); messages.push(`Ação desbloqueada: ${effect.target}.`); }
    if (effect.type === 'unlock_profession' && effect.target) { state.character.professions = Array.from(new Set([...state.character.professions, effect.target])); messages.push(`Profissão desbloqueada: ${effect.target}.`); }
    if (effect.type === 'unlock_location' && effect.target) { state.world.unlocks.locations = Array.from(new Set([...state.world.unlocks.locations, effect.target])); messages.push(`Acesso revelado: ${effect.target}.`); }
    if (effect.type === 'unlock_dialogue' && effect.target) { state.world.unlocks.dialogues = Array.from(new Set([...state.world.unlocks.dialogues, effect.target])); messages.push(`Novo diálogo possível: ${effect.target}.`); }
    if (effect.type === 'trigger_event' && effect.target) { state.world.unlocks.events = Array.from(new Set([...state.world.unlocks.events, effect.target])); messages.push(`Evento ativado: ${effect.target}.`); }
  }
  return messages;
}

function removeOne(state: GameState, item: Item) {
  if (item.quantity > 1) item.quantity -= 1;
  else state.character.inventory = state.character.inventory.filter(candidate => candidate.id !== item.id);
}

function craftedItem(state: GameState, first: Item, second: Item) {
  const inherited = [...first.effects.mechanical, ...second.effects.mechanical].filter((effect, index, all) => all.findIndex(candidate => candidate.type === effect.type && candidate.target === effect.target) === index).slice(0, 3);
  return normalizeItem({
    name: `${first.name} + ${second.name}`, description: `Objeto fabricado combinando ${first.name} e ${second.name}.`, category: first.category === 'material' ? second.category : first.category,
    rarity: first.rarity === 'common' ? second.rarity : first.rarity, weight: first.weight + second.weight, value: Math.max(1, Math.round((first.value + second.value) * 1.2)),
    effects: { narrative: [`Carrega a história combinada de ${first.name} e ${second.name}.`], mechanical: inherited.length ? inherited : [defaultEffect('tool', first.name)] }, origin: `Fabricado por ${state.character.name} no turno ${state.session.turn}.`,
  }, state.character.name, 'Fabricação procedural', state.session.turn);
}

export function executeItemAction(inputState: GameState, input: ItemActionInput) {
  const state = structuredClone(inputState);
  let item = state.character.inventory.find(candidate => candidate.id === input.itemId);
  if (input.action === 'steal' && !item) {
    item = state.world.itemRegistry[input.itemId];
    if (!item || item.ownerId === state.character.name || item.state === 'destroyed') throw new Error('Este item não pode ser roubado.');
    item = structuredClone(item); item.state = 'stolen'; item.equipped = false; record(item, state, 'stolen', `${state.character.name} tomou o item.`, state.character.name); state.character.inventory.push(item);
  }
  if (!item) throw new Error('Item não encontrado.');
  const messages: string[] = [];

  if (input.action === 'use') {
    messages.push(...applyEffects(state, item));
    if (item.durability) item.durability.current = Math.max(0, item.durability.current - 1);
    if (item.category === 'consumable') {
      const consumedStack = item.quantity === 1;
      removeOne(state, item);
      if (consumedStack) { item.state = 'consumed'; record(item, state, 'consumed', messages.join(' ') || `Uso de ${item.name}.`, 'world:consumed'); }
      else record(item, state, 'used', messages.join(' ') || `Uso de ${item.name}.`);
    } else record(item, state, 'used', messages.join(' ') || `Uso de ${item.name}.`);
  } else if (input.action === 'equip') {
    if (!['weapon', 'armor', 'accessory', 'tool'].includes(item.category)) throw new Error('Este item não pode ser equipado.');
    item.equipped = !item.equipped; item.state = item.equipped ? 'equipped' : 'carried'; record(item, state, item.equipped ? 'equipped' : 'unequipped', item.equipped ? 'Equipado.' : 'Guardado na mochila.');
    messages.push(item.equipped ? `${item.name} equipado.` : `${item.name} removido.`);
  } else if (input.action === 'store') {
    item.equipped = false; item.state = item.state === 'stored' ? 'carried' : 'stored'; record(item, state, 'stored', item.state === 'stored' ? 'Guardado.' : 'Retirado do armazenamento.'); messages.push(item.state === 'stored' ? `${item.name} guardado.` : `${item.name} voltou à mochila.`);
  } else if (input.action === 'lend') {
    const npc = state.world.npcs[input.targetNpcId || ''] || Object.values(state.world.npcs).find(candidate => candidate.locationId === state.world.currentLocationId && candidate.status === 'active');
    if (!npc) throw new Error('Não há alguém presente para receber o item.');
    item.state = 'lent'; item.equipped = false; record(item, state, 'lent', `Emprestado a ${npc.name}.`, npc.id); state.character.inventory = state.character.inventory.filter(candidate => candidate.id !== item!.id); messages.push(`${item.name} foi emprestado a ${npc.name}.`);
  } else if (input.action === 'sell') {
    const gold = Math.max(1, Math.round(item.value * RARITY_VALUE[item.rarity] * .55)); const soldStack = item.quantity === 1; removeOne(state, item); item.state = soldStack ? 'sold' : 'carried'; record(item, state, 'sold', `Vendido por ${gold} moedas.`, soldStack ? 'world:market' : state.character.name); state.character.gold += gold; messages.push(`${item.name} vendido por ${gold} moedas.`);
  } else if (['lose', 'destroy', 'discard'].includes(input.action)) {
    item.equipped = false; item.state = input.action === 'lose' ? 'lost' : input.action === 'destroy' ? 'destroyed' : 'discarded'; record(item, state, input.action, `${item.name}: ${item.state}.`, 'world'); state.character.inventory = state.character.inventory.filter(candidate => candidate.id !== item!.id); messages.push(`${item.name} foi ${item.state === 'lost' ? 'perdido' : item.state === 'destroyed' ? 'destruído' : 'descartado'}.`);
  } else if (input.action === 'repair') {
    if (!item.durability || item.durability.current >= item.durability.max) throw new Error('Este item não precisa de reparo.');
    const cost = Math.max(1, Math.ceil((item.durability.max - item.durability.current) * Math.max(1, item.value) / item.durability.max * .25));
    if (state.character.gold < cost) throw new Error('Moedas insuficientes para o reparo.');
    state.character.gold -= cost; item.durability.current = item.durability.max; record(item, state, 'repaired', `Reparado por ${cost} moedas.`); messages.push(`${item.name} reparado por ${cost} moedas.`);
  } else if (input.action === 'craft' || input.action === 'combine') {
    const second = state.character.inventory.find(candidate => candidate.id === input.secondaryItemId) || state.character.inventory.find(candidate => candidate.id !== item!.id && ['material', 'tool'].includes(candidate.category));
    if (!second) throw new Error('É necessário outro material ou ferramenta para combinar.');
    const result = craftedItem(state, item, second); const firstConsumed = item.quantity === 1; const secondConsumed = second.quantity === 1; removeOne(state, item); removeOne(state, second);
    if (firstConsumed) { item.state = 'consumed'; record(item, state, 'crafted', `Consumido na fabricação de ${result.name}.`, 'world:craft'); }
    if (secondConsumed) { second.state = 'consumed'; record(second, state, 'crafted', `Consumido na fabricação de ${result.name}.`, 'world:craft'); }
    state.world.itemRegistry[second.id] = structuredClone(second); state.character.inventory.push(result); state.world.itemRegistry[result.id] = structuredClone(result); messages.push(`${result.name} foi fabricado e seus efeitos já estão ativos para uso.`);
  } else if (input.action === 'steal') messages.push(`${item.name} agora está com ${state.character.name}.`);

  state.world.itemRegistry[item.id] = structuredClone(item);
  return { state, item, messages };
}

export function equipmentEffectTotal(state: GameState, type: ItemMechanicalEffect['type'], target?: string) {
  return state.character.inventory.filter(item => item.equipped && item.durability?.current !== 0).flatMap(item => item.effects.mechanical)
    .filter(effect => effect.type === type && (!target || !effect.target || effect.target.toLocaleLowerCase('pt-BR') === target.toLocaleLowerCase('pt-BR')))
    .reduce((total, effect) => total + effect.value, 0);
}

export const ItemEngine = { normalize: normalizeItem, materializeSuggestion: materializeItemSuggestion, registerSuggestions: registerSuggestedItems, execute: executeItemAction, equipmentEffectTotal };
