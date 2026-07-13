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

export type Quest = {
  id: string;
  title: string;
  description: string;
  objectives: Array<{ id: string; text: string; completed: boolean }>;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  rewardXp: number;
  rewardGold: number;
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
};

export type Location = {
  id: string;
  name: string;
  region: string;
  kind: 'city' | 'village' | 'tavern' | 'forest' | 'river' | 'road' | 'ruin' | 'wild';
  description: string;
  discovered: boolean;
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
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
  summary: string;
};

export type GameState = {
  schemaVersion: 2;
  campaignId: string;
  campaign: {
    name: string;
    premise: string;
    conflict: string;
    chapter: number;
    quests: Quest[];
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

export type NewCampaignInput = { campaignName: string; characterName: string; className: string };
export type EngineTurn = { state: GameState; requiresDice: boolean; roll: PendingRoll | null; events: GameEvent[]; fallbackNarrative: string };

const ATTRIBUTE_KEYS: AttributeKey[] = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
const SKILL_RANKS: SkillRank[] = ['Iniciante', 'Aprendiz', 'Competente', 'Especialista', 'Mestre', 'Lendário'];
const now = () => new Date().toISOString();
const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clean = (value: string, max = 240) => value.trim().replace(/\s+/g, ' ').slice(0, max);
const hash = (value: string) => Array.from(value).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0) >>> 0;

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
  const variations = [
    `A chuva fina cobre Norwich quando ${input.characterName} chega com uma dívida que não pode ignorar.`,
    `${input.characterName} desperta ao som dos sinos de Norwich; alguém deixou um mapa marcado sob a porta.`,
    `As lanternas de Norwich ainda estão acesas quando ${input.characterName} reconhece um símbolo ligado ao próprio passado.`,
  ];
  return {
    narrative: `${variations[hash(input.characterName + input.className) % variations.length]} A cidade segue sua rotina, sem saber que algo antigo começou a se mover. O que você faz?`,
    premise: `Uma campanha construída em torno de ${input.characterName}, ${input.className}.`,
    conflict: 'Rumores sobre caminhos desaparecidos começam a alterar a vida em Norwich.',
    origin: `Nascido longe dos centros de poder, aprendeu cedo a viver como ${input.className}.`,
    profession: template.profession,
    birthRegion: 'Terras do Vale',
  };
}

export function createInitialState(input: NewCampaignInput): GameState {
  const createdAt = now();
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
  const norwich: Location = { id: 'norwich', name: 'Norwich', region: 'Terras do Vale', kind: 'city', description: 'Uma cidade de pontes de pedra, mercados antigos e ruas que guardam rumores.', discovered: true };
  const state: GameState = {
    schemaVersion: 2,
    campaignId: uid(),
    campaign: {
      name: clean(input.campaignName, 80),
      premise: opening.premise,
      conflict: opening.conflict,
      chapter: 1,
      quests: [{ id: uid(), title: 'O símbolo sob a chuva', description: 'Descubra por que um símbolo antigo voltou a aparecer em Norwich.', objectives: [{ id: uid(), text: 'Investigue os rumores em Norwich', completed: false }], status: 'active', rewardXp: 50, rewardGold: 15 }],
      memory: { shortTerm: [opening.narrative], mediumTerm: ['A campanha começou em Norwich.'], longTerm: [], summary: opening.premise },
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
      day: 1, hour: 18, weather: 'Chuva fina', currentLocationId: norwich.id, locations: { [norwich.id]: norwich },
      npcs: { 'npc-mara': { id: 'npc-mara', name: 'Mara Vell', role: 'Contato inicial', personality: 'Observadora, prática e cautelosa.', goal: 'Entender os símbolos que surgiram em Norwich.', profession: 'Arquivista', locationId: norwich.id, relationship: 0, knowledge: ['Reconhece o símbolo ligado ao conflito inicial.'], memories: [] } },
      factions: { conselho: { id: 'conselho', name: 'Conselho de Norwich', goal: 'Preservar a estabilidade da cidade.' } },
      economy: { regionMultiplier: 1, shops: { 'mercado-norwich': { id: 'mercado-norwich', name: 'Mercado da Ponte', locationId: 'norwich', products: [
        { id: 'pocao-simples', name: 'Poção simples', kind: 'consumível', basePrice: 8, stock: 5, description: 'Recupera vitalidade.' },
        { id: 'corda', name: 'Corda de cânhamo', kind: 'ferramenta', basePrice: 6, stock: 3, description: 'Ajuda em escaladas e travessias.' },
        { id: 'kit-pesca', name: 'Kit de pesca', kind: 'ferramenta', basePrice: 10, stock: 2, description: 'Vara curta, linha e anzóis.' },
      ] } } },
      reputation: { individuals: {}, cities: { norwich: 0 }, factions: {}, regions: { 'Terras do Vale': 0 }, kingdoms: {}, moral: 0 }, timeline: [],
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
  const options: Array<[RegExp, Location]> = [
    [/taverna|estalagem/, { id: 'taverna-lua', name: 'Taverna da Lua', region: 'Norwich', kind: 'tavern', description: 'Uma casa de madeira aquecida por lareira, rumores e canecas.', discovered: true }],
    [/floresta|bosque/, { id: 'floresta-velha', name: 'Floresta Velha', region: 'Terras do Vale', kind: 'forest', description: 'Trilhas estreitas sob árvores antigas e musgo luminoso.', discovered: true }],
    [/rio|riacho|ponte/, { id: 'riacho-norwich', name: 'Riacho de Norwich', region: 'Terras do Vale', kind: 'river', description: 'Água fria corta o vale junto a uma ponte desgastada.', discovered: true }],
    [/ruína|templo|torre abandonada/, { id: 'ruinas-bruma', name: 'Ruínas da Bruma', region: 'Terras do Vale', kind: 'ruin', description: 'Pedras tomadas por heras escondem inscrições quase apagadas.', discovered: true }],
    [/norwich|cidade|mercado/, state.world.locations.norwich || { id: 'norwich', name: 'Norwich', region: 'Terras do Vale', kind: 'city', description: 'Cidade-base da campanha.', discovered: true }],
  ];
  const found = options.find(([pattern]) => pattern.test(value));
  if (!found) return null;
  return { location: found[1], isNew: !state.world.locations[found[1].id] };
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

function updateQuestFromAction(state: GameState, action: string, events: GameEvent[]): GameState {
  const value = action.toLowerCase();
  if (!/investig|pista|rumor|símbolo|simbolo/.test(value)) return state;
  let rewardXp = 0;
  let rewardGold = 0;
  const quests = state.campaign.quests.map(quest => {
    if (quest.status !== 'active') return quest;
    const objectives = quest.objectives.map(objective => ({ ...objective, completed: objective.completed || /investigue|rumor|símbolo/.test(objective.text.toLowerCase()) }));
    const completed = objectives.every(objective => objective.completed);
    if (completed) {
      rewardXp += quest.rewardXp;
      rewardGold += quest.rewardGold;
      events.push(makeEvent(state, 'quest', `Missão concluída: ${quest.title}.`, 'engine', 90));
    }
    return { ...quest, objectives, status: completed ? 'completed' as const : quest.status };
  });
  let next = { ...state, campaign: { ...state.campaign, quests } };
  if (rewardXp) next = grantMilestoneXp(next, rewardXp, 'missão concluída', events);
  if (rewardGold) {
    next = { ...next, character: { ...next.character, gold: next.character.gold + rewardGold } };
    events.push(makeEvent(state, 'gold', `+${rewardGold} moedas de recompensa.`, 'engine', 75));
  }
  return next;
}

function applySocialConsequences(state: GameState, action: string, events: GameEvent[]): GameState {
  const nearby = Object.values(state.world.npcs).filter(npc => npc.locationId === state.world.currentLocationId);
  const target = nearby.find(npc => action.toLowerCase().includes(npc.name.toLowerCase())) || (/ajud|ameaç|insult|agradec|convers|falar/.test(action.toLowerCase()) ? nearby[0] : undefined);
  if (!target) return state;
  const lower = action.toLowerCase();
  const positive = /ajud|proteg|agradec|gentil|honest|cumpriment/.test(lower);
  const negative = /ameaç|insult|roub|agred|mentir/.test(lower);
  if (!positive && !negative) return state;
  const delta = positive ? 2 : -2;
  const npc = { ...target, relationship: clamp(target.relationship + delta, -100, 100), memories: [...target.memories, clean(action, 180)].slice(-12) };
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
  state.session.turn += 1;
  state.session.lastRoll = null;
  state.session.recentActions = [...state.session.recentActions, action].slice(-8);
  state.campaign.memory.shortTerm = [...state.campaign.memory.shortTerm, `T${state.session.turn}: ${action}`].slice(-8);
  state = advanceClock(state, 1);
  const events: GameEvent[] = [makeEvent(state, 'action', action, 'player', 30, false)];
  const locationChange = inferLocation(action, state);
  if (locationChange && locationChange.location.id !== state.world.currentLocationId) {
    state.world.locations[locationChange.location.id] = locationChange.location;
    state.world.currentLocationId = locationChange.location.id;
    events.push(makeEvent(state, 'world', `Local atual: ${locationChange.location.name}.`, 'world', 60));
    if (locationChange.isNew) state = grantMilestoneXp(state, 8, 'descoberta de um novo local', events);
  }
  state = updateQuestFromAction(state, action, events);
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
  state.campaign.memory.shortTerm = [...state.campaign.memory.shortTerm, `T${state.session.turn}: ${pending.skill} ${result.success ? 'teve sucesso' : 'falhou'} (${total}/${pending.difficulty}).`].slice(-8);
  state = updateSave(withEvents(state, events));
  return { state, result, events, fallbackNarrative: result.success ? `O teste de ${pending.skill} funciona e abre uma oportunidade concreta. O que você faz?` : `O teste de ${pending.skill} falha e produz uma consequência, mas a história continua. O que você faz?` };
}

export function acceptNarrative(state: GameState, narrative: string, memorySummary?: string, memoryUpdate: string[] = []): GameState {
  const safeNarrative = clean(narrative, 1800) || state.session.narrative;
  const safeSummary = clean(memorySummary || state.campaign.memory.summary, 1200);
  const medium = [...state.campaign.memory.mediumTerm, ...memoryUpdate.map(value => clean(value, 220)).filter(Boolean)].slice(-20);
  return updateSave({ ...state, campaign: { ...state.campaign, memory: { ...state.campaign.memory, mediumTerm: medium, summary: safeSummary } }, session: { ...state.session, narrative: safeNarrative } });
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
  state.character.gold -= price;
  const existing = state.character.inventory.find(item => item.name === product.name);
  if (existing) existing.quantity += 1;
  else state.character.inventory.push({ id: uid(), name: product.name, kind: product.kind, quantity: 1, value: product.basePrice, description: product.description });
  state.world.economy.shops[shopId].products = state.world.economy.shops[shopId].products.map(candidate => candidate.id === productId ? { ...candidate, stock: candidate.stock - 1 } : candidate);
  const events = [makeEvent(state, 'gold', `${product.name} comprado por ${price} moedas.`, 'engine', 70)];
  state = updateSave(withEvents(state, events));
  return { state, events, narrative: `A compra é concluída no ${shop.name}. ${product.name} agora está na mochila. O que você faz?` };
}

export function applyGenesis(state: GameState, genesis: Partial<{ narrative: string; premise: string; conflict: string; origin: string; profession: string; birthRegion: string; questTitle: string; questDescription: string; npcName: string; npcRole: string; npcPersonality: string; npcGoal: string; factionName: string }>): GameState {
  const location = currentLocation(state);
  const npcName = clean(genesis.npcName || 'Mara Vell', 60);
  const npcId = `npc-${hash(npcName).toString(36)}`;
  const factionName = clean(genesis.factionName || 'Círculo das Lanternas', 80);
  const factionId = `faction-${hash(factionName).toString(36)}`;
  const quest: Quest = { id: uid(), title: clean(genesis.questTitle || state.campaign.quests[0].title, 100), description: clean(genesis.questDescription || state.campaign.quests[0].description, 260), objectives: [{ id: uid(), text: 'Descubra a primeira pista do conflito', completed: false }], status: 'active', rewardXp: 50, rewardGold: 15 };
  return acceptNarrative({
    ...state,
    campaign: { ...state.campaign, premise: clean(genesis.premise || state.campaign.premise, 400), conflict: clean(genesis.conflict || state.campaign.conflict, 400), quests: [quest], memory: { ...state.campaign.memory, summary: clean(genesis.premise || state.campaign.memory.summary, 1200) } },
    character: { ...state.character, origin: clean(genesis.origin || state.character.origin, 300), profession: clean(genesis.profession || state.character.profession, 80), birthRegion: clean(genesis.birthRegion || state.character.birthRegion, 80) },
    world: {
      ...state.world,
      npcs: { ...state.world.npcs, [npcId]: { id: npcId, name: npcName, role: clean(genesis.npcRole || 'Contato inicial', 80), personality: clean(genesis.npcPersonality || 'Observadora e cautelosa', 120), goal: clean(genesis.npcGoal || 'Entender o que ameaça Norwich', 180), profession: 'Moradora de Norwich', locationId: location.id, relationship: 0, knowledge: ['Conhece rumores ligados ao conflito inicial.'], memories: [] } },
      factions: { ...state.world.factions, [factionId]: { id: factionId, name: factionName, goal: 'Influenciar o futuro da região.' } },
    },
  }, genesis.narrative || state.session.narrative, genesis.premise);
}

export function buildAiContext(state: GameState) {
  const location = currentLocation(state);
  const nearbyNpcs = Object.values(state.world.npcs).filter(npc => npc.locationId === location.id).slice(0, 4).map(npc => ({ name: npc.name, role: npc.role, personality: npc.personality, goal: npc.goal, relationship: npc.relationship, memories: npc.memories.slice(-3) }));
  return {
    campaign: { name: state.campaign.name, premise: state.campaign.premise, conflict: state.campaign.conflict, chapter: state.campaign.chapter },
    character: { name: state.character.name, className: state.character.className, origin: state.character.origin, profession: state.character.profession, level: state.character.level, hp: state.character.hp, maxHp: state.character.maxHp, mana: state.character.mana, gold: state.character.gold, titles: state.character.titles, conditions: state.character.conditions },
    world: { day: state.world.day, hour: state.world.hour, weather: state.world.weather, location, nearbyNpcs },
    objectives: state.campaign.quests.filter(quest => quest.status === 'active').map(quest => ({ title: quest.title, objectives: quest.objectives })),
    memory: { summary: state.campaign.memory.summary, medium: state.campaign.memory.mediumTerm.slice(-8), recent: state.campaign.memory.shortTerm.slice(-6) },
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
  if (candidate.schemaVersion === 2 && candidate.character && candidate.world && candidate.session) {
    const current = candidate as GameState;
    if (!current.world.economy) {
      const restored = createInitialState({ campaignName: current.campaign.name, characterName: current.character.name, className: current.character.className });
      current.world.economy = restored.world.economy;
    }
    return current;
  }
  const legacy = candidate as Record<string, any>;
  if (!legacy.campaignId || !legacy.characterName) return null;
  const fresh = createInitialState({ campaignName: String(legacy.campaignName || 'Campanha recuperada'), characterName: String(legacy.characterName), className: String(legacy.className || 'Explorador') });
  fresh.campaignId = String(legacy.campaignId);
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
export const initialState = (characterName = 'Viajante', campaignName = 'Nova campanha', className = 'Explorador') => createInitialState({ characterName, campaignName, className });
export const advanceDemo = (state: GameState, action: string) => {
  const result = beginAction(state, action);
  return { narrative: result.fallbackNarrative, needsRoll: result.requiresDice, rollSkill: result.roll?.skill || null, rollDifficulty: result.roll?.difficulty || null, scene: currentLocation(result.state).name, locationChanged: false, events: result.events, state: acceptNarrative(result.state, result.fallbackNarrative) };
};
export type Event = GameEvent;
export type ClassName = string;
