import { NextResponse } from 'next/server';
import { advanceDemo, type GameState } from '@/lib/engine';

type Roll = { skill: string; die: number; bonus: number; total: number; difficulty: number };

export async function POST(request: Request) {
  const { action, state, roll } = await request.json() as { action?: string; state?: GameState; roll?: Roll };
  if (!action?.trim() || !state) return NextResponse.json({ error: 'Descreva uma ação.' }, { status: 400 });
  const { sceneImage: _ignored, ...cleanState } = state;
  if (roll) {
    const success = roll.total >= roll.difficulty;
    const consequence = success
      ? `O teste de ${roll.skill} abre uma oportunidade. O ambiente reage e alguém percebe o que você fez. O que você faz?`
      : `O teste de ${roll.skill} falha, mas não encerra sua história. Uma complicação toma forma e exige uma nova decisão. O que você faz?`;
    return NextResponse.json({ narrative: consequence, needsRoll: false, rollSkill: null, rollDifficulty: null, scene: cleanState.location, locationChanged: false, mode: 'procedural', state: cleanState });
  }
  const result = advanceDemo(cleanState, action);
  return NextResponse.json({ ...result, mode: 'procedural', state: { ...result.state, sceneImage: undefined } });
}
