'use client';

import { memo } from 'react';
import type { Item } from '@/lib/engine';
import type { ItemAction } from '@/lib/items/item-engine';

const CATEGORY_LABEL: Record<Item['category'], string> = {
  consumable: 'CONSUMÍVEL', tool: 'FERRAMENTA', weapon: 'ARMA', armor: 'ARMADURA', accessory: 'ACESSÓRIO', material: 'MATERIAL',
  quest: 'ITEM DE MISSÃO', document: 'DOCUMENTO', key: 'CHAVE', relic: 'RELÍQUIA', narrative: 'OBJETO NARRATIVO',
};
const RARITY_LABEL: Record<Item['rarity'], string> = { common: 'COMUM', uncommon: 'INCOMUM', rare: 'RARO', epic: 'ÉPICO', legendary: 'LENDÁRIO' };

function availableActions(item: Item, hasNearbyNpc: boolean): Array<{ action: ItemAction; label: string; danger?: boolean }> {
  const actions: Array<{ action: ItemAction; label: string; danger?: boolean }> = [];
  if (item.category === 'consumable' || item.effects.mechanical.some(effect => effect.type.startsWith('unlock_') || effect.type === 'trigger_event')) actions.push({ action: 'use', label: 'USAR' });
  if (['weapon', 'armor', 'accessory', 'tool'].includes(item.category)) actions.push({ action: 'equip', label: item.equipped ? 'REMOVER' : 'EQUIPAR' });
  actions.push({ action: 'store', label: item.state === 'stored' ? 'RETIRAR' : 'GUARDAR' });
  if (hasNearbyNpc) actions.push({ action: 'lend', label: 'EMPRESTAR' });
  actions.push({ action: 'sell', label: 'VENDER' });
  if (item.durability && item.durability.current < item.durability.max) actions.push({ action: 'repair', label: 'REPARAR' });
  if (['material', 'tool'].includes(item.category)) actions.push({ action: 'combine', label: 'COMBINAR' });
  actions.push({ action: 'discard', label: 'DESCARTAR', danger: true }, { action: 'lose', label: 'PERDER', danger: true }, { action: 'destroy', label: 'DESTRUIR', danger: true });
  return actions;
}

function InventoryPanel({ items, busy, hasNearbyNpc, onAction }: { items: Item[]; busy: boolean; hasNearbyNpc: boolean; onAction: (itemId: string, action: ItemAction) => void }) {
  return <section className="side-panel inventory-panel"><h3>INVENTÁRIO · {items.length} ITENS</h3>
    {items.length === 0 && <p className="rep">A mochila está vazia. Itens perdidos e destruídos continuam registrados na história do mundo.</p>}
    <div className="inventory-list">{items.map(item => <details className={`inventory-item rarity-${item.rarity}`} key={item.id}>
      <summary><span className="item-icon">{item.category === 'weapon' ? '⚔' : item.category === 'armor' ? '◆' : item.category === 'consumable' ? '✚' : item.category === 'key' ? '⌘' : '◇'}</span><span><b>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</b><small>{RARITY_LABEL[item.rarity]} · {CATEGORY_LABEL[item.category]} {item.equipped ? '· EQUIPADO' : ''}</small></span><em>{Number((item.weight * item.quantity).toFixed(2))} kg</em></summary>
      <p>{item.description}</p>
      <div className="item-meta"><span>VALOR {item.value} G</span><span>ESTADO {item.state.toUpperCase()}</span>{item.durability && <span>DURABILIDADE {item.durability.current}/{item.durability.max}</span>}</div>
      <ul className="item-effects">{item.effects.mechanical.map((effect, index) => <li key={`${effect.type}-${index}`}>◆ {effect.target || effect.type.replaceAll('_', ' ')} {effect.value > 1 ? `+${effect.value}` : ''}</li>)}</ul>
      <div className="item-actions">{availableActions(item, hasNearbyNpc).map(option => <button type="button" key={option.action} className={option.danger ? 'danger' : ''} disabled={busy} onClick={() => onAction(item.id, option.action)}>{option.label}</button>)}</div>
    </details>)}</div>
  </section>;
}

export default memo(InventoryPanel, (previous, next) => previous.items === next.items && previous.busy === next.busy && previous.hasNearbyNpc === next.hasNearbyNpc);
