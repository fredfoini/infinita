import type { GameState } from '@/lib/engine';
import type { SceneVisualDescriptor, VisualIntensity } from '@/lib/visual/types';

const emotionVocabulary: Array<[RegExp, string]> = [
  [/atac|combate|luta|golpe|duelo/, 'luta'], [/fug|perseg|corr/, 'perseguição'], [/ameaç|tens|perigo/, 'ameaça'],
  [/investig|pista|mist[eé]rio|segredo/, 'mistério'], [/descobr|revela/, 'descoberta'], [/explor|viaj|travess/, 'aventura'],
  [/romance|beij|afeto|amor/, 'romance'], [/amiz|companheir|ajud/, 'amizade'], [/negoci|diplomac|convers/, 'negociação'],
  [/humor|engra[cç]|absurd/, 'humor'], [/luto|triste|morreu|perda/, 'tristeza'], [/vit[oó]ria|celebr/, 'vitória'],
  [/derrota|falha|consequ/, 'derrota'], [/trabalh|profiss|of[ií]cio/, 'trabalho'], [/terror|horror|inquiet/, 'terror leve'],
  [/magi|arcano|maravilh|portal/, 'magia'], [/crime|furt|roub/, 'crime'], [/descans|paz|contempl/, 'contemplação'],
];

function normalize(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function inferGenre(text: string) {
  const value = normalize(text);
  if (/western|cowboy|pistoleiro|xerife/.test(value)) return 'western';
  if (/espaco|nave|planeta|androide|cyber|sci-fi/.test(value)) return 'ficção científica';
  if (/terror|horror|assombr|vampir/.test(value)) return 'terror fantástico';
  if (/pirata|navio|oceano|marinheiro/.test(value)) return 'aventura marítima';
  if (/cidade moderna|detetive|policial/.test(value)) return 'mistério urbano';
  return 'fantasia de aventura';
}

function inferEmotion(text: string) {
  const value = normalize(text);
  const found = emotionVocabulary.filter(([pattern]) => pattern.test(value)).map(([, emotion]) => emotion);
  return { primary: found[0] || 'aventura', secondary: Array.from(new Set(found.slice(1, 4))) };
}

function inferAction(text: string) {
  const value = normalize(text);
  if (/atac|combate|luta|duelo/.test(value)) return 'combate';
  if (/convers|fala|negoci|pergunt/.test(value)) return 'conversa';
  if (/viaj|segue|caminh|entra|sai|explor/.test(value)) return 'viagem';
  if (/investig|procura|examina|observa/.test(value)) return 'investigação';
  if (/fug|perseg|corre/.test(value)) return 'perseguição';
  return 'exploração';
}

function inferIntensity(text: string): VisualIntensity {
  const value = normalize(text);
  if (/mortal|explos|grande combate|critico|desesper/.test(value)) return 'high';
  if (/amea[cç]|risco|combate|fug|tens|falha/.test(value)) return 'medium';
  return 'low';
}

function timeLabel(hour: number) { return hour < 6 ? 'madrugada' : hour < 12 ? 'manhã' : hour < 18 ? 'tarde' : 'noite'; }

export function createSceneVisualDescriptor(state: GameState): SceneVisualDescriptor {
  const location = state.world.locations[state.world.currentLocationId] || Object.values(state.world.locations)[0];
  const action = state.session.recentActions.at(-1) || state.session.narrative;
  const semanticText = `${state.campaign.premise} ${state.session.narrative} ${action}`;
  const emotion = inferEmotion(semanticText);
  const nearby = Object.values(state.world.npcs).filter(npc => npc.locationId === location?.id && npc.status === 'active').slice(0, 5);
  const objects = state.character.inventory.filter(item => item.equipped).map(item => item.kind).slice(0, 4);
  const locationType = location?.kind || 'wild';
  return {
    campaignId: state.campaignId,
    sceneId: `turn-${state.session.turn}-${location?.id || 'unknown'}`,
    genre: inferGenre(`${state.campaign.memory.worldGenesis.originalPrompt} ${state.campaign.premise}`),
    primaryEmotion: emotion.primary,
    secondaryEmotions: emotion.secondary,
    intensity: inferIntensity(semanticText),
    locationType,
    environmentTags: Array.from(new Set([locationType, location?.region || '', state.world.weather, timeLabel(state.world.hour)].filter(Boolean))),
    timeOfDay: timeLabel(state.world.hour),
    weather: state.world.weather,
    actionType: inferAction(action),
    numberOfCharacters: Math.max(1, nearby.length + 1),
    characterArchetypes: Array.from(new Set([state.character.className, ...nearby.map(npc => npc.profession || npc.role)])).slice(0, 6),
    relationshipContext: nearby.some(npc => npc.relationship > 1) ? 'aliança ou confiança' : nearby.some(npc => npc.relationship < -1) ? 'tensão social' : 'relação neutra',
    importantObjects: objects,
    safetyClass: 'safe',
    visualSummary: `${emotion.primary} em ${locationType}; ${inferAction(action)}; ${timeLabel(state.world.hour)}; clima ${state.world.weather}`,
  };
}

export function normalizeDescriptor(input: SceneVisualDescriptor): SceneVisualDescriptor {
  const clean = (value: unknown, fallback: string, max = 100) => String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, max);
  const list = (value: unknown, limit = 8) => Array.isArray(value) ? Array.from(new Set(value.map(item => clean(item, '', 80)).filter(Boolean))).slice(0, limit) : [];
  const intensity: VisualIntensity = ['low', 'medium', 'high'].includes(input.intensity) ? input.intensity : 'low';
  return {
    campaignId: clean(input.campaignId, 'anonymous', 80), sceneId: clean(input.sceneId, 'scene', 100), genre: clean(input.genre, 'fantasia de aventura'),
    primaryEmotion: clean(input.primaryEmotion, 'aventura'), secondaryEmotions: list(input.secondaryEmotions), intensity,
    locationType: clean(input.locationType, 'ambiente desconhecido'), environmentTags: list(input.environmentTags), timeOfDay: clean(input.timeOfDay, '', 30) || undefined,
    weather: clean(input.weather, '', 50) || undefined, actionType: clean(input.actionType, 'exploração'), numberOfCharacters: Math.max(0, Math.min(12, Number(input.numberOfCharacters) || 0)),
    characterArchetypes: list(input.characterArchetypes, 6), relationshipContext: clean(input.relationshipContext, '', 80) || undefined,
    importantObjects: list(input.importantObjects, 8), safetyClass: input.safetyClass === 'sanitized' ? 'sanitized' : 'safe', visualSummary: clean(input.visualSummary, 'cena ambiental de aventura', 300),
  };
}

export function sceneVisualHash(descriptor: SceneVisualDescriptor) {
  const semantic = JSON.stringify({ genre: descriptor.genre, primaryEmotion: descriptor.primaryEmotion, secondary: descriptor.secondaryEmotions, intensity: descriptor.intensity, location: descriptor.locationType, environment: descriptor.environmentTags, time: descriptor.timeOfDay, weather: descriptor.weather, action: descriptor.actionType, characters: descriptor.characterArchetypes, count: descriptor.numberOfCharacters, objects: descriptor.importantObjects });
  let hash = 2166136261;
  for (const char of semantic) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `visual-${(hash >>> 0).toString(36)}`;
}

export const SceneDescriptorService = { create: createSceneVisualDescriptor, normalize: normalizeDescriptor };
export const SceneVisualHashService = { hash: sceneVisualHash };
