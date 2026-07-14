'use client';

import { memo } from 'react';
import PixelActor from '@/components/PixelActor';
import { currentLocation, type GameState } from '@/lib/engine';
import { animationForAction } from '@/lib/visual/sprite-system';

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
      <PixelActor identity={state.character.sprite} animation={playerAnimation} label={`${state.character.name}, ${state.character.className}`} className="player" />
    </div>
    <div className="weather-layer"><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="scene-vignette" />
  </div>;
}

export default memo(LayeredWorldScene, (previous, next) => previous.state === next.state);
