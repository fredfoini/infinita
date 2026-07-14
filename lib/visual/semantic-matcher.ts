import type { SceneVisualDescriptor, VisualAsset, VisualMatch } from '@/lib/visual/types';

const overlap = (left: string[], right: string[]) => {
  const a = new Set(left.map(value => value.toLowerCase())); const b = new Set(right.map(value => value.toLowerCase()));
  if (!a.size || !b.size) return 0;
  return Array.from(a).filter(value => b.has(value)).length / Math.max(a.size, b.size);
};
const exact = (a: string, b: string) => a.toLowerCase() === b.toLowerCase() ? 1 : 0;

export function scoreVisualAsset(scene: SceneVisualDescriptor, asset: VisualAsset, sessionAssetIds: string[] = []): VisualMatch {
  if (!asset.safeForReuse || asset.moderationStatus === 'rejected') return { asset: null, confidence: 0 };
  const emotionMatch = Math.max(exact(scene.primaryEmotion, asset.primaryEmotion), overlap([scene.primaryEmotion, ...scene.secondaryEmotions], [asset.primaryEmotion, ...asset.secondaryEmotions]) * .85);
  const genreMatch = overlap([scene.genre], asset.genreTags);
  const actionMatch = overlap([scene.actionType], asset.actionTags);
  const locationMatch = overlap([scene.locationType], asset.locationTags);
  const environmentMatch = overlap(scene.environmentTags, asset.environmentTags);
  const intensityMatch = exact(scene.intensity, asset.intensity);
  const expectedCharacters = asset.sceneDescriptorSnapshot.numberOfCharacters || 0;
  const characterCountMatch = 1 - Math.min(1, Math.abs(scene.numberOfCharacters - expectedCharacters) / 5);
  const recencyDiversityBonus = sessionAssetIds.includes(asset.id) ? 0 : 1;
  const scoreBreakdown = { emotionMatch, genreMatch, actionMatch, locationMatch, environmentMatch, intensityMatch, characterCountMatch, recencyDiversityBonus };
  let confidence = .35 * emotionMatch + .20 * genreMatch + .15 * actionMatch + .10 * locationMatch + .08 * environmentMatch + .05 * intensityMatch + .04 * characterCountMatch + .03 * recencyDiversityBonus;
  if (sessionAssetIds.includes(asset.id)) confidence -= .12;
  confidence *= Math.max(.6, Math.min(1, asset.qualityScore || .75));
  return { asset, confidence: Math.max(0, Math.min(1, confidence)), scoreBreakdown };
}

export function findBestVisualAsset(scene: SceneVisualDescriptor, assets: VisualAsset[], sessionAssetIds: string[] = []): VisualMatch {
  return assets.map(asset => scoreVisualAsset(scene, asset, sessionAssetIds)).filter(match => match.asset).sort((a, b) => b.confidence - a.confidence)[0] || { asset: null, confidence: 0 };
}

export const SemanticImageMatcher = { score: scoreVisualAsset, findBest: findBestVisualAsset };
