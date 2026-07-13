import { buildAiContext, type GameState, type NewCampaignInput, type RollResult } from '@/lib/engine';

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
  imagePrompt: string;
};

export type CampaignGenesis = {
  narrative: string;
  premise: string;
  conflict: string;
  origin: string;
  profession: string;
  birthRegion: string;
  questTitle: string;
  questDescription: string;
  npcName: string;
  npcRole: string;
  npcPersonality: string;
  npcGoal: string;
  factionName: string;
};

type ChatCompletionJson = { choices?: Array<{ message?: { content?: string } }> };

const baseRules = `Você é o Mestre do INFINITA, um RPG de liberdade textual e fantasia medieval acolhedora com momentos épicos.
A Engine é a única autoridade. Você não altera XP, HP, mana, moedas, atributos, inventário, reputação, missões ou resultados de dados.
Nunca controle o protagonista, nunca ofereça opções A/B/C, nunca resolva o problema pelo jogador e nunca contradiga o estado.
Narre consequências concretas em 2 a 4 frases curtas, com diálogo quando couber. Termine com "O que você faz?".
Peça d20 apenas quando houver risco, incerteza e consequência real. Uma falha sempre continua a história.
Responda somente JSON válido, sem markdown.`;

async function requestJson<T>(system: string, user: string): Promise<T | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 700,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!response.ok) throw new Error(`Groq ${response.status}: ${(await response.text()).slice(0, 240)}`);
  const payload = await response.json() as ChatCompletionJson;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('A IA retornou uma resposta vazia.');
  return JSON.parse(content) as T;
}

function fallbackReply(state: GameState, fallbackNarrative: string): GameMasterReply {
  return {
    narrative: fallbackNarrative,
    requiresDice: Boolean(state.session.pendingRoll), diceType: 'd20', difficulty: state.session.pendingRoll?.difficulty || null,
    skill: state.session.pendingRoll?.skill || null, attribute: state.session.pendingRoll?.attribute || null,
    reason: state.session.pendingRoll?.reason || null, npcActions: [], worldSuggestions: [], memoryUpdate: [],
    memorySummary: state.campaign.memory.summary, imagePrompt: '',
  };
}

export async function narrateTurn(state: GameState, action: string, fallbackNarrative: string, rollResult?: RollResult): Promise<{ reply: GameMasterReply; mode: 'ai' | 'fallback'; error?: string }> {
  const context = buildAiContext(state);
  const contract = `Retorne exatamente estas chaves: {"narrative":string,"requiresDice":boolean,"diceType":"d20","difficulty":number|null,"skill":string|null,"attribute":string|null,"reason":string|null,"npcActions":string[],"worldSuggestions":string[],"memoryUpdate":string[],"memorySummary":string,"imagePrompt":string}.
Se a Engine já criou pendingRoll, preserve seus dados. Se há rollResult, narre o sucesso ou a falha e não peça o mesmo teste novamente.
memorySummary deve ter no máximo 700 caracteres e preservar somente fatos duradouros. imagePrompt deve descrever a cena como pixel art 16-bit GBA, nunca realista.`;
  try {
    const reply = await requestJson<GameMasterReply>(`${baseRules}\n${contract}`, JSON.stringify({ context, playerAction: action, rollResult: rollResult || null }));
    if (!reply) return { reply: fallbackReply(state, fallbackNarrative), mode: 'fallback', error: 'GROQ_API_KEY não configurada.' };
    return { reply, mode: 'ai' };
  } catch (error) {
    console.error('INFINITA Game Master failed', error);
    return { reply: fallbackReply(state, fallbackNarrative), mode: 'fallback', error: error instanceof Error ? error.message : 'Falha no provedor de IA.' };
  }
}

export async function generateCampaign(input: NewCampaignInput, state: GameState): Promise<{ genesis: CampaignGenesis | null; mode: 'ai' | 'fallback'; error?: string }> {
  const contract = `Crie o início de uma campanha única, coerente com a classe livre escolhida. Norwich é apenas o ponto técnico inicial e não deve ser um roteiro obrigatório.
Retorne exatamente: {"narrative":string,"premise":string,"conflict":string,"origin":string,"profession":string,"birthRegion":string,"questTitle":string,"questDescription":string,"npcName":string,"npcRole":string,"npcPersonality":string,"npcGoal":string,"factionName":string}.
A narrativa deve ter 2 a 4 frases e terminar com "O que você faz?". Não conceda itens, XP, dinheiro ou atributos.`;
  try {
    const genesis = await requestJson<CampaignGenesis>(`${baseRules}\n${contract}`, JSON.stringify({ input, universalRules: { startingCity: 'Norwich', initialLevel: 1 }, deterministicState: buildAiContext(state) }));
    return genesis ? { genesis, mode: 'ai' } : { genesis: null, mode: 'fallback', error: 'GROQ_API_KEY não configurada.' };
  } catch (error) {
    console.error('INFINITA campaign generation failed', error);
    return { genesis: null, mode: 'fallback', error: error instanceof Error ? error.message : 'Falha ao gerar campanha.' };
  }
}
