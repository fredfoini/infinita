export type VisualIntensity = 'low' | 'medium' | 'high';
export type VisualSafetyClass = 'safe' | 'sanitized';
export type ModerationMode = 'direct' | 'sanitized' | 'neutral_fallback' | 'reject';

export type SceneVisualDescriptor = {
  campaignId: string;
  sceneId: string;
  genre: string;
  primaryEmotion: string;
  secondaryEmotions: string[];
  intensity: VisualIntensity;
  locationType: string;
  environmentTags: string[];
  timeOfDay?: string;
  weather?: string;
  actionType: string;
  numberOfCharacters: number;
  characterArchetypes: string[];
  relationshipContext?: string;
  importantObjects: string[];
  safetyClass: VisualSafetyClass;
  visualSummary: string;
};

export type ModerationResult = {
  allowed: boolean;
  mode: ModerationMode;
  safeVisualSummary: string;
  blockedCategories: string[];
};

export type VisualAsset = {
  id: string;
  fileUrl: string;
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: string;
  createdByCampaignId?: string;
  genreTags: string[];
  primaryEmotion: string;
  secondaryEmotions: string[];
  locationTags: string[];
  actionTags: string[];
  environmentTags: string[];
  characterTags: string[];
  intensity: VisualIntensity;
  safeForReuse: boolean;
  moderationStatus: 'approved' | 'sanitized' | 'rejected';
  qualityScore: number;
  reuseCount: number;
  lastUsedAt?: string;
  perceptualHash?: string;
  semanticEmbedding?: number[];
  sceneDescriptorSnapshot: SceneVisualDescriptor;
};

export type VisualMatch = { asset: VisualAsset | null; confidence: number; scoreBreakdown?: Record<string, number> };

export type ProviderStatus = {
  state: 'unknown' | 'available' | 'unavailable';
  lastError?: string;
  retryAfter?: string;
  estimatedRemainingBudget?: number;
};

export type ImageCacheMetrics = {
  generated: number;
  reused: number;
  cacheHits: number;
  requests: number;
  estimatedCost: number;
  accumulatedCost: number;
  totalGenerationMs: number;
  providerFailures: number;
  reuseConfidenceTotal: number;
  sanitizations: number;
  categoryMisses: Record<string, number>;
};

export const EMPTY_VISUAL_METRICS: ImageCacheMetrics = {
  generated: 0, reused: 0, cacheHits: 0, requests: 0, estimatedCost: 0, accumulatedCost: 0,
  totalGenerationMs: 0, providerFailures: 0, reuseConfidenceTotal: 0, sanitizations: 0, categoryMisses: {},
};
