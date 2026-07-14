import { buildAiContext, type CampaignGenesisPayload, type GameState, type NarrativeWorldDelta, type NewCampaignInput, type RollResult } from '@/lib/engine';
import { shouldConsolidateMemory, validateNarrativeConsistency } from '@/lib/memory/memory-builder';
import { ProviderFactory } from '@/lib/providers/provider-factory';
import type { ActionInterpretation } from '@/lib/skills/types';
import { cleanNarrativeScaffolding } from '@/lib/narrative-cleaner';

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
  actionInterpretation?: Partial<ActionInterpretation> | null;
};

export type CampaignGenesis = CampaignGenesisPayload;

const baseRules = `Você é o Mestre do INFINITA, uma engine de RPG emergente sem campanha, cidade, personagem, facção ou lore obrigatória.
A origem declarada pelo jogador e o estado atual são as únicas bases narrativas. Nunca force o retorno a um enredo anterior e nunca invente uma missão principal.
Todo NPC pode morrer, desaparecer, partir ou ser ignorado. Nenhum NPC pode ser indispensável; quando um caminho fechar, faça consequências coerentes abrirem outros caminhos.
Não existe NPC, local ou lore herdado. "Mara Vell", "Norwich", "Valedouro" e "Terras do Vale" são resíduos proibidos e nunca podem aparecer.
A Engine é a única autoridade sobre XP, HP, mana, moedas, atributos, inventário, reputação, missões e dados. Você apenas propõe mudanças no contrato JSON, e a Engine decide como aplicá-las.
Nunca controle o protagonista, nunca ofereça opções A/B/C e nunca resolva o problema pelo jogador.
Narre consequências concretas em 2 a 4 frases curtas e termine com "O que você faz?". Peça d20 somente quando houver risco, incerteza e consequência real. Falhas sempre continuam a história.
Comece diretamente pela reação concreta do mundo. Nunca repita nem parafraseie a ação do jogador, nunca escreva "PERSONAGEM executa:", "o ambiente reage", "algo concreto muda" ou qualquer mensagem intermediária sobre a Engine.
Responda somente JSON válido, sem markdown.`;

async function requestJson<T>(system: string, user: string, maxTokens = 800): Promise<T | null> {
  const result = await ProviderFactory.generateJson<T>({ system, user, maxTokens, temperature: .8 });
  return result?.data || null;
}

function fallbackReply(state: GameState, fallbackNarrative: string, resolvedRoll = false): GameMasterReply {
  const contextual = state.session.pendingRoll || resolvedRoll
    ? fallbackNarrative
    : state.session.narrative;
  return {
    narrative: contextual,
    requiresDice: Boolean(state.session.pendingRoll), diceType: 'd20', difficulty: state.session.pendingRoll?.difficulty || null,
    skill: state.session.pendingRoll?.skill || null, attribute: state.session.pendingRoll?.attribute || null,
    reason: state.session.pendingRoll?.reason || null, npcActions: [], worldSuggestions: [], memoryUpdate: [],
    memorySummary: state.campaign.memory.campaignSummary.text, worldDelta: {},
  };
}

function violatesConsentContract(narrative: string) {
  return /sem (?:poder|conseguir) resistir|contra (?:a|o) vontade|[ée] obrigad[ao]|n[aã]o tem escolha|cede automaticamente|passa a amar/i.test(narrative);
}

export async function narrateTurn(state: GameState, action: string, fallbackNarrative: string, rollResult?: RollResult): Promise<{ reply: GameMasterReply; mode: 'ai' | 'fallback'; error?: string }> {
  const context = buildAiContext(state);
  const contract = `Retorne exatamente estas chaves: {"narrative":string,"requiresDice":boolean,"diceType":"d20","difficulty":number|null,"skill":string|null,"attribute":string|null,"reason":string|null,"actionInterpretation":{"rawAction":string,"intent":string,"domain":"combat|movement|social|romance|knowledge|craft|survival|perception|stealth|commerce|magic|performance|medicine|exploration|general","proposedSkill":string,"proposedAttribute":"strength|dexterity|constitution|intelligence|wisdom|charisma","actionMethod":string,"targetId":string,"requiresRoll":boolean,"opposed":boolean,"riskLevel":"none|low|medium|high|extreme","reasoning":string,"possibleExistingSkillKeys":string[],"trainable":boolean,"trivial":boolean,"consentRequired":boolean}|null,"npcActions":string[],"worldSuggestions":string[],"memoryUpdate":string[],"memorySummary":string,"worldDelta":{"locations":[{"name":string,"region":string,"kind":string,"description":string,"visualIdentity":{"architecture":string,"palette":string[],"fixedObjects":string[]}}],"currentLocationName":string|null,"npcs":[{"name":string,"role":string,"personality":string,"goal":string,"profession":string,"locationName":string,"visualAppearance":{"clothing":string,"hair":string,"accessories":string[],"weapon":string,"apparentAge":string,"palette":string[]}}],"npcChanges":[{"name":string,"status":"active|dead|missing|departed","memory":string}],"opportunities":string[],"quests":[{"title":string,"description":string,"objective":string,"status":"active|completed|failed|abandoned"}],"worldChanges":string[],"items":[{"name":string,"description":string,"category":"consumable|tool|weapon|armor|accessory|material|quest|document|key|relic|narrative","rarity":"common|uncommon|rare|epic|legendary","weight":number,"value":number,"quantity":number,"origin":string,"narrativeEffects":string[],"mechanicalEffects":[{"type":"restore_hp|restore_mana|attribute_bonus|skill_bonus|unlock_action|unlock_location|unlock_dialogue|unlock_profession|trigger_event|damage_bonus|defense_bonus","target":string,"value":number}],"durability":number|null}],"spells":[{"name":string,"fantasy":string,"suggestedType":"attack|healing|defense|control|utility|summoning|movement|narrative","suggestedPower":"low|medium|high","element":string,"origin":string}],"mechanicalEffects":[{"type":"damage_player|heal_player|restore_mana|change_gold|change_reputation","amount":number,"target":string,"reason":string}]}}.
Use arrays vazias quando não houver mudança e currentLocationName null quando o jogador não mudou de local. Crie objetivos somente quando surgirem organicamente das escolhas, desejos ou consequências; nunca os chame de missão principal.
Se um NPC ficou indisponível, registre npcChanges e crie ao menos uma oportunidade coerente que não dependa dele. Se a Engine já criou pendingRoll, preserve seus dados.
Crie um NPC em worldDelta.npcs somente quando a ação atual fizer o jogador encontrar, observar ou provocar concretamente essa pessoa. O nome do novo NPC deve aparecer na narrativa deste mesmo turno; nunca preencha NPCs decorativos ou vindos de uma campanha anterior. Crie locais da mesma forma: apenas quando forem descobertos na narrativa, com nome próprio explícito. Procurar uma cidade não significa já ter encontrado uma.
Quando houver rollResult, context.scene.previousNarrative é a cena imediatamente anterior ao dado. Continue diretamente dessa cena e resolva exatamente playerAction conforme die, total, difficulty, success e critical. Mostre uma consequência ficcional específica, perceptível e ligada às pessoas, objetos e perigos já presentes; não use frases genéricas como "o teste teve sucesso", "o teste falhou" ou "a situação muda". Não peça o mesmo teste novamente, não ofereça uma nova rolagem e devolva requiresDice false.
memorySummary deve ter no máximo 900 caracteres e preservar origem, locais, pessoas, relações, eventos, objetivos e mudanças duradouras. Só consolide o resumo quando context.memory.mustConsolidateSummary for true; caso contrário, devolva o resumo atual. memoryUpdate contém apenas fatos canônicos permanentes, nunca detalhes triviais.
Só sugira um item quando a narrativa disser explicitamente que o personagem o adquiriu, encontrou, recebeu, roubou ou fabricou. Use no máximo um item por turno. O nome exato precisa aparecer na narrativa. Todo item deve possuir pelo menos um efeito mecânico real e coerente; a Engine validará e poderá rejeitar a sugestão. Nunca altere diretamente o inventário.
Só sugira magia quando o personagem realmente a aprender por treino, mestre, item, descoberta ou consequência. A Engine define custo, dano, cura e cooldown. mechanicalEffects são sugestões factuais da consequência narrada; use valores pequenos e nunca altere estado apenas no texto. Se a ação do jogador for possível e não exigir dado, faça a situação avançar concretamente e preencha os deltas correspondentes. Nunca responda com uma paráfrase genérica da ação.
actionInterpretation é apenas uma proposta semântica para a Engine validar. Interprete intenção, método, objeto, alvo, duração, risco e oposição; não escolha CD final. Use null quando a Engine já forneceu pendingRoll ou rollResult. Romance nunca é controle mental: Sedução usa Carisma para a qualidade da abordagem, enquanto perceber receptividade usa Sabedoria + Empatia, e nenhuma rolagem substitui consentimento, limites, personalidade ou objetivos do NPC.`;
  try {
    const reply = await requestJson<GameMasterReply>(`${baseRules}\n${contract}`, JSON.stringify({ context, playerAction: action, rollResult: rollResult || null }), 1800);
    if (!reply) return { reply: fallbackReply(state, fallbackNarrative, Boolean(rollResult)), mode: 'fallback', error: 'Nenhum provedor narrativo está disponível.' };
    if (typeof reply.narrative !== 'string' || !reply.narrative.trim()) {
      return { reply: fallbackReply(state, fallbackNarrative, Boolean(rollResult)), mode: 'fallback', error: 'A IA retornou uma consequência narrativa vazia.' };
    }
    if (rollResult?.consentRequired && violatesConsentContract(reply.narrative)) {
      return { reply: fallbackReply(state, fallbackNarrative, true), mode: 'fallback', error: 'A consequência da IA violou o contrato de consentimento e foi rejeitada.' };
    }
    reply.requiresDice = Boolean(reply.requiresDice);
    if (rollResult) {
      reply.requiresDice = false;
      reply.difficulty = null;
      reply.skill = null;
      reply.attribute = null;
      reply.reason = null;
    }
    reply.worldDelta ||= {};
    reply.worldDelta.locations ||= []; reply.worldDelta.npcs ||= []; reply.worldDelta.npcChanges ||= []; reply.worldDelta.opportunities ||= []; reply.worldDelta.quests ||= []; reply.worldDelta.worldChanges ||= []; reply.worldDelta.items ||= []; reply.worldDelta.spells ||= []; reply.worldDelta.mechanicalEffects ||= [];
    reply.memoryUpdate ||= [];
    if (!shouldConsolidateMemory(state, reply.worldDelta, reply.narrative)) reply.memorySummary = state.campaign.memory.campaignSummary.text;
    const validation = validateNarrativeConsistency(state, reply.narrative, reply.worldDelta);
    const cleanedNarrative = cleanNarrativeScaffolding(validation.narrative, state.character.name);
    if (!cleanedNarrative) {
      return { reply: fallbackReply(state, fallbackNarrative, Boolean(rollResult)), mode: 'fallback', error: 'A IA não produziu uma consequência narrativa utilizável.' };
    }
    reply.narrative = cleanedNarrative;
    reply.worldDelta = validation.delta;
    if (validation.contradictions.length) reply.memoryUpdate.push(...validation.contradictions.map(value => `Correção de consistência: ${value}`));
    return { reply, mode: 'ai' };
  } catch (error) {
    console.error('INFINITA Game Master failed', error);
    return { reply: fallbackReply(state, fallbackNarrative, Boolean(rollResult)), mode: 'fallback', error: error instanceof Error ? error.message : 'Falha no provedor de IA.' };
  }
}

export async function generateCampaign(input: NewCampaignInput, state: GameState): Promise<{ genesis: CampaignGenesis | null; mode: 'ai' | 'fallback'; error?: string }> {
  const contract = `Crie um mundo inicial exclusivamente a partir de "openingPrompt", nome, classe e campanha fornecidos pelo jogador. Não herde qualquer lore, cidade, conflito, NPC ou facção anterior.
Retorne exatamente: {"narrative":string,"premise":string,"conflict":string,"origin":string,"profession":string,"birthRegion":string,"initialLocation":{"name":string,"region":string,"kind":"city|village|tavern|forest|river|road|ruin|wild","description":string,"visualIdentity":{"architecture":string,"palette":string[],"fixedObjects":string[]}},"culture":{"name":string,"values":string[],"customs":string[],"notes":string},"opportunities":string[],"npcs":[{"name":string,"role":string,"personality":string,"goal":string,"profession":string,"visualAppearance":{"clothing":string,"hair":string,"accessories":string[],"weapon":string,"apparentAge":string,"palette":string[]}}],"factions":[{"name":string,"goal":string}],"economy":{"regionMultiplier":number,"shopName":string,"products":[{"name":string,"kind":"arma|armadura|consumível|ferramenta|material|missão","basePrice":number,"stock":number,"description":string}]},"weather":string,"hour":number}.
Nesta criação inicial, npcs deve ser obrigatoriamente []. Não introduza nem nomeie qualquer pessoa na narrativa inicial; NPCs nascerão depois, exclusivamente das ações do jogador. Facções e loja podem ser arrays/vazios quando não fizerem sentido para a origem. opportunities são possibilidades, não ordens nem missão principal.
A narrativa deve ter 2 a 4 frases, respeitar literalmente a situação inicial do jogador e terminar com "O que você faz?". Não conceda itens, XP, dinheiro ou atributos.`;
  try {
    const genesis = await requestJson<CampaignGenesis>(`${baseRules}\n${contract}`, JSON.stringify({ input, deterministicState: buildAiContext(state) }), 1500);
    return genesis ? { genesis, mode: 'ai' } : { genesis: null, mode: 'fallback', error: 'Nenhum provedor narrativo está disponível.' };
  } catch (error) {
    console.error('INFINITA campaign generation failed', error);
    return { genesis: null, mode: 'fallback', error: error instanceof Error ? error.message : 'Falha ao gerar campanha.' };
  }
}
