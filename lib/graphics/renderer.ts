import type { AssetBible, BuildingBlueprint, CharacterBlueprint, SceneBlueprint } from '@/lib/graphics/types';
import { findAsset } from '@/lib/graphics/asset-registry';

export type RenderAssets = { registry: AssetBible; images: Record<string, HTMLImageElement> };

export async function preloadSceneAssets(registry: AssetBible, scene: SceneBlueprint): Promise<RenderAssets> {
  const ids = ['characters.npc.atlas.transparent', ...(scene.backgroundAssetId ? [scene.backgroundAssetId] : [])];
  const images: Record<string, HTMLImageElement> = {};
  await Promise.all(ids.map(async id => {
    const definition = findAsset(registry, id);
    if (!definition) return;
    const image = new Image(); image.src = definition.file; await image.decode(); images[id] = image;
  }));
  return { registry, images };
}

function drawNpc(context: CanvasRenderingContext2D, atlas: HTMLImageElement | undefined, index: number, x: number, y: number, flip = false) {
  if (!atlas) return;
  const sx = (index % 8) * 192; const sy = Math.floor(index / 8) * 256;
  context.save(); if (flip) { context.translate(x + 38, y); context.scale(-1, 1); context.drawImage(atlas, sx, sy, 192, 256, 0, 0, 38, 51); } else context.drawImage(atlas, sx, sy, 192, 256, x, y, 38, 51); context.restore();
}

export function renderScene(context: CanvasRenderingContext2D, scene: SceneBlueprint, buildings: BuildingBlueprint, characters: CharacterBlueprint, assets: RenderAssets, frame: number) {
  context.imageSmoothingEnabled = false; context.clearRect(0, 0, 320, 180);
  const background = scene.backgroundAssetId ? assets.images[scene.backgroundAssetId] : undefined;
  if (background) context.drawImage(background, 0, 0, background.naturalWidth, background.naturalHeight, 0, 0, 320, 180);
  else for (const layer of buildings.layers) { context.fillStyle = layer.color; context.fillRect(layer.x, layer.y, layer.width, layer.height); }
  const atlas = assets.images['characters.npc.atlas.transparent'];
  drawNpc(context, atlas, characters.npcIndices[0], 78, 104 + characters.bobOffset);
  drawNpc(context, atlas, characters.npcIndices[1], 190, 101 + (1 - characters.bobOffset), true);
  if (scene.kind === 'interior') drawNpc(context, atlas, characters.npcIndices[2], 252, 93 + characters.bobOffset);
  context.fillStyle = characters.playerSleeve; context.fillRect(121, 161, 28, 19); context.fillRect(171, 161, 28, 19);
  context.fillStyle = characters.playerGlove; context.fillRect(129, 159, 13, 7); context.fillRect(178, 159, 13, 7);
  context.fillStyle = '#624331'; context.fillRect(151, 145, 18, 35);
  if (scene.hour < 6 || scene.hour >= 19) { context.fillStyle = '#111b4075'; context.fillRect(0, 0, 320, 180); }
  if (/chuva|tempestade/i.test(scene.weather)) { context.strokeStyle = '#d8edf0aa'; for (let i = 0; i < 34; i++) { const x = (i * 47 + frame * 7 + scene.seed) % 340 - 10; const y = (i * 29 + frame * 12) % 180; context.beginPath(); context.moveTo(x, y); context.lineTo(x - 4, y + 9); context.stroke(); } }
  if (/neblina|névoa/i.test(scene.weather)) { context.fillStyle = '#eff5f14d'; context.fillRect(0, 72, 320, 70); }
}
