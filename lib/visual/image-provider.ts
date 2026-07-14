import type { SceneVisualDescriptor, VisualAsset } from '@/lib/visual/types';
import { buildSafeImagePrompt, moderateVisualDescriptor } from '@/lib/visual/moderation';
import { normalizeDescriptor, sceneVisualHash } from '@/lib/visual/scene-descriptor';

type ImagePayload = { data?: Array<{ b64_json?: string; url?: string }> };

function providerConfiguration() {
  const apiKey = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY || '';
  return {
    enabled: process.env.IMAGE_GENERATION_ENABLED !== 'false' && Boolean(apiKey),
    apiKey,
    endpoint: 'https://api.openai.com/v1/images/generations',
    model: process.env.IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    provider: 'openai',
    estimatedCost: Math.max(0, Number(process.env.IMAGE_ESTIMATED_COST_USD) || 0),
  };
}

async function materializeImage(item: { b64_json?: string; url?: string }) {
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (!item.url) throw new Error('O provedor não retornou uma imagem.');
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`Falha ao materializar imagem: ${response.status}`);
  const mime = response.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export function imageProviderStatus() {
  const config = providerConfiguration();
  return { enabled: config.enabled, provider: config.provider, model: config.model, estimatedCost: config.estimatedCost };
}

export async function generateVisualAsset(input: SceneVisualDescriptor): Promise<{ asset: VisualAsset; sanitized: boolean; generationMs: number; estimatedCost: number }> {
  const config = providerConfiguration();
  if (!config.enabled) throw new Error('IMAGE_PROVIDER_DISABLED');
  const descriptor = normalizeDescriptor(input);
  const moderation = moderateVisualDescriptor(descriptor);
  const safeDescriptor = { ...descriptor, safetyClass: moderation.mode === 'direct' ? 'safe' as const : 'sanitized' as const, visualSummary: moderation.safeVisualSummary };
  const prompt = buildSafeImagePrompt(safeDescriptor, moderation.safeVisualSummary);
  const started = Date.now();
  const response = await fetch(config.endpoint, {
    method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt, size: '1536x1024', quality: 'medium', n: 1 }),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 400);
    const error = new Error(`IMAGE_PROVIDER_${response.status}: ${body}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const payload = await response.json() as ImagePayload;
  const fileUrl = await materializeImage(payload.data?.[0] || {});
  const createdAt = new Date().toISOString();
  const id = `${sceneVisualHash(safeDescriptor)}-${Date.now().toString(36)}`;
  const asset: VisualAsset = {
    id, fileUrl, provider: config.provider, model: config.model, promptVersion: 'infinita-gba-v1', createdAt,
    createdByCampaignId: descriptor.campaignId, genreTags: [descriptor.genre], primaryEmotion: descriptor.primaryEmotion,
    secondaryEmotions: descriptor.secondaryEmotions, locationTags: [descriptor.locationType], actionTags: [descriptor.actionType],
    environmentTags: descriptor.environmentTags, characterTags: descriptor.characterArchetypes, intensity: descriptor.intensity,
    safeForReuse: moderation.mode !== 'reject', moderationStatus: moderation.mode === 'direct' ? 'approved' : moderation.mode === 'reject' ? 'rejected' : 'sanitized',
    qualityScore: .86, reuseCount: 0, perceptualHash: sceneVisualHash(safeDescriptor), sceneDescriptorSnapshot: { ...safeDescriptor, campaignId: 'shared', sceneId: id },
  };
  return { asset, sanitized: moderation.mode !== 'direct', generationMs: Date.now() - started, estimatedCost: config.estimatedCost };
}

export const ImageGenerationService = { generate: generateVisualAsset };
export const ImageProviderAdapter = { status: imageProviderStatus };
