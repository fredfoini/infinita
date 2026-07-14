export type AttributeKey = 'Força' | 'Destreza' | 'Constituição' | 'Inteligência' | 'Sabedoria' | 'Carisma';
export type Attributes = Record<AttributeKey, number>;
export type EventKind = 'action' | 'roll' | 'xp' | 'skill' | 'level' | 'item' | 'gold' | 'reputation' | 'quest' | 'world' | 'combat' | 'system';
export type SkillRank = 'Iniciante' | 'Aprendiz' | 'Competente' | 'Especialista' | 'Mestre' | 'Lendário';

export type Skill = {
  id: string;
  name: string;
  attribute: AttributeKey;
  xp: number;
  level: number;
  rank: SkillRank;
  trained: boolean;
};

export type Item = {
  id: string;
  name: string;
  kind: 'arma' | 'armadura' | 'consumível' | 'ferramenta' | 'material' | 'missão';
  quantity: number;
  value: number;
  description: string;
  equipped?: boolean;
};

export type GameEvent = {
  id: string;
  turn: number;
  type: EventKind;
  source: 'player' | 'engine' | 'npc' | 'world' | 'combat';
  priority: number;
  text: string;
  persistent: boolean;
  createdAt: string;
};

import { appendSessionMemory, buildMemoryContext, createMemoryState, migrateMemory, updateNarrativeMemory } from '@/lib/memory/memory-builder';
import { advanceVisualCycle, attachCycleIllustration, createVisualCycle, migrateVisualCycle, type CampaignVisualCycle } from '@/lib/visual/visual-cycle';

export type Quest = {
  id: string;
  title: string;
  description: string;
  objectives: Array<{ id: string; text: string; completed: boolean }>;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  rewardXp: number;
  rewardGold: number;
  source: 'emergent';
  memory: { origin: string; motive: string; progress: string[]; consequences: string[]; personalGoal: string };
};

export type NPC = {
  id: string;
  name: string;
  role: string;
  personality: string;
  goal: string;
  profession: string;
  locationId: string;
  relationship: number;
  knowledge: string[];
  memories: string[];
  status: 'active' | 'dead' | 'missing' | 'departed';
  memoryProfile: { firstImpression: string; sharedEvents: string[]; trust: number; favors: string[]; conflicts: string[]; pendingTopics: string[] };
  visualAppearance: { clothing: string; hair: string; accessories: string[]; weapon: string; apparentAge: string; palette: string[] };
};

export type Location = {
  id: string;
  name: string;
  region: string;
  kind: 'city' | 'village' | 'tavern' | 'forest' | 'river' | 'road' | 'ruin' | 'wild';
  description: string;
  discovered: boolean;
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
};

export type RollResult = PendingRoll & {
  die: number;
  attributeBonus: number;
  skillBonus: number;
  total: number;
  success: boolean;
  critical: 'success' | 'failure' | null;
};

export type MemoryState = {
  worldGenesis: { originalPrompt: string; structuredSummary: string; createdAt: string };
  canon: Array<{ id: string; category: string; text: string; turn: number; createdAt: string }>;
  campaignSummary: { text: string; lastConsolidatedTurn: number; revision: number };
  session: Array<{ id: string; turn: number; text: string; importance: 'normal' | 'major' }>;
  anchor: { currentObjective: string; declaredDesires: string[]; importantRelationships: string[]; activeConflicts: string[]; relevantLocations: string[]; themes: string[] };
};

export type GameState = {
  schemaVersion: 5;
  campaignId: string;
  visualCycle: CampaignVisualCycle;
  campaign: {
    name: string;
    premise: string;
    conflict: string;
    originPrompt: string;
    chapter: number;
    quests: Quest[];
    opportunities: string[];
    memory: MemoryState;
  };
  character: {
    name: string;
    className: string;
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
    gold: number;
    skills: Record<string, Skill>;
    inventory: Item[];
    titles: string[];
    conditions: Array<{ name: string; remainingTurns: number; modifier: number }>;
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
    economy: {
      regionMultiplier: number;
      shops: Record<string, { id: string; name: string; locationId: string; products: ShopProduct[] }>;
    };
    reputation: Reputation;
    timeline: GameEvent[];
  };
  session: {
    turn: number;
    narrative: string;
    recentActions: string[];
    pendingRoll: PendingRoll | null;
    lastRoll: RollResult | null;
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

export type NewCampaignInput = { campaignName: string; characterName: string; className: string; openingPrompt: string };

export type NarrativeWorldDelta = {
  locations?: Array<{ name: string; region: string; kind: Location['kind']; description: string; visualIdentity?: Partial<Location['visualIdentity']> }>;
  currentLocationName?: string | null;
  npcs?: Array<{ name: string; role: string; personality: string; goal: string; profession: string; locationName?: string; visualAppearance?: Partial<NPC['visualAppearance']> }>;
  npcChanges?: Array<{ name: string; status: NPC['status']; memory?: string }>;
  opportunities?: string[];
  quests?: Array<{ title: string; description: string; objective: string; status: Quest['status'] }>;
  worldChanges?: string[];
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
const hash = (value: string) => Array.from(value).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0) >>> 0;
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

function skillThreshold(level: number) {
  return 12 + level * level * 8;
}

function rankFor(level: number): SkillRank {
  return SKILL_RANKS[clamp(level - 1, 0, SKILL_RANKS.length - 1)];
}

function makeSkill(name: string, attribute: AttributeKey, trained = false): Skill {
  return { id: uid(), name, attribute, xp: 0, level: 1, rank: 'Iniciante', trained };
}

function classTemplate(className: string) {
  const lower = className.toLowerCase();
  if (/guerreiro|cavaleiro|bárbaro|soldado|paladino/.test(lower)) return { primary: 'Combate', attribute: 'Força' as AttributeKey, hp: 18, mana: 4, profession: 'Armeiro itinerante' };
  if (/ladino|pirata|assassino|gatuno|espião/.test(lower)) return { primary: 'Furtividade', attribute: 'Destreza' as AttributeKey, hp: 13, mana: 7, profession: 'Batedor' };
  if (/místico|mago|bruxo|druida|feiticeiro|clérigo/.test(lower)) return { primary: 'Arcana', attribute: 'Inteligência' as AttributeKey, hp: 11, mana: 18, profession: 'Copista de runas' };
  return { primary: 'Sobrevivência', attribute: 'Sabedoria' as AttributeKey, hp: 15, mana: 9, profession: 'Cartógrafo' };
}

function startingAttributes(className: string): Attributes {
  const values: Attributes = { Força: 10, Destreza: 10, Constituição: 11, Inteligência: 10, Sabedoria: 10, Carisma: 10 };
  const template = classTemplate(className);
  values[template.attribute] = 15;
  if (template.attribute !== 'Constituição') values.Constituição = 13;
  return values;
}

function makeEvent(state: GameState, type: EventKind, text: string, source: GameEvent['source'] = 'engine', priority = 50, persistent = true): GameEvent {
  return { id: uid(), turn: state.session.turn, type, source, priority, text: clean(text, 320), persistent, createdAt: now() };
}

function withEvents(state: GameState, events: GameEvent[]): GameState {
  const ordered = [...events].sort((a, b) => b.priority - a.priority);
  return {
    ...state,
    session: { ...state.session, events: [...ordered, ...state.session.events].slice(0, 30) },
    world: { ...state.world, timeline: [...state.world.timeline, ...ordered.filter(event => event.persistent)].slice(-300) },
  };
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
  const skills: Record<string, Skill> = {
    Combate: makeSkill('Combate', 'Força', template.primary === 'Combate'),
    Furtividade: makeSkill('Furtividade', 'Destreza', template.primary === 'Furtividade'),
    Acrobacia: makeSkill('Acrobacia', 'Destreza'),
    Sobrevivência: makeSkill('Sobrevivência', 'Sabedoria', template.primary === 'Sobrevivência'),
    Percepção: makeSkill('Percepção', 'Sabedoria'),
    Investigação: makeSkill('Investigação', 'Inteligência'),
    Diplomacia: makeSkill('Diplomacia', 'Carisma'),
    Intimidação: makeSkill('Intimidação', 'Carisma'),
    Arcana: makeSkill('Arcana', 'Inteligência', template.primary === 'Arcana'),
    Atletismo: makeSkill('Atletismo', 'Força'),
    Pesca: makeSkill('Pesca', 'Sabedoria'),
  };
  const originLocation: Location = { id: `origin-${hash(input.openingPrompt).toString(36)}`, name: 'Cena Inicial', region: 'Região Desconhecida', kind: 'wild', description: clean(input.openingPrompt, 500), discovered: true, visualIdentity: defaultVisualIdentity('wild', input.openingPrompt) };
  const state: GameState = {
    schemaVersion: 5,
    campaignId,
    visualCycle: createVisualCycle(campaignId),
    campaign: {
      name: clean(input.campaignName, 80),
      premise: opening.premise,
      conflict: opening.conflict,
      originPrompt: clean(input.openingPrompt, 700),
      chapter: 1,
      quests: [],
      opportunities: [],
      memory: createMemoryState(input.openingPrompt, opening.premise, createdAt),
    },
    character: {
      name: clean(input.characterName, 60), className: clean(input.className, 80), origin: opening.origin, profession: opening.profession, birthRegion: opening.birthRegion,
      level: 1, xp: 0, xpToNext: xpThreshold(2), attributePoints: 0, attributes,
      hp: template.hp + attributeModifier(attributes.Constituição), maxHp: template.hp + attributeModifier(attributes.Constituição), mana: template.mana, maxMana: template.mana,
      gold: 12, skills,
      inventory: [
        { id: uid(), name: 'Ração de viagem', kind: 'consumível', quantity: 3, value: 2, description: 'Recupera forças durante um descanso.' },
        { id: uid(), name: 'Tocha', kind: 'ferramenta', quantity: 1, value: 3, description: 'Ilumina locais escuros.' },
      ],
      titles: [], conditions: [],
    },
    world: {
      day: 1, hour: 8, weather: 'Tempo variável', currentLocationId: originLocation.id, locations: { [originLocation.id]: originLocation },
      npcs: {},
      factions: {},
      culture: { name: 'Cultura ainda não revelada', values: [], customs: [], notes: 'Será descoberta conforme a campanha emergir.' },
      changes: [`A campanha nasceu da origem: ${clean(input.openingPrompt, 300)}`],
      economy: { regionMultiplier: 1, shops: {} },
      reputation: { individuals: {}, cities: { [originLocation.id]: 0 }, factions: {}, regions: { [originLocation.region]: 0 }, kingdoms: {}, moral: 0 }, timeline: [],
    },
    session: { turn: 0, narrative: opening.narrative, recentActions: [], pendingRoll: null, lastRoll: null, events: [], combat: null },
    save: { createdAt, updatedAt: createdAt, revision: 1 },
  };
  return state;
}

export function currentLocation(state: GameState) {
  return state.world.locations[state.world.currentLocationId] || Object.values(state.world.locations)[0];
}

export function inferSkill(action: string): { skill: string; attribute: AttributeKey } {
  const value = action.toLowerCase();
  if (/furt|roub|escond|silenc|arrom/.test(value)) return { skill: 'Furtividade', attribute: 'Destreza' };
  if (/escalar|saltar|pular|equilíbrio|acrob/.test(value)) return { skill: 'Acrobacia', attribute: 'Destreza' };
  if (/atac|lutar|golpear|espada|dispar|combate/.test(value)) return { skill: 'Combate', attribute: 'Força' };
  if (/correr|nadar|forçar|levantar|quebrar/.test(value)) return { skill: 'Atletismo', attribute: 'Força' };
  if (/convenc|negoci|persuad|acalmar|dialog/.test(value)) return { skill: 'Diplomacia', attribute: 'Carisma' };
  if (/ameaç|intimid|coagir/.test(value)) return { skill: 'Intimidação', attribute: 'Carisma' };
  if (/investig|vasculh|procur|pista|examinar/.test(value)) return { skill: 'Investigação', attribute: 'Inteligência' };
  if (/magia|runa|feitiço|arcano|ritual/.test(value)) return { skill: 'Arcana', attribute: 'Inteligência' };
  if (/perceb|ouvir|observar|vigiar|notar/.test(value)) return { skill: 'Percepção', attribute: 'Sabedoria' };
  if (/pesc|anzol|peixe/.test(value)) return { skill: 'Pesca', attribute: 'Sabedoria' };
  return { skill: 'Sobrevivência', attribute: 'Sabedoria' };
}

function detectRisk(action: string) {
  return /atac|lutar|roub|furt|arrom|escalar|saltar|correr de|fugir|ameaç|engan|pesc|desarm|ritual|atravessar|invadir|perseguir/.test(action.toLowerCase());
}

function difficultyFor(action: string) {
  const value = action.toLowerCase();
  if (/impossível|lendário|mortal|sem ser visto/.test(value)) return 18;
  if (/difícil|guardado|perigoso|tempestade/.test(value)) return 15;
  return 12;
}

function inferLocation(action: string, state: GameState): { location: Location; isNew: boolean } | null {
  const value = action.toLowerCase();
  const kinds: Array<[RegExp, Location['kind'], string]> = [
    [/taverna|estalagem/, 'tavern', 'Estabelecimento local'],
    [/floresta|bosque|selva|mata/, 'forest', 'Área selvagem'],
    [/rio|riacho|ponte|lago|costa/, 'river', 'Curso de água'],
    [/ruína|templo|torre|cripta/, 'ruin', 'Estrutura antiga'],
    [/estrada|trilha|caminho/, 'road', 'Caminho aberto'],
    [/cidade|vila|aldeia|mercado/, 'city', 'Assentamento'],
  ];
  const found = kinds.find(([pattern]) => pattern.test(value));
  if (!found) return null;
  const explicit = action.match(/(?:até|para|rumo a|entro em|chego a(?:o| à)?)\s+(?:a|o|uma|um)?\s*([^,.!?]{2,60})/i)?.[1];
  const name = clean(explicit || found[2], 80).replace(/\b\w/g, char => char.toUpperCase());
  const region = currentLocation(state).region;
  const id = `location-${hash(`${region}:${name}`).toString(36)}`;
  const existing = state.world.locations[id];
  if (existing) return { location: existing, isNew: false };
  const description = `Local descoberto pelas ações do jogador: ${clean(action, 220)}`;
  const location: Location = { id, name, region, kind: found[1], description, discovered: true, visualIdentity: defaultVisualIdentity(found[1], description) };
  return { location, isNew: true };
}

function addSkillPractice(state: GameState, skillName: string, amount: number, events: GameEvent[]): GameState {
  const existing = state.character.skills[skillName] || makeSkill(skillName, inferSkill(skillName).attribute);
  let skill = { ...existing, xp: existing.xp + amount };
  if (skill.xp >= skillThreshold(skill.level) && skill.level < 6) {
    skill = { ...skill, xp: skill.xp - skillThreshold(skill.level), level: skill.level + 1, rank: rankFor(skill.level + 1) };
    events.push(makeEvent(state, 'skill', `${skill.name} avançou para ${skill.rank}.`, 'engine', 70));
  }
  return { ...state, character: { ...state.character, skills: { ...state.character.skills, [skillName]: skill } } };
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

export function applyNarrativeWorldDelta(inputState: GameState, delta?: NarrativeWorldDelta): GameState {
  if (!delta) return inputState;
  let state = structuredClone(inputState);
  const events: GameEvent[] = [];

  for (const candidate of (delta.locations || []).slice(0, 4)) {
    const name = clean(candidate.name || '', 80);
    if (!name) continue;
    const region = clean(candidate.region || currentLocation(state).region, 80);
    const id = `location-${hash(`${region}:${name}`).toString(36)}`;
    const allowedKinds: Location['kind'][] = ['city', 'village', 'tavern', 'forest', 'river', 'road', 'ruin', 'wild'];
    const kind = allowedKinds.includes(candidate.kind) ? candidate.kind : 'wild';
    const description = clean(candidate.description || 'Local emergente.', 300);
    const location: Location = { id, name, region, kind, description, discovered: true, visualIdentity: { ...defaultVisualIdentity(kind, description), ...candidate.visualIdentity } };
    if (!state.world.locations[id]) events.push(makeEvent(state, 'world', `Local descoberto: ${name}.`, 'world', 65));
    state.world.locations[id] = location;
  }
  if (delta.currentLocationName) {
    const destination = Object.values(state.world.locations).find(location => location.name.toLowerCase() === delta.currentLocationName?.toLowerCase());
    if (destination && destination.id !== state.world.currentLocationId) {
      state.world.currentLocationId = destination.id;
      events.push(makeEvent(state, 'world', `Local atual: ${destination.name}.`, 'world', 70));
    }
  }

  for (const candidate of (delta.npcs || []).slice(0, 6)) {
    const name = clean(candidate.name || '', 60);
    if (!name) continue;
    const id = `npc-${hash(name.toLowerCase()).toString(36)}`;
    const targetLocation = Object.values(state.world.locations).find(location => location.name.toLowerCase() === candidate.locationName?.toLowerCase()) || currentLocation(state);
    const previous = state.world.npcs[id];
    state.world.npcs[id] = {
      id, name,
      role: clean(candidate.role || 'Pessoa do mundo', 80),
      personality: clean(candidate.personality || 'Personalidade ainda não revelada.', 140),
      goal: clean(candidate.goal || 'Possui interesses próprios.', 180),
      profession: clean(candidate.profession || 'Ocupação desconhecida', 80),
      locationId: targetLocation.id,
      relationship: previous?.relationship || 0,
      knowledge: previous?.knowledge || [],
      memories: previous?.memories || [],
      status: previous?.status || 'active',
      memoryProfile: previous?.memoryProfile || defaultNpcMemory(candidate.personality),
      visualAppearance: { ...(previous?.visualAppearance || defaultAppearance(candidate.profession)), ...candidate.visualAppearance },
    };
    if (!previous) events.push(makeEvent(state, 'world', `Pessoa conhecida: ${name}.`, 'world', 55));
  }

  let continuityNeeded = false;
  for (const change of (delta.npcChanges || []).slice(0, 6)) {
    const npc = Object.values(state.world.npcs).find(candidate => candidate.name.toLowerCase() === change.name?.toLowerCase());
    if (!npc) continue;
    const allowed: NPC['status'][] = ['active', 'dead', 'missing', 'departed'];
    npc.status = allowed.includes(change.status) ? change.status : npc.status;
    if (change.memory) {
      const memory = clean(change.memory, 180);
      npc.memories = [...npc.memories, memory].slice(-12);
      npc.memoryProfile.sharedEvents = [...npc.memoryProfile.sharedEvents, memory].slice(-20);
    }
    if (npc.status !== 'active') continuityNeeded = true;
    events.push(makeEvent(state, 'world', `${npc.name}: ${npc.status}.`, 'world', 75));
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
      const quest: Quest = { id: uid(), title, description: clean(update.description || title, 300), objectives: [{ id: uid(), text: clean(update.objective || update.description || title, 180), completed: status === 'completed' }], status, rewardXp: 35, rewardGold: 8, source: 'emergent', memory: { origin: `Surgiu no turno ${state.session.turn}.`, motive: clean(update.description || title, 240), progress: status === 'active' ? [] : [status], consequences: [], personalGoal: clean(update.objective || '', 180) } };
      state.campaign.quests.push(quest);
      events.push(makeEvent(state, 'quest', `Novo objetivo emergente: ${title}.`, 'world', 70));
      if (status === 'completed') { rewardXp += quest.rewardXp; rewardGold += quest.rewardGold; }
    }
  }
  if (rewardXp) state = grantMilestoneXp(state, rewardXp, 'objetivo emergente concluído', events);
  if (rewardGold) state.character.gold += rewardGold;

  const changes = (delta.worldChanges || []).map(value => clean(value, 260)).filter(Boolean);
  state.world.changes = [...state.world.changes, ...changes].slice(-100);
  for (const change of changes) events.push(makeEvent(state, 'world', change, 'world', 60));
  return updateSave(withEvents(state, events));
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

export function beginAction(inputState: GameState, rawAction: string): EngineTurn {
  const action = clean(rawAction, 500);
  if (!action) throw new Error('Descreva uma ação.');
  if (inputState.session.pendingRoll) throw new Error('Resolva a rolagem pendente antes de agir novamente.');
  let state = structuredClone(inputState);
  state.visualCycle = advanceVisualCycle(state.visualCycle);
  state.session.turn += 1;
  state.session.lastRoll = null;
  state.session.recentActions = [...state.session.recentActions, action].slice(-8);
  state.campaign.memory = appendSessionMemory(state.campaign.memory, state.session.turn, `Ação declarada: ${action}`);
  state = advanceClock(state, 1);
  const events: GameEvent[] = [makeEvent(state, 'action', action, 'player', 30, false)];
  const locationChange = inferLocation(action, state);
  if (locationChange && locationChange.location.id !== state.world.currentLocationId) {
    state.world.locations[locationChange.location.id] = locationChange.location;
    state.world.currentLocationId = locationChange.location.id;
    events.push(makeEvent(state, 'world', `Local atual: ${locationChange.location.name}.`, 'world', 60));
    if (locationChange.isNew) state = grantMilestoneXp(state, 8, 'descoberta de um novo local', events);
  }
  state = applySocialConsequences(state, action, events);
  const requiresDice = detectRisk(action);
  if (requiresDice) {
    const inferred = inferSkill(action);
    state.session.pendingRoll = { id: uid(), action, skill: inferred.skill, attribute: inferred.attribute, difficulty: difficultyFor(action), reason: `Há risco e consequência na tentativa de ${action.toLowerCase()}.`, createdAtTurn: state.session.turn };
    events.push(makeEvent(state, 'roll', `Teste necessário: ${inferred.skill} (${inferred.attribute}) contra CD ${state.session.pendingRoll.difficulty}.`, 'engine', 85, false));
  }
  state = updateSave(withEvents(state, events));
  return {
    state,
    requiresDice,
    roll: state.session.pendingRoll,
    events,
    fallbackNarrative: requiresDice
      ? `Sua ação encontra resistência real. O resultado depende de um teste de ${state.session.pendingRoll!.skill} contra CD ${state.session.pendingRoll!.difficulty}.`
      : `O mundo reage à sua decisão e a situação avança em ${currentLocation(state).name}. O que você faz?`,
  };
}

function resolveCombat(state: GameState, result: RollResult, events: GameEvent[]): GameState {
  if (!/atac|golpear|lutar|dispar/.test(result.action.toLowerCase())) return state;
  let combat = state.session.combat || { enemyName: 'Adversário', enemyHp: 10, enemyMaxHp: 10, defense: 12, initiative: 'player' as const };
  if (result.success) {
    const damage = Math.max(1, 3 + attributeModifier(state.character.attributes.Força) + (result.critical === 'success' ? 4 : 0));
    combat = { ...combat, enemyHp: Math.max(0, combat.enemyHp - damage) };
    events.push(makeEvent(state, 'combat', `${combat.enemyName} sofreu ${damage} de dano.`, 'combat', 75));
    if (combat.enemyHp === 0) {
      events.push(makeEvent(state, 'combat', `${combat.enemyName} foi derrotado.`, 'combat', 95));
      state = grantMilestoneXp(state, 18, 'vitória em um confronto relevante', events);
      return { ...state, session: { ...state.session, combat: null } };
    }
  } else {
    const damage = result.critical === 'failure' ? 4 : 2;
    state = { ...state, character: { ...state.character, hp: Math.max(0, state.character.hp - damage) } };
    events.push(makeEvent(state, 'combat', `${state.character.name} sofreu ${damage} de dano.`, 'combat', 80));
  }
  return { ...state, session: { ...state.session, combat } };
}

export function resolvePendingRoll(inputState: GameState, forcedDie?: number): { state: GameState; result: RollResult; events: GameEvent[]; fallbackNarrative: string } {
  const pending = inputState.session.pendingRoll;
  if (!pending) throw new Error('Não há rolagem pendente.');
  let state = structuredClone(inputState);
  state.visualCycle = advanceVisualCycle(state.visualCycle);
  const skill = state.character.skills[pending.skill] || makeSkill(pending.skill, pending.attribute);
  const die = clamp(forcedDie || Math.floor(Math.random() * 20) + 1, 1, 20);
  const attributeBonus = attributeModifier(state.character.attributes[pending.attribute]);
  const skillBonus = (skill.level - 1) + (skill.trained ? 2 : 0);
  const total = die + attributeBonus + skillBonus;
  const result: RollResult = { ...pending, die, attributeBonus, skillBonus, total, success: die === 20 || (die !== 1 && total >= pending.difficulty), critical: die === 20 ? 'success' : die === 1 ? 'failure' : null };
  const events: GameEvent[] = [makeEvent(state, 'roll', `${pending.skill}: d20 (${die}) + atributo ${attributeBonus >= 0 ? '+' : ''}${attributeBonus} + perícia ${skillBonus} = ${total} contra CD ${pending.difficulty}. ${result.success ? 'SUCESSO' : 'FALHA'}.`, 'engine', 100)];
  state.session.pendingRoll = null;
  state.session.lastRoll = result;
  state = addSkillPractice(state, pending.skill, result.success ? 3 : 1, events);
  state = resolveCombat(state, result, events);
  state.campaign.memory = appendSessionMemory(state.campaign.memory, state.session.turn, `${pending.skill} ${result.success ? 'teve sucesso' : 'falhou'} (${total}/${pending.difficulty}).`, result.critical ? 'major' : 'normal');
  state = updateSave(withEvents(state, events));
  return { state, result, events, fallbackNarrative: result.success ? `O teste de ${pending.skill} funciona e abre uma oportunidade concreta. O que você faz?` : `O teste de ${pending.skill} falha e produz uma consequência, mas a história continua. O que você faz?` };
}

export function acceptNarrative(state: GameState, narrative: string, memorySummary?: string, memoryUpdate: string[] = [], worldDelta?: NarrativeWorldDelta): GameState {
  const safeNarrative = clean(narrative, 1800) || state.session.narrative;
  const memory = updateNarrativeMemory(state, safeNarrative, memorySummary, memoryUpdate, worldDelta);
  return updateSave({ ...state, campaign: { ...state.campaign, memory }, session: { ...state.session, narrative: safeNarrative } });
}

export function setActiveIllustration(inputState: GameState, assetId: string, generated = false): GameState {
  const visualCycle = attachCycleIllustration(inputState.visualCycle, clean(assetId, 160), generated);
  if (visualCycle === inputState.visualCycle) return inputState;
  return updateSave({ ...inputState, visualCycle });
}

export function acceptSuggestedRoll(state: GameState, action: string, suggestion?: { skill?: string | null; attribute?: string | null; difficulty?: number | null; reason?: string | null }): GameState {
  if (state.session.pendingRoll || !suggestion?.skill) return state;
  const inferred = inferSkill(action);
  const attribute = ATTRIBUTE_KEYS.includes(suggestion.attribute as AttributeKey) ? suggestion.attribute as AttributeKey : inferred.attribute;
  const pending: PendingRoll = { id: uid(), action, skill: clean(suggestion.skill, 40), attribute, difficulty: clamp(Number(suggestion.difficulty) || 12, 8, 20), reason: clean(suggestion.reason || 'A situação envolve risco e consequência.', 180), createdAtTurn: state.session.turn };
  const event = makeEvent(state, 'roll', `Teste necessário: ${pending.skill} (${pending.attribute}) contra CD ${pending.difficulty}.`, 'engine', 85, false);
  return updateSave(withEvents({ ...state, session: { ...state.session, pendingRoll: pending } }, [event]));
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

export function useInventoryItem(inputState: GameState, itemId: string): { state: GameState; events: GameEvent[]; narrative: string } {
  const item = inputState.character.inventory.find(candidate => candidate.id === itemId);
  if (!item) throw new Error('Item não encontrado no inventário.');
  if (item.kind !== 'consumível') throw new Error('Este item não pode ser consumido agora.');
  let state = structuredClone(inputState);
  state.visualCycle = advanceVisualCycle(state.visualCycle);
  const events: GameEvent[] = [];
  if (/ração|poção|alimento/i.test(item.name)) {
    const recovered = Math.min(4, state.character.maxHp - state.character.hp);
    state.character.hp += recovered;
    events.push(makeEvent(state, 'item', `${item.name} usado. ${recovered > 0 ? `Vitalidade +${recovered}.` : 'A vitalidade já estava completa.'}`, 'engine', 70));
  }
  state.character.inventory = state.character.inventory.map(candidate => candidate.id === itemId ? { ...candidate, quantity: candidate.quantity - 1 } : candidate).filter(candidate => candidate.quantity > 0);
  state = updateSave(withEvents(state, events));
  return { state, events, narrative: `${state.character.name} usa ${item.name}. A ação é registrada pelo mundo. O que você faz?` };
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
  if (existing) existing.quantity += 1;
  else state.character.inventory.push({ id: uid(), name: product.name, kind: product.kind, quantity: 1, value: product.basePrice, description: product.description });
  state.world.economy.shops[shopId].products = state.world.economy.shops[shopId].products.map(candidate => candidate.id === productId ? { ...candidate, stock: candidate.stock - 1 } : candidate);
  const events = [makeEvent(state, 'gold', `${product.name} comprado por ${price} moedas.`, 'engine', 70)];
  state = updateSave(withEvents(state, events));
  return { state, events, narrative: `A compra é concluída no ${shop.name}. ${product.name} agora está na mochila. O que você faz?` };
}

export function applyGenesis(state: GameState, genesis: CampaignGenesisPayload): GameState {
  const candidate = genesis.initialLocation;
  const fallback = currentLocation(state);
  const locationName = clean(candidate?.name || fallback.name, 80);
  const region = clean(candidate?.region || fallback.region, 80);
  const allowedKinds: Location['kind'][] = ['city', 'village', 'tavern', 'forest', 'river', 'road', 'ruin', 'wild'];
  const location: Location = {
    id: `location-${hash(`${region}:${locationName}`).toString(36)}`,
    name: locationName,
    region,
    kind: candidate && allowedKinds.includes(candidate.kind) ? candidate.kind : fallback.kind,
    description: clean(candidate?.description || fallback.description, 400),
    discovered: true,
    visualIdentity: { ...defaultVisualIdentity(candidate && allowedKinds.includes(candidate.kind) ? candidate.kind : fallback.kind, candidate?.description || fallback.description), ...candidate?.visualIdentity },
  };
  const npcs: Record<string, NPC> = {};
  for (const candidateNpc of (genesis.npcs || []).slice(0, 6)) {
    const name = clean(candidateNpc.name || '', 60);
    if (!name) continue;
    const id = `npc-${hash(name.toLowerCase()).toString(36)}`;
    const profession = clean(candidateNpc.profession || 'Ocupação desconhecida', 80);
    const personality = clean(candidateNpc.personality || '', 140);
    npcs[id] = { id, name, role: clean(candidateNpc.role || 'Pessoa do mundo', 80), personality, goal: clean(candidateNpc.goal || '', 180), profession, locationId: location.id, relationship: 0, knowledge: [], memories: [], status: 'active', memoryProfile: defaultNpcMemory(personality), visualAppearance: { ...defaultAppearance(profession), ...candidateNpc.visualAppearance } };
  }
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
    character: { ...state.character, origin: clean(genesis.origin || state.character.origin, 400), profession: clean(genesis.profession || state.character.profession, 80), birthRegion: clean(genesis.birthRegion || state.character.birthRegion, 80) },
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

export function buildAiContext(state: GameState) {
  const location = currentLocation(state);
  const nearbyNpcs = Object.values(state.world.npcs).filter(npc => npc.locationId === location.id && npc.status === 'active').slice(0, 4).map(npc => ({ name: npc.name, role: npc.role, personality: npc.personality, goal: npc.goal, relationship: npc.relationship, status: npc.status, memories: npc.memories.slice(-3) }));
  const unavailableNpcs = Object.values(state.world.npcs).filter(npc => npc.status !== 'active').slice(-8).map(npc => ({ name: npc.name, status: npc.status, memories: npc.memories.slice(-2) }));
  return {
    campaign: { name: state.campaign.name, originPrompt: state.campaign.originPrompt, premise: state.campaign.premise, conflict: state.campaign.conflict, chapter: state.campaign.chapter, opportunities: state.campaign.opportunities },
    character: { name: state.character.name, className: state.character.className, origin: state.character.origin, profession: state.character.profession, level: state.character.level, hp: state.character.hp, maxHp: state.character.maxHp, mana: state.character.mana, gold: state.character.gold, titles: state.character.titles, conditions: state.character.conditions },
    world: { day: state.world.day, hour: state.world.hour, weather: state.world.weather, location, culture: state.world.culture, nearbyNpcs, unavailableNpcs, recentChanges: state.world.changes.slice(-12) },
    objectives: state.campaign.quests.filter(quest => quest.status === 'active').map(quest => ({ title: quest.title, objectives: quest.objectives })),
    memory: buildMemoryContext(state),
    pendingRoll: state.session.pendingRoll,
  };
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
  if ([2, 3, 4, 5].includes(version) && candidate.character && candidate.world && candidate.session) {
    const current = candidate as any;
    current.schemaVersion = 5;
    current.visualCycle = migrateVisualCycle(current.visualCycle, current.campaignId, 0);
    current.campaign.originPrompt ||= current.character.origin || current.campaign.premise || 'A campanha foi recuperada de uma versão anterior.';
    current.campaign.opportunities ||= [];
    current.campaign.memory = migrateMemory(current.campaign.memory, current.campaign.originPrompt, current.campaign.premise, current.session.turn || 0, current.save?.createdAt || now());
    current.world.culture ||= { name: 'Cultura não registrada', values: [], customs: [], notes: 'Migrada de uma campanha anterior.' };
    current.world.changes ||= (current.world.timeline || []).slice(-40).map((event: GameEvent) => event.text);
    for (const location of Object.values(current.world.locations || {}) as Location[]) location.visualIdentity ||= defaultVisualIdentity(location.kind, location.description);
    for (const npc of Object.values(current.world.npcs || {}) as NPC[]) {
      npc.status ||= 'active'; npc.memoryProfile ||= defaultNpcMemory(npc.personality); npc.visualAppearance ||= defaultAppearance(npc.profession);
    }
    for (const quest of current.campaign.quests || []) {
      quest.source ||= 'emergent'; quest.memory ||= { origin: 'Migrada de uma versão anterior.', motive: quest.description || quest.title, progress: [], consequences: [], personalGoal: quest.objectives?.[0]?.text || '' };
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

// Compatibilidade temporária com versões anteriores do cliente.
export const initialState = (characterName = 'Viajante', campaignName = 'Nova campanha', className = 'Explorador', openingPrompt = 'Minha história começa em um lugar ainda desconhecido.') => createInitialState({ characterName, campaignName, className, openingPrompt });
export const advanceDemo = (state: GameState, action: string) => {
  const result = beginAction(state, action);
  return { narrative: result.fallbackNarrative, needsRoll: result.requiresDice, rollSkill: result.roll?.skill || null, rollDifficulty: result.roll?.difficulty || null, scene: currentLocation(result.state).name, locationChanged: false, events: result.events, state: acceptNarrative(result.state, result.fallbackNarrative) };
};
export type Event = GameEvent;
export type ClassName = string;
