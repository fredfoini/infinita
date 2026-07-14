import { NextResponse } from 'next/server';
import { generateVisualAsset, imageProviderStatus } from '@/lib/visual/image-provider';
import { normalizeDescriptor } from '@/lib/visual/scene-descriptor';
import type { SceneVisualDescriptor } from '@/lib/visual/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() { return NextResponse.json(imageProviderStatus()); }

export async function POST(request: Request) {
  try {
    const descriptor = normalizeDescriptor(await request.json() as SceneVisualDescriptor);
    const result = await generateVisualAsset(descriptor);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no provedor visual.';
    const disabled = message === 'IMAGE_PROVIDER_DISABLED';
    const quota = /429|quota|credit|billing|balance/i.test(message);
    console.error('INFINITA visual generation failed', message);
    return NextResponse.json({ error: disabled ? 'Geração visual não configurada; usando banco local.' : 'O banco visual continuará usando o melhor fallback disponível.', providerUnavailable: disabled || quota, retryAfterSeconds: quota ? 3600 : 900 }, { status: disabled ? 503 : 502 });
  }
}
