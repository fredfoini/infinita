import { NextResponse } from 'next/server';
import { applyGenesis, createInitialState, type NewCampaignInput } from '@/lib/engine';
import { generateCampaign } from '@/lib/game-master';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<NewCampaignInput>;
    const input: NewCampaignInput = {
      campaignName: body.campaignName?.trim().slice(0, 80) || '',
      characterName: body.characterName?.trim().slice(0, 60) || '',
      className: body.className?.trim().slice(0, 80) || '',
      openingPrompt: body.openingPrompt?.trim().slice(0, 700) || '',
    };
    if (!input.campaignName || !input.characterName || !input.className || !input.openingPrompt) return NextResponse.json({ error: 'Preencha campanha, personagem, classe e como a história começa.' }, { status: 400 });
    let state = createInitialState(input);
    const generation = await generateCampaign(input, state);
    if (generation.genesis) state = applyGenesis(state, generation.genesis);
    return NextResponse.json({ state, mode: generation.mode, warning: generation.error });
  } catch (error) {
    console.error('INFINITA campaign creation failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível criar a campanha.' }, { status: 500 });
  }
}
