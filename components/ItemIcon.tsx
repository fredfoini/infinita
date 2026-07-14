'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Item } from '@/lib/engine';
import type { VisualAsset } from '@/lib/visual/types';
import { listVisualAssets, saveVisualAsset } from '@/lib/visual/visual-asset-repository';

const CELL_BY_CATEGORY: Record<Item['category'], [number, number]> = {
  consumable: [2, 0], tool: [4, 3], weapon: [0, 1], armor: [1, 2], accessory: [5, 2],
  material: [1, 3], quest: [6, 3], document: [5, 3], key: [4, 0], relic: [6, 3], narrative: [7, 3],
};

function itemCell(item: Item): [number, number] {
  const name = item.name.toLocaleLowerCase('pt-BR');
  if (/ração|comida|pão|alimento/.test(name)) return [0, 0];
  if (/tocha|lanterna/.test(name)) return [1, 0];
  if (/cura|vida|sangue/.test(name)) return [2, 0];
  if (/mana|éter|arcano/.test(name)) return [3, 0];
  if (/chave/.test(name)) return [4, 0];
  if (/mapa|pergaminho|carta|documento/.test(name)) return [5, 0];
  if (/moeda|ouro|bolsa/.test(name)) return [6, 0];
  if (/baú|tesouro/.test(name)) return [7, 0];
  if (/espada/.test(name)) return [0, 1];
  if (/adaga|faca/.test(name)) return [1, 1];
  if (/arco/.test(name)) return [2, 1];
  if (/cajado|bastão/.test(name)) return [3, 1];
  if (/machado/.test(name)) return [4, 1];
  if (/martelo/.test(name)) return [5, 1];
  if (/lança/.test(name)) return [6, 1];
  if (/escudo/.test(name)) return [7, 1];
  if (/couro/.test(name)) return [0, 2];
  if (/placa|peitoral/.test(name)) return [1, 2];
  if (/elmo|capacete/.test(name)) return [2, 2];
  if (/bota/.test(name)) return [3, 2];
  if (/luva/.test(name)) return [4, 2];
  if (/anel/.test(name)) return [5, 2];
  if (/amuleto|colar/.test(name)) return [6, 2];
  if (/capa|manto/.test(name)) return [7, 2];
  if (/erva|planta/.test(name)) return [0, 3];
  if (/minério|pedra|ferro/.test(name)) return [1, 3];
  if (/madeira|lenha/.test(name)) return [2, 3];
  if (/peixe/.test(name)) return [3, 3];
  if (/livro|grimório/.test(name)) return [5, 3];
  if (/cristal|gema/.test(name)) return [6, 3];
  return CELL_BY_CATEGORY[item.category];
}

function isBaseIcon(item: Item) {
  return /ração|comida|pão|alimento|tocha|lanterna|cura|vida|sangue|mana|éter|arcano|chave|mapa|pergaminho|carta|documento|moeda|ouro|bolsa|baú|tesouro|espada|adaga|faca|arco|cajado|bastão|machado|martelo|lança|escudo|couro|placa|peitoral|elmo|capacete|bota|luva|anel|amuleto|colar|capa|manto|erva|planta|minério|pedra|ferro|madeira|lenha|peixe|livro|grimório|cristal|gema/i.test(item.name);
}

function semanticKey(item: Item) { return `item-icon:${item.category}:${item.name.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`; }

export default function ItemIcon({ item, campaignId, localOnly }: { item: Item; campaignId: string; localOnly: boolean }) {
  const [evolvedUrl, setEvolvedUrl] = useState('');
  const key = useMemo(() => semanticKey(item), [item]);

  useEffect(() => {
    let cancelled = false;
    if (isBaseIcon(item)) return;
    async function resolve() {
      const exact = (await listVisualAssets()).find(asset => asset.semanticKey === key);
      if (exact?.fileUrl) { if (!cancelled) setEvolvedUrl(exact.fileUrl); return; }
      const playerPrompt = `${item.name}. ${item.description}. Origem: ${item.origin}. Efeitos narrativos: ${item.effects.narrative.join('; ')}`.slice(0, 1000);
      const response = await fetch('/api/visual/evolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'item-icon', semanticKey: key, campaignId, playerPrompt, localOnly }) });
      if (!response.ok) return;
      const payload = await response.json() as { asset?: VisualAsset };
      if (payload.asset?.fileUrl) await saveVisualAsset(payload.asset);
      if (!cancelled && payload.asset?.fileUrl) setEvolvedUrl(payload.asset.fileUrl);
    }
    void resolve().catch(() => undefined);
    return () => { cancelled = true; };
  }, [campaignId, item, key, localOnly]);

  const [column, row] = itemCell(item);
  const style = evolvedUrl ? { backgroundImage: `url('${evolvedUrl}')`, backgroundPosition: 'center', backgroundSize: 'cover' } : { backgroundPosition: `${column / 7 * 100}% ${row / 3 * 100}%` } as CSSProperties;
  return <span className={`item-icon ${evolvedUrl ? 'evolved' : ''}`} style={style} role="img" aria-label={`Ícone de ${item.name}`} />;
}
