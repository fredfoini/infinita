'use client';

import { EMPTY_VISUAL_METRICS, type ImageCacheMetrics as ImageCacheMetricsState, type ProviderStatus, type VisualAsset } from '@/lib/visual/types';

const DB_NAME = 'infinita-visual-bank';
const DB_VERSION = 1;
const ASSET_STORE = 'assets';
const META_STORE = 'meta';
const METRICS_KEY = 'infinita-visual-metrics-v1';
const PROVIDER_KEY = 'infinita-image-provider-status-v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o banco visual.'));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha no banco visual.'));
  });
}

export async function listVisualAssets(): Promise<VisualAsset[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await openDatabase();
  try { return await requestResult(db.transaction(ASSET_STORE, 'readonly').objectStore(ASSET_STORE).getAll()) as VisualAsset[]; }
  finally { db.close(); }
}

export async function getVisualAsset(id: string): Promise<VisualAsset | null> {
  if (typeof indexedDB === 'undefined' || !id) return null;
  const db = await openDatabase();
  try { return (await requestResult(db.transaction(ASSET_STORE, 'readonly').objectStore(ASSET_STORE).get(id)) as VisualAsset | undefined) || null; }
  finally { db.close(); }
}

export async function saveVisualAsset(asset: VisualAsset) {
  const db = await openDatabase();
  try { await requestResult(db.transaction(ASSET_STORE, 'readwrite').objectStore(ASSET_STORE).put(asset)); }
  finally { db.close(); }
}

export async function markVisualAssetReused(asset: VisualAsset) {
  const updated = { ...asset, reuseCount: asset.reuseCount + 1, lastUsedAt: new Date().toISOString() };
  await saveVisualAsset(updated);
  return updated;
}

export function getVisualMetrics(): ImageCacheMetricsState {
  if (typeof localStorage === 'undefined') return { ...EMPTY_VISUAL_METRICS };
  try { return { ...EMPTY_VISUAL_METRICS, ...JSON.parse(localStorage.getItem(METRICS_KEY) || '{}') }; }
  catch { return { ...EMPTY_VISUAL_METRICS }; }
}

export function updateVisualMetrics(patch: Partial<ImageCacheMetricsState> & { categoryMiss?: string }) {
  const current = getVisualMetrics();
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'categoryMiss' || typeof value !== 'number') continue;
    (next as unknown as Record<string, unknown>)[key] = Number((current as unknown as Record<string, number>)[key] || 0) + value;
  }
  if (patch.categoryMiss) next.categoryMisses = { ...next.categoryMisses, [patch.categoryMiss]: (next.categoryMisses[patch.categoryMiss] || 0) + 1 };
  localStorage.setItem(METRICS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('infinita-visual-metrics'));
  return next;
}

export function getProviderStatus(): ProviderStatus {
  if (typeof localStorage === 'undefined') return { state: 'unknown' };
  try { return { state: 'unknown', ...JSON.parse(localStorage.getItem(PROVIDER_KEY) || '{}') }; }
  catch { return { state: 'unknown' }; }
}

export function setProviderStatus(status: ProviderStatus) {
  localStorage.setItem(PROVIDER_KEY, JSON.stringify(status));
  window.dispatchEvent(new CustomEvent('infinita-provider-status'));
}

export function providerCircuitOpen() {
  const status = getProviderStatus();
  if (status.state !== 'unavailable' || !status.retryAfter) return false;
  return Date.parse(status.retryAfter) > Date.now();
}

export function resetProviderCircuit() { setProviderStatus({ state: 'unknown' }); }

export const VisualAssetRepository = { list: listVisualAssets, get: getVisualAsset, save: saveVisualAsset, markReused: markVisualAssetReused };
export const ImageCreditMonitor = { getStatus: getProviderStatus, setStatus: setProviderStatus, isCircuitOpen: providerCircuitOpen, reset: resetProviderCircuit };
export const ImageCacheMetrics = { get: getVisualMetrics, update: updateVisualMetrics };
