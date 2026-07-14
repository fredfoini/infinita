'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Logo from '@/components/Logo';
import InventoryPanel from '@/components/InventoryPanel';
import MenuSpriteStage from '@/components/MenuSpriteStage';
import ParchmentWriting from '@/components/ParchmentWriting';
import PixelActor from '@/components/PixelActor';
import { createInitialState, currentLocation, migrateState, productPrice, setActiveIllustration, xpProgress, type AttributeKey, type GameState, type NewCampaignInput, type RollResult } from '@/lib/engine';
import type { ItemAction } from '@/lib/items/item-engine';
import type { VisualAsset } from '@/lib/visual/types';
import { applyCampaignSharingDecision } from '@/lib/content-sharing-policy';
import { cleanNarrativeScaffolding } from '@/lib/narrative-cleaner';
import PortableGameHeader from '@/components/PortableGameHeader';
import ConsequencesLog from '@/components/ConsequencesLog';

const IntroSequence = dynamic(() => import('@/components/IntroSequence'), { ssr: false });
const SceneVisual = dynamic(() => import('@/components/SceneVisual'), { ssr: false, loading: () => <div className="scene-visual visual-placeholder" /> });

type StoredCampaigns = { version: 8; campaigns: GameState[]; active?: string };
type TurnReply = { state?: GameState; narrative?: string; requiresDice?: boolean; rollResult?: RollResult | null; mode?: string; warning?: string; error?: string };
type Panel = 'inventory' | 'map' | 'journal' | 'quests' | 'character';

const STORAGE_INDEX_KEY = 'infinita-campaign-index-v8';
const CAMPAIGN_KEY = 'infinita-campaign-v8:';
const LEGACY_KEYS = ['infinita-campaigns-v7', 'infinita-campaigns-v6', 'infinita-campaigns-v5', 'infinita-campaigns-v4', 'infinita-campaigns-v3'];
const CLASS_OPTIONS = [
  { name: 'Guerreiro', icon: '⚔', text: 'Resiste à pressão e domina confrontos diretos.' },
  { name: 'Explorador', icon: '⌖', text: 'Lê trilhas, ruínas e os sinais do mundo.' },
  { name: 'Ladino', icon: '✦', text: 'Age com precisão onde ninguém está olhando.' },
  { name: 'Místico', icon: '☽', text: 'Interpreta forças antigas e conhecimentos ocultos.' },
];

function difficultyLabel(value: number) {
  if (value <= 5) return 'muito fácil';
  if (value <= 8) return 'fácil';
  if (value <= 10) return 'comum';
  if (value <= 12) return 'moderada';
  if (value <= 15) return 'difícil';
  if (value <= 18) return 'muito difícil';
  if (value <= 22) return 'extrema';
  if (value <= 26) return 'extraordinária';
  return 'quase impossível';
}

const OUTCOME_LABEL = { critical_failure: 'FALHA CRÍTICA', failure: 'FALHA', partial_success: 'SUCESSO PARCIAL', success: 'SUCESSO', critical_success: 'SUCESSO CRÍTICO' } as const;

function readCampaigns(): StoredCampaigns {
  try {
    const index = JSON.parse(localStorage.getItem(STORAGE_INDEX_KEY) || 'null') as { ids?: string[]; active?: string } | null;
    if (index?.ids?.length) {
      const campaigns = index.ids.map(id => {
        const raw = localStorage.getItem(`${CAMPAIGN_KEY}${id}`);
        if (!raw) return null;
        const backupKey = `infinita-migration-backup:${id}`;
        if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, raw);
        return migrateState(JSON.parse(raw));
      }).filter((value): value is GameState => Boolean(value));
      if (campaigns.length) return { version: 8, campaigns, active: campaigns.some(item => item.campaignId === index.active) ? index.active : campaigns[0].campaignId };
    }
  } catch { /* Continua para migração dos saves antigos. */ }
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      if (!localStorage.getItem(`infinita-migration-backup:${key}`)) localStorage.setItem(`infinita-migration-backup:${key}`, raw);
      const parsed = JSON.parse(raw) as { campaigns?: unknown[]; active?: string };
      const campaigns = (parsed.campaigns || []).map(migrateState).filter((value): value is GameState => Boolean(value));
      if (campaigns.length) return { version: 8, campaigns, active: campaigns.some(item => item.campaignId === parsed.active) ? parsed.active : campaigns[0].campaignId };
    } catch {
      // Um save corrompido não impede a abertura do jogo.
    }
  }
  return { version: 8, campaigns: [] };
}

async function api<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
  return data;
}

async function evolveCharacterVisual(state: GameState, input: NewCampaignInput) {
  if (state.campaign.sharingMode === 'local-only') return null;
  const playerPrompt = `Nome: ${input.characterName}. Classe: ${input.className}. Personalidade: ${input.personality || 'revelada pelas escolhas'}. História criada pelo jogador: ${input.openingPrompt}`.slice(0, 1200);
  const response = await fetch('/api/visual/evolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    kind: 'character-sheet', semanticKey: `character-sheet:${state.campaignId}`, campaignId: state.campaignId, playerPrompt,
    characterVisualIdentity: `${input.characterName}; ${input.className}; ${input.personality || ''}; ${input.openingPrompt}`,
  }) });
  if (!response.ok) return null;
  const payload = await response.json() as { asset?: VisualAsset };
  if (!payload.asset?.fileUrl) return null;
  return { ...state, character: { ...state.character, appearanceDescription: `Visual evolutivo criado a partir da história: ${input.openingPrompt.slice(0, 140)}`, sprite: { ...state.character.sprite, sheetUrl: payload.asset.fileUrl, sourceAssetId: payload.asset.id, lineageGeneration: payload.asset.lineageGeneration || 1 } }, save: { ...state.save, revision: state.save.revision + 1, updatedAt: new Date().toISOString() } };
}

export default function Game() {
  const [campaigns, setCampaigns] = useState<GameState[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState(true);
  const [panel, setPanel] = useState<Panel>('inventory');
  const [characterName, setCharacterName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [openingPrompt, setOpeningPrompt] = useState('');
  const [personality, setPersonality] = useState('');
  const [selectedClass, setSelectedClass] = useState('Explorador');
  const [customClass, setCustomClass] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [intro, setIntro] = useState<GameState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const actionInputRef = useRef<HTMLInputElement>(null);
  const savedRevisions = useRef(new Map<string, number>());

  const current = useMemo(() => campaigns.find(campaign => campaign.campaignId === activeId), [campaigns, activeId]);
  const location = useMemo(() => current ? currentLocation(current) : null, [current]);

  useEffect(() => {
    const stored = readCampaigns();
    setCampaigns(stored.campaigns);
    setActiveId(stored.active);
    setMenu(stored.campaigns.length === 0);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const save = () => {
      for (const campaign of campaigns) {
        if (savedRevisions.current.get(campaign.campaignId) === campaign.save.revision) continue;
        localStorage.setItem(`${CAMPAIGN_KEY}${campaign.campaignId}`, JSON.stringify(campaign));
        savedRevisions.current.set(campaign.campaignId, campaign.save.revision);
      }
      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify({ version: 8, ids: campaigns.map(campaign => campaign.campaignId), active: activeId }));
    };
    const timer = window.setTimeout(save, 80);
    return () => window.clearTimeout(timer);
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

  const update = useCallback((next: GameState) => setCampaigns(list => list.map(campaign => campaign.campaignId === next.campaignId ? next : campaign)), []);
  const resolveIllustration = useCallback((assetId: string, generated: boolean) => setCampaigns(list => list.map(campaign =>
    campaign.campaignId === activeId && campaign.visualCycle.activeIllustrationId !== assetId
      ? setActiveIllustration(campaign, assetId, generated)
      : campaign,
  )), [activeId]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    const className = customClass.trim() || selectedClass;
    const input: NewCampaignInput = { characterName: characterName.trim(), campaignName: campaignName.trim(), className, openingPrompt: openingPrompt.trim(), personality: personality.trim() };
    if (!input.characterName || !input.campaignName || !input.className || !input.openingPrompt || busy) return;
    setBusy(true);
    setNotice('Criando um mundo para este personagem...');
    try {
      const result = await api<{ state: GameState; warning?: string }>('/api/campaign', input);
      setCampaigns(list => [...list, result.state]);
      setActiveId(result.state.campaignId);
      setMenu(false);
      setIntro(result.state);
      setNotice(result.state.campaign.sharingMode === 'local-only' ? 'Campanha privada neste navegador.' : result.warning ? 'Campanha iniciada com a narrativa de segurança.' : 'Campanha criada e salva.');
      void evolveCharacterVisual(result.state, input).then(evolved => { if (evolved) { update(evolved); setIntro(currentIntro => currentIntro?.campaignId === evolved.campaignId ? evolved : currentIntro); setNotice('O visual exclusivo do personagem foi incorporado ao banco global.'); } }).catch(() => undefined);
    } catch (error) {
      const fallback = applyCampaignSharingDecision(createInitialState(input), input.openingPrompt);
      setCampaigns(list => [...list, fallback]);
      setActiveId(fallback.campaignId);
      setMenu(false);
      setIntro(fallback);
      setNotice(error instanceof Error ? `IA indisponível: ${error.message}. O modo seguro iniciou a campanha.` : 'Campanha iniciada no modo seguro.');
      void evolveCharacterVisual(fallback, input).then(evolved => { if (evolved) { update(evolved); setIntro(currentIntro => currentIntro?.campaignId === evolved.campaignId ? evolved : currentIntro); } }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function sendTurn(kind: 'action' | 'roll' | 'attribute' | 'useItem' | 'buyItem' | 'itemAction' | 'castSpell', playerAction?: string, extra: Record<string, string> = {}) {
    if (!current || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const requestId = globalThis.crypto?.randomUUID?.() || `${current.campaignId}-${current.save.revision}-${Date.now()}`;
      const reply = await api<TurnReply>('/api/turn', { kind, requestId, action: playerAction, state: current, ...extra });
      if (!reply.state) throw new Error('A Engine não retornou o estado do jogo.');
      update(reply.state);
      setNotice(reply.state.campaign.sharingMode === 'local-only' ? 'Campanha privada neste navegador.' : reply.mode === 'ai' ? 'Turno salvo.' : 'Progresso salvo localmente.');
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
    localStorage.removeItem(`${CAMPAIGN_KEY}${id}`);
    savedRevisions.current.delete(id);
    if (activeId === id) setActiveId(undefined);
  }

  function handleItemAction(itemId: string, itemOperation: ItemAction) {
    if (['destroy', 'discard', 'lose'].includes(itemOperation) && !window.confirm(`Confirmar: ${itemOperation === 'destroy' ? 'destruir' : itemOperation === 'discard' ? 'descartar' : 'perder'} este item permanentemente?`)) return;
    void sendTurn('itemAction', undefined, { itemId, itemOperation });
  }

  if (!loaded) return <main className="loading-screen"><div className="loading-parchment"><ParchmentWriting label="Carregando a crônica" /></div><Logo variant="loading" priority/><span>PREPARANDO A CRÔNICA...</span><i className="loading-particle p1"/><i className="loading-particle p2"/><i className="loading-particle p3"/></main>;

  if (intro) return <IntroSequence campaign={intro} onComplete={() => setIntro(null)} />;

  if (menu || !current) {
    return <main className="premium-menu">
      <section className="game-menu">
        <Logo variant="menu" priority/>
        <MenuSpriteStage />
        <p className="eyebrow">INFINITA ENGINE</p>
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
            <label>PERSONALIDADE<input value={personality} onChange={event => setPersonality(event.target.value)} maxLength={180} placeholder="Ex.: curioso, leal e impaciente" /></label>
            <div className="random-appearance-note"><b>VISUAL SORTEADO</b><span>A Engine criará um aventureiro aleatório e manterá o mesmo visual durante toda a campanha.</span></div>
          </div>
          <label className="opening-seed">COMO SUA HISTÓRIA COMEÇA?<textarea value={openingPrompt} onChange={event => setOpeningPrompt(event.target.value)} maxLength={700} required placeholder="Ex.: Sou um ferreiro falido. Acordei em um navio pirata. Sou um músico viajante em busca de trabalho..." /><small>Esta situação será a semente de todo o mundo. Não existe campanha principal predefinida.</small></label>
          <label>ARQUÉTIPOS SUGERIDOS</label>
          <div className="class-grid">
            {CLASS_OPTIONS.map(option => <button type="button" key={option.name} className={`class-card ${selectedClass === option.name && !customClass ? 'active' : ''}`} onClick={() => { setSelectedClass(option.name); setCustomClass(''); }}>
              <i>{option.icon}</i><b>{option.name}</b><span>{option.text}</span>
            </button>)}
          </div>
          <label>OU CRIE QUALQUER CLASSE<input className="custom-class" value={customClass} onChange={event => setCustomClass(event.target.value)} maxLength={80} placeholder="Ex.: Cartógrafo de Sonhos, Ferreiro Errante..." /></label>
          <button className="launch" disabled={busy || !characterName.trim() || !campaignName.trim() || !openingPrompt.trim()}>{busy ? 'CRIANDO MUNDO...' : 'INICIAR JORNADA'}</button>
        </form>
        {notice && <p className="menu-notice">{notice}</p>}
      </section>
    </main>;
  }

  const pendingRoll = current.session.pendingRoll;
  const lastRoll = current.session.lastRoll;
  const activeSkillAudit = pendingRoll ? current.world.skillAudits.find(audit => audit.id === pendingRoll.auditId) : current.world.skillAudits.at(-1);
  return <main className="game-screen">
    <div className="console-label">● INFINITA ADVANCE</div>
    <div className="shell">
      <PortableGameHeader campaignName={current.campaign.name} level={current.character.level} day={current.world.day} hour={current.world.hour} locationName={location?.name || 'Local desconhecido'} onMenu={() => setDrawerOpen(open => !open)}/>
      <div className="grid">
        <section className="adventure">
          <div className="scene generated">
            <SceneVisual state={current} onIllustrationResolved={resolveIllustration} />
            <div className="scene-name">{location?.name} · {current.world.weather}</div>
          </div>
          <article className="narrative" aria-live="polite">
            {busy && <span className="thinking">◆</span>}{cleanNarrativeScaffolding(current.session.narrative, current.character.name) || current.session.narrative}
            {lastRoll && <div className={`roll-result ${['partial_success', 'success', 'critical_success'].includes(lastRoll.outcome) ? 'success' : 'failure'}`}>D20 {lastRoll.die} · TOTAL {lastRoll.total} · {OUTCOME_LABEL[lastRoll.outcome] || (lastRoll.success ? 'SUCESSO' : 'FALHA')}</div>}
            {current.session.turn < 2 && <div className="tutorial-tip">Escreva qualquer ação. Quando houver risco, você rolará um dado D20.</div>}
          </article>
        </section>
        <aside className={drawerOpen ? 'drawer-open' : ''}>
          <button type="button" className="drawer-close" onClick={() => setDrawerOpen(false)}>× FECHAR</button>
          <button className="switch" type="button" onClick={() => setMenu(true)}>≡ SALVAR E VOLTAR AO MENU</button>
          <div className="character-card">
            <PixelActor identity={current.character.sprite} animation="idle" compact label={`${current.character.name}, ${current.character.className}`} className="character-portrait" />
            <div><h2>{current.character.name.toUpperCase()}</h2><p className="class-label">{current.character.className} · {current.character.profession}</p></div>
          </div>
          <div className="stat"><span>VITALIDADE</span><b>{current.character.hp}/{current.character.maxHp}</b></div>
          <div className="bar"><i style={{ width: `${current.character.hp / current.character.maxHp * 100}%` }} /></div>
          <div className="stat"><span>MANA</span><b>{current.character.mana}/{current.character.maxMana}</b></div>
          <div className="bar manabar"><i style={{ width: `${current.character.mana / Math.max(1, current.character.maxMana) * 100}%` }} /></div>
          <div className="stat"><span>ENERGIA</span><b>{current.character.energy}/{current.character.maxEnergy}</b></div>
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
          {panel === 'inventory' && <InventoryPanel items={current.character.inventory} campaignId={current.campaignId} localOnly={current.campaign.sharingMode === 'local-only'} busy={busy} hasNearbyNpc={Object.values(current.world.npcs).some(npc => npc.locationId === current.world.currentLocationId && npc.status === 'active')} onAction={handleItemAction} />}
          {panel === 'character' && <section className="side-panel"><h3>ATRIBUTOS {current.character.attributePoints > 0 && `· ${current.character.attributePoints} PONTO`}</h3><ul>{Object.entries(current.character.attributes).map(([name, value]) => <li key={name}><span>› {name}</span>{current.character.attributePoints > 0 && value < 20 ? <button type="button" className="mini-action" disabled={busy} onClick={() => void sendTurn('attribute', undefined, { attribute: name as AttributeKey })}>+ {value}</button> : <em>{value}</em>}</li>)}</ul><hr /><h3>PERÍCIAS</h3><ul>{Object.values(current.character.skills).filter(skill => skill.trained || skill.xp > 0).slice(0, 8).map(skill => <li key={skill.id}>› {skill.name}<em>{skill.rank}</em></li>)}</ul><hr/><h3>MAGIAS</h3>{current.character.spells.length ? <ul>{current.character.spells.map(spell => <li key={spell.id}><span>› {spell.name}<small>{spell.manaCost} MANA · {spell.currentCooldown ? `RECARGA ${spell.currentCooldown}` : spell.type.toUpperCase()}</small></span><button type="button" className="mini-action" disabled={busy || spell.currentCooldown > 0 || current.character.mana < spell.manaCost} onClick={() => void sendTurn('castSpell', undefined, { spellId: spell.id })}>USAR</button></li>)}</ul> : <p className="rep">Nenhuma magia aprendida.</p>}</section>}
          {panel === 'quests' && <section className="side-panel"><h3>OBJETIVOS EMERGENTES</h3>{current.campaign.quests.length ? current.campaign.quests.map(quest => <article className="quest" key={quest.id}><b>{quest.title}</b><span>{quest.status === 'completed' ? 'CONCLUÍDO' : quest.status === 'active' ? quest.description : quest.status.toUpperCase()}</span>{quest.objectives.map(objective => <small key={objective.id}>{objective.completed ? '✓' : '□'} {objective.text}</small>)}</article>) : <p className="rep">Nenhum objetivo foi imposto. Eles surgirão das suas escolhas.</p>}<hr /><h3>OPORTUNIDADES</h3>{current.campaign.opportunities.length ? current.campaign.opportunities.map(opportunity => <p className="journal-event" key={opportunity}>◇ {opportunity}</p>) : <p className="rep">O mundo ainda está revelando possibilidades.</p>}<hr /><h3>REPUTAÇÃO</h3><p className="rep">{location?.name || 'Local atual'} {current.world.reputation.cities[current.world.currentLocationId] || 0}<br />{location?.region || 'Região'} {current.world.reputation.regions[location?.region || ''] || 0}<br />Moral percebida {current.world.reputation.moral}</p></section>}
          {panel === 'journal' && <section className="side-panel"><h3>MEMÓRIA DA CAMPANHA</h3><p className="journal-summary">{current.campaign.memory.campaignSummary.text}</p><hr/><h3>ÂNCORA NARRATIVA</h3><p className="rep">{current.campaign.memory.anchor.currentObjective || 'Nenhum objetivo atual imposto.'}<br/>{current.campaign.memory.anchor.themes.join(' · ')}</p><hr/><h3>FATOS CANÔNICOS</h3>{current.campaign.memory.canon.slice(-5).reverse().map(fact => <p className="journal-event" key={fact.id}>{fact.text}</p>)}<hr/><h3>ÚLTIMOS ACONTECIMENTOS</h3>{current.world.timeline.slice(-6).reverse().map(event => <p className="journal-event" key={event.id}>D{current.world.day} · {event.text}</p>)}</section>}
          {panel === 'map' && <section className="side-panel"><h3>LOCAIS DESCOBERTOS</h3><ul>{Object.values(current.world.locations).filter(place => place.discovered).map(place => <li key={place.id}><span>{place.id === current.world.currentLocationId ? '◆' : '◇'} {place.name}</span><em>{place.region}</em></li>)}</ul><hr/><h3>PESSOAS PRESENTES</h3>{Object.values(current.world.npcs).filter(npc => npc.locationId === current.world.currentLocationId && npc.status === 'active').map(npc => <article className="quest" key={npc.id}><b>{npc.name}</b><span>{npc.role} · {npc.profession}</span><small>Relação: {npc.relationship}</small></article>)}{Object.values(current.world.npcs).filter(npc => npc.status !== 'active').length > 0 && <><hr/><h3>PESSOAS AUSENTES</h3>{Object.values(current.world.npcs).filter(npc => npc.status !== 'active').map(npc => <p className="journal-event" key={npc.id}>{npc.name} · {npc.status}</p>)}</>}<hr/><h3>CULTURA LOCAL</h3><p className="rep">{current.world.culture.name}<br/>{current.world.culture.notes}</p><hr/><h3>LOJA LOCAL</h3>{Object.values(current.world.economy.shops).filter(shop => shop.locationId === current.world.currentLocationId).map(shop => <article key={shop.id}><b className="shop-name">{shop.name}</b><ul>{shop.products.map(product => <li key={product.id}><span>{product.name} · {product.stock}</span><button type="button" className="mini-action" disabled={busy || product.stock < 1 || current.character.gold < productPrice(current, product)} onClick={() => void sendTurn('buyItem', undefined, { shopId: shop.id, productId: product.id })}>{productPrice(current, product)} G</button></li>)}</ul></article>)}</section>}
        </aside>
      </div>
      <ConsequencesLog events={current.session.events}/>
      <form className="action-form" onSubmit={submitAction}>
        <label>{pendingRoll ? `TESTE DE ${pendingRoll.attribute.toUpperCase()} + ${pendingRoll.skill.toUpperCase()}` : 'O QUE VOCÊ FAZ?'}</label>
        {pendingRoll
          ? <div className="roll-request"><small>Motivo: {pendingRoll.reason}<br/>Dificuldade: {difficultyLabel(pendingRoll.difficulty)} · CD {pendingRoll.difficulty}{pendingRoll.opposedBy ? ` · oposição: ${pendingRoll.opposedBy.label}` : ''}</small>{process.env.NODE_ENV !== 'production' && activeSkillAudit && <details className="skill-audit"><summary>AUDITORIA DO TESTE</summary><code>Ação: {activeSkillAudit.rawPlayerAction}<br/>Intenção: {activeSkillAudit.interpretedIntent}<br/>Domínio: {activeSkillAudit.domain}<br/>Proposta LLM: {activeSkillAudit.llmProposedAttribute || '—'} + {activeSkillAudit.llmProposedSkill || '—'}<br/>Validação: {activeSkillAudit.engineSelectedAttribute} + {activeSkillAudit.engineSelectedSkillName}<br/>Correções: {activeSkillAudit.corrections.join(' | ') || 'nenhuma'}<br/>CD: {activeSkillAudit.difficulty}</code></details>}<button type="button" className="roll-only" onClick={() => void sendTurn('roll')} disabled={busy}><span>⚄</span>{busy ? 'ROLANDO...' : 'ROLAR D20'}</button></div>
          : <div className="input-row"><input ref={actionInputRef} value={action} onChange={event => setAction(event.target.value)} maxLength={500} placeholder="Escreva qualquer ação..." disabled={busy} autoFocus /><button disabled={busy || !action.trim()}>{busy ? '...' : 'ENVIAR'}</button></div>}
      </form>
      <footer><span>AUTOSAVE · REVISÃO {current.save.revision}</span><span>{notice || 'CAMPANHA ATIVA'}</span></footer>
    </div>
  </main>;
}
