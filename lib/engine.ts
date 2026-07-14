export type AttributeKey = 'Força' | 'Destreza' | 'Constituição' | 'Inteligência' | 'Sabedoria' | 'Carisma';
export type Attributes = Record<AttributeKey, number>;
export type EventKind = 'action' | 'roll' | 'xp' | 'skill' | 'level' | 'item' | 'gold' | 'reputation' | 'quest' | 'world' | 'combat' | 'magic' | 'system';
export type SkillRank = 'Iniciante' | 'Aprendiz' | 'Competente' | 'Especialista' | 'Mestre' | 'Lendário';

export type Skill = import('@/lib/skills/types').DynamicSkill & {
  /** Aliases legados mantidos para HUD e saves anteriores. */
  attribute: AttributeKey;
  xp: number;
  rank: SkillRank;
  trained: boolean;
};

export type ItemCategory = 'consumable' | 'tool' | 'weapon' | 'armor' | 'accessory' | 'material' | 'quest' | 'document' | 'key' | 'relic' | 'narrative';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemState = 'carried' | 'equipped' | 'stored' | 'lent' | 'sold' | 'consumed' | 'lost' | 'stolen' | 'destroyed' | 'discarded';
export type ItemMechanicalEffect = { type: 'restore_hp' | 'restore_mana' | 'attribute_bonus' | 'skill_bonus' | 'unlock_action' | 'unlock_location' | 'unlock_dialogue' | 'unlock_profession' | 'trigger_event' | 'damage_bonus' | 'defense_bonus'; target?: string; value: number; duration?: number };
export type ItemHistoryEntry = { turn: number; action: string; detail: string; ownerId: string; createdAt: string };

export type Item = {
  id: string;
  name: string;
  kind: 'arma' | 'armadura' | 'consumível' | 'ferramenta' | 'material' | 'missão';
  category: ItemCategory;
  rarity: ItemRarity;
  weight: number;
  quantity: number;
  value: number;
  description: string;
  state: ItemState;
  origin: string;
  effects: { narrative: string[]; mechanical: ItemMechanicalEffect[] };
  stack: { stackable: boolean; max: number };
  durability: { current: number; max: number } | null;
  ownerId: string;
  history: ItemHistoryEntry[];
  equipped: boolean;
};

export type GameEvent = {
  id: string;
  campaignId: string;
  turnId: string;
  turn: number;
  eventType: import('@/lib/events/event-bus').GameEventType;
  type: EventKind;
  source: 'player' | 'engine' | 'npc' | 'world' | 'combat' | 'llm_suggestion';
  actorId?: string;
  targetIds: string[];
  payload: Record<string, unknown>;
  schemaVersion: 1;
  priority: number;
  text: string;
  persistent: boolean;
  createdAt: string;
};

import { appendSessionMemory, buildMemoryContext, createMemoryState, migrateMemory, updateNarrativeMemory } from '@/lib/memory/memory-builder';
import { advanceVisualCycle, attachCycleIllustration, createVisualCycle, migrateVisualCycle, type CampaignVisualCycle } from '@/lib/visual/visual-cycle';
import { equipmentEffectTotal, executeItemAction, normalizeItem, registerSuggestedItems, type ItemActionInput } from '@/lib/items/item-engine';
import { reduceGameEvents, type EventDraft, type GameEventType } from '@/lib/events/event-bus';
import { castSpell, learnSuggestedSpells, tickSpellCooldowns, type Spell, type SpellSuggestion } from '@/lib/magic/magic-engine';
import { resolveActionSemantics, normalizeSemanticText } from '@/lib/skills/skill-semantic-resolver';
import { CORE_TO_DISPLAY, DISPLAY_TO_CORE, canonicalSkill, materializeDynamicSkill, proficiencyForLevel, skillExperienceToNext, validateTestSelection } from '@/lib/skills/test-selection-validator';
import { meaningfulSkillXp, progressDynamicSkill, resolveSkillCheck } from '@/lib/skills/skill-check-engine';
import type { ActionInterpretation, CheckOutcome, ContextualModifier, CoreAttribute, SkillResolutionAudit } from '@/lib/skills/types';
import { createSpriteIdentity, migrateSpriteIdentity, type SpriteIdentity } from '@/lib/visual/sprite-system';

export type Quest = {
  id: string;
  title: string;
  description: string;
  objectives: Array<{ id: string; text: string; completed: boolean; conditionType: string; currentValue: number | boolean | string; targetValue: number | boolean | string; status: 'locked' | 'active' | 'completed' | 'failed'; eventSubscriptions: GameEventType[] }>;
  status: 'available' | 'active' | 'completed' | 'failed' | 'abandoned' | 'obsolete';
  rewardXp: number;
  rewardGold: number;
  source: 'emergent';
  originType: 'player_goal' | 'npc_request' | 'world_event' | 'discovery' | 'contract' | 'consequence';
  originEventId: string;
  relevantNpcIds: string[];
  relevantLocationIds: string[];
  consequences: string[];
  rewards: Array<{ type: 'xp' | 'gold'; amount: number }>;
  createdAt: string;
  updatedAt: string;
  memory: { origin: string; motive: string; progress: string[]; consequences: string[]; personalGoal: string };
};

export type NPC = {
  id: string;
  campaignId: string;
  name: string;
  role: string;
  personality: string;
  goal: string;
  goals: string[];
  profession: string;
  locationId: string;
  relationship: number;
  relationships: Array<{ npcId: string; kind: string; value: number }>;
  reputationWithPlayer: number;
  inventoryIds: string[];
  createdFromEventId: string;
  knowledge: string[];
  memories: string[];
  status: 'active' | 'dead' | 'missing' | 'departed';
  memoryProfile: { firstImpression: string; sharedEvents: string[]; trust: number; favors: string[]; conflicts: string[]; pendingTopics: string[] };
  visualAppearance: { clothing: string; hair: string; accessories: string[]; weapon: string; apparentAge: string; palette: string[] };
  sprite: SpriteIdentity;
};

export type Location = {
  id: string;
  campaignId: string;
  name: string;
  region: string;
  kind: string;
  description: string;
  discovered: boolean;
  visited: boolean;
  current: boolean;
  status: 'active' | 'destroyed' | 'abandoned' | 'inaccessible';
  parentLocationId?: string;
  connectedLocationIds: string[];
  residentNpcIds: string[];
  presentNpcIds: string[];
  tags: string[];
  createdFromEventId: string;
  createdAt: string;
  updatedAt: string;
  visualIdentity: { architecture: string; palette: string[]; fixedObjects: string[] };
};

export type ShopProduct = {
  id: string;
  name: string;
  kind: Item['kind'];
  basePrice: number;
  stock: number;
  description: string;
};

export type Reputation = {
  individuals: Record<string, number>;
  cities: Record<string, number>;
  factions: Record<string, number>;
  regions: Record<string, number>;
  kingdoms: Record<string, number>;
  moral: number;
};

export type PendingRoll = {
  id: string;
  action: string;
  skill: string;
  attribute: AttributeKey;
  difficulty: number;
  reason: string;
  createdAtTurn: number;
  coreAttribute: CoreAttribute;
  skillId?: string;
  domain: import('@/lib/skills/types').ActionDomain;
  intent: string;
  method: string;
  opposed: boolean;
  opposedBy?: { label: string; defense: number };
  riskLevel: import('@/lib/skills/types').RiskLevel;
  advantage: number;
  disadvantage: number;
  contextualModifiers: ContextualModifier[];
  auditId: string;
  consentRequired?: boolean;
};

export type RollResult = PendingRoll & {
  die: number;
  attributeBonus: number;
  skillBonus: number;
  total: number;
  success: boolean;
  critical: 'success' | 'failure' | null;
  outcome: CheckOutcome;
  contextualBonus: number;
};

export type MemoryState = {
  worldGenesis: { originalPrompt: string; structuredSummary: string; createdAt: string };
  canon: Array<{ id: string; category: string; text: string; turn: number; createdAt: string }>;
  campaignSummary: { text: string; lastConsolidatedTurn: number; revision: number };
  session: Array<{ id: string; turn: number; text: string; importance: 'normal' | 'major' }>;
  anchor: { currentObjective: string; declaredDesires: string[]; importantRelationships: string[]; activeConflicts: string[]; relevantLocations: string[]; themes: string[] };
};

export type GameState = {
  schemaVersion: 8;
  campaignId: string;
  visualCycle: CampaignVisualCycle;
  campaign: {
    name: string;
    premise: string;
    conflict: string;
    originPrompt: string;
    sharingMode?: import('@/lib/content-sharing-policy').CampaignSharingMode;
    sharingReason?: import('@/lib/content-sharing-policy').GlobalContributionDecision['reason'];
    chapter: number;
    quests: Quest[];
    opportunities: string[];
    memory: MemoryState;
  };
  character: {
    name: string;
    className: string;
    personality: string;
    appearanceDescription: string;
    sprite: SpriteIdentity;
    origin: string;
    profession: string;
    birthRegion: string;
    level: number;
    xp: number;
    xpToNext: number;
    attributePoints: number;
    attributes: Attributes;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    energy: number;
    maxEnergy: number;
    gold: number;
    skills: Record<string, Skill>;
    inventory: Item[];
    unlockedActions: string[];
    professions: string[];
    titles: string[];
    conditions: Array<{ name: string; remainingTurns: number; modifier: number }>;
    activeEffects: Array<{ id: string; name: string; type: string; value: number; remainingTurns: number }>;
    spells: Spell[];
  };
  world: {
    day: number;
    hour: number;
    weather: string;
    currentLocationId: string;
    locations: Record<string, Location>;
    npcs: Record<string, NPC>;
    factions: Record<string, { id: string; name: string; goal: string }>;
    culture: { name: string; values: string[]; customs: string[]; notes: string };
    changes: string[];
    itemRegistry: Record<string, Item>;
    unlocks: { locations: string[]; dialogues: string[]; events: string[] };
    economy: {
      regionMultiplier: number;
      shops: Record<string, { id: string; name: string; locationId: string; products: ShopProduct[] }>;
    };
    reputation: Reputation;
    timeline: GameEvent[];
    processedTurnIds: string[];
    skillAudits: SkillResolutionAudit[];
    skillMigrationBackup: Array<{ originalKey: string; skill: unknown }>;
  };
  session: {
    turn: number;
    narrative: string;
    recentActions: string[];
    pendingRoll: PendingRoll | null;
    lastRoll: RollResult | null;
    currentTurnId: string;
    events: GameEvent[];
    combat: null | {
      enemyName: string;
      enemyHp: number;
      enemyMaxHp: number;
      defense: number;
      initiative: 'player' | 'enemy';
    };
  };
  save: {
    createdAt: string;
    updatedAt: string;
    revision: number;
  };
};

export type NewCampaignInput = { campaignName: string; characterName: string; className: string; openingPrompt: string; personality?: string; appearanceDescription?: string };

export type NarrativeWorldDelta = {
  locations?: Array<{ name: string; region: string; kind: Location['kind']; description: string; visualIdentity?: Partial<Location['visualIdentity']> }>;
  currentLocationName?: string | null;
  npcs?: Array<{ name: string; role: string; personality: string; goal: string; profession: string; locationName?: string; visualAppearance?: Partial<NPC['visualAppearance']> }>;
  npcChanges?: Array<{ name: string; status: NPC['status']; memory?: string }>;
  opportunities?: string[];
  quests?: Array<{ title: string; description: string; objective: string; status: Quest['status'] }>;
  worldChanges?: string[];
  items?: Array<{
    name: string; description: string; category: ItemCategory; rarity?: ItemRarity; weight?: number; value?: number; quantity?: number;
    origin: string; narrativeEffects?: string[]; mechanicalEffects: ItemMechanicalEffect[]; durability?: number | null;
  }>;
  spells?: SpellSuggestion[];
  mechanicalEffects?: Array<{ type: 'damage_player' | 'heal_player' | 'restore_mana' | 'change_gold' | 'change_reputation'; amount: number; target?: string; reason: string }>;
};

export type CampaignGenesisPayload = {
  narrative?: string;
  premise?: string;
  conflict?: string;
  origin?: string;
  profession?: string;
  birthRegion?: string;
  initialLocation?: { name: string; region: string; kind: Location['kind']; description: string; visualIdentity?: Partial<Location['visualIdentity']> };
  culture?: { name: string; values: string[]; customs: string[]; notes: string };
  opportunities?: string[];
  npcs?: Array<{ name: string; role: string; personality: string; goal: string; profession: string; visualAppearance?: Partial<NPC['visualAppearance']> }>;
  factions?: Array<{ name: string; goal: string }>;
  economy?: { regionMultiplier?: number; shopName?: string; products?: Array<{ name: string; kind: Item['kind']; basePrice: number; stock: number; description: string }> };
  weather?: string;
  hour?: number;
};
export type EngineTurn = { state: GameState; requiresDice: boolean; roll: PendingRoll | null; events: GameEvent[]; fallbackNarrative: string };

const ATTRIBUTE_KEYS: AttributeKey[] = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
const SKILL_RANKS: SkillRank[] = ['Iniciante', 'Aprendiz', 'Competente', 'Especialista', 'Mestre', 'Lendário'];
const now = () => new Date().toISOString();
const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clean = (value: string, max = 240) => value.trim().replace(/\s+/g, ' ').slice(0, max);
const LEGACY_LORE = /\b(?:Mara Vell|Norwich|Valedouro|Terras do Vale)\b/i;
const GENERIC_LOCATION = /^(?:assentamento|ponto de origem|estabelecimento local|área selvagem|curso de água|estrutura antiga|caminho aberto|local atual)$/i;

export function isLegacyLore(value: string) { return LEGACY_LORE.test(String(value || '')); }
export function sanitizeLegacyLoreText(value: string) {
  return String(value || '')
    .replace(/\bMara Vell\b/gi, 'uma pessoa desconhecida')
    .replace(/\b(?:Norwich|Valedouro|Terras do Vale|Assentamento)\b/gi, 'local desconhecido');
}
function emergentLocationName(value: string) {
  const name = clean(sanitizeLegacyLoreText(value || ''), 80);
  return !name || GENERIC_LOCATION.test(name) ? 'Local desconhecido' : name;
}
const hash = (value: string) => Array.from(value).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0) >>> 0;
const aiContextCache = new Map<string, ReturnType<typeof buildAiContextUncached>>();
const defaultVisualIdentity = (kind: Location['kind'], description = ''): Location['visualIdentity'] => ({
  architecture: clean(description || `${kind} com arquitetura própria da região`, 160), palette: ['violeta profundo', 'dourado suave', 'tons naturais'], fixedObjects: [],
});
const defaultAppearance = (profession = 'viajante'): NPC['visualAppearance'] => ({ clothing: clean(`traje de ${profession}`, 100), hair: 'silhueta legível', accessories: [], weapon: '', apparentAge: 'adulto', palette: ['tons locais', 'contraste violeta'] });
const defaultNpcMemory = (firstImpression = ''): NPC['memoryProfile'] => ({ firstImpression: clean(firstImpression || 'Primeiro encontro ainda sem impressão definida.', 180), sharedEvents: [], trust: 0, favors: [], conflicts: [], pendingTopics: [] });

export function xpThreshold(level: number) {
  if (level <= 1) return 0;
  const known: Record<number, number> = { 2: 100, 3: 250, 4: 450, 5: 700, 10: 4000, 20: 18000 };
  if (known[level]) return known[level];
  if (level < 10) return Math.round(700 + Math.pow(level - 5, 1.55) * 300);
  return Math.round(4000 + Math.pow(level - 10, 1.7) * 280);
}

export function attributeModifier(value: number) {
  return Math.floor((value - 10) / 2);
}

function rankFor(level: number): SkillRank {
  return SKILL_RANKS[clamp(level - 1, 0, SKILL_RANKS.length - 1)];
}

function legacyRank(rank: import('@/lib/skills/types').ProficiencyRank): SkillRank {
  return ({ untrained: 'Iniciante', novice: 'Iniciante', apprentice: 'Aprendiz', competent: 'Competente', expert: 'Especialista', master: 'Mestre', legendary: 'Lendário' } as const)[rank];
}

function synchronizeSkillAliases(skill: import('@/lib/skills/types').DynamicSkill): Skill {
  return { ...skill, attribute: CORE_TO_DISPLAY[skill.primaryAttribute], xp: skill.experience, rank: legacyRank(skill.proficiencyRank), trained: skill.proficiencyRank !== 'untrained' };
}

function makeSkill(name: string, attribute: AttributeKey, trained = false, campaignId = '', characterId = '', sourceAction?: string, createdDynamically = false): Skill {
  const definition = canonicalSkill(name);
  const dynamic = materializeDynamicSkill({ campaignId, characterId, name: definition.name || name, normalizedKey: definition.key, domain: definition.domain, attribute: DISPLAY_TO_CORE[normalizeSemanticText(attribute)] || definition.primary, sourceAction, createdDynamically, trained });
  return synchronizeSkillAliases(dynamic);
}

function classTemplate(className: string) {
  const lower = className.toLowerCase();
  if (/guerreiro|cavaleiro|bárbaro|soldado|paladino/.test(lower)) return { primary: 'Combate', attribute: 'Força' as AttributeKey, hp: 18, mana: 4, profession: 'Combatente' };
  if (/ladino|pirata|assassino|gatuno|espião/.test(lower)) return { primary: 'Furtividade', attribute: 'Destreza' as AttributeKey, hp: 13, mana: 7, profession: 'Infiltrador' };
  if (/místico|mago|bruxo|druida|feiticeiro|clérigo/.test(lower)) return { primary: 'Arcana', attribute: 'Inteligência' as AttributeKey, hp: 11, mana: 18, profession: 'Ocultista' };
  if (/cowboy|pistoleiro|atirador|caçador de recompensas/.test(lower)) return { primary: 'Combate', attribute: 'Destreza' as AttributeKey, hp: 14, mana: 5, profession: 'Pistoleiro' };
  if (/explorador|ranger|patrulheiro|caçador|batedor/.test(lower)) return { primary: 'Sobrevivência', attribute: 'Sabedoria' as AttributeKey, hp: 15, mana: 9, profession: 'Explorador' };
  return { primary: 'Sobrevivência', attribute: 'Sabedoria' as AttributeKey, hp: 15, mana: 9, profession: clean(className, 80) || 'Aventureiro' };
}

function recoveredItemCategory(name: string): ItemCategory {
  const normalized = normalizeSemanticText(name);
  if (/revolver|pistola|rifle|espada|faca|adaga|arco|machado|arma/.test(normalized)) return 'weapon';
  if (/carta|bilhete|mapa|livro|documento|diario/.test(normalized)) return 'document';
  if (/cantil|pocao|racao|comida|bebida|agua/.test(normalized)) return 'consumable';
  if (/chave/.test(normalized)) return 'key';
  if (/armadura|elmo|capacete|escudo/.test(normalized)) return 'armor';
  if (/anel|colar|amuleto|capa/.test(normalized)) return 'accessory';
  if (/corda|tocha|lanterna|ferramenta|kit/.test(normalized)) return 'tool';
  return 'narrative';
}

function recoverConfirmedInventory(state: GameState) {
  const sources = [
    state.session.narrative,
    ...state.session.events.slice(-30).map(event => event.text),
    ...state.world.timeline.slice(-30).map(event => event.text),
    ...state.world.changes.slice(-30),
  ].filter(Boolean);
  const names: string[] = [];
  const storedPattern = /(?:guarda|guardou|coloca|colocou|põe|pôs)\s+(?:cuidadosamente\s+)?(?:o|a|um|uma)?\s*([^,.!?]{2,80}?)\s+(?:na|no|em sua|dentro da)\s+(?:mochila|bolsa|inventário)/gi;
  const containerPattern = /(?:pegou|guardou|adquiriu|saqueou|recolheu)[^.!?]{0,160}?\bcontendo\s+([^.!?]{2,180})/gi;
  for (const source of sources) {
    storedPattern.lastIndex = 0;
    containerPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = storedPattern.exec(source)) !== null) names.push(match[1]);
    while ((match = containerPattern.exec(source)) !== null) names.push(...match[1].split(/\s*,\s*|\s+e\s+/i));
  }
  const known = new Set(state.character.inventory.map(item => normalizeSemanticText(item.name)));
  for (const candidate of names) {
    let name = clean(candidate, 80).replace(/^(?:o|a|os|as|um|uma|seu|sua)\s+/i, '').replace(/\s+(?:meio cheia?|com letras.*)$/i, '').trim();
    if (normalizeSemanticText(name) === 'cantil') name = 'Cantil de água';
    if (!name || known.has(normalizeSemanticText(name))) continue;
    name = name.charAt(0).toLocaleUpperCase('pt-BR') + name.slice(1);
    const item = normalizeItem({ name, description: `${name} recuperado do registro confirmado da campanha.`, category: recoveredItemCategory(name), quantity: 1 }, state.character.name, 'Recuperado da narrativa canônica da campanha.', state.session.turn);
    state.character.inventory.push(item);
    state.world.itemRegistry[item.id] = structuredClone(item);
    known.add(normalizeSemanticText(name));
  }
}

function startingAttributes(className: string): Attributes {
  const values: Attributes = { Força: 10, Destreza: 10, Constituição: 11, Inteligência: 10, Sabedoria: 10, Carisma: 10 };
  const template = classTemplate(className);
  values[template.attribute] = 15;
  if (template.attribute !== 'Constituição') values.Constituição = 13;
  return values;
}

const EVENT_TYPE_BY_KIND: Record<EventKind, GameEventType> = { action: 'ActionDeclared', roll: 'RollResolved', xp: 'WorldChanged', skill: 'WorldChanged', level: 'WorldChanged', item: 'ItemUsed', gold: 'CurrencyChanged', reputation: 'ReputationChanged', quest: 'QuestProgressed', world: 'WorldChanged', combat: 'DamageApplied', magic: 'SpellCast', system: 'WorldChanged' };

function makeEvent(state: GameState, type: EventKind, text: string, source: GameEvent['source'] = 'engine', priority = 50, persistent = true, detail: Partial<EventDraft> = {}): GameEvent {
  return {
    id: uid(), campaignId: state.campaignId, turnId: state.session.currentTurnId || `legacy-turn-${state.session.turn}`, turn: state.session.turn,
    eventType: detail.type || EVENT_TYPE_BY_KIND[type], type, source: detail.source || source, actorId: state.character.name,
    targetIds: detail.targetIds || [], payload: detail.payload || {}, schemaVersion: 1,
    priority: detail.priority || priority, text: clean(detail.text || text, 320), persistent: detail.persistent ?? persistent, createdAt: now(),
  };
}

function withEvents(state: GameState, events: GameEvent[]): GameState {
  const ordered = [...events].sort((a, b) => b.priority - a.priority);
  const next = {
    ...state,
    session: { ...state.session, events: [...ordered, ...state.session.events].slice(0, 30) },
    world: { ...state.world, timeline: [...state.world.timeline, ...ordered.filter(event => event.persistent)].slice(-300) },
  };
  return reduceGameEvents(next, ordered);
}

function locationRecord(state: Pick<GameState, 'campaignId'>, value: Pick<Location, 'id' | 'name' | 'region' | 'kind' | 'description' | 'discovered' | 'visualIdentity'>, eventId = 'genesis'): Location {
  const createdAt = now();
  return { ...value, campaignId: state.campaignId, visited: value.discovered, current: false, status: 'active', connectedLocationIds: [], residentNpcIds: [], presentNpcIds: [], tags: [value.kind], createdFromEventId: eventId, createdAt, updatedAt: createdAt };
}

function advanceClock(state: GameState, hours = 1): GameState {
  const total = state.world.hour + hours;
  return { ...state, world: { ...state.world, hour: total % 24, day: state.world.day + Math.floor(total / 24) } };
}

function updateSave(state: GameState): GameState {
  return { ...state, save: { ...state.save, updatedAt: now(), revision: state.save.revision + 1 } };
}

function defaultOpening(input: NewCampaignInput) {
  const template = classTemplate(input.className);
  const seed = clean(input.openingPrompt, 700);
  return {
    narrative: `${input.characterName} começa sua história assim: ${seed}. O mundo ao redor ainda está tomando forma a partir dessa origem. O que você faz?`,
    premise: seed,
    conflict: 'Nenhum conflito central foi imposto; tensões surgirão das escolhas e consequências da campanha.',
    origin: seed,
    profession: template.profession,
    birthRegion: 'Origem ainda não revelada',
  };
}

export function createInitialState(input: NewCampaignInput): GameState {
  const createdAt = now();
  const campaignId = uid();
  const template = classTemplate(input.className);
  const opening = defaultOpening(input);
  const attributes = startingAttributes(input.className);
  const characterId = clean(input.characterName, 60);
  const skills: Record<string, Skill> = {
    Luta: makeSkill('Luta', 'Força', template.primary === 'Combate', campaignId, characterId),
    Furtividade: makeSkill('Furtividade', 'Destreza', template.primary === 'Furtividade', campaignId, characterId),
    Sobrevivência: makeSkill('Sobrevivência', 'Sabedoria', template.primary === 'Sobrevivência', campaignId, characterId),
    Percepção: makeSkill('Percepção', 'Sabedoria', false, campaignId, characterId),
    Investigação: makeSkill('Investigação', 'Inteligência', false, campaignId, characterId),
    Persuasão: makeSkill('Persuasão', 'Carisma', false, campaignId, characterId),
    Intimidação: makeSkill('Intimidação', 'Carisma', false, campaignId, characterId),
    Arcana: makeSkill('Arcana', 'Inteligência', template.primary === 'Arcana', campaignId, characterId),
    Atletismo: makeSkill('Atletismo', 'Força', false, campaignId, characterId),
  };
  const originLocation = locationRecord({ campaignId }, { id: `origin-${hash(input.openingPrompt).toString(36)}`, name: 'Local desconhecido', region: 'Região desconhecida', kind: 'wild', description: clean(input.openingPrompt, 500), discovered: false, visualIdentity: defaultVisualIdentity('wild', input.openingPrompt) });
  originLocation.current = true;
  const ownerId = clean(input.characterName, 60);
  const initialItems = [
    normalizeItem({ name: 'Ração de viagem', description: 'Recupera forças durante um descanso.', kind: 'consumível', category: 'consumable', quantity: 3, value: 2, effects: { narrative: ['Uma refeição simples torna a marcha suportável.'], mechanical: [{ type: 'restore_hp', value: 4 }] } }, ownerId, `Equipamento inicial de ${input.className}.`),
    normalizeItem({ name: 'Tocha', description: 'Ilumina locais escuros e permite explorar sem luz.', kind: 'ferramenta', category: 'tool', quantity: 1, value: 3, effects: { narrative: ['Afasta a escuridão imediata.'], mechanical: [{ type: 'unlock_action', target: 'explorar locais escuros', value: 1 }] } }, ownerId, `Equipamento inicial de ${input.className}.`),
  ];
  const state: GameState = {
    schemaVersion: 8,
    campaignId,
    visualCycle: createVisualCycle(campaignId),
    campaign: {
      name: clean(input.campaignName, 80),
      premise: opening.premise,
      conflict: opening.conflict,
      originPrompt: clean(input.openingPrompt, 700),
      sharingMode: 'global',
      chapter: 1,
      quests: [],
      opportunities: [],
      memory: createMemoryState(input.openingPrompt, opening.premise, createdAt),
    },
    character: {
      name: clean(input.characterName, 60), className: clean(input.className, 80), personality: clean(input.personality || 'Personalidade revelada pelas escolhas.', 180), appearanceDescription: `Visual sorteado pela Engine para ${clean(input.className, 80)}.`,
      sprite: createSpriteIdentity({ id: campaignId, name: input.characterName, className: input.className, personality: input.personality, story: input.openingPrompt }), origin: opening.origin, profession: opening.profession, birthRegion: opening.birthRegion,
      level: 1, xp: 0, xpToNext: xpThreshold(2), attributePoints: 0, attributes,
      hp: template.hp + attributeModifier(attributes.Constituição), maxHp: template.hp + attributeModifier(attributes.Constituição), mana: template.mana, maxMana: template.mana, energy: 10, maxEnergy: 10,
      gold: 12, skills, inventory: initialItems, unlockedActions: [], professions: [opening.profession],
      titles: [], conditions: [], activeEffects: [], spells: [],
    },
    world: {
      day: 1, hour: 8, weather: 'Tempo variável', currentLocationId: originLocation.id, locations: { [originLocation.id]: originLocation },
      npcs: {},
      factions: {},
      culture: { name: 'Cultura ainda não revelada', values: [], customs: [], notes: 'Será descoberta conforme a campanha emergir.' },
      changes: [`A campanha nasceu da origem: ${clean(input.openingPrompt, 300)}`],
      itemRegistry: Object.fromEntries(initialItems.map(item => [item.id, structuredClone(item)])),
      unlocks: { locations: [], dialogues: [], events: [] },
      economy: { regionMultiplier: 1, shops: {} },
      reputation: { individuals: {}, cities: { [originLocation.id]: 0 }, factions: {}, regions: { [originLocation.region]: 0 }, kingdoms: {}, moral: 0 }, timeline: [], processedTurnIds: [], skillAudits: [], skillMigrationBackup: [],
    },
    session: { turn: 0, narrative: opening.narrative, recentActions: [], pendingRoll: null, lastRoll: null, currentTurnId: '', events: [], combat: null },
    save: { createdAt, updatedAt: createdAt, revision: 1 },
  };
  return state;
}

export function currentLocation(state: GameState) {
  return state.world.locations[state.world.currentLocationId] || Object.values(state.world.locations)[0];
}

export function inferSkill(action: string): { skill: string; attribute: AttributeKey } {
  const interpretation = resolveActionSemantics(action);
  return { skill: interpretation.proposedSkill || 'Sobrevivência', attribute: CORE_TO_DISPLAY[interpretation.proposedAttribute] };
}

export function interpretPlayerAction(action: string, state?: GameState) {
  return resolveActionSemantics(action, {
    previousNarrative: state?.session.narrative,
    nearbyNpcNames: state ? Object.values(state.world.npcs).filter(npc => npc.locationId === state.world.currentLocationId && npc.status === 'active').map(npc => npc.name) : [],
    knownUnlockedActions: state?.character.unlockedActions,
  });
}

function selectActionTest(state: GameState, action: string, interpretation = interpretPlayerAction(action, state), llmProposal?: Partial<ActionInterpretation>) {
  const nearby = Object.values(state.world.npcs).filter(npc => npc.locationId === state.world.currentLocationId && npc.status === 'active');
  const target = nearby.find(npc => normalizeSemanticText(action).includes(normalizeSemanticText(npc.name))) || (interpretation.opposed ? nearby[0] : undefined);
  const targetDefense = target ? clamp(10 + Math.floor(Math.max(0, target.relationship) / 20), 8, 18) : undefined;
  const contextualDifficulty = /impossível|quase impossível/i.test(action) ? 30 : /extraordinário/i.test(action) ? 26 : /extremo|mortal/i.test(action) ? 22 : undefined;
  const selection = validateTestSelection({
    campaignId: state.campaignId,
    characterId: state.character.name,
    turnId: state.session.currentTurnId || `turn-${state.session.turn}`,
    interpretation,
    existingSkills: Object.values(state.character.skills),
    llmProposal,
    contextualDifficulty,
    targetLabel: target?.name,
    targetDefense,
  });
  const conditionPenalty = state.character.conditions.reduce((sum, condition) => sum + Math.min(0, condition.modifier), 0);
  if (conditionPenalty) selection.contextualModifiers.push({ id: 'active-conditions', label: 'Condições ativas', value: conditionPenalty, source: 'condition' });
  return selection;
}

function ensureSelectionSkill(state: GameState, selection: ReturnType<typeof selectActionTest>) {
  let skill = selection.existingSkillId ? Object.values(state.character.skills).find(candidate => candidate.id === selection.existingSkillId) : undefined;
  if (!skill && selection.createSkill) {
    skill = synchronizeSkillAliases(materializeDynamicSkill({ campaignId: state.campaignId, characterId: state.character.name, name: selection.skillName, normalizedKey: selection.normalizedSkillKey, domain: selection.interpretation.domain, attribute: selection.attribute, sourceAction: selection.interpretation.rawAction, createdDynamically: true, trained: true }));
    state.character.skills[skill.name] = skill;
    selection.audit.engineSelectedSkillId = skill.id;
    selection.audit.engineSelectedSkillName = skill.name;
  }
  return skill;
}

function pendingFromSelection(selection: ReturnType<typeof selectActionTest>, action: string, turn: number, skill?: Skill): PendingRoll {
  return {
    id: uid(), action, skill: skill?.name || selection.skillName, skillId: skill?.id, attribute: CORE_TO_DISPLAY[selection.attribute], coreAttribute: selection.attribute,
    difficulty: selection.difficulty || 12, reason: selection.interpretation.reasoning, createdAtTurn: turn,
    domain: selection.interpretation.domain, intent: selection.interpretation.intent, method: selection.interpretation.actionMethod, opposed: selection.opposed, opposedBy: selection.opposedBy,
    riskLevel: selection.interpretation.riskLevel, advantage: selection.advantage, disadvantage: selection.disadvantage, contextualModifiers: selection.contextualModifiers, auditId: selection.audit.id,
    consentRequired: selection.interpretation.consentRequired,
  };
}

function progressSkillAfterCheck(state: GameState, pending: PendingRoll, outcome: CheckOutcome, events: GameEvent[]): GameState {
  const existing = Object.values(state.character.skills).find(skill => skill.id === pending.skillId || normalizeSemanticText(skill.name) === normalizeSemanticText(pending.skill));
  if (!existing) return state;
  const recent = state.world.skillAudits.slice(-8);
  const exactAction = normalizeSemanticText(pending.action);
  const repeatedExactAction = Math.max(0, recent.filter(audit => normalizeSemanticText(audit.rawPlayerAction) === exactAction).length - 1);
  const recentSameSkillUses = Math.max(0, recent.filter(audit => audit.engineSelectedSkillId === existing.id || normalizeSemanticText(audit.engineSelectedSkillName || '') === normalizeSemanticText(existing.name)).length - 1);
  const xp = meaningfulSkillXp({ difficulty: pending.difficulty, outcome, recentSameSkillUses, repeatedExactAction });
  const beforeLevel = existing.level;
  const progressed = synchronizeSkillAliases(progressDynamicSkill(existing, xp, outcome));
  if (xp > 0) events.push(makeEvent(state, 'skill', `+${xp} XP em ${progressed.name} por uso significativo.`, 'engine', 62));
  if (progressed.level > beforeLevel) events.push(makeEvent(state, 'skill', `${progressed.name} avançou para ${progressed.rank}.`, 'engine', 75));
  return { ...state, character: { ...state.character, skills: { ...state.character.skills, [existing.name]: progressed } } };
}

export function grantMilestoneXp(state: GameState, amount: number, reason: string, events: GameEvent[]): GameState {
  if (amount <= 0) return state;
  let character = { ...state.character, xp: state.character.xp + amount };
  events.push(makeEvent(state, 'xp', `+${amount} XP — ${reason}.`, 'engine', 80));
  while (character.xp >= character.xpToNext) {
    character.level += 1;
    character.attributePoints += 1;
    character.maxHp += 2 + Math.max(0, attributeModifier(character.attributes.Constituição));
    character.hp = character.maxHp;
    character.maxMana += 1;
    character.mana = character.maxMana;
    character.xpToNext = xpThreshold(character.level + 1);
    events.push(makeEvent(state, 'level', `Nível ${character.level} conquistado. Você recebeu 1 ponto de atributo.`, 'engine', 100));
  }
  return { ...state, character };
}

export function applyNarrativeWorldDelta(inputState: GameState, delta?: NarrativeWorldDelta, narrative = '', deferSave = false): GameState {
  if (!delta) return inputState;
  let state = structuredClone(inputState);
  const events: GameEvent[] = [];
  const canonicalNarrative = sanitizeLegacyLoreText(narrative);
  const normalizedNarrative = normalizeSemanticText(canonicalNarrative);

  for (const candidate of (delta.locations || []).slice(0, 4)) {
    const name = emergentLocationName(candidate.name || '');
    if (name === 'Local desconhecido' || isLegacyLore(candidate.name || '') || !normalizedNarrative.includes(normalizeSemanticText(name))) continue;
    const region = clean(candidate.region || currentLocation(state).region, 80);
    const id = `location-${hash(`${region}:${name}`).toString(36)}`;
    const kind = clean(candidate.kind || 'wild', 40).toLowerCase();
    const description = clean(candidate.description || 'Local emergente.', 300);
    const location = locationRecord(state, { id, name, region, kind, description, discovered: true, visualIdentity: { ...defaultVisualIdentity(kind, description), ...candidate.visualIdentity } }, state.session.currentTurnId || 'llm-suggestion');
    if (!state.world.locations[id]) events.push(makeEvent(state, 'world', `Local descoberto: ${name}.`, 'world', 65, true, { type: 'LocationCreated', targetIds: [id], payload: { locationId: id } }));
    state.world.locations[id] = location;
  }
  if (delta.currentLocationName) {
    const destination = Object.values(state.world.locations).find(location => location.name.toLowerCase() === delta.currentLocationName?.toLowerCase());
    if (destination && destination.id !== state.world.currentLocationId) {
      const previous = currentLocation(state);
      if (previous) { previous.current = false; previous.connectedLocationIds = Array.from(new Set([...previous.connectedLocationIds, destination.id])); previous.updatedAt = now(); }
      state.world.currentLocationId = destination.id;
      destination.current = true; destination.visited = true; destination.updatedAt = now();
      destination.connectedLocationIds = Array.from(new Set([...destination.connectedLocationIds, previous?.id].filter(Boolean) as string[]));
      events.push(makeEvent(state, 'world', `Local atual: ${destination.name}.`, 'world', 70, true, { type: 'LocationDiscovered', targetIds: [destination.id], payload: { locationId: destination.id } }));
    }
  }

  for (const candidate of (delta.npcs || []).slice(0, 6)) {
    const name = clean(candidate.name || '', 60);
    if (!name || isLegacyLore(name) || !normalizedNarrative.includes(normalizeSemanticText(name))) continue;
    const id = `npc-${hash(name.toLowerCase()).toString(36)}`;
    const targetLocation = Object.values(state.world.locations).find(location => location.name.toLowerCase() === candidate.locationName?.toLowerCase()) || currentLocation(state);
    const previous = state.world.npcs[id];
    state.world.npcs[id] = {
      id, name,
      campaignId: state.campaignId,
      role: clean(candidate.role || 'Pessoa do mundo', 80),
      personality: clean(candidate.personality || 'Personalidade ainda não revelada.', 140),
      goal: clean(candidate.goal || 'Possui interesses próprios.', 180),
      goals: [clean(candidate.goal || 'Possui interesses próprios.', 180)],
      profession: clean(candidate.profession || 'Ocupação desconhecida', 80),
      locationId: targetLocation.id,
      relationship: previous?.relationship || 0,
      relationships: previous?.relationships || [], reputationWithPlayer: previous?.reputationWithPlayer || previous?.relationship || 0,
      inventoryIds: previous?.inventoryIds || [], createdFromEventId: previous?.createdFromEventId || state.session.currentTurnId || 'llm-suggestion',
      knowledge: previous?.knowledge || [],
      memories: previous?.memories || [],
      status: previous?.status || 'active',
      memoryProfile: previous?.memoryProfile || defaultNpcMemory(candidate.personality),
      visualAppearance: { ...(previous?.visualAppearance || defaultAppearance(candidate.profession)), ...candidate.visualAppearance },
      sprite: previous?.sprite || createSpriteIdentity({ id, name, className: candidate.profession || candidate.role || 'Pessoa do mundo', personality: candidate.personality, appearance: [candidate.visualAppearance?.clothing, candidate.visualAppearance?.hair].filter(Boolean).join(', '), story: candidate.goal }),
    };
    targetLocation.presentNpcIds = Array.from(new Set([...targetLocation.presentNpcIds, id]));
    targetLocation.residentNpcIds = Array.from(new Set([...targetLocation.residentNpcIds, id]));
    if (!previous) events.push(makeEvent(state, 'world', `Pessoa conhecida: ${name}.`, 'world', 55, true, { type: 'NpcCreated', targetIds: [id], payload: { npcId: id } }));
  }

  let continuityNeeded = false;
  for (const change of (delta.npcChanges || []).slice(0, 6)) {
    const npc = Object.values(state.world.npcs).find(candidate => candidate.name.toLowerCase() === change.name?.toLowerCase());
    if (!npc) continue;
    const allowed: NPC['status'][] = ['active', 'dead', 'missing', 'departed'];
    npc.status = allowed.includes(change.status) ? change.status : npc.status;
    const npcLocation = state.world.locations[npc.locationId];
    if (npcLocation) npcLocation.presentNpcIds = npc.status === 'active' ? Array.from(new Set([...npcLocation.presentNpcIds, npc.id])) : npcLocation.presentNpcIds.filter(id => id !== npc.id);
    if (change.memory) {
      const memory = clean(change.memory, 180);
      npc.memories = [...npc.memories, memory].slice(-12);
      npc.memoryProfile.sharedEvents = [...npc.memoryProfile.sharedEvents, memory].slice(-20);
    }
    if (npc.status !== 'active') continuityNeeded = true;
    events.push(makeEvent(state, 'world', `${npc.name}: ${npc.status}.`, 'world', 75, true, { type: npc.status === 'dead' ? 'NpcDied' : 'WorldChanged', targetIds: [npc.id], payload: { status: npc.status } }));
  }

  const opportunities = [...state.campaign.opportunities, ...(delta.opportunities || []).map(value => clean(value, 220)).filter(Boolean)];
  if (continuityNeeded && !(delta.opportunities || []).length) opportunities.push('As consequências abriram uma rota alternativa ainda não explorada.');
  state.campaign.opportunities = Array.from(new Set(opportunities)).slice(-20);

  let rewardXp = 0;
  let rewardGold = 0;
  for (const update of (delta.quests || []).slice(0, 4)) {
    const title = clean(update.title || '', 100);
    if (!title) continue;
    const existing = state.campaign.quests.find(quest => quest.title.toLowerCase() === title.toLowerCase());
    const status: Quest['status'] = ['active', 'completed', 'failed', 'abandoned'].includes(update.status) ? update.status : 'active';
    if (existing) {
      const justCompleted = existing.status !== 'completed' && status === 'completed';
      existing.status = status;
      existing.description = clean(update.description || existing.description, 300);
      existing.memory.progress = [...existing.memory.progress, `${status}: ${clean(update.objective || update.description || title, 180)}`].slice(-20);
      if (status !== 'active') existing.memory.consequences = [...existing.memory.consequences, clean(update.description || `${title}: ${status}`, 220)].slice(-12);
      if (status === 'completed') existing.objectives = existing.objectives.map(objective => ({ ...objective, completed: true }));
      if (justCompleted) { rewardXp += existing.rewardXp; rewardGold += existing.rewardGold; events.push(makeEvent(state, 'quest', `Objetivo concluído: ${existing.title}.`, 'engine', 90)); }
    } else {
      const timestamp = now();
      const quest: Quest = { id: uid(), title, description: clean(update.description || title, 300), objectives: [{ id: uid(), text: clean(update.objective || update.description || title, 180), completed: status === 'completed', conditionType: 'quest_progress', currentValue: status === 'completed' ? 1 : 0, targetValue: 1, status: status === 'completed' ? 'completed' : 'active', eventSubscriptions: ['QuestProgressed'] }], status, rewardXp: 35, rewardGold: 8, source: 'emergent', originType: 'consequence', originEventId: state.session.currentTurnId || `turn-${state.session.turn}`, relevantNpcIds: [], relevantLocationIds: [state.world.currentLocationId], consequences: [], rewards: [{ type: 'xp', amount: 35 }, { type: 'gold', amount: 8 }], createdAt: timestamp, updatedAt: timestamp, memory: { origin: `Surgiu no turno ${state.session.turn}.`, motive: clean(update.description || title, 240), progress: status === 'active' ? [] : [status], consequences: [], personalGoal: clean(update.objective || '', 180) } };
      state.campaign.quests.push(quest);
      events.push(makeEvent(state, 'quest', `Novo objetivo emergente: ${title}.`, 'world', 70, true, { type: 'QuestCreated', targetIds: [quest.id], payload: { questId: quest.id } }));
      if (status === 'completed') { rewardXp += quest.rewardXp; rewardGold += quest.rewardGold; }
    }
  }
  if (rewardXp) state = grantMilestoneXp(state, rewardXp, 'objetivo emergente concluído', events);
  if (rewardGold) state.character.gold += rewardGold;

  const changes = (delta.worldChanges || []).map(value => clean(value, 260)).filter(Boolean);
  state.world.changes = [...state.world.changes, ...changes].slice(-100);
  for (const change of changes) events.push(makeEvent(state, 'world', change, 'world', 60));
  const itemResult = registerSuggestedItems(state, delta.items, canonicalNarrative);
  state = itemResult.state;
  for (const item of itemResult.created) events.push(makeEvent(state, 'item', `Item adquirido: ${item.name} (${item.rarity}). ${item.effects.mechanical.map(effect => effect.target || effect.type).join(', ')}.`, 'world', 78));
  const learnedSpells = learnSuggestedSpells(state, delta.spells || []);
  for (const spell of learnedSpells) events.push(makeEvent(state, 'magic', `Magia aprendida: ${spell.name}. Custo ${spell.manaCost} de mana.`, 'engine', 90, true, { type: 'SpellLearned', targetIds: [spell.id], payload: { spellId: spell.id, manaCost: spell.manaCost } }));
  for (const effect of (delta.mechanicalEffects || []).slice(0, 4)) {
    const amount = clamp(Math.abs(Number(effect.amount) || 0), 0, Math.max(1, state.character.level * 4 + 8));
    if (!amount || !clean(effect.reason || '', 140)) continue;
    if (effect.type === 'damage_player') { const before = state.character.hp; state.character.hp = clamp(before - amount, 0, state.character.maxHp); events.push(makeEvent(state, 'combat', `${state.character.name} sofreu ${before - state.character.hp} de dano: ${effect.reason}.`, 'engine', 88, true, { type: 'DamageApplied', targetIds: [state.character.name], payload: { amount: before - state.character.hp, reason: effect.reason } })); }
    if (effect.type === 'heal_player') { const before = state.character.hp; state.character.hp = clamp(before + amount, 0, state.character.maxHp); events.push(makeEvent(state, 'combat', `${state.character.name} recuperou ${state.character.hp - before} de vitalidade: ${effect.reason}.`, 'engine', 82, true, { type: 'HealingApplied', targetIds: [state.character.name], payload: { amount: state.character.hp - before, reason: effect.reason } })); }
    if (effect.type === 'restore_mana') { const before = state.character.mana; state.character.mana = clamp(before + amount, 0, state.character.maxMana); events.push(makeEvent(state, 'magic', `${state.character.mana - before} de mana restaurada: ${effect.reason}.`, 'engine', 82, true, { type: 'ManaRestored', targetIds: [state.character.name], payload: { amount: state.character.mana - before, reason: effect.reason } })); }
    if (effect.type === 'change_gold') { const signed = Number(effect.amount) < 0 ? -amount : amount; const before = state.character.gold; state.character.gold = Math.max(0, before + signed); events.push(makeEvent(state, 'gold', `Moedas ${state.character.gold - before >= 0 ? '+' : ''}${state.character.gold - before}: ${effect.reason}.`, 'engine', 80, true, { type: 'CurrencyChanged', targetIds: [state.character.name], payload: { amount: state.character.gold - before, reason: effect.reason } })); }
    if (effect.type === 'change_reputation') { const signed = Number(effect.amount) < 0 ? -amount : amount; const location = currentLocation(state); state.world.reputation.cities[location.id] = clamp((state.world.reputation.cities[location.id] || 0) + signed, -100, 100); events.push(makeEvent(state, 'reputation', `Reputação em ${location.name} ${signed >= 0 ? '+' : ''}${signed}: ${effect.reason}.`, 'engine', 80, true, { type: 'ReputationChanged', targetIds: [location.id], payload: { amount: signed, reason: effect.reason } })); }
  }
  const evolved = withEvents(state, events);
  return deferSave ? evolved : updateSave(evolved);
}

function applySocialConsequences(state: GameState, action: string, events: GameEvent[]): GameState {
  const nearby = Object.values(state.world.npcs).filter(npc => npc.locationId === state.world.currentLocationId && npc.status === 'active');
  const target = nearby.find(npc => action.toLowerCase().includes(npc.name.toLowerCase())) || (/ajud|ameaç|insult|agradec|convers|falar/.test(action.toLowerCase()) ? nearby[0] : undefined);
  if (!target) return state;
  const lower = action.toLowerCase();
  const positive = /ajud|proteg|agradec|gentil|honest|cumpriment/.test(lower);
  const negative = /ameaç|insult|roub|agred|mentir/.test(lower);
  if (!positive && !negative) return state;
  const delta = positive ? 2 : -2;
  const socialMemory = clean(action, 180);
  const npc = {
    ...target,
    relationship: clamp(target.relationship + delta, -100, 100),
    reputationWithPlayer: clamp(target.relationship + delta, -100, 100),
    memories: [...target.memories, socialMemory].slice(-12),
    memoryProfile: {
      ...target.memoryProfile,
      sharedEvents: [...target.memoryProfile.sharedEvents, socialMemory].slice(-20),
      trust: clamp(target.memoryProfile.trust + delta, -100, 100),
      favors: positive ? [...target.memoryProfile.favors, socialMemory].slice(-10) : target.memoryProfile.favors,
      conflicts: negative ? [...target.memoryProfile.conflicts, socialMemory].slice(-10) : target.memoryProfile.conflicts,
    },
  };
  const location = currentLocation(state);
  const reputation = structuredClone(state.world.reputation);
  reputation.individuals[npc.id] = npc.relationship;
  reputation.cities[state.world.currentLocationId] = clamp((reputation.cities[state.world.currentLocationId] || 0) + Math.sign(delta), -100, 100);
  reputation.regions[location.region] = clamp((reputation.regions[location.region] || 0) + Math.sign(delta), -100, 100);
  reputation.moral = clamp(reputation.moral + Math.sign(delta), -100, 100);
  events.push(makeEvent(state, 'reputation', `Relação com ${npc.name} ${delta > 0 ? `+${delta}` : delta}. Reputação em ${location.name} ${delta > 0 ? '+1' : '-1'}.`, 'npc', 75));
  return { ...state, world: { ...state.world, npcs: { ...state.world.npcs, [npc.id]: npc }, reputation } };
}

export function beginAction(inputState: GameState, rawAction: string, requestedTurnId = uid()): EngineTurn {
  const action = clean(rawAction, 500);
  if (!action) throw new Error('Descreva uma ação.');
  if (inputState.session.pendingRoll) throw new Error('Resolva a rolagem pendente antes de agir novamente.');
  let state = structuredClone(inputState);
  const turnId = clean(requestedTurnId, 100) || uid();
  if (state.world.processedTurnIds.includes(turnId)) return { state, requiresDice: Boolean(state.session.pendingRoll), roll: state.session.pendingRoll, events: [], fallbackNarrative: state.session.narrative };
  state.session.currentTurnId = turnId;
  tickSpellCooldowns(state);
  state.character.activeEffects = state.character.activeEffects.map(effect => ({ ...effect, remainingTurns: effect.remainingTurns - 1 })).filter(effect => effect.remainingTurns > 0);
  state.visualCycle = advanceVisualCycle(state.visualCycle);
  state.session.turn += 1;
  state.session.lastRoll = null;
  state.session.recentActions = [...state.session.recentActions, action].slice(-8);
  state.campaign.memory = appendSessionMemory(state.campaign.memory, state.session.turn, `Ação declarada: ${action}`);
  state = advanceClock(state, 1);
  const events: GameEvent[] = [makeEvent(state, 'action', action, 'player', 30, false)];
  state = applySocialConsequences(state, action, events);
  const interpretation = interpretPlayerAction(action, state);
  const selection = selectActionTest(state, action, interpretation);
  state.world.skillAudits = [...state.world.skillAudits, selection.audit].slice(-200);
  const skill = ensureSelectionSkill(state, selection);
  const requiresDice = selection.requiresRoll;
  if (requiresDice) {
    state.session.pendingRoll = pendingFromSelection(selection, action, state.session.turn, skill);
    events.push(makeEvent(state, 'roll', `Teste necessário: ${state.session.pendingRoll.attribute} + ${state.session.pendingRoll.skill} contra CD ${state.session.pendingRoll.difficulty}. ${state.session.pendingRoll.reason}`, 'engine', 85, false));
    if (selection.audit.newSkillCreated && skill) events.push(makeEvent(state, 'skill', `Nova perícia descoberta: ${skill.name} (${skill.rank}).`, 'engine', 68));
  }
  state = updateSave(withEvents(state, events));
  return {
    state,
    requiresDice,
    roll: state.session.pendingRoll,
    events,
    fallbackNarrative: requiresDice
      ? `Sua ação encontra resistência real. O resultado depende de ${state.session.pendingRoll!.attribute} + ${state.session.pendingRoll!.skill} contra CD ${state.session.pendingRoll!.difficulty}.`
      : `Uma consequência começa a se revelar em ${currentLocation(state).name}. O que você faz?`,
  };
}

function resolveCombat(state: GameState, result: RollResult, events: GameEvent[]): GameState {
  if (!/atac|golpear|lutar|dispar/.test(result.action.toLowerCase())) return state;
  let combat = state.session.combat || { enemyName: 'Adversário', enemyHp: 10, enemyMaxHp: 10, defense: 12, initiative: 'player' as const };
  if (result.success) {
    const damage = Math.max(1, 3 + attributeModifier(state.character.attributes.Força) + equipmentEffectTotal(state, 'damage_bonus') + (result.critical === 'success' ? 4 : 0));
    combat = { ...combat, enemyHp: Math.max(0, combat.enemyHp - damage) };
    events.push(makeEvent(state, 'combat', `${combat.enemyName} sofreu ${damage} de dano.`, 'combat', 75, true, { type: 'DamageApplied', targetIds: [combat.enemyName], payload: { amount: damage, basicAttack: true } }));
    if (combat.enemyHp === 0) {
      events.push(makeEvent(state, 'combat', `${combat.enemyName} foi derrotado.`, 'combat', 95));
      state = grantMilestoneXp(state, 18, 'vitória em um confronto relevante', events);
      return { ...state, session: { ...state.session, combat: null } };
    }
  } else {
    const damage = Math.max(0, (result.critical === 'failure' ? 4 : 2) - equipmentEffectTotal(state, 'defense_bonus'));
    state = { ...state, character: { ...state.character, hp: Math.max(0, state.character.hp - damage) } };
    events.push(makeEvent(state, 'combat', `${state.character.name} sofreu ${damage} de dano.`, 'combat', 80, true, { type: 'DamageApplied', targetIds: [state.character.name], payload: { amount: damage } }));
  }
  return { ...state, session: { ...state.session, combat } };
}

export function resolvePendingRoll(inputState: GameState, forcedDie?: number): { state: GameState; result: RollResult; events: GameEvent[]; fallbackNarrative: string } {
  const pending = inputState.session.pendingRoll;
  if (!pending) throw new Error('Não há rolagem pendente.');
  let state = structuredClone(inputState);
  state.visualCycle = advanceVisualCycle(state.visualCycle);
  const skill = Object.values(state.character.skills).find(candidate => candidate.id === pending.skillId || normalizeSemanticText(candidate.name) === normalizeSemanticText(pending.skill));
  const equipmentAttribute = equipmentEffectTotal(state, 'attribute_bonus', pending.attribute);
  const equipmentSkill = equipmentEffectTotal(state, 'skill_bonus', pending.skill);
  const contextualModifiers = [...(pending.contextualModifiers || [])];
  if (equipmentAttribute) contextualModifiers.push({ id: 'equipment-attribute', label: `Equipamento em ${pending.attribute}`, value: equipmentAttribute, source: 'equipment' });
  if (equipmentSkill) contextualModifiers.push({ id: 'equipment-skill', label: `Equipamento em ${pending.skill}`, value: equipmentSkill, source: 'equipment' });
  const check = resolveSkillCheck({
    id: pending.id,
    turnId: state.session.currentTurnId,
    characterId: state.character.name,
    attributeValue: state.character.attributes[pending.attribute],
    skill,
    difficulty: pending.difficulty,
    forcedDie,
    advantage: pending.advantage,
    disadvantage: pending.disadvantage,
    contextualModifiers,
    opposedBy: pending.opposedBy,
  });
  const die = check.rollResult;
  const total = check.totalResult;
  const result: RollResult = {
    ...pending, die, attributeBonus: check.attributeBonus, skillBonus: check.skillBonus, contextualBonus: check.contextualBonus, total,
    success: check.outcome === 'success' || check.outcome === 'critical_success',
    critical: check.outcome === 'critical_success' ? 'success' : check.outcome === 'critical_failure' ? 'failure' : null,
    outcome: check.outcome,
  };
  const outcomeLabel: Record<CheckOutcome, string> = { critical_failure: 'FALHA CRÍTICA', failure: 'FALHA', partial_success: 'SUCESSO PARCIAL', success: 'SUCESSO', critical_success: 'SUCESSO CRÍTICO' };
  const events: GameEvent[] = [makeEvent(state, 'roll', `${pending.attribute} + ${pending.skill}: d20 (${die}) + atributo ${check.attributeBonus >= 0 ? '+' : ''}${check.attributeBonus} + perícia ${check.skillBonus} + contexto ${check.contextualBonus} = ${total} contra CD ${pending.difficulty}. ${outcomeLabel[result.outcome]}.`, 'engine', 100)];
  state.session.pendingRoll = null;
  state.session.lastRoll = result;
  state = progressSkillAfterCheck(state, pending, result.outcome, events);
  state = resolveCombat(state, result, events);
  const location = currentLocation(state);
  state.campaign.memory = appendSessionMemory(state.campaign.memory, state.session.turn, `${pending.skill} ${result.success ? 'teve sucesso' : 'falhou'} (${total}/${pending.difficulty}).`, result.critical ? 'major' : 'normal');
  state = updateSave(withEvents(state, events));
  return {
    state,
    result,
    events,
    fallbackNarrative: `Resultado mecânico registrado: ${pending.skill} ${result.success ? 'teve sucesso' : 'falhou'} (${total}/${pending.difficulty}) em ${location.name}. A consequência ficcional deve ser narrada pela IA.`,
  };
}

export function acceptNarrative(state: GameState, narrative: string, memorySummary?: string, memoryUpdate: string[] = [], worldDelta?: NarrativeWorldDelta): GameState {
  const safeNarrative = clean(sanitizeLegacyLoreText(narrative), 1800) || sanitizeLegacyLoreText(state.session.narrative);
  const memory = updateNarrativeMemory(state, safeNarrative, memorySummary, memoryUpdate, worldDelta);
  const processedTurnIds = state.session.currentTurnId ? Array.from(new Set([...state.world.processedTurnIds, state.session.currentTurnId])).slice(-120) : state.world.processedTurnIds;
  return updateSave({ ...state, campaign: { ...state.campaign, memory }, world: { ...state.world, processedTurnIds }, session: { ...state.session, narrative: safeNarrative } });
}

export function setActiveIllustration(inputState: GameState, assetId: string, generated = false): GameState {
  const visualCycle = attachCycleIllustration(inputState.visualCycle, clean(assetId, 160), generated);
  if (visualCycle === inputState.visualCycle) return inputState;
  return updateSave({ ...inputState, visualCycle });
}

export function acceptSuggestedRoll(inputState: GameState, action: string, suggestion?: { skill?: string | null; attribute?: string | null; difficulty?: number | null; reason?: string | null; interpretation?: Partial<ActionInterpretation> | null }): GameState {
  if (inputState.session.pendingRoll || !suggestion?.skill) return inputState;
  const state = structuredClone(inputState);
  const deterministic = interpretPlayerAction(action, state);
  const proposedCore = suggestion.interpretation?.proposedAttribute
    || DISPLAY_TO_CORE[normalizeSemanticText(suggestion.attribute || '')]
    || deterministic.proposedAttribute;
  const llmProposal: Partial<ActionInterpretation> = {
    ...suggestion.interpretation,
    proposedSkill: clean(suggestion.interpretation?.proposedSkill || suggestion.skill, 60),
    proposedAttribute: proposedCore,
    requiresRoll: true,
    reasoning: clean(suggestion.interpretation?.reasoning || suggestion.reason || '', 240),
  };
  let interpretation = deterministic;
  const unresolvedByRules = deterministic.domain === 'general' && /não identificou risco/i.test(deterministic.reasoning);
  if (unresolvedByRules && llmProposal.domain && llmProposal.domain !== 'general' && llmProposal.reasoning) {
    interpretation = {
      ...deterministic,
      intent: clean(llmProposal.intent || 'intenção interpretada semanticamente', 160),
      domain: llmProposal.domain,
      proposedSkill: llmProposal.proposedSkill || deterministic.proposedSkill,
      proposedAttribute: proposedCore,
      actionMethod: clean(llmProposal.actionMethod || 'método declarado pelo jogador', 120),
      requiresRoll: true,
      opposed: Boolean(llmProposal.opposed),
      riskLevel: llmProposal.riskLevel && llmProposal.riskLevel !== 'none' ? llmProposal.riskLevel : 'medium',
      reasoning: clean(llmProposal.reasoning, 240),
      possibleExistingSkillKeys: llmProposal.possibleExistingSkillKeys || [],
      trainable: true,
      trivial: false,
      consentRequired: llmProposal.consentRequired,
    };
  }
  const selection = selectActionTest(state, action, interpretation, llmProposal);
  if (!selection.requiresRoll) {
    state.world.skillAudits = [...state.world.skillAudits, selection.audit].slice(-200);
    return updateSave(state);
  }
  selection.audit.difficulty = selection.difficulty;
  state.world.skillAudits = [...state.world.skillAudits, selection.audit].slice(-200);
  const skill = ensureSelectionSkill(state, selection);
  const pending = pendingFromSelection(selection, action, state.session.turn, skill);
  const events = [makeEvent(state, 'roll', `Teste necessário: ${pending.attribute} + ${pending.skill} contra CD ${pending.difficulty}. ${pending.reason}`, 'engine', 85, false)];
  if (selection.audit.newSkillCreated && skill) events.push(makeEvent(state, 'skill', `Nova perícia descoberta: ${skill.name} (${skill.rank}).`, 'engine', 68));
  return updateSave(withEvents({ ...state, session: { ...state.session, pendingRoll: pending } }, events));
}

export function spendAttributePoint(inputState: GameState, attribute: AttributeKey): { state: GameState; events: GameEvent[] } {
  if (!ATTRIBUTE_KEYS.includes(attribute)) throw new Error('Atributo inválido.');
  if (inputState.character.attributePoints < 1) throw new Error('Você não possui pontos de atributo.');
  if (inputState.character.attributes[attribute] >= 20) throw new Error('Este atributo já atingiu o limite atual.');
  let state = structuredClone(inputState);
  const previousConstitution = attributeModifier(state.character.attributes.Constituição);
  state.character.attributes[attribute] += 1;
  state.character.attributePoints -= 1;
  if (attribute === 'Constituição') {
    const increase = Math.max(0, attributeModifier(state.character.attributes.Constituição) - previousConstitution);
    state.character.maxHp += increase;
    state.character.hp += increase;
  }
  const events = [makeEvent(state, 'level', `${attribute} aumentou para ${state.character.attributes[attribute]}.`, 'engine', 90)];
  state = updateSave(withEvents(state, events));
  return { state, events };
}

export function performItemAction(inputState: GameState, input: ItemActionInput): { state: GameState; events: GameEvent[]; narrative: string } {
  const prepared = { ...inputState, visualCycle: advanceVisualCycle(inputState.visualCycle) };
  const result = executeItemAction(prepared, input);
  const text = result.messages.join(' ') || `${result.item.name} alterou permanentemente o estado da campanha.`;
  const eventType: GameEventType = input.action === 'lose' || input.action === 'destroy' || input.action === 'discard' ? 'ItemLost' : input.action === 'use' ? 'ItemUsed' : 'WorldChanged';
  const events = [makeEvent(result.state, 'item', text, 'engine', input.action === 'destroy' || input.action === 'lose' ? 82 : 70, true, { type: eventType, targetIds: [result.item.id], payload: { itemId: result.item.id, action: input.action } })];
  if (result.state.character.hp > inputState.character.hp) events.push(makeEvent(result.state, 'combat', `Vitalidade restaurada em ${result.state.character.hp - inputState.character.hp}.`, 'engine', 82, true, { type: 'HealingApplied', targetIds: [result.state.character.name], payload: { amount: result.state.character.hp - inputState.character.hp, itemId: result.item.id } }));
  if (result.state.character.mana > inputState.character.mana) events.push(makeEvent(result.state, 'magic', `Mana restaurada em ${result.state.character.mana - inputState.character.mana}.`, 'engine', 82, true, { type: 'ManaRestored', targetIds: [result.state.character.name], payload: { amount: result.state.character.mana - inputState.character.mana, itemId: result.item.id } }));
  const state = updateSave(withEvents(result.state, events));
  return { state, events, narrative: `${text} O mundo registra a consequência. O que você faz?` };
}

export function performSpellCast(inputState: GameState, spellId: string): { state: GameState; events: GameEvent[]; narrative: string } {
  const prepared = structuredClone(inputState);
  prepared.visualCycle = advanceVisualCycle(prepared.visualCycle);
  const result = castSpell(prepared, spellId);
  const events = result.events.map(draft => makeEvent(result.state, 'magic', draft.text, draft.source || 'engine', draft.priority || 80, draft.persistent ?? true, draft));
  const state = updateSave(withEvents(result.state, events));
  return { state, events, narrative: `${events.map(event => event.text).join(' ')} O que você faz?` };
}

export function consumeInventoryItem(inputState: GameState, itemId: string) {
  return performItemAction(inputState, { action: 'use', itemId });
}

export function productPrice(state: GameState, product: ShopProduct) {
  const cityReputation = state.world.reputation.cities[state.world.currentLocationId] || 0;
  const reputationDiscount = clamp(cityReputation * 0.005, -0.25, 0.2);
  return Math.max(1, Math.round(product.basePrice * state.world.economy.regionMultiplier * (1 - reputationDiscount)));
}

export function buyProduct(inputState: GameState, shopId: string, productId: string): { state: GameState; events: GameEvent[]; narrative: string } {
  const shop = inputState.world.economy.shops[shopId];
  if (!shop || shop.locationId !== inputState.world.currentLocationId) throw new Error('Esta loja não está disponível neste local.');
  const product = shop.products.find(candidate => candidate.id === productId);
  if (!product || product.stock < 1) throw new Error('Produto esgotado.');
  const price = productPrice(inputState, product);
  if (inputState.character.gold < price) throw new Error('Moedas insuficientes.');
  let state = structuredClone(inputState);
  state.visualCycle = advanceVisualCycle(state.visualCycle);
  state.character.gold -= price;
  const existing = state.character.inventory.find(item => item.name === product.name);
  if (existing) { existing.quantity = Math.min(existing.stack.max, existing.quantity + 1); state.world.itemRegistry[existing.id] = structuredClone(existing); }
  else {
    const item = normalizeItem({ name: product.name, kind: product.kind, description: product.description, quantity: 1, value: product.basePrice }, state.character.name, `Comprado em ${shop.name}.`, state.session.turn);
    state.character.inventory.push(item);
    state.world.itemRegistry[item.id] = structuredClone(item);
  }
  state.world.economy.shops[shopId].products = state.world.economy.shops[shopId].products.map(candidate => candidate.id === productId ? { ...candidate, stock: candidate.stock - 1 } : candidate);
  const events = [makeEvent(state, 'gold', `${product.name} comprado por ${price} moedas.`, 'engine', 70)];
  state = updateSave(withEvents(state, events));
  return { state, events, narrative: `A compra é concluída no ${shop.name}. ${product.name} agora está na mochila. O que você faz?` };
}

export function applyGenesis(state: GameState, genesis: CampaignGenesisPayload): GameState {
  const candidate = genesis.initialLocation;
  const fallback = currentLocation(state);
  const locationName = emergentLocationName(candidate?.name || fallback.name);
  const locationKnown = locationName !== 'Local desconhecido';
  const region = locationKnown ? clean(sanitizeLegacyLoreText(candidate?.region || fallback.region), 80) : 'Região desconhecida';
  const genesisKind = locationKnown ? clean(candidate?.kind || fallback.kind || 'wild', 40).toLowerCase() : 'wild';
  const location = locationRecord(state, {
    id: `location-${hash(`${region}:${locationName}`).toString(36)}`,
    name: locationName,
    region,
    kind: genesisKind,
    description: clean(candidate?.description || fallback.description, 400),
    discovered: locationKnown,
    visualIdentity: { ...defaultVisualIdentity(genesisKind, candidate?.description || fallback.description), ...candidate?.visualIdentity },
  }, 'world-genesis');
  location.current = true;
  const npcs: Record<string, NPC> = {};
  location.residentNpcIds = Object.keys(npcs);
  location.presentNpcIds = Object.keys(npcs);
  const factions: GameState['world']['factions'] = {};
  for (const candidateFaction of (genesis.factions || []).slice(0, 4)) {
    const name = clean(candidateFaction.name || '', 80);
    if (!name) continue;
    const id = `faction-${hash(name.toLowerCase()).toString(36)}`;
    factions[id] = { id, name, goal: clean(candidateFaction.goal || 'Possui interesses próprios.', 180) };
  }
  const shops: GameState['world']['economy']['shops'] = {};
  if (genesis.economy?.shopName && genesis.economy.products?.length) {
    const shopName = clean(genesis.economy.shopName, 80);
    const shopId = `shop-${hash(`${location.id}:${shopName}`).toString(36)}`;
    const allowedItemKinds: Item['kind'][] = ['arma', 'armadura', 'consumível', 'ferramenta', 'material', 'missão'];
    shops[shopId] = { id: shopId, name: shopName, locationId: location.id, products: genesis.economy.products.slice(0, 8).map(product => ({ id: `product-${hash(`${shopId}:${product.name}`).toString(36)}`, name: clean(product.name, 80), kind: allowedItemKinds.includes(product.kind) ? product.kind : 'material', basePrice: clamp(Number(product.basePrice) || 1, 1, 500), stock: clamp(Number(product.stock) || 1, 0, 99), description: clean(product.description || '', 180) })) };
  }
  const culture = genesis.culture || state.world.culture;
  const premise = clean(genesis.premise || state.campaign.originPrompt, 500);
  const next: GameState = {
    ...state,
    campaign: { ...state.campaign, premise, conflict: clean(genesis.conflict || state.campaign.conflict, 500), opportunities: Array.from(new Set((genesis.opportunities || []).map(value => clean(value, 220)).filter(Boolean))).slice(0, 12), memory: { ...state.campaign.memory, worldGenesis: { ...state.campaign.memory.worldGenesis, structuredSummary: premise }, canon: [...state.campaign.memory.canon, { id: `genesis-world-${location.id}`, category: 'location', text: `Mundo inicial: ${location.name}, ${location.region}.`, turn: 0, createdAt: state.save.createdAt }].slice(-120), campaignSummary: { ...state.campaign.memory.campaignSummary, text: premise } } },
    character: { ...state.character, origin: clean(genesis.origin || state.character.origin, 400), profession: classTemplate(state.character.className).profession, birthRegion: clean(genesis.birthRegion || state.character.birthRegion, 80) },
    world: {
      ...state.world,
      hour: clamp(Number(genesis.hour) || state.world.hour, 0, 23),
      weather: clean(genesis.weather || state.world.weather, 60),
      currentLocationId: location.id,
      locations: { [location.id]: location },
      npcs,
      factions,
      culture: { name: clean(culture.name || 'Cultura local', 100), values: (culture.values || []).map(value => clean(value, 100)).filter(Boolean).slice(0, 8), customs: (culture.customs || []).map(value => clean(value, 120)).filter(Boolean).slice(0, 8), notes: clean(culture.notes || '', 300) },
      changes: [...state.world.changes, `A cena inicial emergiu em ${location.name}.`].slice(-100),
      economy: { regionMultiplier: clamp(Number(genesis.economy?.regionMultiplier) || 1, .5, 3), shops },
      reputation: { individuals: {}, cities: { [location.id]: 0 }, factions: {}, regions: { [location.region]: 0 }, kingdoms: {}, moral: 0 },
    },
  };
  return acceptNarrative(next, genesis.narrative || state.session.narrative, premise, [`Cultura inicial: ${next.world.culture.name}.`, ...next.campaign.opportunities.map(value => `Oportunidade: ${value}`)]);
}

function buildAiContextUncached(state: GameState) {
  const location = currentLocation(state);
  const allNpcs = Object.values(state.world.npcs);
  const nearbyNpcs = allNpcs.filter(npc => npc.locationId === location.id && npc.status === 'active').slice(0, 4).map(npc => ({ name: npc.name, role: npc.role, goal: npc.goal, relationship: npc.relationship, memories: npc.memories.slice(-2) }));
  const unavailableNpcs = allNpcs.filter(npc => npc.status !== 'active').slice(-5).map(npc => ({ name: npc.name, status: npc.status }));
  return {
    campaign: { origin: state.campaign.originPrompt, premise: state.campaign.premise, conflict: state.campaign.conflict, opportunities: state.campaign.opportunities.slice(-6) },
    character: { name: state.character.name, className: state.character.className, profession: state.character.profession, level: state.character.level, hp: state.character.hp, maxHp: state.character.maxHp, mana: state.character.mana, gold: state.character.gold, titles: state.character.titles.slice(-5), conditions: state.character.conditions, unlockedActions: state.character.unlockedActions.slice(-8), inventory: state.character.inventory.filter(item => item.state !== 'stored').slice(0, 12).map(item => ({ name: item.name, category: item.category, rarity: item.rarity, quantity: item.quantity, equipped: item.equipped, durability: item.durability, effects: item.effects.mechanical })) },
    world: { day: state.world.day, hour: state.world.hour, weather: state.world.weather, location: { name: location.name, region: location.region, kind: location.kind, description: location.description }, culture: { name: state.world.culture.name, notes: state.world.culture.notes }, nearbyNpcs, unavailableNpcs, recentChanges: state.world.changes.slice(-6), unlocks: state.world.unlocks },
    scene: {
      previousNarrative: state.session.narrative,
      recentActions: state.session.recentActions.slice(-4),
      lastRoll: state.session.lastRoll,
      recentConsequences: state.world.timeline.slice(-6).map(event => ({ type: event.eventType || event.type, text: event.text, turn: event.turn })),
    },
    memory: buildMemoryContext(state),
    pendingRoll: state.session.pendingRoll,
  };
}

export function buildAiContext(state: GameState) {
  const cacheKey = `${state.campaignId}:${state.save.revision}`;
  const cached = aiContextCache.get(cacheKey);
  if (cached) return cached;
  const context = buildAiContextUncached(state);
  aiContextCache.set(cacheKey, context);
  if (aiContextCache.size > 32) aiContextCache.delete(aiContextCache.keys().next().value!);
  return context;
}

export function xpProgress(state: GameState) {
  const previous = xpThreshold(state.character.level);
  const range = Math.max(1, state.character.xpToNext - previous);
  return clamp(((state.character.xp - previous) / range) * 100, 0, 100);
}

export function migrateState(value: unknown): GameState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<GameState> & Record<string, unknown>;
  const version = Number((candidate as Record<string, unknown>).schemaVersion);
  if ([2, 3, 4, 5, 6, 7, 8].includes(version) && candidate.character && candidate.world && candidate.session) {
    const current = candidate as any;
    current.schemaVersion = 8;
    current.visualCycle = migrateVisualCycle(current.visualCycle, current.campaignId, 0);
    current.campaign.sharingMode ||= 'global';
    current.campaign.originPrompt ||= current.character.origin || current.campaign.premise || 'A campanha foi recuperada de uma versão anterior.';
    current.campaign.opportunities ||= [];
    current.campaign.memory = migrateMemory(current.campaign.memory, current.campaign.originPrompt, current.campaign.premise, current.session.turn || 0, current.save?.createdAt || now());
    current.session.narrative = sanitizeLegacyLoreText(current.session.narrative || '');
    current.campaign.memory.canon = (current.campaign.memory.canon || []).filter((fact: { text: string }) => !isLegacyLore(fact.text));
    current.campaign.memory.session = (current.campaign.memory.session || []).filter((fact: { text: string }) => !isLegacyLore(fact.text));
    current.campaign.memory.campaignSummary.text = sanitizeLegacyLoreText(current.campaign.memory.campaignSummary.text || '');
    current.campaign.opportunities = (current.campaign.opportunities || []).filter((value: string) => !isLegacyLore(value));
    current.world.timeline = (current.world.timeline || []).filter((event: GameEvent) => !isLegacyLore(event.text));
    current.session.events = (current.session.events || []).filter((event: GameEvent) => !isLegacyLore(event.text));
    current.world.changes = (current.world.changes || []).filter((value: string) => !isLegacyLore(value));
    current.campaign.quests = (current.campaign.quests || []).filter((quest: Quest) => !isLegacyLore(JSON.stringify(quest)));
    current.world.culture ||= { name: 'Cultura não registrada', values: [], customs: [], notes: 'Migrada de uma campanha anterior.' };
    current.world.changes ||= (current.world.timeline || []).slice(-40).map((event: GameEvent) => event.text);
    current.character.unlockedActions ||= [];
    current.character.professions ||= [current.character.profession].filter(Boolean);
    current.character.energy = clamp(Number(current.character.energy ?? 10), 0, Number(current.character.maxEnergy ?? 10));
    current.character.maxEnergy = Math.max(1, Number(current.character.maxEnergy ?? 10));
    current.character.spells ||= [];
    current.character.activeEffects ||= [];
    current.character.personality ||= 'Personalidade revelada pelas escolhas.';
    current.character.appearanceDescription ||= `Viajante ${current.character.className || 'aventureiro'} de silhueta marcante.`;
    current.character.sprite = migrateSpriteIdentity(current.character.sprite, { id: current.campaignId, name: current.character.name, className: current.character.className, personality: current.character.personality, appearance: current.character.appearanceDescription, story: current.campaign.originPrompt });
    current.character.inventory = (current.character.inventory || []).map((item: Partial<Item> & Pick<Item, 'name' | 'description'>) => normalizeItem(item, current.character.name, item.origin || 'Migrado de uma campanha anterior.', current.session.turn || 0));
    current.world.itemRegistry ||= {};
    for (const item of current.character.inventory as Item[]) current.world.itemRegistry[item.id] = structuredClone(item);
    recoverConfirmedInventory(current as GameState);
    current.world.unlocks ||= { locations: [], dialogues: [], events: [] };
    current.world.processedTurnIds ||= [];
    current.world.skillAudits ||= [];
    current.world.skillMigrationBackup ||= [];
    const shouldBackupSkills = version < 8 && current.world.skillMigrationBackup.length === 0;
    const migratedSkills: Record<string, Skill> = {};
    for (const [originalKey, raw] of Object.entries(current.character.skills || {}) as Array<[string, any]>) {
      if (shouldBackupSkills) current.world.skillMigrationBackup.push({ originalKey, skill: structuredClone(raw) });
      const definition = canonicalSkill(raw.name || originalKey, raw.domain);
      const legacyAttribute = DISPLAY_TO_CORE[normalizeSemanticText(raw.attribute || '')] || raw.primaryAttribute || definition.primary;
      const dynamic = materializeDynamicSkill({ campaignId: current.campaignId, characterId: current.character.name, name: definition.name || raw.name || originalKey, normalizedKey: definition.key, domain: raw.domain || definition.domain, attribute: legacyAttribute, createdDynamically: Boolean(raw.createdDynamically), trained: raw.trained ?? raw.proficiencyRank !== 'untrained' });
      const normalized = synchronizeSkillAliases({
        ...dynamic,
        ...raw,
        id: raw.id || dynamic.id,
        campaignId: current.campaignId,
        characterId: current.character.name,
        name: definition.name || raw.name || originalKey,
        normalizedKey: definition.key,
        domain: raw.domain || definition.domain,
        description: raw.description || definition.description,
        primaryAttribute: legacyAttribute,
        alternativeAttributes: raw.alternativeAttributes || definition.alternatives,
        level: Math.max(1, Number(raw.level) || 1),
        experience: Math.max(0, Number(raw.experience ?? raw.xp) || 0),
        experienceToNextLevel: Math.max(1, Number(raw.experienceToNextLevel) || skillExperienceToNext(Math.max(1, Number(raw.level) || 1))),
        proficiencyRank: raw.proficiencyRank || proficiencyForLevel(Math.max(1, Number(raw.level) || 1), Boolean(raw.trained)),
        usageCount: Math.max(0, Number(raw.usageCount) || 0), successCount: Math.max(0, Number(raw.successCount) || 0), failureCount: Math.max(0, Number(raw.failureCount) || 0),
        specializations: Array.isArray(raw.specializations) ? raw.specializations : [], legacyImported: raw.normalizedKey ? Boolean(raw.legacyImported) : true,
        createdAt: raw.createdAt || current.save?.createdAt || now(), updatedAt: raw.updatedAt || current.save?.updatedAt || now(),
      });
      const previous = migratedSkills[normalized.name];
      if (!previous || normalized.level > previous.level || normalized.experience > previous.experience) migratedSkills[normalized.name] = normalized;
    }
    current.character.skills = migratedSkills;
    if (normalizeSemanticText(current.character.profession) === 'cartografo') {
      const correctedProfession = classTemplate(current.character.className).profession;
      current.character.profession = correctedProfession;
      current.character.professions = Array.from(new Set([
        correctedProfession,
        ...(current.character.professions || []).filter((profession: string) => normalizeSemanticText(profession) !== 'cartografo'),
      ]));
    }
    current.session.currentTurnId ||= '';
    if (current.session.pendingRoll && !current.session.pendingRoll.coreAttribute) {
      const pending = current.session.pendingRoll;
      const interpretation = interpretPlayerAction(pending.action, current as GameState);
      const matched = Object.values(current.character.skills as Record<string, Skill>).find(skill => normalizeSemanticText(skill.name) === normalizeSemanticText(pending.skill));
      Object.assign(pending, {
        coreAttribute: DISPLAY_TO_CORE[normalizeSemanticText(pending.attribute)] || interpretation.proposedAttribute,
        skillId: matched?.id,
        domain: interpretation.domain,
        intent: interpretation.intent,
        method: interpretation.actionMethod,
        opposed: interpretation.opposed,
        riskLevel: interpretation.riskLevel === 'none' ? 'medium' : interpretation.riskLevel,
        advantage: 0,
        disadvantage: 0,
        contextualModifiers: [],
        auditId: `migration-${pending.id}`,
        consentRequired: interpretation.consentRequired,
      });
    }
    if (current.session.lastRoll && !current.session.lastRoll.outcome) {
      const last = current.session.lastRoll;
      last.outcome = last.critical === 'success' ? 'critical_success' : last.critical === 'failure' ? 'critical_failure' : last.success ? 'success' : 'failure';
      last.contextualBonus ||= 0;
    }
    for (const location of Object.values(current.world.locations || {}) as Location[]) {
      location.campaignId ||= current.campaignId; location.visualIdentity ||= defaultVisualIdentity(location.kind, location.description); location.visited ??= location.discovered;
      if (isLegacyLore(location.name) || GENERIC_LOCATION.test(location.name)) { location.name = 'Local desconhecido'; location.region = 'Região desconhecida'; location.kind = 'wild'; location.discovered = false; }
      location.current = location.id === current.world.currentLocationId; location.status ||= 'active'; location.connectedLocationIds ||= []; location.residentNpcIds ||= []; location.presentNpcIds ||= [];
      location.tags ||= [location.kind]; location.createdFromEventId ||= 'migration'; location.createdAt ||= current.save?.createdAt || now(); location.updatedAt ||= current.save?.updatedAt || now();
    }
    const legacyNpcIds = (Object.values(current.world.npcs || {}) as NPC[]).filter(npc => isLegacyLore(npc.name)).map(npc => npc.id);
    for (const id of legacyNpcIds) delete current.world.npcs[id];
    for (const id of legacyNpcIds) delete current.world.reputation?.individuals?.[id];
    for (const location of Object.values(current.world.locations || {}) as Location[]) { location.residentNpcIds = location.residentNpcIds.filter(id => !legacyNpcIds.includes(id)); location.presentNpcIds = location.presentNpcIds.filter(id => !legacyNpcIds.includes(id)); }
    for (const npc of Object.values(current.world.npcs || {}) as NPC[]) {
      npc.campaignId ||= current.campaignId; npc.status ||= 'active'; npc.goals ||= [npc.goal].filter(Boolean); npc.relationships ||= []; npc.reputationWithPlayer ??= npc.relationship || 0; npc.inventoryIds ||= []; npc.createdFromEventId ||= 'migration'; npc.memoryProfile ||= defaultNpcMemory(npc.personality); npc.visualAppearance ||= defaultAppearance(npc.profession);
      npc.sprite = migrateSpriteIdentity(npc.sprite, { id: npc.id, name: npc.name, className: npc.profession || npc.role, personality: npc.personality, appearance: [npc.visualAppearance.clothing, npc.visualAppearance.hair].filter(Boolean).join(', '), story: npc.goal });
    }
    for (const quest of current.campaign.quests || []) {
      quest.source ||= 'emergent'; quest.memory ||= { origin: 'Migrada de uma versão anterior.', motive: quest.description || quest.title, progress: [], consequences: [], personalGoal: quest.objectives?.[0]?.text || '' };
      quest.originType ||= 'consequence'; quest.originEventId ||= 'migration'; quest.relevantNpcIds ||= []; quest.relevantLocationIds ||= [current.world.currentLocationId]; quest.consequences ||= []; quest.rewards ||= [{ type: 'xp', amount: quest.rewardXp || 0 }, { type: 'gold', amount: quest.rewardGold || 0 }]; quest.createdAt ||= current.save?.createdAt || now(); quest.updatedAt ||= now();
      quest.objectives = (quest.objectives || []).map((objective: any) => ({ ...objective, conditionType: objective.conditionType || 'quest_progress', currentValue: objective.currentValue ?? (objective.completed ? 1 : 0), targetValue: objective.targetValue ?? 1, status: objective.status || (objective.completed ? 'completed' : 'active'), eventSubscriptions: objective.eventSubscriptions || ['QuestProgressed'] }));
    }
    for (const event of [...(current.world.timeline || []), ...(current.session.events || [])] as any[]) {
      event.campaignId ||= current.campaignId; event.turnId ||= `legacy-turn-${event.turn || 0}`; event.eventType ||= EVENT_TYPE_BY_KIND[event.type as EventKind] || 'WorldChanged'; event.targetIds ||= []; event.payload ||= {}; event.schemaVersion ||= 1;
    }
    if (!current.world.economy) {
      const restored = createInitialState({ campaignName: current.campaign.name, characterName: current.character.name, className: current.character.className, openingPrompt: current.campaign.originPrompt });
      current.world.economy = restored.world.economy;
    }
    return current as GameState;
  }
  const legacy = candidate as Record<string, any>;
  if (!legacy.campaignId || !legacy.characterName) return null;
  const openingPrompt = String(legacy.openingPrompt || legacy.origin || 'Minha história continua a partir de um passado recuperado.');
  const fresh = createInitialState({ campaignName: String(legacy.campaignName || 'Campanha recuperada'), characterName: String(legacy.characterName), className: String(legacy.className || 'Explorador'), openingPrompt });
  fresh.campaignId = String(legacy.campaignId);
  fresh.visualCycle = createVisualCycle(fresh.campaignId);
  fresh.character.level = Number(legacy.level) || 1;
  fresh.character.xp = Number(legacy.xp) || 0;
  fresh.character.xpToNext = xpThreshold(fresh.character.level + 1);
  fresh.character.hp = Number(legacy.hp) || fresh.character.hp;
  fresh.character.maxHp = Number(legacy.maxHp) || fresh.character.maxHp;
  fresh.character.gold = Number(legacy.gold) || fresh.character.gold;
  fresh.session.narrative = Array.isArray(legacy.log) ? String(legacy.log.at(-1) || fresh.session.narrative) : fresh.session.narrative;
  return fresh;
}
export type Event = GameEvent;
export type ClassName = string;
