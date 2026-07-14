import { NextResponse } from 'next/server';
import { generateVisualAsset, imageProviderStatus } from '@/lib/visual/image-provider';
import { normalizeDescriptor } from '@/lib/visual/scene-descriptor';
import type { SceneVisualDescriptor } from '@/lib/visual/types';
import { ensureGlobalRootAsset, getGlobalVisualAsset, globalVisualRegistryStatus, registerGlobalVisualAsset } from '@/lib/visual/global-visual-registry';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() { return NextResponse.json(imageProviderStatus()); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as SceneVisualDescriptor | { descriptor: SceneVisualDescriptor; parentAssetId?: string; localOnly?: boolean };
    const descriptor = normalizeDescriptor('descriptor' in body ? body.descriptor : body);
    const localOnly = 'descriptor' in body && Boolean(body.localOnly);
    let parent = null;
    if (globalVisualRegistryStatus().enabled) parent = 'descriptor' in body && body.parentAssetId ? await getGlobalVisualAsset(body.parentAssetId) : await ensureGlobalRootAsset('scene');
    const result = await generateVisualAsset(descriptor, { assetKind: 'scene', semanticKey: `scene:${descriptor.genre}:${descriptor.locationType}:${descriptor.environmentTags.join(':')}`, playerPrompt: descriptor.playerPromptInfluence, parentAsset: parent });
    const asset = !localOnly && globalVisualRegistryStatus().enabled ? await registerGlobalVisualAsset(result.asset) : { ...result.asset, global: false };
    return NextResponse.json({ ...result, asset, localOnly });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no provedor visual.';
    const disabled = message === 'IMAGE_PROVIDER_DISABLED';
    const quota = /429|quota|credit|billing|balance/i.test(message);
    console.error('INFINITA visual generation failed', message);
    return NextResponse.json({ error: disabled ? 'Geração visual não configurada; usando banco local.' : 'O banco visual continuará usando o melhor fallback disponível.', providerUnavailable: disabled || quota, retryAfterSeconds: quota ? 3600 : 900 }, { status: disabled ? 503 : 502 });
  }
}
