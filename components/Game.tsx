'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ProceduralScene from '@/components/ProceduralScene';
import AmbientAudio from '@/components/AmbientAudio';
import IntroSequence from '@/components/IntroSequence';
import { createInitialState, currentLocation, migrateState, productPrice, xpProgress, type AttributeKey, type GameState, type NewCampaignInput, type RollResult } from '@/lib/engine';

type StoredCampaigns = { version: 4; campaigns: GameState[]; active?: string };
type TurnReply = { state?: GameState; narrative?: string; requiresDice?: boolean; rollResult?: RollResult | null; mode?: string; warning?: string; error?: string };
type Panel = 'inventory' | 'map' | 'journal' | 'quests' | 'character';

const STORAGE_KEY = 'infinita-campaigns-v4';
const LEGACY_KEYS = ['infinita-campaigns-v3'];
const CLASS_OPTIONS = [
  { name: 'Guerreiro', icon: '⚔', text: 'Resiste à pressão e domina confrontos diretos.' },
  { name: 'Explorador', icon: '⌖', text: 'Lê trilhas, ruínas e os sinais do mundo.' },
  { name: 'Ladino', icon: '✦', text: 'Age com precisão onde ninguém está olhando.' },
  { name: 'Místico', icon: '☽', text: 'Interpreta forças antigas e conhecimentos ocultos.' },
];

function readCampaigns(): StoredCampaigns {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { campaigns?: unknown[]; active?: string };
      const campaigns = (parsed.campaigns || []).map(migrateState).filter((value): value is GameState => Boolean(value));
      if (campaigns.length) return { version: 4, campaigns, active: campaigns.some(item => item.campaignId === parsed.active) ? parsed.active : campaigns[0].campaignId };
    } catch {
      // Um save corrompido não impede a abertura do jogo.
    }
  }
  return { version: 4, campaigns: [] };
}

async function api<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
  return data;
}

export default function Game() {
  const [campaigns, setCampaigns] = useState<GameState[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState(true);
  const [panel, setPanel] = useState<Panel>('inventory');
  const [characterName, setCharacterName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [selectedClass, setSelectedClass] = useState('Explorador');
  const [customClass, setCustomClass] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [intro, setIntro] = useState<GameState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const actionInputRef = useRef<HTMLInputElement>(null);

  const current = useMemo(() => campaigns.find(campaign => campaign.campaignId === activeId), [campaigns, activeId]);
  const location = current ? currentLocation(current) : null;

  useEffect(() => {
    const stored = readCampaigns();
    setCampaigns(stored.campaigns);
    setActiveId(stored.active);
    setMenu(stored.campaigns.length === 0);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, campaigns, active: activeId } satisfies StoredCampaigns));
  }, [campaigns, activeId, loaded]);

  useEffect(() => {
    let animation = 0;
    let gamepadPressed = false;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(open => !open);
      if (event.key.toLowerCase() === 'r' && current?.session.pendingRoll && !busy) void sendTurn('roll');
    };
    const pollGamepad = () => {
      const gamepad = navigator.getGamepads?.()[0];
      const pressed = Boolean(gamepad?.buttons[0]?.pressed);
      if (pressed && !gamepadPressed && !busy) {
        if (current?.session.pendingRoll) void sendTurn('roll'); else actionInputRef.current?.focus();
      }
      gamepadPressed = pressed;
      animation = requestAnimationFrame(pollGamepad);
    };
    window.addEventListener('keydown', keyboard);
    animation = requestAnimationFrame(pollGamepad);
    return () => { window.removeEventListener('keydown', keyboard); cancelAnimationFrame(animation); };
    // O listener é recriado quando muda a rolagem ativa; sendTurn é uma declaração estável dentro deste render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.campaignId, current?.session.pendingRoll?.id, busy]);

  const update = (next: GameState) => setCampaigns(list => list.map(campaign => campaign.campaignId === next.campaignId ? next : campaign));

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    const className = customClass.trim() || selectedClass;
    const input: NewCampaignInput = { characterName: characterName.trim(), campaignName: campaignName.trim(), className };
    if (!input.characterName || !input.campaignName || !input.className || busy) return;
    setBusy(true);
    setNotice('Criando um mundo para este personagem...');
    try {
      const result = await api<{ state: GameState; warning?: string }>('/api/campaign', input);
      setCampaigns(list => [...list, result.state]);
      setActiveId(result.state.campaignId);
      setMenu(false);
      setIntro(result.state);
      setNotice(result.warning ? 'Campanha iniciada com a narrativa de segurança.' : 'Campanha criada e salva.');
    } catch (error) {
      const fallback = createInitialState(input);
      setCampaigns(list => [...list, fallback]);
      setActiveId(fallback.campaignId);
      setMenu(false);
      setIntro(fallback);
      setNotice(error instanceof Error ? `IA indisponível: ${error.message}. O modo seguro iniciou a campanha.` : 'Campanha iniciada no modo seguro.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTurn(kind: 'action' | 'roll' | 'attribute' | 'useItem' | 'buyItem', playerAction?: string, extra: Record<string, string> = {}) {
    if (!current || busy) return;
    setBusy(true);
    setNotice(kind === 'roll' ? 'Os dados estão decidindo a consequência...' : 'O mundo está reagindo...');
    try {
      const reply = await api<TurnReply>('/api/turn', { kind, action: playerAction, state: current, ...extra });
      if (!reply.state) throw new Error('A Engine não retornou o estado do jogo.');
      update(reply.state);
      setNotice(reply.warning ? 'A IA ficou indisponível neste turno; a Engine preservou o progresso.' : reply.mode === 'ai' ? 'Turno salvo.' : 'Turno resolvido pela Engine.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível concluir o turno. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function submitAction(event: FormEvent) {
    event.preventDefault();
    const value = action.trim();
    if (!value || !current || current.session.pendingRoll) return;
    setAction('');
    void sendTurn('action', value);
  }

  function continueCampaign(campaign: GameState) {
    setActiveId(campaign.campaignId);
    setMenu(false);
    setNotice('Campanha carregada do último autosave.');
  }

  function deleteCampaign(id: string) {
    if (!window.confirm('Apagar esta campanha deste navegador? Esta ação não pode ser desfeita.')) return;
    setCampaigns(list => list.filter(campaign => campaign.campaignId !== id));
    if (activeId === id) setActiveId(undefined);
  }

  if (!loaded) return <main className="loading-screen">CARREGANDO INFINITA...</main>;

  if (intro) return <IntroSequence campaign={intro} onComplete={() => setIntro(null)} />;

  if (menu || !current) {
    return <main className="premium-menu">
      <section className="game-menu">
        <div className="menu-rune" aria-hidden="true">◆</div>
        <p className="eyebrow">INFINITA ENGINE</p>
        <h1>INFINITA</h1>
        <p className="subtitle">Um mundo que se lembra de cada consequência.</p>
        {campaigns.length > 0 && <section className="save-slots">
          <h2>CONTINUAR JORNADA</h2>
          {campaigns.map(campaign => <article className="save-card" key={campaign.campaignId}>
            <button type="button" className="save-open" onClick={() => continueCampaign(campaign)}>
              <b>{campaign.campaign.name}</b>
              <span>{campaign.character.name} · {campaign.character.className} · Nível {campaign.character.level}</span>
              <small>{currentLocation(campaign).name} · Turno {campaign.session.turn}</small>
            </button>
            <button type="button" className="save-delete" aria-label={`Apagar ${campaign.campaign.name}`} onClick={() => deleteCampaign(campaign.campaignId)}>×</button>
          </article>)}
        </section>}
        <form className="new-game" onSubmit={createCampaign}>
          <h2>NOVA CAMPANHA</h2>
          <div className="menu-fields">
            <label>NOME DO PERSONAGEM<input value={characterName} onChange={event => setCharacterName(event.target.value)} maxLength={60} placeholder="Quem enfrentará o mundo?" /></label>
            <label>NOME DA CAMPANHA<input value={campaignName} onChange={event => setCampaignName(event.target.value)} maxLength={80} placeholder="O nome desta crônica" /></label>
          </div>
          <label>ARQUÉTIPOS SUGERIDOS</label>
          <div className="class-grid">
            {CLASS_OPTIONS.map(option => <button type="button" key={option.name} className={`class-card ${selectedClass === option.name && !customClass ? 'active' : ''}`} onClick={() => { setSelectedClass(option.name); setCustomClass(''); }}>
              <i>{option.icon}</i><b>{option.name}</b><span>{option.text}</span>
            </button>)}
          </div>
          <label>OU CRIE QUALQUER CLASSE<input className="custom-class" value={customClass} onChange={event => setCustomClass(event.target.value)} maxLength={80} placeholder="Ex.: Cartógrafo de Sonhos, Ferreiro Errante..." /></label>
          <button className="launch" disabled={busy || !characterName.trim() || !campaignName.trim()}>{busy ? 'CRIANDO MUNDO...' : 'INICIAR JORNADA'}</button>
        </form>
        {notice && <p className="menu-notice">{notice}</p>}
      </section>
    </main>;
  }

  const pendingRoll = current.session.pendingRoll;
  const lastRoll = current.session.lastRoll;
  return <main className="game-screen">
    <div className="console-label">● INFINITA ADVANCE</div>
    <div className="shell">
      <header>
        <div className="logo"><i className="rune" /><span>INFINITA</span></div>
        <div className="header-status"><AmbientAudio location={location?.name || 'Norwich'} /><button type="button" className="mobile-menu-toggle" onClick={() => setDrawerOpen(open => !open)}>MENU</button><small>{current.campaign.name.toUpperCase()} · NÍVEL {current.character.level} · D{current.world.day} · {String(current.world.hour).padStart(2, '0')}:00</small></div>
      </header>
      <div className="grid">
        <section className="adventure">
          <div className="scene generated">
            <ProceduralScene location={location?.name || 'Norwich'} className={current.character.className} seed={current.campaignId} weather={current.world.weather} hour={current.world.hour} />
            <div className="scene-name">{location?.name} · {current.world.weather}</div>
          </div>
          <article className="narrative" aria-live="polite">
            {busy && <span className="thinking">◆</span>}{current.session.narrative}
            {lastRoll && <div className={`roll-result ${lastRoll.success ? 'success' : 'failure'}`}>D20 {lastRoll.die} · TOTAL {lastRoll.total} · {lastRoll.success ? 'SUCESSO' : 'FALHA'}</div>}
            {current.session.turn < 2 && <div className="tutorial-tip">DICA: descreva qualquer ação. Quando houver risco real, a Engine bloqueará o texto e mostrará o botão de d20.</div>}
          </article>
        </section>
        <aside className={drawerOpen ? 'drawer-open' : ''}>
          <button type="button" className="drawer-close" onClick={() => setDrawerOpen(false)}>× FECHAR</button>
          <button className="switch" type="button" onClick={() => setMenu(true)}>≡ SALVAR E VOLTAR AO MENU</button>
          <h2>{current.character.name.toUpperCase()}</h2>
          <p className="class-label">{current.character.className} · {current.character.profession}</p>
          <div className="stat"><span>VITALIDADE</span><b>{current.character.hp}/{current.character.maxHp}</b></div>
          <div className="bar"><i style={{ width: `${current.character.hp / current.character.maxHp * 100}%` }} /></div>
          <div className="stat"><span>MANA</span><b>{current.character.mana}/{current.character.maxMana}</b></div>
          <div className="bar manabar"><i style={{ width: `${current.character.mana / Math.max(1, current.character.maxMana) * 100}%` }} /></div>
          <div className="stat"><span>EXPERIÊNCIA</span><b>{current.character.xp}/{current.character.xpToNext}</b></div>
          <div className="bar xpbar"><i style={{ width: `${xpProgress(current)}%` }} /></div>
          <div className="stat"><span>MOEDAS</span><b>{current.character.gold} G</b></div>
          <nav className="panel-tabs" aria-label="Painéis do personagem">
            <button type="button" className={panel === 'inventory' ? 'active' : ''} onClick={() => setPanel('inventory')}>MOCHILA</button>
            <button type="button" className={panel === 'map' ? 'active' : ''} onClick={() => setPanel('map')}>MAPA</button>
            <button type="button" className={panel === 'quests' ? 'active' : ''} onClick={() => setPanel('quests')}>MISSÕES</button>
            <button type="button" className={panel === 'character' ? 'active' : ''} onClick={() => setPanel('character')}>FICHA</button>
            <button type="button" className={panel === 'journal' ? 'active' : ''} onClick={() => setPanel('journal')}>DIÁRIO</button>
          </nav>
          {panel === 'inventory' && <section className="side-panel"><h3>INVENTÁRIO</h3><ul>{current.character.inventory.map(item => <li key={item.id}><span>› {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>{item.kind === 'consumível' ? <button type="button" className="mini-action" disabled={busy} onClick={() => void sendTurn('useItem', undefined, { itemId: item.id })}>USAR</button> : <em>{item.value} G</em>}</li>)}</ul></section>}
          {panel === 'character' && <section className="side-panel"><h3>ATRIBUTOS {current.character.attributePoints > 0 && `· ${current.character.attributePoints} PONTO`}</h3><ul>{Object.entries(current.character.attributes).map(([name, value]) => <li key={name}><span>› {name}</span>{current.character.attributePoints > 0 && value < 20 ? <button type="button" className="mini-action" disabled={busy} onClick={() => void sendTurn('attribute', undefined, { attribute: name as AttributeKey })}>+ {value}</button> : <em>{value}</em>}</li>)}</ul><hr /><h3>PERÍCIAS</h3><ul>{Object.values(current.character.skills).filter(skill => skill.trained || skill.xp > 0).slice(0, 8).map(skill => <li key={skill.id}>› {skill.name}<em>{skill.rank}</em></li>)}</ul></section>}
          {panel === 'quests' && <section className="side-panel"><h3>MISSÕES</h3>{current.campaign.quests.map(quest => <article className="quest" key={quest.id}><b>{quest.title}</b><span>{quest.status === 'completed' ? 'CONCLUÍDA' : quest.description}</span>{quest.objectives.map(objective => <small key={objective.id}>{objective.completed ? '✓' : '□'} {objective.text}</small>)}</article>)}<hr /><h3>REPUTAÇÃO</h3><p className="rep">Norwich {current.world.reputation.cities.norwich || 0}<br />Moral percebida {current.world.reputation.moral}</p></section>}
          {panel === 'journal' && <section className="side-panel"><h3>MEMÓRIA DA CAMPANHA</h3><p className="journal-summary">{current.campaign.memory.summary}</p><hr/><h3>ÚLTIMOS ACONTECIMENTOS</h3>{current.world.timeline.slice(-6).reverse().map(event => <p className="journal-event" key={event.id}>D{current.world.day} · {event.text}</p>)}</section>}
          {panel === 'map' && <section className="side-panel"><h3>LOCAIS DESCOBERTOS</h3><ul>{Object.values(current.world.locations).filter(place => place.discovered).map(place => <li key={place.id}><span>{place.id === current.world.currentLocationId ? '◆' : '◇'} {place.name}</span><em>{place.region}</em></li>)}</ul><hr/><h3>PESSOAS PRESENTES</h3>{Object.values(current.world.npcs).filter(npc => npc.locationId === current.world.currentLocationId).map(npc => <article className="quest" key={npc.id}><b>{npc.name}</b><span>{npc.role} · {npc.profession}</span><small>Relação: {npc.relationship}</small></article>)}<hr/><h3>LOJA LOCAL</h3>{Object.values(current.world.economy.shops).filter(shop => shop.locationId === current.world.currentLocationId).map(shop => <article key={shop.id}><b className="shop-name">{shop.name}</b><ul>{shop.products.map(product => <li key={product.id}><span>{product.name} · {product.stock}</span><button type="button" className="mini-action" disabled={busy || product.stock < 1 || current.character.gold < productPrice(current, product)} onClick={() => void sendTurn('buyItem', undefined, { shopId: shop.id, productId: product.id })}>{productPrice(current, product)} G</button></li>)}</ul></article>)}</section>}
        </aside>
      </div>
      <section className="events">
        <h3>REGISTRO DE CONSEQUÊNCIAS</h3>
        {current.session.events.length ? current.session.events.slice(0, 5).map(event => <p key={event.id} className={`event ${event.type}`}>{event.text}</p>) : <p>Nenhuma consequência registrada.</p>}
      </section>
      <form className="action-form" onSubmit={submitAction}>
        <label>{pendingRoll ? `TESTE DE ${pendingRoll.skill.toUpperCase()} · ${pendingRoll.reason}` : 'O QUE VOCÊ FAZ?'}</label>
        {pendingRoll
          ? <button type="button" className="roll-only" onClick={() => void sendTurn('roll')} disabled={busy}><span>⚄</span>{busy ? 'ROLANDO...' : `ROLAR D20 · ${pendingRoll.attribute} · CD ${pendingRoll.difficulty}`}</button>
          : <div className="input-row"><input ref={actionInputRef} value={action} onChange={event => setAction(event.target.value)} maxLength={500} placeholder="Escreva qualquer ação..." disabled={busy} autoFocus /><button disabled={busy || !action.trim()}>{busy ? '...' : 'ENVIAR'}</button></div>}
      </form>
      <footer><span>AUTOSAVE · REVISÃO {current.save.revision}</span><span>{notice || 'CAMPANHA ATIVA'}</span></footer>
    </div>
  </main>;
}
