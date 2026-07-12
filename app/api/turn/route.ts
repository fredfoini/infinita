import { NextResponse } from 'next/server';
import { advanceDemo, type Event, type GameState } from '@/lib/engine';

type AiTurn = { narrative?: string; needsRoll?: boolean; rollSkill?: string; rollDifficulty?: number; location?: string; locationChanged?: boolean; title?: { name: string; power: string }; moral?: { npc: string; delta: number }; events?: Event[] };
type RollResult = { skill: string; die: number; bonus: number; total: number; difficulty: number };

async function generateScene(apiKey: string, prompt: string) {
  const response = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size: '1024x1024', quality: 'low', n: 1, output_format: 'png' }) });
  if (!response.ok) throw new Error(`Imagem: ${await response.text()}`);
  const data = await response.json(); const image = data.data?.[0];
  return image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url;
}

export async function POST(request: Request) {
  const { action, state, roll } = await request.json() as { action?: string; state?: GameState; roll?: RollResult };
  if (!action?.trim() || !state) return NextResponse.json({ error: 'Descreva uma ação e informe a campanha.' }, { status: 400 });
  const success = roll ? roll.total >= roll.difficulty : false;
  const base = roll ? {
    narrative: `${success ? 'O teste é bem-sucedido.' : 'O teste falha.'} A consequência ainda está se revelando.`, needsRoll: false, rollSkill: null, rollDifficulty: null,
    scene: state.location, locationChanged: false, events: state.events, state
  } : advanceDemo(state, action); const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ...base, mode: 'demo', aiError: 'OPENAI_API_KEY não configurada.' });
  try {
    const prompt = `Você é o Mestre de Jogo de INFINITA, RPG narrativo persistente. Responda APENAS JSON válido. Narração em português, 2-4 frases curtas, com diálogo se couber e termine exatamente em "O que você faz?". Sem opções fixas. Avalie a ação e retorne: {"narrative":string,"needsRoll":boolean,"rollSkill":string|null,"rollDifficulty":number|null,"location":string,"locationChanged":boolean,"title":{"name":string,"power":string}|null,"moral":{"npc":string,"delta":number}|null,"events":[{"kind":"xp|skill|title|moral|level|roll","text":string,"amount":number|null}]}. Gere título e poder somente para uma conquista marcante; título curto, poético e ligado à ação. A reputação é percepção social, não bem/mal. Estado atual: ${JSON.stringify(state)}. Ação: ${action}.${roll ? ` RESULTADO DEFINITIVO DO TESTE: ${roll.skill}, dado ${roll.die} + bônus ${roll.bonus} = ${roll.total}, CD ${roll.difficulty}; ${success ? 'SUCESSO' : 'FALHA'}. Narre a consequência direta deste resultado e dê continuidade à cena. Não peça outra rolagem, a menos que surja um novo risco independente.` : ''}`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }] }) });
    if (!response.ok) throw new Error(await response.text());
    const ai = JSON.parse((await response.json()).choices[0].message.content) as AiTurn;
    const next = { ...base.state, location: ai.location || base.state.location, events: [...base.events, ...(ai.events || [])] };
    if (ai.title?.name && !next.titles.includes(ai.title.name)) { next.titles = [...next.titles, ai.title.name]; next.events.push({ kind: 'title', text: `Novo título: ${ai.title.name}. Poder: ${ai.title.power}` }); }
    if (ai.moral?.npc) { next.reputation = { ...next.reputation, local: next.reputation.local + ai.moral.delta, npcs: { ...next.reputation.npcs, [ai.moral.npc]: (next.reputation.npcs[ai.moral.npc] || 0) + ai.moral.delta } }; next.events.push({ kind: 'moral', text: `Moral com ${ai.moral.npc}: ${ai.moral.delta > 0 ? '+' : ''}${ai.moral.delta}.` }); }
    const locationChanged = Boolean(ai.locationChanged || next.location !== state.location); let sceneImage: string | undefined;
    if (locationChanged && process.env.ENABLE_IMAGE_GENERATION === 'true') { try { sceneImage = await generateScene(apiKey, `Pixel art, 16-bit dark fantasy RPG, first-person scene in ${next.location}, ${state.className} adventurer implied but not visible, dramatic light, no text, game background.`); } catch (error) { console.error('INFINITA image generation failed', error); } }
    return NextResponse.json({ ...base, narrative: ai.narrative || base.narrative, needsRoll: ai.needsRoll ?? base.needsRoll, rollSkill: ai.rollSkill || base.rollSkill, rollDifficulty: ai.rollDifficulty || base.rollDifficulty, scene: next.location, locationChanged, state: { ...next, sceneImage }, mode: 'ai' });
  } catch (error) { console.error('INFINITA text generation failed', error); return NextResponse.json({ ...base, mode: 'demo', aiError: error instanceof Error ? error.message.slice(0, 220) : 'Falha ao chamar a IA.' }); }
}
