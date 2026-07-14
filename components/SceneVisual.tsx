'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import type { GameState } from '@/lib/engine';
import ParchmentWriting from '@/components/ParchmentWriting';
import { createSceneVisualDescriptor } from '@/lib/visual/scene-descriptor';
import { findBestVisualAsset } from '@/lib/visual/semantic-matcher';
import {
  getProviderStatus, getVisualAsset, listVisualAssets, markVisualAssetReused,
  providerCircuitOpen, saveVisualAsset, setProviderStatus, updateVisualMetrics,
} from '@/lib/visual/visual-asset-repository';
import type { VisualAsset } from '@/lib/visual/types';

export const VisualFallbackService = { mode: 'parchment' as const };

type SceneVisualProps = {
  state: GameState;
  onIllustrationResolved?: (assetId: string, generated: boolean) => void;
};

function SceneVisual({ state, onIllustrationResolved }: SceneVisualProps) {
  const cycle = state.visualCycle;
  const descriptor = useMemo(
    () => createSceneVisualDescriptor(state),
    // O descritor é congelado no início do bloco; mudanças internas não podem trocar a imagem ativa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.campaignId, cycle.phaseStartAction],
  );
  const [asset, setAsset] = useState<VisualAsset | null>(null);
  const [status, setStatus] = useState<'parchment' | 'cache' | 'generating'>('parchment');

  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    setStatus('parchment');
    if (cycle.currentPhase !== 'illustration') return () => { cancelled = true; };

    async function resolveIllustrationBlock() {
      // An illustration already attached to this block is immutable for all ten actions.
      if (cycle.activeIllustrationId) {
        const exact = await getVisualAsset(cycle.activeIllustrationId).catch(() => null);
        if (!cancelled && exact) { setAsset(exact); setStatus('cache'); }
        return;
      }

      const assets = await listVisualAssets().catch(() => []);
      if (cancelled) return;
      updateVisualMetrics({ requests: 1 });
      const match = findBestVisualAsset(descriptor, assets, []);
      if (match.asset && match.confidence >= .88) {
        const reused = await markVisualAssetReused(match.asset).catch(() => match.asset!);
        if (cancelled) return;
        setAsset(reused); setStatus('cache');
        updateVisualMetrics({ reused: 1, cacheHits: 1, reuseConfidenceTotal: match.confidence });
        onIllustrationResolved?.(reused.id, false);
        return;
      }
      if (providerCircuitOpen()) {
        if (match.asset && match.confidence >= .65) {
          setAsset(match.asset); setStatus('cache');
          updateVisualMetrics({ reused: 1, reuseConfidenceTotal: match.confidence });
          onIllustrationResolved?.(match.asset.id, false);
        } else updateVisualMetrics({ categoryMiss: descriptor.primaryEmotion });
        return;
      }

      setStatus('generating');
      const response = await fetch('/api/visual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(descriptor) });
      const payload = await response.json() as { asset?: VisualAsset; sanitized?: boolean; generationMs?: number; estimatedCost?: number; error?: string; retryAfterSeconds?: number };
      if (!response.ok || !payload.asset) {
        setProviderStatus({ state: 'unavailable', lastError: payload.error || `Erro ${response.status}`, retryAfter: new Date(Date.now() + (payload.retryAfterSeconds || 900) * 1000).toISOString() });
        updateVisualMetrics({ providerFailures: 1 });
        if (match.asset && match.confidence >= .65) {
          setAsset(match.asset); setStatus('cache');
          updateVisualMetrics({ reused: 1, reuseConfidenceTotal: match.confidence });
          onIllustrationResolved?.(match.asset.id, false);
        } else { setStatus('parchment'); updateVisualMetrics({ categoryMiss: descriptor.primaryEmotion }); }
        return;
      }
      await saveVisualAsset(payload.asset);
      if (cancelled) return;
      setProviderStatus({ ...getProviderStatus(), state: 'available', lastError: undefined, retryAfter: undefined });
      setAsset(payload.asset); setStatus('cache');
      updateVisualMetrics({ generated: 1, totalGenerationMs: payload.generationMs || 0, estimatedCost: payload.estimatedCost || 0, accumulatedCost: payload.estimatedCost || 0, sanitizations: payload.sanitized ? 1 : 0 });
      onIllustrationResolved?.(payload.asset.id, true);
    }

    void resolveIllustrationBlock().catch(error => {
      if (cancelled) return;
      setAsset(null); setStatus('parchment');
      setProviderStatus({ state: 'unavailable', lastError: error instanceof Error ? error.message : 'Falha visual.', retryAfter: new Date(Date.now() + 900000).toISOString() });
      updateVisualMetrics({ providerFailures: 1, categoryMiss: descriptor.primaryEmotion });
    });
    return () => { cancelled = true; };
  }, [state.campaignId, cycle.currentPhase, cycle.phaseStartAction, cycle.activeIllustrationId, descriptor, onIllustrationResolved]);

  return <div className="scene-visual" data-source={status} data-phase={cycle.currentPhase}>
    <ParchmentWriting />
    {/* Assets do banco podem ser data URLs; o otimizador do Next não materializa esse formato. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {asset && <img className="cycle-illustration" src={asset.fileUrl} alt={`Cena em ${descriptor.locationType}: ${descriptor.primaryEmotion}`} draggable={false} decoding="async" />}
    {status === 'generating' && <span className="visual-loading">ILUSTRANDO A CRÔNICA...</span>}
  </div>;
}

export default memo(SceneVisual, (previous, next) => previous.state === next.state);
