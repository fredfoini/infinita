import { NextResponse } from 'next/server';
import { acceptNarrative, acceptSuggestedRoll, applyNarrativeWorldDelta, beginAction, buyProduct, consumeInventoryItem, migrateState, performItemAction, performSpellCast, resolvePendingRoll, spendAttributePoint, type AttributeKey } from '@/lib/engine';
import { narrateTurn } from '@/lib/game-master';
import { ProviderFactory } from '@/lib/providers/provider-factory';
import type { ItemAction } from '@/lib/items/item-engine';
import { applyCampaignSharingDecision } from '@/lib/content-sharing-policy';

export const runtime = 'nodejs';

type Payload = { kind?: 'action' | 'roll' | 'attribute' | 'useItem' | 'buyItem' | 'itemAction' | 'castSpell'; requestId?: string; action?: string; attribute?: string; itemId?: string; spellId?: string; secondaryItemId?: string; targetNpcId?: string; itemOperation?: ItemAction; shopId?: string; productId?: string; state?: unknown };

function stableD20(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 20 + 1;
}

export async function GET() {
  return NextResponse.json({ ok: true, schemaVersion: 8, providers: ProviderFactory.diagnostics() });
}

export async function POST(request: Request) {
  const started = performance.now();
  const respond = (body: object, status = 200, detail = '') => NextResponse.json(body, { status, headers: { 'Server-Timing': `${detail}${detail ? ',' : ''}total;dur=${(performance.now() - started).toFixed(1)}` } });
  try {
    const payload = await request.json() as Payload;
    let state = migrateState(payload.state);
    if (!state) return respond({ error: 'Estado de campanha inválido.' }, 400);
    state = applyCampaignSharingDecision(state, payload.action || state.session.pendingRoll?.action || '');

    if (payload.kind === 'attribute') {
      const result = spendAttributePoint(state, payload.attribute as AttributeKey);
      return respond({ state: result.state, narrative: result.state.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'useItem') {
      const result = consumeInventoryItem(state, payload.itemId || '');
      const next = acceptNarrative(result.state, result.narrative);
      return respond({ state: next, narrative: next.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'itemAction') {
      if (!payload.itemOperation) return respond({ error: 'Ação de item inválida.' }, 400);
      const result = performItemAction(state, { action: payload.itemOperation, itemId: payload.itemId || '', secondaryItemId: payload.secondaryItemId, targetNpcId: payload.targetNpcId });
      const next = acceptNarrative(result.state, result.narrative);
      return respond({ state: next, narrative: next.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'buyItem') {
      const result = buyProduct(state, payload.shopId || '', payload.productId || '');
      const next = acceptNarrative(result.state, result.narrative);
      return respond({ state: next, narrative: next.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'castSpell') {
      const result = performSpellCast(state, payload.spellId || '');
      const next = acceptNarrative(result.state, result.narrative);
      return respond({ state: next, narrative: next.session.narrative, requiresDice: false, events: result.events, mode: 'engine' });
    }

    if (payload.kind === 'roll') {
      const action = state.session.pendingRoll?.action;
      const rollId = state.session.pendingRoll?.id;
      if (!action) return respond({ error: 'Não há rolagem pendente.' }, 409);
      const engineStarted = performance.now();
      const resolved = resolvePendingRoll(state, stableD20(rollId || `${state.campaignId}:${state.session.turn}:${action}`));
      const engineMs = performance.now() - engineStarted;
      const llmStarted = performance.now();
      const narration = await narrateTurn(resolved.state, action, resolved.fallbackNarrative, resolved.result);
      const llmMs = performance.now() - llmStarted;
      if (narration.mode !== 'ai') {
        return respond({
          error: 'A IA não conseguiu narrar a consequência deste D20. A rolagem continua pendente e o mesmo resultado será preservado ao tentar novamente.',
          retryable: true,
          rollPending: true,
        }, 503, `engine;dur=${engineMs.toFixed(1)},llm;dur=${llmMs.toFixed(1)}`);
      }
      const evolved = applyNarrativeWorldDelta(resolved.state, narration.reply.worldDelta, narration.reply.narrative, true);
      const next = acceptNarrative(evolved, narration.reply.narrative, narration.reply.memorySummary, narration.reply.memoryUpdate, narration.reply.worldDelta);
      return respond({ state: next, narrative: next.session.narrative, requiresDice: false, roll: null, rollResult: resolved.result, events: resolved.events, mode: narration.mode, warning: narration.error }, 200, `engine;dur=${engineMs.toFixed(1)},llm;dur=${llmMs.toFixed(1)}`);
    }

    const action = payload.action?.trim();
    if (!action) return respond({ error: 'Descreva uma ação.' }, 400);
    const engineStarted = performance.now();
    const turn = beginAction(state, action, payload.requestId);
    const engineMs = performance.now() - engineStarted;
    const llmStarted = performance.now();
    const narration = await narrateTurn(turn.state, action, turn.fallbackNarrative);
    const llmMs = performance.now() - llmStarted;
    let next = turn.state;
    if (!next.session.pendingRoll && narration.reply.requiresDice) {
      next = acceptSuggestedRoll(next, action, { skill: narration.reply.skill, attribute: narration.reply.attribute, difficulty: narration.reply.difficulty, reason: narration.reply.reason, interpretation: narration.reply.actionInterpretation });
    }
    next = applyNarrativeWorldDelta(next, narration.reply.worldDelta, narration.reply.narrative, true);
    next = acceptNarrative(next, narration.reply.narrative, narration.reply.memorySummary, narration.reply.memoryUpdate, narration.reply.worldDelta);
    return respond({ state: next, narrative: next.session.narrative, requiresDice: Boolean(next.session.pendingRoll), roll: next.session.pendingRoll, rollResult: null, events: turn.events, mode: narration.mode, warning: narration.error }, 200, `engine;dur=${engineMs.toFixed(1)},llm;dur=${llmMs.toFixed(1)}`);
  } catch (error) {
    console.error('INFINITA turn failed', error);
    return respond({ error: error instanceof Error ? error.message : 'Não foi possível processar o turno.' }, 500);
  }
}
