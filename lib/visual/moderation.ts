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
  return `Original handcrafted 16-bit pixel-art environment for an early-2000s portable fantasy RPG, viewed from a fixed three-quarter isometric camera. Environment only: no people, creatures, text, interface or watermark. Crisp pixel clusters, readable architecture, reusable foreground and background layers, subtle atmospheric depth, natural palette of earth brown, parchment beige, forest green, stone gray, river blue and restrained gold. No neon, glass effects, gradients, photorealism or 3D rendering. The environment must remain visually compatible with small animated character sprites composited over it. Genre: ${descriptor.genre}. Location: ${descriptor.locationType}. Intended action: ${descriptor.actionType}. Emotional tone: ${descriptor.primaryEmotion}, ${descriptor.secondaryEmotions.join(', ') || 'adventure'}. Intensity: ${descriptor.intensity}. Environment: ${descriptor.environmentTags.join(', ')}. Time: ${descriptor.timeOfDay || 'unspecified'}. Weather: ${descriptor.weather || 'unspecified'}. Important objects: ${descriptor.importantObjects.join(', ') || 'environmental props'}. Safe composition: ${safeSummary}. Entirely original design with no protected franchises or recognizable copyrighted characters.`;
}

export const ImageModerationService = { moderate: moderateVisualDescriptor, buildSafePrompt: buildSafeImagePrompt };
