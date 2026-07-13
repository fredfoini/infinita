import type { AssetBible, AssetDefinition } from '@/lib/graphics/types';

let cached: Promise<AssetBible> | null = null;

export function loadAssetRegistry(): Promise<AssetBible> {
  if (!cached) cached = fetch('/assets/sprite_bible.json').then(response => {
    if (!response.ok) throw new Error('Asset Registry indisponível.');
    return response.json() as Promise<AssetBible>;
  });
  return cached;
}

export function findAsset(registry: AssetBible, id: string): AssetDefinition | undefined {
  return registry.assets.find(asset => asset.id === id);
}

export function compatibleAssets(registry: AssetBible, category: string, tags: string[] = []) {
  return registry.assets.filter(asset => asset.category === category && tags.every(tag => asset.tags.includes(tag)));
}
