import type { ModerationResult, SceneVisualDescriptor } from '@/lib/visual/types';

const sexual = /sexo expl[ií]cito|nudez|estupr|porn|genit/i;
const graphicViolence = /decapit|desmembr|v[ií]scera|tortura|sangue jorr|viol[eê]ncia gr[aá]fica/i;
const hate = /propaganda de [oó]dio|exterm[ií]nio|supremac|humilha[cç][aã]o.*grupo/i;

export function moderateVisualDescriptor(descriptor: SceneVisualDescriptor): ModerationResult {
  const source = `${descriptor.visualSummary} ${descriptor.actionType} ${descriptor.primaryEmotion} ${descriptor.environmentTags.join(' ')}`;
  const blocked: string[] = [];
  if (sexual.test(source)) blocked.push('sexual-explicit');
  if (graphicViolence.test(source)) blocked.push('graphic-violence');
  if (hate.test(source)) blocked.push('hateful-content');
  if (!blocked.length) return { allowed: true, mode: 'direct', safeVisualSummary: descriptor.visualSummary, blockedCategories: [] };
  if (blocked.includes('sexual-explicit')) return { allowed: true, mode: 'sanitized', safeVisualSummary: 'proximidade afetiva sugerida por silhuetas, sem nudez ou conteúdo sexual', blockedCategories: blocked };
  if (blocked.includes('graphic-violence')) return { allowed: true, mode: 'sanitized', safeVisualSummary: 'confronto tenso não gráfico, poses defensivas e consequência sugerida sem ferimentos explícitos', blockedCategories: blocked };
  if (blocked.includes('hateful-content')) return { allowed: true, mode: 'neutral_fallback', safeVisualSummary: 'ambiente social tenso sem símbolos ofensivos, grupos protegidos ou degradação', blockedCategories: blocked };
  return { allowed: false, mode: 'reject', safeVisualSummary: 'ambiente neutro relacionado à aventura', blockedCategories: blocked };
}

export function buildSafeImagePrompt(descriptor: SceneVisualDescriptor, safeSummary: string) {
  return `Handcrafted 16-bit pixel art scene for a modern portable-console RPG. Detailed Game Boy Advance-era visual language, crisp pixel edges, no blur, no photorealism, no 3D rendering, no text, no UI, no watermark. Readable silhouettes, expressive poses, cohesive color palette, layered background, clear foreground action, atmospheric but not overly dark. Horizontal narrative scene suitable for a mobile-responsive RPG interface. Genre: ${descriptor.genre}. Location: ${descriptor.locationType}. Action: ${descriptor.actionType}. Emotional tone: ${descriptor.primaryEmotion}, ${descriptor.secondaryEmotions.join(', ') || 'adventure'}. Intensity: ${descriptor.intensity}. Environment: ${descriptor.environmentTags.join(', ')}. Time: ${descriptor.timeOfDay || 'unspecified'}. Weather: ${descriptor.weather || 'unspecified'}. Characters: ${descriptor.numberOfCharacters}, archetypes ${descriptor.characterArchetypes.join(', ') || 'adventurers'}. Important objects: ${descriptor.importantObjects.join(', ') || 'environmental props'}. Safe composition: ${safeSummary}. No protected franchises or recognizable copyrighted characters.`;
}

export const ImageModerationService = { moderate: moderateVisualDescriptor, buildSafePrompt: buildSafeImagePrompt };
