'use client';

import { useEffect, useState } from 'react';
import { getProviderStatus, getVisualMetrics, listVisualAssets, resetProviderCircuit } from '@/lib/visual/visual-asset-repository';
import type { ImageCacheMetrics, ProviderStatus } from '@/lib/visual/types';

export default function AdminVisualDashboard() {
  const [metrics, setMetrics] = useState<ImageCacheMetrics>(() => getVisualMetrics());
  const [provider, setProvider] = useState<ProviderStatus>(() => getProviderStatus());
  const [assetCount, setAssetCount] = useState(0);
  useEffect(() => {
    const refresh = () => { setMetrics(getVisualMetrics()); setProvider(getProviderStatus()); void listVisualAssets().then(assets => setAssetCount(assets.length)); };
    refresh();
    window.addEventListener('infinita-visual-metrics', refresh); window.addEventListener('infinita-provider-status', refresh);
    return () => { window.removeEventListener('infinita-visual-metrics', refresh); window.removeEventListener('infinita-provider-status', refresh); };
  }, []);
  const reuseTotal = metrics.reused || 0;
  return <section className="side-panel visual-dashboard">
    <h3>BANCO VISUAL</h3>
    <p className="rep">{assetCount} imagens persistentes neste navegador</p>
    <ul>
      <li><span>Geradas</span><em>{metrics.generated}</em></li><li><span>Reutilizadas</span><em>{metrics.reused}</em></li>
      <li><span>Cache hit</span><em>{metrics.requests ? Math.round(metrics.cacheHits / metrics.requests * 100) : 0}%</em></li>
      <li><span>Confiança média</span><em>{reuseTotal ? (metrics.reuseConfidenceTotal / reuseTotal).toFixed(2) : '—'}</em></li>
      <li><span>Sanitizações</span><em>{metrics.sanitizations}</em></li><li><span>Falhas do provedor</span><em>{metrics.providerFailures}</em></li>
      <li><span>Custo estimado</span><em>US$ {metrics.accumulatedCost.toFixed(3)}</em></li>
    </ul>
    <hr/><h3>PROVEDOR</h3><p className="rep">{provider.state.toUpperCase()}{provider.lastError ? ` · ${provider.lastError}` : ''}</p>
    {provider.state === 'unavailable' && <button type="button" className="mini-action visual-retry" onClick={() => { resetProviderCircuit(); setProvider(getProviderStatus()); }}>TENTAR NOVAMENTE</button>}
  </section>;
}
