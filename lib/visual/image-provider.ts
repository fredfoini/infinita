import sharp from 'sharp';
import type { SceneVisualDescriptor, VisualAsset, VisualAssetKind } from '@/lib/visual/types';
import { buildSafeImagePrompt, moderateVisualDescriptor } from '@/lib/visual/moderation';
import { normalizeDescriptor, sceneVisualHash } from '@/lib/visual/scene-descriptor';

type ImagePayload = { data?: Array<{ b64_json?: string; url?: string }> };
export type VisualDerivationOptions = {
  assetKind?: VisualAssetKind;
  semanticKey?: string;
  playerPrompt?: string;
  parentAsset?: VisualAsset | null;
  customPrompt?: string;
};

function providerConfiguration() {
  const apiKey = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY || '';
  return {
    enabled: process.env.IMAGE_GENERATION_ENABLED !== 'false' && Boolean(apiKey), apiKey,
    generationEndpoint: 'https://api.openai.com/v1/images/generations', editEndpoint: 'https://api.openai.com/v1/images/edits',
    model: process.env.IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2', provider: 'openai',
    estimatedCost: Math.max(0, Number(process.env.IMAGE_ESTIMATED_COST_USD) || 0),
  };
}

async function responseBytes(item: { b64_json?: string; url?: string }) {
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (!item.url) throw new Error('O provedor não retornou uma imagem.');
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`Falha ao materializar imagem: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function removeGreenChroma(input: Buffer) {
  const image = sharp(input).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index]; const green = data[index + 1]; const blue = data[index + 2];
    if (green > 145 && green > red * 1.45 && green > blue * 1.35) data[index + 3] = 0;
    else if (green > red * 1.18 && green > blue * 1.12) data[index + 1] = Math.min(green, Math.max(red, blue) + 22);
  }
  return sharp(data, { raw: info }).png({ compressionLevel: 9, palette: true }).toBuffer();
}

function derivedPrompt(kind: VisualAssetKind, descriptor: SceneVisualDescriptor, playerPrompt: string, customPrompt?: string) {
  if (customPrompt) return customPrompt;
  if (kind === 'motion-sheet') return `Edit the supplied character sprite sheet while preserving the exact same character identity, face, hair, clothing, palette and equipment. Keep exactly 8 equal columns and 4 equal rows, the same dimensions, margins and all existing cells. Change only row 3 columns 3 and 4 into two readable animation frames for this new player-authored movement: ${playerPrompt}. Perfectly flat solid #00ff00 chroma-key background in every cell, no shadows on the background, and do not use that green in the character. Crisp hand-pixeled 16-bit art, no text, no UI, no watermark.`;
  if (kind === 'character-sheet') return `Use the supplied sprite sheet as the strict layout and pixel-density reference. Create a new original character sheet with exactly 8 equal columns and 4 equal rows. Preserve the frame order, proportions, camera direction, margins and animation readability. The player's own prompt is the dominant design input: ${playerPrompt}. Character identity: ${descriptor.characterVisualIdentity || descriptor.characterArchetypes.join(', ')}. Include idle, walk, talk, celebrate, attack, cast, hurt, death, run, fishing, crafting, sitting and sleeping frames in the same cells as the reference. Perfectly flat solid #00ff00 chroma-key background in every cell, no shadows on the background, and do not use that green in the character. Crisp hand-pixeled 16-bit art, no text, no UI, no watermark, no copyrighted character.`;
  if (kind === 'item-icon') return `Use the supplied item atlas only as the strict pixel-art style, lighting, scale and palette reference. Create one new square inventory icon representing: ${playerPrompt}. The player's description and item history must determine the object's shape, materials, wear and magical details. Center a single readable object with generous padding on the same opaque deep forest-charcoal background. Crisp hand-pixeled 16-bit clusters, no generic geometric placeholder, no text, no UI, no watermark, no copyrighted item.`;
  return buildSafeImagePrompt(descriptor, descriptor.visualSummary);
}

async function requestImage(config: ReturnType<typeof providerConfiguration>, prompt: string, kind: VisualAssetKind, parent?: VisualAsset | null) {
  const size = kind === 'character-sheet' || kind === 'motion-sheet' ? '1536x768' : kind === 'item-icon' ? '1024x1024' : '1536x1024';
  if (parent?.fileUrl) {
    const parentResponse = await fetch(parent.fileUrl);
    if (!parentResponse.ok) throw new Error(`PARENT_ASSET_${parentResponse.status}`);
    const length = Number(parentResponse.headers.get('content-length') || 0);
    if (length > 49_000_000) throw new Error('PARENT_ASSET_TOO_LARGE');
    const form = new FormData();
    form.append('model', config.model); form.append('prompt', prompt); form.append('size', size); form.append('quality', 'medium');
    form.append('image[]', new Blob([await parentResponse.arrayBuffer()], { type: parentResponse.headers.get('content-type') || 'image/png' }), 'parent.png');
    return fetch(config.editEndpoint, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: form });
  }
  return fetch(config.generationEndpoint, {
    method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt, size, quality: 'medium', n: 1 }),
  });
}

export function imageProviderStatus() {
  const config = providerConfiguration();
  return { enabled: config.enabled, provider: config.provider, model: config.model, estimatedCost: config.estimatedCost, supportsLineage: true };
}

export async function generateVisualAsset(input: SceneVisualDescriptor, options: VisualDerivationOptions = {}): Promise<{ asset: VisualAsset; sanitized: boolean; generationMs: number; estimatedCost: number }> {
  const config = providerConfiguration();
  if (!config.enabled) throw new Error('IMAGE_PROVIDER_DISABLED');
  const descriptor = normalizeDescriptor({ ...input, playerPromptInfluence: options.playerPrompt || input.playerPromptInfluence });
  const moderation = moderateVisualDescriptor(descriptor);
  const safeDescriptor = { ...descriptor, safetyClass: moderation.mode === 'direct' ? 'safe' as const : 'sanitized' as const, visualSummary: moderation.safeVisualSummary };
  const kind = options.assetKind || 'scene';
  const playerPrompt = String(options.playerPrompt || safeDescriptor.playerPromptInfluence || safeDescriptor.visualSummary).slice(0, 1200);
  const prompt = derivedPrompt(kind, safeDescriptor, playerPrompt, options.customPrompt);
  const started = Date.now();
  const response = await requestImage(config, prompt, kind, options.parentAsset);
  if (!response.ok) {
    const body = (await response.text()).slice(0, 400);
    const error = new Error(`IMAGE_PROVIDER_${response.status}: ${body}`); (error as Error & { status?: number }).status = response.status; throw error;
  }
  const payload = await response.json() as ImagePayload;
  let bytes = await responseBytes(payload.data?.[0] || {});
  if (kind === 'character-sheet' || kind === 'motion-sheet') bytes = await removeGreenChroma(bytes);
  const fileUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  const createdAt = new Date().toISOString();
  const id = `${sceneVisualHash(safeDescriptor)}-${kind}-${Date.now().toString(36)}`;
  const parent = options.parentAsset;
  const asset: VisualAsset = {
    id, fileUrl, provider: config.provider, model: config.model, promptVersion: 'infinita-lineage-v1', createdAt,
    createdByCampaignId: descriptor.campaignId, genreTags: [descriptor.genre], primaryEmotion: descriptor.primaryEmotion,
    secondaryEmotions: descriptor.secondaryEmotions, locationTags: [descriptor.locationType], actionTags: [descriptor.actionType],
    environmentTags: descriptor.environmentTags, characterTags: descriptor.characterArchetypes, intensity: descriptor.intensity,
    safeForReuse: moderation.mode !== 'reject', moderationStatus: moderation.mode === 'direct' ? 'approved' : moderation.mode === 'reject' ? 'rejected' : 'sanitized',
    qualityScore: .86, reuseCount: 0, perceptualHash: sceneVisualHash(safeDescriptor), sceneDescriptorSnapshot: { ...safeDescriptor, campaignId: 'shared', sceneId: id },
    assetKind: kind, semanticKey: options.semanticKey || sceneVisualHash(safeDescriptor), parentAssetId: parent?.id,
    rootAssetId: parent?.rootAssetId || parent?.id, lineageGeneration: (parent?.lineageGeneration || 0) + 1,
    playerPromptInfluence: playerPrompt.slice(0, 600), global: false,
  };
  return { asset, sanitized: moderation.mode !== 'direct', generationMs: Date.now() - started, estimatedCost: config.estimatedCost };
}

export const ImageGenerationService = { generate: generateVisualAsset };
export const ImageProviderAdapter = { status: imageProviderStatus };
