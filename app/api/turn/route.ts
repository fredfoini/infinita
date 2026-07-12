import { NextResponse } from 'next/server';
import { advanceDemo, type GameState } from '@/lib/engine';

type Roll = { skill: string; die: number; bonus: number; total: number; difficulty: number };
type AiTurn = { narrative?: string; needsRoll?: boolean; rollSkill?: string; rollDifficulty?: number; location?: string; locationChanged?: boolean };

export async function POST(request: Request) {
  const { action, state, roll } = await request.json() as { action?: string; state?: GameState; roll?: Roll };
  if (!action?.trim() || !state) return NextResponse.json({ error: 'Descreva uma ação.' }, { status: 400 });
  const { sceneImage: _ignored, ...cleanState } = state;
  const baseline = roll ? { narrative: '', needsRoll: false, rollSkill: null, rollDifficulty: null, scene: cleanState.location, locationChanged: false, state: cleanState } : advanceDemo(cleanState, action);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ ...baseline, mode: 'fallback', error: 'OPENAI_API_KEY não configurada.' });
  const rollContext = roll ? `Resultado do teste já realizado: ${roll.skill}, d20 ${roll.die} + ${roll.bonus} = ${roll.total}, CD ${roll.difficulty}. ${roll.total >= roll.difficulty ? 'SUCESSO' : 'FALHA'}. Narre a consequência concreta e continue a cena; não peça nova rolagem para o mesmo risco.` : '';
  const prompt = `Você é o Mestre de Jogo do RPG INFINITA. Simule um mundo vivo, coerente e persistente. Nunca ofereça opções fechadas. Responda somente JSON: {"narrative":string,"needsRoll":boolean,"rollSkill":string|null,"rollDifficulty":number|null,"location":string,"locationChanged":boolean}. Em português, escreva 2 a 4 frases curtas, com diálogo quando couber, e termine exatamente com "O que você faz?". Peça d20 somente quando há risco, incerteza e consequência. Não dê XP, itens ou títulos na narrativa: o motor calcula isso. Estado: ${JSON.stringify(cleanState)}. Ação: ${action}. ${rollContext}`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }] }) });
    if (!response.ok) throw new Error(await response.text());
    const ai = JSON.parse((await response.json()).choices[0].message.content) as AiTurn;
    const next = { ...baseline.state, location: ai.location || baseline.state.location };
    return NextResponse.json({ ...baseline, narrative: ai.narrative || baseline.narrative, needsRoll: ai.needsRoll ?? baseline.needsRoll, rollSkill: ai.rollSkill || baseline.rollSkill, rollDifficulty: ai.rollDifficulty || baseline.rollDifficulty, scene: next.location, locationChanged: ai.locationChanged ?? baseline.locationChanged, state: next, mode: 'ai' });
  } catch (error) {
    console.error('INFINITA AI failed', error);
    return NextResponse.json({ ...baseline, mode: 'fallback', error: error instanceof Error ? error.message.slice(0, 180) : 'Falha na IA.' });
  }
}
