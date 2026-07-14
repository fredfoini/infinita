import { buildAiContext, type CampaignGenesisPayload, type GameState, type NarrativeWorldDelta, type NewCampaignInput, type RollResult } from '@/lib/engine';
import { shouldConsolidateMemory, validateNarrativeConsistency } from '@/lib/memory/memory-builder';
import { ProviderFactory } from '@/lib/providers/provider-factory';

export type GameMasterReply = {
  narrative: string;
  requiresDice: boolean;
  diceType: 'd20';
  difficulty: number | null;
  skill: string | null;
  attribute: string | null;
  reason: string | null;
  npcActions: string[];
  worldSuggestions: string[];
  memoryUpdate: string[];
  memorySummary: string;
  worldDelta: NarrativeWorldDelta;
};

export type CampaignGenesis = CampaignGenesisPayload;

const baseRules = `Você é o Mestre do INFINITA, uma engine de RPG emergente sem campanha, cidade, personagem, facção ou lore obrigatória.
A origem declarada pelo jogador e o estado atual são as únicas bases narrativas. Nunca force o retorno a um enredo anterior e nunca invente uma missão principal.
Todo NPC pode morrer, desaparecer, partir ou ser ignorado. Nenhum NPC pode ser indispensável; quando um caminho fechar, faça consequências coerentes abrirem outros caminhos.
A Engine é a única autoridade sobre XP, HP, mana, moedas, atributos, inventário, reputação, missões e dados. Você apenas propõe mudanças no contrato JSON, e a Engine decide como aplicá-las.
Nunca controle o protagonista, nunca ofereça opções A/B/C e nunca resolva o problema pelo jogador.
Narre consequências concretas em 2 a 4 frases curtas e termine com "O que você faz?". Peça d20 somente quando houver risco, incerteza e consequência real. Falhas sempre continuam a história.
Responda somente JSON válido, sem markdown.`;

async function requestJson<T>(system: string, user: string, maxTokens = 800): Promise<T | null> {
  const result = await ProviderFactory.generateJson<T>({ system, user, maxTokens, temperature: .8 });
  return result?.data || null;
}

function fallbackReply(state: GameState, fallbackNarrative: string): GameMasterReply {
  return {
    narrative: fallbackNarrative,
    requiresDice: Boolean(state.session.pendingRoll), diceType: 'd20', difficulty: state.session.pendingRoll?.difficulty || null,
    skill: state.session.pendingRoll?.skill || null, attribute: state.session.pendingRoll?.attribute || null,
    reason: state.session.pendingRoll?.reason || null, npcActions: [], worldSuggestions: [], memoryUpdate: [],
    memorySummary: state.campaign.memory.campaignSummary.text, worldDelta: {},
  };
}

export async function narrateTurn(state: GameState, action: string, fallbackNarrative: string, rollResult?: RollResult): Promise<{ reply: GameMasterReply; mode: 'ai' | 'fallback'; error?: string }> {
  const context = buildAiContext(state);
  const contract = `Retorne exatamente estas chaves: {"narrative":string,"requiresDice":boolean,"diceType":"d20","difficulty":number|null,"skill":string|null,"attribute":string|null,"reason":string|null,"npcActions":string[],"worldSuggestions":string[],"memoryUpdate":string[],"memorySummary":string,"worldDelta":{"locations":[{"name":string,"region":string,"kind":"city|village|tavern|forest|river|road|ruin|wild","description":string,"visualIdentity":{"architecture":string,"palette":string[],"fixedObjects":string[]}}],"currentLocationName":string|null,"npcs":[{"name":string,"role":string,"personality":string,"goal":string,"profession":string,"locationName":string,"visualAppearance":{"clothing":string,"hair":string,"accessories":string[],"weapon":string,"apparentAge":string,"palette":string[]}}],"npcChanges":[{"name":string,"status":"active|dead|missing|departed","memory":string}],"opportunities":string[],"quests":[{"title":string,"description":string,"objective":string,"status":"active|completed|failed|abandoned"}],"worldChanges":string[]}}.
Use arrays vazias quando não houver mudança e currentLocationName null quando o jogador não mudou de local. Crie objetivos somente quando surgirem organicamente das escolhas, desejos ou consequências; nunca os chame de missão principal.
Se um NPC ficou indisponível, registre npcChanges e crie ao menos uma oportunidade coerente que não dependa dele. Se a Engine já criou pendingRoll, preserve seus dados. Se há rollResult, narre o resultado e não peça o mesmo teste novamente.
memorySummary deve ter no máximo 900 caracteres e preservar origem, locais, pessoas, relações, eventos, objetivos e mudanças duradouras. Só consolide o resumo quando context.memory.mustConsolidateSummary for true; caso contrário, devolva o resumo atual. memoryUpdate contém apenas fatos canônicos permanentes, nunca detalhes triviais.`;
  try {
    const reply = await requestJson<GameMasterReply>(`${baseRules}\n${contract}`, JSON.stringify({ context, playerAction: action, rollResult: rollResult || null }), 1200);
    if (!reply) return { reply: fallbackReply(state, fallbackNarrative), mode: 'fallback', error: 'Nenhum provedor narrativo está disponível.' };
    reply.worldDelta ||= {};
    reply.memoryUpdate ||= [];
    if (!shouldConsolidateMemory(state, reply.worldDelta, reply.narrative)) reply.memorySummary = state.campaign.memory.campaignSummary.text;
    const validation = validateNarrativeConsistency(state, reply.narrative, reply.worldDelta);
    reply.narrative = validation.narrative;
    reply.worldDelta = validation.delta;
    if (validation.contradictions.length) reply.memoryUpdate.push(...validation.contradictions.map(value => `Correção de consistência: ${value}`));
    return { reply, mode: 'ai' };
  } catch (error) {
    console.error('INFINITA Game Master failed', error);
    return { reply: fallbackReply(state, fallbackNarrative), mode: 'fallback', error: error instanceof Error ? error.message : 'Falha no provedor de IA.' };
  }
}

export async function generateCampaign(input: NewCampaignInput, state: GameState): Promise<{ genesis: CampaignGenesis | null; mode: 'ai' | 'fallback'; error?: string }> {
  const contract = `Crie um mundo inicial exclusivamente a partir de "openingPrompt", nome, classe e campanha fornecidos pelo jogador. Não herde qualquer lore, cidade, conflito, NPC ou facção anterior.
Retorne exatamente: {"narrative":string,"premise":string,"conflict":string,"origin":string,"profession":string,"birthRegion":string,"initialLocation":{"name":string,"region":string,"kind":"city|village|tavern|forest|river|road|ruin|wild","description":string,"visualIdentity":{"architecture":string,"palette":string[],"fixedObjects":string[]}},"culture":{"name":string,"values":string[],"customs":string[],"notes":string},"opportunities":string[],"npcs":[{"name":string,"role":string,"personality":string,"goal":string,"profession":string,"visualAppearance":{"clothing":string,"hair":string,"accessories":string[],"weapon":string,"apparentAge":string,"palette":string[]}}],"factions":[{"name":string,"goal":string}],"economy":{"regionMultiplier":number,"shopName":string,"products":[{"name":string,"kind":"arma|armadura|consumível|ferramenta|material|missão","basePrice":number,"stock":number,"description":string}]},"weather":string,"hour":number}.
NPCs, facções e loja podem ser arrays/vazios quando não fizerem sentido para a origem. opportunities são possibilidades, não ordens nem missão principal. Nenhum NPC é essencial.
A narrativa deve ter 2 a 4 frases, respeitar literalmente a situação inicial do jogador e terminar com "O que você faz?". Não conceda itens, XP, dinheiro ou atributos.`;
  try {
    const genesis = await requestJson<CampaignGenesis>(`${baseRules}\n${contract}`, JSON.stringify({ input, deterministicState: buildAiContext(state) }), 1500);
    return genesis ? { genesis, mode: 'ai' } : { genesis: null, mode: 'fallback', error: 'Nenhum provedor narrativo está disponível.' };
  } catch (error) {
    console.error('INFINITA campaign generation failed', error);
    return { genesis: null, mode: 'fallback', error: error instanceof Error ? error.message : 'Falha ao gerar campanha.' };
  }
}
