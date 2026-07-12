import { NextResponse } from 'next/server';
import { advanceDemo, type Event, type GameState } from '@/lib/engine';

type AiTurn = { narrative?: string; needsRoll?: boolean; rollSkill?: string; rollDifficulty?: number; location?: string; locationChanged?: boolean; imagePrompt?: string; title?: { name: string; power: string }; moral?: { npc: string; delta: number }; events?: Event[] };
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
  // Scene images are display assets, not campaign memory. A base64 image can be hundreds of thousands of tokens.
  const { sceneImage: _sceneImage, ...safeState } = state;
  const success = roll ? roll.total >= roll.difficulty : false;
  const base = roll ? {
    narrative: `${success ? 'O teste é bem-sucedido.' : 'O teste falha.'} A consequência ainda está se revelando.`, needsRoll: false, rollSkill: null, rollDifficulty: null,
    scene: safeState.location, locationChanged: false, events: safeState.events, state: safeState
  } : advanceDemo(safeState, action); const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ...base, mode: 'demo', aiError: 'OPENAI_API_KEY não configurada.' });
  try {
    const prompt = `Você é o Mestre de Jogo oficial de INFINITA. Você simula um mundo vivo, não escreve um roteiro: aceite liberdade total, não ofereça escolhas fechadas, NPCs só sabem o que poderiam saber e consequências devem ser coerentes. Responda APENAS JSON válido. Narração em português, 2-4 frases curtas, diálogo quando couber e termine exatamente em "O que você faz?". Peça teste somente com risco, incerteza e consequência relevante. Retorne: {"narrative":string,"needsRoll":boolean,"rollSkill":string|null,"rollDifficulty":number|null,"location":string,"locationChanged":boolean,"imagePrompt":string,"title":{"name":string,"power":string}|null,"moral":{"npc":string,"delta":number}|null,"events":[{"kind":"xp|skill|title|moral|level|roll","text":string,"amount":number|null}]}. imagePrompt é obrigatório e deve estar em INGLÊS: descreva somente a cena visual atual em primeira pessoa, com enquadramento, objetos no primeiro plano, figuras/NPCs, arquitetura, clima e luz. Não inclua estilo, UI, texto, logo ou instruções negativas. Gere título e poder somente para conquista marcante. Reputação é percepção social, não bem/mal. Estado atual: ${JSON.stringify(safeState)}. Ação: ${action}.${roll ? ` RESULTADO DEFINITIVO DO TESTE: ${roll.skill}, dado ${roll.die} + bônus ${roll.bonus} = ${roll.total}, CD ${roll.difficulty}; ${success ? 'SUCESSO' : 'FALHA'}. Narre a consequência direta e dê continuidade. Não peça outra rolagem, salvo um risco novo e independente.` : ''}`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }] }) });
    if (!response.ok) throw new Error(await response.text());
    const ai = JSON.parse((await response.json()).choices[0].message.content) as AiTurn;
    const next = { ...base.state, location: ai.location || base.state.location, events: [...base.events, ...(ai.events || [])] };
    if (ai.title?.name && !next.titles.includes(ai.title.name)) { next.titles = [...next.titles, ai.title.name]; next.events.push({ kind: 'title', text: `Novo título: ${ai.title.name}. Poder: ${ai.title.power}` }); }
    if (ai.moral?.npc) { next.reputation = { ...next.reputation, local: next.reputation.local + ai.moral.delta, npcs: { ...next.reputation.npcs, [ai.moral.npc]: (next.reputation.npcs[ai.moral.npc] || 0) + ai.moral.delta } }; next.events.push({ kind: 'moral', text: `Moral com ${ai.moral.npc}: ${ai.moral.delta > 0 ? '+' : ''}${ai.moral.delta}.` }); }
    const locationChanged = Boolean(ai.locationChanged || next.location !== safeState.location); let sceneImage: string | undefined;
    if (locationChanged && process.env.ENABLE_IMAGE_GENERATION === 'true') { try { sceneImage = await generateScene(apiKey, `Create a handcrafted 2D sprite-art scene for a Game Boy Advance-era fantasy RPG. Camera is strictly FIRST PERSON, at human eye level, looking through the player character's eyes from behind environmental cover. ${ai.imagePrompt || `Wide view of ${next.location}, with a clear foreground prop and a readable destination ahead.`} Always use a WIDE ESTABLISHING SHOT: foreground scenery at the edges, an open navigable space in the center, and the destination in the distance. Any people must be small full-body 16-to-32-pixel sprites, never close-up portraits; no face, hands, bartender, counter, or single NPC may occupy more than one quarter of the frame. Use authentic low-resolution pixel-art construction: deliberately blocky 2x/4x pixel clusters, clean 1-pixel outlines, selective dithering, limited warm GBA-style palette, tile-based architecture, crisp sprite silhouettes, detailed but readable 32-bit handheld game composition. The frame must look like an original 2000s portable RPG screenshot, not an AI-filtered illustration. Never use photorealism, photography, oil paint, 3D rendering, smooth gradients, blur, soft airbrush, modern concept art, text, captions, HUD, logo, watermark, borders, or a visible player character.`); } catch (error) { console.error('INFINITA image generation failed', error); } }
    return NextResponse.json({ ...base, narrative: ai.narrative || base.narrative, needsRoll: ai.needsRoll ?? base.needsRoll, rollSkill: ai.rollSkill || base.rollSkill, rollDifficulty: ai.rollDifficulty || base.rollDifficulty, scene: next.location, locationChanged, state: { ...next, sceneImage }, mode: 'ai' });
  } catch (error) { console.error('INFINITA text generation failed', error); return NextResponse.json({ ...base, mode: 'demo', aiError: error instanceof Error ? error.message.slice(0, 220) : 'Falha ao chamar a IA.' }); }
}
