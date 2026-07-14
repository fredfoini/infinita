import { NextResponse } from 'next/server';
import { acceptNarrative, acceptSuggestedRoll, applyNarrativeWorldDelta, beginAction, buyProduct, migrateState, resolvePendingRoll, spendAttributePoint, useInventoryItem, type AttributeKey } from '@/lib/engine';
import { narrateTurn } from '@/lib/game-master';

export const runtime = 'nodejs';

type Payload = { kind?: 'action' | 'roll' | 'attribute' | 'useItem' | 'buyItem'; action?: string; attribute?: string; itemId?: string; shopId?: string; productId?: string; state?: unknown };

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const state = migrateState(payload.state);
    if (!state) return NextResponse.json({ error: 'Estado de campanha inválido.' }, { status: 400 });

    if (payload.kind === 'attribute') {
      const result = spendAttributePoint(state, payload.attribute as AttributeKey);
      return NextResponse.json({ state: result.state, narrative: result.state.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'useItem') {
      const result = useInventoryItem(state, payload.itemId || '');
      const next = acceptNarrative(result.state, result.narrative);
      return NextResponse.json({ state: next, narrative: next.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'buyItem') {
      const result = buyProduct(state, payload.shopId || '', payload.productId || '');
      const next = acceptNarrative(result.state, result.narrative);
      return NextResponse.json({ state: next, narrative: next.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'roll') {
      const action = state.session.pendingRoll?.action;
      if (!action) return NextResponse.json({ error: 'Não há rolagem pendente.' }, { status: 409 });
      const resolved = resolvePendingRoll(state);
      const narration = await narrateTurn(resolved.state, action, resolved.fallbackNarrative, resolved.result);
      const evolved = applyNarrativeWorldDelta(resolved.state, narration.reply.worldDelta);
      const next = acceptNarrative(evolved, narration.reply.narrative, narration.reply.memorySummary, narration.reply.memoryUpdate, narration.reply.worldDelta);
      return NextResponse.json({ state: next, narrative: next.session.narrative, requiresDice: false, roll: null, rollResult: resolved.result, events: resolved.events, mode: narration.mode, warning: narration.error });
    }

    const action = payload.action?.trim();
    if (!action) return NextResponse.json({ error: 'Descreva uma ação.' }, { status: 400 });
    const turn = beginAction(state, action);
    const narration = await narrateTurn(turn.state, action, turn.fallbackNarrative);
    let next = turn.state;
    if (!next.session.pendingRoll && narration.reply.requiresDice) {
      next = acceptSuggestedRoll(next, action, { skill: narration.reply.skill, attribute: narration.reply.attribute, difficulty: narration.reply.difficulty, reason: narration.reply.reason });
    }
    next = applyNarrativeWorldDelta(next, narration.reply.worldDelta);
    next = acceptNarrative(next, narration.reply.narrative, narration.reply.memorySummary, narration.reply.memoryUpdate, narration.reply.worldDelta);
    return NextResponse.json({ state: next, narrative: next.session.narrative, requiresDice: Boolean(next.session.pendingRoll), roll: next.session.pendingRoll, rollResult: null, events: turn.events, mode: narration.mode, warning: narration.error });
  } catch (error) {
    console.error('INFINITA turn failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível processar o turno.' }, { status: 500 });
  }
}
