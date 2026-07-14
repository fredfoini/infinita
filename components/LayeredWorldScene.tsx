'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import PixelActor from '@/components/PixelActor';
import { currentLocation, type GameState } from '@/lib/engine';
import { animationForAction } from '@/lib/visual/sprite-system';
import { listVisualAssets, saveVisualAsset } from '@/lib/visual/visual-asset-repository';

const SCENES: Record<string, { column: number; row: number; key: string }> = {
  city: { column: 0, row: 0, key: 'village' }, village: { column: 0, row: 0, key: 'village' }, road: { column: 0, row: 0, key: 'village' },
  tavern: { column: 1, row: 0, key: 'tavern' }, inn: { column: 1, row: 0, key: 'tavern' },
  forest: { column: 2, row: 0, key: 'forest' }, wild: { column: 2, row: 0, key: 'forest' },
  river: { column: 3, row: 0, key: 'river' }, harbor: { column: 3, row: 0, key: 'river' },
  mine: { column: 0, row: 1, key: 'mine' }, cave: { column: 0, row: 1, key: 'mine' }, ruin: { column: 0, row: 1, key: 'mine' },
  castle: { column: 1, row: 1, key: 'castle' }, church: { column: 1, row: 1, key: 'castle' }, temple: { column: 1, row: 1, key: 'castle' },
  shop: { column: 2, row: 1, key: 'shop' }, workshop: { column: 2, row: 1, key: 'shop' },
  mountain: { column: 3, row: 1, key: 'mountain' },
};

function LayeredWorldScene({ state, illustrationUrl }: { state: GameState; illustrationUrl?: string }) {
  const location = currentLocation(state);
  const scene = SCENES[location.kind.toLocaleLowerCase('pt-BR')] || SCENES.wild;
  const backgroundPosition = `${scene.column / 3 * 100}% ${scene.row * 100}%`;
  const recentAction = state.session.recentActions.at(-1) || '';
  const playerAnimation = animationForAction(recentAction, state.session.lastRoll?.success, state.character.hp);
  const [motionSheetUrl, setMotionSheetUrl] = useState('');
  const motionKey = useMemo(() => `motion-sheet:${state.character.sprite.sourceAssetId || state.campaignId}:${recentAction.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`, [recentAction, state.campaignId, state.character.sprite.sourceAssetId]);

  useEffect(() => {
    let cancelled = false; setMotionSheetUrl('');
    if (playerAnimation !== 'custom' || !recentAction.trim()) return;
    async function resolveMotion() {
      const exact = (await listVisualAssets()).find(asset => asset.semanticKey === motionKey);
      if (exact?.fileUrl) { if (!cancelled) setMotionSheetUrl(exact.fileUrl); return; }
      const response = await fetch('/api/visual/evolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'motion-sheet', semanticKey: motionKey, campaignId: state.campaignId, parentAssetId: state.character.sprite.sourceAssetId, playerPrompt: recentAction, characterVisualIdentity: state.character.sprite.description, localOnly: state.campaign.sharingMode === 'local-only' }) });
      if (!response.ok) return;
      const payload = await response.json() as { asset?: import('@/lib/visual/types').VisualAsset };
      if (payload.asset?.fileUrl) await saveVisualAsset(payload.asset);
      if (!cancelled && payload.asset?.fileUrl) setMotionSheetUrl(payload.asset.fileUrl);
    }
    void resolveMotion().catch(() => undefined); return () => { cancelled = true; };
  }, [motionKey, playerAnimation, recentAction, state.campaignId, state.campaign.sharingMode, state.character.sprite.description, state.character.sprite.sourceAssetId]);
  const nearby = Object.values(state.world.npcs).filter(npc => npc.locationId === location.id && npc.status === 'active').slice(0, 4);
  const weather = state.world.weather.toLocaleLowerCase('pt-BR');
  const weatherKind = /chuva|tempest/.test(weather) ? 'rain' : /neve|geada/.test(weather) ? 'snow' : /vento|ventania/.test(weather) ? 'wind' : /névoa|neblina/.test(weather) ? 'mist' : 'clear';
  const time = state.world.hour < 6 || state.world.hour >= 20 ? 'night' : state.world.hour < 9 || state.world.hour >= 17 ? 'twilight' : 'day';

  return <div className="layered-world" data-scene={scene.key} data-weather={weatherKind} data-time={time}>
    <div className={`world-background ${illustrationUrl ? 'external-illustration' : ''}`} style={illustrationUrl ? { backgroundImage: `url('${illustrationUrl}')`, backgroundPosition: 'center' } : { backgroundPosition }} />
    <div className="world-lighting" />
    <div className="world-motion"><i/><i/><i/><i/><i/><i/></div>
    <div className="world-props"><i className="ambient-flame"/><i className="ambient-flag"/><i className="ambient-water"/></div>
    <div className="world-actors">
      {nearby.map((npc, index) => <PixelActor key={npc.id} identity={npc.sprite} animation={index === state.session.turn % Math.max(1, nearby.length) ? 'talk' : 'idle'} facing={index % 2 ? 'left' : 'right'} compact label={`${npc.name}, ${npc.profession}`} className={`npc actor-${index}`} />)}
      <PixelActor identity={motionSheetUrl ? { ...state.character.sprite, sheetUrl: motionSheetUrl } : state.character.sprite} animation={playerAnimation} label={`${state.character.name}, ${state.character.className}`} className="player" />
    </div>
    <div className="weather-layer"><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="scene-vignette" />
  </div>;
}

export default memo(LayeredWorldScene, (previous, next) => previous.state === next.state);
