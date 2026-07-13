export type SceneKind = 'settlement' | 'interior' | 'forest' | 'river' | 'ruin' | 'road';
export type RectLayer = { x: number; y: number; width: number; height: number; color: string };
export type AssetDefinition = { id: string; file: string; category: string; tags: string[]; size: { width: number; height: number }; layers: string[]; variants: number; animations: string[]; compatibility: string[]; pixelArt: boolean };
export type AssetBible = { version: number; visualStandard: { nativeScene: { width: number; height: number }; scaling: string }; assets: AssetDefinition[] };
export type SceneBlueprint = { kind: SceneKind; location: string; weather: string; hour: number; seed: number; backgroundAssetId?: string; palette: { sky: string; ground: string; shadow: string; accent: string }; density: number };
export type CharacterBlueprint = { npcIndices: number[]; playerSleeve: string; playerGlove: string; bobOffset: number };
export type BuildingBlueprint = { layers: RectLayer[] };
