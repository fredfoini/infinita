import type { BuildingBlueprint, RectLayer, SceneBlueprint } from '@/lib/graphics/types';

const rect = (x: number, y: number, width: number, height: number, color: string): RectLayer => ({ x, y, width, height, color });

export function composeBuildings(scene: SceneBlueprint): BuildingBlueprint {
  const p = scene.palette;
  const layers: RectLayer[] = [rect(0, 0, 320, 180, p.sky), rect(0, 104, 320, 76, p.ground)];
  if (scene.kind === 'interior') {
    for (let x = 0; x < 320; x += 32) layers.push(rect(x, 0, 5, 126, p.shadow));
    layers.push(rect(198, 87, 122, 44, '#503227'), rect(205, 93, 108, 7, p.accent), rect(18, 34, 46, 45, '#55372e'), rect(25, 42, 32, 29, '#f0b15c'));
  } else if (scene.kind === 'forest') {
    for (let i = 0; i < scene.density + 3; i++) { const x = (i * 43 + scene.seed % 27) % 320; layers.push(rect(x, 17 + i % 3 * 7, 13, 119, p.shadow), rect(x - 13, 8 + i % 4 * 6, 40, 42, i % 2 ? '#2d6048' : '#24533f')); }
    layers.push(rect(108, 107, 104, 73, '#b58c55'));
  } else if (scene.kind === 'river') {
    for (let y = 72; y < 180; y += 14) for (let x = y % 38; x < 320; x += 52) layers.push(rect(x, y, 26, 3, p.accent));
    layers.push(rect(0, 121, 84, 59, '#51764d'), rect(244, 118, 76, 62, '#51764d'), rect(84, 108, 161, 14, '#755039'));
  } else if (scene.kind === 'ruin') {
    for (let i = 0; i < 6; i++) { const x = 12 + i * 54; layers.push(rect(x, 44 + i % 2 * 14, 32, 78, p.shadow), rect(x + 6, 32 + i % 2 * 14, 20, 17, '#797486')); }
    layers.push(rect(118, 113, 84, 67, '#887967'), rect(148, 81, 24, 32, '#382f45'));
  } else if (scene.kind === 'road') {
    layers.push(rect(122, 92, 76, 88, '#d2b078'), rect(0, 109, 99, 71, '#587453'), rect(220, 109, 100, 71, '#587453'));
  }
  return { layers };
}
