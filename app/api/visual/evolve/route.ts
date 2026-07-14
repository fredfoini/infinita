import { NextResponse } from 'next/server';
import { generateVisualAsset } from '@/lib/visual/image-provider';
import { ensureGlobalRootAsset, findGlobalVisualAsset, getGlobalVisualAsset, globalVisualRegistryStatus, registerGlobalVisualAsset, reserveGlobalVisualGeneration } from '@/lib/visual/global-visual-registry';
import { normalizeDescriptor } from '@/lib/visual/scene-descriptor';
import type { SceneVisualDescriptor, VisualAssetKind } from '@/lib/visual/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const KINDS = new Set<VisualAssetKind>(['scene', 'item-icon', 'character-sheet', 'motion-sheet']);

function fallbackDescriptor(campaignId: string, kind: VisualAssetKind, playerPrompt: string): SceneVisualDescriptor {
  return normalizeDescriptor({ campaignId, sceneId: `${kind}-${Date.now()}`, genre: 'fantasia de aventura', primaryEmotion: 'descoberta', secondaryEmotions: [], intensity: 'medium', locationType: kind, environmentTags: ['pixel art'], actionType: 'criação', numberOfCharacters: kind.includes('character') || kind.includes('motion') ? 1 : 0, characterArchetypes: [], importantObjects: [], safetyClass: 'safe', visualSummary: playerPrompt, playerPromptInfluence: playerPrompt });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { kind?: VisualAssetKind; semanticKey?: string; campaignId?: string; playerPrompt?: string; parentAssetId?: string; descriptor?: SceneVisualDescriptor; characterVisualIdentity?: string; localOnly?: boolean };
    const kind = KINDS.has(body.kind as VisualAssetKind) ? body.kind as VisualAssetKind : 'scene';
    const semanticKey = String(body.semanticKey || '').trim().slice(0, 180);
    const campaignId = String(body.campaignId || body.descriptor?.campaignId || 'anonymous').slice(0, 80);
    const playerPrompt = String(body.playerPrompt || body.descriptor?.playerPromptInfluence || '').trim().slice(0, 1200);
    const localOnly = Boolean(body.localOnly);
    if (!semanticKey || !playerPrompt) return NextResponse.json({ error: 'semanticKey e playerPrompt são obrigatórios.' }, { status: 400 });
    if (localOnly) {
      const descriptor = normalizeDescriptor({ ...(body.descriptor || fallbackDescriptor(campaignId, kind, playerPrompt)), campaignId, playerPromptInfluence: playerPrompt, characterVisualIdentity: body.characterVisualIdentity || body.descriptor?.characterVisualIdentity });
      const result = await generateVisualAsset(descriptor, { assetKind: kind, semanticKey, playerPrompt });
      return NextResponse.json({ ...result, asset: { ...result.asset, global: false }, reused: false, localOnly: true });
    }
    if (!globalVisualRegistryStatus().enabled) return NextResponse.json({ error: 'Banco visual global ainda não configurado.', configurationRequired: true }, { status: 503 });
    const existing = await findGlobalVisualAsset(semanticKey); if (existing) return NextResponse.json({ asset: existing, reused: true });
    const reservation = await reserveGlobalVisualGeneration(campaignId, semanticKey);
    if (!reservation.allowed) return NextResponse.json({ error: reservation.reason, pending: reservation.reason === 'GENERATION_ALREADY_RUNNING' }, { status: 429 });
    const parent = body.parentAssetId ? await getGlobalVisualAsset(body.parentAssetId) : await ensureGlobalRootAsset(kind);
    const descriptor = normalizeDescriptor({ ...(body.descriptor || fallbackDescriptor(campaignId, kind, playerPrompt)), campaignId, playerPromptInfluence: playerPrompt, characterVisualIdentity: body.characterVisualIdentity || body.descriptor?.characterVisualIdentity });
    const result = await generateVisualAsset(descriptor, { assetKind: kind, semanticKey, playerPrompt, parentAsset: parent });
    const asset = await registerGlobalVisualAsset(result.asset);
    return NextResponse.json({ ...result, asset, reused: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na evolução visual.';
    const quota = /429|quota|credit|billing|balance/i.test(message);
    return NextResponse.json({ error: message, providerUnavailable: quota, retryAfterSeconds: quota ? 3600 : 900 }, { status: quota ? 429 : 502 });
  }
}
