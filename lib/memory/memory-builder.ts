import type { GameEvent, GameState, MemoryState, NarrativeWorldDelta, NPC, Quest } from '@/lib/engine';

const IMPORTANT_EVENT = /morreu|morte|casamento|casou|profiss[aã]o|neg[oó]cio|fundou|descobriu|nova regi[aã]o|pol[ií]tic|grande combate|derrotou|conclu[ií]d|transform/i;
const unique = (values: string[], limit: number) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(-limit);
const clip = (value: string, max: number) => value.trim().replace(/\s+/g, ' ').slice(0, max);

export function createMemoryState(prompt: string, summary: string, createdAt: string): MemoryState {
  return {
    worldGenesis: { originalPrompt: clip(prompt, 700), structuredSummary: clip(summary, 900), createdAt },
    canon: [{ id: `genesis-${createdAt}`, category: 'genesis', text: clip(prompt, 500), turn: 0, createdAt }],
    campaignSummary: { text: clip(summary, 1200), lastConsolidatedTurn: 0, revision: 1 },
    session: [{ id: `opening-${createdAt}`, turn: 0, text: clip(summary, 400), importance: 'major' }],
    anchor: {
      currentObjective: '',
      declaredDesires: [],
      importantRelationships: [],
      activeConflicts: [],
      relevantLocations: [],
      themes: inferThemes(`${prompt} ${summary}`),
    },
  };
}

export function inferThemes(text: string): string[] {
  const value = text.toLowerCase();
  const themes: string[] = [];
  if (/fam[ií]lia|amor|romance|casamento/.test(value)) themes.push('vínculos');
  if (/vingan|justi[cç]a|crime/.test(value)) themes.push('justiça e consequência');
  if (/mist[eé]rio|mem[oó]ria|segredo|investig/.test(value)) themes.push('mistério');
  if (/explor|viagem|descob|mapa/.test(value)) themes.push('descoberta');
  if (/guerra|combate|amea[cç]a/.test(value)) themes.push('conflito');
  if (/trabalho|profiss[aã]o|neg[oó]cio|of[ií]cio/.test(value)) themes.push('ofício e transformação');
  return themes.length ? themes.slice(0, 5) : ['escolha e consequência'];
}

export function isTransformativeEvent(text: string, delta?: NarrativeWorldDelta) {
  return IMPORTANT_EVENT.test(text) || Boolean(delta?.npcChanges?.some(change => change.status !== 'active')) ||
    Boolean(delta?.quests?.some(quest => quest.status === 'completed' || quest.status === 'failed')) ||
    Boolean(delta?.locations?.length || delta?.worldChanges?.some(change => IMPORTANT_EVENT.test(change)));
}

export function shouldConsolidateMemory(state: GameState, delta?: NarrativeWorldDelta, narrative = '') {
  const turnsSinceSummary = state.session.turn - state.campaign.memory.campaignSummary.lastConsolidatedTurn;
  return turnsSinceSummary >= 12 || isTransformativeEvent(narrative, delta);
}

function npcMemory(npc: NPC) {
  return {
    name: npc.name,
    role: npc.role,
    status: npc.status,
    relationship: npc.relationship,
    firstImpression: npc.memoryProfile.firstImpression,
    sharedEvents: npc.memoryProfile.sharedEvents.slice(-4),
    trust: npc.memoryProfile.trust,
    favors: npc.memoryProfile.favors.slice(-3),
    conflicts: npc.memoryProfile.conflicts.slice(-3),
    pendingTopics: npc.memoryProfile.pendingTopics.slice(-3),
  };
}

function questMemory(quest: Quest) {
  return {
    title: quest.title,
    status: quest.status,
    origin: quest.memory.origin,
    motive: quest.memory.motive,
    progress: quest.memory.progress.slice(-4),
    consequences: quest.memory.consequences.slice(-3),
    personalGoal: quest.memory.personalGoal,
    objectives: quest.objectives,
  };
}

export function buildMemoryContext(state: GameState) {
  const location = state.world.locations[state.world.currentLocationId] || Object.values(state.world.locations)[0];
  const relevantNpcIds = new Set([
    ...Object.values(state.world.npcs).filter(npc => npc.locationId === location?.id).map(npc => npc.id),
    ...state.campaign.memory.anchor.importantRelationships,
  ]);
  const relevantNpcs = Object.values(state.world.npcs).filter(npc => relevantNpcIds.has(npc.id)).slice(0, 8).map(npcMemory);
  const activeQuests = state.campaign.quests.filter(quest => quest.status === 'active').slice(0, 8).map(questMemory);
  return {
    worldGenesis: state.campaign.memory.worldGenesis,
    canon: state.campaign.memory.canon.slice(-24),
    campaignSummary: state.campaign.memory.campaignSummary,
    sessionMemory: state.campaign.memory.session.slice(-10),
    narrativeAnchor: state.campaign.memory.anchor,
    currentLocation: location,
    relevantNpcs,
    quests: activeQuests,
    mustConsolidateSummary: shouldConsolidateMemory(state),
  };
}

export function appendSessionMemory(memory: MemoryState, turn: number, text: string, importance: 'normal' | 'major' = 'normal'): MemoryState {
  const entry = { id: `memory-${turn}-${Math.abs(hashText(text))}`, turn, text: clip(text, 420), importance } as const;
  return { ...memory, session: [...memory.session, entry].slice(-20) };
}

export function updateNarrativeMemory(state: GameState, narrative: string, summary?: string, facts: string[] = [], delta?: NarrativeWorldDelta): MemoryState {
  const important = isTransformativeEvent(narrative, delta);
  let memory = appendSessionMemory(state.campaign.memory, state.session.turn, narrative, important ? 'major' : 'normal');
  const canonCandidates = [
    ...facts,
    ...(delta?.worldChanges || []),
    ...(delta?.npcChanges || []).filter(change => change.status !== 'active').map(change => `${change.name}: ${change.status}. ${change.memory || ''}`),
    ...(delta?.quests || []).filter(quest => quest.status !== 'active').map(quest => `${quest.title}: ${quest.status}.`),
  ].map(value => clip(value, 320)).filter(Boolean);
  if (important || canonCandidates.length) {
    const existing = new Set(memory.canon.map(fact => fact.text.toLowerCase()));
    const additions = canonCandidates.filter(text => !existing.has(text.toLowerCase())).map((text, index) => ({
      id: `canon-${state.session.turn}-${index}-${Math.abs(hashText(text))}`,
      category: classifyFact(text), text, turn: state.session.turn, createdAt: new Date().toISOString(),
    }));
    memory = { ...memory, canon: [...memory.canon, ...additions].slice(-120) };
  }
  if (summary && shouldConsolidateMemory(state, delta, narrative)) {
    memory = { ...memory, campaignSummary: { text: clip(summary, 1200), lastConsolidatedTurn: state.session.turn, revision: memory.campaignSummary.revision + 1 } };
  }
  return { ...memory, anchor: refreshAnchor(state, memory, delta) };
}

function refreshAnchor(state: GameState, memory: MemoryState, delta?: NarrativeWorldDelta) {
  const activeQuest = (delta?.quests || []).find(quest => quest.status === 'active') || state.campaign.quests.find(quest => quest.status === 'active');
  const relationships = Object.values(state.world.npcs).filter(npc => Math.abs(npc.relationship) >= 2 || npc.memoryProfile.sharedEvents.length > 1).map(npc => npc.id);
  const locations = unique([state.world.currentLocationId, ...memory.anchor.relevantLocations], 12);
  const conflicts = unique([state.campaign.conflict, ...memory.anchor.activeConflicts].filter(Boolean), 10);
  return {
    ...memory.anchor,
    currentObjective: activeQuest ? ('objective' in activeQuest ? activeQuest.objective : activeQuest.title) : memory.anchor.currentObjective,
    importantRelationships: unique([...memory.anchor.importantRelationships, ...relationships], 16),
    activeConflicts: conflicts,
    relevantLocations: locations,
    themes: unique([...memory.anchor.themes, ...inferThemes(`${state.campaign.premise} ${state.campaign.conflict}`)], 8),
  };
}

export function validateNarrativeConsistency(state: GameState, narrative: string, delta: NarrativeWorldDelta) {
  const contradictions: string[] = [];
  const unavailable = Object.values(state.world.npcs).filter(npc => npc.status !== 'active');
  const incomingNames = new Set((delta.npcs || []).map(npc => npc.name.toLowerCase()));
  for (const npc of unavailable) if (incomingNames.has(npc.name.toLowerCase())) contradictions.push(`${npc.name} está ${npc.status} e não pode ser recriado como NPC ativo.`);
  const correctedDelta: NarrativeWorldDelta = { ...delta, npcs: (delta.npcs || []).filter(npc => !unavailable.some(old => old.name.toLowerCase() === npc.name.toLowerCase())) };
  const safeNarrative = clip(narrative, 1800) || state.session.narrative;
  return { narrative: safeNarrative, delta: correctedDelta, contradictions };
}

export function migrateMemory(old: unknown, prompt: string, summary: string, turn: number, createdAt: string): MemoryState {
  const candidate = old as Partial<MemoryState> & { shortTerm?: string[]; mediumTerm?: string[]; longTerm?: string[]; summary?: string };
  if (candidate?.worldGenesis && candidate.campaignSummary && candidate.anchor) return candidate as MemoryState;
  const next = createMemoryState(prompt, candidate?.summary || summary, createdAt);
  next.session = (candidate?.shortTerm || []).map((text, index) => ({ id: `migrated-session-${index}`, turn: Math.max(0, turn - index), text: clip(text, 420), importance: 'normal' as const })).slice(-20);
  next.canon = [...next.canon, ...(candidate?.longTerm || []).map((text, index) => ({ id: `migrated-canon-${index}`, category: 'legacy', text: clip(text, 320), turn: 0, createdAt }))].slice(-120);
  next.campaignSummary = { text: clip(candidate?.summary || summary, 1200), lastConsolidatedTurn: turn, revision: 1 };
  next.anchor.declaredDesires = unique(candidate?.mediumTerm || [], 12);
  return next;
}

function classifyFact(text: string) {
  if (/morreu|dead|missing|departed|partiu|desapareceu/i.test(text)) return 'npc-status';
  if (/conclu|falhou|abandon/i.test(text)) return 'quest';
  if (/regi[aã]o|local|cidade|floresta|ru[ií]na/i.test(text)) return 'location';
  return 'world-change';
}

function hashText(value: string) {
  return Array.from(value).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0);
}

export function importantEventsFromTimeline(events: GameEvent[]) {
  return events.filter(event => event.persistent && (event.priority >= 75 || IMPORTANT_EVENT.test(event.text))).map(event => event.text);
}
