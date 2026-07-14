import { NextResponse } from 'next/server';
import { findGlobalVisualAsset, getGlobalVisualAsset, globalVisualRegistryStatus, listGlobalVisualAssets, markGlobalVisualAssetReused } from '@/lib/visual/global-visual-registry';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.has('status')) return NextResponse.json(globalVisualRegistryStatus());
    const id = url.searchParams.get('id'); if (id) return NextResponse.json({ asset: await getGlobalVisualAsset(id) });
    const semanticKey = url.searchParams.get('semanticKey'); if (semanticKey) return NextResponse.json({ asset: await findGlobalVisualAsset(semanticKey) });
    return NextResponse.json({ assets: await listGlobalVisualAssets(Number(url.searchParams.get('limit')) || 180) });
  } catch (error) {
    return NextResponse.json({ assets: [], error: error instanceof Error ? error.message : 'Falha no banco visual global.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { reuseId?: string };
    if (!body.reuseId) return NextResponse.json({ error: 'reuseId obrigatório.' }, { status: 400 });
    return NextResponse.json({ asset: await markGlobalVisualAssetReused(body.reuseId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao registrar reutilização.' }, { status: 503 });
  }
}
