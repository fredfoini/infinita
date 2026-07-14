import 'server-only';
import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SceneVisualDescriptor, VisualAsset, VisualAssetKind } from '@/lib/visual/types';
import { classifyGlobalContribution } from '@/lib/content-sharing-policy';

const ASSET_HASH = 'infinita:visual:assets:v1';
const ASSET_INDEX = 'infinita:visual:index:v1';
const SEMANTIC_PREFIX = 'infinita:visual:semantic:v1:';

function config() {
  return {
    blobToken: process.env.BLOB_READ_WRITE_TOKEN || '',
    redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
  };
}

export function globalVisualRegistryStatus() {
  const value = config();
  return { enabled: Boolean(value.blobToken && value.redisUrl && value.redisToken), blob: Boolean(value.blobToken), metadata: Boolean(value.redisUrl && value.redisToken) };
}

async function redis<T = unknown>(command: Array<string | number>) {
  const value = config();
  if (!value.redisUrl || !value.redisToken) throw new Error('GLOBAL_VISUAL_METADATA_DISABLED');
  const response = await fetch(value.redisUrl, { method: 'POST', headers: { Authorization: `Bearer ${value.redisToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store' });
  const payload = await response.json() as { result?: T; error?: string };
  if (!response.ok || payload.error) throw new Error(payload.error || `GLOBAL_VISUAL_REDIS_${response.status}`);
  return payload.result as T;
}

function safeKey(value: string) { return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9:_-]+/g, '-').slice(0, 180); }

function decodeDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], 'base64') };
}

export async function getGlobalVisualAsset(id: string) {
  if (!globalVisualRegistryStatus().enabled || !id) return null;
  const raw = await redis<string | null>(['HGET', ASSET_HASH, id]);
  return raw ? JSON.parse(raw) as VisualAsset : null;
}

export async function findGlobalVisualAsset(semanticKey: string) {
  if (!globalVisualRegistryStatus().enabled || !semanticKey) return null;
  const id = await redis<string | null>(['GET', `${SEMANTIC_PREFIX}${safeKey(semanticKey)}`]);
  return id ? getGlobalVisualAsset(id) : null;
}

export async function listGlobalVisualAssets(limit = 180) {
  if (!globalVisualRegistryStatus().enabled) return [];
  const ids = await redis<string[]>(['ZREVRANGE', ASSET_INDEX, 0, Math.max(0, Math.min(500, limit) - 1)]);
  if (!ids?.length) return [];
  const rows = await redis<Array<string | null>>(['HMGET', ASSET_HASH, ...ids]);
  return rows.filter(Boolean).map(row => JSON.parse(row!) as VisualAsset).filter(asset => asset.safeForReuse && asset.moderationStatus !== 'rejected');
}

export async function registerGlobalVisualAsset(asset: VisualAsset) {
  if (!globalVisualRegistryStatus().enabled) return asset;
  const contribution = classifyGlobalContribution(`${asset.playerPromptInfluence || ''} ${asset.sceneDescriptorSnapshot.visualSummary || ''}`);
  if (asset.moderationStatus !== 'approved' || !asset.safeForReuse || contribution.mode === 'local-only') return { ...asset, global: false };
  let fileUrl = asset.fileUrl;
  const decoded = decodeDataUrl(fileUrl);
  if (decoded) {
    const extension = decoded.contentType.includes('webp') ? 'webp' : decoded.contentType.includes('jpeg') ? 'jpg' : 'png';
    const blob = await put(`infinita/visual/${asset.assetKind || 'scene'}/${asset.id}.${extension}`, decoded.bytes, {
      access: 'public', token: config().blobToken, addRandomSuffix: false, allowOverwrite: true, contentType: decoded.contentType,
    });
    fileUrl = blob.url;
  }
  const globalAsset = { ...asset, fileUrl, global: true };
  await redis(['HSET', ASSET_HASH, globalAsset.id, JSON.stringify(globalAsset)]);
  await redis(['ZADD', ASSET_INDEX, Date.parse(globalAsset.createdAt) || Date.now(), globalAsset.id]);
  if (globalAsset.semanticKey) await redis(['SET', `${SEMANTIC_PREFIX}${safeKey(globalAsset.semanticKey)}`, globalAsset.id]);
  return globalAsset;
}

export async function markGlobalVisualAssetReused(id: string) {
  const asset = await getGlobalVisualAsset(id); if (!asset) return null;
  const updated = { ...asset, reuseCount: asset.reuseCount + 1, lastUsedAt: new Date().toISOString() };
  await redis(['HSET', ASSET_HASH, id, JSON.stringify(updated)]);
  return updated;
}

const ROOTS: Record<VisualAssetKind, { id: string; file: string; semanticKey: string }> = {
  scene: { id: 'root-scene-atlas-v1', file: 'world-scene-atlas-v1.png', semanticKey: 'root:scene' },
  'item-icon': { id: 'root-item-icon-atlas-v1', file: 'item-icon-atlas-v1.png', semanticKey: 'root:item-icon' },
  'character-sheet': { id: 'root-character-sheet-v1', file: 'hero-sprite-sheet-v1.png', semanticKey: 'root:character-sheet' },
  'motion-sheet': { id: 'root-motion-sheet-v1', file: 'hero-sprite-sheet-v1.png', semanticKey: 'root:motion-sheet' },
  'style-reference': { id: 'root-style-reference-v1', file: 'world-scene-atlas-v1.png', semanticKey: 'root:style-reference' },
};

function rootDescriptor(kind: VisualAssetKind): SceneVisualDescriptor {
  return { campaignId: 'global', sceneId: `root-${kind}`, genre: 'fantasia de aventura', primaryEmotion: 'aventura', secondaryEmotions: [], intensity: 'low', locationType: kind, environmentTags: ['pixel art', 'base original'], actionType: 'referência', numberOfCharacters: kind.includes('character') || kind.includes('motion') ? 1 : 0, characterArchetypes: [], importantObjects: [], safetyClass: 'safe', visualSummary: `Referência visual raiz para ${kind}.` };
}

export async function ensureGlobalRootAsset(kind: VisualAssetKind) {
  const root = ROOTS[kind];
  const existing = await getGlobalVisualAsset(root.id); if (existing) return existing;
  const bytes = await readFile(path.join(process.cwd(), 'public', 'assets', root.file));
  return registerGlobalVisualAsset({
    id: root.id, fileUrl: `data:image/png;base64,${bytes.toString('base64')}`, provider: 'infinita', model: 'original-seed', promptVersion: 'root-v1', createdAt: new Date(0).toISOString(),
    genreTags: ['fantasia'], primaryEmotion: 'aventura', secondaryEmotions: [], locationTags: [kind], actionTags: ['reference'], environmentTags: ['pixel art'], characterTags: [], intensity: 'low',
    safeForReuse: true, moderationStatus: 'approved', qualityScore: 1, reuseCount: 0, sceneDescriptorSnapshot: rootDescriptor(kind), assetKind: kind, semanticKey: root.semanticKey, rootAssetId: root.id, lineageGeneration: 0, global: true,
  });
}

export async function reserveGlobalVisualGeneration(campaignId: string, semanticKey: string) {
  if (!globalVisualRegistryStatus().enabled) return { allowed: false, reason: 'GLOBAL_VISUAL_REGISTRY_DISABLED' };
  const lock = await redis<string | null>(['SET', `infinita:visual:lock:${safeKey(semanticKey)}`, campaignId, 'NX', 'EX', 180]);
  if (lock !== 'OK') return { allowed: false, reason: 'GENERATION_ALREADY_RUNNING' };
  const day = new Date().toISOString().slice(0, 10);
  const count = await redis<number>(['INCR', `infinita:visual:quota:${safeKey(campaignId)}:${day}`]);
  if (count === 1) await redis(['EXPIRE', `infinita:visual:quota:${safeKey(campaignId)}:${day}`, 172800]);
  const limit = Math.max(1, Number(process.env.GLOBAL_VISUAL_DAILY_LIMIT_PER_CAMPAIGN) || 4);
  return count <= limit ? { allowed: true } : { allowed: false, reason: 'CAMPAIGN_DAILY_VISUAL_LIMIT' };
}

export const GlobalVisualRegistry = { status: globalVisualRegistryStatus, list: listGlobalVisualAssets, get: getGlobalVisualAsset, find: findGlobalVisualAsset, register: registerGlobalVisualAsset, markReused: markGlobalVisualAssetReused, ensureRoot: ensureGlobalRootAsset, reserve: reserveGlobalVisualGeneration };
