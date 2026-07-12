import { NextResponse } from 'next/server';
import { advanceDemo, initialState, type GameState } from '@/lib/engine';

export async function POST(request: Request) {
  const { action, state } = await request.json() as { action?: string; state?: GameState };
  if (!action?.trim()) return NextResponse.json({ error: 'Descreva uma ação.' }, { status: 400 });
  const current = state ?? initialState();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json(advanceDemo(current, action));

  const prompt = `Você é o Mestre de Jogo da INFINITA. Responda em português, com 2-4 frases curtas, diálogo quando couber e termine exatamente com "O que você faz?". Nunca ofereça lista de opções. Só peça rolagem se houver risco real. Retorne APENAS JSON válido: {"narrative":string,"needsRoll":boolean,"rollDifficulty":number|null,"scene":string,"statePatch":{"hp":number,"xp":number,"gold":number,"location":string,"day":number,"hour":number,"inventory":string[],"log":string[]}}. Estado: ${JSON.stringify(current)}. Ação do jogador: ${action}`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }] })
    });
    if (!response.ok) throw new Error('OpenAI indisponível');
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({ ...result, state: { ...current, ...result.statePatch, log: [...current.log, ...(result.statePatch?.log || [])] } });
  } catch { return NextResponse.json(advanceDemo(current, action)); }
}
